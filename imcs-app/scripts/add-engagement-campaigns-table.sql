-- X Engagement Campaigns
-- Admin creates campaigns to boost tweets or spread copypasta

CREATE TABLE IF NOT EXISTS x_engagement_campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  target_tweet_id TEXT,
  target_tweet_url TEXT,
  engagement_type TEXT NOT NULL DEFAULT 'quote_repost' CHECK (engagement_type IN ('quote_repost', 'reply', 'post_copypasta')),
  required_text TEXT,
  iq_reward INTEGER NOT NULL DEFAULT 10,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_engagement_campaigns_active ON x_engagement_campaigns(active) WHERE active = true;
