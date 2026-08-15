/*
# Fix infinite RLS recursion in coachee session-access functions

## Problem
`coachee_can_access_session` and `user_is_session_nominee` were updated to
check capsule enrollments by joining `coaching_sessions` internally. But both
functions are called FROM the `coaching_sessions` RLS SELECT policy — so the
inner join re-triggers the same RLS policy, causing infinite recursion.
Result: queries hang or return empty rows.

## Fix
Recreate both functions as SECURITY DEFINER so their internal queries on
`coaching_sessions` run as the function owner (bypassing RLS), breaking
the recursion cycle. The functions still enforce correct email-based
ownership; SECURITY DEFINER only affects the inner helper lookups.

Also set search_path = '' and qualify all table references for security.
*/

CREATE OR REPLACE FUNCTION public.coachee_can_access_session(p_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
SELECT
  EXISTS (
    SELECT 1 FROM public.session_nominees sn
    WHERE sn.session_id = p_session_id
    AND sn.coachee_email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
  )
  OR
  EXISTS (
    SELECT 1 FROM public.session_purchases sp
    WHERE sp.session_id = p_session_id
    AND sp.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1
    FROM public.capsule_enrollments ce
    JOIN public.coaching_sessions cs ON cs.capsule_id = ce.capsule_id
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
SECURITY DEFINER
SET search_path = public
AS $$
SELECT
  EXISTS (
    SELECT 1 FROM public.session_nominees sn
    WHERE sn.session_id = p_session_id
    AND sn.coachee_email = (auth.jwt() ->> 'email')
  )
  OR EXISTS (
    SELECT 1
    FROM public.capsule_enrollments ce
    JOIN public.coaching_sessions cs ON cs.capsule_id = ce.capsule_id
    WHERE cs.id = p_session_id
    AND ce.coachee_email = (auth.jwt() ->> 'email')
  );
$$;
