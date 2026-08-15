/*
# Admin read policies for feedback and login events
Allows the admin user (identified by email) to read all feedback and login event rows.
Uses a subquery on auth.users to check the requesting user's email.
*/

DROP POLICY IF EXISTS "admin_select_feedback" ON app_feedback;
CREATE POLICY "admin_select_feedback" ON app_feedback FOR SELECT
  TO authenticated
  USING (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'deepagster@gmail.com'
    OR auth.uid() = user_id
  );

DROP POLICY IF EXISTS "admin_select_reaction" ON reaction_feedback;
CREATE POLICY "admin_select_reaction" ON reaction_feedback FOR SELECT
  TO authenticated
  USING (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'deepagster@gmail.com'
    OR auth.uid() = user_id
  );

DROP POLICY IF EXISTS "admin_select_login_events" ON user_login_events;
CREATE POLICY "admin_select_login_events" ON user_login_events FOR SELECT
  TO authenticated
  USING (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'deepagster@gmail.com'
    OR auth.uid() = user_id
  );
