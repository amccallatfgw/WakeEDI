export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getPool, sql } from "@/lib/mssql";
import { requireAuth } from "@/lib/authorize";

/**
 * POST /api/mappings/clone
 * Clone a mapping template for a specific partner.
 * Body: { templateId, partnerId, name? }
 */
export async function POST(req: NextRequest) {
    try {
        requireAuth();
        const body = await req.json();
        const { templateId, partnerId, name } = body;

        if (!templateId || !partnerId) {
            return NextResponse.json({ error: "templateId and partnerId are required" }, { status: 400 });
        }

        const db = await getPool();

        // Get the template profile
        const tplRes = await db.request()
            .input("tid", sql.Int, templateId)
            .query("SELECT * FROM mapping_profiles WHERE mapping_id = @tid");

        const tpl = tplRes.recordset[0];
        if (!tpl) return NextResponse.json({ error: "Template not found" }, { status: 404 });

        // Get partner name for default naming
        const partnerRes = await db.request()
            .input("pid", sql.Int, partnerId)
            .query("SELECT name FROM trading_partners WHERE partner_id = @pid");
        const partnerName = partnerRes.recordset[0]?.name ?? "Partner";

        // Create new profile from template
        const profileName = name || `${partnerName} — ${tpl.tx_set} ${tpl.direction}`;
        const newRes = await db.request()
            .input("partner_id", sql.Int, partnerId)
            .input("name", sql.NVarChar(100), profileName)
            .input("tx_set", sql.VarChar(3), tpl.tx_set)
            .input("direction", sql.VarChar(10), tpl.direction)
            .input("target_app", sql.VarChar(50), tpl.target_app)
            .input("description", sql.NVarChar(500), `Cloned from template: ${tpl.name}`)
            .query(`
                INSERT INTO mapping_profiles (partner_id, name, tx_set, direction, target_app, description, is_template)
                OUTPUT INSERTED.mapping_id
                VALUES (@partner_id, @name, @tx_set, @direction, @target_app, @description, 0)
            `);

        const newMappingId = newRes.recordset[0].mapping_id;

        // Clone all rules from template
        const rulesRes = await db.request()
            .input("tid", sql.Int, templateId)
            .query("SELECT * FROM mapping_rules WHERE mapping_id = @tid ORDER BY sort_order");

        let clonedCount = 0;
        for (const rule of rulesRes.recordset) {
            await db.request()
                .input("mid", sql.Int, newMappingId)
                .input("x12_path", sql.VarChar(100), rule.x12_path)
                .input("x12_segment", sql.VarChar(5), rule.x12_segment)
                .input("x12_element", sql.Int, rule.x12_element)
                .input("x12_sub_element", sql.Int, rule.x12_sub_element)
                .input("x12_loop", sql.VarChar(20), rule.x12_loop)
                .input("target_table", sql.VarChar(100), rule.target_table)
                .input("target_column", sql.VarChar(100), rule.target_column)
                .input("transform", sql.VarChar(50), rule.transform)
                .input("transform_args", sql.NVarChar(500), rule.transform_args)
                .input("default_value", sql.NVarChar(200), rule.default_value)
                .input("is_required", sql.Bit, rule.is_required)
                .input("sort_order", sql.Int, rule.sort_order)
                .input("notes", sql.NVarChar(300), rule.notes)
                .query(`
                    INSERT INTO mapping_rules
                        (mapping_id, x12_path, x12_segment, x12_element, x12_sub_element, x12_loop,
                         target_table, target_column, transform, transform_args, default_value,
                         is_required, sort_order, notes)
                    VALUES
                        (@mid, @x12_path, @x12_segment, @x12_element, @x12_sub_element, @x12_loop,
                         @target_table, @target_column, @transform, @transform_args, @default_value,
                         @is_required, @sort_order, @notes)
                `);
            clonedCount++;
        }

        // Wire the partner's transaction set to use this mapping
        await db.request()
            .input("pid", sql.Int, partnerId)
            .input("txs", sql.VarChar(3), tpl.tx_set)
            .input("dir", sql.VarChar(10), tpl.direction)
            .input("mid", sql.Int, newMappingId)
            .query(`
                IF NOT EXISTS (SELECT 1 FROM partner_transaction_sets WHERE partner_id = @pid AND tx_set = @txs AND direction = @dir)
                    INSERT INTO partner_transaction_sets (partner_id, tx_set, direction, mapping_id, auto_process, auto_ack)
                    VALUES (@pid, @txs, @dir, @mid, 1, 1)
                ELSE
                    UPDATE partner_transaction_sets SET mapping_id = @mid WHERE partner_id = @pid AND tx_set = @txs AND direction = @dir
            `);

        return NextResponse.json({
            mapping_id: newMappingId,
            rules_cloned: clonedCount,
            name: profileName,
        }, { status: 201 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
    }
}
