export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getPool } from "@/lib/mssql";
import { verifyPassword, signJWT } from "@/lib/auth";

export async function POST(req: Request) {
    try {
        const { email, password } = await req.json();

        if (!email || !password) {
            return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
        }

        const db = await getPool();

        const lockResult = await db.request()
            .input("Email", email)
            .query(`
                SELECT user_id, email, display_name, role, is_active,
                       password_hash, failed_logins, locked_until
                FROM users
                WHERE email = @Email AND org_id = 1
            `);

        const user = lockResult.recordset[0];

        if (!user) {
            return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
        }

        if (!user.is_active) {
            return NextResponse.json({ error: "Account is disabled." }, { status: 403 });
        }

        if (user.locked_until && new Date(user.locked_until) > new Date()) {
            return NextResponse.json({ error: "Account is temporarily locked. Try again later." }, { status: 423 });
        }

        if (!user.password_hash) {
            return NextResponse.json({ error: "Account not configured. Contact administrator." }, { status: 403 });
        }

        const ok = await verifyPassword(user.password_hash, password);

        if (!ok) {
            const newFailed = (user.failed_logins || 0) + 1;
            const lockUntil = newFailed >= 5
                ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
                : null;

            await db.request()
                .input("UserId", user.user_id)
                .input("FailedLogins", newFailed)
                .input("LockedUntil", lockUntil)
                .query(`
                    UPDATE users
                    SET failed_logins = @FailedLogins, locked_until = @LockedUntil
                    WHERE user_id = @UserId
                `);

            return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
        }

        // Success — reset failed logins, update last login
        await db.request()
            .input("UserId", user.user_id)
            .query(`
                UPDATE users
                SET failed_logins = 0, locked_until = NULL, last_login_at = SYSUTCDATETIME()
                WHERE user_id = @UserId
            `);

        const ROLE_MAP: Record<string, number> = {
            admin: 1, manager: 2, user: 3, readonly: 4,
        };
        const roleId = ROLE_MAP[(user.role ?? "").toLowerCase()] ?? null;

        const token = signJWT({
            userId: user.user_id,
            roleId,
            role: user.role,
            email: user.email,
            name: user.display_name,
        });

        const res = NextResponse.json({ success: true }, { status: 200 });

        res.cookies.set("auth", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24,
        });

        return res;

    } catch (err) {
        console.error("LOGIN ERROR:", err);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
