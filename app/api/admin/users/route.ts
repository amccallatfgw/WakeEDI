export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getPool, sql } from "@/lib/mssql";
import { requireAdmin } from "@/lib/authorize";
import { hashPassword } from "@/lib/auth";

export async function GET() {
    try {
        requireAdmin();
        const db = await getPool();
        const res = await db.request().query(`
            SELECT user_id, email, display_name, role, is_active, last_login_at, created_at
            FROM users WHERE org_id = 1
            ORDER BY created_at DESC
        `);
        return NextResponse.json({ users: res.recordset });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        requireAdmin();
        const body = await req.json();
        const { email, display_name, role, password } = body;

        if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });

        const db = await getPool();

        // Check for existing user
        const exists = await db.request()
            .input("email", sql.NVarChar(200), email.toLowerCase().trim())
            .query("SELECT user_id FROM users WHERE email = @email AND org_id = 1");

        if (exists.recordset.length > 0) {
            return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
        }

        const hash = password ? await hashPassword(password) : null;

        const res = await db.request()
            .input("org_id",       sql.Int,          1)
            .input("email",        sql.NVarChar(200), email.toLowerCase().trim())
            .input("display_name", sql.NVarChar(100), display_name ?? null)
            .input("password_hash",sql.NVarChar(500), hash)
            .input("role",         sql.NVarChar(50),  role ?? "user")
            .query(`
                INSERT INTO users (org_id, email, display_name, password_hash, role)
                OUTPUT INSERTED.user_id
                VALUES (@org_id, @email, @display_name, @password_hash, @role)
            `);

        return NextResponse.json({ user_id: res.recordset[0].user_id });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
    }
}
