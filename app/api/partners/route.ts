export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getPool, sql } from "@/lib/mssql";
import { requireAuth } from "@/lib/authorize";

export async function GET(req: NextRequest) {
    try {
        requireAuth();
        const { searchParams } = new URL(req.url);
        const search = searchParams.get("search") ?? "";
        const active = searchParams.get("active");

        const db = await getPool();
        const r = db.request();
        let where = "WHERE org_id = 1";
        if (search) { r.input("q", `%${search}%`); where += " AND (name LIKE @q OR isa_id LIKE @q OR scac_code LIKE @q)"; }
        if (active === "true") where += " AND is_active = 1";
        if (active === "false") where += " AND is_active = 0";

        const result = await r.query(`
            SELECT p.*,
                (SELECT COUNT(*) FROM connections c WHERE c.partner_id = p.partner_id AND c.is_active = 1) AS active_connections,
                (SELECT COUNT(*) FROM partner_transaction_sets pts WHERE pts.partner_id = p.partner_id AND pts.is_active = 1) AS tx_set_count,
                (SELECT COUNT(*) FROM edi_interchanges i WHERE i.partner_id = p.partner_id AND i.received_at >= DATEADD(day,-7,SYSUTCDATETIME())) AS week_volume
            FROM trading_partners p
            ${where}
            ORDER BY p.name
        `);

        return NextResponse.json({ partners: result.recordset });
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
        r.input("org_id", sql.Int, 1);
        r.input("name", sql.NVarChar(200), body.name);
        r.input("isa_id", sql.VarChar(15), body.isa_id);
        r.input("isa_qualifier", sql.VarChar(2), body.isa_qualifier ?? "ZZ");
        r.input("gs_id", sql.VarChar(15), body.gs_id ?? null);
        r.input("scac_code", sql.VarChar(4), body.scac_code ?? null);
        r.input("contact_name", sql.NVarChar(100), body.contact_name ?? null);
        r.input("contact_email", sql.NVarChar(200), body.contact_email ?? null);
        r.input("contact_phone", sql.VarChar(30), body.contact_phone ?? null);
        r.input("notes", sql.NVarChar(sql.MAX), body.notes ?? null);
        r.input("target_app", sql.VarChar(50), body.target_app ?? "freightwake");
        r.input("target_db", sql.VarChar(100), body.target_db ?? null);

        const result = await r.query(`
            INSERT INTO trading_partners
                (org_id, name, isa_id, isa_qualifier, gs_id, scac_code, contact_name,
                 contact_email, contact_phone, notes, target_app, target_db)
            OUTPUT INSERTED.partner_id
            VALUES
                (@org_id, @name, @isa_id, @isa_qualifier, @gs_id, @scac_code, @contact_name,
                 @contact_email, @contact_phone, @notes, @target_app, @target_db)
        `);

        return NextResponse.json({ partner_id: result.recordset[0].partner_id }, { status: 201 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
    }
}
