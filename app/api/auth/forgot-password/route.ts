export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getPool, sql } from "@/lib/mssql";
import { sendPasswordResetEmail } from "@/lib/email";
import crypto from "crypto";

export async function POST(req: NextRequest) {
    try {
        const { email } = await req.json();
        if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

        const db = await getPool();
        const res = await db.request()
            .input("email", sql.NVarChar(200), email.toLowerCase().trim())
            .query("SELECT user_id, display_name, email, is_active FROM users WHERE email = @email");

        // Always return success to prevent user enumeration
        if (!res.recordset[0] || !res.recordset[0].is_active) {
            return NextResponse.json({ ok: true });
        }

        const user = res.recordset[0];
        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        // Invalidate any existing tokens for this user
        await db.request()
            .input("uid", sql.Int, user.user_id)
            .query("UPDATE password_reset_tokens SET used_at = GETUTCDATE() WHERE user_id = @uid AND used_at IS NULL");

        // Insert new token
        await db.request()
            .input("uid",   sql.Int,        user.user_id)
            .input("token", sql.VarChar(64), token)
            .input("exp",   sql.DateTime2,   expiresAt)
            .query("INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (@uid, @token, @exp)");

        await sendPasswordResetEmail(user.email, user.display_name ?? "there", token);

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        console.error("Forgot password error:", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
