import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, Globe, StopCircle, CheckCircle, ThumbsUp, ThumbsDown, Plus } from 'lucide-react';
import { ipc, type SessionRow } from '../lib/ipc';

const EXTEND_OPTIONS = [5, 10, 15, 25];

interface Props {
  userId: string;
}

function useCountdown(startedAt: string, endMinutes: number) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    const calc = () => {
      const end = new Date(startedAt).getTime() + endMinutes * 60 * 1000;
      return Math.max(0, Math.floor((end - Date.now()) / 1000));
    };
    setRemaining(calc());
    const iv = setInterval(() => setRemaining(calc()), 1000);
    return () => clearInterval(iv);
  }, [startedAt, endMinutes]);
  return remaining;
}

export default function SessionActivePage({ userId }: Props) {
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [ending, setEnding] = useState(false);
  const [extending, setExtending] = useState(false);
  const [defaultExtendMinutes, setDefaultExtendMinutes] = useState(25);
  const [goalPrompt, setGoalPrompt] = useState<{ status: 'completed' | 'abandoned' } | null>(null);
  const [autoSkipCountdown, setAutoSkipCountdown] = useState(10);
  const autoSkipRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    ipc.sessionGetActive().then((s) => {
      if (!s) { navigate('/'); return; }
      setSession(s);
      setLoading(false);
    });
    ipc.settingsGet().then((s) => {
      const rec = s as Record<string, string>;
      const d = parseInt(rec.defaultSessionDuration ?? '25');
      if (!isNaN(d) && d > 0) setDefaultExtendMinutes(d);
    });
    return () => { if (autoSkipRef.current) clearInterval(autoSkipRef.current); };
  }, [userId]);

  useEffect(() => {
    const unsub = ipc.onSessionChanged((s) => {
      if (!s) navigate('/');
      else setSession(s);
    });
    return unsub;
  }, []);

  const remaining = useCountdown(session?.started_at ?? '', session?.end_minutes ?? 0);

  useEffect(() => {
    const unsub = ipc.onSessionTimeUp(() => {
      if (!ending && !goalPrompt) promptGoalAchieved('completed');
    });
    return unsub;
  }, []);

  const promptGoalAchieved = (status: 'completed' | 'abandoned') => {
    if (!session || ending) return;
    setGoalPrompt({ status });
    setAutoSkipCountdown(10);
    if (autoSkipRef.current) clearInterval(autoSkipRef.current);
    autoSkipRef.current = setInterval(() => {
      setAutoSkipCountdown((c) => {
        if (c <= 1) {
          clearInterval(autoSkipRef.current!);
          finaliseSession(status, null);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const handleExtend = async (minutes: number) => {
    if (extending || !session) return;
    setExtending(true);
    await ipc.sessionExtend(minutes);
    setSession((s) => s ? { ...s, end_minutes: s.end_minutes + minutes } : s);
    setExtending(false);
  };

  const finaliseSession = async (status: 'completed' | 'abandoned', achieved: boolean | null) => {
    if (autoSkipRef.current) clearInterval(autoSkipRef.current);
    if (!session || ending) return;
    setEnding(true);
    await ipc.sessionEnd(status, achieved);
    navigate('/');
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-64">
        <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!session) return null;

  const totalSeconds = session.end_minutes * 60;
  const progress = totalSeconds > 0 ? (totalSeconds - remaining) / totalSeconds : 0;
  const circumference = 2 * Math.PI * 54;
  const strokeDashoffset = circumference * (1 - progress);
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const isWarning = remaining < 60;

  return (
    <div className="p-6 md:p-8 max-w-xl mx-auto space-y-5">
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-gray-900">Active Session</h1>
        <p className="text-sm text-gray-500 mt-0.5">Stay focused — you're doing great.</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm text-center">
        <div className="relative w-32 h-32 mx-auto mb-5">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="54" stroke="#f3f4f6" strokeWidth="8" fill="none" />
            <circle
              cx="60" cy="60" r="54"
              stroke={isWarning ? '#ef4444' : '#0f766e'}
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-2xl font-bold tabular-nums ${isWarning ? 'text-red-500' : 'text-gray-900'}`}>
              {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </span>
            <span className="text-xs text-gray-400">remaining</span>
          </div>
        </div>
        <h2 className="font-semibold text-gray-800 text-base mb-1">{session.goal}</h2>
        <p className="text-xs text-gray-400">{session.end_minutes} minute session</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Globe className="w-4 h-4 text-teal-600" />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Allowed Apps</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {session.allowed_apps.map((app) => (
            <span key={app.appName} className="flex items-center gap-1.5 text-xs bg-teal-50 text-teal-700 px-3 py-1.5 rounded-lg font-medium">
              <CheckCircle className="w-3 h-3" />
              {app.appName}
            </span>
          ))}
        </div>
      </div>

      {/* Extend session */}
      {!goalPrompt && !confirming && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Plus className="w-4 h-4 text-teal-600" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Extend Session</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleExtend(defaultExtendMinutes)}
              disabled={extending}
              className="flex-1 py-2 text-xs font-bold rounded-xl border border-teal-600 text-white bg-teal-600 hover:bg-teal-700 transition disabled:opacity-50"
            >
              +{defaultExtendMinutes}m
            </button>
            {EXTEND_OPTIONS.filter((m) => m !== defaultExtendMinutes).map((m) => (
              <button
                key={m}
                onClick={() => handleExtend(m)}
                disabled={extending}
                className="flex-1 py-2 text-xs font-semibold rounded-xl border border-teal-200 text-teal-700 bg-teal-50 hover:bg-teal-100 transition disabled:opacity-50"
              >
                +{m}m
              </button>
            ))}
          </div>
        </div>
      )}

      {goalPrompt ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm text-center space-y-4">
          <div className="w-12 h-12 bg-teal-50 rounded-full flex items-center justify-center mx-auto">
            <Target className="w-6 h-6 text-teal-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-base">Session complete!</p>
            <p className="text-sm text-gray-500 mt-1">Did you achieve your goal?</p>
            <p className="text-xs text-gray-400 mt-0.5 font-medium">{session.goal}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => finaliseSession(goalPrompt.status, true)}
              className="flex-1 flex items-center justify-center gap-2 bg-teal-600 text-white font-semibold py-3 rounded-xl text-sm hover:bg-teal-700 transition"
            >
              <ThumbsUp className="w-4 h-4" /> Yes!
            </button>
            <button
              onClick={() => finaliseSession(goalPrompt.status, false)}
              className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-700 font-semibold py-3 rounded-xl text-sm hover:bg-gray-200 transition"
            >
              <ThumbsDown className="w-4 h-4" /> Not quite
            </button>
          </div>
          <p className="text-xs text-gray-400">Auto-skipping in {autoSkipCountdown}s…</p>
        </div>
      ) : !confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="w-full flex items-center justify-center gap-2 border-2 border-red-200 text-red-600 font-semibold py-3 rounded-xl text-sm hover:bg-red-50 transition-all duration-150"
        >
          <StopCircle className="w-4 h-4" />
          End Session Early
        </button>
      ) : (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 space-y-3">
          <p className="text-sm font-medium text-red-700 text-center">End this session early?</p>
          <div className="flex gap-3">
            <button
              onClick={() => promptGoalAchieved('abandoned')}
              disabled={ending}
              className="flex-1 bg-red-500 text-white font-semibold py-2.5 rounded-xl text-sm hover:bg-red-600 transition disabled:opacity-60"
            >
              {ending ? '...' : 'Yes, end now'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="flex-1 bg-white border border-red-200 text-red-600 font-semibold py-2.5 rounded-xl text-sm hover:bg-red-50 transition"
            >
              Keep going
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
