-- Fix insert/update/delete on coaching_sessions to match coach by email too
DROP POLICY IF EXISTS insert_coaching_sessions ON coaching_sessions;
CREATE POLICY insert_coaching_sessions ON coaching_sessions FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM coaches c
      WHERE c.id = coaching_sessions.coach_id
        AND (c.user_id = auth.uid() OR c.email = (auth.jwt() ->> 'email') OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com')
    )
  );

DROP POLICY IF EXISTS update_coaching_sessions ON coaching_sessions;
CREATE POLICY update_coaching_sessions ON coaching_sessions FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM coaches c
      WHERE c.id = coaching_sessions.coach_id
        AND (c.user_id = auth.uid() OR c.email = (auth.jwt() ->> 'email') OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com')
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM coaches c
      WHERE c.id = coaching_sessions.coach_id
        AND (c.user_id = auth.uid() OR c.email = (auth.jwt() ->> 'email') OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com')
    )
  );

DROP POLICY IF EXISTS delete_coaching_sessions ON coaching_sessions;
CREATE POLICY delete_coaching_sessions ON coaching_sessions FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM coaches c
      WHERE c.id = coaching_sessions.coach_id
        AND (c.user_id = auth.uid() OR c.email = (auth.jwt() ->> 'email') OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com')
    )
  );

-- Backfill coaches.user_id from auth.users where still null, so future lookups work
UPDATE coaches c SET user_id = au.id
FROM auth.users au
WHERE au.email = c.email AND c.user_id IS NULL;
