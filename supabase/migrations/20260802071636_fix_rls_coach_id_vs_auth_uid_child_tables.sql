-- Fix session_notes_files: coach_id column is coaches.id, not auth.uid()
DROP POLICY IF EXISTS "insert_session_notes_files" ON session_notes_files;
DROP POLICY IF EXISTS "update_session_notes_files" ON session_notes_files;
DROP POLICY IF EXISTS "delete_session_notes_files" ON session_notes_files;
DROP POLICY IF EXISTS "select_session_notes_files" ON session_notes_files;

CREATE POLICY "insert_session_notes_files" ON session_notes_files FOR INSERT TO authenticated
  WITH CHECK (coach_owns_session(session_id));

CREATE POLICY "update_session_notes_files" ON session_notes_files FOR UPDATE TO authenticated
  USING (coach_owns_session(session_id)) WITH CHECK (coach_owns_session(session_id));

CREATE POLICY "delete_session_notes_files" ON session_notes_files FOR DELETE TO authenticated
  USING (coach_owns_session(session_id));

CREATE POLICY "select_session_notes_files" ON session_notes_files FOR SELECT TO authenticated
  USING (
    coach_owns_session(session_id)
    OR EXISTS (
      SELECT 1 FROM session_nominees sn
      WHERE sn.session_id = session_notes_files.session_id
        AND sn.coachee_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Fix activity_sets: same wrong pattern
DROP POLICY IF EXISTS "insert_activity_sets" ON activity_sets;
DROP POLICY IF EXISTS "update_activity_sets" ON activity_sets;
DROP POLICY IF EXISTS "delete_activity_sets" ON activity_sets;

CREATE POLICY "insert_activity_sets" ON activity_sets FOR INSERT TO authenticated
  WITH CHECK (coach_owns_session(session_id));

CREATE POLICY "update_activity_sets" ON activity_sets FOR UPDATE TO authenticated
  USING (coach_owns_session(session_id)) WITH CHECK (coach_owns_session(session_id));

CREATE POLICY "delete_activity_sets" ON activity_sets FOR DELETE TO authenticated
  USING (coach_owns_session(session_id));
