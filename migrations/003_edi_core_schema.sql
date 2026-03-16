-- ============================================================================
-- WakeEDI — Migration 003: EDI Core Schema
-- Database: Wake-edi
--
-- Trading Partners → AS2 Connections → Field Mappings → Transaction Log
-- Designed for X12 transaction sets: 204, 210, 214, 990, 997
-- ============================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. TRADING PARTNERS
-- The company you exchange EDI with. One partner can have multiple
-- connections (AS2, SFTP, etc.) and multiple mapping profiles.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE trading_partners (
    partner_id      INT            IDENTITY(1,1) PRIMARY KEY,
    org_id          INT            NOT NULL DEFAULT 1,
    name            NVARCHAR(200)  NOT NULL,
    isa_id          VARCHAR(15)    NOT NULL,        -- ISA06/ISA08 qualifier+id
    isa_qualifier   VARCHAR(2)     NOT NULL DEFAULT 'ZZ',
    gs_id           VARCHAR(15)    NULL,            -- GS02/GS03 app sender/receiver
    scac_code       VARCHAR(4)     NULL,
    contact_name    NVARCHAR(100)  NULL,
    contact_email   NVARCHAR(200)  NULL,
    contact_phone   VARCHAR(30)    NULL,
    notes           NVARCHAR(MAX)  NULL,
    -- Which Wake Tech app does this partner map to?
    target_app      VARCHAR(50)    NULL,            -- 'freightwake', 'wakefleet', etc.
    target_db       VARCHAR(100)   NULL,            -- 'waketech_freightwake'
    is_active       BIT            NOT NULL DEFAULT 1,
    created_at      DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at      DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE UNIQUE INDEX uq_partner_isa ON trading_partners (isa_qualifier, isa_id);
CREATE INDEX ix_partner_org ON trading_partners (org_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. AS2 / CONNECTION PROFILES
-- How we talk to this partner. AS2 is primary, but supports SFTP, API too.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE connections (
    connection_id   INT            IDENTITY(1,1) PRIMARY KEY,
    partner_id      INT            NOT NULL REFERENCES trading_partners(partner_id),
    protocol        VARCHAR(10)    NOT NULL DEFAULT 'AS2',  -- AS2, SFTP, API, EMAIL
    -- AS2 settings
    as2_id_local    VARCHAR(100)   NULL,            -- Our AS2 identifier
    as2_id_remote   VARCHAR(100)   NULL,            -- Their AS2 identifier
    as2_url         VARCHAR(500)   NULL,            -- Their AS2 endpoint URL
    -- Encryption & signing
    encrypt_algo    VARCHAR(20)    NULL DEFAULT 'AES256',
    sign_algo       VARCHAR(20)    NULL DEFAULT 'SHA256',
    mdn_mode        VARCHAR(10)    NULL DEFAULT 'sync',   -- sync, async, none
    mdn_url         VARCHAR(500)   NULL,            -- async MDN return URL
    -- Certificates (PEM stored in cert_store table)
    local_cert_id   INT            NULL,
    partner_cert_id INT            NULL,
    -- SFTP fallback
    sftp_host       VARCHAR(200)   NULL,
    sftp_port       INT            NULL DEFAULT 22,
    sftp_user       VARCHAR(100)   NULL,
    sftp_path       VARCHAR(500)   NULL,
    -- Status
    is_active       BIT            NOT NULL DEFAULT 1,
    last_test_at    DATETIME2      NULL,
    last_test_ok    BIT            NULL,
    created_at      DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at      DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE INDEX ix_conn_partner ON connections (partner_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. CERTIFICATE STORE
-- X.509 certs for AS2 signing and encryption. PEM format.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE cert_store (
    cert_id         INT            IDENTITY(1,1) PRIMARY KEY,
    partner_id      INT            NULL REFERENCES trading_partners(partner_id),
    label           NVARCHAR(100)  NOT NULL,
    cert_type       VARCHAR(20)    NOT NULL,        -- 'public', 'private', 'ca'
    pem_data        NVARCHAR(MAX)  NOT NULL,
    serial_number   VARCHAR(100)   NULL,
    issuer          NVARCHAR(200)  NULL,
    subject         NVARCHAR(200)  NULL,
    not_before      DATETIME2      NULL,
    not_after       DATETIME2      NULL,
    fingerprint     VARCHAR(64)    NULL,
    is_active       BIT            NOT NULL DEFAULT 1,
    created_at      DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. TRANSACTION SETS — What EDI documents this partner sends/receives
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE partner_transaction_sets (
    pts_id          INT            IDENTITY(1,1) PRIMARY KEY,
    partner_id      INT            NOT NULL REFERENCES trading_partners(partner_id),
    tx_set          VARCHAR(3)     NOT NULL,        -- '204', '210', '214', '990', '997'
    direction       VARCHAR(10)    NOT NULL,        -- 'inbound', 'outbound'
    x12_version     VARCHAR(10)    NOT NULL DEFAULT '004010',
    is_active       BIT            NOT NULL DEFAULT 1,
    -- Processing config
    auto_process    BIT            NOT NULL DEFAULT 1,
    auto_ack        BIT            NOT NULL DEFAULT 1,  -- auto-send 997
    mapping_id      INT            NULL,            -- FK to field_mappings
    created_at      DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE UNIQUE INDEX uq_pts ON partner_transaction_sets (partner_id, tx_set, direction);

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. SARA FIELD MAPPING ENGINE
-- Maps X12 segments/elements to Wake Tech database fields.
-- "SARA" = Segment Aware Routing Architecture
--
-- Example: 204 inbound → FreightWake orders table
--   X12 path: B2/04 → orders.customer_ref
--   X12 path: S5(1)/G62(1)/02 → order_stops.sched_arrive
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE mapping_profiles (
    mapping_id      INT            IDENTITY(1,1) PRIMARY KEY,
    partner_id      INT            NULL REFERENCES trading_partners(partner_id),
    name            NVARCHAR(100)  NOT NULL,
    tx_set          VARCHAR(3)     NOT NULL,
    direction       VARCHAR(10)    NOT NULL,
    target_app      VARCHAR(50)    NOT NULL,        -- 'freightwake'
    description     NVARCHAR(500)  NULL,
    is_template     BIT            NOT NULL DEFAULT 0,  -- reusable template
    is_active       BIT            NOT NULL DEFAULT 1,
    created_at      DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at      DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE mapping_rules (
    rule_id         INT            IDENTITY(1,1) PRIMARY KEY,
    mapping_id      INT            NOT NULL REFERENCES mapping_profiles(mapping_id) ON DELETE CASCADE,
    -- Source: X12 segment path
    x12_path        VARCHAR(100)   NOT NULL,        -- e.g. 'B2/04', 'S5(1)/G62(1)/02'
    x12_segment     VARCHAR(5)     NOT NULL,        -- e.g. 'B2', 'S5', 'G62', 'N1', 'N3'
    x12_element     INT            NOT NULL,        -- element position (1-based)
    x12_sub_element INT            NULL,            -- component within composite
    x12_loop        VARCHAR(20)    NULL,            -- loop context if needed
    -- Target: Wake Tech field
    target_table    VARCHAR(100)   NOT NULL,        -- e.g. 'orders', 'order_stops'
    target_column   VARCHAR(100)   NOT NULL,        -- e.g. 'customer_ref', 'sched_arrive'
    -- Transform
    transform       VARCHAR(50)    NULL,            -- 'none','date','decimal','lookup','concat','trim'
    transform_args  NVARCHAR(500)  NULL,            -- JSON args for transform
    default_value   NVARCHAR(200)  NULL,
    is_required     BIT            NOT NULL DEFAULT 0,
    sort_order      INT            NOT NULL DEFAULT 0,
    notes           NVARCHAR(300)  NULL,
    created_at      DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE INDEX ix_rules_mapping ON mapping_rules (mapping_id, sort_order);

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. TRANSACTION LOG
-- Every EDI interchange that flows through the system.
-- ═══════════════════════════════════════════════════════════════════════════

-- Interchange envelope (ISA/IEA)
CREATE TABLE edi_interchanges (
    interchange_id  BIGINT         IDENTITY(1,1) PRIMARY KEY,
    partner_id      INT            NULL REFERENCES trading_partners(partner_id),
    connection_id   INT            NULL REFERENCES connections(connection_id),
    direction       VARCHAR(10)    NOT NULL,        -- 'inbound', 'outbound'
    isa_control     VARCHAR(9)     NOT NULL,        -- ISA13
    isa_sender_q    VARCHAR(2)     NULL,
    isa_sender_id   VARCHAR(15)    NULL,
    isa_receiver_q  VARCHAR(2)     NULL,
    isa_receiver_id VARCHAR(15)    NULL,
    isa_date        VARCHAR(6)     NULL,            -- YYMMDD
    isa_time        VARCHAR(4)     NULL,            -- HHMM
    status          VARCHAR(20)    NOT NULL DEFAULT 'received',
    raw_data        NVARCHAR(MAX)  NULL,            -- full ISA...IEA envelope
    file_path       VARCHAR(500)   NULL,
    byte_count      INT            NULL,
    error_message   NVARCHAR(MAX)  NULL,
    received_at     DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    processed_at    DATETIME2      NULL,
    created_at      DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE INDEX ix_interchange_partner ON edi_interchanges (partner_id, received_at DESC);
CREATE INDEX ix_interchange_isa ON edi_interchanges (isa_control);

-- Functional group (GS/GE)
CREATE TABLE edi_groups (
    group_id        BIGINT         IDENTITY(1,1) PRIMARY KEY,
    interchange_id  BIGINT         NOT NULL REFERENCES edi_interchanges(interchange_id),
    gs_control      VARCHAR(9)     NOT NULL,        -- GS06
    gs_func_id      VARCHAR(2)     NOT NULL,        -- GS01 (SM, IN, QM, etc.)
    gs_sender       VARCHAR(15)    NULL,
    gs_receiver     VARCHAR(15)    NULL,
    gs_version      VARCHAR(12)    NULL,            -- GS08 (004010, 005010)
    tx_count        INT            NOT NULL DEFAULT 0,
    status          VARCHAR(20)    NOT NULL DEFAULT 'received',
    created_at      DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE INDEX ix_group_interchange ON edi_groups (interchange_id);

-- Transaction set (ST/SE)
CREATE TABLE edi_transactions (
    transaction_id  BIGINT         IDENTITY(1,1) PRIMARY KEY,
    group_id        BIGINT         NOT NULL REFERENCES edi_groups(group_id),
    interchange_id  BIGINT         NOT NULL REFERENCES edi_interchanges(interchange_id),
    partner_id      INT            NULL REFERENCES trading_partners(partner_id),
    st_control      VARCHAR(9)     NOT NULL,        -- ST02
    tx_set          VARCHAR(3)     NOT NULL,        -- ST01 (204, 210, 214, 990, 997)
    direction       VARCHAR(10)    NOT NULL,
    status          VARCHAR(20)    NOT NULL DEFAULT 'received',
    -- Mapped result
    target_entity   VARCHAR(50)    NULL,            -- 'order', 'invoice', 'status_update'
    target_id       INT            NULL,            -- FK to the created/updated record
    mapping_id      INT            NULL,
    -- Content
    segment_count   INT            NULL,
    raw_segments    NVARCHAR(MAX)  NULL,            -- parsed segments as JSON array
    parsed_data     NVARCHAR(MAX)  NULL,            -- mapped key-value JSON
    error_message   NVARCHAR(MAX)  NULL,
    -- Acknowledgment
    ack_status      VARCHAR(20)    NULL,            -- 'accepted', 'rejected', 'partial'
    ack_sent_at     DATETIME2      NULL,
    received_at     DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    processed_at    DATETIME2      NULL,
    created_at      DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE INDEX ix_tx_partner ON edi_transactions (partner_id, received_at DESC);
CREATE INDEX ix_tx_set ON edi_transactions (tx_set, direction);
CREATE INDEX ix_tx_target ON edi_transactions (target_entity, target_id);
CREATE INDEX ix_tx_status ON edi_transactions (status);

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. ACKNOWLEDGMENT TRACKING (997/999)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE edi_acknowledgments (
    ack_id          BIGINT         IDENTITY(1,1) PRIMARY KEY,
    transaction_id  BIGINT         NULL REFERENCES edi_transactions(transaction_id),
    interchange_id  BIGINT         NULL REFERENCES edi_interchanges(interchange_id),
    partner_id      INT            NOT NULL REFERENCES trading_partners(partner_id),
    direction       VARCHAR(10)    NOT NULL,
    ack_type        VARCHAR(3)     NOT NULL DEFAULT '997',
    ack_code        VARCHAR(2)     NOT NULL,        -- A=Accepted, R=Rejected, E=Error, P=Partial
    error_segments  NVARCHAR(MAX)  NULL,            -- AK3/AK4 error detail JSON
    sent_at         DATETIME2      NULL,
    created_at      DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. EVENT / TRIGGER LOG
-- Outbound triggers: when FreightWake data changes, generate EDI
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE edi_triggers (
    trigger_id      INT            IDENTITY(1,1) PRIMARY KEY,
    partner_id      INT            NOT NULL REFERENCES trading_partners(partner_id),
    name            NVARCHAR(100)  NOT NULL,
    description     NVARCHAR(500)  NULL,
    -- What fires this trigger
    source_app      VARCHAR(50)    NOT NULL,        -- 'freightwake'
    source_event    VARCHAR(50)    NOT NULL,        -- 'order.status_change', 'order.created', 'invoice.created'
    source_filter   NVARCHAR(MAX)  NULL,            -- JSON filter conditions
    -- What it generates
    tx_set          VARCHAR(3)     NOT NULL,        -- '214', '210', etc.
    mapping_id      INT            NULL REFERENCES mapping_profiles(mapping_id),
    -- Execution
    is_active       BIT            NOT NULL DEFAULT 1,
    last_fired_at   DATETIME2      NULL,
    fire_count      INT            NOT NULL DEFAULT 0,
    created_at      DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at      DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE edi_trigger_log (
    log_id          BIGINT         IDENTITY(1,1) PRIMARY KEY,
    trigger_id      INT            NOT NULL REFERENCES edi_triggers(trigger_id),
    transaction_id  BIGINT         NULL,
    source_entity   VARCHAR(50)    NULL,
    source_id       INT            NULL,
    status          VARCHAR(20)    NOT NULL DEFAULT 'pending',
    error_message   NVARCHAR(MAX)  NULL,
    created_at      DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE INDEX ix_trigger_log ON edi_trigger_log (trigger_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- 9. AS2 MESSAGE LOG (MDN tracking)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE as2_messages (
    message_id      BIGINT         IDENTITY(1,1) PRIMARY KEY,
    connection_id   INT            NOT NULL REFERENCES connections(connection_id),
    partner_id      INT            NOT NULL REFERENCES trading_partners(partner_id),
    direction       VARCHAR(10)    NOT NULL,
    message_id_hdr  VARCHAR(200)   NOT NULL,        -- AS2 Message-ID header
    as2_from        VARCHAR(100)   NOT NULL,
    as2_to          VARCHAR(100)   NOT NULL,
    content_type    VARCHAR(200)   NULL,
    -- MDN
    mdn_mode        VARCHAR(10)    NULL,
    mdn_status      VARCHAR(20)    NULL,            -- 'success', 'failed', 'pending'
    mdn_message_id  VARCHAR(200)   NULL,
    mic_hash        VARCHAR(200)   NULL,
    -- Status
    http_status     INT            NULL,
    byte_count      INT            NULL,
    error_message   NVARCHAR(MAX)  NULL,
    sent_at         DATETIME2      NULL,
    received_at     DATETIME2      NULL,
    mdn_received_at DATETIME2      NULL,
    created_at      DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE INDEX ix_as2_partner ON as2_messages (partner_id, created_at DESC);
CREATE INDEX ix_as2_msgid ON as2_messages (message_id_hdr);

-- ═══════════════════════════════════════════════════════════════════════════
-- 10. LOOKUP TABLES (code translations for transforms)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE lookup_tables (
    lookup_id       INT            IDENTITY(1,1) PRIMARY KEY,
    table_name      VARCHAR(50)    NOT NULL,        -- e.g. 'equipment_type', 'stop_reason'
    source_code     VARCHAR(50)    NOT NULL,
    target_value    NVARCHAR(200)  NOT NULL,
    description     NVARCHAR(200)  NULL,
    created_at      DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE UNIQUE INDEX uq_lookup ON lookup_tables (table_name, source_code);

-- Seed common X12 equipment type codes → FreightWake values
INSERT INTO lookup_tables (table_name, source_code, target_value, description) VALUES
    ('equipment_type', 'TL', 'Van',         'Truckload Van'),
    ('equipment_type', 'FT', 'Flatbed',     'Flatbed Trailer'),
    ('equipment_type', 'RG', 'Reefer',      'Refrigerated'),
    ('equipment_type', 'TN', 'Tanker',      'Tanker'),
    ('equipment_type', 'CN', 'Container',   'Container'),
    ('equipment_type', 'DD', 'Double Drop', 'Double Drop Deck'),
    ('equipment_type', 'SD', 'Step Deck',   'Step Deck'),
    ('equipment_type', 'LB', 'Lowboy',      'Lowboy');

-- Seed X12 stop reason codes
INSERT INTO lookup_tables (table_name, source_code, target_value, description) VALUES
    ('stop_reason', 'CL', 'pickup',   'Shipper Load & Count'),
    ('stop_reason', 'CU', 'delivery', 'Consignee Unload'),
    ('stop_reason', 'LD', 'pickup',   'Load'),
    ('stop_reason', 'UL', 'delivery', 'Unload');

-- Seed 204 B2/06 payment method codes
INSERT INTO lookup_tables (table_name, source_code, target_value, description) VALUES
    ('payment_method', 'CC', 'collect',  'Collect'),
    ('payment_method', 'PP', 'prepaid',  'Prepaid'),
    ('payment_method', 'TP', 'third_party', 'Third Party');

-- Seed 214 status codes → FreightWake order status
INSERT INTO lookup_tables (table_name, source_code, target_value, description) VALUES
    ('shipment_status', 'AF', 'assigned',    'Carrier Dispatched'),
    ('shipment_status', 'AG', 'in_transit',  'Estimated Delivery'),
    ('shipment_status', 'X3', 'in_transit',  'Arrived at Pickup'),
    ('shipment_status', 'X1', 'in_transit',  'En Route'),
    ('shipment_status', 'X6', 'in_transit',  'Arrived at Delivery'),
    ('shipment_status', 'D1', 'delivered',   'Delivered'),
    ('shipment_status', 'CD', 'cancelled',   'Carrier Declined');
