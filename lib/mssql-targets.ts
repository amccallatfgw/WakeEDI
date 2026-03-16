// lib/mssql-targets.ts — Multi-database connection pool manager
// Returns the correct SQL pool based on target_app name.
// WakeEDI can read/write to any Wake Tech database the fw_app user has access to.

import sql, { config as SqlConfig } from "mssql";

// Pool cache keyed by database name
const pools: Record<string, Promise<sql.ConnectionPool>> = {};

function required(name: string, value: string | undefined) {
    if (!value) throw new Error(`${name} environment variable is required.`);
    return value;
}

// Database name mapping — target_app → actual database name
const DB_MAP: Record<string, string> = {
    wakeedi:      process.env.MSSQL_DB ?? "Wake-edi",
    freightwake:  process.env.FREIGHTWAKE_DB ?? "waketech_freightwake",
    wakesignal:   process.env.WAKESIGNAL_DB ?? "waketech_wakesignal",
    wakemail:     process.env.WAKEMAIL_DB ?? "waketech_wakemail",
};

function getConfigForDb(database: string): SqlConfig {
    return {
        user: required("MSSQL_USER", process.env.MSSQL_USER),
        password: required("MSSQL_PASS", process.env.MSSQL_PASS),
        server: required("MSSQL_HOST", process.env.MSSQL_HOST),
        database,
        options: { encrypt: true, trustServerCertificate: false },
        pool: { max: 5, min: 0, idleTimeoutMillis: 30_000 },
    };
}

/**
 * Get a connection pool for a specific target app.
 * Usage: const db = await getTargetPool("freightwake");
 */
export async function getTargetPool(targetApp: string) {
    const dbName = DB_MAP[targetApp.toLowerCase()];
    if (!dbName) {
        throw new Error(`Unknown target app: ${targetApp}. Known targets: ${Object.keys(DB_MAP).join(", ")}`);
    }

    if (!pools[dbName]) {
        pools[dbName] = new sql.ConnectionPool(getConfigForDb(dbName))
            .connect()
            .catch((err) => {
                delete pools[dbName];
                throw err;
            });
    }

    return pools[dbName];
}

/**
 * Introspect a target database — get all tables and their columns.
 * Used by the mapping UI to show available fields.
 */
export async function getTargetSchema(targetApp: string): Promise<{
    tables: { table_name: string; columns: { column_name: string; data_type: string; is_nullable: boolean; max_length: number | null }[] }[];
}> {
    const pool = await getTargetPool(targetApp);

    const result = await pool.request().query(`
        SELECT 
            t.TABLE_NAME AS table_name,
            c.COLUMN_NAME AS column_name,
            c.DATA_TYPE AS data_type,
            CASE WHEN c.IS_NULLABLE = 'YES' THEN 1 ELSE 0 END AS is_nullable,
            c.CHARACTER_MAXIMUM_LENGTH AS max_length
        FROM INFORMATION_SCHEMA.TABLES t
        JOIN INFORMATION_SCHEMA.COLUMNS c ON c.TABLE_NAME = t.TABLE_NAME AND c.TABLE_SCHEMA = t.TABLE_SCHEMA
        WHERE t.TABLE_TYPE = 'BASE TABLE' AND t.TABLE_SCHEMA = 'dbo'
        ORDER BY t.TABLE_NAME, c.ORDINAL_POSITION
    `);

    // Group by table
    const tableMap = new Map<string, any[]>();
    for (const row of result.recordset) {
        if (!tableMap.has(row.table_name)) tableMap.set(row.table_name, []);
        tableMap.get(row.table_name)!.push({
            column_name: row.column_name,
            data_type: row.data_type,
            is_nullable: !!row.is_nullable,
            max_length: row.max_length,
        });
    }

    return {
        tables: Array.from(tableMap.entries()).map(([table_name, columns]) => ({
            table_name,
            columns,
        })),
    };
}

export { sql };
