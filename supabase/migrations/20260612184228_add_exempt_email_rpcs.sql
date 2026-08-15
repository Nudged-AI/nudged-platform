-- RPC to add an exempt email (SECURITY DEFINER runs as owner, bypasses RLS)
CREATE OR REPLACE FUNCTION add_exempt_email(p_email text, p_added_by text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO exempt_emails (email, added_by) VALUES (lower(trim(p_email)), p_added_by)
  ON CONFLICT (email) DO NOTHING;
END;
$$;

-- RPC to remove an exempt email
CREATE OR REPLACE FUNCTION remove_exempt_email(p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM exempt_emails WHERE email = lower(trim(p_email));
END;
$$;

-- RPC to list all exempt emails
CREATE OR REPLACE FUNCTION list_exempt_emails()
RETURNS TABLE (email text, added_by text, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT ee.email, ee.added_by, ee.created_at FROM exempt_emails ee ORDER BY ee.created_at DESC;
END;
$$;
