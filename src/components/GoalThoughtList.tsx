import React, { useState, useEffect, useRef } from 'react';
import {
  Star, Check, Pencil, ChevronDown, HelpCircle, Bell, BellOff,
  ArrowUp, ArrowDown, Clock, X, Brain, Copy, Square, CheckSquare, Sparkles
} from 'lucide-react';
import { getTagColor } from '../lib/tags';
import { supabase } from '../supabase';
import type { User } from '@supabase/supabase-js';
import { callLLM, parseJSON } from '../lib/llm';
import { useNavigate } from 'react-router-dom';
import { InfoButton } from './Tutorial';

export interface ParkedItem {
  id: string;
  content: string;
  tags: string[];
  is_highlighted: boolean;
  is_closed: boolean;
  milestone_index: number;
  created_at: string;
  image_url?: string | null;
  sort_order: number;
}

interface Schedule {
  id: string;
  parked_item_id: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  time_of_day: string;
  day_of_week?: number | null;
  date_of_month?: number | null;
  end_date?: string | null;
  is_active: boolean;
}

interface Props {
  user: User;
  items: ParkedItem[];
  goalId: string;
  goalTitle: string;
  allGoalThoughts: string[];
  customTags: string[];
  schedules: Record<string, Schedule>;
  onReload: () => void;
  onEdit: (id: string) => void;
  allowSummarise?: boolean;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function GoalThoughtList({
  user, items, goalId, goalTitle, allGoalThoughts, customTags, schedules, onReload, onEdit, allowSummarise = true
}: Props) {
  const navigate = useNavigate();
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [seekHelp, setSeekHelp] = useState<Record<string, string>>({});
  const [seekingHelp, setSeekingHelp] = useState<string | null>(null);
  const [schedulePanel, setSchedulePanel] = useState<string | null>(null);
  const [copyItem, setCopyItem] = useState<ParkedItem | null>(null);
  const [allGoals, setAllGoals] = useState<{id:string;title:string;milestone_tags?:string[]|null}[]>([]);
  const [copyTargets, setCopyTargets] = useState<string[]>([]);
  const [copyMilestone, setCopyMilestone] = useState('General');
  const [copying, setCopying] = useState(false);
  // Bulk select
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOp, setBulkOp] = useState<string | null>(null);
  const [bulkCopyGoals, setBulkCopyGoals] = useState<{id:string;title:string}[]>([]);
  const [bulkCopyTargets, setBulkCopyTargets] = useState<string[]>([]);
  const [bulkCopying, setBulkCopying] = useState(false);
  const [bulkScheduleForm, setBulkScheduleForm] = useState({ frequency: 'daily', time_of_day: '09:00' });
  // Summarise
  const [summariseOpen, setSummariseOpen] = useState(false);
  const [summarising, setSummarising] = useState(false);
  const [summaryResult, setSummaryResult] = useState<{ title: string; objective: string; summary_bullets: string[]; next_steps: string[]; nudged_suggestions: string[] } | null>(null);
  const [savingSummary, setSavingSummary] = useState(false);
  // Highlight focus
  const [lastHighlightedId, setLastHighlightedId] = useState<string | null>(null);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!copyItem) return;
    supabase.from('goals').select('id,title,milestone_tags').eq('user_id', user.id).then(({ data }) => {
      setAllGoals((data ?? []).filter((g: any) => g.id !== goalId));
      setCopyTargets([]);
      setCopyMilestone('General');
    });
  }, [copyItem, user.id, goalId]);

  const handleCopy = async () => {
    if (!copyItem || copyTargets.length === 0) return;
    setCopying(true);
    await Promise.all(copyTargets.map(gid => supabase.from('parked_items').insert({
      user_id: user.id, goal_id: gid, milestone_tag: copyMilestone, milestone_tags: [copyMilestone],
      milestone_index: 0, raw_thought: copyItem.content, item_type: 'task', content: copyItem.content, tags: copyItem.tags ?? [],
    })));
    setCopying(false);
    setCopyItem(null);
    onReload();
  };
  const [scheduleForm, setScheduleForm] = useState<Partial<Schedule>>({});

  const openItems = [...items.filter(i => !i.is_closed)].sort((a, b) => a.sort_order - b.sort_order || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const closedItems = [...items.filter(i => i.is_closed)].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  // Show max 15 open, rest via scroll (all rendered but container has max-height)

  const toggleHighlight = async (item: ParkedItem) => {
    setLastHighlightedId(item.id);
    await supabase.from('parked_items').update({ is_highlighted: !item.is_highlighted }).eq('id', item.id);
    onReload();
  };

  // Scroll to last highlighted item after items re-render
  useEffect(() => {
    if (!lastHighlightedId) return;
    const el = itemRefs.current[lastHighlightedId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      setLastHighlightedId(null);
    }
  }, [items, lastHighlightedId]);

  const toggleArchive = async (item: ParkedItem) => {
    const next = !item.is_closed;
    const updates: Record<string, unknown> = { is_closed: next };
    if (!next) updates.sort_order = 0; // restored items go to top
    await supabase.from('parked_items').update(updates).eq('id', item.id);
    onReload();
  };

  const moveItem = async (item: ParkedItem, dir: 'up' | 'down') => {
    const idx = openItems.findIndex(i => i.id === item.id);
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= openItems.length) return;
    const other = openItems[swapIdx];
    const myOrder = item.sort_order || idx;
    const otherOrder = other.sort_order || swapIdx;
    await Promise.all([
      supabase.from('parked_items').update({ sort_order: otherOrder }).eq('id', item.id),
      supabase.from('parked_items').update({ sort_order: myOrder }).eq('id', other.id),
    ]);
    onReload();
  };

  const handleSeekHelp = async (item: ParkedItem) => {
    setSeekingHelp(item.id);
    try {
      const context = allGoalThoughts.slice(0, 20).join('\n');
      const prompt = `Goal: "${goalTitle}"
Challenge: "${item.content}"
Existing thoughts: ${context || 'none'}
Give a ONE-LINE practical solution suggestion for this challenge, considering the existing thoughts.
Return JSON: {"solution":"one line answer"}`;
      const res = await callLLM('custom_prompt', { prompt });
      const parsed = parseJSON<{ solution: string }>(res);
      if (parsed?.solution) setSeekHelp(p => ({ ...p, [item.id]: parsed.solution }));
    } catch { /* silent */ } finally { setSeekingHelp(null); }
  };

  const saveSchedule = async (itemId: string) => {
    const existing = schedules[itemId];
    const payload = {
      user_id: user.id,
      parked_item_id: itemId,
      frequency: scheduleForm.frequency ?? 'daily',
      time_of_day: scheduleForm.time_of_day ?? '09:00',
      day_of_week: scheduleForm.day_of_week ?? null,
      date_of_month: scheduleForm.date_of_month ?? null,
      end_date: scheduleForm.end_date ?? null,
      is_active: true,
    };
    if (existing) {
      await supabase.from('thought_schedules').update(payload).eq('id', existing.id);
    } else {
      await supabase.from('thought_schedules').insert(payload);
    }
    setSchedulePanel(null);
    onReload();
  };

  const deleteSchedule = async (itemId: string) => {
    const existing = schedules[itemId];
    if (existing) await supabase.from('thought_schedules').delete().eq('id', existing.id);
    setSchedulePanel(null);
    onReload();
  };

  const openSchedulePanel = (item: ParkedItem) => {
    const existing = schedules[item.id];
    setScheduleForm(existing ? { ...existing } : { frequency: 'daily', time_of_day: '09:00' });
    setSchedulePanel(item.id);
  };

  const handleBulkResolve = async () => {
    await Promise.all([...selected].map(id => supabase.from('parked_items').update({ is_closed: true }).eq('id', id)));
    setSelected(new Set()); setBulkOp(null); onReload();
  };

  const handleBulkHighlight = async () => {
    await Promise.all([...selected].map(id => supabase.from('parked_items').update({ is_highlighted: true }).eq('id', id)));
    setSelected(new Set()); setBulkOp(null); onReload();
  };

  const handleBulkCopy = async () => {
    if (bulkCopyTargets.length === 0) return;
    setBulkCopying(true);
    const selItems = openItems.filter(i => selected.has(i.id));
    await Promise.all(bulkCopyTargets.flatMap(gid => selItems.map(item =>
      supabase.from('parked_items').insert({ user_id: user.id, goal_id: gid, milestone_tag: 'General', milestone_tags: ['General'], milestone_index: 0, raw_thought: item.content, item_type: 'task', content: item.content, tags: item.tags ?? [] })
    )));
    setBulkCopying(false); setSelected(new Set()); setBulkOp(null); onReload();
  };

  const handleBulkReminder = async () => {
    const sel = [...selected];
    for (const id of sel) {
      const existing = schedules[id];
      const payload = { user_id: user.id, parked_item_id: id, frequency: bulkScheduleForm.frequency, time_of_day: bulkScheduleForm.time_of_day, is_active: true };
      if (existing) await supabase.from('thought_schedules').update(payload).eq('id', existing.id);
      else await supabase.from('thought_schedules').insert(payload);
    }
    setSelected(new Set()); setBulkOp(null); onReload();
  };

  const openSummarise = async () => {
    setSummariseOpen(true);
    setSummaryResult(null);
    setSummarising(true);
    try {
      const selItems = openItems.filter(i => selected.has(i.id));
      const thoughts = selItems.map(i => `- ${i.content} [${i.tags?.join(',') || 'none'}]`).join('\n');
      const prompt = `Thread: "${goalTitle}"\nSelected thoughts:\n${thoughts}\n\nAnalyse these thoughts and return JSON:\n{"title":"concise title (max 60 chars)","objective":"1-2 sentences summarising the collective objective of these thoughts","summary_bullets":["up to 5 bullet strings summarising key themes"],"next_steps":["explicit next steps evident from the thoughts, or if not clear add a Nudged perspective — up to 4 bullet strings"],"nudged_suggestions":["max 3 actionable suggestions the user may not have thought of yet, from a Nudged growth coaching perspective"]}`;
      const result = await callLLM('custom_prompt', { prompt });
      const parsed = parseJSON<{ title: string; objective: string; summary_bullets: string[]; next_steps: string[]; nudged_suggestions: string[] }>(result);
      if (parsed) setSummaryResult(parsed);
    } catch { /* silent */ } finally { setSummarising(false); }
  };

  const saveSummary = async () => {
    if (!summaryResult) return;
    setSavingSummary(true);
    const selItems = openItems.filter(i => selected.has(i.id));
    await supabase.from('saved_summaries').insert({
      user_id: user.id, goal_id: goalId,
      title: summaryResult.title,
      summary_text: JSON.stringify(summaryResult),
      missing_focus: null,
      thoughts_count: selItems.length,
    });
    setSavingSummary(false);
    setSummariseOpen(false);
    setSelected(new Set());
  };

  useEffect(() => {
    if (bulkOp !== 'copy') return;
    supabase.from('goals').select('id,title').eq('user_id', user.id).then(({ data }) => {
      setBulkCopyGoals((data ?? []).filter((g: any) => g.id !== goalId));
      setBulkCopyTargets([]);
    });
  }, [bulkOp, user.id, goalId]);

  const renderItem = (item: ParkedItem, idx: number, total: number) => {
    const hasSchedule = !!schedules[item.id];
    const helpText = seekHelp[item.id];
    const isChallenge = (item.tags ?? []).includes('challenge');

    return (
      <div key={item.id} ref={el => { itemRefs.current[item.id] = el; }} className={`rounded-xl border transition mb-2 ${item.is_highlighted ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100'}`}>
        {/* Content area */}
        <div className="p-3 pb-2">
          <p className={`text-sm leading-relaxed text-gray-800 w-full ${item.is_closed ? 'line-through text-gray-400' : ''}`}>{item.content}</p>
          {/* Tags */}
          {(item.tags ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {item.tags.map(tag => {
                const c = getTagColor(tag, customTags);
                return <span key={tag} className={`text-xs px-2 py-0.5 rounded-full ${c.bg} ${c.text} font-medium`}>#{tag}</span>;
              })}
            </div>
          )}
          {/* Datetime */}
          <p className="text-xs text-gray-400 mt-1.5">{new Date(item.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
          {/* Seek help answer */}
          {helpText && (
            <div className="mt-2 bg-blue-50 rounded-lg px-3 py-2 text-xs text-blue-800 border border-blue-100">
              <span className="font-semibold">Suggestion: </span>{helpText}
              <div className="flex items-center gap-2 mt-1.5">
                <button
                  onClick={() => navigate(`/parked-thoughts?goalId=${goalId}&prefill=${encodeURIComponent(helpText)}`)}
                  className="flex items-center gap-1 text-xs bg-blue-600 text-white px-2 py-1 rounded-lg hover:bg-blue-700 transition"
                >
                  <Brain className="w-3 h-3" /> Park this
                </button>
                <button onClick={() => setSeekHelp(p => { const n = {...p}; delete n[item.id]; return n; })} className="text-blue-400 hover:text-blue-700"><X className="w-3 h-3" /></button>
              </div>
            </div>
          )}
          {/* Schedule panel */}
          {schedulePanel === item.id && (
            <div className="mt-2 bg-gray-50 rounded-xl p-3 border border-gray-200 space-y-2">
              <div className="flex gap-2">
                {(['daily','weekly','monthly'] as const).map(f => (
                  <button key={f} onClick={() => setScheduleForm(p => ({ ...p, frequency: f }))}
                    className={`text-xs px-3 py-1 rounded-lg border transition capitalize ${scheduleForm.frequency === f ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                    {f}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <label className="text-xs text-gray-500">Time:</label>
                <input type="time" value={scheduleForm.time_of_day ?? '09:00'} onChange={e => setScheduleForm(p => ({ ...p, time_of_day: e.target.value }))}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-teal-400" />
                {scheduleForm.frequency === 'weekly' && (
                  <>
                    <label className="text-xs text-gray-500">Day:</label>
                    <select value={scheduleForm.day_of_week ?? 1} onChange={e => setScheduleForm(p => ({ ...p, day_of_week: +e.target.value }))}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none">
                      {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                    </select>
                  </>
                )}
                {scheduleForm.frequency === 'monthly' && (
                  <>
                    <label className="text-xs text-gray-500">Date:</label>
                    <input type="number" min={1} max={31} value={scheduleForm.date_of_month ?? 1} onChange={e => setScheduleForm(p => ({ ...p, date_of_month: +e.target.value }))}
                      className="text-xs border border-gray-200 rounded-lg w-16 px-2 py-1 focus:outline-none" />
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">End date (optional):</label>
                <input type="date" value={scheduleForm.end_date ?? ''} onChange={e => setScheduleForm(p => ({ ...p, end_date: e.target.value || null }))}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => saveSchedule(item.id)} className="text-xs bg-teal-600 text-white px-3 py-1.5 rounded-lg hover:bg-teal-700 transition">Save</button>
                {hasSchedule && <button onClick={() => deleteSchedule(item.id)} className="text-xs text-red-500 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100 transition">Remove</button>}
                <button onClick={() => setSchedulePanel(null)} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
              </div>
            </div>
          )}
        </div>

        {/* Actions bar */}
        <div className="flex items-center justify-between px-2 py-1.5 border-t border-gray-100 bg-gray-50/60 rounded-b-xl">
          <div className="flex items-center gap-0.5">
            {/* Checkbox */}
            <button onClick={() => setSelected(p => { const n = new Set(p); n.has(item.id) ? n.delete(item.id) : n.add(item.id); return n; })}
              className="p-1.5 rounded-lg text-gray-400 hover:text-teal-500 transition">
              {selected.has(item.id) ? <CheckSquare className="w-4 h-4 text-teal-500" /> : <Square className="w-4 h-4" />}
            </button>
            {/* Reorder */}
            {idx > 0 && (
              <button onClick={() => moveItem(item, 'up')} className="p-1.5 rounded-lg text-gray-300 hover:text-gray-600 transition"><ArrowUp className="w-3.5 h-3.5" /></button>
            )}
            {idx < total - 1 && (
              <button onClick={() => moveItem(item, 'down')} className="p-1.5 rounded-lg text-gray-300 hover:text-gray-600 transition"><ArrowDown className="w-3.5 h-3.5" /></button>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            {isChallenge && !item.is_closed && (
              <button onClick={() => handleSeekHelp(item)} disabled={seekingHelp === item.id} title="Seek Help"
                className="p-1.5 rounded-lg text-blue-400 hover:text-blue-600 hover:bg-blue-50 transition disabled:opacity-40">
                <HelpCircle className="w-4 h-4" />
              </button>
            )}
            <button onClick={() => openSchedulePanel(item)} title={hasSchedule ? 'Edit schedule' : 'Schedule reminder'}
              className={`p-1.5 rounded-lg transition ${hasSchedule ? 'text-teal-500 hover:text-teal-700 hover:bg-teal-50' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-50'}`}>
              {hasSchedule ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            </button>
            <button onClick={() => toggleHighlight(item)} title="Highlight"
              className={`p-1.5 rounded-lg transition ${item.is_highlighted ? 'text-amber-500 hover:text-amber-700' : 'text-gray-300 hover:text-gray-500'}`}>
              <Star className="w-4 h-4" fill={item.is_highlighted ? 'currentColor' : 'none'} />
            </button>
            <button onClick={() => onEdit(item.id)} title="Edit"
              className="p-1.5 rounded-lg text-gray-300 hover:text-teal-600 hover:bg-teal-50 transition">
              <Pencil className="w-4 h-4" />
            </button>
            <button onClick={() => setCopyItem(item)} title="Copy to goals"
              className="p-1.5 rounded-lg text-gray-300 hover:text-blue-600 hover:bg-blue-50 transition">
              <Copy className="w-4 h-4" />
            </button>
            <button onClick={() => toggleArchive(item)} title={item.is_closed ? 'Restore' : 'Resolve'}
              className={`p-1.5 rounded-lg transition ${item.is_closed ? 'bg-teal-100 text-teal-600 hover:bg-gray-100 hover:text-gray-500' : 'text-gray-300 hover:text-teal-600 hover:bg-teal-50'}`}>
              <Check className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Bulk select bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 mb-3 bg-teal-50 border border-teal-200 rounded-xl px-3 py-2 flex-wrap">
          <span className="text-xs font-semibold text-teal-700">{selected.size} selected</span>
          <button onClick={() => setSelected(new Set(openItems.map(i => i.id)))} className="text-xs text-teal-600 hover:text-teal-800 underline">Select all</button>
          <button onClick={() => setSelected(new Set())} className="text-xs text-gray-500 hover:text-gray-700 underline">Clear</button>
          <div className="flex gap-1.5 ml-auto flex-wrap">
            <button onClick={handleBulkResolve} className="text-xs bg-green-600 text-white px-2.5 py-1 rounded-lg hover:bg-green-700">Resolve</button>
            <button onClick={handleBulkHighlight} className="text-xs bg-amber-500 text-white px-2.5 py-1 rounded-lg hover:bg-amber-600">Highlight</button>
            <InfoButton text="Mark selected thoughts as highlighted — they'll appear pinned at the top and in the dashboard highlights section." />
            <button onClick={() => setBulkOp(bulkOp === 'copy' ? null : 'copy')} className="text-xs bg-blue-600 text-white px-2.5 py-1 rounded-lg hover:bg-blue-700">Copy to</button>
            <button onClick={() => setBulkOp(bulkOp === 'reminder' ? null : 'reminder')} className="text-xs bg-teal-600 text-white px-2.5 py-1 rounded-lg hover:bg-teal-700">Remind</button>
            <InfoButton text="Set a recurring reminder for selected thoughts — daily, weekly, or monthly — to revisit and act on them." />
            {allowSummarise && <button onClick={openSummarise} className="text-xs bg-gray-800 text-white px-2.5 py-1 rounded-lg hover:bg-gray-900 flex items-center gap-1"><Sparkles className="w-3 h-3" /> Summarise</button>}
            {allowSummarise && <InfoButton text="Generates a structured breakdown: Objective, key themes, Next Steps, and Nudged ideas you may not have considered." />}
          </div>
        </div>
      )}

      {/* Bulk copy panel */}
      {bulkOp === 'copy' && (
        <div className="mb-3 bg-white border border-blue-200 rounded-xl p-3 space-y-2">
          <p className="text-xs font-semibold text-gray-700">Copy {selected.size} thought(s) to:</p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {bulkCopyGoals.map(g => (
              <label key={g.id} className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-gray-50">
                <input type="checkbox" checked={bulkCopyTargets.includes(g.id)} onChange={() => setBulkCopyTargets(p => p.includes(g.id) ? p.filter(x => x !== g.id) : [...p, g.id])} className="accent-teal-600" />
                <span className="text-sm text-gray-700">{g.title}</span>
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={handleBulkCopy} disabled={bulkCopyTargets.length === 0 || bulkCopying} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-60">
              {bulkCopying ? 'Copying...' : 'Copy'}
            </button>
            <button onClick={() => setBulkOp(null)} className="text-xs text-gray-500">Cancel</button>
          </div>
        </div>
      )}

      {/* Bulk reminder panel */}
      {bulkOp === 'reminder' && (
        <div className="mb-3 bg-white border border-teal-200 rounded-xl p-3 space-y-2">
          <p className="text-xs font-semibold text-gray-700">Set reminder for {selected.size} thought(s):</p>
          <div className="flex gap-2 flex-wrap">
            {(['daily','weekly','monthly'] as const).map(f => (
              <button key={f} onClick={() => setBulkScheduleForm(p => ({ ...p, frequency: f }))}
                className={`text-xs px-3 py-1 rounded-lg border capitalize ${bulkScheduleForm.frequency === f ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-200'}`}>{f}</button>
            ))}
            <input type="time" value={bulkScheduleForm.time_of_day} onChange={e => setBulkScheduleForm(p => ({ ...p, time_of_day: e.target.value }))} className="text-xs border border-gray-200 rounded-lg px-2 py-1" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleBulkReminder} className="text-xs bg-teal-600 text-white px-3 py-1.5 rounded-lg hover:bg-teal-700">Save</button>
            <button onClick={() => setBulkOp(null)} className="text-xs text-gray-500">Cancel</button>
          </div>
        </div>
      )}
      {/* Open thoughts (max-height with scroll = ~15 items) */}
      {openItems.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-6">No thoughts here yet</p>
      )}
      <div className="max-h-[600px] overflow-y-auto pr-1">
        {openItems.map((item, idx) => renderItem(item, idx, openItems.length))}
      </div>

      {/* Archived */}
      {closedItems.length > 0 && (
        <div className="mt-3 border-t border-gray-100 pt-2">
          <button onClick={() => setArchiveOpen(p => !p)} className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 transition py-1">
            <Check className="w-3 h-3" />
            Archived ({closedItems.length})
            <ChevronDown className={`w-3 h-3 transition-transform ${archiveOpen ? 'rotate-180' : ''}`} />
          </button>
          {archiveOpen && (
            <div className="mt-2 max-h-64 overflow-y-auto pr-1">
              {closedItems.map((item, idx) => renderItem(item, idx, closedItems.length))}
            </div>
          )}
        </div>
      )}

      {/* Copy modal */}
      {copyItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Copy to Goals</h3>
              <button onClick={() => setCopyItem(null)} className="p-1 text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-gray-500 mb-3 bg-gray-50 rounded-lg px-3 py-2 line-clamp-2">{copyItem.content}</p>
            <p className="text-xs font-semibold text-gray-700 mb-2">Select goals to copy to:</p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto mb-4">
              {allGoals.length === 0 ? (
                <p className="text-xs text-gray-400">No other goals available.</p>
              ) : allGoals.map(g => (
                <label key={g.id} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50">
                  <input type="checkbox" checked={copyTargets.includes(g.id)} onChange={() => setCopyTargets(p => p.includes(g.id) ? p.filter(x => x !== g.id) : [...p, g.id])} className="rounded accent-teal-600" />
                  <span className="text-sm text-gray-700">{g.title}</span>
                </label>
              ))}
            </div>
            {copyTargets.length > 0 && (() => {
              const firstGoal = allGoals.find(g => g.id === copyTargets[0]);
              const milestones = firstGoal?.milestone_tags?.length ? firstGoal.milestone_tags : ['Getting Committed','Building Roadmap','Start Journey','Final Stretch','Finish Line'];
              return (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-700 mb-1.5">Milestone tag:</p>
                  <select value={copyMilestone} onChange={e => setCopyMilestone(e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-teal-400">
                    <option value="General">General</option>
                    {milestones.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              );
            })()}
            <div className="flex gap-2">
              <button onClick={() => setCopyItem(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleCopy} disabled={copyTargets.length === 0 || copying} className="flex-1 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-60 transition">
                {copying ? 'Copying...' : `Copy to ${copyTargets.length} goal${copyTargets.length > 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summarise modal */}
      {summariseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-teal-500" /><h3 className="font-bold text-gray-900">Summarise selected thoughts</h3></div>
              <button onClick={() => setSummariseOpen(false)} className="p-1.5 text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5">
              {summarising ? (
                <div className="flex flex-col items-center py-8 gap-3">
                  <div className="w-7 h-7 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-gray-500">Analysing {selected.size} thoughts...</p>
                </div>
              ) : summaryResult ? (
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                  <p className="font-bold text-gray-900">{summaryResult.title}</p>

                  <div className="bg-teal-50 border border-teal-100 rounded-xl px-4 py-3">
                    <p className="text-xs font-semibold text-teal-700 mb-1 uppercase tracking-wide">Objective</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{summaryResult.objective}</p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Summary</p>
                    <ul className="space-y-1.5">
                      {(summaryResult.summary_bullets ?? []).map((b, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-700"><span className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-1.5 flex-shrink-0" />{b}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                    <p className="text-xs font-semibold text-blue-700 mb-2 uppercase tracking-wide">Next Steps</p>
                    <ul className="space-y-1.5">
                      {(summaryResult.next_steps ?? []).map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-700"><span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />{s}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                    <p className="text-xs font-semibold text-amber-700 mb-2 uppercase tracking-wide">Nudged Suggestion</p>
                    <ul className="space-y-1.5">
                      {(summaryResult.nudged_suggestions ?? []).map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-700"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />{s}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">Failed to generate. Try again.</p>
              )}
            </div>
            {!summarising && summaryResult && (
              <div className="flex gap-2 px-5 pb-5">
                <button onClick={() => setSummariseOpen(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Close</button>
                <button onClick={saveSummary} disabled={savingSummary} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-60">
                  {savingSummary ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Sparkles className="w-4 h-4" />} Save Summary
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
