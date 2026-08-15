import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Calendar, Check, X, Loader2,
  Briefcase, Heart, DollarSign, BookOpen, Dumbbell, Star, Globe, Music,
  Home, Lightbulb, Leaf, Flame, Brain, Newspaper, Zap, Quote, Wand2, Trash2,
  Search, LayoutDashboard, Pencil, FileText, Layers, Bell, AlignLeft
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabase';
import type { User } from '@supabase/supabase-js';
import type { UserProfile } from '../supabase';
import { callLLM, parseJSON } from '../lib/llm';
import { getTagColor, DEFAULT_TAGS } from '../lib/tags';
import GoalThoughtList, { type ParkedItem } from '../components/GoalThoughtList';
import GoalDashboard from '../components/GoalDashboard';
import GoalSummary from '../components/GoalSummary';
import { InfoButton } from '../components/Tutorial';

interface Goal {
  id: string; user_id: string; title: string; icon: string;
  target_date: string | null; created_at: string;
  is_general: boolean; is_all_thread?: boolean;
  default_tags?: string[] | null; active_tag_names?: string[] | null;
  milestone_labels?: string[] | null; milestone_tags?: string[] | null;
}
interface NudgeData {
  goal_id: string; nudge_text: string | null; nudge_quote: string | null;
  nudge_quote_author: string | null; good_news_text: string | null;
}
interface Schedule {
  id: string; parked_item_id: string; frequency: 'once'|'daily'|'weekly'|'monthly';
  time_of_day: string; day_of_week?: number|null; date_of_month?: number|null;
  end_date?: string|null; is_active: boolean; specific_datetime?: string|null;
}
interface FilterState {
  activeTags: string[]; showHighlightedOnly: boolean; showWithReminder: boolean;
  textSearch: string; aiSearchActive: boolean; aiFilteredIds: string[]|null;
}
const DEFAULT_FILTER: FilterState = { activeTags: [], showHighlightedOnly: false, showWithReminder: false, textSearch: '', aiSearchActive: false, aiFilteredIds: null };
interface Props { user: User; profile: UserProfile; }
const DEFAULT_MILESTONES = ['Getting Committed','Building Roadmap','Start Journey','Final Stretch','Finish Line'];
const MAX_GOALS = 10;
const ICONS = [
  { key:'briefcase', Icon:Briefcase, label:'Career',   color:'text-blue-500',   bg:'bg-blue-50' },
  { key:'heart',     Icon:Heart,     label:'Health',   color:'text-red-500',    bg:'bg-red-50' },
  { key:'dollar',    Icon:DollarSign,label:'Finance',  color:'text-yellow-500', bg:'bg-yellow-50' },
  { key:'book',      Icon:BookOpen,  label:'Learning', color:'text-indigo-500', bg:'bg-indigo-50' },
  { key:'dumbbell',  Icon:Dumbbell,  label:'Fitness',  color:'text-orange-500', bg:'bg-orange-50' },
  { key:'star',      Icon:Star,      label:'Personal', color:'text-amber-500',  bg:'bg-amber-50' },
  { key:'globe',     Icon:Globe,     label:'Travel',   color:'text-cyan-500',   bg:'bg-cyan-50' },
  { key:'music',     Icon:Music,     label:'Hobby',    color:'text-purple-500', bg:'bg-purple-50' },
  { key:'home',      Icon:Home,      label:'Family',   color:'text-teal-500',   bg:'bg-teal-50' },
  { key:'lightbulb', Icon:Lightbulb, label:'Idea',     color:'text-yellow-400', bg:'bg-yellow-50' },
  { key:'leaf',      Icon:Leaf,      label:'Wellbeing',color:'text-green-500',  bg:'bg-green-50' },
  { key:'flame',     Icon:Flame,     label:'Passion',  color:'text-red-400',    bg:'bg-red-50' },
];
function getIconMeta(key: string) { return ICONS.find(i => i.key === key) ?? ICONS[0]; }
function GoalIcon({ iconKey, size='md' }: { iconKey: string; size?:'sm'|'md' }) {
  const m = getIconMeta(iconKey ?? 'briefcase');
  const sz = size==='sm' ? 'w-7 h-7' : 'w-9 h-9';
  const ic = size==='sm' ? 'w-3.5 h-3.5' : 'w-4.5 h-4.5';
  return <div className={`${sz} ${m.bg} rounded-lg flex items-center justify-center flex-shrink-0`}><m.Icon className={`${ic} ${m.color}`} /></div>;
}
function daysUntil(date: string) { return Math.floor((new Date(date).getTime()-Date.now())/86400000); }
function daysAgo(date: string) { return Math.floor((Date.now()-new Date(date).getTime())/86400000); }

// Thread chip edit popover
function ChipEditor({ goal, onClose, onUpdate, onDelete, threadCustomTags, onAddCustomTag }: {
  goal: Goal; onClose:()=>void;
  onUpdate:(patch:{target_date:string|null;active_tag_names:string[];default_tags:string[]})=>void;
  onDelete:()=>void; threadCustomTags:string[]; onAddCustomTag:(name:string)=>void;
}) {
  const [date, setDate] = useState(goal.target_date ?? '');
  const allAvail = [...new Set([...DEFAULT_TAGS, ...threadCustomTags])].sort((a,b)=>a.localeCompare(b));
  const initDefault = (goal.default_tags?.length ? goal.default_tags : [DEFAULT_TAGS[0]]);
  const [defaultTags, setDefaultTags] = useState<string[]>(initDefault);
  const [newTag, setNewTag] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);
  const toggleTag = (t: string) => setDefaultTags(p => p.includes(t) ? (p.length > 1 ? p.filter(x=>x!==t) : p) : p.length>=3 ? p : [...p,t]);
  const addTag = () => {
    const t = newTag.trim().toLowerCase().replace(/\s+/g,'-');
    if (!t || allAvail.includes(t)) { setNewTag(''); return; }
    onAddCustomTag(t);
    setDefaultTags(p => p.length<3 ? [...p,t] : p);
    setNewTag('');
  };
  return (
    <>
    <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />
    <div ref={ref} className="fixed z-50 bg-white border border-gray-200 rounded-2xl shadow-2xl p-4 w-72" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
      <div className="flex items-center justify-between mb-3">
        <p className="font-semibold text-sm text-gray-900 truncate">{goal.title}</p>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
      </div>
      <div className="mb-3">
        <label className="text-xs text-gray-500 mb-1 block">Due date</label>
        <div className="relative"><Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="pl-8 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg w-full focus:outline-none focus:ring-1 focus:ring-teal-400" /></div>
      </div>
      <div className="mb-3">
        <label className="text-xs text-gray-500 mb-1.5 block">Default tags ({defaultTags.length}/3) <span className="text-gray-400">— min 1, max 3</span></label>
        <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
          {allAvail.map(t => { const a=defaultTags.includes(t); const c=getTagColor(t,threadCustomTags); return (
            <button key={t} onClick={()=>toggleTag(t)} className={`text-xs px-2 py-0.5 rounded-full border transition ${a?`${c.bg} ${c.text} border-current opacity-100`:'bg-white text-gray-400 border-gray-200 hover:border-gray-400'} ${!a&&defaultTags.length>=3?'opacity-40 cursor-not-allowed':''}`}>#{t}</button>
          ); })}
        </div>
      </div>
      <div className="mb-3 flex gap-1.5">
        <input value={newTag} onChange={e=>setNewTag(e.target.value.slice(0,20))} onKeyDown={e=>e.key==='Enter'&&addTag()} placeholder="New tag for this thread..." className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 flex-1 focus:outline-none focus:ring-1 focus:ring-teal-400" />
        <button onClick={addTag} className="text-xs bg-teal-600 text-white px-2.5 rounded-lg hover:bg-teal-700">Add</button>
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <button onClick={onDelete} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700"><Trash2 className="w-3 h-3" />Delete</button>
        <button onClick={()=>onUpdate({target_date:date||null,active_tag_names:defaultTags,default_tags:defaultTags})} className="text-xs bg-teal-600 text-white px-3 py-1.5 rounded-lg hover:bg-teal-700">Save</button>
      </div>
    </div>
    </>
  );
}

// Add thread modal
function AddThreadModal({ onClose, onSaved, user, customTags }: { onClose:()=>void; onSaved:(g:Goal)=>void; user:User; customTags:string[] }) {
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState('briefcase');
  const [targetDate, setTargetDate] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([DEFAULT_TAGS[0]]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const allAvail = [...new Set([...DEFAULT_TAGS,...customTags])].sort((a,b)=>a.localeCompare(b));
  const toggleTag = (t:string) => setActiveTags(p=>p.includes(t)?(p.length>1?p.filter(x=>x!==t):p):p.length>=3?p:[...p,t]);
  const save = async () => {
    if (!title.trim()) { setError('Title required'); return; }
    setSaving(true);
    const { data } = await supabase.from('goals').insert({
      user_id:user.id, title:title.trim(), icon, target_date:targetDate||null,
      milestone_tags:DEFAULT_MILESTONES, milestone_labels:DEFAULT_MILESTONES,
      default_tags:activeTags, active_tag_names:activeTags,
      is_all_thread:false, updated_at:new Date().toISOString()
    }).select().maybeSingle();
    setSaving(false);
    if (data) onSaved(data as Goal); else setError('Failed to save');
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5 space-y-4">
        <div className="flex items-center justify-between"><h3 className="font-bold text-gray-900">New Thread</h3><button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button></div>
        {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Thread title" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
        <div>
          <label className="text-xs text-gray-500 mb-1.5 block">Target date (optional)</label>
          <input type="date" value={targetDate} onChange={e=>setTargetDate(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-2 block">Icon</label>
          <div className="flex flex-wrap gap-2">
            {ICONS.map(({key,Icon:I,label,color,bg})=>(
              <button key={key} type="button" onClick={()=>setIcon(key)} title={label} className={`w-9 h-9 rounded-xl flex items-center justify-center border-2 ${icon===key?'border-teal-500 ring-2 ring-teal-200':'border-transparent'} ${bg}`}>
                <I className={`w-4.5 h-4.5 ${color}`} />
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1.5 block">Default tags ({activeTags.length}/3) <span className="text-gray-400">— min 1, max 3</span></label>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
            {allAvail.map(t=>{const a=activeTags.includes(t);const c=getTagColor(t,customTags);return(
              <button key={t} onClick={()=>toggleTag(t)} className={`text-xs px-2 py-0.5 rounded-full border transition ${a?`${c.bg} ${c.text} border-current`:'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>#{t}</button>
            );})}
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-1">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl">Cancel</button>
          <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-5 py-2 text-sm bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 disabled:opacity-60">
            {saving?<Loader2 className="w-4 h-4 animate-spin"/>:<Check className="w-4 h-4"/>}Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GoalPage({ user, profile }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGoalId, setSelectedGoalId] = useState<string|null>(null); // null = all
  const [selectedTab, setSelectedTab] = useState<'thoughts'|'dashboard'|'summary'>('thoughts');
  const [parkedItems, setParkedItems] = useState<ParkedItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [nudge, setNudge] = useState<NudgeData|null>(null);
  const [loadingNudge, setLoadingNudge] = useState(false);
  const [generatingNudge, setGeneratingNudge] = useState(false);
  const [suggestedThoughts, setSuggestedThoughts] = useState<string[]>([]);
  const [schedules, setSchedules] = useState<Record<string,Schedule>>({});
  const [dashRefresh, setDashRefresh] = useState(new Date());
  const [editingChipId, setEditingChipId] = useState<string|null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [threadCustomTags, setThreadCustomTags] = useState<Record<string,string[]>>({});
  const [globalCustomTags, setGlobalCustomTags] = useState<string[]>([]);
  const [aiSearchQuery, setAiSearchQuery] = useState('');
  const [aiSearchLoading, setAiSearchLoading] = useState(false);
  const [filterMap, setFilterMap] = useState<Map<string,FilterState>>(new Map());
  const nudgeAutoRef = useRef<Set<string>>(new Set());

  const getFilter = (id: string) => filterMap.get(id) ?? {...DEFAULT_FILTER};
  const setFilter = (id: string, patch: Partial<FilterState>) => {
    setFilterMap(m => { const n=new Map(m); n.set(id,{...getFilter(id),...patch}); return n; });
  };

  const selectedGoal = goals.find(g=>g.id===selectedGoalId) ?? null;
  const isSpecificThread = !!(selectedGoal && !selectedGoal.is_all_thread);
  const nonSpecialGoals = goals.filter(g=>!g.is_general&&!g.is_all_thread);
  const generalGoal = goals.find(g=>g.is_general);
  const viewableGoals = [...(generalGoal?[generalGoal]:[]), ...nonSpecialGoals];

  const fetchGoals = useCallback(async () => {
    const { data } = await supabase.from('goals').select('*').eq('user_id',user.id).order('created_at',{ascending:true});
    setGoals((data as Goal[])?? []);
    setLoading(false);
  }, [user.id]);

  const fetchCustomTags = useCallback(async () => {
    const { data } = await supabase.from('custom_tags').select('tag_name,goal_id').eq('user_id',user.id);
    const perThread: Record<string,string[]> = {};
    const global: string[] = [];
    for (const r of (data??[]) as any[]) {
      if (r.goal_id) { perThread[r.goal_id] = [...(perThread[r.goal_id]??[]), r.tag_name]; }
      else global.push(r.tag_name);
    }
    setThreadCustomTags(perThread);
    setGlobalCustomTags(global);
  }, [user.id]);

  useEffect(() => { fetchGoals(); fetchCustomTags(); }, [fetchGoals, fetchCustomTags]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const goalId = params.get('goalId');
    if (goalId && goals.length > 0) {
      const g = goals.find(x=>x.id===goalId);
      if (g) { setSelectedGoalId(g.id); setSelectedTab('thoughts'); }
    }
  }, [location.search, goals]);

  const fetchParkedItems = useCallback(async (goalId: string|null) => {
    setLoadingItems(true);
    let query = supabase.from('parked_items').select('*');
    if (goalId) {
      const g = goals.find(x=>x.id===goalId);
      if (g?.is_all_thread) query = query.eq('user_id',user.id);
      else query = query.eq('goal_id',goalId);
    } else {
      query = query.eq('user_id',user.id);
    }
    const { data } = await query.order('sort_order',{ascending:true}).order('created_at',{ascending:false});
    setParkedItems((data as ParkedItem[])?? []);
    setLoadingItems(false);
  }, [user.id, goals]);

  const fetchSchedules = useCallback(async () => {
    const { data } = await supabase.from('thought_schedules').select('*').eq('user_id',user.id);
    const map: Record<string,Schedule> = {};
    for (const s of (data as Schedule[])?? []) map[s.parked_item_id]=s;
    setSchedules(map);
  }, [user.id]);

  const fetchNudge = useCallback(async (goalId: string) => {
    const { data } = await supabase.from('goal_nudges').select('*').eq('goal_id',goalId).eq('is_goal_level',true).maybeSingle();
    return data as NudgeData|null;
  }, []);

  const handleGenerateNudge = useCallback(async (goal: Goal, silent=false) => {
    if (!silent) setGeneratingNudge(true);
    const profDesc = [profile.profession,profile.job_business_details].filter(Boolean).join(', ');
    try {
      const prompt = `Life coach. Goal: "${goal.title}", User: ${profDesc||'not provided'}.\nGenerate JSON: {"nudge_text":"2-3 sentence motivational advice","nudge_quote":"famous quote","nudge_quote_author":"Author","good_news_text":"positive news trend","suggested_thoughts":["actionable thought 1","actionable thought 2","actionable thought 3"]}`;
      const result = await callLLM('custom_prompt',{prompt});
      const parsed = parseJSON<{nudge_text:string;nudge_quote:string;nudge_quote_author:string;good_news_text:string;suggested_thoughts:string[]}>(result);
      if (parsed) {
        await supabase.from('goal_nudges').upsert(
          {user_id:user.id,goal_id:goal.id,milestone_index:-1,is_goal_level:true,nudge_text:parsed.nudge_text,nudge_quote:parsed.nudge_quote,nudge_quote_author:parsed.nudge_quote_author,good_news_text:parsed.good_news_text,generated_at:new Date().toISOString()},
          {onConflict:'goal_id,milestone_index'}
        );
        setNudge({goal_id:goal.id,nudge_text:parsed.nudge_text,nudge_quote:parsed.nudge_quote,nudge_quote_author:parsed.nudge_quote_author,good_news_text:parsed.good_news_text});
        if (parsed.suggested_thoughts) setSuggestedThoughts(parsed.suggested_thoughts.slice(0,3));
      }
    } catch { /* silent */ } finally { if (!silent) setGeneratingNudge(false); }
  }, [user.id,profile.profession,profile.job_business_details]);

  useEffect(() => {
    fetchParkedItems(selectedGoalId);
    fetchSchedules();
    if (isSpecificThread && selectedGoal) {
      setSelectedTab(t => t === 'dashboard' || t === 'summary' ? t : 'thoughts');
      (async () => {
        const existing = await fetchNudge(selectedGoal.id);
        if (existing) setNudge(existing);
        else if (!nudgeAutoRef.current.has(selectedGoal.id)) {
          nudgeAutoRef.current.add(selectedGoal.id);
          handleGenerateNudge(selectedGoal, true);
        }
      })();
    } else {
      setSelectedTab('thoughts');
    }
  }, [selectedGoalId, goals, fetchParkedItems, fetchSchedules, fetchNudge, handleGenerateNudge]);

  useEffect(() => {
    const t = setInterval(()=>setDashRefresh(new Date()), 10*60*1000);
    return ()=>clearInterval(t);
  }, []);

  const handleGoalUpdate = async (goalId: string, patch: {target_date?:string|null; active_tag_names?:string[]; default_tags?:string[]}) => {
    await supabase.from('goals').update({...patch, updated_at:new Date().toISOString()}).eq('id',goalId);
    setGoals(gs=>gs.map(g=>g.id===goalId?{...g,...patch}:g));
    setEditingChipId(null);
  };

  const handleDelete = async (goalId: string) => {
    if (!confirm('Delete this thread and all its thoughts?')) return;
    await supabase.from('goals').delete().eq('id',goalId);
    await fetchGoals();
    if (selectedGoalId===goalId) setSelectedGoalId(null);
    setEditingChipId(null);
  };

  const handleAddCustomTag = async (goalId: string, name: string) => {
    await supabase.from('custom_tags').insert({user_id:user.id,tag_name:name,goal_id:goalId});
    setThreadCustomTags(p=>({...p,[goalId]:[...(p[goalId]??[]),name]}));
  };

  const acceptSuggestedThought = async (thought: string) => {
    if (!selectedGoal) return;
    await supabase.from('parked_items').insert({user_id:user.id,goal_id:selectedGoal.id,milestone_index:0,milestone_tag:'General',raw_thought:thought,item_type:'task',content:thought,tags:['tasks']});
    setSuggestedThoughts(p=>p.filter(t=>t!==thought));
    fetchParkedItems(selectedGoalId);
  };

  const handleAiSearch = async () => {
    if (!aiSearchQuery.trim()) return;
    setAiSearchLoading(true);
    try {
      const visible = parkedItems.filter(i=>!i.is_closed).slice(0,100).map((i,idx)=>`${idx}|${i.content}`).join('\n');
      const prompt = `Given these thoughts:\n${visible}\n\nUser query: "${aiSearchQuery}"\n\nReturn relevant indices. JSON: {"indices":[0,3,7]}`;
      const result = await callLLM('custom_prompt',{prompt});
      const parsed = parseJSON<{indices:number[]}>(result);
      if (parsed?.indices) {
        const items = parkedItems.filter(i=>!i.is_closed);
        const ids = parsed.indices.map(i=>items[i]?.id).filter(Boolean) as string[];
        const key = selectedGoalId ?? '_all';
        setFilter(key,{aiSearchActive:true,aiFilteredIds:ids});
      }
    } catch { /* silent */ } finally { setAiSearchLoading(false); }
  };

  // Tags for current view
  const getActiveTags = (): string[] => {
    if (!selectedGoalId) {
      // All: union of all goals' active_tag_names
      return [...new Set(goals.flatMap(g=>g.active_tag_names?.length?g.active_tag_names:DEFAULT_TAGS.slice(0,10)))];
    }
    const g = goals.find(x=>x.id===selectedGoalId);
    const custom = threadCustomTags[selectedGoalId]??[];
    return g?.active_tag_names?.length ? g.active_tag_names : [...DEFAULT_TAGS.slice(0,10),...custom];
  };

  const getFilteredItems = (): ParkedItem[] => {
    const key = selectedGoalId ?? '_all';
    const f = getFilter(key);
    let items = parkedItems;
    if (f.aiSearchActive && f.aiFilteredIds) items = items.filter(i=>f.aiFilteredIds!.includes(i.id));
    if (f.activeTags.length>0) items = items.filter(i=>f.activeTags.some(t=>(i.tags??[]).includes(t)));
    if (f.showHighlightedOnly) items = items.filter(i=>i.is_highlighted);
    if (f.showWithReminder) items = items.filter(i=>!!schedules[i.id]);
    return items;
  };

  const activeTags = getActiveTags();
  const filteredItems = getFilteredItems();
  const key = selectedGoalId ?? '_all';
  const f = getFilter(key);
  // Show all tags that appear on at least one thought in current view
  const usedTags = [...new Set(parkedItems.filter(i=>!i.is_closed).flatMap(i=>i.tags??[]))];
  const searchableTags = usedTags.length > 0 ? usedTags : activeTags;

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const navigateToPark = () => {
    if (selectedGoalId && !selectedGoal?.is_all_thread) navigate(`/parked-thoughts?goalId=${selectedGoalId}`);
    else navigate('/parked-thoughts');
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      {/* Thread chips header */}
      <div className="bg-white border-b border-gray-100 shadow-sm flex-shrink-0">
        <div className="flex items-center">
          <div className="flex-1 overflow-x-auto flex items-center gap-2 px-4 py-3" style={{scrollbarWidth:'none'}}>
            {/* All chip */}
            <button
              onClick={()=>{setSelectedGoalId(null);setSelectedTab('thoughts');}}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition ${!selectedGoalId?'bg-teal-600 text-white border-teal-600 shadow-sm':'bg-white text-gray-600 border-gray-200 hover:border-teal-300'}`}>
              <Layers className="w-4 h-4" />All
            </button>
            {/* Thread chips */}
            {viewableGoals.map(g => {
              const dr = g.target_date ? daysUntil(g.target_date) : null;
              const dColor = dr===null?'':(dr<0?'text-red-600':dr<=10?'text-orange-500':dr<=25?'text-amber-500':'text-green-600');
              const isActive = selectedGoalId===g.id;
              return (
                <div key={g.id} className="relative flex-shrink-0">
                  <button
                    onClick={()=>{setSelectedGoalId(g.id);setSelectedTab('thoughts');setEditingChipId(null);}}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition text-sm ${isActive?'bg-teal-50 border-teal-400 text-teal-800 shadow-sm':'bg-white border-gray-200 text-gray-700 hover:border-teal-300'}`}>
                    <GoalIcon iconKey={g.icon} size="sm" />
                    <div className="text-left">
                      <p className="font-medium leading-tight max-w-[90px] truncate">{g.title}</p>
                      {dr!==null&&<p className={`text-xs ${dColor} leading-tight`}>{dr<0?`${Math.abs(dr)}d over`:`${dr}d`}</p>}
                    </div>
                    {!g.is_general && (
                      <button onClick={e=>{e.stopPropagation();setEditingChipId(prev=>prev===g.id?null:g.id);}}
                        className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-teal-600 rounded ml-0.5">
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}
                  </button>
                  {editingChipId===g.id&&!g.is_general&&(
                    <ChipEditor
                      goal={g}
                      onClose={()=>setEditingChipId(null)}
                      onUpdate={patch=>handleGoalUpdate(g.id,patch)}
                      onDelete={()=>handleDelete(g.id)}
                      threadCustomTags={[...globalCustomTags,...(threadCustomTags[g.id]??[])]}
                      onAddCustomTag={name=>handleAddCustomTag(g.id,name)}
                    />
                  )}
                </div>
              );
            })}
          </div>
          {/* Park + Add buttons */}
          <div className="flex items-center gap-2 px-3 flex-shrink-0 border-l border-gray-100">
            <button onClick={navigateToPark}
              className="flex items-center gap-1.5 text-xs bg-teal-600 text-white px-3 py-2 rounded-xl hover:bg-teal-700 font-medium">
              <Brain className="w-3.5 h-3.5" />Park
            </button>
            <InfoButton text="Park a thought — save any idea, challenge, or action to a thread before it slips away." />
            {nonSpecialGoals.length < MAX_GOALS && (
              <button onClick={()=>setShowAddModal(true)} title="Add thread"
                className="p-2 bg-gray-50 text-gray-600 rounded-xl hover:bg-gray-100 border border-gray-200">
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="flex flex-1 min-h-0">
        {/* Left icon bar — only for specific thread */}
        {isSpecificThread && (
          <div className="flex-shrink-0 w-12 flex flex-col items-center py-3 gap-1 border-r border-gray-100 bg-white">
            <button onClick={()=>setSelectedTab('thoughts')} title="Thoughts"
              className={`p-2.5 rounded-xl transition ${selectedTab==='thoughts'?'bg-teal-100 text-teal-700':'text-gray-400 hover:bg-gray-100'}`}>
              <AlignLeft className="w-4 h-4" />
            </button>
            <button onClick={()=>setSelectedTab('dashboard')} title="Dashboard"
              className={`p-2.5 rounded-xl transition ${selectedTab==='dashboard'?'bg-teal-100 text-teal-700':'text-gray-400 hover:bg-gray-100'}`}>
              <LayoutDashboard className="w-4 h-4" />
            </button>
            <button onClick={()=>setSelectedTab('summary')} title="Summary"
              className={`p-2.5 rounded-xl transition ${selectedTab==='summary'?'bg-teal-100 text-teal-700':'text-gray-400 hover:bg-gray-100'}`}>
              <FileText className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 overflow-y-auto">
          {selectedTab==='dashboard' && isSpecificThread && selectedGoal ? (
            <div className="p-5 space-y-5">
              <GoalDashboard goal={selectedGoal} items={parkedItems} onRefresh={()=>{setDashRefresh(new Date());fetchParkedItems(selectedGoalId);}} lastRefresh={dashRefresh} userId={user.id}
                onNavigateToAll={(opts)=>{setSelectedTab('thoughts');setFilter(selectedGoal.id,{showHighlightedOnly:!!opts?.highlightedOnly,activeTags:opts?.tag?[opts.tag]:[]});}} />
              {/* Nudge card */}
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-teal-50 rounded-lg flex items-center justify-center"><Zap className="w-4 h-4 text-teal-500" /></div>
                    <span className="text-sm font-semibold text-gray-800">Your Nudge</span>
                    <InfoButton text="A personalised motivational nudge, quote, and good news based on your thread — refreshed on demand." />
                  </div>
                  <button onClick={()=>handleGenerateNudge(selectedGoal)} disabled={generatingNudge}
                    className="flex items-center gap-1.5 text-xs text-teal-600 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-lg transition disabled:opacity-60">
                    {generatingNudge?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:<Wand2 className="w-3.5 h-3.5"/>}
                    {nudge?'Refresh':'Generate'}
                  </button>
                </div>
                <div className="p-4">
                  {loadingNudge||generatingNudge?(
                    <div className="flex items-center gap-2 py-2 text-teal-600"><Loader2 className="w-4 h-4 animate-spin"/><span className="text-xs">{loadingNudge?'Loading...':'Generating...'}</span></div>
                  ):nudge?(
                    <div className="space-y-3">
                      {nudge.nudge_text&&<div className="flex items-start gap-3"><div className="w-7 h-7 bg-teal-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"><Zap className="w-3.5 h-3.5 text-teal-500"/></div><p className="text-sm text-gray-700 leading-relaxed">{nudge.nudge_text}</p></div>}
                      {nudge.nudge_quote&&<div className="bg-gray-50 rounded-xl px-4 py-3 flex items-start gap-2"><Quote className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5"/><div><p className="text-sm text-gray-600 italic">"{nudge.nudge_quote}"</p>{nudge.nudge_quote_author&&<p className="text-xs text-gray-400 mt-1">— {nudge.nudge_quote_author}</p>}</div></div>}
                      {nudge.good_news_text&&<div className="bg-amber-50 rounded-xl px-4 py-3 flex items-start gap-2"><Newspaper className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5"/><div><p className="text-xs font-bold text-amber-700 mb-0.5">Good News</p><p className="text-sm text-gray-700">{nudge.good_news_text}</p></div></div>}
                      {suggestedThoughts.length>0&&(
                        <div className="bg-blue-50 rounded-xl px-4 py-3">
                          <p className="text-xs font-bold text-blue-700 mb-2">Suggested Tasks</p>
                          <div className="space-y-2">{suggestedThoughts.map((t,i)=><div key={i} className="flex items-center gap-2"><span className="text-xs text-gray-700 flex-1">{t}</span><button onClick={()=>acceptSuggestedThought(t)} className="text-xs bg-blue-600 text-white px-2.5 py-1 rounded-lg hover:bg-blue-700 flex-shrink-0">Accept</button></div>)}</div>
                        </div>
                      )}
                    </div>
                  ):<div className="flex items-center gap-2 text-gray-400 py-1"><Lightbulb className="w-4 h-4"/><span className="text-xs">Preparing your nudge...</span></div>}
                </div>
              </div>
            </div>
          ) : selectedTab==='summary' && isSpecificThread && selectedGoal ? (
            <div className="p-5">
              <GoalSummary goal={selectedGoal} items={parkedItems} user={user} />
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {/* Search + filters */}
              <div className="space-y-2">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"/>
                    <input value={aiSearchQuery} onChange={e=>setAiSearchQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleAiSearch()}
                      placeholder="AI search thoughts..." className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-teal-400 bg-white"/>
                  </div>
                  <button onClick={handleAiSearch} disabled={aiSearchLoading||!aiSearchQuery.trim()}
                    className="flex items-center gap-1 text-xs bg-teal-600 text-white px-3 py-2 rounded-xl hover:bg-teal-700 disabled:opacity-50 flex-shrink-0">
                    {aiSearchLoading?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:<Wand2 className="w-3.5 h-3.5"/>}Search
                  </button>
                  <InfoButton text="AI-powered semantic search — finds thoughts by meaning, not just keywords." />
                  {f.aiSearchActive&&<button onClick={()=>setFilter(key,{aiSearchActive:false,aiFilteredIds:null})} className="text-xs text-gray-500 hover:text-gray-700 px-2">Clear</button>}
                </div>
                {/* Tag filter chips — only show tags with thoughts */}
                {searchableTags.length>0&&(
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={()=>setFilter(key,{showHighlightedOnly:!f.showHighlightedOnly})}
                      className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium transition ${f.showHighlightedOnly?'bg-amber-100 text-amber-700 border-amber-300':'bg-white text-gray-500 border-gray-200 hover:border-amber-300'}`}>
                      <Star className="w-3 h-3" fill={f.showHighlightedOnly?'currentColor':'none'}/>Highlighted
                    </button>
                    <button onClick={()=>setFilter(key,{showWithReminder:!f.showWithReminder})}
                      className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium transition ${f.showWithReminder?'bg-teal-100 text-teal-700 border-teal-300':'bg-white text-gray-500 border-gray-200 hover:border-teal-300'}`}>
                      <Bell className="w-3 h-3"/>Reminder
                    </button>
                    {searchableTags.map(tag=>{
                      const c=getTagColor(tag,[]);const active=f.activeTags.includes(tag);
                      return(<button key={tag} onClick={()=>setFilter(key,{activeTags:active?f.activeTags.filter(x=>x!==tag):[...f.activeTags,tag]})}
                        className={`text-xs px-2.5 py-1 rounded-full border font-medium transition ${active?`${c.bg} ${c.text} border-current`:'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
                        #{tag}
                      </button>);
                    })}
                  </div>
                )}
              </div>

              {/* Thoughts */}
              {loadingItems?(
                <div className="flex justify-center py-6"><div className="w-5 h-5 border-2 border-teal-400 border-t-transparent rounded-full animate-spin"/></div>
              ):(
                <GoalThoughtList
                  user={user}
                  items={filteredItems}
                  goalId={selectedGoalId??'_all'}
                  goalTitle={selectedGoal?.title??'All Threads'}
                  allGoalThoughts={parkedItems.map(i=>i.content)}
                  customTags={[...globalCustomTags,...(selectedGoalId?threadCustomTags[selectedGoalId]??[]:Object.values(threadCustomTags).flat())]}
                  schedules={schedules}
                  allowSummarise={!!selectedGoalId}
                  onReload={()=>{fetchParkedItems(selectedGoalId);fetchSchedules();}}
                  onEdit={id=>navigate(`/parked-thoughts?editId=${id}${selectedGoalId?`&goalId=${selectedGoalId}`:''}`)}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add thread modal */}
      {showAddModal&&(
        <AddThreadModal
          user={user}
          customTags={globalCustomTags}
          onClose={()=>setShowAddModal(false)}
          onSaved={async g=>{await fetchGoals();setSelectedGoalId(g.id);setSelectedTab('thoughts');setShowAddModal(false);}}
        />
      )}
    </div>
  );
}
