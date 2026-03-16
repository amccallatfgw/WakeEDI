"use client";

import { useCallback, useEffect, useState } from "react";
import {
    DataTable, PageHeader, Toolbar, SearchBox, FilterSelect, Slideout,
    PaginationBar, StatusBadge, DetailGrid, DetailField, SectionHeader,
    fmtDate, ColDef,
} from "@/components/shared";

type EDITx = {
    transaction_id: number; tx_set: string; st_control: string; direction: string;
    status: string; partner_name: string; partner_isa: string; isa_control: string;
    target_entity: string; target_id: number; segment_count: number;
    error_message: string; received_at: string; processed_at: string;
};

const TX_LABELS: Record<string, string> = {
    "204": "Load Tender", "210": "Freight Invoice", "214": "Status Update",
    "990": "Response", "997": "Acknowledgment",
};

const COLS: ColDef<EDITx>[] = [
    { key: "tx_set", label: "TX Set", className: "w-[100px] font-mono font-semibold",
        render: v => <span>{v} <span className="text-xs text-ink-2 font-normal">{TX_LABELS[v] ?? ""}</span></span> },
    { key: "direction", label: "Dir", className: "w-[90px]",
        render: v => <span className={`text-xs font-semibold px-2 py-0.5 rounded ${v === "inbound" ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"}`}>{v}</span> },
    { key: "partner_name", label: "Partner", className: "min-w-[150px]" },
    { key: "status", label: "Status", className: "w-[110px]", render: v => <StatusBadge value={v} /> },
    { key: "isa_control", label: "ISA #", className: "w-[100px] font-mono text-xs" },
    { key: "target_id", label: "Target", className: "w-[100px]",
        render: (v, row) => v ? <span className="text-xs">{row.target_entity} #{v}</span> : <span className="text-xs text-slate-400">—</span> },
    { key: "received_at", label: "Received", className: "w-[150px]", render: v => fmtDate(v, true) },
];

const TX_SET_OPTS = [
    { value: "", label: "All TX Sets" },
    { value: "204", label: "204 — Load Tender" },
    { value: "210", label: "210 — Invoice" },
    { value: "214", label: "214 — Status" },
    { value: "990", label: "990 — Response" },
    { value: "997", label: "997 — Ack" },
];

const STATUS_OPTS = [
    { value: "", label: "All Status" },
    { value: "received", label: "Received" },
    { value: "processed", label: "Processed" },
    { value: "unmapped", label: "Unmapped" },
    { value: "error", label: "Error" },
];

const DIR_OPTS = [
    { value: "", label: "All Directions" },
    { value: "inbound", label: "Inbound" },
    { value: "outbound", label: "Outbound" },
];

export default function TransactionsPage() {
    const [rows, setRows]       = useState<EDITx[]>([]);
    const [total, setTotal]     = useState(0);
    const [loading, setLoading] = useState(true);
    const [txSet, setTxSet]     = useState("");
    const [status, setStatus]   = useState("");
    const [direction, setDir]   = useState("");
    const [page, setPage]       = useState(0);
    const [selected, setSelected] = useState<EDITx | null>(null);
    const [autoRefresh, setAuto]  = useState(false);

    const load = useCallback(() => {
        setLoading(true);
        const p = new URLSearchParams({ page: String(page + 1), size: "50" });
        if (txSet) p.set("txSet", txSet);
        if (status) p.set("status", status);
        if (direction) p.set("direction", direction);

        fetch(`/api/transactions?${p}`)
            .then(r => r.json())
            .then(d => { setRows(d.transactions ?? []); setTotal(d.total ?? 0); })
            .finally(() => setLoading(false));
    }, [txSet, status, direction, page]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (!autoRefresh) return;
        const id = setInterval(load, 5000);
        return () => clearInterval(id);
    }, [autoRefresh, load]);

    return (
        <section className="p-2">
            <PageHeader title="Transaction Monitor" subtitle="All EDI transactions flowing through WakeEDI"
                actions={
                    <button onClick={() => setAuto(a => !a)}
                        className={`h-9 px-4 rounded-lg text-sm font-semibold transition-colors ${autoRefresh ? "bg-emerald-600 text-white" : "border border-fw-border bg-white text-ink hover:bg-slate-50"}`}>
                        {autoRefresh ? "● Live" : "Auto-refresh"}
                    </button>
                } />

            <Toolbar>
                <FilterSelect value={txSet} onChange={v => { setTxSet(v); setPage(0); }} options={TX_SET_OPTS} />
                <FilterSelect value={status} onChange={v => { setStatus(v); setPage(0); }} options={STATUS_OPTS} />
                <FilterSelect value={direction} onChange={v => { setDir(v); setPage(0); }} options={DIR_OPTS} />
            </Toolbar>

            <DataTable cols={COLS} rows={rows} loading={loading}
                rowKey={r => r.transaction_id}
                onRowClick={r => setSelected(r)} />

            <PaginationBar page={page} pageSize={50} total={total} onPageChange={setPage} />

            <Slideout open={!!selected} onClose={() => setSelected(null)} title={`Transaction ${selected?.tx_set ?? ""} #${selected?.transaction_id ?? ""}`}>
                {selected && (
                    <div className="flex flex-col gap-2">
                        <SectionHeader title="Envelope" />
                        <DetailGrid>
                            <DetailField label="TX Set" value={`${selected.tx_set} — ${TX_LABELS[selected.tx_set] ?? ""}`} />
                            <DetailField label="Direction" value={selected.direction} />
                            <DetailField label="ST Control" value={selected.st_control} mono />
                            <DetailField label="ISA Control" value={selected.isa_control} mono />
                            <DetailField label="Partner" value={selected.partner_name} />
                            <DetailField label="ISA ID" value={selected.partner_isa} mono />
                        </DetailGrid>

                        <SectionHeader title="Processing" />
                        <DetailGrid>
                            <DetailField label="Status" value={selected.status} />
                            <DetailField label="Segments" value={selected.segment_count} />
                            <DetailField label="Received" value={fmtDate(selected.received_at, true)} />
                            <DetailField label="Processed" value={fmtDate(selected.processed_at, true)} />
                            {selected.target_id && (
                                <DetailField label="Target" value={`${selected.target_entity} #${selected.target_id}`} />
                            )}
                        </DetailGrid>

                        {selected.error_message && (
                            <>
                                <SectionHeader title="Error" />
                                <div className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm font-mono whitespace-pre-wrap">
                                    {selected.error_message}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </Slideout>
        </section>
    );
}
