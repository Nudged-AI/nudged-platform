/*
# Allow capsule-enrolled coachees to read their capsules

## Problem
The capsules SELECT policy only allowed public/active capsules or the owning
coach. Coachees enrolled in a private Coaching capsule could not read the
capsule row, so the coachee view could not resolve capsule names and the
capsules appeared missing.

## Changes
- Recreate the `select_capsules` policy to additionally allow any authenticated
  user whose email appears in `capsule_enrollments` for that capsule.
- No other policies are touched. Coachees still cannot insert/update/delete
  capsules; only the owning coach can.

## Security
- Adds a read-only path for coachees explicitly enrolled by the coach via
  `capsule_enrollments`. No write access is granted.
*/

DROP POLICY IF EXISTS "select_capsules" ON capsules;
CREATE POLICY "select_capsules"
ON capsules FOR SELECT
TO authenticated
USING (
  (is_public AND is_active)
  OR is_coach_for(coach_id)
  OR EXISTS (
    SELECT 1 FROM capsule_enrollments ce
    WHERE ce.capsule_id = capsules.id
    AND ce.coachee_email = (auth.jwt() ->> 'email')
  )
);
