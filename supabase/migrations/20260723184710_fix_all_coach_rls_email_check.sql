-- Fix all coach-scoped RLS policies to also check coach email (matching coaching_sessions pattern)
-- This fixes session creation failures when coach.user_id doesn't match auth.uid()

-- cc_activities
DROP POLICY IF EXISTS "insert_cc_activities" ON cc_activities;
CREATE POLICY "insert_cc_activities" ON cc_activities FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM coaching_sessions s JOIN coaches c ON c.id = s.coach_id
      WHERE s.id = cc_activities.session_id
      AND (c.user_id = auth.uid() OR c.email = (auth.jwt() ->> 'email') OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com'))
  );
DROP POLICY IF EXISTS "update_cc_activities" ON cc_activities;
CREATE POLICY "update_cc_activities" ON cc_activities FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM coaching_sessions s JOIN coaches c ON c.id = s.coach_id
      WHERE s.id = cc_activities.session_id
      AND (c.user_id = auth.uid() OR c.email = (auth.jwt() ->> 'email') OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM coaching_sessions s JOIN coaches c ON c.id = s.coach_id
      WHERE s.id = cc_activities.session_id
      AND (c.user_id = auth.uid() OR c.email = (auth.jwt() ->> 'email') OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com'))
  );
DROP POLICY IF EXISTS "delete_cc_activities" ON cc_activities;
CREATE POLICY "delete_cc_activities" ON cc_activities FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM coaching_sessions s JOIN coaches c ON c.id = s.coach_id
      WHERE s.id = cc_activities.session_id
      AND (c.user_id = auth.uid() OR c.email = (auth.jwt() ->> 'email') OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com'))
  );

-- cc_tasks (joins through cc_activities)
DROP POLICY IF EXISTS "insert_cc_tasks" ON cc_tasks;
CREATE POLICY "insert_cc_tasks" ON cc_tasks FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM cc_activities a JOIN coaching_sessions s ON s.id = a.session_id JOIN coaches c ON c.id = s.coach_id
      WHERE a.id = cc_tasks.activity_id
      AND (c.user_id = auth.uid() OR c.email = (auth.jwt() ->> 'email') OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com'))
  );
DROP POLICY IF EXISTS "delete_cc_tasks" ON cc_tasks;
CREATE POLICY "delete_cc_tasks" ON cc_tasks FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM cc_activities a JOIN coaching_sessions s ON s.id = a.session_id JOIN coaches c ON c.id = s.coach_id
      WHERE a.id = cc_tasks.activity_id
      AND (c.user_id = auth.uid() OR c.email = (auth.jwt() ->> 'email') OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com'))
  );

-- quiz_modules
DROP POLICY IF EXISTS "insert_quiz_modules" ON quiz_modules;
CREATE POLICY "insert_quiz_modules" ON quiz_modules FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM cc_activities a JOIN coaching_sessions s ON s.id = a.session_id JOIN coaches c ON c.id = s.coach_id
      WHERE a.id = quiz_modules.activity_id
      AND (c.user_id = auth.uid() OR c.email = (auth.jwt() ->> 'email') OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com'))
  );
DROP POLICY IF EXISTS "delete_quiz_modules" ON quiz_modules;
CREATE POLICY "delete_quiz_modules" ON quiz_modules FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM cc_activities a JOIN coaching_sessions s ON s.id = a.session_id JOIN coaches c ON c.id = s.coach_id
      WHERE a.id = quiz_modules.activity_id
      AND (c.user_id = auth.uid() OR c.email = (auth.jwt() ->> 'email') OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com'))
  );

-- quiz_questions
DROP POLICY IF EXISTS "insert_quiz_questions" ON quiz_questions;
CREATE POLICY "insert_quiz_questions" ON quiz_questions FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM quiz_modules qm JOIN cc_activities a ON a.id = qm.activity_id JOIN coaching_sessions s ON s.id = a.session_id JOIN coaches c ON c.id = s.coach_id
      WHERE qm.id = quiz_questions.module_id
      AND (c.user_id = auth.uid() OR c.email = (auth.jwt() ->> 'email') OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com'))
  );
DROP POLICY IF EXISTS "delete_quiz_questions" ON quiz_questions;
CREATE POLICY "delete_quiz_questions" ON quiz_questions FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM quiz_modules qm JOIN cc_activities a ON a.id = qm.activity_id JOIN coaching_sessions s ON s.id = a.session_id JOIN coaches c ON c.id = s.coach_id
      WHERE qm.id = quiz_questions.module_id
      AND (c.user_id = auth.uid() OR c.email = (auth.jwt() ->> 'email') OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com'))
  );

-- talk_config
DROP POLICY IF EXISTS "insert_talk_config" ON talk_config;
CREATE POLICY "insert_talk_config" ON talk_config FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM cc_activities a JOIN coaching_sessions s ON s.id = a.session_id JOIN coaches c ON c.id = s.coach_id
      WHERE a.id = talk_config.activity_id
      AND (c.user_id = auth.uid() OR c.email = (auth.jwt() ->> 'email') OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com'))
  );
DROP POLICY IF EXISTS "delete_talk_config" ON talk_config;
CREATE POLICY "delete_talk_config" ON talk_config FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM cc_activities a JOIN coaching_sessions s ON s.id = a.session_id JOIN coaches c ON c.id = s.coach_id
      WHERE a.id = talk_config.activity_id
      AND (c.user_id = auth.uid() OR c.email = (auth.jwt() ->> 'email') OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com'))
  );

-- watch_items
DROP POLICY IF EXISTS "insert_watch_items" ON watch_items;
CREATE POLICY "insert_watch_items" ON watch_items FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM cc_activities a JOIN coaching_sessions s ON s.id = a.session_id JOIN coaches c ON c.id = s.coach_id
      WHERE a.id = watch_items.activity_id
      AND (c.user_id = auth.uid() OR c.email = (auth.jwt() ->> 'email') OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com'))
  );
DROP POLICY IF EXISTS "delete_watch_items" ON watch_items;
CREATE POLICY "delete_watch_items" ON watch_items FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM cc_activities a JOIN coaching_sessions s ON s.id = a.session_id JOIN coaches c ON c.id = s.coach_id
      WHERE a.id = watch_items.activity_id
      AND (c.user_id = auth.uid() OR c.email = (auth.jwt() ->> 'email') OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com'))
  );

-- parking_config
DROP POLICY IF EXISTS "insert_parking_config" ON parking_config;
CREATE POLICY "insert_parking_config" ON parking_config FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM cc_activities a JOIN coaching_sessions s ON s.id = a.session_id JOIN coaches c ON c.id = s.coach_id
      WHERE a.id = parking_config.activity_id
      AND (c.user_id = auth.uid() OR c.email = (auth.jwt() ->> 'email') OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com'))
  );
DROP POLICY IF EXISTS "delete_parking_config" ON parking_config;
CREATE POLICY "delete_parking_config" ON parking_config FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM cc_activities a JOIN coaching_sessions s ON s.id = a.session_id JOIN coaches c ON c.id = s.coach_id
      WHERE a.id = parking_config.activity_id
      AND (c.user_id = auth.uid() OR c.email = (auth.jwt() ->> 'email') OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com'))
  );

-- knowledge_points
DROP POLICY IF EXISTS "insert_knowledge_points" ON knowledge_points;
CREATE POLICY "insert_knowledge_points" ON knowledge_points FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM cc_activities a JOIN coaching_sessions s ON s.id = a.session_id JOIN coaches c ON c.id = s.coach_id
      WHERE a.id = knowledge_points.activity_id
      AND (c.user_id = auth.uid() OR c.email = (auth.jwt() ->> 'email') OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com'))
  );
DROP POLICY IF EXISTS "delete_knowledge_points" ON knowledge_points;
CREATE POLICY "delete_knowledge_points" ON knowledge_points FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM cc_activities a JOIN coaching_sessions s ON s.id = a.session_id JOIN coaches c ON c.id = s.coach_id
      WHERE a.id = knowledge_points.activity_id
      AND (c.user_id = auth.uid() OR c.email = (auth.jwt() ->> 'email') OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com'))
  );

-- session_nominees (FOR ALL policy — need to recreate with email check)
DROP POLICY IF EXISTS "insert_session_nominees" ON session_nominees;
CREATE POLICY "insert_session_nominees" ON session_nominees FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM coaching_sessions s JOIN coaches c ON c.id = s.coach_id
      WHERE s.id = session_nominees.session_id
      AND (c.user_id = auth.uid() OR c.email = (auth.jwt() ->> 'email') OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com'))
  );
DROP POLICY IF EXISTS "delete_session_nominees" ON session_nominees;
CREATE POLICY "delete_session_nominees" ON session_nominees FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM coaching_sessions s JOIN coaches c ON c.id = s.coach_id
      WHERE s.id = session_nominees.session_id
      AND (c.user_id = auth.uid() OR c.email = (auth.jwt() ->> 'email') OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com'))
  );
