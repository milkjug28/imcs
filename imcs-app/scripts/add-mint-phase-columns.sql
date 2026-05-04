-- Migration: Add mint phase columns to whitelist table
-- Phases: GTD (guaranteed), Community (snapshot holders), FCFS (first come first serve)
-- Phases stack: each phase = 1 mint allocation

ALTER TABLE whitelist ADD COLUMN IF NOT EXISTS gtd BOOLEAN DEFAULT false;
ALTER TABLE whitelist ADD COLUMN IF NOT EXISTS community BOOLEAN DEFAULT false;
ALTER TABLE whitelist ADD COLUMN IF NOT EXISTS fcfs BOOLEAN DEFAULT false;
ALTER TABLE whitelist ADD COLUMN IF NOT EXISTS source TEXT;

-- Index for phase-based queries (wallet checker, merkle tree generation)
CREATE INDEX IF NOT EXISTS idx_whitelist_gtd ON whitelist (wallet_address) WHERE gtd = true;
CREATE INDEX IF NOT EXISTS idx_whitelist_community ON whitelist (wallet_address) WHERE community = true;
CREATE INDEX IF NOT EXISTS idx_whitelist_fcfs ON whitelist (wallet_address) WHERE fcfs = true;
CREATE INDEX IF NOT EXISTS idx_whitelist_source ON whitelist (source);
