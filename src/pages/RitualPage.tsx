import React, { useState } from 'react';
import { Loader2, Send, Music, RefreshCw } from 'lucide-react';
import { supabase } from '../supabase';
import { callLLM, parseJSON } from '../lib/llm';
import type { UserProfile } from '../supabase';

interface Props {
  userId: string;
  profile: UserProfile;
}

const AFFIRMATION_ICONS = ['✦', '❋', '✿'];
const GRATITUDE_ICONS = ['♡', '☽', '✦'];

const AFFIRMATION_COLORS = [
  { bg: 'bg-teal-50', border: 'border-teal-100', text: 'text-teal-800', icon: 'text-teal-400' },
  { bg: 'bg-rose-50', border: 'border-rose-100', text: 'text-rose-800', icon: 'text-rose-400' },
  { bg: 'bg-violet-50', border: 'border-violet-100', text: 'text-violet-800', icon: 'text-violet-400' },
];

const GRATITUDE_COLORS = [
  { bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-800', icon: 'text-amber-400' },
  { bg: 'bg-green-50', border: 'border-green-100', text: 'text-green-800', icon: 'text-green-400' },
  { bg: 'bg-sky-50', border: 'border-sky-100', text: 'text-sky-800', icon: 'text-sky-400' },
];

export default function RitualPage({ userId, profile }: Props) {
  const [concern, setConcern] = useState('');
  const [loading, setLoading] = useState(false);
  const [affirmations, setAffirmations] = useState<string[]>([]);
  const [gratitudes, setGratitudes] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!concern.trim()) return;
    setLoading(true);
    setError('');
    try {
      const [wiseHistory, visions] = await Promise.all([
        supabase.from('wise_advice_messages').select('content, role').eq('user_id', userId).order('created_at', { ascending: false }).limit(6),
        supabase.from('visions').select('id, vision_name').eq('user_id', userId).eq('status', 'active').limit(3),
      ]);

      const visionIds = (visions.data ?? []).map((v) => v.id);
      const { data: challengeData } = visionIds.length > 0
        ? await supabase.from('vision_challenges').select('challenge_text').in('vision_id', visionIds).limit(5)
        : { data: [] };

      const age = profile.date_of_birth
        ? String(new Date().getFullYear() - new Date(profile.date_of_birth).getFullYear()) : '';
      const visionNames = (visions.data ?? []).map((v) => v.vision_name).join(', ');
      const challengeList = (challengeData ?? []).map((c) => c.challenge_text).join('; ');
      const wiseCtx = (wiseHistory.data ?? []).filter((m) => m.role === 'user').slice(0, 3).map((m) => m.content).join('; ');

      const raw = await callLLM('ritual_affirmations', {
        name: profile.full_name.split(' ')[0],
        age, profession: profile.profession,
        marital_status: profile.marital_status,
        children: String(profile.children),
        vision_names: visionNames,
        challenges: challengeList,
        concern: concern.trim(),
        ed_insight: '',
        wise_context: wiseCtx,
      });

      type R = { affirmations: string[]; gratitudes: string[] };
      const parsed = parseJSON<R>(raw);
      if (parsed && parsed.affirmations?.length) {
        setAffirmations(parsed.affirmations.slice(0, 3));
        setGratitudes(parsed.gratitudes?.slice(0, 3) ?? []);
        setSubmitted(true);
      } else {
        setError('Could not generate your ritual. Please try again.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      if (msg.includes('credit_exhausted')) {
        setError('Your AI credit balance is exhausted. Please request a top-up from your Profile page.');
      } else {
        setError('Could not generate your ritual. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setConcern('');
    setAffirmations([]);
    setGratitudes([]);
    setSubmitted(false);
    setError('');
  };

  return (
    <div className="min-h-screen pb-20 relative overflow-hidden" style={{ background: 'linear-gradient(160deg, #f0ede8 0%, #e8f0ed 50%, #edf0f5 100%)' }}>
      {/* Decorative background blobs */}
      <div className="absolute top-0 left-0 w-64 h-64 rounded-full opacity-20 pointer-events-none" style={{ background: 'radial-gradient(circle, #b2dfdb, transparent)', transform: 'translate(-30%, -30%)' }} />
      <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full opacity-15 pointer-events-none" style={{ background: 'radial-gradient(circle, #f8bbd0, transparent)', transform: 'translate(30%, 30%)' }} />

      {/* Header */}
      <div className="relative z-10 flex flex-col items-center pt-10 pb-6 px-6">
        <img src="/image copy.png" alt="Calm On" className="w-20 h-20 object-contain mb-3 drop-shadow-sm" />
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#2d4a3e', fontFamily: "'Georgia', serif" }}>My Ritual</h1>
        <div className="flex items-center gap-3 mt-2">
          <div className="h-px w-10 bg-teal-300/50" />
          <svg className="w-4 h-4 text-teal-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C9 2 6.5 4.5 6.5 7.5c0 1.5.6 2.8 1.5 3.8C6.2 12.5 5 14.5 5 17h14c0-2.5-1.2-4.5-3-5.7.9-1 1.5-2.3 1.5-3.8C17.5 4.5 15 2 12 2z" />
          </svg>
          <div className="h-px w-10 bg-teal-300/50" />
        </div>
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-4 space-y-6">
        {/* What's bothering you */}
        <div className="bg-white/70 backdrop-blur-sm rounded-3xl border border-white/80 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-teal-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C9 2 6.5 4.5 6.5 7.5c0 1.5.6 2.8 1.5 3.8C6.2 12.5 5 14.5 5 17h14c0-2.5-1.2-4.5-3-5.7.9-1 1.5-2.3 1.5-3.8C17.5 4.5 15 2 12 2z" />
            </svg>
            <h2 className="text-sm font-semibold text-gray-700">What is bothering you today</h2>
          </div>
          <textarea
            value={concern}
            onChange={(e) => setConcern(e.target.value)}
            placeholder="Share your thoughts..."
            rows={3}
            disabled={submitted}
            className="w-full bg-white/60 border border-gray-200 rounded-2xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-300 placeholder-gray-400 disabled:opacity-60"
          />
          <div className="flex justify-end mt-3 gap-2">
            {submitted && (
              <button onClick={reset} className="flex items-center gap-1.5 px-4 py-2 border border-teal-300 text-teal-600 rounded-xl text-sm font-semibold hover:bg-teal-50 transition-all">
                <RefreshCw className="w-3.5 h-3.5" /> New Ritual
              </button>
            )}
            {!submitted && (
              <button
                onClick={handleSubmit}
                disabled={!concern.trim() || loading}
                className="flex items-center gap-2 px-5 py-2 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 transition-all"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {loading ? 'Creating your ritual...' : 'Submit'}
              </button>
            )}
          </div>
          {error && (
            <p className="mt-3 text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>
          )}
        </div>

        {submitted && (
          <>
            {/* Ritual header */}
            <div className="text-center">
              <p className="text-lg font-semibold" style={{ color: '#2d4a3e' }}>
                <span className="inline-block w-2 h-2 rounded-full bg-rose-300 mr-2 mb-0.5" />
                Your personalised 5 minutes ritual
                <span className="inline-block w-2 h-2 rounded-full bg-rose-300 ml-2 mb-0.5" />
              </p>
            </div>

            {/* Meditation — coming soon */}
            <div className="bg-white/70 backdrop-blur-sm rounded-3xl border border-white/80 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-5 pt-4 pb-2">
                <svg className="w-4 h-4 text-teal-500" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C9 2 6.5 4.5 6.5 7.5c0 1.5.6 2.8 1.5 3.8C6.2 12.5 5 14.5 5 17h14c0-2.5-1.2-4.5-3-5.7.9-1 1.5-2.3 1.5-3.8C17.5 4.5 15 2 12 2z" />
                </svg>
                <h3 className="text-sm font-semibold text-gray-700">Your quick 3 minutes meditation</h3>
              </div>
              <div className="relative mx-4 mb-4 rounded-2xl overflow-hidden bg-gradient-to-br from-teal-100 to-slate-100" style={{ height: 160 }}>
                <img
                  src="https://images.pexels.com/photos/1051838/pexels-photo-1051838.jpeg?auto=compress&cs=tinysrgb&w=800"
                  alt="meditation"
                  className="w-full h-full object-cover opacity-70"
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-white/80 flex items-center justify-center shadow-md">
                    <Music className="w-5 h-5 text-teal-600" />
                  </div>
                  <span className="bg-white/80 text-xs font-semibold text-teal-700 px-3 py-1 rounded-full">Coming Soon</span>
                </div>
                <span className="absolute bottom-2 right-3 text-xs text-white/90 bg-black/30 rounded-full px-2 py-0.5">3 min</span>
              </div>
            </div>

            {/* Read them and repeat */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-4 h-4 text-teal-500" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C9 2 6.5 4.5 6.5 7.5c0 1.5.6 2.8 1.5 3.8C6.2 12.5 5 14.5 5 17h14c0-2.5-1.2-4.5-3-5.7.9-1 1.5-2.3 1.5-3.8C17.5 4.5 15 2 12 2z" />
                </svg>
                <h3 className="text-sm font-semibold text-gray-700">Read them and repeat in your mind</h3>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {affirmations.map((a, i) => {
                  const c = AFFIRMATION_COLORS[i % AFFIRMATION_COLORS.length];
                  return (
                    <div key={i} className={`${c.bg} border ${c.border} rounded-2xl p-4 flex flex-col items-center text-center gap-2 shadow-sm`}>
                      <span className={`text-xl ${c.icon}`}>{AFFIRMATION_ICONS[i]}</span>
                      <p className={`text-xs font-semibold leading-snug ${c.text}`}>{a}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Gratitude */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-4 h-4 text-rose-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
                <h3 className="text-sm font-semibold text-gray-700">Gratitude</h3>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {gratitudes.map((g, i) => {
                  const c = GRATITUDE_COLORS[i % GRATITUDE_COLORS.length];
                  return (
                    <div key={i} className={`${c.bg} border ${c.border} rounded-2xl p-4 flex flex-col items-center text-center gap-2 shadow-sm`}>
                      <span className={`text-xl ${c.icon}`}>{GRATITUDE_ICONS[i]}</span>
                      <p className={`text-xs font-semibold leading-snug ${c.text}`}>{g}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {!submitted && !loading && (
          <div className="text-center text-sm text-gray-400 pt-2">
            Share what's on your mind to receive your personalised ritual
          </div>
        )}
      </div>
    </div>
  );
}
