import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Target, CheckCircle, Brain, ArrowRight, TrendingUp, Medal, Zap, Star, Flame } from 'lucide-react';
import { ipc, type SessionRow } from '../lib/ipc';

interface Props {
  userId: string;
}

interface DayMetric {
  label: string;
  date: string;
  completed: number;
  returnsPerMin: number;
  returnRate: number;
}

type RangeKey = '7d' | '14d' | '1m' | '3m' | '6m';

const RANGE_OPTIONS: { key: RangeKey; label: string; days: number }[] = [
  { key: '7d',  label: '7 days',   days: 7  },
  { key: '14d', label: '2 weeks',  days: 14 },
  { key: '1m',  label: '1 month',  days: 30 },
  { key: '3m',  label: '3 months', days: 90 },
  { key: '6m',  label: '6 months', days: 180 },
];

const HERO_IMAGES = [
  'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=1600',
  'https://images.pexels.com/photos/1438072/pexels-photo-1438072.jpeg?auto=compress&cs=tinysrgb&w=1600',
  'https://images.pexels.com/photos/590016/pexels-photo-590016.jpeg?auto=compress&cs=tinysrgb&w=1600',
  'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=1600',
];

function last7Days(): { label: string; date: string }[] {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({
      label: d.toLocaleDateString('en-US', { weekday: 'short' }),
      date: d.toISOString().slice(0, 10),
    });
  }
  return days;
}

function startOfRange(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - (days - 1));
  return d.toISOString().slice(0, 10);
}

function BarChart({ values, color, fmt }: { values: number[]; color: string; fmt: (v: number) => string }) {
  const max = Math.max(...values, 0.001);
  const H = 52;
  return (
    <div className="flex items-end gap-1.5 h-14">
      {values.map((v, i) => {
        const h = Math.max(3, Math.round((v / max) * H));
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative">
            <div className={`w-full rounded-md ${color} transition-all duration-300`} style={{ height: h }} />
            {v > 0 && (
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[9px] px-1.5 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 shadow-lg">
                {fmt(v)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardPage({ userId }: Props) {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [pendingThoughts, setPendingThoughts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeSession, setActiveSession] = useState<SessionRow | null>(null);
  const [range, setRange] = useState<RangeKey>('1m');
  const heroImg = HERO_IMAGES[new Date().getDay() % HERO_IMAGES.length];

  useEffect(() => { loadData(); }, [userId]);

  useEffect(() => {
    const unsub = ipc.onSessionChanged((session) => {
      if (session) setActiveSession(session);
      else { setActiveSession(null); loadData(); }
    });
    return unsub;
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [rows, thoughts] = await Promise.all([
      ipc.dbSessionsList({ limit: 500 }),
      ipc.dbThoughtsList(),
    ]);
    setSessions(rows);
    setPendingThoughts(thoughts.filter((t) => t.status === 'pending').length);
    setActiveSession(rows.find((s) => s.status === 'active') ?? null);
    setLoading(false);
  };

  const chartDays = last7Days();
  const chartMetrics: DayMetric[] = chartDays.map(({ label, date }) => {
    const daySessions = sessions.filter(
      (s) => s.status === 'completed' && s.started_at.slice(0, 10) === date
    );
    const totalMins = daySessions.reduce((sum, s) => sum + s.end_minutes, 0);
    const totalRaised = daySessions.reduce((sum, s) => sum + (s.returns_raised ?? 0), 0);
    const totalMade = daySessions.reduce((sum, s) => sum + (s.returns_made ?? 0), 0);
    return {
      label,
      date,
      completed: daySessions.length,
      returnsPerMin: totalMins > 0 ? totalRaised / totalMins : 0,
      returnRate: totalRaised > 0 ? totalMade / totalRaised : 0,
    };
  });

  const rangeDays = RANGE_OPTIONS.find((r) => r.key === range)!.days;
  const rangeStart = startOfRange(rangeDays);
  const filteredSessions = sessions.filter(
    (s) => s.status === 'completed' && s.started_at.slice(0, 10) >= rangeStart
  );

  const rockFocusCount = filteredSessions.filter((s) => (s.returns_raised ?? 0) === 0).length;
  const quickComebackCount = filteredSessions.filter(
    (s) => (s.returns_raised ?? 0) > 0 && (s.returns_made ?? 0) / (s.returns_raised ?? 1) >= 0.9
  ).length;
  const superSessionCount = filteredSessions.filter((s) => s.goal_achieved === 1).length;

  const totalSessionsFiltered = filteredSessions.length;
  const totalRaisedFiltered = filteredSessions.reduce((sum, s) => sum + (s.returns_raised ?? 0), 0);
  const totalMadeFiltered = filteredSessions.reduce((sum, s) => sum + (s.returns_made ?? 0), 0);
  const totalMinsFiltered = filteredSessions.reduce((sum, s) => sum + s.end_minutes, 0);
  const returnsPerMinFiltered = totalMinsFiltered > 0 ? (totalRaisedFiltered / totalMinsFiltered).toFixed(2) : '—';
  const returnRateFiltered = totalRaisedFiltered > 0 ? `${Math.round((totalMadeFiltered / totalRaisedFiltered) * 100)}%` : '—';
  const totalFocusedSecs = filteredSessions.reduce((sum, s) => sum + (s.focused_seconds ?? 0), 0);
  const totalSessionSecs = totalMinsFiltered * 60;
  const focusPct = totalSessionSecs > 0 && filteredSessions.some((s) => s.focused_seconds != null)
    ? `${Math.min(100, Math.round((totalFocusedSecs / totalSessionSecs) * 100))}%`
    : '—';

  const totalMinsH = Math.floor(totalMinsFiltered / 60);
  const totalMinsM = totalMinsFiltered % 60;
  const focusTimeLabel = totalMinsFiltered > 0
    ? totalMinsH > 0 ? `${totalMinsH}h ${totalMinsM}m` : `${totalMinsM}m`
    : '—';

  if (loading) {
    return (
      <div className="w-full">
        <div className="h-44 bg-gray-200 animate-pulse" />
        <div className="px-5 py-6 space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-white rounded-2xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  const rangeLabel = RANGE_OPTIONS.find((r) => r.key === range)!.label;
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="w-full">
      {/* Hero banner */}
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: '16/5' }}>
        <img src={heroImg} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-gray-900/80 via-gray-900/50 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-end px-6 pb-6">
          <p className="text-teal-300 text-xs font-semibold uppercase tracking-widest mb-1">{today}</p>
          <h1 className="text-3xl font-bold text-white leading-tight">Your Focus Dashboard</h1>
          <p className="text-gray-300 text-sm mt-1">Track your sessions, medals, and focus trends</p>
        </div>
        <Link
          to="/new-session"
          className="absolute top-4 right-4 flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-lg transition-all duration-150"
        >
          <Plus className="w-4 h-4" />
          New Session
        </Link>
      </div>

      <div className="px-5 py-5 space-y-6">
        {/* Active session banner */}
        {activeSession && (
          <Link to="/session/active" className="block">
            <div className="bg-gradient-to-r from-teal-700 to-teal-500 rounded-2xl p-5 text-white shadow-lg shadow-teal-100 hover:shadow-xl transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <Target className="w-5 h-5 text-white" strokeWidth={2.2} />
                  </div>
                  <div>
                    <p className="text-teal-100 text-xs font-semibold uppercase tracking-wider mb-0.5">Active Session</p>
                    <p className="font-semibold text-base leading-tight">{activeSession.goal}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-teal-100">Resume</span>
                  <ArrowRight className="w-5 h-5 text-white/80" />
                </div>
              </div>
            </div>
          </Link>
        )}

        {/* Parked thoughts */}
        {pendingThoughts > 0 && (
          <Link to="/parked-thoughts">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between hover:bg-amber-100 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center">
                  <Brain className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-800">{pendingThoughts} parked thought{pendingThoughts > 1 ? 's' : ''} waiting</p>
                  <p className="text-xs text-amber-600">Accept, reject, or group into themes</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-amber-600" />
            </div>
          </Link>
        )}

        {/* Quick stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: CheckCircle, label: 'Sessions',    value: String(totalSessionsFiltered), color: 'text-teal-600',   bg: 'bg-teal-50',   ring: 'ring-teal-100'   },
            { icon: Flame,       label: 'Focus Time',  value: focusTimeLabel,                color: 'text-orange-600', bg: 'bg-orange-50', ring: 'ring-orange-100' },
            { icon: TrendingUp,  label: 'Return Rate', value: returnRateFiltered,            color: 'text-green-600',  bg: 'bg-green-50',  ring: 'ring-green-100'  },
            { icon: Target,      label: 'Focus %',     value: focusPct,                      color: 'text-blue-600',   bg: 'bg-blue-50',   ring: 'ring-blue-100'   },
          ].map(({ icon: Icon, label, value, color, bg, ring }) => (
            <div key={label} className={`bg-white rounded-2xl border border-gray-100 ring-1 ${ring} p-4 shadow-sm`}>
              <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center mb-3`}>
                <Icon className={`w-4 h-4 ${color}`} strokeWidth={2} />
              </div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Date range filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">Range:</span>
          {RANGE_OPTIONS.map((r) => (
            <button key={r.key} onClick={() => setRange(r.key)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                range === r.key ? 'bg-teal-600 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:border-teal-300 hover:text-teal-700'
              }`}>
              {r.label}
            </button>
          ))}
        </div>

        {/* Medal Board */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Medal Board</h2>
            <span className="text-xs text-gray-400">{rangeLabel}</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { icon: Medal, name: 'Rock Focus',     desc: 'Zero deviations',  count: rockFocusCount,     gradient: 'from-yellow-400 to-amber-500', ring: 'ring-amber-200', glow: 'shadow-amber-100'  },
              { icon: Zap,   name: 'Quick Comeback', desc: '90%+ return rate', count: quickComebackCount, gradient: 'from-blue-400 to-cyan-500',    ring: 'ring-blue-200',  glow: 'shadow-blue-100'   },
              { icon: Star,  name: 'Super Session',  desc: 'Goal achieved',    count: superSessionCount,  gradient: 'from-green-400 to-teal-500',   ring: 'ring-green-200', glow: 'shadow-green-100'  },
            ].map(({ icon: Icon, name, desc, count, gradient, ring, glow }) => (
              <div key={name} className={`bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex flex-col items-center text-center transition-all duration-200 ${count > 0 ? `ring-2 ${ring} shadow-lg ${glow}` : 'opacity-50'}`}>
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-3 shadow-md ${count === 0 ? 'grayscale' : ''}`}>
                  <Icon className="w-7 h-7 text-white" strokeWidth={2.2} />
                </div>
                <p className="text-3xl font-bold text-gray-900">{count}</p>
                <p className="text-xs font-semibold text-gray-700 mt-1">{name}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 7-day charts */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Last 7 Days — Activity Trends</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <p className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-0.5">Sessions / Day</p>
              <p className="text-xs text-gray-400 mb-4">completed sessions per day</p>
              <BarChart values={chartMetrics.map((m) => m.completed)} color="bg-teal-400" fmt={(v) => `${v} session${v !== 1 ? 's' : ''}`} />
              <div className="flex gap-1 mt-2">
                {chartMetrics.map((m) => <p key={m.date} className="flex-1 text-center text-[9px] text-gray-400">{m.label}</p>)}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <p className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-0.5">Returns / Min</p>
              <p className="text-xs text-gray-400 mb-4">lower is better — fewer interruptions</p>
              <BarChart values={chartMetrics.map((m) => m.returnsPerMin)} color="bg-orange-400" fmt={(v) => `${v.toFixed(2)}/min`} />
              <div className="flex gap-1 mt-2">
                {chartMetrics.map((m) => <p key={m.date} className="flex-1 text-center text-[9px] text-gray-400">{m.label}</p>)}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <p className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-0.5">Return Rate %</p>
              <p className="text-xs text-gray-400 mb-4">aim for 95%+ bounce-back ability</p>
              <BarChart values={chartMetrics.map((m) => (isNaN(m.returnRate) ? 0 : m.returnRate * 100))} color="bg-blue-400" fmt={(v) => `${Math.round(v)}%`} />
              <div className="flex gap-1 mt-2">
                {chartMetrics.map((m) => <p key={m.date} className="flex-1 text-center text-[9px] text-gray-400">{m.label}</p>)}
              </div>
            </div>
          </div>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pb-2">
          {[
            { to: '/vision-board', label: 'Vision Board', bg: 'bg-gradient-to-br from-teal-500 to-teal-700', desc: 'Goals & roadmap' },
            { to: '/nudges',       label: 'My Nudges',    bg: 'bg-gradient-to-br from-sky-500 to-blue-700',  desc: 'Daily motivation' },
            { to: '/parked-thoughts', label: 'Parked Thoughts', bg: 'bg-gradient-to-br from-amber-500 to-orange-600', desc: 'Ideas to review' },
            { to: '/history',      label: 'Session History', bg: 'bg-gradient-to-br from-slate-600 to-slate-800', desc: 'All past sessions' },
          ].map(({ to, label, bg, desc }) => (
            <Link key={to} to={to}>
              <div className={`${bg} rounded-2xl p-4 text-white shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-150`}>
                <p className="text-sm font-bold">{label}</p>
                <p className="text-xs text-white/70 mt-0.5">{desc}</p>
                <ArrowRight className="w-4 h-4 text-white/60 mt-3" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
