-- Success tasks table for "Earn Medal" feature
CREATE TABLE IF NOT EXISTS vision_success_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vision_id UUID NOT NULL REFERENCES visions(id) ON DELETE CASCADE,
  task_text TEXT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  verification_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE vision_success_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_success_tasks" ON vision_success_tasks FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_success_tasks" ON vision_success_tasks FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_success_tasks" ON vision_success_tasks FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_success_tasks" ON vision_success_tasks FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_success_tasks_vision ON vision_success_tasks(vision_id);

-- Harry preferences for friend mode (habits, reminders etc)
CREATE TABLE IF NOT EXISTS harry_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  preference_key TEXT NOT NULL,
  preference_value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, preference_key)
);

ALTER TABLE harry_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_harry_prefs" ON harry_preferences FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_harry_prefs" ON harry_preferences FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_harry_prefs" ON harry_preferences FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_harry_prefs" ON harry_preferences FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
