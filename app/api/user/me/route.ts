export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authorize";
import { getPool } from "@/lib/mssql";

export async function GET() {
    try {
        const auth = requireAuth();
        const db = await getPool();
        const res = await db.request()
            .input("uid", auth.userId)
            .query(`
                SELECT user_id, email, display_name, role, is_active, last_login_at, created_at
                FROM users WHERE user_id = @uid
            `);
        const user = res.recordset[0];
        if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
        return NextResponse.json(user);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
    }
}
