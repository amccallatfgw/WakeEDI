"use client";
import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
    const [email, setEmail]     = useState("");
    const [loading, setLoading] = useState(false);
    const [sent, setSent]       = useState(false);
    const [error, setError]     = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
            await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });
            setSent(true);
        } catch {
            setError("Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen grid place-items-center bg-slate-50">
            <div className="w-full max-w-[420px] px-4">
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
                    <div className="flex flex-col items-center mb-8">
                        <h1 className="text-xl font-bold text-ink tracking-tight">WakeEDI</h1>
                    </div>

                    {sent ? (
                        <div className="text-center">
                            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                                <span className="text-2xl">✉️</span>
                            </div>
                            <h2 className="text-lg font-bold text-slate-800 mb-2">Check your email</h2>
                            <p className="text-sm text-slate-500 mb-6">
                                If an account exists for <strong>{email}</strong>, we've sent a password reset link.
                            </p>
                            <Link href="/login" className="text-sm text-accent font-semibold hover:underline">
                                Back to sign in
                            </Link>
                        </div>
                    ) : (
                        <>
                            <h2 className="text-xl font-bold text-slate-800 mb-1">Forgot your password?</h2>
                            <p className="text-sm text-slate-500 mb-6">Enter your email and we'll send you a reset link.</p>

                            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-semibold text-slate-600">Email address</label>
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        placeholder="you@company.com"
                                        className="h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-accent"
                                    />
                                </div>

                                {error && <div className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="h-10 rounded-lg bg-accent text-white font-bold text-sm border-none cursor-pointer hover:bg-accent-hover disabled:opacity-60"
                                >
                                    {loading ? "Sending…" : "Send reset link"}
                                </button>
                            </form>

                            <div className="mt-6 text-center">
                                <Link href="/login" className="text-sm text-slate-500 hover:text-slate-700">
                                    ← Back to sign in
                                </Link>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
