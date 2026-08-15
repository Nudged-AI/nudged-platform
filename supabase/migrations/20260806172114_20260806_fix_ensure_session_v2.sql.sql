/*
# Fix: ensure_session_for_booking — correct INSERT column/value mismatch + remove timezone drift

## Problem
The previous migration had 17 columns in the INSERT but only 16 values (missing `v_session_num`).
This caused a PostgreSQL error, so no session was created for any booking.

## Fix
1. Correct the INSERT to include `v_session_num` for the `session_number` column.
2. Set `session_from_dt` and `session_to_dt` to NULL — the coach sets the time when they open
   the session editor. The booking's date and time are preserved in `coach_bookings` and `session_date`.
   This avoids the timezone drift issue entirely (no UTC interpretation of local time).

## Changes
- Recreate `ensure_session_for_booking` with the correct INSERT statement.
*/

CREATE OR REPLACE FUNCTION public.ensure_session_for_booking(p_booking_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_booking     coach_bookings%ROWTYPE;
  v_capsule     capsules%ROWTYPE;
  v_session_id  uuid;
  v_session_num int;
  v_uid         text;
BEGIN
  SELECT * INTO v_booking FROM coach_bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- If booking already has a session_id and that session still exists, return it
  IF v_booking.session_id IS NOT NULL THEN
    PERFORM 1 FROM coaching_sessions WHERE id = v_booking.session_id;
    IF FOUND THEN RETURN v_booking.session_id; END IF;
  END IF;

  -- Need a capsule to create a session
  IF v_booking.capsule_id IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO v_capsule FROM capsules WHERE id = v_booking.capsule_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Next session number for this capsule
  SELECT COALESCE(MAX(session_number), 0) + 1
  INTO v_session_num
  FROM coaching_sessions
  WHERE capsule_id = v_booking.capsule_id;

  v_uid := 'SESS-' || v_booking.capsule_id::text || '-' || v_session_num || '-' || extract(epoch from now())::int;

  INSERT INTO coaching_sessions (
    capsule_id, coach_id, session_uid, topic,
    session_number, session_date, session_from_dt, session_to_dt,
    status, is_public, is_active, is_submitted,
    goals, decks, session_notes, summary, capsule_type
  ) VALUES (
    v_booking.capsule_id,
    v_capsule.coach_id,
    v_uid,
    'Session ' || v_session_num,
    v_session_num,
    v_booking.booking_date,
    NULL,
    NULL,
    'Scheduled',
    false, true, false,
    '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, ARRAY[]::text[], v_capsule.capsule_type
  )
  RETURNING id INTO v_session_id;

  UPDATE coach_bookings
  SET session_id = v_session_id,
      is_standalone = false
  WHERE id = p_booking_id;

  RETURN v_session_id;
END;
$function$;
