-- Replace function-based RLS with inline email/user_id checks
-- Robust against coach_id UUID changes (row deletion/recreation)

-- INSERT policy: user must be an active coach (by email or user_id)
DROP POLICY IF EXISTS insert_coaching_sessions ON coaching_sessions;
CREATE POLICY "insert_coaching_sessions" ON coaching_sessions FOR INSERT
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

-- UPDATE policy: user must be an active coach
DROP POLICY IF EXISTS update_coaching_sessions ON coaching_sessions;
CREATE POLICY "update_coaching_sessions" ON coaching_sessions FOR UPDATE
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

-- DELETE policy: same check
DROP POLICY IF EXISTS delete_coaching_sessions ON coaching_sessions;
CREATE POLICY "delete_coaching_sessions" ON coaching_sessions FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM coaches c
      WHERE c.is_active = true
      AND (
        c.user_id = auth.uid()
        OR c.email = (auth.jwt() ->> 'email')
      )
    )
  );

-- Use a fixed UUID for deepagster's coach row so it survives recreation
DELETE FROM coaches WHERE email = 'deepagster@gmail.com';
INSERT INTO coaches (id, email, user_id, coach_name, coach_type, coach_niche, is_active)
VALUES ('aeb83563-96d3-4d4a-85b6-fb26f79eb2f6', 'deepagster@gmail.com', 'aeb83563-96d3-4d4a-85b6-fb26f79eb2f6', 'Deepa Agster', 'Admin', 'Admin', true)
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, user_id = EXCLUDED.user_id, is_active = true;
