-- Floor `available` at 0 so a later sell (negative trading IQ) can never strand an
-- allocation into negative available. Allocated IQ on a savant stays permanent.
-- Dropping a generated column loses no data (it is derived); re-adding recomputes for all rows.
-- DROP defaults to RESTRICT: if anything depended on the column this errors and changes nothing.
-- Wrapped in a transaction so drop+add is atomic. Run in Supabase SQL editor.

BEGIN;

ALTER TABLE wallet_iq_balances DROP COLUMN available;

ALTER TABLE wallet_iq_balances
  ADD COLUMN available INTEGER
  GENERATED ALWAYS AS (GREATEST(0, total_earned - total_allocated)) STORED;

COMMIT;

-- Verify (run after): should show 0 rows with negative available.
-- SELECT count(*) FROM wallet_iq_balances WHERE available < 0;
