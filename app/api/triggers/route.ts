export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getPool, sql } from "@/lib/mssql";
import { requireAuth } from "@/lib/authorize";

export async function GET() {
    try {
        requireAuth();
        const db = await getPool();
        const result = await db.request().query(`
            SELECT t.*, p.name AS partner_name
            FROM edi_triggers t
            LEFT JOIN trading_partners p ON p.partner_id = t.partner_id
            ORDER BY t.name
        `);
        return NextResponse.json({ triggers: result.recordset });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        requireAuth();
        const body = await req.json();
        const db = await getPool();
        const r = db.request();
        r.input("partner_id", sql.Int, parseInt(body.partner_id));
        r.input("name", sql.NVarChar(100), body.name);
        r.input("description", sql.NVarChar(500), body.description ?? null);
        r.input("source_app", sql.VarChar(50), body.source_app ?? "freightwake");
        r.input("source_event", sql.VarChar(50), body.source_event);
        r.input("tx_set", sql.VarChar(3), body.tx_set);

        const result = await r.query(`
            INSERT INTO edi_triggers (partner_id, name, description, source_app, source_event, tx_set)
            OUTPUT INSERTED.trigger_id
            VALUES (@partner_id, @name, @description, @source_app, @source_event, @tx_set)
        `);
        return NextResponse.json({ trigger_id: result.recordset[0].trigger_id }, { status: 201 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
    }
}
