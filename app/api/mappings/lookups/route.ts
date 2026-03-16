export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getPool, sql } from "@/lib/mssql";
import { requireAuth } from "@/lib/authorize";

export async function GET(req: NextRequest) {
    try {
        requireAuth();
        const { searchParams } = new URL(req.url);
        const tableName = searchParams.get("table_name") ?? "";
        const search = searchParams.get("search") ?? "";

        const db = await getPool();
        const r = db.request();
        let where = "WHERE 1=1";
        if (tableName) { r.input("tn", tableName); where += " AND table_name = @tn"; }
        if (search) { r.input("q", `%${search}%`); where += " AND (source_code LIKE @q OR target_value LIKE @q OR description LIKE @q)"; }

        const result = await r.query(`SELECT * FROM lookup_tables ${where} ORDER BY table_name, source_code`);
        const tablesRes = await db.request().query("SELECT DISTINCT table_name FROM lookup_tables ORDER BY table_name");

        return NextResponse.json({
            lookups: result.recordset,
            tables: tablesRes.recordset.map((r: any) => r.table_name),
        });
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
        r.input("table_name", sql.VarChar(50), body.table_name);
        r.input("source_code", sql.VarChar(50), body.source_code);
        r.input("target_value", sql.NVarChar(200), body.target_value);
        r.input("description", sql.NVarChar(200), body.description ?? null);

        const result = await r.query(`
            INSERT INTO lookup_tables (table_name, source_code, target_value, description)
            OUTPUT INSERTED.lookup_id
            VALUES (@table_name, @source_code, @target_value, @description)
        `);
        return NextResponse.json({ lookup_id: result.recordset[0].lookup_id }, { status: 201 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
    }
}
