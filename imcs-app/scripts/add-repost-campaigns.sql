-- First: add 'repost' to the allowed engagement types
ALTER TABLE x_engagement_campaigns
  DROP CONSTRAINT x_engagement_campaigns_engagement_type_check;

ALTER TABLE x_engagement_campaigns
  ADD CONSTRAINT x_engagement_campaigns_engagement_type_check
  CHECK (engagement_type IN ('repost', 'quote_repost', 'reply', 'post_copypasta'));

-- 1. Repost for +10 IQ
INSERT INTO x_engagement_campaigns (id, name, description, target_tweet_id, target_tweet_url, engagement_type, required_text, iq_reward, active)
VALUES (
  gen_random_uuid(),
  'repost da tweet',
  'repost dis tweet 2 spred da savant gospel. ez iq.',
  '2058673795330715705',
  'https://x.com/imcsnft/status/2058673795330715705',
  'repost',
  NULL,
  10,
  true
);

-- 2. Quote repost tagging @imcsnft for +15 IQ
INSERT INTO x_engagement_campaigns (id, name, description, target_tweet_id, target_tweet_url, engagement_type, required_text, iq_reward, active)
VALUES (
  gen_random_uuid(),
  'quote repost n tag @imcsnft',
  'quote repost da tweet n tag @imcsnft. show da wurld ur a savant.',
  '2058673795330715705',
  'https://x.com/imcsnft/status/2058673795330715705',
  'quote_repost',
  '@imcsnft',
  15,
  true
);
