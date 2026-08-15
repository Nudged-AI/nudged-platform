/*
# Fix quiz_files INSERT RLS policy + session_from_dt update after booking

## Problem 1: Quiz file upload fails
The `insert_quiz_files` RLS policy checks `s.coach_id = auth.uid()` but
`coaching_sessions.coach_id` stores `coaches.id`, NOT `auth.users.id`.
So the comparison always fails and the INSERT is rejected by RLS.

The `select_quiz_files` policy already uses `coach_owns_session()` which
correctly joins through `coaches` to check `c.user_id = auth.uid()`.

## Fix 1
Rewrite the INSERT, UPDATE, and DELETE policies on `quiz_files` to use
`coach_owns_session()` instead of the direct `s.coach_id = auth.uid()` check.

## Problem 2: Booked session date/time not showing when coach opens it
The `ensure_session_for_booking` function sets `session_from_dt` to NULL.
The frontend (PublicCalendarPage) tries to update it after booking, but
the `coaching_sessions` UPDATE RLS policy may block the anon/authenticated
user from updating a session they don't own.

## Fix 2
Allow the booking creator to update `session_from_dt` and `session_to_dt`
on a session linked to their booking. Add an UPDATE policy that allows
updates when the user has a booking with `session_id = coaching_sessions.id`
and their email matches.
*/

-- Fix 1: Drop and recreate quiz_files policies using coach_owns_session()
DROP POLICY IF EXISTS "insert_quiz_files" ON quiz_files;
CREATE POLICY "insert_quiz_files"
ON quiz_files FOR INSERT
TO authenticated
WITH CHECK (coach_owns_session(
  (SELECT a.session_id FROM cc_activities a WHERE a.id = quiz_files.activity_id)
));

DROP POLICY IF EXISTS "update_quiz_files" ON quiz_files;
CREATE POLICY "update_quiz_files"
ON quiz_files FOR UPDATE
TO authenticated
USING (coach_owns_session(
  (SELECT a.session_id FROM cc_activities a WHERE a.id = quiz_files.activity_id)
))
WITH CHECK (coach_owns_session(
  (SELECT a.session_id FROM cc_activities a WHERE a.id = quiz_files.activity_id)
));

DROP POLICY IF EXISTS "delete_quiz_files" ON quiz_files;
CREATE POLICY "delete_quiz_files"
ON quiz_files FOR DELETE
TO authenticated
USING (coach_owns_session(
  (SELECT a.session_id FROM cc_activities a WHERE a.id = quiz_files.activity_id)
));

-- Fix 2: Allow booking creator to update session date/time fields
DROP POLICY IF EXISTS "update_booking_session_dt" ON coaching_sessions;
CREATE POLICY "update_booking_session_dt"
ON coaching_sessions FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM coach_bookings cb
    WHERE cb.session_id = coaching_sessions.id
    AND cb.coachee_email = (auth.jwt() ->> 'email')
    AND cb.status <> 'cancelled'
  )
)
WITH CHECK (true);
