import React from 'react';
import { Target, CheckCircle, PlusCircle } from 'lucide-react';

interface StoredSession {
  id: string;
  goal: string;
  end_minutes: number;
  allowed_sites: string[];
  tolerance_seconds: number;
  status: string;
  started_at: string;
  ended_at?: string;
}

interface Props {
  session: StoredSession;
  onNewSession: () => void;
}

export default function CompletedSession({ session, onNewSession }: Props) {
  const isCompleted = session.status === 'completed';
  const started = new Date(session.started_at);
  const ended = session.ended_at ? new Date(session.ended_at) : new Date();
  const diffMins = Math.round((ended.getTime() - started.getTime()) / 60000);

  return (
    <div className="w-80 bg-white" style={{ minHeight: 340 }}>
      <div className="bg-gradient-to-br from-teal-700 to-teal-500 px-5 py-4 flex items-center gap-2">
        <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center">
          <Target className="w-4 h-4 text-white" strokeWidth={2.2} />
        </div>
        <span className="text-white font-bold text-base tracking-wide">Return On</span>
      </div>

      <div className="px-5 py-6 flex flex-col items-center text-center gap-4">
        <div className="text-5xl">{isCompleted ? '🎉' : '✋'}</div>
        <div>
          <h2 className="text-base font-bold text-gray-800 mb-1">
            {isCompleted ? 'Session Complete!' : 'Session Ended'}
          </h2>
          <p className="text-sm text-gray-500">
            {isCompleted
              ? `Great work! You stayed focused for ${session.end_minutes} minutes.`
              : `You ended after ${diffMins} minute${diffMins !== 1 ? 's' : ''}.`}
          </p>
        </div>

        <div className="w-full bg-teal-50 rounded-xl px-4 py-3 text-left">
          <div className="flex items-center gap-1.5 mb-1">
            <CheckCircle className="w-3.5 h-3.5 text-teal-600" />
            <span className="text-xs font-semibold text-teal-600 uppercase tracking-wider">Completed Goal</span>
          </div>
          <p className="text-sm font-medium text-gray-800">{session.goal}</p>
        </div>

        <button
          onClick={onNewSession}
          className="w-full bg-gradient-to-r from-teal-700 to-teal-500 text-white font-semibold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 hover:opacity-90 transition"
        >
          <PlusCircle className="w-4 h-4" /> Start New Session
        </button>
      </div>
    </div>
  );
}
