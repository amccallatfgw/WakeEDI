"use client";

import { useCallback, useEffect, useState } from "react";
import { DataTable, PageHeader, Toolbar, BtnPrimary, Slideout, SectionHeader, StatusBadge, ColDef } from "@/components/shared";

type Connection = {
    connection_id: number; partner_id: number; partner_name: string; isa_id: string;
    protocol: string; as2_id_local: string; as2_id_remote: string; as2_url: string;
    encrypt_algo: string; sign_algo: string; mdn_mode: string;
    sftp_host: string; sftp_port: number; sftp_user: string;
    is_active: boolean; last_test_at: string; last_test_ok: boolean;
};

const COLS: ColDef<Connection>[] = [
    { key: "partner_name", label: "Partner", className: "font-semibold min-w-[160px]" },
    { key: "protocol", label: "Protocol", className: "w-[90px]",
        render: v => <span className={`font-mono font-bold text-xs px-2 py-0.5 rounded ${v === "AS2" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>{v}</span> },
    { key: "as2_url", label: "Endpoint", className: "min-w-[200px] text-xs font-mono truncate max-w-[300px]",
        render: (v, row) => row.protocol === "AS2" ? (v || "—") : `${row.sftp_host || "—"}:${row.sftp_port}` },
    { key: "encrypt_algo", label: "Encryption", className: "w-[100px] text-xs font-mono" },
    { key: "mdn_mode", label: "MDN", className: "w-[80px] capitalize text-xs" },
    { key: "is_active", label: "Status", className: "w-[90px]",
        render: v => <StatusBadge value={v ? "Active" : "Inactive"} /> },
    { key: "last_test_ok", label: "Test", className: "w-[80px]",
        render: (v, row) => !row.last_test_at ? <span className="text-xs text-slate-400">Never</span> :
            <span className={`text-xs font-semibold ${v ? "text-emerald-600" : "text-red-600"}`}>{v ? "✓ Pass" : "✗ Fail"}</span> },
];

export default function ConnectionsPage() {
    const [rows, setRows] = useState<Connection[]>([]);
    const [loading, setLoading] = useState(true);
    const [partners, setPartners] = useState<{ partner_id: number; name: string }[]>([]);
    const [addOpen, setAddOpen] = useState(false);
    const [protocol, setProtocol] = useState<"AS2" | "SFTP">("AS2");
    const [form, setForm] = useState<any>({ partner_id: "", protocol: "AS2", as2_id_local: "", as2_id_remote: "", as2_url: "", encrypt_algo: "AES256", sign_algo: "SHA256", mdn_mode: "sync", sftp_host: "", sftp_port: 22, sftp_user: "", sftp_path: "" });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const load = useCallback(() => {
        setLoading(true);
        fetch("/api/connections").then(r => r.json()).then(d => setRows(d.connections ?? [])).finally(() => setLoading(false));
        fetch("/api/partners?active=true").then(r => r.json()).then(d => setPartners(d.partners ?? []));
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleAdd = async () => {
        if (!form.partner_id) { setError("Select a partner"); return; }
        setSaving(true); setError("");
        try {
            const res = await fetch("/api/connections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, protocol }) });
            if (!res.ok) { setError((await res.json()).error ?? "Failed"); return; }
            setAddOpen(false); load();
        } catch { setError("Something went wrong"); }
        finally { setSaving(false); }
    };

    return (
        <section className="p-2">
            <PageHeader title="Connections" subtitle="AS2 and SFTP connections to trading partners"
                actions={<BtnPrimary onClick={() => setAddOpen(true)}>+ Add Connection</BtnPrimary>} />
            <DataTable cols={COLS} rows={rows} loading={loading} rowKey={r => r.connection_id} />

            <Slideout open={addOpen} onClose={() => setAddOpen(false)} title="Add Connection" width="w-[480px]">
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-600">Partner *</label>
                        <select value={form.partner_id} onChange={e => setForm((f: any) => ({ ...f, partner_id: parseInt(e.target.value) }))}
                            className="h-10 px-3 rounded-lg border border-fw-border bg-white text-sm">
                            <option value="">Select partner…</option>
                            {partners.map(p => <option key={p.partner_id} value={p.partner_id}>{p.name}</option>)}
                        </select>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-600">Protocol</label>
                        <div className="flex gap-2">
                            {(["AS2", "SFTP"] as const).map(p => (
                                <button key={p} onClick={() => { setProtocol(p); setForm((f: any) => ({ ...f, protocol: p })); }}
                                    className={`flex-1 h-10 rounded-lg text-sm font-semibold transition-colors ${protocol === p ? "bg-accent text-white" : "border border-fw-border bg-white text-ink hover:bg-slate-50"}`}>
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>

                    {protocol === "AS2" && (
                        <>
                            <SectionHeader title="AS2 Configuration" />
                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-semibold text-slate-600">Our AS2 ID</label>
                                    <input value={form.as2_id_local} onChange={e => setForm((f: any) => ({ ...f, as2_id_local: e.target.value }))}
                                        placeholder="WAKETECH" className="h-10 px-3 rounded-lg border border-fw-border bg-white text-sm font-mono" />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-semibold text-slate-600">Their AS2 ID</label>
                                    <input value={form.as2_id_remote} onChange={e => setForm((f: any) => ({ ...f, as2_id_remote: e.target.value }))}
                                        placeholder="PARTNER123" className="h-10 px-3 rounded-lg border border-fw-border bg-white text-sm font-mono" />
                                </div>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-semibold text-slate-600">AS2 Endpoint URL</label>
                                <input value={form.as2_url} onChange={e => setForm((f: any) => ({ ...f, as2_url: e.target.value }))}
                                    placeholder="https://partner.com/as2/receive" className="h-10 px-3 rounded-lg border border-fw-border bg-white text-sm font-mono" />
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-semibold text-slate-600">Encryption</label>
                                    <select value={form.encrypt_algo} onChange={e => setForm((f: any) => ({ ...f, encrypt_algo: e.target.value }))}
                                        className="h-10 px-2 rounded-lg border border-fw-border bg-white text-sm">
                                        <option value="AES256">AES-256</option><option value="AES128">AES-128</option><option value="3DES">3DES</option><option value="none">None</option>
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-semibold text-slate-600">Signing</label>
                                    <select value={form.sign_algo} onChange={e => setForm((f: any) => ({ ...f, sign_algo: e.target.value }))}
                                        className="h-10 px-2 rounded-lg border border-fw-border bg-white text-sm">
                                        <option value="SHA256">SHA-256</option><option value="SHA1">SHA-1</option><option value="none">None</option>
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-semibold text-slate-600">MDN</label>
                                    <select value={form.mdn_mode} onChange={e => setForm((f: any) => ({ ...f, mdn_mode: e.target.value }))}
                                        className="h-10 px-2 rounded-lg border border-fw-border bg-white text-sm">
                                        <option value="sync">Sync</option><option value="async">Async</option><option value="none">None</option>
                                    </select>
                                </div>
                            </div>
                        </>
                    )}

                    {protocol === "SFTP" && (
                        <>
                            <SectionHeader title="SFTP Configuration" />
                            <div className="grid grid-cols-3 gap-3">
                                <div className="col-span-2 flex flex-col gap-1">
                                    <label className="text-xs font-semibold text-slate-600">Host</label>
                                    <input value={form.sftp_host} onChange={e => setForm((f: any) => ({ ...f, sftp_host: e.target.value }))}
                                        placeholder="sftp.partner.com" className="h-10 px-3 rounded-lg border border-fw-border bg-white text-sm font-mono" />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-semibold text-slate-600">Port</label>
                                    <input type="number" value={form.sftp_port} onChange={e => setForm((f: any) => ({ ...f, sftp_port: parseInt(e.target.value) }))}
                                        className="h-10 px-3 rounded-lg border border-fw-border bg-white text-sm font-mono" />
                                </div>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-semibold text-slate-600">Username</label>
                                <input value={form.sftp_user} onChange={e => setForm((f: any) => ({ ...f, sftp_user: e.target.value }))}
                                    className="h-10 px-3 rounded-lg border border-fw-border bg-white text-sm font-mono" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-semibold text-slate-600">Remote Path</label>
                                <input value={form.sftp_path} onChange={e => setForm((f: any) => ({ ...f, sftp_path: e.target.value }))}
                                    placeholder="/inbound/edi" className="h-10 px-3 rounded-lg border border-fw-border bg-white text-sm font-mono" />
                            </div>
                        </>
                    )}

                    {error && <div className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}

                    <button onClick={handleAdd} disabled={saving}
                        className="h-10 rounded-lg bg-accent text-white font-bold text-sm border-none cursor-pointer hover:bg-accent-hover disabled:opacity-60 mt-2">
                        {saving ? "Creating…" : "Create Connection"}
                    </button>
                </div>
            </Slideout>
        </section>
    );
}
