-- ============================================================================
-- WakeEDI — Seed Data
-- Run AFTER schema.sql
--
-- Default admin password: changeme123
-- (Argon2id hash — change immediately after first login)
-- ============================================================================

-- The hash below corresponds to 'changeme123' with Argon2id
-- If this hash doesn't work, use the app's password reset flow or run:
--   node -e "require('argon2').hash('changeme123',{type:2,memoryCost:16384,timeCost:3,parallelism:2}).then(console.log)"
-- and replace the hash below.

INSERT INTO users (org_id, email, display_name, password_hash, role, is_active)
VALUES (
    1,
    'admin@waketech.com',
    'System Admin',
    -- This is a placeholder. Generate a real hash on first setup:
    -- Run: node -e "require('argon2').hash('changeme123',{type:2,memoryCost:16384,timeCost:3,parallelism:2}).then(console.log)"
    NULL,
    'admin',
    1
);

-- Set default corporate profile (empty — no branding)
INSERT INTO app_settings (setting_key, setting_value)
VALUES ('corporate_profile', '{"name":"WakeEDI"}');
