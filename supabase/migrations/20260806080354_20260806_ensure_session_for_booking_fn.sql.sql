/*
# Create ensure_session_for_booking function

## Problem
When a coachee books via the public calendar, there are no coaching_sessions
rows in the capsule — the coach hasn't created sessions yet. The booking is
saved to coach_bookings with session_id = null. As a result:
1. Coachee Sessions tab shows nothing (it only reads coaching_sessions)
2. Coach Bookings edit pencil doesn't show (requires session_id)

## Solution
A SECURITY DEFINER function that:
- Given a booking_id, looks up the coach_bookings row
- If session_id is already set, returns it
- Otherwise creates a new coaching_sessions row with the booking's date/time
  then links coach_bookings.session_id → the new session
- Returns the session_id so the client can navigate to it

The function runs as the db owner, bypassing RLS, so the anon/coachee
can call it without needing UPDATE on coaching_sessions or INSERT privileges.
*/

CREATE OR REPLACE FUNCTION public.ensure_session_for_booking(
  p_booking_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_booking     coach_bookings%ROWTYPE;
  v_capsule     capsules%ROWTYPE;
  v_session_id  uuid;
  v_session_num int;
  v_from_dt     timestamptz;
  v_to_dt       timestamptz;
BEGIN
  SELECT * INTO v_booking FROM coach_bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- If already linked, just return existing session
  IF v_booking.session_id IS NOT NULL THEN
    RETURN v_booking.session_id;
  END IF;

  -- Need a capsule_id to create a session
  IF v_booking.capsule_id IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO v_capsule FROM capsules WHERE id = v_booking.capsule_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Compute next session number
  SELECT COALESCE(MAX(session_number), 0) + 1
    INTO v_session_num
    FROM coaching_sessions
   WHERE capsule_id = v_booking.capsule_id;

  -- Build timestamps
  v_from_dt := (v_booking.booking_date::text || 'T' || v_booking.start_time || ':00')::timestamptz;
  v_to_dt   := CASE 
    WHEN v_booking.end_time IS NULL OR v_booking.end_time = '' THEN NULL
    ELSE (v_booking.booking_date::text || 'T' || v_booking.end_time || ':00')::timestamptz
  END;

  -- Insert new coaching_sessions row
  INSERT INTO coaching_sessions (
    capsule_id, coach_id, topic,
    session_number, session_date, session_from_dt, session_to_dt,
    status, is_public, is_active, is_submitted,
    goals, decks, session_notes, summary, capsule_type
  ) VALUES (
    v_booking.capsule_id,
    (SELECT user_id FROM coaches WHERE id = v_capsule.coach_id),
    COALESCE('Session ' || v_session_num, 'Coaching Session'),
    v_session_num,
    v_booking.booking_date,
    v_from_dt,
    v_to_dt,
    'Scheduled',
    false, true, false,
    '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, '[]'::jsonb,
    v_capsule.capsule_type
  )
  RETURNING id INTO v_session_id;

  -- Link the booking to the new session
  UPDATE coach_bookings
     SET session_id = v_session_id,
         is_standalone = false
   WHERE id = p_booking_id;

  RETURN v_session_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_session_for_booking TO anon, authenticated;
