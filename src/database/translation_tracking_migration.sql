-- ============================================================
-- TRANSLATION TRACKING MIGRATION
-- Adds original_* columns to sms_logs for before/after comparison
-- Run: psql -d sms_platform -f src/database/translation_tracking_migration.sql
-- ============================================================

ALTER TABLE sms_logs ADD COLUMN IF NOT EXISTS original_sender_id TEXT;
ALTER TABLE sms_logs ADD COLUMN IF NOT EXISTS original_destination TEXT;
ALTER TABLE sms_logs ADD COLUMN IF NOT EXISTS original_message TEXT;
ALTER TABLE sms_logs ADD COLUMN IF NOT EXISTS applied_translations TEXT;

COMMENT ON COLUMN sms_logs.original_sender_id IS 'Sender ID before translation rules were applied';
COMMENT ON COLUMN sms_logs.original_destination IS 'Destination before translation rules were applied';
COMMENT ON COLUMN sms_logs.original_message IS 'Message body before translation rules were applied';
COMMENT ON COLUMN sms_logs.applied_translations IS 'JSON array of translation rule descriptions applied (e.g. [\"strip 2 digits\", \"add prefix 88\"])';
