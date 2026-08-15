INSERT INTO prompt_library (prompt_key, prompt_name, prompt_text, version, is_active)
VALUES (
  'coach_goals_gen',
  'Generate session goals from uploaded content',
  'You are a coaching curriculum designer. Analyze the uploaded session content (transcript, slides, notes, video description) and derive clear, quantified session goals for the coachee. Return ONLY a JSON array of strings (1-3 goals), each goal must include a measurable target (e.g. "Increase daily deep-work minutes from 30 to 60 by next session"). Uploaded content: {{content}}. Topic: {{topic}}. Audience: {{audience}}.',
  1,
  true
)
ON CONFLICT (prompt_key) DO UPDATE SET prompt_text = EXCLUDED.prompt_text, version = EXCLUDED.version;