-- Agent Memory table: per-user and general memories with salience scoring
CREATE TABLE agent_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_type TEXT NOT NULL CHECK (memory_type IN ('user_fact', 'conversation', 'observation', 'preference')),
  subject TEXT,
  content TEXT NOT NULL,
  salience REAL DEFAULT 0.5 CHECK (salience >= 0 AND salience <= 1),
  access_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_accessed TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX idx_agent_memory_subject ON agent_memory(subject);
CREATE INDEX idx_agent_memory_type ON agent_memory(memory_type);
CREATE INDEX idx_agent_memory_salience ON agent_memory(salience DESC);

-- Enable trigram extension for fuzzy content search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_agent_memory_content_trgm ON agent_memory USING gin(content gin_trgm_ops);

-- Agent State table: persistent key-value store for cron state, heartbeat, acquisition mode
CREATE TABLE agent_state (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);
