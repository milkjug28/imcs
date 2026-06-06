-- trait_burns: one row per burn-for-IQ transaction.
-- A holder burns unequipped trait 1155s; each trait burned = +5 IQ for allocation.
-- Weekly cap: <= 50 traits burned per wallet per week (resets Sunday 00:00 UTC),
--   enforced by SUM(traits_burned) WHERE created_at >= week_start.
-- iq_awarded = credited IQ (capped to the weekly remaining); may be < traits_burned*5
--   if an over-cap burn was submitted directly to the contract.
-- tx_hash UNIQUE = idempotency guard against double-claiming the same burn tx.

CREATE TABLE IF NOT EXISTS trait_burns (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  tx_hash        TEXT NOT NULL UNIQUE,
  traits_burned  INTEGER NOT NULL DEFAULT 0,
  iq_awarded     INTEGER NOT NULL DEFAULT 0,
  trait_ids      JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trait_burns_wallet ON trait_burns(wallet_address);
CREATE INDEX IF NOT EXISTS idx_trait_burns_wallet_week ON trait_burns(wallet_address, created_at);
