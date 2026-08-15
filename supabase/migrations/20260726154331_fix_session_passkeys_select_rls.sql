-- Allow authenticated users to verify passkeys for public sessions (for marketplace purchase)
DROP POLICY IF EXISTS select_session_passkeys ON session_passkeys;
CREATE POLICY "select_session_passkeys" ON session_passkeys FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM coaching_sessions s
      JOIN capsules c ON c.id = s.capsule_id
      WHERE s.id = session_passkeys.session_id
      AND s.is_public = true AND s.is_submitted = true AND c.is_public = true
    )
  );