/*
# v2.1.0 — Capsule Knowledge, Chatbot Customization, Insights Cache, Power-to-Goal

## Changes
1. capsule_knowledge: coach uploads files at capsule level, extracted text consolidated
2. coach_chatbot_config: coach's chosen chatbot name, avatar, greeting (default Wise Harry)
3. coach_insights_cache: cached insights per session/activity/coachee for auto-populate
4. power_to_goal + power_to_goal_summary: confidence vs doubt word tracking per session
5. parked_items.session_id: nullable FK for cross-session loading within a capsule
6. coaching_sessions.generated_summary: AI-generated session summary

## Security
- Uses existing helper functions is_coach_for(), coach_owns_session(), user_is_session_nominee()
- Admin = (auth.jwt() ->> 'email') = 'deepagster@gmail.com'
*/

-- Helper for capsule ownership
CREATE OR REPLACE FUNCTION coach_owns_capsule(p_capsule_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM capsules cap
    JOIN coaches c ON c.id = cap.coach_id
    WHERE cap.id = p_capsule_id
    AND (
      c.user_id = auth.uid()
      OR c.email = (auth.jwt() ->> 'email')
      OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com'
    )
  );
$$;

-- ============ 1. Capsule Knowledge ============
CREATE TABLE IF NOT EXISTS capsule_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capsule_id uuid NOT NULL REFERENCES capsules(id) ON DELETE CASCADE,
  coach_id uuid NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_type text NOT NULL,
  storage_path text,
  extracted_text text DEFAULT '',
  consolidated_notes text DEFAULT '',
  uploaded_at timestamptz DEFAULT now()
);
ALTER TABLE capsule_knowledge ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_capsule_knowledge" ON capsule_knowledge;
CREATE POLICY "select_capsule_knowledge" ON capsule_knowledge FOR SELECT
  TO authenticated USING (
    coach_owns_capsule(capsule_id)
    OR user_is_session_nominee(
      (SELECT s.id FROM coaching_sessions s WHERE s.capsule_id = capsule_knowledge.capsule_id LIMIT 1)
    )
  );
DROP POLICY IF EXISTS "insert_capsule_knowledge" ON capsule_knowledge;
CREATE POLICY "insert_capsule_knowledge" ON capsule_knowledge FOR INSERT
  TO authenticated WITH CHECK (coach_owns_capsule(capsule_id));
DROP POLICY IF EXISTS "update_capsule_knowledge" ON capsule_knowledge;
CREATE POLICY "update_capsule_knowledge" ON capsule_knowledge FOR UPDATE
  TO authenticated USING (coach_owns_capsule(capsule_id))
  WITH CHECK (coach_owns_capsule(capsule_id));
DROP POLICY IF EXISTS "delete_capsule_knowledge" ON capsule_knowledge;
CREATE POLICY "delete_capsule_knowledge" ON capsule_knowledge FOR DELETE
  TO authenticated USING (coach_owns_capsule(capsule_id));

-- ============ 2. Coach Chatbot Config ============
CREATE TABLE IF NOT EXISTS coach_chatbot_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL UNIQUE REFERENCES coaches(id) ON DELETE CASCADE,
  chatbot_name text NOT NULL DEFAULT 'Wise Harry',
  chatbot_avatar_url text,
  greeting_line text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE coach_chatbot_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_coach_chatbot_config" ON coach_chatbot_config;
CREATE POLICY "select_coach_chatbot_config" ON coach_chatbot_config FOR SELECT
  TO authenticated USING (
    is_coach_for(coach_id)
    OR EXISTS (
      SELECT 1 FROM coaching_sessions s
      JOIN session_nominees sn ON sn.session_id = s.id
      WHERE s.coach_id = coach_chatbot_config.coach_id
      AND sn.coachee_email = (auth.jwt() ->> 'email')
    )
  );
DROP POLICY IF EXISTS "insert_coach_chatbot_config" ON coach_chatbot_config;
CREATE POLICY "insert_coach_chatbot_config" ON coach_chatbot_config FOR INSERT
  TO authenticated WITH CHECK (is_coach_for(coach_id));
DROP POLICY IF EXISTS "update_coach_chatbot_config" ON coach_chatbot_config;
CREATE POLICY "update_coach_chatbot_config" ON coach_chatbot_config FOR UPDATE
  TO authenticated USING (is_coach_for(coach_id))
  WITH CHECK (is_coach_for(coach_id));

-- ============ 3. Coach Insights Cache ============
CREATE TABLE IF NOT EXISTS coach_insights_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES coaching_sessions(id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  coachee_email text NOT NULL,
  insights_text text DEFAULT '',
  followup_chat jsonb DEFAULT '[]',
  generated_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(session_id, activity_type, coachee_email)
);
ALTER TABLE coach_insights_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_coach_insights_cache" ON coach_insights_cache;
CREATE POLICY "select_coach_insights_cache" ON coach_insights_cache FOR SELECT
  TO authenticated USING (
    coach_owns_session(session_id)
    OR user_is_session_nominee(session_id)
  );
DROP POLICY IF EXISTS "insert_coach_insights_cache" ON coach_insights_cache;
CREATE POLICY "insert_coach_insights_cache" ON coach_insights_cache FOR INSERT
  TO authenticated WITH CHECK (coach_owns_session(session_id));
DROP POLICY IF EXISTS "update_coach_insights_cache" ON coach_insights_cache;
CREATE POLICY "update_coach_insights_cache" ON coach_insights_cache FOR UPDATE
  TO authenticated USING (coach_owns_session(session_id))
  WITH CHECK (coach_owns_session(session_id));
DROP POLICY IF EXISTS "delete_coach_insights_cache" ON coach_insights_cache;
CREATE POLICY "delete_coach_insights_cache" ON coach_insights_cache FOR DELETE
  TO authenticated USING (coach_owns_session(session_id));

-- ============ 4. Power to Goal ============
CREATE TABLE IF NOT EXISTS power_to_goal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES coaching_sessions(id) ON DELETE CASCADE,
  capsule_id uuid NOT NULL REFERENCES capsules(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email text NOT NULL,
  activity_type text NOT NULL,
  input_text text DEFAULT '',
  confidence_count integer DEFAULT 0,
  doubt_count integer DEFAULT 0,
  total_words integer DEFAULT 0,
  recorded_at timestamptz DEFAULT now()
);
ALTER TABLE power_to_goal ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_power_to_goal" ON power_to_goal;
CREATE POLICY "select_power_to_goal" ON power_to_goal FOR SELECT
  TO authenticated USING (user_id = auth.uid() OR coach_owns_session(session_id));
DROP POLICY IF EXISTS "insert_power_to_goal" ON power_to_goal;
CREATE POLICY "insert_power_to_goal" ON power_to_goal FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS power_to_goal_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES coaching_sessions(id) ON DELETE CASCADE,
  capsule_id uuid NOT NULL REFERENCES capsules(id) ON DELETE CASCADE,
  user_email text NOT NULL,
  total_confidence integer DEFAULT 0,
  total_doubt integer DEFAULT 0,
  total_words integer DEFAULT 0,
  power_percentage numeric(5,2) DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(session_id, user_email)
);
ALTER TABLE power_to_goal_summary ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_power_to_goal_summary" ON power_to_goal_summary;
CREATE POLICY "select_power_to_goal_summary" ON power_to_goal_summary FOR SELECT
  TO authenticated USING (user_email = (auth.jwt() ->> 'email') OR coach_owns_session(session_id));
DROP POLICY IF EXISTS "insert_power_to_goal_summary" ON power_to_goal_summary;
CREATE POLICY "insert_power_to_goal_summary" ON power_to_goal_summary FOR INSERT
  TO authenticated WITH CHECK (user_email = (auth.jwt() ->> 'email'));
DROP POLICY IF EXISTS "update_power_to_goal_summary" ON power_to_goal_summary;
CREATE POLICY "update_power_to_goal_summary" ON power_to_goal_summary FOR UPDATE
  TO authenticated USING (user_email = (auth.jwt() ->> 'email'))
  WITH CHECK (user_email = (auth.jwt() ->> 'email'));

-- ============ 5. Parked items session_id ============
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'parked_items' AND column_name = 'session_id') THEN
    ALTER TABLE parked_items ADD COLUMN session_id uuid REFERENCES coaching_sessions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============ 6. Coaching sessions generated summary ============
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'coaching_sessions' AND column_name = 'generated_summary') THEN
    ALTER TABLE coaching_sessions ADD COLUMN generated_summary text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_capsule_knowledge_capsule ON capsule_knowledge(capsule_id);
CREATE INDEX IF NOT EXISTS idx_coach_insights_cache_session ON coach_insights_cache(session_id, coachee_email);
CREATE INDEX IF NOT EXISTS idx_power_to_goal_session ON power_to_goal(session_id, user_email);
CREATE INDEX IF NOT EXISTS idx_power_to_goal_summary_session ON power_to_goal_summary(session_id, user_email);
CREATE INDEX IF NOT EXISTS idx_parked_items_session ON parked_items(session_id);