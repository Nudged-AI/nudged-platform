-- Add FITB (Fill-in-the-blank) to visions table
ALTER TABLE visions ADD COLUMN IF NOT EXISTS fitb_responses jsonb DEFAULT '[]';

-- Add sub_milestones to vision_roadmap
ALTER TABLE vision_roadmap ADD COLUMN IF NOT EXISTS sub_milestones jsonb DEFAULT '[]';

-- Add is_selected to vision_challenges (user selected = actively dealing with it)
ALTER TABLE vision_challenges ADD COLUMN IF NOT EXISTS is_selected boolean DEFAULT false;

-- Add is_starred and is_closed to vision_blockers (same mechanic as challenges)
ALTER TABLE vision_blockers ADD COLUMN IF NOT EXISTS is_starred boolean DEFAULT false;
ALTER TABLE vision_blockers ADD COLUMN IF NOT EXISTS is_resolved boolean DEFAULT false;

-- Add URL citation to nudge_daily_log and good_news_cache
CREATE TABLE IF NOT EXISTS good_news_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vision_id uuid NOT NULL REFERENCES visions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  news_data jsonb NOT NULL DEFAULT '[]',
  stories_data jsonb NOT NULL DEFAULT '[]',
  generated_at timestamptz DEFAULT now(),
  vision_updated_at timestamptz
);

ALTER TABLE good_news_cache ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'good_news_cache' AND policyname = 'select_own_good_news_cache') THEN
    CREATE POLICY "select_own_good_news_cache" ON good_news_cache FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'good_news_cache' AND policyname = 'insert_own_good_news_cache') THEN
    CREATE POLICY "insert_own_good_news_cache" ON good_news_cache FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'good_news_cache' AND policyname = 'update_own_good_news_cache') THEN
    CREATE POLICY "update_own_good_news_cache" ON good_news_cache FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'good_news_cache' AND policyname = 'delete_own_good_news_cache') THEN
    CREATE POLICY "delete_own_good_news_cache" ON good_news_cache FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;
