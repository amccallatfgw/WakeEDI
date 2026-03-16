export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { processInbound } from "@/lib/edi-processor";
import { computeMIC, buildMDN, verifySignature } from "@/lib/as2-crypto";
import { getPool, sql } from "@/lib/mssql";

/**
 * POST /api/as2/receive — Inbound AS2 endpoint
 * Trading partners POST X12 data here. No auth — partner identified by ISA envelope.
 * Supports: plain X12, multipart/signed, content-type detection.
 * Returns: MDN (Message Disposition Notification) per AS2 spec.
 */
export async function POST(req: NextRequest) {
    const as2From = req.headers.get("as2-from")?.replace(/"/g, "") || "";
    const as2To = req.headers.get("as2-to")?.replace(/"/g, "") || "";
    const messageId = req.headers.get("message-id") || `<unknown-${Date.now()}>`;
    const contentType = req.headers.get("content-type") || "";

    try {
        const rawBody = await req.text();

        // Extract X12 payload from body
        let x12Data: string;
        let signature: string | null = null;

        if (contentType.includes("multipart/signed")) {
            // Signed AS2 — extract the X12 payload and signature from MIME parts
            const boundaryMatch = contentType.match(/boundary="?([^";]+)"?/);
            const boundary = boundaryMatch?.[1];

            if (boundary) {
                const parts = rawBody.split(`--${boundary}`).filter(p => p.trim() && !p.trim().startsWith("--"));
                // First part is the payload, second is the signature
                const payloadPart = parts[0] || "";
                const sigPart = parts[1] || "";

                // Strip MIME headers from payload part
                const payloadBodyStart = payloadPart.indexOf("\r\n\r\n");
                x12Data = payloadBodyStart >= 0 ? payloadPart.slice(payloadBodyStart + 4).trim() : payloadPart.trim();

                // Extract base64 signature
                const sigBodyStart = sigPart.indexOf("\r\n\r\n");
                signature = sigBodyStart >= 0 ? sigPart.slice(sigBodyStart + 4).trim() : null;
            } else {
                const isaIdx = rawBody.indexOf("ISA");
                x12Data = isaIdx >= 0 ? rawBody.slice(isaIdx) : rawBody;
            }
        } else {
            // Plain X12 or other content type
            const isaIdx = rawBody.indexOf("ISA");
            x12Data = isaIdx >= 0 ? rawBody.slice(isaIdx) : rawBody;
        }

        if (!x12Data || !x12Data.includes("ISA")) {
            const mdn = buildMDN({
                originalMessageId: messageId, as2From: as2To, as2To: as2From,
                status: "failed", errorMessage: "No valid X12 data found",
            });
            return new NextResponse(mdn.body, {
                status: 200,
                headers: { "Content-Type": mdn.contentType, "AS2-From": as2To, "AS2-To": as2From },
            });
        }

        // Compute MIC before processing
        const micHash = computeMIC(x12Data, "SHA256");

        // Log inbound AS2 message
        const db = await getPool();
        await db.request()
            .input("direction", sql.VarChar(10), "inbound")
            .input("message_id_hdr", sql.VarChar(200), messageId)
            .input("as2_from", sql.VarChar(100), as2From)
            .input("as2_to", sql.VarChar(100), as2To)
            .input("content_type", sql.VarChar(200), contentType)
            .input("mic_hash", sql.VarChar(200), micHash)
            .input("byte_count", sql.Int, rawBody.length)
            .input("connection_id", sql.Int, 0)
            .input("partner_id", sql.Int, 0)
            .query(`
                INSERT INTO as2_messages
                    (connection_id, partner_id, direction, message_id_hdr, as2_from, as2_to,
                     content_type, mic_hash, byte_count, received_at)
                VALUES
                    (@connection_id, @partner_id, @direction, @message_id_hdr, @as2_from, @as2_to,
                     @content_type, @mic_hash, @byte_count, SYSUTCDATETIME())
            `);

        // Process the EDI through the standard pipeline
        const result = await processInbound(x12Data);

        // Build MDN response
        const mdn = buildMDN({
            originalMessageId: messageId,
            as2From: as2To,
            as2To: as2From,
            status: result.success ? "processed" : "failed",
            micHash,
            micAlgo: "sha256",
            errorMessage: result.errors.length > 0 ? result.errors[0] : undefined,
        });

        return new NextResponse(mdn.body, {
            status: 200,
            headers: {
                "Content-Type": mdn.contentType,
                "AS2-From": as2To,
                "AS2-To": as2From,
                "Message-ID": `<mdn-${Date.now()}@edi.waketech.ai>`,
            },
        });

    } catch (e: any) {
        console.error("AS2 receive error:", e);
        const mdn = buildMDN({
            originalMessageId: messageId, as2From: as2To, as2To: as2From,
            status: "failed", errorMessage: e.message,
        });
        return new NextResponse(mdn.body, {
            status: 200,
            headers: { "Content-Type": mdn.contentType },
        });
    }
}

/** GET /api/as2/receive — Health check */
export async function GET() {
    return NextResponse.json({
        status: "ok",
        service: "WakeEDI AS2 Receiver",
        endpoint: "/api/as2/receive",
        accepts: ["application/edi-x12", "multipart/signed"],
        version: "2.0",
    });
}
