/*
  # Add parked_thoughts table and update sessions table

  1. New Tables
    - `parked_thoughts`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `session_id` (uuid, nullable, references sessions)
      - `content` (text) - the thought text
      - `status` (text) - 'pending', 'accepted', 'rejected'
      - `theme` (text, nullable) - user-assigned theme/group
      - `created_at` (timestamptz)
      - `reviewed_at` (timestamptz, nullable)

  2. Updated sessions table
    - Add `user_email` column for cross-device sync
    - Add `device_id` column to track originating device

  3. Security
    - RLS enabled on parked_thoughts
    - Users can only access their own parked thoughts
*/

-- Add columns to sessions if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sessions' AND column_name = 'user_email'
  ) THEN
    ALTER TABLE sessions ADD COLUMN user_email text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sessions' AND column_name = 'device_id'
  ) THEN
    ALTER TABLE sessions ADD COLUMN device_id text;
  END IF;
END $$;

-- Create parked_thoughts table
CREATE TABLE IF NOT EXISTS parked_thoughts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  content text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  theme text,
  created_at timestamptz DEFAULT now(),
  reviewed_at timestamptz
);

ALTER TABLE parked_thoughts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own thoughts"
  ON parked_thoughts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own thoughts"
  ON parked_thoughts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own thoughts"
  ON parked_thoughts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own thoughts"
  ON parked_thoughts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Index for fast user queries
CREATE INDEX IF NOT EXISTS idx_parked_thoughts_user_id ON parked_thoughts(user_id);
CREATE INDEX IF NOT EXISTS idx_parked_thoughts_session_id ON parked_thoughts(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_email ON sessions(user_email);
