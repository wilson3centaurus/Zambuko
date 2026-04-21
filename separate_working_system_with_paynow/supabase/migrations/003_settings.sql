-- Settings key-value store for admin-configurable options
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT          NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Row-level security: service role only
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_settings" ON settings USING (true) WITH CHECK (true);

-- Seed defaults
INSERT INTO settings (key, value) VALUES
  ('voucher_secret', '')
ON CONFLICT (key) DO NOTHING;
