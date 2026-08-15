CREATE TABLE IF NOT EXISTS thought_vents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  goal_id uuid REFERENCES goals(id) ON DELETE SET NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE thought_vents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_vents" ON thought_vents FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_vents" ON thought_vents FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_vents" ON thought_vents FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_vents" ON thought_vents FOR DELETE TO authenticated USING (auth.uid() = user_id);
