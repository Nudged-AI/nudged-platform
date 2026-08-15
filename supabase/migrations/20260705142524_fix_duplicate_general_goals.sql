-- Delete duplicate General goals, keeping only the earliest created one per user
DELETE FROM goals
WHERE is_general = true
  AND id NOT IN (
    SELECT DISTINCT ON (user_id) id
    FROM goals
    WHERE is_general = true
    ORDER BY user_id, created_at ASC
  );
