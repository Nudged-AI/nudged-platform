/*
# Phase 1: Drop all existing coach-related RLS policies

Drops every policy on all 12 coach-related tables so we can then
replace the helper functions (which policies depend on) and recreate
all policies cleanly in Phase 2.
*/

-- Drop all policies on these tables
DROP POLICY IF EXISTS select_coaches ON coaches;
DROP POLICY IF EXISTS insert_coaches ON coaches;
DROP POLICY IF EXISTS update_coaches ON coaches;
DROP POLICY IF EXISTS delete_coaches ON coaches;

DROP POLICY IF EXISTS select_capsules ON capsules;
DROP POLICY IF EXISTS insert_capsules ON capsules;
DROP POLICY IF EXISTS update_capsules ON capsules;
DROP POLICY IF EXISTS delete_capsules ON capsules;

DROP POLICY IF EXISTS select_coaching_sessions ON coaching_sessions;
DROP POLICY IF EXISTS insert_coaching_sessions ON coaching_sessions;
DROP POLICY IF EXISTS update_coaching_sessions ON coaching_sessions;
DROP POLICY IF EXISTS delete_coaching_sessions ON coaching_sessions;

DROP POLICY IF EXISTS select_cc_activities ON cc_activities;
DROP POLICY IF EXISTS insert_cc_activities ON cc_activities;
DROP POLICY IF EXISTS update_cc_activities ON cc_activities;
DROP POLICY IF EXISTS delete_cc_activities ON cc_activities;

DROP POLICY IF EXISTS select_cc_tasks ON cc_tasks;
DROP POLICY IF EXISTS insert_cc_tasks ON cc_tasks;
DROP POLICY IF EXISTS update_cc_tasks ON cc_tasks;
DROP POLICY IF EXISTS delete_cc_tasks ON cc_tasks;

DROP POLICY IF EXISTS select_session_passkeys ON session_passkeys;
DROP POLICY IF EXISTS insert_session_passkeys ON session_passkeys;
DROP POLICY IF EXISTS update_session_passkeys ON session_passkeys;
DROP POLICY IF EXISTS delete_session_passkeys ON session_passkeys;

DROP POLICY IF EXISTS select_session_nominees ON session_nominees;
DROP POLICY IF EXISTS insert_session_nominees ON session_nominees;
DROP POLICY IF EXISTS update_session_nominees ON session_nominees;
DROP POLICY IF EXISTS delete_session_nominees ON session_nominees;

DROP POLICY IF EXISTS select_coachees ON coachees;
DROP POLICY IF EXISTS insert_coachees ON coachees;
DROP POLICY IF EXISTS update_coachees ON coachees;
DROP POLICY IF EXISTS delete_coachees ON coachees;

DROP POLICY IF EXISTS select_coach_goals ON coach_goals;
DROP POLICY IF EXISTS insert_coach_goals ON coach_goals;
DROP POLICY IF EXISTS update_coach_goals ON coach_goals;
DROP POLICY IF EXISTS delete_coach_goals ON coach_goals;

DROP POLICY IF EXISTS select_session_purchases ON session_purchases;
DROP POLICY IF EXISTS insert_session_purchases ON session_purchases;
DROP POLICY IF EXISTS update_session_purchases ON session_purchases;
DROP POLICY IF EXISTS delete_session_purchases ON session_purchases;

DROP POLICY IF EXISTS select_coach_stars ON coach_stars;
DROP POLICY IF EXISTS insert_coach_stars ON coach_stars;
DROP POLICY IF EXISTS update_coach_stars ON coach_stars;
DROP POLICY IF EXISTS delete_coach_stars ON coach_stars;

DROP POLICY IF EXISTS select_activity_completions ON activity_completions;
DROP POLICY IF EXISTS insert_activity_completions ON activity_completions;
DROP POLICY IF EXISTS update_activity_completions ON activity_completions;
DROP POLICY IF EXISTS delete_activity_completions ON activity_completions;
