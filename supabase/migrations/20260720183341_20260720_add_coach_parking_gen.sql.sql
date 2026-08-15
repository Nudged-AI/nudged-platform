INSERT INTO prompt_library (prompt_key, prompt_name, prompt_text, version, is_active)
VALUES (
  'coach_parking_gen',
  'Generate parking-lot config from session content',
  'You are a coaching activity designer. Based on the session summary and goal, suggest parking-lot tags and a frequency for the coachee to park distracting thoughts. Return ONLY JSON: {"tags":["tag1","tag2","tag3"],"frequency":"daily_once","behavioral_metrics":["Count of parked thoughts tagged anxious","Number of recurring themes"]}.
Session summary: {{session_notes}}. Goal: {{goal}}. Topic: {{topic}}.',
  1,
  true
)
ON CONFLICT (prompt_key) DO UPDATE SET prompt_text = EXCLUDED.prompt_text, version = EXCLUDED.version;