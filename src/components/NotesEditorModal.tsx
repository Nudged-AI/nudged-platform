import { useState, useEffect, useRef } from 'react';
import { X, Upload, Sparkles, Plus, Trash2, FileText, Loader2, Check, ChevronDown, ChevronRight, File, ArrowUp, ArrowDown } from 'lucide-react';
import { supabase } from '../supabase';
import { callLLM, parseJSON, stripMarkdown } from '../lib/llm';
import { getCapsuleKnowledge } from '../lib/coach';

function stripHtmlTags(html: string): string {
  return html
    .replace(/<strong[^>]*>/gi, '')
    .replace(/<\/strong>/gi, '')
    .replace(/<b[^>]*>/gi, '')
    .replace(/<\/b>/gi, '')
    .replace(/<i[^>]*>/gi, '')
    .replace(/<\/i>/gi, '')
    .replace(/<em[^>]*>/gi, '')
    .replace(/<\/em>/gi, '')
    .replace(/<ul[^>]*>/gi, '')
    .replace(/<\/ul>/gi, '')
    .replace(/<ol[^>]*>/gi, '')
    .replace(/<\/ol>/gi, '')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
import { RichTextEditor } from './RichTextEditor';
import { extractFileText } from '../lib/pptx-extract';

interface Chapter {
  id?: string;
  title: string;
  chapter_type: 'mandatory' | 'custom';
  position: number;
  content_html: string;
  is_ai_generated: boolean;
}

interface UploadedFile {
  id?: string;
  file_name: string;
  file_type: string;
  extracted_text: string;
}

interface Props {
  sessionId: string;
  capsuleType: 'Training' | 'Coaching';
  capsuleGoal: string;
  capsuleId: string;
  coacheeEmails: string[];
  onClose: () => void;
  onSave?: (notesHtml: string, chapters: Chapter[]) => void;
}

const MANDATORY_CHAPTERS: { title: string }[] = [
  { title: 'Session Goal' },
  { title: 'Challenges to target' },
];

const OPTIONAL_CHAPTERS: { title: string }[] = [
  { title: 'Discovery made during the session' },
  { title: 'Next Steps' },
];

export function NotesEditorModal({ sessionId, capsuleType, capsuleGoal, capsuleId, coacheeEmails, onClose, onSave }: Props) {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [expandedChapters, setExpandedChapters] = useState<Set<number>>(new Set([0]));
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [generating, setGenerating] = useState(false);
  const [genStatus, setGenStatus] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [newChapterName, setNewChapterName] = useState('');
  const [showAddChapter, setShowAddChapter] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [existingNotesHtml, setExistingNotesHtml] = useState('');
  const [generatedSummary, setGeneratedSummary] = useState('');
  const chaptersRef = useRef(chapters); chaptersRef.current = chapters;
  const summaryRef = useRef(generatedSummary); summaryRef.current = generatedSummary;
  const lastSavedRef = useRef('');

  useEffect(() => {
    loadChapters();
    loadFiles();
    loadExistingNotes();
  }, [sessionId]);

  const loadChapters = async () => {
    const { data } = await supabase.from('session_chapters').select('*').eq('session_id', sessionId).order('position');
    const existing = (data as any[]) ?? [];
    if (existing.length > 0) {
      setChapters(existing.map(c => ({
        id: c.id, title: c.title, chapter_type: c.chapter_type,
        position: c.position, content_html: c.content_html ?? '',
        is_ai_generated: c.is_ai_generated ?? false,
      })));
      setExpandedChapters(new Set([0]));
    } else {
      const defaults: Chapter[] = [
        ...MANDATORY_CHAPTERS.map((c, i) => ({ title: c.title, chapter_type: 'mandatory' as const, position: i, content_html: '', is_ai_generated: false })),
        ...OPTIONAL_CHAPTERS.map((c, i) => ({ title: c.title, chapter_type: 'custom' as const, position: MANDATORY_CHAPTERS.length + i, content_html: '', is_ai_generated: false })),
      ];
      setChapters(defaults);
      setExpandedChapters(new Set([0]));
    }
  };

  const loadFiles = async () => {
    const { data } = await supabase.from('session_notes_files').select('*').eq('session_id', sessionId).order('uploaded_at');
    setUploadedFiles((data as any[])?.map(f => ({ id: f.id, file_name: f.file_name, file_type: f.file_type, extracted_text: f.extracted_text })) ?? []);
  };

  const loadExistingNotes = async () => {
    const { data } = await supabase.from('coaching_sessions').select('notes_html, notes_generated_summary').eq('id', sessionId).maybeSingle();
    if (data) {
      setExistingNotesHtml((data as any).notes_html ?? '');
      setGeneratedSummary((data as any).notes_generated_summary ?? '');
    }
  };

  const toggleChapter = (idx: number) => {
    setExpandedChapters(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const updateChapterContent = (idx: number, html: string) => {
    setChapters(prev => prev.map((c, i) => i === idx ? { ...c, content_html: html } : c));
  };

  const addCustomChapter = () => {
    if (!newChapterName.trim()) return;
    setChapters(prev => [...prev, { title: newChapterName.trim(), chapter_type: 'custom', position: prev.length, content_html: '', is_ai_generated: false }]);
    setNewChapterName('');
    setShowAddChapter(false);
  };

  const moveChapter = (idx: number, dir: -1 | 1) => {
    setChapters(prev => {
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next.map((c, i) => ({ ...c, position: i }));
    });
  };

  const removeCustomChapter = (idx: number) => {
    if (chapters[idx].chapter_type === 'mandatory') return;
    setChapters(prev => prev.filter((_, i) => i !== idx));
  };

  const handleFileUpload = async (files: FileList) => {
    setUploading(true);
    setGenStatus('Extracting file content...');
    const fileArr = Array.from(files);
    for (const file of fileArr) {
      const isPdf = file.type === 'application/pdf';
      const isImage = file.type.startsWith('image/');
      const isOffice = file.type.includes('presentation') || file.type.includes('powerpoint') || file.type.includes('officedocument') || file.name.match(/\.(pptx?|docx?|xlsx?)$/i);
      const isAudioVideo = file.type.startsWith('audio/') || file.type.startsWith('video/');
      let extractedText = '';
      try {
        if (isPdf || isImage) {
          extractedText = await extractFileText(file);
        } else if (isOffice || isAudioVideo) {
          extractedText = await extractFileText(file);
        } else {
          extractedText = await file.text();
        }
      } catch {
        extractedText = `[File: ${file.name}]`;
      }
      extractedText = extractedText.slice(0, 15000);

      const { data, error: fileErr } = await supabase.from('session_notes_files').insert({
        session_id: sessionId, file_name: file.name, file_type: file.type,
        extracted_text: extractedText,
      }).select().single();
      if (fileErr) {
        setSaveError('Failed to save file: ' + fileErr.message);
      } else if (data) {
        setUploadedFiles(prev => [...prev, { id: (data as any).id, file_name: file.name, file_type: file.type, extracted_text: extractedText }]);
      }
    }
    setUploading(false);
    setGenStatus('');
  };

  const removeFile = async (fileId: string) => {
    await supabase.from('session_notes_files').delete().eq('id', fileId);
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const generateNotes = async () => {
    setGenerating(true);
    setGenStatus('Gathering context...');
    try {
      const filesText = uploadedFiles.map(f => f.extracted_text).filter(Boolean).join('\n\n').slice(0, 15000);
      const capsuleKnowledge = await getCapsuleKnowledge(capsuleId);

      const emails = coacheeEmails.length > 0 ? coacheeEmails : ['__none__'];
      setGenStatus('Fetching quiz, belief, and metric data...');
      const { data: quizAct } = await supabase.from('cc_activities').select('id').eq('session_id', sessionId).eq('activity_type', 'quiz').maybeSingle();
      const quizActId = (quizAct as any)?.id;
      const quizModQuery = quizActId
        ? supabase.from('quiz_modules').select('title,asked_question_ids').eq('activity_id', quizActId).order('position')
        : Promise.resolve({ data: [] });
      const [{ data: quizMods }, { data: stars }, { data: completions }, { data: prevSessions }] = await Promise.all([
        quizModQuery,
        supabase.from('coach_stars').select('reason,stars,activity_type').eq('session_id', sessionId).in('user_email', emails),
        supabase.from('activity_completions').select('activity_type,notes,learning,completed_date').eq('session_id', sessionId).in('user_email', emails),
        supabase.from('coaching_sessions').select('id,topic,session_number,generated_summary,session_notes,notes_html').neq('id', sessionId).eq('capsule_id', capsuleId).order('session_number').limit(5),
      ]);

      const weakQuizTopics = ((quizMods as any[]) ?? []).map(m => m.title).join(', ') || 'No quiz data';
      const beliefsCaptured = ((stars as any[]) ?? []).filter(s => s.activity_type === 'talk').map(s => s.reason).join('; ') || 'No beliefs captured yet';
      const taskCompletion = ((completions as any[]) ?? []).filter(c => c.activity_type === 'tasks').map(c => c.notes).join('; ') || 'No task data';

      setGenStatus('Fetching thought patterns and power-to-goal metrics...');
      const { data: talkSessions } = await supabase.from('talk_sessions').select('id').eq('session_id', sessionId).in('user_email', emails);
      const talkSessionIds = ((talkSessions as any[]) ?? []).map(t => t.id);
      const [{ data: p2g }, { data: talkMsgs }] = await Promise.all([
        supabase.from('power_to_goal').select('activity_type,raw_text,created_at').eq('session_id', sessionId).in('user_email', emails).order('created_at', { ascending: false }).limit(20),
        talkSessionIds.length > 0
          ? supabase.from('talk_messages').select('role,content,created_at').in('talk_session_id', talkSessionIds).order('created_at').limit(30)
          : Promise.resolve({ data: [] }),
      ]);
      const p2gText = ((p2g as any[]) ?? []).map(p => `[${p.activity_type}] ${p.raw_text}`).join('\n') || 'No power-to-goal data';
      const talkText = ((talkMsgs as any[]) ?? []).filter(m => m.role === 'user').map(m => m.content).join(' ') || 'No talk data';
      const prevContext = ((prevSessions as any[]) ?? []).map(s => {
        const sn = Array.isArray(s.session_notes) ? (s.session_notes as any[])?.map((n: any) => typeof n === 'string' ? n : n?.notes || '').join('; ') : '';
        return `Session ${s.session_number}: ${s.topic} - Summary: ${s.generated_summary ?? ''}. Notes: ${sn}. Notes HTML: ${(s.notes_html ?? '').slice(0, 2000)}`;
      }).join('\n') || 'No previous sessions';

      setGenStatus('Fetching beliefs, insights, and prior session activities...');
      const prevSessionIds = ((prevSessions as any[]) ?? []).map(s => s.id);

      const [{ data: beliefs }, { data: insights }, { data: prevFiles }, { data: prevCompletions }, { data: prevP2G }] = await Promise.all([
        supabase.from('coach_beliefs_analysis').select('coachee_email,beliefs_json,created_at').eq('session_id', sessionId).in('coachee_email', emails),
        supabase.from('coach_insights_cache').select('activity_type,coachee_email,insights_text').eq('session_id', sessionId).in('coachee_email', emails).order('generated_at', { ascending: false }).limit(10),
        prevSessionIds.length > 0
          ? supabase.from('session_notes_files').select('file_name,extracted_text,session_id').in('session_id', prevSessionIds)
          : Promise.resolve({ data: [] }),
        prevSessionIds.length > 0
          ? supabase.from('activity_completions').select('session_id,activity_type,notes,learning,completed_date').in('session_id', prevSessionIds).in('user_email', emails)
          : Promise.resolve({ data: [] }),
        prevSessionIds.length > 0
          ? supabase.from('power_to_goal').select('session_id,activity_type,raw_text,created_at').in('session_id', prevSessionIds).in('user_email', emails).order('created_at', { ascending: false }).limit(30)
          : Promise.resolve({ data: [] }),
      ]);

      const beliefsText = ((beliefs as any[]) ?? []).map(b => {
        const bj = typeof b.beliefs_json === 'string' ? JSON.parse(b.beliefs_json) : b.beliefs_json;
        const topBeliefs = Array.isArray(bj) ? bj.slice(0, 5).map((bl: any) => bl.belief || bl.text || JSON.stringify(bl)).join('; ') : JSON.stringify(bj);
        return `[${b.coachee_email}] Top beliefs: ${topBeliefs}`;
      }).join('\n') || 'No belief analysis available';

      const insightsText = ((insights as any[]) ?? []).map(i => `[${i.coachee_email} | ${i.activity_type}] ${i.insights_text}`).join('\n') || 'No coach insights available';

      const prevFilesText = ((prevFiles as any[]) ?? []).map(f => `[${f.file_name}] ${f.extracted_text?.slice(0, 2000) ?? ''}`).join('\n') || 'No prior session files';

      const prevActivitiesBySession: Record<string, string[]> = {};
      for (const c of ((prevCompletions as any[]) ?? [])) {
        const key = c.session_id;
        if (!prevActivitiesBySession[key]) prevActivitiesBySession[key] = [];
        prevActivitiesBySession[key].push(`${c.activity_type}: ${c.notes || ''} ${c.learning ? `| Learning: ${c.learning}` : ''}`);
      }
      const prevP2GBySession: Record<string, string[]> = {};
      for (const p of ((prevP2G as any[]) ?? [])) {
        const key = p.session_id;
        if (!prevP2GBySession[key]) prevP2GBySession[key] = [];
        prevP2GBySession[key].push(`[${p.activity_type}] ${p.raw_text}`);
      }
      const prevSessionActivities = ((prevSessions as any[]) ?? []).map(s => {
        const acts = prevActivitiesBySession[s.id]?.join('; ') ?? 'No activity completions';
        const p2g = prevP2GBySession[s.id]?.join('; ') ?? 'No power-to-goal data';
        return `Session ${s.session_number} (${s.topic}): Activities: ${acts}. P2G: ${p2g}`;
      }).join('\n') || 'No previous session activities';

      setGenStatus('Generating session notes with AI...');
      const res = await callLLM('coach_session_notes_gen', {
        capsule_type: capsuleType,
        capsule_goal: capsuleGoal || 'Not specified',
        session_files: filesText || 'No files uploaded',
        capsule_knowledge: capsuleKnowledge.slice(0, 12000),
        weak_quiz_topics: weakQuizTopics,
        beliefs_captured: beliefsCaptured,
        task_completion: taskCompletion,
        previous_sessions_context: prevContext,
        existing_notes: existingNotesHtml ? stripMarkdown(existingNotesHtml).slice(0, 5000) : '',
        coachee_emails: coacheeEmails.join(', '),
        power_to_goal: p2gText,
        talk_conversations: talkText,
        top_beliefs: beliefsText,
        coach_insights: insightsText,
        previous_session_activities: prevSessionActivities,
        previous_session_files: prevFilesText,
      });

      const parsed = parseJSON<any>(res);
      if (parsed) {
        const newChapters = chapters.map(c => ({ ...c }));
        if (parsed.session_goal) {
          const idx = newChapters.findIndex(c => c.title === 'Session Goal');
          if (idx >= 0) newChapters[idx] = { ...newChapters[idx], content_html: parsed.session_goal, is_ai_generated: true };
        }
        if (parsed.challenges_to_target) {
          const idx = newChapters.findIndex(c => c.title === 'Challenges to target');
          if (idx >= 0) newChapters[idx] = { ...newChapters[idx], content_html: parsed.challenges_to_target, is_ai_generated: true };
        }
        const summaryText = stripHtmlTags(parsed.summary || '');
        setGeneratedSummary(summaryText);
        setChapters(newChapters);
        setExpandedChapters(new Set([0, 1]));
        setGenStatus('Notes generated successfully.');
      } else {
        setGenStatus('Generated raw text. Review and paste into chapters manually.');
      }
    } catch (e: any) {
      setGenStatus('Error: ' + e.message);
    }
    setGenerating(false);
  };

  const doSave = async (): Promise<boolean> => {
    const current = chaptersRef.current;
    const snapshot = JSON.stringify({ c: current, s: summaryRef.current });
    if (snapshot === lastSavedRef.current) return true;
    setSaving(true);
    try {
      const reordered = current.map((c, i) => ({ ...c, position: i }));
      const notesHtml = reordered.map(c => `<h3>${c.title}</h3>${c.content_html}`).join('\n');
      const { error: notesErr } = await supabase.from('coaching_sessions').update({
        notes_html: notesHtml, notes_generated_summary: summaryRef.current,
        updated_at: new Date().toISOString(),
      }).eq('id', sessionId);
      if (notesErr) { setSaveError('Failed to save notes: ' + notesErr.message); return false; }
      const { data: existingChs, error: chSelErr } = await supabase.from('session_chapters').select('id').eq('session_id', sessionId);
      if (chSelErr) { setSaveError('Failed to load chapters: ' + chSelErr.message); return false; }
      const existingIds = new Set(((existingChs as any[]) ?? []).map(c => c.id));
      for (const ch of reordered) {
        if (ch.id && existingIds.has(ch.id)) {
          const { error: upErr } = await supabase.from('session_chapters').update({
            content_html: ch.content_html, is_ai_generated: ch.is_ai_generated, position: ch.position, title: ch.title,
          }).eq('id', ch.id);
          if (upErr) { setSaveError('Failed to update chapter: ' + upErr.message); return false; }
          existingIds.delete(ch.id);
        } else {
          const { data: inserted, error: insErr } = await supabase.from('session_chapters').insert({
            session_id: sessionId, title: ch.title, chapter_type: ch.chapter_type,
            position: ch.position, content_html: ch.content_html, is_ai_generated: ch.is_ai_generated,
          }).select().single();
          if (insErr) { setSaveError('Failed to insert chapter: ' + insErr.message); return false; }
          if (inserted) ch.id = (inserted as any).id;
        }
      }
      for (const oldId of existingIds) {
        await supabase.from('session_chapters').delete().eq('id', oldId);
      }
      setChapters(reordered);
      lastSavedRef.current = snapshot;
      setSaveError('');
      onSave?.(notesHtml, reordered);
      return true;
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => doSave(), 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <p className="text-sm font-bold text-gray-800">Session Notes Editor</p>
          <span className={`text-xs px-2 py-0.5 rounded-full ${capsuleType === 'Training' ? 'bg-sky-50 text-sky-700' : 'bg-teal-50 text-teal-700'}`}>{capsuleType}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => doSave()} disabled={saving} className="flex items-center gap-1 text-xs text-white bg-teal-600 hover:bg-teal-700 px-4 py-2 rounded-lg disabled:opacity-60">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save
          </button>
          <button onClick={async () => { await doSave(); onClose(); }} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
      </div>
      {saveError && <div className="px-5 py-1.5 bg-red-50 border-b border-red-100 text-xs text-red-600">{saveError}</div>}

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-5 py-4 space-y-4">
          {/* File upload section */}
          <div className="bg-gradient-to-br from-sky-50 to-teal-50 rounded-xl p-4 border border-sky-100">
            <p className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1.5"><FileText className="w-4 h-4 text-teal-600" /> Upload session files (PDF, DOC, PPT, Audio)</p>
            <p className="text-xs text-gray-500 mb-2">Upload multiple files at any time. AI will use these to generate session notes.</p>
            <div className="flex items-center gap-2">
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => e.target.files?.length && handleFileUpload(e.target.files)} />
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="flex items-center gap-1.5 text-xs text-teal-700 border border-teal-200 bg-white rounded-lg px-3 py-2 cursor-pointer hover:bg-teal-50 disabled:opacity-60">
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Choose files
              </button>
              <button onClick={generateNotes} disabled={generating || uploading} className="flex items-center gap-1.5 text-xs text-white bg-teal-600 hover:bg-teal-700 rounded-lg px-3 py-2 disabled:opacity-60">
                {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Generate with AI
              </button>
            </div>
            {uploadedFiles.length > 0 && (
              <div className="mt-2 space-y-1">
                {uploadedFiles.map(f => (
                  <div key={f.id} className="flex items-center gap-2 text-xs text-gray-600 bg-white rounded-lg px-2 py-1.5">
                    <File className="w-3 h-3 text-teal-500" />
                    <span className="flex-1 truncate">{f.file_name}</span>
                    <button onClick={() => removeFile(f.id!)} className="text-red-500 p-0.5"><Trash2 className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            )}
            {genStatus && <p className="text-xs text-gray-600 mt-2 flex items-center gap-1">{generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3 text-emerald-600" />} {genStatus}</p>}
          </div>

          {/* AI Summary section */}
          {generatedSummary && (
            <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
              <p className="text-xs font-bold text-amber-800 mb-1">AI Summary (auto-generated)</p>
              <p className="text-xs text-gray-700 whitespace-pre-wrap">{generatedSummary}</p>
            </div>
          )}

          {/* Chapters */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-gray-700">Chapters</p>
              <button onClick={() => setShowAddChapter(!showAddChapter)} className="text-xs text-teal-600 flex items-center gap-1"><Plus className="w-3 h-3" /> Add chapter</button>
            </div>
            {showAddChapter && (
              <div className="flex items-center gap-2 mb-2">
                <input value={newChapterName} onChange={e => setNewChapterName(e.target.value)} placeholder="Chapter name" onKeyDown={e => e.key === 'Enter' && addCustomChapter()} className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg" />
                <button onClick={addCustomChapter} className="text-xs text-white bg-teal-600 px-3 py-1.5 rounded-lg">Add</button>
              </div>
            )}
            {chapters.map((ch, idx) => (
              <div key={idx} className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 cursor-pointer" onClick={() => toggleChapter(idx)}>
                  {expandedChapters.has(idx) ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                  <span className="text-sm font-semibold text-gray-800 flex-1">{ch.title}</span>
                  {ch.chapter_type === 'mandatory' && <span className="text-xs text-red-500 font-medium">Required</span>}
                  {ch.is_ai_generated && <span className="text-xs text-teal-600 flex items-center gap-0.5"><Sparkles className="w-3 h-3" /> AI</span>}
                  {ch.chapter_type === 'custom' && <button onClick={e => { e.stopPropagation(); removeCustomChapter(idx); }} className="text-red-500 p-0.5"><Trash2 className="w-3 h-3" /></button>}
                  <button onClick={e => { e.stopPropagation(); moveChapter(idx, -1); }} disabled={idx === 0} className="text-gray-400 p-0.5 disabled:opacity-30"><ArrowUp className="w-3 h-3" /></button>
                  <button onClick={e => { e.stopPropagation(); moveChapter(idx, 1); }} disabled={idx === chapters.length - 1} className="text-gray-400 p-0.5 disabled:opacity-30"><ArrowDown className="w-3 h-3" /></button>
                </div>
                {expandedChapters.has(idx) && (
                  <div className="p-3">
                    <RichTextEditor
                      value={ch.content_html}
                      onChange={html => updateChapterContent(idx, html)}
                      placeholder={`Write ${ch.title.toLowerCase()} here...`}
                      minHeight="200px"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
