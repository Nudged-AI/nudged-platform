import React, { useEffect, useState } from 'react';
import DeclarationForm from './components/DeclarationForm';
import ActiveSession from './components/ActiveSession';
import CompletedSession from './components/CompletedSession';
import LoginScreen from './components/LoginScreen';
import { supabase } from './supabase';
import type { User } from '@supabase/supabase-js';

interface StoredSession {
  id: string;
  goal: string;
  end_minutes: number;
  allowed_sites: string[];
  tolerance_seconds: number;
  status: string;
  last_allowed_url: string;
  started_at: string;
  ended_at?: string;
}

export default function PopupApp() {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setUser(s?.user ?? null);
      setAuthChecked(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setUser(s?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    chrome.storage.local.get(['returnon_session'], (result) => {
      const s = result.returnon_session as StoredSession | undefined;
      if (s && s.status === 'active') {
        const started = new Date(s.started_at).getTime();
        const endMs = s.end_minutes * 60 * 1000;
        if (Date.now() < started + endMs) {
          setSession(s);
        } else {
          s.status = 'completed';
          chrome.storage.local.set({ returnon_session: s });
          setSession(s);
        }
      } else if (s) {
        setSession(s);
      }
      setLoading(false);
    });
  }, [authChecked]);

  const handleSessionStart = (s: StoredSession) => setSession(s);

  const handleEndSession = () => {
    chrome.runtime.sendMessage({ type: 'SESSION_END' });
    chrome.storage.local.remove('returnon_session');
    setSession(null);
  };

  const handleNewSession = () => setSession(null);

  if (!authChecked) {
    return (
      <div className="w-80 h-40 flex items-center justify-center bg-white">
        <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  if (loading) {
    return (
      <div className="w-80 h-40 flex items-center justify-center bg-white">
        <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <DeclarationForm onSessionStart={handleSessionStart} />;
  }

  if (session.status === 'completed' || session.status === 'abandoned') {
    return <CompletedSession session={session} onNewSession={handleNewSession} />;
  }

  return <ActiveSession session={session} onEndSession={handleEndSession} />;
}
