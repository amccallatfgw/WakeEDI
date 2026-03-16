"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

function ResetPasswordForm() {
    const params   = useSearchParams();
    const router   = useRouter();
    const token    = params.get("token") ?? "";

    const [password, setPassword]     = useState("");
    const [confirm, setConfirm]       = useState("");
    const [loading, setLoading]       = useState(false);
    const [validating, setValidating] = useState(true);
    const [valid, setValid]           = useState(false);
    const [name, setName]             = useState("");
    const [error, setError]           = useState("");
    const [done, setDone]             = useState(false);
    const [show, setShow]             = useState(false);

    useEffect(() => {
        if (!token) { setValidating(false); return; }
        fetch(`/api/auth/reset-password?token=${token}`)
            .then(r => r.json())
            .then(d => { setValid(d.valid); setName(d.name ?? ""); })
            .finally(() => setValidating(false));
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirm) { setError("Passwords do not match."); return; }
        if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, password }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error ?? "Something went wrong."); return; }
            setDone(true);
            setTimeout(() => router.push("/login"), 3000);
        } catch {
            setError("Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    if (validating) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!valid) {
        return (
            <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">⚠️</span>
                </div>
                <h2 className="text-lg font-bold text-slate-800 mb-2">Link expired or invalid</h2>
                <p className="text-sm text-slate-500 mb-6">This password reset link is no longer valid.</p>
                <Link href="/forgot-password" className="text-sm text-accent font-semibold hover:underline">Request new link</Link>
            </div>
        );
    }

    if (done) {
        return (
            <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">✓</span>
                </div>
                <h2 className="text-lg font-bold text-slate-800 mb-2">Password updated</h2>
                <p className="text-sm text-slate-500">Redirecting you to sign in…</p>
            </div>
        );
    }

    return (
        <>
            <h2 className="text-xl font-bold text-slate-800 mb-1">Set new password</h2>
            <p className="text-sm text-slate-500 mb-6">Hi {name}, choose a strong password for your account.</p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-600">New password</label>
                    <div className="relative">
                        <input
                            type={show ? "text" : "password"}
                            required
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="Min. 8 characters"
                            className="h-10 w-full px-3 pr-10 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-accent"
                        />
                        <button type="button" onClick={() => setShow(s => !s)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs border-none bg-transparent cursor-pointer">
                            {show ? "Hide" : "Show"}
                        </button>
                    </div>
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-600">Confirm password</label>
                    <input
                        type={show ? "text" : "password"}
                        required
                        value={confirm}
                        onChange={e => setConfirm(e.target.value)}
                        placeholder="Repeat password"
                        className="h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-accent"
                    />
                </div>

                {/* Password strength indicator */}
                {password.length > 0 && (
                    <div className="flex gap-1">
                        {[1,2,3,4].map(i => {
                            const strength = [password.length >= 8, /[A-Z]/.test(password), /[0-9]/.test(password), /[^a-zA-Z0-9]/.test(password)].filter(Boolean).length;
                            return <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= strength ? strength <= 1 ? "bg-red-400" : strength <= 2 ? "bg-amber-400" : strength <= 3 ? "bg-blue-400" : "bg-emerald-500" : "bg-slate-200"}`} />;
                        })}
                    </div>
                )}

                {error && <div className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}

                <button
                    type="submit"
                    disabled={loading}
                    className="h-10 rounded-lg bg-accent text-white font-bold text-sm border-none cursor-pointer hover:bg-accent-hover disabled:opacity-60"
                >
                    {loading ? "Updating…" : "Update password"}
                </button>
            </form>
        </>
    );
}

export default function ResetPasswordPage() {
    return (
        <div className="min-h-screen grid place-items-center bg-slate-50">
            <div className="w-full max-w-[420px] px-4">
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
                    <div className="flex flex-col items-center mb-8">
                        <h1 className="text-xl font-bold text-ink tracking-tight">WakeEDI</h1>
                    </div>
                    <Suspense fallback={<div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>}>
                        <ResetPasswordForm />
                    </Suspense>
                </div>
            </div>
        </div>
    );
}
