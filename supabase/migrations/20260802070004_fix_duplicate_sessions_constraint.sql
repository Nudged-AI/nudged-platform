-- Remove duplicate sessions, keeping the one with the most data
WITH dups AS (
  SELECT session_uid, id,
    ROW_NUMBER() OVER (
      PARTITION BY session_uid
      ORDER BY 
        (notes_html IS NOT NULL) DESC,
        (SELECT count(*) FROM cc_activities WHERE session_id = coaching_sessions.id) DESC,
        created_at DESC
    ) as rn
  FROM coaching_sessions
  WHERE session_uid IN (
    SELECT session_uid FROM coaching_sessions GROUP BY session_uid HAVING count(*) > 1
  )
)
DELETE FROM coaching_sessions WHERE id IN (SELECT id FROM dups WHERE rn > 1);

-- Prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS coaching_sessions_session_uid_unique ON coaching_sessions (session_uid);
