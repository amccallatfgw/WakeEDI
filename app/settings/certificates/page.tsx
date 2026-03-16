"use client";

import { useCallback, useEffect, useState } from "react";
import { DataTable, PageHeader, BtnPrimary, Slideout, SectionHeader, StatusBadge, fmtDate, ColDef } from "@/components/shared";

type Cert = {
    cert_id: number; partner_name: string; label: string; cert_type: string;
    serial_number: string; issuer: string; subject: string;
    not_before: string; not_after: string; fingerprint: string; is_active: boolean;
};

const COLS: ColDef<Cert>[] = [
    { key: "label", label: "Label", className: "font-semibold min-w-[180px]" },
    { key: "cert_type", label: "Type", className: "w-[90px]",
        render: v => <span className={`text-xs font-semibold px-2 py-0.5 rounded ${v === "public" ? "bg-blue-50 text-blue-700" : v === "private" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{v}</span> },
    { key: "partner_name", label: "Partner", className: "min-w-[140px]" },
    { key: "subject", label: "Subject", className: "min-w-[200px] text-xs font-mono truncate max-w-[300px]" },
    { key: "not_after", label: "Expires", className: "w-[120px]",
        render: v => {
            if (!v) return "—";
            const d = new Date(v);
            const isExpired = d < new Date();
            const isSoon = d < new Date(Date.now() + 30 * 86400000);
            return <span className={`text-xs font-semibold ${isExpired ? "text-red-600" : isSoon ? "text-amber-600" : "text-emerald-600"}`}>{fmtDate(v)}</span>;
        }
    },
    { key: "is_active", label: "Status", className: "w-[90px]", render: v => <StatusBadge value={v ? "Active" : "Inactive"} /> },
];

export default function CertificatesPage() {
    const [rows, setRows] = useState<Cert[]>([]);
    const [loading, setLoading] = useState(true);
    const [partners, setPartners] = useState<{ partner_id: number; name: string }[]>([]);
    const [addOpen, setAddOpen] = useState(false);
    const [form, setForm] = useState({ partner_id: "", label: "", cert_type: "public", pem_data: "" });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const load = useCallback(() => {
        setLoading(true);
        fetch("/api/settings/certificates").then(r => r.json()).then(d => setRows(d.certificates ?? [])).finally(() => setLoading(false));
        fetch("/api/partners?active=true").then(r => r.json()).then(d => setPartners(d.partners ?? []));
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleAdd = async () => {
        if (!form.label || !form.pem_data) { setError("Label and PEM data are required"); return; }
        setSaving(true); setError("");
        try {
            const res = await fetch("/api/settings/certificates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
            if (!res.ok) { setError((await res.json()).error ?? "Failed"); return; }
            setAddOpen(false); setForm({ partner_id: "", label: "", cert_type: "public", pem_data: "" }); load();
        } catch { setError("Something went wrong"); }
        finally { setSaving(false); }
    };

    return (
        <section className="p-2">
            <PageHeader title="Certificates" subtitle="X.509 certificates for AS2 signing and encryption"
                actions={<BtnPrimary onClick={() => setAddOpen(true)}>+ Upload Certificate</BtnPrimary>} />
            <DataTable cols={COLS} rows={rows} loading={loading} rowKey={r => r.cert_id} />

            <Slideout open={addOpen} onClose={() => setAddOpen(false)} title="Upload Certificate" width="w-[480px]">
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-600">Label *</label>
                        <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                            placeholder="e.g. Acme Public Key 2026" className="h-10 px-3 rounded-lg border border-fw-border bg-white text-sm" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold text-slate-600">Type</label>
                            <select value={form.cert_type} onChange={e => setForm(f => ({ ...f, cert_type: e.target.value }))}
                                className="h-10 px-3 rounded-lg border border-fw-border bg-white text-sm">
                                <option value="public">Public Key</option>
                                <option value="private">Private Key</option>
                                <option value="ca">CA Certificate</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold text-slate-600">Partner</label>
                            <select value={form.partner_id} onChange={e => setForm(f => ({ ...f, partner_id: e.target.value }))}
                                className="h-10 px-3 rounded-lg border border-fw-border bg-white text-sm">
                                <option value="">Our certificate</option>
                                {partners.map(p => <option key={p.partner_id} value={p.partner_id}>{p.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-600">PEM Data *</label>
                        <textarea value={form.pem_data} onChange={e => setForm(f => ({ ...f, pem_data: e.target.value }))}
                            rows={10} placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                            className="px-3 py-2 rounded-lg border border-fw-border bg-white text-xs font-mono outline-none focus:ring-2 focus:ring-blue-100 focus:border-accent" />
                    </div>
                    {error && <div className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}
                    <button onClick={handleAdd} disabled={saving}
                        className="h-10 rounded-lg bg-accent text-white font-bold text-sm border-none cursor-pointer hover:bg-accent-hover disabled:opacity-60 mt-2">
                        {saving ? "Uploading…" : "Upload Certificate"}
                    </button>
                </div>
            </Slideout>
        </section>
    );
}
