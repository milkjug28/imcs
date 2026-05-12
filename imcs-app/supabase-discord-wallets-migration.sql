-- Multi-wallet support for Discord verification
-- One Discord user can link multiple wallets

CREATE TABLE IF NOT EXISTS discord_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_user_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL UNIQUE,
  token_count INTEGER DEFAULT 0,
  linked_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_discord_user FOREIGN KEY (discord_user_id)
    REFERENCES discord_verifications(discord_user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_discord_wallets_user
  ON discord_wallets(discord_user_id);

CREATE INDEX IF NOT EXISTS idx_discord_wallets_wallet
  ON discord_wallets(wallet_address);

-- Remove wallet_address column constraint from discord_verifications
-- (it now stores total across all wallets, not a single wallet)
-- Keep the column for backwards compat but it's no longer the source of truth
