"use client";

import { ReactNode } from "react";

// ── PageHeader ────────────────────────────────────────────────
export function PageHeader({ title, subtitle, actions }: {
    title: string; subtitle?: string; actions?: ReactNode;
}) {
    return (
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4 md:mb-6">
            <div className="min-w-0">
                <h1 className="text-lg md:text-xl font-semibold text-ink">{title}</h1>
                {subtitle && <p className="text-sm text-ink-2 mt-0.5">{subtitle}</p>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
    );
}

// ── StatCard ──────────────────────────────────────────────────
export function StatCard({ label, value, sub, accent }: {
    label: string; value: string | number; sub?: string; accent?: boolean;
}) {
    return (
        <div className={`rounded-xl border p-3 md:p-5 ${accent ? "border-accent bg-accent/5" : "border-fw-border bg-white"}`}>
            <p className="text-xs font-medium text-ink-2 uppercase tracking-wide">{label}</p>
            <p className={`text-xl md:text-2xl font-semibold mt-1 ${accent ? "text-accent" : "text-ink"}`}>{value}</p>
            {sub && <p className="text-xs text-ink-2 mt-0.5">{sub}</p>}
        </div>
    );
}

// ── Badge ─────────────────────────────────────────────────────
const BADGE_STYLES: Record<string, string> = {
    active:   "bg-emerald-50 text-emerald-700 border-emerald-200",
    pending:  "bg-amber-50 text-amber-700 border-amber-200",
    inactive: "bg-slate-50 text-slate-500 border-slate-200",
    error:    "bg-rose-50 text-rose-700 border-rose-200",
    success:  "bg-green-50 text-green-700 border-green-200",
    warning:  "bg-amber-50 text-amber-700 border-amber-200",
    info:     "bg-blue-50 text-blue-700 border-blue-200",
    default:  "bg-slate-50 text-slate-600 border-slate-200",
};

export function Badge({ label, variant }: { label: string; variant?: string }) {
    const key = (variant ?? label ?? "").toLowerCase().replace(/[\s-]/g, "_");
    const cls = BADGE_STYLES[key] ?? BADGE_STYLES.default;
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${cls}`}>{label}</span>
    );
}

// ── Table ─────────────────────────────────────────────────────
export type ColDef = {
    key: string; label: string; className?: string;
    render?: (val: any, row: any) => ReactNode;
};

export function Table({ cols, rows, onRowClick, loading }: {
    cols: ColDef[]; rows: Record<string, any>[]; onRowClick?: (row: Record<string, any>) => void; loading?: boolean;
}) {
    if (loading) {
        return <div className="flex items-center justify-center h-48"><div className="spinner" /></div>;
    }
    return (
        <div className="overflow-x-auto rounded-xl border border-fw-border bg-white">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-fw-border bg-slate-50">
                        {cols.map(c => (
                            <th key={c.key} className={`px-4 py-3 text-left text-xs font-semibold text-ink-2 uppercase tracking-wide whitespace-nowrap ${c.className ?? ""}`}>{c.label}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.length === 0 ? (
                        <tr><td colSpan={cols.length} className="px-4 py-12 text-center text-sm text-ink-2">No records found</td></tr>
                    ) : rows.map((row, i) => (
                        <tr key={i}
                            className={`border-b border-fw-border last:border-0 transition-colors ${onRowClick ? "cursor-pointer hover:bg-slate-50" : ""}`}
                            onClick={() => onRowClick?.(row)}>
                            {cols.map(c => (
                                <td key={c.key} className={`px-4 py-3 text-ink whitespace-nowrap ${c.className ?? ""}`}>
                                    {c.render ? c.render(row[c.key], row) : (row[c.key] ?? "—")}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ── SearchInput ───────────────────────────────────────────────
export function SearchInput({ value, onChange, placeholder }: {
    value: string; onChange: (v: string) => void; placeholder?: string;
}) {
    return (
        <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" value={value} onChange={e => onChange(e.target.value)}
                placeholder={placeholder ?? "Search..."}
                className="pl-9 pr-4 py-2 text-sm border border-fw-border rounded-lg bg-white text-ink placeholder-ink-2/60 outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent w-64" />
        </div>
    );
}

// ── Pagination ────────────────────────────────────────────────
export function Pagination({ page, total, pageSize, onChange }: {
    page: number; total: number; pageSize: number; onChange: (p: number) => void;
}) {
    const pages = Math.ceil(total / pageSize);
    if (pages <= 1) return null;
    return (
        <div className="flex items-center gap-2 text-sm text-ink-2 mt-4">
            <span>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total.toLocaleString()}</span>
            <div className="flex gap-1 ml-auto">
                <button disabled={page <= 1} onClick={() => onChange(page - 1)}
                    className="px-3 py-1.5 rounded-lg border border-fw-border hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">← Prev</button>
                <button disabled={page >= pages} onClick={() => onChange(page + 1)}
                    className="px-3 py-1.5 rounded-lg border border-fw-border hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Next →</button>
            </div>
        </div>
    );
}

// ── SlideoutPanel ─────────────────────────────────────────────
export function SlideoutPanel({ title, open, onClose, children, width }: {
    title: string; open: boolean; onClose: () => void; children: ReactNode; width?: string;
}) {
    if (!open) return null;
    return (
        <>
            <div className="fixed inset-0 bg-black/20 z-[200]" onClick={onClose} />
            <div className={`fixed top-0 right-0 h-full bg-white shadow-2xl z-[201] flex flex-col animate-slide-in ${width ?? "w-[520px]"}`}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-fw-border">
                    <h2 className="text-base font-semibold text-ink">{title}</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                        <svg className="w-4 h-4 text-ink-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6">{children}</div>
            </div>
        </>
    );
}

// ── DetailField ───────────────────────────────────────────────
export function DetailField({ label, value }: { label: string; value?: string | null }) {
    return (
        <div>
            <p className="text-xs font-medium text-ink-2 uppercase tracking-wide mb-0.5">{label}</p>
            <p className="text-sm text-ink">{value || "—"}</p>
        </div>
    );
}

export function DetailSection({ title, children }: { title: string; children: ReactNode }) {
    return (
        <div className="mb-6">
            <h3 className="text-xs font-semibold text-ink-2 uppercase tracking-widest mb-3 border-b border-fw-border pb-2">{title}</h3>
            <div className="grid grid-cols-2 gap-4">{children}</div>
        </div>
    );
}

// ── Select ────────────────────────────────────────────────────
export function Select({ value, onChange, options, className }: {
    value: string; onChange: (v: string) => void;
    options: { value: string; label: string }[]; className?: string;
}) {
    return (
        <select value={value} onChange={e => onChange(e.target.value)}
            className={`text-sm border border-fw-border rounded-lg px-3 py-2 bg-white text-ink outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent ${className ?? ""}`}>
            {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
    );
}

// ── Btn ───────────────────────────────────────────────────────
export function Btn({ children, onClick, variant, disabled, className }: {
    children: ReactNode; onClick?: () => void;
    variant?: "primary" | "secondary" | "ghost"; disabled?: boolean; className?: string;
}) {
    const base = "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
    const variants = {
        primary:   "bg-accent text-white hover:bg-accent-hover",
        secondary: "border border-fw-border bg-white text-ink hover:bg-slate-50",
        ghost:     "text-ink-2 hover:bg-slate-100",
    };
    return (
        <button onClick={onClick} disabled={disabled}
            className={`${base} ${variants[variant ?? "secondary"]} ${className ?? ""}`}>
            {children}
        </button>
    );
}
