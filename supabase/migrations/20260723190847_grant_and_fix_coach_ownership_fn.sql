-- Ensure the SECURITY DEFINER function is executable by authenticated role
GRANT EXECUTE ON FUNCTION is_coach_owner_by_id(uuid) TO authenticated;

-- Also make the function more robust: short-circuit for admin BEFORE checking coaches
CREATE OR REPLACE FUNCTION is_coach_owner_by_id(p_coach_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT
    (auth.jwt() ->> 'email') = 'deepagster@gmail.com'
    OR EXISTS (
      SELECT 1 FROM coaches c
      WHERE c.id = p_coach_id
      AND (
        c.user_id = auth.uid()
        OR c.email = (auth.jwt() ->> 'email')
      )
    );
$$;
