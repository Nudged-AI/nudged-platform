/*
# Feedback System and Login Events

1. New Tables
- `app_feedback`: General qualitative feedback submitted via the feedback form.
  - user_id, email, feature (dropdown), screenshot_url, text_feedback, created_at
- `reaction_feedback`: Thumbs up/down reactions on key actions (park thought, bulk park, search).
  - user_id, email, action_type, is_positive, qualitative (if negative), created_at
- `user_login_events`: Records each time a user logs in, for admin visibility.
  - user_id, email, created_at

2. Security
- RLS enabled on all three tables.
- Authenticated users can INSERT their own rows.
- Only admin (deepagster@gmail.com) can SELECT all rows via service role; clients use authenticated SELECT scoped to own user_id.
*/

CREATE TABLE IF NOT EXISTS app_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  feature text NOT NULL,
  screenshot_url text,
  text_feedback text,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE app_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insert_own_feedback" ON app_feedback;
CREATE POLICY "insert_own_feedback" ON app_feedback FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_own_feedback" ON app_feedback;
CREATE POLICY "select_own_feedback" ON app_feedback FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS reaction_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  action_type text NOT NULL,
  is_positive boolean NOT NULL,
  qualitative text,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE reaction_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insert_own_reaction" ON reaction_feedback;
CREATE POLICY "insert_own_reaction" ON reaction_feedback FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_own_reaction" ON reaction_feedback;
CREATE POLICY "select_own_reaction" ON reaction_feedback FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS user_login_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS user_login_events_user_id_idx ON user_login_events (user_id, created_at DESC);

ALTER TABLE user_login_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insert_own_login_event" ON user_login_events;
CREATE POLICY "insert_own_login_event" ON user_login_events FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_own_login_events" ON user_login_events;
CREATE POLICY "select_own_login_events" ON user_login_events FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
