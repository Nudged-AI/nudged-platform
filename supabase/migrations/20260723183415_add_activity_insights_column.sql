ALTER TABLE thought_analyses ADD COLUMN IF NOT EXISTS activity_insights jsonb DEFAULT '{}';
