import React, { useState, useEffect, useRef } from 'react';
import { X, Zap, Send, Loader2, Quote, ChevronDown, ChevronUp, MessageCircle, Users, DollarSign, Check } from 'lucide-react';
import { supabase } from '../supabase';
import { callLLM, parseJSON } from '../lib/llm';
import { callEDAgent } from '../lib/ed-agent';
import type { UserProfile } from '../supabase';

interface Props {
  userId: string;
  profile: UserProfile;
  externalOpen?: boolean;
  onExternalOpenHandled?: () => void;
}

type Mode = 'friend' | 'deep' | 'quick';

interface WiseMessage {
  role: 'user' | 'assistant';
  content: string;
  formatted?: { quote: string; author: string; explanation: string };
}

interface Vision {
  id: string;
  vision_name: string;
  vision_description: string;
}

const HARRY_AVATAR = '/ayan.som_Smiling_smart_bearded_man_wearing_a_navy_blue_cap._C_fb57000e-dbb4-45e5-8b4d-2e2505c55642_2.png';

const FRIEND_OPENERS = [
  (name: string, ctx: string) => `Hey ${name}! ${ctx} How's everything going with you today?`,
  (name: string, ctx: string) => `${name}! Good to see you. ${ctx} How are you holding up?`,
  (name: string, ctx: string) => `Hi ${name}! ${ctx} What's been on your mind lately?`,
  (name: string, ctx: string) => `Hey ${name}, hope you're doing well. ${ctx} How's the day been?`,
];

export default function WiseAdviceFloat({ userId, profile, externalOpen, onExternalOpenHandled }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (externalOpen) { setOpen(true); onExternalOpenHandled?.(); }
  }, [externalOpen]);
  const [mode, setMode] = useState<Mode>('friend');
  const [visions, setVisions] = useState<Vision[]>([]);
  const [vision, setVision] = useState<Vision | null>(null);
  const [messages, setMessages] = useState<WiseMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [creditExhausted, setCreditExhausted] = useState(false);
  const [topUpSent, setTopUpSent] = useState(false);
  const [edInsight, setEdInsight] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [welcomeMsg, setWelcomeMsg] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initialized = useRef(false);

  const switchVision = (v: Vision) => {
    setVision(v);
    setMessages([]);
    setWelcomeMsg('');
    setEdInsight('');
    setSuggestions([]);
    initialized.current = false;
  };

  useEffect(() => {
    supabase
      .from('visions')
      .select('id, vision_name, vision_description')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data?.length) {
          setVisions(data as Vision[]);
          setVision(data[0] as Vision);
        }
      });
  }, [userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!open || !vision || initialized.current) return;
    initialized.current = true;

    const loadContext = async () => {
      try {
        const [edResult, wiseHistory, diaryData, challenges, harryPrefs] = await Promise.all([
          callEDAgent(profile, vision.id).catch(() => null),
          supabase.from('wise_advice_messages').select('content, role, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(6),
          supabase.from('diary_entries').select('topic, content, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(3),
          supabase.from('vision_challenges').select('challenge_text, is_starred').eq('vision_id', vision.id).limit(5),
          supabase.from('harry_preferences').select('preference_key, preference_value').eq('user_id', userId).limit(20),
        ]);

        let insight = '';
        if (edResult) {
          insight = edResult.stuck_point + ' ' + (edResult.root_pattern_summary ?? '');
          setEdInsight(insight);
          if (edResult.coaching_questions?.length) setSuggestions(edResult.coaching_questions.slice(0, 3));
        }

        const name = profile.full_name.split(' ')[0];
        const prevUserMessages = (wiseHistory.data ?? []).filter((m) => m.role === 'user');
        const latestDiary = (diaryData.data ?? [])[0];
        const starredChallenge = (challenges.data ?? []).find((c) => c.is_starred);
        const prefs: Record<string, string> = {};
        (harryPrefs.data ?? []).forEach((p) => { prefs[p.preference_key] = p.preference_value; });

        let ctx = '';
        if (prevUserMessages.length > 0) {
          const lastMsg = prevUserMessages[0].content;
          const when = new Date(wiseHistory.data![0].created_at).toLocaleDateString('en-US', { weekday: 'long' });
          ctx = `Last time on ${when} you mentioned "${lastMsg.slice(0, 55)}…" — hope that's getting better.`;
        } else if (profile.children > 0) {
          ctx = `Hope the little one${profile.children > 1 ? 's are' : ' is'} doing well!`;
        } else if (latestDiary) {
          ctx = `I noticed your diary entry about "${latestDiary.topic}" — sounds like there's a lot going on.`;
        } else if (prefs['sleep_time']) {
          ctx = `Hope you got to bed by ${prefs['sleep_time']} last night!`;
        } else if (starredChallenge) {
          ctx = `Still thinking about that challenge of yours — "${starredChallenge.challenge_text.slice(0, 45)}…"`;
        } else if (insight?.length > 10) {
          ctx = `Hope the ${insight.slice(0, 50).toLowerCase().split('.')[0]} stuff is easing up.`;
        }

        const opener = FRIEND_OPENERS[Math.floor(Math.random() * FRIEND_OPENERS.length)];
        setWelcomeMsg(opener(name, ctx));
      } catch {
        const name = profile.full_name.split(' ')[0];
        setWelcomeMsg(`Hey ${name}! Great to see you — how's the day going?`);
      }
    };

    loadContext();
  }, [open, vision]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  const send = async (question: string) => {
    if (!question.trim() || !vision) return;
    const q = question.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: q }]);
    setLoading(true);
    try {
      const age = profile.date_of_birth ? String(new Date().getFullYear() - new Date(profile.date_of_birth).getFullYear()) : '';
      const [challengesRes, openRes, closedRes, diaryRes, wiseHistRes, prefsRes] = await Promise.all([
        supabase.from('vision_challenges').select('challenge_category, challenge_text, is_starred').eq('vision_id', vision.id).limit(10),
        supabase.from('vision_challenges').select('challenge_text').eq('vision_id', vision.id).eq('is_closed', false).limit(5),
        supabase.from('vision_challenges').select('challenge_text').eq('vision_id', vision.id).eq('is_closed', true).limit(3),
        supabase.from('diary_entries').select('topic, content, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
        supabase.from('wise_advice_messages').select('content, role').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
        supabase.from('harry_preferences').select('preference_key, preference_value').eq('user_id', userId).limit(20),
      ]);

      const cats = [...new Set((challengesRes.data ?? []).map((c) => c.challenge_category))].join(', ');
      const specs = (challengesRes.data ?? []).slice(0, 5).map((c) => c.challenge_text).join('; ');
      const openList = (openRes.data ?? []).map((c) => c.challenge_text).join('; ');
      const closedList = (closedRes.data ?? []).map((c) => c.challenge_text).join('; ');
      const diaryContext = (diaryRes.data ?? []).map((d) => `[${d.topic}]: ${d.content?.slice(0, 100)}`).join(' | ');
      const pastHistory = (wiseHistRes.data ?? []).reverse().map((m) => `${m.role === 'user' ? 'User' : 'Harry'}: ${m.content}`).join('\n');
      const conversationHistory = messages.slice(-6).map((m) => `${m.role === 'user' ? 'User' : 'Harry'}: ${m.content}`).join('\n');
      const harryPrefsStr = (prefsRes.data ?? []).map((p) => `${p.preference_key}: ${p.preference_value}`).join(', ');

      let promptKey: string;
      let vars: Record<string, string>;

      if (mode === 'quick') {
        promptKey = 'wise_advice_quick';
        vars = {
          name: profile.full_name, age, gender: profile.gender,
          profession: profile.profession, marital_status: profile.marital_status,
          children: String(profile.children),
          vision_name: vision.vision_name, vision_description: vision.vision_description,
          challenge_categories: cats, specific_challenges: specs,
          user_question: q, conversation_history: conversationHistory,
          ed_agent_insight: edInsight,
        };
      } else if (mode === 'deep') {
        promptKey = 'wise_harry_deep';
        vars = {
          name: profile.full_name, age, gender: profile.gender,
          profession: profile.profession, marital_status: profile.marital_status,
          children: String(profile.children),
          vision_name: vision.vision_name, vision_description: vision.vision_description,
          challenge_categories: cats, specific_challenges: specs,
          open_challenges: openList, closed_challenges: closedList,
          diary_context: diaryContext, past_history: pastHistory,
          user_question: q, conversation_history: conversationHistory,
          ed_agent_insight: edInsight,
        };
      } else {
        promptKey = 'wise_harry_friend';
        const istTime = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
        const lastUserMsg = (wiseHistRes.data ?? []).find((m) => m.role === 'user')?.content ?? '';
        vars = {
          name: profile.full_name, age, gender: profile.gender,
          profession: profile.profession, marital_status: profile.marital_status,
          children: String(profile.children),
          vision_names: vision.vision_name,
          ist_time: istTime,
          ed_insight: edInsight,
          last_message: lastUserMsg.slice(0, 100),
          preferences: harryPrefsStr,
          harry_preferences: harryPrefsStr,
          diary_context: diaryContext, past_history: pastHistory,
          user_question: q, conversation_history: conversationHistory,
        };
      }

      const raw = await callLLM(promptKey, vars);
      let msg: WiseMessage;

      if (mode === 'quick') {
        type Q = { quote: string; author: string; explanation: string };
        const parsed = parseJSON<Q>(raw);
        msg = { role: 'assistant', content: parsed ? `"${parsed.quote}" — ${parsed.author}\n\n${parsed.explanation}` : raw, formatted: parsed ?? undefined };
      } else if (mode === 'friend') {
        type F = { response: string; remember?: { key: string; value: string } | null };
        const parsed = parseJSON<F>(raw);
        msg = { role: 'assistant', content: parsed?.response ?? raw };
        if (parsed?.remember?.key && parsed?.remember?.value) {
          await supabase.from('harry_preferences').upsert({
            user_id: userId, preference_key: parsed.remember.key, preference_value: parsed.remember.value, updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id,preference_key' });
        }
      } else {
        type D = { response: string };
        const parsed = parseJSON<D>(raw);
        msg = { role: 'assistant', content: parsed?.response ?? raw };
      }

      setMessages((prev) => [...prev, msg]);
      await supabase.from('wise_advice_messages').insert([
        { vision_id: vision.id, user_id: userId, mode, role: 'user', content: q },
        { vision_id: vision.id, user_id: userId, mode, role: 'assistant', content: msg.content },
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('credit_exhausted')) {
        setCreditExhausted(true);
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: "Sorry, I'm having trouble connecting right now. Try again in a moment." }]);
      }
    } finally {
      setLoading(false);
    }
  };

  const friendSuggestions = ["How's your day?", 'Tell me what happened', "I need to talk about something"];
  const quickSuggestions = suggestions.length > 0 ? suggestions : ['How do I stay consistent?', 'What is blocking me?', 'How do I start today?'];
  const currentSuggestions = mode === 'friend' ? friendSuggestions : quickSuggestions;

  if (!vision) return null;

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:left-60" onClick={() => setOpen(false)} />
      )}

      {open && (
        <div className="fixed bottom-0 left-0 right-0 md:left-60 z-50 flex items-end justify-start p-0 md:p-6 pointer-events-none">
          <div
            className="w-full md:w-[460px] bg-white rounded-t-3xl md:rounded-3xl shadow-2xl border border-gray-100 flex flex-col pointer-events-auto"
            style={{ maxHeight: 'calc(100vh - 5rem)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0 bg-gradient-to-r from-teal-600 to-teal-700 rounded-t-3xl md:rounded-t-3xl">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/40 flex-shrink-0 shadow-md">
                  <img src={HARRY_AVATAR} alt="Wise Harry" className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white">Wise Harry</p>
                  {visions.length > 1 ? (
                    <select
                      value={vision?.id ?? ''}
                      onChange={(e) => { const v = visions.find((x) => x.id === e.target.value); if (v) switchVision(v); }}
                      className="text-xs text-teal-100 font-medium bg-transparent border-none outline-none cursor-pointer max-w-[180px] truncate"
                    >
                      {visions.map((v) => <option key={v.id} value={v.id}>{v.vision_name}</option>)}
                    </select>
                  ) : (
                    <p className="text-xs text-teal-100 truncate max-w-[200px]">{vision?.vision_name}</p>
                  )}
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="p-2 text-white/70 hover:text-white hover:bg-white/20 rounded-xl transition-all flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mode selector — Friend first, Deep second, Quick third */}
            <div className="flex gap-1.5 px-4 pt-3 pb-2 flex-shrink-0">
              <button
                onClick={() => setMode('friend')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${mode === 'friend' ? 'bg-teal-600 text-white border-teal-600' : 'border-gray-200 text-gray-500 hover:border-teal-300'}`}
              >
                <Users className="w-3 h-3" /> My Friend Harry
              </button>
              <button
                onClick={() => setMode('deep')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${mode === 'deep' ? 'bg-teal-600 text-white border-teal-600' : 'border-gray-200 text-gray-500 hover:border-teal-300'}`}
              >
                <MessageCircle className="w-3 h-3" /> Deep Discussion
              </button>
              <button
                onClick={() => setMode('quick')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${mode === 'quick' ? 'bg-teal-600 text-white border-teal-600' : 'border-gray-200 text-gray-500 hover:border-teal-300'}`}
              >
                <Zap className="w-3 h-3" /> Quick Advice
              </button>
            </div>
            {mode === 'friend' && (
              <p className="px-4 pb-2 text-xs text-gray-400 flex-shrink-0">Harry chats like a friend — check-ins, daily habits, and a nudge about your goal when it fits.</p>
            )}
            {mode === 'deep' && (
              <p className="px-4 pb-2 text-xs text-gray-400 flex-shrink-0">Harry leads a coaching conversation with 3–4 loaded questions aimed at finding a breakthrough.</p>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
              {welcomeMsg && messages.length === 0 && (
                <div className="flex gap-2.5">
                  <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border border-teal-100">
                    <img src={HARRY_AVATAR} alt="Harry" className="w-full h-full object-cover" />
                  </div>
                  <div className="bg-gradient-to-r from-teal-50 to-blue-50 border border-teal-100 rounded-2xl px-3 py-2.5 max-w-[85%]">
                    <p className="text-sm text-gray-700 leading-relaxed">{welcomeMsg}</p>
                  </div>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start gap-2.5'}`}>
                  {m.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border border-teal-100">
                      <img src={HARRY_AVATAR} alt="Harry" className="w-full h-full object-cover" />
                    </div>
                  )}
                  {m.role === 'assistant' && m.formatted?.quote ? (
                    <div className="max-w-[80%] bg-white shadow-sm border border-teal-100 rounded-2xl p-3.5 space-y-2">
                      <div className="flex items-start gap-2">
                        <Quote className="w-3.5 h-3.5 text-teal-400 flex-shrink-0 mt-0.5" />
                        <p className="text-sm font-bold text-gray-800 italic leading-snug">{m.formatted.quote}</p>
                      </div>
                      <p className="text-xs text-teal-600 font-semibold">— {m.formatted.author}</p>
                      <div className="border-t border-gray-100 pt-2">
                        <p className="text-xs text-gray-600 leading-relaxed">{m.formatted.explanation}</p>
                      </div>
                    </div>
                  ) : (
                    <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${m.role === 'user' ? 'bg-teal-600 text-white' : 'bg-white shadow-sm border border-gray-100 text-gray-700'}`}>
                      {m.content}
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex justify-start gap-2.5">
                  <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border border-teal-100">
                    <img src={HARRY_AVATAR} alt="Harry" className="w-full h-full object-cover" />
                  </div>
                  <div className="bg-white shadow-sm border border-gray-100 rounded-2xl px-3.5 py-2.5 flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Suggestions */}
            {messages.length === 0 && (
              <div className="flex flex-wrap gap-2 px-4 pb-2 flex-shrink-0">
                {currentSuggestions.map((s) => (
                  <button key={s} onClick={() => send(s)} className="text-xs bg-teal-50 text-teal-700 px-3 py-1.5 rounded-full border border-teal-100 hover:bg-teal-100 transition-all">
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Credit exhausted banner */}
            {creditExhausted && (
              <div className="mx-4 mb-3 bg-red-50 border border-red-100 rounded-2xl p-4 flex-shrink-0">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <p className="text-sm font-semibold text-red-700">AI credits exhausted</p>
                </div>
                <p className="text-xs text-red-600 mb-3">Your $5 credit balance is at zero. Request a $5 top-up and we'll approve it shortly.</p>
                {topUpSent ? (
                  <div className="flex items-center gap-1.5 text-xs text-teal-700 font-semibold">
                    <Check className="w-3.5 h-3.5" /> Request sent! We'll top you up soon.
                  </div>
                ) : (
                  <button
                    onClick={async () => {
                      await supabase.from('credit_requests').insert({ user_id: userId, requested_usd: 5.0, status: 'pending' });
                      setTopUpSent(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 text-white rounded-xl text-xs font-semibold hover:bg-teal-700 transition-all"
                  >
                    <DollarSign className="w-3 h-3" /> Request $5 Top-up
                  </button>
                )}
              </div>
            )}

            {/* Input */}
            <div className="flex gap-2 px-4 pb-4 pt-2 border-t border-gray-100 flex-shrink-0">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send(input)}
                placeholder={creditExhausted ? 'Credits exhausted — request top-up above' : mode === 'friend' ? 'Chat with Harry…' : mode === 'quick' ? 'Ask Harry anything…' : "Share what's on your mind…"}
                disabled={creditExhausted}
                className="flex-1 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 min-w-0 disabled:bg-gray-50 disabled:text-gray-400"
              />
              <button onClick={() => send(input)} disabled={!input.trim() || loading || creditExhausted} className="bg-teal-600 text-white rounded-xl px-3.5 py-2.5 hover:bg-teal-700 transition-all disabled:opacity-50 flex-shrink-0">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${open ? 'bg-teal-600 text-white' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
      >
        <span className="flex items-center gap-3">
          <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 border border-gray-200">
            <img src={HARRY_AVATAR} alt="Harry" className="w-full h-full object-cover" />
          </div>
          Wise Harry
        </span>
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
      </button>
    </>
  );
}
