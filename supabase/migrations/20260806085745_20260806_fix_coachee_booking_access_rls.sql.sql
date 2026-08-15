/*
# Fix coachee access to sessions and activities via coach_bookings

## Problem
A coachee who books a session via the public calendar (coach_bookings) could see the capsule
but NOT the session inside it, nor any activities (Talk, Tasks, Quiz, etc.) attached to that session.
This is because:
- `select_coaching_sessions` policy checks capsule_enrollments but NOT coach_bookings
- `coachee_can_access_session()` function checks session_nominees and session_purchases but NOT coach_bookings or capsule_enrollments

## Changes
1. Recreate `coachee_can_access_session` to also check `coach_bookings` (by session_id) and `capsule_enrollments` (by capsule_id via the session)
2. Recreate `select_coaching_sessions` policy to add a `coach_bookings` clause
3. Both changes use `auth.jwt() ->> 'email'` for consistency with existing patterns

## Security
- Only the coachee who made the booking (matching by email) gains read access
- No write access is granted — only SELECT
- The coach_bookings check is scoped to non-cancelled bookings
*/
-- Fix 1: Update coachee_can_access_session to check coach_bookings and capsule_enrollments
CREATE OR REPLACE FUNCTION public.coachee_can_access_session(p_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    EXISTS (SELECT 1 FROM session_nominees sn
            WHERE sn.session_id = p_session_id
              AND sn.coachee_email = (SELECT email FROM auth.users WHERE id = auth.uid()))
    OR
    EXISTS (SELECT 1 FROM session_purchases sp
            WHERE sp.session_id = p_session_id
              AND sp.user_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM coach_bookings cb
            WHERE cb.session_id = p_session_id
              AND cb.coachee_email = (SELECT email FROM auth.users WHERE id = auth.uid())
              AND cb.status <> 'cancelled')
    OR
    EXISTS (
      SELECT 1 FROM capsule_enrollments ce
      JOIN coaching_sessions cs ON cs.id = p_session_id
      WHERE ce.capsule_id = cs.capsule_id
        AND ce.coachee_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    );
$$;

-- Fix 2: Update select_coaching_sessions to add coach_bookings clause
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
    OR EXISTS (
      SELECT 1 FROM coach_bookings cb
      WHERE cb.session_id = coaching_sessions.id
        AND cb.coachee_email = (auth.jwt() ->> 'email')
        AND cb.status <> 'cancelled'
    )
  );
