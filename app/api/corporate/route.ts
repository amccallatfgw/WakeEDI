export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/mssql";

export async function GET() {
    try {
        const db = await getPool();
        const r = await db.request().query(`SELECT setting_value FROM app_settings WHERE setting_key = 'corporate_profile'`);
        const raw = r.recordset[0]?.setting_value;
        return NextResponse.json(raw ? JSON.parse(raw) : {});
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const db = await getPool();
        const json = JSON.stringify(body);
        await db.request().input("v", json).query(`
            MERGE app_settings AS t
            USING (SELECT 'corporate_profile' AS k) AS s ON t.setting_key = s.k
            WHEN MATCHED THEN UPDATE SET setting_value = @v, updated_at = GETUTCDATE()
            WHEN NOT MATCHED THEN INSERT (setting_key, setting_value) VALUES ('corporate_profile', @v);
        `);
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
