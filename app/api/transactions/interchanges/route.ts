export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getPool, sql } from "@/lib/mssql";
import { requireAuth } from "@/lib/authorize";

export async function GET(req: NextRequest) {
    try {
        requireAuth();
        const { searchParams } = new URL(req.url);
        const direction = searchParams.get("direction") ?? "";
        const status = searchParams.get("status") ?? "";
        const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
        const size = Math.min(100, parseInt(searchParams.get("size") ?? "50"));
        const offset = (page - 1) * size;

        const db = await getPool();
        const r = db.request();
        let where = "WHERE 1=1";
        if (direction) { r.input("dir", direction); where += " AND i.direction = @dir"; }
        if (status) { r.input("status", status); where += " AND i.status = @status"; }
        r.input("size", sql.Int, size);
        r.input("offset", sql.Int, offset);

        const result = await r.query(`
            SELECT i.*, p.name AS partner_name,
                (SELECT COUNT(*) FROM edi_transactions t WHERE t.interchange_id = i.interchange_id) AS tx_count,
                COUNT(*) OVER() AS total_count
            FROM edi_interchanges i
            LEFT JOIN trading_partners p ON p.partner_id = i.partner_id
            ${where}
            ORDER BY i.received_at DESC
            OFFSET @offset ROWS FETCH NEXT @size ROWS ONLY
        `);

        return NextResponse.json({
            interchanges: result.recordset,
            total: result.recordset[0]?.total_count ?? 0,
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
    }
}
