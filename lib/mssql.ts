// lib/mssql.ts — Azure SQL connection pool
import sql, { config as SqlConfig } from "mssql";

let pool: Promise<sql.ConnectionPool> | null = null;

function required(name: string, value: string | undefined) {
    if (!value) {
        throw new Error(`${name} environment variable is required for database connections.`);
    }
    return value;
}

export function getConfig(): SqlConfig {
    return {
        user: required("MSSQL_USER", process.env.MSSQL_USER),
        password: required("MSSQL_PASS", process.env.MSSQL_PASS),
        server: required("MSSQL_HOST", process.env.MSSQL_HOST),
        database: required("MSSQL_DB", process.env.MSSQL_DB),
        options: { encrypt: true, trustServerCertificate: false },
        pool: { max: 10, min: 0, idleTimeoutMillis: 30_000 },
    };
}

/**
 * Returns a shared connection pool for the Azure SQL database.
 * Example: const db = await getPool();
 */
export async function getPool() {
    if (!pool) {
        pool = new sql.ConnectionPool(getConfig())
            .connect()
            .catch((err) => {
                pool = null;
                throw err;
            });
    }
    return pool;
}

export { sql };
