import React, { useEffect, useState } from 'react';
import { Target, Clock, Globe, StopCircle, CheckCircle } from 'lucide-react';

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
  session: StoredSession;
  onEndSession: () => void;
}

function useCountdown(startedAt: string, endMinutes: number) {
  const endTime = new Date(startedAt).getTime() + endMinutes * 60 * 1000;
  const [remaining, setRemaining] = useState(() => Math.max(0, endTime - Date.now()));

  useEffect(() => {
    const id = setInterval(() => {
      const r = Math.max(0, endTime - Date.now());
      setRemaining(r);
      if (r === 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [endTime]);

  const totalMs = endMinutes * 60 * 1000;
  const progress = 1 - remaining / totalMs;
  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  return { remaining, progress, mins, secs };
}

export default function ActiveSession({ session, onEndSession }: Props) {
  const { remaining, progress, mins, secs } = useCountdown(session.started_at, session.end_minutes);
  const [confirming, setConfirming] = useState(false);

  const radius = 42;
  const circ = 2 * Math.PI * radius;
  const dashOffset = circ * (1 - progress);

  useEffect(() => {
    if (remaining === 0) onEndSession();
  }, [remaining]);

  return (
    <div className="w-80 bg-white" style={{ minHeight: 400 }}>
      {/* Header */}
      <div className="bg-gradient-to-br from-teal-700 to-teal-500 px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center">
            <Target className="w-4 h-4 text-white" strokeWidth={2.2} />
          </div>
          <span className="text-white font-bold text-base tracking-wide">Return On</span>
        </div>
        <span className="text-xs text-teal-100 bg-white/15 px-2 py-0.5 rounded-full font-medium">Active</span>
      </div>

      <div className="px-5 py-5 space-y-5">
        {/* Goal */}
        <div className="bg-teal-50 rounded-xl px-4 py-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Target className="w-3.5 h-3.5 text-teal-600" />
            <span className="text-xs font-semibold text-teal-600 uppercase tracking-wider">Goal</span>
          </div>
          <p className="text-sm font-medium text-gray-800">{session.goal}</p>
        </div>

        {/* Timer ring */}
        <div className="flex flex-col items-center gap-1">
          <svg width="104" height="104" viewBox="0 0 104 104" className="-rotate-90">
            <circle cx="52" cy="52" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="8" />
            <circle
              cx="52" cy="52" r={radius}
              fill="none"
              stroke={remaining < 60000 ? '#ef4444' : '#0f766e'}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={dashOffset}
              style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.3s' }}
            />
          </svg>
          <div className="absolute flex flex-col items-center" style={{ marginTop: -2 }}>
            <span className="text-xl font-bold text-gray-800 tabular-nums">
              {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </span>
            <span className="text-xs text-gray-400">remaining</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-gray-50 rounded-xl px-3 py-2.5">
            <div className="flex items-center gap-1 mb-0.5">
              <Clock className="w-3 h-3 text-gray-400" />
              <span className="text-xs text-gray-400">Duration</span>
            </div>
            <p className="text-sm font-semibold text-gray-700">{session.end_minutes} min</p>
          </div>
          <div className="bg-gray-50 rounded-xl px-3 py-2.5">
            <div className="flex items-center gap-1 mb-0.5">
              <Globe className="w-3 h-3 text-gray-400" />
              <span className="text-xs text-gray-400">Sites allowed</span>
            </div>
            <p className="text-sm font-semibold text-gray-700">{session.allowed_sites.length}</p>
          </div>
        </div>

        {/* Allowed sites */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Allowed Sites</p>
          <div className="space-y-1">
            {session.allowed_sites.map((site, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs text-gray-600">
                <CheckCircle className="w-3 h-3 text-teal-500 flex-shrink-0" />
                <span className="truncate">{site}</span>
              </div>
            ))}
          </div>
        </div>

        {/* End session */}
        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="w-full flex items-center justify-center gap-2 text-sm font-medium text-gray-400 hover:text-red-500 py-2 rounded-xl border border-dashed border-gray-200 hover:border-red-300 transition"
          >
            <StopCircle className="w-4 h-4" /> End Session Early
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={onEndSession}
              className="flex-1 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 py-2 rounded-xl transition"
            >
              Yes, End
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="flex-1 text-sm font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 py-2 rounded-xl transition"
            >
              Keep Going
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
