/*
# Fix coachee access to sessions and activities via capsule enrollment

## Problem
Coachees enrolled in a private Coaching capsule could not see the capsule's
sessions or activities in the coachee view. The RLS helper functions
`coachee_can_access_session` and `user_is_session_nominee` only checked
`session_nominees` and `session_purchases`, ignoring `capsule_enrollments`.
The `coaching_sessions` SELECT policy also did not cover capsule-enrolled coachees.

## Changes
1. Recreate `coachee_can_access_session(session_id)` to additionally return true
   when the caller's email is enrolled in the capsule that owns the session.
2. Recreate `user_is_session_nominee(session_id)` the same way (used by the
   `coaching_sessions` SELECT policy).
3. The `coaching_sessions` SELECT policy already calls `user_is_session_nominee`
   and `user_purchased_session`, so updating the function fixes the policy too.
   No policy changes needed — only function bodies change.

## Security
- Functions remain `SECURITY DEFINER`-equivalent (plain functions used in RLS).
- Only adds an additional read path for coachees already explicitly enrolled
  by the coach via `capsule_enrollments`. No write access is granted.
- Existing coach ownership and public/active checks are unchanged.
*/

CREATE OR REPLACE FUNCTION public.coachee_can_access_session(p_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
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
)
OR
EXISTS (
  SELECT 1
  FROM capsule_enrollments ce
  JOIN coaching_sessions cs ON cs.capsule_id = ce.capsule_id
  WHERE cs.id = p_session_id
  AND ce.coachee_email = (
    SELECT email FROM auth.users WHERE id = auth.uid()
  )
);
$$;

CREATE OR REPLACE FUNCTION public.user_is_session_nominee(p_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
SELECT EXISTS (
  SELECT 1 FROM session_nominees sn
  WHERE sn.session_id = p_session_id
  AND sn.coachee_email = (auth.jwt() ->> 'email')
)
OR EXISTS (
  SELECT 1
  FROM capsule_enrollments ce
  JOIN coaching_sessions cs ON cs.capsule_id = ce.capsule_id
  WHERE cs.id = p_session_id
  AND ce.coachee_email = (auth.jwt() ->> 'email')
);
$$;
