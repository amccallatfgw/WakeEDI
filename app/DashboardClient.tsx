"use client";

import { useEffect, useState } from "react";

type DashData = {
    users: { total: number; active: number };
};

export default function DashboardClient() {
    const [data, setData] = useState<DashData | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch("/api/dashboard")
            .then((r) => r.json())
            .then((d) => {
                if (d.error) setError(d.error);
                else setData(d);
            })
            .catch((e) => setError(e.message));
    }, []);

    if (error) {
        return (
            <div className="px-4 py-3 rounded-lg bg-red-50 text-red-700 text-sm mt-4">
                {error}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-[14px] border border-accent/30 bg-accent/5 p-3 md:p-5">
                    <p className="text-[11px] font-semibold text-ink-2 uppercase tracking-wider">Total Users</p>
                    <p className="text-xl md:text-3xl font-bold mt-1.5 text-accent">{data?.users.total ?? "—"}</p>
                </div>
                <div className="rounded-[14px] border border-fw-border bg-white shadow-app p-3 md:p-5">
                    <p className="text-[11px] font-semibold text-ink-2 uppercase tracking-wider">Active Users</p>
                    <p className="text-xl md:text-3xl font-bold mt-1.5 text-ink">{data?.users.active ?? "—"}</p>
                </div>
            </div>

            <div className="bg-white border border-fw-border rounded-[14px] shadow-app p-8 text-center text-ink-2">
                <p className="text-lg font-semibold mb-2">Welcome to WakeEDI</p>
                <p className="text-sm">Add industry-specific dashboard widgets to replace this placeholder.</p>
            </div>
        </div>
    );
}
