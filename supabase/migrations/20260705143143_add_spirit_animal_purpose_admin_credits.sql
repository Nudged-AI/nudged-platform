-- Animal/purpose profile for users
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS spirit_animal text;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS life_purpose text;

-- Admin controls: banned users list
CREATE TABLE IF NOT EXISTS admin_controls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE admin_controls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_read_controls" ON admin_controls FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_write_controls" ON admin_controls FOR INSERT TO authenticated WITH CHECK (
  (SELECT email FROM auth.users WHERE id = auth.uid()) = 'deepagster@gmail.com'
);
CREATE POLICY "admin_update_controls" ON admin_controls FOR UPDATE TO authenticated USING (
  (SELECT email FROM auth.users WHERE id = auth.uid()) = 'deepagster@gmail.com'
) WITH CHECK (
  (SELECT email FROM auth.users WHERE id = auth.uid()) = 'deepagster@gmail.com'
);

-- Banned users table
CREATE TABLE IF NOT EXISTS banned_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  banned_by text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE banned_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_read_banned" ON banned_users FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_write_banned" ON banned_users FOR INSERT TO authenticated WITH CHECK (
  (SELECT email FROM auth.users WHERE id = auth.uid()) = 'deepagster@gmail.com'
);
CREATE POLICY "admin_delete_banned" ON banned_users FOR DELETE TO authenticated USING (
  (SELECT email FROM auth.users WHERE id = auth.uid()) = 'deepagster@gmail.com'
);

-- Seed: global_maintenance key
INSERT INTO admin_controls (key, value) VALUES ('global_maintenance', 'false')
ON CONFLICT (key) DO NOTHING;

-- Credit extension requests
CREATE TABLE IF NOT EXISTS credit_extension_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  whatsapp text NOT NULL,
  amount_usd numeric NOT NULL DEFAULT 5,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE credit_extension_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_requests" ON credit_extension_requests FOR SELECT TO authenticated USING (auth.uid() = user_id OR (SELECT email FROM auth.users WHERE id = auth.uid()) = 'deepagster@gmail.com');
CREATE POLICY "insert_own_requests" ON credit_extension_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admin_update_requests" ON credit_extension_requests FOR UPDATE TO authenticated USING (
  (SELECT email FROM auth.users WHERE id = auth.uid()) = 'deepagster@gmail.com'
) WITH CHECK (
  (SELECT email FROM auth.users WHERE id = auth.uid()) = 'deepagster@gmail.com'
);
