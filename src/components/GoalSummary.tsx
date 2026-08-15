import React, { useState, useEffect, useCallback } from 'react';
import { Search, Calendar, FileText, Trash2, Clock, Plus, X, Bell, Loader2, Zap } from 'lucide-react';
import { supabase } from '../supabase';
import type { User } from '@supabase/supabase-js';
import { callLLM, parseJSON } from '../lib/llm';
import { InfoButton } from './Tutorial';

interface Goal { id: string; title: string; }

interface SavedSummary {
  id: string;
  goal_id: string;
  title: string;
  summary_text: string;
  missing_focus: string | null;
  thoughts_count: number;
  created_at: string;
}

interface SummarySchedule {
  id: string;
  goal_id: string;
  tags: string[];
  custom_prompt: string;
  frequency: string;
  time_of_day: string;
  day_of_week: number | null;
  date_of_month: number | null;
  specific_datetime: string | null;
  is_active: boolean;
  created_at: string;
}

interface Props {
  goal: Goal;
  items: { id: string; content: string; tags: string[]; is_closed: boolean; created_at: string }[];
  user: User;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const PRESETS = [
  { label: 'Last 1 day thoughts', windowDays: 1, prompt: 'Summarise thoughts from the last day. Highlight what was achieved and what needs attention.' },
  { label: 'Last 1 week thoughts', windowDays: 7, prompt: 'Summarise thoughts from the last week. Show progress, patterns, and priorities for next week.' },
];

export default function GoalSummary({ goal, user, items }: Props) {
  const [savedSummaries, setSavedSummaries] = useState<SavedSummary[]>([]);
  const [schedules, setSchedules] = useState<SummarySchedule[]>([]);
  const [loadingSummaries, setLoadingSummaries] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [schedForm, setSchedForm] = useState({
    tags: [] as string[],
    custom_prompt: '',
    frequency: 'daily' as 'once' | 'daily' | 'weekly' | 'monthly',
    time_of_day: '21:00',
    day_of_week: 1,
    date_of_month: 1,
    specific_datetime: '',
  });

  const fetchSummaries = useCallback(async () => {
    setLoadingSummaries(true);
    const { data } = await supabase.from('saved_summaries').select('*').eq('goal_id', goal.id).order('created_at', { ascending: false });
    setSavedSummaries((data as SavedSummary[]) ?? []);
    setLoadingSummaries(false);
  }, [goal.id]);

  const fetchSchedules = useCallback(async () => {
    const { data } = await supabase.from('summary_schedules').select('*').eq('goal_id', goal.id).order('created_at', { ascending: false });
    setSchedules((data as SummarySchedule[]) ?? []);
  }, [goal.id]);

  const fetchTags = useCallback(async () => {
    const { data } = await supabase.from('custom_tags').select('tag_name').eq('user_id', user.id);
    setAllTags((data ?? []).map((r: any) => r.tag_name));
  }, [user.id]);

  useEffect(() => { fetchSummaries(); fetchSchedules(); fetchTags(); }, [fetchSummaries, fetchSchedules, fetchTags]);

  const handleDelete = async (id: string) => {
    await supabase.from('saved_summaries').delete().eq('id', id);
    setSavedSummaries(p => p.filter(s => s.id !== id));
  };

  const handleDeleteSchedule = async (id: string) => {
    await supabase.from('summary_schedules').delete().eq('id', id);
    setSchedules(p => p.filter(s => s.id !== id));
  };

  // Generate and save a summary immediately from given thoughts + prompt
  const generateAndSaveSummary = async (thoughts: { content: string; created_at: string }[], customPrompt: string, title: string) => {
    if (thoughts.length === 0) return;
    const thoughtsText = thoughts.map((t, i) => `${i + 1}. ${t.content}`).join('\n');
    const prompt = `${customPrompt}\n\nThread: "${goal.title}"\nThoughts:\n${thoughtsText.slice(0, 4000)}\n\nReturn JSON: {"title":"short title","objective":"1 sentence","summary_bullets":["bullet"],"next_steps":["step"],"nudged_suggestions":["suggestion"]}`;
    const result = await callLLM('custom_prompt', { prompt });
    const parsed = parseJSON<{ title: string; objective: string; summary_bullets: string[]; next_steps: string[]; nudged_suggestions: string[] }>(result);
    if (!parsed) return;
    await supabase.from('saved_summaries').insert({
      user_id: user.id,
      goal_id: goal.id,
      title: parsed.title || title,
      summary_text: JSON.stringify(parsed),
      thoughts_count: thoughts.length,
    });
    await fetchSummaries();
  };

  const applyPreset = async (preset: typeof PRESETS[0]) => {
    setGeneratingSummary(true);
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - preset.windowDays);
      const filtered = items.filter(i => !i.is_closed && new Date(i.created_at) >= cutoff);
      await generateAndSaveSummary(filtered, preset.prompt, preset.label);
    } catch { /* silent */ } finally { setGeneratingSummary(false); }
  };

  const saveSchedule = async () => {
    setSavingSchedule(true);
    try {
      await supabase.from('summary_schedules').insert({
        user_id: user.id,
        goal_id: goal.id,
        tags: schedForm.tags,
        custom_prompt: schedForm.custom_prompt,
        frequency: schedForm.frequency,
        time_of_day: schedForm.time_of_day,
        day_of_week: schedForm.frequency === 'weekly' ? schedForm.day_of_week : null,
        date_of_month: schedForm.frequency === 'monthly' ? schedForm.date_of_month : null,
        specific_datetime: schedForm.frequency === 'once' ? schedForm.specific_datetime : null,
        is_active: true,
      });

      // For "once" schedules, generate the summary immediately
      if (schedForm.frequency === 'once') {
        const tagFilter = schedForm.tags;
        const filtered = items.filter(i => {
          if (i.is_closed) return false;
          if (tagFilter.length > 0) return tagFilter.some(t => (i.tags ?? []).includes(t));
          return true;
        });
        const prompt = schedForm.custom_prompt || `Summarise the latest thoughts for the thread "${goal.title}".`;
        await generateAndSaveSummary(filtered, prompt, `Summary – ${new Date().toLocaleDateString()}`);
      }

      setShowScheduleForm(false);
      setSchedForm({ tags: [], custom_prompt: '', frequency: 'daily', time_of_day: '21:00', day_of_week: 1, date_of_month: 1, specific_datetime: '' });
      fetchSchedules();
    } catch { /* silent */ } finally { setSavingSchedule(false); }
  };

  const filteredSummaries = savedSummaries.filter(s => {
    const matchesText = !searchQuery || s.title.toLowerCase().includes(searchQuery.toLowerCase()) || s.summary_text.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDate = !dateFilter || s.created_at.startsWith(dateFilter);
    return matchesText && matchesDate;
  });

  const groupedByDate = filteredSummaries.reduce((acc, s) => {
    const dateStr = new Date(s.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(s);
    return acc;
  }, {} as Record<string, SavedSummary[]>);

  const toggleSchedTag = (tag: string) =>
    setSchedForm(p => ({ ...p, tags: p.tags.includes(tag) ? p.tags.filter(t => t !== tag) : [...p.tags, tag] }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-900">Saved Summaries</h3>
          <p className="text-xs text-gray-400 mt-0.5">Select thoughts in the All tab and click Summarise, use a preset below, or schedule recurring summaries.</p>
        </div>
        <button onClick={() => setShowScheduleForm(p => !p)} className="flex items-center gap-1.5 text-xs bg-teal-600 text-white px-3 py-1.5 rounded-lg hover:bg-teal-700 transition font-medium">
          <Plus className="w-3.5 h-3.5" /> Schedule <InfoButton text="Schedule a recurring AI summary for this thread — choose tags to filter by, write a custom AI prompt, and pick a time. Summaries appear here automatically." />
        </button>
      </div>

      {/* Out-of-box preset buttons */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Quick Summaries</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(p => (
            <button key={p.label} onClick={() => applyPreset(p)} disabled={generatingSummary}
              className="flex items-center gap-1.5 text-xs bg-teal-50 border border-teal-200 text-teal-700 px-3 py-2 rounded-xl hover:bg-teal-100 disabled:opacity-60 transition font-medium">
              {generatingSummary ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              {p.label}
            </button>
          ))}
        </div>
        {generatingSummary && <p className="text-xs text-teal-600 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Generating summary...</p>}
      </div>

      {/* Active schedules */}
      {schedules.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Active Schedules</p>
          {schedules.map(s => (
            <div key={s.id} className="bg-teal-50 border border-teal-100 rounded-xl px-3 py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Bell className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-teal-800 truncate">
                    {s.frequency === 'once' ? `Once at ${s.specific_datetime ? new Date(s.specific_datetime).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : s.time_of_day}` :
                     s.frequency === 'daily' ? `Daily at ${s.time_of_day}` :
                     s.frequency === 'weekly' ? `Weekly on ${DAYS[s.day_of_week ?? 1]} at ${s.time_of_day}` :
                     `Monthly on ${s.date_of_month} at ${s.time_of_day}`}
                  </p>
                  {s.tags.length > 0 && <p className="text-xs text-teal-600 mt-0.5">Tags: {s.tags.join(', ')}</p>}
                  {s.custom_prompt && <p className="text-xs text-gray-500 mt-0.5 truncate">Prompt: {s.custom_prompt}</p>}
                </div>
              </div>
              <button onClick={() => handleDeleteSchedule(s.id)} className="p-1.5 text-teal-400 hover:text-red-500 flex-shrink-0 transition"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
      )}

      {/* Schedule form */}
      {showScheduleForm && (
        <div className="bg-white border border-teal-200 rounded-2xl p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-800">Schedule a Summary</p>
            <button onClick={() => setShowScheduleForm(false)} className="p-1 text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">Filter by tags (optional)</label>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {allTags.map(tag => (
                <button key={tag} onClick={() => toggleSchedTag(tag)}
                  className={`text-xs px-2 py-0.5 rounded-full border transition ${schedForm.tags.includes(tag) ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-500 border-gray-200 hover:border-teal-300'}`}>
                  #{tag}
                </button>
              ))}
              {allTags.length === 0 && <span className="text-xs text-gray-400">No custom tags yet</span>}
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">Custom AI prompt</label>
            <textarea value={schedForm.custom_prompt} onChange={e => setSchedForm(p => ({ ...p, custom_prompt: e.target.value.slice(0, 500) }))}
              placeholder="e.g. Summarise my day's progress, highlight what I achieved and what needs attention tomorrow..."
              rows={2} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-teal-400 resize-none" />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-xs text-gray-500">Frequency:</label>
            {(['once', 'daily', 'weekly', 'monthly'] as const).map(f => (
              <button key={f} onClick={() => setSchedForm(p => ({ ...p, frequency: f }))}
                className={`text-xs px-3 py-1 rounded-lg border transition capitalize ${schedForm.frequency === f ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                {f}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {schedForm.frequency === 'once' ? (
              <>
                <label className="text-xs text-gray-500">Date &amp; Time:</label>
                <input type="datetime-local" value={schedForm.specific_datetime} onChange={e => setSchedForm(p => ({ ...p, specific_datetime: e.target.value }))}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-teal-400" />
              </>
            ) : (
              <>
                <label className="text-xs text-gray-500">Time:</label>
                <input type="time" value={schedForm.time_of_day} onChange={e => setSchedForm(p => ({ ...p, time_of_day: e.target.value }))}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-teal-400" />
                {schedForm.frequency === 'weekly' && (
                  <select value={schedForm.day_of_week ?? 1} onChange={e => setSchedForm(p => ({ ...p, day_of_week: +e.target.value }))}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none">
                    {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                )}
                {schedForm.frequency === 'monthly' && (
                  <input type="number" min={1} max={31} value={schedForm.date_of_month ?? 1} onChange={e => setSchedForm(p => ({ ...p, date_of_month: +e.target.value }))}
                    className="text-xs border border-gray-200 rounded-lg w-16 px-2 py-1 focus:outline-none" />
                )}
              </>
            )}
          </div>

          {schedForm.frequency === 'once' && (
            <p className="text-xs text-teal-600 bg-teal-50 rounded-lg px-3 py-2">Summary will be generated immediately when you save.</p>
          )}

          <button onClick={saveSchedule} disabled={savingSchedule || (schedForm.frequency === 'once' && !schedForm.specific_datetime)}
            className="text-xs bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition disabled:opacity-60 font-medium flex items-center gap-1.5">
            {savingSchedule ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            {savingSchedule ? 'Saving...' : 'Save Schedule'}
          </button>
        </div>
      )}

      {/* Search + date filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search summaries..." className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-400 bg-white" />
        </div>
        <div className="relative">
          <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input type="month" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="pl-8 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-400 bg-white" />
        </div>
        {(searchQuery || dateFilter) && (
          <button onClick={() => { setSearchQuery(''); setDateFilter(''); }} className="text-xs text-gray-400 hover:text-gray-600 px-2">Clear</button>
        )}
      </div>

      {loadingSummaries ? (
        <div className="flex justify-center py-6"><div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : filteredSummaries.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
          <FileText className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500">{savedSummaries.length === 0 ? 'No summaries yet' : 'No summaries match your search'}</p>
          <p className="text-xs text-gray-400 mt-1">Use a Quick Summary preset above, or go to "All thoughts", select thoughts, and click Summarise.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(groupedByDate).map(([dateStr, summaries]) => (
            <div key={dateStr}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">{dateStr}</p>
                <span className="text-xs text-gray-400">({summaries.length})</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>
              <div className="space-y-3">
                {summaries.map(s => (
                  <div key={s.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900 leading-tight">{s.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{new Date(s.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · {s.thoughts_count} thoughts</p>
                      </div>
                      <button onClick={() => handleDelete(s.id)} className="p-1.5 text-gray-300 hover:text-red-500 flex-shrink-0 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                    {(() => {
                      let parsed: { objective?: string; summary_bullets?: string[]; next_steps?: string[]; nudged_suggestions?: string[] } | null = null;
                      try { parsed = JSON.parse(s.summary_text); } catch { /* legacy plain text */ }
                      if (parsed && parsed.objective) return (
                        <div className="space-y-3">
                          <div className="bg-teal-50 border border-teal-100 rounded-lg px-3 py-2">
                            <p className="text-xs font-semibold text-teal-700 mb-0.5 uppercase tracking-wide">Objective</p>
                            <p className="text-xs text-gray-700 leading-relaxed">{parsed.objective}</p>
                          </div>
                          {(parsed.summary_bullets ?? []).length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Summary</p>
                              <ul className="space-y-1">
                                {(parsed.summary_bullets ?? []).map((b, i) => <li key={i} className="flex items-start gap-2 text-xs text-gray-700"><span className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-1 flex-shrink-0" />{b}</li>)}
                              </ul>
                            </div>
                          )}
                          {(parsed.next_steps ?? []).length > 0 && (
                            <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                              <p className="text-xs font-semibold text-blue-700 mb-1.5 uppercase tracking-wide">Next Steps</p>
                              <ul className="space-y-1">
                                {(parsed.next_steps ?? []).map((st, i) => <li key={i} className="flex items-start gap-2 text-xs text-gray-700"><span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1 flex-shrink-0" />{st}</li>)}
                              </ul>
                            </div>
                          )}
                          {(parsed.nudged_suggestions ?? []).length > 0 && (
                            <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                              <p className="text-xs font-semibold text-amber-700 mb-1.5 uppercase tracking-wide">Nudged Suggestion</p>
                              <ul className="space-y-1">
                                {(parsed.nudged_suggestions ?? []).map((sg, i) => <li key={i} className="flex items-start gap-2 text-xs text-gray-700"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1 flex-shrink-0" />{sg}</li>)}
                              </ul>
                            </div>
                          )}
                        </div>
                      );
                      return (
                        <>
                          <p className="text-sm text-gray-700 leading-relaxed mb-3">{s.summary_text}</p>
                          {s.missing_focus && (
                            <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                              <p className="text-xs font-semibold text-amber-700 mb-0.5">What's missing</p>
                              <p className="text-xs text-gray-600 leading-relaxed">{s.missing_focus}</p>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
