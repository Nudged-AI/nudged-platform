/*
# Fix activity_completions for times_per_day > 1 and add self-assessment fields

1. Drop the unique constraint that blocks multiple completions per item per day
   (needed when times_per_day > 1 — e.g. watch twice daily)
2. Add a `completion_seq` integer to distinguish 1st, 2nd… completion within the same day
3. Add `what_went_well` and `to_be_focused` text columns for coachee self-assessment
4. Re-create unique constraint including completion_seq
*/

ALTER TABLE activity_completions
  ADD COLUMN IF NOT EXISTS completion_seq   integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS what_went_well  text,
  ADD COLUMN IF NOT EXISTS to_be_focused   text;

-- Drop old unique constraint (name may vary — drop by definition)
DO $$
DECLARE
  con_name text;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'activity_completions'::regclass
    AND contype = 'u';
  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE activity_completions DROP CONSTRAINT %I', con_name);
  END IF;
END $$;

-- New unique constraint includes completion_seq so each sequence slot is distinct
ALTER TABLE activity_completions
  ADD CONSTRAINT activity_completions_unique
  UNIQUE (session_id, user_id, activity_type, item_id, completed_date, completion_seq);
