import { useState } from 'react';
import { Users, Brain, Home, Loader2 } from 'lucide-react';
import { supabase } from '../supabase';
import type { User } from '@supabase/supabase-js';

export type AppMode = 'buddy' | 'parker';

interface Props {
  user: User;
  onSelect: (mode: AppMode, setAsDefault: boolean) => void;
  onLogout?: () => void;
}

const ADMIN_EMAIL = 'deepagster@gmail.com';

export default function AppSelection({ user, onSelect }: Props) {
  const [selected, setSelected] = useState<AppMode | null>(null);
  const [setAsDefault, setSetAsDefault] = useState(true);
  const [saving, setSaving] = useState(false);
  const isAdmin = user.email === ADMIN_EMAIL;

  const handleSelect = async () => {
    if (!selected) return;
    setSaving(true);
    if (setAsDefault) {
      await supabase.from('user_profiles').update({ preferred_app: selected }).eq('id', user.id);
    }
    setSaving(false);
    onSelect(selected, setAsDefault);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 via-white to-amber-50 px-4 py-8">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <img src="/icons/ChatGPT_Image_Jul_5,_2026,_11_50_00_AM.png" alt="Nudged" className="w-16 h-16 mx-auto mb-3 rounded-xl object-contain shadow-sm" />
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Welcome to Nudged</h1>
          <p className="text-sm text-gray-500 mt-1.5">Choose your experience to get started</p>
        </div>

        <div className={`grid grid-cols-1 ${isAdmin ? 'sm:grid-cols-2' : ''} gap-4 max-w-${isAdmin ? '2xl' : 'md'} mx-auto`}>
          {/* Buddy */}
          <button
            onClick={() => setSelected('buddy')}
            className={`relative text-left rounded-3xl border-2 p-6 transition-all duration-200 ${
              selected === 'buddy'
                ? 'border-teal-500 bg-teal-50 shadow-lg scale-[1.02]'
                : 'border-gray-100 bg-white hover:border-teal-200 hover:shadow-md'
            }`
            }>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Buddy by Nudged</h2>
            <p className="text-xs text-gray-500 leading-relaxed">Coaching marketplace and coachee sessions. Explore coaches, join sessions, and complete your activities.</p>
            {selected === 'buddy' && (
              <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-teal-500 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              </div>
            )}
          </button>

          {/* Parker — admin only */}
          {isAdmin && (
          <button
            onClick={() => setSelected('parker')}
            className={`relative text-left rounded-3xl border-2 p-6 transition-all duration-200 ${
              selected === 'parker'
                ? 'border-amber-500 bg-amber-50 shadow-lg scale-[1.02]'
                : 'border-gray-100 bg-white hover:border-amber-200 hover:shadow-md'
            }`
            }>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center mb-4">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Parker by Nudged</h2>
            <p className="text-xs text-gray-500 leading-relaxed">Capture and park your thoughts. Threads, parking, and bulk upload for personal reflection.</p>
            {selected === 'parker' && (
              <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              </div>
            )}
          </button>
          )}
        </div>

        {selected && (
          <div className="mt-6 flex items-center justify-center gap-3 animate-in fade-in duration-200">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={setAsDefault}
                onChange={e => setSetAsDefault(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-400"
              />
              Set as my default
            </label>
          </div>
        )}

        <div className="mt-6 flex items-center justify-center gap-3">
          {selected && (
            <button
              onClick={handleSelect}
              disabled={saving}
              className="px-6 py-3 bg-gradient-to-r from-teal-600 to-emerald-600 text-white text-sm font-bold rounded-2xl shadow-md hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Continue to {selected === 'buddy' ? 'Buddy' : 'Parker'}
            </button>
          )}
          <button
            onClick={() => supabase.auth.signOut()}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition"
          >
            <Home className="w-4 h-4" /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
