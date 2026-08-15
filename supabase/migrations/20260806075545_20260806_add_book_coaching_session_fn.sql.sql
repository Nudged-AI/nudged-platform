/*
# Allow anon to update coaching_sessions booking info via SECURITY DEFINER function

## Problem
When a coachee books a session from the public calendar (no auth), the app
needs to update the `coaching_sessions` row with the booking date/time and
set status to 'Scheduled'. The RLS UPDATE policy only allows authenticated
coaches, so the anon-key update silently fails — booked sessions never get
their date/time updated and don't appear in the coachee's or coach's session
lists properly.

## Solution
Create a SECURITY DEFINER function `book_coaching_session` that:
- Accepts session_id, booking_date, start_time, end_time
- Updates only session_date, session_from_dt, session_to_dt, and status
- Is callable by anon (the public booking form uses the anon key)
- Only updates the specified columns — no other fields can be touched

## Security
- The function is SECURITY DEFINER, running with the owner's privileges
- It only updates booking-related columns (date, time, status)
- It does NOT allow changing coach_id, capsule_id, or any other field
- EXECUTE granted to anon and authenticated
- Search path set to 'public' for security
*/

CREATE OR REPLACE FUNCTION public.book_coaching_session(
  p_session_id uuid,
  p_booking_date date,
  p_start_time text,
  p_end_time text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE coaching_sessions
  SET
    session_date = p_booking_date,
    session_from_dt = (p_booking_date::text || 'T' || p_start_time || ':00')::timestamptz,
    session_to_dt = CASE WHEN p_end_time IS NULL OR p_end_time = '' THEN NULL
                         ELSE (p_booking_date::text || 'T' || p_end_time || ':00')::timestamptz END,
    status = 'Scheduled',
    updated_at = now()
  WHERE id = p_session_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.book_coaching_session TO anon, authenticated;
