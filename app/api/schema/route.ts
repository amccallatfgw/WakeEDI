export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authorize";
import { getTargetSchema } from "@/lib/mssql-targets";

/**
 * GET /api/schema?target=freightwake
 * Returns all tables and columns from the target database.
 * Used by the mapping UI to populate table/column dropdowns.
 */
export async function GET(req: NextRequest) {
    try {
        requireAuth();
        const target = req.nextUrl.searchParams.get("target") ?? "freightwake";

        const schema = await getTargetSchema(target);

        return NextResponse.json(schema);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
    }
}
