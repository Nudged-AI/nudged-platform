/*
# Fix admin read policies for feedback and login tables

The previous policies used a subquery on auth.users to check admin email,
but the authenticated role cannot query auth.users directly.
Replace with auth.jwt() to read email from the JWT token instead.
*/

-- app_feedback
DROP POLICY IF EXISTS "admin_select_feedback" ON app_feedback;
DROP POLICY IF EXISTS "select_own_feedback" ON app_feedback;
CREATE POLICY "select_feedback" ON app_feedback FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com'
  );

-- reaction_feedback
DROP POLICY IF EXISTS "admin_select_reaction" ON reaction_feedback;
DROP POLICY IF EXISTS "select_own_reaction" ON reaction_feedback;
CREATE POLICY "select_reaction" ON reaction_feedback FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com'
  );

-- user_login_events
DROP POLICY IF EXISTS "admin_select_login_events" ON user_login_events;
DROP POLICY IF EXISTS "select_own_login_events" ON user_login_events;
CREATE POLICY "select_login_events" ON user_login_events FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com'
  );
