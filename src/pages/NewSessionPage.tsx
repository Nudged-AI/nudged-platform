import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, Clock, Globe, Bell, Plus, X, ChevronRight, Info } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../supabase';

const DURATION_OPTIONS = [15, 20, 45, 60];
const TOLERANCE_OPTIONS = [10, 20, 30, 60];

const DESKTOP_APPS = [
  { label: 'MS Teams', value: 'teams.microsoft.com' },
  { label: 'Slack', value: 'app.slack.com' },
  { label: 'Zoom', value: 'zoom.us' },
  { label: 'Google Meet', value: 'meet.google.com' },
];

interface Props {
  user: User;
}

export default function NewSessionPage({ user }: Props) {
  const navigate = useNavigate();
  const [goal, setGoal] = useState('');
  const [endMinutes, setEndMinutes] = useState(25);
  const [customMinutes, setCustomMinutes] = useState('');
  const [sites, setSites] = useState<string[]>(['']);
  const [toleranceSeconds, setToleranceSeconds] = useState(20);
  const [customTolerance, setCustomTolerance] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [loadingDefaults, setLoadingDefaults] = useState(true);
  const [defaultDuration, setDefaultDuration] = useState(25);
  const [defaultTolerance, setDefaultTolerance] = useState(20);

  // Load settings defaults and last session's allowed sites on mount
  useEffect(() => {
    loadDefaults();
  }, [user.id]);

  const loadDefaults = async () => {
    setLoadingDefaults(true);

    // Load settings
    const { data: settingsData } = await supabase
      .from('settings')
      .select('default_session_duration, default_reminder_tolerance')
      .eq('user_id', user.id)
      .maybeSingle();

    const dur = settingsData?.default_session_duration ?? 25;
    const tol = settingsData?.default_reminder_tolerance ?? 20;
    setDefaultDuration(dur);
    setDefaultTolerance(tol);
    setEndMinutes(dur);
    setToleranceSeconds(tol);
    setCustomMinutes('');
    setCustomTolerance('');

    // Load last session's allowed sites
    const { data: lastSession } = await supabase
      .from('sessions')
      .select('allowed_sites')
      .eq('user_id', user.id)
      .neq('status', 'active')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastSession?.allowed_sites?.length) {
      setSites(lastSession.allowed_sites);
    }

    setLoadingDefaults(false);
  };

  const addSite = () => setSites((s) => [...s, '']);
  const removeSite = (i: number) => setSites((s) => s.filter((_, idx) => idx !== i));
  const updateSite = (i: number, val: string) => setSites((s) => s.map((v, idx) => (idx === i ? val : v)));

  const addDesktopApp = (val: string) => {
    if (!sites.includes(val)) setSites((s) => [...s.filter(Boolean), val]);
  };

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
      const sessionData = {
        user_id: user.id,
        user_email: user.email,
        goal: goal.trim(),
        end_minutes: finalMinutes,
        allowed_sites: cleanSites,
        tolerance_seconds: finalTolerance,
        status: 'active' as const,
        last_allowed_url: cleanSites[0].startsWith('http') ? cleanSites[0] : 'https://' + cleanSites[0],
        started_at: new Date().toISOString(),
      };

      const { data, error: dbError } = await supabase
        .from('sessions')
        .insert(sessionData)
        .select('id')
        .single();

      if (dbError) throw dbError;

      const storedSession = { id: data.id, ...sessionData };

      // Push to chrome extension if available
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.set({ returnon_session: storedSession });
        chrome.runtime?.sendMessage?.({ type: 'SESSION_START', session: storedSession });
      }

      navigate('/session/active');
    } catch (err) {
      setError('Failed to start session. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const effectiveDuration = customMinutes ? parseInt(customMinutes) || endMinutes : endMinutes;
  const effectiveTolerance = customTolerance ? parseInt(customTolerance) || toleranceSeconds : toleranceSeconds;

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Declare Focus Session</h1>
        <p className="text-sm text-gray-500 mt-1">Set your intention and let Return On keep you on track.</p>
      </div>

      {loadingDefaults ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Goal */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              <Target className="w-3.5 h-3.5 text-teal-600" />
              Session Goal
            </label>
            <input
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. Research competitor pricing"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition"
            />
          </div>

          {/* Duration */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              <Clock className="w-3.5 h-3.5 text-teal-600" />
              Duration (minutes)
            </label>
            <div className="flex items-center gap-1.5 mb-3">
              <Info className="w-3 h-3 text-teal-500 flex-shrink-0" />
              <p className="text-xs text-teal-600">
                Default from settings: <strong>{defaultDuration} min</strong>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {DURATION_OPTIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => { setEndMinutes(d); setCustomMinutes(''); }}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition ${
                    endMinutes === d && !customMinutes
                      ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-teal-400 hover:text-teal-700'
                  }`}
                >
                  {d} min
                </button>
              ))}
              {/* Show default button if not in standard list */}
              {!DURATION_OPTIONS.includes(defaultDuration) && (
                <button
                  type="button"
                  onClick={() => { setEndMinutes(defaultDuration); setCustomMinutes(''); }}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition ${
                    endMinutes === defaultDuration && !customMinutes
                      ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                      : 'bg-teal-50 text-teal-700 border-teal-200 hover:border-teal-400'
                  }`}
                >
                  {defaultDuration} min
                </button>
              )}
              <input
                type="number"
                min={1}
                value={customMinutes}
                onChange={(e) => setCustomMinutes(e.target.value)}
                placeholder="Custom"
                className="w-24 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
              />
            </div>
          </div>

          {/* Allowed Sites */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              <Globe className="w-3.5 h-3.5 text-teal-600" />
              Allowed Sites & Apps
            </label>
            <div className="flex items-center gap-1.5 mb-3">
              <Info className="w-3 h-3 text-teal-500 flex-shrink-0" />
              <p className="text-xs text-teal-600">Pre-filled from your last session.</p>
            </div>

            {/* Quick-add desktop apps */}
            <div className="flex flex-wrap gap-2 mb-3">
              {DESKTOP_APPS.map(({ label, value }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => addDesktopApp(value)}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition ${
                    sites.includes(value)
                      ? 'bg-teal-50 text-teal-700 border-teal-200'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-teal-300 hover:text-teal-700'
                  }`}
                >
                  + {label}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {sites.map((site, i) => (
                <div key={i} className="flex items-center gap-2">
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
                      <X className="w-4 h-4" />
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
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              <Bell className="w-3.5 h-3.5 text-teal-600" />
              Reminder Tolerance (seconds)
            </label>
            <div className="flex items-center gap-1.5 mb-3">
              <Info className="w-3 h-3 text-teal-500 flex-shrink-0" />
              <p className="text-xs text-teal-600">
                Default from settings: <strong>{defaultTolerance}s</strong>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {TOLERANCE_OPTIONS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setToleranceSeconds(t); setCustomTolerance(''); }}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition ${
                    toleranceSeconds === t && !customTolerance
                      ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-teal-400 hover:text-teal-700'
                  }`}
                >
                  {t}s
                </button>
              ))}
              {!TOLERANCE_OPTIONS.includes(defaultTolerance) && (
                <button
                  type="button"
                  onClick={() => { setToleranceSeconds(defaultTolerance); setCustomTolerance(''); }}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition ${
                    toleranceSeconds === defaultTolerance && !customTolerance
                      ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                      : 'bg-teal-50 text-teal-700 border-teal-200 hover:border-teal-400'
                  }`}
                >
                  {defaultTolerance}s
                </button>
              )}
              <input
                type="number"
                min={5}
                value={customTolerance}
                onChange={(e) => setCustomTolerance(e.target.value)}
                placeholder="Custom"
                className="w-24 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 px-4 py-2.5 rounded-xl">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-gradient-to-r from-teal-700 to-teal-500 text-white font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-2 hover:opacity-90 active:opacity-80 transition shadow-sm shadow-teal-200 disabled:opacity-60"
          >
            {submitting ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>Start Session — {effectiveDuration} min <ChevronRight className="w-4 h-4" /></>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
