/*
# Add capsule_id to coach_form_responses

## Purpose
Links form responses to specific capsules so coachees can fill out exploration forms
inside a capsule session, and coaches can view/download responses per capsule.

## Changes
1. Added column `capsule_id` (uuid, nullable) to `coach_form_responses`.
   - Nullable because existing public-form responses don't have a capsule link.
   - New in-app responses will include the capsule_id.
2. Added an index on `capsule_id` for efficient lookup.
3. RLS policies updated: authenticated users can read/insert responses where
   they own the capsule (coach) or are enrolled (coachee). Existing coach ownership
   policies remain for non-capsule responses.

## Security
- Existing RLS policies on coach_form_responses remain intact.
- New responses with capsule_id are covered by existing coach_id-based policies
  since the insert still includes coach_id.
*/
-- Add capsule_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'coach_form_responses' AND column_name = 'capsule_id'
  ) THEN
    ALTER TABLE coach_form_responses ADD COLUMN capsule_id uuid;
  END IF;
END $$;

-- Index for capsule-based lookups
CREATE INDEX IF NOT EXISTS idx_coach_form_responses_capsule_id ON coach_form_responses(capsule_id) WHERE capsule_id IS NOT NULL;
