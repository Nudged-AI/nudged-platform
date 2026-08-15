
-- Feature 10: Add is_all_thread flag to goals
ALTER TABLE goals ADD COLUMN IF NOT EXISTS is_all_thread boolean DEFAULT false;

-- Feature 14: Add default_tags to goals
ALTER TABLE goals ADD COLUMN IF NOT EXISTS default_tags text[] DEFAULT '{}';

-- Feature 3: Add extra_goal_ids for multi-thread linking
ALTER TABLE parked_items ADD COLUMN IF NOT EXISTS extra_goal_ids uuid[] DEFAULT '{}';

-- Feature 12/13: Saved summaries table
CREATE TABLE IF NOT EXISTS saved_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id uuid REFERENCES goals(id) ON DELETE SET NULL,
  title text NOT NULL,
  summary_text text NOT NULL,
  missing_focus text,
  thoughts_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE saved_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_summaries" ON saved_summaries FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_summaries" ON saved_summaries FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_summaries" ON saved_summaries FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_summaries" ON saved_summaries FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
