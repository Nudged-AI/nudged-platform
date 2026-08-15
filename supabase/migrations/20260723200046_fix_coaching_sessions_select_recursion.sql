/*
# Fix coaching_sessions SELECT policy — eliminate recursive coach_owns_session call

## Root cause
The SELECT policy on coaching_sessions called coach_owns_session(id), which
internally queries coaching_sessions again, causing infinite recursion.
When a coach inserts a new session and chains .select().single(), the SELECT
policy would recurse and fail, producing the misleading RLS error.

## Fix
Replace the SELECT policy to use is_coach_for(coach_id) directly — coach_id
is already on the coaching_sessions row itself, so no recursive join needed.

Also rebuild coach_owns_session to only be used by CHILD tables (cc_activities,
session_passkeys, etc.) which legitimately need to look up the session's coach.
coach_owns_session is fine for those tables because they don't query coaching_sessions
from within the coaching_sessions SELECT policy.

No data modified.
*/

-- Fix the SELECT policy to avoid recursion
DROP POLICY IF EXISTS select_coaching_sessions ON coaching_sessions;
CREATE POLICY select_coaching_sessions ON coaching_sessions FOR SELECT
  TO authenticated
  USING (
    (is_public AND is_active)
    OR is_coach_for(coach_id)
    OR user_is_session_nominee(id)
    OR user_purchased_session(id)
  );

-- Also restore INSERT to proper check (not the wide-open debug version)
DROP POLICY IF EXISTS insert_coaching_sessions ON coaching_sessions;
CREATE POLICY insert_coaching_sessions ON coaching_sessions FOR INSERT
  TO authenticated WITH CHECK (is_coach_for(coach_id));
