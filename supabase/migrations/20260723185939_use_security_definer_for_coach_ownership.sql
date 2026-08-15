-- Replace inline subquery checks with a SECURITY DEFINER function
-- so coaching_sessions INSERT/UPDATE/DELETE are never blocked by JWT edge cases

CREATE OR REPLACE FUNCTION is_coach_owner_by_id(p_coach_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM coaches c
    WHERE c.id = p_coach_id
    AND (
      c.user_id = auth.uid()
      OR c.email = (auth.jwt() ->> 'email')
      OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com'
    )
  );
$$;

-- Re-create coaching_sessions policies using the function
DROP POLICY IF EXISTS "insert_coaching_sessions" ON coaching_sessions;
CREATE POLICY "insert_coaching_sessions" ON coaching_sessions FOR INSERT
  TO authenticated WITH CHECK (is_coach_owner_by_id(coach_id));

DROP POLICY IF EXISTS "update_coaching_sessions" ON coaching_sessions;
CREATE POLICY "update_coaching_sessions" ON coaching_sessions FOR UPDATE
  TO authenticated
  USING (is_coach_owner_by_id(coach_id))
  WITH CHECK (is_coach_owner_by_id(coach_id));

DROP POLICY IF EXISTS "delete_coaching_sessions" ON coaching_sessions;
CREATE POLICY "delete_coaching_sessions" ON coaching_sessions FOR DELETE
  TO authenticated USING (is_coach_owner_by_id(coach_id));

-- Also re-create the cc_activities / child-table policies using the same function
-- so every write in the session-save flow goes through the same robust check

DROP POLICY IF EXISTS "insert_cc_activities" ON cc_activities;
CREATE POLICY "insert_cc_activities" ON cc_activities FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM coaching_sessions s WHERE s.id = cc_activities.session_id AND is_coach_owner_by_id(s.coach_id))
  );

DROP POLICY IF EXISTS "update_cc_activities" ON cc_activities;
CREATE POLICY "update_cc_activities" ON cc_activities FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM coaching_sessions s WHERE s.id = cc_activities.session_id AND is_coach_owner_by_id(s.coach_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM coaching_sessions s WHERE s.id = cc_activities.session_id AND is_coach_owner_by_id(s.coach_id)));

DROP POLICY IF EXISTS "delete_cc_activities" ON cc_activities;
CREATE POLICY "delete_cc_activities" ON cc_activities FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM coaching_sessions s WHERE s.id = cc_activities.session_id AND is_coach_owner_by_id(s.coach_id)));

DROP POLICY IF EXISTS "insert_session_nominees" ON session_nominees;
CREATE POLICY "insert_session_nominees" ON session_nominees FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM coaching_sessions s WHERE s.id = session_nominees.session_id AND is_coach_owner_by_id(s.coach_id)));

DROP POLICY IF EXISTS "delete_session_nominees" ON session_nominees;
CREATE POLICY "delete_session_nominees" ON session_nominees FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM coaching_sessions s WHERE s.id = session_nominees.session_id AND is_coach_owner_by_id(s.coach_id)));

DROP POLICY IF EXISTS "insert_session_passkeys" ON session_passkeys;
CREATE POLICY "insert_session_passkeys" ON session_passkeys FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM coaching_sessions s WHERE s.id = session_passkeys.session_id AND is_coach_owner_by_id(s.coach_id)));

DROP POLICY IF EXISTS "delete_session_passkeys" ON session_passkeys;
CREATE POLICY "delete_session_passkeys" ON session_passkeys FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM coaching_sessions s WHERE s.id = session_passkeys.session_id AND is_coach_owner_by_id(s.coach_id)));
