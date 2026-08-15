
-- Atomic credit deduction function (called from edge functions via service role)
CREATE OR REPLACE FUNCTION deduct_credit(p_user_id uuid, p_cost numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE user_credits
  SET
    balance_usd = GREATEST(0, balance_usd - p_cost),
    total_spent_usd = total_spent_usd + p_cost,
    updated_at = now()
  WHERE user_id = p_user_id AND is_exempt = false;
END;
$$;

-- Function to get full admin view of users (called from edge function with service role)
CREATE OR REPLACE FUNCTION admin_user_stats()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  balance_usd numeric,
  total_granted_usd numeric,
  total_spent_usd numeric,
  is_exempt boolean,
  call_count bigint,
  last_used_at timestamptz,
  created_at timestamptz
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    uc.user_id,
    au.email,
    up.full_name,
    uc.balance_usd,
    uc.total_granted_usd,
    uc.total_spent_usd,
    uc.is_exempt,
    COUNT(ul.id) AS call_count,
    MAX(ul.created_at) AS last_used_at,
    uc.created_at
  FROM user_credits uc
  JOIN auth.users au ON au.id = uc.user_id
  LEFT JOIN user_profiles up ON up.id = uc.user_id
  LEFT JOIN llm_usage_log ul ON ul.user_id = uc.user_id
  GROUP BY uc.user_id, au.email, up.full_name, uc.balance_usd, uc.total_granted_usd, uc.total_spent_usd, uc.is_exempt, uc.created_at
  ORDER BY uc.total_spent_usd DESC;
END;
$$;
