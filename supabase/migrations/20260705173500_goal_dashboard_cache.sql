CREATE TABLE IF NOT EXISTS goal_dashboard_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id uuid NOT NULL,
  cache_key text NOT NULL,
  cache_data jsonb NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(goal_id, cache_key)
);

ALTER TABLE goal_dashboard_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_cache" ON goal_dashboard_cache FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_cache" ON goal_dashboard_cache FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_cache" ON goal_dashboard_cache FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_cache" ON goal_dashboard_cache FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
