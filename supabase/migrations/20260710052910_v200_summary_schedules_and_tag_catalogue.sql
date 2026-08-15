/*
# v2.0.0 Summary Schedules

1. New Tables
- `summary_schedules` — user-scheduled summary generation
  - id (uuid PK)
  - user_id (uuid, owner, defaults to auth.uid())
  - goal_id (uuid FK to goals, which thread)
  - tags (text[], optional filter by tags)
  - custom_prompt (text, AI prompt for the summary)
  - frequency (text: 'once','daily','weekly','monthly')
  - time_of_day (text, HH:MM)
  - day_of_week (int, nullable, for weekly)
  - date_of_month (int, nullable, for monthly)
  - specific_datetime (timestamptz, nullable, for once)
  - is_active (boolean, default true)
  - last_run_at (timestamptz, nullable)
  - created_at (timestamptz, default now())
2. Security
- Enable RLS on summary_schedules
- Owner-scoped CRUD policies for authenticated users
3. Notes
- saved_summaries table already exists; summary_schedules generates entries into it
*/

CREATE TABLE IF NOT EXISTS summary_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id uuid NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  tags text[] NOT NULL DEFAULT '{}',
  custom_prompt text NOT NULL DEFAULT '',
  frequency text NOT NULL DEFAULT 'daily' CHECK (frequency IN ('once','daily','weekly','monthly')),
  time_of_day text NOT NULL DEFAULT '21:00',
  day_of_week int,
  date_of_month int,
  specific_datetime timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE summary_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_summary_schedules" ON summary_schedules;
CREATE POLICY "select_own_summary_schedules" ON summary_schedules FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_summary_schedules" ON summary_schedules;
CREATE POLICY "insert_own_summary_schedules" ON summary_schedules FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_summary_schedules" ON summary_schedules;
CREATE POLICY "update_own_summary_schedules" ON summary_schedules FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_summary_schedules" ON summary_schedules;
CREATE POLICY "delete_own_summary_schedules" ON summary_schedules FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Add default_tags column to goals (min 1, max 3 default tags per thread)
ALTER TABLE goals ADD COLUMN IF NOT EXISTS default_tags text[] NOT NULL DEFAULT '{}';
