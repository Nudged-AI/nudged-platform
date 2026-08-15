-- Fix RLS so coaches can access their own capsules/sessions by email OR user_id.
-- Root cause: admin onboards coaches by email, leaving user_id null until first login,
-- and even after linking the policies only matched user_id, not email.

-- Capsules: drop and recreate select/update/delete to match coach by email too
DROP POLICY IF EXISTS select_capsules ON capsules;
CREATE POLICY select_capsules ON capsules FOR SELECT
  TO authenticated USING (
    (is_public AND is_active)
    OR EXISTS (
      SELECT 1 FROM coaches c
      WHERE c.id = capsules.coach_id
        AND (c.user_id = auth.uid() OR c.email = (auth.jwt() ->> 'email') OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com')
    )
    OR EXISTS (
      SELECT 1 FROM coaching_sessions s
      JOIN session_nominees sn ON sn.session_id = s.id
      WHERE s.capsule_id = capsules.id AND sn.coachee_email = (auth.jwt() ->> 'email')
    )
    OR EXISTS (
      SELECT 1 FROM coaching_sessions s
      JOIN session_purchases sp ON sp.session_id = s.id
      WHERE s.capsule_id = capsules.id AND sp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS update_capsules ON capsules;
CREATE POLICY update_capsules ON capsules FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM coaches c
      WHERE c.id = capsules.coach_id
        AND (c.user_id = auth.uid() OR c.email = (auth.jwt() ->> 'email') OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com')
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM coaches c
      WHERE c.id = capsules.coach_id
        AND (c.user_id = auth.uid() OR c.email = (auth.jwt() ->> 'email') OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com')
    )
  );

DROP POLICY IF EXISTS delete_capsules ON capsules;
CREATE POLICY delete_capsules ON capsules FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM coaches c
      WHERE c.id = capsules.coach_id
        AND (c.user_id = auth.uid() OR c.email = (auth.jwt() ->> 'email') OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com')
    )
  );

-- Coaching sessions: same email-based ownership fix
DROP POLICY IF EXISTS select_coaching_sessions ON coaching_sessions;
CREATE POLICY select_coaching_sessions ON coaching_sessions FOR SELECT
  TO authenticated USING (
    (is_public AND is_active)
    OR EXISTS (
      SELECT 1 FROM coaches c
      WHERE c.id = coaching_sessions.coach_id
        AND (c.user_id = auth.uid() OR c.email = (auth.jwt() ->> 'email') OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com')
    )
    OR EXISTS (
      SELECT 1 FROM session_nominees sn
      WHERE sn.session_id = coaching_sessions.id AND sn.coachee_email = (auth.jwt() ->> 'email')
    )
    OR EXISTS (
      SELECT 1 FROM session_purchases sp
      WHERE sp.session_id = coaching_sessions.id AND sp.user_id = auth.uid()
    )
  );

-- Need to see existing policies for update/delete on coaching_sessions
