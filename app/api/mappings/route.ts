export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getPool, sql } from "@/lib/mssql";
import { requireAuth } from "@/lib/authorize";

export async function GET(req: NextRequest) {
    try {
        requireAuth();
        const partnerId = req.nextUrl.searchParams.get("partnerId");
        const mappingId = req.nextUrl.searchParams.get("mappingId");

        const db = await getPool();

        // If requesting a specific mapping with its rules
        if (mappingId) {
            const r = db.request().input("mid", sql.Int, parseInt(mappingId));
            const profile = await r.query("SELECT * FROM mapping_profiles WHERE mapping_id = @mid");
            const rules = await db.request()
                .input("mid", sql.Int, parseInt(mappingId))
                .query("SELECT * FROM mapping_rules WHERE mapping_id = @mid ORDER BY sort_order, rule_id");

            return NextResponse.json({
                profile: profile.recordset[0] ?? null,
                rules: rules.recordset,
            });
        }

        // List all profiles
        const r = db.request();
        let where = "WHERE 1=1";
        if (partnerId) { r.input("pid", sql.Int, parseInt(partnerId)); where += " AND (m.partner_id = @pid OR m.is_template = 1)"; }

        const result = await r.query(`
            SELECT m.*,
                p.name AS partner_name,
                (SELECT COUNT(*) FROM mapping_rules mr WHERE mr.mapping_id = m.mapping_id) AS rule_count
            FROM mapping_profiles m
            LEFT JOIN trading_partners p ON p.partner_id = m.partner_id
            ${where}
            ORDER BY m.is_template DESC, m.name
        `);

        return NextResponse.json({ mappings: result.recordset });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        requireAuth();
        const body = await req.json();
        const db = await getPool();

        // Create mapping profile
        if (body.action === "add_rule") {
            const r = db.request();
            r.input("mapping_id", sql.Int, body.mapping_id);
            r.input("x12_path", sql.VarChar(100), body.x12_path);
            r.input("x12_segment", sql.VarChar(5), body.x12_segment);
            r.input("x12_element", sql.Int, body.x12_element);
            r.input("x12_sub_element", sql.Int, body.x12_sub_element ?? null);
            r.input("x12_loop", sql.VarChar(20), body.x12_loop ?? null);
            r.input("target_table", sql.VarChar(100), body.target_table);
            r.input("target_column", sql.VarChar(100), body.target_column);
            r.input("transform", sql.VarChar(50), body.transform ?? "none");
            r.input("transform_args", sql.NVarChar(500), body.transform_args ?? null);
            r.input("default_value", sql.NVarChar(200), body.default_value ?? null);
            r.input("is_required", sql.Bit, body.is_required ? 1 : 0);
            r.input("sort_order", sql.Int, body.sort_order ?? 0);
            r.input("notes", sql.NVarChar(300), body.notes ?? null);

            const result = await r.query(`
                INSERT INTO mapping_rules
                    (mapping_id, x12_path, x12_segment, x12_element, x12_sub_element, x12_loop,
                     target_table, target_column, transform, transform_args, default_value,
                     is_required, sort_order, notes)
                OUTPUT INSERTED.rule_id
                VALUES
                    (@mapping_id, @x12_path, @x12_segment, @x12_element, @x12_sub_element, @x12_loop,
                     @target_table, @target_column, @transform, @transform_args, @default_value,
                     @is_required, @sort_order, @notes)
            `);

            return NextResponse.json({ rule_id: result.recordset[0].rule_id }, { status: 201 });
        }

        // Create new mapping profile
        const r = db.request();
        r.input("partner_id", sql.Int, body.partner_id ?? null);
        r.input("name", sql.NVarChar(100), body.name);
        r.input("tx_set", sql.VarChar(3), body.tx_set);
        r.input("direction", sql.VarChar(10), body.direction);
        r.input("target_app", sql.VarChar(50), body.target_app ?? "freightwake");
        r.input("description", sql.NVarChar(500), body.description ?? null);
        r.input("is_template", sql.Bit, body.is_template ? 1 : 0);

        const result = await r.query(`
            INSERT INTO mapping_profiles
                (partner_id, name, tx_set, direction, target_app, description, is_template)
            OUTPUT INSERTED.mapping_id
            VALUES
                (@partner_id, @name, @tx_set, @direction, @target_app, @description, @is_template)
        `);

        return NextResponse.json({ mapping_id: result.recordset[0].mapping_id }, { status: 201 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
    }
}
