// lib/edi-processor.ts — EDI Transaction Processor
// Orchestrates: receive raw X12 → parse → identify partner → apply SARA mapping → write → acknowledge

import { getPool, sql } from "./mssql";
import { parseX12, extract204, extract214 } from "./x12-parser";
import type { X12Interchange, X12Group, X12Transaction } from "./x12-parser";
import { applyMapping, writeMappedRecords } from "./sara";
import { build997, wrapEnvelope, nextGSControl } from "./x12-generator";

export type ProcessResult = {
    success: boolean;
    interchange_id: number | null;
    transactions_processed: number;
    transactions_failed: number;
    ack_generated: boolean;
    errors: string[];
    details: {
        tx_set: string;
        st_control: string;
        status: string;
        target_id?: number;
        error?: string;
    }[];
};

/**
 * Process a raw inbound X12 interchange.
 * 1. Parse the X12
 * 2. Identify the trading partner from ISA
 * 3. Log the interchange
 * 4. For each transaction: apply mapping, write records, log result
 * 5. Generate 997 acknowledgment if configured
 */
export async function processInbound(rawData: string, connectionId?: number): Promise<ProcessResult> {
    const db = await getPool();
    const errors: string[] = [];
    const details: ProcessResult["details"] = [];
    let interchangeDbId: number | null = null;

    // 1. Parse
    const parsed = parseX12(rawData);
    if (!parsed.success || parsed.interchanges.length === 0) {
        return {
            success: false,
            interchange_id: null,
            transactions_processed: 0,
            transactions_failed: 0,
            ack_generated: false,
            errors: parsed.errors.length > 0 ? parsed.errors : ["Failed to parse X12 data"],
            details: [],
        };
    }

    const interchange = parsed.interchanges[0];

    // 2. Identify trading partner
    const partnerRes = await db.request()
        .input("q", sql.VarChar(2), interchange.isa_sender_q)
        .input("id", sql.VarChar(15), interchange.isa_sender_id)
        .query(`
            SELECT partner_id, name, target_app, target_db
            FROM trading_partners
            WHERE isa_qualifier = @q AND isa_id = @id AND is_active = 1
        `);

    const partner = partnerRes.recordset[0];
    const partnerId = partner?.partner_id ?? null;

    if (!partner) {
        errors.push(`Unknown trading partner: ${interchange.isa_sender_q}/${interchange.isa_sender_id}`);
    }

    // 3. Log interchange
    const icRes = await db.request()
        .input("partner_id", sql.Int, partnerId)
        .input("connection_id", sql.Int, connectionId ?? null)
        .input("direction", sql.VarChar(10), "inbound")
        .input("isa_control", sql.VarChar(9), interchange.isa_control)
        .input("isa_sender_q", sql.VarChar(2), interchange.isa_sender_q)
        .input("isa_sender_id", sql.VarChar(15), interchange.isa_sender_id)
        .input("isa_receiver_q", sql.VarChar(2), interchange.isa_receiver_q)
        .input("isa_receiver_id", sql.VarChar(15), interchange.isa_receiver_id)
        .input("isa_date", sql.VarChar(6), interchange.isa_date)
        .input("isa_time", sql.VarChar(4), interchange.isa_time)
        .input("raw_data", sql.NVarChar(sql.MAX), rawData)
        .input("byte_count", sql.Int, rawData.length)
        .input("status", sql.VarChar(20), partner ? "processing" : "unmatched")
        .query(`
            INSERT INTO edi_interchanges
                (partner_id, connection_id, direction, isa_control, isa_sender_q, isa_sender_id,
                 isa_receiver_q, isa_receiver_id, isa_date, isa_time, raw_data, byte_count, status)
            OUTPUT INSERTED.interchange_id
            VALUES
                (@partner_id, @connection_id, @direction, @isa_control, @isa_sender_q, @isa_sender_id,
                 @isa_receiver_q, @isa_receiver_id, @isa_date, @isa_time, @raw_data, @byte_count, @status)
        `);

    interchangeDbId = icRes.recordset[0]?.interchange_id;

    if (!partner) {
        return {
            success: false,
            interchange_id: interchangeDbId,
            transactions_processed: 0,
            transactions_failed: 0,
            ack_generated: false,
            errors,
            details: [],
        };
    }

    // 4. Process each group and transaction
    let processed = 0;
    let failed = 0;
    const ackTransactions: { txSet: string; stControl: string; ackCode: string }[] = [];

    for (const group of interchange.groups) {
        // Log group
        const grpRes = await db.request()
            .input("ic_id", sql.BigInt, interchangeDbId)
            .input("gs_control", sql.VarChar(9), group.gs_control)
            .input("gs_func_id", sql.VarChar(2), group.gs_func_id)
            .input("gs_sender", sql.VarChar(15), group.gs_sender)
            .input("gs_receiver", sql.VarChar(15), group.gs_receiver)
            .input("gs_version", sql.VarChar(12), group.gs_version)
            .input("tx_count", sql.Int, group.transactions.length)
            .query(`
                INSERT INTO edi_groups (interchange_id, gs_control, gs_func_id, gs_sender, gs_receiver, gs_version, tx_count)
                OUTPUT INSERTED.group_id
                VALUES (@ic_id, @gs_control, @gs_func_id, @gs_sender, @gs_receiver, @gs_version, @tx_count)
            `);

        const groupId = grpRes.recordset[0]?.group_id;

        for (const tx of group.transactions) {
            let txStatus = "received";
            let targetId: number | null = null;
            let txError: string | null = null;
            let mappingId: number | null = null;

            try {
                // Find mapping profile for this tx set + partner
                const ptsRes = await db.request()
                    .input("pid", sql.Int, partnerId)
                    .input("txs", sql.VarChar(3), tx.tx_set)
                    .query(`
                        SELECT pts.mapping_id
                        FROM partner_transaction_sets pts
                        WHERE pts.partner_id = @pid AND pts.tx_set = @txs
                            AND pts.direction = 'inbound' AND pts.is_active = 1
                    `);

                mappingId = ptsRes.recordset[0]?.mapping_id ?? null;

                if (mappingId) {
                    // Apply SARA mapping
                    const mapped = await applyMapping(tx, mappingId);

                    if (mapped.success && mapped.records.length > 0) {
                        const writeResult = await writeMappedRecords(mapped.records);

                        if (writeResult.success && writeResult.created.length > 0) {
                            targetId = writeResult.created[0].id;
                            txStatus = "processed";
                            processed++;
                        } else {
                            txStatus = "error";
                            txError = writeResult.errors.join("; ");
                            failed++;
                        }
                    } else if (mapped.errors.length > 0) {
                        txStatus = "error";
                        txError = mapped.errors.join("; ");
                        failed++;
                    } else {
                        txStatus = "processed";
                        processed++;
                    }
                } else {
                    // No mapping — log but don't fail
                    txStatus = "unmapped";
                    processed++;
                }

                ackTransactions.push({
                    txSet: tx.tx_set,
                    stControl: tx.st_control,
                    ackCode: txStatus === "error" ? "R" : "A",
                });

            } catch (e: any) {
                txStatus = "error";
                txError = e.message;
                failed++;
                ackTransactions.push({ txSet: tx.tx_set, stControl: tx.st_control, ackCode: "R" });
            }

            // Log transaction
            await db.request()
                .input("group_id", sql.BigInt, groupId)
                .input("interchange_id", sql.BigInt, interchangeDbId)
                .input("partner_id", sql.Int, partnerId)
                .input("st_control", sql.VarChar(9), tx.st_control)
                .input("tx_set", sql.VarChar(3), tx.tx_set)
                .input("direction", sql.VarChar(10), "inbound")
                .input("status", sql.VarChar(20), txStatus)
                .input("target_entity", sql.VarChar(50), tx.tx_set === "204" ? "order" : tx.tx_set === "214" ? "status_update" : null)
                .input("target_id", sql.Int, targetId)
                .input("mapping_id", sql.Int, mappingId)
                .input("segment_count", sql.Int, tx.segment_count)
                .input("raw_segments", sql.NVarChar(sql.MAX), JSON.stringify(tx.segments.map(s => s.raw)))
                .input("error_message", sql.NVarChar(sql.MAX), txError)
                .query(`
                    INSERT INTO edi_transactions
                        (group_id, interchange_id, partner_id, st_control, tx_set, direction,
                         status, target_entity, target_id, mapping_id, segment_count, raw_segments, error_message)
                    VALUES
                        (@group_id, @interchange_id, @partner_id, @st_control, @tx_set, @direction,
                         @status, @target_entity, @target_id, @mapping_id, @segment_count, @raw_segments, @error_message)
                `);

            details.push({
                tx_set: tx.tx_set,
                st_control: tx.st_control,
                status: txStatus,
                target_id: targetId ?? undefined,
                error: txError ?? undefined,
            });
        }
    }

    // 5. Update interchange status
    const finalStatus = failed > 0 ? (processed > 0 ? "partial" : "error") : "processed";
    await db.request()
        .input("id", sql.BigInt, interchangeDbId)
        .input("status", sql.VarChar(20), finalStatus)
        .query("UPDATE edi_interchanges SET status = @status, processed_at = SYSUTCDATETIME() WHERE interchange_id = @id");

    // 6. Generate 997 if configured
    let ackGenerated = false;
    // (997 generation would happen here — check partner_transaction_sets.auto_ack)

    return {
        success: failed === 0,
        interchange_id: interchangeDbId,
        transactions_processed: processed,
        transactions_failed: failed,
        ack_generated: ackGenerated,
        errors,
        details,
    };
}
