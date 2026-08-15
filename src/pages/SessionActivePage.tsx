import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, Globe, StopCircle, CheckCircle, PlusCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../supabase';

interface ActiveSessionData {
  id: string;
  goal: string;
  end_minutes: number;
  allowed_sites: string[];
  tolerance_seconds: number;
  status: string;
  started_at: string;
  extensions?: Array<{ added_minutes: number; extended_at: string }>;
}

interface Props {
  user: User;
}

function useCountdown(startedAt: string, endMinutes: number, totalExtended: number) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const calc = () => {
      const end = new Date(startedAt).getTime() + (endMinutes + totalExtended) * 60 * 1000;
      return Math.max(0, Math.floor((end - Date.now()) / 1000));
    };
    setRemaining(calc());
    const iv = setInterval(() => setRemaining(calc()), 1000);
    return () => clearInterval(iv);
  }, [startedAt, endMinutes, totalExtended]);

  return remaining;
}

export default function SessionActivePage({ user }: Props) {
  const navigate = useNavigate();
  const [session, setSession] = useState<ActiveSessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [ending, setEnding] = useState(false);
  const [showExtend, setShowExtend] = useState(false);
  const [extendMinutes, setExtendMinutes] = useState(25);
  const [customExtend, setCustomExtend] = useState('');
  const [extending, setExtending] = useState(false);
  const [extendSuccess, setExtendSuccess] = useState(false);
  const [defaultDuration, setDefaultDuration] = useState(25);

  useEffect(() => {
    loadSession();
    loadDefaultDuration();
  }, [user.id]);

  const loadDefaultDuration = async () => {
    const { data } = await supabase
      .from('settings')
      .select('default_session_duration')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data?.default_session_duration) {
      setDefaultDuration(data.default_session_duration);
      setExtendMinutes(data.default_session_duration);
    }
  };

  const loadSession = async () => {
    const { data } = await supabase
      .from('sessions')
      .select('id,goal,end_minutes,allowed_sites,tolerance_seconds,status,started_at,extensions')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();
    if (!data) {
      navigate('/');
      return;
    }
    setSession(data);
    setLoading(false);
  };

  const totalExtended = (session?.extensions ?? []).reduce((s, e) => s + e.added_minutes, 0);
  const remaining = useCountdown(session?.started_at ?? '', session?.end_minutes ?? 0, totalExtended);

  useEffect(() => {
    if (session && remaining === 0) {
      endSession('completed');
    }
  }, [remaining, session]);

  const endSession = async (status: 'completed' | 'abandoned') => {
    if (!session || ending) return;
    setEnding(true);
    await supabase
      .from('sessions')
      .update({ status, ended_at: new Date().toISOString() })
      .eq('id', session.id);

    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.remove('returnon_session');
      chrome.runtime?.sendMessage?.({ type: 'SESSION_END' });
    }
    navigate('/');
  };

  const handleExtend = async () => {
    if (!session) return;
    const mins = customExtend ? parseInt(customExtend) : extendMinutes;
    if (isNaN(mins) || mins < 1) return;

    setExtending(true);
    const extension = { added_minutes: mins, extended_at: new Date().toISOString() };
    const updatedExtensions = [...(session.extensions ?? []), extension];
    const newEndMinutes = session.end_minutes + mins;

    await supabase
      .from('sessions')
      .update({ extensions: updatedExtensions, end_minutes: newEndMinutes })
      .eq('id', session.id);

    // Notify extension
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      const updatedSession = { ...session, end_minutes: newEndMinutes, extensions: updatedExtensions };
      chrome.runtime.sendMessage({ type: 'SESSION_EXTEND', session: updatedSession });
      chrome.storage.local.set({ returnon_session: updatedSession });
    }

    setSession((s) => s ? { ...s, end_minutes: newEndMinutes, extensions: updatedExtensions } : s);
    setCustomExtend('');
    setExtending(false);
    setExtendSuccess(true);
    setTimeout(() => { setExtendSuccess(false); setShowExtend(false); }, 1500);
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-64">
        <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) return null;

  const totalSeconds = (session.end_minutes) * 60;
  const elapsed = totalSeconds - remaining;
  const progress = totalSeconds > 0 ? elapsed / totalSeconds : 0;
  const circumference = 2 * Math.PI * 54;
  const strokeDashoffset = circumference * (1 - progress);
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const isWarning = remaining < 60;
  const EXTEND_PRESETS = [5, 10, 15, defaultDuration].filter((v, i, a) => a.indexOf(v) === i);

  return (
    <div className="p-6 md:p-8 max-w-xl mx-auto space-y-5">
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-gray-900">Active Session</h1>
        <p className="text-sm text-gray-500 mt-0.5">Stay focused — you're doing great.</p>
      </div>

      {/* Timer card */}
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
        <p className="text-xs text-gray-400">
          {session.end_minutes} min session
          {totalExtended > 0 && <span className="ml-1 text-teal-600 font-medium">(+{totalExtended} min extended)</span>}
        </p>
      </div>

      {/* Extend session */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <button
          onClick={() => setShowExtend((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition text-sm font-semibold text-gray-700"
        >
          <div className="flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-teal-600" />
            Extend Session
          </div>
          {showExtend ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {showExtend && (
          <div className="px-5 pb-4 border-t border-gray-50">
            <p className="text-xs text-gray-400 mt-3 mb-3">
              Add minutes to the current session. Permissible sites remain the same.
              Default extension: <span className="font-semibold text-teal-600">{defaultDuration} min</span> (from settings).
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              {EXTEND_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => { setExtendMinutes(p); setCustomExtend(''); }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                    extendMinutes === p && !customExtend
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-teal-400'
                  }`}
                >
                  +{p} min
                </button>
              ))}
              <input
                type="number"
                min={1}
                value={customExtend}
                onChange={(e) => setCustomExtend(e.target.value)}
                placeholder="Custom"
                className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
              />
            </div>
            <button
              onClick={handleExtend}
              disabled={extending}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-teal-700 to-teal-500 text-white font-semibold py-2.5 rounded-xl text-sm hover:opacity-90 transition disabled:opacity-60"
            >
              {extendSuccess ? (
                <><CheckCircle className="w-4 h-4" /> Extended!</>
              ) : extending ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <><PlusCircle className="w-4 h-4" /> Add {customExtend || extendMinutes} minutes</>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Allowed sites */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Globe className="w-4 h-4 text-teal-600" />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Allowed Sites</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {session.allowed_sites.map((site) => (
            <span key={site} className="flex items-center gap-1.5 text-xs bg-teal-50 text-teal-700 px-3 py-1.5 rounded-lg font-medium">
              <CheckCircle className="w-3 h-3" />
              {site}
            </span>
          ))}
        </div>
      </div>

      {/* End button */}
      {!confirming ? (
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
              onClick={() => endSession('abandoned')}
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
