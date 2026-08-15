-- 1. Capsule: add passkey, default goals (for coaching type)
ALTER TABLE capsules ADD COLUMN IF NOT EXISTS passkey text;
ALTER TABLE capsules ADD COLUMN IF NOT EXISTS capsule_goals jsonb DEFAULT '[]'::jsonb;

-- 2. Capsule enrollments: auto-enroll coachees for all sessions in a capsule
CREATE TABLE IF NOT EXISTS capsule_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capsule_id uuid NOT NULL REFERENCES capsules(id) ON DELETE CASCADE,
  coachee_email text NOT NULL,
  coachee_id uuid,
  enrolled_at timestamptz DEFAULT now(),
  UNIQUE (capsule_id, coachee_email)
);
ALTER TABLE capsule_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_enrollments" ON capsule_enrollments FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_own_enrollments" ON capsule_enrollments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_own_enrollments" ON capsule_enrollments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_own_enrollments" ON capsule_enrollments FOR DELETE TO authenticated USING (true);

-- 3. cc_activities: add coach_questions (up to 3 questions per activity), scheduled_dates, num_questions, questions_per_day
ALTER TABLE cc_activities ADD COLUMN IF NOT EXISTS coach_questions text[] DEFAULT '{}';
ALTER TABLE cc_activities ADD COLUMN IF NOT EXISTS scheduled_dates date[] DEFAULT '{}';
ALTER TABLE cc_activities ADD COLUMN IF NOT EXISTS num_questions integer DEFAULT 5;
ALTER TABLE cc_activities ADD COLUMN IF NOT EXISTS questions_per_day integer DEFAULT 5;

-- 4. quiz_modules: add num_questions, questions_per_day, asked_question_ids
ALTER TABLE quiz_modules ADD COLUMN IF NOT EXISTS num_questions integer DEFAULT 5;
ALTER TABLE quiz_modules ADD COLUMN IF NOT EXISTS questions_per_day integer DEFAULT 5;
ALTER TABLE quiz_modules ADD COLUMN IF NOT EXISTS asked_question_ids uuid[] DEFAULT '{}';

-- 5. talk_config: add coach_questions (already has chatbot_questions, repurpose as coach_questions)
ALTER TABLE talk_config ADD COLUMN IF NOT EXISTS coach_questions text[] DEFAULT '{}';

-- 6. activity_completions: add coach_question_answer (for dashboard LLM analysis)
ALTER TABLE activity_completions ADD COLUMN IF NOT EXISTS coach_question_answer text;

-- 7. talk_observations: store observations related to coach questions
CREATE TABLE IF NOT EXISTS talk_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  talk_session_id uuid,
  session_id uuid NOT NULL REFERENCES coaching_sessions(id) ON DELETE CASCADE,
  user_id uuid,
  user_email text,
  coach_question text,
  observation text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE talk_observations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_obs" ON talk_observations FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_own_obs" ON talk_observations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_own_obs" ON talk_observations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_own_obs" ON talk_observations FOR DELETE TO authenticated USING (true);

-- 8. coach_insights_chat: store coach followup Q&A per activity
CREATE TABLE IF NOT EXISTS coach_insights_chat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES coaching_sessions(id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  user_email text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE coach_insights_chat ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_chat" ON coach_insights_chat FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_own_chat" ON coach_insights_chat FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_own_chat" ON coach_insights_chat FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_own_chat" ON coach_insights_chat FOR DELETE TO authenticated USING (true);
