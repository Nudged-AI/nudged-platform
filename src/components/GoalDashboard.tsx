import React, { useEffect, useState } from 'react';
import { RefreshCw, Image as ImageIcon, Youtube, Brain, CloudLightning, Loader2, ExternalLink, Trash2 } from 'lucide-react';
import { getTagColor } from '../lib/tags';
import { supabase, SUPABASE_URL } from '../supabase';
import { callLLM, parseJSON } from '../lib/llm';
import { InfoButton } from './Tutorial';

interface ParkedItem {
  id: string;
  content: string;
  tags: string[];
  is_highlighted: boolean;
  is_closed: boolean;
  milestone_index: number;
  created_at: string;
  image_url?: string | null;
}

interface Goal {
  id: string;
  title: string;
  created_at: string;
  target_date: string | null;
  milestone_labels?: string[] | null;
}

interface Props {
  goal: Goal;
  items: ParkedItem[];
  onRefresh: () => void;
  lastRefresh: Date;
  onNavigateToAll?: (opts?: { tag?: string; milestoneTag?: string; highlightedOnly?: boolean }) => void;
  userId: string;
}

interface YoutubeVideo {
  id: string;
  title: string;
  thumbnail: string;
  channel: string;
}

interface JohariData {
  visible_strengths: string[];
  visible_limitations: string[];
  hidden_fears: string[];
  hidden_talents: string[];
  summary: string;
}

interface WordCloudData {
  negative_words: string[];
  reframed: { original: string; reframed: string }[];
  summary: string;
}

const DEFAULT_MILESTONES = ['Getting Committed', 'Building Roadmap', 'Start Journey', 'Final Stretch', 'Finish Line'];

function daysAgo(date: string) {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
}

function daysUntil(date: string) {
  return Math.floor((new Date(date).getTime() - Date.now()) / 86400000);
}

function getProgressColor(daysRemaining: number | null): string {
  if (daysRemaining === null) return 'bg-gray-300';
  if (daysRemaining < 0) return 'bg-red-900';
  if (daysRemaining <= 10) return 'bg-red-500';
  if (daysRemaining <= 25) return 'bg-amber-500';
  return 'bg-green-500';
}

function getProgressTextColor(daysRemaining: number | null): string {
  if (daysRemaining === null) return 'text-gray-500';
  if (daysRemaining < 0) return 'text-red-900';
  if (daysRemaining <= 10) return 'text-red-600';
  if (daysRemaining <= 25) return 'text-amber-600';
  return 'text-green-600';
}

export default function GoalDashboard({ goal, items, onRefresh, lastRefresh, onNavigateToAll, userId }: Props) {
  const [now, setNow] = useState(new Date());
  const [ytVideos, setYtVideos] = useState<YoutubeVideo[] | null>(null);
  const [ytLoading, setYtLoading] = useState(false);
  const [johariData, setJohariData] = useState<JohariData | null>(null);
  const [johariLoading, setJohariLoading] = useState(false);
  const [wordData, setWordData] = useState<WordCloudData | null>(null);
  const [wordLoading, setWordLoading] = useState(false);

  useEffect(() => { setNow(new Date()); }, [lastRefresh]);

  // Load persisted cache on mount
  useEffect(() => {
    supabase.from('goal_dashboard_cache').select('cache_key,cache_data').eq('goal_id', goal.id).then(({ data }) => {
      if (!data) return;
      for (const row of data) {
        if (row.cache_key === 'youtube') setYtVideos(row.cache_data as YoutubeVideo[]);
        if (row.cache_key === 'johari') setJohariData(row.cache_data as JohariData);
        if (row.cache_key === 'wordcloud') setWordData(row.cache_data as WordCloudData);
      }
    });
  }, [goal.id]);

  const open = items.filter(i => !i.is_closed);
  const milestoneLabels = (goal.milestone_labels?.length === 5 ? goal.milestone_labels : DEFAULT_MILESTONES);

  const tagCounts: Record<string, number> = {};
  for (const item of open) {
    for (const tag of (item.tags ?? [])) {
      tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
    }
  }
  const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const milestoneStats = [0, 1, 2, 3, 4].map(mi => ({
    label: milestoneLabels[mi],
    open: open.filter(i => i.milestone_index === mi).length,
    aged: open.filter(i => i.milestone_index === mi && daysAgo(i.created_at) > 50).length,
  }));

  const daysRemaining = goal.target_date ? daysUntil(goal.target_date) : null;
  const goalAge = daysAgo(goal.created_at);
  const daysTotal = goal.target_date ? Math.max(1, daysUntil(goal.created_at) + goalAge) : null;
  const progressPct = daysTotal ? Math.min(100, Math.max(0, (goalAge / daysTotal) * 100)) : 0;
  const progressColor = getProgressColor(daysRemaining);
  const progressTextColor = getProgressTextColor(daysRemaining);

  const sortedOpen = [...open].sort((a, b) => daysAgo(b.created_at) - daysAgo(a.created_at));
  const topHighlighted = sortedOpen.filter(i => i.is_highlighted).slice(0, 5);
  const topNonHighlighted = sortedOpen.filter(i => !i.is_highlighted).slice(0, 5);
  const images = items.filter(i => i.image_url).map(i => ({ url: i.image_url!, id: i.id, content: i.content }));
  const customTags = topTags.map(([t]) => t).filter(t => !['tasks','challenge','gratitude','ideas','to-do','notes'].includes(t));

  const saveCache = async (key: string, data: any) => {
    await supabase.from('goal_dashboard_cache').upsert(
      { user_id: userId, goal_id: goal.id, cache_key: key, cache_data: data, generated_at: new Date().toISOString() },
      { onConflict: 'goal_id,cache_key' }
    );
  };

  const loadYouTube = async () => {
    setYtLoading(true);
    try {
      const topTagsStr = topTags.slice(0, 3).map(([t]) => t).join(' ');
      const query = `${goal.title} ${topTagsStr}`.trim();
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/youtube-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ query }),
      });
      const json = await res.json();
      const videos = json.videos ?? [];
      setYtVideos(videos);
      await saveCache('youtube', videos);
    } catch { setYtVideos([]); } finally { setYtLoading(false); }
  };

  const loadJohari = async () => {
    if (open.length < 10) return;
    setJohariLoading(true);
    try {
      const thoughts = open.slice(0, 30).map(i => i.content).join('\n');
      const prompt = `Goal: "${goal.title}"
Thoughts:\n${thoughts}

Analyse these thoughts and create a Johari Window with exactly this JSON structure:
{"visible_strengths":["2-4 points"],"visible_limitations":["2-4 points"],"hidden_fears":["2-4 points"],"hidden_talents":["2-4 points"],"summary":"2-3 sentences summarising the person's mindset"}
Return only valid JSON.`;
      const result = await callLLM('custom_prompt', { prompt });
      const parsed = parseJSON<JohariData>(result);
      if (parsed) {
        setJohariData(parsed);
        await saveCache('johari', parsed);
      }
    } catch { /* silent */ } finally { setJohariLoading(false); }
  };

  const loadWordCloud = async () => {
    setWordLoading(true);
    try {
      const thoughts = items.slice(0, 40).map(i => i.content).join('\n');
      const NEGATIVE = ['fail','can\'t','won\'t','hard','difficult','struggle','fear','worried','anxious','stuck','lost','confused','overwhelmed','frustrated','doubt','wrong','bad','never','impossible','hate','weak','slow'];
      const wordFreq: Record<string, number> = {};
      thoughts.toLowerCase().split(/\W+/).forEach(w => {
        if (NEGATIVE.some(n => w.includes(n))) wordFreq[w] = (wordFreq[w] ?? 0) + 1;
      });
      const topNeg = Object.entries(wordFreq).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([w]) => w).filter(Boolean);
      let reframed: { original: string; reframed: string }[] = [];
      if (topNeg.length > 0) {
        const sentences = thoughts.split(/[.!?\n]+/).map(s => s.trim()).filter(s => topNeg.some(w => s.toLowerCase().includes(w))).slice(0, 10);
        if (sentences.length > 0) {
          const prompt = `Reframe these negative thoughts into positive, actionable ones. Return JSON: {"reframed":[{"original":"...","reframed":"..."}]}. Thoughts:\n${sentences.map((s, i) => `${i+1}. ${s}`).join('\n')}\nReturn only valid JSON.`;
          const result = await callLLM('custom_prompt', { prompt });
          const parsed = parseJSON<{ reframed: { original: string; reframed: string }[] }>(result);
          if (parsed?.reframed) reframed = parsed.reframed;
        }
      }
      const summaryPrompt = `Based on these thoughts about "${goal.title}", write a 2-sentence encouraging summary of patterns and growth areas. Thoughts: ${thoughts.slice(0, 500)}`;
      const summaryResult = await callLLM('custom_prompt', { prompt: summaryPrompt });
      setWordData({ negative_words: topNeg, reframed, summary: summaryResult.slice(0, 300) });
      await saveCache('wordcloud', { negative_words: topNeg, reframed, summary: summaryResult.slice(0, 300) });
    } catch { /* silent */ } finally { setWordLoading(false); }
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">Last updated: {lastRefresh.toLocaleTimeString()}</span>
        <button onClick={onRefresh} className="flex items-center gap-1.5 text-xs text-teal-600 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-lg transition">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Summary boxes */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <button onClick={() => onNavigateToAll?.()} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm text-left hover:border-teal-300 hover:shadow-md transition-all">
          <p className="text-xs text-gray-500 mb-1">Open Thoughts</p>
          <p className="text-3xl font-black text-gray-900">{open.length}</p>
        </button>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Goal Age</p>
          <p className="text-3xl font-black text-gray-900">{goalAge}<span className="text-sm font-normal text-gray-400 ml-1">days</span></p>
        </div>
        {daysRemaining !== null && (
          <div className={`rounded-xl border p-4 shadow-sm ${daysRemaining < 0 ? 'bg-red-50 border-red-100' : daysRemaining <= 10 ? 'bg-red-50 border-red-100' : daysRemaining <= 25 ? 'bg-amber-50 border-amber-100' : 'bg-green-50 border-green-100'}`}>
            <p className="text-xs text-gray-500 mb-1">Days Remaining</p>
            <p className={`text-3xl font-black ${progressTextColor}`}>{Math.abs(daysRemaining)}<span className="text-sm font-normal text-gray-400 ml-1">{daysRemaining < 0 ? 'overdue' : 'left'}</span></p>
          </div>
        )}
        {topHighlighted.length > 0 && (
          <button onClick={() => onNavigateToAll?.({ highlightedOnly: true })} className="bg-amber-50 rounded-xl border border-amber-100 p-4 shadow-sm text-left hover:border-amber-300 hover:shadow-md transition-all">
            <p className="text-xs text-amber-600 mb-1">Highlighted</p>
            <p className="text-3xl font-black text-amber-700">{topHighlighted.length}</p>
          </button>
        )}
      </div>

      {/* Image gallery — max 4 visible, scrollable */}
      {images.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <ImageIcon className="w-4 h-4 text-gray-400" />
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Images ({images.length})</p>
          </div>
          <div className="grid grid-cols-4 gap-2 overflow-y-auto" style={{ maxHeight: '13rem' }}>
            {images.map(img => (
              <div key={img.id} className="relative group aspect-square rounded-lg overflow-hidden bg-gray-100">
                <a href={img.url} target="_blank" rel="noopener noreferrer" className="block w-full h-full hover:opacity-90 transition">
                  <img src={img.url} alt="thought" className="w-full h-full object-cover" />
                </a>
                <button
                  onClick={async () => {
                    if (!confirm('Remove this image from the gallery?')) return;
                    const path = img.url.split('/').pop();
                    if (path) await supabase.storage.from('vision-assets').remove([`thought-images/${userId}/${path}`]);
                    await supabase.from('parked_items').update({ image_url: null }).eq('id', img.id);
                    onRefresh();
                  }}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition hover:bg-red-600"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top tags */}
      {topTags.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Top Tags</p>
          <div className="flex flex-wrap gap-2">
            {topTags.map(([tag, count]) => {
              const c = getTagColor(tag, customTags);
              return (
                <button key={tag} onClick={() => onNavigateToAll?.({ tag })}
                  className={`flex items-center gap-2 ${c.bg} ${c.text} px-3 py-2 rounded-xl hover:opacity-80 transition`}>
                  <span className="text-sm font-medium">#{tag}</span>
                  <span className="text-xs font-bold bg-white/60 rounded-full px-1.5 py-0.5">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Milestone progress */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Milestone Progress</p>
        {daysTotal !== null && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Created {goalAge}d ago</span>
              {daysRemaining !== null && <span className={progressTextColor}>{daysRemaining < 0 ? `${Math.abs(daysRemaining)}d overdue` : `${daysRemaining}d left`}</span>}
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full ${progressColor} rounded-full transition-all`} style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        )}
        <div className="space-y-2">
          {milestoneStats.map((ms, i) => (
            <button key={i} onClick={() => onNavigateToAll?.({ milestoneTag: ms.label })} className="flex items-center gap-3 w-full hover:bg-gray-50 rounded-lg px-1 py-0.5 transition-colors">
              <span className="text-xs text-gray-500 w-32 truncate text-left">{i+1}. {ms.label}</span>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-teal-400 rounded-full" style={{ width: ms.open > 0 ? '100%' : '0%' }} />
              </div>
              <span className="text-xs text-gray-600 w-8 text-right font-semibold">{ms.open}</span>
              {ms.aged > 0 && <span className="text-xs text-red-500 w-16 text-right">({ms.aged} aged)</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Progress Bubble Chart */}
      {open.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Journey Map — Where are your thoughts?</p>
          <div className="relative">
            {/* Axis labels */}
            <div className="flex justify-between text-xs text-gray-400 mb-2">
              <span>Start</span>
              {milestoneLabels.map((label, i) => (
                <span key={i} className="text-center truncate max-w-[80px]">{label}</span>
              ))}
              <span>Done</span>
            </div>
            {/* Journey track */}
            <div className="relative h-2 bg-gray-100 rounded-full mb-6">
              <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-teal-400 to-emerald-400 rounded-full" style={{ width: `${progressPct}%` }} />
              {milestoneLabels.map((_, i) => (
                <div key={i} className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-white bg-teal-300" style={{ left: `${((i + 1) / (milestoneLabels.length + 1)) * 100}%` }} />
              ))}
            </div>
            {/* Bubble clusters per milestone */}
            <div className="flex gap-2 items-end">
              {milestoneLabels.map((label, mi) => {
                const mItems = open.filter(i => i.milestone_index === mi);
                const highlighted = mItems.filter(i => i.is_highlighted).length;
                const aged = mItems.filter(i => daysAgo(i.created_at) > 50).length;
                const size = Math.max(32, Math.min(80, 20 + mItems.length * 8));
                const isActive = mItems.length > 0;
                return (
                  <button key={mi} onClick={() => onNavigateToAll?.({ milestoneTag: label })}
                    className="flex-1 flex flex-col items-center gap-1.5 group">
                    <div className="relative flex items-center justify-center"
                      style={{ width: `${size}px`, height: `${size}px` }}>
                      <div className={`rounded-full transition-all group-hover:scale-110 flex items-center justify-center ${
                        isActive
                          ? aged > 0 ? 'bg-red-100 border-2 border-red-300' : highlighted > 0 ? 'bg-amber-100 border-2 border-amber-300' : 'bg-teal-100 border-2 border-teal-300'
                          : 'bg-gray-50 border-2 border-dashed border-gray-200'
                      }`} style={{ width: '100%', height: '100%' }}>
                        <span className={`font-black text-lg ${isActive ? aged > 0 ? 'text-red-600' : highlighted > 0 ? 'text-amber-600' : 'text-teal-600' : 'text-gray-300'}`}>
                          {mItems.length}
                        </span>
                      </div>
                      {highlighted > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full border-2 border-white text-[9px] font-bold text-white flex items-center justify-center">{highlighted}</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 text-center leading-tight truncate w-full">{label}</span>
                    {aged > 0 && <span className="text-xs text-red-500 font-medium">{aged} aged</span>}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 mt-3 text-center">Bubble size = thought count · Amber = has highlights · Red border = has aged thoughts</p>
          </div>
        </div>
      )}

      {/* Top aged thoughts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {topHighlighted.length > 0 && (
          <div className="bg-white rounded-xl border border-amber-100 p-4 shadow-sm">
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-2">Top Highlighted (aged)</p>
            <div className="space-y-2">
              {topHighlighted.map(item => (
                <div key={item.id} className="bg-amber-50 rounded-lg px-3 py-2">
                  <p className="text-xs text-gray-700 line-clamp-2">{item.content}</p>
                  <p className="text-xs text-amber-600 mt-1">{daysAgo(item.created_at)}d old</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {topNonHighlighted.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Oldest Open</p>
            <div className="space-y-2">
              {topNonHighlighted.map(item => (
                <div key={item.id} className="bg-gray-50 rounded-lg px-3 py-2">
                  <p className="text-xs text-gray-700 line-clamp-2">{item.content}</p>
                  <p className="text-xs text-gray-400 mt-1">{daysAgo(item.created_at)}d old</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Johari Window */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center"><Brain className="w-4 h-4 text-blue-500" /></div>
            <span className="text-sm font-semibold text-gray-800">Johari Window</span>
            <InfoButton text="Analyses your thought patterns to reveal visible strengths, limitations, hidden fears, and hidden talents — a framework for self-awareness." />
            {open.length < 10 && <span className="text-xs text-gray-400">({10 - open.length} more thoughts needed)</span>}
          </div>
          {open.length >= 10 && !johariData && (
            <button onClick={loadJohari} disabled={johariLoading} className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition disabled:opacity-60">
              {johariLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
              Analyse
            </button>
          )}
          {johariData && (
            <button onClick={loadJohari} disabled={johariLoading} className="text-xs text-blue-500 hover:text-blue-700">
              {johariLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Refresh'}
            </button>
          )}
        </div>
        <div className="p-4">
          {open.length < 10 ? (
            <p className="text-xs text-gray-400 py-2">Add at least 10 open thoughts to unlock your Johari Window analysis.</p>
          ) : johariLoading ? (
            <div className="flex items-center gap-2 py-3 text-blue-500"><Loader2 className="w-4 h-4 animate-spin" /><span className="text-xs">Analysing your thought patterns...</span></div>
          ) : johariData ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Visible Strengths', items: johariData.visible_strengths, color: 'bg-teal-50 border-teal-200 text-teal-800' },
                  { label: 'Visible Limitations', items: johariData.visible_limitations, color: 'bg-red-50 border-red-200 text-red-800' },
                  { label: 'Hidden Fears', items: johariData.hidden_fears, color: 'bg-amber-50 border-amber-200 text-amber-800' },
                  { label: 'Hidden Talents', items: johariData.hidden_talents, color: 'bg-blue-50 border-blue-200 text-blue-800' },
                ].map(({ label, items: pts, color }) => (
                  <div key={label} className={`border rounded-xl p-3 ${color}`}>
                    <p className="text-xs font-bold mb-1.5 uppercase tracking-wide">{label}</p>
                    <ul className="space-y-1">
                      {pts.map((pt, i) => <li key={i} className="text-xs leading-snug">• {pt}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
              {johariData.summary && <p className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2 italic">{johariData.summary}</p>}
            </div>
          ) : (
            <p className="text-xs text-gray-400 py-2">Click "Analyse" to generate your Johari Window from your thoughts.</p>
          )}
        </div>
      </div>

      {/* Word Cloud + Reframing */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-rose-50 rounded-lg flex items-center justify-center"><CloudLightning className="w-4 h-4 text-rose-500" /></div>
            <span className="text-sm font-semibold text-gray-800">Negative Patterns & Reframing</span>
            <InfoButton text="Detects negative words in your thoughts and offers positive reframes — turning blockers into actionable mindset shifts." />
          </div>
          {!wordData ? (
            <button onClick={loadWordCloud} disabled={wordLoading} className="flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg transition disabled:opacity-60">
              {wordLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CloudLightning className="w-3.5 h-3.5" />}
              Analyse
            </button>
          ) : (
            <button onClick={loadWordCloud} disabled={wordLoading} className="text-xs text-rose-500 hover:text-rose-700">
              {wordLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Refresh'}
            </button>
          )}
        </div>
        <div className="p-4">
          {wordLoading ? (
            <div className="flex items-center gap-2 py-3 text-rose-500"><Loader2 className="w-4 h-4 animate-spin" /><span className="text-xs">Detecting patterns...</span></div>
          ) : wordData ? (
            <div className="space-y-3">
              {wordData.negative_words.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-2">Negative words detected:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {wordData.negative_words.map(w => (
                      <span key={w} className="text-xs bg-rose-100 text-rose-700 px-2.5 py-1 rounded-full font-medium">{w}</span>
                    ))}
                  </div>
                </div>
              )}
              {wordData.reframed.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-2">Reframed thoughts:</p>
                  <div className="space-y-2">
                    {wordData.reframed.map((r, i) => (
                      <div key={i} className="bg-gray-50 rounded-lg p-2.5">
                        <p className="text-xs text-gray-400 line-through">{r.original}</p>
                        <p className="text-xs text-teal-700 font-medium mt-1">→ {r.reframed}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {wordData.summary && <p className="text-xs text-gray-600 bg-blue-50 rounded-lg px-3 py-2 italic">{wordData.summary}</p>}
              {wordData.negative_words.length === 0 && <p className="text-xs text-teal-600">No significant negative patterns found — great mindset!</p>}
            </div>
          ) : (
            <p className="text-xs text-gray-400 py-2">Click "Analyse" to detect negative word patterns and get reframing suggestions.</p>
          )}
        </div>
      </div>

      {/* YouTube Videos */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-red-50 rounded-lg flex items-center justify-center"><Youtube className="w-4 h-4 text-red-500" /></div>
            <span className="text-sm font-semibold text-gray-800">Relevant Videos</span>
            <InfoButton text="Finds YouTube videos related to your thread title and top tags — curated learning content to keep you inspired and informed." />
          </div>
          {!ytVideos ? (
            <button onClick={loadYouTube} disabled={ytLoading} className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition disabled:opacity-60">
              {ytLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Youtube className="w-3.5 h-3.5" />}
              Load Videos
            </button>
          ) : (
            <button onClick={loadYouTube} disabled={ytLoading} className="text-xs text-red-500 hover:text-red-700">
              {ytLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Refresh'}
            </button>
          )}
        </div>
        <div className="p-4">
          {ytLoading ? (
            <div className="flex items-center gap-2 py-3 text-red-500"><Loader2 className="w-4 h-4 animate-spin" /><span className="text-xs">Finding videos...</span></div>
          ) : ytVideos && ytVideos.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ytVideos.map(v => (
                <a key={v.id} href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noopener noreferrer"
                  className="flex gap-3 group hover:bg-gray-50 rounded-xl p-1.5 transition">
                  <img src={v.thumbnail} alt={v.title} className="w-24 h-16 rounded-lg object-cover flex-shrink-0 bg-gray-100" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 line-clamp-2 group-hover:text-red-600 transition">{v.title}</p>
                    <p className="text-xs text-gray-400 mt-1 truncate">{v.channel}</p>
                    <ExternalLink className="w-3 h-3 text-gray-300 group-hover:text-red-400 mt-1" />
                  </div>
                </a>
              ))}
            </div>
          ) : ytVideos && ytVideos.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">No videos found for this goal.</p>
          ) : (
            <p className="text-xs text-gray-400 py-2">Click "Load Videos" to find YouTube content related to your goal and top tags.</p>
          )}
        </div>
      </div>
    </div>
  );
}
