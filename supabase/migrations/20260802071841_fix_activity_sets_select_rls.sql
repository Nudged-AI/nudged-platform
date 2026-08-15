DROP POLICY IF EXISTS "select_activity_sets" ON activity_sets;
CREATE POLICY "select_activity_sets" ON activity_sets FOR SELECT TO authenticated
  USING (
    coach_owns_session(session_id)
    OR EXISTS (
      SELECT 1 FROM session_nominees sn
      WHERE sn.session_id = activity_sets.session_id
        AND sn.coachee_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );
