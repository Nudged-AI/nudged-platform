-- Allow any authenticated user to SELECT session_passkeys so they can verify a passcode during marketplace purchase.
-- (The passkey is a shared secret the coach gives out; RLS should not block verifying it.)
DROP POLICY IF EXISTS "select_session_passkeys" ON session_passkeys;
CREATE POLICY "select_session_passkeys" ON session_passkeys FOR SELECT
  TO authenticated USING (true);
