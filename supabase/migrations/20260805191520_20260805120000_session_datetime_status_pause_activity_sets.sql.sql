/*
# Session datetime/status, talk session pause, activity set fixes

## Changes

### 1. coaching_sessions: add session_from_dt, session_to_dt, status
- `session_from_dt` (timestamptz, nullable) — session start date & time
- `session_to_dt` (timestamptz, nullable) — session end date & time
- `status` (text, default 'Draft') — auto-computed: 'Scheduled' or 'Completed'

### 2. talk_sessions: add is_paused, paused_at, total_paused_seconds
- `is_paused` (boolean, default false) — whether session is currently paused
- `paused_at` (timestamptz, nullable) — when pause started
- `total_paused_seconds` (integer, default 0) — accumulated paused time

### 3. activity_sets: add is_editable
- `is_editable` (boolean, default true) — whether coach can still edit this set

## Notes
- session_date column remains for backward compatibility
- status is computed client-side based on session_from_dt vs now
- No data loss — all new columns are nullable or have safe defaults
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'coaching_sessions' AND column_name = 'session_from_dt') THEN
    ALTER TABLE coaching_sessions ADD COLUMN session_from_dt timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'coaching_sessions' AND column_name = 'session_to_dt') THEN
    ALTER TABLE coaching_sessions ADD COLUMN session_to_dt timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'coaching_sessions' AND column_name = 'status') THEN
    ALTER TABLE coaching_sessions ADD COLUMN status text NOT NULL DEFAULT 'Draft';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'talk_sessions' AND column_name = 'is_paused') THEN
    ALTER TABLE talk_sessions ADD COLUMN is_paused boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'talk_sessions' AND column_name = 'paused_at') THEN
    ALTER TABLE talk_sessions ADD COLUMN paused_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'talk_sessions' AND column_name = 'total_paused_seconds') THEN
    ALTER TABLE talk_sessions ADD COLUMN total_paused_seconds integer NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activity_sets' AND column_name = 'is_editable') THEN
    ALTER TABLE activity_sets ADD COLUMN is_editable boolean NOT NULL DEFAULT true;
  END IF;
END $$;