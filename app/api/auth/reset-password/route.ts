export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getPool, sql } from "@/lib/mssql";
import { hashPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
    try {
        const { token, password } = await req.json();
        if (!token || !password) return NextResponse.json({ error: "Token and password required" }, { status: 400 });
        if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });

        const db = await getPool();

        const res = await db.request()
            .input("token", sql.VarChar(64), token)
            .query(`
                SELECT t.token_id, t.user_id, t.expires_at, t.used_at, u.email, u.display_name
                FROM password_reset_tokens t
                JOIN users u ON u.user_id = t.user_id
                WHERE t.token = @token
            `);

        const record = res.recordset[0];

        if (!record) return NextResponse.json({ error: "Invalid or expired reset link." }, { status: 400 });
        if (record.used_at) return NextResponse.json({ error: "This reset link has already been used." }, { status: 400 });
        if (new Date(record.expires_at) < new Date()) return NextResponse.json({ error: "This reset link has expired." }, { status: 400 });

        const hash = await hashPassword(password);

        await db.request()
            .input("uid",  sql.Int,          record.user_id)
            .input("hash", sql.NVarChar(500), hash)
            .query("UPDATE users SET password_hash = @hash, failed_logins = 0, locked_until = NULL WHERE user_id = @uid");

        await db.request()
            .input("tid", sql.Int, record.token_id)
            .query("UPDATE password_reset_tokens SET used_at = GETUTCDATE() WHERE token_id = @tid");

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        console.error("Reset password error:", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

// GET — validate token
export async function GET(req: NextRequest) {
    try {
        const token = req.nextUrl.searchParams.get("token");
        if (!token) return NextResponse.json({ valid: false });

        const db = await getPool();
        const res = await db.request()
            .input("token", sql.VarChar(64), token)
            .query(`
                SELECT t.expires_at, t.used_at, u.display_name
                FROM password_reset_tokens t
                JOIN users u ON u.user_id = t.user_id
                WHERE t.token = @token
            `);

        const record = res.recordset[0];
        if (!record || record.used_at || new Date(record.expires_at) < new Date()) {
            return NextResponse.json({ valid: false });
        }

        return NextResponse.json({ valid: true, name: record.display_name });
    } catch {
        return NextResponse.json({ valid: false });
    }
}
