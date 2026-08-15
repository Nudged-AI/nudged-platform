-- Add content_interests field to visions
ALTER TABLE visions ADD COLUMN IF NOT EXISTS content_interests TEXT;

-- Create diary_entries table
CREATE TABLE IF NOT EXISTS diary_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  content TEXT NOT NULL,
  is_custom_topic BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE diary_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_diary" ON diary_entries FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "insert_own_diary" ON diary_entries FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_diary" ON diary_entries FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_diary" ON diary_entries FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS diary_entries_user_id_idx ON diary_entries(user_id);
CREATE INDEX IF NOT EXISTS diary_entries_created_at_idx ON diary_entries(user_id, created_at DESC);
