import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Leaf, Loader2, Star, Send, Check, Play, CheckCircle2, Brain, Info, Sparkles, ChevronLeft, ChevronRight, BookOpen, ListChecks, Eye, MessageCircle, Trophy, Mic, Search, Youtube, Wand2, Pencil, Calendar, FileText, Ban, Layers } from 'lucide-react';
import { supabase } from '../supabase';
import type { User } from '@supabase/supabase-js';
import { callLLM, parseJSON, stripMarkdown } from '../lib/llm';
import { STOCK_IMAGES, formatDate, knowledgeBgForIndex, getChatbotConfig, getCapsuleKnowledge, getPreviousSessionsContext } from '../lib/coach';
import { recordPowerToGoal } from '../lib/power-to-goal';
import SessionDashboard from '../components/SessionDashboard';
import PublicCalendarPage from '../components/PublicCalendarPage';
import ExplorationFormTab from '../components/ExplorationFormTab';

interface Props { user: User; }

interface CoacheeCapsule {
  id: string;
  name: string;
  description: string | null;
  capsule_type: string;
  coach_id: string;
  coach_name: string;
  coach_portrait: string | null;
  sessions: CoacheeSession[];
}

interface CoacheeSession {
  id: string;
  topic: string;
  session_uid: string | null;
  session_number: number;
  session_date: string | null;
  status: string | null;
  session_from_dt: string | null;
  capsule_id: string;
  capsule_name: string;
  capsule_type: string;
  coach_id: string;
  coach_name: string;
  summary: string[];
  generated_summary?: string | null;
  coach_portrait?: string | null;
}

export default function CoacheePage({ user }: Props) {
  const [loading, setLoading] = useState(true);
  const [capsules, setCapsules] = useState<CoacheeCapsule[]>([]);
  const [openCapsule, setOpenCapsule] = useState<CoacheeCapsule | null>(null);

  const load = async () => {
    setLoading(true);
    // Find capsules I'm enrolled in
    const { data: enroll } = await supabase.from('capsule_enrollments').select('capsule_id').eq('coachee_email', user.email ?? '');
    const enrolledCapIds = ((enroll as any[]) ?? []).map(e => e.capsule_id);
    // Also check nominations (sessions I'm nominated for → get their capsule_ids)
    const { data: nom } = await supabase.from('session_nominees').select('session_id').eq('coachee_email', user.email ?? '');
    const nomSessionIds = ((nom as any[]) ?? []).map(n => n.session_id);
    let nomCapIds: string[] = [];
    if (nomSessionIds.length > 0) {
      const { data: nomSessions } = await supabase.from('coaching_sessions').select('capsule_id').in('id', nomSessionIds);
      nomCapIds = Array.from(new Set(((nomSessions as any[]) ?? []).map(s => s.capsule_id)));
    }
    // Also find capsules from sessions the coachee has booked (via coach_bookings)
    let { data: bookedSessions } = await supabase.from('coach_bookings').select('id,session_id,capsule_id').eq('coachee_email', user.email ?? '');
    // For any bookings without a session_id, create a coaching_sessions row now
    const unlinkedBookings = ((bookedSessions as any[]) ?? []).filter(b => !b.session_id && b.capsule_id);
    for (const b of unlinkedBookings) {
      await supabase.rpc('ensure_session_for_booking', { p_booking_id: b.id });
    }
    // Re-fetch bookings after ensuring sessions — session_id should now be populated
    if (unlinkedBookings.length > 0) {
      const { data: refreshed } = await supabase.from('coach_bookings').select('id,session_id,capsule_id').eq('coachee_email', user.email ?? '');
      bookedSessions = refreshed;
    }
    const bookedSessionIds = ((bookedSessions as any[]) ?? []).filter(b => b.session_id).map(b => b.session_id);
    let bookedCapIds: string[] = [];
    if (bookedSessionIds.length > 0) {
      const { data: bookedSessRows } = await supabase.from('coaching_sessions').select('capsule_id').in('id', bookedSessionIds);
      bookedCapIds = Array.from(new Set(((bookedSessRows as any[]) ?? []).map(s => s.capsule_id).filter(Boolean)));
    }
    // Also include capsule_ids directly from bookings (for ones we just ensured)
    const bookingCapIds = ((bookedSessions as any[]) ?? []).filter(b => b.capsule_id).map(b => b.capsule_id);
    const allCapIds = Array.from(new Set([...enrolledCapIds, ...nomCapIds, ...bookedCapIds, ...bookingCapIds]));
    if (allCapIds.length === 0) { setCapsules([]); setLoading(false); return; }
    const { data: caps } = await supabase.from('capsules').select('id,name,description,capsule_type,coach_id').in('id', allCapIds);
    const capList = (caps as any[]) ?? [];
    const coachIds = Array.from(new Set(capList.map(c => c.coach_id)));
    let coachMap: Record<string, string> = {};
    if (coachIds.length > 0) {
      const { data: coaches } = await supabase.from('coaches').select('id,coach_name').in('id', coachIds);
      (coaches as any[])?.forEach(c => coachMap[c.id] = c.coach_name);
    }
    const { data: profs } = await supabase.from('coach_profiles').select('coach_id,portrait_url').in('coach_id', coachIds.length ? coachIds : ['00000000-0000-0000-0000-000000000000']);
    const profMap: Record<string, string | null> = {};
    (profs as any[])?.forEach(p => { profMap[p.coach_id] = p.portrait_url ?? null; });
    // Load sessions for all capsules
    const { data: allSessions } = await supabase.from('coaching_sessions').select('id,topic,session_uid,session_number,session_date,session_from_dt,session_to_dt,status,capsule_id,coach_id,summary,generated_summary').in('capsule_id', allCapIds).neq('status', 'Cancelled').order('session_number');
    const sList = (allSessions as any[]) ?? [];
    const capsuleMap: Record<string, CoacheeCapsule> = {};
    for (const c of capList) {
      capsuleMap[c.id] = {
        id: c.id, name: c.name, description: c.description, capsule_type: c.capsule_type,
        coach_id: c.coach_id, coach_name: coachMap[c.coach_id] ?? 'Coach',
        coach_portrait: profMap[c.coach_id] ?? null, sessions: [],
      };
    }
    for (const s of sList) {
      const cap = capsuleMap[s.capsule_id];
      if (!cap) continue;
      cap.sessions.push({
        id: s.id, topic: s.topic, session_uid: s.session_uid, session_number: s.session_number,
        session_date: s.session_date, status: s.status, session_from_dt: s.session_from_dt,
        capsule_id: s.capsule_id, capsule_name: cap.name, capsule_type: cap.capsule_type,
        coach_id: s.coach_id, coach_name: cap.coach_name,
        summary: s.summary ?? [], generated_summary: s.generated_summary ?? null,
        coach_portrait: cap.coach_portrait,
      });
    }
    const freshCapsules = Object.values(capsuleMap);
    setCapsules(freshCapsules);
    if (openCapsule) {
      const updated = freshCapsules.find(c => c.id === openCapsule.id);
      if (updated) setOpenCapsule(updated);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user.id]);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-teal-500 animate-spin" /></div>;

  if (openCapsule) return <CapsuleDetail capsule={openCapsule} user={user} onBack={() => { setOpenCapsule(null); load(); }} onDataChanged={load} />;

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 pb-24"
      style={{ backgroundImage: `linear-gradient(rgba(255,255,255,0.9), rgba(255,255,255,0.9)), url(${STOCK_IMAGES.leaf})`, backgroundSize: 'cover', backgroundAttachment: 'fixed' }}>
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <Leaf className="w-5 h-5 text-emerald-600" />
          <h1 className="text-xl font-black text-gray-900 tracking-tight">Coachee View</h1>
        </div>
        <p className="text-xs text-gray-500">Capsules assigned to you by your coach.</p>
      </div>

      {capsules.length === 0 ? (
        <div className="bg-white/80 rounded-2xl border border-gray-100 p-10 text-center">
          <Layers className="w-10 h-10 text-emerald-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500 mb-1">No capsules assigned yet.</p>
          <p className="text-xs text-gray-400">Capsules will appear here when your coach enrolls you.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {capsules.map(c => (
            <button key={c.id} onClick={() => setOpenCapsule(c)}
              className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 hover:shadow-md transition text-left">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center flex-shrink-0">
                <Layers className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800 truncate">{c.name}</p>
                <p className="text-xs text-gray-500">by {c.coach_name} · {c.sessions.length} session{c.sessions.length !== 1 ? 's' : ''} · {c.capsule_type}</p>
                {c.description && <p className="text-xs text-gray-400 truncate mt-0.5">{c.description}</p>}
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============ Capsule Detail — tabs for form, booking, sessions ============ */

type CapsuleTab = 'overview' | 'form' | 'book' | 'sessions';

function CapsuleDetail({ capsule, user, onBack, onDataChanged }: { capsule: CoacheeCapsule; user: User; onBack: () => void; onDataChanged: () => void }) {
  const [tab, setTab] = useState<CapsuleTab>('overview');

  const tabs: { key: CapsuleTab; label: string; icon: any }[] = [
    { key: 'overview', label: 'Overview', icon: BookOpen },
    { key: 'form', label: 'Exploration Form', icon: FileText },
    { key: 'book', label: 'Book Session', icon: Calendar },
    { key: 'sessions', label: 'Sessions', icon: Layers },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 pb-24">
      <button onClick={onBack} className="text-xs text-gray-500 hover:text-gray-800 mb-3 flex items-center gap-1"><ChevronLeft className="w-3.5 h-3.5" /> Back</button>
      <div className="mb-4 flex items-center gap-3">
        <div className="w-12 h-12 rounded-full overflow-hidden bg-teal-50 flex-shrink-0 border border-teal-100">
          {capsule.coach_portrait ? <img src={capsule.coach_portrait} alt={capsule.coach_name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Brain className="w-5 h-5 text-teal-400" /></div>}
        </div>
        <div>
          <p className="text-xs text-teal-600 font-semibold">by {capsule.coach_name}</p>
          <h1 className="text-xl font-black text-gray-900 tracking-tight">{capsule.name}</h1>
          <p className="text-xs text-gray-500">{capsule.capsule_type} · {capsule.sessions.length} session{capsule.sessions.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="flex gap-1 mb-5 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap transition ${tab === t.key ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          {capsule.description && <p className="text-sm text-gray-700 mb-4">{capsule.description}</p>}
          <p className="text-xs text-gray-500 mb-3">This capsule has {capsule.sessions.filter(s => s.status !== 'Cancelled').length} session{capsule.sessions.filter(s => s.status !== 'Cancelled').length !== 1 ? 's' : ''}. Use the tabs above to fill your exploration form, book a session, or access session activities.</p>
          <div className="space-y-2">
            {capsule.sessions.filter(s => s.status !== 'Cancelled').map(s => (
              <div key={s.id} className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-teal-600">S{s.session_number}</span>
                <span className="text-gray-700">{s.topic}</span>
                {s.session_date && <span className="text-gray-400">· {formatDate(s.session_date)}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'form' && <ExplorationFormTab coachId={capsule.coach_id} capsuleId={capsule.id} coacheeEmail={user.email ?? ''} />}
      {tab === 'book' && <PublicCalendarPage coachId={capsule.coach_id} coacheeName={user.user_metadata?.full_name || user.email} coacheeEmail={user.email ?? ''} capsuleId={capsule.id} sessionId={''} onBooked={() => { setTab('sessions'); onDataChanged(); }} />}
      {tab === 'sessions' && <SessionList capsule={capsule} user={user} />}
    </div>
  );
}

/* ============ Session List inside capsule — coachee can open or cancel ============ */

function SessionList({ capsule, user }: { capsule: CoacheeCapsule; user: User }) {
  const [openSession, setOpenSession] = useState<CoacheeSession | null>(null);
  const [sessions, setSessions] = useState<CoacheeSession[]>(capsule.sessions);

  useEffect(() => { setSessions(capsule.sessions); }, [capsule.sessions]);

  const cancelSession = async (s: CoacheeSession) => {
    if (!confirm('Cancel this session?')) return;
    await supabase.from('coaching_sessions').update({ status: 'Cancelled' }).eq('id', s.id);
    await supabase.from('coach_bookings').update({ status: 'cancelled' }).eq('session_id', s.id);
    setSessions(prev => prev.filter(x => x.id !== s.id));
  };

  if (openSession) return <SessionDetail session={openSession} user={user} onBack={() => setOpenSession(null)} />;

  const visibleSessions = sessions.filter(s => s.status !== 'Cancelled');

  return (
    <div className="space-y-3">
      {visibleSessions.length === 0 && <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center text-sm text-gray-400">No sessions in this capsule yet.</div>}
      {visibleSessions.map(s => (
        <div key={s.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-50 to-emerald-50 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-teal-600">S{s.session_number}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-800 truncate">{s.topic}</p>
            <p className="text-xs text-gray-500">{formatDate(s.session_date)} {s.session_from_dt ? `· ${new Date(s.session_from_dt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}` : ''}</p>
            {s.status === 'Scheduled' && <span className="text-xs text-sky-500 font-medium">Scheduled</span>}
          </div>
          <button onClick={() => setOpenSession(s)} className="text-xs text-teal-600 hover:underline px-2 py-1">Open</button>
          <button onClick={() => cancelSession(s)} className="p-1.5 rounded-lg hover:bg-amber-50" title="Cancel session"><Ban className="w-3.5 h-3.5 text-amber-500" /></button>
        </div>
      ))}
    </div>
  );
}

/* ============ Session Detail with activity tabs ============ */

type Tab = 'summary' | 'talk' | 'tasks' | 'parking' | 'knowledge' | 'watch' | 'quiz' | 'dashboard';

function SessionDetail({ session, user, onBack }: { session: CoacheeSession; user: User; onBack: () => void }) {
  const [tab, setTab] = useState<Tab>('summary');
  const [activities, setActivities] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [coachPortrait, setCoachPortrait] = useState<string | null>(null);
  const isCoaching = session.capsule_type === 'Coaching';

  useEffect(() => {
    (async () => {
      const { data: acts } = await supabase.from('cc_activities').select('*').eq('session_id', session.id).eq('is_active_set', true);
      const map: Record<string, any> = {};
      (acts as any[])?.forEach(a => { map[a.activity_type] = a; });
      setActivities(map);
      const { data: profile } = await supabase.from('coach_profiles').select('portrait_url').eq('coach_id', session.coach_id).maybeSingle();
      if (profile) setCoachPortrait((profile as any).portrait_url ?? null);
      setLoading(false);
    })();
  }, [session.id]);

  const tabs: { key: Tab; label: string; icon: any; show: boolean }[] = [
    { key: 'summary', label: 'Summary', icon: BookOpen, show: !isCoaching },
    { key: 'talk', label: 'Talk', icon: MessageCircle, show: !!activities.talk?.is_enabled },
    { key: 'tasks', label: 'Tasks', icon: ListChecks, show: !!activities.tasks?.is_enabled },
    { key: 'quiz', label: 'Quiz', icon: Sparkles, show: !!activities.quiz?.is_enabled },
    { key: 'watch', label: 'Watch', icon: Eye, show: !!activities.watch?.is_enabled },
    { key: 'parking', label: 'Parking', icon: Brain, show: !!activities.parking?.is_enabled && !!activities.parking?.config?.tags?.length && !isCoaching },
    { key: 'dashboard', label: 'Dashboard', icon: Trophy, show: true },
    { key: 'knowledge', label: 'Knowledge', icon: BookOpen, show: !!activities.knowledge?.is_enabled },
  ];

  useEffect(() => {
    if (loading) return;
    const visibleTabs = tabs.filter(t => t.show);
    if (visibleTabs.length > 0 && !visibleTabs.some(t => t.key === tab)) {
      setTab(visibleTabs[0].key);
    }
  }, [loading, activities]);

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 pb-24">
      <button onClick={onBack} className="text-xs text-gray-500 hover:text-gray-800 mb-3 flex items-center gap-1"><ChevronLeft className="w-3.5 h-3.5" /> Back</button>
      <div className="mb-4 flex items-center gap-3">
        <div className="w-12 h-12 rounded-full overflow-hidden bg-teal-50 flex-shrink-0 border border-teal-100">
          {coachPortrait || session.coach_portrait ? <img src={coachPortrait ?? session.coach_portrait ?? ''} alt={session.coach_name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Brain className="w-5 h-5 text-teal-400" /></div>}
        </div>
        <div>
          <p className="text-xs text-teal-600 font-semibold">{session.capsule_name}</p>
          <h1 className="text-xl font-black text-gray-900 tracking-tight">{session.topic}</h1>
          <p className="text-xs text-gray-500">by {session.coach_name} · Session {session.session_number} · {formatDate(session.session_date)}</p>
        </div>
      </div>

      {loading ? <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 text-teal-500 animate-spin" /></div> : (
        <>
          <div className="flex gap-1 mb-5 overflow-x-auto pb-1">
            {tabs.filter(t => t.show).map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap transition ${tab === t.key ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
                <t.icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            ))}
          </div>

          {tab === 'summary' && <SummaryTab session={session} userEmail={user.email ?? ''} onParkThought={() => setTab('parking')} />}
          {tab === 'talk' && <TalkTab session={session} activity={activities.talk} user={user} onParkThought={() => setTab('parking')} />}
          {tab === 'tasks' && <TasksTab session={session} activity={activities.tasks} user={user} onParkThought={() => setTab('parking')} />}
          {tab === 'quiz' && <QuizTab session={session} activity={activities.quiz} user={user} onParkThought={() => setTab('parking')} />}
          {tab === 'watch' && <WatchTab session={session} activity={activities.watch} user={user} onParkThought={() => setTab('parking')} />}
          {tab === 'parking' && <ParkingTab session={session} activity={activities.parking} user={user} />}
          {tab === 'dashboard' && <SessionDashboard sessionId={session.id} userId={user.id} coacheeEmail={user.email ?? ''} />}
          {tab === 'knowledge' && <KnowledgeTab session={session} activity={activities.knowledge} />}
        </>
      )}
    </div>
  );
}

/* ============ Shared date selector ============ */

function DateSelector({ activity, label, selectedDate, onSelect, activityLabel, allowAnyDate }: { activity: any; label: string; selectedDate: string; onSelect: (d: string) => void; activityLabel: string; allowAnyDate?: boolean }) {
  const fmtD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const today = fmtD(new Date());
  const scheduledDates: string[] = (activity?.scheduled_dates ?? []).sort();

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <label className="text-xs font-semibold text-gray-500 mb-1 block">{label}</label>
      {scheduledDates.length === 0 ? <p className="text-xs text-gray-400">No scheduled dates available. Ask your coach to configure dates for this activity.</p> : (
        <div className="flex flex-wrap gap-1.5">
          {scheduledDates.map(d => {
            const isToday = d === today;
            const isSelectable = allowAnyDate || isToday;
            const isSelected = selectedDate === d;
            return (
              <button key={d} onClick={() => isSelectable && onSelect(d)} disabled={!isSelectable}
                className={`text-xs px-2.5 py-1.5 rounded-lg border ${isSelected ? 'bg-teal-600 text-white border-teal-600' : isSelectable ? 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 cursor-pointer' : 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'}`}>
                {new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' })}
                {isToday && <span className="ml-1 text-[9px] uppercase">today</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============ Summary ============ */

function SummaryTab({ session, userEmail, onParkThought }: { session: CoacheeSession; userEmail?: string; onParkThought?: () => void }) {
  const [generated, setGenerated] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const hasSummary = session.summary.length > 0;
  const hasGenerated = !!(session as any).generated_summary;

  useEffect(() => {
    if (hasGenerated) { setGenerated((session as any).generated_summary); return; }
    if (!hasSummary) { setGenerated(null); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        let coacheeProfile = '';
        try {
          const { data: profile } = await supabase.from('coachees').select('client_name,profession,profession_details,marital_status,children,reasons_for_seeking,primary_goal,main_blocker').eq('email', userEmail ?? '').maybeSingle();
          if (profile) {
            coacheeProfile = `Name: ${profile.client_name ?? ''}\nProfession: ${profile.profession ?? ''} ${profile.profession_details ?? ''}\nMarital status: ${profile.marital_status ?? ''}\nChildren: ${profile.children ?? 0}\nReasons for seeking: ${profile.reasons_for_seeking ?? ''}\nPrimary goal: ${profile.primary_goal ?? ''}\nMain blocker: ${profile.main_blocker ?? ''}`;
          }
        } catch { /* silent */ }
        const res = await callLLM('coachee_session_summary', {
          session_topic: session.topic,
          session_summary: session.summary.join('\n'),
          coachee_profile: coacheeProfile,
        });
        if (!cancelled) setGenerated(stripMarkdown(res || session.summary.join(' ')));
      } catch {
        if (!cancelled) setGenerated(session.summary.join(' '));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [session.id, hasSummary, hasGenerated, session.topic]);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <p className="text-sm font-bold text-gray-800 mb-3">Session Summary</p>
      {loading && <div className="flex items-center gap-2 text-xs text-gray-500"><Loader2 className="w-4 h-4 animate-spin text-teal-500" /> Generating your summary...</div>}
      {!loading && !hasSummary && !hasGenerated && (
        <div className="space-y-2">
          <p className="text-xs text-gray-400 mb-2">No detailed summary provided by coach yet. Here is the session topic:</p>
          <p className="text-sm text-gray-700">{session.topic}</p>
        </div>
      )}
      {!loading && (hasGenerated || hasSummary) && generated && (
        <div className="space-y-3">
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{generated}</p>
          {hasSummary && (
            <details className="mt-4">
              <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">View original coach notes</summary>
              <ul className="space-y-1.5 mt-2">
                {session.summary.map((p, i) => (
                  <li key={i} className="flex gap-2 text-xs text-gray-500">
                    <span className="text-teal-600 font-bold">{i + 1}.</span> {p}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
      <ParkThoughtButton onPark={onParkThought} />
    </div>
  );
}

/* ============ Talk (Wise Harry) ============ */

function TalkTab({ session, activity, user, onParkThought }: { session: CoacheeSession; activity: any; user: User; onParkThought?: () => void }) {
  const [talkSession, setTalkSession] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<any>(null);
  const [chatbotCfg, setChatbotCfg] = useState<{ chatbot_name: string; chatbot_avatar_url: string | null; greeting_line: string | null }>({ chatbot_name: 'Wise Harry', chatbot_avatar_url: null, greeting_line: null });
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showClosePrompt, setShowClosePrompt] = useState(false);
  const closePromptedRef = useRef(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [isPaused, setIsPaused] = useState(false);
  const fmtD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const today = fmtD(new Date());

  const load = useCallback(async () => {
    setLoading(true);
    const { data: cfg } = await supabase.from('talk_config').select('*').eq('activity_id', activity.id).maybeSingle();
    setConfig(cfg as any);
    const cbCfg = await getChatbotConfig(session.coach_id);
    setChatbotCfg(cbCfg);
    const { data: ts } = await supabase.from('talk_sessions').select('*').eq('session_id', session.id).eq('user_id', user.id).order('started_at', { ascending: false }).limit(1).maybeSingle();
    if (ts && !(ts as any).ended_at) {
      setTalkSession(ts);
      const { data: msgs } = await supabase.from('talk_messages').select('*').eq('talk_session_id', (ts as any).id).order('created_at');
      const msgList = (msgs as any[]) ?? [];
      const fixedMsgs = msgList.map(m => m.role === 'assistant' ? { ...m, content: m.content?.replace(/Wise Harry/g, cbCfg.chatbot_name) } : m);
      setMessages(fixedMsgs);
      const start = new Date((ts as any).started_at).getTime();
      const pausedSecs = (ts as any).total_paused_seconds ?? 0;
      const pausedDuringCurrent = (ts as any).is_paused ? Math.floor((Date.now() - new Date((ts as any).paused_at).getTime()) / 1000) : 0;
      setElapsed(Math.floor((Date.now() - start - pausedSecs - pausedDuringCurrent) / 1000));
      setIsPaused((ts as any).is_paused ?? false);
    }
    setLoading(false);
  }, [activity?.id, session.id, session.coach_id, user.id]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { if (activity) load(); else setLoading(false); }, [load, activity]);

  useEffect(() => {
    if (talkSession && !talkSession.ended_at && !isPaused) {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
  }, [talkSession, isPaused]);

  const durationMin = config?.duration_minutes ?? 10;
  useEffect(() => {
    if (talkSession && !talkSession.ended_at && elapsed >= durationMin * 60 && !closePromptedRef.current) {
      closePromptedRef.current = true;
      setShowClosePrompt(true);
      const prompt = `Our time is up for today. Would you like to close this session, or continue? You can end whenever you're ready.`;
      setMessages(m => [...m, { role: 'assistant', content: prompt }]);
      supabase.from('talk_messages').insert({ talk_session_id: talkSession.id, role: 'assistant', content: prompt });
    }
  }, [elapsed, durationMin, talkSession]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages]);

  const startSession = async () => {
    if (!selectedDate) { alert('Please select a date first.'); return; }
    if (selectedDate !== today) { alert('You can only start a ' + chatbotCfg.chatbot_name + ' session on today\'s date.'); return; }
    try {
      const { data, error } = await supabase.from('talk_sessions').insert({ session_id: session.id, user_id: user.id, user_email: user.email ?? '', started_at: new Date().toISOString(), session_date: selectedDate }).select().single();
      if (error || !data) { alert('Could not start session. Please try again.'); return; }
      setTalkSession(data);
      setElapsed(0);
      const coachQuestions = config?.coach_questions ?? [];
      let contextIntro = '';
      try {
        const [{ data: sessRow }, { data: prevTalkSessions }] = await Promise.all([
          supabase.from('coaching_sessions').select('summary,topic,goals').eq('id', session.id).maybeSingle(),
          supabase.from('talk_sessions').select('id,ended_at,session_id').eq('session_id', session.id).order('started_at', { ascending: false }),
        ]);
        const summaryText = (sessRow?.summary ?? []).length > 0 ? (sessRow.summary as string[]).join(' ') : '';
        const priorTalkSessions = (prevTalkSessions as any[])?.filter(t => t.id !== (data as any).id && t.ended_at) ?? [];
        if (priorTalkSessions.length > 0) {
          const lastTs = priorTalkSessions[0];
          const { data: lastMsgs } = await supabase.from('talk_messages').select('role,content').eq('talk_session_id', lastTs.id).order('created_at').limit(6);
          const lastUserMsg = (lastMsgs as any[])?.filter(m => m.role === 'user').slice(-1)[0];
          if (lastUserMsg) {
            contextIntro = `Last time we spoke, you mentioned: "${lastUserMsg.content.slice(0, 150)}". `;
          }
        } else {
          const { data: capsuleSessions } = await supabase.from('coaching_sessions').select('id').eq('capsule_id', session.capsule_id);
          const otherSessionIds = ((capsuleSessions as any[]) ?? []).map(s => s.id).filter(id => id !== session.id);
          if (otherSessionIds.length > 0) {
            const { data: otherTalks } = await supabase.from('talk_sessions').select('id,session_id,ended_at').in('session_id', otherSessionIds).eq('user_id', user.id).eq('is_complete', true).order('started_at', { ascending: false }).limit(1);
            if (otherTalks && (otherTalks as any[]).length > 0) {
              const lastOther = (otherTalks as any[])[0];
              const { data: lastMsgs } = await supabase.from('talk_messages').select('role,content').eq('talk_session_id', lastOther.id).order('created_at').limit(6);
              const lastUserMsg = (lastMsgs as any[])?.filter(m => m.role === 'user').slice(-1)[0];
              if (lastUserMsg) {
                contextIntro = `Last time we spoke, you mentioned: "${lastUserMsg.content.slice(0, 150)}". `;
              }
            }
          }
          if (!contextIntro && summaryText) {
            contextIntro = `Your coach noted: "${summaryText.slice(0, 200)}". `;
          }
        }
      } catch { /* silent */ }
      const greeting = chatbotCfg.greeting_line ? chatbotCfg.greeting_line + ' ' : '';
      const welcome = coachQuestions.length > 0
        ? `${greeting}${contextIntro}Hi! I am ${chatbotCfg.chatbot_name}. There are a few questions your coach would love to explore with you. Let us start there. To begin, what stood out to you most from that session?`
        : `${greeting}${contextIntro}Hi! I am ${chatbotCfg.chatbot_name}. I understand you just had a session on "${session.topic}". Let us reflect on it together. What stood out to you most?`;
      setMessages([{ role: 'assistant', content: welcome }]);
      await supabase.from('talk_messages').insert({ talk_session_id: (data as any).id, role: 'assistant', content: welcome });
    } catch (e: any) {
      alert('Could not start session: ' + (e.message ?? 'unknown error'));
    }
  };

  const togglePause = async () => {
    if (!talkSession || talkSession.ended_at) return;
    if (isPaused) {
      const pausedAt = talkSession.paused_at ? new Date(talkSession.paused_at).getTime() : Date.now();
      const addSecs = Math.floor((Date.now() - pausedAt) / 1000);
      const newTotal = (talkSession.total_paused_seconds ?? 0) + addSecs;
      await supabase.from('talk_sessions').update({ is_paused: false, paused_at: null, total_paused_seconds: newTotal }).eq('id', talkSession.id);
      setTalkSession((t: any) => ({ ...t, is_paused: false, paused_at: null, total_paused_seconds: newTotal }));
      setIsPaused(false);
    } else {
      const now = new Date().toISOString();
      await supabase.from('talk_sessions').update({ is_paused: true, paused_at: now }).eq('id', talkSession.id);
      setTalkSession((t: any) => ({ ...t, is_paused: true, paused_at: now }));
      setIsPaused(true);
    }
  };

  const endSession = async () => {
    if (!talkSession) return;
    await supabase.from('talk_sessions').update({ ended_at: new Date().toISOString(), duration_seconds: elapsed, is_complete: true }).eq('id', talkSession.id);
    await supabase.from('coach_stars').insert({ session_id: session.id, user_id: user.id, user_email: user.email ?? '', activity_type: 'talk', reason: 'Completed talk session', stars: 1 });
    try {
      const userMsgs = messages.filter(m => m.role === 'user').map(m => m.content).join(' | ');
      if (userMsgs) {
        await supabase.from('activity_completions').insert({ session_id: session.id, user_id: user.id, user_email: user.email ?? '', activity_type: 'talk', item_id: talkSession.id, notes: userMsgs, learning: 'Talk session thought pattern captured', completed_date: fmtD(new Date()) });
        await recordPowerToGoal(session.id, session.capsule_id, user.id, user.email ?? '', 'talk', userMsgs);
      }
    } catch { /* silent */ }
    setShowClosePrompt(false);
    setTalkSession((t: any) => ({ ...t, ended_at: new Date().toISOString() }));
  };

  const continueSession = () => { setShowClosePrompt(false); };

  const send = async () => {
    if (!input.trim() || !talkSession) return;
    const userMsg = input.trim();
    setMessages(m => [...m, { role: 'user', content: userMsg }]);
    setInput('');
    setSending(true);
    try {
      const [{ data: profile }, { data: capsule }, { data: sessRow }] = await Promise.all([
        supabase.from('coachees').select('client_name,profession,preferred_checkin_time,default_emotion_tags,practice_comfort,privacy_preference').eq('email', user.email ?? '').maybeSingle(),
        supabase.from('capsules').select('name,description').eq('id', session.capsule_id).maybeSingle(),
        supabase.from('coaching_sessions').select('goals,summary,topic').eq('id', session.id).maybeSingle(),
      ]);
      const history = [...messages.slice(-8), { role: 'user', content: userMsg }].map(m => `${m.role}: ${m.content}`).join('\n');
      const sessionGoalText = (sessRow?.goals ?? []).length > 0 ? ((sessRow as any)?.goals as string[]).join('; ') : session.topic;
      const summaryText = (sessRow?.summary ?? []).length > 0 ? ((sessRow as any)?.summary as string[]).join('\n') : 'No summary recorded.';
      const capsuleGoalsText = capsule?.description ?? capsule?.name ?? 'No capsule description available.';
      const capsuleKnowledge = await getCapsuleKnowledge(session.capsule_id);
      const previousContext = await getPreviousSessionsContext(session.capsule_id, session.id, user.email ?? '');
      const res = await callLLM('wise_harry_coachee', {
        chatbot_name: chatbotCfg.chatbot_name,
        greeting_line: chatbotCfg.greeting_line ?? '',
        capsule_goals: capsuleGoalsText,
        capsule_knowledge: capsuleKnowledge,
        previous_sessions_context: previousContext,
        session_topic: session.topic,
        session_goal: sessionGoalText,
        session_summary: summaryText,
        guidelines: JSON.stringify(config?.prompts ?? []),
        coach_questions: JSON.stringify(config?.coach_questions ?? []),
        submodality: 'Visual',
        challenge: config?.end_goal ?? session.topic,
        metrics: JSON.stringify(config?.metrics ?? []),
        onboarding: JSON.stringify(profile ?? {}),
        history,
        current_user_message: userMsg,
      });
      const reply = stripMarkdown(res || 'Tell me more about that.');
      setMessages(m => [...m, { role: 'assistant', content: reply }]);
      await supabase.from('talk_messages').insert([
        { talk_session_id: talkSession.id, role: 'user', content: userMsg },
        { talk_session_id: talkSession.id, role: 'assistant', content: reply },
      ]);
      await recordPowerToGoal(session.id, session.capsule_id, user.id, user.email ?? '', 'talk', userMsg);
    } catch { /* silent */ }
    setSending(false);
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 text-teal-500 animate-spin" /></div>;
  if (!activity) return <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center text-sm text-gray-400">Talk activity not configured for this session yet.</div>;

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  const isComplete = elapsed >= durationMin * 60;

  return (
    <div className="space-y-3">
      <DateSelector activity={activity} label="Select date for talk session" selectedDate={selectedDate} onSelect={setSelectedDate} activityLabel="Wise Harry" />
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden flex flex-col" style={{ height: '60vh' }}>
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <div className="w-9 h-9 rounded-full overflow-hidden bg-teal-50 flex-shrink-0">
            <img src={chatbotCfg.chatbot_avatar_url ?? STOCK_IMAGES.wiseHarry} alt={chatbotCfg.chatbot_name} className="w-full h-full object-cover" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-gray-800">{chatbotCfg.chatbot_name}</p>
            <p className="text-xs text-gray-500">Target: {durationMin} min</p>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full font-mono ${isPaused ? 'bg-sky-50 text-sky-700' : isComplete ? 'bg-emerald-50 text-emerald-700' : (talkSession ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-500')}`}>{isPaused ? 'PAUSED' : `${mm}:${ss}`}</span>
          {talkSession && !talkSession.ended_at && <button onClick={togglePause} className={`text-xs px-2 py-1 rounded-full ${isPaused ? 'bg-emerald-50 text-emerald-700' : 'bg-sky-50 text-sky-700'}`}>{isPaused ? 'Resume' : 'Pause'}</button>}
          {talkSession && !talkSession.ended_at && <button onClick={endSession} className="text-xs text-red-600 hover:underline">End</button>}
          {showClosePrompt && (
            <div className="flex gap-2">
              <button onClick={continueSession} className="text-xs text-teal-600 border border-teal-200 px-2 py-1 rounded-lg hover:bg-teal-50">Continue</button>
              <button onClick={endSession} className="text-xs text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded-lg">Close Session</button>
            </div>
          )}
        </div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
          {!talkSession ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <img src={chatbotCfg.chatbot_avatar_url ?? STOCK_IMAGES.wiseHarry} alt={chatbotCfg.chatbot_name} className="w-20 h-20 rounded-full object-cover mb-3" />
              <p className="text-sm text-gray-600 mb-3">Start a session with {chatbotCfg.chatbot_name} to reflect on your progress.</p>
              <button onClick={startSession} disabled={selectedDate !== today} className="flex items-center gap-1 text-xs text-white bg-teal-600 hover:bg-teal-700 px-4 py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"><Play className="w-3.5 h-3.5" /> Start Session</button>
              {selectedDate !== today && <p className="text-xs text-gray-400 mt-2">Select today's date to start.</p>}
            </div>
          ) : messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${m.role === 'user' ? 'bg-teal-600 text-white' : 'bg-white border border-gray-100 text-gray-800'}`}>{m.content}</div>
            </div>
          ))}
        </div>
        {talkSession && !talkSession.ended_at && (
          <div className="p-3 border-t border-gray-100 flex gap-2">
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Type your message…"
              className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-teal-400" />
            <button onClick={send} disabled={sending} className="text-white bg-teal-600 hover:bg-teal-700 p-2 rounded-xl disabled:opacity-60">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        )}
      </div>
      <div className="px-4 pb-3">
        <ParkThoughtButton small onPark={onParkThought} />
      </div>
    </div>
  );
}

/* ============ Tasks ============ */

function TasksTab({ session, activity, user, onParkThought }: { session: CoacheeSession; activity: any; user: User; onParkThought?: () => void }) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [completions, setCompletions] = useState<Record<string, any[]>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [learning, setLearning] = useState<Record<string, string>>({});
  const [whatWentWell, setWhatWentWell] = useState<Record<string, string>>({});
  const [toBeFocused, setToBeFocused] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [listeningField, setListeningField] = useState<string | null>(null);

  const startVoice = (field: string, setter: (fn: (prev: Record<string, string>) => Record<string, string>) => void, taskId: string) => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Voice not supported on this browser.'); return; }
    const rec = new SR();
    rec.continuous = false; rec.interimResults = false; rec.lang = 'en-US';
    setListeningField(`${taskId}-${field}`);
    rec.onresult = (e: any) => { setter(prev => ({ ...prev, [taskId]: (prev[taskId] ?? '') + (prev[taskId] ? ' ' : '') + e.results[0][0].transcript })); };
    rec.onend = () => setListeningField(null);
    rec.start();
  };

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('cc_tasks').select('*').eq('activity_id', activity.id).order('position');
    setTasks((data as any[]) ?? []);
    const { data: comps } = await supabase.from('activity_completions').select('item_id,notes,completed_date,what_went_well,to_be_focused,completion_seq').eq('session_id', session.id).eq('user_id', user.id).eq('activity_type', 'tasks');
    const map: Record<string, any[]> = {};
    (comps as any[])?.forEach(c => { if (c.item_id) { (map[c.item_id] ??= []).push({ date: c.completed_date, notes: c.notes, whatWentWell: c.what_went_well, toBeFocused: c.to_be_focused }); } });
    setCompletions(map);
    setLoading(false);
  };

  useEffect(() => { if (activity) load(); else setLoading(false); }, [activity?.id, session.id, user.id]);

  const isDayComplete = (taskId: string, date: string, timesPerDay: number) => {
    const comps = (completions[taskId] ?? []).filter(c => c.date === date);
    return comps.length >= timesPerDay;
  };

  const markComplete = async (t: any, date: string) => {
    const timesPerDay = t.times_per_day ?? 1;
    const existing = (completions[t.id] ?? []).filter(c => c.date === date);
    if (existing.length >= timesPerDay) return;
    if (!notes[t.id]?.trim()) { alert('Please describe what you did.'); return; }
    if (!learning[t.id]?.trim()) { alert('Please write what you learned.'); return; }
    const seq = existing.length + 1;
    await supabase.from('activity_completions').insert({ session_id: session.id, user_id: user.id, user_email: user.email ?? '', activity_type: 'tasks', item_id: t.id, notes: notes[t.id], learning: learning[t.id], completed_date: date, completion_seq: seq, what_went_well: whatWentWell[t.id] || null, to_be_focused: toBeFocused[t.id] || null });
    await supabase.from('coach_stars').insert({ session_id: session.id, user_id: user.id, user_email: user.email ?? '', activity_type: 'tasks', reason: t.task_text, stars: 1 });
    try { await recordPowerToGoal(session.id, session.capsule_id, user.id, user.email ?? '', 'tasks', [notes[t.id], learning[t.id], whatWentWell[t.id], toBeFocused[t.id]].filter(Boolean).join(' ')); } catch { /* silent */ }
    setCompletions(c => ({ ...c, [t.id]: [...(c[t.id] ?? []), { date, notes: notes[t.id], whatWentWell: whatWentWell[t.id], toBeFocused: toBeFocused[t.id] }] }));
    setNotes(n => ({ ...n, [t.id]: '' }));
    setLearning(l => ({ ...l, [t.id]: '' }));
    setWhatWentWell(w => ({ ...w, [t.id]: '' }));
    setToBeFocused(f => ({ ...f, [t.id]: '' }));
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 text-teal-500 animate-spin" /></div>;

  return (
    <div className="space-y-3">
      <DateSelector activity={activity} label="Select date to attempt tasks" selectedDate={selectedDate} onSelect={setSelectedDate} activityLabel="Tasks" />
      {!selectedDate ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center text-sm text-gray-400">Please select a date above to attempt tasks.</div>
      ) : tasks.length === 0 ? <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center text-sm text-gray-400">No tasks assigned.</div> : (
        tasks.map((t) => {
          const timesPerDay = t.times_per_day ?? 1;
          const complete = isDayComplete(t.id, selectedDate, timesPerDay);
          return (
            <div key={t.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="flex gap-3 p-4">
                {t.image_url && <img src={t.image_url} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />}
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-800">{t.task_text}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{t.sub_modality} · {timesPerDay}x/day · {t.time_of_day ?? 'anytime'}</p>
                </div>
                <Star className="w-4 h-4 text-amber-400" />
              </div>
              <div className="px-4 pb-3">
                {complete ? (
                  <div className="bg-emerald-50 rounded-lg p-2"><span className="text-xs text-emerald-700 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Done for {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' })}</span></div>
                ) : (
                  <div className="space-y-2 bg-amber-50 rounded-lg p-2">
                    <div className="flex gap-1">
                      <input value={notes[t.id] ?? ''} onChange={e => setNotes(n => ({ ...n, [t.id]: e.target.value }))} placeholder="What did you do?" className="flex-1 px-2 py-1 rounded-lg border border-gray-200 text-xs outline-none focus:border-teal-400" />
                      <button onClick={() => startVoice('notes', setNotes, t.id)} className={`flex items-center justify-center w-7 h-7 rounded-lg shrink-0 ${listeningField === `${t.id}-notes` ? 'bg-rose-500 text-white animate-pulse' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}><Mic className="w-3 h-3" /></button>
                    </div>
                    <div className="flex gap-1">
                      <input value={learning[t.id] ?? ''} onChange={e => setLearning(l => ({ ...l, [t.id]: e.target.value }))} placeholder="What did you learn?" className="flex-1 px-2 py-1 rounded-lg border border-gray-200 text-xs outline-none focus:border-teal-400" />
                      <button onClick={() => startVoice('learning', setLearning, t.id)} className={`flex items-center justify-center w-7 h-7 rounded-lg shrink-0 ${listeningField === `${t.id}-learning` ? 'bg-rose-500 text-white animate-pulse' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}><Mic className="w-3 h-3" /></button>
                    </div>
                    <button onClick={() => markComplete(t, selectedDate)} className="text-xs text-white bg-teal-600 hover:bg-teal-700 px-2.5 py-1 rounded-lg">Mark Complete</button>
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
      <ParkThoughtButton onPark={onParkThought} />
    </div>
  );
}

/* ============ Quiz ============ */

function QuizTab({ session, activity, user, onParkThought }: { session: CoacheeSession; activity: any; user: User; onParkThought?: () => void }) {
  const [modules, setModules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [qi, setQi] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [stars, setStars] = useState(0);
  const [alreadyDoneToday, setAlreadyDoneToday] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');

  useEffect(() => {
    (async () => {
      if (!activity || !selectedDate) { setLoading(false); return; }
      setLoading(true);
      const questionsPerDay = activity?.questions_per_day ?? 5;
      const { data: mods } = await supabase.from('quiz_modules').select('id,title,position,frequency,questions_per_day,asked_question_ids').eq('activity_id', activity.id).order('position');
      const mList = (mods as any[]) ?? [];
      const allQs: any[] = [];
      for (const m of mList) {
        const { data: qs } = await supabase.from('quiz_questions').select('*').eq('module_id', m.id).order('created_at');
        m.questions = (qs as any[]) ?? [];
        allQs.push(...(m.questions ?? []));
      }
      setModules(mList);
      const { count } = await supabase.from('activity_completions').select('id', { count: 'exact', head: true }).eq('session_id', session.id).eq('user_id', user.id).eq('activity_type', 'quiz').eq('completed_date', selectedDate);
      setAlreadyDoneToday((count ?? 0) >= questionsPerDay);
      const askedIds = new Set((mList.flatMap((m: any) => m.asked_question_ids ?? []) as string[]));
      const unasked = allQs.filter(q => !askedIds.has(q.id));
      const asked = allQs.filter(q => askedIds.has(q.id));
      const shuffle = (arr: any[]) => arr.map(v => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(p => p[1]);
      let pool: any[];
      if (unasked.length >= questionsPerDay) pool = shuffle(unasked).slice(0, questionsPerDay);
      else if (unasked.length > 0) pool = [...shuffle(unasked), ...shuffle(asked)].slice(0, questionsPerDay);
      else pool = shuffle(allQs).slice(0, questionsPerDay);
      setQuizQuestions(pool);
      setLoading(false);
    })();
  }, [activity?.id, selectedDate]);

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 text-teal-500 animate-spin" /></div>;
  if (!activity) return <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center text-sm text-gray-400">Quiz activity not configured for this session yet.</div>;
  if (!selectedDate) return <DateSelector activity={activity} label="Select date to attempt quiz" selectedDate={selectedDate} onSelect={setSelectedDate} activityLabel="Quiz" />;
  if (alreadyDoneToday) return <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center"><p className="text-sm text-emerald-700 font-semibold">Quiz completed for {selectedDate}!</p><p className="text-xs text-gray-500 mt-1">Come back for the next round.</p><ParkThoughtButton onPark={onParkThought} /></div>;
  if (quizQuestions.length === 0) return <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center text-sm text-gray-400">No quiz available.</div>;

  const currentQuestion = quizQuestions[qi];
  if (!currentQuestion) {
    supabase.from('activity_completions').insert({ session_id: session.id, user_id: user.id, user_email: user.email ?? '', activity_type: 'quiz', item_id: 'quiz-complete', notes: 'Quiz completed', completed_date: selectedDate }).then(() => {});
    const askedIds = quizQuestions.map(q => q.id);
    for (const m of modules) {
      const modAsked = askedIds.filter(id => m.questions?.some((q: any) => q.id === id));
      if (modAsked.length) supabase.from('quiz_modules').update({ asked_question_ids: [...(m.asked_question_ids ?? []), ...modAsked] }).eq('id', m.id).then(() => {});
    }
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
        <p className="text-sm font-bold text-gray-800">Quiz Complete!</p>
        <p className="text-xs text-gray-500 mt-1">{stars} / {quizQuestions.length} correct</p>
        <ParkThoughtButton onPark={onParkThought} />
      </div>
    );
  }

  const pick = (idx: number) => {
    if (feedback) return;
    setSelected(idx);
    const correct = idx === currentQuestion.answer_index;
    setFeedback(correct ? 'correct' : 'wrong');
    if (correct) { setStars(s => s + 1); currentQuestion._answeredCorrect = true; supabase.from('coach_stars').insert({ session_id: session.id, user_id: user.id, user_email: user.email ?? '', activity_type: 'quiz', reason: currentQuestion.question, stars: 1 }).then(() => {}); }
    else { supabase.from('coach_stars').insert({ session_id: session.id, user_id: user.id, user_email: user.email ?? '', activity_type: 'quiz', reason: currentQuestion.question, stars: 0 }).then(() => {}); }
  };

  const next = () => { setSelected(null); setFeedback(null); if (qi + 1 < quizQuestions.length) setQi(qi + 1); else setQi(quizQuestions.length); };

  return (
    <div className="space-y-4">
      <DateSelector activity={activity} label="Quiz date" selectedDate={selectedDate} onSelect={(d) => { setSelectedDate(d); setQi(0); setSelected(null); setFeedback(null); setStars(0); }} activityLabel="Quiz" />
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500">Q{qi + 1} of {quizQuestions.length}</p>
        <span className="flex items-center gap-1 text-xs font-bold text-amber-600"><Star className="w-3.5 h-3.5" /> {stars}</span>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {currentQuestion.image_url && <img src={currentQuestion.image_url} alt="" className="w-full h-40 object-cover" />}
        <div className="p-5">
          <p className="text-sm font-bold text-gray-800 mb-4">{currentQuestion.question}</p>
          <div className="space-y-2">
            {currentQuestion.options.map((o: string, idx: number) => {
              let style = 'border-gray-200 hover:border-teal-300 bg-white';
              if (feedback && idx === currentQuestion.answer_index) style = 'border-emerald-500 bg-emerald-50 text-emerald-800';
              else if (feedback && idx === selected && idx !== currentQuestion.answer_index) style = 'border-red-500 bg-red-50 text-red-800';
              else if (feedback) style = 'border-gray-200 bg-gray-50 opacity-60';
              return <button key={idx} onClick={() => pick(idx)} disabled={!!feedback} className={`w-full text-left px-4 py-2.5 rounded-xl border-2 text-sm transition ${style}`}>{o}</button>;
            })}
          </div>
          {feedback && (
            <div className="mt-4">
              <p className={`text-sm font-bold ${feedback === 'correct' ? 'text-emerald-700' : 'text-red-700'}`}>{feedback === 'correct' ? 'Correct! +1 star' : 'Not quite. The correct answer is highlighted.'}</p>
              <button onClick={next} className="mt-3 text-xs text-white bg-teal-600 hover:bg-teal-700 px-4 py-2 rounded-lg">{qi + 1 >= quizQuestions.length ? 'Finish' : 'Next'}</button>
            </div>
          )}
        </div>
      </div>
      <ParkThoughtButton onPark={onParkThought} />
    </div>
  );
}

/* ============ Knowledge ============ */

function KnowledgeTab({ activity }: { session: CoacheeSession; activity: any }) {
  const [points, setPoints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activity) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase.from('knowledge_points').select('*').eq('activity_id', activity.id).order('position');
      setPoints((data as any[]) ?? []);
      setLoading(false);
    })();
  }, [activity?.id]);

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 text-teal-500 animate-spin" /></div>;
  if (!activity) return <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center text-sm text-gray-400">Knowledge activity not configured for this session yet.</div>;
  if (points.length === 0) return <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center text-sm text-gray-400">No knowledge points.</div>;

  return (
    <div className="space-y-4 max-w-md mx-auto">
      <p className="text-xs text-gray-400 text-center">Scroll to browse</p>
      <div className="overflow-y-auto rounded-2xl" style={{ height: '70vh' }}>
        <div className="space-y-4">
          {points.map((p, i) => (
            <div key={i} className="relative rounded-2xl overflow-hidden shadow-lg" style={{ height: '60vh' }}>
              <img src={p.image_url ?? knowledgeBgForIndex(i)} alt="" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <p className="text-white text-lg font-bold leading-snug drop-shadow-lg">{p.point_text}</p>
              </div>
              <div className="absolute top-4 right-4 text-white/80 text-xs font-mono">{i + 1} / {points.length}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============ Watch ============ */

function WatchTab({ session, activity, user, onParkThought }: { session: CoacheeSession; activity: any; user: User; onParkThought?: () => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [completions, setCompletions] = useState<Record<string, any[]>>({});
  const [videoWatched, setVideoWatched] = useState<Record<string, boolean>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [learning, setLearning] = useState<Record<string, string>>({});
  const [whatWentWell, setWhatWentWell] = useState<Record<string, string>>({});
  const [toBeFocused, setToBeFocused] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [listeningField, setListeningField] = useState<string | null>(null);

  const startVoice = (field: string, setter: (fn: (prev: Record<string, string>) => Record<string, string>) => void, itemId: string) => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Voice not supported on this browser.'); return; }
    const rec = new SR();
    rec.continuous = false; rec.interimResults = false; rec.lang = 'en-US';
    setListeningField(`${itemId}-${field}`);
    rec.onresult = (e: any) => { setter(prev => ({ ...prev, [itemId]: (prev[itemId] ?? '') + (prev[itemId] ? ' ' : '') + e.results[0][0].transcript })); };
    rec.onend = () => setListeningField(null);
    rec.start();
  };

  useEffect(() => {
    if (!activity) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase.from('watch_items').select('*').eq('activity_id', activity.id).order('position');
      setItems((data as any[]) ?? []);
      const { data: comps } = await supabase.from('activity_completions').select('item_id,notes,completed_date,learning').eq('session_id', session.id).eq('user_id', user.id).eq('activity_type', 'watch');
      const m: Record<string, any[]> = {}; const l: Record<string, string> = {};
      (comps as any[])?.forEach(c => { if (c.item_id) { (m[c.item_id] ??= []).push({ date: c.completed_date, notes: c.notes, learning: c.learning }); if (c.learning) l[c.item_id] = c.learning; } });
      setCompletions(m); setLearning(l);
      setLoading(false);
    })();
  }, [activity?.id, session.id, user.id]);

  const getYouTubeThumb = (url: string): string | null => {
    const m = url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/);
    return m ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : null;
  };
  const isYouTube = (url: string): boolean => /youtube\.com|youtu\.be/.test(url ?? '');

  const complete = async (w: any) => {
    if (!selectedDate) { alert('Please select a date first.'); return; }
    if (!videoWatched[w.id]) { alert('Please watch the video first.'); return; }
    if (!checked[w.id]) { alert('Please confirm you have watched the video.'); return; }
    if (!learning[w.id]?.trim()) { alert('Please write what you learned.'); return; }
    const existing = completions[w.id];
    if (Array.isArray(existing) && existing.filter((c: any) => c.date === selectedDate).length >= (w.times_per_day ?? 1)) { alert('Already completed for this date.'); return; }
    const seq = (Array.isArray(existing) ? existing.filter((c: any) => c.date === selectedDate).length : 0) + 1;
    await supabase.from('activity_completions').insert({ session_id: session.id, user_id: user.id, user_email: user.email ?? '', activity_type: 'watch', item_id: w.id, notes: 'watched', learning: learning[w.id], completed_date: selectedDate, completion_seq: seq, what_went_well: whatWentWell[w.id] || null, to_be_focused: toBeFocused[w.id] || null });
    await supabase.from('coach_stars').insert({ session_id: session.id, user_id: user.id, user_email: user.email ?? '', activity_type: 'watch', reason: w.title, stars: 1 });
    try { await recordPowerToGoal(session.id, session.capsule_id, user.id, user.email ?? '', 'watch', [learning[w.id], whatWentWell[w.id], toBeFocused[w.id]].filter(Boolean).join(' ')); } catch { /* silent */ }
    setCompletions(c => ({ ...c, [w.id]: [...((c as any)[w.id] ?? []), { date: selectedDate, learning: learning[w.id] }] }));
    setLearning(l => ({ ...l, [w.id]: '' }));
    setWhatWentWell(w => ({ ...w, [w.id]: '' }));
    setToBeFocused(f => ({ ...f, [w.id]: '' }));
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 text-teal-500 animate-spin" /></div>;
  if (!activity) return <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center text-sm text-gray-400">Watch activity not configured for this session yet.</div>;

  return (
    <div className="space-y-4">
      <DateSelector activity={activity} label="Select date to attempt watch" selectedDate={selectedDate} onSelect={setSelectedDate} activityLabel="Watch" />
      {!selectedDate ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center text-sm text-gray-400">Please select a date above to attempt watch.</div>
      ) : items.length === 0 ? <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center text-sm text-gray-400">No videos assigned.</div> : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {items.map(w => {
            const ytThumb = getYouTubeThumb(w.video_url);
            const yt = isYouTube(w.video_url);
            const todayComps = (completions[w.id] ?? []).filter((c: any) => c.date === selectedDate);
            const timesPerDay = w.times_per_day ?? 1;
            const isDone = todayComps.length >= timesPerDay;
            return (
              <div key={w.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <a href={w.video_url} target="_blank" rel="noreferrer" className="block relative aspect-square" onClick={() => setVideoWatched(v => ({ ...v, [w.id]: true }))}>
                  {ytThumb ? <img src={ytThumb} alt="" className="absolute inset-0 w-full h-full object-contain bg-black" /> : yt ? <div className="absolute inset-0 bg-red-600 flex items-center justify-center"><Youtube className="w-10 h-10 text-white" /></div> : <div className="absolute inset-0 bg-gray-800 flex items-center justify-center"><Play className="w-8 h-8 text-white" /></div>}
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center"><Play className="w-8 h-8 text-white" /></div>
                </a>
                <div className="p-2.5">
                  <p className="text-xs font-semibold text-gray-800 line-clamp-2">{w.title}</p>
                  {isDone ? (
                    <p className="text-[10px] text-emerald-700 flex items-center gap-0.5 mt-1.5"><Check className="w-3 h-3" /> Done</p>
                  ) : (
                    <div className="mt-2 space-y-1.5">
                      {videoWatched[w.id] && <label className="flex items-center gap-1 text-[10px] text-gray-700 cursor-pointer"><input type="checkbox" checked={checked[w.id] ?? false} onChange={e => setChecked(c => ({ ...c, [w.id]: e.target.checked }))} className="w-3 h-3 rounded border-gray-300 text-teal-600" /> Watched</label>}
                      <input value={learning[w.id] ?? ''} onChange={e => setLearning(l => ({ ...l, [w.id]: e.target.value }))} placeholder="What did you learn?" className="w-full px-2 py-1 rounded-lg border border-gray-200 text-[10px] outline-none focus:border-teal-400" />
                      <button onClick={() => complete(w)} disabled={!videoWatched[w.id] || !checked[w.id] || !learning[w.id]?.trim()} className="text-[10px] text-white bg-teal-600 hover:bg-teal-700 px-2 py-1 rounded-lg disabled:opacity-50 w-full">Done</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <ParkThoughtButton onPark={onParkThought} />
    </div>
  );
}

/* ============ Parking ============ */

function ParkingTab({ session, activity, user }: { session: CoacheeSession; activity: any; user: User }) {
  const [config, setConfig] = useState<any>(null);
  const [thread, setThread] = useState<any>(null);
  const [thought, setThought] = useState('');
  const [parked, setParked] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [listening, setListening] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [predicting, setPredicting] = useState(false);
  const [predictedTags, setPredictedTags] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [allSessionParked, setAllSessionParked] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const fmtD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const today = fmtD(new Date());
  const tags = (config?.tags ?? (activity?.config?.tags ?? [])) as string[];
  const allTags = tags.includes('Others') ? tags : [...tags, 'Others'];

  const predictTags = async (text: string) => {
    if (!text.trim() || text.length < 5 || allTags.length === 0) { setPredictedTags([]); return; }
    setPredicting(true);
    try {
      const tagList = allTags.filter(t => t !== 'Others').join(', ');
      const prompt = `You are a tag classification AI. Analyze the following thought and assign 1-3 tags from the available tag list.\n\nThought: "${text}"\n\nAvailable tags (pick from these ONLY): [${tagList}]\n\nReturn ONLY valid JSON: {"tags": ["tag1", "tag2"]}`;
      const result = await callLLM('custom_prompt', { prompt });
      const parsed = parseJSON<{ tags: string[] }>(result);
      if (parsed?.tags && Array.isArray(parsed.tags)) {
        const valid = parsed.tags.filter((t: string) => allTags.includes(t));
        if (valid.length > 0) { setPredictedTags(valid); setSelectedTags(valid); }
        else setPredictedTags([]);
      } else setPredictedTags([]);
    } catch { /* silent */ } finally { setPredicting(false); }
  };

  const predictTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (predictTimer.current) clearTimeout(predictTimer.current);
    if (thought.trim().length >= 5) predictTimer.current = setTimeout(() => predictTags(thought), 1200);
    else setPredictedTags([]);
    return () => { if (predictTimer.current) clearTimeout(predictTimer.current); };
  }, [thought, allTags.length]);

  useEffect(() => {
    if (!activity) { return; }
    (async () => {
      const { data: cfg } = await supabase.from('parking_config').select('*').eq('activity_id', activity.id).maybeSingle();
      setConfig(cfg ?? { tags: activity?.config?.tags ?? [], frequency: activity?.config?.frequency ?? 'daily_once' });
      const { data: goals } = await supabase.from('goals').select('id,title').eq('user_id', user.id);
      const gList = (goals as any[]) ?? [];
      if (gList.length > 0) {
        const { data: st } = await supabase.from('session_threads').select('*,goal_id').eq('session_id', session.id).in('goal_id', gList.map(g => g.id)).maybeSingle();
        setThread(st);
        if (st) {
          const { data: items } = await supabase.from('parked_items').select('id,content,tags,created_at,session_id').eq('goal_id', (st as any).goal_id).order('created_at', { ascending: false }).limit(50);
          setParked((items as any[]) ?? []);
        }
      }
    })();
  }, [activity?.id, session.id, user.id]);

  const loadAllSessions = async () => {
    const { data: allSessions } = await supabase.from('coaching_sessions').select('id,session_number,topic').eq('capsule_id', session.capsule_id).order('session_number');
    const sList = (allSessions as any[]) ?? [];
    const { data: allThreads } = await supabase.from('session_threads').select('goal_id,session_id').in('session_id', sList.map(s => s.id));
    const tList = (allThreads as any[]) ?? [];
    const { data: goals } = await supabase.from('goals').select('id').eq('user_id', user.id);
    const gList = (goals as any[]) ?? [];
    const threadGoalIds = tList.map(t => t.goal_id).filter(gid => gList.some(g => g.id === gid));
    if (threadGoalIds.length === 0) { setAllSessionParked([]); return; }
    const { data: allItems } = await supabase.from('parked_items').select('id,content,tags,created_at,session_id,goal_id').in('goal_id', threadGoalIds).order('created_at', { ascending: false });
    const items = (allItems as any[]) ?? [];
    const sessionMap: Record<string, string> = {};
    tList.forEach(t => { sessionMap[t.goal_id] = `S${sList.find(s => s.id === t.session_id)?.session_number ?? '?'}`; });
    setAllSessionParked(items.map(item => ({ ...item, session_tag: sessionMap[item.goal_id] ?? '' })));
  };

  const ensureThread = async (): Promise<string | null> => {
    if (thread) return (thread as any).goal_id;
    const title = `${session.capsule_name} / ${session.coach_name} / ${session.session_uid ?? 'S' + session.session_number}`;
    const { data: g } = await supabase.from('goals').insert({ user_id: user.id, title, is_general: false, is_all_thread: false }).select().single();
    if (!g) return null;
    await supabase.from('session_threads').insert({ session_id: session.id, session_uid: session.session_uid, goal_id: (g as any).id, thread_title: title, allowed_tags: allTags });
    setThread({ goal_id: (g as any).id });
    return (g as any).id;
  };

  const park = async () => {
    if (!thought.trim() || thought.length < 5) return;
    if (!selectedDate) { alert('Please select a date first.'); return; }
    if (selectedDate !== today) { alert('You can only park thoughts for today.'); return; }
    setSaving(true);
    const goalId = await ensureThread();
    if (!goalId) { setSaving(false); alert('Could not create thread.'); return; }
    const { data: row } = await supabase.from('parked_items').insert({ user_id: user.id, goal_id: goalId, raw_thought: thought.trim(), content: thought.trim(), item_type: 'task', tags: selectedTags, session_id: session.id }).select('id,content,tags,created_at').single();
    if (row) setParked(p => [row as any, ...p]);
    try { await recordPowerToGoal(session.id, session.capsule_id, user.id, user.email ?? '', 'parking', thought.trim()); } catch { /* silent */ }
    setThought(''); setSelectedTags([]); setSaving(false);
  };

  const toggleTag = (t: string) => setSelectedTags(s => s.includes(t) ? s.filter(x => x !== t) : [...s, t]);
  const toggleEditTag = (t: string) => setEditTags(s => s.includes(t) ? s.filter(x => x !== t) : [...s, t]);
  const startEdit = (p: any) => { setEditingId(p.id); setEditContent(p.content); setEditTags(p.tags ?? []); };
  const updateThought = async (id: string) => {
    await supabase.from('parked_items').update({ content: editContent, tags: editTags }).eq('id', id);
    setParked(p => p.map(item => item.id === id ? { ...item, content: editContent, tags: editTags } : item));
    setEditingId(null);
  };
  const startVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Voice not supported on this browser.'); return; }
    const rec = new SR();
    rec.continuous = false; rec.interimResults = false; rec.lang = 'en-US';
    setListening(true);
    rec.onresult = (e: any) => { setThought(t => (t ? t + ' ' : '') + e.results[0][0].transcript); };
    rec.onend = () => setListening(false);
    rec.start();
  };

  const displayList = showAllSessions ? allSessionParked : parked;
  const filteredParked = displayList.filter(p =>
    !searchQuery || p.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.tags ?? []).some((t: string) => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (p as any).session_tag?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <DateSelector activity={activity} label="Select date to park thoughts" selectedDate={selectedDate} onSelect={setSelectedDate} activityLabel="Parking" />
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <p className="text-xs font-semibold text-gray-500">Tags (nominated by coach):</p>
          {predicting && <span className="text-xs text-teal-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> predicting…</span>}
          {predictedTags.length > 0 && !predicting && <span className="text-xs text-teal-600 flex items-center gap-0.5"><Wand2 className="w-3 h-3" /> AI-suggested</span>}
        </div>
        {allTags.length === 0 ? <p className="text-xs text-gray-400 italic">No tags nominated by coach for this session yet.</p> : (
          <div className="flex flex-wrap gap-1.5">
            {allTags.map(t => {
              const isPredicted = predictedTags.includes(t);
              const isSelected = selectedTags.includes(t);
              return <button key={t} onClick={() => toggleTag(t)} className={`text-xs px-2.5 py-1 rounded-full font-medium border transition ${isSelected ? 'bg-teal-600 text-white border-teal-600' : isPredicted ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' : 'bg-teal-50 text-teal-700 border-teal-100 hover:bg-teal-100'}`}>{t}</button>;
            })}
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <textarea value={thought} onChange={e => setThought(e.target.value)} placeholder="Park your thought here..." rows={2} className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-teal-400 resize-none" />
        <button onClick={startVoice} className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${listening ? 'bg-rose-500 text-white animate-pulse' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}><Mic className="w-4 h-4" /></button>
      </div>
      <button onClick={park} disabled={!thought.trim() || saving || selectedDate !== today} className="text-xs text-white bg-teal-600 hover:bg-teal-700 px-4 py-2 rounded-lg disabled:opacity-50">{saving ? 'Parking...' : 'Park Thought'}</button>
      <div className="space-y-2">
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs font-bold text-gray-700">Parked Thoughts ({displayList.length})</p>
          <div className="flex items-center gap-2">
            <button onClick={() => { setShowAllSessions(s => !s); if (!showAllSessions) loadAllSessions(); }} className={`text-xs px-2 py-1 rounded-lg border ${showAllSessions ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>{showAllSessions ? 'This session only' : 'All sessions'}</button>
            {displayList.length > 0 && <div className="relative"><Search className="w-3 h-3 text-gray-400 absolute left-2 top-1.5" /><input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search..." className="pl-7 pr-2 py-1 text-xs border border-gray-200 rounded-lg outline-none focus:border-teal-400 w-44" /></div>}
          </div>
        </div>
        {filteredParked.length === 0 ? <p className="text-xs text-gray-400 italic">{displayList.length === 0 ? 'No thoughts parked yet.' : 'No thoughts match your search.'}</p> : filteredParked.map(p => (
          <div key={p.id} className="p-3 rounded-xl bg-gray-50 border border-gray-100">
            {editingId === p.id ? (
              <div className="space-y-2">
                <textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={2} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm outline-none focus:border-teal-400" />
                <div className="flex flex-wrap gap-1">{allTags.map(t => <button key={t} onClick={() => toggleEditTag(t)} className={`text-[10px] px-1.5 py-0.5 rounded-full border ${editTags.includes(t) ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-200'}`}>{t}</button>)}</div>
                <div className="flex gap-2"><button onClick={() => updateThought(p.id)} className="text-xs text-white bg-teal-600 px-2 py-1 rounded-lg">Save</button><button onClick={() => setEditingId(null)} className="text-xs text-gray-500 px-2 py-1 rounded-lg hover:bg-gray-100">Cancel</button></div>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-800">{p.content}</p>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  {(p.tags ?? []).map((t: string) => <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-600 border border-teal-100">{t}</span>)}
                  {(p as any).session_tag && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">{(p as any).session_tag}</span>}
                  <span className="text-[10px] text-gray-400 ml-auto">{new Date(p.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' })}</span>
                  <button onClick={() => startEdit(p)} className="text-[10px] text-teal-600 hover:text-teal-700 flex items-center gap-0.5"><Pencil className="w-2.5 h-2.5" /> Edit</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============ Park Thought button ============ */

function ParkThoughtButton({ small, onPark }: { small?: boolean; onPark?: () => void }) {
  const navigate = useNavigate();
  const [showInfo, setShowInfo] = useState(false);
  return (
    <div className={`flex items-center gap-2 ${small ? '' : 'mt-4'}`}>
      <button onClick={() => onPark ? onPark() : navigate('/parked-thoughts')} className={`flex items-center gap-1 text-teal-600 hover:text-teal-700 ${small ? 'text-xs' : 'text-xs'}`}>
        <Brain className="w-3.5 h-3.5" /> Park a thought
      </button>
      <button onClick={() => setShowInfo(s => !s)} className="p-0.5 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200" title="What is Park Thoughts?"><Info className="w-3 h-3" /></button>
      {showInfo && <p className="text-xs text-gray-500 flex-1">Park thoughts to reflect and capture insights from this session.</p>}
    </div>
  );
}
