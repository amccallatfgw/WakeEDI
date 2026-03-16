"use client";

import { useCallback, useEffect, useState } from "react";
import { DataTable, PageHeader, Toolbar, FilterSelect, PaginationBar, Slideout, DetailGrid, DetailField, SectionHeader, StatusBadge, fmtDate, ColDef } from "@/components/shared";

type Interchange = {
    interchange_id: number; partner_name: string; direction: string; isa_control: string;
    isa_sender_q: string; isa_sender_id: string; isa_receiver_q: string; isa_receiver_id: string;
    isa_date: string; isa_time: string; status: string; byte_count: number;
    error_message: string; received_at: string; processed_at: string; tx_count: number;
};

const COLS: ColDef<Interchange>[] = [
    { key: "isa_control", label: "ISA #", className: "w-[100px] font-mono font-semibold" },
    { key: "direction", label: "Dir", className: "w-[90px]",
        render: v => <span className={`text-xs font-semibold px-2 py-0.5 rounded ${v === "inbound" ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"}`}>{v}</span> },
    { key: "partner_name", label: "Partner", className: "min-w-[150px]" },
    { key: "isa_sender_id", label: "Sender", className: "w-[130px] font-mono text-xs" },
    { key: "isa_receiver_id", label: "Receiver", className: "w-[130px] font-mono text-xs" },
    { key: "status", label: "Status", className: "w-[110px]", render: v => <StatusBadge value={v} /> },
    { key: "tx_count", label: "TX", className: "w-[60px] text-center font-semibold" },
    { key: "byte_count", label: "Size", className: "w-[80px] text-xs",
        render: v => v ? `${(v / 1024).toFixed(1)} KB` : "—" },
    { key: "received_at", label: "Received", className: "w-[150px]", render: v => fmtDate(v, true) },
];

export default function InterchangesPage() {
    const [rows, setRows] = useState<Interchange[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [direction, setDir] = useState("");
    const [status, setStatus] = useState("");
    const [page, setPage] = useState(0);
    const [selected, setSelected] = useState<Interchange | null>(null);

    const load = useCallback(() => {
        setLoading(true);
        const p = new URLSearchParams({ page: String(page + 1), size: "50" });
        if (direction) p.set("direction", direction);
        if (status) p.set("status", status);
        fetch(`/api/transactions/interchanges?${p}`)
            .then(r => r.json())
            .then(d => { setRows(d.interchanges ?? []); setTotal(d.total ?? 0); })
            .finally(() => setLoading(false));
    }, [direction, status, page]);

    useEffect(() => { load(); }, [load]);

    return (
        <section className="p-2">
            <PageHeader title="Interchanges" subtitle="ISA/IEA envelope-level log of all EDI traffic" />
            <Toolbar>
                <FilterSelect value={direction} onChange={v => { setDir(v); setPage(0); }} options={[
                    { value: "", label: "All Directions" }, { value: "inbound", label: "Inbound" }, { value: "outbound", label: "Outbound" },
                ]} />
                <FilterSelect value={status} onChange={v => { setStatus(v); setPage(0); }} options={[
                    { value: "", label: "All Status" }, { value: "processed", label: "Processed" },
                    { value: "partial", label: "Partial" }, { value: "error", label: "Error" }, { value: "unmatched", label: "Unmatched" },
                ]} />
            </Toolbar>
            <DataTable cols={COLS} rows={rows} loading={loading} rowKey={r => r.interchange_id} onRowClick={r => setSelected(r)} />
            <PaginationBar page={page} pageSize={50} total={total} onPageChange={setPage} />

            <Slideout open={!!selected} onClose={() => setSelected(null)} title={`Interchange ISA ${selected?.isa_control ?? ""}`}>
                {selected && (
                    <>
                        <SectionHeader title="Envelope" />
                        <DetailGrid>
                            <DetailField label="ISA Control" value={selected.isa_control} mono />
                            <DetailField label="Direction" value={selected.direction} />
                            <DetailField label="Sender" value={`${selected.isa_sender_q}/${selected.isa_sender_id}`} mono />
                            <DetailField label="Receiver" value={`${selected.isa_receiver_q}/${selected.isa_receiver_id}`} mono />
                            <DetailField label="Partner" value={selected.partner_name} />
                            <DetailField label="Status" value={selected.status} />
                            <DetailField label="Transactions" value={selected.tx_count} />
                            <DetailField label="Size" value={selected.byte_count ? `${(selected.byte_count / 1024).toFixed(1)} KB` : "—"} />
                            <DetailField label="Received" value={fmtDate(selected.received_at, true)} />
                            <DetailField label="Processed" value={fmtDate(selected.processed_at, true)} />
                        </DetailGrid>
                        {selected.error_message && (
                            <>
                                <SectionHeader title="Error" />
                                <div className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm font-mono whitespace-pre-wrap">{selected.error_message}</div>
                            </>
                        )}
                    </>
                )}
            </Slideout>
        </section>
    );
}
