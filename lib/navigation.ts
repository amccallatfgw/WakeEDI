import { Roles, RoleId } from "./roles";
import type { ComponentType, SVGProps } from "react";
import {
    HomeIcon,
    Cog6ToothIcon,
    BuildingOffice2Icon,
    ArrowsRightLeftIcon,
    BoltIcon,
    MapIcon,
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
    {
        key:       "home",
        label:     "Home",
        icon:      HomeIcon,
        href:      "/",
        placement: "both",
        roles:     [Roles.Admin, Roles.Manager, Roles.User, Roles.ReadOnly],
        links:     [{ name: "Dashboard", href: "/" }],
    },

    {
        key:       "partners",
        label:     "Partners",
        icon:      BuildingOffice2Icon,
        href:      "/partners",
        placement: "both",
        roles:     [Roles.Admin, Roles.Manager, Roles.User],
        links: [
            { name: "Trading Partners", href: "/partners" },
            { name: "Connections",      href: "/connections" },
        ],
    },

    {
        key:       "mappings",
        label:     "Mappings",
        icon:      MapIcon,
        href:      "/mappings",
        placement: "both",
        roles:     [Roles.Admin, Roles.Manager],
        links: [
            { name: "Field Mappings",   href: "/mappings" },
            { name: "Lookup Tables",    href: "/mappings/lookups" },
        ],
    },

    {
        key:       "transactions",
        label:     "Transactions",
        icon:      ArrowsRightLeftIcon,
        href:      "/transactions",
        placement: "both",
        roles:     [Roles.Admin, Roles.Manager, Roles.User, Roles.ReadOnly],
        links: [
            { name: "Live Monitor",     href: "/transactions" },
            { name: "Interchanges",     href: "/transactions/interchanges" },
        ],
    },

    {
        key:       "triggers",
        label:     "Triggers",
        icon:      BoltIcon,
        href:      "/triggers",
        placement: "topbar",
        roles:     [Roles.Admin, Roles.Manager],
        links: [
            { name: "Outbound Triggers", href: "/triggers" },
            { name: "Trigger Log",       href: "/triggers/log" },
        ],
    },

    {
        key:       "settings",
        label:     "Settings",
        icon:      Cog6ToothIcon,
        href:      "/settings",
        placement: "both",
        roles:     [Roles.Admin, Roles.Manager, Roles.User],
        links: [
            { name: "Profile",      href: "/settings/profile" },
            { name: "Users",        href: "/settings/users", roles: [Roles.Admin] },
            { name: "Certificates", href: "/settings/certificates", roles: [Roles.Admin], divider: true },
        ],
    },
];
