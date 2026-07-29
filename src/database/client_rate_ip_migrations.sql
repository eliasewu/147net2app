-- ============================================================
-- CLIENT IP WHITELISTING + RATE PLANS MIGRATION
-- Idempotent — safe to run on live databases
-- ============================================================

-- 1. client_ips table: one-to-many IP whitelist per client
CREATE TABLE IF NOT EXISTS client_ips (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    ip_address VARCHAR(50) NOT NULL,
    label VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(client_id, ip_address)
);

CREATE INDEX IF NOT EXISTS idx_client_ips_client ON client_ips(client_id);

-- 2. rate_plans table: dedicated rate structure per client
CREATE TABLE IF NOT EXISTS rate_plans (
    id SERIAL PRIMARY KEY,
    plan_name VARCHAR(255) NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed default rate plan
INSERT INTO rate_plans (plan_name, description, is_default) 
SELECT 'Default Rate Plan', 'Default pricing for all clients', true
WHERE NOT EXISTS (SELECT 1 FROM rate_plans WHERE is_default = true);

-- 3. Ensure clients table has rate_plan_id (already in schema, but idempotent)
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS rate_plan_id INTEGER REFERENCES rate_plans(id);

-- 4. Update clients CHECK constraint to include 'deleted' status
-- (idempotent: drops and re-adds if needed)
DO $$
BEGIN
    -- The existing constraint may not have 'deleted'
    ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_status_check;
    ALTER TABLE clients ADD CONSTRAINT clients_status_check 
        CHECK (status IN ('active','inactive','suspended','deleted'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5. Add deleted_at column if not present
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 6. Trigger for auto-updating updated_at on clients
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_clients_updated_at ON clients;
CREATE TRIGGER update_clients_updated_at 
    BEFORE UPDATE ON clients 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. Seed sample IPs for existing clients
INSERT INTO client_ips (client_id, ip_address, label)
SELECT id, smpp_ip, 'Primary IP' FROM clients 
WHERE smpp_ip IS NOT NULL AND smpp_ip != '0.0.0.0' AND smpp_ip != ''
  AND NOT EXISTS (SELECT 1 FROM client_ips WHERE client_ips.client_id = clients.id AND client_ips.ip_address = clients.smpp_ip);

-- 8. Add rate_plan_id column to suppliers table
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS rate_plan_id INTEGER REFERENCES rate_plans(id);
