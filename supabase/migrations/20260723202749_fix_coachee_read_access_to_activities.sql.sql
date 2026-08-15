/*
# Fix coachee read access to session activities and metrics

## Problem
Coachees nominated for a session (or who purchased one) could not see activity tabs
(Talk, Tasks, Quiz, Knowledge, Watch, Parking) because the SELECT policies on
`cc_activities` and `session_metrics` only allowed the coach (`coach_owns_session`).
Child tables (cc_tasks, quiz_modules, talk_config, parking_config, etc.) transitively
failed too because they check `EXISTS (SELECT 1 FROM cc_activities ...)`.

## Changes
1. New function `coachee_can_access_session(session_uuid)` — returns true if the
   authenticated user is a nominee (by email) or purchaser (by user_id) of the session.
2. New SELECT policies on `cc_activities` and `session_metrics` that allow coachees
   to read rows for sessions they can access. Existing coach policies are kept;
   these are additive (OR semantics).
*/

CREATE OR REPLACE FUNCTION coachee_can_access_session(p_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM session_nominees sn
      WHERE sn.session_id = p_session_id
        AND sn.coachee_email = (
          SELECT email FROM auth.users WHERE id = auth.uid()
        )
    )
    OR
    EXISTS (
      SELECT 1 FROM session_purchases sp
      WHERE sp.session_id = p_session_id
        AND sp.user_id = auth.uid()
    );
$$;

-- Add coachee SELECT policy on cc_activities (additive to existing coach policy)
DROP POLICY IF EXISTS "select_cc_activities_coachee" ON cc_activities;
CREATE POLICY "select_cc_activities_coachee"
  ON cc_activities FOR SELECT
  TO authenticated
  USING (coachee_can_access_session(session_id));

-- Add coachee SELECT policy on session_metrics (additive to existing coach policy)
DROP POLICY IF EXISTS "select_session_metrics_coachee" ON session_metrics;
CREATE POLICY "select_session_metrics_coachee"
  ON session_metrics FOR SELECT
  TO authenticated
  USING (coachee_can_access_session(session_id));
