# Database Migrations

This folder contains SQL migration scripts to update your Supabase database.

## When to Use Migrations

- **New installations**: Run the main `schema.sql` file
- **Existing databases**: Run migration files to add new features without losing data

## How to Run Migrations

### Option 1: Supabase Dashboard (Recommended)

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **SQL Editor**
4. Click **New Query**
5. Copy and paste the migration SQL
6. Click **Run** or press `Ctrl/Cmd + Enter`

### Option 2: Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Run migration
supabase db push
```

## Migration Files

### 001_add_openai_thread_and_indexes.sql

**Purpose**: Adds OpenAI Assistants API support and optimizes message queries

**Changes**:
- ✅ Adds `openai_thread_id` column to `chats` table
- ✅ Creates index on `openai_thread_id` for fast lookups
- ✅ Creates composite index on `messages(chat_id, created_at)`
- ✅ Ensures real-time is enabled on messages table

**When to run**: After initial setup if you need OpenAI Assistants API integration

**Safe to re-run**: Yes (uses `IF NOT EXISTS` checks)

## Migration Order

Run migrations in numerical order:
1. `001_add_openai_thread_and_indexes.sql`
2. (Future migrations will be numbered 002, 003, etc.)

## Verification

After running a migration, you can verify the changes:

```sql
-- Check if openai_thread_id column exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'chats' AND column_name = 'openai_thread_id';

-- Check indexes on messages table
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'messages';

-- Check real-time publication
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';
```

## Troubleshooting

### Error: "column already exists"
This is normal if you've already run the migration. The script checks for existing columns.

### Error: "relation does not exist"
Run the main `schema.sql` file first to create all tables.

### Error: "permission denied"
Make sure you're using the service role key or running in Supabase dashboard as owner.

## Rollback (If Needed)

To rollback migration 001:

```sql
-- Remove openai_thread_id column
ALTER TABLE chats DROP COLUMN IF EXISTS openai_thread_id;

-- Remove indexes
DROP INDEX IF EXISTS idx_chats_thread_id;
DROP INDEX IF EXISTS idx_messages_chat_id_created_at;

-- Note: Cannot remove table from realtime publication safely
-- (would affect other features)
```

## Best Practices

1. **Backup first**: Always backup your database before running migrations
2. **Test locally**: Use Supabase local development to test migrations
3. **Run in order**: Always run migrations in numerical order
4. **Check results**: Verify changes after running migrations
5. **Keep history**: Don't delete old migration files

## Creating New Migrations

If you need to create a new migration:

1. Create a new file: `00X_descriptive_name.sql`
2. Use `IF NOT EXISTS` and `IF EXISTS` for safety
3. Add verification queries
4. Test on local database first
5. Document changes in this README
