-- Enable pg_cron and pg_net
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Job tracking table
CREATE TABLE IF NOT EXISTS good_news_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','done','failed')),
  progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  triggered_by text NOT NULL DEFAULT 'manual' CHECK (triggered_by IN ('manual','scheduled')),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE good_news_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_jobs" ON good_news_jobs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_jobs" ON good_news_jobs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_jobs" ON good_news_jobs FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_jobs" ON good_news_jobs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Index for quick status lookups
CREATE INDEX IF NOT EXISTS good_news_jobs_user_status_idx ON good_news_jobs(user_id, status, created_at DESC);
