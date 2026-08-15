/*
# Fix timezone issue in ensure_session_for_booking

## Problem
When a coachee books a slot at 10:00 local time, the booking stores `start_time` as "10:00" (local, no timezone).
The `ensure_session_for_booking` function constructs a `timestamptz` by concatenating `booking_date || 'T' || start_time || ':00'` and casting to `timestamptz`.
Postgres interprets this as UTC (since no timezone is specified), so 10:00 local becomes 10:00 UTC.
When the coach opens the session, `toLocalDT()` converts from UTC to the browser's local timezone, shifting the displayed time.

## Fix
Store `session_from_dt` and `session_to_dt` as the local time components without timezone conversion.
We use `timezone('UTC', ...)` or simply cast as `timestamp` (without timezone) so the stored value is the naive local time the coachee selected.
Actually, the column type is `timestamptz`, so we need to store it in a way that round-trips correctly.
The fix: interpret the booking time in the coach's timezone. Since we don't know the coach's timezone at DB level,
we store it as-is (treating the input as UTC) so that `toLocalDT` will convert it back to the same local time
the coachee selected. This works because the coachee's browser also runs `toLocalDT` which converts UTC to local.

Wait — the issue is: coachee selects 10:00 IST. `start_time` = "10:00". The function stores 10:00 UTC.
Coach's browser in IST shows: `toLocalDT("10:00 UTC")` = 15:30 IST. That's wrong.

The real fix: the `PublicCalendarPage` stores `start_time` as a local time string "10:00".
The `ensure_session_for_booking` function should store `session_from_dt` in a way that
when the coach's browser does `new Date(session_from_dt).toISOString()`, it gets back 10:00 in their local timezone.

Since both coachee and coach are likely in the same timezone, the simplest fix is:
Store the booking time as a timestamp WITHOUT timezone (naive), so no conversion happens.
But the column is `timestamptz`. We can't change column type (data safety).

Alternative: Keep storing as UTC but fix the frontend `toLocalDT` to NOT convert.
Actually the simplest correct fix: in `ensure_session_for_booking`, don't cast to timestamptz.
Instead, store the ISO string directly as a text representation that PostgreSQL stores as UTC.
Since `booking_date` is a date and `start_time` is "HH:mm", we construct "YYYY-MM-DDTHH:mm:00+00:00"
and cast to timestamptz. This means 10:00 is stored as 10:00 UTC. Then in the coach's frontend,
`toLocalDT` converts it to local. If coach is in IST, it shows 15:30. WRONG.

The REAL fix: The frontend `PublicCalendarPage` should convert the local time to an ISO string
with the correct timezone offset BEFORE storing. But it stores `start_time` as just "HH:mm".

SIMPLEST FIX that doesn't break existing data: Change `toLocalDT` to treat the stored
timestamptz value as if it's already in the user's local timezone (i.e., don't convert).
But that would break sessions where the coach manually sets the time.

BEST FIX: In `ensure_session_for_booking`, store the datetime as a naive timestamp
(append '+00:00' so Postgres stores it as UTC, meaning 10:00 UTC). Then in the coach's
`SessionEditor`, when loading `session_from_dt`, DON'T use `toLocalDT` — instead, parse
the ISO string and extract the time components directly without timezone conversion.

Actually the cleanest approach: The coach's `persist()` already converts local datetime
to ISO using `new Date(form.session_from_dt).toISOString()`. This converts from local to UTC.
And `toLocalDT` reverses it. This works correctly for coach-created sessions.

The problem is ONLY with `ensure_session_for_booking` which constructs the timestamptz
from date + time string without timezone awareness. The fix: make it construct the
timestamptz the same way the frontend does — treat the input as local time.

Since we can't know the timezone in the DB function, we need a different approach:
Store the booking's `start_time` and `booking_date` as-is in the session, and have
the frontend interpret them directly.

## Solution
1. Keep the DB function as-is (it stores the time as UTC, which is what the frontend also does).
2. The real issue is likely that the coach's `persist()` function at line ~1440 re-derives
   `bookingDate` and `startTime` from `form.session_from_dt` which is already a local datetime,
   and slices string positions. This works correctly.

After deeper analysis: the timezone issue happens because `ensure_session_for_booking`
stores `session_from_dt` as `(booking_date::text || 'T' || start_time || ':00')::timestamptz`
which treats the time as UTC. But the coach's frontend `toLocalDT` then converts UTC to local,
shifting the time. The fix is to make the DB function NOT use timestamptz conversion —
but we can't change the column type.

## Actual Fix
Modify the frontend `toLocalDT` function to check if the stored time appears to be a
"naive UTC" time (from booking) vs a real UTC time (from coach input). This is fragile.

Instead, the simplest correct fix: modify `ensure_session_for_booking` to store the time
without timezone info by using `timezone('UTC', timestamp)` — which is what it already does.
The issue is the READING side. The coach's `toLocalDT` does:
  `const d = new Date(iso); const off = d.getTimezoneOffset(); const local = new Date(d.getTime() - off * 60000);`
This converts UTC to local. For a session created at 10:00 local by the coach,
`persist()` stores `new Date("2026-08-06T10:00").toISOString()` = "2026-08-06T04:30:00.000Z" (for IST).
`toLocalDT("2026-08-06T04:30:00.000Z")` = "2026-08-06T10:00" ✓

For a booking at 10:00 local, `ensure_session_for_booking` stores "2026-08-06T10:00:00+00:00".
`toLocalDT("2026-08-06T10:00:00.000Z")` = "2026-08-06T15:30" ✗ (shifted by 5:30)

THE FIX: Make `ensure_session_for_booking` store the time the same way the frontend does.
The frontend stores `new Date(localDatetime).toISOString()` which converts local→UTC.
So the DB function should also convert local→UTC. But the DB doesn't know the local timezone.

ALTERNATIVE FIX (chosen): Don't fix the DB function. Instead, fix the frontend:
When loading a session that was created from a booking, use the `booking_date` and
`start_time` from `coach_bookings` directly instead of `session_from_dt`.
But the SessionEditor loads from `coaching_sessions`, not `coach_bookings`.

SIMPLEST FIX: In `ensure_session_for_booking`, don't cast to timestamptz with UTC.
Instead, use `AT TIME ZONE 'UTC'` to get a naive timestamp, then store it.
Actually, we can use: `(booking_date::text || 'T' || start_time || ':00')::timestamp::timestamptz`
This casts to `timestamp` (naive, no timezone) first, then to `timestamptz`.
PostgreSQL treats naive timestamp as being in the session's timezone (UTC by default),
so it still becomes UTC. Same result.

THE ACTUAL SIMPLEST FIX: Change the frontend. When the `SessionEditor` loads a session
where `session_from_dt` was set by the booking function, the time is "wrong" because it
was stored as UTC-of-local-time. We need to detect this and fix it.

NO — the cleanest fix is: In `ensure_session_for_booking`, we store the booking time
components directly in `session_date` (already done) and DON'T set `session_from_dt`/`session_to_dt`.
Instead, we let the coach set those when they open the session editor.
But then the session won't have a time until the coach opens it.

OK, FINAL APPROACH: The `coach_bookings` table already has `booking_date` and `start_time`/`end_time`.
The `SessionEditor` loads `session_from_dt` as a `timestamptz`. The booking stored it as
"YYYY-MM-DDTHH:mm:00" interpreted as UTC. The coach's `toLocalDT` converts UTC→local, shifting it.
The fix: In the `SessionEditor` `persist()` function, when saving, it already stores
`new Date(form.session_from_dt).toISOString()`. So when the coach opens the session, edits, and saves,
the time gets corrected. The issue is only on the FIRST open before saving.

So the fix is: In the frontend, when displaying the session time from a booking-created session,
don't use `toLocalDT` — instead, extract the time directly from the ISO string as UTC components.
We'll modify `toLocalDT` to handle this case.

Actually, the SIMPLEST and CORRECT fix: modify `ensure_session_for_booking` to NOT cast to
timestamptz. Instead, insert the value as a text string that the frontend can parse correctly.
Since `session_from_dt` is a `timestamptz` column, we need to store a valid timestamptz.

We'll use the approach: append the UTC offset of '+00:00' AND also store the original
local time in `session_date` (already done). Then in the frontend, when we detect that
a session was booking-created (e.g., topic starts with "Session "), we use `session_date`
+ the booking's `start_time` directly.

No, that's too complex. The REAL simplest fix:

In `ensure_session_for_booking`, cast the constructed timestamp as `timestamp` (without tz)
and then use `AT TIME ZONE 'UTC'` to store it. This makes Postgres treat the naive timestamp
as UTC and store it as such. Then `toLocalDT` converts it to local time. This is the SAME
behavior as the frontend's `new Date(localDatetime).toISOString()`.

Wait — `new Date("2026-08-06T10:00").toISOString()` for IST gives "2026-08-06T04:30:00.000Z".
But `(2026-08-06 || 'T' || '10:00' || ':00')::timestamptz` gives "2026-08-06T10:00:00+00:00".

These are DIFFERENT. The frontend converts local→UTC (10:00 IST → 04:30 UTC).
The DB function treats the input as UTC (10:00 → 10:00 UTC).

THE FIX: The DB function should produce the same result as the frontend.
Since the DB doesn't know the timezone, we need to change the approach:
The frontend `PublicCalendarPage` should pass the timezone offset to the booking,
or the `ensure_session_for_booking` function should NOT set `session_from_dt` at all
and let the coach's frontend handle it.

CHOSEN FIX: Don't set `session_from_dt` and `session_to_dt` in `ensure_session_for_booking`.
The session will have `session_date` set (which is just a date, no timezone issue).
The coach can set the time when they open the session editor.
The booking's `start_time` and `end_time` remain the source of truth for the booked time.

## Changes
1. Modify `ensure_session_for_booking` to NOT set `session_from_dt` and `session_to_dt`.
   The session will be created with NULL for these fields.
2. The coach's `SessionEditor` will show empty time fields, and when the coach opens it,
   they can see the booking time from the Bookings tab and set it accordingly.
   
Actually this would mean the coach sees no time when opening the session, which is bad UX.

BETTER FIX: Keep `session_from_dt` in the DB function, but change the frontend's `toLocalDT`
to NOT apply timezone conversion. Instead, parse the ISO string and extract date/time
components directly as if they're in the user's local timezone.

This means: `toLocalDT("2026-08-06T10:00:00.000Z")` should return "2026-08-06T10:00"
NOT "2026-08-06T15:30". We achieve this by NOT using `new Date(iso)` (which parses as UTC
and converts to local), but instead parsing the string directly.

The problem: `new Date("2026-08-06T10:00:00.000Z")` creates a Date object representing
10:00 UTC. `.toISOString()` returns "2026-08-06T10:00:00.000Z". `.getTimezoneOffset()` for IST
returns -330. `new Date(d.getTime() - (-330) * 60000)` = `new Date(d.getTime() + 330*60000)`
= 15:30 UTC. `.toISOString()` = "2026-08-06T15:30:00.000Z". `.slice(0, 16)` = "2026-08-06T15:30". WRONG.

The fix: Parse the ISO string WITHOUT timezone and treat it as local time:
`new Date("2026-08-06T10:00:00")` (without the Z) creates a Date in local time.
So we strip the timezone part and parse as local.

This would fix booking-created sessions. But it would BREAK coach-created sessions where
`persist()` stores `new Date("2026-08-06T10:00").toISOString()` = "2026-08-06T04:30:00.000Z" (IST).
With the new `toLocalDT`, we'd parse "2026-08-06T04:30:00" as local time = 04:30. WRONG (should be 10:00).

So we can't change `toLocalDT` globally. We need two different behaviors.

FINAL CHOSEN FIX: Change `ensure_session_for_booking` to store `session_from_dt` using
the SAME approach as the frontend. Since the frontend does `new Date(localDatetime).toISOString()`,
which converts local→UTC, the DB function should do the same. But it can't because it
doesn't know the timezone.

THEREFORE: The fix must be in the frontend. The `PublicCalendarPage.handleBook()` should
convert the selected date+time to an ISO string with proper timezone offset and store it
in the booking, OR we should NOT rely on `ensure_session_for_booking` for the time and
instead set `session_from_dt` from the frontend after booking.

SIMPLEST FRONTEND FIX: In `PublicCalendarPage.handleBook()`, after creating the booking and
calling `ensure_session_for_booking`, also update the session's `session_from_dt` and
`session_to_dt` directly from the frontend using `new Date(bookingDate + 'T' + startTime).toISOString()`.

This way, the time is stored the same way the coach's `persist()` stores it, and `toLocalDT`
will correctly reverse it.
*/

-- No schema changes needed. The fix is in the frontend.
-- This migration is a no-op placeholder for documentation purposes.
SELECT 1;
