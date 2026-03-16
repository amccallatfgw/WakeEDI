"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import MobileNav from "@/components/MobileNav";
import Clock from "@/components/Clock";
import UserMenu from "./UserMenu";
import { NAV_ITEMS } from "@/lib/navigation";
import type { RoleId } from "@/lib/roles";

type TopbarProps = {
    roleId: number | null;
    userEmail: string | null;
};

type CorporateProfile = {
    name?: string;
    logoUrl?: string | null;
    logoScale?: number | null;
    logoPosX?: number | null;
    logoPosY?: number | null;
    tagline?: string;
};

export default function Topbar({ roleId, userEmail }: TopbarProps) {
    const [open, setOpen] = useState<string | null>(null);
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const closeTimer = useRef<number | null>(null);
    const [corporate, setCorporate] = useState<CorporateProfile | null>(null);

    useEffect(() => {
        try {
            const cached = localStorage.getItem("wt_corporate");
            if (cached) setCorporate(JSON.parse(cached));
        } catch {}

        fetch("/api/corporate")
            .then(r => r.ok ? r.json() : {})
            .then((d: any) => {
                const profile: CorporateProfile = d?.name ? d : {};
                setCorporate(profile);
                localStorage.setItem("wt_corporate", JSON.stringify(profile));
            })
            .catch(() => { setCorporate({}); });
    }, []);

    const closeMenu = () => setOpen(null);
    const openMenu = (label: string) => setOpen(label);
    const toggleMenu = (label: string) =>
        setOpen((prev) => (prev === label ? null : label));

    const clearCloseTimer = () => {
        if (closeTimer.current) {
            clearTimeout(closeTimer.current);
            closeTimer.current = null;
        }
    };

    const scheduleClose = () => {
        clearCloseTimer();
        closeTimer.current = window.setTimeout(() => {
            setOpen((curr) => {
                const hovered = document.querySelector(".menu-item:hover");
                if (hovered && hovered.getAttribute("data-label") === curr) return curr;
                return null;
            });
        }, 180);
    };

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeMenu(); };
        const onDocClick = (e: MouseEvent) => {
            const t = e.target as HTMLElement;
            if (!t.closest(".menu-item")) closeMenu();
        };
        document.addEventListener("keydown", onKey);
        document.addEventListener("click", onDocClick);
        return () => {
            document.removeEventListener("keydown", onKey);
            document.removeEventListener("click", onDocClick);
        };
    }, []);

    if (roleId === null) return null;

    const displayName =
        userEmail?.split("@")[0]?.replace(/^\w/, (c) => c.toUpperCase()) ?? "User";

    const visibleItems = NAV_ITEMS
        .filter((item) => item.placement === "topbar" || item.placement === "both")
        .filter((item) => item.roles.includes(roleId as RoleId))
        .map((item) => ({
            ...item,
            links: item.links.filter((l) => !l.roles || l.roles.includes(roleId as RoleId)),
        }));

    function BrandLogo({ compact }: { compact?: boolean }) {
        if (corporate === null) {
            return <div style={{ width: compact ? "auto" : "220px", height: compact ? "36px" : "56px" }} />;
        }
        if (corporate.name && corporate.logoUrl) {
            return compact ? (
                <div style={{ height: "36px", overflow: "hidden", position: "relative" }}>
                    <img src={corporate.logoUrl} alt={corporate.name} style={{ height: "100%", width: "auto", objectFit: "contain" }} />
                </div>
            ) : (
                <div style={{ width: "220px", height: "56px", overflow: "hidden", position: "relative", flexShrink: 0 }}>
                    <img
                        src={corporate.logoUrl}
                        alt={corporate.name}
                        style={{
                            position: "absolute", width: "100%", height: "100%",
                            objectFit: "contain",
                            transform: `scale(${(corporate.logoScale ?? 100) / 100}) translate(${(corporate.logoPosX ?? 50) - 50}%, ${(corporate.logoPosY ?? 50) - 50}%)`,
                            transformOrigin: "center center",
                        }}
                    />
                </div>
            );
        }
        return (
            <span className={`font-bold text-slate-800 tracking-tight ${compact ? "text-base truncate block" : "text-xl max-[900px]:text-base"}`}>
                {corporate.name || "WakeEDI"}
            </span>
        );
    }

    return (
        <>
        {/* Desktop header */}
        <header className="sticky top-0 z-50 hidden md:flex items-center gap-7 px-6 bg-white border-b border-fw-border" style={{ height: "80px" }} role="banner">
            <div>
                <Link href="/" aria-label="Go to home">
                    <BrandLogo />
                </Link>
            </div>

            <nav className="flex gap-7" role="navigation" aria-label="Primary">
                {visibleItems.map(({ label, links }) => {
                    const isOpen = open === label;
                    return (
                        <div
                            key={label}
                            className="menu-item relative"
                            data-label={label}
                            aria-expanded={isOpen}
                            onMouseEnter={() => { clearCloseTimer(); openMenu(label); }}
                            onMouseLeave={scheduleClose}
                        >
                            <button
                                className="appearance-none border-0 bg-transparent cursor-pointer font-[inherit] text-ink px-1.5 py-2.5 rounded-[10px] transition-colors hover:bg-black/5"
                                aria-haspopup="true"
                                aria-expanded={isOpen}
                                onClick={() => toggleMenu(label)}
                            >
                                {label}
                            </button>
                            <div
                                className={`absolute top-[calc(100%+2px)] left-0 min-w-[220px] max-w-[calc(100vw-16px)] bg-white border border-fw-border rounded-xl shadow-app p-2 z-[1000] ${isOpen ? "block" : "hidden"}`}
                                role="menu"
                                onMouseEnter={clearCloseTimer}
                                onMouseLeave={scheduleClose}
                            >
                                {links.map((l, i) => (
                                    <div key={`${label}-${i}`}>
                                        {l.divider && <div className="my-1 border-t border-slate-100" />}
                                        <Link href={l.href} role="menuitem" tabIndex={isOpen ? 0 : -1}
                                            className="block px-3 py-2.5 rounded-lg text-ink-2 no-underline transition-colors hover:bg-slate-50 hover:text-ink">
                                            {l.name}
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </nav>

            <div className="flex-1" />

            <div className="flex items-center gap-3">
                <Clock />
                <UserMenu name={displayName} />
            </div>
        </header>

        {/* Mobile header */}
        <header className="sticky top-0 z-50 flex md:hidden items-center gap-3 px-3 bg-white border-b border-fw-border" style={{ height: "56px" }} role="banner">
            <button
                onClick={() => setMobileNavOpen(true)}
                className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors flex-shrink-0"
                aria-label="Open menu"
            >
                <svg className="w-5 h-5 text-slate-700" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
            </button>

            <Link href="/" aria-label="Go to home" className="flex-1 min-w-0">
                <BrandLogo compact />
            </Link>
        </header>

        <MobileNav
            open={mobileNavOpen}
            onClose={() => setMobileNavOpen(false)}
            roleId={roleId}
            displayName={displayName}
        />
        </>
    );
}
