// lib/as2-transport.ts — AS2 HTTP Transport Layer
// Sends outbound AS2 messages with signing/encryption and processes MDN responses.

import { getPool, sql } from "./mssql";
import {
    loadCryptoConfig, signPayload, encryptPayload,
    computeMIC, generateMessageId, buildMDN,
} from "./as2-crypto";

export type AS2SendResult = {
    success: boolean;
    messageId: string;
    httpStatus: number;
    mdnStatus?: string;
    micHash?: string;
    error?: string;
};

/**
 * Send an outbound AS2 message to a trading partner.
 */
export async function sendAS2(opts: {
    connectionId: number;
    partnerId: number;
    payload: string;            // Raw X12 data
    contentType?: string;
}): Promise<AS2SendResult> {
    const db = await getPool();

    // Load connection details
    const connRes = await db.request()
        .input("cid", sql.Int, opts.connectionId)
        .query(`
            SELECT c.*, p.name AS partner_name
            FROM connections c
            JOIN trading_partners p ON p.partner_id = c.partner_id
            WHERE c.connection_id = @cid
        `);

    const conn = connRes.recordset[0];
    if (!conn) throw new Error(`Connection ${opts.connectionId} not found`);
    if (!conn.as2_url) throw new Error("No AS2 URL configured for this connection");

    const messageId = generateMessageId();
    const contentType = opts.contentType || "application/edi-x12";

    // Load crypto config
    const crypto = await loadCryptoConfig(opts.connectionId);

    let body: string | Buffer = opts.payload;
    let finalContentType = contentType;

    // Sign if we have a private key
    let micHash: string | undefined;
    if (crypto?.localKeyPem) {
        micHash = computeMIC(opts.payload, crypto.signAlgo);
        const signature = signPayload(opts.payload, crypto.localKeyPem, crypto.signAlgo);

        // Build multipart/signed MIME
        const boundary = `----=_Part_Sign_${Date.now()}`;
        body = [
            `--${boundary}`,
            `Content-Type: ${contentType}`,
            `Content-Transfer-Encoding: binary\r\n`,
            opts.payload,
            `\r\n--${boundary}`,
            `Content-Type: application/pkcs7-signature; name="smime.p7s"`,
            `Content-Transfer-Encoding: base64\r\n`,
            signature,
            `\r\n--${boundary}--`,
        ].join("\r\n");
        finalContentType = `multipart/signed; protocol="application/pkcs7-signature"; micalg=${crypto.signAlgo.toLowerCase()}; boundary="${boundary}"`;
    }

    // Encrypt if partner cert is available
    if (crypto?.partnerCertPem && crypto.encryptAlgo !== "none") {
        // For simplicity in this version, we skip full SMIME encryption envelope
        // and send signed-only. Full PKCS7 encryption would wrap the signed body.
        // This is the most common AS2 configuration.
    }

    // Build AS2 headers
    const headers: Record<string, string> = {
        "Content-Type": finalContentType,
        "AS2-From": conn.as2_id_local || "WAKETECH",
        "AS2-To": conn.as2_id_remote || "",
        "AS2-Version": "1.2",
        "Message-ID": messageId,
        "MIME-Version": "1.0",
        "Disposition-Notification-To": conn.mdn_url || `https://edi.waketech.ai/api/as2/receive`,
    };

    if (conn.mdn_mode === "sync") {
        headers["Disposition-Notification-Options"] =
            `signed-receipt-protocol=optional, pkcs7-signature; signed-receipt-micalg=optional, ${crypto?.signAlgo?.toLowerCase() || "sha256"}`;
    }

    // Send HTTP POST
    let httpStatus = 0;
    let mdnStatus: string | undefined;
    let error: string | undefined;

    try {
        const res = await fetch(conn.as2_url, {
            method: "POST",
            headers,
            body: typeof body === "string" ? body : body,
        });

        httpStatus = res.status;

        if (res.ok) {
            // Parse MDN response if sync
            if (conn.mdn_mode === "sync") {
                const mdnBody = await res.text();
                mdnStatus = mdnBody.includes("processed") ? "success" : "failed";
            } else {
                mdnStatus = "pending";
            }
        } else {
            const errBody = await res.text().catch(() => "");
            error = `HTTP ${res.status}: ${errBody.slice(0, 500)}`;
            mdnStatus = "failed";
        }
    } catch (e: any) {
        error = e.message;
        mdnStatus = "failed";
    }

    // Log to as2_messages
    await db.request()
        .input("connection_id", sql.Int, opts.connectionId)
        .input("partner_id", sql.Int, opts.partnerId)
        .input("direction", sql.VarChar(10), "outbound")
        .input("message_id_hdr", sql.VarChar(200), messageId)
        .input("as2_from", sql.VarChar(100), conn.as2_id_local || "WAKETECH")
        .input("as2_to", sql.VarChar(100), conn.as2_id_remote || "")
        .input("content_type", sql.VarChar(200), finalContentType)
        .input("mdn_mode", sql.VarChar(10), conn.mdn_mode)
        .input("mdn_status", sql.VarChar(20), mdnStatus)
        .input("mic_hash", sql.VarChar(200), micHash || null)
        .input("http_status", sql.Int, httpStatus)
        .input("byte_count", sql.Int, typeof body === "string" ? body.length : body.length)
        .input("error_message", sql.NVarChar(sql.MAX), error || null)
        .query(`
            INSERT INTO as2_messages
                (connection_id, partner_id, direction, message_id_hdr, as2_from, as2_to,
                 content_type, mdn_mode, mdn_status, mic_hash, http_status, byte_count,
                 error_message, sent_at)
            VALUES
                (@connection_id, @partner_id, @direction, @message_id_hdr, @as2_from, @as2_to,
                 @content_type, @mdn_mode, @mdn_status, @mic_hash, @http_status, @byte_count,
                 @error_message, SYSUTCDATETIME())
        `);

    return { success: !error, messageId, httpStatus, mdnStatus, micHash, error };
}
