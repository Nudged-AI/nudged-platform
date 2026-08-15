import React, { useState, useEffect } from 'react';
import {
  ThumbsUp, Loader2, RefreshCw, Target, AlertTriangle, CheckCircle2,
  ArrowRight, CreditCard as Edit2, Music, ExternalLink,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { callLLM, parseJSON } from '../lib/llm';
import { callEDAgent } from '../lib/ed-agent';
import type { UserProfile } from '../lib/supabase';

interface Props {
  userId: string;
  profile: UserProfile;
  onViewRoadmap: (visionId: string) => void;
}

interface Vision {
  id: string;
  vision_name: string;
  target_date: string;
}

interface Habit {
  id: string;
  challenge_category: string;
  habit_text: string;
  habit_type: string;
  thumbs_up: boolean;
  vision_id: string;
}

interface RoadmapMini {
  step_number: number;
  title: string;
  status: string;
  target_period: string;
  description: string;
}

interface NeedsAttention {
  type: string;
  message: string;
  action: string;
}

interface NewsItem {
  headline: string;
  summary: string;
  timeframe: string;
  news_type?: string;
  citation_url?: string;
  citation_source?: string;
}

const CATEGORY_STORY_IMAGES: Record<string, string> = {
  Money: 'https://images.pexels.com/photos/534216/pexels-photo-534216.jpeg?auto=compress&cs=tinysrgb&w=600',
  Financial: 'https://images.pexels.com/photos/6801648/pexels-photo-6801648.jpeg?auto=compress&cs=tinysrgb&w=600',
  Health: 'https://images.pexels.com/photos/1552252/pexels-photo-1552252.jpeg?auto=compress&cs=tinysrgb&w=600',
  Business: 'https://images.pexels.com/photos/3182812/pexels-photo-3182812.jpeg?auto=compress&cs=tinysrgb&w=600',
  Career: 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=600',
  Fear: 'https://images.pexels.com/photos/1547813/pexels-photo-1547813.jpeg?auto=compress&cs=tinysrgb&w=600',
  Beliefs: 'https://images.pexels.com/photos/1051838/pexels-photo-1051838.jpeg?auto=compress&cs=tinysrgb&w=600',
  Family: 'https://images.pexels.com/photos/1128318/pexels-photo-1128318.jpeg?auto=compress&cs=tinysrgb&w=600',
  Time: 'https://images.pexels.com/photos/1600661/pexels-photo-1600661.jpeg?auto=compress&cs=tinysrgb&w=600',
  default: 'https://images.pexels.com/photos/1181675/pexels-photo-1181675.jpeg?auto=compress&cs=tinysrgb&w=600',
};

function getStoryImage(cat: string) {
  const key = Object.keys(CATEGORY_STORY_IMAGES).find((k) => cat.toLowerCase().includes(k.toLowerCase()));
  return CATEGORY_STORY_IMAGES[key ?? 'default'];
}

const NUDGE_BG_COLORS = [
  'from-teal-700 to-teal-500',
  'from-blue-700 to-blue-500',
  'from-slate-700 to-slate-500',
  'from-emerald-700 to-emerald-500',
  'from-cyan-700 to-cyan-500',
  'from-teal-800 to-teal-600',
  'from-blue-800 to-blue-600',
  'from-slate-800 to-slate-600',
  'from-emerald-800 to-emerald-600',
  'from-cyan-800 to-cyan-600',
];

export default function NudgesPage({ userId, profile, onViewRoadmap }: Props) {
  const [visions, setVisions] = useState<Vision[]>([]);
  const [activeVisionId, setActiveVisionId] = useState<string | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [concern, setConcern] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [loadingStory, setLoadingStory] = useState(false);
  const [quote, setQuote] = useState<{ quote: string; author: string; meaning: string } | null>(null);
  const [story, setStory] = useState<{ title: string; person: string; story: string; lesson: string; source?: string; category?: string } | null>(null);
  const [roadmapPreview, setRoadmapPreview] = useState<RoadmapMini[]>([]);
  const [needsAttention, setNeedsAttention] = useState<NeedsAttention[]>([]);
  const [edInsight, setEdInsight] = useState('');
  const [updatedTime, setUpdatedTime] = useState('');

  useEffect(() => {
    loadVisions();
    setUpdatedTime(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }));
  }, [userId]);

  useEffect(() => {
    if (activeVisionId) {
      loadHabitsForVision(activeVisionId);
      loadRoadmapPreview(activeVisionId);
      checkNeedsAttention(activeVisionId);
      callEDAgent(profile, activeVisionId).then((r) => {
        if (r) {
          setEdInsight(r.stuck_point + ' ' + (r.root_pattern_summary ?? ''));
          loadQuoteWithContext(activeVisionId, r.stuck_point);
          loadStoryWithContext(activeVisionId, r.stuck_point);
        } else {
          loadQuoteWithContext(activeVisionId, '');
          loadStoryWithContext(activeVisionId, '');
        }
      }).catch(() => {
        loadQuoteWithContext(activeVisionId, '');
        loadStoryWithContext(activeVisionId, '');
      });
    }
  }, [activeVisionId]);

  const loadVisions = async () => {
    const { data } = await supabase.from('visions').select('id, vision_name, target_date').eq('user_id', userId).eq('status', 'active').order('vision_order');
    const v = (data as Vision[]) ?? [];
    setVisions(v);
    if (v.length > 0) setActiveVisionId(v[0].id);
  };

  const loadHabitsForVision = async (vid: string) => {
    setLoading(true);
    const { data } = await supabase.from('vision_habits').select('*').eq('vision_id', vid).order('sort_order');
    setHabits((data as Habit[]) ?? []);
    setLoading(false);
  };

  const loadRoadmapPreview = async (vid: string) => {
    const { data } = await supabase.from('vision_roadmap').select('step_number, title, status, target_period, description').eq('vision_id', vid).order('step_number').limit(5);
    setRoadmapPreview((data as RoadmapMini[]) ?? []);
  };

  const checkNeedsAttention = async (vid: string) => {
    const issues: NeedsAttention[] = [];
    const { data: rm } = await supabase.from('vision_roadmap').select('target_period, status').eq('vision_id', vid);
    if (rm?.find((r) => r.status === 'in_progress')) issues.push({ type: 'roadmap', message: 'Roadmap step in progress', action: 'Review' });
    const { data: ch } = await supabase.from('vision_challenges').select('is_closed').eq('vision_id', vid).eq('is_closed', false);
    if ((ch?.length ?? 0) > 0) issues.push({ type: 'challenges', message: `${ch?.length} open challenges`, action: 'Take Action' });
    setNeedsAttention(issues);
  };

  const getCatAndVision = async (vid: string) => {
    const { data: ch } = await supabase.from('vision_challenges').select('challenge_category').eq('vision_id', vid).limit(1);
    const cat = ch?.[0]?.challenge_category ?? 'Beliefs';
    const vision = visions.find((v) => v.id === vid);
    return { cat, vision };
  };

  const loadQuoteWithContext = async (vid: string, insight: string) => {
    setLoadingQuote(true);
    try {
      const { cat, vision } = await getCatAndVision(vid);
      const raw = await callLLM('quote_of_day', {
        challenge_category: cat,
        concern_text: insight || concern,
        vision_name: vision?.vision_name ?? '',
      });
      type QuoteResp = { quote: string; author: string; source: string; meaning: string };
      const parsed = parseJSON<QuoteResp>(raw);
      if (parsed) setQuote({ quote: parsed.quote, author: parsed.author, meaning: parsed.meaning });
    } catch (err) { console.error(err); }
    finally { setLoadingQuote(false); }
  };

  const loadStoryWithContext = async (vid: string, insight: string) => {
    setLoadingStory(true);
    try {
      const { cat, vision } = await getCatAndVision(vid);
      const age = profile.date_of_birth ? String(new Date().getFullYear() - new Date(profile.date_of_birth).getFullYear()) : '';
      const raw = await callLLM('story_of_challenge', {
        vision_name: vision?.vision_name ?? '',
        challenge_category: cat,
        concern_text: insight || concern,
        age, gender: profile.gender,
        profession: profile.profession,
        marital_status: profile.marital_status,
        children: String(profile.children),
      });
      type StoryResp = { title: string; person: string; story: string; lesson: string; source?: string };
      const parsed = parseJSON<StoryResp>(raw);
      if (parsed) setStory({ ...parsed, category: cat });
    } catch (err) { console.error(err); }
    finally { setLoadingStory(false); }
  };

  const handleConcernSubmit = async () => {
    if (!activeVisionId || !concern.trim()) return;
    // Reload quote, story, and nudges based on concern
    loadQuoteWithContext(activeVisionId, concern);
    loadStoryWithContext(activeVisionId, concern);
    // Regenerate habits with concern context
    setLoading(true);
    try {
      const { data: ch } = await supabase.from('vision_challenges').select('challenge_category, challenge_text, is_starred').eq('vision_id', activeVisionId);
      const vision = visions.find((v) => v.id === activeVisionId);
      const age = profile.date_of_birth ? String(new Date().getFullYear() - new Date(profile.date_of_birth).getFullYear()) : '';
      const cats = [...new Set((ch ?? []).map((c) => c.challenge_category))].join(', ');
      const specs = (ch ?? []).filter((c) => c.is_starred).slice(0, 5).map((c) => c.challenge_text).join('; ');
      const raw = await callLLM('habits', {
        name: profile.full_name, age, gender: profile.gender,
        profession_type: profile.profession, job_business_details: profile.job_business_details,
        marital_status: profile.marital_status, children_details: String(profile.children),
        family_dependencies: `${profile.marital_status}, ${profile.children} children`,
        vision_name: vision?.vision_name ?? '', vision_description: '',
        target_date: vision?.target_date ?? '', why_best_suited: '',
        what_if_not_achieved: '',
        challenge_categories: cats, specific_challenges: `${specs} - User concern: ${concern}`,
        custom_challenges: '', biggest_fears: concern, avoided_actions: '',
      });
      type HabitResponse = { challenge_nudges: Array<{ nudges: Array<{ nudge: string; nudge_type: string; when_to_flash: string }>, challenge_category: string; likely_hidden_belief: string; emotional_block: string }> };
      const parsed = parseJSON<HabitResponse>(raw);
      if (parsed?.challenge_nudges) {
        await supabase.from('vision_habits').delete().eq('vision_id', activeVisionId);
        const habitRows = parsed.challenge_nudges.flatMap((cat, ci) =>
          cat.nudges.map((n, ni) => ({
            vision_id: activeVisionId, user_id: userId,
            challenge_category: cat.challenge_category, habit_text: n.nudge,
            habit_type: n.nudge_type, when_to_flash: n.when_to_flash,
            likely_hidden_belief: cat.likely_hidden_belief,
            emotional_block: cat.emotional_block, is_custom: false, sort_order: ci * 10 + ni,
          }))
        );
        if (habitRows.length) {
          await supabase.from('vision_habits').insert(habitRows);
          await loadHabitsForVision(activeVisionId);
        }
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
    setUpdatedTime(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }));
  };

  const thumbUp = async (habit: Habit) => {
    const newVal = !habit.thumbs_up;
    await supabase.from('vision_habits').update({ thumbs_up: newVal }).eq('id', habit.id);
    setHabits((prev) => prev.map((h) => h.id === habit.id ? { ...h, thumbs_up: newVal } : h));
  };

  const topHabits = habits.slice(0, 10);
  const currentRoadmapStep = roadmapPreview.find((r) => r.status === 'in_progress');

  const statusColor: Record<string, string> = {
    completed: 'bg-teal-500 text-white', in_progress: 'bg-blue-500 text-white', upcoming: 'bg-gray-200 text-gray-500',
  };

  return (
    <div className="w-full pb-8">
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <h1 className="text-2xl font-bold text-gray-900">My Nudges</h1>
        <p className="text-sm text-gray-500 mt-0.5">Daily guidance for your vision</p>
      </div>

      {/* Vision tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 px-5">
        {visions.map((v) => (
          <button key={v.id} onClick={() => setActiveVisionId(v.id)}
            className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all ${activeVisionId === v.id ? 'bg-teal-600 text-white border-teal-600' : 'border-gray-200 text-gray-600 hover:border-teal-300 bg-white'}`}>
            <Target className="w-3.5 h-3.5" /> {v.vision_name}
          </button>
        ))}
      </div>

      {/* Concern input */}
      <div className="mx-5 mt-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <h2 className="font-bold text-gray-800 mb-3 text-sm">What is on your mind today?</h2>
        <textarea
          value={concern}
          onChange={(e) => setConcern(e.target.value)}
          placeholder="Share what is bothering you or what you want to focus on today..."
          rows={2}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Updated {updatedTime}
          </span>
          <button onClick={handleConcernSubmit} disabled={!concern.trim() || loading}
            className="px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 transition-all flex items-center gap-1.5">
            {loading ? <><Loader2 className="w-3 h-3 animate-spin" /> Refreshing…</> : 'Refresh Nudges'}
          </button>
        </div>
      </div>

      {/* Today's Nudges */}
      <div className="mt-5 px-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs font-bold">1</div>
          <h2 className="font-bold text-gray-800">Today's Nudges</h2>
          {loading && <Loader2 className="w-4 h-4 animate-spin text-teal-500" />}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1,2,3,4].map((i) => <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />)}
          </div>
        ) : topHabits.length === 0 ? (
          <div className="bg-gray-50 rounded-2xl p-6 text-center">
            <p className="text-sm text-gray-400">Complete your vision board first to see personalised nudges here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {topHabits.map((habit, idx) => (
              <div key={habit.id} className={`relative bg-gradient-to-br ${NUDGE_BG_COLORS[idx % NUDGE_BG_COLORS.length]} rounded-2xl p-5 shadow-md flex flex-col justify-between min-h-32`}>
                <div>
                  <span className="text-white/30 text-5xl font-serif leading-none select-none">"</span>
                  <p className="text-white text-base font-bold leading-snug tracking-wide -mt-2">{habit.habit_text}</p>
                  <span className="text-white/30 text-5xl font-serif leading-none select-none float-right -mt-4">"</span>
                </div>
                <div className="flex items-center justify-between mt-4 clear-both">
                  <span className="text-xs text-white/60 bg-white/10 rounded-full px-2.5 py-0.5 font-medium">{habit.challenge_category}</span>
                  <button onClick={() => thumbUp(habit)}
                    className={`p-1.5 rounded-xl border transition-all ${habit.thumbs_up ? 'bg-white/30 text-white border-white/40' : 'border-white/20 text-white/50 hover:text-white hover:border-white/40'}`}>
                    <ThumbsUp className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quote + Story */}
      <div className="mt-6 px-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold">2</div>
          <h2 className="font-bold text-gray-800">Quote & Story</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Quote */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Quote of the Day</p>
              <button onClick={() => activeVisionId && loadQuoteWithContext(activeVisionId, edInsight)} disabled={loadingQuote}
                className="text-xs text-teal-600 hover:underline flex items-center gap-1">
                {loadingQuote ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              </button>
            </div>
            {loadingQuote ? (
              <div className="p-5 space-y-2">
                <div className="h-4 bg-gray-100 rounded animate-pulse" />
                <div className="h-4 bg-gray-100 rounded animate-pulse w-3/4" />
              </div>
            ) : quote ? (
              <div className="p-5">
                <div className="bg-gray-50 rounded-xl p-4 relative">
                  <span className="absolute -top-3 left-3 text-teal-400 text-6xl font-serif leading-none">"</span>
                  <p className="text-sm font-semibold text-gray-800 italic leading-relaxed pt-3">{quote.quote}</p>
                  <span className="absolute -bottom-4 right-3 text-teal-400 text-6xl font-serif leading-none">"</span>
                </div>
                <p className="text-xs text-teal-600 font-bold mt-5">— {quote.author}</p>
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-600 leading-relaxed">{quote.meaning}</p>
                </div>
              </div>
            ) : (
              <div className="p-5 text-center"><p className="text-sm text-gray-400">Loading your daily quote…</p></div>
            )}
          </div>

          {/* Story */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Story for Your Challenge</p>
              <button onClick={() => activeVisionId && loadStoryWithContext(activeVisionId, edInsight)} disabled={loadingStory}
                className="text-xs text-teal-600 hover:underline flex items-center gap-1">
                {loadingStory ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              </button>
            </div>
            {loadingStory ? (
              <div><div className="h-28 bg-gray-100 animate-pulse" /><div className="p-4 space-y-2"><div className="h-3 bg-gray-100 rounded animate-pulse" /></div></div>
            ) : story ? (
              <div>
                <img src={getStoryImage(story.category ?? '')} alt="" className="w-full h-28 object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                <div className="p-4">
                  <p className="text-sm font-bold text-gray-800 leading-snug">How {story.person} {story.title.toLowerCase()}</p>
                  <p className="text-xs text-gray-600 mt-2 leading-relaxed">{story.story}</p>
                  <div className="mt-3 bg-teal-50 rounded-xl px-3 py-2">
                    <p className="text-xs text-teal-700 font-semibold">{story.lesson}</p>
                  </div>
                  {story.source && (
                    <p className="text-xs text-gray-400 mt-2">Source: {story.source}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-5 text-center"><p className="text-sm text-gray-400">Loading your story…</p></div>
            )}
          </div>
        </div>
      </div>

      {/* Good News */}
      {activeVisionId && (
        <div className="mt-6 px-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold">3</div>
            <h2 className="font-bold text-gray-800">Good News</h2>
          </div>
          <GoodNewsSection
            visionId={activeVisionId}
            visionName={visions.find((v) => v.id === activeVisionId)?.vision_name ?? ''}
            profile={profile}
          />
        </div>
      )}

      {/* Roadmap Status */}
      {roadmapPreview.length > 0 && (
        <div className="mt-6 mx-5 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">4</div>
              <h2 className="font-bold text-gray-800">Roadmap Status</h2>
            </div>
            <button onClick={() => activeVisionId && onViewRoadmap(activeVisionId)}
              className="text-xs text-teal-600 hover:underline flex items-center gap-1 font-medium">
              Full Roadmap <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2">
            {roadmapPreview.slice(0, 3).map((step, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition-colors">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${statusColor[step.status]}`}>
                  {step.status === 'completed' ? <CheckCircle2 className="w-3.5 h-3.5" /> : step.step_number}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{step.title}</p>
                  <p className="text-xs text-gray-400">{step.target_period}</p>
                </div>
                <span className={`text-xs rounded-full px-2 py-0.5 font-medium flex-shrink-0 ${step.status === 'completed' ? 'bg-teal-100 text-teal-700' : step.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                  {step.status === 'in_progress' ? 'In Progress' : step.status === 'completed' ? 'Done' : 'Upcoming'}
                </span>
              </div>
            ))}
          </div>
          {currentRoadmapStep && (
            <div className="mt-3 p-3 bg-blue-50 rounded-xl">
              <p className="text-xs font-bold text-blue-700">Now: Milestone {currentRoadmapStep.step_number} — {currentRoadmapStep.title}</p>
              <p className="text-xs text-blue-600 mt-0.5 leading-relaxed">{currentRoadmapStep.description.slice(0, 100)}…</p>
            </div>
          )}
        </div>
      )}

      {/* Meditation placeholder */}
      <div className="mt-4 mx-5 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center flex-shrink-0">
            <Music className="w-6 h-6 text-teal-500" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <div className="w-6 h-6 rounded-full bg-teal-500 text-white flex items-center justify-center text-xs font-bold">5</div>
              <p className="text-sm font-bold text-gray-800">Meditation</p>
            </div>
            <p className="text-xs text-gray-500">Guided audio sessions — coming soon.</p>
          </div>
        </div>
      </div>

      {/* Needs Attention */}
      {needsAttention.length > 0 && (
        <div className="mt-4 mx-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold">!</div>
            <h2 className="font-bold text-gray-800">Needs Attention</h2>
          </div>
          <div className="space-y-2">
            {needsAttention.map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-red-50 border border-red-100">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <p className="text-xs font-semibold text-red-700">{item.message}</p>
                </div>
                <button onClick={() => activeVisionId && onViewRoadmap(activeVisionId)}
                  className="text-xs text-red-600 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-100 transition-all font-medium flex-shrink-0">
                  {item.action}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom actions */}
      <div className="flex gap-3 mt-5 px-5">
        <button onClick={() => activeVisionId && onViewRoadmap(activeVisionId)}
          className="flex items-center gap-2 px-4 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all">
          View Challenges <ArrowRight className="w-4 h-4" />
        </button>
        <button onClick={() => activeVisionId && onViewRoadmap(activeVisionId)}
          className="flex items-center gap-2 px-4 py-3 border border-teal-300 rounded-xl text-sm font-semibold text-teal-700 hover:bg-teal-50 transition-all">
          <Edit2 className="w-4 h-4" /> Edit Vision
        </button>
      </div>
    </div>
  );
}

function GoodNewsSection({ visionId, visionName, profile }: { visionId: string; visionName: string; profile: UserProfile }) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { load(); }, [visionId]);

  const load = async () => {
    setLoading(true);
    try {
      const { data: ch } = await supabase.from('vision_challenges').select('challenge_category').eq('vision_id', visionId).limit(1);
      const cat = ch?.[0]?.challenge_category ?? 'Beliefs';
      const age = profile.date_of_birth ? String(new Date().getFullYear() - new Date(profile.date_of_birth).getFullYear()) : '';
      const raw = await callLLM('good_news', {
        vision_name: visionName, challenge_category: cat, concern_text: '',
        name: profile.full_name,
        user_context: `${profile.profession}, ${age} years old, ${profile.marital_status}`,
      });
      const parsed = parseJSON<NewsItem[]>(raw);
      if (parsed) setItems(parsed);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  if (loading) return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[1,2,3].map((i) => <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />)}
    </div>
  );

  const newsImages = [
    'https://images.pexels.com/photos/6801648/pexels-photo-6801648.jpeg?auto=compress&cs=tinysrgb&w=400',
    'https://images.pexels.com/photos/3184292/pexels-photo-3184292.jpeg?auto=compress&cs=tinysrgb&w=400',
    'https://images.pexels.com/photos/7413916/pexels-photo-7413916.jpeg?auto=compress&cs=tinysrgb&w=400',
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {items.map((item, i) => (
        <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden group">
          <img src={newsImages[i % newsImages.length]} alt="" className="w-full h-20 object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <div className="p-3">
            {item.news_type && (
              <span className={`inline-block mb-1.5 text-xs rounded-full px-2 py-0.5 font-medium ${item.news_type === 'informational' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                {item.news_type === 'informational' ? 'Info' : 'Action'}
              </span>
            )}
            <p className="text-xs font-bold text-gray-800 leading-snug">{item.headline}</p>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">{item.summary}</p>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-green-700 bg-green-100 rounded-full px-2 py-0.5 font-medium">{item.timeframe}</span>
              {item.citation_url && (
                <a
                  href={item.citation_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-teal-600 hover:underline flex items-center gap-0.5"
                >
                  {item.citation_source ?? 'Source'} <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
            </div>
          </div>
        </div>
      ))}
      {items.length === 0 && <p className="text-sm text-gray-400 col-span-3">No news available right now.</p>}
    </div>
  );
}
