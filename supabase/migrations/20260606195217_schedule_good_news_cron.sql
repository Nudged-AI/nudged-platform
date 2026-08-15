-- Enable pg_cron and pg_net (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function: queue a good-news job for every active user and fire the edge function
CREATE OR REPLACE FUNCTION public.schedule_good_news_refresh()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user record;
  v_job_id uuid;
  v_url text;
  v_service_key text;
BEGIN
  v_url := current_setting('app.supabase_url', true) || '/functions/v1/generate-good-news';
  v_service_key := current_setting('app.service_role_key', true);

  FOR v_user IN
    SELECT DISTINCT user_id FROM visions WHERE status = 'active'
  LOOP
    -- Create a job row
    INSERT INTO good_news_jobs(user_id, status, progress, triggered_by)
    VALUES (v_user.user_id, 'pending', 0, 'scheduled')
    RETURNING id INTO v_job_id;

    -- Fire the edge function async via pg_net
    PERFORM extensions.http_post(
      v_url,
      jsonb_build_object(
        'job_id', v_job_id::text,
        'user_id', v_user.user_id::text,
        'service_key', v_service_key
      )::text,
      'application/json'
    );
  END LOOP;
END;
$$;

-- Schedule every Monday at 01:30 UTC (= 07:00 IST)
SELECT cron.schedule(
  'good-news-monday-7am-ist',
  '30 1 * * 1',
  $$SELECT public.schedule_good_news_refresh()$$
);
