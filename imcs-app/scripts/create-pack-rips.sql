-- pack_rips: one row per pack opened (rip).
-- iq_awarded = sum of BoosterWon IQ for that rip (0 when no booster slot).
-- COUNT(*) per wallet = lifetime paks ript. SUM(iq_awarded) = pack IQ earned.
-- Replaces the old pack_iq_credits name (same shape, clearer purpose).

DROP TABLE IF EXISTS pack_iq_credits;

CREATE TABLE IF NOT EXISTS pack_rips (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  request_id    TEXT NOT NULL UNIQUE,
  iq_awarded    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pack_rips_wallet ON pack_rips(wallet_address);
