/*
  # Return On - Focus App Tables

  1. New Tables
    - `sessions` - stores declared focus sessions
      - id, goal, end_minutes, allowed_sites (array), tolerance_seconds, status, started_at, ended_at
    - `deviations` - stores deviation events per session
      - id, session_id, url, started_at, returned_at, was_reminded
  2. Security
    - Enable RLS on both tables
    - Policies for authenticated users to manage their own data
*/

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  goal text NOT NULL DEFAULT '',
  end_minutes integer NOT NULL DEFAULT 25,
  allowed_sites text[] NOT NULL DEFAULT '{}',
  tolerance_seconds integer NOT NULL DEFAULT 20,
  status text NOT NULL DEFAULT 'active',
  last_allowed_url text NOT NULL DEFAULT '',
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz
);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own sessions"
  ON sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS deviations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  url text NOT NULL DEFAULT '',
  started_at timestamptz DEFAULT now(),
  returned_at timestamptz,
  was_reminded boolean NOT NULL DEFAULT false
);

ALTER TABLE deviations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own deviations"
  ON deviations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = deviations.session_id
      AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own deviations"
  ON deviations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = deviations.session_id
      AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own deviations"
  ON deviations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = deviations.session_id
      AND sessions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = deviations.session_id
      AND sessions.user_id = auth.uid()
    )
  );
