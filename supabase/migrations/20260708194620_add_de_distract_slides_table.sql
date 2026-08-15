/*
# Create de_distract_slides table

Persists generated De-distract slide content per user so slides survive page
refreshes and accumulate over time rather than being regenerated on every open.

1. New Tables
- `de_distract_slides`
  - `id` (uuid, primary key)
  - `user_id` (uuid, FK to auth.users, cascade delete)
  - `batch_num` (integer) — which generation batch this slide belongs to
  - `slide_type` (text) — 'animal' | 'thread' | 'quote' | 'news'
  - `slide_data` (jsonb) — full slide payload serialised as JSON
  - `created_at` (timestamptz)

2. Security
- RLS enabled; authenticated users can only access their own rows.
- 4 policies: select/insert/update/delete scoped to auth.uid() = user_id.

3. Notes
- No UPDATE needed in practice; rows are insert-only. Policy included for completeness.
- Index on (user_id, created_at) for efficient ordered fetches per user.
*/

CREATE TABLE IF NOT EXISTS de_distract_slides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  batch_num integer NOT NULL DEFAULT 0,
  slide_type text NOT NULL,
  slide_data jsonb NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS de_distract_slides_user_created
  ON de_distract_slides (user_id, created_at ASC);

ALTER TABLE de_distract_slides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_de_distract_slides" ON de_distract_slides;
CREATE POLICY "select_own_de_distract_slides" ON de_distract_slides FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_de_distract_slides" ON de_distract_slides;
CREATE POLICY "insert_own_de_distract_slides" ON de_distract_slides FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_de_distract_slides" ON de_distract_slides;
CREATE POLICY "update_own_de_distract_slides" ON de_distract_slides FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_de_distract_slides" ON de_distract_slides;
CREATE POLICY "delete_own_de_distract_slides" ON de_distract_slides FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
