import React, { useState, useEffect, useRef } from 'react';
import { Plus, ChevronLeft, ChevronRight, Star, Target, CreditCard as Edit2, Trash2, ArrowRight, Send, Loader2, Zap, MessageCircle, Newspaper, CheckCircle2, Trophy, Quote, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { callLLM, parseJSON } from '../lib/llm';
import { callEDAgent } from '../lib/ed-agent';
import type { UserProfile } from '../lib/supabase';

interface Props {
  userId: string;
  profile: UserProfile;
  onAddVision: () => void;
  onEditVision: (visionId: string) => void;
}

interface Vision {
  id: string;
  vision_name: string;
  vision_description: string;
  vision_image_url: string;
  target_date: string;
  why_best_suited: string;
  for_whom: string[];
  what_if_not_achieved: string;
  calm_points: number;
  created_at: string;
}

interface RoadmapStep {
  id: string;
  step_number: number;
  title: string;
  description: string;
  target_period: string;
  status: 'completed' | 'in_progress' | 'upcoming';
  sub_milestones?: string[];
}

interface WiseMessage {
  role: 'user' | 'assistant';
  content: string;
  formatted?: { quote?: string; author?: string; explanation?: string };
}

interface NewsItem {
  headline: string;
  summary: string;
  timeframe: string;
  news_type?: string;
  citation_url?: string;
  citation_source?: string;
}

// Pexels images per vision theme (keyword-based fallbacks)
const THEME_IMAGES: Record<string, string> = {
  financial: 'https://images.pexels.com/photos/534216/pexels-photo-534216.jpeg?auto=compress&cs=tinysrgb&w=1200',
  health: 'https://images.pexels.com/photos/1552252/pexels-photo-1552252.jpeg?auto=compress&cs=tinysrgb&w=1200',
  career: 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=1200',
  business: 'https://images.pexels.com/photos/3182812/pexels-photo-3182812.jpeg?auto=compress&cs=tinysrgb&w=1200',
  family: 'https://images.pexels.com/photos/1128318/pexels-photo-1128318.jpeg?auto=compress&cs=tinysrgb&w=1200',
  travel: 'https://images.pexels.com/photos/346885/pexels-photo-346885.jpeg?auto=compress&cs=tinysrgb&w=1200',
  education: 'https://images.pexels.com/photos/159775/library-la-trobe-study-students-159775.jpeg?auto=compress&cs=tinysrgb&w=1200',
  default: 'https://images.pexels.com/photos/1181675/pexels-photo-1181675.jpeg?auto=compress&cs=tinysrgb&w=1200',
};

function getThemeImage(visionName: string, imageUrl?: string) {
  if (imageUrl) return imageUrl;
  const lower = visionName.toLowerCase();
  if (lower.includes('financ') || lower.includes('money') || lower.includes('wealth')) return THEME_IMAGES.financial;
  if (lower.includes('health') || lower.includes('fit') || lower.includes('weight')) return THEME_IMAGES.health;
  if (lower.includes('career') || lower.includes('job') || lower.includes('promot')) return THEME_IMAGES.career;
  if (lower.includes('business') || lower.includes('startup') || lower.includes('entrepreneur')) return THEME_IMAGES.business;
  if (lower.includes('family') || lower.includes('child') || lower.includes('parent')) return THEME_IMAGES.family;
  if (lower.includes('travel') || lower.includes('explore')) return THEME_IMAGES.travel;
  if (lower.includes('educ') || lower.includes('learn') || lower.includes('study')) return THEME_IMAGES.education;
  return THEME_IMAGES.default;
}

function MedalBoard({ visionId }: { visionId: string }) {
  const [raised, setRaised] = useState(0);
  const [closed, setClosed] = useState(0);

  useEffect(() => {
    supabase.from('vision_challenges').select('id, is_closed').eq('vision_id', visionId).then(({ data }) => {
      setRaised(data?.length ?? 0);
      setClosed(data?.filter((d) => d.is_closed).length ?? 0);
    });
  }, [visionId]);

  const rate = raised > 0 ? Math.round((closed / raised) * 100) : 0;

  return (
    <div className="grid grid-cols-4 gap-3">
      {[
        { label: 'Challenges', value: raised, color: 'bg-blue-50 text-blue-700', icon: Trophy },
        { label: 'Closed', value: closed, color: 'bg-teal-50 text-teal-700', icon: CheckCircle2 },
        { label: 'Calm Points', value: closed * 20, color: 'bg-amber-50 text-amber-700', icon: Star },
        { label: 'Success %', value: `${rate}%`, color: 'bg-green-50 text-green-700', icon: Target },
      ].map(({ label, value, color, icon: Icon }) => (
        <div key={label} className={`rounded-2xl px-3 py-3 ${color} flex flex-col items-center text-center`}>
          <Icon className="w-4 h-4 mb-1 opacity-60" />
          <p className="text-lg font-bold">{value}</p>
          <p className="text-xs font-medium opacity-70 mt-0.5">{label}</p>
        </div>
      ))}
    </div>
  );
}

function RoadmapVertical({ steps }: { steps: RoadmapStep[] }) {
  const statusColor: Record<string, string> = {
    completed: 'bg-teal-500 text-white border-teal-500',
    in_progress: 'bg-blue-500 text-white border-blue-500',
    upcoming: 'bg-white text-gray-400 border-gray-200',
  };
  const statusBadge: Record<string, string> = {
    completed: 'bg-teal-100 text-teal-700',
    in_progress: 'bg-blue-100 text-blue-700',
    upcoming: 'bg-gray-100 text-gray-500',
  };
  const stepBg: Record<string, string> = {
    completed: 'border-teal-100 bg-teal-50/20',
    in_progress: 'border-blue-100 bg-blue-50/30',
    upcoming: 'border-gray-100',
  };

  return (
    <div className="relative space-y-4">
      <div className="absolute left-4 top-5 bottom-5 w-0.5 bg-gradient-to-b from-teal-300 via-blue-200 to-gray-200" />
      {steps.map((step) => (
        <div key={step.id} className="relative flex gap-3">
          <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 z-10 shadow-sm ${statusColor[step.status]}`}>
            {step.status === 'completed' ? <CheckCircle2 className="w-4 h-4" /> : step.step_number}
          </div>
          <div className={`flex-1 border rounded-2xl overflow-hidden shadow-sm ${stepBg[step.status]}`}>
            <div className={`flex items-start justify-between px-4 py-3 border-b ${stepBg[step.status]}`}>
              <p className="text-sm font-bold text-gray-800 leading-snug flex-1">{step.title}</p>
              <span className={`text-xs rounded-full px-2 py-0.5 font-medium flex-shrink-0 ml-2 ${statusBadge[step.status]}`}>
                {step.status === 'in_progress' ? 'In Progress' : step.status === 'completed' ? 'Completed' : 'Upcoming'}
              </span>
            </div>
            <div className="px-4 py-3">
              <p className="text-xs text-gray-500 leading-relaxed">{step.description}</p>
              <p className="text-xs text-gray-400 mt-1.5">Target: {step.target_period}</p>

              {/* Sub-milestones */}
              {(step.sub_milestones ?? []).length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Action Steps</p>
                  {(step.sub_milestones ?? []).map((sub, si) => (
                    <div key={si} className="flex items-start gap-2">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${step.status === 'completed' ? 'border-teal-400 bg-teal-100' : 'border-gray-200'}`}>
                        {step.status === 'completed' && <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />}
                      </div>
                      <p className="text-xs text-gray-600 leading-snug">{sub}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function WiseAdvicePanel({ vision, profile }: { vision: Vision; profile: UserProfile }) {
  const [mode, setMode] = useState<'quick' | 'deep'>('quick');
  const [messages, setMessages] = useState<WiseMessage[]>([]);
  const [recentMessages, setRecentMessages] = useState<WiseMessage[]>([]);
  const [showRecent, setShowRecent] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [edInsight, setEdInsight] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [welcomeMsg, setWelcomeMsg] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    supabase.from('wise_advice_messages').select('role, content, created_at').eq('vision_id', vision.id).order('created_at', { ascending: false }).limit(40).then(({ data }) => {
      if (data?.length) {
        // Keep last 10 as recent, show empty current session
        const all = [...data].reverse().map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
        setRecentMessages(all.slice(-20));
      }
    });
    callEDAgent(profile, vision.id).then((r) => {
      if (r) {
        setEdInsight(r.stuck_point + ' ' + (r.root_pattern_summary ?? ''));
        if (r.coaching_questions?.length) setSuggestions(r.coaching_questions.slice(0, 3));
        // Build welcome message
        const name = profile.full_name.split(' ')[0];
        const hour = new Date().getHours();
        const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
        let welcome = `${greeting}, ${name}! How's the day going?`;
        if (r.stuck_point && r.stuck_point.length > 10) {
          welcome += ` I noticed you've been working through some challenges around ${r.stuck_point.slice(0, 60).toLowerCase()}. Hope things are getting clearer.`;
        }
        setWelcomeMsg(welcome);
      } else {
        const name = profile.full_name.split(' ')[0];
        setWelcomeMsg(`Hi ${name}! How's the day going? I'm here to help with your vision journey.`);
      }
    }).catch(() => {
      const name = profile.full_name.split(' ')[0];
      setWelcomeMsg(`Hi ${name}! How's the day going?`);
    });
  }, [vision.id]);

  const send = async (question: string) => {
    if (!question.trim()) return;
    const q = question.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: q }]);
    setLoading(true);

    try {
      const pastQ = messages.filter((m) => m.role === 'user').slice(-5).map((m) => m.content).join('; ');
      const age = profile.date_of_birth ? String(new Date().getFullYear() - new Date(profile.date_of_birth).getFullYear()) : '';
      const { data: challenges } = await supabase.from('vision_challenges').select('challenge_category, challenge_text').eq('vision_id', vision.id).limit(10);
      const cats = [...new Set((challenges ?? []).map((c) => c.challenge_category))].join(', ');
      const specs = (challenges ?? []).slice(0, 5).map((c) => c.challenge_text).join('; ');

      const conversationHistory = messages.slice(-6).map((m) => `${m.role === 'user' ? 'User' : 'Coach'}: ${m.content}`).join('\n');

      const raw = await callLLM(mode === 'quick' ? 'wise_advice_quick' : 'wise_advice_deep', {
        name: profile.full_name, age, gender: profile.gender,
        profession: profile.profession, marital_status: profile.marital_status, children: String(profile.children),
        vision_name: vision.vision_name, vision_description: vision.vision_description,
        challenge_categories: cats, specific_challenges: specs,
        past_questions: pastQ, parked_thoughts: '',
        user_question: q, conversation_history: conversationHistory,
        ed_agent_insight: edInsight,
      });

      let msg: WiseMessage;
      if (mode === 'quick') {
        type QuickResp = { quote: string; author: string; explanation: string };
        const parsed = parseJSON<QuickResp>(raw);
        msg = { role: 'assistant', content: parsed ? `"${parsed.quote}" — ${parsed.author}\n\n${parsed.explanation}` : raw, formatted: parsed ?? undefined };
      } else {
        type DeepResp = { question: string };
        const parsed = parseJSON<DeepResp>(raw);
        msg = { role: 'assistant', content: parsed?.question ?? raw };
      }

      setMessages((prev) => [...prev, msg]);
      await supabase.from('wise_advice_messages').insert([
        { vision_id: vision.id, user_id: profile.id, mode, role: 'user', content: q },
        { vision_id: vision.id, user_id: profile.id, mode, role: 'assistant', content: msg.content },
      ]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Unable to connect right now. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const quickSuggestions = suggestions.length > 0 ? suggestions : ['How do I stay consistent?', 'What is blocking me?', 'How do I start today?'];

  return (
    <div className="space-y-4">
      {/* Welcome message */}
      {welcomeMsg && messages.length === 0 && (
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center flex-shrink-0">
            <MessageCircle className="w-4 h-4 text-white" />
          </div>
          <div className="bg-gradient-to-r from-teal-50 to-blue-50 border border-teal-100 rounded-2xl px-4 py-3 max-w-sm">
            <p className="text-sm text-gray-700 leading-relaxed">{welcomeMsg}</p>
          </div>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {(['quick', 'deep'] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${mode === m ? 'bg-teal-600 text-white border-teal-600' : 'border-gray-200 text-gray-600 hover:border-teal-300'}`}>
            {m === 'quick' ? <><Zap className="w-3.5 h-3.5" /> Quick Advice</> : <><MessageCircle className="w-3.5 h-3.5" /> Deep Discussion</>}
          </button>
        ))}
        {recentMessages.length > 0 && (
          <button onClick={() => setShowRecent(!showRecent)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-gray-200 text-gray-500 hover:bg-gray-50 transition-all">
            Recent Chats {showRecent ? '▲' : '▼'}
          </button>
        )}
      </div>

      {showRecent && recentMessages.length > 0 && (
        <div className="bg-gray-50 rounded-2xl p-3 max-h-40 overflow-y-auto space-y-2 border border-gray-100">
          <p className="text-xs font-semibold text-gray-500 mb-2">Recent Conversations</p>
          {recentMessages.slice(-10).map((m, i) => (
            <div key={i} className={`text-xs rounded-xl px-3 py-2 max-w-xs ${m.role === 'user' ? 'bg-teal-100 text-teal-800 ml-auto' : 'bg-white text-gray-600 border border-gray-100'}`}>
              {m.content.slice(0, 100)}{m.content.length > 100 ? '…' : ''}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-500">{mode === 'quick' ? 'Get a wise quote and explanation tailored to your vision.' : 'A one-question-at-a-time coaching journey to uncover your root pattern.'}</p>

      <div className="bg-gray-50 rounded-2xl p-4 min-h-32 max-h-96 overflow-y-auto space-y-3">
        {messages.length === 0 && <p className="text-xs text-gray-400 text-center py-8">Ask a question to start your coaching session.</p>}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'assistant' && m.formatted?.quote ? (
              <div className="max-w-sm bg-white shadow-sm border border-teal-100 rounded-2xl p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <Quote className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm font-semibold text-gray-800 italic">{m.formatted.quote}</p>
                </div>
                <p className="text-xs text-teal-600 font-medium">— {m.formatted.author}</p>
                <div className="border-t border-gray-100 pt-2">
                  <p className="text-xs text-gray-600 leading-relaxed">{m.formatted.explanation}</p>
                </div>
              </div>
            ) : (
              <div className={`max-w-xs rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-teal-600 text-white' : 'bg-white shadow-sm border border-gray-100 text-gray-700 font-medium'}`}>
                {m.content}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white shadow-sm border border-gray-100 rounded-2xl px-4 py-3">
              <Loader2 className="w-4 h-4 animate-spin text-teal-500" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {mode === 'quick' && messages.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {quickSuggestions.map((s) => (
            <button key={s} onClick={() => send(s)}
              className="text-xs bg-teal-50 text-teal-700 px-3 py-1.5 rounded-full border border-teal-100 hover:bg-teal-100 transition-all">
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send(input)}
          placeholder={mode === 'quick' ? 'Ask anything about your vision…' : 'Share what\'s on your mind…'}
          className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
        <button onClick={() => send(input)} disabled={!input.trim() || loading}
          className="bg-teal-600 text-white rounded-xl px-4 py-3 hover:bg-teal-700 transition-all disabled:opacity-50">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function GoodNewsPanel({ vision, profile }: { vision: Vision; profile: UserProfile }) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { load(); }, [vision.id]);

  const load = async () => {
    setLoading(true);
    try {
      const { data: challenges } = await supabase.from('vision_challenges').select('challenge_category').eq('vision_id', vision.id).limit(3);
      const cat = challenges?.[0]?.challenge_category ?? '';
      const age = profile.date_of_birth ? String(new Date().getFullYear() - new Date(profile.date_of_birth).getFullYear()) : '';
      const userContext = `${profile.profession}, ${age} years old, ${profile.marital_status}, ${profile.children} children`;
      const raw = await callLLM('good_news', {
        vision_name: vision.vision_name,
        challenge_category: cat,
        concern_text: '',
        name: profile.full_name,
        user_context: userContext,
      });
      const parsed = parseJSON<NewsItem[]>(raw);
      if (parsed) setItems(parsed);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  const newsImages = [
    'https://images.pexels.com/photos/6801648/pexels-photo-6801648.jpeg?auto=compress&cs=tinysrgb&w=400',
    'https://images.pexels.com/photos/3184292/pexels-photo-3184292.jpeg?auto=compress&cs=tinysrgb&w=400',
    'https://images.pexels.com/photos/7413916/pexels-photo-7413916.jpeg?auto=compress&cs=tinysrgb&w=400',
  ];

  return (
    <div className="space-y-4">
      {items.map((item, i) => (
        <div key={i} className="flex gap-4 p-4 rounded-2xl bg-gradient-to-r from-green-50 to-teal-50 border border-green-100">
          <img
            src={newsImages[i % newsImages.length]}
            alt=""
            className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <div className="flex-1">
            {item.news_type && (
              <span className={`inline-block mb-1 text-xs rounded-full px-2 py-0.5 font-medium ${item.news_type === 'informational' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                {item.news_type === 'informational' ? 'Informational' : 'Action'}
              </span>
            )}
            <p className="text-sm font-bold text-gray-800 leading-snug">{item.headline}</p>
            <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">{item.summary}</p>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs text-green-700 bg-green-100 rounded-full px-2.5 py-0.5 font-medium">{item.timeframe}</span>
              {item.citation_url && (
                <a href={item.citation_url} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-teal-600 hover:underline flex items-center gap-0.5">
                  {item.citation_source ?? 'Source'} <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
            </div>
          </div>
        </div>
      ))}
      {items.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No news available right now.</p>}
    </div>
  );
}

export default function VisionBoardViewPage({ userId, profile, onAddVision, onEditVision }: Props) {
  const [visions, setVisions] = useState<Vision[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [roadmaps, setRoadmaps] = useState<Record<string, RoadmapStep[]>>({});
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const activeVision = visions[activeIdx];

  useEffect(() => { loadVisions(); }, [userId]);

  useEffect(() => {
    if (activeVision && !roadmaps[activeVision.id]) loadRoadmap(activeVision.id);
  }, [activeVision]);

  const loadVisions = async () => {
    setLoading(true);
    const { data } = await supabase.from('visions').select('*').eq('user_id', userId).eq('status', 'active').order('vision_order');
    setVisions((data as Vision[]) ?? []);
    setLoading(false);
  };

  const loadRoadmap = async (vid: string) => {
    const { data } = await supabase.from('vision_roadmap').select('*').eq('vision_id', vid).order('step_number');
    if (data) setRoadmaps((prev) => ({ ...prev, [vid]: data as RoadmapStep[] }));
  };

  const deleteVision = async (id: string) => {
    await supabase.from('visions').update({ status: 'archived' }).eq('id', id);
    setDeletingId(null);
    await loadVisions();
    setActiveIdx(0);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-teal-500" /></div>;
  }

  if (visions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-16 h-16 rounded-2xl bg-teal-50 flex items-center justify-center">
          <Target className="w-8 h-8 text-teal-500" />
        </div>
        <p className="text-lg font-bold text-gray-800">No visions yet</p>
        <p className="text-sm text-gray-500">Create your first vision board to get started.</p>
        <button onClick={onAddVision} className="flex items-center gap-2 px-5 py-3 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 transition-all">
          <Plus className="w-4 h-4" /> Add Vision
        </button>
      </div>
    );
  }

  const steps = activeVision ? (roadmaps[activeVision.id] ?? []) : [];
  const heroImage = activeVision ? getThemeImage(activeVision.vision_name, activeVision.vision_image_url) : '';

  return (
    <div className="w-full">
      {/* Vision tabs */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <button onClick={() => setActiveIdx((i) => Math.max(0, i - 1))} disabled={activeIdx === 0} className="p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-30">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex gap-2 overflow-x-auto flex-1">
          {visions.map((v, i) => (
            <button key={v.id} onClick={() => setActiveIdx(i)}
              className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold transition-all ${i === activeIdx ? 'bg-teal-600 border-teal-600 text-white' : 'border-gray-200 text-gray-600 hover:border-teal-300 bg-white'}`}>
              {i === activeIdx && <CheckCircle2 className="w-3.5 h-3.5" />}
              {v.vision_name}
            </button>
          ))}
        </div>
        <button onClick={() => setActiveIdx((i) => Math.min(visions.length - 1, i + 1))} disabled={activeIdx === visions.length - 1} className="p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-30">
          <ChevronRight className="w-5 h-5" />
        </button>
        <button onClick={onAddVision} disabled={visions.length >= 3}
          className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 disabled:opacity-40 transition-all flex-shrink-0">
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {activeVision && (
        <div>
          {/* HERO BANNER - full width showstopper */}
          <div className="relative w-full" style={{ aspectRatio: '16/6', minHeight: 220 }}>
            <img src={heroImage} alt={activeVision.vision_name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6">
              <div className="flex items-end justify-between">
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight">{activeVision.vision_name}</h1>
                  {activeVision.vision_description && (
                    <p className="text-sm text-white/80 mt-1.5 max-w-lg leading-relaxed">{activeVision.vision_description}</p>
                  )}
                  {activeVision.target_date && (
                    <p className="text-xs text-white/60 mt-2">Target: {new Date(activeVision.target_date).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</p>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => onEditVision(activeVision.id)}
                    className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm text-white px-3 py-2 rounded-xl text-xs font-semibold hover:bg-white/30 transition-all border border-white/20">
                    <Edit2 className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button onClick={() => setDeletingId(activeVision.id)}
                    className="bg-white/20 backdrop-blur-sm text-white px-3 py-2 rounded-xl text-xs font-semibold hover:bg-red-500/50 transition-all border border-white/20">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="px-5 py-4 space-y-5">
            {/* Medal board */}
            <MedalBoard visionId={activeVision.id} />

            {/* Good News - expanded by default */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-50">
                <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
                  <Newspaper className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">Good News for You</p>
                  <p className="text-xs text-gray-400">Uplifting developments relevant to your vision</p>
                </div>
              </div>
              <div className="px-5 py-5">
                <GoodNewsPanel vision={activeVision} profile={profile} />
              </div>
            </div>

            {/* Roadmap - expanded, vertical */}
            {steps.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center flex-shrink-0">
                      <Target className="w-5 h-5 text-teal-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-800">My Roadmap</p>
                      <p className="text-xs text-gray-400">{steps.filter((s) => s.status === 'completed').length} of {steps.length} milestones completed</p>
                    </div>
                  </div>
                  <button onClick={() => onEditVision(activeVision.id)}
                    className="text-xs text-teal-600 font-semibold hover:underline flex items-center gap-1">
                    Edit <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="px-5 py-5">
                  <RoadmapVertical steps={steps} />
                </div>
              </div>
            )}

            {/* Wise Advice - expanded */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-50">
                <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="w-5 h-5 text-teal-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">Wise Advice</p>
                  <p className="text-xs text-gray-400">Quick quote or deep one-on-one coaching discussion</p>
                </div>
              </div>
              <div className="px-5 py-5">
                <WiseAdvicePanel vision={activeVision} profile={profile} />
              </div>
            </div>
          </div>
        </div>
      )}

      {deletingId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <h3 className="font-bold text-gray-900 mb-2">Delete this vision?</h3>
            <p className="text-sm text-gray-500 mb-5">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingId(null)} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all">Cancel</button>
              <button onClick={() => deleteVision(deletingId)} className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-all">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
