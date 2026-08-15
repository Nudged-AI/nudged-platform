import React, { useEffect, useState, useRef } from 'react';
import { Loader2, Trophy, Check, Sparkles, Eye, EyeOff, HelpCircle, Brain, Star, Send, TrendingUp, Target, BarChart3, Zap, Heart, MessageSquare, Plus, History } from 'lucide-react';
import { supabase } from '../supabase';
import { fetchSessionInputs, analyzeSessionThoughts, saveAnalysis, loadAnalysis, type ThoughtAnalysis } from '../lib/thought-agent';
import { callLLM, stripMarkdown, parseJSON } from '../lib/llm';
import { getCapsuleKnowledge, getPreviousSessionsContext } from '../lib/coach';
import { getPowerToGoalForSession, getPowerToGoalTrend, type PowerToGoalResult } from '../lib/power-to-goal';

interface Props { sessionId: string; userId: string; isCoach?: boolean; coacheeEmail?: string; }

const ACTIVITY_LABELS: Record<string, string> = { talk: 'Talk', tasks: 'Tasks', parking: 'Parking', watch: 'Watch', quiz: 'Quiz', knowledge: 'Knowledge' };

export default function SessionDashboard({ sessionId, userId, isCoach, coacheeEmail }: Props) {
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<any[]>([]);
  const [session, setSession] = useState<any>(null);
  const [completions, setCompletions] = useState<any[]>([]);
  const [stars, setStars] = useState<any[]>([]);
  const [analysis, setAnalysis] = useState<ThoughtAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<string>('');
  const [coachAnswer, setCoachAnswer] = useState<string>('');
  const [analyzingActivity, setAnalyzingActivity] = useState(false);
  const [chatMsgs, setChatMsgs] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const [powerToGoal, setPowerToGoal] = useState<PowerToGoalResult | null>(null);
  const [powerTrend, setPowerTrend] = useState<{ sessionNumber: number; pct: number; topic: string }[]>([]);
  const [insightsTab, setInsightsTab] = useState<'current' | 'history'>('current');
  const [insightsHistory, setInsightsHistory] = useState<any[]>([]);
  const [, setQuizModules] = useState<any[]>([]);
  const [quizResults, setQuizResults] = useState<any[]>([]);
  const [beliefs, setBeliefs] = useState<any[]>([]);
  const [beliefsLoading, setBeliefsLoading] = useState(false);

  const useEmail = !!coacheeEmail;
  const queryUserId = useEmail ? coacheeEmail! : userId;
  // When coach is viewing and no coachee is selected, don't filter by user — show all completions
  const applyFilter = (q: any, col: string) => {
    if (isCoach && !coacheeEmail) return q; // coach sees all coachee data
    return useEmail ? q.eq(col === 'user_id' ? 'user_email' : col, coacheeEmail!) : q.eq(col, queryUserId);
  };

  useEffect(() => { (async () => { await loadAll(); })(); }, [sessionId, userId, coacheeEmail]);

  const loadAll = async () => {
    setLoading(true);
    const { data: sess } = await supabase.from('coaching_sessions').select('*').eq('id', sessionId).single();
    setSession(sess);
    const { data: acts } = await supabase.from('cc_activities').select('*').eq('session_id', sessionId).eq('is_enabled', true).eq('is_active_set', true);
    setActivities((acts as any[]) ?? []);
    const compsQ = supabase.from('activity_completions').select('*').eq('session_id', sessionId);
    const { data: comps } = await applyFilter(compsQ, 'user_id');
    setCompletions((comps as any[]) ?? []);
    const stQ = supabase.from('coach_stars').select('*').eq('session_id', sessionId);
    const { data: st } = await applyFilter(stQ, 'user_id');
    setStars((st as any[]) ?? []);
    const a = await loadAnalysis(sessionId, userId);
    setAnalysis(a);
    const { data: capsule } = sess?.capsule_id ? await supabase.from('capsules').select('capsule_type').eq('id', sess.capsule_id).single() : { data: null };
    const isTraining = (capsule as any)?.capsule_type === 'Training';
    if (coacheeEmail && !isTraining) {
      const ptg = await getPowerToGoalForSession(sessionId, coacheeEmail);
      setPowerToGoal(ptg);
      if (sess?.capsule_id) {
        const trend = await getPowerToGoalTrend(sess.capsule_id, coacheeEmail);
        setPowerTrend(trend.map(t => ({ sessionNumber: t.sessionNumber, pct: t.pct, topic: t.topic })));
      }
    } else {
      setPowerToGoal(null);
      setPowerTrend([]);
    }
    // Load quiz modules and results if quiz activity is enabled
    const quizAct = (acts as any[])?.find(a => a.activity_type === 'quiz' && a.is_enabled);
    if (quizAct) {
      await loadQuizResults(quizAct.id);
    }
    // Load beliefs if coach
    if (isCoach) {
      await loadBeliefs();
    }
    setLoading(false);
  };

  const loadQuizResults = async (quizActivityId: string) => {
    try {
      const { data: mods } = await supabase.from('quiz_modules').select('id,title,position').eq('activity_id', quizActivityId).order('position');
      const modList = (mods as any[]) ?? [];
      setQuizModules(modList);
      // Get quiz completions (stars with activity_type='quiz' give us correct/wrong data)
      const starQ = supabase.from('coach_stars').select('reason,stars').eq('session_id', sessionId).eq('activity_type', 'quiz');
      const { data: quizStars } = await applyFilter(starQ, 'user_id');
      const quizCompletions = (quizStars as any[]) ?? [];
      // For each module, calculate % correct
      const results = modList.map(mod => {
        // We need to match quiz stars to modules — stars store the question text as reason
        // Get questions for this module
        return { moduleId: mod.id, moduleTitle: mod.title, correct: 0, total: 0, pct: 0 };
      });
      // Get all quiz questions to match star reasons to modules
      for (const mod of modList) {
        const { data: qs } = await supabase.from('quiz_questions').select('id,question,module_id').eq('module_id', mod.id);
        const qList = (qs as any[]) ?? [];
        const qTexts = new Set(qList.map(q => q.question));
        // Stars store question text as reason — match by text
        const modStars = quizCompletions.filter(s => qTexts.has(s.reason));
        const correct = modStars.filter(s => s.stars > 0).length;
        const total = modStars.length;
        const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
        const idx = results.findIndex(r => r.moduleId === mod.id);
        if (idx >= 0) { results[idx] = { moduleId: mod.id, moduleTitle: mod.title, correct, total, pct }; }
      }
      setQuizResults(results);
    } catch { /* quiz tables may not exist */ }
  };

  const loadBeliefs = async () => {
    try {
      let q = supabase.from('coach_beliefs_analysis').select('*').eq('session_id', sessionId).order('created_at', { ascending: false });
      if (coacheeEmail) q = q.eq('coachee_email', coacheeEmail);
      const { data } = await q.limit(1).maybeSingle();
      if (data) setBeliefs((data as any).beliefs_json ?? []);
      else setBeliefs([]);
    } catch { setBeliefs([]); }
  };

  const generateBeliefs = async () => {
    setBeliefsLoading(true);
    try {
      // Gather data from talk sessions, task/watch completions, and parked thoughts
      let talkContext = '';
      const { data: ts } = useEmail
        ? await supabase.from('talk_sessions').select('id').eq('session_id', sessionId).eq('user_email', coacheeEmail!)
        : await supabase.from('talk_sessions').select('id').eq('session_id', sessionId);
      for (const t of (ts as any[]) ?? []) {
        const { data: msgs } = await supabase.from('talk_messages').select('role,content').eq('talk_session_id', t.id).order('created_at').limit(50);
        talkContext += (msgs as any[])?.filter(m => m.role === 'user').map(m => m.content).join(' ') ?? '';
      }

      let taskWatchContext = '';
      const twComps = completions.filter(c => c.activity_type === 'tasks' || c.activity_type === 'watch');
      taskWatchContext = twComps.map(c => {
        const parts = [c.what_went_well, c.learning, c.to_be_focused, c.notes].filter(Boolean);
        return `[${c.activity_type}] ${parts.join(' | ')}`;
      }).join('\n');

      let parkingContext = '';
      const { data: threads } = await supabase.from('session_threads').select('goal_id').eq('session_id', sessionId);
      for (const t of (threads as any[]) ?? []) {
        const pQ = supabase.from('parked_items').select('content,tags').eq('goal_id', t.goal_id).order('created_at', { ascending: false }).limit(50);
        const { data: parked } = useEmail ? await pQ.eq('user_email', coacheeEmail!) : await pQ;
        parkingContext += (parked as any[])?.map(p => p.content).join('\n') ?? '';
      }

      // Gather coachee profile (family, profession) for richer analysis
      let coacheeProfile = '';
      if (coacheeEmail) {
        const { data: profile } = await supabase.from('coachees').select('client_name,profession,profession_details,marital_status,children,reasons_for_seeking,primary_goal,main_blocker').eq('email', coacheeEmail).maybeSingle();
        if (profile) {
          coacheeProfile = `Name: ${profile.client_name ?? ''}\nProfession: ${profile.profession ?? ''} ${profile.profession_details ?? ''}\nMarital status: ${profile.marital_status ?? ''}\nChildren: ${profile.children ?? 0}\nReasons for seeking coaching: ${profile.reasons_for_seeking ?? ''}\nPrimary goal: ${profile.primary_goal ?? ''}\nMain blocker: ${profile.main_blocker ?? ''}`;
        }
      }

      // Gather session notes and capsule knowledge for context
      let sessionNotesContext = '';
      if (session?.summary) {
        sessionNotesContext = Array.isArray(session.summary) ? (session.summary as string[]).join('\n') : (session.generated_summary ?? '');
      }
      let capsuleKnowledgeContext = '';
      if (session?.capsule_id) {
        capsuleKnowledgeContext = await getCapsuleKnowledge(session.capsule_id);
      }

      const allContext = `COACHEE PROFILE:\n${coacheeProfile}\n\nSESSION NOTES:\n${sessionNotesContext}\n\nCAPSULE KNOWLEDGE:\n${capsuleKnowledgeContext}\n\nTALK SESSIONS:\n${talkContext}\n\nTASKS & WATCH:\n${taskWatchContext}\n\nPARKED THOUGHTS:\n${parkingContext}`;

      const res = await callLLM('custom_prompt', {
        prompt: `You are an expert coaching psychologist specializing in identifying deep emotional blockers that hold people back.

EMOTIONAL BLOCKER FRAMEWORK (internal reference — do NOT mention chakras or energy centers to the user):
The following are core negative emotional blockers and their corresponding positive transformations:
- Inertia / Lethargy → Excitement, Enthusiasm
- Attachment / Clinging → Creativity, Flow
- Jealousy / Envy → Generosity, Abundance
- Hatred / Resentment → Love, Compassion
- Non-expressiveness / Suppression → Expression, Authentic Voice
- Anger / Rage → Knowledge, Understanding, Wisdom
- Fear / Anxiety → Courage, Trust
- Guilt / Shame → Self-acceptance, Forgiveness
- Grief / Sorrow → Joy, Gratitude
- Confusion / Doubt → Clarity, Intuition
- Pride / Ego → Humility, Service
- Greed / Hoarding → Sharing, Generosity

YOUR TASK:
1. Analyze ALL the coachee data below — their profile (family, profession, personal context), session notes, capsule knowledge, talk conversations, task reflections, and parked thoughts.
2. Identify the TOP 3-5 beliefs and emotions expressed.
3. For EACH belief/emotion, identify the negative emotional blocker from the framework above.
4. Map it to the corresponding positive emotion that will transform it.
5. Identify 2-3 positive emotions that will help convert the negative blocker to positive.
6. For each belief, suggest 3 micro baby tasks (very small, immediate actions the coachee can start doing right away) that will help crack the belief and give deep insight.

REPORTING RULES:
- Do NOT use technical terms like "chakra", "energy center", "root chakra", etc. in the output.
- Use plain, human language: "negative blocker" and "positive shift" or "transformative emotion".
- Mix insights from the existing data with the emotional blocker analysis for a rich, holistic view.
- Each micro task should be specific, tiny, and actionable — something the coachee can do in 5 minutes or less.

Data:
${allContext}

Return ONLY valid JSON (no markdown, no code fences):
{"beliefs": [{"belief": "the belief name", "emotion": "the associated emotion", "negative_blocker": "the core negative blocker (e.g. Inertia, Anger, Fear)", "positive_emotions": ["emotion 1", "emotion 2", "emotion 3"], "micro_tasks": ["task 1 - small immediate action", "task 2 - small immediate action", "task 3 - small immediate action"], "source": "talk|task/watch|parking|profile", "confidence": "high|medium|low", "evidence": "brief evidence from the data"}]}`
      });
      const parsed = parseJSON<{ beliefs: any[] }>(res);
      const beliefsData = parsed?.beliefs ?? [];
      if (beliefsData.length === 0) {
        alert('No beliefs could be extracted from the AI response. The coachee may not have enough activity data yet.');
      } else {
        setBeliefs(beliefsData);
        // Delete old beliefs for this session+coachee before saving new ones
        await supabase.from('coach_beliefs_analysis').delete().eq('session_id', sessionId).eq('coachee_email', coacheeEmail ?? '');
        // Save to DB
        const { error: insertErr } = await supabase.from('coach_beliefs_analysis').insert({
          session_id: sessionId,
          coachee_email: coacheeEmail ?? '',
          beliefs_json: beliefsData,
        });
        if (insertErr) {
          console.warn('Beliefs saved in UI but DB insert failed:', insertErr.message);
        }
      }
    } catch (e: any) {
      console.error('Belief analysis failed:', e);
      alert('Belief analysis failed: ' + (e.message ?? 'Unknown error'));
    }
    setBeliefsLoading(false);
  };

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const inputs = await fetchSessionInputs(sessionId, queryUserId, coacheeEmail);
      if (inputs.length > 0) {
        // Fetch coachee profile for richer analysis
        let coacheeProfile = '';
        if (coacheeEmail) {
          try {
            const { data: profile } = await supabase.from('coachees').select('client_name,profession,profession_details,marital_status,children,reasons_for_seeking,primary_goal,main_blocker').eq('email', coacheeEmail).maybeSingle();
            if (profile) {
              coacheeProfile = `Name: ${profile.client_name ?? ''}\nProfession: ${profile.profession ?? ''} ${profile.profession_details ?? ''}\nMarital status: ${profile.marital_status ?? ''}\nChildren: ${profile.children ?? 0}\nReasons for seeking: ${profile.reasons_for_seeking ?? ''}\nPrimary goal: ${profile.primary_goal ?? ''}\nMain blocker: ${profile.main_blocker ?? ''}`;
            }
          } catch { /* silent */ }
        }
        const result = await analyzeSessionThoughts(sessionId, queryUserId, inputs, coacheeProfile);
        await saveAnalysis(sessionId, queryUserId, result);
        setAnalysis(result);
      } else {
        alert('No activity data found for this coachee in this session. Ensure there are Talk sessions, Tasks, Watch completions, or Parked thoughts.');
      }
    } catch (e: any) { alert('Analysis failed: ' + e.message); }
    setAnalyzing(false);
  };

  const starsByActivity: Record<string, number> = {};
  stars.forEach(s => { starsByActivity[s.activity_type] = (starsByActivity[s.activity_type] ?? 0) + (s.stars ?? 0); });
  const totalStars = stars.reduce((a, s) => a + (s.stars ?? 0), 0);

  const getActivityCompletions = (actType: string) => {
    const act = activities.find(a => a.activity_type === actType);
    const scheduledDates: string[] = act?.scheduled_dates ?? [];
    const actComps = completions.filter(c => c.activity_type === actType);
    return scheduledDates.map(date => {
      const dayComps = actComps.filter(c => c.completed_date === date);
      return { date, completed: dayComps.length, status: dayComps.length > 0 ? 'complete' : 'not_attempted' };
    });
  };

  // Coach Insights: always fresh analysis, with history
  const analyzeActivity = async (actType: string) => {
    const act = activities.find(a => a.activity_type === actType);
    if (!act) return;
    setAnalyzingActivity(true);
    setCoachAnswer('');
    setChatMsgs([]);
    setInsightsTab('current');
    try {
      const coachQuestions = act.coach_questions ?? [];
      const actComps = completions.filter(c => c.activity_type === actType);
      let dataContext = '';
      if (actType === 'parking') {
        const { data: threads } = await supabase.from('session_threads').select('goal_id').eq('session_id', sessionId);
        for (const t of (threads as any[]) ?? []) {
          const pQ = supabase.from('parked_items').select('content,tags,created_at').eq('goal_id', t.goal_id).order('created_at', { ascending: false }).limit(50);
          const { data: parked } = useEmail ? await pQ.eq('user_email', coacheeEmail!) : await pQ;
          dataContext += (parked as any[])?.map(p => `[${p.tags?.join(',') ?? ''}] ${p.content}`).join('\n') ?? '';
        }
      } else if (actType === 'quiz') {
        // Get quiz data from stars (correct answers have stars>0)
        const quizStars = stars.filter(s => s.activity_type === 'quiz');
        dataContext = quizStars.map(s => `Q: ${s.reason} | ${s.stars > 0 ? 'Correct' : 'Incorrect'}`).join('\n');
      } else if (actType === 'talk') {
        try {
          const tsQ = supabase.from('talk_sessions').select('id').eq('session_id', sessionId);
          const { data: ts } = useEmail ? await tsQ.eq('user_email', coacheeEmail!) : await tsQ;
          for (const t of (ts as any[]) ?? []) {
            const { data: msgs } = await supabase.from('talk_messages').select('role,content').eq('talk_session_id', t.id).order('created_at');
            dataContext += (msgs as any[])?.map(m => `${m.role}: ${m.content}`).join('\n') ?? '';
          }
        } catch { dataContext = ''; }
      } else {
        dataContext = actComps.map(c => `Date: ${c.completed_date}, Notes: ${c.notes ?? ''}, Learning: ${c.learning ?? ''}, Good: ${c.what_went_well ?? ''}, Focus: ${c.to_be_focused ?? ''}`).join('\n');
      }
      const capsuleKnowledge = session?.capsule_id ? await getCapsuleKnowledge(session.capsule_id) : 'No capsule knowledge.';
      const previousContext = session?.capsule_id ? await getPreviousSessionsContext(session.capsule_id, sessionId, coacheeEmail ?? '') : 'No previous sessions.';
      const sessionGoalText = Array.isArray(session?.goals) ? (session.goals as string[]).join('; ') : '';
      const summaryText = Array.isArray(session?.summary) ? (session.summary as string[]).join('\n') : (session?.generated_summary ?? '');
      // Fetch coachee profile for richer insights
      let coacheeProfile = '';
      if (coacheeEmail) {
        try {
          const { data: profile } = await supabase.from('coachees').select('client_name,profession,profession_details,marital_status,children,reasons_for_seeking,primary_goal,main_blocker').eq('email', coacheeEmail).maybeSingle();
          if (profile) {
            coacheeProfile = `Name: ${profile.client_name ?? ''}\nProfession: ${profile.profession ?? ''} ${profile.profession_details ?? ''}\nMarital status: ${profile.marital_status ?? ''}\nChildren: ${profile.children ?? 0}\nReasons for seeking: ${profile.reasons_for_seeking ?? ''}\nPrimary goal: ${profile.primary_goal ?? ''}\nMain blocker: ${profile.main_blocker ?? ''}`;
          }
        } catch { /* silent */ }
      }
      const res = await callLLM('coach_insights_activity', {
        activity_type: actType,
        coach_questions: JSON.stringify(coachQuestions),
        activity_data: dataContext,
        session_topic: session?.topic ?? '',
        session_goal: sessionGoalText,
        session_summary: summaryText,
        capsule_knowledge: capsuleKnowledge,
        previous_sessions_context: previousContext,
        coachee_profile: coacheeProfile,
      });
      const answer = stripMarkdown(res || '');
      setCoachAnswer(answer);
      // Save to history (keep last 3) — include followups as conversation_json
      await supabase.from('coach_insights_history').insert({
        session_id: sessionId,
        activity_type: actType,
        coachee_email: coacheeEmail ?? '',
        insights_text: answer,
        conversation_json: [],
      });
      // Delete old chat messages for this session+activity (fresh start)
      await supabase.from('coach_insights_chat').delete().eq('session_id', sessionId).eq('activity_type', actType).eq('user_email', coacheeEmail ?? '');
      // Delete old history beyond last 3
      const { data: hist } = await supabase.from('coach_insights_history').select('id').eq('session_id', sessionId).eq('activity_type', actType).eq('coachee_email', coacheeEmail ?? '').order('created_at', { ascending: false });
      const histList = (hist as any[]) ?? [];
      if (histList.length > 3) {
        for (let i = 3; i < histList.length; i++) {
          await supabase.from('coach_insights_history').delete().eq('id', histList[i].id);
        }
      }
      // Fresh analysis — no old chat to load
      setChatMsgs([]);
    } catch (e: any) { setCoachAnswer('Analysis failed: ' + e.message); }
    setAnalyzingActivity(false);
  };

  const loadInsightsHistory = async (actType: string) => {
    const { data: hist } = await supabase.from('coach_insights_history').select('*').eq('session_id', sessionId).eq('activity_type', actType).eq('coachee_email', coacheeEmail ?? '').order('created_at', { ascending: false });
    setInsightsHistory((hist as any[]) ?? []);
    setInsightsTab('history');
  };

  const sendChat = async () => {
    if (!chatInput.trim() || !selectedActivity) return;
    const msg = { role: 'user', content: chatInput.trim() };
    setChatMsgs(m => [...m, msg]);
    setChatInput('');
    setChatLoading(true);
    try {
      await supabase.from('coach_insights_chat').insert({ session_id: sessionId, activity_type: selectedActivity, role: 'user', content: msg.content, user_email: coacheeEmail });
      const act = activities.find(a => a.activity_type === selectedActivity);
      const history = [...chatMsgs, msg].map(m => `${m.role}: ${m.content}`).join('\n');
      const capsuleKnowledge = session?.capsule_id ? await getCapsuleKnowledge(session.capsule_id) : 'No capsule knowledge.';
      const previousContext = session?.capsule_id ? await getPreviousSessionsContext(session.capsule_id, sessionId, coacheeEmail ?? '') : 'No previous sessions.';
      const sessionGoalText = Array.isArray(session?.goals) ? (session.goals as string[]).join('; ') : '';
      const summaryText = Array.isArray(session?.summary) ? (session.summary as string[]).join('\n') : (session?.generated_summary ?? '');
      const res = await callLLM('coach_insights_followup', {
        activity_type: selectedActivity,
        coach_questions: JSON.stringify(act?.coach_questions ?? []),
        previous_answer: coachAnswer,
        conversation_history: history,
        coach_question: msg.content,
        session_topic: session?.topic ?? '',
        session_goal: sessionGoalText,
        session_summary: summaryText,
        capsule_knowledge: capsuleKnowledge,
        previous_sessions_context: previousContext,
        activity_data: completions.filter(c => c.activity_type === selectedActivity).map(c => c.notes ?? '').join('; '),
      });
      const aiMsg = { role: 'assistant', content: stripMarkdown(res) };
      setChatMsgs(m => [...m, aiMsg]);
      await supabase.from('coach_insights_chat').insert({ session_id: sessionId, activity_type: selectedActivity, role: 'assistant', content: res, user_email: coacheeEmail });
      // Update history record with full conversation
      const { data: histRows } = await supabase.from('coach_insights_history').select('id,conversation_json').eq('session_id', sessionId).eq('activity_type', selectedActivity).eq('coachee_email', coacheeEmail ?? '').order('created_at', { ascending: false }).limit(1);
      const histRow = (histRows as any[])?.[0];
      if (histRow) {
        const conv = Array.isArray(histRow.conversation_json) ? histRow.conversation_json : [];
        await supabase.from('coach_insights_history').update({ conversation_json: [...conv, msg, aiMsg] }).eq('id', histRow.id);
      }
    } catch (e: any) { setChatMsgs(m => [...m, { role: 'assistant', content: 'Error: ' + e.message }]); }
    setChatLoading(false);
    setTimeout(() => chatRef.current?.scrollTo(0, chatRef.current.scrollHeight), 100);
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 text-teal-500 animate-spin" /></div>;

  const enabledActivities = activities.map(a => a.activity_type).filter(t => t !== 'knowledge');
  const hasQuiz = enabledActivities.includes('quiz');

  return (
    <div className="space-y-6">
      {/* Power to Goal section — visible to both coach and coachee */}
      {powerToGoal && (
        <Section title="Power to Goal" icon={<Zap className="w-4 h-4 text-amber-500" />}>
          <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-4 border border-amber-100">
            <div className="flex items-center gap-4 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-3xl font-black text-amber-600">{powerToGoal.powerPercentage}%</span>
                <span className="text-xs text-gray-500">power to goal</span>
              </div>
              <div className="flex gap-3 text-xs">
                <span className="text-emerald-700 font-semibold">Confidence words: {powerToGoal.confidenceCount}</span>
                <span className="text-red-600 font-semibold">Doubt words: {powerToGoal.doubtCount}</span>
                <span className="text-gray-500">Total words: {powerToGoal.totalWords}</span>
              </div>
            </div>
            {powerTrend.length > 1 && (
              <div>
                <p className="text-xs font-bold text-gray-700 mb-2">Trend across sessions</p>
                <div className="flex items-end gap-2 h-24">
                  {powerTrend.map((t, i) => {
                    const maxPct = Math.max(...powerTrend.map(x => x.pct), 1);
                    const height = (t.pct / maxPct) * 100;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full bg-amber-400 rounded-t" style={{ height: `${height}%` }} title={`Session ${t.sessionNumber}: ${t.pct}%`} />
                        <span className="text-[10px] text-gray-400">S{t.sessionNumber}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Stars — visible to both */}
      <Section title="Stars" icon={<Star className="w-4 h-4 text-amber-500" />}>
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-100">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-5 h-5 text-amber-500" />
            <span className="text-2xl font-bold text-amber-600">{totalStars}</span>
            <span className="text-xs text-gray-500">total stars earned</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {enabledActivities.map(actType => {
              const count = starsByActivity[actType] ?? 0;
              return (
                <div key={actType} className="bg-white rounded-xl p-3 border border-amber-100 text-center">
                  <Star className={`w-5 h-5 mx-auto mb-1 ${count > 0 ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />
                  <p className="text-lg font-bold text-amber-600">{count}</p>
                  <p className="text-[10px] text-gray-500 capitalize">{ACTIVITY_LABELS[actType] ?? actType}</p>
                </div>
              );
            })}
            {enabledActivities.length === 0 && <p className="text-xs text-gray-400">No activities enabled.</p>}
          </div>
        </div>
      </Section>

      {/* Completion Status — visible to both */}
      <Section title="Completion Status" icon={<Check className="w-4 h-4 text-emerald-600" />}>
        {enabledActivities.length === 0 ? <p className="text-xs text-gray-400">No activities enabled.</p> : (
          <div className="space-y-3">
            {enabledActivities.map(actType => {
              const dayStatuses = getActivityCompletions(actType);
              if (dayStatuses.length === 0) return (
                <div key={actType} className="border border-gray-100 rounded-xl p-3">
                  <p className="text-xs font-semibold text-gray-700 capitalize mb-1">{ACTIVITY_LABELS[actType] ?? actType}</p>
                  <p className="text-xs text-gray-400">No scheduled dates.</p>
                </div>
              );
              return (
                <div key={actType} className="border border-gray-100 rounded-xl p-3">
                  <p className="text-xs font-semibold text-gray-700 capitalize mb-2">{ACTIVITY_LABELS[actType] ?? actType}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {dayStatuses.map(d => (
                      <div key={d.date} className={`text-xs px-2 py-1 rounded-lg border ${d.status === 'complete' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                        {new Date(d.date + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' })}
                        {d.status === 'complete' && <Check className="w-3 h-3 inline ml-1" />}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* Quiz Results Table — visible to both coach and coachee */}
      {hasQuiz && quizResults.length > 0 && (
        <Section title="Quiz Results" icon={<HelpCircle className="w-4 h-4 text-indigo-500" />}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 font-semibold text-gray-600">Module</th>
                  <th className="text-center py-2 px-3 font-semibold text-gray-600">Correct</th>
                  <th className="text-center py-2 px-3 font-semibold text-gray-600">Total</th>
                  <th className="text-center py-2 px-3 font-semibold text-gray-600">% Correct</th>
                </tr>
              </thead>
              <tbody>
                {quizResults.map((r, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-2 px-3 text-gray-700">{r.moduleTitle}</td>
                    <td className="py-2 px-3 text-center text-emerald-600 font-semibold">{r.correct}</td>
                    <td className="py-2 px-3 text-center text-gray-500">{r.total}</td>
                    <td className="py-2 px-3 text-center">
                      <span className={`font-bold ${r.pct >= 70 ? 'text-emerald-600' : r.pct >= 40 ? 'text-amber-600' : 'text-red-500'}`}>{r.pct}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Beliefs & Emotions Analysis — coach only, above Coach Insights */}
      {isCoach && (
        <Section title="Top Beliefs & Emotions" icon={<Heart className="w-4 h-4 text-rose-500" />}>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">AI-identified beliefs and emotions from Talk sessions, Task/Watch reflections, and Parked thoughts.</p>
              <button onClick={generateBeliefs} disabled={beliefsLoading}
                className="flex items-center gap-1.5 text-xs text-white bg-rose-500 hover:bg-rose-600 px-3 py-1.5 rounded-lg disabled:opacity-50">
                {beliefsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                {beliefsLoading ? 'Analyzing...' : 'Generate Analysis'}
              </button>
            </div>
            {beliefs.length > 0 ? (
              <div className="space-y-2">
                {beliefs.map((b, i) => (
                  <div key={i} className="bg-rose-50 border border-rose-100 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-rose-800">{b.belief}</span>
                        {b.emotion && <span className="text-xs text-gray-500">— {b.emotion}</span>}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${b.source === 'talk' ? 'bg-teal-100 text-teal-700' : b.source === 'task/watch' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>{b.source}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${b.confidence === 'high' ? 'bg-emerald-100 text-emerald-700' : b.confidence === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{b.confidence}</span>
                      </div>
                    </div>
                    {b.evidence && <p className="text-xs text-gray-600 mb-2">{b.evidence}</p>}
                    {b.negative_blocker && (
                      <div className="mb-2">
                        <span className="text-[10px] font-bold text-red-600">Negative blocker: </span>
                        <span className="text-xs text-gray-700">{b.negative_blocker}</span>
                      </div>
                    )}
                    {b.positive_emotions && b.positive_emotions.length > 0 && (
                      <div className="mb-2 flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold text-emerald-600">Positive shifts: </span>
                        {b.positive_emotions.map((e: string, ei: number) => (
                          <span key={ei} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">{e}</span>
                        ))}
                      </div>
                    )}
                    {b.micro_tasks && b.micro_tasks.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-teal-700 mb-1">Micro baby tasks to crack this belief:</p>
                        <ol className="list-decimal list-inside space-y-0.5">
                          {b.micro_tasks.map((t: string, ti: number) => <li key={ti} className="text-xs text-gray-700">{t}</li>)}
                        </ol>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">Click "Generate Analysis" to identify top beliefs and emotions from coachee data.</p>
            )}
          </div>
        </Section>
      )}

      {/* Coach Insights — coach only */}
      {isCoach && (
        <Section title="Coach Insights" icon={<Brain className="w-4 h-4 text-indigo-600" />}>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Select activity to analyze</label>
              <div className="flex flex-wrap gap-1.5">
                {enabledActivities.map(actType => (
                  <button key={actType} onClick={() => { setSelectedActivity(actType); analyzeActivity(actType); }}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border capitalize ${selectedActivity === actType ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                    {ACTIVITY_LABELS[actType] ?? actType}
                  </button>
                ))}
              </div>
            </div>

            {/* Tabs: Current | History | Create New */}
            {selectedActivity && (
              <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                <button onClick={() => setInsightsTab('current')} className={`text-xs font-semibold px-2 py-1 rounded-lg ${insightsTab === 'current' ? 'text-indigo-700 bg-indigo-50' : 'text-gray-500'}`}>Current</button>
                <button onClick={() => loadInsightsHistory(selectedActivity)} className={`text-xs font-semibold px-2 py-1 rounded-lg flex items-center gap-1 ${insightsTab === 'history' ? 'text-indigo-700 bg-indigo-50' : 'text-gray-500'}`}>
                  <History className="w-3 h-3" /> History
                </button>
                <button onClick={() => analyzeActivity(selectedActivity)} className="text-xs font-semibold px-2 py-1 rounded-lg flex items-center gap-1 text-teal-600 hover:bg-teal-50">
                  <Plus className="w-3 h-3" /> Create New
                </button>
              </div>
            )}

            {insightsTab === 'history' ? (
              <div className="space-y-2">
                {insightsHistory.length === 0 ? <p className="text-xs text-gray-400">No history yet.</p> : (
                  insightsHistory.map((h, i) => (
                    <div key={h.id ?? i} className="bg-white border border-gray-100 rounded-xl p-3">
                      <p className="text-[10px] text-gray-400 mb-1">{new Date(h.created_at).toLocaleString()}</p>
                      <p className="text-xs text-gray-600 whitespace-pre-wrap">{h.insights_text}</p>
                      {Array.isArray(h.conversation_json) && h.conversation_json.length > 0 && (
                        <div className="mt-2 space-y-1.5">
                          <p className="text-[10px] font-bold text-gray-400">Follow-ups:</p>
                          {h.conversation_json.map((m: any, mi: number) => (
                            <div key={mi} className={`text-xs px-3 py-1.5 rounded-lg ${m.role === 'user' ? 'bg-teal-50 text-teal-700' : 'bg-gray-50 text-gray-600'} whitespace-pre-wrap`}>
                              <span className="font-semibold">{m.role === 'user' ? 'Coach' : 'AI'}:</span> {m.content}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            ) : (
              <>
                {selectedActivity && (() => {
                  const act = activities.find(a => a.activity_type === selectedActivity);
                  const cqs = act?.coach_questions ?? [];
                  return cqs.length > 0 ? (
                    <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3">
                      <p className="text-xs font-bold text-indigo-700 mb-2">Coach Questions for {ACTIVITY_LABELS[selectedActivity]}:</p>
                      <ol className="list-decimal list-inside space-y-1">
                        {cqs.map((q: string, i: number) => <li key={i} className="text-xs text-gray-700">{q}</li>)}
                      </ol>
                    </div>
                  ) : <p className="text-xs text-gray-400">No coach questions configured for this activity.</p>;
                })()}
                {analyzingActivity && <div className="flex items-center gap-2 text-xs text-gray-500"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing activity data...</div>}
                {coachAnswer && !analyzingActivity && (
                  <div className="bg-white border border-gray-100 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold text-gray-700 flex items-center gap-1"><Sparkles className="w-3.5 h-3.5 text-teal-500" /> AI Analysis</p>
                    </div>
                    <div className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">{coachAnswer}</div>
                  </div>
                )}
                {selectedActivity && coachAnswer && !analyzingActivity && (
                  <div>
                    <p className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1"><MessageSquare className="w-3 h-3" /> Ask follow-up questions</p>
                    <div ref={chatRef} className="max-h-64 overflow-y-auto space-y-2 mb-3 bg-gray-50 rounded-xl p-4">
                      {chatMsgs.map((m, i) => (
                        <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`text-xs px-4 py-2 rounded-xl max-w-[75%] whitespace-pre-wrap ${m.role === 'user' ? 'bg-teal-600 text-white' : 'bg-white border border-gray-200 text-gray-700'}`}>
                            {m.content}
                          </div>
                        </div>
                      ))}
                      {chatLoading && <div className="flex justify-start"><div className="text-xs px-3 py-1.5 rounded-xl bg-white border border-gray-200"><Loader2 className="w-3 h-3 animate-spin inline" /> Thinking...</div></div>}
                    </div>
                    <div className="flex gap-2">
                      <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat()}
                        placeholder="Ask a follow-up..." className="flex-1 px-3 py-2.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-teal-400" />
                      <button onClick={sendChat} disabled={chatLoading} className="text-xs text-white bg-teal-600 hover:bg-teal-700 px-4 py-2.5 rounded-lg disabled:opacity-50">
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </Section>
      )}

      {/* Thought Pattern Analysis — coach only */}
      {isCoach && (
        <Section title="Thought Pattern Analysis" icon={<Sparkles className="w-4 h-4 text-teal-600" />}>
          <div className="flex justify-end mb-3">
            <button onClick={runAnalysis} disabled={analyzing}
              className="flex items-center gap-1.5 text-xs text-white bg-teal-600 hover:bg-teal-700 px-3 py-1.5 rounded-lg disabled:opacity-50">
              {analyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              {analyzing ? 'Analyzing...' : analysis ? 'Re-run Thought Analysis' : 'Run Thought Analysis'}
            </button>
          </div>
          {!analysis ? <p className="text-xs text-gray-400">Click "Run Thought Analysis" to detect patterns.</p> : (
            <div className="space-y-5">
              {analysis.undercurrents.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> Detected Undercurrents</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {analysis.undercurrents.map((u, i) => (
                      <div key={i} className="bg-teal-50 rounded-xl p-3 border border-teal-100">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-bold text-teal-800">{u.label}</p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${u.trend === 'growing' ? 'bg-emerald-100 text-emerald-700' : u.trend === 'declining' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{u.trend}</span>
                        </div>
                        <p className="text-xs text-gray-600">{u.explanation}</p>
                        <div className="mt-1.5"><div className="h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-teal-400 rounded-full" style={{ width: `${u.confidence === 'high' ? 90 : u.confidence === 'medium' ? 60 : 30}%` }} /></div></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {analysis.word_cloud.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1"><BarChart3 className="w-3.5 h-3.5" /> Top Thought Components</p>
                  <div className="space-y-1.5">
                    {analysis.word_cloud.slice(0, 8).map((w) => {
                      const maxCount = Math.max(...analysis.word_cloud.map(x => x.count));
                      const pct = (w.count / maxCount) * 100;
                      return (
                        <div key={w.word} className="flex items-center gap-2">
                          <span className={`text-xs font-semibold w-24 truncate ${w.is_negative ? 'text-red-600' : 'text-teal-700'}`}>{w.word}</span>
                          <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${w.is_negative ? 'bg-red-400' : 'bg-teal-400'}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-gray-500 w-8 text-right">{w.count}</span>
                        </div>
                      );
                    })}
                  </div>
                  {analysis.negative_words.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {analysis.negative_words.map((w, i) => <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100">{w}</span>)}
                    </div>
                  )}
                </div>
              )}
              {analysis.recommendations && (analysis.recommendations.direction || analysis.recommendations.focus_now) && (
                <div>
                  <p className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1"><Target className="w-3.5 h-3.5" /> Recommendations</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {analysis.recommendations.direction && <div className="bg-teal-50 rounded-xl p-3 border border-teal-100"><p className="text-xs font-bold text-teal-800 mb-1">Direction</p><p className="text-xs text-gray-600">{analysis.recommendations.direction}</p></div>}
                    {analysis.recommendations.focus_now && <div className="bg-amber-50 rounded-xl p-3 border border-amber-100"><p className="text-xs font-bold text-amber-800 mb-1">Focus Now</p><p className="text-xs text-gray-600">{analysis.recommendations.focus_now}</p></div>}
                  </div>
                  {analysis.recommendations.next_actions?.length > 0 && (
                    <div className="mt-2 bg-gray-50 rounded-xl p-3 border border-gray-100">
                      <p className="text-xs font-semibold text-gray-600 mb-1">Next Actions:</p>
                      <ol className="list-decimal list-inside text-xs text-gray-600 space-y-0.5">
                        {analysis.recommendations.next_actions.map((a, i) => <li key={i}>{a}</li>)}
                      </ol>
                    </div>
                  )}
                </div>
              )}
              {analysis.johari_window && (
                <div>
                  <p className="text-xs font-bold text-gray-700 mb-2">Johari Window</p>
                  <div className="grid grid-cols-2 gap-2">
                    <JohariQuadrant title="Open" items={analysis.johari_window.open} icon={<Eye className="w-3 h-3" />} bg="bg-emerald-50" border="border-emerald-200" text="text-emerald-700" />
                    <JohariQuadrant title="Blind" items={analysis.johari_window.blind} icon={<HelpCircle className="w-3 h-3" />} bg="bg-amber-50" border="border-amber-200" text="text-amber-700" />
                    <JohariQuadrant title="Hidden" items={analysis.johari_window.hidden} icon={<EyeOff className="w-3 h-3" />} bg="bg-indigo-50" border="border-indigo-200" text="text-indigo-700" />
                    <JohariQuadrant title="Unknown" items={analysis.johari_window.unknown} icon={<HelpCircle className="w-3 h-3" />} bg="bg-gray-50" border="border-gray-200" text="text-gray-600" />
                  </div>
                </div>
              )}
            </div>
          )}
        </Section>
      )}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <p className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-1.5">{icon} {title}</p>
      {children}
    </div>
  );
}

function JohariQuadrant({ title, items, icon, bg, border, text }: { title: string; items: string[]; icon: React.ReactNode; bg: string; border: string; text: string }) {
  return (
    <div className={`${bg} ${border} border rounded-xl p-3`}>
      <p className={`text-xs font-bold ${text} flex items-center gap-1 mb-1.5`}>{icon} {title}</p>
      {items.length === 0 ? <p className="text-[10px] text-gray-400 italic">—</p> : (
        <ul className="space-y-0.5">
          {items.map((item, i) => <li key={i} className="text-[10px] text-gray-600">{item}</li>)}
        </ul>
      )}
    </div>
  );
}
