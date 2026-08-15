-- Restore proper RLS on coaching_sessions INSERT
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