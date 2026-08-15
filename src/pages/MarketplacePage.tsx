import { useEffect, useState } from 'react';
import { Search, ShoppingBag, Loader2, Check, GraduationCap, X, Lock } from 'lucide-react';
import { supabase } from '../supabase';
import type { User } from '@supabase/supabase-js';
import { STOCK_IMAGES, formatDate } from '../lib/coach';

interface Props { user: User; }

interface MarketSession {
  id: string;
  topic: string;
  session_uid: string | null;
  session_date: string | null;
  session_number: number;
  capsule_id: string;
  capsule_name: string;
  coach_id: string;
  coach_name: string;
  organization: string | null;
  portrait_url: string | null;
  categories: string[];
  niches: string[];
}

export default function MarketplacePage({ user }: Props) {
  const [sessions, setSessions] = useState<MarketSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [purchased, setPurchased] = useState<Set<string>>(new Set());
  const [buying, setBuying] = useState<string | null>(null);
  const [passcodeModal, setPasscodeModal] = useState<MarketSession | null>(null);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [passcodeError, setPasscodeError] = useState('');

  const load = async () => {
    setLoading(true);
    const { data: capsules } = await supabase.from('capsules').select('id,name,coach_id,capsule_type,description').eq('is_public', true).eq('is_active', true);
    const capList = (capsules as any[]) ?? [];
    const coachIds = Array.from(new Set(capList.map(c => c.coach_id)));
    const { data: coaches } = await supabase.from('coaches').select('id,coach_name,coach_niche').in('id', coachIds.length ? coachIds : ['00000000-0000-0000-0000-000000000000']);
    const coachMap: Record<string, any> = {};
    (coaches as any[])?.forEach(c => { coachMap[c.id] = c; });
    const { data: profiles } = await supabase.from('coach_profiles').select('coach_id,portrait_url,categories,niches').in('coach_id', coachIds.length ? coachIds : ['00000000-0000-0000-0000-000000000000']);
    const profMap: Record<string, any> = {};
    (profiles as any[])?.forEach(p => { profMap[p.coach_id] = p; });
    const capIds = capList.map(c => c.id);
    const { data: sessions } = await supabase.from('coaching_sessions').select('id,topic,session_uid,session_date,session_number,capsule_id,coach_id,is_public,is_active,is_submitted').in('capsule_id', capIds.length ? capIds : ['00000000-0000-0000-0000-000000000000']).eq('is_public', true).eq('is_active', true).eq('is_submitted', true);
    const sList = (sessions as any[]) ?? [];
    const rows: MarketSession[] = [];
    for (const cap of capList) {
      const capSessions = sList.filter(s => s.capsule_id === cap.id);
      const coach = coachMap[cap.coach_id];
      const prof = profMap[cap.coach_id];
      const base = {
        capsule_id: cap.id, capsule_name: cap.name,
        coach_id: cap.coach_id, coach_name: coach?.coach_name ?? 'Coach',
        organization: coach?.coach_niche ?? null,
        portrait_url: prof?.portrait_url ?? null, categories: prof?.categories ?? [], niches: prof?.niches ?? [],
      };
      if (capSessions.length === 0) {
        rows.push({ id: `cap-${cap.id}`, topic: cap.description || 'Capsule available — sessions coming soon', session_uid: null, session_date: null, session_number: 0, ...base });
      } else {
        for (const s of capSessions) {
          rows.push({ id: s.id, topic: s.topic, session_uid: s.session_uid, session_date: s.session_date, session_number: s.session_number, ...base });
        }
      }
    }
    setSessions(rows);
    const { data: pur } = await supabase.from('session_purchases').select('session_id').eq('user_id', user.id);
    setPurchased(new Set((pur as any[])?.map(p => p.session_id) ?? []));
    setLoading(false);
  };

  useEffect(() => { load(); }, [user.id]);

  const startBuy = (s: MarketSession) => setPasscodeModal(s);

  const redeemPasscode = async () => {
    if (!passcodeModal || !passcodeInput.trim()) return;
    setPasscodeError('');
    const { data: pk } = await supabase.from('session_passkeys').select('id').eq('session_id', passcodeModal.id).eq('passkey', passcodeInput.trim()).maybeSingle();
    if (!pk) { setPasscodeError('Wrong passcode. Session not added.'); return; }
    await supabase.from('session_purchases').insert({ session_id: passcodeModal.id, user_id: user.id, user_email: user.email ?? '' });
    await supabase.from('session_nominees').upsert({ session_id: passcodeModal.id, coachee_email: user.email ?? '' }, { onConflict: 'session_id,coachee_email' });
    setPurchased(prev => new Set([...prev, passcodeModal.id]));
    setPasscodeModal(null); setPasscodeInput(''); setPasscodeError('');
  };

  const filtered = sessions.filter(s => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return s.coach_name.toLowerCase().includes(q) || s.topic.toLowerCase().includes(q) || s.capsule_name.toLowerCase().includes(q);
  });

  // Group by coach, then by capsule
  const grouped: Record<string, { coach: any; capsules: Record<string, { capsule: any; sessions: MarketSession[] }> }> = {};
  for (const s of filtered) {
    if (!grouped[s.coach_id]) grouped[s.coach_id] = { coach: { name: s.coach_name, organization: s.organization, portrait_url: s.portrait_url }, capsules: {} };
    if (!grouped[s.coach_id].capsules[s.capsule_id]) grouped[s.coach_id].capsules[s.capsule_id] = { capsule: { name: s.capsule_name, categories: s.categories, niches: s.niches }, sessions: [] };
    grouped[s.coach_id].capsules[s.capsule_id].sessions.push(s);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 pb-24"
      style={{ backgroundImage: `linear-gradient(rgba(255,255,255,0.92), rgba(255,255,255,0.92)), url(${STOCK_IMAGES.leafSoft})`, backgroundSize: 'cover', backgroundAttachment: 'fixed' }}>
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <ShoppingBag className="w-5 h-5 text-teal-600" />
          <h1 className="text-xl font-black text-gray-900 tracking-tight">Nudged Marketplace</h1>
        </div>
        <p className="text-xs text-gray-500">Browse capsules and sessions across all coaches. Buy to add to your Coachee tab.</p>
      </div>

      <div className="relative mb-5">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by coach name or session topic"
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:border-teal-400 focus:ring-1 focus:ring-teal-100 outline-none" />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-teal-500 animate-spin" /></div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="bg-white/80 rounded-2xl border border-gray-100 p-10 text-center">
          <ShoppingBag className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No public sessions available yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([coachId, cg]) => (
            <div key={coachId}>
              {/* Coach header */}
              <div className="flex items-center gap-3 mb-3 bg-white/70 rounded-2xl p-3 border border-gray-100">
                <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-teal-50">
                  {cg.coach.portrait_url ? <img src={cg.coach.portrait_url} alt={cg.coach.name} className="w-full h-full object-cover" /> :
                    <div className="w-full h-full flex items-center justify-center"><GraduationCap className="w-6 h-6 text-teal-500" /></div>}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{cg.coach.name}</p>
                  {cg.coach.organization && <p className="text-xs text-gray-500">{cg.coach.organization}</p>}
                </div>
              </div>
              {/* Capsules under coach */}
              <div className="space-y-4 ml-2 md:ml-4">
                {Object.entries(cg.capsules).map(([capId, capGroup]) => (
                  <div key={capId}>
                    <p className="text-xs font-semibold text-teal-700 mb-2 flex items-center gap-1.5"><GraduationCap className="w-3.5 h-3.5" /> {capGroup.capsule.name}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {capGroup.sessions.map(s => {
                        const owned = purchased.has(s.id);
                        return (
                          <div key={s.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition">
                            <div className="flex gap-3 p-4">
                              <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-teal-50">
                                {s.portrait_url ? <img src={s.portrait_url} alt={s.coach_name} className="w-full h-full object-cover" /> :
                                  <div className="w-full h-full flex items-center justify-center"><GraduationCap className="w-6 h-6 text-teal-500" /></div>}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-800 truncate">{s.topic}</p>
                                <p className="text-xs text-gray-500">{s.session_uid ? `Session ${s.session_number} · ${formatDate(s.session_date)}` : 'Sessions coming soon'}</p>
                              </div>
                            </div>
                            <div className="px-4 pb-4 flex items-center justify-between">
                              {owned ? (
                                <span className="flex items-center gap-1 text-xs text-emerald-700 font-semibold"><Check className="w-3.5 h-3.5" /> Added</span>
                              ) : s.session_uid ? (
                                <button onClick={() => startBuy(s)} disabled={buying === s.id}
                                  className="flex items-center gap-1 text-xs text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 px-4 py-2 rounded-lg shadow-sm transition disabled:opacity-60 font-bold">
                                  <Lock className="w-3.5 h-3.5" /> Buy
                                </button>
                              ) : (
                                <button disabled className="flex items-center gap-1 text-xs text-gray-400 bg-gray-100 px-4 py-2 rounded-lg cursor-not-allowed">
                                  <ShoppingBag className="w-3.5 h-3.5" /> Buy
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Passcode modal */}
      {passcodeModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-gray-800 flex items-center gap-1.5"><Lock className="w-4 h-4 text-teal-600" /> Enter Passcode</p>
              <button onClick={() => { setPasscodeModal(null); setPasscodeInput(''); setPasscodeError(''); }} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-4 h-4 text-gray-500" /></button>
            </div>
            <p className="text-xs text-gray-500 mb-3">{passcodeModal.topic}</p>
            <input value={passcodeInput} onChange={e => setPasscodeInput(e.target.value)} placeholder="Passcode"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-teal-400" />
            {passcodeError && <p className="text-xs text-red-600 mt-2">{passcodeError}</p>}
            <button onClick={redeemPasscode} className="w-full mt-3 text-xs text-white bg-teal-600 hover:bg-teal-700 py-2 rounded-lg">Add to my sessions</button>
          </div>
        </div>
      )}
    </div>
  );
}
