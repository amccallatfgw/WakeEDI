export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { getPool } from "@/lib/mssql";

export async function GET() {
    try {
        const db = await getPool();

        const usersRes = await db.request().query(`
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active
            FROM users WHERE org_id = 1
        `);

        return NextResponse.json({
            users: usersRes.recordset[0],
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
