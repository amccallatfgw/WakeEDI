// lib/migrator.ts — Migration runner
import { getDeployPool, execDDL, sql } from "./mssql-deploy";
import fs from "fs";
import path from "path";

const MIGRATIONS_DIR = path.join(process.cwd(), "migrations");

export type MigrationResult = {
    filename: string; success: boolean; duration_ms: number; error?: string; skipped?: boolean;
};

async function ensureTrackingTable() {
    const pool = await getDeployPool();
    await pool.request().query(`
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = '_migrations')
        CREATE TABLE _migrations (
            migration_id INT IDENTITY(1,1) PRIMARY KEY,
            filename NVARCHAR(200) NOT NULL UNIQUE,
            executed_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
            success BIT NOT NULL DEFAULT 1,
            error_message NVARCHAR(MAX) NULL,
            duration_ms INT NOT NULL DEFAULT 0
        );
    `);
}

async function getExecuted(): Promise<Set<string>> {
    const pool = await getDeployPool();
    const res = await pool.request().query("SELECT filename FROM _migrations WHERE success = 1");
    return new Set(res.recordset.map((r: any) => r.filename));
}

function getMigrationFiles(): string[] {
    if (!fs.existsSync(MIGRATIONS_DIR)) return [];
    return fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith(".sql")).sort();
}

export async function runMigrations(): Promise<MigrationResult[]> {
    await ensureTrackingTable();
    const executed = await getExecuted();
    const files = getMigrationFiles();
    const results: MigrationResult[] = [];
    const pool = await getDeployPool();

    for (const filename of files) {
        if (executed.has(filename)) { results.push({ filename, success: true, duration_ms: 0, skipped: true }); continue; }
        const sqlText = fs.readFileSync(path.join(MIGRATIONS_DIR, filename), "utf-8");
        const start = Date.now();
        try {
            const result = await execDDL(sqlText);
            const duration = Date.now() - start;
            if (result.success) {
                await pool.request().input("f", sql.NVarChar(200), filename).input("d", sql.Int, duration)
                    .query("INSERT INTO _migrations (filename, success, duration_ms) VALUES (@f, 1, @d)");
                results.push({ filename, success: true, duration_ms: duration });
            } else {
                const errorMsg = result.errors.join("\n");
                await pool.request().input("f", sql.NVarChar(200), filename).input("d", sql.Int, duration).input("e", sql.NVarChar(sql.MAX), errorMsg)
                    .query("INSERT INTO _migrations (filename, success, error_message, duration_ms) VALUES (@f, 0, @e, @d)");
                results.push({ filename, success: false, duration_ms: duration, error: errorMsg });
                break;
            }
        } catch (e: any) { results.push({ filename, success: false, duration_ms: Date.now() - start, error: e.message }); break; }
    }
    return results;
}

export async function getMigrationStatus() {
    await ensureTrackingTable();
    const pool = await getDeployPool();
    const res = await pool.request().query("SELECT * FROM _migrations ORDER BY migration_id");
    const executedSet = new Set(res.recordset.filter((r: any) => r.success).map((r: any) => r.filename));
    const files = getMigrationFiles();
    return { executed: res.recordset, pending: files.filter(f => !executedSet.has(f)), files };
}
