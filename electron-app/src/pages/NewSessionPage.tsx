import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Target, Clock, Layers, Bell, ChevronRight, Info, AlertCircle } from 'lucide-react';
import { ipc, type AllowedApp } from '../lib/ipc';
import AppPicker from '../components/AppPicker';

const DURATION_OPTIONS = [15, 20, 25, 45, 60];
const TOLERANCE_OPTIONS = [10, 20, 30, 60];

interface Props {
  userId: string;
}

export default function NewSessionPage({ userId }: Props) {
  const navigate = useNavigate();
  const [goal, setGoal] = useState('');
  const [endMinutes, setEndMinutes] = useState(25);
  const [customMinutes, setCustomMinutes] = useState('');
  const [allowedApps, setAllowedApps] = useState<AllowedApp[]>([]);
  const [toleranceSeconds, setToleranceSeconds] = useState(20);
  const [customTolerance, setCustomTolerance] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [hasActiveSession, setHasActiveSession] = useState(false);

  useEffect(() => {
    ipc.sessionGetActive().then((s) => { if (s) setHasActiveSession(true); });
    Promise.all([
      ipc.settingsGet(),
      ipc.dbSessionsList({ limit: 1 }),
    ]).then(([s, sessions]) => {
      const rec = s as Record<string, string>;
      if (rec.defaultSessionDuration) {
        const d = parseInt(rec.defaultSessionDuration);
        if (!isNaN(d) && d > 0) {
          if (DURATION_OPTIONS.includes(d)) {
            setEndMinutes(d);
            setCustomMinutes('');
          } else {
            setCustomMinutes(String(d));
          }
        }
      }
      if (rec.defaultTolerance) {
        const t = parseInt(rec.defaultTolerance);
        if (!isNaN(t) && t >= 5) {
          if (TOLERANCE_OPTIONS.includes(t)) {
            setToleranceSeconds(t);
            setCustomTolerance('');
          } else {
            setCustomTolerance(String(t));
          }
        }
      }
      const lastSession = (sessions as Array<{ allowed_apps?: AllowedApp[] }>)[0];
      if (lastSession?.allowed_apps && lastSession.allowed_apps.length > 0) {
        setAllowedApps(lastSession.allowed_apps);
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (hasActiveSession) { setError('A session is already running. End it before starting a new one.'); return; }
    if (!goal.trim()) { setError('Please enter a session goal.'); return; }
    if (allowedApps.length === 0) { setError('Add at least one allowed app.'); return; }

    const finalMinutes = customMinutes ? parseInt(customMinutes) : endMinutes;
    const finalTolerance = customTolerance ? parseInt(customTolerance) : toleranceSeconds;
    if (isNaN(finalMinutes) || finalMinutes < 1) { setError('Invalid session duration.'); return; }
    if (isNaN(finalTolerance) || finalTolerance < 5) { setError('Tolerance must be at least 5 seconds.'); return; }

    setSubmitting(true);
    try {
      await ipc.sessionStart({
        goal: goal.trim(),
        end_minutes: finalMinutes,
        allowed_apps: allowedApps,
        tolerance_seconds: finalTolerance,
      });
      navigate('/session/active');
    } catch {
      setError('Failed to start session. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-5 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Declare Focus Session</h1>
        <p className="text-sm text-gray-500 mt-1">Set your intention and let Return On keep you on track.</p>
      </div>

      {hasActiveSession && (
        <div className="mb-4 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">Session already running</p>
            <p className="text-xs text-amber-600">End your current session before starting a new one.</p>
          </div>
          <Link to="/session/active" className="text-xs font-semibold text-amber-700 underline whitespace-nowrap">Go to session</Link>
        </div>
      )}

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
          <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            <Clock className="w-3.5 h-3.5 text-teal-600" />
            Duration (minutes)
          </label>
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

        {/* Allowed Apps */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            <Layers className="w-3.5 h-3.5 text-teal-600" />
            Allowed Apps
          </label>

          <AppPicker selected={allowedApps} onChange={setAllowedApps} />

          <div className="mt-3 flex items-start gap-2 p-3 bg-blue-50 rounded-xl">
            <Info className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-600 leading-relaxed">
              For <strong>websites</strong> (Canva, Notion, Jira…) add them by domain — Return On tracks the active tab in <strong>Google Chrome</strong>. Just being in Chrome is not enough; the tab must be on a permitted site. Type any domain like <strong>canva.com</strong> to add it. The Return button will bring you back to the right tab automatically.
            </p>
          </div>
        </div>

        {/* Tolerance */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            <Bell className="w-3.5 h-3.5 text-teal-600" />
            Reminder Tolerance (seconds)
          </label>
          <p className="text-xs text-gray-400 mb-3">How many seconds before a reminder appears when you switch to a non-allowed app.</p>
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
          <p className="text-xs text-red-500 bg-red-50 px-4 py-3 rounded-xl">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-gradient-to-r from-teal-700 to-teal-500 text-white font-semibold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 hover:opacity-90 active:opacity-80 transition disabled:opacity-60 shadow-md shadow-teal-200"
        >
          {submitting ? (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>Start Focus Session <ChevronRight className="w-4 h-4" /></>
          )}
        </button>
      </form>
    </div>
  );
}
