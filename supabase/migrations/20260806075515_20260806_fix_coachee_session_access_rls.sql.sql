/*
# Fix coachee access to coaching_sessions via capsule enrollment

## Problem
Coachees enrolled in a capsule could not see sessions in that capsule
unless the sessions were explicitly public+active, or the coachee was
individually nominated for that specific session. This caused booked
sessions to not appear in the coachee's Sessions tab.

## Changes
- Drops and recreates the `select_coaching_sessions` policy to add
  capsule-enrollment-based access: any authenticated user who is enrolled
  in a capsule can see all sessions in that capsule.
- The existing access paths (public+active, coach ownership, session
  nominee, purchased session) remain unchanged.

## Security
- No new tables or columns.
- Only the SELECT policy on `coaching_sessions` is modified.
- UPDATE/INSERT/DELETE policies are unchanged (still coach-only).
*/

DROP POLICY IF EXISTS "select_coaching_sessions" ON coaching_sessions;

CREATE POLICY "select_coaching_sessions" ON coaching_sessions FOR SELECT
  TO authenticated USING (
    (is_public AND is_active)
    OR is_coach_for(coach_id)
    OR user_is_session_nominee(id)
    OR user_purchased_session(id)
    OR EXISTS (
      SELECT 1 FROM capsule_enrollments ce
      WHERE ce.capsule_id = coaching_sessions.capsule_id
        AND ce.coachee_email = (auth.jwt() ->> 'email')
    )
  );
