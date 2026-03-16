import { cookies } from "next/headers";
import { decodeJWT } from "./auth";
import { Roles } from "./roles";

type AuthPayload = {
    userId: number;
    roleId: number;
    role: string;
    email: string;
    name: string;
};

function getTokenFromCookies(): string | null {
    const cookieStore = cookies();
    return cookieStore.get("auth")?.value ?? null;
}

export function getAuthPayload(): AuthPayload | null {
    const token = getTokenFromCookies();
    if (!token) return null;

    try {
        const payload = decodeJWT(token) as any;
        const userId = Number(payload?.userId);
        const roleId = Number(payload?.roleId);
        if (!Number.isFinite(userId) || !Number.isFinite(roleId)) return null;
        return {
            userId,
            roleId,
            role: payload?.role ?? "",
            email: payload?.email ?? "",
            name: payload?.name ?? "",
        };
    } catch {
        return null;
    }
}

export function requireAuth(): AuthPayload {
    const payload = getAuthPayload();
    if (!payload) {
        throw Object.assign(new Error("Unauthorized"), { status: 401 });
    }
    return payload;
}

export function requireAdmin(): AuthPayload {
    const payload = requireAuth();
    if (payload.roleId !== Roles.Admin) {
        throw Object.assign(new Error("Forbidden"), { status: 403 });
    }
    return payload;
}
