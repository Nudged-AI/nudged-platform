DROP POLICY IF EXISTS "insert_session_chapters" ON session_chapters;
DROP POLICY IF EXISTS "update_session_chapters" ON session_chapters;
DROP POLICY IF EXISTS "delete_session_chapters" ON session_chapters;
DROP POLICY IF EXISTS "select_session_chapters" ON session_chapters;

CREATE POLICY "insert_session_chapters" ON session_chapters FOR INSERT TO authenticated
  WITH CHECK (coach_owns_session(session_id));

CREATE POLICY "update_session_chapters" ON session_chapters FOR UPDATE TO authenticated
  USING (coach_owns_session(session_id)) WITH CHECK (coach_owns_session(session_id));

CREATE POLICY "delete_session_chapters" ON session_chapters FOR DELETE TO authenticated
  USING (coach_owns_session(session_id));

CREATE POLICY "select_session_chapters" ON session_chapters FOR SELECT TO authenticated
  USING (
    coach_owns_session(session_id)
    OR EXISTS (
      SELECT 1 FROM capsule_enrollments ce
      JOIN coaching_sessions s ON s.capsule_id = ce.capsule_id
      WHERE s.id = session_chapters.session_id
        AND ce.coachee_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );
