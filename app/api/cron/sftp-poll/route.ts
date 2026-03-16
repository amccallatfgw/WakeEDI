export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { pollAllSFTP } from "@/lib/sftp-poller";

/**
 * GET /api/cron/sftp-poll
 * Trigger SFTP polling for all active SFTP connections.
 * Called by cron job or manually. Protected by internal API key.
 */
export async function GET(req: NextRequest) {
    // Verify internal API key (cron jobs use this)
    const apiKey = req.headers.get("x-internal-api-key");
    const expectedKey = process.env.INTERNAL_API_KEY;

    if (expectedKey && apiKey !== expectedKey) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const results = await pollAllSFTP();

        const totalFound = results.reduce((s, r) => s + r.filesFound, 0);
        const totalProcessed = results.reduce((s, r) => s + r.filesProcessed, 0);
        const totalFailed = results.reduce((s, r) => s + r.filesFailed, 0);

        return NextResponse.json({
            success: true,
            connections_polled: results.length,
            total_files_found: totalFound,
            total_files_processed: totalProcessed,
            total_files_failed: totalFailed,
            results,
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
