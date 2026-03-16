export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authorize";
import { runMigrations, getMigrationStatus } from "@/lib/migrator";

export async function GET() {
    try { requireAdmin(); return NextResponse.json(await getMigrationStatus()); }
    catch (e: any) { return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}

export async function POST() {
    try {
        requireAdmin();
        const results = await runMigrations();
        const allOk = results.every(r => r.success || r.skipped);
        return NextResponse.json({ success: allOk, results });
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
