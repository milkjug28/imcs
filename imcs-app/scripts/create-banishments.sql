-- Banishments table for the "banisht lewserz" feature
-- Users submit X handles (and optionally wallets) to publicly banish.
-- Consensus is measured by how many independent people submit the same handle.
-- Run this in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS banishments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  target_x_handle TEXT NOT NULL,
  target_wallet_address TEXT,
  reason TEXT NOT NULL,
  submitter_wallet TEXT NOT NULL,
  ip_address TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT banish_reason_min CHECK (char_length(reason) >= 5),
  CONSTRAINT banish_reason_max CHECK (char_length(reason) <= 500),
  UNIQUE(submitter_wallet, target_x_handle)
);

CREATE INDEX IF NOT EXISTS idx_banishments_target ON banishments(target_x_handle);
CREATE INDEX IF NOT EXISTS idx_banishments_submitter ON banishments(submitter_wallet);
