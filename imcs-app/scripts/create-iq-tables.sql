-- IQ System Tables
-- Run in Supabase SQL Editor

-- 1. Snapshot metadata - tracks when snapshots were taken
CREATE TABLE IF NOT EXISTS iq_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  taken_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_holders INTEGER,
  total_iq_distributed INTEGER,
  notes TEXT
);

-- 2. Per-wallet snapshot history - what each wallet earned per snapshot
CREATE TABLE IF NOT EXISTS wallet_iq_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL REFERENCES iq_snapshots(id),
  wallet TEXT NOT NULL,
  leaderboard_iq INTEGER NOT NULL DEFAULT 0,
  trading_iq INTEGER NOT NULL DEFAULT 0,
  listed_count INTEGER NOT NULL DEFAULT 0,
  total_iq_points INTEGER NOT NULL DEFAULT 0,
  tokens_held INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(snapshot_id, wallet)
);

-- 3. Wallet IQ balances - current available points to allocate
CREATE TABLE IF NOT EXISTS wallet_iq_balances (
  wallet TEXT PRIMARY KEY,
  total_earned INTEGER NOT NULL DEFAULT 0,
  total_allocated INTEGER NOT NULL DEFAULT 0,
  available INTEGER GENERATED ALWAYS AS (total_earned - total_allocated) STORED,
  last_snapshot_id UUID REFERENCES iq_snapshots(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Per-savant allocated IQ - permanent, lives on the token
CREATE TABLE IF NOT EXISTS savant_iq (
  token_id INTEGER PRIMARY KEY,
  iq_points INTEGER NOT NULL DEFAULT 69,
  allocated_by TEXT NOT NULL,
  allocated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wallet_iq_snapshots_wallet ON wallet_iq_snapshots(wallet);
CREATE INDEX IF NOT EXISTS idx_wallet_iq_snapshots_snapshot ON wallet_iq_snapshots(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_savant_iq_allocated_by ON savant_iq(allocated_by);

-- RLS disabled - server-side only access via service role key
ALTER TABLE iq_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_iq_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_iq_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE savant_iq ENABLE ROW LEVEL SECURITY;
