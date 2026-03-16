// lib/as2-crypto.ts — AS2 Cryptographic Operations
// Handles S/MIME signing, encryption, verification, and MDN generation.
// Uses Node.js built-in crypto module with PEM certs from cert_store table.

import crypto from "crypto";
import { getPool, sql } from "./mssql";

export type AS2CryptoConfig = {
    localCertPem: string;       // Our public cert (PEM)
    localKeyPem: string;        // Our private key (PEM)
    partnerCertPem: string;     // Partner's public cert (PEM)
    signAlgo: string;           // SHA256, SHA1
    encryptAlgo: string;        // AES256, AES128, 3DES
};

/**
 * Load crypto config for a connection from the cert_store table.
 */
export async function loadCryptoConfig(connectionId: number): Promise<AS2CryptoConfig | null> {
    const db = await getPool();
    const connRes = await db.request()
        .input("cid", sql.Int, connectionId)
        .query(`
            SELECT c.*, conn.sign_algo, conn.encrypt_algo,
                   lc.pem_data AS local_cert_pem,
                   lk.pem_data AS local_key_pem,
                   pc.pem_data AS partner_cert_pem
            FROM connections conn
            LEFT JOIN cert_store lc ON lc.cert_id = conn.local_cert_id AND lc.cert_type = 'public'
            LEFT JOIN cert_store lk ON lk.partner_id IS NULL AND lk.cert_type = 'private' AND lk.is_active = 1
            LEFT JOIN cert_store pc ON pc.cert_id = conn.partner_cert_id AND pc.cert_type = 'public'
            WHERE conn.connection_id = @cid
        `);

    const row = connRes.recordset[0];
    if (!row) return null;

    // If no certs configured, fall back to finding active certs
    let localCert = row.local_cert_pem;
    let localKey = row.local_key_pem;
    let partnerCert = row.partner_cert_pem;

    if (!localKey) {
        const keyRes = await db.request().query(
            "SELECT TOP 1 pem_data FROM cert_store WHERE cert_type = 'private' AND partner_id IS NULL AND is_active = 1"
        );
        localKey = keyRes.recordset[0]?.pem_data;
    }

    if (!localCert) {
        const certRes = await db.request().query(
            "SELECT TOP 1 pem_data FROM cert_store WHERE cert_type = 'public' AND partner_id IS NULL AND is_active = 1"
        );
        localCert = certRes.recordset[0]?.pem_data;
    }

    return {
        localCertPem: localCert || "",
        localKeyPem: localKey || "",
        partnerCertPem: partnerCert || "",
        signAlgo: row.sign_algo || "SHA256",
        encryptAlgo: row.encrypt_algo || "AES256",
    };
}

/**
 * Sign a payload using our private key.
 * Returns the signature as base64.
 */
export function signPayload(payload: string | Buffer, privateKeyPem: string, algorithm = "SHA256"): string {
    const algoMap: Record<string, string> = {
        "SHA256": "sha256", "SHA1": "sha1", "SHA384": "sha384", "SHA512": "sha512",
    };
    const signer = crypto.createSign(algoMap[algorithm] || "sha256");
    signer.update(typeof payload === "string" ? Buffer.from(payload) : payload);
    return signer.sign(privateKeyPem, "base64");
}

/**
 * Verify a signature against a payload using partner's public cert.
 */
export function verifySignature(payload: string | Buffer, signature: string, certPem: string, algorithm = "SHA256"): boolean {
    const algoMap: Record<string, string> = {
        "SHA256": "sha256", "SHA1": "sha1", "SHA384": "sha384", "SHA512": "sha512",
    };
    try {
        const verifier = crypto.createVerify(algoMap[algorithm] || "sha256");
        verifier.update(typeof payload === "string" ? Buffer.from(payload) : payload);
        return verifier.verify(certPem, signature, "base64");
    } catch {
        return false;
    }
}

/**
 * Compute MIC (Message Integrity Check) hash for MDN.
 */
export function computeMIC(payload: string | Buffer, algorithm = "SHA256"): string {
    const algoMap: Record<string, string> = {
        "SHA256": "sha256", "SHA1": "sha1", "SHA384": "sha384",
    };
    const hash = crypto.createHash(algoMap[algorithm] || "sha256");
    hash.update(typeof payload === "string" ? Buffer.from(payload) : payload);
    return hash.digest("base64");
}

/**
 * Encrypt payload using partner's public certificate.
 * Uses AES-256-CBC with the key encrypted by RSA.
 */
export function encryptPayload(payload: string | Buffer, certPem: string, algorithm = "AES256"): {
    encryptedData: Buffer;
    encryptedKey: Buffer;
    iv: Buffer;
} {
    const algoMap: Record<string, string> = {
        "AES256": "aes-256-cbc", "AES128": "aes-128-cbc", "3DES": "des-ede3-cbc",
    };
    const keyLengths: Record<string, number> = {
        "AES256": 32, "AES128": 16, "3DES": 24,
    };

    const cipher = algoMap[algorithm] || "aes-256-cbc";
    const keyLen = keyLengths[algorithm] || 32;

    // Generate random symmetric key and IV
    const symmetricKey = crypto.randomBytes(keyLen);
    const iv = crypto.randomBytes(16);

    // Encrypt payload with symmetric key
    const enc = crypto.createCipheriv(cipher, symmetricKey, iv);
    const encData = Buffer.concat([enc.update(typeof payload === "string" ? Buffer.from(payload) : payload), enc.final()]);

    // Encrypt symmetric key with partner's public cert
    const encKey = crypto.publicEncrypt(certPem, symmetricKey);

    return { encryptedData: encData, encryptedKey: encKey, iv };
}

/**
 * Decrypt payload using our private key.
 */
export function decryptPayload(
    encryptedData: Buffer, encryptedKey: Buffer, iv: Buffer,
    privateKeyPem: string, algorithm = "AES256"
): Buffer {
    const algoMap: Record<string, string> = {
        "AES256": "aes-256-cbc", "AES128": "aes-128-cbc", "3DES": "des-ede3-cbc",
    };
    const cipher = algoMap[algorithm] || "aes-256-cbc";

    // Decrypt symmetric key with our private key
    const symmetricKey = crypto.privateDecrypt(privateKeyPem, encryptedKey);

    // Decrypt payload with symmetric key
    const dec = crypto.createDecipheriv(cipher, symmetricKey, iv);
    return Buffer.concat([dec.update(encryptedData), dec.final()]);
}

/**
 * Build a synchronous MDN (Message Disposition Notification) response body.
 */
export function buildMDN(opts: {
    originalMessageId: string;
    as2From: string;
    as2To: string;
    status: "processed" | "failed";
    micHash?: string;
    micAlgo?: string;
    errorMessage?: string;
}): { body: string; contentType: string } {
    const boundary = `----=_Part_MDN_${Date.now()}`;
    const disposition = opts.status === "processed"
        ? "automatic-action/MDN-sent-automatically; processed"
        : `automatic-action/MDN-sent-automatically; failed/Failure: ${opts.errorMessage || "processing-error"}`;

    const humanReadable = opts.status === "processed"
        ? `The AS2 message has been received and processed successfully.\r\nOriginal Message ID: ${opts.originalMessageId}`
        : `The AS2 message could not be processed.\r\nOriginal Message ID: ${opts.originalMessageId}\r\nError: ${opts.errorMessage || "Unknown error"}`;

    const machineReadable = [
        `Reporting-UA: WakeEDI`,
        `Original-Recipient: rfc822; ${opts.as2To}`,
        `Final-Recipient: rfc822; ${opts.as2To}`,
        `Original-Message-ID: ${opts.originalMessageId}`,
        `Disposition: ${disposition}`,
        opts.micHash ? `Received-Content-MIC: ${opts.micHash}, ${opts.micAlgo || "sha256"}` : null,
    ].filter(Boolean).join("\r\n");

    const body = [
        `--${boundary}`,
        `Content-Type: text/plain\r\n`,
        humanReadable,
        `\r\n--${boundary}`,
        `Content-Type: message/disposition-notification\r\n`,
        machineReadable,
        `\r\n--${boundary}--`,
    ].join("\r\n");

    return {
        body,
        contentType: `multipart/report; report-type=disposition-notification; boundary="${boundary}"`,
    };
}

/**
 * Generate a unique AS2 Message-ID.
 */
export function generateMessageId(domain = "edi.waketech.ai"): string {
    const uuid = crypto.randomUUID();
    return `<${uuid}@${domain}>`;
}

/**
 * Parse certificate PEM to extract metadata.
 */
export function parseCertInfo(pem: string): {
    subject: string; issuer: string; serialNumber: string;
    notBefore: Date; notAfter: Date; fingerprint: string;
} | null {
    try {
        const cert = new crypto.X509Certificate(pem);
        return {
            subject: cert.subject,
            issuer: cert.issuer,
            serialNumber: cert.serialNumber,
            notBefore: new Date(cert.validFrom),
            notAfter: new Date(cert.validTo),
            fingerprint: cert.fingerprint256.replace(/:/g, "").toLowerCase(),
        };
    } catch {
        return null;
    }
}
