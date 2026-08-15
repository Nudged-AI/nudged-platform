import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Target, Clock, CheckCircle, AlertCircle, Brain, ArrowRight } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../supabase';

interface SessionRow {
  id: string;
  goal: string;
  end_minutes: number;
  status: string;
  started_at: string;
  ended_at?: string;
  allowed_sites: string[];
}

interface Props {
  user: User;
}

export default function DashboardPage({ user }: Props) {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [pendingThoughts, setPendingThoughts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeSession, setActiveSession] = useState<SessionRow | null>(null);

  useEffect(() => {
    loadData();
  }, [user.id]);

  const loadData = async () => {
    setLoading(true);
    const [{ data: sessData }, { count }] = await Promise.all([
      supabase
        .from('sessions')
        .select('id,goal,end_minutes,status,started_at,ended_at,allowed_sites')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(10),
      supabase
        .from('parked_thoughts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'pending'),
    ]);
    const rows = sessData ?? [];
    setSessions(rows);
    setPendingThoughts(count ?? 0);
    const active = rows.find((s) => s.status === 'active') ?? null;
    setActiveSession(active);
    setLoading(false);
  };

  const completedToday = sessions.filter((s) => {
    if (s.status !== 'completed') return false;
    const d = new Date(s.started_at);
    const now = new Date();
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth();
  }).length;

  const totalMinutesToday = sessions
    .filter((s) => {
      if (s.status !== 'completed') return false;
      const d = new Date(s.started_at);
      const now = new Date();
      return d.getDate() === now.getDate() && d.getMonth() === now.getMonth();
    })
    .reduce((sum, s) => sum + s.end_minutes, 0);

  if (loading) {
    return (
      <div className="p-6 md:p-8 max-w-4xl mx-auto">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-white rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Link
          to="/new-session"
          className="flex items-center gap-2 bg-gradient-to-r from-teal-700 to-teal-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm shadow-teal-200 hover:opacity-90 transition-all duration-150"
        >
          <Plus className="w-4 h-4" />
          New Session
        </Link>
      </div>

      {/* Active session banner */}
      {activeSession && (
        <Link to="/session/active" className="block">
          <div className="bg-gradient-to-r from-teal-700 to-teal-500 rounded-2xl p-5 text-white shadow-lg shadow-teal-200 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Target className="w-5 h-5 text-white" strokeWidth={2.2} />
                </div>
                <div>
                  <p className="text-teal-100 text-xs font-medium uppercase tracking-wider mb-0.5">Active Session</p>
                  <p className="font-semibold text-base leading-tight">{activeSession.goal}</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-white/70" />
            </div>
          </div>
        </Link>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: CheckCircle, label: 'Completed Today', value: completedToday, color: 'text-teal-600', bg: 'bg-teal-50', to: '/history' },
          { icon: Clock, label: 'Minutes Today', value: totalMinutesToday, color: 'text-blue-600', bg: 'bg-blue-50', to: '/history' },
          { icon: Target, label: 'Total Sessions', value: sessions.length, color: 'text-gray-600', bg: 'bg-gray-100', to: '/history' },
          { icon: Brain, label: 'Parked Thoughts', value: pendingThoughts, color: 'text-amber-600', bg: 'bg-amber-50', to: '/parked-thoughts' },
        ].map(({ icon: Icon, label, value, color, bg, to }) => (
          <Link key={label} to={to} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md hover:border-teal-200 transition-all">
            <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center mb-3`}>
              <Icon className={`w-4.5 h-4.5 ${color}`} strokeWidth={2} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </Link>
        ))}
      </div>

      {/* Pending thoughts CTA */}
      {pendingThoughts > 0 && (
        <Link to="/parked-thoughts">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between hover:bg-amber-100 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center">
                <Brain className="w-4.5 h-4.5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-800">{pendingThoughts} parked thought{pendingThoughts > 1 ? 's' : ''} to review</p>
                <p className="text-xs text-amber-600">Accept, reject, or group them into themes</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-amber-600" />
          </div>
        </Link>
      )}

      {/* Recent sessions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Recent Sessions</h2>
          <Link to="/history" className="text-xs text-teal-600 font-medium hover:text-teal-700">View all</Link>
        </div>
        {sessions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center shadow-sm">
            <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Target className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-gray-500 text-sm">No sessions yet. Start your first focus session!</p>
            <Link to="/new-session" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-teal-600 hover:text-teal-700">
              <Plus className="w-4 h-4" /> Declare a session
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.slice(0, 5).map((s) => (
              <div key={s.id} className="bg-white rounded-2xl border border-gray-100 px-4 py-3.5 flex items-center gap-4 shadow-sm">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  s.status === 'active' ? 'bg-teal-100' : s.status === 'completed' ? 'bg-green-100' : 'bg-gray-100'
                }`}>
                  {s.status === 'active' ? (
                    <div className="w-2.5 h-2.5 bg-teal-500 rounded-full animate-pulse" />
                  ) : s.status === 'completed' ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-gray-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{s.goal}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {s.end_minutes}min · {new Date(s.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  s.status === 'active' ? 'bg-teal-100 text-teal-700' :
                  s.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {s.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
