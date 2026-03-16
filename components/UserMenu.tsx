"use client";

import { useState } from "react";
import LogoutButton from "./LogoutButton";

type UserMenuProps = {
    name: string;
};

export default function UserMenu({ name }: UserMenuProps) {
    const [open, setOpen] = useState(false);
    const initial = name.charAt(0).toUpperCase();

    return (
        <div
            className="menu-item relative"
            data-label="user-menu"
            aria-expanded={open}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
        >
            <button
                className="appearance-none border-0 bg-transparent cursor-pointer font-[inherit] text-ink px-1.5 py-2.5 rounded-[10px] transition-colors hover:bg-black/5"
                aria-haspopup="true"
                aria-expanded={open}
            >
                <span className="inline-flex items-center gap-2">
                    <span className="h-7 w-7 rounded-full bg-accent text-white inline-flex items-center justify-center font-semibold text-[13px]">
                        {initial}
                    </span>
                    <span>{name}</span>
                </span>
            </button>

            <div
                className={`absolute top-[calc(100%+2px)] right-0 min-w-[220px] max-w-[calc(100vw-16px)] bg-white border border-fw-border rounded-xl shadow-app p-2 z-[1000] ${open ? "block" : "hidden"}`}
                role="menu"
            >
                <a href="/settings/profile" role="menuitem" className="block px-3 py-2.5 rounded-lg text-ink-2 no-underline transition-colors hover:bg-slate-50 hover:text-ink">
                    Profile
                </a>
                <a href="/settings" role="menuitem" className="block px-3 py-2.5 rounded-lg text-ink-2 no-underline transition-colors hover:bg-slate-50 hover:text-ink">
                    Settings
                </a>

                <div className="border-t border-fw-border mt-1 pt-1">
                    <LogoutButton variant="menu" />
                </div>
            </div>
        </div>
    );
}
