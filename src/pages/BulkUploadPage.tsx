import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Send, X, FileText, Loader2, ChevronDown, Check, Wand2, Mic, MicOff, Square } from 'lucide-react';
import { supabase } from '../supabase';
import type { User } from '@supabase/supabase-js';
import { callLLM, parseJSON } from '../lib/llm';
import { DEFAULT_TAGS } from '../lib/tags';
import { InfoButton } from '../components/Tutorial';

interface Goal { id: string; title: string; is_general: boolean; default_tags?: string[]; }
interface Props { user: User; }

interface Row {
  id: number;
  thought: string;
  goalId: string;
  tags: string[];
}

let nextId = 1;
function newRow(goalId: string): Row {
  return { id: nextId++, thought: '', goalId, tags: [] };
}

const STORAGE_KEY = 'calm_bulk_listen_drafts';

function TagDropdown({ tags, onChange, allTags }: { tags: string[]; onChange: (t: string[]) => void; allTags: string[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (tag: string) => onChange(tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag]);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white hover:border-teal-300 transition focus:outline-none focus:ring-1 focus:ring-teal-400">
        <span className="truncate text-gray-600">
          {tags.length === 0 ? 'Tags...' : tags.slice(0, 2).join(', ') + (tags.length > 2 ? ` +${tags.length - 2}` : '')}
        </span>
        <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute z-20 top-full left-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg w-40 py-1.5 max-h-48 overflow-y-auto">
          {allTags.map(tag => (
            <button key={tag} type="button" onClick={() => toggle(tag)}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition">
              <span className={`w-3.5 h-3.5 rounded flex items-center justify-center border flex-shrink-0 ${tags.includes(tag) ? 'bg-teal-600 border-teal-600' : 'border-gray-300'}`}>
                {tags.includes(tag) && <Check className="w-2.5 h-2.5 text-white" />}
              </span>
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BulkUploadPage({ user }: Props) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [predicting, setPredicting] = useState<number | null>(null);
  const [docLoading, setDocLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState('');
  const [customTags, setCustomTags] = useState<string[]>([]);

  // Listen In state
  const [listening, setListening] = useState(false);
  const [listenTranscript, setListenTranscript] = useState('');
  const [listenProcessing, setListenProcessing] = useState(false);
  const [listenDisposed, setListenDisposed] = useState(false);
  const [listenMode, setListenMode] = useState<'mic' | 'system'>('mic');
  const recognitionRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accumulatedRef = useRef<string>('');

  useEffect(() => {
    supabase.from('goals').select('id,title,is_general,default_tags').eq('user_id', user.id).then(({ data }) => {
      const gs = (data ?? []) as Goal[];
      setGoals(gs);
      const defGoal = gs[0]?.id ?? '';
      // Restore saved drafts from localStorage
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as Row[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            nextId = Math.max(...parsed.map(r => r.id), 0) + 1;
            setRows(parsed);
            return;
          }
        } catch { /* ignore */ }
      }
      setRows([newRow(defGoal), newRow(defGoal), newRow(defGoal)]);
    });
    supabase.from('custom_tags').select('tag_name').eq('user_id', user.id).then(({ data }) => {
      setCustomTags((data ?? []).map((r: any) => r.tag_name));
    });
  }, [user.id]);

  // Persist rows to localStorage
  useEffect(() => {
    if (rows.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    }
  }, [rows]);

  const allTags = [...DEFAULT_TAGS, ...customTags].sort((a, b) => a.localeCompare(b));
  const updateRow = (id: number, field: keyof Row, value: any) =>
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  const addRow = () => setRows(prev => [...prev, newRow(goals[0]?.id ?? '')]);
  const removeRow = (id: number) => setRows(prev => prev.filter(r => r.id !== id));

  const autoPredict = async (id: number, thought: string) => {
    if (!thought.trim() || thought.length < 10) return;
    setPredicting(id);
    try {
      const goalList = goals.filter(g => !g.is_general).map((g, i) => `${i}: ${g.title}`).join(', ');
      const prompt = `Given goals: [${goalList}] and thought: "${thought}"
Available category tags: [${allTags.join(', ')}]
Pick the best matching goal index and 1-3 tags. Return JSON: {"goal_index": number_or_-1, "tags": ["tag1","tag2"]}. Return only JSON.`;
      const result = await callLLM('custom_prompt', { prompt });
      const parsed = parseJSON<{ goal_index: number; tags: string[] }>(result);
      if (parsed) {
        const nonGeneral = goals.filter(g => !g.is_general);
        if (parsed.goal_index >= 0 && parsed.goal_index < nonGeneral.length) {
          updateRow(id, 'goalId', nonGeneral[parsed.goal_index].id);
        }
        if (Array.isArray(parsed.tags)) updateRow(id, 'tags', parsed.tags.filter(t => allTags.includes(t)));
      }
    } catch { /* silent */ } finally { setPredicting(null); }
  };

  const extractWithLLM = async (text: string) => {
    setExtracting(true);
    try {
      const goalList = goals.filter(g => !g.is_general).map((g, i) => `${i}: ${g.title}`).join(', ');
      const prompt = `Extract individual tasks, ideas, challenges, and thoughts from this document. For each one, predict the best goal index (from the list) and category tags.

Goals: [${goalList}]
Available tags: [${allTags.join(', ')}]

Document text:
${text.slice(0, 3000)}

Return JSON: {"items": [{"thought": "text", "goal_index": number, "tags": ["tag"]}]}
Extract at least 3 and at most 30 distinct items. Return only valid JSON.`;
      const result = await callLLM('custom_prompt', { prompt });
      const parsed = parseJSON<{ items: { thought: string; goal_index: number; tags: string[] }[] }>(result);
      if (parsed?.items?.length) {
        const nonGeneral = goals.filter(g => !g.is_general);
        const defGoal = goals[0]?.id ?? '';
        setRows(parsed.items.map(item => {
          const goalId = (item.goal_index >= 0 && item.goal_index < nonGeneral.length) ? nonGeneral[item.goal_index].id : defGoal;
          return {
            id: nextId++,
            thought: item.thought?.slice(0, 500) ?? '',
            goalId,
            tags: (item.tags ?? []).filter(t => allTags.includes(t)),
          };
        }));
      }
    } catch { setError('Failed to extract from document.'); } finally { setExtracting(false); }
  };

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocLoading(true);
    setError('');
    try {
      const supported = ['.txt', '.md', '.csv'].some(ext => file.name.toLowerCase().endsWith(ext)) || file.type === 'text/plain';
      if (!supported) {
        setError('Supported formats: .txt, .md, .csv. For .pdf/.doc/.xls, copy the text and paste it below the import button.');
        setDocLoading(false);
        return;
      }
      const text = await file.text();
      if (text.trim().length > 50) {
        setDocLoading(false);
        await extractWithLLM(text);
      } else {
        setError('Document too short to extract thoughts from.');
        setDocLoading(false);
      }
    } catch { setError('Failed to read document.'); setDocLoading(false); }
    e.target.value = '';
  };

  // Listen In feature
  const notify = (title: string, body: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  };

  const startListening = async () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setError('Voice recognition not supported in this browser.'); return; }
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    accumulatedRef.current = '';
    setListenTranscript('');
    setListenDisposed(false);
    setListening(true);
    notify('Nudged — Listen In', 'Listening started. Speak your thoughts — we\'ll capture them.');

    rec.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          accumulatedRef.current += transcript + ' ';
        } else {
          interim += transcript;
        }
      }
      setListenTranscript(accumulatedRef.current + interim);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        stopListening();
      }, 5 * 60 * 1000);
    };

    rec.onerror = () => { /* silent */ };
    rec.onend = () => {
      if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
      setListening(false);
    };

    rec.start();
    recognitionRef.current = rec;
  };

  const stopListening = async () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* */ }
      recognitionRef.current = null;
    }
    // Release system audio stream if any
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    setListening(false);
    const fullText = accumulatedRef.current.trim();
    if (!fullText) return;

    notify('Nudged — Listen In', 'Listening stopped. Processing your thoughts...');
    setListenProcessing(true);
    try {
      const goalList = goals.filter(g => !g.is_general).map((g, i) => `${i}: ${g.title}`).join(', ');
      const prompt = `Extract individual tasks, ideas, challenges, and thoughts from this spoken transcript. For each one, predict the best goal index and category tags.

Goals: [${goalList}]
Available tags: [${allTags.join(', ')}]

Transcript:
${fullText.slice(0, 3000)}

Return JSON: {"items": [{"thought": "text", "goal_index": number, "tags": ["tag"]}]}
Extract at least 1 and at most 30 distinct items. Return only valid JSON.`;
      const result = await callLLM('custom_prompt', { prompt });
      const parsed = parseJSON<{ items: { thought: string; goal_index: number; tags: string[] }[] }>(result);
      if (parsed?.items?.length) {
        const nonGeneral = goals.filter(g => !g.is_general);
        const defGoal = goals[0]?.id ?? '';
        const newRows = parsed.items.map(item => {
          const goalId = (item.goal_index >= 0 && item.goal_index < nonGeneral.length) ? nonGeneral[item.goal_index].id : defGoal;
          const g = goals.find(x => x.id === goalId);
          const defaultTags = g?.default_tags ?? [];
          return {
            id: nextId++,
            thought: item.thought?.slice(0, 500) ?? '',
            goalId,
            tags: Array.from(new Set([...(item.tags ?? []).filter(t => allTags.includes(t)), ...defaultTags])),
          };
        });
        setRows(prev => [...prev, ...newRows]);
        notify('Nudged — Listen In', `${newRows.length} thoughts ready for review. Go to Bulk Upload to submit.`);
        setListenDisposed(true);
      }
    } catch { /* silent */ } finally {
      setListenProcessing(false);
      setListenTranscript('');
      accumulatedRef.current = '';
    }
  };

  const handleSubmit = async () => {
    const valid = rows.filter(r => r.thought.trim() && r.goalId);
    if (valid.length === 0) { setError('Add at least one thought.'); return; }
    setSubmitting(true); setError('');
    try {
      await Promise.all(valid.map(r => {
        return supabase.from('parked_items').insert({
          user_id: user.id, goal_id: r.goalId, milestone_tag: 'General',
          milestone_tags: ['General'], milestone_index: 0,
          raw_thought: r.thought.trim(), item_type: r.tags.includes('challenge') ? 'challenge' : 'task',
          content: r.thought.trim(), tags: r.tags,
        });
      }));
      setSuccess(true);
      localStorage.removeItem(STORAGE_KEY);
      const defGoal = goals[0]?.id ?? '';
      setRows([newRow(defGoal), newRow(defGoal), newRow(defGoal)]);
      setTimeout(() => setSuccess(false), 4000);
    } catch { setError('Failed to submit. Please try again.'); } finally { setSubmitting(false); }
  };

  if (goals.length === 0) return (
    <div className="flex items-center justify-center min-h-[60vh] text-center px-6">
      <p className="text-gray-400 text-sm">No goals yet. Create a goal first.</p>
    </div>
  );

  const filledRows = rows.filter(r => r.thought.trim()).length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">Bulk Upload <InfoButton text="Add many thoughts at once — type or paste text, then link each row to a thread and tags before submitting all in one go. Drafts persist even if you close the tab." /></h1>
          <p className="text-gray-500 text-sm mt-1">Add multiple thoughts at once, import from a document, or listen in.</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Listen mode toggle */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 text-xs">
            <button onClick={() => setListenMode('mic')} className={`px-2.5 py-1 rounded-lg transition ${listenMode === 'mic' ? 'bg-white text-gray-800 shadow-sm font-medium' : 'text-gray-500'}`}>Mic</button>
            <button onClick={() => setListenMode('system')} className={`px-2.5 py-1 rounded-lg transition ${listenMode === 'system' ? 'bg-white text-gray-800 shadow-sm font-medium' : 'text-gray-500'}`}>Meeting audio</button>
          </div>
          <button
            onClick={listening ? stopListening : startListening}
            disabled={listenProcessing}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition shadow-sm ${listening ? 'bg-red-600 text-white hover:bg-red-700 animate-pulse' : 'bg-teal-600 text-white hover:bg-teal-700'} disabled:opacity-60`}
          >
            {listenProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            {listenProcessing ? 'Processing...' : listening ? 'Stop' : 'Listen In'}
          </button>
          <label className="flex items-center gap-2 cursor-pointer px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition shadow-sm">
            {docLoading || extracting ? <Loader2 className="w-4 h-4 animate-spin text-teal-500" /> : <FileText className="w-4 h-4" />}
            {extracting ? 'Extracting...' : 'Import file'}
            <input type="file" accept=".txt,.md,.csv" onChange={handleDocUpload} className="hidden" disabled={docLoading || extracting} />
          </label>
        </div>
      </div>

      {listening && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3 text-red-700 text-sm">
          <Mic className="w-4 h-4 animate-pulse flex-shrink-0" />
          <span>
            {listenMode === 'system'
              ? 'Listening via microphone — for meeting audio, ensure your OS routes speaker output back to the mic (e.g. via Stereo Mix or a virtual audio cable).'
              : 'Listening to microphone...'} Stop to extract thoughts.
          </span>
        </div>
      )}
      {listenDisposed && !listening && !listenProcessing && (
        <div className="mb-4 bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 text-teal-700 text-sm">
          Listening session ended. Audio stream has been released. Review and edit the extracted thoughts below, then click Park.
        </div>
      )}
      {listenTranscript && (
        <div className="mb-4 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 max-h-32 overflow-y-auto">
          <p className="text-xs text-gray-400 mb-1">Live transcript:</p>
          <p className="text-sm text-gray-700">{listenTranscript.slice(-500)}</p>
        </div>
      )}
      {extracting && (
        <div className="mb-4 bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 flex items-center gap-3 text-teal-700 text-sm">
          <Wand2 className="w-4 h-4 animate-pulse flex-shrink-0" />
          Parker AI is reading your document and extracting thoughts...
        </div>
      )}
      {success && (
        <div className="mb-4 bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 text-teal-700 text-sm font-medium flex items-center gap-2">
          <Check className="w-4 h-4" /> All thoughts parked successfully!
        </div>
      )}
      {error && <p className="mb-4 text-sm text-red-600 bg-red-50 px-4 py-2.5 rounded-xl">{error}</p>}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto mb-4">
        <div className="min-w-[480px]">
          <div className="grid gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider" style={{ gridTemplateColumns: '1fr 160px 160px 36px' }}>
            <span>Thought</span>
            <span>Thread</span>
            <span>Tags</span>
            <span></span>
          </div>
          <div className="divide-y divide-gray-50">
            {rows.map(row => (
              <div key={row.id} className="grid gap-2 px-4 py-2 items-start" style={{ gridTemplateColumns: '1fr 160px 160px 36px' }}>
                <div className="flex items-start gap-1.5 pt-0.5">
                  <textarea
                    value={row.thought}
                    onChange={e => updateRow(row.id, 'thought', e.target.value.slice(0, 500))}
                    onBlur={e => autoPredict(row.id, e.target.value)}
                    rows={2}
                    placeholder="Type or paste a thought..."
                    className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-400 resize-none"
                  />
                  {predicting === row.id && <Loader2 className="w-4 h-4 text-teal-400 animate-spin flex-shrink-0 mt-1" />}
                </div>
                <select value={row.goalId} onChange={e => updateRow(row.id, 'goalId', e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-400">
                  {goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
                </select>
                <TagDropdown tags={row.tags} onChange={t => updateRow(row.id, 'tags', t)} allTags={allTags} />
                <button onClick={() => removeRow(row.id)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition flex-shrink-0 mt-0.5">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button onClick={addRow} className="flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700 font-medium">
          <Plus className="w-4 h-4" /> Add row
        </button>
        <button onClick={handleSubmit} disabled={submitting || filledRows === 0} className="flex items-center gap-2 bg-teal-600 text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-teal-700 disabled:opacity-60 transition shadow-md shadow-teal-100">
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {submitting ? 'Saving...' : `Park ${filledRows} thought${filledRows !== 1 ? 's' : ''}`}
        </button>
      </div>

      <p className="text-xs text-gray-400 mt-3 text-center">
        Drafts are saved automatically. Listen In uses your microphone. For meeting audio, enable OS audio loopback (Stereo Mix on Windows, BlackHole on Mac) so the mic picks up speaker output.
      </p>
    </div>
  );
}
