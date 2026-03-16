// lib/sftp-poller.ts — SFTP Polling Engine
// Connects to trading partner SFTP servers, downloads new .edi files,
// feeds them through the EDI processor pipeline, moves to /processed.
//
// Also supports outbound SFTP push for partners who receive via SFTP.
//
// Note: Requires 'ssh2-sftp-client' package. Install with:
//   npm install ssh2-sftp-client && npm install -D @types/ssh2-sftp-client

import { getPool, sql } from "./mssql";
import { processInbound } from "./edi-processor";

export type PollResult = {
    connectionId: number;
    partnerName: string;
    filesFound: number;
    filesProcessed: number;
    filesFailed: number;
    errors: string[];
};

/**
 * Poll all active SFTP connections for new EDI files.
 */
export async function pollAllSFTP(): Promise<PollResult[]> {
    const db = await getPool();
    const results: PollResult[] = [];

    // Get all active SFTP connections
    const connRes = await db.request().query(`
        SELECT c.connection_id, c.partner_id, c.sftp_host, c.sftp_port,
               c.sftp_user, c.sftp_path, p.name AS partner_name
        FROM connections c
        JOIN trading_partners p ON p.partner_id = c.partner_id
        WHERE c.protocol = 'SFTP' AND c.is_active = 1
            AND c.sftp_host IS NOT NULL AND c.sftp_host != ''
    `);

    for (const conn of connRes.recordset) {
        const result = await pollSingleSFTP(conn);
        results.push(result);
    }

    return results;
}

/**
 * Poll a single SFTP connection.
 */
async function pollSingleSFTP(conn: any): Promise<PollResult> {
    const result: PollResult = {
        connectionId: conn.connection_id,
        partnerName: conn.partner_name,
        filesFound: 0,
        filesProcessed: 0,
        filesFailed: 0,
        errors: [],
    };

    let SftpClient: any;
    try {
        SftpClient = require("ssh2-sftp-client");
    } catch {
        result.errors.push("ssh2-sftp-client not installed. Run: npm install ssh2-sftp-client");
        return result;
    }

    const sftp = new SftpClient();

    try {
        await sftp.connect({
            host: conn.sftp_host,
            port: conn.sftp_port || 22,
            username: conn.sftp_user,
            // Password or key would come from a secure store
            // For now, check for SFTP_PASS_{CONNECTION_ID} env var
            password: process.env[`SFTP_PASS_${conn.connection_id}`] || process.env.SFTP_DEFAULT_PASS,
        });

        const remotePath = conn.sftp_path || "/inbound";
        const processedPath = `${remotePath}/processed`;

        // Ensure processed directory exists
        try {
            await sftp.mkdir(processedPath, true);
        } catch { /* may already exist */ }

        // List files in inbound directory
        const files = await sftp.list(remotePath);
        const ediFiles = files.filter((f: any) =>
            f.type === "-" && (
                f.name.endsWith(".edi") ||
                f.name.endsWith(".x12") ||
                f.name.endsWith(".txt") ||
                f.name.endsWith(".EDI") ||
                f.name.endsWith(".X12")
            )
        );

        result.filesFound = ediFiles.length;

        for (const file of ediFiles) {
            try {
                const filePath = `${remotePath}/${file.name}`;
                const content = await sftp.get(filePath);
                const rawData = content.toString("utf-8");

                if (!rawData.includes("ISA")) {
                    result.errors.push(`${file.name}: No ISA segment found, skipping`);
                    result.filesFailed++;
                    continue;
                }

                // Process through standard EDI pipeline
                const processResult = await processInbound(rawData, conn.connection_id);

                if (processResult.success) {
                    // Move to processed folder
                    try {
                        await sftp.rename(filePath, `${processedPath}/${file.name}`);
                    } catch {
                        // If rename fails, try delete (some SFTP servers don't support rename)
                        try { await sftp.delete(filePath); } catch {}
                    }
                    result.filesProcessed++;
                } else {
                    result.errors.push(`${file.name}: ${processResult.errors.join("; ")}`);
                    result.filesFailed++;
                    // Move to error folder if processing failed
                    const errorPath = `${remotePath}/error`;
                    try {
                        await sftp.mkdir(errorPath, true);
                        await sftp.rename(filePath, `${errorPath}/${file.name}`);
                    } catch {}
                }
            } catch (e: any) {
                result.errors.push(`${file.name}: ${e.message}`);
                result.filesFailed++;
            }
        }
    } catch (e: any) {
        result.errors.push(`Connection failed: ${e.message}`);
    } finally {
        try { await sftp.end(); } catch {}
    }

    // Update last_test on connection
    const db = await getPool();
    await db.request()
        .input("cid", sql.Int, conn.connection_id)
        .input("ok", sql.Bit, result.errors.length === 0 ? 1 : 0)
        .query("UPDATE connections SET last_test_at = SYSUTCDATETIME(), last_test_ok = @ok WHERE connection_id = @cid");

    return result;
}

/**
 * Push a file to a partner's SFTP server (outbound).
 */
export async function pushSFTP(opts: {
    connectionId: number;
    filename: string;
    content: string;
}): Promise<{ success: boolean; error?: string }> {
    const db = await getPool();
    const connRes = await db.request()
        .input("cid", sql.Int, opts.connectionId)
        .query("SELECT * FROM connections WHERE connection_id = @cid AND protocol = 'SFTP'");

    const conn = connRes.recordset[0];
    if (!conn) return { success: false, error: "Connection not found or not SFTP" };

    let SftpClient: any;
    try {
        SftpClient = require("ssh2-sftp-client");
    } catch {
        return { success: false, error: "ssh2-sftp-client not installed" };
    }

    const sftp = new SftpClient();

    try {
        await sftp.connect({
            host: conn.sftp_host,
            port: conn.sftp_port || 22,
            username: conn.sftp_user,
            password: process.env[`SFTP_PASS_${conn.connection_id}`] || process.env.SFTP_DEFAULT_PASS,
        });

        const outPath = conn.sftp_path?.replace("/inbound", "/outbound") || "/outbound";
        try { await sftp.mkdir(outPath, true); } catch {}

        await sftp.put(Buffer.from(opts.content), `${outPath}/${opts.filename}`);

        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    } finally {
        try { await sftp.end(); } catch {}
    }
}
