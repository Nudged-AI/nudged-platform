-- Add config column to cc_activities for storing activity-level config (frequency, metrics, etc.)
ALTER TABLE cc_activities
  ADD COLUMN IF NOT EXISTS config jsonb DEFAULT '{}'::jsonb;

-- Update coach prompt library to match new mockup-driven output shapes

-- TALK: probe questions + end goal + duration + frequency + behavioral metrics
UPDATE prompt_library SET prompt_text =
'You are a coaching chatbot designer. Based on the session summary and goal, generate:
1. probe_questions: 5-8 questions the chatbot asks the coachee to surface their challenge
2. end_goal: one-sentence outcome the coachee works toward
3. duration_minutes: suggested minutes per session (integer)
4. frequency: one of daily_once | daily_twice | weekly | alternate
5. behavioral_metrics: 2-4 measurable prompts (e.g. "Count of negative words like can''t, won''t, never")
Return ONLY JSON: {"probe_questions":["..."],"end_goal":"...","duration_minutes":10,"frequency":"daily_once","behavioral_metrics":["..."]}.
Session summary: {{session_notes}}. Goal: {{goal}}. Topic: {{topic}}.'
WHERE prompt_key = 'coach_talk_gen';

-- TASKS: simple list of action items (no sub-modality/frequency per mockup)
UPDATE prompt_library SET prompt_text =
'You are a coaching activity designer. Based on the session summary and goal, generate 5-8 simple action-item tasks the coachee should do. Return ONLY JSON: {"tasks":["task 1","task 2",...]}.
Session summary: {{session_notes}}. Goal: {{goal}}. Topic: {{topic}}.'
WHERE prompt_key = 'coach_tasks_gen';

-- KNOWLEDGE: 30-word knowledge points
UPDATE prompt_library SET prompt_text =
'You are a coaching content designer. Based on the session summary and goal, generate 8-12 crisp knowledge points (max 30 words each) the coachee should remember. Return ONLY JSON: {"kps":["point 1","point 2",...]}.
Session summary: {{session_notes}}. Goal: {{goal}}. Topic: {{topic}}.'
WHERE prompt_key = 'coach_knowledge_gen';

-- WATCH: direct YouTube URLs
UPDATE prompt_library SET prompt_text =
'You are a coaching content curator. Based on the session summary and goal, suggest 3-5 YouTube videos. For each, provide a direct video URL (https://www.youtube.com/watch?v=XXXX), a short title, and a reflection question. Return ONLY JSON: {"watch":[{"url":"https://www.youtube.com/watch?v=...","title":"...","question":"..."}]}.
Session summary: {{session_notes}}. Goal: {{goal}}. Topic: {{topic}}.'
WHERE prompt_key = 'coach_watch_gen';

-- QUIZ: modules with pipe-format question entries (Q|opt1|opt2|opt3|opt4|answer_letter)
UPDATE prompt_library SET prompt_text =
'You are a coaching curriculum designer. Based on the session summary and goal, generate a quiz broken into up to 6 modules. For each module, produce 5 questions. Return ONLY JSON: {"modules":[{"title":"Module name","frequency":"daily_once","time_of_day":"anytime","questions":["Question text?|Option A|Option B|Option C|Option D|A","Question text?|Option A|Option B|Option C|Option D|C"]}]}.
Rules: each question string uses | as delimiter, last field is the correct answer letter (A/B/C/D). frequency is one of daily_once|daily_twice|weekly. time_of_day is one of anytime|morning|evening.
Session summary: {{session_notes}}. Goal: {{goal}}. Topic: {{topic}}. Audience: {{audience}}. Days to next session: {{days}}.'
WHERE prompt_key = 'coach_quiz_gen';

-- PARKING: tags + frequency + behavioral metrics
UPDATE prompt_library SET prompt_text =
'You are a coaching activity designer. Based on the session summary and goal, suggest parking-lot tags and a frequency for the coachee to park distracting thoughts. Return ONLY JSON: {"tags":["tag1","tag2","tag3"],"frequency":"daily_once","behavioral_metrics":["Count of parked thoughts tagged anxious","Number of recurring themes"]}.
Session summary: {{session_notes}}. Goal: {{goal}}. Topic: {{topic}}.'
WHERE prompt_key = 'coach_parking_gen';