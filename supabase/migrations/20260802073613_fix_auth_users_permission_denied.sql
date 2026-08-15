
-- Replace coachee_can_access_session to use JWT email instead of querying auth.users
CREATE OR REPLACE FUNCTION public.coachee_can_access_session(p_session_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
SELECT
EXISTS (
SELECT 1 FROM public.session_nominees sn
WHERE sn.session_id = p_session_id
AND sn.coachee_email = (auth.jwt() ->> 'email')
)
OR
EXISTS (
SELECT 1 FROM public.session_purchases sp
WHERE sp.session_id = p_session_id
AND sp.user_id = auth.uid()
)
OR
EXISTS (
SELECT 1
FROM public.capsule_enrollments ce
JOIN public.coaching_sessions cs ON cs.capsule_id = ce.capsule_id
WHERE cs.id = p_session_id
AND ce.coachee_email = (auth.jwt() ->> 'email')
);
$$;

-- Also fix session_chapters SELECT policy to not query auth.users
DROP POLICY IF EXISTS "select_session_chapters" ON session_chapters;
CREATE POLICY "select_session_chapters" ON session_chapters FOR SELECT TO authenticated
  USING (
    coach_owns_session(session_id)
    OR EXISTS (
      SELECT 1 FROM capsule_enrollments ce
      JOIN coaching_sessions s ON s.capsule_id = ce.capsule_id
      WHERE s.id = session_chapters.session_id
        AND ce.coachee_email = (auth.jwt() ->> 'email')
    )
  );

-- Also fix activity_sets SELECT to not query auth.users
DROP POLICY IF EXISTS "select_activity_sets" ON activity_sets;
CREATE POLICY "select_activity_sets" ON activity_sets FOR SELECT TO authenticated
  USING (
    coach_owns_session(session_id)
    OR EXISTS (
      SELECT 1 FROM session_nominees sn
      WHERE sn.session_id = activity_sets.session_id
        AND sn.coachee_email = (auth.jwt() ->> 'email')
    )
  );

-- Also fix session_notes_files SELECT to not query auth.users
DROP POLICY IF EXISTS "select_session_notes_files" ON session_notes_files;
CREATE POLICY "select_session_notes_files" ON session_notes_files FOR SELECT TO authenticated
  USING (
    coach_owns_session(session_id)
    OR EXISTS (
      SELECT 1 FROM session_nominees sn
      WHERE sn.session_id = session_notes_files.session_id
        AND sn.coachee_email = (auth.jwt() ->> 'email')
    )
  );
