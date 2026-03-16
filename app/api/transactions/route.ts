export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getPool, sql } from "@/lib/mssql";
import { requireAuth } from "@/lib/authorize";

export async function GET(req: NextRequest) {
    try {
        requireAuth();
        const { searchParams } = new URL(req.url);
        const txSet     = searchParams.get("txSet") ?? "";
        const status    = searchParams.get("status") ?? "";
        const direction = searchParams.get("direction") ?? "";
        const partnerId = searchParams.get("partnerId") ?? "";
        const page      = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
        const size      = Math.min(100, parseInt(searchParams.get("size") ?? "50"));
        const offset    = (page - 1) * size;

        const db = await getPool();
        const r = db.request();
        let where = "WHERE 1=1";

        if (txSet)     { r.input("txSet", txSet); where += " AND t.tx_set = @txSet"; }
        if (status)    { r.input("status", status); where += " AND t.status = @status"; }
        if (direction) { r.input("dir", direction); where += " AND t.direction = @dir"; }
        if (partnerId) { r.input("pid", sql.Int, parseInt(partnerId)); where += " AND t.partner_id = @pid"; }

        r.input("size", sql.Int, size);
        r.input("offset", sql.Int, offset);

        const result = await r.query(`
            SELECT t.transaction_id, t.tx_set, t.st_control, t.direction, t.status,
                   t.target_entity, t.target_id, t.segment_count, t.error_message,
                   t.received_at, t.processed_at,
                   p.name AS partner_name, p.isa_id AS partner_isa,
                   i.isa_control,
                   COUNT(*) OVER() AS total_count
            FROM edi_transactions t
            LEFT JOIN trading_partners p ON p.partner_id = t.partner_id
            LEFT JOIN edi_interchanges i ON i.interchange_id = t.interchange_id
            ${where}
            ORDER BY t.received_at DESC
            OFFSET @offset ROWS FETCH NEXT @size ROWS ONLY
        `);

        // Weekly stats
        const stats = await db.request().query(`
            SELECT tx_set, direction, status, COUNT(*) AS cnt
            FROM edi_transactions
            WHERE received_at >= DATEADD(day, -7, SYSUTCDATETIME())
            GROUP BY tx_set, direction, status
        `);

        return NextResponse.json({
            transactions: result.recordset,
            total: result.recordset[0]?.total_count ?? 0,
            stats: stats.recordset,
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
    }
}
