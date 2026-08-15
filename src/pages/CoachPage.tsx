import { useEffect, useState, useRef } from 'react';
import { GraduationCap, Loader2, Plus, Users, Layers, BookOpen, Check, X, Pencil, Trash2, Copy, Lock, Globe, Power, PowerOff, Send, Sparkles, Star, Info, Search, Tag, Clock, Upload, FileText, Video, Wand2, Eye, MessageSquare, CheckSquare, HelpCircle, Youtube, ChevronLeft, Brain, Trophy, Zap, BarChart3, Calendar, Download, UserPlus } from 'lucide-react';
import { supabase } from '../supabase';
import type { User } from '@supabase/supabase-js';
import { callLLM, parseJSON, stripMarkdown } from '../lib/llm';
import SessionDashboard from '../components/SessionDashboard';
import { fetchSessionInputs, analyzeSessionThoughts, saveAnalysis, loadAnalysis, type ThoughtAnalysis } from '../lib/thought-agent';
import { extractFileText } from '../lib/pptx-extract';
import { NotesEditorModal } from '../components/NotesEditorModal';
import KnowYourCoachee from '../components/KnowYourCoachee';
import Bookings from '../components/Bookings';
import {
  getCoachForEmail, buildSessionUid, formatDate, STOCK_IMAGES,
  getCapsuleKnowledge, getPreviousSessionsContext,
  type Coach, type Coachee, type Capsule, type CoachingSession,
  PROFESSION_OPTIONS, EMOTION_TAGS, PRACTICE_COMFORT, SUB_MODALITIES,
} from '../lib/coach';

interface Props { user: User; }

type SubTab = 'coachees' | 'capsules' | 'bookings' | 'dashboard';

function toLocalDT(iso: string): string {
  // Convert a UTC ISO string to a datetime-local string in IST (Asia/Kolkata, UTC+5:30)
  // Uses Intl to avoid any browser-local-zone interference
  const d = new Date(iso);
  const istParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d);
  const get = (t: string) => istParts.find(p => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

// Convert a datetime-local string (interpreted as IST) to a UTC ISO string for storage
function istLocalToISO(dtLocal: string): string {
  // dtLocal is "YYYY-MM-DDTHH:MM" in IST. Append +05:30 offset and convert to UTC.
  return new Date(dtLocal + '+05:30').toISOString();
}

export default function CoachPage({ user }: Props) {
  const [coach, setCoach] = useState<Coach | null>(null);
  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState<SubTab>('coachees');

  useEffect(() => {
    (async () => {
      const email = user.email ?? '';
      let c = await getCoachForEmail(email);
      if (c && !c.user_id) {
        const { data: upd } = await supabase.from('coaches').update({ user_id: user.id }).eq('id', c.id).select('*').maybeSingle();
        if (upd) c = upd as Coach;
      }
      setCoach(c);
      setLoading(false);
    })();
  }, [user.id, user.email]);

  const [editSession, setEditSession] = useState<{ session: CoachingSession; capsule: Capsule } | null>(null);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-teal-500 animate-spin" /></div>;
  if (!coach) return (
    <div className="max-w-2xl mx-auto py-16 px-4 text-center">
      <GraduationCap className="w-10 h-10 text-gray-300 mx-auto mb-3" />
      <p className="text-sm text-gray-500">You are not registered as a coach. Please contact the admin.</p>
    </div>
  );

  const openSessionEditor = async (sessionId: string | null, bookingId?: string) => {
    let resolvedSessionId = sessionId;
    // If no session_id, try to create one from the booking
    if (!resolvedSessionId && bookingId) {
      const { data: newSessId } = await supabase.rpc('ensure_session_for_booking', { p_booking_id: bookingId });
      resolvedSessionId = (newSessId as string) ?? null;
    }
    if (!resolvedSessionId) { alert('Unable to find or create a session for this booking.'); return; }
    const { data: sess } = await supabase.from('coaching_sessions').select('*').eq('id', resolvedSessionId).maybeSingle();
    if (!sess) { alert('Session not found.'); return; }
    const { data: cap } = await supabase.from('capsules').select('*').eq('id', (sess as any).capsule_id).maybeSingle();
    if (!cap) { alert('Capsule not found.'); return; }
    setEditSession({ session: sess as CoachingSession, capsule: cap as Capsule });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 pb-24">
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <GraduationCap className="w-5 h-5 text-teal-600" />
          <h1 className="text-xl font-black text-gray-900 tracking-tight">Coach</h1>
        </div>
        <p className="text-xs text-gray-500">Welcome, {coach.coach_name}. Manage your coachees, capsules, and sessions.</p>
      </div>

      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
        {([['coachees', 'Coachees', Users], ['capsules', 'Capsules', Layers], ['bookings', 'Bookings', Calendar], ['dashboard', 'Dashboard', Star]] as const).map(([k, label, Icon]) => (
          <button key={k} onClick={() => setSub(k)}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition ${sub === k ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-500'}`}>
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {sub === 'coachees' && <CoacheeOnboarding coach={coach} />}
      {sub === 'capsules' && <CapsuleMaster coach={coach} coachEmail={user.email ?? ''} />}
      {sub === 'bookings' && <Bookings coach={coach} coachEmail={user.email ?? ''} onEditSession={openSessionEditor} />}
      {sub === 'dashboard' && <CoachDashboard coach={coach} />}

      {editSession && (
        <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
          <div className="max-w-4xl mx-auto px-5 py-6">
            <SessionEditor coach={coach} capsule={editSession.capsule} session={editSession.session} onClose={() => { setEditSession(null); }} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ============ Coachee Onboarding ============ */

function CoacheeOnboarding({ coach }: { coach: Coach }) {
  const [coachees, setCoachees] = useState<Coachee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Coachee | null>(null);
  const [form, setForm] = useState<any>({});
  const [goals, setGoals] = useState<any[]>([{ goal_text: '', target_date: '', past_actions: '', consequence: '', success_metrics: [], challenges: [], emotional_blockers: [] }]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('coachees').select('*').eq('coach_id', coach.id).order('created_at', { ascending: false });
    setCoachees((data as Coachee[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [coach.id]);

  const startNew = () => {
    setEditing(null);
    setForm({ email: '', client_name: '', whatsapp_number: '', date_of_birth: '', gender: '', profession: '', profession_details: '', marital_status: '', children: 0, default_emotion_tags: [], preferred_checkin_time: 'Morning', practice_comfort: [], privacy_preference: 'Private', sub_modality: '', reasons_for_seeking: '', primary_goal: '', main_blocker: '', target_timeline: '', preferred_language: '', reminder_style: '', package: '', session_frequency: '', preferred_start_date: '' });
    setGoals([{ goal_text: '', target_date: '', past_actions: '', consequence: '', success_metrics: [], challenges: [], emotional_blockers: [] }]);
    setShowForm(true);
  };

  const startEdit = async (c: Coachee) => {
    setEditing(c);
    setForm({ ...c, date_of_birth: c.date_of_birth ?? '' });
    const { data: gs } = await supabase.from('coach_goals').select('*').eq('coachee_id', c.id).order('created_at');
    setGoals((gs as any[]) ?? [{ goal_text: '', target_date: '', past_actions: '', consequence: '', success_metrics: [], challenges: [], emotional_blockers: [] }]);
    setShowForm(true);
  };

  const save = async () => {
    setSaving(true);
    let coacheeId = editing?.id;
    if (editing) {
      await supabase.from('coachees').update({
        email: form.email, client_name: form.client_name, whatsapp_number: form.whatsapp_number || null,
        date_of_birth: form.date_of_birth || null, gender: form.gender || null, profession: form.profession || null,
        profession_details: form.profession_details || null, marital_status: form.marital_status || null,
        children: Number(form.children) || 0, default_emotion_tags: form.default_emotion_tags,
        preferred_checkin_time: form.preferred_checkin_time, practice_comfort: form.practice_comfort,
        privacy_preference: form.privacy_preference, sub_modality: form.sub_modality || null,
        reasons_for_seeking: form.reasons_for_seeking || null, primary_goal: form.primary_goal || null,
        main_blocker: form.main_blocker || null, target_timeline: form.target_timeline || null,
        preferred_language: form.preferred_language || null, reminder_style: form.reminder_style || null,
        package: form.package || null, session_frequency: form.session_frequency || null,
        preferred_start_date: form.preferred_start_date || null,
        updated_at: new Date().toISOString(),
      }).eq('id', editing.id);
    } else {
      const { data, error } = await supabase.from('coachees').insert({
        coach_id: coach.id, email: form.email, client_name: form.client_name, whatsapp_number: form.whatsapp_number || null,
        date_of_birth: form.date_of_birth || null, gender: form.gender || null, profession: form.profession || null,
        profession_details: form.profession_details || null, marital_status: form.marital_status || null,
        children: Number(form.children) || 0, default_emotion_tags: form.default_emotion_tags,
        preferred_checkin_time: form.preferred_checkin_time, practice_comfort: form.practice_comfort,
        privacy_preference: form.privacy_preference, sub_modality: form.sub_modality || null,
        reasons_for_seeking: form.reasons_for_seeking || null, primary_goal: form.primary_goal || null,
        main_blocker: form.main_blocker || null, target_timeline: form.target_timeline || null,
        preferred_language: form.preferred_language || null, reminder_style: form.reminder_style || null,
        package: form.package || null, session_frequency: form.session_frequency || null,
        preferred_start_date: form.preferred_start_date || null,
      }).select().single();
      if (error) { alert(error.message); setSaving(false); return; }
      coacheeId = (data as any).id;
    }
    // Save goals
    if (coacheeId) {
      await supabase.from('coach_goals').delete().eq('coachee_id', coacheeId);
      const validGoals = goals.filter(g => g.goal_text.trim());
      for (const g of validGoals) {
        await supabase.from('coach_goals').insert({
          coachee_id: coacheeId, goal_text: g.goal_text, target_date: g.target_date || null,
          past_actions: g.past_actions || null, consequence: g.consequence || null,
          success_metrics: g.success_metrics, challenges: g.challenges, emotional_blockers: g.emotional_blockers,
        });
      }
    }
    setSaving(false);
    setShowForm(false);
    load();
  };

  const remove = async (c: Coachee) => {
    if (!confirm(`Remove coachee ${c.client_name}?`)) return;
    await supabase.from('coachees').delete().eq('id', c.id);
    load();
  };

  const toggleArr = (key: string, val: string) => setForm((f: any) => ({ ...f, [key]: Array.isArray(f[key]) ? (f[key].includes(val) ? f[key].filter((v: string) => v !== val) : [...f[key], val]) : [val] }));

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 text-teal-500 animate-spin" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold text-gray-800">Coachee Onboarding</p>
        <button onClick={startNew} className="flex items-center gap-1 text-xs text-white bg-teal-600 hover:bg-teal-700 px-3 py-1.5 rounded-lg transition">
          <Plus className="w-3.5 h-3.5" /> Add Coachee
        </button>
      </div>

      {!showForm && coachees.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No coachees yet. Add your first coachee to get started.</p>
        </div>
      ) : !showForm ? (
        <div className="space-y-2">
          {coachees.map(c => (
            <div key={c.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-teal-50 flex items-center justify-center"><Users className="w-4 h-4 text-teal-600" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">{c.client_name}</p>
                <p className="text-xs text-gray-500 truncate">{c.email}{c.sub_modality ? ` · ${c.sub_modality}` : ''}</p>
              </div>
              <button onClick={() => startEdit(c)} className="p-1.5 rounded-lg hover:bg-gray-100"><Pencil className="w-3.5 h-3.5 text-gray-500" /></button>
              <button onClick={() => remove(c)} className="p-1.5 rounded-lg hover:bg-red-50"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-bold text-gray-800">{editing ? 'Edit Coachee' : 'New Coachee'}</p>
            <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-4 h-4 text-gray-500" /></button>
          </div>
          <div className="px-5 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
            {/* Personal */}
            <p className="text-xs font-bold text-teal-700 uppercase tracking-wide">Personal Section</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input label="Client name" value={form.client_name} onChange={(v) => setForm((f: any) => ({ ...f, client_name: v }))} />
              <Input label="Registered gmail id" value={form.email} onChange={(v) => setForm((f: any) => ({ ...f, email: v }))} />
              <Input label="WhatsApp number" value={form.whatsapp_number} onChange={(v) => setForm((f: any) => ({ ...f, whatsapp_number: v }))} />
              <Input label="Date of birth" type="date" value={form.date_of_birth} onChange={(v) => setForm((f: any) => ({ ...f, date_of_birth: v }))} />
              <Select label="Gender" value={form.gender} onChange={(v) => setForm((f: any) => ({ ...f, gender: v }))} options={['', 'Male', 'Female', 'Non-binary', 'Prefer not to say']} />
              <Select label="Profession" value={form.profession} onChange={(v) => setForm((f: any) => ({ ...f, profession: v }))} options={['', ...PROFESSION_OPTIONS]} />
              <Input label="Profession details" value={form.profession_details} onChange={(v) => setForm((f: any) => ({ ...f, profession_details: v }))} />
              <Select label="Marital status" value={form.marital_status} onChange={(v) => setForm((f: any) => ({ ...f, marital_status: v }))} options={['', 'Single', 'Married', 'Divorced', 'Widowed']} />
              <Input label="Children" type="number" value={String(form.children ?? 0)} onChange={(v) => setForm((f: any) => ({ ...f, children: v }))} />
            </div>

            {/* Preferences */}
            <p className="text-xs font-bold text-teal-700 uppercase tracking-wide pt-2">Preferences</p>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Default emotion state</label>
              <div className="flex flex-wrap gap-1.5">
                {EMOTION_TAGS.map(t => (
                  <button key={t} onClick={() => toggleArr('default_emotion_tags', t)}
                    className={`text-xs px-2 py-1 rounded-full border ${form.default_emotion_tags?.includes(t) ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-200'}`}>{t}</button>
                ))}
              </div>
            </div>
            <Select label="Preferred check-in time" value={form.preferred_checkin_time} onChange={(v) => setForm((f: any) => ({ ...f, preferred_checkin_time: v }))} options={['Morning', 'Evening', 'Custom']} />
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Practice comfort</label>
              <div className="flex flex-wrap gap-1.5">
                {PRACTICE_COMFORT.map(t => (
                  <button key={t} onClick={() => toggleArr('practice_comfort', t)}
                    className={`text-xs px-2 py-1 rounded-full border ${form.practice_comfort?.includes(t) ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-200'}`}>{t}</button>
                ))}
              </div>
            </div>
            <Select label="Privacy preference" value={form.privacy_preference} onChange={(v) => setForm((f: any) => ({ ...f, privacy_preference: v }))} options={['Private', 'Share summary', 'Share full']} />
            <Select label="Sub modality" value={form.sub_modality} onChange={(v) => setForm((f: any) => ({ ...f, sub_modality: v }))} options={['', ...SUB_MODALITIES]} />

            {/* Coaching Details */}
            <p className="text-xs font-bold text-teal-700 uppercase tracking-wide pt-2">Coaching Details</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input label="Reasons for seeking coaching" value={form.reasons_for_seeking ?? ''} onChange={(v) => setForm((f: any) => ({ ...f, reasons_for_seeking: v }))} />
              <Input label="Primary goal" value={form.primary_goal ?? ''} onChange={(v) => setForm((f: any) => ({ ...f, primary_goal: v }))} />
              <Input label="Main blocker" value={form.main_blocker ?? ''} onChange={(v) => setForm((f: any) => ({ ...f, main_blocker: v }))} />
              <Input label="Target timeline" value={form.target_timeline ?? ''} onChange={(v) => setForm((f: any) => ({ ...f, target_timeline: v }))} />
              <Input label="Preferred language" value={form.preferred_language ?? ''} onChange={(v) => setForm((f: any) => ({ ...f, preferred_language: v }))} />
              <Input label="Reminder style" value={form.reminder_style ?? ''} onChange={(v) => setForm((f: any) => ({ ...f, reminder_style: v }))} />
            </div>

            {/* Engagement Details */}
            <p className="text-xs font-bold text-teal-700 uppercase tracking-wide pt-2">Engagement Details</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input label="Package" value={form.package ?? ''} onChange={(v) => setForm((f: any) => ({ ...f, package: v }))} />
              <Input label="Session frequency" value={form.session_frequency ?? ''} onChange={(v) => setForm((f: any) => ({ ...f, session_frequency: v }))} />
              <Input label="Preferred start date" type="date" value={form.preferred_start_date ?? ''} onChange={(v) => setForm((f: any) => ({ ...f, preferred_start_date: v }))} />
            </div>
          </div>
          <div className="px-5 py-2 border-t border-gray-100">
            <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
              <Lock className="w-3 h-3" />
              <span>All personal data is protected with AES-256 encryption</span>
            </div>
          </div>
          <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="text-xs text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-100">Cancel</button>
            <button onClick={save} disabled={saving} className="flex items-center gap-1 text-xs text-white bg-teal-600 hover:bg-teal-700 px-4 py-2 rounded-lg transition disabled:opacity-60">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============ Capsule Master ============ */

function CapsuleMaster({ coach, coachEmail }: { coach: Coach; coachEmail: string }) {
  const [capsules, setCapsules] = useState<Capsule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Capsule | null>(null);
  const [form, setForm] = useState<any>({});
  const [openCapsule, setOpenCapsule] = useState<Capsule | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchType, setSearchType] = useState('all');
  const [searchStatus, setSearchStatus] = useState('all');
  const [searchDate, setSearchDate] = useState('');

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('capsules').select('*').eq('coach_id', coach.id).order('created_at', { ascending: false });
    setCapsules((data as Capsule[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [coach.id]);

  const startNew = () => { setEditing(null); setForm({ name: '', description: '', capsule_type: 'Coaching', is_public: false, is_active: true, passkey: '', capsule_goals: [], nominatedCoachees: [], capsule_goal: '', package_offered: '', remarks: '' }); setShowForm(true); loadCoacheesForCapsule(); };
  const startEdit = (c: Capsule) => { setEditing(c); setForm({ ...c, passkey: c.passkey ?? '', capsule_goals: c.capsule_goals ?? [], nominatedCoachees: [], capsule_goal: (c as any).capsule_goal ?? '', package_offered: (c as any).package_offered ?? '', remarks: (c as any).remarks ?? '' }); setShowForm(true); loadCoacheesForCapsule(c.id); };

  const [capsuleCoachees, setCapsuleCoachees] = useState<Coachee[]>([]);
  const loadCoacheesForCapsule = async (cid?: string) => {
    const { data: cs } = await supabase.from('coachees').select('id,email,client_name').eq('coach_id', coach.id).order('client_name');
    setCapsuleCoachees((cs as Coachee[]) ?? []);
    if (cid) {
      const { data: existing } = await supabase.from('capsule_enrollments').select('coachee_email').eq('capsule_id', cid);
      const enrolled = ((existing as any[]) ?? []).map(e => e.coachee_email);
      setForm((f: any) => ({ ...f, nominatedCoachees: enrolled }));
    }
  };

  const [goalValidated, setGoalValidated] = useState(false);
  const [goalValidating, setGoalValidating] = useState(false);
  const [goalFeedback, setGoalFeedback] = useState('');
  const [goalSuggestions, setGoalSuggestions] = useState<string[]>([]);

  const validateGoal = async () => {
    if (!form.capsule_goal?.trim()) { alert('Please enter a capsule goal first.'); return; }
    setGoalValidating(true); setGoalFeedback(''); setGoalSuggestions([]);
    try {
      const res = await callLLM('custom_prompt', { prompt: `You are a coaching goal validator. Analyze this capsule goal and determine if it is quantifiable and measurable.\n\nGoal: "${form.capsule_goal}"\n\nRespond with ONLY valid JSON: {"is_valid": true/false, "feedback": "Brief explanation.", "suggestions": ["If not valid, provide 3 alternative reframed goals that are quantifiable and measurable. If valid, return empty array."]}` });
      const parsed = parseJSON<{ is_valid: boolean; feedback: string; suggestions?: string[] }>(res);
      if (parsed) {
        setGoalValidated(parsed.is_valid);
        setGoalFeedback(parsed.feedback);
        setGoalSuggestions(parsed.suggestions ?? []);
      } else { setGoalFeedback('Could not validate. Please try again.'); }
    } catch (e: any) { setGoalFeedback('Validation failed: ' + e.message); }
    setGoalValidating(false);
  };

  const acceptSuggestion = (suggestion: string) => {
    setForm((f: any) => ({ ...f, capsule_goal: suggestion }));
    setGoalValidated(true);
    setGoalFeedback('Goal updated to suggested quantifiable version.');
    setGoalSuggestions([]);
  };

  const save = async () => {
    if (!form.name?.trim()) { alert('Capsule name is required.'); return; }
    if (form.capsule_type === 'Coaching' && (!form.nominatedCoachees || form.nominatedCoachees.length === 0)) { alert('Coachee nomination is mandatory for Coaching capsules.'); return; }
    if (form.capsule_type === 'Coaching' && form.nominatedCoachees.length > 1) { alert('Only one coachee can be nominated for Coaching capsules.'); return; }
    if (form.is_public && !form.passkey?.trim()) { alert('Passkey is required when capsule is public.'); return; }
    if (form.capsule_type === 'Coaching' && !form.capsule_goal?.trim()) { alert('Capsule goal is mandatory for Coaching capsules.'); return; }
    if (form.capsule_type === 'Coaching' && !goalValidated) { alert('Please validate the capsule goal first. Click "Validate Goal" to check if it is quantifiable and measurable.'); return; }
    const isCoaching = form.capsule_type === 'Coaching';
    const payload = { name: form.name, description: form.description, capsule_type: form.capsule_type, is_public: isCoaching ? false : form.is_public, is_active: form.is_active, passkey: form.is_public && !isCoaching ? form.passkey?.trim() || null : null, capsule_goals: isCoaching ? (form.capsule_goals ?? []) : [], capsule_goal: isCoaching ? form.capsule_goal : null, package_offered: form.package_offered || null, remarks: form.remarks || null, updated_at: new Date().toISOString() };
    let capsuleId = editing?.id;
    if (editing) {
      await supabase.from('capsules').update(payload).eq('id', editing.id);
    } else {
      const { data, error } = await supabase.from('capsules').insert({ coach_id: coach.id, ...payload }).select().single();
      if (error) { alert('Failed to save capsule: ' + error.message); return; }
      capsuleId = (data as any)?.id;
    }
    if (capsuleId) {
      await supabase.from('capsule_enrollments').delete().eq('capsule_id', capsuleId);
      if (form.nominatedCoachees?.length) {
        await supabase.from('capsule_enrollments').insert(form.nominatedCoachees.map((e: string) => ({ capsule_id: capsuleId, coachee_email: e })));
      }
      if (!editing) {
        setForm((f: any) => ({ ...f, id: capsuleId }));
        setEditing({ id: capsuleId } as any);
        load();
        return;
      }
    }
    setShowForm(false);
    load();
  };

  const togglePublic = async (c: Capsule) => { if (c.capsule_type === 'Coaching') { alert('Coaching capsules cannot be made public.'); return; } await supabase.from('capsules').update({ is_public: !c.is_public, updated_at: new Date().toISOString() }).eq('id', c.id); load(); };
  const toggleActive = async (c: Capsule) => { await supabase.from('capsules').update({ is_active: !c.is_active, updated_at: new Date().toISOString() }).eq('id', c.id); load(); };
  const remove = async (c: Capsule) => { if (!confirm(`Delete capsule ${c.name}?`)) return; await supabase.from('capsules').delete().eq('id', c.id); load(); };

  const [copying, setCopying] = useState(false);
  const copyCapsule = async (c: Capsule) => {
    const newName = prompt('Enter name for copied capsule:', `${c.name} (Copy)`);
    if (!newName?.trim()) return;
    setCopying(true);
    try {
      // 1. Create new capsule
      const { data: newCap, error: capErr } = await supabase.from('capsules').insert({
        coach_id: coach.id, name: newName.trim(), description: c.description, capsule_type: c.capsule_type,
        is_public: false, is_active: true, passkey: null, capsule_goals: c.capsule_goals ?? [],
      }).select().single();
      if (capErr) { alert('Failed to copy capsule: ' + capErr.message); setCopying(false); return; }
      const newCapId = (newCap as any).id;
      // 2. Copy enrollments
      const { data: enrollments } = await supabase.from('capsule_enrollments').select('coachee_email').eq('capsule_id', c.id);
      if (enrollments?.length) await supabase.from('capsule_enrollments').insert((enrollments as any[]).map(e => ({ capsule_id: newCapId, coachee_email: e.coachee_email })));
      // 3. Copy all sessions as drafts
      const { data: sessions } = await supabase.from('coaching_sessions').select('*').eq('capsule_id', c.id).order('session_number');
      for (const s of (sessions as any[]) ?? []) {
        const { data: newSess, error: sErr } = await supabase.from('coaching_sessions').insert({
          capsule_id: newCapId, coach_id: coach.id, session_uid: `${(newCap as any).name.slice(0,3).toUpperCase()}-${Date.now().toString(36).slice(-4)}`,
          topic: s.topic, session_date: null, goals: s.goals, target_audience: s.target_audience, next_session_date: null,
          decks: s.decks, session_notes: s.session_notes, is_public: false, is_active: true, is_submitted: false,
          activation_date: null, deactivation_date: null, session_number: s.session_number, summary: s.summary,
        }).select().single();
        if (sErr || !newSess) continue;
        const newSid = (newSess as any).id;
        // Copy activities + child records
        const { data: acts } = await supabase.from('cc_activities').select('*').eq('session_id', s.id);
        for (const a of (acts as any[]) ?? []) {
          const { data: newAct } = await supabase.from('cc_activities').insert({
            session_id: newSid, activity_type: a.activity_type, is_enabled: a.is_enabled, frequency: a.frequency,
            duration_minutes: a.duration_minutes, metrics: a.metrics, selected_activities: a.selected_activities,
            coach_questions: a.coach_questions ?? [], scheduled_dates: a.scheduled_dates ?? [],
            num_questions: a.num_questions, questions_per_day: a.questions_per_day, config: a.config,
          }).select().single();
          if (!newAct) continue;
          const actId = (newAct as any).id;
          if (a.activity_type === 'quiz') {
            const { data: mods } = await supabase.from('quiz_modules').select('*').eq('activity_id', a.id).order('position');
            for (const m of (mods as any[]) ?? []) {
              const { data: nm } = await supabase.from('quiz_modules').insert({ activity_id: actId, title: m.title, position: m.position, frequency: m.frequency, time_of_day: m.time_of_day, days_per_week: m.days_per_week, num_questions: m.num_questions, questions_per_day: m.questions_per_day }).select().single();
              if (nm) { const { data: qs } = await supabase.from('quiz_questions').select('*').eq('module_id', m.id).order('created_at'); const qRows = ((qs as any[]) ?? []).map(q => ({ module_id: (nm as any).id, question: q.question, options: q.options, answer_index: q.answer_index, image_url: q.image_url })); if (qRows.length) await supabase.from('quiz_questions').insert(qRows); }
            }
          } else if (a.activity_type === 'tasks') {
            const { data: ts } = await supabase.from('cc_tasks').select('*').eq('activity_id', a.id).order('position');
            const rows = ((ts as any[]) ?? []).map((t, i) => ({ activity_id: actId, sub_modality: t.sub_modality, task_text: t.task_text, frequency: t.frequency, image_url: t.image_url, position: i, time_of_day: t.time_of_day, days_per_week: t.days_per_week, start_date: t.start_date, end_date: t.end_date, times_per_day: t.times_per_day }));
            if (rows.length) await supabase.from('cc_tasks').insert(rows);
          } else if (a.activity_type === 'talk') {
            const { data: tc } = await supabase.from('talk_config').select('*').eq('activity_id', a.id).maybeSingle();
            if (tc) await supabase.from('talk_config').insert({ activity_id: actId, prompts: (tc as any).prompts, chatbot_questions: (tc as any).chatbot_questions, coach_questions: (tc as any).coach_questions, metrics: (tc as any).metrics, duration_minutes: (tc as any).duration_minutes, frequency: (tc as any).frequency });
          } else if (a.activity_type === 'watch') {
            const { data: ws } = await supabase.from('watch_items').select('*').eq('activity_id', a.id).order('position');
            const rows = ((ws as any[]) ?? []).map((w, i) => ({ activity_id: actId, video_url: w.video_url, title: w.title, thumbnail_url: w.thumbnail_url, question: w.question, frequency: w.frequency, position: i, start_date: w.start_date, end_date: w.end_date, times_per_day: w.times_per_day, time_of_day: w.time_of_day, days_per_week: w.days_per_week }));
            if (rows.length) await supabase.from('watch_items').insert(rows);
          } else if (a.activity_type === 'parking') {
            const { data: pc } = await supabase.from('parking_config').select('*').eq('activity_id', a.id).maybeSingle();
            if (pc) await supabase.from('parking_config').insert({ activity_id: actId, tags: (pc as any).tags, frequency: (pc as any).frequency, prompt: (pc as any).prompt });
          }
        }
      }
      alert(`Capsule copied as "${newName.trim()}" with ${sessions?.length ?? 0} draft session(s). You can edit and submit them.`);
      load();
    } catch (e: any) { alert('Copy failed: ' + e.message); }
    setCopying(false);
  };

  const filteredCapsules = capsules.filter(c => {
    if (searchType !== 'all' && c.capsule_type !== searchType) return false;
    if (searchStatus === 'active' && !c.is_active) return false;
    if (searchStatus === 'inactive' && c.is_active) return false;
    if (searchDate) {
      const capDate = new Date(c.created_at).toISOString().slice(0, 10);
      if (capDate !== searchDate) return false;
    }
    if (searchKeyword) {
      const q = searchKeyword.toLowerCase();
      if (!c.name.toLowerCase().includes(q) && !(c.description || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 text-teal-500 animate-spin" /></div>;

  if (openCapsule) return <SessionMaster coach={coach} capsule={openCapsule} onBack={() => { setOpenCapsule(null); load(); }} />;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold text-gray-800">Capsule Master</p>
        <button onClick={startNew} className="flex items-center gap-1 text-xs text-white bg-teal-600 hover:bg-teal-700 px-3 py-1.5 rounded-lg transition">
          <Plus className="w-3.5 h-3.5" /> New Capsule
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4 space-y-3">
          <p className="text-sm font-bold text-gray-800">{editing ? 'Edit Capsule' : 'New Capsule'}</p>
          <Input label="Capsule name" value={form.name} onChange={(v) => setForm((f: any) => ({ ...f, name: v }))} />
          <Input label="Description" value={form.description} onChange={(v) => setForm((f: any) => ({ ...f, description: v }))} />
          <Select label="Type" value={form.capsule_type} onChange={(v) => setForm((f: any) => ({ ...f, capsule_type: v, is_public: v === 'Coaching' ? false : form.is_public, nominatedCoachees: v === 'Coaching' ? (form.nominatedCoachees ?? []).slice(0, 1) : form.nominatedCoachees }))} options={['Training', 'Coaching']} />

          {/* Capsule Goal — mandatory for Coaching */}
          {form.capsule_type === 'Coaching' && (
            <div className="border border-teal-100 rounded-xl p-3 bg-teal-50/30 space-y-2">
              <p className="text-xs font-bold text-teal-800">CAPSULE GOAL (mandatory)</p>
              <Input label="Capsule goal (must be quantifiable & measurable)" value={form.capsule_goal ?? ''} onChange={(v) => { setForm((f: any) => ({ ...f, capsule_goal: v })); setGoalValidated(false); setGoalFeedback(''); }} />
              <div className="flex items-center gap-2">
                <button type="button" onClick={validateGoal} disabled={goalValidating} className="text-xs text-white bg-teal-600 hover:bg-teal-700 px-3 py-1.5 rounded-lg disabled:opacity-50 flex items-center gap-1">
                  {goalValidating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Validate Goal
                </button>
                {goalValidated && <span className="text-xs text-emerald-600 font-semibold">Validated</span>}
              </div>
              {goalFeedback && <p className={`text-xs ${goalValidated ? 'text-emerald-600' : 'text-amber-600'}`}>{goalFeedback}</p>}
              {goalSuggestions.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-gray-500">Pick a suggested goal:</p>
                  {goalSuggestions.map((s, i) => (
                    <button key={i} type="button" onClick={() => acceptSuggestion(s)} className="w-full text-left text-xs text-gray-700 bg-white border border-teal-200 rounded-lg px-3 py-2 hover:bg-teal-50 hover:border-teal-400 transition">
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Package & Remarks */}
          <Input label="Package offered" value={form.package_offered ?? ''} onChange={(v) => setForm((f: any) => ({ ...f, package_offered: v }))} />
          <Input label="Remarks" value={form.remarks ?? ''} onChange={(v) => setForm((f: any) => ({ ...f, remarks: v }))} />

          <div className="flex gap-4">
            <label className={`flex items-center gap-2 text-xs ${form.capsule_type === 'Coaching' ? 'text-gray-300' : 'text-gray-600'}`}>
              <input type="checkbox" checked={form.is_public} disabled={form.capsule_type === 'Coaching'} onChange={e => setForm((f: any) => ({ ...f, is_public: e.target.checked }))} /> Public (visible in Marketplace)
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={form.is_active} onChange={e => setForm((f: any) => ({ ...f, is_active: e.target.checked }))} /> Active</label>
          </div>
          {form.is_public && form.capsule_type === 'Training' && (
            <Input label="Passkey (for marketplace purchase)" value={form.passkey ?? ''} onChange={(v) => setForm((f: any) => ({ ...f, passkey: v }))} />
          )}
          {/* Coachee nomination */}
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">
              {form.capsule_type === 'Coaching' ? 'Nominate coachee (mandatory, 1 only)' : 'Nominate coachee(s) (optional)'}
            </label>
            {capsuleCoachees.length === 0 ? <p className="text-xs text-gray-400">No coachees onboarded. Go to Coachees tab to add them first.</p> : (
              <div className="max-h-40 overflow-y-auto border border-gray-100 rounded-lg">
                {capsuleCoachees.map(c => {
                  const selected = (form.nominatedCoachees ?? []).includes(c.email);
                  const disabledForCoaching = form.capsule_type === 'Coaching' && (form.nominatedCoachees ?? []).length >= 1 && !selected;
                  return (
                    <button key={c.id} type="button" disabled={disabledForCoaching}
                      onClick={() => setForm((f: any) => {
                        const cur = f.nominatedCoachees ?? [];
                        if (f.capsule_type === 'Coaching') return { ...f, nominatedCoachees: selected ? [] : [c.email] };
                        return { ...f, nominatedCoachees: selected ? cur.filter((e: string) => e !== c.email) : [...cur, c.email] };
                      })}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-gray-50 ${selected ? 'bg-teal-50' : ''} ${disabledForCoaching ? 'opacity-40' : ''}`}>
                      <span>{c.client_name} <span className="text-gray-400">{c.email}</span></span>
                      {selected && <Check className="w-3.5 h-3.5 text-teal-600" />}
                    </button>
                  );
                })}
              </div>
            )}
            {(form.nominatedCoachees ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(form.nominatedCoachees ?? []).map((e: string) => (
                  <span key={e} className="text-xs bg-teal-50 text-teal-700 px-2 py-1 rounded-full flex items-center gap-1">{e}
                    <button onClick={() => setForm((f: any) => ({ ...f, nominatedCoachees: (f.nominatedCoachees ?? []).filter((x: string) => x !== e) }))} className="hover:text-red-500"><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>
          {/* Coach Section — Goals (coaching only) */}
          {form.capsule_type === 'Coaching' && (
            <div className="border border-teal-100 rounded-xl p-3 bg-teal-50/30">
              <p className="text-xs font-bold text-teal-800 mb-2">COACH SECTION — GOALS</p>
              <p className="text-xs text-gray-500 mb-2">Set goals for the nominated coachee. These will be visible in the coachee's view.</p>
              {[0, 1, 2].map(i => (
                <input key={i} value={(form.capsule_goals ?? [])[i] ?? ''} placeholder={`Goal ${i + 1}`}
                  onChange={e => setForm((f: any) => { const g = [...(f.capsule_goals ?? [])]; g[i] = e.target.value; return { ...f, capsule_goals: g }; })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs mb-2 outline-none focus:border-teal-400" />
              ))}
            </div>
          )}
          {form.id && (
            <CapsuleKnowledgeUploader capsuleId={form.id} coachId={coach.id} />
          )}
          {form.id && (
            <div className="border border-teal-100 rounded-xl p-3 bg-teal-50/30">
              <p className="text-xs font-bold text-teal-800 mb-2">EXPLORATION FORM (optional)</p>
              <p className="text-xs text-gray-500 mb-3">Create a form for coachees to fill out. Their responses are saved to this capsule and you can download them anytime.</p>
              <KnowYourCoachee coach={coach} coachEmail={coachEmail} capsuleId={form.id} />
            </div>
          )}
          <div className="pt-2">
            <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400 mb-2">
              <Lock className="w-3 h-3" />
              <span>All personal data is protected with AES-256 encryption</span>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="text-xs text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-100">{form.id ? 'Done' : 'Cancel'}</button>
              <button onClick={save} className="text-xs text-white bg-teal-600 hover:bg-teal-700 px-4 py-2 rounded-lg">{form.id ? 'Update' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Capsule search */}
      <div className="bg-white rounded-xl border border-gray-100 p-3 mb-3 flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-[150px] relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)} placeholder="Search by keyword..." className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg" />
        </div>
        <select value={searchType} onChange={e => setSearchType(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5">
          <option value="all">All types</option>
          <option value="Coaching">Coaching</option>
          <option value="Training">Training</option>
        </select>
        <select value={searchStatus} onChange={e => setSearchStatus(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5">
          <option value="all">All status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <input type="date" value={searchDate} onChange={e => setSearchDate(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5" />
      </div>

      {capsules.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <Layers className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No capsules yet. Create your first capsule.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredCapsules.map(c => (
            <div key={c.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-50 to-emerald-50 flex items-center justify-center"><Layers className="w-5 h-5 text-teal-600" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{c.name}</p>
                  <p className="text-xs text-gray-500 truncate">{c.capsule_type} · {c.description || 'No description'}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${c.is_public ? 'bg-sky-50 text-sky-700' : 'bg-gray-100 text-gray-500'}`}>{c.is_public ? 'Public' : 'Private'}</span>
                <span className={`text-xs px-2 py-1 rounded-full ${c.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{c.is_active ? 'Active' : 'Inactive'}</span>
                <button onClick={() => setOpenCapsule(c)} className="text-xs text-teal-600 hover:underline">Open</button>
                <button onClick={() => startEdit(c)} className="p-1.5 rounded-lg hover:bg-gray-100"><Pencil className="w-3.5 h-3.5 text-gray-500" /></button>
                <button onClick={() => copyCapsule(c)} disabled={copying} title="Copy capsule" className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-50"><Copy className="w-3.5 h-3.5 text-gray-500" /></button>
                <button onClick={() => togglePublic(c)} title="Toggle public" className="p-1.5 rounded-lg hover:bg-gray-100">{c.is_public ? <Globe className="w-3.5 h-3.5 text-sky-600" /> : <Lock className="w-3.5 h-3.5 text-gray-400" />}</button>
                <button onClick={() => toggleActive(c)} title="Toggle active" className="p-1.5 rounded-lg hover:bg-gray-100">{c.is_active ? <Power className="w-3.5 h-3.5 text-emerald-600" /> : <PowerOff className="w-3.5 h-3.5 text-gray-400" />}</button>
                <button onClick={() => remove(c)} className="p-1.5 rounded-lg hover:bg-red-50"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      {filteredCapsules.length === 0 && capsules.length > 0 && <p className="text-xs text-gray-400 text-center py-4">No capsules match your search.</p>}
    </div>
  );
}

/* ============ Session Master ============ */
function SessionMaster({ coach, capsule, onBack }: { coach: Coach; capsule: Capsule; onBack: () => void }) {
  const [sessions, setSessions] = useState<CoachingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CoachingSession | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('coaching_sessions').select('*').eq('capsule_id', capsule.id).order('session_number', { ascending: true });
    setSessions((data as CoachingSession[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [capsule.id]);

  const startNew = () => { setEditing(null); setShowForm(true); };
  const startEdit = (s: CoachingSession) => { setEditing(s); setShowForm(true); };

  const deleteSession = async (sessionId: string) => {
    // Delete child records first, then the session
    await supabase.from('cc_activities').delete().eq('session_id', sessionId);
    await supabase.from('activity_sets').delete().eq('session_id', sessionId);
    await supabase.from('session_nominees').delete().eq('session_id', sessionId);
    await supabase.from('session_passkeys').delete().eq('session_id', sessionId);
    const { error } = await supabase.from('coaching_sessions').delete().eq('id', sessionId);
    if (error) { alert('Failed to delete session: ' + error.message); return; }
    load();
  };

  const copySession = async (s: CoachingSession, toCapsuleId?: string) => {
    const targetCapsule = toCapsuleId ?? capsule.id;
    const { count } = await supabase.from('coaching_sessions').select('id', { count: 'exact', head: true }).eq('capsule_id', targetCapsule);
    const nextNum = ((count as unknown as number) ?? 0) + 1;
    const newUid = buildSessionUid(capsule.name, coach.coach_name, new Date().toISOString().slice(0, 10), nextNum);
    const { data, error: copyErr } = await supabase.from('coaching_sessions').insert({
      capsule_id: targetCapsule, coach_id: coach.id, session_uid: newUid,
      topic: s.topic, session_date: null, goals: s.goals, target_audience: s.target_audience, next_session_date: null,
      decks: s.decks, session_notes: s.session_notes, is_public: false, is_active: true, is_submitted: false,
      activation_date: null, deactivation_date: null, session_number: nextNum, summary: s.summary,
    }).select().single();
    if (copyErr) { alert('Failed to copy session: ' + copyErr.message); load(); return; }
    const newId = (data as any)?.id;
    if (newId && s.is_submitted) {
      const [{ data: acts }, { data: regs }] = await Promise.all([
        supabase.from('cc_activities').select('*').eq('session_id', s.id),
        supabase.from('regimes').select('*').eq('session_id', s.id),
      ]);
      for (const a of (acts as any[]) ?? []) {
        const { activity_type, is_enabled, frequency, duration_minutes, metrics, selected_activities } = a;
        const { data: newAct } = await supabase.from('cc_activities').insert({ session_id: newId, activity_type, is_enabled, frequency, duration_minutes, metrics, selected_activities }).select().single();
        if (!newAct) continue;
        const actId = (newAct as any).id;
        if (activity_type === 'quiz') {
          const { data: mods } = await supabase.from('quiz_modules').select('*').eq('activity_id', a.id).order('position');
          for (const m of (mods as any[]) ?? []) {
            const { data: nm } = await supabase.from('quiz_modules').insert({ activity_id: actId, title: m.title, position: m.position, frequency: m.frequency, time_of_day: m.time_of_day, days_per_week: m.days_per_week }).select().single();
            if (nm) {
              const { data: qs } = await supabase.from('quiz_questions').select('*').eq('module_id', m.id).order('created_at');
              const qRows = ((qs as any[]) ?? []).map(q => ({ module_id: (nm as any).id, question: q.question, options: q.options, answer_index: q.answer_index, image_url: q.image_url }));
              if (qRows.length) await supabase.from('quiz_questions').insert(qRows);
            }
          }
        } else if (activity_type === 'tasks') {
          const { data: ts } = await supabase.from('cc_tasks').select('*').eq('activity_id', a.id).order('position');
          const rows = ((ts as any[]) ?? []).map((t, i) => ({ activity_id: actId, sub_modality: t.sub_modality, task_text: t.task_text, frequency: t.frequency, image_url: t.image_url, position: i, time_of_day: t.time_of_day, days_per_week: t.days_per_week, start_date: t.start_date, end_date: t.end_date, times_per_day: t.times_per_day }));
          if (rows.length) await supabase.from('cc_tasks').insert(rows);
        } else if (activity_type === 'knowledge') {
          const { data: ks } = await supabase.from('knowledge_points').select('*').eq('activity_id', a.id).order('position');
          const rows = ((ks as any[]) ?? []).map((k, i) => ({ activity_id: actId, point_text: k.point_text, image_url: k.image_url, position: i }));
          if (rows.length) await supabase.from('knowledge_points').insert(rows);
        } else if (activity_type === 'talk') {
          const { data: tc } = await supabase.from('talk_config').select('*').eq('activity_id', a.id).maybeSingle();
          if (tc) await supabase.from('talk_config').insert({ activity_id: actId, prompts: (tc as any).prompts, chatbot_questions: (tc as any).chatbot_questions, end_goal: (tc as any).end_goal, metrics: (tc as any).metrics, duration_minutes: (tc as any).duration_minutes, frequency: (tc as any).frequency });
        } else if (activity_type === 'watch') {
          const { data: ws } = await supabase.from('watch_items').select('*').eq('activity_id', a.id).order('position');
          const rows = ((ws as any[]) ?? []).map((w, i) => ({ activity_id: actId, video_url: w.video_url, title: w.title, thumbnail_url: w.thumbnail_url, question: w.question, frequency: w.frequency, position: i, start_date: w.start_date, end_date: w.end_date, times_per_day: w.times_per_day, time_of_day: w.time_of_day, days_per_week: w.days_per_week }));
          if (rows.length) await supabase.from('watch_items').insert(rows);
        } else if (activity_type === 'parking') {
          const { data: pc } = await supabase.from('parking_config').select('*').eq('activity_id', a.id).maybeSingle();
          if (pc) await supabase.from('parking_config').insert({ activity_id: actId, tags: (pc as any).tags, frequency: (pc as any).frequency, prompt: (pc as any).prompt });
        }
      }
      const { data: noms } = await supabase.from('session_nominees').select('coachee_email').eq('session_id', s.id);
      if (noms?.length) await supabase.from('session_nominees').insert((noms as any[]).map(n => ({ session_id: newId, coachee_email: n.coachee_email })));
      const { data: pks } = await supabase.from('session_passkeys').select('passkey').eq('session_id', s.id);
      if (pks?.length) await supabase.from('session_passkeys').insert((pks as any[]).map(p => ({ session_id: newId, passkey: p.passkey })));
    }
    if (newId) alert('Session copied as private draft. Make it public to show in marketplace.');
    load();
  };

  const toggleSessionActive = async (s: CoachingSession) => {
    await supabase.from('coaching_sessions').update({ is_active: !s.is_active, updated_at: new Date().toISOString() }).eq('id', s.id);
    load();
  };

  const toggleSessionPublic = async (s: CoachingSession) => {
    await supabase.from('coaching_sessions').update({ is_public: !s.is_public, updated_at: new Date().toISOString() }).eq('id', s.id);
    load();
  };

  const [viewing, setViewing] = useState<CoachingSession | null>(null);
  const [managing, setManaging] = useState<CoachingSession | null>(null);
  const [coacheeCounts, setCoacheeCounts] = useState<Record<string, number>>({});
  const loadCoacheeCounts = async (sessionIds: string[]) => {
    if (sessionIds.length === 0) return;
    const [{ data: noms }, { data: purs }] = await Promise.all([
      supabase.from('session_nominees').select('session_id').in('session_id', sessionIds),
      supabase.from('session_purchases').select('session_id').in('session_id', sessionIds),
    ]);
    const map: Record<string, number> = {};
    const all = [...(noms as any[]) ?? [], ...(purs as any[]) ?? []];
    const seen = new Set<string>();
    for (const r of all) {
      const key = `${r.session_id}:${r.session_id}`;
      if (!seen.has(key)) { seen.add(key); map[r.session_id] = (map[r.session_id] ?? 0) + 1; }
    }
    setCoacheeCounts(map);
  };

  useEffect(() => { if (sessions.length) loadCoacheeCounts(sessions.map(s => s.id)); }, [sessions]);

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 text-teal-500 animate-spin" /></div>;

  return (
    <div>
      <button onClick={onBack} className="text-xs text-gray-500 hover:text-gray-800 mb-3 flex items-center gap-1"><X className="w-3.5 h-3.5" /> Back to capsules</button>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-bold text-gray-800">{capsule.name}</p>
          <p className="text-xs text-gray-500">{capsule.capsule_type} · {sessions.length} session(s)</p>
        </div>
        <button onClick={startNew} className="flex items-center gap-1 text-xs text-white bg-teal-600 hover:bg-teal-700 px-3 py-1.5 rounded-lg transition">
          <Plus className="w-3.5 h-3.5" /> New Session
        </button>
      </div>

      {sessions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No sessions yet. Add your first session.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map(s => {
            const sStatus = (s as any).session_from_dt ? (new Date((s as any).session_from_dt) > new Date() ? 'Scheduled' : 'Completed') : ((s as any).status || 'Draft');
            return (
            <div key={s.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">Session {s.session_number}: {s.topic}</p>
                  <p className="text-xs text-gray-500 truncate">ID: {s.session_uid ?? '—'} · {formatDate(s.session_date)}{s.is_submitted ? ' · Submitted' : ' · Draft'}</p>
                  <p className="text-xs text-teal-600 font-semibold mt-0.5">{coacheeCounts[s.id] ?? 0} coachee(s)</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-semibold ${sStatus === 'Scheduled' ? 'bg-sky-50 text-sky-700' : sStatus === 'Completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{sStatus}</span>
                <button onClick={() => toggleSessionPublic(s)} title="Toggle public/private" className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${s.is_public ? 'bg-sky-50 text-sky-700' : 'bg-gray-100 text-gray-500'}`}>{s.is_public ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}{s.is_public ? 'Public' : 'Private'}</button>
                <span className={`text-xs px-2 py-1 rounded-full ${s.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{s.is_active ? 'Active' : 'Inactive'}</span>
                <button onClick={() => startEdit(s)} disabled={s.is_submitted} className={`p-1.5 rounded-lg ${s.is_submitted ? 'opacity-40' : 'hover:bg-gray-100'}`} title={s.is_submitted ? 'Submitted — copy to edit' : 'Edit'}><Pencil className="w-3.5 h-3.5 text-gray-500" /></button>
                <button onClick={() => setManaging(s)} title="Manage coachees & passcode" className="p-1.5 rounded-lg hover:bg-gray-100"><Users className="w-3.5 h-3.5 text-teal-600" /></button>
                <button onClick={() => setViewing(s)} title="View session" className="p-1.5 rounded-lg hover:bg-gray-100"><Eye className="w-3.5 h-3.5 text-teal-600" /></button>
                <button onClick={() => copySession(s)} title="Copy session" className="p-1.5 rounded-lg hover:bg-gray-100"><Copy className="w-3.5 h-3.5 text-gray-500" /></button>
                <button onClick={() => toggleSessionActive(s)} title="Toggle active" className="p-1.5 rounded-lg hover:bg-gray-100">{s.is_active ? <Power className="w-3.5 h-3.5 text-emerald-600" /> : <PowerOff className="w-3.5 h-3.5 text-gray-400" />}</button>
                <button onClick={async () => { if (confirm(`Delete Session ${s.session_number}: ${s.topic}?\nThis will remove the session and all its activities. This cannot be undone.`)) { await deleteSession(s.id); } }} title="Delete session" className="p-1.5 rounded-lg hover:bg-red-50"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-40 bg-white overflow-y-auto">
          <div className="max-w-4xl mx-auto px-5 py-6">
            <SessionEditor coach={coach} capsule={capsule} session={editing} onClose={() => { setShowForm(false); setEditing(null); load(); }} />
          </div>
        </div>
      )}
      {viewing && <SessionViewer session={viewing} onClose={() => setViewing(null)} />}
      {managing && <SessionManager session={managing} coach={coach} onClose={() => { setManaging(null); load(); }} />}
    </div>
  );
}

/* ============ Session Manager (coachees + passcode, post-submission) ============ */

function SessionManager({ session, coach, onClose }: { session: CoachingSession; coach: Coach; onClose: () => void }) {
  const [nominees, setNominees] = useState<string[]>([]);
  const [coachees, setCoachees] = useState<Coachee[]>([]);
  const [passkey, setPasskey] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: noms }, { data: cs }, { data: pk }] = await Promise.all([
        supabase.from('session_nominees').select('coachee_email').eq('session_id', session.id),
        supabase.from('coachees').select('id,email,client_name').eq('coach_id', coach.id).order('client_name'),
        supabase.from('session_passkeys').select('passkey').eq('session_id', session.id).maybeSingle(),
      ]);
      setNominees(((noms as any[]) ?? []).map(n => n.coachee_email));
      setCoachees((cs as Coachee[]) ?? []);
      setPasskey((pk as any)?.passkey ?? '');
      setLoading(false);
    })();
  }, [session.id, coach.id]);

  const toggle = (email: string) => setNominees(ns => ns.includes(email) ? ns.filter(e => e !== email) : [...ns, email]);

  const save = async () => {
    setSaving(true);
    // Sync nominees: delete all, re-insert current
    await supabase.from('session_nominees').delete().eq('session_id', session.id);
    if (nominees.length) await supabase.from('session_nominees').insert(nominees.map(e => ({ session_id: session.id, coachee_email: e })));
    // Update passkey: delete existing, insert new
    if (passkey.trim()) {
      await supabase.from('session_passkeys').delete().eq('session_id', session.id);
      await supabase.from('session_passkeys').insert({ session_id: session.id, passkey: passkey.trim() });
    }
    setSaving(false);
    alert('Coachees and passcode updated.');
    onClose();
  };

  if (loading) return <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center"><Loader2 className="w-5 h-5 text-white animate-spin" /></div>;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-white w-full md:max-w-lg rounded-t-3xl md:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-5 py-3 border-b border-gray-100 flex items-center justify-between z-10">
          <p className="text-sm font-bold text-gray-800">Manage: Session {session.session_number}</p>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-4 h-4 text-gray-500" /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Coachees ({nominees.length} nominated)</label>
            <p className="text-xs text-gray-400 mb-2">Adding a coachee makes this session appear in their Coachee tab. Removing hides it (unless purchased).</p>
            {coachees.length === 0 ? <p className="text-xs text-gray-400">No coachees onboarded.</p> : (
              <div className="max-h-48 overflow-y-auto border border-gray-100 rounded-lg">
                {coachees.map(c => (
                  <button key={c.id} onClick={() => toggle(c.email)} type="button"
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-gray-50 ${nominees.includes(c.email) ? 'bg-teal-50' : ''}`}>
                    <span>{c.client_name} <span className="text-gray-400">{c.email}</span></span>
                    {nominees.includes(c.email) && <Check className="w-3.5 h-3.5 text-teal-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Passcode (required for private access)</label>
            <input value={passkey} onChange={e => setPasskey(e.target.value)} placeholder="Passcode"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-teal-400" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="text-xs text-gray-600 border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50">Cancel</button>
            <button onClick={save} disabled={saving} className="text-xs text-white bg-teal-600 hover:bg-teal-700 px-4 py-2 rounded-lg disabled:opacity-60 flex items-center gap-1">{saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============ Session Viewer (read-only) ============ */

function SessionViewer({ session, onClose }: { session: CoachingSession; onClose: () => void }) {
  const [tab, setTab] = useState<'summary' | 'tasks' | 'knowledge' | 'quiz' | 'talk' | 'watch' | 'parking' | 'form'>('summary');
  const [fullSession, setFullSession] = useState<any>(null);
  const [activities, setActivities] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<Record<string, any>>({});

  useEffect(() => {
    (async () => {
      const { data: full } = await supabase.from('coaching_sessions').select('*').eq('id', session.id).single();
      setFullSession(full);
      const { data: acts } = await supabase.from('cc_activities').select('*').eq('session_id', session.id);
      const map: Record<string, any> = {};
      (acts as any[])?.forEach(a => { map[a.activity_type] = a; });
      setActivities(map);
      // Load details per activity
      const d: Record<string, any> = {};
      if (map.quiz) {
        const { data: mods } = await supabase.from('quiz_modules').select('id,title,position').eq('activity_id', map.quiz.id).order('position');
        for (const m of (mods as any[]) ?? []) {
          const { data: qs } = await supabase.from('quiz_questions').select('question,options,answer_index,image_url').eq('module_id', m.id).order('created_at');
          m.questions = qs ?? [];
        }
        d.quiz = mods;
      }
      if (map.tasks) {
        const { data: ts } = await supabase.from('cc_tasks').select('task_text,sub_modality,frequency,time_of_day,times_per_day,start_date,end_date,image_url').eq('activity_id', map.tasks.id).order('position');
        d.tasks = ts;
      }
      if (map.knowledge) {
        const { data: kp } = await supabase.from('knowledge_points').select('point_text,image_url').eq('activity_id', map.knowledge.id).order('position');
        d.knowledge = kp;
      }
      if (map.talk) {
        const { data: cfg } = await supabase.from('talk_config').select('prompts,duration_minutes,frequency').eq('activity_id', map.talk.id).maybeSingle();
        d.talk = cfg;
      }
      if (map.watch) {
        const { data: ws } = await supabase.from('watch_items').select('title,video_url,question,thumbnail_url').eq('activity_id', map.watch.id).order('position');
        d.watch = ws;
      }
      if (map.parking) {
        const { data: pc } = await supabase.from('parking_config').select('tags,frequency,prompt').eq('activity_id', map.parking.id).maybeSingle();
        d.parking = pc;
      }
      setDetails(d);
      setLoading(false);
    })();
  }, [session.id]);

  const tabs: { key: typeof tab; label: string; show: boolean; highlight?: boolean }[] = [
    { key: 'summary', label: 'Summary', show: true },
    { key: 'tasks', label: 'Tasks', show: !!activities.tasks?.is_enabled },
    { key: 'quiz', label: 'Quiz', show: !!activities.quiz?.is_enabled },
    { key: 'talk', label: 'Talk', show: !!activities.talk?.is_enabled },
    { key: 'watch', label: 'Watch', show: !!activities.watch?.is_enabled },
    { key: 'parking', label: 'Parking', show: !!activities.parking?.is_enabled },
    { key: 'knowledge', label: 'Knowledge', show: !!activities.knowledge?.is_enabled, highlight: true },
    { key: 'form', label: 'Session Form', show: true, highlight: true },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-white w-full md:max-w-2xl rounded-t-3xl md:rounded-3xl shadow-2xl max-h-[95vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-5 py-3 border-b border-gray-100 flex items-center justify-between z-10">
          <div>
            <p className="text-sm font-bold text-gray-800">Session {session.session_number}: {session.topic}</p>
            <p className="text-xs text-gray-500">{session.session_uid ?? '—'} · {formatDate(session.session_date)} · {session.is_submitted ? 'Submitted' : 'Draft'}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-4 h-4 text-gray-500" /></button>
        </div>
        {loading ? <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 text-teal-500 animate-spin" /></div> : (
          <>
            <div className="flex gap-1 px-5 pt-3 overflow-x-auto pb-1">
              {tabs.filter(t => t.show).map(t => {
                const activeCls = t.highlight ? 'bg-amber-500 text-white' : 'bg-teal-600 text-white';
                const inactiveCls = t.highlight ? 'bg-amber-50 text-amber-700 border border-amber-300 hover:bg-amber-100 font-bold' : 'bg-gray-100 text-gray-600';
                return (
                  <button key={t.key} onClick={() => setTab(t.key)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap ${tab === t.key ? activeCls : inactiveCls}`}>{t.label}</button>
                );
              })}
            </div>
            <div className="px-5 py-4 space-y-3">
              {tab === 'summary' && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-500 mb-2">Summary</p>
                  {(session.summary ?? []).length === 0 ? <p className="text-xs text-gray-400">No summary.</p> : (
                    <ul className="space-y-1.5">{(session.summary as string[]).map((p, i) => <li key={i} className="text-sm text-gray-700"><span className="text-teal-600 font-bold">{i + 1}.</span> {p}</li>)}</ul>
                  )}
                  <p className="text-xs font-semibold text-gray-500 mt-3 mb-1">Goals</p>
                  {(session.goals ?? []).length === 0 ? <p className="text-xs text-gray-400">No goals.</p> : (
                    <ul className="space-y-1">{(session.goals as string[]).map((g, i) => <li key={i} className="text-xs text-gray-700">• {g}</li>)}</ul>
                  )}
                </div>
              )}
              {tab === 'tasks' && (
                <div className="space-y-2">{(details.tasks ?? []).map((t: any, i: number) => (
                  <div key={i} className="bg-gray-50 rounded-xl p-3 flex gap-3">
                    {t.image_url && <img src={t.image_url} className="w-10 h-10 rounded-lg object-cover" alt="" />}
                    <div><p className="text-sm text-gray-800">{t.task_text}</p><p className="text-xs text-gray-500">{t.sub_modality} · {t.frequency} · {t.times_per_day}x/day · {t.time_of_day}</p></div>
                  </div>
                ))}{(details.tasks ?? []).length === 0 && <p className="text-xs text-gray-400">No tasks.</p>}</div>
              )}
              {tab === 'knowledge' && (
                <div className="space-y-2">{(details.knowledge ?? []).map((p: any, i: number) => (
                  <div key={i} className="bg-gray-50 rounded-xl p-3 flex gap-3">
                    {p.image_url && <img src={p.image_url} className="w-10 h-10 rounded-lg object-cover" alt="" />}
                    <p className="text-sm text-gray-800">{p.point_text}</p>
                  </div>
                ))}{(details.knowledge ?? []).length === 0 && <p className="text-xs text-gray-400">No knowledge points.</p>}</div>
              )}
              {tab === 'quiz' && (
                <div className="space-y-3">{(details.quiz ?? []).map((m: any, mi: number) => (
                  <div key={mi} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-sm font-semibold text-gray-800 mb-2">{m.title}</p>
                    <div className="space-y-2">{(m.questions ?? []).map((q: any, qi: number) => (
                      <div key={qi} className="text-xs">
                        <p className="text-gray-700 font-medium">Q{qi + 1}. {q.question}</p>
                        <ul className="mt-1 space-y-0.5">{(q.options ?? []).map((o: string, oi: number) => (
                          <li key={oi} className={oi === q.answer_index ? 'text-emerald-700 font-semibold' : 'text-gray-600'}>{String.fromCharCode(65 + oi)}. {o}{oi === q.answer_index && ' ✓'}</li>
                        ))}</ul>
                      </div>
                    ))}</div>
                  </div>
                ))}{(details.quiz ?? []).length === 0 && <p className="text-xs text-gray-400">No quiz.</p>}</div>
              )}
              {tab === 'talk' && details.talk && (
                <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                  <p className="text-sm text-gray-800"><span className="font-semibold">Duration:</span> {details.talk.duration_minutes ?? 10} min · {details.talk.frequency ?? 'daily_once'}</p>
                  <p className="text-xs font-semibold text-gray-500 mt-2">Prompts</p>
                  {(details.talk.prompts ?? []).length === 0 ? <p className="text-xs text-gray-400">None.</p> : <ul className="space-y-1">{(details.talk.prompts as string[]).map((p, i) => <li key={i} className="text-xs text-gray-700">• {p}</li>)}</ul>}
                </div>
              )}
              {tab === 'watch' && (
                <div className="space-y-2">{(details.watch ?? []).map((w: any, i: number) => (
                  <a key={i} href={w.video_url} target="_blank" rel="noreferrer" className="bg-gray-50 rounded-xl p-3 flex gap-3 hover:bg-gray-100">
                    {w.thumbnail_url && <img src={w.thumbnail_url} className="w-16 h-10 rounded-lg object-cover" alt="" />}
                    <div><p className="text-sm text-gray-800">{w.title}</p><p className="text-xs text-gray-500">{w.question}</p></div>
                  </a>
                ))}{(details.watch ?? []).length === 0 && <p className="text-xs text-gray-400">No watch items.</p>}</div>
              )}
              {tab === 'parking' && details.parking && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm text-gray-800"><span className="font-semibold">Prompt:</span> {details.parking.prompt || '—'}</p>
                  <p className="text-sm text-gray-800 mt-1"><span className="font-semibold">Frequency:</span> {details.parking.frequency ?? 'daily_once'}</p>
                  <p className="text-sm text-gray-800 mt-1"><span className="font-semibold">Tags:</span> {(details.parking.tags ?? []).join(', ') || '—'}</p>
                </div>
              )}
              {tab === 'form' && fullSession && (
                <div className="bg-gray-50 rounded-xl p-4 space-y-3 text-xs">
                  <p className="text-sm font-bold text-gray-800">Session Form (Read-Only)</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div><span className="font-semibold text-gray-600">Topic:</span> {fullSession.topic || '—'}</div>
                    <div><span className="font-semibold text-gray-600">Session #:</span> {fullSession.session_number ?? '—'}</div>
                    <div><span className="font-semibold text-gray-600">Session date:</span> {formatDate(fullSession.session_date)}</div>
                    <div><span className="font-semibold text-gray-600">Next session:</span> {formatDate(fullSession.next_session_date)}</div>
                    <div><span className="font-semibold text-gray-600">Activation:</span> {formatDate(fullSession.activation_date)}</div>
                    <div><span className="font-semibold text-gray-600">Deactivation:</span> {formatDate(fullSession.deactivation_date)}</div>
                    <div><span className="font-semibold text-gray-600">Target audience:</span> {fullSession.target_audience || '—'}</div>
                    <div><span className="font-semibold text-gray-600">Type:</span> {fullSession.is_public ? 'Public' : 'Private'} · {fullSession.is_active ? 'Active' : 'Inactive'} · {fullSession.is_submitted ? 'Submitted' : 'Draft'}</div>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-600 mb-1">Goals:</p>
                    {(fullSession.goals ?? []).length === 0 ? <p className="text-gray-400">No goals.</p> : <ul className="space-y-0.5">{(fullSession.goals as string[]).map((g, i) => <li key={i} className="text-gray-700">• {g}</li>)}</ul>}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-600 mb-1">Summary:</p>
                    {(fullSession.summary ?? []).length === 0 ? <p className="text-gray-400">No summary.</p> : <ul className="space-y-0.5">{(fullSession.summary as string[]).map((s, i) => <li key={i} className="text-gray-700">• {s}</li>)}</ul>}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-600 mb-1">Session notes:</p>
                    <p className="text-gray-700 whitespace-pre-wrap">{fullSession.session_notes?.notes || fullSession.session_notes?.upload_summary || '—'}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-600 mb-1">Decks:</p>
                    {(fullSession.decks ?? []).length === 0 ? <p className="text-gray-400">No decks.</p> : <ul className="space-y-0.5">{(fullSession.decks as any[]).map((d, i) => <li key={i} className="text-gray-700">• {typeof d === 'string' ? d : d?.name || d?.url || JSON.stringify(d)}</li>)}</ul>}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ============ Quiz File Upload ============ */

function QuizFileUpload({ sessionId, ensureSessionId }: { sessionId: string; ensureSessionId: () => Promise<string | null> }) {
  const [files, setFiles] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (sessionId) loadFiles(sessionId);
  }, [sessionId]);

  const loadFiles = async (sid?: string) => {
    const id = sid ?? sessionId;
    if (!id) return;
    const { data: acts } = await supabase.from('cc_activities').select('id').eq('session_id', id).eq('activity_type', 'quiz').maybeSingle();
    if (!acts) return;
    const { data } = await supabase.from('quiz_files').select('*').eq('activity_id', (acts as any).id).order('uploaded_at');
    setFiles((data as any[]) ?? []);
  };

  const handleUpload = async (fileList: FileList) => {
    setUploading(true);
    let sid = sessionId;
    if (!sid) { sid = await ensureSessionId() ?? ''; if (!sid) { setUploading(false); return; } }
    let { data: acts } = await supabase.from('cc_activities').select('id').eq('session_id', sid).eq('activity_type', 'quiz').maybeSingle();
    if (!acts) { const { data: newAct, error: actErr } = await supabase.from('cc_activities').insert({ session_id: sid, activity_type: 'quiz', is_enabled: true, is_active_set: true, frequency: 'daily_once', selected_activities: ['quiz'] }).select().single(); if (actErr) { setUploading(false); alert('Failed to create quiz activity: ' + actErr.message); return; } acts = newAct as any; }
    for (const file of Array.from(fileList)) {
      let extractedText = '';
      try { extractedText = await extractFileText(file); } catch (e: any) { console.warn('Extract failed for', file.name, e); extractedText = `[File: ${file.name}]`; }
      extractedText = extractedText.slice(0, 15000);
      const { error: qfErr } = await supabase.from('quiz_files').insert({ activity_id: (acts as any).id, file_name: file.name, file_type: file.type, extracted_text: extractedText });
      if (qfErr) { alert('Failed to save quiz file: ' + qfErr.message); }
    }
    await loadFiles(sid);
    setUploading(false);
  };

  const removeFile = async (id: string) => {
    await supabase.from('quiz_files').delete().eq('id', id);
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  return (
    <div className="bg-sky-50/50 rounded-lg p-2.5 border border-sky-100">
      <p className="text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1"><FileText className="w-3.5 h-3.5 text-sky-500" /> Quiz source files (up to 3 PDF/DOC/PPT) — AI uses these to generate questions</p>
      <div className="flex items-center gap-2">
        <input ref={fileRef} type="file" multiple className="hidden" onChange={e => e.target.files?.length && handleUpload(e.target.files)} />
        <button onClick={() => fileRef.current?.click()} disabled={uploading || files.length >= 3} className="flex items-center gap-1 text-xs text-sky-700 border border-sky-200 bg-white rounded-lg px-2 py-1 hover:bg-sky-50 disabled:opacity-50">
          {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />} Add file ({files.length}/3)
        </button>
      </div>
      {files.length > 0 && (
        <div className="mt-1.5 space-y-1">
          {files.map(f => (
            <div key={f.id} className="flex items-center gap-2 text-xs text-gray-600 bg-white rounded px-2 py-1">
              <FileText className="w-3 h-3 text-sky-400" />
              <span className="flex-1 truncate">{f.file_name}</span>
              <button onClick={() => removeFile(f.id)} className="text-red-400"><Trash2 className="w-3 h-3" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============ Session Editor (inline, 2-part, save-only) ============ */

function SessionEditor({ coach, capsule, session, onClose }: { coach: Coach; capsule: Capsule; session: CoachingSession | null; onClose: () => void }) {
  const isTraining = capsule.capsule_type === 'Training';
  const allActivityTypes = ['talk', 'tasks', 'knowledge', 'parking', 'watch', 'quiz'];
  const [form, setForm] = useState<any>(session ? {
    topic: session.topic, session_date: session.session_date ?? '', session_from_dt: (session as any).session_from_dt ? toLocalDT((session as any).session_from_dt) : '', session_to_dt: (session as any).session_to_dt ? toLocalDT((session as any).session_to_dt) : '', goals: (session.goals as any[]) ?? [], target_audience: session.target_audience ?? '',
    next_session_date: session.next_session_date ?? '', decks: session.decks ?? [], session_notes: session.session_notes ?? {},
    is_public: session.is_public, is_active: session.is_active, activation_date: session.activation_date ?? '', deactivation_date: session.deactivation_date ?? '',
    summary: session.summary ?? [], capsule_type: (session as any).capsule_type ?? capsule.capsule_type,
    selectedActivities: allActivityTypes, parkingTags: [] as string[],
    activities: {} as Record<string, any>,
  } : {
    topic: '', session_date: '', session_from_dt: '', session_to_dt: '', goals: [], target_audience: '', next_session_date: '', decks: [], session_notes: {},
    is_public: true, is_active: true, activation_date: '', deactivation_date: '', summary: [],
    capsule_type: capsule.capsule_type,
    selectedActivities: allActivityTypes, parkingTags: [],
    activities: {},
  });
  const [coachees, setCoachees] = useState<Coachee[]>([]);
  const [enrolledEmailsForSession, setEnrolledEmailsForSession] = useState<string[]>([]);
  const [generating, setGenerating] = useState<Record<string, boolean>>({});
  const [genStatus, setGenStatus] = useState('');
  const [genProgress, setGenProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [showNotesEditor, setShowNotesEditor] = useState(false);
  const [activitySets, setActivitySets] = useState<any[]>([]);
  const [activeSetId, setActiveSetId] = useState<string>('');
  const [sessionCount, setSessionCount] = useState(0);
  const [part, setPart] = useState<1 | 2>(1);
  const [savedSessionId, setSavedSessionId] = useState<string | null>(session?.id ?? null);
  const currentSessionId = session?.id ?? savedSessionId;
  const persistingRef = useRef(false);
  const createdIdRef = useRef<string | null>(session?.id ?? null);
  const [availSlots, setAvailSlots] = useState<any[]>([]);
  const [availWarnings, setAvailWarnings] = useState<{ from?: string }>({});

  useEffect(() => {
    supabase.from('coach_availability').select('*').eq('coach_id', coach.id).eq('is_active', true).then(({ data }) => setAvailSlots((data as any[]) ?? []));
  }, [coach.id]);

  useEffect(() => {
    if (!form.session_from_dt) { setAvailWarnings({}); return; }
    const d = new Date(istLocalToISO(form.session_from_dt));
    const dow = d.getDay();
    const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const daySlots = availSlots.filter(s => s.day_of_week === dow);
    if (daySlots.length === 0) {
      // Find next available day
      const nextDay = availSlots.length > 0 ? [...availSlots].sort((a, b) => (a.day_of_week === dow ? 7 : (a.day_of_week - dow + 7) % 7)) : [];
      const nextDow = nextDay[0]?.day_of_week;
      const dayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][nextDow ?? dow];
      setAvailWarnings({ from: `No availability set for this day. Next available: ${dayName}` });
    } else {
      const inSlot = daySlots.some(s => s.start_time <= hhmm && hhmm < s.end_time);
      if (!inSlot) {
        const times = daySlots.map(s => `${s.start_time}-${s.end_time}`).join(', ');
        setAvailWarnings({ from: `Outside availability. Open slots: ${times}` });
      } else {
        setAvailWarnings({});
      }
    }
  }, [form.session_from_dt, availSlots]);

  useEffect(() => {
    supabase.from('coachees').select('id,email,client_name').eq('coach_id', coach.id).then(({ data }) => setCoachees((data as Coachee[]) ?? []));
    supabase.from('coaching_sessions').select('id', { count: 'exact', head: true }).eq('capsule_id', capsule.id).then(({ count }) => setSessionCount((count as unknown as number) ?? 0));
    supabase.from('capsule_enrollments').select('coachee_email').eq('capsule_id', capsule.id).then(({ data }) => setEnrolledEmailsForSession((data as any[])?.map(r => r.coachee_email) ?? []));
  }, [coach.id, capsule.id]);

  // Load existing activities from DB when editing an existing session so the coach sees them and re-save preserves them
  useEffect(() => {
    if (!session?.id) return;
    let cancelled = false;
    (async () => {
      const sid = session.id!;
      const { data: acts } = await supabase.from('cc_activities').select('*').eq('session_id', sid);
      const actMap: Record<string, any> = {};
      for (const a of (acts as any[]) ?? []) {
        const at = a.activity_type;
        const entry: any = { coach_questions: a.coach_questions ?? [], scheduled_dates: a.scheduled_dates ?? [] };
        if (at === 'quiz') { entry.num_questions = a.num_questions ?? 5; entry.questions_per_day = a.questions_per_day ?? 5; entry.frequency = a.config?.frequency ?? 'daily_once'; entry.modules = []; }
        if (at === 'talk') { entry.duration_minutes = a.duration_minutes ?? 10; entry.frequency = a.frequency ?? 'daily_once'; entry.probe_questions = []; entry.chatbot_questions = []; }
        if (at === 'tasks') { entry.tasks = []; entry.frequency = a.frequency ?? 'daily'; }
        if (at === 'knowledge') { entry.kps = []; }
        if (at === 'watch') { entry.watch = []; entry.frequency = a.frequency ?? 'weekly'; }
        if (at === 'parking') { entry.frequency = a.config?.frequency ?? 'daily_once'; }
        actMap[at] = entry;
      }
      // Load child records for each activity
      if (actMap.quiz) { const { data: mods } = await supabase.from('quiz_modules').select('id,title,position,frequency,time_of_day,num_questions,questions_per_day').eq('activity_id', actMap.quiz.id ?? (acts as any[])?.find(a => a.activity_type === 'quiz')?.id).order('position'); if (mods) for (const m of mods as any[]) { const { data: qs } = await supabase.from('quiz_questions').select('question,options,answer_index,image_url').eq('module_id', m.id).order('created_at'); m.questions = qs ?? []; } actMap.quiz.modules = mods ?? []; }
      const quizActId = (acts as any[])?.find(a => a.activity_type === 'quiz')?.id;
      if (actMap.tasks) { const ta = (acts as any[])?.find(a => a.activity_type === 'tasks')?.id; const { data: ts } = await supabase.from('cc_tasks').select('task_text,frequency,time_of_day,start_date,end_date').eq('activity_id', ta).order('position'); actMap.tasks.tasks = (ts as any[])?.map(t => t.task_text) ?? []; }
      if (actMap.knowledge) { const ka = (acts as any[])?.find(a => a.activity_type === 'knowledge')?.id; const { data: kp } = await supabase.from('knowledge_points').select('point_text').eq('activity_id', ka).order('position'); actMap.knowledge.kps = (kp as any[])?.map(k => k.point_text) ?? []; }
      if (actMap.talk) { const ta = (acts as any[])?.find(a => a.activity_type === 'talk')?.id; const { data: tc } = await supabase.from('talk_config').select('prompts,chatbot_questions,coach_questions,duration_minutes,frequency').eq('activity_id', ta).maybeSingle(); if (tc) { actMap.talk.probe_questions = (tc as any).prompts ?? []; actMap.talk.chatbot_questions = (tc as any).chatbot_questions ?? []; actMap.talk.coach_questions = (tc as any).coach_questions ?? []; actMap.talk.duration_minutes = (tc as any).duration_minutes ?? 10; actMap.talk.frequency = (tc as any).frequency ?? 'daily_once'; } }
      if (actMap.watch) { const wa = (acts as any[])?.find(a => a.activity_type === 'watch')?.id; const { data: ws } = await supabase.from('watch_items').select('title,video_url,question').eq('activity_id', wa).order('position'); actMap.watch.watch = (ws as any[])?.map(w => ({ url: w.video_url, title: w.title, question: w.question })) ?? []; }
      if (actMap.parking) { const pa = (acts as any[])?.find(a => a.activity_type === 'parking')?.id; const { data: pc } = await supabase.from('parking_config').select('tags,frequency,prompt').eq('activity_id', pa).maybeSingle(); if (pc) { actMap.parking.tags = (pc as any).tags ?? []; } }
      if (!cancelled) {
        const parkingTags = actMap.parking?.tags ?? form.parkingTags;
        setForm((f: any) => ({ ...f, activities: actMap, parkingTags }));
        loadActivitySets(sid);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  const setGoal = (i: number, v: string) => setForm((f: any) => ({ ...f, goals: f.goals.map((g: string, j: number) => j === i ? v : g) }));

  const sessionNotesText = () => form.session_notes?.notes || form.session_notes?.upload_summary || '';

  const generateOne = async (act: string) => {
    setGenerating(g => ({ ...g, [act]: true })); setGenProgress(10); setGenStatus(`Generating ${act} with AI…`);
    try {
      const days = form.next_session_date ? Math.max(1, Math.ceil((new Date(form.next_session_date).getTime() - new Date(form.session_date || new Date().toISOString().slice(0, 10)).getTime()) / 86400000)) : 7;
      const goalsText = form.goals.filter(Boolean).join('; ');
      const sn = sessionNotesText();
      const goal = goalsText || form.topic;
      // Fetch coachee profile for context
      let coacheeProfile = '';
      if (enrolledEmailsForSession.length > 0) {
        const { data: profiles } = await supabase.from('coachees').select('client_name,profession,profession_details,marital_status,children,reasons_for_seeking,primary_goal,main_blocker').eq('email', enrolledEmailsForSession[0]).maybeSingle();
        if (profiles) {
          coacheeProfile = `Name: ${profiles.client_name ?? ''}\nProfession: ${profiles.profession ?? ''} ${profiles.profession_details ?? ''}\nMarital status: ${profiles.marital_status ?? ''}\nChildren: ${profiles.children ?? 0}\nReasons for seeking: ${profiles.reasons_for_seeking ?? ''}\nPrimary goal: ${profiles.primary_goal ?? ''}\nMain blocker: ${profiles.main_blocker ?? ''}`;
        }
      }
      // Fetch capsule-level knowledge and previous session notes for context
      let capsuleKnowledge = '';
      let prevSessionContext = '';
      try {
        const { data: capRows } = await supabase.from('capsule_knowledge').select('consolidated_notes,extracted_text,file_name').eq('capsule_id', capsule.id);
        capsuleKnowledge = ((capRows as any[]) ?? []).map(r => r.consolidated_notes || r.extracted_text || `[${r.file_name}]`).join('\n\n').slice(0, 12000) || '';
        if (currentSessionId) {
          const { data: prevSess } = await supabase.from('coaching_sessions').select('topic,session_number,summary,session_notes,generated_summary').neq('id', currentSessionId).eq('capsule_id', capsule.id).order('session_number').limit(3);
          prevSessionContext = ((prevSess as any[]) ?? []).map(s => {
            const sn = Array.isArray(s.session_notes) ? (s.session_notes as any[])?.map((n: any) => typeof n === 'string' ? n : n?.notes || '').join('; ') : '';
            const sm = Array.isArray(s.summary) ? (s.summary as string[]).join('; ') : (s.generated_summary ?? '');
            return `Session ${s.session_number} (${s.topic}): Summary: ${sm}. Notes: ${sn}`;
          }).join('\n') || '';
        }
      } catch { /* silent */ }
      // Fetch session notes files for this session
      let sessionFilesText = '';
      if (currentSessionId) {
        const { data: sf } = await supabase.from('session_notes_files').select('extracted_text,file_name').eq('session_id', currentSessionId);
        sessionFilesText = ((sf as any[]) ?? []).map(f => f.extracted_text).filter(Boolean).join('\n\n').slice(0, 10000) || '';
      }
      const fullContext = [sn, capsuleKnowledge, prevSessionContext, sessionFilesText].filter(Boolean).join('\n\n---\n\n');
      let produced: any = null;
      if (act === 'quiz') {
        let quizFileText = '';
        if (currentSessionId) {
          const { data: qa } = await supabase.from('cc_activities').select('id').eq('session_id', currentSessionId).eq('activity_type', 'quiz').maybeSingle();
          if (qa) {
            const { data: qfs } = await supabase.from('quiz_files').select('extracted_text').eq('activity_id', (qa as any).id);
            quizFileText = (qfs as any[])?.map(f => f.extracted_text).filter(Boolean).join('\n\n').slice(0, 12000) ?? '';
          }
        }
        const r = await callLLM('coach_quiz_gen', { topic: form.topic, goal, goals: goalsText, audience: form.target_audience || 'general', days: String(days), session_notes: quizFileText || fullContext, num_questions: String(form.activities?.quiz?.num_questions ?? 5), questions_per_day: String(form.activities?.quiz?.questions_per_day ?? 5), coachee_profile: coacheeProfile });
        produced = parseJSON<any>(r);
        if (produced?.modules) {
          produced.modules = produced.modules.map((m: any) => ({
            ...m,
            questions: (m.questions ?? []).map((q: any) => {
              if (typeof q === 'string') {
                const parts = q.split('|');
                return { question: parts[0]?.trim() ?? '', options: [parts[1]??'', parts[2]??'', parts[3]??'', parts[4]??''].map((x:string)=>x.trim()), answer_index: Math.max(0, ['A','B','C','D'].indexOf((parts[5]??'A').trim().toUpperCase())) };
              }
              return q;
            })
          }));
        }
      }
      else if (act === 'tasks') { const r = await callLLM('coach_tasks_gen', { topic: form.topic, goal, goals: goalsText, days: String(days), session_notes: fullContext, coachee_profile: coacheeProfile }); const parsed = parseJSON<any>(r); produced = { tasks: parsed?.tasks ?? [], frequency: parsed?.frequency ?? 'daily' }; }
      else if (act === 'knowledge') { const r = await callLLM('coach_knowledge_gen', { topic: form.topic, goal, goals: goalsText, session_notes: fullContext, coachee_profile: coacheeProfile }); const parsed = parseJSON<any>(r); produced = { kps: parsed?.kps ?? [] }; }
      else if (act === 'watch') { const r = await callLLM('coach_watch_gen', { topic: form.topic, goal, goals: goalsText, session_notes: fullContext, coachee_profile: coacheeProfile }); const parsed = parseJSON<any>(r); produced = { watch: parsed?.watch ?? [], frequency: parsed?.frequency ?? 'weekly' }; }
      else if (act === 'talk') { const r = await callLLM('coach_talk_gen', { goal, topic: form.topic, session_notes: fullContext, coachee_profile: coacheeProfile }); produced = parseJSON<any>(r); if (produced && !produced.probe_questions && produced.prompts) { produced.probe_questions = produced.prompts; } }
      else if (act === 'parking') { const r = await callLLM('coach_parking_gen', { topic: form.topic, goal, goals: goalsText, session_notes: fullContext, coachee_profile: coacheeProfile }); produced = parseJSON<any>(r); }
      setGenProgress(100); setGenStatus(`${act} generated.`);
      setForm((f: any) => {
        const acts = { ...(f.activities ?? {}) };
        acts[act] = produced;
        if (act === 'parking' && produced?.tags) return { ...f, activities: acts, parkingTags: produced.tags };
        return { ...f, activities: acts };
      });
    } catch (e: any) { setGenStatus('Error: ' + e.message); }
    setGenerating(g => ({ ...g, [act]: false })); setTimeout(() => setGenProgress(0), 1500);
  };

  const persist = async (): Promise<string | null> => {
    if (!form.topic.trim()) { alert('Topic is required.'); return null; }
    if (persistingRef.current) return createdIdRef.current;
    persistingRef.current = true;
    setSaving(true);
    try {
    const sessionNum = session?.session_number ?? (sessionCount + 1);
    const uid = session?.session_uid ?? buildSessionUid(capsule.name, coach.coach_name, form.session_date || new Date().toISOString().slice(0, 10), sessionNum);
    const payload: any = {
      capsule_id: capsule.id, coach_id: coach.id, session_uid: uid, topic: form.topic,
      session_date: form.session_date || null, session_from_dt: form.session_from_dt ? istLocalToISO(form.session_from_dt) : null, session_to_dt: form.session_to_dt ? istLocalToISO(form.session_to_dt) : null, status: form.session_from_dt ? (new Date(istLocalToISO(form.session_from_dt)) > new Date() ? 'Scheduled' : 'Completed') : 'Draft', goals: [], target_audience: form.target_audience || null,
      next_session_date: form.next_session_date || null, decks: form.decks, session_notes: form.session_notes,
      is_public: form.is_public, is_active: form.is_active, is_submitted: false,
      activation_date: form.activation_date || null, deactivation_date: form.deactivation_date || null,
      session_number: sessionNum, summary: form.summary, capsule_type: form.capsule_type,
    };
    let sessionId = session?.id ?? createdIdRef.current;
    if (sessionId) {
      const { error: updErr } = await supabase.from('coaching_sessions').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', sessionId);
      if (updErr) { alert('Failed to update session: ' + updErr.message); return null; }
    } else {
      const { data, error } = await supabase.from('coaching_sessions').insert(payload).select().single();
      if (error) { alert('Failed to create session: ' + error.message); return null; }
      sessionId = (data as any).id;
      createdIdRef.current = sessionId;
    }
    const acts = form.activities ?? {};
    const sel = form.selectedActivities;
    if (sessionId) {
      // Ensure an activity set exists — create default Set A if none
      let currentActiveSetId = activeSetId;
      if (!currentActiveSetId) {
        const { data: existingSets } = await supabase.from('activity_sets').select('id,is_active').eq('session_id', sessionId).order('created_at');
        const activeSet = (existingSets as any[])?.find(s => s.is_active);
        if (activeSet) {
          currentActiveSetId = activeSet.id;
        } else {
          const { data: newSet } = await supabase.from('activity_sets').insert({ session_id: sessionId, set_name: 'Set A', set_label: 'A', is_active: true, is_locked: false }).select().single();
          currentActiveSetId = (newSet as any)?.id ?? null;
        }
        if (currentActiveSetId) setActiveSetId(currentActiveSetId);
      }
      // Quiz — always upsert cc_activities row when toggled on; only sync child rows if modules exist
      if (sel.includes('quiz')) {
        if (!acts.quiz) acts.quiz = { modules: [], coach_questions: [], scheduled_dates: [] };
        const { data: act, error: actErr } = await supabase.from('cc_activities').upsert({ session_id: sessionId, activity_type: 'quiz', activity_set_id: currentActiveSetId, is_active_set: true, is_enabled: true, frequency: 'daily_once', selected_activities: sel, coach_questions: acts.quiz.coach_questions ?? [], scheduled_dates: acts.quiz.scheduled_dates ?? [], num_questions: acts.quiz.num_questions ?? 5, questions_per_day: acts.quiz.questions_per_day ?? 5, config: { frequency: acts.quiz.frequency ?? 'daily_once' } }, { onConflict: 'session_id,activity_type' }).select().single();
        if (actErr) { alert('Failed to save quiz activity: ' + actErr.message); return null; }
        if (act && acts.quiz.modules?.length > 0) {
          await supabase.from('quiz_modules').delete().eq('activity_id', (act as any).id);
          for (let mi = 0; mi < acts.quiz.modules.length; mi++) {
            const m = acts.quiz.modules[mi];
            const { data: modRow } = await supabase.from('quiz_modules').insert({ activity_id: (act as any).id, title: m.title, position: mi, frequency: m.frequency || 'daily_once', time_of_day: m.time_of_day || 'anytime', days_per_week: 7, num_questions: m.num_questions ?? acts.quiz.num_questions ?? 5, questions_per_day: m.questions_per_day ?? acts.quiz.questions_per_day ?? 5 }).select().single();
            if (modRow && m.questions) {
              const qRows = m.questions.map((q: any) => {
                if (typeof q === 'string') { const parts = String(q).split('|'); return { module_id: (modRow as any).id, question: parts[0]?.trim() ?? '', options: [parts[1]??'', parts[2]??'', parts[3]??'', parts[4]??''].map((x:string)=>(x??'').trim()), answer_index: Math.max(0, ['A','B','C','D'].indexOf((parts[5]??'A').trim().toUpperCase())), image_url: STOCK_IMAGES.quiz[mi % STOCK_IMAGES.quiz.length] }; }
                return { module_id: (modRow as any).id, question: q.question ?? '', options: q.options ?? ['', '', '', ''], answer_index: q.answer_index ?? 0, image_url: STOCK_IMAGES.quiz[mi % STOCK_IMAGES.quiz.length] };
              }).filter((q: any) => q.question);
              if (qRows.length) await supabase.from('quiz_questions').insert(qRows);
            }
          }
        }
      }
      // Tasks
      if (sel.includes('tasks')) {
        if (!acts.tasks) acts.tasks = { tasks: [], coach_questions: [], scheduled_dates: [] };
        const { data: act, error: actErr } = await supabase.from('cc_activities').upsert({ session_id: sessionId, activity_type: 'tasks', activity_set_id: currentActiveSetId, is_active_set: true, is_enabled: true, frequency: 'daily_once', selected_activities: sel, coach_questions: acts.tasks.coach_questions ?? [], scheduled_dates: acts.tasks.scheduled_dates ?? [] }, { onConflict: 'session_id,activity_type' }).select().single();
        if (actErr) { alert('Failed to save tasks activity: ' + actErr.message); return null; }
        if (act && acts.tasks.tasks?.length > 0) {
          await supabase.from('cc_tasks').delete().eq('activity_id', (act as any).id);
          const rows = acts.tasks.tasks.filter((t: string) => t?.trim()).map((t: string, i: number) => ({ activity_id: (act as any).id, sub_modality: 'Visual', task_text: t, frequency: 'daily', image_url: STOCK_IMAGES.tasks[i % STOCK_IMAGES.tasks.length], position: i, time_of_day: 'anytime', days_per_week: 7, start_date: form.session_date || null, end_date: form.next_session_date || null, times_per_day: 1 }));
          if (rows.length) await supabase.from('cc_tasks').insert(rows);
        }
      }
      // Knowledge
      if (sel.includes('knowledge')) {
        if (!acts.knowledge) acts.knowledge = { kps: [], coach_questions: [], scheduled_dates: [] };
        const { data: act, error: actErr } = await supabase.from('cc_activities').upsert({ session_id: sessionId, activity_type: 'knowledge', activity_set_id: currentActiveSetId, is_active_set: true, is_enabled: true, frequency: 'daily_once', selected_activities: sel }, { onConflict: 'session_id,activity_type' }).select().single();
        if (actErr) { alert('Failed to save knowledge activity: ' + actErr.message); return null; }
        if (act && acts.knowledge.kps?.length > 0) {
          await supabase.from('knowledge_points').delete().eq('activity_id', (act as any).id);
          const rows = acts.knowledge.kps.filter((p: string) => p?.trim()).map((p: string, i: number) => ({ activity_id: (act as any).id, point_text: p, image_url: STOCK_IMAGES.knowledge[i % STOCK_IMAGES.knowledge.length], position: i }));
          if (rows.length) await supabase.from('knowledge_points').insert(rows);
        }
      }
      // Talk — always upsert cc_activities row when toggled on
      if (sel.includes('talk')) {
        if (!acts.talk) acts.talk = { probe_questions: [], chatbot_questions: [], coach_questions: [], scheduled_dates: [], duration_minutes: 10, frequency: 'daily_once' };
        const { data: act, error: actErr } = await supabase.from('cc_activities').upsert({ session_id: sessionId, activity_type: 'talk', activity_set_id: currentActiveSetId, is_active_set: true, is_enabled: true, frequency: acts.talk.frequency || 'daily_once', duration_minutes: acts.talk.duration_minutes || 10, selected_activities: sel, coach_questions: acts.talk.coach_questions ?? [], scheduled_dates: acts.talk.scheduled_dates ?? [] }, { onConflict: 'session_id,activity_type' }).select().single();
        if (actErr) { alert('Failed to save talk activity: ' + actErr.message); return null; }
        if (act && (acts.talk.probe_questions?.length > 0 || acts.talk.chatbot_questions?.length > 0 || acts.talk.coach_questions?.length > 0)) {
          await supabase.from('talk_config').delete().eq('activity_id', (act as any).id);
          await supabase.from('talk_config').insert({ activity_id: (act as any).id, prompts: acts.talk.probe_questions ?? [], chatbot_questions: acts.talk.chatbot_questions ?? [], coach_questions: acts.talk.coach_questions ?? [], metrics: [], duration_minutes: acts.talk.duration_minutes || 10, frequency: acts.talk.frequency || 'daily_once' });
        }
      }
      // Watch
      if (sel.includes('watch')) {
        if (!acts.watch) acts.watch = { watch: [], coach_questions: [], scheduled_dates: [] };
        const { data: act, error: actErr } = await supabase.from('cc_activities').upsert({ session_id: sessionId, activity_type: 'watch', activity_set_id: currentActiveSetId, is_active_set: true, is_enabled: true, frequency: 'weekly', selected_activities: sel, coach_questions: acts.watch.coach_questions ?? [], scheduled_dates: acts.watch.scheduled_dates ?? [] }, { onConflict: 'session_id,activity_type' }).select().single();
        if (actErr) { alert('Failed to save watch activity: ' + actErr.message); return null; }
        if (act && acts.watch.watch?.length > 0) {
          await supabase.from('watch_items').delete().eq('activity_id', (act as any).id);
          const rows = acts.watch.watch.filter((w: any) => w.url?.trim()).map((w: any, i: number) => ({ activity_id: (act as any).id, video_url: w.url, title: w.title || '', thumbnail_url: STOCK_IMAGES.watch[0], question: w.question || 'What did you learn from this video?', frequency: 'weekly', position: i, start_date: form.session_date || null, end_date: form.next_session_date || null, times_per_day: 1, time_of_day: 'anytime', days_per_week: 7 }));
          if (rows.length) await supabase.from('watch_items').insert(rows);
        }
      }
      // Parking
      if (sel.includes('parking')) {
        const { data: act, error: actErr } = await supabase.from('cc_activities').upsert({ session_id: sessionId, activity_type: 'parking', activity_set_id: currentActiveSetId, is_active_set: true, is_enabled: true, frequency: 'daily_once', selected_activities: sel, coach_questions: acts.parking?.coach_questions ?? [], scheduled_dates: acts.parking?.scheduled_dates ?? [], config: { tags: form.parkingTags ?? [], frequency: acts.parking?.frequency ?? 'daily_once' } }, { onConflict: 'session_id,activity_type' }).select().single();
        if (actErr) { alert('Failed to save parking activity: ' + actErr.message); return null; }
        if (act) {
          await supabase.from('parking_config').delete().eq('activity_id', (act as any).id);
          await supabase.from('parking_config').insert({ activity_id: (act as any).id, tags: form.parkingTags ?? [], frequency: acts.parking?.frequency ?? 'daily_once', prompt: 'Park your thoughts here' });
        }
      }
    }
    setSavedSessionId(sessionId ?? null);
    // Sync to coach_bookings so the Booking tab and calendar reflect coach-planned sessions
    if (sessionId && form.session_from_dt) {
      const bookingDate = form.session_date || form.session_from_dt.slice(0, 10);
      const startTime = form.session_from_dt.slice(11, 16);
      const endTime = form.session_to_dt ? form.session_to_dt.slice(11, 16) : startTime;
      const { data: existingBooking } = await supabase.from('coach_bookings').select('id').eq('session_id', sessionId).maybeSingle();
      const fromISO = istLocalToISO(form.session_from_dt);
      const isUpcoming = new Date(fromISO) > new Date();
      if (existingBooking) {
        await supabase.from('coach_bookings').update({
          booking_date: bookingDate, start_time: startTime, end_time: endTime,
          capsule_id: capsule.id, is_standalone: false, status: isUpcoming ? 'confirmed' : 'completed',
        }).eq('id', (existingBooking as any).id);
      } else {
        await supabase.from('coach_bookings').insert({
          coach_id: coach.id, coachee_name: null, coachee_email: null,
          booking_date: bookingDate, start_time: startTime, end_time: endTime,
          capsule_id: capsule.id, session_id: sessionId, is_standalone: false,
          status: isUpcoming ? 'confirmed' : 'completed',
        });
      }
    }
    return sessionId ?? null;
  } finally {
    setSaving(false);
    persistingRef.current = false;
  }
  };

  const toggleActivity = (act: string) => setForm((f: any) => {
    const enabled = f.selectedActivities.includes(act);
    const nextSel = enabled ? f.selectedActivities.filter((a: string) => a !== act) : [...f.selectedActivities, act];
    if (enabled && f.activities) {
      const a = { ...f.activities }; delete a[act];
      return { ...f, selectedActivities: nextSel, activities: a };
    }
    return { ...f, selectedActivities: nextSel };
  });
  // Coach questions helpers (up to 3 per activity)
  const addCoachQuestion = (act: string) => setForm((f: any) => { const nf = ensureAct(f, act, {}); const cqs = [...(nf.activities[act].coach_questions ?? [])]; if (cqs.length < 3) cqs.push(''); return { ...nf, activities: { ...nf.activities, [act]: { ...nf.activities[act], coach_questions: cqs } } }; });
  const removeCoachQuestion = (act: string, i: number) => setForm((f: any) => { if (!f.activities?.[act]?.coach_questions) return f; return { ...f, activities: { ...f.activities, [act]: { ...f.activities[act], coach_questions: f.activities[act].coach_questions.filter((_: any, j: number) => j !== i) } } }; });
  const setCoachQuestionVal = (act: string, i: number, v: string) => setForm((f: any) => { if (!f.activities?.[act]?.coach_questions) return f; return { ...f, activities: { ...f.activities, [act]: { ...f.activities[act], coach_questions: f.activities[act].coach_questions.map((x: string, j: number) => j === i ? v : x) } } }; });
  // Scheduled dates helper
  const toggleScheduledDate = (act: string, date: string) => setForm((f: any) => { const nf = ensureAct(f, act, {}); const dates = nf.activities[act].scheduled_dates ?? []; return { ...nf, activities: { ...nf.activities, [act]: { ...nf.activities[act], scheduled_dates: dates.includes(date) ? dates.filter((d: string) => d !== date) : [...dates, date].sort() } } }; });
  const addParkingTag = (t: string) => setForm((f: any) => ({ ...f, parkingTags: f.parkingTags.includes(t) ? f.parkingTags : [...f.parkingTags, t] }));
  const removeParkingTag = (t: string) => setForm((f: any) => ({ ...f, parkingTags: f.parkingTags.filter((x: string) => x !== t) }));
  // Activity helpers — initialize structure lazily so manual Add works before AI generation
  const ensureAct = (f: any, act: string, init: any) => { const a = f.activities ?? {}; if (!a[act]) a[act] = init; return { ...f, activities: a }; };
  const addProbeQ = () => setForm((f: any) => { const nf = ensureAct(f, 'talk', { probe_questions: [], duration_minutes: 10, frequency: 'daily_once' }); return { ...nf, activities: { ...nf.activities, talk: { ...nf.activities.talk, probe_questions: [...(nf.activities.talk.probe_questions ?? []), ''] } } }; });
  const addTask = () => setForm((f: any) => { const nf = ensureAct(f, 'tasks', { tasks: [] }); return { ...nf, activities: { ...nf.activities, tasks: { ...nf.activities.tasks, tasks: [...(nf.activities.tasks.tasks ?? []), ''] } } }; });
  const addKp = () => setForm((f: any) => { const nf = ensureAct(f, 'knowledge', { kps: [] }); return { ...nf, activities: { ...nf.activities, knowledge: { ...nf.activities.knowledge, kps: [...(nf.activities.knowledge.kps ?? []), ''] } } }; });
  const addWatchVid = () => setForm((f: any) => { const nf = ensureAct(f, 'watch', { watch: [] }); return { ...nf, activities: { ...nf.activities, watch: { ...nf.activities.watch, watch: [...(nf.activities.watch.watch ?? []), { url: '', title: '', question: '' }] } } }; });
  const addQuizModule = () => setForm((f: any) => {
    const nf = ensureAct(f, 'quiz', { modules: [], num_questions: 5, questions_per_day: 5 });
    const newMod = { title: '', frequency: 'daily_once', time_of_day: 'anytime', questions: [{ question: '', options: ['', '', '', ''], answer_index: 0 }] };
    return { ...nf, activities: { ...nf.activities, quiz: { ...nf.activities.quiz, modules: [...(nf.activities.quiz.modules ?? []), newMod] } } };
  });
  const addQuizQuestion = (mi: number) => setForm((f: any) => { if (!f.activities?.quiz?.modules?.[mi]) return f; const mods = [...f.activities.quiz.modules]; mods[mi] = { ...mods[mi], questions: [...(mods[mi].questions ?? []), { question: '', options: ['', '', '', ''], answer_index: 0 }] }; return { ...f, activities: { ...f.activities, quiz: { ...f.activities.quiz, modules: mods } } }; });
  const addParkingTagInput = () => setForm((f: any) => ({ ...f, parkingTags: [...(f.parkingTags ?? []), ''] }));
  const removeProbeQ = (i: number) => setForm((f: any) => { if (!f.activities?.talk?.probe_questions) return f; return { ...f, activities: { ...f.activities, talk: { ...f.activities.talk, probe_questions: f.activities.talk.probe_questions.filter((_: any, j: number) => j !== i) } } }; });
  const removeTask = (i: number) => setForm((f: any) => { if (!f.activities?.tasks?.tasks) return f; return { ...f, activities: { ...f.activities, tasks: { ...f.activities.tasks, tasks: f.activities.tasks.tasks.filter((_: any, j: number) => j !== i) } } }; });
  const removeKp = (i: number) => setForm((f: any) => { if (!f.activities?.knowledge?.kps) return f; return { ...f, activities: { ...f.activities, knowledge: { ...f.activities.knowledge, kps: f.activities.knowledge.kps.filter((_: any, j: number) => j !== i) } } }; });
  const removeWatchVid = (i: number) => setForm((f: any) => { if (!f.activities?.watch?.watch) return f; return { ...f, activities: { ...f.activities, watch: { ...f.activities.watch, watch: f.activities.watch.watch.filter((_: any, j: number) => j !== i) } } }; });
  const removeQuizModule = (mi: number) => setForm((f: any) => { if (!f.activities?.quiz?.modules) return f; return { ...f, activities: { ...f.activities, quiz: { ...f.activities.quiz, modules: f.activities.quiz.modules.filter((_: any, j: number) => j !== mi) } } }; });
  const removeQuizQuestion = (mi: number, qi: number) => setForm((f: any) => { if (!f.activities?.quiz?.modules?.[mi]) return f; const mods = [...f.activities.quiz.modules]; mods[mi] = { ...mods[mi], questions: mods[mi].questions.filter((_: any, j: number) => j !== qi) }; return { ...f, activities: { ...f.activities, quiz: { ...f.activities.quiz, modules: mods } } }; });
  const removeParkingTagInput = (i: number) => setForm((f: any) => ({ ...f, parkingTags: (f.parkingTags ?? []).filter((_: any, j: number) => j !== i) }));
  const loadActivitySets = async (sessionId: string) => {
    const { data } = await supabase.from('activity_sets').select('*').eq('session_id', sessionId).order('created_at');
    const sets = (data as any[]) ?? [];
    setActivitySets(sets);
    const active = sets.find(s => s.is_active);
    setActiveSetId(active?.id ?? sets[0]?.id ?? '');
  };
  const createActivitySet = async (copyFromId?: string) => {
    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = await persist() ?? null;
    }
    if (!sessionId) return;
    const nextLabel = String.fromCharCode(65 + activitySets.length);
    const { data: newSet } = await supabase.from('activity_sets').insert({ session_id: sessionId, set_name: `Set ${nextLabel}`, set_label: nextLabel, is_active: false, is_locked: false }).select().single();
    if (newSet) {
      if (copyFromId) {
        const { data: oldActs } = await supabase.from('cc_activities').select('*').eq('activity_set_id', copyFromId);
        for (const oldAct of (oldActs as any[]) ?? []) {
          const { id, ...rest } = oldAct;
          await supabase.from('cc_activities').insert({ ...rest, activity_set_id: (newSet as any).id, is_active_set: false });
        }
      }
      await loadActivitySets(sessionId);
    }
  };
  const activateSet = async (setId: string) => {
    if (!currentSessionId) return;
    await supabase.from('activity_sets').update({ is_active: false }).eq('session_id', currentSessionId);
    await supabase.from('activity_sets').update({ is_active: true, is_locked: false }).eq('id', setId);
    await supabase.from('cc_activities').update({ is_active_set: false }).eq('session_id', currentSessionId);
    await supabase.from('cc_activities').update({ is_active_set: true }).eq('activity_set_id', setId);
    setActiveSetId(setId);
    await loadActivitySets(currentSessionId);
  };
  const filteredCoachees = coachees;

  useEffect(() => {
    if (currentSessionId) loadActivitySets(currentSessionId);
  }, [currentSessionId]);

  return (
    <div className="space-y-4">
      {showNotesEditor && currentSessionId && (
        <NotesEditorModal
          sessionId={currentSessionId}
          capsuleType={form.capsule_type}
          capsuleGoal={capsule.capsule_goal ?? capsule.description ?? ''}
          capsuleId={capsule.id}
          coacheeEmails={enrolledEmailsForSession}
          onClose={() => setShowNotesEditor(false)}
          onSave={() => {}}
        />
      )}
      {/* Header with part tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="text-xs text-teal-600 hover:text-teal-700 flex items-center gap-1"><ChevronLeft className="w-3.5 h-3.5" /> Back to {capsule.name}</button>
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          <button onClick={() => setPart(1)} className={`text-xs font-semibold px-3 py-1.5 rounded-md ${part === 1 ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-500'}`}>Part 1: Details</button>
          <button onClick={() => setPart(2)} className={`text-xs font-semibold px-3 py-1.5 rounded-md ${part === 2 ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-500'}`}>Part 2: Activities</button>
        </div>
      </div>
      <p className="text-sm font-bold text-gray-800">{session ? `Edit Session ${session.session_number}` : 'New Session'} · {capsule.name} · <span className={form.capsule_type === 'Training' ? 'text-sky-600' : 'text-teal-600'}>{form.capsule_type}</span></p>

      {part === 1 && (
        <div className="space-y-4">
          <Input label="Session topic" value={form.topic} onChange={(v) => setForm((f: any) => ({ ...f, topic: v }))} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Session from date & time</label>
              <input type="datetime-local" value={form.session_from_dt} onChange={e => setForm((f: any) => ({ ...f, session_from_dt: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-teal-400 focus:ring-1 focus:ring-teal-100 outline-none" />
              {form.session_from_dt && availWarnings.from && <p className="text-xs text-amber-600 mt-1">{availWarnings.from}</p>}
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Session to date & time</label>
              <input type="datetime-local" value={form.session_to_dt} onChange={e => setForm((f: any) => ({ ...f, session_to_dt: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-teal-400 focus:ring-1 focus:ring-teal-100 outline-none" />
            </div>
            <Input label="Session date (legacy, optional)" type="date" value={form.session_date} onChange={(v) => setForm((f: any) => ({ ...f, session_date: v }))} />
            <Input label="Next session date (optional)" type="date" value={form.next_session_date} onChange={(v) => setForm((f: any) => ({ ...f, next_session_date: v }))} />
          </div>
          {/* Auto-status display */}
          {form.session_from_dt && (
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-gray-500">Session status:</span>
              <span className={`px-2 py-0.5 rounded-full font-bold ${new Date(istLocalToISO(form.session_from_dt)) > new Date() ? 'bg-sky-50 text-sky-700' : 'bg-emerald-50 text-emerald-700'}`}>
                {new Date(istLocalToISO(form.session_from_dt)) > new Date() ? 'Scheduled' : 'Completed'}
              </span>
              <span className="text-gray-400">(auto-updated based on from date & time)</span>
            </div>
          )}
          <Input label="Target audience" value={form.target_audience} onChange={(v) => setForm((f: any) => ({ ...f, target_audience: v }))} />

          {/* Session Notes Editor button */}
          <div className="bg-gradient-to-br from-sky-50 to-teal-50 rounded-xl p-4 border border-sky-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-700 flex items-center gap-1.5"><FileText className="w-4 h-4 text-teal-600" /> Session Notes</p>
                <p className="text-xs text-gray-500 mt-1">Open the notes editor to write, upload files, generate with AI, and organize by chapters.</p>
              </div>
              <button onClick={async () => { if (!currentSessionId) { const sid = await persist(); if (!sid) return; } setShowNotesEditor(true); }} className="flex items-center gap-1.5 text-xs text-white bg-teal-600 hover:bg-teal-700 rounded-lg px-4 py-2">
                <FileText className="w-3.5 h-3.5" /> Open Notes Editor
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={() => persist()} disabled={saving} className="flex items-center gap-1 text-xs text-white bg-teal-600 hover:bg-teal-700 px-4 py-2 rounded-lg disabled:opacity-60">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save
            </button>
          </div>
        </div>
      )}

      {part === 2 && (
        <div className="space-y-4">
          {/* Activity Sets header */}
          <div className="flex items-center justify-between bg-white rounded-xl border border-gray-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold text-gray-700">Activity Sets:</p>
              {activitySets.map(s => (
                <button key={s.id} onClick={() => s.id !== activeSetId && activateSet(s.id)} className={`text-xs px-2.5 py-1 rounded-lg border ${s.id === activeSetId ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-500 border-gray-200'}`}>
                  {s.set_name}{s.is_locked ? ' 🔒' : ''}
                </button>
              ))}
              <button onClick={() => createActivitySet(activeSetId)} className="text-xs text-teal-600 flex items-center gap-1"><Plus className="w-3 h-3" /> Copy & New</button>
            </div>
          </div>

          {/* Activity activation/deactivation dates */}
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Activity activation date</label>
              <input type="date" value={form.activation_date} onChange={e => setForm((f: any) => ({ ...f, activation_date: e.target.value }))}
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Activity deactivation date</label>
              <input type="date" value={form.deactivation_date} onChange={e => setForm((f: any) => ({ ...f, deactivation_date: e.target.value }))}
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg" />
            </div>
          </div>

          {/* Activity type selection */}
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Activities for this session (toggle to enable)</label>
            <div className="flex flex-wrap gap-1.5">
              {allActivityTypes.map(act => (
                <button key={act} onClick={() => toggleActivity(act)} type="button"
                  className={`text-xs px-2.5 py-1.5 rounded-lg border capitalize ${form.selectedActivities.includes(act) ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-400 border-gray-200 line-through'}`}>{act}</button>
              ))}
            </div>
          </div>
          <p className="text-xs text-gray-500">Part 2 (Activities) is optional. Save the session without any activities if needed. Once a set is activated, it cannot be changed — copy it to create a new set.</p>

            {/* TALK */}
            <ActivityCard title="Talk" icon={<MessageSquare className="w-4 h-4 text-teal-600" />} enabled={form.selectedActivities.includes('talk')}
              onToggle={() => toggleActivity('talk')} onGenerate={() => generateOne('talk')} generating={generating['talk']}>
              <div className="space-y-2">
                <div className="flex gap-2 items-center">
                  <label className="text-xs text-gray-500">Duration (min):</label>
                  <input type="number" min={1} max={60} value={form.activities?.talk?.duration_minutes ?? 10} onChange={e => setForm((f: any) => ({ ...f, activities: { ...f.activities, talk: { ...(f.activities?.talk ?? {}), duration_minutes: +e.target.value } } }))}
                    className="w-16 px-2 py-1 text-xs border border-gray-200 rounded-lg" />
                </div>
                {/* Coach questions */}
                <CoachQuestionsEditor act="talk" questions={form.activities?.talk?.coach_questions ?? []} onAdd={() => addCoachQuestion('talk')} onRemove={(i) => removeCoachQuestion('talk', i)} onChange={(i, v) => setCoachQuestionVal('talk', i, v)} />
                {/* Scheduled dates */}
                <ScheduledDatesEditor act="talk" dates={form.activities?.talk?.scheduled_dates ?? []} activationDate={form.activation_date} deactivationDate={form.deactivation_date} onToggle={(d) => toggleScheduledDate('talk', d)} />
                {/* Probe questions */}
                <div className="flex items-center justify-between pt-1">
                  <p className="text-xs font-semibold text-gray-600">Probe questions</p>
                  <button onClick={addProbeQ} className="text-xs text-teal-600 flex items-center gap-1"><Plus className="w-3 h-3" /> Add question</button>
                </div>
                {(form.activities?.talk?.probe_questions ?? []).map((p: string, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-4">{i + 1}.</span>
                    <input value={p} onChange={e => setForm((f: any) => ({ ...f, activities: { ...f.activities, talk: { ...f.activities.talk, probe_questions: f.activities.talk.probe_questions.map((x: string, j: number) => j === i ? e.target.value : x) } } }))}
                      className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded-lg" placeholder={`Probe question ${i + 1}`} />
                    <button onClick={() => removeProbeQ(i)} className="text-red-500 p-0.5"><Trash2 className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            </ActivityCard>

            {/* TASKS */}
            <ActivityCard title="Tasks" icon={<CheckSquare className="w-4 h-4 text-teal-600" />} enabled={form.selectedActivities.includes('tasks')}
              onToggle={() => toggleActivity('tasks')} onGenerate={() => generateOne('tasks')} generating={generating['tasks']}>
              <div className="space-y-2">
                <CoachQuestionsEditor act="tasks" questions={form.activities?.tasks?.coach_questions ?? []} onAdd={() => addCoachQuestion('tasks')} onRemove={(i) => removeCoachQuestion('tasks', i)} onChange={(i, v) => setCoachQuestionVal('tasks', i, v)} />
                <ScheduledDatesEditor act="tasks" dates={form.activities?.tasks?.scheduled_dates ?? []} activationDate={form.activation_date} deactivationDate={form.deactivation_date} onToggle={(d) => toggleScheduledDate('tasks', d)} />
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">Reflection prompt:</label>
                  <input value={form.activities?.tasks?.reflection_prompt ?? ''} onChange={e => setForm((f: any) => ({ ...f, activities: { ...f.activities, tasks: { ...f.activities.tasks, reflection_prompt: e.target.value } } }))}
                    className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded-lg" placeholder="What did you learn?" />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-600">Tasks list</p>
                  <button onClick={addTask} className="text-xs text-teal-600 flex items-center gap-1"><Plus className="w-3 h-3" /> Add task</button>
                </div>
                {(form.activities?.tasks?.tasks ?? []).map((t: string, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-4">{i + 1}.</span>
                    <input value={t} onChange={e => setForm((f: any) => ({ ...f, activities: { ...f.activities, tasks: { ...f.activities.tasks, tasks: f.activities.tasks.tasks.map((x: string, j: number) => j === i ? e.target.value : x) } } }))}
                      className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded-lg" placeholder={`Task ${i + 1}`} />
                    <button onClick={() => removeTask(i)} className="text-red-500 p-0.5"><Trash2 className="w-3 h-3" /></button>
                  </div>
                ))}
                {(form.activities?.tasks?.tasks ?? []).length === 0 && <p className="text-xs text-gray-400 italic">No tasks yet. Click "Add task" or "Generate with AI".</p>}
              </div>
            </ActivityCard>

            {/* KNOWLEDGE */}
            <ActivityCard title="Knowledge" icon={<BookOpen className="w-4 h-4 text-teal-600" />} enabled={form.selectedActivities.includes('knowledge')}
              onToggle={() => toggleActivity('knowledge')} onGenerate={() => generateOne('knowledge')} generating={generating['knowledge']}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-600">Knowledge points (max 30 words each)</p>
                <button onClick={addKp} className="text-xs text-teal-600 flex items-center gap-1"><Plus className="w-3 h-3" /> Add</button>
              </div>
              {(form.activities?.knowledge?.kps ?? []).map((p: string, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-4">{i + 1}.</span>
                  <input value={p} onChange={e => setForm((f: any) => ({ ...f, activities: { ...f.activities, knowledge: { ...f.activities.knowledge, kps: f.activities.knowledge.kps.map((x: string, j: number) => j === i ? e.target.value : x) } } }))}
                    className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded-lg" placeholder={`Knowledge point ${i + 1}`} />
                  <button onClick={() => removeKp(i)} className="text-red-500 p-0.5"><Trash2 className="w-3 h-3" /></button>
                </div>
              ))}
              {(form.activities?.knowledge?.kps ?? []).length === 0 && <p className="text-xs text-gray-400 italic">No knowledge points yet.</p>}
            </ActivityCard>

            {/* PARKING */}
            <ActivityCard title="Parking" icon={<Tag className="w-4 h-4 text-amber-500" />} enabled={form.selectedActivities.includes('parking')}
              onToggle={() => toggleActivity('parking')} onGenerate={() => generateOne('parking')} generating={generating['parking']}>
              <div className="space-y-2">
                <CoachQuestionsEditor act="parking" questions={form.activities?.parking?.coach_questions ?? []} onAdd={() => addCoachQuestion('parking')} onRemove={(i) => removeCoachQuestion('parking', i)} onChange={(i, v) => setCoachQuestionVal('parking', i, v)} />
                <ScheduledDatesEditor act="parking" dates={form.activities?.parking?.scheduled_dates ?? []} activationDate={form.activation_date} deactivationDate={form.deactivation_date} onToggle={(d) => toggleScheduledDate('parking', d)} />
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-600">Parking tags</p>
                  <button onClick={addParkingTagInput} className="text-xs text-teal-600 flex items-center gap-1"><Plus className="w-3 h-3" /> Add tag</button>
                </div>
                {(form.parkingTags ?? []).map((t: string, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <Tag className="w-3 h-3 text-amber-500" />
                    <input value={t} onChange={e => setForm((f: any) => ({ ...f, parkingTags: f.parkingTags.map((x: string, j: number) => j === i ? e.target.value : x) }))}
                      className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded-lg" placeholder={`Tag ${i + 1}`} />
                    <button onClick={() => removeParkingTagInput(i)} className="text-red-500 p-0.5"><Trash2 className="w-3 h-3" /></button>
                  </div>
                ))}
                {(form.parkingTags ?? []).length === 0 && <p className="text-xs text-gray-400 italic">No tags yet.</p>}
              </div>
            </ActivityCard>

            {/* WATCH */}
            <ActivityCard title="Watch" icon={<Youtube className="w-4 h-4 text-teal-600" />} enabled={form.selectedActivities.includes('watch')}
              onToggle={() => toggleActivity('watch')} onGenerate={() => generateOne('watch')} generating={generating['watch']}>
              <div className="space-y-2">
                <CoachQuestionsEditor act="watch" questions={form.activities?.watch?.coach_questions ?? []} onAdd={() => addCoachQuestion('watch')} onRemove={(i) => removeCoachQuestion('watch', i)} onChange={(i, v) => setCoachQuestionVal('watch', i, v)} />
                <ScheduledDatesEditor act="watch" dates={form.activities?.watch?.scheduled_dates ?? []} activationDate={form.activation_date} deactivationDate={form.deactivation_date} onToggle={(d) => toggleScheduledDate('watch', d)} />
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">Reflection prompt:</label>
                  <input value={form.activities?.watch?.reflection_prompt ?? ''} onChange={e => setForm((f: any) => ({ ...f, activities: { ...f.activities, watch: { ...f.activities.watch, reflection_prompt: e.target.value } } }))}
                    className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded-lg" placeholder="What did you learn?" />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-600">Watch videos</p>
                  <button onClick={addWatchVid} className="text-xs text-teal-600 flex items-center gap-1"><Plus className="w-3 h-3" /> Add video</button>
                </div>
                {(form.activities?.watch?.watch ?? []).map((w: any, i: number) => (
                  <div key={i} className="border-l-2 border-teal-200 pl-2 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <input value={w.url} onChange={e => setForm((f: any) => ({ ...f, activities: { ...f.activities, watch: { ...f.activities.watch, watch: f.activities.watch.watch.map((x: any, j: number) => j === i ? { ...x, url: e.target.value } : x) } } }))}
                        className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded-lg" placeholder="https://www.youtube.com/watch?v=..." />
                      <button onClick={() => removeWatchVid(i)} className="text-red-500 p-0.5"><Trash2 className="w-3 h-3" /></button>
                    </div>
                    <input value={w.title} onChange={e => setForm((f: any) => ({ ...f, activities: { ...f.activities, watch: { ...f.activities.watch, watch: f.activities.watch.watch.map((x: any, j: number) => j === i ? { ...x, title: e.target.value } : x) } } }))}
                      className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg" placeholder="Video title" />
                    <input value={w.question} onChange={e => setForm((f: any) => ({ ...f, activities: { ...f.activities, watch: { ...f.activities.watch, watch: f.activities.watch.watch.map((x: any, j: number) => j === i ? { ...x, question: e.target.value } : x) } } }))}
                      className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg" placeholder="Reflection question" />
                  </div>
                ))}
                {(form.activities?.watch?.watch ?? []).length === 0 && <p className="text-xs text-gray-400 italic">No videos yet.</p>}
              </div>
            </ActivityCard>

            {/* QUIZ */}
            <ActivityCard title="Quiz" icon={<HelpCircle className="w-4 h-4 text-teal-600" />} enabled={form.selectedActivities.includes('quiz')}
              onToggle={() => toggleActivity('quiz')} onGenerate={() => generateOne('quiz')} generating={generating['quiz']}>
              <div className="space-y-3">
                <CoachQuestionsEditor act="quiz" questions={form.activities?.quiz?.coach_questions ?? []} onAdd={() => addCoachQuestion('quiz')} onRemove={(i) => removeCoachQuestion('quiz', i)} onChange={(i, v) => setCoachQuestionVal('quiz', i, v)} />
                <ScheduledDatesEditor act="quiz" dates={form.activities?.quiz?.scheduled_dates ?? []} activationDate={form.activation_date} deactivationDate={form.deactivation_date} onToggle={(d) => toggleScheduledDate('quiz', d)} />
                <div className="flex items-center gap-4 flex-wrap">
                  <label className="text-xs text-gray-500">Questions per module per session (X):</label>
                  <input type="number" min={1} max={20} value={form.activities?.quiz?.questions_per_day ?? 5} onChange={e => setForm((f: any) => ({ ...f, activities: { ...f.activities, quiz: { ...(f.activities?.quiz ?? {}), questions_per_day: +e.target.value } } }))}
                    className="w-16 px-2 py-1 text-xs border border-gray-200 rounded-lg" />
                  <label className="text-xs text-gray-500 ml-2">Questions to generate per module (Y):</label>
                  <input type="number" min={1} max={50} value={form.activities?.quiz?.num_questions ?? 5} onChange={e => setForm((f: any) => ({ ...f, activities: { ...f.activities, quiz: { ...(f.activities?.quiz ?? {}), num_questions: +e.target.value } } }))}
                    className="w-16 px-2 py-1 text-xs border border-gray-200 rounded-lg" />
                </div>
                {/* Quiz file upload */}
                <QuizFileUpload sessionId={currentSessionId ?? ''} ensureSessionId={persist} />
                <div className="flex items-center justify-between"><p className="text-xs font-semibold text-gray-600">Quiz modules</p>
                  <button onClick={addQuizModule} className="text-xs text-teal-600 flex items-center gap-1"><Plus className="w-3 h-3" /> Add module</button>
                </div>
                {(form.activities?.quiz?.modules ?? []).map((m: any, mi: number) => (
                  <div key={mi} className="border-l-2 border-teal-200 pl-2 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <input value={m.title} onChange={e => setForm((f: any) => ({ ...f, activities: { ...f.activities, quiz: { ...f.activities.quiz, modules: f.activities.quiz.modules.map((x: any, j: number) => j === mi ? { ...x, title: e.target.value } : x) } } }))}
                        className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded-lg" placeholder="Module title" />
                      <button onClick={() => removeQuizModule(mi)} className="text-red-500 p-0.5"><Trash2 className="w-3 h-3" /></button>
                    </div>
                    {(m.questions ?? []).map((q: any, qi: number) => (
                      <div key={qi} className="bg-gray-50 rounded-lg p-2 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 w-4">{qi + 1}.</span>
                          <input value={q.question ?? ''} onChange={e => setForm((f: any) => ({ ...f, activities: { ...f.activities, quiz: { ...f.activities.quiz, modules: f.activities.quiz.modules.map((x: any, j: number) => j === mi ? { ...x, questions: x.questions.map((qq: any, k: number) => k === qi ? { ...qq, question: e.target.value } : qq) } : x) } } }))}
                            className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded-lg" placeholder="Question text" />
                          <button onClick={() => removeQuizQuestion(mi, qi)} className="text-red-500 p-0.5"><Trash2 className="w-3 h-3" /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 ml-6">
                          {['A', 'B', 'C', 'D'].map((letter, oi) => (
                            <div key={oi} className="flex items-center gap-1.5">
                              <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
                                <input type="checkbox" checked={q.answer_index === oi} onChange={e => setForm((f: any) => ({ ...f, activities: { ...f.activities, quiz: { ...f.activities.quiz, modules: f.activities.quiz.modules.map((x: any, j: number) => j === mi ? { ...x, questions: x.questions.map((qq: any, k: number) => k === qi ? { ...qq, answer_index: e.target.checked ? oi : qq.answer_index } : qq) } : x) } } }))}
                                  className="w-3.5 h-3.5 rounded border-gray-300 text-teal-600" />
                                <span className="font-bold">{letter}</span>
                              </label>
                              <input value={q.options?.[oi] ?? ''} onChange={e => setForm((f: any) => ({ ...f, activities: { ...f.activities, quiz: { ...f.activities.quiz, modules: f.activities.quiz.modules.map((x: any, j: number) => j === mi ? { ...x, questions: x.questions.map((qq: any, k: number) => k === qi ? { ...qq, options: (qq.options ?? ['','','','']).map((opt: string, ok: number) => ok === oi ? e.target.value : opt) } : qq) } : x) } } }))}
                                className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded-lg" placeholder={`Option ${letter}`} />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    <button onClick={() => addQuizQuestion(mi)} className="text-xs text-teal-600 flex items-center gap-1"><Plus className="w-3 h-3" /> Add question</button>
                  </div>
                ))}
                {(form.activities?.quiz?.modules ?? []).length === 0 && <p className="text-xs text-gray-400 italic">No modules yet.</p>}
              </div>
            </ActivityCard>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => persist()} disabled={saving} className="flex items-center gap-1 text-xs text-white bg-teal-600 hover:bg-teal-700 px-4 py-2 rounded-lg disabled:opacity-60">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============ Coach Dashboard ============ */

function CoachDashboard({ coach }: { coach: Coach }) {
  const [loading, setLoading] = useState(true);
  const [capsules, setCapsules] = useState<Capsule[]>([]);
  const [selectedCapsule, setSelectedCapsule] = useState<Capsule | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [enrolledEmails, setEnrolledEmails] = useState<string[]>([]);
  const [selectedCoacheeEmail, setSelectedCoacheeEmail] = useState<string>('');
  const [coacheeMap, setCoacheeMap] = useState<Record<string, { email: string; userId?: string }>>({});
  const [viewMode, setViewMode] = useState<'sessions' | 'crossSession'>('sessions');
  const [crossData, setCrossData] = useState<any[]>([]);
  const [crossLoading, setCrossLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: caps } = await supabase.from('capsules').select('*').eq('coach_id', coach.id).order('created_at');
      setCapsules((caps as Capsule[]) ?? []);
      setLoading(false);
    })();
  }, [coach.id]);

  // Load sessions + enrolled coachees when capsule selected
  useEffect(() => {
    if (!selectedCapsule) return;
    (async () => {
      setLoading(true);
      const { data: sList } = await supabase.from('coaching_sessions').select('*').eq('capsule_id', selectedCapsule.id).order('session_number');
      setSessions((sList as any[]) ?? []);
      const { data: enrollments } = await supabase.from('capsule_enrollments').select('coachee_email').eq('capsule_id', selectedCapsule.id);
      const emails = ((enrollments as any[]) ?? []).map(e => e.coachee_email);
      const sIds = ((sList as any[]) ?? []).map(s => s.id);
      if (sIds.length) {
        const [{ data: noms }, { data: purs }] = await Promise.all([
          supabase.from('session_nominees').select('coachee_email').in('session_id', sIds),
          supabase.from('session_purchases').select('user_email').in('session_id', sIds),
        ]);
        (noms as any[])?.forEach(n => { if (n.coachee_email && !emails.includes(n.coachee_email)) emails.push(n.coachee_email); });
        (purs as any[])?.forEach(p => { if (p.user_email && !emails.includes(p.user_email)) emails.push(p.user_email); });
      }
      const uniqueEmails = [...new Set(emails)];
      setEnrolledEmails(uniqueEmails);
      // For coaching capsules, auto-select the single coachee
      if (selectedCapsule.capsule_type === 'Coaching' && uniqueEmails.length === 1) {
        setSelectedCoacheeEmail(uniqueEmails[0]);
      } else {
        setSelectedCoacheeEmail('');
      }
      const map: Record<string, { email: string; userId?: string }> = {};
      for (const email of uniqueEmails) {
        const { data: c } = await supabase.from('coachees').select('id').eq('email', email).maybeSingle();
        map[email] = { email, userId: (c as any)?.id };
      }
      setCoacheeMap(map);
      setLoading(false);
    })();
  }, [selectedCapsule]);

  const loadCrossSession = async () => {
    if (!selectedCapsule) return;
    setCrossLoading(true);
    const { data: sList } = await supabase.from('coaching_sessions').select('*').eq('capsule_id', selectedCapsule.id).order('session_number');
    const sIds = ((sList as any[]) ?? []).map(s => s.id);
    if (sIds.length === 0) { setCrossData([]); setCrossLoading(false); return; }
    const [{ data: allStars }, { data: allComps }, { data: allPt }] = await Promise.all([
      supabase.from('coach_stars').select('session_id,user_email,activity_type,stars').in('session_id', sIds),
      supabase.from('activity_completions').select('session_id,user_email,activity_type,completed_date').in('session_id', sIds),
      supabase.from('power_to_goal_summary').select('session_id,user_email,power_percentage').in('session_id', sIds),
    ]);
    const rows = ((sList as any[]) ?? []).map(s => {
      const sid = s.id;
      const sStars = (allStars as any[])?.filter(x => x.session_id === sid) ?? [];
      const sComps = (allComps as any[])?.filter(x => x.session_id === sid) ?? [];
      const sPt = (allPt as any[])?.filter(x => x.session_id === sid) ?? [];
      const filterByEmail = (arr: any[]) => selectedCoacheeEmail ? arr.filter(x => x.user_email === selectedCoacheeEmail) : arr;
      const fStars = filterByEmail(sStars);
      const fComps = filterByEmail(sComps);
      const fPt = filterByEmail(sPt);
      const totalStars = fStars.reduce((a, x) => a + (x.stars ?? 0), 0);
      const totalComps = fComps.length;
      const avgPower = fPt.length > 0 ? Math.round(fPt.reduce((a, x) => a + Number(x.power_percentage ?? 0), 0) / fPt.length) : 0;
      const coacheeCount = selectedCoacheeEmail ? 1 : new Set(sStars.map(x => x.user_email)).size;
      return { sessionNumber: s.session_number, topic: s.topic, sessionDate: s.session_date, totalStars, totalComps, avgPower, coacheeCount };
    });
    setCrossData(rows);
    setCrossLoading(false);
  };

  if (loading && !selectedCapsule) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 text-teal-500 animate-spin" /></div>;

  // Session-level dashboard view
  if (selectedCapsule && selectedSession) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <button onClick={() => setSelectedSession(null)} className="text-xs text-teal-600 hover:text-teal-700 mb-2 flex items-center gap-1"><ChevronLeft className="w-3.5 h-3.5" /> Back to {selectedCapsule.name}</button>
            <p className="text-sm font-bold text-gray-800">Session {selectedSession.session_number}: {selectedSession.topic}</p>
          </div>
          {enrolledEmails.length > 0 && (
            <select value={selectedCoacheeEmail} onChange={e => setSelectedCoacheeEmail(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-teal-400">
              <option value="">All coachees (consolidated)</option>
              {enrolledEmails.map(email => <option key={email} value={email}>{email}</option>)}
            </select>
          )}
        </div>
        {selectedCoacheeEmail ? (
          <SessionDashboard sessionId={selectedSession.id} userId={coacheeMap[selectedCoacheeEmail]?.userId ?? selectedCoacheeEmail} isCoach coacheeEmail={selectedCoacheeEmail} />
        ) : (
          <ConsolidatedDashboard sessionId={selectedSession.id} emails={enrolledEmails} coacheeMap={coacheeMap} />
        )}
      </div>
    );
  }

  if (selectedCapsule) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setSelectedCapsule(null)} className="text-xs text-teal-600 hover:text-teal-700 flex items-center gap-1"><ChevronLeft className="w-3.5 h-3.5" /> Back to capsules</button>
          <div className="flex items-center gap-3">
            {enrolledEmails.length > 0 && (
              <select value={selectedCoacheeEmail} onChange={e => { setSelectedCoacheeEmail(e.target.value); if (viewMode === 'crossSession') loadCrossSession(); }}
                className="text-xs border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-teal-400">
                <option value="">All coachees</option>
                {enrolledEmails.map(email => <option key={email} value={email}>{email}</option>)}
              </select>
            )}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
              <button onClick={() => setViewMode('sessions')} className={`text-xs font-semibold px-2.5 py-1 rounded-md ${viewMode === 'sessions' ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-500'}`}>Sessions</button>
              <button onClick={() => { setViewMode('crossSession'); loadCrossSession(); }} className={`text-xs font-semibold px-2.5 py-1 rounded-md ${viewMode === 'crossSession' ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-500'}`}>Cross-Session</button>
            </div>
          </div>
        </div>
        {viewMode === 'crossSession' ? (
          crossLoading ? <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 text-teal-500 animate-spin" /></div> : crossData.length === 0 ? (
            <p className="text-xs text-gray-400">No sessions in this capsule yet.</p>
          ) : (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <p className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-1.5"><BarChart3 className="w-4 h-4 text-teal-600" /> Cross-Session Progress — {selectedCapsule.name}</p>
                <p className="text-xs text-gray-500 mb-3">Metrics across all sessions in this capsule {selectedCoacheeEmail ? `for ${selectedCoacheeEmail}` : 'for all coachees'}.</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2 px-3 font-semibold text-gray-600">Session</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-600">Topic</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-600">Date</th>
                        <th className="text-center py-2 px-3 font-semibold text-gray-600">Stars</th>
                        <th className="text-center py-2 px-3 font-semibold text-gray-600">Completions</th>
                        <th className="text-center py-2 px-3 font-semibold text-gray-600">Power to Goal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {crossData.map((r, i) => (
                        <tr key={i} className="border-b border-gray-50">
                          <td className="py-2 px-3 text-gray-700 font-semibold">S{r.sessionNumber}</td>
                          <td className="py-2 px-3 text-gray-600">{r.topic}</td>
                          <td className="py-2 px-3 text-gray-500">{r.sessionDate || '—'}</td>
                          <td className="py-2 px-3 text-center text-amber-600 font-bold">{r.totalStars}</td>
                          <td className="py-2 px-3 text-center text-emerald-600 font-bold">{r.totalComps}</td>
                          <td className="py-2 px-3 text-center text-amber-600 font-bold">{r.avgPower}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Trend charts */}
                {crossData.length > 1 && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs font-bold text-gray-700 mb-2">Stars Trend</p>
                      <div className="flex items-end gap-2 h-20">
                        {crossData.map((r, i) => {
                          const max = Math.max(...crossData.map(x => x.totalStars), 1);
                          return <div key={i} className="flex-1 flex flex-col items-center gap-0.5"><div className="w-full bg-amber-400 rounded-t" style={{ height: `${(r.totalStars / max) * 100}%` }} /><span className="text-[10px] text-gray-400">S{r.sessionNumber}</span></div>;
                        })}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-700 mb-2">Completions Trend</p>
                      <div className="flex items-end gap-2 h-20">
                        {crossData.map((r, i) => {
                          const max = Math.max(...crossData.map(x => x.totalComps), 1);
                          return <div key={i} className="flex-1 flex flex-col items-center gap-0.5"><div className="w-full bg-emerald-400 rounded-t" style={{ height: `${(r.totalComps / max) * 100}%` }} /><span className="text-[10px] text-gray-400">S{r.sessionNumber}</span></div>;
                        })}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-700 mb-2">Power to Goal Trend</p>
                      <div className="flex items-end gap-2 h-20">
                        {crossData.map((r, i) => {
                          const max = Math.max(...crossData.map(x => x.avgPower), 1);
                          return <div key={i} className="flex-1 flex flex-col items-center gap-0.5"><div className="w-full bg-teal-400 rounded-t" style={{ height: `${(r.avgPower / max) * 100}%` }} /><span className="text-[10px] text-gray-400">S{r.sessionNumber}</span></div>;
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        ) : loading ? <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 text-teal-500 animate-spin" /></div> : sessions.length === 0 ? (
          <p className="text-xs text-gray-400">No sessions in this capsule yet.</p>
        ) : (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-xs font-bold text-gray-700 mb-2">Enrolled coachees ({enrolledEmails.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {enrolledEmails.map(e => <span key={e} className="text-xs px-2 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-200">{e}</span>)}
                {enrolledEmails.length === 0 && <span className="text-xs text-gray-400">No coachees enrolled.</span>}
              </div>
            </div>
            <div className="space-y-2">
              {sessions.map(s => (
                <div key={s.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-800">Session {s.session_number}: {s.topic}</p>
                    <p className="text-xs text-gray-400">{s.session_uid}</p>
                  </div>
                  <button onClick={() => { setSelectedSession(s); if (selectedCapsule.capsule_type === 'Coaching' && enrolledEmails.length === 1) setSelectedCoacheeEmail(enrolledEmails[0]); }}
                    className="text-xs text-teal-600 border border-teal-200 px-3 py-2 rounded-lg hover:bg-teal-50">View Dashboard</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Capsule selection view
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <p className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-1.5"><Star className="w-4 h-4 text-amber-500" /> Bragging Board — Select a Capsule</p>
        {capsules.length === 0 ? <p className="text-xs text-gray-400">No capsules yet.</p> : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {capsules.map(c => (
              <button key={c.id} onClick={() => setSelectedCapsule(c)}
                className="text-left p-4 rounded-xl border border-gray-100 hover:border-teal-200 hover:bg-teal-50/30 transition">
                <p className="text-sm font-bold text-gray-800">{c.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{c.capsule_type} · {c.is_public ? 'Public' : 'Private'} · {c.is_active ? 'Active' : 'Inactive'}</p>
                {c.description && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{c.description}</p>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Consolidated dashboard for all coachees — shows only Coach Insights + Thought Pattern Analysis
function ConsolidatedDashboard({ sessionId, emails, coacheeMap }: { sessionId: string; emails: string[]; coacheeMap: Record<string, { email: string; userId?: string }> }) {
  const [loading, setLoading] = useState(true);
  const [allStars, setAllStars] = useState<any[]>([]);
  const [allCompletions, setAllCompletions] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [session, setSession] = useState<any>(null);
  const [selectedActivity, setSelectedActivity] = useState<string>('');
  const [coachAnswer, setCoachAnswer] = useState<string>('');
  const [analyzingActivity, setAnalyzingActivity] = useState(false);
  const [chatMsgs, setChatMsgs] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [powerSummaries, setPowerSummaries] = useState<any[]>([]);
  const [powerTrend, setPowerTrend] = useState<{ sessionNumber: number; pct: number; topic: string }[]>([]);
  const [thoughtCoachee, setThoughtCoachee] = useState('');
  const [thoughtAnalysis, setThoughtAnalysis] = useState<ThoughtAnalysis | null>(null);
  const [thoughtLoading, setThoughtLoading] = useState(false);
  const [isTrainingCapsule, setIsTrainingCapsule] = useState(false);
  const [consolidatedQuiz, setConsolidatedQuiz] = useState<any[]>([]);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: stars }, { data: comps }, { data: sess }, { data: acts }] = await Promise.all([
        supabase.from('coach_stars').select('*').eq('session_id', sessionId),
        supabase.from('activity_completions').select('*').eq('session_id', sessionId),
        supabase.from('coaching_sessions').select('*').eq('id', sessionId).single(),
        supabase.from('cc_activities').select('*').eq('session_id', sessionId).eq('is_enabled', true),
      ]);
      setAllStars((stars as any[]) ?? []);
      setAllCompletions((comps as any[]) ?? []);
      setSession(sess);
      setActivities((acts as any[]) ?? []);
      // Load consolidated quiz results for all coachees
      const quizAct = (acts as any[])?.find(a => a.activity_type === 'quiz' && a.is_enabled);
      if (quizAct) {
        await loadConsolidatedQuiz(quizAct.id, (stars as any[]) ?? []);
      }
      // Load power to goal for all coachees (only for Coaching capsules)
      const { data: capData } = sess?.capsule_id ? await supabase.from('capsules').select('capsule_type').eq('id', sess.capsule_id).single() : { data: null };
      const isTraining = (capData as any)?.capsule_type === 'Training';
      setIsTrainingCapsule(isTraining);
      if (sess?.capsule_id && !isTraining) {
        const { data: ptSummaries } = await supabase.from('power_to_goal_summary').select('*').eq('session_id', sessionId);
        setPowerSummaries((ptSummaries as any[]) ?? []);
        // Trend across sessions
        const { data: allSessions } = await supabase.from('coaching_sessions').select('id,session_number,topic').eq('capsule_id', sess.capsule_id).order('session_number');
        const sList = (allSessions as any[]) ?? [];
        if (sList.length > 0) {
          const { data: allPtSummaries } = await supabase.from('power_to_goal_summary').select('session_id,power_percentage').in('session_id', sList.map(s => s.id));
          const ptMap: Record<string, number[]> = {};
          (allPtSummaries as any[])?.forEach(p => {
            if (!ptMap[p.session_id]) ptMap[p.session_id] = [];
            ptMap[p.session_id].push(Number(p.power_percentage ?? 0));
          });
          setPowerTrend(sList.map(s => ({
            sessionNumber: s.session_number,
            topic: s.topic,
            pct: ptMap[s.id]?.length ? Math.round(ptMap[s.id].reduce((a: number, b: number) => a + b, 0) / ptMap[s.id].length) : 0,
          })));
        }
      }
      setLoading(false);
    })();
  }, [sessionId]);

  const loadConsolidatedQuiz = async (quizActivityId: string, starsData: any[]) => {
    try {
      const { data: mods } = await supabase.from('quiz_modules').select('id,title,position').eq('activity_id', quizActivityId).order('position');
      const modList = (mods as any[]) ?? [];
      const quizStars = starsData.filter(s => s.activity_type === 'quiz');
      const results: any[] = [];
      for (const mod of modList) {
        const { count: totalQuestions } = await supabase.from('quiz_questions').select('id', { count: 'exact', head: true }).eq('module_id', mod.id);
        const { data: qs } = await supabase.from('quiz_questions').select('id,question').eq('module_id', mod.id);
        const qTexts = new Set((qs as any[])?.map(q => q.question) ?? []);
        const modStars = quizStars.filter(s => qTexts.has(s.reason));
        const correctAnswers = modStars.filter(s => s.stars > 0).length;
        results.push({ moduleId: mod.id, moduleTitle: mod.title, correct: correctAnswers, total: totalQuestions ?? 0 });
      }
      setConsolidatedQuiz(results);
    } catch { setConsolidatedQuiz([]); }
  };

  const ACTIVITY_LABELS: Record<string, string> = { talk: 'Talk', tasks: 'Tasks', parking: 'Parking', watch: 'Watch', quiz: 'Quiz', knowledge: 'Knowledge' };

  const analyzeActivity = async (actType: string) => {
    const act = activities.find(a => a.activity_type === actType);
    if (!act) return;
    setAnalyzingActivity(true);
    setCoachAnswer('');
    try {
      // Check cache for each coachee
      if (emails.length > 0) {
        const { data: cached } = await supabase.from('coach_insights_cache').select('*').eq('session_id', sessionId).eq('activity_type', actType).in('coachee_email', emails);
        if (cached && (cached as any[]).length > 0 && (cached as any[]).some(c => c.insights_text)) {
          const combined = (cached as any[]).map(c => `[${c.coachee_email}]\n${c.insights_text}`).join('\n\n---\n\n');
          setCoachAnswer(combined);
          const { data: chat } = await supabase.from('coach_insights_chat').select('*').eq('session_id', sessionId).eq('activity_type', actType).order('created_at');
          setChatMsgs((chat as any[]) ?? []);
          setAnalyzingActivity(false);
          return;
        }
      }
      const coachQuestions = act.coach_questions ?? [];
      let dataContext = '';
      if (actType === 'parking') {
        const { data: threads } = await supabase.from('session_threads').select('goal_id').eq('session_id', sessionId);
        for (const t of (threads as any[]) ?? []) {
          const { data: parked } = await supabase.from('parked_items').select('content,tags,created_at').eq('goal_id', t.goal_id).order('created_at', { ascending: false }).limit(50);
          dataContext += (parked as any[])?.map(p => `[${p.tags?.join(',') ?? ''}] ${p.content}`).join('\n') ?? '';
        }
      } else if (actType === 'talk') {
        const { data: ts } = await supabase.from('talk_sessions').select('id').eq('session_id', sessionId);
        for (const t of (ts as any[]) ?? []) {
          const { data: msgs } = await supabase.from('talk_messages').select('role,content').eq('talk_session_id', t.id).order('created_at');
          dataContext += (msgs as any[])?.map(m => `${m.role}: ${m.content}`).join('\n') ?? '';
        }
      } else {
        dataContext = allCompletions.filter(c => c.activity_type === actType).map(c => `[${c.user_email ?? ''}] Date: ${c.completed_date}, Notes: ${c.notes ?? ''}, Learning: ${c.learning ?? ''}`).join('\n');
      }
      const capsuleKnowledge = session?.capsule_id ? await getCapsuleKnowledge(session.capsule_id) : 'No capsule knowledge.';
      const previousContext = session?.capsule_id ? await getPreviousSessionsContext(session.capsule_id, sessionId, '') : 'No previous sessions.';
      const sessionGoalText = Array.isArray(session?.goals) ? (session.goals as string[]).join('; ') : '';
      const summaryText = Array.isArray(session?.summary) ? (session.summary as string[]).join('\n') : (session?.generated_summary ?? '');
      const res = await callLLM('coach_insights_activity', {
        activity_type: actType, coach_questions: JSON.stringify(coachQuestions), activity_data: dataContext,
        session_topic: session?.topic ?? '', session_goal: sessionGoalText, session_summary: summaryText,
        capsule_knowledge: capsuleKnowledge, previous_sessions_context: previousContext,
      });
      const answer = stripMarkdown(res || '');
      setCoachAnswer(answer);
      // Cache per coachee
      for (const email of emails) {
        const { data: existing } = await supabase.from('coach_insights_cache').select('id').eq('session_id', sessionId).eq('activity_type', actType).eq('coachee_email', email).maybeSingle();
        if (existing) {
          await supabase.from('coach_insights_cache').update({ insights_text: answer, updated_at: new Date().toISOString() }).eq('id', (existing as any).id);
        } else {
          await supabase.from('coach_insights_cache').insert({ session_id: sessionId, activity_type: actType, coachee_email: email, insights_text: answer });
        }
      }
      const { data: chat } = await supabase.from('coach_insights_chat').select('*').eq('session_id', sessionId).eq('activity_type', actType).order('created_at');
      setChatMsgs((chat as any[]) ?? []);
    } catch (e: any) { setCoachAnswer('Analysis failed: ' + e.message); }
    setAnalyzingActivity(false);
  };

  const sendChat = async () => {
    if (!chatInput.trim() || !selectedActivity) return;
    const msg = { role: 'user', content: chatInput.trim() };
    setChatMsgs(m => [...m, msg]);
    setChatInput('');
    setChatLoading(true);
    try {
      await supabase.from('coach_insights_chat').insert({ session_id: sessionId, activity_type: selectedActivity, role: 'user', content: msg.content });
      const act = activities.find(a => a.activity_type === selectedActivity);
      const history = [...chatMsgs, msg].map(m => `${m.role}: ${m.content}`).join('\n');
      const capsuleKnowledge = session?.capsule_id ? await getCapsuleKnowledge(session.capsule_id) : 'No capsule knowledge.';
      const previousContext = session?.capsule_id ? await getPreviousSessionsContext(session.capsule_id, sessionId, '') : 'No previous sessions.';
      const sessionGoalText = Array.isArray(session?.goals) ? (session.goals as string[]).join('; ') : '';
      const summaryText = Array.isArray(session?.summary) ? (session.summary as string[]).join('\n') : (session?.generated_summary ?? '');
      const res = await callLLM('coach_insights_followup', {
        activity_type: selectedActivity, coach_questions: JSON.stringify(act?.coach_questions ?? []),
        previous_answer: coachAnswer, conversation_history: history, coach_question: msg.content,
        session_topic: session?.topic ?? '', session_goal: sessionGoalText, session_summary: summaryText,
        capsule_knowledge: capsuleKnowledge, previous_sessions_context: previousContext,
        activity_data: allCompletions.filter(c => c.activity_type === selectedActivity).map(c => c.notes ?? '').join('; '),
      });
      const aiMsg = { role: 'assistant', content: stripMarkdown(res) };
      setChatMsgs(m => [...m, aiMsg]);
      await supabase.from('coach_insights_chat').insert({ session_id: sessionId, activity_type: selectedActivity, role: 'assistant', content: res });
    } catch (e: any) { setChatMsgs(m => [...m, { role: 'assistant', content: 'Error: ' + e.message }]); }
    setChatLoading(false);
    setTimeout(() => chatRef.current?.scrollTo(0, chatRef.current.scrollHeight), 100);
  };

  const runThoughtAnalysis = async () => {
    if (!thoughtCoachee) return;
    setThoughtLoading(true);
    try {
      const inputs = await fetchSessionInputs(sessionId, thoughtCoachee, thoughtCoachee);
      if (inputs.length > 0) {
        const result = await analyzeSessionThoughts(sessionId, thoughtCoachee, inputs);
        await saveAnalysis(sessionId, thoughtCoachee, result);
        setThoughtAnalysis(result);
      } else { setThoughtAnalysis(null); alert('No activity data found for this coachee in this session.'); }
    } catch (e: any) { alert('Analysis failed: ' + e.message); }
    setThoughtLoading(false);
  };

  const loadThoughtAnalysis = async (email: string) => {
    if (!email) { setThoughtAnalysis(null); return; }
    const existing = await loadAnalysis(sessionId, email);
    setThoughtAnalysis(existing);
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 text-teal-500 animate-spin" /></div>;

  const enabledActivities = activities.map(a => a.activity_type).filter(t => t !== 'knowledge');
  const totalStars = allStars.reduce((a, s) => a + (s.stars ?? 0), 0);
  const starsByActivity: Record<string, number> = {};
  allStars.forEach(s => { starsByActivity[s.activity_type] = (starsByActivity[s.activity_type] ?? 0) + (s.stars ?? 0); });
  const starsByCoachee: Record<string, number> = {};
  allStars.forEach(s => { const e = s.user_email ?? ''; starsByCoachee[e] = (starsByCoachee[e] ?? 0) + (s.stars ?? 0); });
  const avgPower = powerSummaries.length > 0 ? Math.round(powerSummaries.reduce((a, p) => a + Number(p.power_percentage ?? 0), 0) / powerSummaries.length) : 0;

  return (
    <div className="space-y-4">
      {/* Power to Goal — only for Coaching capsules */}
      {!isTrainingCapsule && (
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <p className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-1.5"><Zap className="w-4 h-4 text-amber-500" /> Power to Goal (All Coachees)</p>
        <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-4 border border-amber-100">
          <div className="flex items-center gap-4 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-3xl font-black text-amber-600">{avgPower}%</span>
              <span className="text-xs text-gray-500">average power to goal</span>
            </div>
            <div className="flex gap-3 text-xs">
              <span className="text-emerald-700 font-semibold">Total Confidence: {powerSummaries.reduce((a, p) => a + (p.total_confidence ?? 0), 0)}</span>
              <span className="text-red-600 font-semibold">Total Doubt: {powerSummaries.reduce((a, p) => a + (p.total_doubt ?? 0), 0)}</span>
            </div>
          </div>
          {powerTrend.length > 1 && (
            <div>
              <p className="text-xs font-bold text-gray-700 mb-2">Trend across sessions</p>
              <div className="flex items-end gap-2 h-24">
                {powerTrend.map((t, i) => {
                  const maxPct = Math.max(...powerTrend.map(x => x.pct), 1);
                  const height = (t.pct / maxPct) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full bg-amber-400 rounded-t" style={{ height: `${height}%` }} title={`Session ${t.sessionNumber}: ${t.pct}%`} />
                      <span className="text-[10px] text-gray-400">S{t.sessionNumber}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Stars */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <p className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-1.5"><Star className="w-4 h-4 text-amber-500" /> Stars (All Coachees)</p>
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-100">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-5 h-5 text-amber-500" />
            <span className="text-2xl font-bold text-amber-600">{totalStars}</span>
            <span className="text-xs text-gray-500">total stars across {emails.length} coachees</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Object.entries(starsByActivity).map(([act, count]) => (
              <div key={act} className="bg-white rounded-xl p-3 border border-amber-100 text-center">
                <Star className={`w-5 h-5 mx-auto mb-1 ${count > 0 ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />
                <p className="text-lg font-bold text-amber-600">{count}</p>
                <p className="text-[10px] text-gray-500 capitalize">{ACTIVITY_LABELS[act] ?? act}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-1.5">
            <p className="text-xs font-bold text-gray-700 mb-1">Stars per coachee</p>
            {emails.map(email => {
              const count = starsByCoachee[email] ?? 0;
              const maxStars = Math.max(...Object.values(starsByCoachee), 1);
              return (
                <div key={email} className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 w-48 truncate">{email}</span>
                  <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(count / maxStars) * 100}%` }} />
                  </div>
                  <span className="text-xs text-gray-500 w-8 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Completion Status */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <p className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-600" /> Completion Status (All Coachees)</p>
        <div className="space-y-2">
          {enabledActivities.length === 0 ? <p className="text-xs text-gray-400">No activities enabled.</p> : enabledActivities.map(actType => {
            const actComps = allCompletions.filter(c => c.activity_type === actType);
            const act = activities.find(a => a.activity_type === actType);
            const scheduledDates = act?.scheduled_dates ?? [];
            const coacheesWithComps = new Set(actComps.map(c => c.user_email)).size;
            return (
              <div key={actType} className="border border-gray-100 rounded-lg p-2">
                <p className="text-xs font-semibold text-gray-700 capitalize mb-0.5">{ACTIVITY_LABELS[actType] ?? actType}</p>
                <div className="flex gap-3 text-xs text-gray-500">
                  <span>{actComps.length} completions</span>
                  <span>·</span>
                  <span>{scheduledDates.length} dates</span>
                  <span>·</span>
                  <span>{coacheesWithComps}/{emails.length} coachees</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Consolidated Quiz Results */}
      {consolidatedQuiz.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-1.5"><HelpCircle className="w-4 h-4 text-indigo-500" /> Quiz Results (All Coachees)</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 font-semibold text-gray-600">Module</th>
                  <th className="text-center py-2 px-3 font-semibold text-gray-600">Correct Answers</th>
                  <th className="text-center py-2 px-3 font-semibold text-gray-600">Total Questions</th>
                  <th className="text-center py-2 px-3 font-semibold text-gray-600">Score %</th>
                </tr>
              </thead>
              <tbody>
                {consolidatedQuiz.map((r, i) => {
                  const pct = r.total > 0 ? Math.round((r.correct / r.total) * 100) : 0;
                  return (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-2 px-3 text-gray-700 font-semibold">{r.moduleTitle}</td>
                      <td className="py-2 px-3 text-center text-gray-700">{r.correct}</td>
                      <td className="py-2 px-3 text-center text-gray-700">{r.total}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`font-bold ${pct >= 70 ? 'text-emerald-600' : pct >= 40 ? 'text-amber-600' : 'text-red-500'}`}>{pct}%</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Thought Pattern Analysis */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <p className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-teal-600" /> Thought Pattern Analysis</p>
        <div className="flex gap-2 mb-3">
          <select value={thoughtCoachee} onChange={e => { setThoughtCoachee(e.target.value); loadThoughtAnalysis(e.target.value); }} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-teal-400">
            <option value="">Select coachee</option>
            {emails.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <button onClick={runThoughtAnalysis} disabled={!thoughtCoachee || thoughtLoading} className="flex items-center gap-1 text-xs text-white bg-teal-600 hover:bg-teal-700 px-3 py-1.5 rounded-lg disabled:opacity-50">
            {thoughtLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} {thoughtAnalysis ? 'Re-run' : 'Run'} Analysis
          </button>
        </div>
        {thoughtAnalysis && (
          <div className="space-y-3">
            {thoughtAnalysis.undercurrents?.length > 0 && (
              <div>
                <p className="text-xs font-bold text-gray-700 mb-1">Detected Undercurrents</p>
                {thoughtAnalysis.undercurrents.map((u, i) => (
                  <div key={i} className="bg-teal-50 rounded-lg p-2 mb-1 border border-teal-100">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-xs font-bold text-teal-800">{u.label}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${u.trend === 'growing' ? 'bg-emerald-100 text-emerald-700' : u.trend === 'declining' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{u.trend}</span>
                    </div>
                    <p className="text-xs text-gray-600">{u.explanation}</p>
                  </div>
                ))}
              </div>
            )}
            {thoughtAnalysis.word_cloud?.length > 0 && (
              <div>
                <p className="text-xs font-bold text-gray-700 mb-1">Top Thought Components</p>
                <div className="space-y-1">
                  {thoughtAnalysis.word_cloud.slice(0, 6).map((w, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className={`text-xs font-semibold w-24 truncate ${w.is_negative ? 'text-red-600' : 'text-teal-700'}`}>{w.word}</span>
                      <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${w.is_negative ? 'bg-red-400' : 'bg-teal-400'}`} style={{ width: `${(w.count / Math.max(...thoughtAnalysis.word_cloud.map(x => x.count))) * 100}%` }} /></div>
                      <span className="text-xs text-gray-500 w-6">{w.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {thoughtAnalysis.recommendations && (thoughtAnalysis.recommendations.direction || thoughtAnalysis.recommendations.focus_now) && (
              <div>
                <p className="text-xs font-bold text-gray-700 mb-1">Recommendations</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {thoughtAnalysis.recommendations.direction && <div className="bg-teal-50 rounded-lg p-2 border border-teal-100"><p className="text-xs font-bold text-teal-800 mb-0.5">Direction</p><p className="text-xs text-gray-600">{thoughtAnalysis.recommendations.direction}</p></div>}
                  {thoughtAnalysis.recommendations.focus_now && <div className="bg-amber-50 rounded-lg p-2 border border-amber-100"><p className="text-xs font-bold text-amber-800 mb-0.5">Focus Now</p><p className="text-xs text-gray-600">{thoughtAnalysis.recommendations.focus_now}</p></div>}
                </div>
                {thoughtAnalysis.recommendations.next_actions?.length > 0 && (
                  <ol className="list-decimal list-inside text-xs text-gray-600 mt-2 space-y-0.5">
                    {thoughtAnalysis.recommendations.next_actions.map((a, i) => <li key={i}>{a}</li>)}
                  </ol>
                )}
              </div>
            )}
          </div>
        )}
        {!thoughtAnalysis && !thoughtLoading && <p className="text-xs text-gray-400">Select a coachee and click "Run Analysis" to detect thought patterns.</p>}
      </div>

      {/* Coach Insights */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <p className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-1.5"><Brain className="w-4 h-4 text-indigo-600" /> Coach Insights (All Coachees)</p>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Select activity to analyze</label>
            <div className="flex flex-wrap gap-1.5">
              {enabledActivities.map(actType => (
                <button key={actType} onClick={() => { setSelectedActivity(actType); analyzeActivity(actType); }}
                  className={`text-xs px-2.5 py-1.5 rounded-lg border capitalize ${selectedActivity === actType ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                  {ACTIVITY_LABELS[actType] ?? actType}
                </button>
              ))}
            </div>
          </div>
          {analyzingActivity && <div className="flex items-center gap-2 text-xs text-gray-500"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing...</div>}
          {coachAnswer && !analyzingActivity && (
            <div className="bg-white border border-gray-100 rounded-xl p-3">
              <p className="text-xs text-gray-600 whitespace-pre-wrap">{coachAnswer}</p>
            </div>
          )}
          {selectedActivity && coachAnswer && !analyzingActivity && (
            <div>
              <div ref={chatRef} className="max-h-48 overflow-y-auto space-y-2 mb-2 bg-gray-50 rounded-xl p-3">
                {chatMsgs.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`text-xs px-3 py-1.5 rounded-xl max-w-[80%] whitespace-pre-wrap ${m.role === 'user' ? 'bg-teal-600 text-white' : 'bg-white border border-gray-200 text-gray-700'}`}>{m.content}</div>
                  </div>
                ))}
                {chatLoading && <div className="flex justify-start"><div className="text-xs px-3 py-1.5 rounded-xl bg-white border border-gray-200"><Loader2 className="w-3 h-3 animate-spin inline" /> Thinking...</div></div>}
              </div>
              <div className="flex gap-2">
                <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat()} placeholder="Ask follow-up..." className="flex-1 px-3 py-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-teal-400" />
                <button onClick={sendChat} disabled={chatLoading} className="text-xs text-white bg-teal-600 hover:bg-teal-700 px-3 py-2 rounded-lg disabled:opacity-50"><Send className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============ Reusable inputs ============ */

function ActivityCard({ title, icon, enabled, onToggle, onGenerate, generating, children }: { title: string; icon: React.ReactNode; enabled: boolean; onToggle: () => void; onGenerate: () => void; generating?: boolean; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl border p-3 space-y-2 transition ${enabled ? 'bg-white border-teal-200' : 'bg-gray-50 border-gray-200 opacity-60'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={onToggle} type="button" className={`flex items-center gap-1.5 ${enabled ? 'text-teal-700' : 'text-gray-400 line-through'}`}>
            {icon}<span className="text-xs font-bold uppercase tracking-wide">{title}</span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onGenerate} disabled={!enabled || generating} type="button"
            className="flex items-center gap-1 text-xs text-teal-700 border border-teal-200 px-2 py-1 rounded-lg hover:bg-teal-50 disabled:opacity-40">
            {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Generate with AI
          </button>
        </div>
      </div>
      {enabled ? children : <p className="text-xs text-gray-400 italic">Disabled — data flushed. Toggle to re-enable.</p>}
    </div>
  );
}

function CoachQuestionsEditor({ act, questions, onAdd, onRemove, onChange }: { act: string; questions: string[]; onAdd: () => void; onRemove: (i: number) => void; onChange: (i: number, v: string) => void }) {
  return (
    <div className="border border-indigo-100 rounded-xl p-2.5 bg-indigo-50/30">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs font-bold text-indigo-700">Coach Questions (up to 3)</p>
        {questions.length < 3 && <button onClick={onAdd} className="text-xs text-indigo-600 flex items-center gap-0.5"><Plus className="w-3 h-3" /> Add</button>}
      </div>
      {questions.length === 0 ? <p className="text-xs text-gray-400 italic">No coach questions yet. These will be answered by AI in the dashboard.</p> : (
        <div className="space-y-1.5">
          {questions.map((q, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="text-xs text-indigo-400 font-bold w-4">{i + 1}.</span>
              <input value={q} onChange={e => onChange(i, e.target.value)} placeholder={`Coach question ${i + 1}`}
                className="flex-1 px-2 py-1.5 text-xs border border-indigo-200 rounded-lg outline-none focus:border-indigo-400" />
              <button onClick={() => onRemove(i)} className="text-red-400 p-0.5 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ScheduledDatesEditor({ dates, activationDate, deactivationDate, onToggle }: { act: string; dates: string[]; activationDate: string; deactivationDate: string; onToggle: (d: string) => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const minDate = activationDate || today;
  const maxDate = deactivationDate || '';
  const days: string[] = [];
  if (minDate) {
    const start = new Date(minDate + 'T00:00:00');
    const end = maxDate ? new Date(maxDate + 'T00:00:00') : new Date(start.getTime() + 30 * 86400000);
    const d = new Date(start);
    while (d <= end) { days.push(d.toISOString().slice(0, 10)); d.setDate(d.getDate() + 1); }
  }
  return (
    <div className="border border-teal-100 rounded-xl p-2.5 bg-teal-50/20">
      <p className="text-xs font-bold text-teal-700 mb-1.5">Scheduled Dates (select days the coachee should attempt this activity)</p>
      {days.length === 0 ? <p className="text-xs text-gray-400">Set activation/deactivation dates in the session form first.</p> : (
        <div className="flex flex-wrap gap-1">
          {days.map(d => {
            const selected = dates.includes(d);
            return (
              <button key={d} type="button" onClick={() => onToggle(d)}
                className={`text-xs px-2 py-1 rounded-lg border ${selected ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                {new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' })}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-500 mb-1 block">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-teal-400 focus:ring-1 focus:ring-teal-100 outline-none" />
    </div>
  );
}
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-500 mb-1 block">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-teal-400 focus:ring-1 focus:ring-teal-100 outline-none">
        {options.map(o => <option key={o} value={o}>{o || 'Select'}</option>)}
      </select>
    </div>
  );
}

function CapsuleKnowledgeUploader({ capsuleId, coachId }: { capsuleId: string; coachId: string }) {
  const [files, setFiles] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('capsule_knowledge').select('*').eq('capsule_id', capsuleId).order('uploaded_at', { ascending: false });
    setFiles((data as any[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [capsuleId]);

  const handleUpload = async (fileList: FileList) => {
    setUploading(true);
    for (const file of Array.from(fileList)) {
      try {
        const extracted = await extractFileText(file);
        const { data, error } = await supabase.from('capsule_knowledge').insert({
          capsule_id: capsuleId, coach_id: coachId,
          file_name: file.name, file_type: file.type || file.name.split('.').pop() || 'unknown',
          extracted_text: extracted,
          consolidated_notes: extracted,
        }).select().single();
        if (!error && data) {
          // Generate consolidated notes from all files
          const allFiles = [...files, data];
          const allText = allFiles.map((f: any) => f.consolidated_notes || f.extracted_text || '').join('\n\n');
          if (allText.length > 100) {
            try {
              const summary = await callLLM('coach_summary_gen', { content: allText.slice(0, 12000) });
              await supabase.from('capsule_knowledge').update({ consolidated_notes: stripMarkdown(summary) }).eq('id', (data as any).id);
            } catch { /* use raw extracted text */ }
          }
        }
      } catch (e: any) { alert(`Failed to upload ${file.name}: ${e.message}`); }
    }
    setUploading(false);
    await load();
  };

  const removeFile = async (id: string) => {
    await supabase.from('capsule_knowledge').delete().eq('id', id);
    await load();
  };

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
      <p className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-1.5">
        <BookOpen className="w-4 h-4 text-teal-600" /> Previous Session Knowledge (Capsule-level)
      </p>
      <p className="text-xs text-gray-500 mb-3">Upload PPT, PDF, DOC, DOCX, video, or audio files. Content will be extracted and used by the Talk agent and Coach Insights.</p>
      {loading ? <Loader2 className="w-4 h-4 animate-spin text-teal-500" /> : (
        <>
          {files.length > 0 && (
            <div className="space-y-1.5 mb-3">
              {files.map((f: any) => (
                <div key={f.id} className="flex items-center gap-2 bg-white rounded-lg p-2 border border-gray-100">
                  <FileText className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-xs text-gray-700 flex-1 truncate">{f.file_name}</span>
                  <span className="text-[10px] text-gray-400">{(f.extracted_text ?? '').length} chars</span>
                  <button onClick={() => removeFile(f.id)} className="text-xs text-red-500 hover:text-red-600">Remove</button>
                </div>
              ))}
            </div>
          )}
          <label className={`flex items-center gap-1.5 text-xs text-teal-600 cursor-pointer hover:text-teal-700 ${uploading ? 'opacity-50' : ''}`}>
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Upload knowledge files
            <input type="file" multiple accept=".ppt,.pptx,.pdf,.doc,.docx,.txt,.mp3,.wav,.m4a,.ogg,.mp4,.mov,.avi,.mkv" className="hidden" disabled={uploading} onChange={e => e.target.files?.length && handleUpload(e.target.files)} />
          </label>
        </>
      )}
    </div>
  );
}


