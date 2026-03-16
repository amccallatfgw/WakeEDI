"use client";

import { useEffect, useState } from "react";

type NowState = { date: string; time: string; zone: string };

function formatNow(): NowState {
    const now = new Date();
    const parts = new Intl.DateTimeFormat(undefined, {
        year: "numeric", month: "short", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        hour12: true, timeZoneName: "short",
    }).formatToParts(now);

    const zone = parts.find(p => p.type === "timeZoneName")?.value ?? "";
    const date = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "2-digit", weekday: "short" }).format(now);
    const time = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }).format(now);

    return { date, time, zone };
}

export default function Clock() {
    const [mounted, setMounted] = useState(false);
    const [{ date, time, zone }, setNow] = useState<NowState>(formatNow());

    useEffect(() => {
        setMounted(true);
        const id = setInterval(() => setNow(formatNow()), 1000);
        return () => clearInterval(id);
    }, []);

    if (!mounted) return null;

    return (
        <div className="inline-flex gap-1.5 text-ink-2 font-semibold tabular-nums" aria-live="polite">
            <span>{date}</span>
            <span className="opacity-60">|</span>
            <span>{time}</span>
            <span>({zone})</span>
        </div>
    );
}
