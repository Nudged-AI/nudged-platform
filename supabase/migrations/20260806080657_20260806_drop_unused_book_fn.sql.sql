/*
# Drop unused book_coaching_session function

The ensure_session_for_booking function supersedes book_coaching_session.
The latter was created earlier but is no longer called from the frontend.
*/

DROP FUNCTION IF EXISTS public.book_coaching_session(uuid, date, text, text);
