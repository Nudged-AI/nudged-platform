-- Fix capsules INSERT policy: don't require exact coach_id match
-- Just verify user is an active coach (by email or user_id)
DROP POLICY IF EXISTS insert_capsules ON capsules;
CREATE POLICY "insert_capsules" ON capsules FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM coaches c
      WHERE c.is_active = true
      AND (
        c.user_id = auth.uid()
        OR c.email = (auth.jwt() ->> 'email')
      )
    )
  );

-- UPDATE policy: same relaxed check
DROP POLICY IF EXISTS update_capsules ON capsules;
CREATE POLICY "update_capsules" ON capsules FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM coaches c
      WHERE c.is_active = true
      AND (
        c.user_id = auth.uid()
        OR c.email = (auth.jwt() ->> 'email')
      )
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM coaches c
      WHERE c.is_active = true
      AND (
        c.user_id = auth.uid()
        OR c.email = (auth.jwt() ->> 'email')
      )
    )
  );
