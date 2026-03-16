"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shared";

export default function ProfilePage() {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/user/me")
            .then(r => r.json())
            .then(d => setUser(d))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return <div className="flex items-center justify-center h-48"><div className="spinner" /></div>;
    }

    return (
        <section className="p-2">
            <PageHeader title="Profile" subtitle="Your account details" />

            <div className="bg-white border border-fw-border rounded-[14px] shadow-app p-6 max-w-lg">
                <div className="flex items-center gap-4 mb-6">
                    <div className="h-14 w-14 rounded-full bg-accent text-white flex items-center justify-center text-xl font-bold">
                        {(user?.display_name ?? user?.email ?? "U").charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <p className="text-lg font-semibold text-ink">{user?.display_name ?? "—"}</p>
                        <p className="text-sm text-ink-2">{user?.email}</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-[11px] font-semibold text-ink-2 uppercase tracking-wider mb-0.5">Role</p>
                        <p className="text-sm text-ink capitalize">{user?.role ?? "—"}</p>
                    </div>
                    <div>
                        <p className="text-[11px] font-semibold text-ink-2 uppercase tracking-wider mb-0.5">Status</p>
                        <p className="text-sm text-ink">{user?.is_active ? "Active" : "Inactive"}</p>
                    </div>
                    <div>
                        <p className="text-[11px] font-semibold text-ink-2 uppercase tracking-wider mb-0.5">Last Login</p>
                        <p className="text-sm text-ink">{user?.last_login_at ? new Date(user.last_login_at).toLocaleString() : "Never"}</p>
                    </div>
                    <div>
                        <p className="text-[11px] font-semibold text-ink-2 uppercase tracking-wider mb-0.5">Member Since</p>
                        <p className="text-sm text-ink">{user?.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}</p>
                    </div>
                </div>
            </div>
        </section>
    );
}
