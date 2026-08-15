
CREATE OR REPLACE FUNCTION grant_credit(p_user_id uuid, p_amount numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE user_credits
  SET
    balance_usd = balance_usd + p_amount,
    total_granted_usd = total_granted_usd + p_amount,
    updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;
