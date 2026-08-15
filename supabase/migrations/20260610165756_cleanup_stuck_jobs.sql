UPDATE good_news_jobs SET status = 'failed', progress = 0
WHERE status = 'running' AND started_at < NOW() - INTERVAL '2 minutes';