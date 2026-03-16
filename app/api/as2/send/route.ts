export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authorize";
import { sendAS2 } from "@/lib/as2-transport";

/**
 * POST /api/as2/send
 * Send an outbound AS2 message to a trading partner.
 * Body: { connectionId, partnerId, payload }
 */
export async function POST(req: NextRequest) {
    try {
        requireAuth();
        const body = await req.json();

        if (!body.connectionId || !body.partnerId || !body.payload) {
            return NextResponse.json({ error: "connectionId, partnerId, and payload are required" }, { status: 400 });
        }

        const result = await sendAS2({
            connectionId: body.connectionId,
            partnerId: body.partnerId,
            payload: body.payload,
        });

        return NextResponse.json(result);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
    }
}
