
-- User credits table: tracks balance per user
CREATE TABLE IF NOT EXISTS user_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance_usd numeric(10,6) NOT NULL DEFAULT 5.0,
  total_granted_usd numeric(10,6) NOT NULL DEFAULT 5.0,
  total_spent_usd numeric(10,6) NOT NULL DEFAULT 0.0,
  is_exempt boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_credits_user_id_unique UNIQUE (user_id)
);

-- LLM usage log: tracks every call with cost
CREATE TABLE IF NOT EXISTS llm_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt_key text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  cost_usd numeric(10,6) NOT NULL DEFAULT 0.0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Credit top-up requests
CREATE TABLE IF NOT EXISTS credit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_usd numeric(10,2) NOT NULL DEFAULT 5.0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Admin exempt list entry for deepagster@gmail.com
-- We identify by email from auth.users
CREATE OR REPLACE FUNCTION auto_grant_credit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  user_email text;
BEGIN
  SELECT email INTO user_email FROM auth.users WHERE id = NEW.id;
  INSERT INTO user_credits (user_id, balance_usd, total_granted_usd, is_exempt)
  VALUES (
    NEW.id,
    5.0,
    5.0,
    (user_email = 'deepagster@gmail.com')
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger: auto-create credit row when user_profiles row is created
DROP TRIGGER IF EXISTS on_profile_created_grant_credit ON user_profiles;
CREATE TRIGGER on_profile_created_grant_credit
  AFTER INSERT ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION auto_grant_credit();

-- Backfill existing users
INSERT INTO user_credits (user_id, balance_usd, total_granted_usd, is_exempt)
SELECT 
  up.id,
  5.0,
  5.0,
  (au.email = 'deepagster@gmail.com')
FROM user_profiles up
JOIN auth.users au ON au.id = up.id
ON CONFLICT (user_id) DO NOTHING;

-- RLS
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_credits" ON user_credits FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own_credits" ON user_credits FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own_credits" ON user_credits FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_delete_own_credits" ON user_credits FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "users_read_own_usage" ON llm_usage_log FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own_usage" ON llm_usage_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own_usage" ON llm_usage_log FOR UPDATE TO authenticated USING (false);
CREATE POLICY "users_delete_own_usage" ON llm_usage_log FOR DELETE TO authenticated USING (false);

CREATE POLICY "users_read_own_requests" ON credit_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own_requests" ON credit_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own_requests" ON credit_requests FOR UPDATE TO authenticated USING (false);
CREATE POLICY "users_delete_own_requests" ON credit_requests FOR DELETE TO authenticated USING (false);

-- Service role bypasses RLS — edge functions use service role key for admin operations
