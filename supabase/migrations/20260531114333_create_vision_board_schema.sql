/*
  # Vision Board Schema

  ## New Tables
  1. `visions` - Core vision board entries (max 3 per user)
     - id, user_id, vision_name, vision_description, vision_image_url
     - target_date, why_best_suited, for_whom, what_if_not_achieved
     - ideal_person, status (active/archived)
     - calm_points (accumulated from closed challenges)

  2. `vision_actions` - Actions taken in last 30 days toward vision
     - id, vision_id, user_id, action_text, is_llm_suggested, checked

  3. `vision_challenges` - Challenges per vision
     - id, vision_id, user_id, challenge_category, challenge_text
     - is_llm_suggested, is_starred (top 3), is_closed, closed_at

  4. `vision_roadmap` - 5-step roadmap per vision
     - id, vision_id, user_id, step_number, title, description
     - target_period, status (completed/in_progress/upcoming)
     - is_user_edited

  5. `vision_habits` - Generated habits per challenge category
     - id, vision_id, user_id, challenge_category, habit_text
     - habit_type (belief-breaking/habit/self-advice/identity/action)
     - when_to_flash, nudge_json (full JSON from LLM)
     - is_custom, thumbs_up

  6. `prompt_library` - Versioned prompt templates
     - id, prompt_key, prompt_name, prompt_text, version, is_active

  ## Security: RLS enabled on all tables
*/

-- Visions
CREATE TABLE IF NOT EXISTS visions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vision_name text NOT NULL DEFAULT '',
  vision_description text NOT NULL DEFAULT '',
  vision_image_url text DEFAULT '',
  target_date date,
  why_best_suited text DEFAULT '',
  for_whom text[] DEFAULT '{}',
  for_whom_custom text DEFAULT '',
  what_if_not_achieved text DEFAULT '',
  ideal_person text DEFAULT '',
  current_behaviour_pattern text DEFAULT '',
  distraction_pattern text DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  calm_points integer NOT NULL DEFAULT 0,
  vision_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE visions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own visions"
  ON visions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own visions"
  ON visions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own visions"
  ON visions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own visions"
  ON visions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Actions taken (last 30 days)
CREATE TABLE IF NOT EXISTS vision_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vision_id uuid NOT NULL REFERENCES visions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_text text NOT NULL DEFAULT '',
  is_llm_suggested boolean NOT NULL DEFAULT false,
  is_checked boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE vision_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own vision_actions"
  ON vision_actions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own vision_actions"
  ON vision_actions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own vision_actions"
  ON vision_actions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own vision_actions"
  ON vision_actions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Challenges
CREATE TABLE IF NOT EXISTS vision_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vision_id uuid NOT NULL REFERENCES visions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_category text NOT NULL DEFAULT '',
  challenge_text text NOT NULL DEFAULT '',
  is_llm_suggested boolean NOT NULL DEFAULT false,
  is_starred boolean NOT NULL DEFAULT false,
  is_closed boolean NOT NULL DEFAULT false,
  closed_at timestamptz,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE vision_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own vision_challenges"
  ON vision_challenges FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own vision_challenges"
  ON vision_challenges FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own vision_challenges"
  ON vision_challenges FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own vision_challenges"
  ON vision_challenges FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Stuck reasons and postpone reasons stored as challenges with type
CREATE TABLE IF NOT EXISTS vision_blockers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vision_id uuid NOT NULL REFERENCES visions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocker_type text NOT NULL DEFAULT 'stuck', -- 'stuck' | 'postpone'
  blocker_text text NOT NULL DEFAULT '',
  is_llm_suggested boolean NOT NULL DEFAULT false,
  is_checked boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE vision_blockers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own vision_blockers"
  ON vision_blockers FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own vision_blockers"
  ON vision_blockers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own vision_blockers"
  ON vision_blockers FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own vision_blockers"
  ON vision_blockers FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Roadmap milestones
CREATE TABLE IF NOT EXISTS vision_roadmap (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vision_id uuid NOT NULL REFERENCES visions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  step_number integer NOT NULL DEFAULT 1,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  target_period text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'upcoming', -- 'completed' | 'in_progress' | 'upcoming'
  is_user_edited boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE vision_roadmap ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own vision_roadmap"
  ON vision_roadmap FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own vision_roadmap"
  ON vision_roadmap FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own vision_roadmap"
  ON vision_roadmap FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own vision_roadmap"
  ON vision_roadmap FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Habits / nudges (stored per vision, displayed in Nudges tab)
CREATE TABLE IF NOT EXISTS vision_habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vision_id uuid NOT NULL REFERENCES visions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_category text NOT NULL DEFAULT '',
  habit_text text NOT NULL DEFAULT '',
  habit_description text DEFAULT '',
  habit_type text DEFAULT 'habit', -- belief-breaking/habit/self-advice/identity/action
  when_to_flash text DEFAULT '',
  likely_hidden_belief text DEFAULT '',
  emotional_block text DEFAULT '',
  is_custom boolean NOT NULL DEFAULT false,
  thumbs_up boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE vision_habits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own vision_habits"
  ON vision_habits FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own vision_habits"
  ON vision_habits FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own vision_habits"
  ON vision_habits FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own vision_habits"
  ON vision_habits FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Wise advice chat history
CREATE TABLE IF NOT EXISTS wise_advice_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vision_id uuid REFERENCES visions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'quick', -- 'quick' | 'deep'
  role text NOT NULL DEFAULT 'user', -- 'user' | 'assistant'
  content text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE wise_advice_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own wise_advice_messages"
  ON wise_advice_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own wise_advice_messages"
  ON wise_advice_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own wise_advice_messages"
  ON wise_advice_messages FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own wise_advice_messages"
  ON wise_advice_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Prompt library (versioned, editable prompts)
CREATE TABLE IF NOT EXISTS prompt_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_key text NOT NULL, -- e.g. 'actions_suggestions', 'challenge_categories', 'challenges', 'stuck_reasons', 'postpone_reasons', 'roadmap', 'habits', 'wise_advice_quick', 'wise_advice_deep', 'quote_of_day', 'story_of_challenge', 'good_news'
  prompt_name text NOT NULL DEFAULT '',
  prompt_text text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE prompt_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read prompt_library"
  ON prompt_library FOR SELECT TO authenticated USING (true);

-- Only service role can modify prompts (managed via migrations)
-- No insert/update/delete policies for regular users

-- Nudge daily log (track what was shown each day)
CREATE TABLE IF NOT EXISTS nudge_daily_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vision_id uuid REFERENCES visions(id) ON DELETE SET NULL,
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  concern_text text DEFAULT '',
  habit_ids uuid[] DEFAULT '{}',
  quote_text text DEFAULT '',
  quote_author text DEFAULT '',
  story_title text DEFAULT '',
  story_text text DEFAULT '',
  good_news_items jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE nudge_daily_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own nudge_daily_log"
  ON nudge_daily_log FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own nudge_daily_log"
  ON nudge_daily_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own nudge_daily_log"
  ON nudge_daily_log FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own nudge_daily_log"
  ON nudge_daily_log FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_visions_user_id ON visions(user_id);
CREATE INDEX IF NOT EXISTS idx_vision_challenges_vision_id ON vision_challenges(vision_id);
CREATE INDEX IF NOT EXISTS idx_vision_roadmap_vision_id ON vision_roadmap(vision_id, step_number);
CREATE INDEX IF NOT EXISTS idx_vision_habits_vision_id ON vision_habits(vision_id);
CREATE INDEX IF NOT EXISTS idx_wise_advice_user_vision ON wise_advice_messages(user_id, vision_id);
CREATE INDEX IF NOT EXISTS idx_prompt_library_key ON prompt_library(prompt_key, is_active);
