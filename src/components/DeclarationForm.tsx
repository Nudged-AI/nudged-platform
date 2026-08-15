import React, { useState } from 'react';
import { Target, Clock, Globe, Bell, Plus, X, ChevronRight } from 'lucide-react';
import { supabase } from '../supabase';

interface StoredSession {
  id: string;
  goal: string;
  end_minutes: number;
  allowed_sites: string[];
  tolerance_seconds: number;
  status: string;
  last_allowed_url: string;
  started_at: string;
}

interface Props {
  onSessionStart: (session: StoredSession) => void;
}

const DURATION_OPTIONS = [15, 20, 45, 60];
const TOLERANCE_OPTIONS = [10, 20, 30, 60];

export default function DeclarationForm({ onSessionStart }: Props) {
  const [goal, setGoal] = useState('');
  const [endMinutes, setEndMinutes] = useState(25);
  const [customMinutes, setCustomMinutes] = useState('');
  const [sites, setSites] = useState<string[]>(['']);
  const [toleranceSeconds, setToleranceSeconds] = useState(20);
  const [customTolerance, setCustomTolerance] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const addSite = () => setSites((s) => [...s, '']);
  const removeSite = (i: number) => setSites((s) => s.filter((_, idx) => idx !== i));
  const updateSite = (i: number, val: string) =>
    setSites((s) => s.map((v, idx) => (idx === i ? val : v)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cleanSites = sites.map((s) => s.trim()).filter(Boolean);
    if (!goal.trim()) { setError('Please enter a session goal.'); return; }
    if (cleanSites.length === 0) { setError('Add at least one allowed site.'); return; }

    const finalMinutes = customMinutes ? parseInt(customMinutes) : endMinutes;
    const finalTolerance = customTolerance ? parseInt(customTolerance) : toleranceSeconds;

    if (isNaN(finalMinutes) || finalMinutes < 1) { setError('Invalid session duration.'); return; }
    if (isNaN(finalTolerance) || finalTolerance < 5) { setError('Tolerance must be at least 5 seconds.'); return; }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const sessionData = {
        goal: goal.trim(),
        end_minutes: finalMinutes,
        allowed_sites: cleanSites,
        tolerance_seconds: finalTolerance,
        status: 'active' as const,
        last_allowed_url: cleanSites[0].startsWith('http') ? cleanSites[0] : 'https://' + cleanSites[0],
        started_at: new Date().toISOString(),
      };

      let sessionId = 'local-' + Date.now();

      if (user) {
        const { data, error: dbError } = await supabase
          .from('sessions')
          .insert({ ...sessionData, user_id: user.id })
          .select('id')
          .single();
        if (!dbError && data) sessionId = data.id;
      }

      const storedSession: StoredSession = { id: sessionId, ...sessionData };

      chrome.storage.local.set({ returnon_session: storedSession });
      chrome.runtime.sendMessage({ type: 'SESSION_START', session: storedSession });
      onSessionStart(storedSession);
    } catch (err) {
      setError('Failed to start session. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-80 bg-white" style={{ minHeight: 520 }}>
      {/* Header */}
      <div className="bg-gradient-to-br from-teal-700 to-teal-500 px-5 py-5">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center">
            <Target className="w-4 h-4 text-white" strokeWidth={2.2} />
          </div>
          <span className="text-white font-bold text-base tracking-wide">Return On</span>
        </div>
        <p className="text-teal-100 text-xs">Declare your focus session to begin.</p>
      </div>

      <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
        {/* Goal */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            <Target className="w-3.5 h-3.5 text-teal-600" />
            Session Goal
          </label>
          <input
            type="text"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="e.g. Research competitor pricing"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition"
          />
        </div>

        {/* Duration */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            <Clock className="w-3.5 h-3.5 text-teal-600" />
            Duration (minutes)
          </label>
          <div className="flex flex-wrap gap-2">
            {DURATION_OPTIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => { setEndMinutes(d); setCustomMinutes(''); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                  endMinutes === d && !customMinutes
                    ? 'bg-teal-600 text-white border-teal-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-teal-400'
                }`}
              >
                {d}
              </button>
            ))}
            <input
              type="number"
              min={1}
              value={customMinutes}
              onChange={(e) => { setCustomMinutes(e.target.value); }}
              placeholder="Custom"
              className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
            />
          </div>
        </div>

        {/* Allowed Sites */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            <Globe className="w-3.5 h-3.5 text-teal-600" />
            Allowed Sites
          </label>
          <div className="space-y-1.5">
            {sites.map((site, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={site}
                  onChange={(e) => updateSite(i, e.target.value)}
                  placeholder="e.g. google.com"
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition"
                />
                {sites.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSite(i)}
                    className="p-1.5 text-gray-400 hover:text-red-400 transition rounded-lg"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addSite}
            className="mt-2 flex items-center gap-1 text-xs text-teal-600 font-medium hover:text-teal-700 transition"
          >
            <Plus className="w-3.5 h-3.5" /> Add site
          </button>
        </div>

        {/* Tolerance */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            <Bell className="w-3.5 h-3.5 text-teal-600" />
            Reminder Tolerance (seconds)
          </label>
          <div className="flex flex-wrap gap-2">
            {TOLERANCE_OPTIONS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { setToleranceSeconds(t); setCustomTolerance(''); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                  toleranceSeconds === t && !customTolerance
                    ? 'bg-teal-600 text-white border-teal-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-teal-400'
                }`}
              >
                {t}s
              </button>
            ))}
            <input
              type="number"
              min={5}
              value={customTolerance}
              onChange={(e) => { setCustomTolerance(e.target.value); }}
              placeholder="Custom"
              className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
            />
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-gradient-to-r from-teal-700 to-teal-500 text-white font-semibold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 hover:opacity-90 active:opacity-80 transition disabled:opacity-60"
        >
          {submitting ? (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              Start Focus Session <ChevronRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
