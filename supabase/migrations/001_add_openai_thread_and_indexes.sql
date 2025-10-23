-- Migration: Add OpenAI thread support and optimize indexes
-- Date: 2025-01-23
-- Description: Adds openai_thread_id to chats table, composite index for messages, and ensures real-time is enabled

-- Add openai_thread_id column to chats table (if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chats' AND column_name = 'openai_thread_id'
  ) THEN
    ALTER TABLE chats ADD COLUMN openai_thread_id TEXT UNIQUE;
  END IF;
END $$;

-- Create index on openai_thread_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_chats_thread_id ON chats(openai_thread_id);

-- Create composite index on messages(chat_id, created_at) for optimal query performance
-- This speeds up queries that fetch messages for a specific chat ordered by time
CREATE INDEX IF NOT EXISTS idx_messages_chat_id_created_at ON messages(chat_id, created_at);

-- Ensure messages table has real-time enabled
-- This allows instant message updates in the chat interface
DO $$
BEGIN
  -- Try to add messages table to realtime publication
  -- Will fail silently if already added
  ALTER PUBLICATION supabase_realtime ADD TABLE messages;
EXCEPTION
  WHEN duplicate_object THEN
    -- Table already in publication, do nothing
    NULL;
END $$;

-- Verify the changes
DO $$
BEGIN
  -- Check if openai_thread_id column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chats' AND column_name = 'openai_thread_id'
  ) THEN
    RAISE NOTICE 'SUCCESS: openai_thread_id column added to chats table';
  ELSE
    RAISE EXCEPTION 'FAILED: openai_thread_id column not found';
  END IF;

  -- Check if composite index exists
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'messages' AND indexname = 'idx_messages_chat_id_created_at'
  ) THEN
    RAISE NOTICE 'SUCCESS: Composite index idx_messages_chat_id_created_at created';
  ELSE
    RAISE WARNING 'WARNING: Composite index idx_messages_chat_id_created_at not found';
  END IF;

  RAISE NOTICE 'Migration completed successfully!';
END $$;
