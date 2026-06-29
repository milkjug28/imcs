-- Enable Row Level Security on every table, with NO policies.
--
-- Effect:
--   - service_role key (used by all server-side API routes) has the bypassrls
--     attribute, so it IGNORES RLS entirely -> your app keeps working unchanged.
--   - anon / authenticated / public roles hit deny-all (RLS on + zero policies =
--     no rows readable, writable, or deletable).
--
-- This converts "safe because nobody has the anon key" into "safe even if the
-- anon key leaks." Run once in the Supabase SQL editor. Idempotent.

ALTER TABLE IF EXISTS public.access_attempts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.banishments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.community_claims        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.discord_verifications   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.discord_wallets         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.iq_snapshots            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.iq_task_completions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pack_rips               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.referrals               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.savant_iq               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.submissions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.task_completions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.trait_burns             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.votes                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.wallet_iq_balances      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.wallet_iq_snapshots     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.whitelist               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.x_engagement_campaigns  ENABLE ROW LEVEL SECURITY;

-- Verify: every table below should show rowsecurity = true.
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
