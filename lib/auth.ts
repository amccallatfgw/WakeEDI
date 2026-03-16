import jwt from "jsonwebtoken";
import argon2 from "argon2";

// Sign JWT
export function signJWT(payload: any) {
    return jwt.sign(payload, process.env.JWT_SECRET!, {
        expiresIn: "24h",
    });
}

// Hash password (Argon2id — canonical config, do not change)
export async function hashPassword(plain: string) {
    return argon2.hash(plain, {
        type: argon2.argon2id,
        memoryCost: 16384,
        timeCost: 3,
        parallelism: 2,
    });
}

// Verify password
export async function verifyPassword(hashed: string, plain: string) {
    return argon2.verify(hashed, plain);
}

// Decode JWT safely (Node only)
export function decodeJWT(token: string) {
    try {
        return jwt.verify(token, process.env.JWT_SECRET!);
    } catch {
        return null;
    }
}
