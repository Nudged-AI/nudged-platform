import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Brain, Send, Loader2, Check, Mic, MicOff, X, Upload, Image as ImageIcon, Wand2, BellOff, Bell, Tag, Lightbulb, Layers, ArrowRight, Clock, Bold, Italic, Underline } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabase';
import type { User } from '@supabase/supabase-js';
import type { UserProfile } from '../supabase';
import { callLLM, parseJSON } from '../lib/llm';
import { getTagColor, DEFAULT_TAGS } from '../lib/tags';
import { TutorialBanner, InfoButton } from '../components/Tutorial';
import { ReactionToast } from '../components/FeedbackWidget';

interface Goal { id: string; title: string; icon: string; is_general: boolean; is_all_thread?: boolean; milestone_tags?: string[] | null; default_tags?: string[] | null; }
interface Props { user: User; profile: UserProfile; }

const GOAL_ICONS: Record<string, string> = { briefcase: '💼', heart: '❤️', dollar: '💰', book: '📖', dumbbell: '🏋️', star: '⭐', globe: '🌍', music: '🎵', home: '🏠', lightbulb: '💡', leaf: '🌿', flame: '🔥' };
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

declare global {
  interface Window { SpeechRecognition: new () => SpeechRecognition; webkitSpeechRecognition: new () => SpeechRecognition; }
}

// Detect reminder patterns — explicit or implicit deadlines
function extractReminderFromText(text: string): { cleanText: string; hasReminder: boolean; datetimeHint: string | null; frequency: 'once'|'daily'|'weekly'|'monthly'|null; parsedDatetime: string | null } {
  const explicitRegex = /\b(remind me|set a reminder|reminder)\b.{0,80}/i;
  const explicitMatch = text.match(explicitRegex);
  if (explicitMatch) {
    const hint = explicitMatch[0];
    const cleanText = text.replace(explicitMatch[0], '').replace(/\s{2,}/g, ' ').trim();
    const recurring = /\b(every|each|daily|weekly|every day|every week)\b/i.test(hint);
    // Try parse a time from the hint
    const parsedDatetime = tryParseReminderDatetime(hint);
    return { cleanText, hasReminder: true, datetimeHint: hint, frequency: recurring ? 'daily' : 'once', parsedDatetime };
  }
  const deadlineRegex = /\b(by|before|due|deadline|need to.{0,20}by|complete.{0,20}by|finish.{0,20}by)\s+(next \w+|tomorrow|today|this \w+|\d{1,2}[/-]\d{1,2}|\w+day)/i;
  const deadlineMatch = text.match(deadlineRegex);
  if (deadlineMatch) {
    return { cleanText: text, hasReminder: true, datetimeHint: `Detected deadline: "${deadlineMatch[0]}" — Nudged suggests a reminder.`, frequency: 'once', parsedDatetime: null };
  }
  return { cleanText: text, hasReminder: false, datetimeHint: null, frequency: null, parsedDatetime: null };
}

function tryParseReminderDatetime(hint: string): string | null {
  try {
    const now = new Date();
    const tomorrowMatch = /tomorrow/i.test(hint);
    const todayMatch = /today/i.test(hint);
    const timeMatch = hint.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    let base = new Date(now);
    if (tomorrowMatch) base.setDate(base.getDate() + 1);
    if (timeMatch) {
      let h = parseInt(timeMatch[1]);
      const m = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      const ampm = timeMatch[3]?.toLowerCase();
      if (ampm === 'pm' && h < 12) h += 12;
      if (ampm === 'am' && h === 12) h = 0;
      base.setHours(h, m, 0, 0);
    } else if (!todayMatch && !tomorrowMatch) {
      return null;
    }
    // Format as datetime-local value
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${base.getFullYear()}-${pad(base.getMonth()+1)}-${pad(base.getDate())}T${pad(base.getHours())}:${pad(base.getMinutes())}`;
  } catch {
    return null;
  }
}

// Render markdown-style bold/italic/underline as styled spans
function renderStyledText(text: string): React.ReactNode {
  if (!text) return null;
  // Process **bold**, *italic*, __underline__
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;
  while (remaining.length > 0) {
    // Bold: **text**
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    // Italic: *text* (not preceded by *)
    const italicMatch = remaining.match(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/);
    // Underline: __text__
    const underlineMatch = remaining.match(/__(.+?)__/);
    const candidates = [
      boldMatch ? { idx: remaining.indexOf(boldMatch[0]), match: boldMatch, type: 'bold' } : null,
      italicMatch ? { idx: remaining.indexOf(italicMatch[0]), match: italicMatch, type: 'italic' } : null,
      underlineMatch ? { idx: remaining.indexOf(underlineMatch[0]), match: underlineMatch, type: 'underline' } : null,
    ].filter(Boolean) as { idx: number; match: RegExpMatchArray; type: string }[];
    if (candidates.length === 0) { parts.push(remaining); break; }
    candidates.sort((a, b) => a.idx - b.idx);
    const first = candidates[0];
    if (first.idx > 0) parts.push(remaining.slice(0, first.idx));
    if (first.type === 'bold') parts.push(<strong key={key++}>{first.match[1]}</strong>);
    else if (first.type === 'italic') parts.push(<em key={key++}>{first.match[1]}</em>);
    else parts.push(<u key={key++}>{first.match[1]}</u>);
    remaining = remaining.slice(first.idx + first.match[0].length);
  }
  return <>{parts}</>;
}

export default function ParkedThoughtsPage({ user, profile }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const isBuddyMode = new URLSearchParams(location.search).get('mode') === 'buddy';
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  // Screen 1: capture
  const [thought, setThought] = useState('');
  const [listening, setListening] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [ocrRunning, setOcrRunning] = useState(false);
  const [confessMode, setConfessMode] = useState(false);
  const [confessed, setConfessed] = useState(false);
  const [ventMode, setVentMode] = useState(false);
  const [vented, setVented] = useState(false);
  const [helpQuery, setHelpQuery] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpRunning, setHelpRunning] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Prediction + screen 2
  const [predicting, setPredicting] = useState(false);
  const [screen, setScreen] = useState<'capture' | 'link'>('capture');
  const [predictionDone, setPredictionDone] = useState(false);
  const predictTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingFromPredictRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const wrapSelection = (wrapper: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = thought.slice(start, end);
    if (!selected) return;
    const newText = thought.slice(0, start) + wrapper + selected + wrapper + thought.slice(end);
    setThought(newText);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + wrapper.length, end + wrapper.length); });
  };

  // Screen 2: link
  const [selectedGoalIds, setSelectedGoalIds] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState('');
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [saveImage, setSaveImage] = useState(false);
  const [imageOnlyMode, setImageOnlyMode] = useState(false);

  // Reminder
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleFrequency, setScheduleFrequency] = useState<'once' | 'daily' | 'weekly' | 'monthly'>('daily');
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [scheduleDayOfWeek, setScheduleDayOfWeek] = useState(1);
  const [scheduleDateOfMonth, setScheduleDateOfMonth] = useState(1);
  const [scheduleEndDate, setScheduleEndDate] = useState('');
  const [scheduleSpecificDatetime, setScheduleSpecificDatetime] = useState('');
  const [detectedReminderHint, setDetectedReminderHint] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [parkedSuccess, setParkedSuccess] = useState(false);
  const [parkedGoalId, setParkedGoalId] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const hasSpeechAPI = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const parkableGoals = goals.filter(g => !g.is_all_thread);

  useEffect(() => {
    (async () => {
      const [{ data: gs }, { data: ct }] = await Promise.all([
        supabase.from('goals').select('id,title,icon,is_general,is_all_thread,milestone_tags,default_tags').eq('user_id', user.id).order('created_at', { ascending: true }),
        supabase.from('custom_tags').select('tag_name').eq('user_id', user.id),
      ]);
      const allGoals = (gs as Goal[]) ?? [];
      setGoals(allGoals);
      const parkable = allGoals.filter(g => !g.is_all_thread);
      if (parkable.length > 0) setSelectedGoalIds([parkable[0].id]);
      setCustomTags((ct ?? []).map((r: any) => r.tag_name));
      setLoading(false);
    })();
  }, [user.id]);

  // Handle URL params + edit mode
  useEffect(() => {
    if (!goals.length) return;
    const params = new URLSearchParams(location.search);
    const goalId = params.get('goalId');
    const eId = params.get('editId');
    const prefill = params.get('prefill');
    if (goalId) setSelectedGoalIds([goalId]);
    if (prefill) setThought(decodeURIComponent(prefill).slice(0, 1000));
    if (eId) {
      setEditId(eId);
      supabase.from('parked_items').select('*').eq('id', eId).maybeSingle().then(({ data }) => {
        if (data) {
          setThought((data as any).raw_thought || (data as any).content);
          setSelectedGoalIds([(data as any).goal_id]);
          setSelectedTags((data as any).tags ?? []);
          setScreen('link');
        }
      });
    }
  }, [location.search, goals]);

  // Auto-predict after 2s pause — does NOT auto-advance screen
  useEffect(() => {
    if (editId || !thought.trim() || thought.length < 10 || confessMode || ventMode) return;
    if (settingFromPredictRef.current) { settingFromPredictRef.current = false; return; }
    setPredictionDone(false);
    if (predictTimeout.current) clearTimeout(predictTimeout.current);
    predictTimeout.current = setTimeout(() => runPredict(thought), 2000);
    return () => { if (predictTimeout.current) clearTimeout(predictTimeout.current); };
  }, [thought, confessMode, ventMode, editId]);

  const runPredict = async (text: string) => {
    if (!text.trim() || goals.length === 0) return;
    setPredicting(true);
    try {
      // Detect reminder in text
      const { cleanText, hasReminder, datetimeHint, frequency, parsedDatetime } = extractReminderFromText(text);
      if (hasReminder && datetimeHint) {
        settingFromPredictRef.current = true;
        setThought(cleanText);
        setDetectedReminderHint(datetimeHint);
        setScheduleEnabled(true);
        const freq = frequency ?? 'once';
        setScheduleFrequency(freq);
        if (freq === 'once' && parsedDatetime) {
          setScheduleSpecificDatetime(parsedDatetime);
        }
      }

      const parkableNonGeneral = parkableGoals.filter(g => !g.is_general);
      const goalList = parkableNonGeneral.map((g, i) => `${i}: ${g.title}`).join(', ');
      const allAvailTags = [...DEFAULT_TAGS, ...customTags];
      const predictText = hasReminder ? cleanText : text;
      const prompt = `Analyze this thought: "${predictText}"
Available threads: [${goalList}]
Available tags: [${allAvailTags.join(', ')}]
Return JSON: {
  "actual_thought": "pure thought content with main topics wrapped in **bold** and key terms wrapped in __underline__ using markdown-style markers. Strip any embedded instructions. Same language as input.",
  "goal_indices": [0-based indices of relevant threads, or [] for general],
  "tags": ["tag1","tag2"],
  "has_instructions": true_or_false,
  "needs_reminder": true_if_a_deadline_or_time_reference_is_detected_even_if_user_didnt_explicitly_ask,
  "reminder_hint": "description of detected deadline/time if needs_reminder is true, else null"
}`;
      const result = await callLLM('custom_prompt', { prompt });
      const parsed = parseJSON<{ actual_thought: string; goal_indices: number[]; tags: string[]; has_instructions: boolean; needs_reminder?: boolean; reminder_hint?: string | null }>(result);
      if (parsed) {
        if (parsed.has_instructions && parsed.actual_thought && parsed.actual_thought !== text) {
          settingFromPredictRef.current = true;
          setThought(parsed.actual_thought.slice(0, 1000));
        }
        // AI-detected implicit reminder
        if (parsed.needs_reminder && parsed.reminder_hint && !hasReminder) {
          setDetectedReminderHint(parsed.reminder_hint);
          setScheduleEnabled(true);
          setScheduleFrequency('once');
        }
        if (Array.isArray(parsed.goal_indices) && parsed.goal_indices.length > 0) {
          const ids = parsed.goal_indices
            .filter(i => i >= 0 && i < parkableNonGeneral.length)
            .map(i => parkableNonGeneral[i].id);
          if (ids.length > 0) {
            setSelectedGoalIds(ids);
            const defaultTagsSet = new Set<string>();
            ids.forEach(gid => {
              const g = goals.find(x => x.id === gid);
              (g?.default_tags ?? []).forEach(t => defaultTagsSet.add(t));
            });
            const merged = Array.from(new Set([...parsed.tags.filter(t => allAvailTags.includes(t)), ...defaultTagsSet]));
            setSelectedTags(merged);
          }
        } else if (Array.isArray(parsed.tags)) {
          setSelectedTags(prev => Array.from(new Set([...parsed.tags.filter((t: string) => allAvailTags.includes(t)), ...prev])));
        }
      }
      // Mark prediction done — user must click Continue manually
      setPredictionDone(true);
    } catch { /* silent */ } finally { setPredicting(false); }
  };

  const goToLink = () => {
    if (predictTimeout.current) clearTimeout(predictTimeout.current);
    setScreen('link');
  };

  const toggleTag = (tag: string) => setSelectedTags(p => p.includes(tag) ? p.filter(t => t !== tag) : [...p, tag]);
  const toggleGoal = (id: string) => {
    setSelectedGoalIds(prev => {
      const next = prev.includes(id) ? (prev.length > 1 ? prev.filter(x => x !== id) : prev) : [...prev, id];
      const defaultTagsSet = new Set<string>();
      next.forEach(gid => {
        const g = goals.find(x => x.id === gid);
        (g?.default_tags ?? []).forEach(t => defaultTagsSet.add(t));
      });
      setSelectedTags(prevTags => Array.from(new Set([...prevTags, ...defaultTagsSet])));
      return next;
    });
  };

  const addCustomTag = async () => {
    const t = customTagInput.trim().toLowerCase().replace(/\s+/g, '-');
    if (!t || customTags.includes(t) || DEFAULT_TAGS.includes(t)) { setCustomTagInput(''); return; }
    await supabase.from('custom_tags').insert({ user_id: user.id, tag_name: t });
    setCustomTags(p => [...p, t]);
    setSelectedTags(p => [...p, t]);
    setCustomTagInput('');
  };

  const toggleListening = () => {
    if (!hasSpeechAPI) return;
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.continuous = false; rec.interimResults = false; rec.lang = 'en-US';
    rec.onresult = (e) => setThought(prev => (prev ? prev + ' ' + e.results[0][0].transcript : e.results[0][0].transcript).slice(0, 1000));
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec; rec.start(); setListening(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setOcrRunning(true);
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng');
      const { data: { text } } = await worker.recognize(file);
      await worker.terminate();
      const cleaned = text.trim().replace(/\n+/g, ' ').slice(0, 1000);
      if (cleaned) setThought(cleaned);
    } catch { /* silent */ } finally { setOcrRunning(false); }
    e.target.value = '';
  };

  const handleHelpMeThink = async () => {
    if (!helpQuery.trim() || selectedGoalIds.length === 0) return;
    setHelpRunning(true);
    try {
      const gid = selectedGoalIds[0];
      const { data } = await supabase.from('parked_items').select('content').eq('goal_id', gid).eq('is_closed', false).limit(20);
      const existing = ((data ?? []) as any[]).map(i => i.content).join('\n');
      const g = goals.find(x => x.id === gid);
      const prompt = `Goal: "${g?.title}"\nExisting thoughts:\n${existing || 'none'}\nUser query: "${helpQuery}"\nGenerate ONE actionable thought. Return JSON: {"thought":"the suggested thought text"}`;
      const result = await callLLM('custom_prompt', { prompt });
      const parsed = parseJSON<{ thought: string }>(result);
      if (parsed?.thought) setThought(parsed.thought.slice(0, 1000));
      setHelpOpen(false); setHelpQuery('');
    } catch { /* silent */ } finally { setHelpRunning(false); }
  };

  const handleSubmit = async () => {
    if (confessMode) { setConfessed(true); setThought(''); setConfessMode(false); return; }
    if (ventMode) {
      if (!thought.trim()) { setError('Please enter your vent.'); return; }
      await supabase.from('thought_vents').insert({ user_id: user.id, goal_id: selectedGoalIds[0] ?? null, content: thought.trim() });
      setVented(true); setThought(''); setVentMode(false);
      setTimeout(() => setVented(false), 4000);
      return;
    }
    if (!imageOnlyMode && !thought.trim()) { setError('Please enter a thought.'); return; }
    if (selectedGoalIds.length === 0) { setError('Please select a thread.'); return; }
    setSubmitting(true); setError('');
    try {
      const item_type = imageOnlyMode ? 'task' : (selectedTags.includes('challenge') ? 'challenge' : selectedTags.includes('gratitude') ? 'gratitude' : 'task');
      const primaryGoalId = selectedGoalIds[0];
      const extraGoalIds = selectedGoalIds.slice(1);

      let imageUrl: string | null = null;
      if (imageFile && (saveImage || imageOnlyMode) && !editId) {
        const { count } = await supabase.from('parked_items').select('id', { count: 'exact', head: true }).eq('user_id', user.id).not('image_url', 'is', null);
        if ((count ?? 0) >= 20) {
          const { data: oldest } = await supabase.from('parked_items').select('id,image_url').eq('user_id', user.id).not('image_url', 'is', null).order('created_at', { ascending: true }).limit(1);
          if (oldest?.[0]) {
            const path = oldest[0].image_url.split('/').pop();
            if (path) await supabase.storage.from('vision-assets').remove([`thought-images/${user.id}/${path}`]);
            await supabase.from('parked_items').update({ image_url: null }).eq('id', oldest[0].id);
          }
        }
        const ext = imageFile.name.split('.').pop() ?? 'jpg';
        const path = `thought-images/${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('vision-assets').upload(path, imageFile, { upsert: true });
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage.from('vision-assets').getPublicUrl(path);
          imageUrl = publicUrl;
        }
      }

      if (editId) {
        await supabase.from('parked_items').update({
          goal_id: primaryGoalId, extra_goal_ids: extraGoalIds,
          milestone_index: 0, milestone_tag: 'General', milestone_tags: ['General'], item_type,
          content: thought.trim(), raw_thought: thought.trim(),
          tags: selectedTags, updated_at: new Date().toISOString()
        }).eq('id', editId);
      } else {
        const insertPayload: Record<string, unknown> = {
          user_id: user.id, goal_id: primaryGoalId, extra_goal_ids: extraGoalIds,
          milestone_index: 0, milestone_tag: 'General', milestone_tags: ['General'],
          item_type, tags: selectedTags, image_url: imageUrl,
        };
        if (!imageOnlyMode) {
          insertPayload.raw_thought = thought;
          insertPayload.content = thought.trim();
        } else {
          insertPayload.raw_thought = '';
          insertPayload.content = '';
        }
        const { data: newItem } = await supabase.from('parked_items').insert(insertPayload).select().maybeSingle();

        if (newItem && scheduleEnabled) {
          const schedulePayload: Record<string, unknown> = {
            user_id: user.id,
            parked_item_id: (newItem as any).id,
            frequency: scheduleFrequency,
            time_of_day: scheduleFrequency === 'once' ? (scheduleSpecificDatetime ? scheduleSpecificDatetime.split('T')[1]?.slice(0, 5) || scheduleTime : scheduleTime) : scheduleTime,
            day_of_week: scheduleFrequency === 'weekly' ? scheduleDayOfWeek : null,
            date_of_month: scheduleFrequency === 'monthly' ? scheduleDateOfMonth : null,
            end_date: scheduleEndDate || null,
            specific_datetime: scheduleFrequency === 'once' && scheduleSpecificDatetime ? scheduleSpecificDatetime : null,
            is_active: true,
          };
          await supabase.from('thought_schedules').insert(schedulePayload);
        }

        if (extraGoalIds.length > 0) {
          await Promise.all(extraGoalIds.map(gid =>
            supabase.from('parked_items').insert({
              user_id: user.id, goal_id: gid,
              milestone_index: 0, milestone_tag: 'General', milestone_tags: ['General'],
              raw_thought: imageOnlyMode ? '' : thought,
              item_type, content: imageOnlyMode ? '' : thought.trim(),
              tags: selectedTags, image_url: imageUrl,
            })
          ));
        }
      }

      setParkedGoalId(primaryGoalId);
      setParkedSuccess(true);
    } catch { setError('Failed to submit. Please try again.'); } finally { setSubmitting(false); }
  };

  const allTags = [...DEFAULT_TAGS, ...customTags].sort((a, b) => a.localeCompare(b));

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>;

  if (parkedSuccess) return (
    <div className="max-w-2xl mx-auto px-4 py-16 flex flex-col items-center gap-6">
      <div className="w-16 h-16 bg-teal-50 rounded-full flex items-center justify-center">
        <Check className="w-8 h-8 text-teal-600" />
      </div>
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-1">Thought parked!</h2>
        <p className="text-sm text-gray-500">Great job capturing that idea.</p>
      </div>
      <ReactionToast user={user} actionType="park_thought" onDone={() => navigate(`/goals?goalId=${parkedGoalId}`, { replace: true })} />
      <button onClick={() => navigate(`/goals?goalId=${parkedGoalId}`, { replace: true })} className="text-xs text-gray-400 hover:text-gray-600 mt-2">
        Go to threads
      </button>
    </div>
  );

  if (parkableGoals.length === 0) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <Layers className="w-12 h-12 text-gray-200 mb-4" />
      <h2 className="text-lg font-bold text-gray-700 mb-2">No threads yet</h2>
      <button onClick={() => navigate('/goals')} className="bg-teal-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-teal-700">Go to Threads</button>
    </div>
  );

  // SCREEN 1 — Capture
  if (screen === 'capture') return (
    <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col min-h-[80vh]">

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Park a thought</h1>
          <p className="text-gray-500 text-sm mt-0.5">Clear your mind. Capture it here.</p>
        </div>
        <button onClick={() => navigate('/goals')} className="flex items-center gap-1.5 text-xs text-teal-600 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-lg flex-shrink-0">
          <Layers className="w-3.5 h-3.5" /> Threads
        </button>
      </div>

      {/* Confess + Vent toggles — hidden in Buddy mode */}
      {!isBuddyMode && (
      <div className="flex flex-wrap gap-4 mb-5">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={confessMode} onChange={e => { setConfessMode(e.target.checked); if (e.target.checked) { setConfessed(false); setVentMode(false); } }} className="w-4 h-4 rounded accent-teal-600" />
          <span className="text-sm text-gray-600">I want to confess</span>
          <InfoButton text="Share something on your heart anonymously. Nothing is stored — it's just for you to feel lighter." />
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={ventMode} onChange={e => { setVentMode(e.target.checked); if (e.target.checked) { setVented(false); setConfessMode(false); } }} className="w-4 h-4 rounded accent-rose-500" />
          <span className="text-sm text-gray-600">I want to vent out</span>
          <InfoButton text="Vent freely — stored privately, never shown publicly." />
        </label>
      </div>
      )}

      {confessed && <div className="bg-teal-50 border border-teal-200 rounded-2xl p-5 text-center mb-6"><p className="text-teal-700 font-semibold">Confessing takes courage, good job!</p></div>}
      {vented && <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 text-center mb-6"><p className="text-rose-700 font-semibold">Venting takes courage, good job!</p></div>}

      {/* Thought input — full focus */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-4 flex-1 flex flex-col">
        <div className="flex items-center gap-1 px-4 pt-3 border-b border-gray-100">
          <button onClick={() => wrapSelection('**')} title="Bold" className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition font-bold text-sm">B</button>
          <button onClick={() => wrapSelection('*')} title="Italic" className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition italic text-sm">I</button>
          <button onClick={() => wrapSelection('__')} title="Underline" className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition underline text-sm">U</button>
          <span className="text-xs text-gray-300 ml-2">Select text then click to format</span>
        </div>
        {/* Preview styled text when not focused */}
        <textarea
          ref={textareaRef}
          value={thought}
          onChange={e => setThought(e.target.value.slice(0, 1000))}
          placeholder={confessMode ? "What's on your mind? (not stored)" : ventMode ? "Vent it all out — this is private, for your eyes only..." : "What's on your mind?\nYou can say things like 'remind me at 6am tomorrow' or 'park this to Health thread'..."}
          className="flex-1 w-full px-5 pt-5 pb-4 text-base text-gray-800 placeholder-gray-400 focus:outline-none resize-none min-h-[180px]"
          autoFocus
        />
        <div className="px-4 pb-4 flex items-center justify-between gap-3">
          <span className="text-xs text-gray-400">{thought.length}/1000</span>
          {predicting && <span className="text-xs text-teal-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />predicting...</span>}
          {predictionDone && !predicting && <span className="text-xs text-teal-600 flex items-center gap-1"><Check className="w-3 h-3" />Ready — click Continue</span>}
        </div>
      </div>

      {/* Voice button — mic icon only, prominent */}
      {hasSpeechAPI && (
        <button
          onClick={toggleListening}
          className={`w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-semibold text-base transition mb-3 ${listening ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-100' : 'bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-200'}`}
          title={listening ? 'Tap to stop recording' : 'Record your thought by voice'}
        >
          {listening ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
          {listening ? <span className="text-sm">Tap to stop</span> : null}
        </button>
      )}

      {/* Secondary tools — hide image upload in Buddy mode */}
      {!confessMode && !ventMode && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {!isBuddyMode && (
          <label className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl cursor-pointer transition ${ocrRunning ? 'bg-teal-50 text-teal-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {ocrRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {ocrRunning ? 'Scanning...' : 'Upload image'}
            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          </label>
          )}
          <button onClick={() => setHelpOpen(p => !p)} className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 transition">
            <Lightbulb className="w-3.5 h-3.5" /> Help me think
          </button>
        </div>
      )}

      {/* Help me think panel */}
      {helpOpen && !confessMode && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 space-y-3">
          <p className="text-sm font-semibold text-amber-800">Help me think</p>
          <textarea value={helpQuery} onChange={e => setHelpQuery(e.target.value)} placeholder="What's your question?" rows={2} className="w-full border border-amber-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-amber-400 resize-none" />
          <div className="flex gap-2">
            <button onClick={handleHelpMeThink} disabled={!helpQuery.trim() || helpRunning} className="flex items-center gap-1.5 text-xs bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700 disabled:opacity-60">
              {helpRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} Generate
            </button>
            <button onClick={() => { setHelpOpen(false); setHelpQuery(''); }} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
          </div>
        </div>
      )}

      {/* Image preview */}
      {imagePreview && (
        <div className="mb-4 flex items-start gap-3">
          <img src={imagePreview} alt="uploaded" className="w-16 h-16 object-cover rounded-xl border border-gray-200" />
          <div className="flex flex-col gap-2">
            <button onClick={() => { setImageFile(null); setImagePreview(null); setSaveImage(false); setImageOnlyMode(false); }} className="text-gray-400 hover:text-red-500 transition"><X className="w-4 h-4" /></button>
            <button onClick={() => {
              setImageOnlyMode(true);
              setSaveImage(true);
              if (goals.length > 0) {
                const nonGeneral = goals.filter(g => !g.is_general && !g.is_all_thread);
                const goalList = nonGeneral.map((g, i) => `${i}: ${g.title}`).join(', ');
                const prompt = `Predict which thread this image belongs to. Threads: [${goalList}]. Return JSON: {"goal_indices": [index]}. Return only JSON.`;
                callLLM('custom_prompt', { prompt }).then(res => {
                  const parsed = parseJSON<{ goal_indices: number[] }>(res);
                  if (parsed?.goal_indices?.length) {
                    const ids = parsed.goal_indices.filter(i => i >= 0 && i < nonGeneral.length).map(i => nonGeneral[i].id);
                    if (ids.length) setSelectedGoalIds(ids);
                  }
                }).catch(() => {}).finally(() => setScreen('link'));
              } else {
                setScreen('link');
              }
            }} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition font-medium flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5" /> Only park image
            </button>
          </div>
        </div>
      )}

      {/* Confess / Vent submit */}
      {(confessMode || ventMode) && (
        <button onClick={handleSubmit} disabled={ventMode && !thought.trim()} className="w-full flex items-center justify-center gap-2 bg-teal-600 text-white py-3.5 rounded-xl font-bold text-base hover:bg-teal-700 transition disabled:opacity-60 shadow-md shadow-teal-100">
          {confessMode ? 'Confess' : 'Vent out'}
        </button>
      )}

      {/* Continue to link screen — always manual click */}
      {!confessMode && !ventMode && (
        <button
          onClick={goToLink}
          disabled={predicting || !thought.trim()}
          className="w-full flex items-center justify-center gap-2 bg-teal-600 text-white py-3.5 rounded-xl font-bold text-base hover:bg-teal-700 transition disabled:opacity-60 shadow-md shadow-teal-100"
        >
          {predicting ? <><Loader2 className="w-5 h-5 animate-spin" /> Analysing...</> : <><ArrowRight className="w-5 h-5" /> Continue</>}
        </button>
      )}
    </div>
  );

  // SCREEN 2 — Link to thread + tags
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <TutorialBanner tutorialKey="save_image" />

      {/* Header with back */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setScreen('capture')} className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 transition">
          <X className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{imageOnlyMode ? 'Park image' : 'Link your thought'}</h1>
          <p className="text-gray-500 text-xs mt-0.5">{imageOnlyMode ? 'Choose a thread for this image' : 'Choose thread(s) and tags'}</p>
        </div>
      </div>

      {/* Thought preview — render styled text */}
      {!imageOnlyMode && (
        <div className="bg-teal-50 border border-teal-200 rounded-2xl px-4 py-3 mb-5">
          <p className="text-sm text-teal-900 leading-relaxed">{renderStyledText(thought)}</p>
        </div>
      )}

      {/* Image preview on screen 2 */}
      {imageOnlyMode && imagePreview && (
        <div className="mb-5 rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
          <img src={imagePreview} alt="uploaded" className="w-full max-h-48 object-cover" />
        </div>
      )}


      {/* Thread selection */}
      <div className="mb-5">
        <p className="text-sm font-semibold text-gray-800 mb-2.5">
          Link to thread(s) {!imageOnlyMode && <span className="text-xs text-gray-400 font-normal">(tap to select multiple)</span>}
        </p>
        <div className="flex flex-wrap gap-2">
          {parkableGoals.map(g => {
            const active = selectedGoalIds.includes(g.id);
            return (
              <button key={g.id} onClick={() => toggleGoal(g.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition ${active ? 'border-teal-500 bg-teal-50 text-teal-800 font-semibold' : 'border-gray-200 text-gray-700 hover:border-teal-300 bg-white'}`}>
                <span>{GOAL_ICONS[g.icon] ?? '🎯'}</span>
                <span>{g.title}</span>
                {active && <Check className="w-3.5 h-3.5 text-teal-600" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tags — skip for image-only */}
      {!imageOnlyMode && (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2.5">
            <Tag className="w-4 h-4 text-gray-400" />
            <p className="text-sm font-semibold text-gray-800">Tags</p>
            {predicting && <span className="text-xs text-teal-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />predicting...</span>}
            {selectedTags.length > 0 && <span className="text-xs text-gray-400 ml-auto">{selectedTags.length} selected</span>}
          </div>
          {selectedTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2.5 bg-teal-50 rounded-xl px-3 py-2 border border-teal-100">
              {selectedTags.map(tag => {
                const c = getTagColor(tag, customTags);
                return (
                  <button key={tag} onClick={() => toggleTag(tag)} className={`text-xs px-2.5 py-1 rounded-full border shadow-sm font-medium ${c.bg} ${c.text} border-current flex items-center gap-1`}>
                    #{tag} <X className="w-2.5 h-2.5" />
                  </button>
                );
              })}
            </div>
          )}
          <div className="max-h-36 overflow-y-auto pr-1">
            <div className="flex flex-wrap gap-1.5 py-1">
              {allTags.filter(t => !selectedTags.includes(t)).map(tag => (
                <button key={tag} onClick={() => toggleTag(tag)}
                  className="text-xs px-2.5 py-1 rounded-full border transition font-medium bg-white text-gray-500 border-gray-200 hover:border-teal-400 hover:text-teal-600 hover:bg-teal-50">
                  #{tag}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <input value={customTagInput} onChange={e => setCustomTagInput(e.target.value.slice(0, 20))}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomTag(); } }}
              placeholder="Add custom tag..." className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-400 w-40 bg-white" />
            <button onClick={addCustomTag} className="text-xs text-teal-600 bg-teal-50 hover:bg-teal-100 px-2.5 py-1.5 rounded-lg">Add</button>
          </div>
        </div>
      )}

      {/* Reminder — skip for image-only */}
      {!editId && !imageOnlyMode && (
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => setScheduleEnabled(p => !p)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${scheduleEnabled ? 'bg-teal-600' : 'bg-gray-200'}`}>
              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${scheduleEnabled ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-sm text-gray-600 flex items-center gap-1.5">
              {scheduleEnabled ? <Bell className="w-4 h-4 text-teal-500" /> : <BellOff className="w-4 h-4 text-gray-400" />}
              {scheduleEnabled ? 'Reminder on' : 'Add a reminder'}
              <InfoButton text="Set a reminder for this thought — once, daily, weekly, or monthly." />
            </span>
          </div>
          {scheduleEnabled && (
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-3">
              {/* Frequency tabs */}
              <div className="flex gap-2 flex-wrap">
                {(['once','daily','weekly','monthly'] as const).map(f => (
                  <button key={f} onClick={() => setScheduleFrequency(f)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition capitalize ${scheduleFrequency === f ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-200 hover:border-teal-300'}`}>
                    {f === 'once' ? 'One-time' : f}
                  </button>
                ))}
              </div>

              {scheduleFrequency === 'once' && (
                <div className="space-y-2">
                  <label className="text-xs text-gray-500 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Date &amp; time</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input type="datetime-local" value={scheduleSpecificDatetime} onChange={e => setScheduleSpecificDatetime(e.target.value)}
                      className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-teal-400 bg-white flex-1" />
                    {detectedReminderHint && (
                      <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 text-xs text-amber-700 max-w-[200px]">
                        <Bell className="w-3 h-3 text-amber-500 flex-shrink-0" />
                        <span className="truncate" title={detectedReminderHint}>{scheduleSpecificDatetime ? 'Pre-filled from text' : 'From your text'}</span>
                        <button onClick={() => setDetectedReminderHint(null)} className="text-amber-400 hover:text-amber-600 flex-shrink-0"><X className="w-3 h-3" /></button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {scheduleFrequency !== 'once' && (
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="text-xs text-gray-500">Time:</label>
                  <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none" />
                  {scheduleFrequency === 'weekly' && (
                    <>
                      <label className="text-xs text-gray-500">Day:</label>
                      <select value={scheduleDayOfWeek} onChange={e => setScheduleDayOfWeek(+e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none">
                        {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                      </select>
                    </>
                  )}
                  {scheduleFrequency === 'monthly' && (
                    <>
                      <label className="text-xs text-gray-500">Date:</label>
                      <input type="number" min={1} max={31} value={scheduleDateOfMonth} onChange={e => setScheduleDateOfMonth(+e.target.value)} className="text-xs border border-gray-200 rounded-lg w-16 px-2 py-1 focus:outline-none" />
                    </>
                  )}
                </div>
              )}

              {scheduleFrequency !== 'once' && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">End date (optional):</label>
                  <input type="date" value={scheduleEndDate} onChange={e => setScheduleEndDate(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none" />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-2.5 rounded-xl mb-4">{error}</p>}

      <div className="flex gap-3">
        <button onClick={() => setScreen('capture')} className="flex-shrink-0 py-3.5 px-5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition">
          Back
        </button>
        <button onClick={handleSubmit} disabled={submitting || (!imageOnlyMode && !thought.trim())} className="flex-1 flex items-center justify-center gap-2 bg-teal-600 text-white py-3.5 rounded-xl font-bold text-base hover:bg-teal-700 transition disabled:opacity-60 shadow-md shadow-teal-100">
          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          {editId ? 'Update' : imageOnlyMode ? 'Park image' : 'Park thought'}
        </button>
      </div>

      {editId && (
        <button onClick={() => { setEditId(null); setThought(''); setSelectedTags([]); navigate('/parked-thoughts', { replace: true }); }} className="w-full text-sm text-gray-500 py-2 hover:text-gray-700 transition mt-2">
          Cancel Edit
        </button>
      )}
    </div>
  );
}
