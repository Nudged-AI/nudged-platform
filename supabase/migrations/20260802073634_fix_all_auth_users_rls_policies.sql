
-- Fix quiz_files SELECT policy to use JWT email instead of auth.users
DROP POLICY IF EXISTS "select_quiz_files" ON quiz_files;
CREATE POLICY "select_quiz_files" ON quiz_files FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cc_activities a
      JOIN coaching_sessions s ON s.id = a.session_id
      WHERE a.id = quiz_files.activity_id
        AND coach_owns_session(s.id)
    )
    OR EXISTS (
      SELECT 1 FROM cc_activities a
      JOIN coaching_sessions s ON s.id = a.session_id
      JOIN session_nominees sn ON sn.session_id = s.id
      WHERE a.id = quiz_files.activity_id
        AND sn.coachee_email = (auth.jwt() ->> 'email')
    )
  );

-- Fix admin_controls policies
DROP POLICY IF EXISTS "admin_write_controls" ON admin_controls;
CREATE POLICY "admin_write_controls" ON admin_controls FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email') = 'deepagster@gmail.com');

DROP POLICY IF EXISTS "admin_update_controls" ON admin_controls;
CREATE POLICY "admin_update_controls" ON admin_controls FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'email') = 'deepagster@gmail.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'deepagster@gmail.com');

-- Fix banned_users policies
DROP POLICY IF EXISTS "admin_write_banned" ON banned_users;
CREATE POLICY "admin_write_banned" ON banned_users FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email') = 'deepagster@gmail.com');

DROP POLICY IF EXISTS "admin_delete_banned" ON banned_users;
CREATE POLICY "admin_delete_banned" ON banned_users FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'email') = 'deepagster@gmail.com');

-- Fix credit_extension_requests policies
DROP POLICY IF EXISTS "select_own_requests" ON credit_extension_requests;
CREATE POLICY "select_own_requests" ON credit_extension_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com');

DROP POLICY IF EXISTS "admin_update_requests" ON credit_extension_requests;
CREATE POLICY "admin_update_requests" ON credit_extension_requests FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'email') = 'deepagster@gmail.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'deepagster@gmail.com');
