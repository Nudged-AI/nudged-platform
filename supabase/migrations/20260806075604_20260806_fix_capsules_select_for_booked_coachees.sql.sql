/*
# Fix capsules SELECT to allow coachees who booked sessions in that capsule

## Problem
When a coachee books a session via the public calendar, they may not be
formally enrolled in the capsule. The capsules SELECT policy only allows:
public+active, coach ownership, or capsule_enrollments match. So a coachee
who booked a session can see the session (via the new coaching_sessions
policy) but cannot see the capsule details (name, description, coach).

## Solution
Add an additional OR condition to the capsules SELECT policy: allow access
if the user has a booking in coach_bookings with a session_id whose
coaching_sessions.capsule_id matches this capsule.

## Security
- Only the SELECT policy is modified; INSERT/UPDATE/DELETE unchanged
- The new condition checks both coach_bookings AND coaching_sessions to
  ensure the user actually booked a session in this capsule
*/

DROP POLICY IF EXISTS "select_capsules" ON capsules;

CREATE POLICY "select_capsules" ON capsules FOR SELECT
  TO authenticated USING (
    (is_public AND is_active)
    OR is_coach_for(coach_id)
    OR EXISTS (
      SELECT 1 FROM capsule_enrollments ce
      WHERE ce.capsule_id = capsules.id
        AND ce.coachee_email = (auth.jwt() ->> 'email')
    )
    OR EXISTS (
      SELECT 1 FROM coach_bookings cb
      JOIN coaching_sessions cs ON cs.id = cb.session_id
      WHERE cb.coachee_email = (auth.jwt() ->> 'email')
        AND cs.capsule_id = capsules.id
    )
  );
