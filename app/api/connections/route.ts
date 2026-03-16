export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getPool, sql } from "@/lib/mssql";
import { requireAuth } from "@/lib/authorize";

export async function GET(req: NextRequest) {
    try {
        requireAuth();
        const partnerId = req.nextUrl.searchParams.get("partnerId");

        const db = await getPool();
        const r = db.request();
        let where = "WHERE 1=1";
        if (partnerId) { r.input("pid", sql.Int, parseInt(partnerId)); where += " AND c.partner_id = @pid"; }

        const result = await r.query(`
            SELECT c.*, p.name AS partner_name, p.isa_id
            FROM connections c
            JOIN trading_partners p ON p.partner_id = c.partner_id
            ${where}
            ORDER BY p.name, c.protocol
        `);

        return NextResponse.json({ connections: result.recordset });
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
        r.input("partner_id", sql.Int, body.partner_id);
        r.input("protocol", sql.VarChar(10), body.protocol ?? "AS2");
        r.input("as2_id_local", sql.VarChar(100), body.as2_id_local ?? null);
        r.input("as2_id_remote", sql.VarChar(100), body.as2_id_remote ?? null);
        r.input("as2_url", sql.VarChar(500), body.as2_url ?? null);
        r.input("encrypt_algo", sql.VarChar(20), body.encrypt_algo ?? "AES256");
        r.input("sign_algo", sql.VarChar(20), body.sign_algo ?? "SHA256");
        r.input("mdn_mode", sql.VarChar(10), body.mdn_mode ?? "sync");
        r.input("mdn_url", sql.VarChar(500), body.mdn_url ?? null);
        r.input("sftp_host", sql.VarChar(200), body.sftp_host ?? null);
        r.input("sftp_port", sql.Int, body.sftp_port ?? 22);
        r.input("sftp_user", sql.VarChar(100), body.sftp_user ?? null);
        r.input("sftp_path", sql.VarChar(500), body.sftp_path ?? null);

        const result = await r.query(`
            INSERT INTO connections
                (partner_id, protocol, as2_id_local, as2_id_remote, as2_url,
                 encrypt_algo, sign_algo, mdn_mode, mdn_url,
                 sftp_host, sftp_port, sftp_user, sftp_path)
            OUTPUT INSERTED.connection_id
            VALUES
                (@partner_id, @protocol, @as2_id_local, @as2_id_remote, @as2_url,
                 @encrypt_algo, @sign_algo, @mdn_mode, @mdn_url,
                 @sftp_host, @sftp_port, @sftp_user, @sftp_path)
        `);

        return NextResponse.json({ connection_id: result.recordset[0].connection_id }, { status: 201 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
    }
}
