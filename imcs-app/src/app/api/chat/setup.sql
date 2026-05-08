-- Run this in Supabase SQL editor to create chat tables

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  username TEXT NOT NULL,
  message TEXT NOT NULL CHECK (char_length(message) <= 500),
  is_bot BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_chat_messages_created ON chat_messages (created_at DESC);
CREATE INDEX idx_chat_messages_wallet ON chat_messages (wallet_address);

CREATE TABLE IF NOT EXISTS chat_usernames (
  wallet_address TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_chat_usernames_name ON chat_usernames (username);
