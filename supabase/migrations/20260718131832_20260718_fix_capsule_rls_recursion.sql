-- Break infinite recursion: rewrite select_capsules without querying coaching_sessions
DROP POLICY IF EXISTS select_capsules ON capsules;
CREATE POLICY select_capsules ON capsules FOR SELECT
  TO authenticated USING (
    (is_public AND is_active)
    OR EXISTS (
      SELECT 1 FROM coaches c
      WHERE c.id = capsules.coach_id
        AND (c.user_id = auth.uid() OR c.email = (auth.jwt() ->> 'email') OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com')
    )
  );
