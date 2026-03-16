-- ============================================================================
-- WakeEDI — Base Schema
-- Database: Wake-edi
-- Server:   sql-waketech-prod.database.windows.net
--
-- Run this in Azure Portal → Query Editor
-- ============================================================================

-- ── Roles lookup ─────────────────────────────────────────────────────────────
CREATE TABLE roles (
    role_id     INT           PRIMARY KEY,
    role_name   NVARCHAR(50)  NOT NULL UNIQUE,
    description NVARCHAR(200) NULL,
    created_at  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);

INSERT INTO roles (role_id, role_name, description) VALUES
    (1, 'admin',      'Full system access'),
    (2, 'manager',    'Department-level access'),
    (3, 'user',       'Standard user access'),
    (4, 'readonly',   'View-only access');

-- ── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE users (
    user_id        INT            IDENTITY(1,1) PRIMARY KEY,
    org_id         INT            NOT NULL DEFAULT 1,
    email          NVARCHAR(200)  NOT NULL,
    display_name   NVARCHAR(100)  NULL,
    password_hash  NVARCHAR(500)  NULL,
    role           NVARCHAR(50)   NOT NULL DEFAULT 'user',
    is_active      BIT            NOT NULL DEFAULT 1,
    failed_logins  INT            NOT NULL DEFAULT 0,
    locked_until   DATETIME2      NULL,
    last_login_at  DATETIME2      NULL,
    created_at     DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at     DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT uq_users_email UNIQUE (org_id, email)
);

CREATE INDEX ix_users_org ON users (org_id);
CREATE INDEX ix_users_email ON users (email);

-- ── Password reset tokens ────────────────────────────────────────────────────
CREATE TABLE password_reset_tokens (
    token_id    INT          IDENTITY(1,1) PRIMARY KEY,
    user_id     INT          NOT NULL REFERENCES users(user_id),
    token       VARCHAR(64)  NOT NULL UNIQUE,
    expires_at  DATETIME2    NOT NULL,
    used_at     DATETIME2    NULL,
    created_at  DATETIME2    NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE INDEX ix_prt_token ON password_reset_tokens (token);
CREATE INDEX ix_prt_user  ON password_reset_tokens (user_id);

-- ── App settings (key-value, stores corporate profile, feature flags, etc.) ──
CREATE TABLE app_settings (
    setting_id    INT            IDENTITY(1,1) PRIMARY KEY,
    setting_key   NVARCHAR(100)  NOT NULL UNIQUE,
    setting_value NVARCHAR(MAX)  NULL,
    created_at    DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at    DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
);

-- ── Audit log ────────────────────────────────────────────────────────────────
CREATE TABLE audit_log (
    log_id      BIGINT         IDENTITY(1,1) PRIMARY KEY,
    org_id      INT            NOT NULL DEFAULT 1,
    user_id     INT            NULL,
    action      NVARCHAR(100)  NOT NULL,
    entity_type NVARCHAR(100)  NULL,
    entity_id   INT            NULL,
    details     NVARCHAR(MAX)  NULL,
    ip_address  NVARCHAR(45)   NULL,
    created_at  DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE INDEX ix_audit_user   ON audit_log (user_id);
CREATE INDEX ix_audit_entity ON audit_log (entity_type, entity_id);
CREATE INDEX ix_audit_date   ON audit_log (created_at);

-- ── Notifications (in-app) ───────────────────────────────────────────────────
CREATE TABLE notifications (
    notification_id INT            IDENTITY(1,1) PRIMARY KEY,
    org_id          INT            NOT NULL DEFAULT 1,
    user_id         INT            NOT NULL REFERENCES users(user_id),
    title           NVARCHAR(200)  NOT NULL,
    body            NVARCHAR(MAX)  NULL,
    type            NVARCHAR(50)   NOT NULL DEFAULT 'info',
    is_read         BIT            NOT NULL DEFAULT 0,
    link            NVARCHAR(500)  NULL,
    created_at      DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE INDEX ix_notif_user ON notifications (user_id, is_read);
