import React, { useEffect, useState, useCallback } from 'react';
import { Pencil, Check, X, Briefcase, Leaf, Calendar, User, DollarSign, Loader2, Flame, Tag, Trash2, Plus, GraduationCap, Home, Users, Brain } from 'lucide-react';
import { supabase } from '../supabase';
import type { User as SupaUser } from '@supabase/supabase-js';
import { TutorialBanner, InfoButton } from '../components/Tutorial';
import { DEFAULT_TAGS, getTagColor } from '../lib/tags';
import CoachProfileSection from '../components/CoachProfileSection';
import { getCoachForEmail } from '../lib/coach';

interface Props {
  user: SupaUser;
}

interface Profile {
  full_name: string;
  date_of_birth: string;
  gender: string;
  profession: string;
  job_business_details: string;
  marital_status: string;
  children: number;
  spirit_animal?: string;
  life_purpose?: string;
}

const ANIMALS = ['Lion','Tiger','Elephant','Eagle','Horse','Dolphin','Butterfly','Wolf','Owl','Dog'];
const PURPOSES = [
  'Empower people to unlock potential.',
  'Guide others toward meaningful growth.',
  'Transform challenges into simple solutions.',
  'Provide clarity during uncertain journeys.',
  'Connect dreams with disciplined action.',
  'Align actions with deeper values.',
  'Support builders creating lasting impact.',
  'Turn confusion into confident direction.',
  'Transform potential into meaningful contribution.',
  'Create meaning through useful contribution.',
];

const empty: Profile = {
  full_name: '', date_of_birth: '', gender: '',
  profession: '', job_business_details: '', marital_status: '', children: 0,
};

export default function ProfilePage({ user }: Props) {
  const [profile, setProfile] = useState<Profile>(empty);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Profile>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [balance, setBalance] = useState<number | null>(null);
  const [isExempt, setIsExempt] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [showExtModal, setShowExtModal] = useState(false);
  const [extEmail, setExtEmail] = useState('');
  const [extWhatsapp, setExtWhatsapp] = useState('');
  const [extAmount, setExtAmount] = useState(5);
  const [editingSpirit, setEditingSpirit] = useState(false);
  const [draftAnimal, setDraftAnimal] = useState('');
  const [draftPurpose, setDraftPurpose] = useState('');
  const [customPurpose, setCustomPurpose] = useState('');
  const [savingSpirit, setSavingSpirit] = useState(false);

  useEffect(() => {
    (async () => {
      const [profileRes, creditRes] = await Promise.all([
        supabase.from('user_profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('user_credits').select('balance_usd, is_exempt').eq('user_id', user.id).maybeSingle(),
      ]);
      if (profileRes.data) { setProfile(profileRes.data as Profile); setDraft(profileRes.data as Profile); }
      if (creditRes.data) {
        setBalance(creditRes.data.balance_usd);
        setIsExempt(creditRes.data.is_exempt);
      }
      setLoading(false);
    })();
  }, [user.id]);

  const startEdit = () => { setDraft({ ...profile }); setEditing(true); setError(''); setSuccess(''); };
  const cancelEdit = () => { setEditing(false); setError(''); };

  const set = (field: keyof Profile, value: string | number) =>
    setDraft(d => ({ ...d, [field]: value }));

  const handleSave = async () => {
    if (!draft.full_name.trim() || !draft.date_of_birth || !draft.gender ||
        !draft.profession || !draft.job_business_details.trim() || !draft.marital_status) {
      setError('Please fill all required fields.'); return;
    }
    setSaving(true); setError('');
    const { error: dbErr } = await supabase.from('user_profiles').upsert({
      id: user.id, ...draft, updated_at: new Date().toISOString(), onboarding_completed: true,
    });
    setSaving(false);
    if (dbErr) { setError(dbErr.message); return; }
    setProfile({ ...draft });
    setEditing(false);
    setSuccess('Profile updated successfully.');
    setTimeout(() => setSuccess(''), 3000);
  };

  const requestTopUp = async () => {
    if (!extEmail.trim()) return;
    setRequesting(true);
    try {
      const { error: reqErr } = await supabase.from('credit_extension_requests').insert({
        user_id: user.id,
        email: extEmail.trim(),
        whatsapp: extWhatsapp.trim() || null,
        amount_usd: extAmount,
        status: 'pending',
      });
      if (!reqErr) { setRequestSent(true); setShowExtModal(false); }
    } finally {
      setRequesting(false);
    }
  };

  const startEditSpirit = () => {
    setDraftAnimal(profile.spirit_animal ?? '');
    const existing = profile.life_purpose ?? '';
    if (PURPOSES.includes(existing)) { setDraftPurpose(existing); setCustomPurpose(''); }
    else { setDraftPurpose('__custom__'); setCustomPurpose(existing); }
    setEditingSpirit(true);
  };

  const saveSpirit = async () => {
    const finalPurpose = draftPurpose === '__custom__' ? customPurpose.trim() : draftPurpose;
    if (!draftAnimal || !finalPurpose) return;
    setSavingSpirit(true);
    const { error: err } = await supabase.from('user_profiles').update({ spirit_animal: draftAnimal, life_purpose: finalPurpose }).eq('id', user.id);
    setSavingSpirit(false);
    if (!err) {
      setProfile(p => ({ ...p, spirit_animal: draftAnimal, life_purpose: finalPurpose }));
      setEditingSpirit(false);
      setSuccess('Spirit & purpose updated.');
      setTimeout(() => setSuccess(''), 3000);
    }
  };

  const initials = profile.full_name
    ? profile.full_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : user.email?.[0].toUpperCase() ?? 'U';

  const formatDOB = (dob: string) => {
    if (!dob) return '—';
    return new Date(dob + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <TutorialBanner tutorialKey="profile" />
      {/* Header card */}
      <div className="bg-gradient-to-r from-teal-700 to-teal-500 rounded-2xl p-6 mb-6 flex items-center gap-5 shadow-lg shadow-teal-100">
        <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-white text-xl font-bold">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-lg leading-tight truncate">{profile.full_name || 'Your Name'}</p>
          <p className="text-white/70 text-sm mt-0.5 truncate">{user.email}</p>
          {profile.profession && (
            <span className="inline-flex items-center gap-1 mt-2 bg-white/20 text-white text-xs px-2.5 py-1 rounded-full font-medium">
              {profile.profession === 'Job' ? <Briefcase className="w-3 h-3" /> : <Leaf className="w-3 h-3" />}
              {profile.profession}
            </span>
          )}
        </div>
        {!editing && (
          <button onClick={startEdit} className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-sm px-3 py-2 rounded-xl transition flex-shrink-0">
            <Pencil className="w-3.5 h-3.5" /> Edit
          </button>
        )}
      </div>

      {success && <p className="text-sm text-teal-700 bg-teal-50 border border-teal-100 px-4 py-2.5 rounded-xl mb-4">{success}</p>}

      {/* Credit balance card */}
      {!isExempt && balance !== null && (
        <div className={`rounded-2xl border p-4 mb-6 flex items-center justify-between gap-4 ${balance > 1 ? 'bg-green-50 border-green-100' : balance > 0 ? 'bg-orange-50 border-orange-100' : 'bg-red-50 border-red-100'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${balance > 1 ? 'bg-green-100' : balance > 0 ? 'bg-orange-100' : 'bg-red-100'}`}>
              <DollarSign className={`w-4 h-4 ${balance > 1 ? 'text-green-600' : balance > 0 ? 'text-orange-500' : 'text-red-500'}`} />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-700">AI Credit Balance</p>
              <p className={`text-lg font-bold ${balance > 1 ? 'text-green-600' : balance > 0 ? 'text-orange-500' : 'text-red-500'}`}>
                ${balance.toFixed(3)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Used to power Harry, Ritual, Good News & more</p>
            </div>
          </div>
          {balance <= 1 && (
            requestSent ? (
              <div className="flex items-center gap-1.5 px-3 py-2 bg-teal-100 rounded-xl text-xs text-teal-700 font-semibold">
                <Check className="w-3.5 h-3.5" /> Request Sent
              </div>
            ) : (
              <button
                onClick={() => { setExtEmail(user.email ?? ''); setShowExtModal(true); }}
                className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 text-white rounded-xl text-xs font-semibold hover:bg-teal-700 transition-all flex-shrink-0"
              >
                <DollarSign className="w-3 h-3" />
                Request Top-up
              </button>
            )
          )}
        </div>
      )}

      {/* Profile details */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-teal-600" />
            <p className="text-sm font-bold text-gray-800">Profile Details</p>
          </div>
          {editing && (
            <div className="flex items-center gap-2">
              <button onClick={cancelEdit} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition">
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-1 text-xs text-white bg-teal-600 hover:bg-teal-700 px-2.5 py-1.5 rounded-lg transition disabled:opacity-60">
                {saving ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Save
              </button>
            </div>
          )}
        </div>

        {error && <p className="text-xs text-red-600 bg-red-50 px-4 py-2.5">{error}</p>}

        <div className="divide-y divide-gray-50">
          {/* Full Name */}
          <Row label="Full Name" required>
            {editing
              ? <input value={draft.full_name} onChange={e => set('full_name', e.target.value)} className={inputCls} placeholder="Enter full name" />
              : <span className={valueCls}>{profile.full_name || '—'}</span>}
          </Row>

          {/* DOB */}
          <Row label="Date of Birth" required>
            {editing
              ? (
                <div className="relative flex-1">
                  <input type="date" value={draft.date_of_birth} onChange={e => set('date_of_birth', e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className={inputCls} />
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              )
              : <span className={valueCls}>{formatDOB(profile.date_of_birth)}</span>}
          </Row>

          {/* Gender */}
          <Row label="Gender" required>
            {editing
              ? (
                <select value={draft.gender} onChange={e => set('gender', e.target.value)} className={inputCls}>
                  <option value="">Select gender</option>
                  <option>Male</option><option>Female</option><option>Non-binary</option><option>Prefer not to say</option>
                </select>
              )
              : <span className={valueCls}>{profile.gender || '—'}</span>}
          </Row>

          {/* Profession */}
          <Row label="Profession" required>
            {editing
              ? (
                <div className="flex gap-2 flex-1">
                  {['Job', 'Business'].map(v => (
                    <button key={v} type="button" onClick={() => set('profession', v)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition ${draft.profession === v ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-200 text-gray-600 hover:border-teal-300'}`}>
                      {v === 'Job' ? <Briefcase className="w-3.5 h-3.5" /> : <Leaf className="w-3.5 h-3.5" />} {v}
                    </button>
                  ))}
                </div>
              )
              : <span className={valueCls}>{profile.profession || '—'}</span>}
          </Row>

          {/* Job / Business Details */}
          <Row label="Job / Business Details" required>
            {editing
              ? <textarea value={draft.job_business_details} onChange={e => set('job_business_details', e.target.value)}
                  maxLength={200} rows={2} placeholder="Describe your role or business..."
                  className={inputCls + ' resize-none'} />
              : <span className={valueCls}>{profile.job_business_details || '—'}</span>}
          </Row>

          {/* Marital Status */}
          <Row label="Marital Status" required>
            {editing
              ? (
                <select value={draft.marital_status} onChange={e => set('marital_status', e.target.value)} className={inputCls}>
                  <option value="">Select status</option>
                  <option>Single</option><option>Married</option><option>Divorced</option>
                  <option>Widowed</option><option>Separated</option><option>Prefer not to say</option>
                </select>
              )
              : <span className={valueCls}>{profile.marital_status || '—'}</span>}
          </Row>

          {/* Children */}
          <Row label="Children" required>
            {editing
              ? (
                <select value={draft.children} onChange={e => set('children', parseInt(e.target.value))} className={inputCls}>
                  {[0, 1, 2, 3, 4, 5].map(n => (
                    <option key={n} value={n}>{n === 0 ? 'None' : n === 5 ? '5 or more' : n}</option>
                  ))}
                </select>
              )
              : <span className={valueCls}>{profile.children === 0 ? 'None' : String(profile.children)}</span>}
          </Row>
        </div>
      </div>

      {/* Default App Selection */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mt-6">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
          <Home className="w-4 h-4 text-teal-600" />
          <p className="text-sm font-bold text-gray-800">Default App</p>
        </div>
        <div className="px-6 py-4">
          <p className="text-xs text-gray-500 mb-3">Choose which app opens when you log in. You can switch anytime from the sidebar.</p>
          <div className="flex gap-2">
            {(['buddy', 'parker'] as const).map(m => (
              <button
                key={m}
                onClick={async () => {
                  await supabase.from('user_profiles').update({ preferred_app: m }).eq('id', user.id);
                  setProfile(p => ({ ...p, preferred_app: m }));
                  setSuccess(`Default app set to ${m === 'buddy' ? 'Buddy' : 'Parker'}.`);
                  setTimeout(() => setSuccess(''), 3000);
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition ${
                  profile.preferred_app === m
                    ? m === 'buddy' ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-amber-500 bg-amber-50 text-amber-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {m === 'buddy' ? <Users className="w-4 h-4" /> : <Brain className="w-4 h-4" />}
                {m === 'buddy' ? 'Buddy' : 'Parker'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tag Catalogue */}
      <TagCatalogue user={user} />

      {/* Spirit Animal & Life Purpose */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mt-6">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-500" />
            <p className="text-sm font-bold text-gray-800">Spirit & Purpose</p>
          </div>
          {!editingSpirit && (
            <button onClick={startEditSpirit} className="flex items-center gap-1.5 text-xs text-teal-600 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-lg transition">
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
          )}
          {editingSpirit && (
            <div className="flex items-center gap-2">
              <button onClick={() => setEditingSpirit(false)} className="text-xs text-gray-500 hover:text-gray-700 px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition flex items-center gap-1"><X className="w-3.5 h-3.5" /> Cancel</button>
              <button onClick={saveSpirit} disabled={savingSpirit || !draftAnimal} className="text-xs text-white bg-teal-600 hover:bg-teal-700 px-2.5 py-1.5 rounded-lg transition disabled:opacity-60 flex items-center gap-1">
                {savingSpirit ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save
              </button>
            </div>
          )}
        </div>
        <div className="px-6 py-4">
          {!editingSpirit ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-28 flex-shrink-0">Spirit Animal</span>
                <span className="text-sm font-semibold text-gray-800">{profile.spirit_animal || '—'}</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-xs text-gray-500 w-28 flex-shrink-0 pt-0.5">Life Purpose</span>
                <span className="text-sm text-gray-700 leading-relaxed">{profile.life_purpose || '—'}</span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-2">Choose your Spirit Animal</p>
                <div className="flex flex-wrap gap-1.5">
                  {ANIMALS.map(a => (
                    <button key={a} onClick={() => setDraftAnimal(a)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${draftAnimal === a ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-200 hover:border-teal-300'}`}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-2">Life Purpose</p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {PURPOSES.map(p => (
                    <button key={p} onClick={() => setDraftPurpose(p)}
                      className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition ${draftPurpose === p ? 'border-teal-500 bg-teal-50 text-teal-800 font-medium' : 'border-gray-200 bg-white text-gray-600 hover:border-teal-300'}`}>
                      {draftPurpose === p && <Check className="w-3.5 h-3.5 inline mr-1.5 text-teal-600" />}{p}
                    </button>
                  ))}
                  <button onClick={() => setDraftPurpose('__custom__')}
                    className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition ${draftPurpose === '__custom__' ? 'border-teal-500 bg-teal-50 text-teal-800 font-medium' : 'border-gray-200 bg-white text-gray-500 hover:border-teal-300'}`}>
                    Write my own...
                  </button>
                </div>
                {draftPurpose === '__custom__' && (
                  <textarea
                    value={customPurpose}
                    onChange={e => setCustomPurpose(e.target.value.slice(0, 200))}
                    placeholder="Describe your life purpose..."
                    rows={2}
                    className="w-full mt-2 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center mt-6">Your information is private and secure.</p>

      {/* Credit extension request modal */}
      {showExtModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Request Credit Top-up</h3>
              <button onClick={() => setShowExtModal(false)} className="p-1 text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-gray-500 mb-4">We'll review your request and add credits to your account.</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">Email *</label>
                <input value={extEmail} onChange={e => setExtEmail(e.target.value)} placeholder="your@email.com" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">WhatsApp (optional)</label>
                <input value={extWhatsapp} onChange={e => setExtWhatsapp(e.target.value)} placeholder="+1 234 567 8900" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">Amount</label>
                <div className="flex gap-2">
                  {[5, 10, 20].map(amt => (
                    <button key={amt} onClick={() => setExtAmount(amt)} className={`flex-1 py-2 rounded-lg border text-sm font-semibold transition ${extAmount === amt ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-700 border-gray-200 hover:border-teal-300'}`}>${amt}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowExtModal(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={requestTopUp} disabled={requesting || !extEmail.trim()} className="flex-1 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-60 transition">
                {requesting ? 'Sending...' : `Request $${extAmount}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls = 'flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition bg-white w-full';
const valueCls = 'text-sm text-gray-800 font-medium';

function Row({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 px-6 py-3.5">
      <span className="text-xs text-gray-500 w-40 flex-shrink-0 pt-2">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </span>
      <div className="flex-1 min-w-0 pt-1.5">{children}</div>
    </div>
  );
}

function TagCatalogue({ user }: { user: SupaUser }) {
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTag, setNewTag] = useState('');
  const [error, setError] = useState('');

  const fetchTags = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('custom_tags').select('tag_name').eq('user_id', user.id);
    setTags((data ?? []).map((r: any) => r.tag_name).sort((a: string, b: string) => a.localeCompare(b)));
    setLoading(false);
  }, [user.id]);

  useEffect(() => { fetchTags(); }, [fetchTags]);

  const handleDelete = async (tag: string) => {
    await supabase.from('custom_tags').delete().eq('user_id', user.id).eq('tag_name', tag);
    setTags(p => p.filter(t => t !== tag));
  };

  const handleAdd = async () => {
    const t = newTag.trim().toLowerCase().replace(/\s+/g, '-');
    if (!t) return;
    if (DEFAULT_TAGS.includes(t) || tags.includes(t)) { setError('Tag already exists.'); return; }
    await supabase.from('custom_tags').insert({ user_id: user.id, tag_name: t });
    setTags(p => [...p, t].sort((a, b) => a.localeCompare(b)));
    setNewTag('');
    setError('');
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
        <Tag className="w-4 h-4 text-teal-600" />
        <p className="text-sm font-bold text-gray-800">Tag Catalogue</p>
        <InfoButton text="All custom tags you've created across all threads. Delete a tag to remove it from search and thought creation — existing thoughts keep their tags." />
        <span className="text-xs text-gray-400 ml-auto">{tags.length} custom tags</span>
      </div>
      <div className="px-6 py-4">
        {loading ? (
          <div className="flex justify-center py-4"><div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-4">
              {DEFAULT_TAGS.map(tag => {
                const c = getTagColor(tag, tags);
                return <span key={tag} className={`text-xs px-2.5 py-1 rounded-full ${c.bg} ${c.text} font-medium`}>#{tag}</span>;
              })}
              {tags.map(tag => {
                const c = getTagColor(tag, tags);
                return (
                  <span key={tag} className={`text-xs px-2.5 py-1 rounded-full ${c.bg} ${c.text} font-medium flex items-center gap-1`}>
                    #{tag}
                    <button onClick={() => handleDelete(tag)} className="hover:text-red-500 transition"><X className="w-2.5 h-2.5" /></button>
                  </span>
                );
              })}
              {tags.length === 0 && <span className="text-xs text-gray-400">No custom tags yet — add one below.</span>}
            </div>
            <div className="flex items-center gap-2">
              <input value={newTag} onChange={e => { setNewTag(e.target.value.slice(0, 20)); setError(''); }}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
                placeholder="Add new tag..." className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-400 w-48 bg-white" />
              <button onClick={handleAdd} className="flex items-center gap-1 text-sm text-teal-600 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-lg font-medium transition">
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
              {error && <span className="text-xs text-red-500">{error}</span>}
            </div>
          </>
        )}
      </div>

      {/* Coach Details section — only if user is a registered coach */}
      <CoachProfileSection user={user} />
    </div>
  );
}
