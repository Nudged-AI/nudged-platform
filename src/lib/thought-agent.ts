import { callLLM, parseJSON } from './llm';
import { supabase } from '../supabase';

export interface ThoughtComponent {
  name: string;
  type: string;
  confidence: string;
  evidence: string;
  inferred: boolean;
  needs_confirmation: boolean;
}

export interface Undercurrent {
  label: string;
  explanation: string;
  confidence: string;
  trend: string;
  supporting_thoughts: string[];
}

export interface MissingPiece {
  what: string;
  why: string;
  action: string;
}

export interface Recommendation {
  direction: string;
  focus_now: string;
  next_actions: string[];
}

export interface JohariWindow {
  open: string[];
  blind: string[];
  hidden: string[];
  unknown: string[];
}

export interface WordCloudItem {
  word: string;
  count: number;
  is_negative: boolean;
}

export interface ThoughtAnalysis {
  components: ThoughtComponent[];
  undercurrents: Undercurrent[];
  missing_pieces: MissingPiece[];
  recommendations: Recommendation;
  johari_window: JohariWindow;
  word_cloud: WordCloudItem[];
  negative_words: string[];
}

export interface ActivityInput {
  activity_type: string;
  declared: boolean;
  content: string;
  status: string;
  completion_pct?: number;
}

const THOUGHT_AGENT_PROMPT_KEY = 'thought_investment_engine';

export async function analyzeSessionThoughts(
  sessionId: string,
  userId: string,
  inputs: ActivityInput[],
  coacheeProfile?: string
): Promise<ThoughtAnalysis> {
  const inputsText = inputs
    .map(i => `[${i.activity_type}${i.declared ? ', declared' : ''}] status=${i.status}${i.completion_pct !== undefined ? `, ${i.completion_pct}% complete` : ''}\n  ${i.content}`)
    .join('\n\n');

  const res = await callLLM(THOUGHT_AGENT_PROMPT_KEY, {
    session_id: sessionId,
    user_id: userId,
    activity_inputs: inputsText,
    coachee_profile: coacheeProfile || 'Not available',
  });

  const parsed = parseJSON<ThoughtAnalysis>(res);
  if (!parsed) {
    return {
      components: [],
      undercurrents: [],
      missing_pieces: [],
      recommendations: { direction: '', focus_now: '', next_actions: [] },
      johari_window: { open: [], blind: [], hidden: [], unknown: [] },
      word_cloud: [],
      negative_words: [],
    };
  }
  return parsed;
}

export async function fetchSessionInputs(sessionId: string, userId: string, userEmail?: string): Promise<ActivityInput[]> {
  const inputs: ActivityInput[] = [];
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
  const useEmail = !!userEmail;
  const uidFilter = useEmail ? userEmail! : (isUuid ? userId : userId);
  const userCol = useEmail ? 'user_email' : 'user_id';

  // Talk messages
  const { data: talkSessions } = await supabase.from('talk_sessions').select('id').eq('session_id', sessionId).eq(userCol, uidFilter);
  for (const ts of (talkSessions as any[]) ?? []) {
    const { data: msgs } = await supabase.from('talk_messages').select('role,content').eq('talk_session_id', ts.id).order('created_at');
    const userMsgs = ((msgs as any[]) ?? []).filter(m => m.role === 'user').map(m => m.content).join(' | ');
    if (userMsgs) inputs.push({ activity_type: 'talk', declared: true, content: userMsgs, status: 'completed' });
  }

  // Quiz answers
  let quizAnswers: any[] = [];
  try {
    const { data, error: qErr } = await supabase.from('cc_quiz_answers').select('question,answer,is_correct').eq('session_id', sessionId).eq(userCol, uidFilter);
    if (!qErr && data) quizAnswers = data as any[];
  } catch { /* table may not exist */ }
  if (quizAnswers.length > 0) {
    const qa = (quizAnswers as any[]).map(a => `Q: ${a.question} | A: ${a.answer} | ${a.is_correct ? 'Correct' : 'Incorrect'}`).join('\n');
    const correct = (quizAnswers as any[]).filter(a => a.is_correct).length;
    const pct = Math.round((correct / (quizAnswers as any[]).length) * 100);
    inputs.push({ activity_type: 'quiz', declared: true, content: qa, status: `${correct}/${(quizAnswers as any[]).length} correct`, completion_pct: pct });
  }

  // Tasks
  let tasks: any[] = [];
  try {
    const { data, error: tErr } = await supabase.from('cc_tasks').select('title,description,is_completed').eq('session_id', sessionId).eq(userCol, uidFilter);
    if (!tErr && data) tasks = data as any[];
  } catch { /* table may not exist */ }
  if (tasks.length > 0) {
    const tc = (tasks as any[]).map(t => `${t.title}: ${t.is_completed ? 'Done' : 'Pending'}`).join('; ');
    const done = (tasks as any[]).filter(t => t.is_completed).length;
    const pct = Math.round((done / (tasks as any[]).length) * 100);
    inputs.push({ activity_type: 'tasks', declared: true, content: tc, status: `${done}/${(tasks as any[]).length} done`, completion_pct: pct });
  }

  // Watch (video views)
  try {
    const { data: watches, error: wErr } = await supabase.from('cc_watch_log').select('video_url,watched_at').eq('session_id', sessionId).eq(userCol, uidFilter);
    if (!wErr && watches && (watches as any[]).length > 0) {
      inputs.push({ activity_type: 'watch', declared: true, content: `${(watches as any[]).length} videos watched`, status: 'completed' });
    }
  } catch { /* table may not exist */ }

  // Parked thoughts for this session's thread
  const { data: threads } = await supabase.from('session_threads').select('goal_id').eq('session_id', sessionId);
  for (const t of (threads as any[]) ?? []) {
    const { data: parked } = await supabase.from('parked_items').select('content,tags,created_at').eq('goal_id', t.goal_id).eq(userCol, uidFilter).order('created_at', { ascending: false }).limit(50);
    for (const p of (parked as any[]) ?? []) {
      inputs.push({ activity_type: 'parking', declared: true, content: p.content, status: 'parked' });
    }
  }

  return inputs;
}

export async function saveAnalysis(sessionId: string, userId: string, analysis: ThoughtAnalysis): Promise<void> {
  await supabase.from('thought_analyses').insert({
    session_id: sessionId,
    user_id: userId,
    components: analysis.components,
    undercurrents: analysis.undercurrents,
    missing_pieces: analysis.missing_pieces,
    recommendations: analysis.recommendations,
    johari_window: analysis.johari_window,
    word_cloud: analysis.word_cloud,
    negative_words: analysis.negative_words,
  });
}

export async function loadAnalysis(sessionId: string, userId: string): Promise<ThoughtAnalysis | null> {
  const { data } = await supabase.from('thought_analyses')
    .select('*')
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const d = data as any;
  return {
    components: d.components ?? [],
    undercurrents: d.undercurrents ?? [],
    missing_pieces: d.missing_pieces ?? [],
    recommendations: d.recommendations ?? { direction: '', focus_now: '', next_actions: [] },
    johari_window: d.johari_window ?? { open: [], blind: [], hidden: [], unknown: [] },
    word_cloud: d.word_cloud ?? [],
    negative_words: d.negative_words ?? [],
  };
}

export interface WeaknessTopic { topic: string; frequency: number; }
export interface ActivityInsights {
  talk?: WeaknessTopic[];
  tasks?: WeaknessTopic[];
  parking?: WeaknessTopic[];
  quiz?: WeaknessTopic[];
}

export async function analyzeActivityInsights(sessionId: string, userId: string, userEmail?: string): Promise<ActivityInsights> {
  const inputs = await fetchSessionInputs(sessionId, userId, userEmail);
  if (inputs.length === 0) return {};
  const inputsText = inputs.map(i => `[${i.activity_type}] ${i.content}`).join('\n\n');
  const res = await callLLM('activity_weakness_insights', { activity_inputs: inputsText });
  const parsed = parseJSON<ActivityInsights>(res);
  return parsed ?? {};
}

export async function saveActivityInsights(sessionId: string, userId: string, insights: ActivityInsights): Promise<void> {
  await supabase.from('thought_analyses').upsert({
    session_id: sessionId, user_id: userId, activity_insights: insights,
  }, { onConflict: 'session_id,user_id' });
}

export async function loadActivityInsights(sessionId: string, userId: string): Promise<ActivityInsights | null> {
  const { data } = await supabase.from('thought_analyses').select('activity_insights').eq('session_id', sessionId).eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle();
  return (data as any)?.activity_insights ?? null;
}
