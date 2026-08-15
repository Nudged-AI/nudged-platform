/*
# Coach & Coachee Schema

## Purpose
Introduces two roles (Coach, Coachee) and the supporting data model for capsules,
sessions, activities, nominations, marketplace purchases, and progress tracking.

## New Tables
1. `coaches` - Registered coaches (admin-onboarded).
2. `coach_profiles` - Public-facing marketplace details for a coach.
3. `coachees` - Coachee master records created by a coach.
4. `coach_goals` - Up to 3 coaching goals per coachee.
5. `capsules` - A training program or coaching intervention by a coach.
6. `coaching_sessions` - Sessions under a capsule (renamed from "sessions" to avoid clash with existing focus-session table).
7. `session_nominees` - Coachees nominated for a session.
8. `session_purchases` - Marketplace purchases of a session by any user.
9. `session_passkeys` - Passkeys for accessing private sessions.
10. `cc_activities` - Activity config for a session.
11. `quiz_modules` - Modules under a quiz activity.
12. `quiz_questions` - Questions under a quiz module.
13. `cc_tasks` - Tasks under a tasks activity (with sub-modality).
14. `knowledge_points` - Knowledge points under a knowledge activity.
15. `watch_items` - Videos under a watch activity.
16. `talk_config` - Chatbot config under a talk activity.
17. `parking_config` - Parking thoughts config under a parking activity.
18. `regimes` - Regime schedule for a session.
19. `activity_completions` - Coachee completion log per activity per day.
20. `talk_sessions` - Wise Harry chat sessions.
21. `talk_messages` - Messages within a talk session.
22. `session_threads` - Auto-created Parked Thoughts threads for a session.
23. `coach_stars` - Stars earned per session per coachee (bragging board).

## Security
- RLS enabled on all tables.
- Coaches manage their own data (coach_id = auth.uid()).
- Coachees read their nominated/purchased sessions.
- Admin (deepagster@gmail.com) has read access to all coach data.
- Public marketplace reads for public capsules/sessions.
*/

-- 1. coaches
CREATE TABLE IF NOT EXISTS coaches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  coach_name text NOT NULL,
  coach_type text NOT NULL DEFAULT 'Coach',
  coach_niche text,
  is_active boolean NOT NULL DEFAULT true,
  onboarded_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(email)
);

ALTER TABLE coaches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_coaches" ON coaches;
CREATE POLICY "select_coaches" ON coaches FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_coaches" ON coaches;
CREATE POLICY "insert_coaches" ON coaches FOR INSERT
  TO authenticated WITH CHECK ((auth.jwt() ->> 'email') = 'deepagster@gmail.com');

DROP POLICY IF EXISTS "update_coaches" ON coaches;
CREATE POLICY "update_coaches" ON coaches FOR UPDATE
  TO authenticated USING ((auth.jwt() ->> 'email') = 'deepagster@gmail.com' OR auth.uid() = user_id)
  WITH CHECK ((auth.jwt() ->> 'email') = 'deepagster@gmail.com' OR auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_coaches" ON coaches;
CREATE POLICY "delete_coaches" ON coaches FOR DELETE
  TO authenticated USING ((auth.jwt() ->> 'email') = 'deepagster@gmail.com');

-- 2. coach_profiles
CREATE TABLE IF NOT EXISTS coach_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  display_name text,
  pronouns text,
  portrait_url text,
  brand_logo_url text,
  welcome_message text,
  categories text[] DEFAULT '{}',
  niches text[] DEFAULT '{}',
  philosophy text,
  tone_tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(coach_id)
);

ALTER TABLE coach_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_coach_profiles" ON coach_profiles;
CREATE POLICY "select_coach_profiles" ON coach_profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_coach_profiles" ON coach_profiles;
CREATE POLICY "insert_coach_profiles" ON coach_profiles FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM coaches c WHERE c.id = coach_id AND (c.user_id = auth.uid() OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com')));

DROP POLICY IF EXISTS "update_coach_profiles" ON coach_profiles;
CREATE POLICY "update_coach_profiles" ON coach_profiles FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM coaches c WHERE c.id = coach_id AND (c.user_id = auth.uid() OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com')))
  WITH CHECK (EXISTS (SELECT 1 FROM coaches c WHERE c.id = coach_id AND (c.user_id = auth.uid() OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com')));

-- 3. coachees
CREATE TABLE IF NOT EXISTS coachees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  email text NOT NULL,
  client_name text NOT NULL,
  whatsapp_number text,
  date_of_birth date,
  gender text,
  profession text,
  profession_details text,
  marital_status text,
  children integer DEFAULT 0,
  default_emotion_tags text[] DEFAULT '{}',
  preferred_checkin_time text,
  practice_comfort text[] DEFAULT '{}',
  privacy_preference text DEFAULT 'Private',
  sub_modality text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(coach_id, email)
);

ALTER TABLE coachees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_coachees" ON coachees;
CREATE POLICY "select_coachees" ON coachees FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM coaches c WHERE c.id = coachees.coach_id AND (c.user_id = auth.uid() OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com'))
    OR (auth.jwt() ->> 'email') = coachees.email
  );

DROP POLICY IF EXISTS "insert_coachees" ON coachees;
CREATE POLICY "insert_coachees" ON coachees FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM coaches c WHERE c.id = coachees.coach_id AND c.user_id = auth.uid()));

DROP POLICY IF EXISTS "update_coachees" ON coachees;
CREATE POLICY "update_coachees" ON coachees FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM coaches c WHERE c.id = coachees.coach_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM coaches c WHERE c.id = coachees.coach_id AND c.user_id = auth.uid()));

DROP POLICY IF EXISTS "delete_coachees" ON coachees;
CREATE POLICY "delete_coachees" ON coachees FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM coaches c WHERE c.id = coachees.coach_id AND c.user_id = auth.uid()));

-- 4. coach_goals
CREATE TABLE IF NOT EXISTS coach_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coachee_id uuid NOT NULL REFERENCES coachees(id) ON DELETE CASCADE,
  goal_text text NOT NULL,
  target_date date,
  past_actions text,
  consequence text,
  success_metrics text[] DEFAULT '{}',
  challenges text[] DEFAULT '{}',
  emotional_blockers text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE coach_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_coach_goals" ON coach_goals;
CREATE POLICY "select_coach_goals" ON coach_goals FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM coachees c JOIN coaches co ON co.id = c.coach_id WHERE c.id = coach_goals.coachee_id AND (co.user_id = auth.uid() OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com' OR (auth.jwt() ->> 'email') = c.email)));

DROP POLICY IF EXISTS "insert_coach_goals" ON coach_goals;
CREATE POLICY "insert_coach_goals" ON coach_goals FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM coachees c JOIN coaches co ON co.id = c.coach_id WHERE c.id = coach_goals.coachee_id AND co.user_id = auth.uid()));

DROP POLICY IF EXISTS "update_coach_goals" ON coach_goals;
CREATE POLICY "update_coach_goals" ON coach_goals FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM coachees c JOIN coaches co ON co.id = c.coach_id WHERE c.id = coach_goals.coachee_id AND co.user_id = auth.uid()));

DROP POLICY IF EXISTS "delete_coach_goals" ON coach_goals;
CREATE POLICY "delete_coach_goals" ON coach_goals FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM coachees c JOIN coaches co ON co.id = c.coach_id WHERE c.id = coach_goals.coachee_id AND co.user_id = auth.uid()));

-- 5. capsules
CREATE TABLE IF NOT EXISTS capsules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  capsule_type text NOT NULL DEFAULT 'Coaching',
  is_public boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE capsules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_capsules" ON capsules;
CREATE POLICY "select_capsules" ON capsules FOR SELECT
  TO authenticated USING (
    (is_public AND is_active)
    OR EXISTS (SELECT 1 FROM coaches c WHERE c.id = capsules.coach_id AND (c.user_id = auth.uid() OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com'))
  );

DROP POLICY IF EXISTS "insert_capsules" ON capsules;
CREATE POLICY "insert_capsules" ON capsules FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM coaches c WHERE c.id = capsules.coach_id AND c.user_id = auth.uid()));

DROP POLICY IF EXISTS "update_capsules" ON capsules;
CREATE POLICY "update_capsules" ON capsules FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM coaches c WHERE c.id = capsules.coach_id AND (c.user_id = auth.uid() OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com')))
  WITH CHECK (EXISTS (SELECT 1 FROM coaches c WHERE c.id = capsules.coach_id AND (c.user_id = auth.uid() OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com')));

DROP POLICY IF EXISTS "delete_capsules" ON capsules;
CREATE POLICY "delete_capsules" ON capsules FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM coaches c WHERE c.id = capsules.coach_id AND c.user_id = auth.uid()));

-- 6. coaching_sessions
CREATE TABLE IF NOT EXISTS coaching_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capsule_id uuid NOT NULL REFERENCES capsules(id) ON DELETE CASCADE,
  coach_id uuid NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  session_uid text,
  topic text NOT NULL,
  session_date date,
  goals jsonb DEFAULT '[]',
  target_audience text,
  next_session_date date,
  decks jsonb DEFAULT '[]',
  session_notes jsonb DEFAULT '{}',
  is_public boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  is_submitted boolean NOT NULL DEFAULT false,
  activation_date date,
  deactivation_date date,
  session_number integer NOT NULL DEFAULT 1,
  summary text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE coaching_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_coaching_sessions" ON coaching_sessions;
CREATE POLICY "select_coaching_sessions" ON coaching_sessions FOR SELECT
  TO authenticated USING (
    (is_public AND is_active)
    OR EXISTS (SELECT 1 FROM coaches c WHERE c.id = coaching_sessions.coach_id AND (c.user_id = auth.uid() OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com'))
  );

DROP POLICY IF EXISTS "insert_coaching_sessions" ON coaching_sessions;
CREATE POLICY "insert_coaching_sessions" ON coaching_sessions FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM coaches c WHERE c.id = coaching_sessions.coach_id AND c.user_id = auth.uid()));

DROP POLICY IF EXISTS "update_coaching_sessions" ON coaching_sessions;
CREATE POLICY "update_coaching_sessions" ON coaching_sessions FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM coaches c WHERE c.id = coaching_sessions.coach_id AND (c.user_id = auth.uid() OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com')))
  WITH CHECK (EXISTS (SELECT 1 FROM coaches c WHERE c.id = coaching_sessions.coach_id AND (c.user_id = auth.uid() OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com')));

DROP POLICY IF EXISTS "delete_coaching_sessions" ON coaching_sessions;
CREATE POLICY "delete_coaching_sessions" ON coaching_sessions FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM coaches c WHERE c.id = coaching_sessions.coach_id AND c.user_id = auth.uid()));

-- 7. session_nominees
CREATE TABLE IF NOT EXISTS session_nominees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES coaching_sessions(id) ON DELETE CASCADE,
  coachee_id uuid REFERENCES coachees(id) ON DELETE SET NULL,
  coachee_email text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(session_id, coachee_email)
);

ALTER TABLE session_nominees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_session_nominees" ON session_nominees;
CREATE POLICY "select_session_nominees" ON session_nominees FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM coaching_sessions s JOIN coaches c ON c.id = s.coach_id WHERE s.id = session_nominees.session_id AND (c.user_id = auth.uid() OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com'))
    OR coachee_email = (auth.jwt() ->> 'email')
  );

DROP POLICY IF EXISTS "insert_session_nominees" ON session_nominees;
CREATE POLICY "insert_session_nominees" ON session_nominees FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM coaching_sessions s JOIN coaches c ON c.id = s.coach_id WHERE s.id = session_nominees.session_id AND c.user_id = auth.uid()));

DROP POLICY IF EXISTS "delete_session_nominees" ON session_nominees;
CREATE POLICY "delete_session_nominees" ON session_nominees FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM coaching_sessions s JOIN coaches c ON c.id = s.coach_id WHERE s.id = session_nominees.session_id AND c.user_id = auth.uid()));

-- 8. session_purchases
CREATE TABLE IF NOT EXISTS session_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES coaching_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(session_id, user_id)
);

ALTER TABLE session_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_session_purchases" ON session_purchases;
CREATE POLICY "select_session_purchases" ON session_purchases FOR SELECT
  TO authenticated USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM coaching_sessions s JOIN coaches c ON c.id = s.coach_id WHERE s.id = session_purchases.session_id AND c.user_id = auth.uid()));

DROP POLICY IF EXISTS "insert_session_purchases" ON session_purchases;
CREATE POLICY "insert_session_purchases" ON session_purchases FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "delete_session_purchases" ON session_purchases;
CREATE POLICY "delete_session_purchases" ON session_purchases FOR DELETE
  TO authenticated USING (user_id = auth.uid());

-- 9. session_passkeys
CREATE TABLE IF NOT EXISTS session_passkeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES coaching_sessions(id) ON DELETE CASCADE,
  passkey text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(session_id, passkey)
);

ALTER TABLE session_passkeys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_session_passkeys" ON session_passkeys;
CREATE POLICY "select_session_passkeys" ON session_passkeys FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM coaching_sessions s JOIN coaches c ON c.id = s.coach_id WHERE s.id = session_passkeys.session_id AND c.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM session_nominees sn WHERE sn.session_id = session_passkeys.session_id AND sn.coachee_email = (auth.jwt() ->> 'email'))
    OR EXISTS (SELECT 1 FROM session_purchases sp WHERE sp.session_id = session_passkeys.session_id AND sp.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_session_passkeys" ON session_passkeys;
CREATE POLICY "insert_session_passkeys" ON session_passkeys FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM coaching_sessions s JOIN coaches c ON c.id = s.coach_id WHERE s.id = session_passkeys.session_id AND c.user_id = auth.uid()));

DROP POLICY IF EXISTS "delete_session_passkeys" ON session_passkeys;
CREATE POLICY "delete_session_passkeys" ON session_passkeys FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM coaching_sessions s JOIN coaches c ON c.id = s.coach_id WHERE s.id = session_passkeys.session_id AND c.user_id = auth.uid()));

-- 10. cc_activities
CREATE TABLE IF NOT EXISTS cc_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES coaching_sessions(id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  frequency text,
  duration_minutes integer,
  metrics jsonb DEFAULT '[]',
  config jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  UNIQUE(session_id, activity_type)
);

ALTER TABLE cc_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_cc_activities" ON cc_activities;
CREATE POLICY "select_cc_activities" ON cc_activities FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM coaching_sessions s JOIN coaches c ON c.id = s.coach_id WHERE s.id = cc_activities.session_id AND (c.user_id = auth.uid() OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com'))
    OR EXISTS (SELECT 1 FROM session_nominees sn WHERE sn.session_id = cc_activities.session_id AND sn.coachee_email = (auth.jwt() ->> 'email'))
    OR EXISTS (SELECT 1 FROM session_purchases sp WHERE sp.session_id = cc_activities.session_id AND sp.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_cc_activities" ON cc_activities;
CREATE POLICY "insert_cc_activities" ON cc_activities FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM coaching_sessions s JOIN coaches c ON c.id = s.coach_id WHERE s.id = cc_activities.session_id AND c.user_id = auth.uid()));

DROP POLICY IF EXISTS "update_cc_activities" ON cc_activities;
CREATE POLICY "update_cc_activities" ON cc_activities FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM coaching_sessions s JOIN coaches c ON c.id = s.coach_id WHERE s.id = cc_activities.session_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM coaching_sessions s JOIN coaches c ON c.id = s.coach_id WHERE s.id = cc_activities.session_id AND c.user_id = auth.uid()));

DROP POLICY IF EXISTS "delete_cc_activities" ON cc_activities;
CREATE POLICY "delete_cc_activities" ON cc_activities FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM coaching_sessions s JOIN coaches c ON c.id = s.coach_id WHERE s.id = cc_activities.session_id AND c.user_id = auth.uid()));

-- 11. quiz_modules
CREATE TABLE IF NOT EXISTS quiz_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES cc_activities(id) ON DELETE CASCADE,
  title text NOT NULL,
  position integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE quiz_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_quiz_modules" ON quiz_modules;
CREATE POLICY "select_quiz_modules" ON quiz_modules FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM cc_activities a WHERE a.id = quiz_modules.activity_id));

DROP POLICY IF EXISTS "insert_quiz_modules" ON quiz_modules;
CREATE POLICY "insert_quiz_modules" ON quiz_modules FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM cc_activities a JOIN coaching_sessions s ON s.id = a.session_id JOIN coaches c ON c.id = s.coach_id WHERE a.id = quiz_modules.activity_id AND c.user_id = auth.uid()));

DROP POLICY IF EXISTS "update_quiz_modules" ON quiz_modules;
CREATE POLICY "update_quiz_modules" ON quiz_modules FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM cc_activities a JOIN coaching_sessions s ON s.id = a.session_id JOIN coaches c ON c.id = s.coach_id WHERE a.id = quiz_modules.activity_id AND c.user_id = auth.uid()));

DROP POLICY IF EXISTS "delete_quiz_modules" ON quiz_modules;
CREATE POLICY "delete_quiz_modules" ON quiz_modules FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM cc_activities a JOIN coaching_sessions s ON s.id = a.session_id JOIN coaches c ON c.id = s.coach_id WHERE a.id = quiz_modules.activity_id AND c.user_id = auth.uid()));

-- 12. quiz_questions
CREATE TABLE IF NOT EXISTS quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES quiz_modules(id) ON DELETE CASCADE,
  question text NOT NULL,
  options text[] NOT NULL,
  answer_index integer NOT NULL,
  image_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_quiz_questions" ON quiz_questions;
CREATE POLICY "select_quiz_questions" ON quiz_questions FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM quiz_modules m JOIN cc_activities a ON a.id = m.activity_id WHERE m.id = quiz_questions.module_id));

DROP POLICY IF EXISTS "insert_quiz_questions" ON quiz_questions;
CREATE POLICY "insert_quiz_questions" ON quiz_questions FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM quiz_modules m JOIN cc_activities a ON a.id = m.activity_id JOIN coaching_sessions s ON s.id = a.session_id JOIN coaches c ON c.id = s.coach_id WHERE m.id = quiz_questions.module_id AND c.user_id = auth.uid()));

DROP POLICY IF EXISTS "update_quiz_questions" ON quiz_questions;
CREATE POLICY "update_quiz_questions" ON quiz_questions FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM quiz_modules m JOIN cc_activities a ON a.id = m.activity_id JOIN coaching_sessions s ON s.id = a.session_id JOIN coaches c ON c.id = s.coach_id WHERE m.id = quiz_questions.module_id AND c.user_id = auth.uid()));

DROP POLICY IF EXISTS "delete_quiz_questions" ON quiz_questions;
CREATE POLICY "delete_quiz_questions" ON quiz_questions FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM quiz_modules m JOIN cc_activities a ON a.id = m.activity_id JOIN coaching_sessions s ON s.id = a.session_id JOIN coaches c ON c.id = s.coach_id WHERE m.id = quiz_questions.module_id AND c.user_id = auth.uid()));

-- 13. cc_tasks
CREATE TABLE IF NOT EXISTS cc_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES cc_activities(id) ON DELETE CASCADE,
  sub_modality text,
  task_text text NOT NULL,
  frequency text,
  image_url text,
  position integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE cc_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_cc_tasks" ON cc_tasks;
CREATE POLICY "select_cc_tasks" ON cc_tasks FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM cc_activities a WHERE a.id = cc_tasks.activity_id));

DROP POLICY IF EXISTS "insert_cc_tasks" ON cc_tasks;
CREATE POLICY "insert_cc_tasks" ON cc_tasks FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM cc_activities a JOIN coaching_sessions s ON s.id = a.session_id JOIN coaches c ON c.id = s.coach_id WHERE a.id = cc_tasks.activity_id AND c.user_id = auth.uid()));

DROP POLICY IF EXISTS "update_cc_tasks" ON cc_tasks;
CREATE POLICY "update_cc_tasks" ON cc_tasks FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM cc_activities a JOIN coaching_sessions s ON s.id = a.session_id JOIN coaches c ON c.id = s.coach_id WHERE a.id = cc_tasks.activity_id AND c.user_id = auth.uid()));

DROP POLICY IF EXISTS "delete_cc_tasks" ON cc_tasks;
CREATE POLICY "delete_cc_tasks" ON cc_tasks FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM cc_activities a JOIN coaching_sessions s ON s.id = a.session_id JOIN coaches c ON c.id = s.coach_id WHERE a.id = cc_tasks.activity_id AND c.user_id = auth.uid()));

-- 14. knowledge_points
CREATE TABLE IF NOT EXISTS knowledge_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES cc_activities(id) ON DELETE CASCADE,
  point_text text NOT NULL,
  image_url text,
  position integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE knowledge_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_knowledge_points" ON knowledge_points;
CREATE POLICY "select_knowledge_points" ON knowledge_points FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM cc_activities a WHERE a.id = knowledge_points.activity_id));

DROP POLICY IF EXISTS "insert_knowledge_points" ON knowledge_points;
CREATE POLICY "insert_knowledge_points" ON knowledge_points FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM cc_activities a JOIN coaching_sessions s ON s.id = a.session_id JOIN coaches c ON c.id = s.coach_id WHERE a.id = knowledge_points.activity_id AND c.user_id = auth.uid()));

DROP POLICY IF EXISTS "update_knowledge_points" ON knowledge_points;
CREATE POLICY "update_knowledge_points" ON knowledge_points FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM cc_activities a JOIN coaching_sessions s ON s.id = a.session_id JOIN coaches c ON c.id = s.coach_id WHERE a.id = knowledge_points.activity_id AND c.user_id = auth.uid()));

DROP POLICY IF EXISTS "delete_knowledge_points" ON knowledge_points;
CREATE POLICY "delete_knowledge_points" ON knowledge_points FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM cc_activities a JOIN coaching_sessions s ON s.id = a.session_id JOIN coaches c ON c.id = s.coach_id WHERE a.id = knowledge_points.activity_id AND c.user_id = auth.uid()));

-- 15. watch_items
CREATE TABLE IF NOT EXISTS watch_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES cc_activities(id) ON DELETE CASCADE,
  video_url text NOT NULL,
  title text,
  thumbnail_url text,
  question text,
  frequency text,
  position integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE watch_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_watch_items" ON watch_items;
CREATE POLICY "select_watch_items" ON watch_items FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM cc_activities a WHERE a.id = watch_items.activity_id));

DROP POLICY IF EXISTS "insert_watch_items" ON watch_items;
CREATE POLICY "insert_watch_items" ON watch_items FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM cc_activities a JOIN coaching_sessions s ON s.id = a.session_id JOIN coaches c ON c.id = s.coach_id WHERE a.id = watch_items.activity_id AND c.user_id = auth.uid()));

DROP POLICY IF EXISTS "update_watch_items" ON watch_items;
CREATE POLICY "update_watch_items" ON watch_items FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM cc_activities a JOIN coaching_sessions s ON s.id = a.session_id JOIN coaches c ON c.id = s.coach_id WHERE a.id = watch_items.activity_id AND c.user_id = auth.uid()));

DROP POLICY IF EXISTS "delete_watch_items" ON watch_items;
CREATE POLICY "delete_watch_items" ON watch_items FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM cc_activities a JOIN coaching_sessions s ON s.id = a.session_id JOIN coaches c ON c.id = s.coach_id WHERE a.id = watch_items.activity_id AND c.user_id = auth.uid()));

-- 16. talk_config
CREATE TABLE IF NOT EXISTS talk_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES cc_activities(id) ON DELETE CASCADE,
  prompts jsonb DEFAULT '[]',
  chatbot_questions jsonb DEFAULT '[]',
  end_goal text,
  metrics jsonb DEFAULT '[]',
  duration_minutes integer DEFAULT 10,
  frequency text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(activity_id)
);

ALTER TABLE talk_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_talk_config" ON talk_config;
CREATE POLICY "select_talk_config" ON talk_config FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM cc_activities a WHERE a.id = talk_config.activity_id));

DROP POLICY IF EXISTS "insert_talk_config" ON talk_config;
CREATE POLICY "insert_talk_config" ON talk_config FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM cc_activities a JOIN coaching_sessions s ON s.id = a.session_id JOIN coaches c ON c.id = s.coach_id WHERE a.id = talk_config.activity_id AND c.user_id = auth.uid()));

DROP POLICY IF EXISTS "update_talk_config" ON talk_config;
CREATE POLICY "update_talk_config" ON talk_config FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM cc_activities a JOIN coaching_sessions s ON s.id = a.session_id JOIN coaches c ON c.id = s.coach_id WHERE a.id = talk_config.activity_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM cc_activities a JOIN coaching_sessions s ON s.id = a.session_id JOIN coaches c ON c.id = s.coach_id WHERE a.id = talk_config.activity_id AND c.user_id = auth.uid()));

DROP POLICY IF EXISTS "delete_talk_config" ON talk_config;
CREATE POLICY "delete_talk_config" ON talk_config FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM cc_activities a JOIN coaching_sessions s ON s.id = a.session_id JOIN coaches c ON c.id = s.coach_id WHERE a.id = talk_config.activity_id AND c.user_id = auth.uid()));

-- 17. parking_config
CREATE TABLE IF NOT EXISTS parking_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES cc_activities(id) ON DELETE CASCADE,
  tags text[] NOT NULL DEFAULT '{}',
  frequency text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(activity_id)
);

ALTER TABLE parking_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_parking_config" ON parking_config;
CREATE POLICY "select_parking_config" ON parking_config FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM cc_activities a WHERE a.id = parking_config.activity_id));

DROP POLICY IF EXISTS "insert_parking_config" ON parking_config;
CREATE POLICY "insert_parking_config" ON parking_config FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM cc_activities a JOIN coaching_sessions s ON s.id = a.session_id JOIN coaches c ON c.id = s.coach_id WHERE a.id = parking_config.activity_id AND c.user_id = auth.uid()));

DROP POLICY IF EXISTS "update_parking_config" ON parking_config;
CREATE POLICY "update_parking_config" ON parking_config FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM cc_activities a JOIN coaching_sessions s ON s.id = a.session_id JOIN coaches c ON c.id = s.coach_id WHERE a.id = parking_config.activity_id AND c.user_id = auth.uid()));

DROP POLICY IF EXISTS "delete_parking_config" ON parking_config;
CREATE POLICY "delete_parking_config" ON parking_config FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM cc_activities a JOIN coaching_sessions s ON s.id = a.session_id JOIN coaches c ON c.id = s.coach_id WHERE a.id = parking_config.activity_id AND c.user_id = auth.uid()));

-- 18. regimes
CREATE TABLE IF NOT EXISTS regimes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES coaching_sessions(id) ON DELETE CASCADE,
  day_number integer NOT NULL,
  activity_type text NOT NULL,
  item_reference text,
  instructions text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE regimes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_regimes" ON regimes;
CREATE POLICY "select_regimes" ON regimes FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM coaching_sessions s WHERE s.id = regimes.session_id));

DROP POLICY IF EXISTS "insert_regimes" ON regimes;
CREATE POLICY "insert_regimes" ON regimes FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM coaching_sessions s JOIN coaches c ON c.id = s.coach_id WHERE s.id = regimes.session_id AND c.user_id = auth.uid()));

DROP POLICY IF EXISTS "update_regimes" ON regimes;
CREATE POLICY "update_regimes" ON regimes FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM coaching_sessions s JOIN coaches c ON c.id = s.coach_id WHERE s.id = regimes.session_id AND c.user_id = auth.uid()));

DROP POLICY IF EXISTS "delete_regimes" ON regimes;
CREATE POLICY "delete_regimes" ON regimes FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM coaching_sessions s JOIN coaches c ON c.id = s.coach_id WHERE s.id = regimes.session_id AND c.user_id = auth.uid()));

-- 19. activity_completions
CREATE TABLE IF NOT EXISTS activity_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES coaching_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email text NOT NULL,
  activity_type text NOT NULL,
  item_id text,
  notes text,
  completed_date date NOT NULL,
  completed_at timestamptz DEFAULT now(),
  UNIQUE(session_id, user_id, activity_type, item_id, completed_date)
);

ALTER TABLE activity_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_activity_completions" ON activity_completions;
CREATE POLICY "select_activity_completions" ON activity_completions FOR SELECT
  TO authenticated USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM coaching_sessions s JOIN coaches c ON c.id = s.coach_id WHERE s.id = activity_completions.session_id AND c.user_id = auth.uid()));

DROP POLICY IF EXISTS "insert_activity_completions" ON activity_completions;
CREATE POLICY "insert_activity_completions" ON activity_completions FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "update_activity_completions" ON activity_completions;
CREATE POLICY "update_activity_completions" ON activity_completions FOR UPDATE
  TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "delete_activity_completions" ON activity_completions;
CREATE POLICY "delete_activity_completions" ON activity_completions FOR DELETE
  TO authenticated USING (user_id = auth.uid());

-- 20. talk_sessions
CREATE TABLE IF NOT EXISTS talk_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES coaching_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email text NOT NULL,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  duration_seconds integer DEFAULT 0,
  is_complete boolean DEFAULT false,
  metrics jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE talk_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_talk_sessions" ON talk_sessions;
CREATE POLICY "select_talk_sessions" ON talk_sessions FOR SELECT
  TO authenticated USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM coaching_sessions s JOIN coaches c ON c.id = s.coach_id WHERE s.id = talk_sessions.session_id AND c.user_id = auth.uid()));

DROP POLICY IF EXISTS "insert_talk_sessions" ON talk_sessions;
CREATE POLICY "insert_talk_sessions" ON talk_sessions FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "update_talk_sessions" ON talk_sessions;
CREATE POLICY "update_talk_sessions" ON talk_sessions FOR UPDATE
  TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "delete_talk_sessions" ON talk_sessions;
CREATE POLICY "delete_talk_sessions" ON talk_sessions FOR DELETE
  TO authenticated USING (user_id = auth.uid());

-- 21. talk_messages
CREATE TABLE IF NOT EXISTS talk_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  talk_session_id uuid NOT NULL REFERENCES talk_sessions(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  metrics jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE talk_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_talk_messages" ON talk_messages;
CREATE POLICY "select_talk_messages" ON talk_messages FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM talk_sessions ts WHERE ts.id = talk_messages.talk_session_id AND ts.user_id = auth.uid()));

DROP POLICY IF EXISTS "insert_talk_messages" ON talk_messages;
CREATE POLICY "insert_talk_messages" ON talk_messages FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM talk_sessions ts WHERE ts.id = talk_messages.talk_session_id AND ts.user_id = auth.uid()));

DROP POLICY IF EXISTS "delete_talk_messages" ON talk_messages;
CREATE POLICY "delete_talk_messages" ON talk_messages FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM talk_sessions ts WHERE ts.id = talk_messages.talk_session_id AND ts.user_id = auth.uid()));

-- 22. session_threads
CREATE TABLE IF NOT EXISTS session_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES coaching_sessions(id) ON DELETE CASCADE,
  goal_id uuid NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  thread_title text NOT NULL,
  allowed_tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  UNIQUE(session_id, goal_id)
);

ALTER TABLE session_threads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_session_threads" ON session_threads;
CREATE POLICY "select_session_threads" ON session_threads FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM goals g WHERE g.id = session_threads.goal_id AND g.user_id = auth.uid()));

DROP POLICY IF EXISTS "insert_session_threads" ON session_threads;
CREATE POLICY "insert_session_threads" ON session_threads FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM goals g WHERE g.id = session_threads.goal_id AND g.user_id = auth.uid()));

DROP POLICY IF EXISTS "delete_session_threads" ON session_threads;
CREATE POLICY "delete_session_threads" ON session_threads FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM goals g WHERE g.id = session_threads.goal_id AND g.user_id = auth.uid()));

-- 23. coach_stars
CREATE TABLE IF NOT EXISTS coach_stars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES coaching_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email text NOT NULL,
  activity_type text NOT NULL,
  reason text,
  stars integer NOT NULL DEFAULT 1,
  earned_at timestamptz DEFAULT now()
);

ALTER TABLE coach_stars ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_coach_stars" ON coach_stars;
CREATE POLICY "select_coach_stars" ON coach_stars FOR SELECT
  TO authenticated USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM coaching_sessions s JOIN coaches c ON c.id = s.coach_id WHERE s.id = coach_stars.session_id AND c.user_id = auth.uid()));

DROP POLICY IF EXISTS "insert_coach_stars" ON coach_stars;
CREATE POLICY "insert_coach_stars" ON coach_stars FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "delete_coach_stars" ON coach_stars;
CREATE POLICY "delete_coach_stars" ON coach_stars FOR DELETE
  TO authenticated USING (user_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_coaches_email ON coaches(email);
CREATE INDEX IF NOT EXISTS idx_coaches_user_id ON coaches(user_id);
CREATE INDEX IF NOT EXISTS idx_coachees_coach_id ON coachees(coach_id);
CREATE INDEX IF NOT EXISTS idx_capsules_coach_id ON capsules(coach_id);
CREATE INDEX IF NOT EXISTS idx_coaching_sessions_capsule_id ON coaching_sessions(capsule_id);
CREATE INDEX IF NOT EXISTS idx_coaching_sessions_coach_id ON coaching_sessions(coach_id);
CREATE INDEX IF NOT EXISTS idx_session_nominees_session_id ON session_nominees(session_id);
CREATE INDEX IF NOT EXISTS idx_session_purchases_user_id ON session_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_cc_activities_session_id ON cc_activities(session_id);
CREATE INDEX IF NOT EXISTS idx_activity_completions_user_session ON activity_completions(user_id, session_id);
CREATE INDEX IF NOT EXISTS idx_talk_sessions_user_session ON talk_sessions(user_id, session_id);
CREATE INDEX IF NOT EXISTS idx_coach_stars_user_session ON coach_stars(user_id, session_id);

-- Second pass: expand capsules/sessions SELECT policies to include nominees/purchases
DROP POLICY IF EXISTS "select_capsules" ON capsules;
CREATE POLICY "select_capsules" ON capsules FOR SELECT
  TO authenticated USING (
    (is_public AND is_active)
    OR EXISTS (SELECT 1 FROM coaches c WHERE c.id = capsules.coach_id AND (c.user_id = auth.uid() OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com'))
    OR EXISTS (SELECT 1 FROM coaching_sessions s JOIN session_nominees sn ON sn.session_id = s.id WHERE s.capsule_id = capsules.id AND sn.coachee_email = (auth.jwt() ->> 'email'))
    OR EXISTS (SELECT 1 FROM coaching_sessions s JOIN session_purchases sp ON sp.session_id = s.id WHERE s.capsule_id = capsules.id AND sp.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "select_coaching_sessions" ON coaching_sessions;
CREATE POLICY "select_coaching_sessions" ON coaching_sessions FOR SELECT
  TO authenticated USING (
    (is_public AND is_active)
    OR EXISTS (SELECT 1 FROM coaches c WHERE c.id = coaching_sessions.coach_id AND (c.user_id = auth.uid() OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com'))
    OR EXISTS (SELECT 1 FROM session_nominees sn WHERE sn.session_id = coaching_sessions.id AND sn.coachee_email = (auth.jwt() ->> 'email'))
    OR EXISTS (SELECT 1 FROM session_purchases sp WHERE sp.session_id = coaching_sessions.id AND sp.user_id = auth.uid())
  );
