// lib/mssql-deploy.ts — DDL-capable connection for migrations
import sql, { config as SqlConfig } from "mssql";

let deployPool: Promise<sql.ConnectionPool> | null = null;

function required(name: string, value: string | undefined) {
    if (!value) throw new Error(`${name} is required for deploy connections.`);
    return value;
}

export function getDeployConfig(): SqlConfig {
    return {
        user: required("MSSQL_DEPLOY_USER", process.env.MSSQL_DEPLOY_USER),
        password: required("MSSQL_DEPLOY_PASS", process.env.MSSQL_DEPLOY_PASS),
        server: required("MSSQL_HOST", process.env.MSSQL_HOST),
        database: required("MSSQL_DB", process.env.MSSQL_DB),
        options: { encrypt: true, trustServerCertificate: false },
        pool: { max: 2, min: 0, idleTimeoutMillis: 15_000 },
    };
}

export async function getDeployPool() {
    if (!deployPool) {
        deployPool = new sql.ConnectionPool(getDeployConfig())
            .connect()
            .catch((err) => { deployPool = null; throw err; });
    }
    return deployPool;
}

export async function execDDL(sqlText: string): Promise<{ success: boolean; statements: number; errors: string[] }> {
    const pool = await getDeployPool();
    const errors: string[] = [];
    const batches = sqlText
        .split(/^\s*GO\s*$/im)
        .map(b => b.trim())
        .filter(b => b.length > 0 && !b.startsWith("--"));
    let executed = 0;
    for (const batch of batches) {
        try { await pool.request().query(batch); executed++; }
        catch (e: any) { errors.push(`[Batch ${executed + 1}] ${e.message}`); }
    }
    return { success: errors.length === 0, statements: executed, errors };
}

export { sql };
