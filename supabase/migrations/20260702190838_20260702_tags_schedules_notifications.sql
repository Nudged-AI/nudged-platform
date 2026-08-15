/*
# Tags, Schedules, Notifications, Image Support, General Goal

## Summary
Adds all the foundational schema for the major new features:
tags on thoughts, thought scheduling/reminders, in-app notifications,
image uploads, highlighted thoughts, reorder support, general goal flag,
and custom milestone labels.

## Changes to parked_items
- `tags` text[] — user-assigned tags (tasks, challenge, gratitude, ideas, to-do, notes + custom)
- `is_highlighted` boolean — user can highlight a thought yellow
- `sort_order` integer — for manual reordering of active thoughts
- `image_url` text — URL of attached image in Supabase storage

## Changes to goals
- `is_general` boolean — marks the auto-created "General" goal (no target date, no milestones)
- `milestone_labels` text[] — optional custom labels for the 5 milestones

## New table: custom_tags
Stores user-specific tags beyond the 6 default tags.
- `user_id`, `tag_name` (unique per user)

## New table: thought_schedules
Stores reminder schedules per thought (daily/weekly/monthly).
- `frequency`, `time_of_day`, `day_of_week`, `date_of_month`, `end_date`
- `last_notified_at` — when the reminder last fired

## New table: notifications
In-app notification records created when a scheduled reminder fires.
- `parked_item_id`, `message`, `is_read`

## Security
All new tables use RLS with authenticated user ownership policies.
*/

-- Extend parked_items
ALTER TABLE parked_items ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
ALTER TABLE parked_items ADD COLUMN IF NOT EXISTS is_highlighted boolean NOT NULL DEFAULT false;
ALTER TABLE parked_items ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE parked_items ADD COLUMN IF NOT EXISTS image_url text;

-- Extend goals
ALTER TABLE goals ADD COLUMN IF NOT EXISTS is_general boolean NOT NULL DEFAULT false;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS milestone_labels text[];

-- Custom tags per user
CREATE TABLE IF NOT EXISTS custom_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  tag_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, tag_name)
);
ALTER TABLE custom_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_custom_tags" ON custom_tags;
CREATE POLICY "select_own_custom_tags" ON custom_tags FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_custom_tags" ON custom_tags;
CREATE POLICY "insert_own_custom_tags" ON custom_tags FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_custom_tags" ON custom_tags;
CREATE POLICY "delete_own_custom_tags" ON custom_tags FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Thought schedules (reminders)
CREATE TABLE IF NOT EXISTS thought_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  parked_item_id uuid NOT NULL REFERENCES parked_items(id) ON DELETE CASCADE,
  frequency text NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  time_of_day text NOT NULL DEFAULT '09:00',
  day_of_week integer CHECK (day_of_week BETWEEN 0 AND 6),
  date_of_month integer CHECK (date_of_month BETWEEN 1 AND 31),
  end_date date,
  is_active boolean NOT NULL DEFAULT true,
  last_notified_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(parked_item_id)
);
ALTER TABLE thought_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_schedules" ON thought_schedules;
CREATE POLICY "select_own_schedules" ON thought_schedules FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_schedules" ON thought_schedules;
CREATE POLICY "insert_own_schedules" ON thought_schedules FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_schedules" ON thought_schedules;
CREATE POLICY "update_own_schedules" ON thought_schedules FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_schedules" ON thought_schedules;
CREATE POLICY "delete_own_schedules" ON thought_schedules FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- In-app notifications
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  parked_item_id uuid REFERENCES parked_items(id) ON DELETE CASCADE,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_notifications" ON notifications;
CREATE POLICY "select_own_notifications" ON notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_notifications" ON notifications;
CREATE POLICY "insert_own_notifications" ON notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_notifications" ON notifications;
CREATE POLICY "update_own_notifications" ON notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_notifications" ON notifications;
CREATE POLICY "delete_own_notifications" ON notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);
