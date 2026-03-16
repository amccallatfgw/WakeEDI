"use client";

import { ReactNode } from "react";

// ── Column definition for DataTable ───────────────────────────────────────────
export type ColDef<T = Record<string, any>> = {
    key: string;
    label: string;
    className?: string;
    render?: (val: any, row: T) => ReactNode;
};

// ── DataTable ─────────────────────────────────────────────────────────────────
type Props<T extends Record<string, any>> = {
    cols: ColDef<T>[];
    rows: T[];
    onRowClick?: (row: T) => void;
    loading?: boolean;
    emptyText?: string;
    rowKey?: (row: T, i: number) => string | number;
};

export function DataTable<T extends Record<string, any>>({
    cols, rows, onRowClick, loading, emptyText = "No records found.", rowKey,
}: Props<T>) {
    return (
        <div className="bg-white border border-fw-border rounded-[14px] shadow-app overflow-hidden">
            <div className="w-full overflow-auto max-h-[calc(100vh-280px)]">
                <table className="w-full border-separate border-spacing-0 text-sm">
                    <thead>
                        <tr>
                            {cols.map((col) => (
                                <th key={col.key} className={`sticky top-0 z-[2] bg-side-bg text-ink-2 font-bold px-3.5 py-3 text-left border-b border-fw-border whitespace-nowrap ${col.className ?? ""}`}>
                                    {col.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={cols.length} className="px-4 py-12 text-center">
                                    <div className="flex items-center justify-center gap-2 text-ink-2">
                                        <div className="spinner" /><span>Loading…</span>
                                    </div>
                                </td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={cols.length} className="px-4 py-12 text-center text-ink-2">{emptyText}</td>
                            </tr>
                        ) : (
                            rows.map((row, i) => (
                                <tr
                                    key={rowKey ? rowKey(row, i) : i}
                                    onClick={() => onRowClick?.(row)}
                                    className={`even:bg-[#fcfdff] border-b border-slate-100 transition-colors ${onRowClick ? "cursor-pointer hover:bg-blue-50/60" : ""}`}
                                >
                                    {cols.map((col) => (
                                        <td key={col.key} className={`px-3.5 py-3 ${col.className ?? ""}`}>
                                            {col.render ? col.render(row[col.key], row) : row[col.key] ?? "—"}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ── Status Badge ──────────────────────────────────────────────────────────────
const BADGE: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700", pending: "bg-amber-50 text-amber-700",
    inactive: "bg-slate-100 text-slate-500", error: "bg-rose-50 text-rose-700",
    success: "bg-green-50 text-green-700", warning: "bg-amber-50 text-amber-700",
    info: "bg-blue-50 text-blue-700",
};
const DOT: Record<string, string> = {
    active: "bg-emerald-500", pending: "bg-amber-500", inactive: "bg-slate-400",
    error: "bg-rose-500", success: "bg-green-500", warning: "bg-amber-500", info: "bg-blue-500",
};

export function StatusBadge({ value }: { value: string }) {
    const key = (value ?? "").toLowerCase().replace(/[\s-]/g, "_");
    const bg = BADGE[key] ?? "bg-slate-100 text-slate-600";
    const dot = DOT[key] ?? "bg-slate-400";
    return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${bg}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
            {value || "—"}
        </span>
    );
}

// ── Page Header ───────────────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, actions }: {
    title: string; subtitle?: string; actions?: ReactNode;
}) {
    return (
        <div className="flex flex-wrap items-start justify-between mb-4 md:mb-6 pb-4 border-b border-fw-border gap-3">
            <div className="min-w-0">
                <h1 className="text-xl md:text-2xl font-bold text-ink mb-1">{title}</h1>
                {subtitle && <p className="text-sm text-ink-2">{subtitle}</p>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2 md:gap-3">{actions}</div>}
        </div>
    );
}

// ── Toolbar ───────────────────────────────────────────────────────────────────
export function Toolbar({ children }: { children: ReactNode }) {
    return <div className="flex flex-wrap items-center gap-2 mb-4">{children}</div>;
}

export function SearchBox({ value, onChange, placeholder }: {
    value: string; onChange: (v: string) => void; placeholder?: string;
}) {
    return (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder ?? "Search…"}
            className="h-9 px-3 rounded-lg border border-fw-border bg-white text-sm min-w-[220px] outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
    );
}

export function FilterSelect({ value, onChange, options }: {
    value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
    return (
        <select value={value} onChange={(e) => onChange(e.target.value)}
            className="h-9 px-2.5 rounded-lg border border-fw-border bg-white text-sm outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent">
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
    );
}

// ── Buttons ───────────────────────────────────────────────────────────────────
export function BtnPrimary({ children, onClick, disabled }: {
    children: ReactNode; onClick?: () => void; disabled?: boolean;
}) {
    return (
        <button onClick={onClick} disabled={disabled}
            className="h-9 px-4 rounded-lg bg-accent text-white text-sm font-semibold border-none cursor-pointer hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed">
            {children}
        </button>
    );
}

export function BtnSecondary({ children, onClick, disabled }: {
    children: ReactNode; onClick?: () => void; disabled?: boolean;
}) {
    return (
        <button onClick={onClick} disabled={disabled}
            className="h-9 px-4 rounded-lg border border-fw-border bg-white text-ink text-sm font-semibold cursor-pointer hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
            {children}
        </button>
    );
}

// ── Pagination ────────────────────────────────────────────────────────────────
export function PaginationBar({ page, pageSize, total, onPageChange, onPageSizeChange, pageSizeOptions = [25, 50, 100] }: {
    page: number; pageSize: number; total: number;
    onPageChange: (p: number) => void; onPageSizeChange?: (s: number) => void; pageSizeOptions?: number[];
}) {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const from = page * pageSize + 1;
    const to = Math.min((page + 1) * pageSize, total);
    return (
        <div className="flex items-center justify-between px-4 py-3 border-t border-fw-border bg-side-bg">
            <div className="flex items-center gap-3 text-sm text-ink-2">
                {onPageSizeChange && (
                    <span className="flex items-center gap-1.5">
                        Show
                        <select value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value))}
                            className="h-7 px-1.5 rounded border border-fw-border bg-white text-sm">
                            {pageSizeOptions.map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                        per page
                    </span>
                )}
                <span>{total > 0 ? `${from}–${to} of ${total.toLocaleString()}` : "0 records"}</span>
            </div>
            <div className="flex gap-2">
                <button onClick={() => onPageChange(page - 1)} disabled={page === 0}
                    className="px-3 py-1.5 rounded-lg border border-fw-border bg-white text-sm font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-default hover:bg-slate-50">Previous</button>
                <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages - 1}
                    className="px-3 py-1.5 rounded-lg border border-fw-border bg-white text-sm font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-default hover:bg-slate-50">Next</button>
            </div>
        </div>
    );
}

// ── Slideout Panel ────────────────────────────────────────────────────────────
export function Slideout({ open, onClose, title, children, width = "w-[520px]" }: {
    open: boolean; onClose: () => void; title: string; children: ReactNode; width?: string;
}) {
    if (!open) return null;
    return (
        <>
            <div className="fixed inset-0 bg-black/20 z-[200]" onClick={onClose} />
            <aside className={`fixed top-0 right-0 h-full bg-white shadow-2xl z-[201] flex flex-col animate-slide-in ${width}`}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-fw-border flex-shrink-0">
                    <h2 className="text-base font-semibold text-ink">{title}</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-ink-2" aria-label="Close">✕</button>
                </div>
                <div className="flex-1 overflow-y-auto p-6">{children}</div>
            </aside>
        </>
    );
}

// ── Detail helpers ────────────────────────────────────────────────────────────
export function DetailGrid({ children }: { children: ReactNode }) {
    return <div className="grid grid-cols-2 gap-x-6 gap-y-4">{children}</div>;
}

export function DetailField({ label, value, full, mono }: {
    label: string; value?: string | number | React.ReactNode | null; full?: boolean; mono?: boolean;
}) {
    return (
        <div className={full ? "col-span-2" : ""}>
            <p className="text-[11px] font-semibold text-ink-2 uppercase tracking-wider mb-0.5">{label}</p>
            <p className={`text-sm text-ink ${mono ? "font-mono" : ""}`}>{value ?? "—"}</p>
        </div>
    );
}

export function SectionHeader({ title }: { title: string }) {
    return (
        <h3 className="text-[11px] font-semibold text-ink-2 uppercase tracking-widest border-b border-fw-border pb-2 mb-4 mt-6 first:mt-0">{title}</h3>
    );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
export function StatCard({ label, value, sub, accent }: {
    label: string; value: string | number; sub?: string; accent?: boolean;
}) {
    return (
        <div className={`rounded-[14px] border p-3 md:p-5 ${accent ? "border-accent/30 bg-accent/5" : "border-fw-border bg-white shadow-app"}`}>
            <p className="text-[11px] font-semibold text-ink-2 uppercase tracking-wider">{label}</p>
            <p className={`text-xl md:text-3xl font-bold mt-1.5 ${accent ? "text-accent" : "text-ink"}`}>{value}</p>
            {sub && <p className="text-xs text-ink-2 mt-1">{sub}</p>}
        </div>
    );
}

// ── Formatters ────────────────────────────────────────────────────────────────
export function fmtDollar(val: any): string {
    const n = Number(val);
    if (!Number.isFinite(n)) return "—";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

export function fmtDate(val: any, includeTime = false): string {
    if (!val) return "—";
    try {
        const d = new Date(val);
        if (includeTime) return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
        return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch { return String(val); }
}
