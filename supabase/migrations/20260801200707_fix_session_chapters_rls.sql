-- Fix session_chapters RLS: coach_id in coaching_sessions is coaches.id, NOT auth.uid()
-- The old policies compared s.coach_id = auth.uid() which never matches.
-- Use is_coach_for() (SECURITY DEFINER) like coaching_sessions does.

DROP POLICY IF EXISTS select_session_chapters ON session_chapters;
DROP POLICY IF EXISTS insert_session_chapters ON session_chapters;
DROP POLICY IF EXISTS update_session_chapters ON session_chapters;
DROP POLICY IF EXISTS delete_session_chapters ON session_chapters;

CREATE POLICY "select_session_chapters" ON session_chapters FOR SELECT
  TO authenticated USING (
    is_coach_for((SELECT coach_id FROM coaching_sessions WHERE id = session_chapters.session_id))
    OR EXISTS (
      SELECT 1 FROM capsule_enrollments ce
      JOIN coaching_sessions s ON s.capsule_id = ce.capsule_id
      WHERE s.id = session_chapters.session_id
      AND ce.coachee_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "insert_session_chapters" ON session_chapters FOR INSERT
  TO authenticated WITH CHECK (
    is_coach_for((SELECT coach_id FROM coaching_sessions WHERE id = session_chapters.session_id))
  );

CREATE POLICY "update_session_chapters" ON session_chapters FOR UPDATE
  TO authenticated USING (
    is_coach_for((SELECT coach_id FROM coaching_sessions WHERE id = session_chapters.session_id))
  ) WITH CHECK (
    is_coach_for((SELECT coach_id FROM coaching_sessions WHERE id = session_chapters.session_id))
  );

CREATE POLICY "delete_session_chapters" ON session_chapters FOR DELETE
  TO authenticated USING (
    is_coach_for((SELECT coach_id FROM coaching_sessions WHERE id = session_chapters.session_id))
  );
