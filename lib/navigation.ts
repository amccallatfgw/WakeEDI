import { Roles, RoleId } from "./roles";
import type { ComponentType, SVGProps } from "react";
import {
    HomeIcon,
    Cog6ToothIcon,
} from "@heroicons/react/24/outline";

export type NavPlacement = "sidebar" | "topbar" | "both";

export type NavLink = {
    name: string;
    href: string;
    roles?: RoleId[];
    divider?: boolean;
};

export type NavItem = {
    key: string;
    label: string;
    icon: ComponentType<SVGProps<SVGSVGElement>>;
    href: string;
    placement: NavPlacement;
    links: NavLink[];
    roles: RoleId[];
};

export const NAV_ITEMS: NavItem[] = [
    // ── Home ──────────────────────────────────────────────────
    {
        key:       "home",
        label:     "Home",
        icon:      HomeIcon,
        href:      "/",
        placement: "both",
        roles:     [Roles.Admin, Roles.Manager, Roles.User, Roles.ReadOnly],
        links:     [{ name: "Dashboard", href: "/" }],
    },

    // ── Settings ──────────────────────────────────────────────
    {
        key:       "settings",
        label:     "Settings",
        icon:      Cog6ToothIcon,
        href:      "/settings",
        placement: "both",
        roles:     [Roles.Admin, Roles.Manager, Roles.User],
        links: [
            { name: "Profile",  href: "/settings/profile" },
            { name: "Users",    href: "/settings/users", roles: [Roles.Admin] },
        ],
    },
];
