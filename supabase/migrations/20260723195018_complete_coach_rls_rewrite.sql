/*
# Phase 2: Replace helper functions and create all new RLS policies

Replaced all old helper functions with clean SECURITY DEFINER versions,
then created consistent 4-policy CRUD sets on all coach-related tables.
Also added policies on session_metrics table.

Functions: is_coach(), is_coach_for(uuid), coach_owns_session(uuid),
user_is_session_nominee(uuid), user_purchased_session(uuid)
All SECURITY DEFINER → bypass RLS → no recursion.

Tables: coaches, capsules, coaching_sessions, cc_activities, cc_tasks,
session_passkeys, session_nominees, coachees, coach_goals,
session_purchases, coach_stars, activity_completions, session_metrics

No data modified.
*/

-- ============================================================
-- 1. Replace helper functions
-- ============================================================
DROP FUNCTION IF EXISTS is_coach_owner_by_id(uuid);
DROP FUNCTION IF EXISTS coach_owns_session(uuid);
DROP FUNCTION IF EXISTS user_is_session_nominee(uuid);
DROP FUNCTION IF EXISTS user_purchased_session(uuid);

CREATE OR REPLACE FUNCTION is_coach()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM coaches c
    WHERE c.is_active = true
    AND (c.user_id = auth.uid() OR c.email = (auth.jwt() ->> 'email'))
  );
$$;

CREATE OR REPLACE FUNCTION is_coach_for(p_coach_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
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

CREATE OR REPLACE FUNCTION coach_owns_session(p_session_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1
    FROM coaching_sessions s
    JOIN coaches c ON c.id = s.coach_id
    WHERE s.id = p_session_id
    AND (
      c.user_id = auth.uid()
      OR c.email = (auth.jwt() ->> 'email')
      OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com'
    )
  );
$$;

CREATE OR REPLACE FUNCTION user_is_session_nominee(p_session_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM session_nominees sn
    WHERE sn.session_id = p_session_id
    AND sn.coachee_email = (auth.jwt() ->> 'email')
  );
$$;

CREATE OR REPLACE FUNCTION user_purchased_session(p_session_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM session_purchases sp
    WHERE sp.session_id = p_session_id
    AND sp.user_id = auth.uid()
  );
$$;

-- ============================================================
-- 2. coaches
-- ============================================================
ALTER TABLE coaches ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_coaches ON coaches FOR SELECT
  TO authenticated USING (true);
CREATE POLICY insert_coaches ON coaches FOR INSERT
  TO authenticated WITH CHECK ((auth.jwt() ->> 'email') = 'deepagster@gmail.com');
CREATE POLICY update_coaches ON coaches FOR UPDATE
  TO authenticated
  USING ((auth.jwt() ->> 'email') = 'deepagster@gmail.com' OR auth.uid() = user_id)
  WITH CHECK ((auth.jwt() ->> 'email') = 'deepagster@gmail.com' OR auth.uid() = user_id);
CREATE POLICY delete_coaches ON coaches FOR DELETE
  TO authenticated USING ((auth.jwt() ->> 'email') = 'deepagster@gmail.com');

-- ============================================================
-- 3. capsules
-- ============================================================
ALTER TABLE capsules ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_capsules ON capsules FOR SELECT
  TO authenticated
  USING ((is_public AND is_active) OR is_coach_for(coach_id));
CREATE POLICY insert_capsules ON capsules FOR INSERT
  TO authenticated WITH CHECK (is_coach_for(coach_id));
CREATE POLICY update_capsules ON capsules FOR UPDATE
  TO authenticated
  USING (is_coach_for(coach_id))
  WITH CHECK (is_coach_for(coach_id));
CREATE POLICY delete_capsules ON capsules FOR DELETE
  TO authenticated USING (is_coach_for(coach_id));

-- ============================================================
-- 4. coaching_sessions
-- ============================================================
ALTER TABLE coaching_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_coaching_sessions ON coaching_sessions FOR SELECT
  TO authenticated
  USING (
    (is_public AND is_active)
    OR coach_owns_session(id)
    OR user_is_session_nominee(id)
    OR user_purchased_session(id)
  );
CREATE POLICY insert_coaching_sessions ON coaching_sessions FOR INSERT
  TO authenticated WITH CHECK (is_coach_for(coach_id));
CREATE POLICY update_coaching_sessions ON coaching_sessions FOR UPDATE
  TO authenticated
  USING (is_coach_for(coach_id))
  WITH CHECK (is_coach_for(coach_id));
CREATE POLICY delete_coaching_sessions ON coaching_sessions FOR DELETE
  TO authenticated USING (is_coach_for(coach_id));

-- ============================================================
-- 5. cc_activities
-- ============================================================
ALTER TABLE cc_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_cc_activities ON cc_activities FOR SELECT
  TO authenticated USING (coach_owns_session(session_id));
CREATE POLICY insert_cc_activities ON cc_activities FOR INSERT
  TO authenticated WITH CHECK (coach_owns_session(session_id));
CREATE POLICY update_cc_activities ON cc_activities FOR UPDATE
  TO authenticated
  USING (coach_owns_session(session_id))
  WITH CHECK (coach_owns_session(session_id));
CREATE POLICY delete_cc_activities ON cc_activities FOR DELETE
  TO authenticated USING (coach_owns_session(session_id));

-- ============================================================
-- 6. cc_tasks
-- ============================================================
ALTER TABLE cc_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_cc_tasks ON cc_tasks FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM cc_activities a
    WHERE a.id = cc_tasks.activity_id
    AND coach_owns_session(a.session_id)
  ));
CREATE POLICY insert_cc_tasks ON cc_tasks FOR INSERT
  TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM cc_activities a
    WHERE a.id = cc_tasks.activity_id
    AND coach_owns_session(a.session_id)
  ));
CREATE POLICY update_cc_tasks ON cc_tasks FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM cc_activities a
    WHERE a.id = cc_tasks.activity_id
    AND coach_owns_session(a.session_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM cc_activities a
    WHERE a.id = cc_tasks.activity_id
    AND coach_owns_session(a.session_id)
  ));
CREATE POLICY delete_cc_tasks ON cc_tasks FOR DELETE
  TO authenticated USING (EXISTS (
    SELECT 1 FROM cc_activities a
    WHERE a.id = cc_tasks.activity_id
    AND coach_owns_session(a.session_id)
  ));

-- ============================================================
-- 7. session_passkeys
-- ============================================================
ALTER TABLE session_passkeys ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_session_passkeys ON session_passkeys FOR SELECT
  TO authenticated USING (coach_owns_session(session_id));
CREATE POLICY insert_session_passkeys ON session_passkeys FOR INSERT
  TO authenticated WITH CHECK (coach_owns_session(session_id));
CREATE POLICY update_session_passkeys ON session_passkeys FOR UPDATE
  TO authenticated
  USING (coach_owns_session(session_id))
  WITH CHECK (coach_owns_session(session_id));
CREATE POLICY delete_session_passkeys ON session_passkeys FOR DELETE
  TO authenticated USING (coach_owns_session(session_id));

-- ============================================================
-- 8. session_nominees
-- ============================================================
ALTER TABLE session_nominees ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_session_nominees ON session_nominees FOR SELECT
  TO authenticated
  USING (coach_owns_session(session_id) OR coachee_email = (auth.jwt() ->> 'email'));
CREATE POLICY insert_session_nominees ON session_nominees FOR INSERT
  TO authenticated WITH CHECK (coach_owns_session(session_id));
CREATE POLICY update_session_nominees ON session_nominees FOR UPDATE
  TO authenticated
  USING (coach_owns_session(session_id))
  WITH CHECK (coach_owns_session(session_id));
CREATE POLICY delete_session_nominees ON session_nominees FOR DELETE
  TO authenticated USING (coach_owns_session(session_id));

-- ============================================================
-- 9. coachees
-- ============================================================
ALTER TABLE coachees ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_coachees ON coachees FOR SELECT
  TO authenticated USING (is_coach_for(coach_id));
CREATE POLICY insert_coachees ON coachees FOR INSERT
  TO authenticated WITH CHECK (is_coach_for(coach_id));
CREATE POLICY update_coachees ON coachees FOR UPDATE
  TO authenticated
  USING (is_coach_for(coach_id))
  WITH CHECK (is_coach_for(coach_id));
CREATE POLICY delete_coachees ON coachees FOR DELETE
  TO authenticated USING (is_coach_for(coach_id));

-- ============================================================
-- 10. coach_goals
-- ============================================================
ALTER TABLE coach_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_coach_goals ON coach_goals FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM coachees c
    WHERE c.id = coach_goals.coachee_id
    AND is_coach_for(c.coach_id)
  ));
CREATE POLICY insert_coach_goals ON coach_goals FOR INSERT
  TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM coachees c
    WHERE c.id = coach_goals.coachee_id
    AND is_coach_for(c.coach_id)
  ));
CREATE POLICY update_coach_goals ON coach_goals FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM coachees c
    WHERE c.id = coach_goals.coachee_id
    AND is_coach_for(c.coach_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM coachees c
    WHERE c.id = coach_goals.coachee_id
    AND is_coach_for(c.coach_id)
  ));
CREATE POLICY delete_coach_goals ON coach_goals FOR DELETE
  TO authenticated USING (EXISTS (
    SELECT 1 FROM coachees c
    WHERE c.id = coach_goals.coachee_id
    AND is_coach_for(c.coach_id)
  ));

-- ============================================================
-- 11. session_purchases
-- ============================================================
ALTER TABLE session_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_session_purchases ON session_purchases FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR coach_owns_session(session_id));
CREATE POLICY insert_session_purchases ON session_purchases FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY update_session_purchases ON session_purchases FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY delete_session_purchases ON session_purchases FOR DELETE
  TO authenticated USING (user_id = auth.uid());

-- ============================================================
-- 12. coach_stars
-- ============================================================
ALTER TABLE coach_stars ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_coach_stars ON coach_stars FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR coach_owns_session(session_id));
CREATE POLICY insert_coach_stars ON coach_stars FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY update_coach_stars ON coach_stars FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY delete_coach_stars ON coach_stars FOR DELETE
  TO authenticated USING (user_id = auth.uid());

-- ============================================================
-- 13. activity_completions
-- ============================================================
ALTER TABLE activity_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_activity_completions ON activity_completions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR coach_owns_session(session_id));
CREATE POLICY insert_activity_completions ON activity_completions FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY update_activity_completions ON activity_completions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY delete_activity_completions ON activity_completions FOR DELETE
  TO authenticated USING (user_id = auth.uid());

-- ============================================================
-- 14. session_metrics (policies were dropped to free the function dependency)
-- ============================================================
ALTER TABLE session_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_session_metrics ON session_metrics FOR SELECT
  TO authenticated USING (coach_owns_session(session_id));
CREATE POLICY insert_session_metrics ON session_metrics FOR INSERT
  TO authenticated WITH CHECK (coach_owns_session(session_id));
CREATE POLICY update_session_metrics ON session_metrics FOR UPDATE
  TO authenticated
  USING (coach_owns_session(session_id))
  WITH CHECK (coach_owns_session(session_id));
CREATE POLICY delete_session_metrics ON session_metrics FOR DELETE
  TO authenticated USING (coach_owns_session(session_id));
