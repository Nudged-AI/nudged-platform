-- Fix session_passkeys RLS to also check coach email (matching coaching_sessions pattern)
DROP POLICY IF EXISTS "insert_session_passkeys" ON session_passkeys;
CREATE POLICY "insert_session_passkeys" ON session_passkeys FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM coaching_sessions s
      JOIN coaches c ON c.id = s.coach_id
      WHERE s.id = session_passkeys.session_id
      AND (c.user_id = auth.uid() OR c.email = (auth.jwt() ->> 'email') OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com')
    )
  );

DROP POLICY IF EXISTS "delete_session_passkeys" ON session_passkeys;
CREATE POLICY "delete_session_passkeys" ON session_passkeys FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM coaching_sessions s
      JOIN coaches c ON c.id = s.coach_id
      WHERE s.id = session_passkeys.session_id
      AND (c.user_id = auth.uid() OR c.email = (auth.jwt() ->> 'email') OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com')
    )
  );
