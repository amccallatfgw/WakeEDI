"use client";

import { useCallback, useEffect, useState } from "react";
import { DataTable, PageHeader, Toolbar, FilterSelect, PaginationBar, StatusBadge, fmtDate, ColDef } from "@/components/shared";

type TriggerLog = {
    log_id: number; trigger_name: string; partner_name: string; tx_set: string;
    source_entity: string; source_id: number; status: string; error_message: string; created_at: string;
};

const COLS: ColDef<TriggerLog>[] = [
    { key: "trigger_name", label: "Trigger", className: "font-semibold min-w-[160px]" },
    { key: "partner_name", label: "Partner", className: "min-w-[140px]" },
    { key: "tx_set", label: "TX Set", className: "w-[80px] font-mono font-semibold" },
    { key: "source_entity", label: "Source", className: "w-[120px]",
        render: (v, row) => v ? <span className="text-xs">{v} #{row.source_id}</span> : "—" },
    { key: "status", label: "Status", className: "w-[100px]", render: v => <StatusBadge value={v} /> },
    { key: "created_at", label: "Fired At", className: "w-[150px]", render: v => fmtDate(v, true) },
];

export default function TriggerLogPage() {
    const [rows, setRows] = useState<TriggerLog[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState("");
    const [page, setPage] = useState(0);

    const load = useCallback(() => {
        setLoading(true);
        const p = new URLSearchParams({ page: String(page + 1), size: "50" });
        if (status) p.set("status", status);
        fetch(`/api/triggers/log?${p}`)
            .then(r => r.json())
            .then(d => { setRows(d.logs ?? []); setTotal(d.total ?? 0); })
            .finally(() => setLoading(false));
    }, [status, page]);

    useEffect(() => { load(); }, [load]);

    return (
        <section className="p-2">
            <PageHeader title="Trigger Log" subtitle="Execution history of outbound EDI triggers" />
            <Toolbar>
                <FilterSelect value={status} onChange={v => { setStatus(v); setPage(0); }} options={[
                    { value: "", label: "All Status" }, { value: "success", label: "Success" },
                    { value: "error", label: "Error" }, { value: "pending", label: "Pending" },
                ]} />
            </Toolbar>
            <DataTable cols={COLS} rows={rows} loading={loading} rowKey={r => r.log_id} />
            <PaginationBar page={page} pageSize={50} total={total} onPageChange={setPage} />
        </section>
    );
}
