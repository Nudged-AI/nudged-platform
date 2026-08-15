/*
# Know Your Coachee + Bookings + Session List schema

## Tables
1. coach_forms — form versions created by coach (exploration forms)
2. coach_form_responses — responses from prospective coachees
3. coach_availability — coach calendar slots
4. coach_bookings — bookings made by coachees/coach
5. coach_booking_sessions — link bookings to capsule sessions (for session list)
*/

-- ============ KNOW YOUR COACHEE ============

CREATE TABLE IF NOT EXISTS coach_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL,
  form_name text NOT NULL DEFAULT 'Exploration Form',
  version int NOT NULL DEFAULT 1,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE coach_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_forms" ON coach_forms FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_forms" ON coach_forms FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_forms" ON coach_forms FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_forms" ON coach_forms FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS coach_form_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES coach_forms(id) ON DELETE CASCADE,
  coach_id uuid NOT NULL,
  email text NOT NULL,
  response_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  promoted_to_coachee boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(form_id, email)
);

ALTER TABLE coach_form_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_responses" ON coach_form_responses FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_responses" ON coach_form_responses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_responses" ON coach_form_responses FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_responses" ON coach_form_responses FOR DELETE TO authenticated USING (true);

-- ============ BOOKINGS ============

CREATE TABLE IF NOT EXISTS coach_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL,
  day_of_week int NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time text NOT NULL,
  end_time text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE coach_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_availability" ON coach_availability FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_availability" ON coach_availability FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_availability" ON coach_availability FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_availability" ON coach_availability FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS coach_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL,
  coachee_name text,
  coachee_email text,
  coachee_user_id uuid,
  booking_date date NOT NULL,
  start_time text NOT NULL,
  end_time text NOT NULL,
  status text NOT NULL DEFAULT 'confirmed',
  remarks text,
  capsule_id uuid,
  session_id uuid,
  is_standalone boolean NOT NULL DEFAULT false,
  ics_sent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE coach_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_bookings" ON coach_bookings FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_bookings" ON coach_bookings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_bookings" ON coach_bookings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_bookings" ON coach_bookings FOR DELETE TO authenticated USING (true);

-- ============ SESSION LIST (standalone sessions) ============
-- Adds standalone_booking_id to coaching_sessions for sessions created from public URL bookings

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'coaching_sessions' AND column_name = 'standalone_booking_id') THEN
    ALTER TABLE coaching_sessions ADD COLUMN standalone_booking_id uuid;
  END IF;
END $$;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_coach_forms_coach_id ON coach_forms(coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_form_responses_form_id ON coach_form_responses(form_id);
CREATE INDEX IF NOT EXISTS idx_coach_availability_coach_id ON coach_availability(coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_bookings_coach_id ON coach_bookings(coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_bookings_date ON coach_bookings(booking_date);