/*
# Add coaching details, engagement details, capsule fields, and insights history

## Summary
This migration adds new columns to support richer coachee onboarding and capsule creation,
plus new tables for coach insights conversation history and beliefs/emotions analysis.

## Changes to `coachees` table
New non-mandatory columns for coaching and engagement details:
- reasons_for_seeking (text) — why the coachee is seeking coaching
- primary_goal (text) — coachee's primary goal
- main_blocker (text) — main blocker the coachee faces
- target_timeline (text) — target timeline for achieving goals
- preferred_language (text) — preferred communication language
- reminder_style (text) — how coachee prefers reminders
- package (text) — coaching package
- session_frequency (text) — how often sessions occur
- preferred_start_date (date) — when coachee wants to start

## Changes to `capsules` table
- capsule_goal (text) — mandatory quantifiable goal for the capsule
- package_offered (text) — package offered with this capsule
- remarks (text) — additional remarks

## New table: `coach_insights_history`
Stores the last 3 AI-generated coach insights conversations per session+activity+coachee.
- id (uuid PK)
- session_id (uuid, FK to coaching_sessions)
- activity_type (text)
- coachee_email (text)
- insights_text (text)
- conversation_json (jsonb) — full follow-up chat
- created_at (timestamptz)

## New table: `coach_beliefs_analysis`
Stores AI-generated top beliefs/emotions identified from coachee activities.
- id (uuid PK)
- session_id (uuid, FK to coaching_sessions)
- coachee_email (text) — empty string means all coachees
- beliefs_json (jsonb) — array of {belief, emotion, source, confidence}
- created_at (timestamptz)

## Security
- RLS enabled on both new tables.
- Policies: coach who owns the session can CRUD (uses coach_owns_session function).
*/

-- Add columns to coachees
DO $$ BEGIN
  ALTER TABLE coachees ADD COLUMN IF NOT EXISTS reasons_for_seeking text;
  ALTER TABLE coachees ADD COLUMN IF NOT EXISTS primary_goal text;
  ALTER TABLE coachees ADD COLUMN IF NOT EXISTS main_blocker text;
  ALTER TABLE coachees ADD COLUMN IF NOT EXISTS target_timeline text;
  ALTER TABLE coachees ADD COLUMN IF NOT EXISTS preferred_language text;
  ALTER TABLE coachees ADD COLUMN IF NOT EXISTS reminder_style text;
  ALTER TABLE coachees ADD COLUMN IF NOT EXISTS package text;
  ALTER TABLE coachees ADD COLUMN IF NOT EXISTS session_frequency text;
  ALTER TABLE coachees ADD COLUMN IF NOT EXISTS preferred_start_date date;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Add columns to capsules
DO $$ BEGIN
  ALTER TABLE capsules ADD COLUMN IF NOT EXISTS capsule_goal text;
  ALTER TABLE capsules ADD COLUMN IF NOT EXISTS package_offered text;
  ALTER TABLE capsules ADD COLUMN IF NOT EXISTS remarks text;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Create coach_insights_history table
CREATE TABLE IF NOT EXISTS coach_insights_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES coaching_sessions(id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  coachee_email text NOT NULL,
  insights_text text,
  conversation_json jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE coach_insights_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_insights_history_own" ON coach_insights_history;
CREATE POLICY "select_insights_history_own" ON coach_insights_history FOR SELECT
  TO authenticated USING (public.coach_owns_session(session_id));

DROP POLICY IF EXISTS "insert_insights_history_own" ON coach_insights_history;
CREATE POLICY "insert_insights_history_own" ON coach_insights_history FOR INSERT
  TO authenticated WITH CHECK (public.coach_owns_session(session_id));

DROP POLICY IF EXISTS "delete_insights_history_own" ON coach_insights_history;
CREATE POLICY "delete_insights_history_own" ON coach_insights_history FOR DELETE
  TO authenticated USING (public.coach_owns_session(session_id));

-- Create coach_beliefs_analysis table
CREATE TABLE IF NOT EXISTS coach_beliefs_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES coaching_sessions(id) ON DELETE CASCADE,
  coachee_email text NOT NULL DEFAULT '',
  beliefs_json jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE coach_beliefs_analysis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_beliefs_own" ON coach_beliefs_analysis;
CREATE POLICY "select_beliefs_own" ON coach_beliefs_analysis FOR SELECT
  TO authenticated USING (public.coach_owns_session(session_id));

DROP POLICY IF EXISTS "insert_beliefs_own" ON coach_beliefs_analysis;
CREATE POLICY "insert_beliefs_own" ON coach_beliefs_analysis FOR INSERT
  TO authenticated WITH CHECK (public.coach_owns_session(session_id));

DROP POLICY IF EXISTS "delete_beliefs_own" ON coach_beliefs_analysis;
CREATE POLICY "delete_beliefs_own" ON coach_beliefs_analysis FOR DELETE
  TO authenticated USING (public.coach_owns_session(session_id));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_insights_history_session ON coach_insights_history(session_id, activity_type, coachee_email);
CREATE INDEX IF NOT EXISTS idx_beliefs_session ON coach_beliefs_analysis(session_id, coachee_email);
