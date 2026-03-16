"use client";

import { useEffect, useState } from "react";
import { StatCard, StatusBadge, fmtDate } from "@/components/shared";

type DashData = {
    partners: { total: number; active: number };
    volume: { total_7d: number; inbound_7d: number; outbound_7d: number; errors_7d: number; processed_7d: number };
    today: { total_today: number; errors_today: number };
    byTxSet: { tx_set: string; direction: string; cnt: number }[];
    recent: { transaction_id: number; tx_set: string; direction: string; status: string; received_at: string; partner_name: string }[];
    connections: { total: number; active: number };
};

const TX_LABELS: Record<string, string> = {
    "204": "Load Tender", "210": "Freight Invoice", "214": "Status Update",
    "990": "Response", "997": "Acknowledgment",
};

export default function DashboardClient() {
    const [data, setData] = useState<DashData | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch("/api/dashboard")
            .then(r => r.json())
            .then(d => d.error ? setError(d.error) : setData(d))
            .catch(e => setError(e.message));
    }, []);

    if (error) return <div className="px-4 py-3 rounded-lg bg-red-50 text-red-700 text-sm mt-4">{error}</div>;

    return (
        <div className="flex flex-col gap-6">
            {/* Top stats */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard label="Today" value={data?.today.total_today ?? "—"} sub="Transactions" accent />
                <StatCard label="7-Day Volume" value={data?.volume.total_7d ?? "—"} sub={`${data?.volume.inbound_7d ?? 0} in / ${data?.volume.outbound_7d ?? 0} out`} />
                <StatCard label="Errors (7d)" value={data?.volume.errors_7d ?? "—"} sub={data?.today.errors_today ? `${data.today.errors_today} today` : "0 today"} />
                <StatCard label="Partners" value={data?.partners.active ?? "—"} sub={`${data?.connections.active ?? 0} active connections`} />
            </div>

            {/* TX Set breakdown */}
            {data?.byTxSet && data.byTxSet.length > 0 && (
                <div>
                    <h2 className="text-base font-semibold text-ink mb-3">Transaction Sets (7 days)</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {data.byTxSet.map((s, i) => (
                            <div key={i} className="rounded-xl border border-fw-border bg-white p-3">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-mono font-bold text-sm text-ink">{s.tx_set}</span>
                                    <span className={`text-xs px-1.5 py-0.5 rounded ${s.direction === "inbound" ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"}`}>
                                        {s.direction}
                                    </span>
                                </div>
                                <p className="text-2xl font-bold text-ink">{s.cnt}</p>
                                <p className="text-xs text-ink-2">{TX_LABELS[s.tx_set] ?? s.tx_set}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Recent transactions */}
            <div>
                <h2 className="text-base font-semibold text-ink mb-3">Recent Transactions</h2>
                <div className="bg-white border border-fw-border rounded-[14px] shadow-app overflow-hidden">
                    <table className="w-full border-separate border-spacing-0 text-sm">
                        <thead>
                            <tr>
                                {["TX Set", "Direction", "Partner", "Status", "Received"].map(h => (
                                    <th key={h} className="bg-side-bg text-ink-2 font-bold px-3.5 py-3 text-left border-b border-fw-border whitespace-nowrap">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {!data ? (
                                <tr><td colSpan={5} className="px-4 py-12 text-center"><div className="flex items-center justify-center gap-2 text-ink-2"><div className="spinner" /><span>Loading…</span></div></td></tr>
                            ) : data.recent.length === 0 ? (
                                <tr><td colSpan={5} className="px-4 py-12 text-center text-ink-2">No transactions yet. EDI data will appear here once partners begin sending.</td></tr>
                            ) : (
                                data.recent.map(tx => (
                                    <tr key={tx.transaction_id} className="even:bg-[#fcfdff] border-b border-slate-100">
                                        <td className="px-3.5 py-3 font-mono font-semibold">{tx.tx_set} <span className="text-xs text-ink-2 font-normal">{TX_LABELS[tx.tx_set] ?? ""}</span></td>
                                        <td className="px-3.5 py-3">
                                            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${tx.direction === "inbound" ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"}`}>
                                                {tx.direction}
                                            </span>
                                        </td>
                                        <td className="px-3.5 py-3">{tx.partner_name ?? "Unknown"}</td>
                                        <td className="px-3.5 py-3"><StatusBadge value={tx.status} /></td>
                                        <td className="px-3.5 py-3 text-ink-2">{fmtDate(tx.received_at, true)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
