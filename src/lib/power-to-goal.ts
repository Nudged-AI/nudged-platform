// Programmatic Power to Goal metric — counts confidence vs doubt words
// in coachee inputs (talk messages, task notes, watch notes, parking thoughts).
// No LLM is used. Word lists are heuristic.

const CONFIDENCE_WORDS = [
  'confident', 'sure', 'certain', 'clear', 'ready', 'determined', 'committed',
  'achieve', 'accomplish', 'succeed', 'success', 'will', 'can', 'able',
  'focused', 'motivated', 'excited', 'positive', 'strong', 'capable',
  'believe', 'trust', 'faith', 'optimistic', 'hopeful', 'driven',
  'goal', 'plan', 'action', 'progress', 'improve', 'growth', 'learn',
  'overcome', 'resolve', 'solution', 'forward', 'unstoppable', 'empowered',
  'energized', 'enthusiastic', 'passionate', 'dedicated', 'persistent',
  'resilient', 'grateful', 'thankful', 'proud', 'win', 'winning',
  'breakthrough', 'transform', 'grow', 'build', 'create', 'opportunity',
  'possible', 'definitely', 'absolutely', 'certainly', 'undoubtedly',
];

const DOUBT_WORDS = [
  'doubt', 'unsure', 'uncertain', 'confused', 'stuck', 'blocked', 'lost',
  'afraid', 'fear', 'worried', 'anxious', 'nervous', 'hesitant', 'reluctant',
  'cant', "can't", 'cannot', 'wont', "won't", 'unable', 'incapable',
  'difficult', 'hard', 'struggle', 'failing', 'fail', 'failure',
  'overwhelmed', 'exhausted', 'tired', 'burnt', 'burnout', 'give up',
  'hopeless', 'helpless', 'powerless', 'useless', 'worthless', 'inadequate',
  'not sure', 'dont know', "don't know", 'maybe', 'perhaps', 'try',
  'problem', 'issue', 'barrier', 'obstacle', 'limitation', 'weak',
  'weakness', 'vulnerable', 'insecure', 'doubtful', 'skeptical', 'pessimistic',
  'frustrated', 'disappointed', 'discouraged', 'demotivated', 'unmotivated',
  'scared', 'terrified', 'panic', 'stress', 'stressed', 'pressure',
  'impossible', 'never', 'always fail', 'too hard', 'too difficult',
];

export interface PowerToGoalResult {
  confidenceCount: number;
  doubtCount: number;
  totalWords: number;
  powerPercentage: number;
}

export function analyzePowerToGoal(text: string): PowerToGoalResult {
  if (!text || text.trim().length === 0) {
    return { confidenceCount: 0, doubtCount: 0, totalWords: 0, powerPercentage: 0 };
  }
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/).filter(w => w.length > 0);
  const totalWords = words.length;
  let confidenceCount = 0;
  let doubtCount = 0;
  for (const w of CONFIDENCE_WORDS) {
    const matches = lower.match(new RegExp(`\\b${w.replace(/'/g, "'")}\\b`, 'g'));
    if (matches) confidenceCount += matches.length;
  }
  for (const w of DOUBT_WORDS) {
    const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matches = lower.match(new RegExp(`\\b${escaped}\\b`, 'g'));
    if (matches) doubtCount += matches.length;
  }
  const total = confidenceCount + doubtCount;
  const powerPercentage = total > 0 ? Math.round((confidenceCount / total) * 10000) / 100 : 0;
  return { confidenceCount, doubtCount, totalWords, powerPercentage };
}

import { supabase } from '../supabase';

export async function recordPowerToGoal(
  sessionId: string,
  capsuleId: string,
  userId: string,
  userEmail: string,
  activityType: string,
  inputText: string
): Promise<void> {
  const result = analyzePowerToGoal(inputText);
  if (result.totalWords === 0) return;
  await supabase.from('power_to_goal').insert({
    session_id: sessionId,
    capsule_id: capsuleId,
    user_id: userId,
    user_email: userEmail,
    activity_type: activityType,
    input_text: inputText.slice(0, 5000),
    confidence_count: result.confidenceCount,
    doubt_count: result.doubtCount,
    total_words: result.totalWords,
  });
  await updatePowerToGoalSummary(sessionId, capsuleId, userEmail);
}

async function updatePowerToGoalSummary(sessionId: string, capsuleId: string, userEmail: string): Promise<void> {
  const { data } = await supabase
    .from('power_to_goal')
    .select('confidence_count,doubt_count,total_words')
    .eq('session_id', sessionId)
    .eq('user_email', userEmail);
  const rows = (data as any[]) ?? [];
  const totalConfidence = rows.reduce((a, r) => a + (r.confidence_count ?? 0), 0);
  const totalDoubt = rows.reduce((a, r) => a + (r.doubt_count ?? 0), 0);
  const totalWords = rows.reduce((a, r) => a + (r.total_words ?? 0), 0);
  const total = totalConfidence + totalDoubt;
  const pct = total > 0 ? Math.round((totalConfidence / total) * 10000) / 100 : 0;
  const { data: existing } = await supabase
    .from('power_to_goal_summary')
    .select('id')
    .eq('session_id', sessionId)
    .eq('user_email', userEmail)
    .maybeSingle();
  if (existing) {
    await supabase.from('power_to_goal_summary').update({
      total_confidence: totalConfidence,
      total_doubt: totalDoubt,
      total_words: totalWords,
      power_percentage: pct,
      updated_at: new Date().toISOString(),
    }).eq('id', (existing as any).id);
  } else {
    await supabase.from('power_to_goal_summary').insert({
      session_id: sessionId,
      capsule_id: capsuleId,
      user_email: userEmail,
      total_confidence: totalConfidence,
      total_doubt: totalDoubt,
      total_words: totalWords,
      power_percentage: pct,
    });
  }
}

export async function getPowerToGoalForSession(sessionId: string, userEmail: string): Promise<PowerToGoalResult | null> {
  const { data } = await supabase
    .from('power_to_goal_summary')
    .select('*')
    .eq('session_id', sessionId)
    .eq('user_email', userEmail)
    .maybeSingle();
  if (!data) return null;
  return {
    confidenceCount: (data as any).total_confidence ?? 0,
    doubtCount: (data as any).total_doubt ?? 0,
    totalWords: (data as any).total_words ?? 0,
    powerPercentage: Number((data as any).power_percentage ?? 0),
  };
}

export async function getPowerToGoalTrend(capsuleId: string, userEmail: string): Promise<{ sessionNumber: number; sessionId: string; pct: number; topic: string }[]> {
  const { data: sessions } = await supabase
    .from('coaching_sessions')
    .select('id,session_number,topic')
    .eq('capsule_id', capsuleId)
    .order('session_number');
  const sList = (sessions as any[]) ?? [];
  if (sList.length === 0) return [];
  const sessionIds = sList.map(s => s.id);
  const { data: summaries } = await supabase
    .from('power_to_goal_summary')
    .select('session_id,power_percentage')
    .eq('capsule_id', capsuleId)
    .eq('user_email', userEmail)
    .in('session_id', sessionIds);
  const summaryMap: Record<string, number> = {};
  (summaries as any[])?.forEach(s => { summaryMap[s.session_id] = Number(s.power_percentage ?? 0); });
  return sList.map(s => ({
    sessionNumber: s.session_number,
    sessionId: s.id,
    topic: s.topic,
    pct: summaryMap[s.id] ?? 0,
  }));
}
