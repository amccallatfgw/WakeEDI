"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { NAV_ITEMS } from "@/lib/navigation";
import type { RoleId } from "@/lib/roles";
import { BookmarkIcon, ChevronLeftIcon, ChevronRightIcon, MapPinIcon } from "@heroicons/react/24/outline";

const PINNED_STORAGE_KEY = "wt:pinned";
const EDGE_REVEAL_DISTANCE = 4;
const AUTO_HIDE_DELAY = 250;
const DROPDOWN_CLOSE_DELAY = 180;

type SidebarProps = {
    roleId: number | null;
};

export default function Sidebar({ roleId }: SidebarProps) {
    const [mounted, setMounted] = useState(false);
    const [pinned, setPinned] = useState(false);
    const [hidden, setHidden] = useState(false);
    const [openKey, setOpenKey] = useState<string | null>(null);
    const closeTimer = useRef<number | null>(null);
    const sidebarRef = useRef<HTMLElement | null>(null);

    const clearCloseTimer = () => {
        if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    };
    const scheduleClose = () => {
        clearCloseTimer();
        closeTimer.current = window.setTimeout(() => setOpenKey(null), DROPDOWN_CLOSE_DELAY);
    };
    const openMenu = (key: string) => { clearCloseTimer(); setOpenKey(key); };

    useEffect(() => {
        const stored = window.localStorage.getItem(PINNED_STORAGE_KEY);
        setPinned(stored === "true");
        setHidden(false);
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return;
        window.localStorage.setItem(PINNED_STORAGE_KEY, String(pinned));
        if (pinned) setHidden(false);
    }, [mounted, pinned]);

    useEffect(() => {
        if (pinned) return;
        const onMove = (event: MouseEvent) => {
            if (event.clientX <= EDGE_REVEAL_DISTANCE) setHidden(false);
        };
        document.addEventListener("mousemove", onMove);
        return () => document.removeEventListener("mousemove", onMove);
    }, [pinned]);

    useEffect(() => {
        if (pinned) return;
        const sidebar = sidebarRef.current;
        if (!sidebar) return;
        let hideTimer: number | undefined;
        const onLeave = () => { hideTimer = window.setTimeout(() => setHidden(true), AUTO_HIDE_DELAY); };
        const onEnter = () => { if (hideTimer) { clearTimeout(hideTimer); hideTimer = undefined; } };
        sidebar.addEventListener("mouseleave", onLeave);
        sidebar.addEventListener("mouseenter", onEnter);
        return () => {
            sidebar.removeEventListener("mouseleave", onLeave);
            sidebar.removeEventListener("mouseenter", onEnter);
            if (hideTimer) clearTimeout(hideTimer);
        };
    }, [pinned, mounted]);

    const sidebarItems = useMemo(() => {
        return NAV_ITEMS
            .filter((item) => item.placement === "sidebar" || item.placement === "both")
            .filter((item) => roleId !== null && item.roles.includes(roleId as RoleId))
            .map((item) => ({
                ...item,
                links: item.links.filter((l) => !l.roles || (roleId !== null && l.roles.includes(roleId as RoleId))),
            }));
    }, [roleId]);

    return (
        <>
            {!pinned && (
                <div
                    className="fixed left-0 top-[72px] w-[10px] h-[calc(100%-72px)] z-[100]"
                    aria-hidden="true"
                    onMouseEnter={() => setHidden(false)}
                />
            )}

            <aside
                ref={sidebarRef}
                className={`w-[72px] bg-side-bg border-r border-fw-border py-3 px-2 flex flex-col gap-2 relative z-[60] transition-transform duration-[250ms] ease-in-out ${hidden ? "-translate-x-full" : ""}`}
                data-pinned={pinned}
                aria-label="Secondary"
            >
                <div className="flex justify-between items-center p-1.5">
                    <button
                        className="border-0 bg-transparent cursor-pointer p-1.5 rounded-[10px] transition-colors hover:bg-black/5 disabled:opacity-45 disabled:cursor-not-allowed"
                        title={hidden ? "Show sidebar" : "Hide sidebar"}
                        onClick={() => { if (!pinned) setHidden(v => !v); }}
                        disabled={pinned}
                    >
                        {hidden ? <ChevronRightIcon className="w-4 h-4" /> : <ChevronLeftIcon className="w-4 h-4" />}
                    </button>
                    <button
                        className="border-0 bg-transparent cursor-pointer p-1.5 rounded-[10px] transition-colors hover:bg-black/5"
                        title={pinned ? "Unpin sidebar" : "Pin sidebar"}
                        onClick={() => setPinned(v => !v)}
                    >
                        {pinned ? <MapPinIcon className="w-4 h-4" /> : <BookmarkIcon className="w-4 h-4" />}
                    </button>
                </div>

                <div className="flex flex-col gap-1.5 mt-1">
                    {sidebarItems.map((item) => {
                        const Icon = item.icon;
                        const isOpen = openKey === item.key;
                        return (
                            <div
                                key={item.key}
                                className="relative flex justify-center"
                                onMouseEnter={() => openMenu(item.key)}
                                onMouseLeave={scheduleClose}
                            >
                                <Link
                                    className="flex items-center justify-center h-[46px] rounded-xl text-ink-2 no-underline transition-colors hover:bg-slate-100 hover:text-ink"
                                    href={item.href}
                                    aria-haspopup="true"
                                    aria-expanded={isOpen}
                                >
                                    <Icon className="w-5 h-5" />
                                </Link>

                                <div
                                    className={`absolute left-14 top-1/2 -translate-y-1/2 min-w-[190px] bg-white border border-fw-border rounded-xl shadow-app p-2 z-[9999] ${isOpen && !hidden ? "block" : "hidden"}`}
                                    role="menu"
                                    onMouseEnter={clearCloseTimer}
                                    onMouseLeave={scheduleClose}
                                >
                                    {item.links.map((l, i) => (
                                        <div key={`${item.key}-${i}`}>
                                            {l.divider && <div className="my-1 border-t border-slate-100" />}
                                            <Link
                                                href={l.href}
                                                role="menuitem"
                                                className="block px-3 py-2.5 rounded-lg no-underline text-ink-2 text-sm leading-tight whitespace-nowrap transition-colors hover:bg-slate-50 hover:text-ink"
                                            >
                                                {l.name}
                                            </Link>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </aside>
        </>
    );
}
