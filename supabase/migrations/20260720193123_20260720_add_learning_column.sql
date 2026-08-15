/*
# Add learning column to activity_completions

## Purpose
Store the coachee's reflection ("what did you learn?") alongside each activity completion.
This is required by the Tasks and Watch activities which now ask the coachee to write
a short learning note before they can mark the activity complete.

## Changes
- ALTER TABLE activity_completions ADD COLUMN learning text (nullable)
- No data migration needed (existing rows get NULL, which is fine)
- No RLS changes needed (table already has owner-scoped policies)
*/

ALTER TABLE activity_completions ADD COLUMN IF NOT EXISTS learning text;
