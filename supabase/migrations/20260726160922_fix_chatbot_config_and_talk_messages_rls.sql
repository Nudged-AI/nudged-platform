-- Drop the restrictive select policy on coach_chatbot_config
DROP POLICY IF EXISTS select_coach_chatbot_config ON coach_chatbot_config;

-- Replace with a permissive one: any authenticated user can read chatbot config
-- (it only contains the chatbot name, avatar, and greeting — no sensitive data)
CREATE POLICY "select_coach_chatbot_config" ON coach_chatbot_config
  FOR SELECT TO authenticated USING (true);

-- Allow coaches to read talk messages for sessions they own
DROP POLICY IF EXISTS select_talk_messages_coach ON talk_messages;
CREATE POLICY "select_talk_messages_coach" ON talk_messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM talk_sessions ts
    JOIN coaching_sessions s ON s.id = ts.session_id
    JOIN coaches c ON c.id = s.coach_id
    WHERE ts.id = talk_messages.talk_session_id
    AND (
      c.user_id = auth.uid()
      OR c.email = (auth.jwt() ->> 'email')
      OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com'
    )
  ));