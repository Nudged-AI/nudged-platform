import { useEffect, useState } from 'react';
import { GraduationCap, Plus, Trash2, Power, PowerOff, Loader2, Users } from 'lucide-react';
import { supabase } from '../supabase';
import type { User } from '@supabase/supabase-js';
import { type Coach } from '../lib/coach';

interface Props { user: User; }

export default function CoachOnboardingSection({ user }: Props) {
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ coach_name: '', coach_type: 'Coach', coach_niche: '', email: '' });
  const [error, setError] = useState('');
  const [bulkMode, setBulkMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('coaches').select('*').order('created_at', { ascending: false });
    setCoaches((data as Coach[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addCoach = async () => {
    if (!form.coach_name.trim() || !form.email.trim()) { setError('Name and email are required.'); return; }
    setAdding(true); setError('');
    const { data: existing } = await supabase.from('coaches').select('id').eq('email', form.email.trim()).maybeSingle();
    if (existing) { setError('Coach with this email already exists.'); setAdding(false); return; }
    // Link user_id if a user with this email exists
    // We cannot look up auth.users.email directly; just insert with null user_id — it will be linked on first login via a lookup RPC if needed
    const { error: insErr } = await supabase.from('coaches').insert({
      email: form.email.trim(),
      coach_name: form.coach_name.trim(),
      coach_type: form.coach_type,
      coach_niche: form.coach_niche.trim() || null,
      onboarded_by: user.email,
      is_active: true,
    });
    setAdding(false);
    if (insErr) { setError(insErr.message); return; }
    setForm({ coach_name: '', coach_type: 'Coach', coach_niche: '', email: '' });
    load();
  };

  const toggleActive = async (c: Coach) => {
    await supabase.from('coaches').update({ is_active: !c.is_active, updated_at: new Date().toISOString() }).eq('id', c.id);
    load();
  };

  const removeCoach = async (c: Coach) => {
    if (!confirm(`Remove coach ${c.coach_name}? This will deactivate their capsules.`)) return;
    await supabase.from('coaches').delete().eq('id', c.id);
    load();
  };

  const bulkDeactivate = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Deactivate ${selected.size} coaches?`)) return;
    await supabase.from('coaches').update({ is_active: false, updated_at: new Date().toISOString() }).in('id', Array.from(selected));
    setSelected(new Set());
    setBulkMode(false);
    load();
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mt-6">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-teal-600" />
          <p className="text-sm font-bold text-gray-800">Nudged Buddy Coach Onboarding</p>
        </div>
        <div className="flex items-center gap-2">
          {bulkMode && selected.size > 0 && (
            <button onClick={bulkDeactivate} className="flex items-center gap-1 text-xs text-white bg-red-500 hover:bg-red-600 px-2.5 py-1.5 rounded-lg transition">
              <PowerOff className="w-3.5 h-3.5" /> Deactivate ({selected.size})
            </button>
          )}
          <button onClick={() => setBulkMode(b => !b)} className="flex items-center gap-1 text-xs text-gray-600 border border-gray-200 hover:bg-gray-50 px-2.5 py-1.5 rounded-lg transition">
            <Users className="w-3.5 h-3.5" /> {bulkMode ? 'Done' : 'Bulk'}
          </button>
        </div>
      </div>

      {/* Add form */}
      <div className="px-6 py-4 bg-gray-50/50 border-b border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input value={form.coach_name} onChange={e => setForm(f => ({ ...f, coach_name: e.target.value }))}
            placeholder="Coach name" className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-teal-400 focus:ring-1 focus:ring-teal-100 outline-none" />
          <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            placeholder="Registered gmail id" className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-teal-400 focus:ring-1 focus:ring-teal-100 outline-none" />
          <select value={form.coach_type} onChange={e => setForm(f => ({ ...f, coach_type: e.target.value }))}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-teal-400 focus:ring-1 focus:ring-teal-100 outline-none">
            <option>Coach</option><option>Trainer</option><option>Both</option>
          </select>
          <div className="flex gap-2">
            <input value={form.coach_niche} onChange={e => setForm(f => ({ ...f, coach_niche: e.target.value }))}
              placeholder="Niche (optional)" className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-teal-400 focus:ring-1 focus:ring-teal-100 outline-none" />
            <button onClick={addCoach} disabled={adding} className="flex items-center gap-1 text-xs text-white bg-teal-600 hover:bg-teal-700 px-3 py-2 rounded-lg transition disabled:opacity-60">
              {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Add
            </button>
          </div>
        </div>
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 text-teal-500 animate-spin" /></div>
      ) : coaches.length === 0 ? (
        <div className="px-6 py-8 text-center text-sm text-gray-400">No coaches onboarded yet.</div>
      ) : (
        <div className="divide-y divide-gray-50">
          {coaches.map(c => (
            <div key={c.id} className="flex items-center gap-3 px-6 py-3">
              {bulkMode && (
                <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} className="w-4 h-4 rounded text-teal-600" />
              )}
              <div className="w-9 h-9 rounded-full bg-teal-50 flex items-center justify-center flex-shrink-0">
                <GraduationCap className="w-4 h-4 text-teal-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{c.coach_name}</p>
                <p className="text-xs text-gray-500 truncate">{c.email} · {c.coach_type}{c.coach_niche ? ` · ${c.coach_niche}` : ''}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${c.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                {c.is_active ? 'Active' : 'Inactive'}
              </span>
              <button onClick={() => toggleActive(c)} title={c.is_active ? 'Deactivate' : 'Activate'}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition">
                {c.is_active ? <Power className="w-3.5 h-3.5 text-emerald-600" /> : <PowerOff className="w-3.5 h-3.5 text-gray-400" />}
              </button>
              <button onClick={() => removeCoach(c)} title="Remove" className="p-1.5 rounded-lg hover:bg-red-50 transition">
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
