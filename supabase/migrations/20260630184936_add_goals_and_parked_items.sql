
-- Goals table
CREATE TABLE IF NOT EXISTS goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  icon text NOT NULL DEFAULT 'briefcase',
  target_date date,
  milestone_1 text,
  milestone_2 text,
  milestone_3 text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_goals" ON goals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_goals" ON goals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_goals" ON goals FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_goals" ON goals FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Parked items (thoughts segregated into challenge/solution/task)
CREATE TABLE IF NOT EXISTS parked_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id uuid NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  milestone_index integer NOT NULL DEFAULT 0,
  raw_thought text NOT NULL,
  item_type text NOT NULL CHECK (item_type IN ('challenge', 'solution', 'task')),
  content text NOT NULL,
  is_closed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE parked_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_parked_items" ON parked_items FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_parked_items" ON parked_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_parked_items" ON parked_items FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_parked_items" ON parked_items FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Nudge cache per goal+milestone
CREATE TABLE IF NOT EXISTS goal_nudges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id uuid NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  milestone_index integer NOT NULL DEFAULT 0,
  nudge_text text,
  nudge_quote text,
  nudge_quote_author text,
  good_news_text text,
  generated_at timestamptz DEFAULT now(),
  UNIQUE(goal_id, milestone_index)
);

ALTER TABLE goal_nudges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_goal_nudges" ON goal_nudges FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_goal_nudges" ON goal_nudges FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_goal_nudges" ON goal_nudges FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_goal_nudges" ON goal_nudges FOR DELETE TO authenticated USING (auth.uid() = user_id);
