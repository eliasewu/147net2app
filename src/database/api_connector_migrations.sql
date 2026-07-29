-- ============================================================
-- api_connector_migrations.sql
-- Add Send SMS template, response pattern, DLR query, and
-- DLR response pattern columns to api_connectors
-- ============================================================

ALTER TABLE api_connectors
  ADD COLUMN IF NOT EXISTS send_body_template TEXT,
  ADD COLUMN IF NOT EXISTS send_response_pattern VARCHAR(255),
  ADD COLUMN IF NOT EXISTS dlr_query_url TEXT,
  ADD COLUMN IF NOT EXISTS dlr_query_params TEXT,
  ADD COLUMN IF NOT EXISTS dlr_response_pattern VARCHAR(255);
