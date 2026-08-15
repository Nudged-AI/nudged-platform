-- Thought Investment Engine: store thought analysis results
CREATE TABLE IF NOT EXISTS thought_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES coaching_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  components jsonb NOT NULL DEFAULT '[]'::jsonb,
  undercurrents jsonb NOT NULL DEFAULT '[]'::jsonb,
  missing_pieces jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  johari_window jsonb NOT NULL DEFAULT '{}'::jsonb,
  word_cloud jsonb NOT NULL DEFAULT '[]'::jsonb,
  negative_words jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE thought_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_thought_analyses" ON thought_analyses FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_thought_analyses" ON thought_analyses FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_thought_analyses" ON thought_analyses FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_thought_analyses" ON thought_analyses FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Allow coaches to read analyses for their sessions' coachees
CREATE POLICY "coach_read_thought_analyses" ON thought_analyses FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM coaching_sessions cs
      JOIN coaches c ON c.id = cs.coach_id
      WHERE cs.id = thought_analyses.session_id
        AND c.email = (auth.email() )
    )
  );

-- Behavioral metrics storage per activity
CREATE TABLE IF NOT EXISTS cc_behavior_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES coaching_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  metric_name text NOT NULL,
  metric_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(session_id, user_id, activity_type, metric_name, recorded_date)
);

ALTER TABLE cc_behavior_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_behavior_metrics" ON cc_behavior_metrics FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_behavior_metrics" ON cc_behavior_metrics FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_behavior_metrics" ON cc_behavior_metrics FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_behavior_metrics" ON cc_behavior_metrics FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "coach_read_behavior_metrics" ON cc_behavior_metrics FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM coaching_sessions cs
      JOIN coaches c ON c.id = cs.coach_id
      WHERE cs.id = cc_behavior_metrics.session_id
        AND c.email = auth.email()
    )
  );

-- Add passkey column to session_nominees for coach to change later
ALTER TABLE session_nominees ADD COLUMN IF NOT EXISTS passkey text;
