"use client";

import { useEffect, useState } from "react";
import { PageHeader, DataTable, StatusBadge, BtnPrimary, Slideout } from "@/components/shared";
import type { ColDef } from "@/components/shared";

type User = {
    user_id: number;
    email: string;
    display_name: string | null;
    role: string;
    is_active: boolean;
    last_login_at: string | null;
    created_at: string;
};

export default function UsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [addOpen, setAddOpen] = useState(false);
    const [form, setForm] = useState({ email: "", display_name: "", role: "user", password: "" });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const load = () => {
        setLoading(true);
        fetch("/api/admin/users")
            .then(r => r.json())
            .then(d => setUsers(d.users ?? []))
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    const handleAdd = async () => {
        if (!form.email) { setError("Email is required"); return; }
        setSaving(true);
        setError("");
        try {
            const res = await fetch("/api/admin/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error ?? "Failed to create user"); return; }
            setAddOpen(false);
            setForm({ email: "", display_name: "", role: "user", password: "" });
            load();
        } catch {
            setError("Something went wrong");
        } finally {
            setSaving(false);
        }
    };

    const cols: ColDef<User>[] = [
        { key: "display_name", label: "Name" },
        { key: "email", label: "Email" },
        { key: "role", label: "Role", render: (v) => <span className="capitalize">{v}</span> },
        { key: "is_active", label: "Status", render: (v) => <StatusBadge value={v ? "Active" : "Inactive"} /> },
        { key: "last_login_at", label: "Last Login", render: (v) => v ? new Date(v).toLocaleDateString() : "Never" },
    ];

    return (
        <section className="p-2">
            <PageHeader
                title="Users"
                subtitle="Manage user accounts"
                actions={<BtnPrimary onClick={() => setAddOpen(true)}>+ Add User</BtnPrimary>}
            />

            <DataTable cols={cols} rows={users} loading={loading} rowKey={(r) => r.user_id} />

            <Slideout open={addOpen} onClose={() => setAddOpen(false)} title="Add User" width="w-[420px]">
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-600">Email *</label>
                        <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                            className="h-10 px-3 rounded-lg border border-fw-border bg-white text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-accent" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-600">Display Name</label>
                        <input type="text" value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
                            className="h-10 px-3 rounded-lg border border-fw-border bg-white text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-accent" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-600">Role</label>
                        <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                            className="h-10 px-3 rounded-lg border border-fw-border bg-white text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-accent">
                            <option value="admin">Admin</option>
                            <option value="manager">Manager</option>
                            <option value="user">User</option>
                            <option value="readonly">Read Only</option>
                        </select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-600">Password</label>
                        <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                            placeholder="Leave blank to set later"
                            className="h-10 px-3 rounded-lg border border-fw-border bg-white text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-accent" />
                    </div>

                    {error && <div className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}

                    <button onClick={handleAdd} disabled={saving}
                        className="h-10 rounded-lg bg-accent text-white font-bold text-sm border-none cursor-pointer hover:bg-accent-hover disabled:opacity-60 mt-2">
                        {saving ? "Creating…" : "Create User"}
                    </button>
                </div>
            </Slideout>
        </section>
    );
}
