export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { getPool } from "@/lib/mssql";

export async function GET() {
    try {
        const db = await getPool();

        const partners = await db.request().query(`
            SELECT COUNT(*) AS total,
                   SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active
            FROM trading_partners WHERE org_id = 1
        `);

        const volume = await db.request().query(`
            SELECT
                COUNT(*) AS total_7d,
                SUM(CASE WHEN direction = 'inbound' THEN 1 ELSE 0 END) AS inbound_7d,
                SUM(CASE WHEN direction = 'outbound' THEN 1 ELSE 0 END) AS outbound_7d,
                SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS errors_7d,
                SUM(CASE WHEN status = 'processed' THEN 1 ELSE 0 END) AS processed_7d
            FROM edi_transactions
            WHERE received_at >= DATEADD(day, -7, SYSUTCDATETIME())
        `);

        const today = await db.request().query(`
            SELECT COUNT(*) AS total_today,
                   SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS errors_today
            FROM edi_transactions
            WHERE received_at >= CAST(SYSUTCDATETIME() AS DATE)
        `);

        const byTxSet = await db.request().query(`
            SELECT tx_set, direction, COUNT(*) AS cnt
            FROM edi_transactions
            WHERE received_at >= DATEADD(day, -7, SYSUTCDATETIME())
            GROUP BY tx_set, direction ORDER BY cnt DESC
        `);

        const recent = await db.request().query(`
            SELECT TOP 10 t.transaction_id, t.tx_set, t.direction, t.status, t.received_at,
                   p.name AS partner_name
            FROM edi_transactions t
            LEFT JOIN trading_partners p ON p.partner_id = t.partner_id
            ORDER BY t.received_at DESC
        `);

        const connections = await db.request().query(`
            SELECT COUNT(*) AS total,
                   SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active
            FROM connections
        `);

        return NextResponse.json({
            partners: partners.recordset[0],
            volume: volume.recordset[0],
            today: today.recordset[0],
            byTxSet: byTxSet.recordset,
            recent: recent.recordset,
            connections: connections.recordset[0],
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
