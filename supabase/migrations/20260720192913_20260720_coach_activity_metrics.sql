/*
# Add per-activity behavioral metrics storage

## Purpose
Store computed behavioral metric values per coachee per activity per session,
so the coach dashboard can display completion + behavioral metrics together.

## New Table: coachee_activity_metrics
- id (uuid PK)
- session_id (uuid FK -> coaching_sessions)
- coachee_id (uuid FK -> coachees)
- user_id (uuid) — auth user id of the coachee
- activity_type (text) — talk/tasks/quiz/watch/parking/knowledge
- metric_name (text) — the behavioral metric prompt
- metric_value (text) — computed value (e.g. "3 negative words")
- computed_at (timestamptz)
- unique(session_id, coachee_id, activity_type, metric_name)

## Security
- RLS enabled, owner-scoped to authenticated coachees (user_id = auth.uid())
- Coach can read metrics for their coachees via session ownership
*/

CREATE TABLE IF NOT EXISTS coachee_activity_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES coaching_sessions(id) ON DELETE CASCADE,
  coachee_id uuid REFERENCES coachees(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  activity_type text NOT NULL,
  metric_name text NOT NULL,
  metric_value text,
  computed_at timestamptz DEFAULT now(),
  UNIQUE (session_id, coachee_id, activity_type, metric_name)
);

ALTER TABLE coachee_activity_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_activity_metrics" ON coachee_activity_metrics;
CREATE POLICY "select_own_activity_metrics" ON coachee_activity_metrics FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_activity_metrics" ON coachee_activity_metrics;
CREATE POLICY "insert_own_activity_metrics" ON coachee_activity_metrics FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_activity_metrics" ON coachee_activity_metrics;
CREATE POLICY "update_own_activity_metrics" ON coachee_activity_metrics FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_activity_metrics" ON coachee_activity_metrics;
CREATE POLICY "delete_own_activity_metrics" ON coachee_activity_metrics FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_coachee_activity_metrics_session ON coachee_activity_metrics(session_id);
CREATE INDEX IF NOT EXISTS idx_coachee_activity_metrics_coachee ON coachee_activity_metrics(coachee_id);
