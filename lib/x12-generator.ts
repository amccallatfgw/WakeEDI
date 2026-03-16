// lib/x12-generator.ts — X12 EDI Generator
// Builds outbound X12 documents from Wake Tech data using mapping profiles.

import { getPool, sql } from "./mssql";

type GeneratorOptions = {
    elementSep?: string;
    segmentSep?: string;
    subElementSep?: string;
    lineBreak?: boolean;        // Add \n after segment terminator for readability
};

const DEFAULTS: GeneratorOptions = {
    elementSep: "*",
    segmentSep: "~",
    subElementSep: ":",
    lineBreak: true,
};

/**
 * Pad a string to a fixed length (right-padded with spaces).
 */
function pad(val: string, len: number): string {
    return (val || "").padEnd(len).slice(0, len);
}

/**
 * Format date as CCYYMMDD.
 */
function formatDate8(d: Date): string {
    return d.getFullYear().toString() +
        (d.getMonth() + 1).toString().padStart(2, "0") +
        d.getDate().toString().padStart(2, "0");
}

/**
 * Format date as YYMMDD.
 */
function formatDate6(d: Date): string {
    return formatDate8(d).slice(2);
}

/**
 * Format time as HHMM.
 */
function formatTime4(d: Date): string {
    return d.getHours().toString().padStart(2, "0") +
        d.getMinutes().toString().padStart(2, "0");
}

/**
 * Generate next ISA control number (9 digits, zero-padded).
 */
export async function nextISAControl(): Promise<string> {
    const db = await getPool();
    const res = await db.request().query(`
        UPDATE app_settings
        SET setting_value = CAST(CAST(ISNULL(setting_value,'0') AS INT) + 1 AS NVARCHAR),
            updated_at = SYSUTCDATETIME()
        OUTPUT INSERTED.setting_value
        WHERE setting_key = 'isa_control_counter'
    `);

    if (res.recordset.length === 0) {
        // First time — create the counter
        await db.request().query(`
            INSERT INTO app_settings (setting_key, setting_value)
            VALUES ('isa_control_counter', '1')
        `);
        return "000000001";
    }

    return res.recordset[0].setting_value.padStart(9, "0");
}

/**
 * Generate next GS control number.
 */
export async function nextGSControl(): Promise<string> {
    const db = await getPool();
    const res = await db.request().query(`
        UPDATE app_settings
        SET setting_value = CAST(CAST(ISNULL(setting_value,'0') AS INT) + 1 AS NVARCHAR),
            updated_at = SYSUTCDATETIME()
        OUTPUT INSERTED.setting_value
        WHERE setting_key = 'gs_control_counter'
    `);

    if (res.recordset.length === 0) {
        await db.request().query(`
            INSERT INTO app_settings (setting_key, setting_value)
            VALUES ('gs_control_counter', '1')
        `);
        return "1";
    }

    return res.recordset[0].setting_value;
}

/**
 * Build ISA segment.
 */
function buildISA(opts: {
    senderQ: string; senderId: string;
    receiverQ: string; receiverId: string;
    controlNumber: string;
    sep: GeneratorOptions;
}): string {
    const e = opts.sep.elementSep!;
    const sub = opts.sep.subElementSep!;
    const now = new Date();

    return [
        "ISA",
        "00",                           // ISA01 Auth qualifier
        pad("", 10),                    // ISA02 Auth info
        "00",                           // ISA03 Security qualifier
        pad("", 10),                    // ISA04 Security info
        pad(opts.senderQ, 2),           // ISA05
        pad(opts.senderId, 15),         // ISA06
        pad(opts.receiverQ, 2),         // ISA07
        pad(opts.receiverId, 15),       // ISA08
        formatDate6(now),               // ISA09
        formatTime4(now),               // ISA10
        "U",                            // ISA11 Repetition sep (U for 4010)
        "00401",                        // ISA12 Version
        opts.controlNumber.padStart(9, "0"), // ISA13
        "0",                            // ISA14 Ack requested
        "P",                            // ISA15 Usage (P=production, T=test)
        sub,                            // ISA16 Sub-element separator
    ].join(e);
}

/**
 * Build GS segment.
 */
function buildGS(opts: {
    funcId: string; senderId: string; receiverId: string;
    controlNumber: string; version?: string;
    sep: GeneratorOptions;
}): string {
    const e = opts.sep.elementSep!;
    const now = new Date();

    return [
        "GS",
        opts.funcId,                    // GS01
        opts.senderId,                  // GS02
        opts.receiverId,                // GS03
        formatDate8(now),               // GS04
        formatTime4(now),               // GS05
        opts.controlNumber,             // GS06
        "X",                            // GS07 Responsible agency
        opts.version || "004010",       // GS08
    ].join(e);
}

/**
 * Build a 997 Functional Acknowledgment for a received transaction.
 */
export function build997(opts: {
    originalGsFuncId: string;
    originalGsControl: string;
    transactions: { txSet: string; stControl: string; ackCode: string; errors?: string[] }[];
    stControl: string;
    sep?: GeneratorOptions;
}): string[] {
    const s = { ...DEFAULTS, ...opts.sep };
    const e = s.elementSep!;
    const segments: string[] = [];

    // ST
    segments.push(["ST", "997", opts.stControl].join(e));

    // AK1 — Functional group response header
    segments.push(["AK1", opts.originalGsFuncId, opts.originalGsControl].join(e));

    for (const tx of opts.transactions) {
        // AK2 — Transaction set response header
        segments.push(["AK2", tx.txSet, tx.stControl].join(e));

        // AK5 — Transaction set response trailer
        // A=Accepted, E=Accepted but errors, R=Rejected
        segments.push(["AK5", tx.ackCode].join(e));
    }

    // AK9 — Functional group response trailer
    const accepted = opts.transactions.filter(t => t.ackCode === "A").length;
    const ackCode = accepted === opts.transactions.length ? "A" : "E";
    segments.push(["AK9", ackCode,
        opts.transactions.length.toString(),
        opts.transactions.length.toString(),
        accepted.toString(),
    ].join(e));

    // SE
    segments.push(["SE", (segments.length + 1).toString(), opts.stControl].join(e));

    return segments;
}

/**
 * Build a 214 Shipment Status Message.
 */
export function build214(opts: {
    refNumber: string;
    shipmentId: string;
    scac: string;
    statusCode: string;
    reasonCode?: string;
    city?: string;
    state?: string;
    stControl: string;
    sep?: GeneratorOptions;
}): string[] {
    const s = { ...DEFAULTS, ...opts.sep };
    const e = s.elementSep!;
    const segments: string[] = [];
    const now = new Date();

    segments.push(["ST", "214", opts.stControl].join(e));

    // B10 — Shipment identification
    segments.push(["B10", opts.refNumber, opts.shipmentId, opts.scac].join(e));

    // MS1 — Location (if provided)
    if (opts.city || opts.state) {
        segments.push(["MS1", opts.city || "", opts.state || "", "US"].join(e));
    }

    // AT7 — Shipment status detail
    segments.push(["AT7", opts.statusCode, opts.reasonCode || "",
        "", "", formatDate8(now), formatTime4(now), "LT"].join(e));

    segments.push(["SE", (segments.length + 1).toString(), opts.stControl].join(e));

    return segments;
}

/**
 * Wrap transaction segments in full ISA/GS/ST envelope.
 */
export async function wrapEnvelope(opts: {
    senderQ: string; senderId: string;
    receiverQ: string; receiverId: string;
    gsFuncId: string;
    gsSenderId: string; gsReceiverId: string;
    innerSegments: string[];
    sep?: GeneratorOptions;
}): Promise<string> {
    const s = { ...DEFAULTS, ...opts.sep };
    const term = s.segmentSep!;
    const nl = s.lineBreak ? "\n" : "";

    const isaControl = await nextISAControl();
    const gsControl = await nextGSControl();

    const lines: string[] = [];

    // ISA
    lines.push(buildISA({
        senderQ: opts.senderQ, senderId: opts.senderId,
        receiverQ: opts.receiverQ, receiverId: opts.receiverId,
        controlNumber: isaControl, sep: s,
    }));

    // GS
    lines.push(buildGS({
        funcId: opts.gsFuncId,
        senderId: opts.gsSenderId,
        receiverId: opts.gsReceiverId,
        controlNumber: gsControl, sep: s,
    }));

    // Inner segments (ST...SE already included)
    lines.push(...opts.innerSegments);

    // GE
    lines.push(["GE", "1", gsControl].join(s.elementSep!));

    // IEA
    lines.push(["IEA", "1", isaControl.padStart(9, "0")].join(s.elementSep!));

    return lines.map(l => l + term + nl).join("");
}
