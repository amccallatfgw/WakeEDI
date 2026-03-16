"use client";

import { useCallback, useEffect, useState } from "react";
import { DataTable, PageHeader, BtnPrimary, Slideout, SectionHeader, StatusBadge, fmtDate, ColDef } from "@/components/shared";

type Trigger = {
    trigger_id: number; partner_name: string; name: string; description: string;
    source_app: string; source_event: string; tx_set: string;
    is_active: boolean; last_fired_at: string; fire_count: number;
};

const EVENT_LABELS: Record<string, string> = {
    "order.created": "Order Created",
    "order.status_change": "Order Status Change",
    "order.dispatched": "Order Dispatched",
    "order.delivered": "Order Delivered",
    "invoice.created": "Invoice Created",
};

const COLS: ColDef<Trigger>[] = [
    { key: "name", label: "Trigger Name", className: "font-semibold min-w-[180px]" },
    { key: "partner_name", label: "Partner", className: "min-w-[140px]" },
    { key: "source_event", label: "Event", className: "w-[180px]",
        render: v => <span className="text-xs bg-violet-50 text-violet-700 px-2 py-0.5 rounded font-semibold">{EVENT_LABELS[v] ?? v}</span> },
    { key: "tx_set", label: "Generates", className: "w-[100px] font-mono font-semibold" },
    { key: "is_active", label: "Status", className: "w-[90px]", render: v => <StatusBadge value={v ? "Active" : "Inactive"} /> },
    { key: "fire_count", label: "Fired", className: "w-[80px] text-center font-semibold" },
    { key: "last_fired_at", label: "Last Fired", className: "w-[150px]", render: v => v ? fmtDate(v, true) : "Never" },
];

export default function TriggersPage() {
    const [rows, setRows] = useState<Trigger[]>([]);
    const [loading, setLoading] = useState(true);
    const [partners, setPartners] = useState<{ partner_id: number; name: string }[]>([]);
    const [addOpen, setAddOpen] = useState(false);
    const [form, setForm] = useState({ name: "", partner_id: "", source_app: "freightwake", source_event: "order.status_change", tx_set: "214", description: "" });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const load = useCallback(() => {
        setLoading(true);
        fetch("/api/triggers").then(r => r.json()).then(d => setRows(d.triggers ?? [])).finally(() => setLoading(false));
        fetch("/api/partners?active=true").then(r => r.json()).then(d => setPartners(d.partners ?? []));
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleAdd = async () => {
        if (!form.name || !form.partner_id) { setError("Name and partner are required"); return; }
        setSaving(true); setError("");
        try {
            const res = await fetch("/api/triggers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
            if (!res.ok) { setError((await res.json()).error ?? "Failed"); return; }
            setAddOpen(false); setForm({ name: "", partner_id: "", source_app: "freightwake", source_event: "order.status_change", tx_set: "214", description: "" }); load();
        } catch { setError("Something went wrong"); }
        finally { setSaving(false); }
    };

    return (
        <section className="p-2">
            <PageHeader title="Outbound Triggers" subtitle="Automatically generate EDI when events occur in Wake Tech apps"
                actions={<BtnPrimary onClick={() => setAddOpen(true)}>+ Add Trigger</BtnPrimary>} />
            <DataTable cols={COLS} rows={rows} loading={loading} rowKey={r => r.trigger_id} />

            <Slideout open={addOpen} onClose={() => setAddOpen(false)} title="Add Outbound Trigger" width="w-[460px]">
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-600">Trigger Name *</label>
                        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            placeholder="e.g. Acme Status Updates" className="h-10 px-3 rounded-lg border border-fw-border bg-white text-sm" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-600">Trading Partner *</label>
                        <select value={form.partner_id} onChange={e => setForm(f => ({ ...f, partner_id: e.target.value }))}
                            className="h-10 px-3 rounded-lg border border-fw-border bg-white text-sm">
                            <option value="">Select partner…</option>
                            {partners.map(p => <option key={p.partner_id} value={p.partner_id}>{p.name}</option>)}
                        </select>
                    </div>

                    <SectionHeader title="Source Event" />
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-600">Source App</label>
                        <select value={form.source_app} onChange={e => setForm(f => ({ ...f, source_app: e.target.value }))}
                            className="h-10 px-3 rounded-lg border border-fw-border bg-white text-sm">
                            <option value="freightwake">FreightWake</option>
                            <option value="custom">Custom</option>
                        </select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-600">Event</label>
                        <select value={form.source_event} onChange={e => setForm(f => ({ ...f, source_event: e.target.value }))}
                            className="h-10 px-3 rounded-lg border border-fw-border bg-white text-sm">
                            <option value="order.created">Order Created</option>
                            <option value="order.status_change">Order Status Change</option>
                            <option value="order.dispatched">Order Dispatched</option>
                            <option value="order.delivered">Order Delivered</option>
                            <option value="invoice.created">Invoice Created</option>
                        </select>
                    </div>

                    <SectionHeader title="Output" />
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-600">Generate TX Set</label>
                        <select value={form.tx_set} onChange={e => setForm(f => ({ ...f, tx_set: e.target.value }))}
                            className="h-10 px-3 rounded-lg border border-fw-border bg-white text-sm font-mono">
                            <option value="214">214 — Shipment Status</option>
                            <option value="210">210 — Freight Invoice</option>
                            <option value="990">990 — Response to Tender</option>
                            <option value="997">997 — Acknowledgment</option>
                        </select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-600">Description</label>
                        <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            className="h-10 px-3 rounded-lg border border-fw-border bg-white text-sm" />
                    </div>

                    {error && <div className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}
                    <button onClick={handleAdd} disabled={saving}
                        className="h-10 rounded-lg bg-accent text-white font-bold text-sm border-none cursor-pointer hover:bg-accent-hover disabled:opacity-60 mt-2">
                        {saving ? "Creating…" : "Create Trigger"}
                    </button>
                </div>
            </Slideout>
        </section>
    );
}
