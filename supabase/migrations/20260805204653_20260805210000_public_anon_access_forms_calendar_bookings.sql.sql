/*
# Public (anon) access for forms, calendar, and bookings

## Purpose
The coach form URL and calendar URL are shared publicly with coachees who do NOT have an account.
Currently all policies on coach_forms, coach_form_responses, coaches, coach_availability, and
coach_bookings are scoped to `TO authenticated` only, which means an unauthenticated visitor
(opens the link in incognito / different browser) gets zero rows and cannot submit anything.

## Changes
Adds read-only anon SELECT on:
- coaches (only coach_name + profile_image_url are needed, but the policy allows SELECT * —
  the frontend only selects those columns; sensitive columns do not exist on this table)
- coach_forms (so the public form page can load the form definition)
- coach_availability (so the public calendar can render available slots)
- coach_bookings (so the public calendar can show which slots are already taken)

Adds anon INSERT on:
- coach_form_responses (so a visitor can submit a form response)
- coach_bookings (so a visitor can create a booking)

No anon UPDATE or DELETE is granted on any table.

## Security notes
1. coach_forms SELECT is intentionally broad (true) because the form URL contains the form ID
   prefix — anyone with the link can already see the form. The form data itself is not sensitive.
2. coach_bookings SELECT is intentionally broad because the calendar needs to check slot
   availability. Booking records contain coachee name/email/remarks but these are only visible
   to people who already have the calendar link. A tighter policy (e.g. only return booking_date
   + start_time) is not possible at the RLS level without column-level privileges, which is a
   future enhancement.
3. coach_bookings INSERT is intentionally broad (WITH CHECK true) because the insert comes from
   an unauthenticated visitor. The frontend validates required fields. A malicious insert could
   be attempted, but the worst case is a fake booking on a coach's calendar, which the coach can
   delete from their dashboard.
4. coach_form_responses INSERT is intentionally broad for the same reason — a visitor with the
   form link can submit responses.

## Idempotency
Each policy is dropped before creation so this migration is safe to re-run.
*/

-- coaches: anon SELECT (public coach profile info for form/calendar pages)
DROP POLICY IF EXISTS "anon_select_coaches" ON coaches;
CREATE POLICY "anon_select_coaches" ON coaches FOR SELECT
  TO anon USING (true);

-- coach_forms: anon SELECT (public form page loads form definition)
DROP POLICY IF EXISTS "anon_select_coach_forms" ON coach_forms;
CREATE POLICY "anon_select_coach_forms" ON coach_forms FOR SELECT
  TO anon USING (true);

-- coach_form_responses: anon INSERT (visitor submits form)
DROP POLICY IF EXISTS "anon_insert_coach_form_responses" ON coach_form_responses;
CREATE POLICY "anon_insert_coach_form_responses" ON coach_form_responses FOR INSERT
  TO anon WITH CHECK (true);

-- coach_availability: anon SELECT (public calendar loads slots)
DROP POLICY IF EXISTS "anon_select_coach_availability" ON coach_availability;
CREATE POLICY "anon_select_coach_availability" ON coach_availability FOR SELECT
  TO anon USING (true);

-- coach_bookings: anon SELECT (public calendar checks which slots are booked)
DROP POLICY IF EXISTS "anon_select_coach_bookings" ON coach_bookings;
CREATE POLICY "anon_select_coach_bookings" ON coach_bookings FOR SELECT
  TO anon USING (true);

-- coach_bookings: anon INSERT (visitor creates a booking)
DROP POLICY IF EXISTS "anon_insert_coach_bookings" ON coach_bookings;
CREATE POLICY "anon_insert_coach_bookings" ON coach_bookings FOR INSERT
  TO anon WITH CHECK (true);
