"use client";

import { useCallback, useEffect, useState } from "react";
import {
    DataTable, PageHeader, BtnPrimary, BtnSecondary, Slideout,
    SectionHeader, StatusBadge, ColDef,
} from "@/components/shared";

type MappingProfile = {
    mapping_id: number; partner_id: number; partner_name: string;
    name: string; tx_set: string; direction: string; target_app: string;
    description: string; is_template: boolean; rule_count: number;
};

type MappingRule = {
    rule_id: number; x12_path: string; x12_segment: string; x12_element: number;
    x12_loop: string; target_table: string; target_column: string;
    transform: string; is_required: boolean; sort_order: number;
};

const TX_LABELS: Record<string, string> = {
    "204": "Load Tender", "210": "Invoice", "214": "Status", "990": "Response", "997": "Ack",
};

const PROFILE_COLS: ColDef<MappingProfile>[] = [
    { key: "name", label: "Profile Name", className: "font-semibold min-w-[200px]" },
    { key: "tx_set", label: "TX Set", className: "w-[120px] font-mono",
        render: v => <span>{v} <span className="text-xs text-ink-2">{TX_LABELS[v] ?? ""}</span></span> },
    { key: "direction", label: "Dir", className: "w-[90px]",
        render: v => <span className={`text-xs font-semibold px-2 py-0.5 rounded ${v === "inbound" ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"}`}>{v}</span> },
    { key: "partner_name", label: "Partner", className: "min-w-[150px]",
        render: (v, row) => row.is_template ? <span className="text-xs px-2 py-0.5 rounded bg-violet-50 text-violet-600 font-semibold">Template</span> : (v ?? "—") },
    { key: "target_app", label: "Target", className: "w-[120px] capitalize" },
    { key: "rule_count", label: "Rules", className: "w-[80px] text-center font-semibold" },
];

export default function MappingsPage() {
    const [profiles, setProfiles] = useState<MappingProfile[]>([]);
    const [loading, setLoading]   = useState(true);
    const [selected, setSelected] = useState<MappingProfile | null>(null);
    const [rules, setRules]       = useState<MappingRule[]>([]);
    const [rulesLoading, setRulesLoading] = useState(false);
    const [addOpen, setAddOpen]   = useState(false);
    const [addRuleOpen, setAddRuleOpen] = useState(false);
    const [form, setForm] = useState({ name: "", tx_set: "204", direction: "inbound", target_app: "freightwake", description: "", is_template: false });
    const [ruleForm, setRuleForm] = useState({ x12_segment: "", x12_element: 1, x12_loop: "", target_table: "", target_column: "", transform: "none", is_required: false });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    // Schema introspection — live tables/columns from target database
    const [schema, setSchema] = useState<{ table_name: string; columns: { column_name: string; data_type: string }[] }[]>([]);
    const [schemaLoaded, setSchemaLoaded] = useState(false);

    const loadSchema = useCallback((targetApp: string) => {
        fetch(`/api/schema?target=${targetApp}`)
            .then(r => r.json())
            .then(d => { setSchema(d.tables ?? []); setSchemaLoaded(true); })
            .catch(() => setSchemaLoaded(false));
    }, []);

    const load = useCallback(() => {
        setLoading(true);
        fetch("/api/mappings").then(r => r.json()).then(d => setProfiles(d.mappings ?? [])).finally(() => setLoading(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    const loadRules = async (mappingId: number) => {
        setRulesLoading(true);
        const res = await fetch(`/api/mappings?mappingId=${mappingId}`);
        const data = await res.json();
        setRules(data.rules ?? []);
        setRulesLoading(false);
    };

    const handleSelectProfile = (row: MappingProfile) => {
        setSelected(row);
        loadRules(row.mapping_id);
    };

    const handleAddProfile = async () => {
        if (!form.name) { setError("Name required"); return; }
        setSaving(true); setError("");
        try {
            const res = await fetch("/api/mappings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
            if (!res.ok) { setError((await res.json()).error ?? "Failed"); return; }
            setAddOpen(false); load();
        } catch { setError("Something went wrong"); }
        finally { setSaving(false); }
    };

    const handleAddRule = async () => {
        if (!selected || !ruleForm.x12_segment || !ruleForm.target_table || !ruleForm.target_column) { setError("Fill all required fields"); return; }
        setSaving(true); setError("");
        try {
            const body = {
                action: "add_rule",
                mapping_id: selected.mapping_id,
                x12_path: `${ruleForm.x12_segment}/${String(ruleForm.x12_element).padStart(2, "0")}`,
                ...ruleForm,
                sort_order: rules.length + 1,
            };
            const res = await fetch("/api/mappings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
            if (!res.ok) { setError((await res.json()).error ?? "Failed"); return; }
            setAddRuleOpen(false);
            setRuleForm({ x12_segment: "", x12_element: 1, x12_loop: "", target_table: "", target_column: "", transform: "none", is_required: false });
            loadRules(selected.mapping_id);
            load();
        } catch { setError("Something went wrong"); }
        finally { setSaving(false); }
    };

    return (
        <section className="p-2">
            <PageHeader title="Field Mappings" subtitle="SARA mapping profiles — map X12 segments to Wake Tech fields"
                actions={<BtnPrimary onClick={() => setAddOpen(true)}>+ New Profile</BtnPrimary>} />

            <DataTable cols={PROFILE_COLS} rows={profiles} loading={loading}
                rowKey={r => r.mapping_id} onRowClick={handleSelectProfile} />

            {/* Rules detail slideout */}
            <Slideout open={!!selected} onClose={() => setSelected(null)}
                title={selected ? `${selected.name} — ${selected.tx_set} ${selected.direction}` : ""} width="w-[640px]">
                {selected && (
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-sm text-ink-2">{selected.description || "No description"}</p>
                            <BtnPrimary onClick={() => { setAddRuleOpen(true); if (!schemaLoaded && selected.target_app) loadSchema(selected.target_app); }}>+ Add Rule</BtnPrimary>
                        </div>

                        <div className="bg-side-bg rounded-xl border border-fw-border overflow-hidden">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-fw-border">
                                        <th className="px-3 py-2.5 text-left font-bold text-ink-2">X12 Segment</th>
                                        <th className="px-3 py-2.5 text-left font-bold text-ink-2">Element</th>
                                        <th className="px-3 py-2.5 text-left font-bold text-ink-2">→</th>
                                        <th className="px-3 py-2.5 text-left font-bold text-ink-2">Target Table</th>
                                        <th className="px-3 py-2.5 text-left font-bold text-ink-2">Column</th>
                                        <th className="px-3 py-2.5 text-left font-bold text-ink-2">Transform</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rulesLoading ? (
                                        <tr><td colSpan={6} className="px-3 py-8 text-center"><div className="spinner mx-auto" /></td></tr>
                                    ) : rules.length === 0 ? (
                                        <tr><td colSpan={6} className="px-3 py-8 text-center text-ink-2">No rules yet. Add rules to map X12 segments to database fields.</td></tr>
                                    ) : rules.map(r => (
                                        <tr key={r.rule_id} className="border-b border-slate-100 bg-white hover:bg-slate-50">
                                            <td className="px-3 py-2 font-mono font-bold text-blue-700">{r.x12_segment}{r.x12_loop ? <span className="text-slate-400 font-normal"> ({r.x12_loop})</span> : ""}</td>
                                            <td className="px-3 py-2 font-mono">{String(r.x12_element).padStart(2, "0")}</td>
                                            <td className="px-3 py-2 text-slate-400">→</td>
                                            <td className="px-3 py-2 font-mono text-emerald-700">{r.target_table}</td>
                                            <td className="px-3 py-2 font-mono">{r.target_column}{r.is_required ? <span className="text-red-500 ml-0.5">*</span> : ""}</td>
                                            <td className="px-3 py-2">{r.transform !== "none" ? <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded text-[10px] font-semibold">{r.transform}</span> : "—"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </Slideout>

            {/* Add Profile slideout */}
            <Slideout open={addOpen} onClose={() => setAddOpen(false)} title="New Mapping Profile" width="w-[420px]">
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-600">Profile Name *</label>
                        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            placeholder="e.g. Acme 204 Inbound" className="h-10 px-3 rounded-lg border border-fw-border bg-white text-sm" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold text-slate-600">TX Set</label>
                            <select value={form.tx_set} onChange={e => setForm(f => ({ ...f, tx_set: e.target.value }))}
                                className="h-10 px-2 rounded-lg border border-fw-border bg-white text-sm font-mono">
                                <option value="204">204 — Load Tender</option><option value="210">210 — Invoice</option>
                                <option value="214">214 — Status</option><option value="990">990 — Response</option>
                                <option value="997">997 — Ack</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold text-slate-600">Direction</label>
                            <select value={form.direction} onChange={e => setForm(f => ({ ...f, direction: e.target.value }))}
                                className="h-10 px-2 rounded-lg border border-fw-border bg-white text-sm">
                                <option value="inbound">Inbound</option><option value="outbound">Outbound</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-600">Description</label>
                        <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            className="h-10 px-3 rounded-lg border border-fw-border bg-white text-sm" />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-ink">
                        <input type="checkbox" checked={form.is_template} onChange={e => setForm(f => ({ ...f, is_template: e.target.checked }))} />
                        Save as reusable template
                    </label>
                    {error && <div className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}
                    <button onClick={handleAddProfile} disabled={saving}
                        className="h-10 rounded-lg bg-accent text-white font-bold text-sm border-none cursor-pointer hover:bg-accent-hover disabled:opacity-60">
                        {saving ? "Creating…" : "Create Profile"}
                    </button>
                </div>
            </Slideout>

            {/* Add Rule slideout */}
            <Slideout open={addRuleOpen} onClose={() => setAddRuleOpen(false)} title="Add Mapping Rule" width="w-[420px]">
                <div className="flex flex-col gap-4">
                    <SectionHeader title="X12 Source" />
                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold text-slate-600">Segment *</label>
                            <input value={ruleForm.x12_segment} onChange={e => setRuleForm(f => ({ ...f, x12_segment: e.target.value.toUpperCase() }))}
                                placeholder="B2, S5, N1…" className="h-10 px-3 rounded-lg border border-fw-border bg-white text-sm font-mono" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold text-slate-600">Element # *</label>
                            <input type="number" min={1} value={ruleForm.x12_element} onChange={e => setRuleForm(f => ({ ...f, x12_element: parseInt(e.target.value) || 1 }))}
                                className="h-10 px-3 rounded-lg border border-fw-border bg-white text-sm font-mono" />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-600">Loop Context (optional)</label>
                        <input value={ruleForm.x12_loop} onChange={e => setRuleForm(f => ({ ...f, x12_loop: e.target.value.toUpperCase() }))}
                            placeholder="S5 for stop loops, N1 for entity loops…" className="h-10 px-3 rounded-lg border border-fw-border bg-white text-sm font-mono" />
                    </div>

                    <SectionHeader title="Target Field" />
                    {!schemaLoaded && selected?.target_app && (
                        <button onClick={() => loadSchema(selected.target_app)} className="text-xs text-accent hover:underline mb-2">
                            Load {selected.target_app} schema →
                        </button>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold text-slate-600">Table *</label>
                            {schema.length > 0 ? (
                                <select value={ruleForm.target_table}
                                    onChange={e => setRuleForm(f => ({ ...f, target_table: e.target.value, target_column: "" }))}
                                    className="h-10 px-2 rounded-lg border border-fw-border bg-white text-sm font-mono">
                                    <option value="">Select table…</option>
                                    {schema.map(t => <option key={t.table_name} value={t.table_name}>{t.table_name}</option>)}
                                </select>
                            ) : (
                                <input value={ruleForm.target_table} onChange={e => setRuleForm(f => ({ ...f, target_table: e.target.value }))}
                                    placeholder="orders, order_stops…" className="h-10 px-3 rounded-lg border border-fw-border bg-white text-sm font-mono" />
                            )}
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold text-slate-600">Column *</label>
                            {schema.length > 0 && ruleForm.target_table ? (
                                <select value={ruleForm.target_column}
                                    onChange={e => setRuleForm(f => ({ ...f, target_column: e.target.value }))}
                                    className="h-10 px-2 rounded-lg border border-fw-border bg-white text-sm font-mono">
                                    <option value="">Select column…</option>
                                    {schema.find(t => t.table_name === ruleForm.target_table)?.columns.map(c => (
                                        <option key={c.column_name} value={c.column_name}>{c.column_name} ({c.data_type})</option>
                                    ))}
                                </select>
                            ) : (
                                <input value={ruleForm.target_column} onChange={e => setRuleForm(f => ({ ...f, target_column: e.target.value }))}
                                    placeholder="customer_ref…" className="h-10 px-3 rounded-lg border border-fw-border bg-white text-sm font-mono" />
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold text-slate-600">Transform</label>
                            <select value={ruleForm.transform} onChange={e => setRuleForm(f => ({ ...f, transform: e.target.value }))}
                                className="h-10 px-2 rounded-lg border border-fw-border bg-white text-sm">
                                <option value="none">None</option><option value="trim">Trim</option><option value="upper">Uppercase</option>
                                <option value="date">Date (CCYYMMDD)</option><option value="time">Time (HHMM)</option>
                                <option value="integer">Integer</option><option value="decimal">Decimal</option>
                                <option value="boolean">Boolean</option><option value="lookup">Lookup Table</option>
                            </select>
                        </div>
                        <label className="flex items-center gap-2 text-sm text-ink self-end pb-2">
                            <input type="checkbox" checked={ruleForm.is_required} onChange={e => setRuleForm(f => ({ ...f, is_required: e.target.checked }))} />
                            Required
                        </label>
                    </div>

                    {error && <div className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}
                    <button onClick={handleAddRule} disabled={saving}
                        className="h-10 rounded-lg bg-accent text-white font-bold text-sm border-none cursor-pointer hover:bg-accent-hover disabled:opacity-60">
                        {saving ? "Adding…" : "Add Rule"}
                    </button>
                </div>
            </Slideout>
        </section>
    );
}
