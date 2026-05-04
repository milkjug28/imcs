-- Community Claims table
-- Tracks NFT holders from partner collections claiming whitelist spots
-- holder_wallet = wallet that owns the NFT (signs the message)
-- mint_wallet = wallet that will mint on mint day (can be burner)
-- ONE claim per holder wallet across ALL collections

CREATE TABLE IF NOT EXISTS community_claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  holder_wallet TEXT NOT NULL,
  mint_wallet TEXT NOT NULL,
  collection_slug TEXT NOT NULL,
  collection_address TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  signature TEXT NOT NULL,
  claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- One claim per holder wallet GLOBALLY (not per collection)
  CONSTRAINT unique_holder_global UNIQUE (holder_wallet),
  -- One claim per mint wallet GLOBALLY
  CONSTRAINT unique_mint_global UNIQUE (mint_wallet)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_community_claims_collection ON community_claims(collection_slug);
CREATE INDEX IF NOT EXISTS idx_community_claims_mint_wallet ON community_claims(mint_wallet);
CREATE INDEX IF NOT EXISTS idx_community_claims_holder_wallet ON community_claims(holder_wallet);

-- View: claim counts per collection
CREATE OR REPLACE VIEW community_claim_counts AS
SELECT
  collection_slug,
  COUNT(*) as claimed
FROM community_claims
GROUP BY collection_slug;
