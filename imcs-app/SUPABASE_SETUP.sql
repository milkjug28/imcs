-- ========================================
-- IMCS SUPABASE DATABASE SETUP
-- SIMPLIFIED - NO RLS (Server-side only access)
-- ========================================
-- Run this entire file in your Supabase SQL Editor
-- Dashboard > SQL Editor > New Query > Paste & Run
-- ========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- TABLES
-- ========================================

-- Submissions table
CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  info TEXT NOT NULL,
  score NUMERIC DEFAULT 0,  -- Weighted score (can be decimal)
  created_at TIMESTAMP DEFAULT NOW(),
  ip_address TEXT,
  referrer_code TEXT,  -- For tracking who referred this submission
  CONSTRAINT wallet_format CHECK (wallet_address ~* '^0x[a-fA-F0-9]{40}$')
);

-- Votes table
CREATE TABLE IF NOT EXISTS votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
  voter_identifier TEXT NOT NULL,  -- Wallet address OR IP address
  vote_type TEXT CHECK(vote_type IN ('upvote', 'downvote')) NOT NULL,
  vote_weight NUMERIC DEFAULT 100,  -- 100 for wallet, 16.7 for IP
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(submission_id, voter_identifier)  -- Prevent duplicate votes
);

-- Access attempts (circle/typing tests)
CREATE TABLE IF NOT EXISTS access_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ip_address TEXT NOT NULL,
  attempt_type TEXT CHECK(attempt_type IN ('circle', 'typing')) NOT NULL,
  success BOOLEAN NOT NULL,
  score NUMERIC,  -- Circle accuracy % or typing WPM
  created_at TIMESTAMP DEFAULT NOW()
);

-- Whitelist table
CREATE TABLE IF NOT EXISTS whitelist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address TEXT NOT NULL UNIQUE,
  status TEXT CHECK(status IN ('approved', 'pending', 'rejected')) DEFAULT 'pending',
  method TEXT,  -- 'auto_score', 'auto_karma', 'manual', 'collaboration'
  notes TEXT,  -- Admin notes
  added_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT wallet_format_wl CHECK (wallet_address ~* '^0x[a-fA-F0-9]{40}$')
);

-- Referrals table (for gamification)
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_wallet TEXT NOT NULL,
  referred_wallet TEXT NOT NULL,
  referral_code TEXT NOT NULL,
  bonus_applied BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(referred_wallet)  -- Each person can only be referred once
);

-- ========================================
-- INDEXES (for performance)
-- ========================================

CREATE INDEX IF NOT EXISTS idx_submissions_wallet ON submissions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_submissions_score ON submissions(score DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_created ON submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_votes_submission ON votes(submission_id);
CREATE INDEX IF NOT EXISTS idx_votes_voter ON votes(voter_identifier);
CREATE INDEX IF NOT EXISTS idx_votes_created ON votes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_attempts_ip ON access_attempts(ip_address, attempt_type);
CREATE INDEX IF NOT EXISTS idx_whitelist_wallet ON whitelist(wallet_address);
CREATE INDEX IF NOT EXISTS idx_whitelist_status ON whitelist(status);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_wallet);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);

-- ========================================
-- FUNCTIONS
-- ========================================

-- Function to update submission scores (weighted votes)
-- This calculates: (sum of upvote weights) - (sum of downvote weights)
CREATE OR REPLACE FUNCTION update_submission_score(sub_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE submissions
  SET score = (
    SELECT COALESCE(
      SUM(CASE
        WHEN vote_type = 'upvote' THEN vote_weight
        WHEN vote_type = 'downvote' THEN -vote_weight
        ELSE 0
      END),
      0
    )
    FROM votes
    WHERE submission_id = sub_id
  )
  WHERE id = sub_id;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-update whitelist based on scores
-- Run this periodically (every hour or via cron job)
CREATE OR REPLACE FUNCTION update_whitelist_auto()
RETURNS TABLE(updated_count INTEGER) AS $$
DECLARE
  count_updated INTEGER := 0;
BEGIN
  -- Auto-approve submissions with score >= 1000
  WITH approved_submissions AS (
    INSERT INTO whitelist (wallet_address, status, method)
    SELECT wallet_address, 'approved', 'auto_score'
    FROM submissions
    WHERE score >= 1000
    ON CONFLICT (wallet_address)
    DO UPDATE SET
      status = 'approved',
      method = 'auto_score',
      updated_at = NOW()
    WHERE whitelist.status != 'approved' OR whitelist.method != 'auto_score'
    RETURNING 1
  )
  SELECT COUNT(*) INTO count_updated FROM approved_submissions;

  -- Auto-approve top 30% voters by karma
  WITH voter_karma AS (
    SELECT
      voter_identifier as wallet_address,
      COUNT(*) as karma_score,
      ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC) as rank,
      COUNT(*) OVER () as total_voters
    FROM votes
    WHERE voter_identifier LIKE '0x%'  -- Only wallet addresses
    GROUP BY voter_identifier
  ),
  approved_voters AS (
    INSERT INTO whitelist (wallet_address, status, method)
    SELECT wallet_address, 'approved', 'auto_karma'
    FROM voter_karma
    WHERE rank <= GREATEST((total_voters * 0.3)::INTEGER, 1)  -- Top 30%, min 1
    ON CONFLICT (wallet_address)
    DO UPDATE SET
      status = 'approved',
      method = CASE
        WHEN whitelist.method = 'auto_score' THEN 'auto_score'  -- Preserve auto_score
        ELSE 'auto_karma'
      END,
      updated_at = NOW()
    WHERE whitelist.status != 'approved'
    RETURNING 1
  )
  SELECT count_updated + COUNT(*) INTO count_updated FROM approved_voters;

  RETURN QUERY SELECT count_updated;
END;
$$ LANGUAGE plpgsql;

-- Function to get voter karma score
CREATE OR REPLACE FUNCTION get_voter_karma(voter_wallet TEXT)
RETURNS INTEGER AS $$
DECLARE
  karma INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO karma
  FROM votes
  WHERE voter_identifier = voter_wallet;

  RETURN COALESCE(karma, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to apply referral bonus
-- NOTE: Using p_ prefix for parameters to avoid column name conflicts
CREATE OR REPLACE FUNCTION apply_referral_bonus(p_ref_code TEXT, p_referred_wallet TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_referrer_wallet TEXT;
  v_already_referred BOOLEAN;
BEGIN
  -- Check if this wallet was already referred
  SELECT EXISTS(
    SELECT 1 FROM referrals WHERE referred_wallet = p_referred_wallet
  ) INTO v_already_referred;

  IF v_already_referred THEN
    RETURN FALSE;
  END IF;

  -- Find referrer by their referral code
  SELECT wallet_address INTO v_referrer_wallet
  FROM submissions
  WHERE referrer_code = p_ref_code;

  IF v_referrer_wallet IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Don't allow self-referral
  IF v_referrer_wallet = p_referred_wallet THEN
    RETURN FALSE;
  END IF;

  -- Insert referral record
  INSERT INTO referrals (referrer_wallet, referred_wallet, referral_code)
  VALUES (v_referrer_wallet, p_referred_wallet, p_ref_code);

  -- Give bonus to referrer (50 points)
  UPDATE submissions
  SET score = score + 50
  WHERE wallet_address = v_referrer_wallet;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- TRIGGERS
-- ========================================

-- Trigger to auto-update scores after vote insert/delete
CREATE OR REPLACE FUNCTION trigger_update_score()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM update_submission_score(OLD.submission_id);
    RETURN OLD;
  ELSE
    PERFORM update_submission_score(NEW.submission_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS vote_score_update ON votes;
CREATE TRIGGER vote_score_update
AFTER INSERT OR DELETE ON votes
FOR EACH ROW
EXECUTE FUNCTION trigger_update_score();

-- Trigger to set updated_at on whitelist changes
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS whitelist_updated_at ON whitelist;
CREATE TRIGGER whitelist_updated_at
BEFORE UPDATE ON whitelist
FOR EACH ROW
EXECUTE FUNCTION trigger_set_updated_at();

-- ========================================
-- VIEWS (for easier querying)
-- ========================================

-- Leaderboard view (submissions with stats)
CREATE OR REPLACE VIEW leaderboard_submissions AS
SELECT
  s.id,
  s.wallet_address,
  s.name,
  s.info,
  s.score,
  s.created_at,
  COUNT(v.id) as total_votes,
  COUNT(CASE WHEN v.vote_type = 'upvote' THEN 1 END) as upvotes,
  COUNT(CASE WHEN v.vote_type = 'downvote' THEN 1 END) as downvotes,
  w.status as whitelist_status
FROM submissions s
LEFT JOIN votes v ON s.id = v.submission_id
LEFT JOIN whitelist w ON s.wallet_address = w.wallet_address
GROUP BY s.id, w.status
ORDER BY s.score DESC, total_votes DESC;

-- Leaderboard view (voters with karma)
CREATE OR REPLACE VIEW leaderboard_voters AS
SELECT
  voter_identifier as wallet_address,
  COUNT(*) as votes_cast,
  SUM(vote_weight) as weighted_votes,
  COUNT(*) as karma_score,
  w.status as whitelist_status
FROM votes
LEFT JOIN whitelist w ON votes.voter_identifier = w.wallet_address
WHERE voter_identifier LIKE '0x%'  -- Only wallet addresses
GROUP BY voter_identifier, w.status
ORDER BY karma_score DESC;

-- User profile view (combines submission + voting + whitelist)
CREATE OR REPLACE VIEW user_profiles AS
SELECT
  s.wallet_address,
  s.name,
  s.info,
  s.score as submission_score,
  s.created_at as submitted_at,
  s.referrer_code,
  COALESCE(v.karma_score, 0) as voting_karma,
  COALESCE(w.status, 'not_submitted') as whitelist_status,
  w.method as whitelist_method,
  COALESCE(r.referral_count, 0) as referrals_made
FROM submissions s
LEFT JOIN (
  SELECT voter_identifier, COUNT(*) as karma_score
  FROM votes
  GROUP BY voter_identifier
) v ON s.wallet_address = v.voter_identifier
LEFT JOIN whitelist w ON s.wallet_address = w.wallet_address
LEFT JOIN (
  SELECT referrer_wallet, COUNT(*) as referral_count
  FROM referrals
  GROUP BY referrer_wallet
) r ON s.wallet_address = r.referrer_wallet;

-- ========================================
-- NO RLS POLICIES
-- ========================================
-- RLS is DISABLED - all access via server-side service role key
-- This is simpler and more secure for this use case

-- ========================================
-- HELPER QUERIES (run these as needed)
-- ========================================

-- Drop existing leaderboard view if it’s materialized or regular
DROP VIEW IF EXISTS leaderboard_scores CASCADE;
DROP MATERIALIZED VIEW IF EXISTS leaderboard_scores CASCADE;

-- Create materialized view for fast leaderboard ranking
CREATE MATERIALIZED VIEW leaderboard_scores AS
WITH task_points AS (
  SELECT wallet_address, SUM(score) as total_task_points
  FROM task_completions
  GROUP BY wallet_address
),
wallet_votes AS (
  SELECT voter_identifier as wallet_address, COUNT(*) as vote_count
  FROM votes
  WHERE voter_identifier LIKE '0x%'
  GROUP BY voter_identifier
),
ip_votes AS (
  SELECT s.wallet_address, COUNT(v.id) as vote_count
  FROM votes v
  JOIN submissions s ON v.voter_identifier = s.ip_address
  WHERE v.voter_identifier NOT LIKE '0x%'
  GROUP BY s.wallet_address
),
total_votes AS (
  SELECT 
    COALESCE(w.wallet_address, i.wallet_address) as wallet_address,
    COALESCE(w.vote_count, 0) + COALESCE(i.vote_count, 0) as total_voting_karma
  FROM wallet_votes w
  FULL OUTER JOIN ip_votes i ON w.wallet_address = i.wallet_address
)
SELECT 
  COALESCE(s.wallet_address, tp.wallet_address, tv.wallet_address) as wallet_address,
  s.name,
  s.info,
  COALESCE(s.score, 0) as submission_score,
  COALESCE(tp.total_task_points, 0) as task_points,
  COALESCE(tv.total_voting_karma, 0) as voting_karma,
  COALESCE(s.score, 0) + COALESCE(tp.total_task_points, 0) + COALESCE(tv.total_voting_karma, 0) as total_points,
  s.created_at
FROM submissions s
FULL OUTER JOIN task_points tp ON s.wallet_address = tp.wallet_address
FULL OUTER JOIN total_votes tv ON COALESCE(s.wallet_address, tp.wallet_address) = tv.wallet_address;

-- Create unique index for the materialized view so it can be refreshed concurrently
CREATE UNIQUE INDEX idx_leaderboard_wallet ON leaderboard_scores(wallet_address);

-- Get submission count
-- SELECT COUNT(*) FROM submissions;

-- Get total votes
-- SELECT COUNT(*) FROM votes;

-- Run whitelist update manually
-- SELECT update_whitelist_auto();

-- Get top 10 submissions
-- SELECT * FROM leaderboard_submissions LIMIT 10;

-- Get top 10 voters
-- SELECT * FROM leaderboard_voters LIMIT 10;

-- Check user profile
-- SELECT * FROM user_profiles WHERE wallet_address = '0x...';

-- Get whitelist count by status
-- SELECT status, COUNT(*) FROM whitelist GROUP BY status;

-- ========================================
-- INITIAL DATA (add manual whitelist addresses)
-- ========================================

-- Example: Add collaboration partners to whitelist
-- INSERT INTO whitelist (wallet_address, status, method, notes)
-- VALUES
--   ('0x1234567890123456789012345678901234567890', 'approved', 'collaboration', 'Project partner'),
--   ('0xABCDEF1234567890123456789012345678901234', 'approved', 'manual', 'Team member')
-- ON CONFLICT (wallet_address) DO NOTHING;

-- ========================================
-- MIGRATION: Multiply all points by 100
-- ========================================
-- Run this ONCE to scale existing data to the new point system
-- This multiplies all scores and vote weights by 100

-- Multiply all submission scores by 100
UPDATE submissions SET score = score * 100 WHERE score != 0;

-- Multiply all vote weights by 100
UPDATE votes SET vote_weight = vote_weight * 100 WHERE vote_weight != 0;

-- Recalculate all submission scores based on new vote weights
-- (This ensures consistency)
UPDATE submissions s
SET score = (
  SELECT COALESCE(
    SUM(CASE
      WHEN vote_type = 'upvote' THEN vote_weight
      WHEN vote_type = 'downvote' THEN -vote_weight
      ELSE 0
    END),
    0
  )
  FROM votes
  WHERE submission_id = s.id
)
WHERE EXISTS (SELECT 1 FROM votes WHERE submission_id = s.id);

-- ========================================
-- DONE!
-- ========================================

SELECT 'Setup complete! Tables created:' as message;
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE 'pg_%' ORDER BY tablename;
