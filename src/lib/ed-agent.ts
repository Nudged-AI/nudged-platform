import { supabase } from '../supabase';
import { callLLM, parseJSON } from './llm';
import type { UserProfile } from '../supabase';

export interface EDAgentResult {
  root_pattern_summary: string;
  main_emotional_blocks: Array<{ emotion: string; protecting: string; blocking: string; unlock: string }>;
  hidden_beliefs: Array<{ belief: string; evidence: string; protects: string; blocks: string; replacement: string }>;
  stuck_point: string;
  new_thoughts: string[];
  recommended_nudges: string[];
  coaching_questions: string[];
  first_action: string;
  calm_on_summary: string;
}

export async function callEDAgent(
  profile: UserProfile,
  visionId: string
): Promise<EDAgentResult | null> {
  try {
    const age = profile.date_of_birth
      ? String(new Date().getFullYear() - new Date(profile.date_of_birth).getFullYear())
      : '';

    const [{ data: vision }, { data: challenges }, { data: blockers }, { data: wiseMessages }, { data: parkedThoughts }] =
      await Promise.all([
        supabase.from('visions').select('*').eq('id', visionId).maybeSingle(),
        supabase.from('vision_challenges').select('challenge_category,challenge_text,is_starred').eq('vision_id', visionId),
        supabase.from('vision_blockers').select('blocker_type,blocker_text').eq('vision_id', visionId),
        supabase.from('wise_advice_messages').select('role,content').eq('vision_id', visionId).eq('role', 'user').order('created_at', { ascending: false }).limit(10),
        supabase.from('parked_thoughts').select('content').eq('user_id', profile.id).limit(10),
      ]);

    const cats = [...new Set((challenges ?? []).map((c) => c.challenge_category))].join(', ');
    const specs = (challenges ?? []).slice(0, 8).map((c) => c.challenge_text).join('; ');
    const fears = (blockers ?? []).filter((b) => b.blocker_type === 'stuck').map((b) => b.blocker_text).join('; ');
    const avoided = (blockers ?? []).filter((b) => b.blocker_type === 'postpone').map((b) => b.blocker_text).join('; ');
    const questionsAsked = (wiseMessages ?? []).map((m) => m.content).join('; ');
    const parked = (parkedThoughts ?? []).map((t: { content: string }) => t.content).join('; ');

    const raw = await callLLM('ed_agent', {
      name: profile.full_name,
      age,
      gender: profile.gender,
      profession_type: profile.profession,
      job_business_details: profile.job_business_details,
      marital_status: profile.marital_status,
      children_details: String(profile.children),
      family_dependencies: `${profile.marital_status}, ${profile.children} children`,
      vision_name: vision?.vision_name ?? '',
      vision_description: vision?.vision_description ?? '',
      target_date: vision?.target_date ?? '',
      why_this_vision_matters: vision?.why_best_suited ?? '',
      what_if_not_achieved: vision?.what_if_not_achieved ?? '',
      ideal_person: vision?.ideal_person ?? '',
      selected_challenge_categories: cats,
      specific_challenges: specs,
      biggest_fears: fears,
      avoided_actions: avoided,
      current_behaviour_pattern: vision?.current_behaviour_pattern ?? '',
      distraction_pattern: vision?.distraction_pattern ?? '',
      questions_asked_over_time: questionsAsked,
      wise_advice_history: questionsAsked,
      parked_thoughts: parked,
      recent_concerns_shared: '',
    });

    return parseJSON<EDAgentResult>(raw);
  } catch (err) {
    console.error('ED Agent error', err);
    return null;
  }
}
