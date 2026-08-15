/*
# Add coachee SELECT policies to all child activity tables

The existing policies on cc_tasks, quiz_modules, quiz_questions, knowledge_points,
watch_items, talk_config, parking_config all use coach_owns_session() which blocks coachees.

This adds a parallel SELECT policy for each table using coachee_can_access_session()
so coachees can read activity data for sessions they are nominated/purchased for.
*/

-- cc_tasks
DROP POLICY IF EXISTS "select_cc_tasks_coachee" ON cc_tasks;
CREATE POLICY "select_cc_tasks_coachee" ON cc_tasks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM cc_activities a WHERE a.id = cc_tasks.activity_id AND coachee_can_access_session(a.session_id)));

-- quiz_modules
DROP POLICY IF EXISTS "select_quiz_modules_coachee" ON quiz_modules;
CREATE POLICY "select_quiz_modules_coachee" ON quiz_modules FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM cc_activities a WHERE a.id = quiz_modules.activity_id AND coachee_can_access_session(a.session_id)));

-- quiz_questions
DROP POLICY IF EXISTS "select_quiz_questions_coachee" ON quiz_questions;
CREATE POLICY "select_quiz_questions_coachee" ON quiz_questions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM quiz_modules m JOIN cc_activities a ON a.id = m.activity_id WHERE m.id = quiz_questions.module_id AND coachee_can_access_session(a.session_id)));

-- knowledge_points
DROP POLICY IF EXISTS "select_knowledge_points_coachee" ON knowledge_points;
CREATE POLICY "select_knowledge_points_coachee" ON knowledge_points FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM cc_activities a WHERE a.id = knowledge_points.activity_id AND coachee_can_access_session(a.session_id)));

-- watch_items
DROP POLICY IF EXISTS "select_watch_items_coachee" ON watch_items;
CREATE POLICY "select_watch_items_coachee" ON watch_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM cc_activities a WHERE a.id = watch_items.activity_id AND coachee_can_access_session(a.session_id)));

-- talk_config
DROP POLICY IF EXISTS "select_talk_config_coachee" ON talk_config;
CREATE POLICY "select_talk_config_coachee" ON talk_config FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM cc_activities a WHERE a.id = talk_config.activity_id AND coachee_can_access_session(a.session_id)));

-- parking_config
DROP POLICY IF EXISTS "select_parking_config_coachee" ON parking_config;
CREATE POLICY "select_parking_config_coachee" ON parking_config FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM cc_activities a WHERE a.id = parking_config.activity_id AND coachee_can_access_session(a.session_id)));
