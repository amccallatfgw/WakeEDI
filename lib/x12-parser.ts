// lib/x12-parser.ts — X12 EDI Parser
// Parses raw X12 interchange into structured objects.
// Handles ISA/IEA, GS/GE, ST/SE envelopes and all inner segments.

export type X12Element = string;

export type X12Segment = {
    id: string;                    // Segment identifier (ISA, GS, ST, B2, S5, N1, etc.)
    elements: X12Element[];        // Element values (0-indexed, [0] = segment id)
    raw: string;                   // Original segment text
    line: number;                  // Line number in file
};

export type X12Transaction = {
    st_control: string;            // ST02
    tx_set: string;                // ST01 (204, 210, 214, 990, 997)
    segments: X12Segment[];        // All segments between ST and SE
    segment_count: number;
};

export type X12Group = {
    gs_control: string;            // GS06
    gs_func_id: string;            // GS01
    gs_sender: string;             // GS02
    gs_receiver: string;           // GS03
    gs_version: string;            // GS08
    transactions: X12Transaction[];
};

export type X12Interchange = {
    isa_control: string;           // ISA13
    isa_sender_q: string;          // ISA05
    isa_sender_id: string;         // ISA06
    isa_receiver_q: string;        // ISA07
    isa_receiver_id: string;       // ISA08
    isa_date: string;              // ISA09
    isa_time: string;              // ISA10
    element_sep: string;           // ISA delimiter (usually *)
    segment_sep: string;           // Segment terminator (usually ~ or \n)
    sub_element_sep: string;       // ISA16 (usually :)
    groups: X12Group[];
    raw: string;
};

export type ParseResult = {
    success: boolean;
    interchanges: X12Interchange[];
    errors: string[];
};

/**
 * Detect delimiters from ISA segment.
 * ISA is always exactly 106 characters. Element separator is char at position 3.
 * Segment terminator is the character after the 16th element.
 */
function detectDelimiters(raw: string): { element: string; segment: string; sub: string } | null {
    // ISA must start at position 0
    if (!raw.startsWith("ISA")) return null;

    const element = raw[3]; // Character right after "ISA"
    if (!element) return null;

    // ISA has 16 elements. Find position of ISA16 (sub-element separator)
    // ISA is fixed-length: 106 chars including segment terminator
    // Element sep is at position 3, sub-element sep is at position 104, segment term is at 105
    const isaElements = raw.substring(0, 107).split(element);
    if (isaElements.length < 17) {
        // Try to find segment terminator by looking after ISA16
        // ISA16 is 1 char, followed by segment terminator
        const sub = raw[104] || ":";
        const segment = raw[105] || "~";
        return { element, segment, sub };
    }

    // ISA16 contains the sub-element separator + segment terminator
    const lastField = isaElements[16] || "";
    const sub = lastField[0] || ":";
    const segment = lastField[1] || lastField[lastField.length - 1] || "~";

    return { element, segment, sub };
}

/**
 * Parse a raw X12 string into structured interchanges.
 */
export function parseX12(raw: string): ParseResult {
    const errors: string[] = [];
    const interchanges: X12Interchange[] = [];

    // Clean up: remove BOM, normalize line endings
    let cleaned = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").trim();

    if (!cleaned.startsWith("ISA")) {
        return { success: false, interchanges: [], errors: ["Data does not start with ISA segment"] };
    }

    const delimiters = detectDelimiters(cleaned);
    if (!delimiters) {
        return { success: false, interchanges: [], errors: ["Cannot detect X12 delimiters from ISA"] };
    }

    const { element: eSep, segment: sSep, sub: subSep } = delimiters;

    // Split into segments
    const rawSegments = cleaned
        .split(sSep)
        .map(s => s.replace(/[\r\n]/g, "").trim())
        .filter(s => s.length > 0);

    const segments: X12Segment[] = rawSegments.map((raw, i) => {
        const elements = raw.split(eSep);
        return { id: elements[0], elements, raw, line: i + 1 };
    });

    // Walk through segments, building the envelope hierarchy
    let i = 0;

    while (i < segments.length) {
        const seg = segments[i];

        if (seg.id === "ISA") {
            const interchange: X12Interchange = {
                isa_control: (seg.elements[13] || "").trim(),
                isa_sender_q: (seg.elements[5] || "").trim(),
                isa_sender_id: (seg.elements[6] || "").trim(),
                isa_receiver_q: (seg.elements[7] || "").trim(),
                isa_receiver_id: (seg.elements[8] || "").trim(),
                isa_date: (seg.elements[9] || "").trim(),
                isa_time: (seg.elements[10] || "").trim(),
                element_sep: eSep,
                segment_sep: sSep,
                sub_element_sep: subSep,
                groups: [],
                raw: cleaned,
            };

            i++;

            // Process groups within this interchange
            while (i < segments.length && segments[i].id !== "IEA") {
                if (segments[i].id === "GS") {
                    const gsSeg = segments[i];
                    const group: X12Group = {
                        gs_control: (gsSeg.elements[6] || "").trim(),
                        gs_func_id: (gsSeg.elements[1] || "").trim(),
                        gs_sender: (gsSeg.elements[2] || "").trim(),
                        gs_receiver: (gsSeg.elements[3] || "").trim(),
                        gs_version: (gsSeg.elements[8] || "").trim(),
                        transactions: [],
                    };

                    i++;

                    // Process transactions within this group
                    while (i < segments.length && segments[i].id !== "GE") {
                        if (segments[i].id === "ST") {
                            const stSeg = segments[i];
                            const tx: X12Transaction = {
                                tx_set: (stSeg.elements[1] || "").trim(),
                                st_control: (stSeg.elements[2] || "").trim(),
                                segments: [],
                                segment_count: 0,
                            };

                            i++;

                            // Collect all segments until SE
                            while (i < segments.length && segments[i].id !== "SE") {
                                tx.segments.push(segments[i]);
                                i++;
                            }

                            tx.segment_count = tx.segments.length + 2; // +2 for ST and SE

                            if (i < segments.length && segments[i].id === "SE") {
                                i++; // skip SE
                            }

                            group.transactions.push(tx);
                        } else {
                            i++;
                        }
                    }

                    if (i < segments.length && segments[i].id === "GE") {
                        i++; // skip GE
                    }

                    interchange.groups.push(group);
                } else {
                    i++;
                }
            }

            if (i < segments.length && segments[i].id === "IEA") {
                i++; // skip IEA
            }

            interchanges.push(interchange);
        } else {
            errors.push(`Unexpected segment ${seg.id} at line ${seg.line} outside ISA envelope`);
            i++;
        }
    }

    return {
        success: errors.length === 0,
        interchanges,
        errors,
    };
}

/**
 * Get element value from a segment by position (1-based, matching X12 convention).
 */
export function getElement(seg: X12Segment, position: number): string {
    return (seg.elements[position] || "").trim();
}

/**
 * Get sub-element from a composite element.
 */
export function getSubElement(seg: X12Segment, position: number, subPosition: number, subSep = ":"): string {
    const element = getElement(seg, position);
    const parts = element.split(subSep);
    return (parts[subPosition - 1] || "").trim();
}

/**
 * Find all segments matching a given ID within a transaction.
 */
export function findSegments(tx: X12Transaction, segmentId: string): X12Segment[] {
    return tx.segments.filter(s => s.id === segmentId);
}

/**
 * Find segments within a loop context.
 * Example: find all N1 segments, then get N3/N4 that follow each N1.
 */
export function findLoop(tx: X12Transaction, loopStart: string): X12Segment[][] {
    const loops: X12Segment[][] = [];
    let current: X12Segment[] | null = null;

    for (const seg of tx.segments) {
        if (seg.id === loopStart) {
            if (current) loops.push(current);
            current = [seg];
        } else if (current) {
            // Check if this is a new loop-level segment (would start a new loop or end current)
            if (seg.id === loopStart || seg.id.match(/^(ST|SE|GS|GE|ISA|IEA)$/)) {
                loops.push(current);
                current = null;
            } else {
                current.push(seg);
            }
        }
    }

    if (current) loops.push(current);
    return loops;
}

/**
 * Quick extract: get common 204 load tender fields.
 */
export function extract204(tx: X12Transaction): Record<string, any> {
    const b2 = tx.segments.find(s => s.id === "B2");
    const b2a = tx.segments.find(s => s.id === "B2A");

    const result: Record<string, any> = {
        tx_set: "204",
        scac: b2 ? getElement(b2, 2) : null,
        customer_ref: b2 ? getElement(b2, 4) : null,
        payment_method: b2 ? getElement(b2, 6) : null,
        purpose: b2a ? getElement(b2a, 1) : null,   // 00=original, 01=cancel, 04=change
        stops: [] as any[],
        total_weight: null as number | null,
        total_miles: null as number | null,
        equipment_type: null as string | null,
    };

    // L11 segments — reference numbers
    const l11s = findSegments(tx, "L11");
    result.references = l11s.map(s => ({
        ref_number: getElement(s, 1),
        ref_qualifier: getElement(s, 2),
    }));

    // S5 loops — stops
    const s5Loops = findLoop(tx, "S5");
    for (const loop of s5Loops) {
        const s5 = loop[0];
        const stop: Record<string, any> = {
            stop_sequence: parseInt(getElement(s5, 1)) || 0,
            stop_reason: getElement(s5, 2),
            weight: parseFloat(getElement(s5, 3)) || null,
            weight_unit: getElement(s5, 4),
            pieces: parseInt(getElement(s5, 5)) || null,
        };

        // N1/N3/N4 within this stop — name/address
        for (const seg of loop) {
            if (seg.id === "N1") {
                stop.entity_type = getElement(seg, 1);
                stop.name = getElement(seg, 2);
                stop.id_qualifier = getElement(seg, 3);
                stop.id_code = getElement(seg, 4);
            } else if (seg.id === "N3") {
                stop.address1 = getElement(seg, 1);
                stop.address2 = getElement(seg, 2);
            } else if (seg.id === "N4") {
                stop.city = getElement(seg, 1);
                stop.state = getElement(seg, 2);
                stop.zip = getElement(seg, 3);
                stop.country = getElement(seg, 4);
            } else if (seg.id === "G62") {
                // Date/time
                const qualifier = getElement(seg, 1);
                const dateVal = getElement(seg, 2);
                const timeQualifier = getElement(seg, 3);
                const timeVal = getElement(seg, 4);
                if (qualifier === "10") stop.pickup_date = dateVal;
                if (qualifier === "02") stop.delivery_date = dateVal;
                if (qualifier === "68") stop.appt_date = dateVal;
                if (timeVal) stop.appt_time = timeVal;
            }
        }

        result.stops.push(stop);
    }

    return result;
}

/**
 * Quick extract: get common 214 status update fields.
 */
export function extract214(tx: X12Transaction): Record<string, any> {
    const b10 = tx.segments.find(s => s.id === "B10");

    const result: Record<string, any> = {
        tx_set: "214",
        ref_number: b10 ? getElement(b10, 1) : null,
        shipment_id: b10 ? getElement(b10, 2) : null,
        scac: b10 ? getElement(b10, 3) : null,
        status_updates: [] as any[],
    };

    // AT7 segments — status details
    const at7s = findSegments(tx, "AT7");
    for (const at7 of at7s) {
        result.status_updates.push({
            status_code: getElement(at7, 1),
            reason_code: getElement(at7, 2),
            date: getElement(at7, 5),
            time: getElement(at7, 6),
            time_code: getElement(at7, 7),
        });
    }

    // MS1/MS2 — location
    const ms1 = tx.segments.find(s => s.id === "MS1");
    if (ms1) {
        result.location = {
            city: getElement(ms1, 1),
            state: getElement(ms1, 2),
            country: getElement(ms1, 3),
        };
    }

    return result;
}
