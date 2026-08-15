/*
# Add preferred_app column to user_profiles

## Purpose
Stores the user's default app choice ('buddy' or 'parker') so they skip
the app selection screen on subsequent logins. NULL means no default chosen yet.

## Changes
- ALTER TABLE user_profiles ADD COLUMN preferred_app text (nullable)
- No data migration needed (existing rows get NULL)
- No RLS changes needed (table already has owner-scoped policies)
*/

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS preferred_app text;
