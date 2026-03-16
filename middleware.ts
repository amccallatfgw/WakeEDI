import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyJWT } from "@/lib/auth-edge";

const PUBLIC_PATHS = [
    "/login",
    "/forgot-password",
    "/reset-password",
    "/api/auth/login",
    "/api/auth/forgot-password",
    "/api/auth/reset-password",
    "/images",
    "/favicon.ico",
];

function isPublic(path: string) {
    return PUBLIC_PATHS.some((p) => path.startsWith(p));
}

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    if (isPublic(pathname)) {
        return NextResponse.next();
    }

    // Internal API key bypass (cron jobs, service-to-service calls)
    const internalKey = req.headers.get("x-internal-api-key");
    if (internalKey && internalKey === process.env.INTERNAL_API_KEY) {
        return NextResponse.next();
    }

    const token = req.cookies.get("auth")?.value;
    if (!token) {
        return NextResponse.redirect(new URL("/login", req.url));
    }

    const payload = await verifyJWT(token);
    if (!payload) {
        return NextResponse.redirect(new URL("/login", req.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico).*)",
    ],
};
