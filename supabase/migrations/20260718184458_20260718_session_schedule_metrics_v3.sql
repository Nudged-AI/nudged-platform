/*
# Session enhancements: schedule fields, metrics, activity selection, parking tags

1. New columns on cc_tasks
- time_of_day (text) — morning/afternoon/evening/anytime
- days_per_week (integer) — how many days per week
- start_date (date) — when task schedule begins
- end_date (date) — when task schedule ends
- times_per_day (integer) — how many times per day the task must be done
2. New columns on cc_activities
- selected_activities (text[]) — which activity types the coach enabled for this session (quiz, tasks, talk, watch, knowledge, parking)
3. New columns on quiz_modules
- frequency (text) — how often quiz must be completed
- time_of_day (text)
- days_per_week (integer)
4. New columns on talk_config
- (already has duration_minutes, frequency, metrics, prompts, end_goal) — no change needed
5. New columns on watch_items
- start_date (date), end_date (date), times_per_day (integer), time_of_day (text), days_per_week (integer)
6. New columns on session_threads
- session_uid (text) — denormalized session UID for display
7. New table: session_metrics — declared metrics per session per activity type
8. RLS: owner-scoped via existing coaching_sessions ownership helper
*/

ALTER TABLE cc_tasks
  ADD COLUMN IF NOT EXISTS time_of_day text DEFAULT 'anytime',
  ADD COLUMN IF NOT EXISTS days_per_week integer DEFAULT 7,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS times_per_day integer DEFAULT 1;

ALTER TABLE cc_activities
  ADD COLUMN IF NOT EXISTS selected_activities text[] DEFAULT '{}';

ALTER TABLE quiz_modules
  ADD COLUMN IF NOT EXISTS frequency text,
  ADD COLUMN IF NOT EXISTS time_of_day text DEFAULT 'anytime',
  ADD COLUMN IF NOT EXISTS days_per_week integer DEFAULT 7;

ALTER TABLE watch_items
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS times_per_day integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS time_of_day text DEFAULT 'anytime',
  ADD COLUMN IF NOT EXISTS days_per_week integer DEFAULT 7;

ALTER TABLE session_threads
  ADD COLUMN IF NOT EXISTS session_uid text;

CREATE TABLE IF NOT EXISTS session_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES coaching_sessions(id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  metric_name text NOT NULL,
  target_value text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE session_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_session_metrics" ON session_metrics;
CREATE POLICY "select_session_metrics" ON session_metrics FOR SELECT
  TO authenticated USING (
    coach_owns_session(session_id)
    OR user_is_session_nominee(session_id)
    OR user_purchased_session(session_id)
  );

DROP POLICY IF EXISTS "insert_session_metrics" ON session_metrics;
CREATE POLICY "insert_session_metrics" ON session_metrics FOR INSERT
  TO authenticated WITH CHECK (coach_owns_session(session_id));

DROP POLICY IF EXISTS "delete_session_metrics" ON session_metrics;
CREATE POLICY "delete_session_metrics" ON session_metrics FOR DELETE
  TO authenticated USING (coach_owns_session(session_id));

CREATE INDEX IF NOT EXISTS idx_session_metrics_session ON session_metrics(session_id);
CREATE INDEX IF NOT EXISTS idx_cc_tasks_dates ON cc_tasks(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_activity_completions_date ON activity_completions(session_id, user_id, activity_type, completed_date);
