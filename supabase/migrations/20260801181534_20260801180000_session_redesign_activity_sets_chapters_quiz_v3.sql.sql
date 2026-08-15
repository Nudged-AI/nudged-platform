/*
# Session Redesign: Activity Sets, Chapters, Rich Notes, Quiz V3

## Purpose
Redesigns the coaching session to support:
1. Inline session form (no modal) with 2 parts: Session Details + Activities
2. Rich text session notes with chapters (mandatory + custom)
3. Multiple activity sets per session (one active at a time)
4. Quiz config changes: X questions per module per session, Y generated per module
5. File uploads at session-notes level and quiz level
6. Remove Submit — Save only; sessions are always editable

## New Tables
### session_notes_files — files uploaded by coach for AI session notes generation
### session_chapters — chapters for session notes (mandatory + custom)
### activity_sets — activity set groupings per session, one active at a time
### quiz_files — files uploaded at quiz level for AI question generation

## Modified Tables
### coaching_sessions — ADD capsule_type, notes_html, notes_generated_summary
### cc_activities — ADD activity_set_id, is_active_set
### quiz_modules — ADD questions_generated_per_module

## Security
- RLS enabled on all new tables with coach-ownership + coachee-nominee SELECT
*/

-- 1. Add columns to coaching_sessions
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='coaching_sessions' AND column_name='capsule_type') THEN
    ALTER TABLE coaching_sessions ADD COLUMN capsule_type text DEFAULT 'Coaching';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='coaching_sessions' AND column_name='notes_html') THEN
    ALTER TABLE coaching_sessions ADD COLUMN notes_html text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='coaching_sessions' AND column_name='notes_generated_summary') THEN
    ALTER TABLE coaching_sessions ADD COLUMN notes_generated_summary text;
  END IF;
END $$;

UPDATE coaching_sessions cs SET capsule_type = c.capsule_type FROM capsules c WHERE cs.capsule_id = c.id AND cs.capsule_type IS NULL;

-- 2. activity_sets
CREATE TABLE IF NOT EXISTS activity_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES coaching_sessions(id) ON DELETE CASCADE,
  set_name text NOT NULL DEFAULT 'Set A',
  set_label text NOT NULL DEFAULT 'A',
  is_active boolean NOT NULL DEFAULT false,
  is_locked boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE activity_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_activity_sets" ON activity_sets;
CREATE POLICY "select_activity_sets" ON activity_sets FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM coaching_sessions s WHERE s.id = activity_sets.session_id AND s.coach_id = auth.uid())
  OR EXISTS (SELECT 1 FROM session_nominees sn WHERE sn.session_id = activity_sets.session_id AND sn.coachee_email = (SELECT email FROM auth.users WHERE id = auth.uid()))
);
DROP POLICY IF EXISTS "insert_activity_sets" ON activity_sets;
CREATE POLICY "insert_activity_sets" ON activity_sets FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM coaching_sessions s WHERE s.id = activity_sets.session_id AND s.coach_id = auth.uid())
);
DROP POLICY IF EXISTS "update_activity_sets" ON activity_sets;
CREATE POLICY "update_activity_sets" ON activity_sets FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM coaching_sessions s WHERE s.id = activity_sets.session_id AND s.coach_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM coaching_sessions s WHERE s.id = activity_sets.session_id AND s.coach_id = auth.uid())
);
DROP POLICY IF EXISTS "delete_activity_sets" ON activity_sets;
CREATE POLICY "delete_activity_sets" ON activity_sets FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM coaching_sessions s WHERE s.id = activity_sets.session_id AND s.coach_id = auth.uid())
);

-- 3. Add activity_set_id to cc_activities
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cc_activities' AND column_name='activity_set_id') THEN
    ALTER TABLE cc_activities ADD COLUMN activity_set_id uuid REFERENCES activity_sets(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cc_activities' AND column_name='is_active_set') THEN
    ALTER TABLE cc_activities ADD COLUMN is_active_set boolean DEFAULT false;
  END IF;
END $$;

-- Backfill default activity sets
INSERT INTO activity_sets (session_id, set_name, set_label, is_active)
SELECT DISTINCT session_id, 'Set A', 'A', true FROM cc_activities WHERE activity_set_id IS NULL GROUP BY session_id ON CONFLICT DO NOTHING;
UPDATE cc_activities ca SET activity_set_id = asub.id, is_active_set = true FROM activity_sets asub WHERE asub.session_id = ca.session_id AND ca.activity_set_id IS NULL;

-- 4. session_notes_files
CREATE TABLE IF NOT EXISTS session_notes_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES coaching_sessions(id) ON DELETE CASCADE,
  file_name text NOT NULL, file_type text, storage_path text, extracted_text text DEFAULT '', uploaded_at timestamptz DEFAULT now()
);
ALTER TABLE session_notes_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_session_notes_files" ON session_notes_files;
CREATE POLICY "select_session_notes_files" ON session_notes_files FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM coaching_sessions s WHERE s.id = session_notes_files.session_id AND s.coach_id = auth.uid())
  OR EXISTS (SELECT 1 FROM session_nominees sn WHERE sn.session_id = session_notes_files.session_id AND sn.coachee_email = (SELECT email FROM auth.users WHERE id = auth.uid()))
);
DROP POLICY IF EXISTS "insert_session_notes_files" ON session_notes_files;
CREATE POLICY "insert_session_notes_files" ON session_notes_files FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM coaching_sessions s WHERE s.id = session_notes_files.session_id AND s.coach_id = auth.uid())
);
DROP POLICY IF EXISTS "update_session_notes_files" ON session_notes_files;
CREATE POLICY "update_session_notes_files" ON session_notes_files FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM coaching_sessions s WHERE s.id = session_notes_files.session_id AND s.coach_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM coaching_sessions s WHERE s.id = session_notes_files.session_id AND s.coach_id = auth.uid())
);
DROP POLICY IF EXISTS "delete_session_notes_files" ON session_notes_files;
CREATE POLICY "delete_session_notes_files" ON session_notes_files FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM coaching_sessions s WHERE s.id = session_notes_files.session_id AND s.coach_id = auth.uid())
);

-- 5. session_chapters
CREATE TABLE IF NOT EXISTS session_chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES coaching_sessions(id) ON DELETE CASCADE,
  title text NOT NULL, chapter_type text NOT NULL DEFAULT 'custom', position integer NOT NULL DEFAULT 0,
  content_html text DEFAULT '', is_ai_generated boolean DEFAULT false, generated_at timestamptz, created_at timestamptz DEFAULT now()
);
ALTER TABLE session_chapters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_session_chapters" ON session_chapters;
CREATE POLICY "select_session_chapters" ON session_chapters FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM coaching_sessions s WHERE s.id = session_chapters.session_id AND s.coach_id = auth.uid())
  OR EXISTS (SELECT 1 FROM session_nominees sn WHERE sn.session_id = session_chapters.session_id AND sn.coachee_email = (SELECT email FROM auth.users WHERE id = auth.uid()))
);
DROP POLICY IF EXISTS "insert_session_chapters" ON session_chapters;
CREATE POLICY "insert_session_chapters" ON session_chapters FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM coaching_sessions s WHERE s.id = session_chapters.session_id AND s.coach_id = auth.uid())
);
DROP POLICY IF EXISTS "update_session_chapters" ON session_chapters;
CREATE POLICY "update_session_chapters" ON session_chapters FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM coaching_sessions s WHERE s.id = session_chapters.session_id AND s.coach_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM coaching_sessions s WHERE s.id = session_chapters.session_id AND s.coach_id = auth.uid())
);
DROP POLICY IF EXISTS "delete_session_chapters" ON session_chapters;
CREATE POLICY "delete_session_chapters" ON session_chapters FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM coaching_sessions s WHERE s.id = session_chapters.session_id AND s.coach_id = auth.uid())
);

-- 6. quiz_files
CREATE TABLE IF NOT EXISTS quiz_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES cc_activities(id) ON DELETE CASCADE,
  file_name text NOT NULL, file_type text, storage_path text, extracted_text text DEFAULT '', uploaded_at timestamptz DEFAULT now()
);
ALTER TABLE quiz_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_quiz_files" ON quiz_files;
CREATE POLICY "select_quiz_files" ON quiz_files FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM cc_activities a JOIN coaching_sessions s ON s.id = a.session_id WHERE a.id = quiz_files.activity_id AND s.coach_id = auth.uid())
  OR EXISTS (SELECT 1 FROM cc_activities a JOIN coaching_sessions s ON s.id = a.session_id JOIN session_nominees sn ON sn.session_id = s.id WHERE a.id = quiz_files.activity_id AND sn.coachee_email = (SELECT email FROM auth.users WHERE id = auth.uid()))
);
DROP POLICY IF EXISTS "insert_quiz_files" ON quiz_files;
CREATE POLICY "insert_quiz_files" ON quiz_files FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM cc_activities a JOIN coaching_sessions s ON s.id = a.session_id WHERE a.id = quiz_files.activity_id AND s.coach_id = auth.uid())
);
DROP POLICY IF EXISTS "update_quiz_files" ON quiz_files;
CREATE POLICY "update_quiz_files" ON quiz_files FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM cc_activities a JOIN coaching_sessions s ON s.id = a.session_id WHERE a.id = quiz_files.activity_id AND s.coach_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM cc_activities a JOIN coaching_sessions s ON s.id = a.session_id WHERE a.id = quiz_files.activity_id AND s.coach_id = auth.uid())
);
DROP POLICY IF EXISTS "delete_quiz_files" ON quiz_files;
CREATE POLICY "delete_quiz_files" ON quiz_files FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM cc_activities a JOIN coaching_sessions s ON s.id = a.session_id WHERE a.id = quiz_files.activity_id AND s.coach_id = auth.uid())
);

-- 7. Add questions_generated_per_module to quiz_modules
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quiz_modules' AND column_name='questions_generated_per_module') THEN
    ALTER TABLE quiz_modules ADD COLUMN questions_generated_per_module integer DEFAULT 5;
  END IF;
END $$;

-- 8. Indexes
CREATE INDEX IF NOT EXISTS idx_activity_sets_session ON activity_sets(session_id);
CREATE INDEX IF NOT EXISTS idx_session_notes_files_session ON session_notes_files(session_id);
CREATE INDEX IF NOT EXISTS idx_session_chapters_session ON session_chapters(session_id);
CREATE INDEX IF NOT EXISTS idx_quiz_files_activity ON quiz_files(activity_id);
CREATE INDEX IF NOT EXISTS idx_cc_activities_set ON cc_activities(activity_set_id);