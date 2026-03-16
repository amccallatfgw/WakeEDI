"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/navigation";
import type { RoleId } from "@/lib/roles";

type MobileNavProps = {
    open: boolean;
    onClose: () => void;
    roleId: number | null;
    displayName: string;
};

export default function MobileNav({ open, onClose, roleId, displayName }: MobileNavProps) {
    const pathname = usePathname();
    const [expandedKey, setExpandedKey] = useState<string | null>(null);

    useEffect(() => { onClose(); }, [pathname]);

    useEffect(() => {
        if (open) { document.body.style.overflow = "hidden"; }
        else { document.body.style.overflow = ""; }
        return () => { document.body.style.overflow = ""; };
    }, [open]);

    if (roleId === null) return null;

    const allItems = NAV_ITEMS
        .filter((item) => item.roles.includes(roleId as RoleId))
        .map((item) => ({
            ...item,
            links: item.links.filter((l) => !l.roles || l.roles.includes(roleId as RoleId)),
        }));

    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 z-[200] bg-black/40 transition-opacity duration-200 md:hidden ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Drawer */}
            <nav
                className={`fixed top-0 left-0 bottom-0 z-[201] w-[280px] max-w-[85vw] bg-white shadow-2xl flex flex-col transition-transform duration-250 ease-out md:hidden ${open ? "translate-x-0" : "-translate-x-full"}`}
                aria-label="Mobile navigation"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-4 border-b border-fw-border">
                    <div className="flex items-center gap-2.5">
                        <span className="h-8 w-8 rounded-full bg-accent text-white inline-flex items-center justify-center font-semibold text-sm">
                            {displayName.charAt(0).toUpperCase()}
                        </span>
                        <span className="font-semibold text-ink text-sm">{displayName}</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
                        aria-label="Close menu"
                    >
                        <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Nav items */}
                <div className="flex-1 overflow-y-auto py-2">
                    {allItems.map((item) => {
                        const Icon = item.icon;
                        const isExpanded = expandedKey === item.key;
                        const hasMultipleLinks = item.links.length > 1;
                        const isActive = item.links.some((l) => pathname === l.href || pathname.startsWith(l.href + "/"));

                        if (!hasMultipleLinks && item.links.length === 1) {
                            return (
                                <Link
                                    key={item.key}
                                    href={item.links[0].href}
                                    className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors no-underline ${isActive ? "bg-blue-50 text-blue-700 font-semibold" : "text-ink-2 hover:bg-slate-50 hover:text-ink"}`}
                                >
                                    <Icon className="w-5 h-5 flex-shrink-0" />
                                    {item.label}
                                </Link>
                            );
                        }

                        return (
                            <div key={item.key}>
                                <button
                                    onClick={() => setExpandedKey(isExpanded ? null : item.key)}
                                    className={`flex items-center gap-3 px-4 py-2.5 text-sm w-full text-left transition-colors ${isActive ? "text-blue-700 font-semibold" : "text-ink-2 hover:bg-slate-50 hover:text-ink"}`}
                                >
                                    <Icon className="w-5 h-5 flex-shrink-0" />
                                    <span className="flex-1">{item.label}</span>
                                    <svg
                                        className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                                        fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                    </svg>
                                </button>

                                {isExpanded && (
                                    <div className="ml-8 mr-2 mb-1 border-l-2 border-slate-200">
                                        {item.links.map((l, i) => {
                                            const linkActive = pathname === l.href || pathname.startsWith(l.href + "/");
                                            return (
                                                <Link
                                                    key={`${item.key}-${i}`}
                                                    href={l.href}
                                                    className={`block pl-4 py-2 text-sm no-underline transition-colors rounded-r-lg ${linkActive ? "text-blue-700 font-medium bg-blue-50" : "text-ink-2 hover:bg-slate-50 hover:text-ink"}`}
                                                >
                                                    {l.name}
                                                </Link>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="border-t border-fw-border px-4 py-3">
                    <a
                        href="/api/auth/logout"
                        className="flex items-center gap-2 text-sm text-red-600 no-underline hover:text-red-700"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                        </svg>
                        Sign out
                    </a>
                </div>
            </nav>
        </>
    );
}
