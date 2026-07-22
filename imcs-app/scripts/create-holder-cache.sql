-- Durable fallback for NFT ownership data when Alchemy is down or rate-limited.
-- The API server upserts on every successful Alchemy fetch, so this stays
-- reasonably fresh without any scheduled job.

CREATE TABLE IF NOT EXISTS holder_cache (
  wallet_address TEXT PRIMARY KEY,
  token_ids INTEGER[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_holder_cache_updated
  ON holder_cache (updated_at DESC);

-- Deny-all RLS (repo convention, see enable-rls-all-tables.sql). Server uses
-- the service_role key which bypasses RLS; a leaked anon key must not be able
-- to poison ownership data that getOwnedTokenIds falls back to.
ALTER TABLE holder_cache ENABLE ROW LEVEL SECURITY;
