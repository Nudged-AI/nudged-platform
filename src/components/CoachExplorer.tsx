import { useEffect, useState } from 'react';
import { Loader2, Layers, BookOpen, Filter, Search, Globe, Lock, Power, PowerOff, Send, FileText } from 'lucide-react';
import { supabase } from '../supabase';
import { formatDate, type Capsule, type CoachingSession, type Coach } from '../lib/coach';

interface Props {
  /** When provided, restricts to this coach's capsules; when null, shows all coaches (admin mode) */
  coach?: Coach | null;
  /** When true, shows coach name column (admin mode) */
  showCoach?: boolean;
}

interface CapsuleWithCoach extends Capsule {
  coach_name?: string;
}

interface SessionWithCoach extends CoachingSession {
  coach_name?: string;
  capsule_name?: string;
}

export default function CoachExplorer({ coach, showCoach }: Props) {
  const [view, setView] = useState<'capsules' | 'sessions'>('capsules');
  const [capsules, setCapsules] = useState<CapsuleWithCoach[]>([]);
  const [sessions, setSessions] = useState<SessionWithCoach[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState('');
  const [coachFilter, setCoachFilter] = useState('');
  const [coaches, setCoaches] = useState<Coach[]>([]);

  const load = async () => {
    setLoading(true);
    if (coach) {
      const { data: caps } = await supabase.from('capsules').select('*').eq('coach_id', coach.id).order('created_at', { ascending: false });
      setCapsules((caps as CapsuleWithCoach[]) ?? []);
      const { data: sess } = await supabase.from('coaching_sessions').select('*').eq('coach_id', coach.id).order('session_number', { ascending: true });
      setSessions((sess as SessionWithCoach[]) ?? []);
    } else {
      const { data: coachesList } = await supabase.from('coaches').select('*').order('coach_name');
      setCoaches((coachesList as Coach[]) ?? []);
      const { data: caps } = await supabase.from('capsules').select('*, coaches!inner(coach_name)').order('created_at', { ascending: false });
      const capsMapped = ((caps as any[]) ?? []).map((c) => ({ ...c, coach_name: c.coaches?.coach_name }));
      setCapsules(capsMapped as CapsuleWithCoach[]);
      const { data: sess } = await supabase.from('coaching_sessions').select('*, capsules!inner(name), coaches!inner(coach_name)').order('session_number', { ascending: true });
      const sessMapped = ((sess as any[]) ?? []).map((s) => ({ ...s, capsule_name: s.capsules?.name, coach_name: s.coaches?.coach_name }));
      setSessions(sessMapped as SessionWithCoach[]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [coach?.id]);

  const filteredCapsules = capsules.filter(c => {
    if (typeFilter && c.capsule_type !== typeFilter) return false;
    if (statusFilter === 'active' && !c.is_active) return false;
    if (statusFilter === 'inactive' && c.is_active) return false;
    if (visibilityFilter === 'public' && !c.is_public) return false;
    if (visibilityFilter === 'private' && c.is_public) return false;
    if (coachFilter && c.coach_name !== coachFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!c.name.toLowerCase().includes(q) && !(c.description ?? '').toLowerCase().includes(q) && !(c.coach_name ?? '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const filteredSessions = sessions.filter(s => {
    if (typeFilter) {
      const cap = capsules.find(c => c.id === s.capsule_id);
      if (!cap || cap.capsule_type !== typeFilter) return false;
    }
    if (statusFilter === 'submitted' && !s.is_submitted) return false;
    if (statusFilter === 'draft' && s.is_submitted) return false;
    if (statusFilter === 'active' && !s.is_active) return false;
    if (statusFilter === 'inactive' && s.is_active) return false;
    if (visibilityFilter === 'public' && !s.is_public) return false;
    if (visibilityFilter === 'private' && s.is_public) return false;
    if (coachFilter && s.coach_name !== coachFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!s.topic.toLowerCase().includes(q) && !(s.session_uid ?? '').toLowerCase().includes(q) && !(s.coach_name ?? '').toLowerCase().includes(q) && !(s.capsule_name ?? '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 text-teal-500 animate-spin" /></div>;

  return (
    <div>
      {/* View toggle */}
      <div className="flex gap-1 mb-3 bg-gray-100 p-1 rounded-xl w-fit">
        {([['capsules', 'Capsules', Layers], ['sessions', 'Sessions', BookOpen]] as const).map(([k, label, Icon]) => (
          <button key={k} onClick={() => setView(k)}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition ${view === k ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-500'}`}>
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 p-3 mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 text-xs text-gray-500 mr-1"><Filter className="w-3.5 h-3.5" /> Filters</div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
            className="pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:border-teal-400 w-44" />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:border-teal-400">
          <option value="">All types</option>
          <option value="Training">Training</option>
          <option value="Coaching">Coaching</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:border-teal-400">
          <option value="">All status</option>
          {view === 'capsules'
            ? <><option value="active">Active</option><option value="inactive">Inactive</option></>
            : <><option value="submitted">Submitted</option><option value="draft">Draft</option><option value="active">Active</option><option value="inactive">Inactive</option></>
          }
        </select>
        <select value={visibilityFilter} onChange={e => setVisibilityFilter(e.target.value)} className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:border-teal-400">
          <option value="">All visibility</option>
          <option value="public">Public</option>
          <option value="private">Private</option>
        </select>
        {showCoach && (
          <select value={coachFilter} onChange={e => setCoachFilter(e.target.value)} className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:border-teal-400">
            <option value="">All coaches</option>
            {coaches.map(c => <option key={c.id} value={c.coach_name}>{c.coach_name}</option>)}
          </select>
        )}
        <span className="text-xs text-gray-400 ml-auto">{view === 'capsules' ? filteredCapsules.length : filteredSessions.length} result(s)</span>
      </div>

      {/* Lists */}
      {view === 'capsules' ? (
        filteredCapsules.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <Layers className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No capsules match the filters.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredCapsules.map(c => (
              <div key={c.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-50 to-emerald-50 flex items-center justify-center flex-shrink-0"><Layers className="w-5 h-5 text-teal-600" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{c.name}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {c.capsule_type}{showCoach && c.coach_name ? ` · ${c.coach_name}` : ''}{c.description ? ` · ${c.description}` : ''}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${c.is_public ? 'bg-sky-50 text-sky-700' : 'bg-gray-100 text-gray-500'}`}>{c.is_public ? 'Public' : 'Private'}</span>
                <span className={`text-xs px-2 py-1 rounded-full ${c.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{c.is_active ? 'Active' : 'Inactive'}</span>
              </div>
            ))}
          </div>
        )
      ) : (
        filteredSessions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No sessions match the filters.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredSessions.map(s => (
              <div key={s.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center flex-shrink-0">
                  {s.is_submitted ? <Send className="w-4 h-4 text-orange-600" /> : <FileText className="w-4 h-4 text-amber-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">Session {s.session_number}: {s.topic}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {s.session_uid ?? '—'} · {formatDate(s.session_date)}
                    {showCoach && s.coach_name ? ` · ${s.coach_name}` : ''}
                    {s.capsule_name ? ` · ${s.capsule_name}` : ''}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${s.is_public ? 'bg-sky-50 text-sky-700' : 'bg-gray-100 text-gray-500'}`}>{s.is_public ? 'Public' : 'Private'}</span>
                <span className={`text-xs px-2 py-1 rounded-full ${s.is_submitted ? 'bg-orange-50 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>{s.is_submitted ? 'Submitted' : 'Draft'}</span>
                <span className={`text-xs px-2 py-1 rounded-full ${s.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{s.is_active ? 'Active' : 'Inactive'}</span>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
