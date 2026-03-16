"use client";

import { useCallback, useEffect, useState } from "react";
import { DataTable, PageHeader, Toolbar, SearchBox, FilterSelect, BtnPrimary, Slideout, ColDef } from "@/components/shared";

type Lookup = {
    lookup_id: number; table_name: string; source_code: string;
    target_value: string; description: string;
};

const COLS: ColDef<Lookup>[] = [
    { key: "table_name", label: "Table", className: "w-[160px] font-mono font-semibold text-blue-700" },
    { key: "source_code", label: "Source Code", className: "w-[120px] font-mono" },
    { key: "target_value", label: "Target Value", className: "min-w-[160px] font-semibold" },
    { key: "description", label: "Description", className: "min-w-[200px] text-ink-2" },
];

export default function LookupsPage() {
    const [rows, setRows] = useState<Lookup[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [tableFilter, setTableFilter] = useState("");
    const [tables, setTables] = useState<string[]>([]);
    const [addOpen, setAddOpen] = useState(false);
    const [form, setForm] = useState({ table_name: "", source_code: "", target_value: "", description: "" });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const load = useCallback(() => {
        setLoading(true);
        const p = new URLSearchParams();
        if (search) p.set("search", search);
        if (tableFilter) p.set("table_name", tableFilter);
        fetch(`/api/mappings/lookups?${p}`)
            .then(r => r.json())
            .then(d => {
                setRows(d.lookups ?? []);
                if (d.tables) setTables(d.tables);
            })
            .finally(() => setLoading(false));
    }, [search, tableFilter]);

    useEffect(() => { load(); }, [load]);

    const handleAdd = async () => {
        if (!form.table_name || !form.source_code || !form.target_value) { setError("Table, source code, and target value are required"); return; }
        setSaving(true); setError("");
        try {
            const res = await fetch("/api/mappings/lookups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
            if (!res.ok) { setError((await res.json()).error ?? "Failed"); return; }
            setAddOpen(false);
            setForm({ table_name: "", source_code: "", target_value: "", description: "" });
            load();
        } catch { setError("Something went wrong"); }
        finally { setSaving(false); }
    };

    const tableOpts = [{ value: "", label: "All Tables" }, ...tables.map(t => ({ value: t, label: t }))];

    return (
        <section className="p-2">
            <PageHeader title="Lookup Tables" subtitle="Code translation tables used by SARA mapping transforms"
                actions={<BtnPrimary onClick={() => setAddOpen(true)}>+ Add Entry</BtnPrimary>} />
            <Toolbar>
                <SearchBox value={search} onChange={setSearch} placeholder="Search codes..." />
                <FilterSelect value={tableFilter} onChange={v => setTableFilter(v)} options={tableOpts} />
            </Toolbar>
            <DataTable cols={COLS} rows={rows} loading={loading} rowKey={r => r.lookup_id} />

            <Slideout open={addOpen} onClose={() => setAddOpen(false)} title="Add Lookup Entry" width="w-[400px]">
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-600">Table Name *</label>
                        <input value={form.table_name} onChange={e => setForm(f => ({ ...f, table_name: e.target.value }))}
                            placeholder="equipment_type, stop_reason, shipment_status..."
                            className="h-10 px-3 rounded-lg border border-fw-border bg-white text-sm font-mono" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-600">Source Code *</label>
                        <input value={form.source_code} onChange={e => setForm(f => ({ ...f, source_code: e.target.value }))}
                            placeholder="X12 code (e.g. TL, FT, CL)"
                            className="h-10 px-3 rounded-lg border border-fw-border bg-white text-sm font-mono" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-600">Target Value *</label>
                        <input value={form.target_value} onChange={e => setForm(f => ({ ...f, target_value: e.target.value }))}
                            placeholder="Wake Tech value (e.g. Van, Flatbed, pickup)"
                            className="h-10 px-3 rounded-lg border border-fw-border bg-white text-sm" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-600">Description</label>
                        <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            className="h-10 px-3 rounded-lg border border-fw-border bg-white text-sm" />
                    </div>
                    {error && <div className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}
                    <button onClick={handleAdd} disabled={saving}
                        className="h-10 rounded-lg bg-accent text-white font-bold text-sm border-none cursor-pointer hover:bg-accent-hover disabled:opacity-60 mt-2">
                        {saving ? "Adding…" : "Add Entry"}
                    </button>
                </div>
            </Slideout>
        </section>
    );
}
