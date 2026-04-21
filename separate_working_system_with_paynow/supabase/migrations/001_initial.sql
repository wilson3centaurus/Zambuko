-- ============================================================
-- Connect WiFi – Initial Database Schema
-- Run in your Supabase SQL editor or via psql
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Admins ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admins (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL DEFAULT '',
  role          TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'superadmin')),
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);

-- ── WiFi Packages ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS packages (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name           TEXT NOT NULL,
  price          NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  duration_hours INTEGER NOT NULL CHECK (duration_hours > 0),
  speed_limit    TEXT NOT NULL DEFAULT '5M/5M',   -- e.g. "5M/5M" (up/down)
  max_devices    INTEGER NOT NULL DEFAULT 1,
  data_limit_mb  INTEGER,                          -- NULL = unlimited
  active         BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default packages
INSERT INTO packages (name, price, duration_hours, speed_limit, sort_order) VALUES
  ('1 Hour',  0.50,   1,    '5M/5M',   1),
  ('1 Day',   2.00,   24,   '10M/10M', 2),
  ('3 Days',  5.00,   72,   '10M/10M', 3),
  ('1 Month', 10.00,  720,  '20M/20M', 4)
ON CONFLICT DO NOTHING;

-- ── Vouchers ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vouchers (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code              TEXT UNIQUE NOT NULL,
  package_id        UUID NOT NULL REFERENCES packages(id) ON DELETE RESTRICT,
  status            TEXT NOT NULL DEFAULT 'unused'
                      CHECK (status IN ('unused', 'active', 'expired', 'disabled')),
  batch_id          TEXT,                          -- for bulk-generated vouchers
  transaction_id    UUID,                          -- linked payment (FK added below)
  user_mac          TEXT,
  user_ip           TEXT,
  device_name       TEXT,
  mikrotik_user_id  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_at           TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_vouchers_code      ON vouchers(code);
CREATE INDEX IF NOT EXISTS idx_vouchers_status    ON vouchers(status);
CREATE INDEX IF NOT EXISTS idx_vouchers_batch_id  ON vouchers(batch_id);

-- ── Transactions ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference         TEXT UNIQUE NOT NULL,          -- our internal ref
  paynow_reference  TEXT,                          -- Paynow's reference
  phone             TEXT NOT NULL,
  amount            NUMERIC(10,2) NOT NULL,
  package_id        UUID REFERENCES packages(id) ON DELETE SET NULL,
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'paid', 'failed', 'cancelled')),
  voucher_id        UUID REFERENCES vouchers(id) ON DELETE SET NULL,
  poll_url          TEXT,                          -- Paynow poll URL
  raw_callback      JSONB,                         -- raw callback payload (audit)
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_reference ON transactions(reference);
CREATE INDEX IF NOT EXISTS idx_transactions_status    ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_phone     ON transactions(phone);

-- Back-fill FK on vouchers.transaction_id
ALTER TABLE vouchers
  ADD CONSTRAINT fk_vouchers_transaction
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

-- ── Sessions ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  voucher_id            UUID NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
  mac_address           TEXT,
  ip_address            TEXT,
  device_name           TEXT,
  start_time            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time              TIMESTAMPTZ,
  bytes_in              BIGINT NOT NULL DEFAULT 0,
  bytes_out             BIGINT NOT NULL DEFAULT 0,
  active                BOOLEAN NOT NULL DEFAULT TRUE,
  mikrotik_session_id   TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_voucher_id  ON sessions(voucher_id);
CREATE INDEX IF NOT EXISTS idx_sessions_active      ON sessions(active) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_sessions_mac         ON sessions(mac_address);

-- ── Logs ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS logs (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type       TEXT NOT NULL,   -- 'login', 'payment', 'voucher', 'error', 'mikrotik'
  level      TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warn', 'error')),
  message    TEXT NOT NULL,
  metadata   JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_type       ON logs(type);
CREATE INDEX IF NOT EXISTS idx_logs_level      ON logs(level);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at DESC);

-- ── Automatic updated_at trigger ─────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ── Row-Level Security ───────────────────────────────────────
-- Admins table is only accessible via service role key
ALTER TABLE admins        ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE vouchers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs          ENABLE ROW LEVEL SECURITY;

-- Packages are readable by anyone (shown on portal)
CREATE POLICY "packages_public_read" ON packages
  FOR SELECT USING (active = TRUE);

-- Service role bypasses RLS (used by our API with service role key)
-- All other access is via service role key only
