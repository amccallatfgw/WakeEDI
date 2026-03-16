"use client";

import { useCallback, useEffect, useState } from "react";
import {
    DataTable, PageHeader, Toolbar, SearchBox, BtnPrimary, Slideout,
    SectionHeader, StatusBadge, ColDef,
} from "@/components/shared";

type Partner = {
    partner_id: number; name: string; isa_id: string; isa_qualifier: string;
    scac_code: string; contact_name: string; contact_email: string;
    target_app: string; is_active: boolean;
    active_connections: number; tx_set_count: number; week_volume: number;
};

const COLS: ColDef<Partner>[] = [
    { key: "name", label: "Partner Name", className: "font-semibold min-w-[180px]" },
    { key: "isa_id", label: "ISA ID", className: "font-mono text-xs w-[120px]",
        render: (v, row) => <span>{row.isa_qualifier}/{v}</span> },
    { key: "scac_code", label: "SCAC", className: "w-[80px] font-mono" },
    { key: "target_app", label: "Target App", className: "w-[120px] capitalize" },
    { key: "active_connections", label: "Connections", className: "w-[100px] text-center" },
    { key: "tx_set_count", label: "TX Sets", className: "w-[80px] text-center" },
    { key: "week_volume", label: "7d Vol", className: "w-[80px] text-center font-semibold" },
    { key: "is_active", label: "Status", className: "w-[100px]",
        render: v => <StatusBadge value={v ? "Active" : "Inactive"} /> },
];

export default function PartnersPage() {
    const [partners, setPartners] = useState<Partner[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [addOpen, setAddOpen] = useState(false);
    const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
    const [cloning, setCloning] = useState(false);
    const [cloneMsg, setCloneMsg] = useState("");
    const [form, setForm] = useState({ name: "", isa_id: "", isa_qualifier: "ZZ", scac_code: "", contact_name: "", contact_email: "", target_app: "freightwake" });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [templates, setTemplates] = useState<{ mapping_id: number; name: string; tx_set: string; direction: string }[]>([]);

    const load = useCallback(() => {
        setLoading(true);
        const p = new URLSearchParams();
        if (search) p.set("search", search);
        fetch(`/api/partners?${p}`)
            .then(r => r.json())
            .then(d => setPartners(d.partners ?? []))
            .finally(() => setLoading(false));
        fetch("/api/mappings")
            .then(r => r.json())
            .then(d => setTemplates((d.mappings ?? []).filter((m: any) => m.is_template)));
    }, [search]);

    useEffect(() => { load(); }, [load]);

    const handleAdd = async () => {
        if (!form.name || !form.isa_id) { setError("Name and ISA ID are required"); return; }
        setSaving(true); setError("");
        try {
            const res = await fetch("/api/partners", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
            const data = await res.json();
            if (!res.ok) { setError(data.error ?? "Failed"); return; }
            setAddOpen(false);
            setForm({ name: "", isa_id: "", isa_qualifier: "ZZ", scac_code: "", contact_name: "", contact_email: "", target_app: "freightwake" });
            load();
        } catch { setError("Something went wrong"); }
        finally { setSaving(false); }
    };

    const F = ({ label, field, placeholder, required, mono }: { label: string; field: keyof typeof form; placeholder?: string; required?: boolean; mono?: boolean }) => (
        <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-600">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
            <input type="text" value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                placeholder={placeholder}
                className={`h-10 px-3 rounded-lg border border-fw-border bg-white text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-accent ${mono ? "font-mono" : ""}`} />
        </div>
    );

    return (
        <section className="p-2">
            <PageHeader title="Trading Partners" subtitle="Companies you exchange EDI with"
                actions={<BtnPrimary onClick={() => setAddOpen(true)}>+ Add Partner</BtnPrimary>} />

            <Toolbar>
                <SearchBox value={search} onChange={setSearch} placeholder="Search partners..." />
            </Toolbar>

            <DataTable cols={COLS} rows={partners} loading={loading} rowKey={r => r.partner_id} onRowClick={r => { setSelectedPartner(r); setCloneMsg(""); }} />

            <Slideout open={addOpen} onClose={() => setAddOpen(false)} title="Add Trading Partner" width="w-[480px]">
                <div className="flex flex-col gap-4">
                    <SectionHeader title="Identity" />
                    <F label="Partner Name" field="name" placeholder="Acme Logistics" required />
                    <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-1">
                            <label className="text-xs font-semibold text-slate-600">Qualifier</label>
                            <select value={form.isa_qualifier} onChange={e => setForm(f => ({ ...f, isa_qualifier: e.target.value }))}
                                className="h-10 w-full px-2 rounded-lg border border-fw-border bg-white text-sm font-mono">
                                <option value="ZZ">ZZ</option><option value="01">01 (DUNS)</option>
                                <option value="08">08 (UCC)</option><option value="14">14 (DUNS+4)</option>
                            </select>
                        </div>
                        <div className="col-span-2">
                            <F label="ISA ID" field="isa_id" placeholder="ACMELOGISTICS" required mono />
                        </div>
                    </div>
                    <F label="SCAC Code" field="scac_code" placeholder="ACME" mono />

                    <SectionHeader title="Contact" />
                    <F label="Contact Name" field="contact_name" placeholder="John Smith" />
                    <F label="Contact Email" field="contact_email" placeholder="edi@acmelogistics.com" />

                    <SectionHeader title="Target" />
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-600">Target Application</label>
                        <select value={form.target_app} onChange={e => setForm(f => ({ ...f, target_app: e.target.value }))}
                            className="h-10 px-3 rounded-lg border border-fw-border bg-white text-sm">
                            <option value="freightwake">FreightWake (TMS)</option>
                            <option value="custom">Custom Database</option>
                        </select>
                    </div>

                    {error && <div className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}

                    <button onClick={handleAdd} disabled={saving}
                        className="h-10 rounded-lg bg-accent text-white font-bold text-sm border-none cursor-pointer hover:bg-accent-hover disabled:opacity-60 mt-2">
                        {saving ? "Creating…" : "Create Partner"}
                    </button>
                </div>
            </Slideout>

            {/* Partner detail with Quick Setup */}
            <Slideout open={!!selectedPartner} onClose={() => setSelectedPartner(null)}
                title={selectedPartner?.name ?? ""} width="w-[480px]">
                {selectedPartner && (
                    <div className="flex flex-col gap-4">
                        <SectionHeader title="Partner Info" />
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div><span className="text-[11px] font-semibold text-ink-2 uppercase">ISA ID</span><p className="font-mono">{selectedPartner.isa_qualifier}/{selectedPartner.isa_id}</p></div>
                            <div><span className="text-[11px] font-semibold text-ink-2 uppercase">SCAC</span><p className="font-mono">{selectedPartner.scac_code || "—"}</p></div>
                            <div><span className="text-[11px] font-semibold text-ink-2 uppercase">Target App</span><p className="capitalize">{selectedPartner.target_app}</p></div>
                            <div><span className="text-[11px] font-semibold text-ink-2 uppercase">7d Volume</span><p className="font-semibold">{selectedPartner.week_volume}</p></div>
                        </div>

                        <SectionHeader title="Quick Setup — Apply Template" />
                        <p className="text-sm text-ink-2">Clone a mapping template to instantly wire this partner for EDI processing.</p>

                        {templates.length === 0 ? (
                            <p className="text-sm text-slate-400">No templates available. Run migration 004 to create standard templates.</p>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {templates.map(t => (
                                    <button key={t.mapping_id}
                                        disabled={cloning}
                                        onClick={async () => {
                                            setCloning(true); setCloneMsg("");
                                            try {
                                                const res = await fetch("/api/mappings/clone", {
                                                    method: "POST",
                                                    headers: { "Content-Type": "application/json" },
                                                    body: JSON.stringify({ templateId: t.mapping_id, partnerId: selectedPartner.partner_id }),
                                                });
                                                const data = await res.json();
                                                if (res.ok) {
                                                    setCloneMsg(`✓ Created "${data.name}" with ${data.rules_cloned} rules`);
                                                    load();
                                                } else {
                                                    setCloneMsg(`Error: ${data.error}`);
                                                }
                                            } catch { setCloneMsg("Something went wrong"); }
                                            finally { setCloning(false); }
                                        }}
                                        className="flex items-center justify-between px-4 py-3 rounded-xl border border-fw-border bg-white hover:bg-slate-50 transition-colors text-left"
                                    >
                                        <div>
                                            <p className="text-sm font-semibold text-ink">{t.name}</p>
                                            <p className="text-xs text-ink-2 mt-0.5">
                                                <span className="font-mono">{t.tx_set}</span> {t.direction}
                                            </p>
                                        </div>
                                        <span className="text-xs font-semibold text-accent">Use →</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {cloneMsg && (
                            <div className={`px-3 py-2 rounded-lg text-sm ${cloneMsg.startsWith("✓") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                                {cloneMsg}
                            </div>
                        )}
                    </div>
                )}
            </Slideout>
        </section>
    );
}
