-- ============================================================
-- BLOCKING MIGRATIONS — Number Blacklists & Keyword Filters
-- Run against existing sms_platform DB: psql -d sms_platform -f blocking_migrations.sql
-- ============================================================

-- 1. Number prefix blacklist table
-- Prefixes are matched from the START of the destination number.
-- client_id/supplier_id NULL = global rule.
CREATE TABLE IF NOT EXISTS number_blacklists (
    id SERIAL PRIMARY KEY,
    prefix VARCHAR(50) NOT NULL,
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_number_blacklists_prefix ON number_blacklists(prefix);
CREATE INDEX IF NOT EXISTS idx_number_blacklists_client ON number_blacklists(client_id);
CREATE INDEX IF NOT EXISTS idx_number_blacklists_supplier ON number_blacklists(supplier_id);

-- 2. Keyword/content filter table
-- Keywords matched against message body. Supports substring and whole_word matching.
-- client_id/supplier_id NULL = global rule. action='block' rejects the message.
CREATE TABLE IF NOT EXISTS keyword_filters (
    id SERIAL PRIMARY KEY,
    keyword VARCHAR(500) NOT NULL,
    match_mode VARCHAR(20) NOT NULL DEFAULT 'substring' CHECK (match_mode IN ('substring','whole_word')),
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    action VARCHAR(20) NOT NULL DEFAULT 'block' CHECK (action IN ('block')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_keyword_filters_client ON keyword_filters(client_id);
CREATE INDEX IF NOT EXISTS idx_keyword_filters_supplier ON keyword_filters(supplier_id);

-- 3. Add 'blocked' to sms_logs status CHECK constraint
-- PostgreSQL doesn't support ALTER CHECK directly, so we drop and re-add.
DO $$
BEGIN
    ALTER TABLE sms_logs DROP CONSTRAINT IF EXISTS sms_logs_status_check;
    ALTER TABLE sms_logs ADD CONSTRAINT sms_logs_status_check
        CHECK (status IN ('pending','submitted','sent','delivered','failed','expired','rejected','blocked'));
END $$;
