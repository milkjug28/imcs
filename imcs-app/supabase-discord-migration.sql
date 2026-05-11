-- Discord verification table
-- Stores wallet <-> Discord account links and tier info
CREATE TABLE IF NOT EXISTS discord_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_user_id TEXT NOT NULL UNIQUE,
  discord_username TEXT,
  wallet_address TEXT NOT NULL,
  token_count INTEGER DEFAULT 0,
  tiers TEXT[],
  verified_at TIMESTAMPTZ DEFAULT NOW(),
  last_checked TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discord_verifications_wallet
  ON discord_verifications(wallet_address);

CREATE INDEX IF NOT EXISTS idx_discord_verifications_discord
  ON discord_verifications(discord_user_id);
