export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { processInbound } from "@/lib/edi-processor";

/**
 * AS2 Receive Endpoint
 * POST /api/as2/receive
 *
 * Accepts inbound AS2/EDI messages.
 * No auth required — AS2 partners POST directly to this URL.
 * Partner identity is verified via ISA envelope identifiers.
 *
 * Content-Type: application/edi-x12 or multipart/signed (for signed AS2)
 */
export async function POST(req: NextRequest) {
    try {
        const contentType = req.headers.get("content-type") || "";
        let rawData: string;

        // Handle different content types
        if (contentType.includes("multipart")) {
            // Signed/encrypted AS2 — for now, extract the text payload
            // Full SMIME handling will be added when we have the crypto layer
            const text = await req.text();
            // Strip MIME headers to get to the X12 payload
            const isaIndex = text.indexOf("ISA");
            rawData = isaIndex >= 0 ? text.slice(isaIndex) : text;
        } else {
            rawData = await req.text();
        }

        if (!rawData || !rawData.includes("ISA")) {
            return NextResponse.json({ error: "No valid X12 data found in request" }, { status: 400 });
        }

        // Extract AS2 headers for logging
        const as2From = req.headers.get("as2-from") || "";
        const as2To = req.headers.get("as2-to") || "";
        const messageId = req.headers.get("message-id") || "";

        // Process the EDI
        const result = await processInbound(rawData);

        // Build MDN response
        if (result.success) {
            return new NextResponse(
                `Message received and processed. Interchange: ${result.interchange_id}. ` +
                `Transactions: ${result.transactions_processed} processed, ${result.transactions_failed} failed.`,
                {
                    status: 200,
                    headers: {
                        "Content-Type": "text/plain",
                        "AS2-From": as2To,
                        "AS2-To": as2From,
                    },
                }
            );
        } else {
            return new NextResponse(
                `Processing errors: ${result.errors.join("; ")}`,
                {
                    status: 200, // AS2 still returns 200 even on processing errors
                    headers: {
                        "Content-Type": "text/plain",
                        "AS2-From": as2To,
                        "AS2-To": as2From,
                    },
                }
            );
        }
    } catch (e: any) {
        console.error("AS2 receive error:", e);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

/**
 * GET /api/as2/receive — health check for AS2 endpoint.
 */
export async function GET() {
    return NextResponse.json({
        status: "ok",
        service: "WakeEDI AS2 Receiver",
        endpoint: "/api/as2/receive",
        accepts: ["application/edi-x12", "application/edifact", "multipart/signed"],
    });
}
