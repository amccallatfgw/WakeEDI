// lib/sara.ts — SARA: Segment Aware Routing Architecture
// The mapping engine that transforms parsed X12 data into Wake Tech database records.
// Reads mapping_rules for a given profile, applies transforms, writes to target tables.

import { getPool, sql } from "./mssql";
import type { X12Transaction, X12Segment } from "./x12-parser";
import { getElement, findSegments, findLoop } from "./x12-parser";

export type MappingRule = {
    rule_id: number;
    mapping_id: number;
    x12_path: string;
    x12_segment: string;
    x12_element: number;
    x12_sub_element: number | null;
    x12_loop: string | null;
    target_table: string;
    target_column: string;
    transform: string | null;
    transform_args: string | null;
    default_value: string | null;
    is_required: boolean;
    sort_order: number;
};

export type MappedRecord = {
    table: string;
    fields: Record<string, any>;
    loop_index?: number;         // For repeating loops (stops)
};

export type SaraResult = {
    success: boolean;
    records: MappedRecord[];
    errors: string[];
    warnings: string[];
};

// ── Transforms ────────────────────────────────────────────────────────────────

function applyTransform(value: string, transform: string | null, args: string | null): any {
    if (!value && !transform) return null;

    switch (transform) {
        case null:
        case "none":
        case "":
            return value || null;

        case "trim":
            return value.trim() || null;

        case "upper":
            return value.toUpperCase() || null;

        case "lower":
            return value.toLowerCase() || null;

        case "date": {
            // X12 dates are CCYYMMDD or YYMMDD
            if (!value) return null;
            const v = value.trim();
            if (v.length === 8) {
                return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
            }
            if (v.length === 6) {
                const year = parseInt(v.slice(0, 2));
                const prefix = year > 50 ? "19" : "20";
                return `${prefix}${v.slice(0, 2)}-${v.slice(2, 4)}-${v.slice(4, 6)}`;
            }
            return value;
        }

        case "time": {
            // X12 times are HHMM or HHMMSS
            if (!value) return null;
            const v = value.trim();
            if (v.length === 4) return `${v.slice(0, 2)}:${v.slice(2, 4)}:00`;
            if (v.length === 6) return `${v.slice(0, 2)}:${v.slice(2, 4)}:${v.slice(4, 6)}`;
            return value;
        }

        case "datetime": {
            // Combine date (CCYYMMDD) and time (HHMM) from args
            if (!value) return null;
            const date = applyTransform(value, "date", null);
            return date;
        }

        case "integer":
            return parseInt(value) || null;

        case "decimal": {
            const places = args ? parseInt(args) : 2;
            const n = parseFloat(value);
            return isNaN(n) ? null : parseFloat(n.toFixed(places));
        }

        case "boolean":
            return ["Y", "1", "true", "yes"].includes(value.toUpperCase()) ? 1 : 0;

        case "lookup": {
            // Lookup transform deferred — resolved at write time via lookup_tables
            return { __lookup: true, table: args, code: value };
        }

        case "concat": {
            // Args format: "separator" — value is already resolved
            return value || null;
        }

        case "static":
            return args || value || null;

        default:
            return value || null;
    }
}

// ── Resolve X12 Path ──────────────────────────────────────────────────────────

/**
 * Resolve an x12_path against a transaction.
 * Path format: SEGMENT/ELEMENT or SEGMENT(occurrence)/ELEMENT
 * For loop segments: S5(1)/N1/02 means "in the 1st S5 loop, find N1, element 02"
 */
function resolveValue(
    tx: X12Transaction,
    rule: MappingRule,
    loopSegments?: X12Segment[]
): string {
    const { x12_segment, x12_element, x12_loop } = rule;

    let searchSegments: X12Segment[];

    if (loopSegments) {
        // Search within a specific loop context
        searchSegments = loopSegments;
    } else if (x12_loop) {
        // Find the loop and search within it
        const loops = findLoop(tx, x12_loop);
        if (loops.length > 0) {
            searchSegments = loops[0]; // First occurrence
        } else {
            return "";
        }
    } else {
        searchSegments = tx.segments;
    }

    const seg = searchSegments.find(s => s.id === x12_segment);
    if (!seg) return "";

    if (rule.x12_sub_element) {
        const element = getElement(seg, x12_element);
        const parts = element.split(":");
        return (parts[rule.x12_sub_element - 1] || "").trim();
    }

    return getElement(seg, x12_element);
}

// ── Main SARA Engine ──────────────────────────────────────────────────────────

/**
 * Apply a mapping profile to a parsed X12 transaction.
 * Returns mapped records ready for database insertion.
 */
export async function applyMapping(
    tx: X12Transaction,
    mappingId: number
): Promise<SaraResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const records: MappedRecord[] = [];

    // Load mapping rules
    const db = await getPool();
    const rulesRes = await db.request()
        .input("mid", sql.Int, mappingId)
        .query(`
            SELECT * FROM mapping_rules
            WHERE mapping_id = @mid
            ORDER BY sort_order, rule_id
        `);

    const rules: MappingRule[] = rulesRes.recordset;

    if (rules.length === 0) {
        return { success: false, records: [], errors: ["No mapping rules found for profile"], warnings: [] };
    }

    // Separate rules into non-loop (header) and loop rules
    const headerRules = rules.filter(r => !r.x12_loop || r.x12_loop === "");
    const loopRulesByLoop = new Map<string, MappingRule[]>();

    for (const rule of rules) {
        if (rule.x12_loop && rule.x12_loop !== "") {
            const existing = loopRulesByLoop.get(rule.x12_loop) || [];
            existing.push(rule);
            loopRulesByLoop.set(rule.x12_loop, existing);
        }
    }

    // Process header rules → single record per target table
    const headerRecords = new Map<string, Record<string, any>>();

    for (const rule of headerRules) {
        const rawValue = resolveValue(tx, rule);
        let value = applyTransform(rawValue, rule.transform, rule.transform_args);

        if (!value && rule.default_value) {
            value = rule.default_value;
        }

        if (!value && rule.is_required) {
            errors.push(`Required field ${rule.target_table}.${rule.target_column} is empty (X12: ${rule.x12_path})`);
            continue;
        }

        if (value === null || value === undefined) continue;

        if (!headerRecords.has(rule.target_table)) {
            headerRecords.set(rule.target_table, {});
        }
        headerRecords.get(rule.target_table)![rule.target_column] = value;
    }

    for (const [table, fields] of headerRecords) {
        records.push({ table, fields });
    }

    // Process loop rules → one record per loop iteration
    for (const [loopId, loopRules] of loopRulesByLoop) {
        const loops = findLoop(tx, loopId);

        for (let idx = 0; idx < loops.length; idx++) {
            const loopSegments = loops[idx];
            const loopRecords = new Map<string, Record<string, any>>();

            for (const rule of loopRules) {
                const rawValue = resolveValue(tx, rule, loopSegments);
                let value = applyTransform(rawValue, rule.transform, rule.transform_args);

                if (!value && rule.default_value) value = rule.default_value;
                if (value === null || value === undefined) continue;

                if (!loopRecords.has(rule.target_table)) {
                    loopRecords.set(rule.target_table, {});
                }
                loopRecords.get(rule.target_table)![rule.target_column] = value;
            }

            for (const [table, fields] of loopRecords) {
                records.push({ table, fields, loop_index: idx });
            }
        }
    }

    // Resolve lookup transforms
    for (const record of records) {
        for (const [col, val] of Object.entries(record.fields)) {
            if (val && typeof val === "object" && val.__lookup) {
                const lookupRes = await db.request()
                    .input("tbl", sql.VarChar(50), val.table)
                    .input("code", sql.VarChar(50), val.code)
                    .query("SELECT target_value FROM lookup_tables WHERE table_name = @tbl AND source_code = @code");

                record.fields[col] = lookupRes.recordset[0]?.target_value || val.code;
            }
        }
    }

    return {
        success: errors.length === 0,
        records,
        errors,
        warnings,
    };
}

/**
 * Write mapped records to the target database.
 * Returns the IDs of created records.
 */
export async function writeMappedRecords(
    records: MappedRecord[],
    targetDb?: string
): Promise<{ success: boolean; created: { table: string; id: number }[]; errors: string[] }> {
    const db = await getPool();
    const created: { table: string; id: number }[] = [];
    const errors: string[] = [];

    for (const record of records) {
        try {
            const columns = Object.keys(record.fields);
            const values = Object.values(record.fields);

            if (columns.length === 0) continue;

            // Always add org_id = 1
            if (!columns.includes("org_id")) {
                columns.push("org_id");
                values.push(1);
            }

            const r = db.request();
            const paramNames: string[] = [];

            columns.forEach((col, i) => {
                const paramName = `p${i}`;
                paramNames.push(`@${paramName}`);
                r.input(paramName, values[i]);
            });

            const colList = columns.map(c => `[${c}]`).join(", ");
            const paramList = paramNames.join(", ");

            // Try INSERT with OUTPUT to get the new ID
            const idCol = record.table.replace(/s$/, "") + "_id";
            const result = await r.query(`
                INSERT INTO dbo.[${record.table}] (${colList})
                OUTPUT INSERTED.[${idCol}]
                VALUES (${paramList})
            `);

            const newId = result.recordset[0]?.[idCol];
            if (newId) {
                created.push({ table: record.table, id: newId });
            }
        } catch (e: any) {
            errors.push(`Failed to insert into ${record.table}: ${e.message}`);
        }
    }

    return { success: errors.length === 0, created, errors };
}
