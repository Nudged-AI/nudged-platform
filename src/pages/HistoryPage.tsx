import React, { useEffect, useState } from 'react';
import { Clock, CheckCircle, AlertCircle, Target, Globe } from 'lucide-react';
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

export default function HistoryPage({ user }: Props) {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('sessions')
      .select('id,goal,end_minutes,status,started_at,ended_at,allowed_sites')
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
      .then(({ data }) => {
        setSessions(data ?? []);
        setLoading(false);
      });
  }, [user.id]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalCompleted = sessions.filter((s) => s.status === 'completed').length;
  const totalMinutes = sessions
    .filter((s) => s.status === 'completed')
    .reduce((sum, s) => sum + s.end_minutes, 0);

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Session History</h1>
        <p className="text-sm text-gray-500 mt-0.5">All your past focus sessions.</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-2xl font-bold text-gray-900">{totalCompleted}</p>
          <p className="text-xs text-gray-500 mt-0.5">Sessions completed</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-2xl font-bold text-gray-900">{totalMinutes}</p>
          <p className="text-xs text-gray-500 mt-0.5">Minutes focused</p>
        </div>
      </div>

      {/* Sessions list */}
      {sessions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center shadow-sm">
          <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Target className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-gray-500 text-sm">No sessions recorded yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => (
            <div key={s.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <button
                className="w-full text-left px-4 py-4 flex items-center gap-4 hover:bg-gray-50 transition"
                onClick={() => setExpanded(expanded === s.id ? null : s.id)}
              >
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
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock className="w-3 h-3" />{s.end_minutes} min
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(s.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                  s.status === 'active' ? 'bg-teal-100 text-teal-700' :
                  s.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>{s.status}</span>
              </button>

              {expanded === s.id && (
                <div className="px-4 pb-4 pt-0 border-t border-gray-50">
                  <div className="flex items-start gap-2 mt-3">
                    <Globe className="w-3.5 h-3.5 text-teal-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-1.5">Allowed Sites</p>
                      <div className="flex flex-wrap gap-1.5">
                        {s.allowed_sites.map((site) => (
                          <span key={site} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-lg">{site}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  {s.ended_at && (
                    <p className="text-xs text-gray-400 mt-3">
                      Ended: {new Date(s.ended_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
