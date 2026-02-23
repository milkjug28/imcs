-- Add claim-related columns to whitelist table
ALTER TABLE whitelist ADD COLUMN IF NOT EXISTS x_username TEXT;
ALTER TABLE whitelist ADD COLUMN IF NOT EXISTS x_user_id TEXT;
ALTER TABLE whitelist ADD COLUMN IF NOT EXISTS tweet_link TEXT;
ALTER TABLE whitelist ADD COLUMN IF NOT EXISTS claimed BOOLEAN DEFAULT FALSE;
ALTER TABLE whitelist ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMP;
