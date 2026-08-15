/*
# v1.9.0 Thread Tags & Reminders

1. goals: add active_tag_names (text[]) — up to 20 UI-visible tags per thread
2. custom_tags: add goal_id (nullable FK) — thread-scoped custom tags
3. thought_schedules: add specific_datetime (timestamptz) for one-time reminders;
   drop old frequency check and re-create to allow 'once'
*/

-- goals: active tags per thread (max 20 enforced in app)
ALTER TABLE goals ADD COLUMN IF NOT EXISTS active_tag_names text[] NOT NULL DEFAULT '{}';

-- custom_tags: make tags thread-scoped (null = global/legacy)
ALTER TABLE custom_tags ADD COLUMN IF NOT EXISTS goal_id uuid REFERENCES goals(id) ON DELETE CASCADE;

-- thought_schedules: one-time reminder support
ALTER TABLE thought_schedules ADD COLUMN IF NOT EXISTS specific_datetime timestamptz;

-- Drop old frequency check constraint if it exists, then recreate allowing 'once'
DO $$ BEGIN
  ALTER TABLE thought_schedules DROP CONSTRAINT IF EXISTS thought_schedules_frequency_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE thought_schedules ADD CONSTRAINT thought_schedules_frequency_check
  CHECK (frequency IN ('once','daily','weekly','monthly'));
