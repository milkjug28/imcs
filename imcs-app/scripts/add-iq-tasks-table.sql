-- IQ Task Completions table
-- Tracks tasks wallets complete to earn IQ points
CREATE TABLE iq_task_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  task_type TEXT NOT NULL,
  iq_awarded INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}',
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(wallet_address, task_type)
);

CREATE INDEX idx_iq_task_completions_wallet ON iq_task_completions(wallet_address);
