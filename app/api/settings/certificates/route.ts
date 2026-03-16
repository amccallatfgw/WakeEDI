export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getPool, sql } from "@/lib/mssql";
import { requireAuth } from "@/lib/authorize";

export async function GET() {
    try {
        requireAuth();
        const db = await getPool();
        const result = await db.request().query(`
            SELECT c.*, p.name AS partner_name
            FROM cert_store c
            LEFT JOIN trading_partners p ON p.partner_id = c.partner_id
            ORDER BY c.label
        `);
        return NextResponse.json({ certificates: result.recordset });
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
        r.input("partner_id", sql.Int, body.partner_id ? parseInt(body.partner_id) : null);
        r.input("label", sql.NVarChar(100), body.label);
        r.input("cert_type", sql.VarChar(20), body.cert_type ?? "public");
        r.input("pem_data", sql.NVarChar(sql.MAX), body.pem_data);

        const result = await r.query(`
            INSERT INTO cert_store (partner_id, label, cert_type, pem_data)
            OUTPUT INSERTED.cert_id
            VALUES (@partner_id, @label, @cert_type, @pem_data)
        `);
        return NextResponse.json({ cert_id: result.recordset[0].cert_id }, { status: 201 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
    }
}
