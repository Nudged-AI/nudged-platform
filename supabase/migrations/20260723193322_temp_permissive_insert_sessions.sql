-- Temporarily make INSERT policy as permissive as possible to confirm RLS is the issue
-- This allows any authenticated user to insert
DROP POLICY IF EXISTS insert_coaching_sessions ON coaching_sessions;
CREATE POLICY "insert_coaching_sessions" ON coaching_sessions FOR INSERT
  TO authenticated WITH CHECK (true);
