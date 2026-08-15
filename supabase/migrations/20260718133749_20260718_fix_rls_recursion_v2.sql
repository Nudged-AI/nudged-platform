-- Break infinite recursion between coaching_sessions and session_nominees RLS
-- by using SECURITY DEFINER helper functions that bypass RLS for ownership checks

CREATE OR REPLACE FUNCTION coach_owns_session(p_session_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM coaching_sessions s
    JOIN coaches c ON c.id = s.coach_id
    WHERE s.id = p_session_id
      AND (c.user_id = auth.uid() OR c.email = (auth.jwt() ->> 'email') OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com')
  );
$$;

CREATE OR REPLACE FUNCTION user_is_session_nominee(p_session_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM session_nominees sn
    WHERE sn.session_id = p_session_id
      AND sn.coachee_email = (auth.jwt() ->> 'email')
  );
$$;

CREATE OR REPLACE FUNCTION user_purchased_session(p_session_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM session_purchases sp
    WHERE sp.session_id = p_session_id
      AND sp.user_id = auth.uid()
  );
$$;

-- Rewrite coaching_sessions policies using helper functions
DROP POLICY IF EXISTS select_coaching_sessions ON coaching_sessions;
CREATE POLICY select_coaching_sessions ON coaching_sessions FOR SELECT
  TO authenticated USING (
    (is_public AND is_active)
    OR coach_owns_session(id)
    OR user_is_session_nominee(id)
    OR user_purchased_session(id)
  );

-- Rewrite session_nominees policies using helper functions
DROP POLICY IF EXISTS select_session_nominees ON session_nominees;
CREATE POLICY select_session_nominees ON session_nominees FOR SELECT
  TO authenticated USING (
    coach_owns_session(session_id)
    OR (auth.jwt() ->> 'email') = 'deepagster@gmail.com'
    OR coachee_email = (auth.jwt() ->> 'email')
  );

DROP POLICY IF EXISTS insert_session_nominees ON session_nominees;
CREATE POLICY insert_session_nominees ON session_nominees
  TO authenticated WITH CHECK (coach_owns_session(session_id));

DROP POLICY IF EXISTS delete_session_nominees ON session_nominees;
CREATE POLICY delete_session_nominees ON session_nominees
  TO authenticated USING (coach_owns_session(session_id));

-- Rewrite session_purchases select policy
DROP POLICY IF EXISTS select_session_purchases ON session_purchases;
CREATE POLICY select_session_purchases ON session_purchases FOR SELECT
  TO authenticated USING (
    user_id = auth.uid()
    OR coach_owns_session(session_id)
  );
