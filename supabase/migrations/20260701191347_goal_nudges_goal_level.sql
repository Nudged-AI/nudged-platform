-- Move goal_nudges to goal-level (not per milestone)
-- Add unique constraint on goal_id alone; keep milestone_index for backward compat but default to -1 for goal-level
ALTER TABLE goal_nudges ADD COLUMN IF NOT EXISTS is_goal_level boolean DEFAULT false;

-- Unique index on goal_id for goal-level nudges
CREATE UNIQUE INDEX IF NOT EXISTS goal_nudges_goal_level_idx ON goal_nudges (goal_id) WHERE is_goal_level = true;
