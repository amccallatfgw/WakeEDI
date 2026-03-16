"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type CorporateProfile = {
    name?: string;
    logoUrl?: string | null;
    tagline?: string;
};

export default function LoginForm() {
    const [email, setEmail]       = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading]   = useState(false);
    const [error, setError]       = useState("");
    const [show, setShow]         = useState(false);
    const [corporate, setCorporate] = useState<CorporateProfile | null>(null);

    useEffect(() => {
        fetch("/api/corporate")
            .then(r => r.ok ? r.json() : {})
            .then(d => setCorporate(d?.name ? d : { name: "WakeEDI" }))
            .catch(() => setCorporate({ name: "WakeEDI" }));
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });

        setLoading(false);

        if (res.ok) {
            window.location.href = "/";
        } else {
            const data = await res.json().catch(() => ({}));
            if (res.status === 423) {
                setError("Account locked. Too many failed attempts. Try again in 15 minutes.");
            } else {
                setError(data.error ?? "Invalid email or password.");
            }
        }
    };

    const appName = corporate?.name ?? "WakeEDI";

    return (
        <div className="min-h-screen flex flex-col bg-slate-50 md:grid md:place-items-center">
            <div className="w-full flex-1 flex flex-col md:flex-none md:max-w-[420px] md:px-4">
                <div className="bg-white md:border md:border-fw-border md:rounded-2xl md:shadow-app flex-1 md:flex-none p-8 flex flex-col justify-center">

                    {/* Brand */}
                    <div className="flex flex-col items-center mb-8">
                        {corporate?.logoUrl ? (
                            <img
                                src={corporate.logoUrl}
                                alt={appName}
                                className="block max-w-[200px] h-auto mb-3"
                            />
                        ) : (
                            <h1 className="text-2xl font-bold text-ink tracking-tight mb-1">
                                {appName}
                            </h1>
                        )}
                        <p className="text-sm text-ink-2">
                            {corporate?.tagline ?? "AS2/EDI Trading Platform"}
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-slate-600">Email</label>
                            <input
                                type="email"
                                required
                                autoComplete="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="you@company.com"
                                className="h-10 px-3 rounded-lg border border-fw-border bg-white text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-accent"
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-semibold text-slate-600">Password</label>
                                <Link
                                    href="/forgot-password"
                                    className="text-xs text-accent hover:underline font-medium"
                                >
                                    Forgot password?
                                </Link>
                            </div>
                            <div className="relative">
                                <input
                                    type={show ? "text" : "password"}
                                    required
                                    autoComplete="current-password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="h-10 w-full px-3 pr-16 rounded-lg border border-fw-border bg-white text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-accent"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShow(s => !s)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer select-none"
                                >
                                    {show ? "Hide" : "Show"}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="h-10 rounded-[10px] bg-accent text-white font-bold text-sm border-none cursor-pointer hover:bg-accent-hover disabled:opacity-60 transition-colors"
                        >
                            {loading ? "Signing in…" : "Sign In"}
                        </button>
                    </form>

                    {/* Contact admin */}
                    <div className="mt-4 text-center text-xs text-slate-400">
                        Need an account?{" "}
                        <a href="mailto:admin@waketech.com" className="text-accent hover:underline">
                            Contact your administrator
                        </a>
                    </div>

                    {/* Footer */}
                    <div className="mt-3 text-center text-xs text-slate-400">
                        &copy; {new Date().getFullYear()} {appName} &middot; Wake Tech
                    </div>
                </div>
            </div>
        </div>
    );
}
