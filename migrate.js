#!/usr/bin/env node
const sql = require("mssql");
const fs = require("fs");
const path = require("path");

try {
    const envPath = path.join(__dirname, ".env.local");
    if (fs.existsSync(envPath)) {
        for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
            const t = line.trim(); if (!t || t.startsWith("#")) continue;
            const eq = t.indexOf("="); if (eq === -1) continue;
            const k = t.slice(0, eq).trim(), v = t.slice(eq + 1).trim();
            if (!process.env[k]) process.env[k] = v;
        }
    }
} catch {}

const MIGRATIONS_DIR = path.join(__dirname, "migrations");
const config = { user: process.env.MSSQL_DEPLOY_USER, password: process.env.MSSQL_DEPLOY_PASS, server: process.env.MSSQL_HOST, database: process.env.MSSQL_DB, options: { encrypt: true, trustServerCertificate: false } };

async function main() {
    const cmd = process.argv[2] || "status";
    if (!config.user || !config.password) { console.error("ERROR: MSSQL_DEPLOY_USER/PASS not set"); process.exit(1); }
    console.log(`Connecting to ${config.server}/${config.database} as ${config.user}...`);
    const pool = await sql.connect(config);

    await pool.request().query(`IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = '_migrations') CREATE TABLE _migrations (migration_id INT IDENTITY(1,1) PRIMARY KEY, filename NVARCHAR(200) NOT NULL UNIQUE, executed_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(), success BIT NOT NULL DEFAULT 1, error_message NVARCHAR(MAX) NULL, duration_ms INT NOT NULL DEFAULT 0);`);

    const executedRes = await pool.request().query("SELECT filename FROM _migrations WHERE success = 1");
    const executedSet = new Set(executedRes.recordset.map(r => r.filename));
    const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith(".sql")).sort();
    const pending = files.filter(f => !executedSet.has(f));

    if (cmd === "status") {
        console.log(`\n${files.length} total, ${executedSet.size} executed, ${pending.length} pending\n`);
        for (const f of files) console.log(`  ${executedSet.has(f) ? "✅" : "⬜"} ${f}`);
        if (pending.length) console.log(`\nRun: node migrate.js run`);
        else console.log("\nAll up to date.");
    } else if (cmd === "run") {
        if (!pending.length) { console.log("\nNo pending migrations."); return; }
        console.log(`\nRunning ${pending.length} migration(s)...\n`);
        for (const filename of pending) {
            const text = fs.readFileSync(path.join(MIGRATIONS_DIR, filename), "utf-8");
            const batches = text.split(/^\s*GO\s*$/im).map(b => b.trim()).filter(b => b.length > 0);
            const start = Date.now(); const errors = [];
            for (let i = 0; i < batches.length; i++) { try { await pool.request().query(batches[i]); } catch (e) { errors.push(`[${i+1}] ${e.message}`); } }
            const dur = Date.now() - start;
            if (!errors.length) {
                await pool.request().input("f", sql.NVarChar(200), filename).input("d", sql.Int, dur).query("INSERT INTO _migrations (filename, success, duration_ms) VALUES (@f, 1, @d)");
                console.log(`  ✅ ${filename} (${dur}ms)`);
            } else {
                const msg = errors.join("\n");
                await pool.request().input("f", sql.NVarChar(200), filename).input("d", sql.Int, dur).input("e", sql.NVarChar(sql.MAX), msg).query("INSERT INTO _migrations (filename, success, error_message, duration_ms) VALUES (@f, 0, @e, @d)");
                console.log(`  ❌ ${filename} (${dur}ms)\n     ${msg}`); break;
            }
        }
        console.log("\nDone.");
    }
    await pool.close();
}
main().catch(e => { console.error(e); process.exit(1); });
