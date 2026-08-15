-- Fix INSERT policy on capsules to also match by email
DROP POLICY IF EXISTS insert_capsules ON capsules;
CREATE POLICY insert_capsules ON capsules FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM coaches c
      WHERE c.id = capsules.coach_id
        AND (c.user_id = auth.uid() OR c.email = (auth.jwt() ->> 'email'))
    )
  );
