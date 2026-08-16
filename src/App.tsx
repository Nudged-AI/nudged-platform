import { useState, useEffect } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { supabase } from './supabase';
import type { UserProfile } from './supabase';
import type { User } from '@supabase/supabase-js';
import ParkedThoughtsPage from './pages/ParkedThoughtsPage';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';
import AboutPage from './pages/AboutPage';
import AppShell from './components/AppShell';
import LoginPage from './pages/LoginPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import GoalPage from './pages/GoalPage';
import SplashScreen from './components/SplashScreen';
import BulkUploadPage from './pages/BulkUploadPage';
import DeDistractPage from './pages/DeDistractPage';
import CoachPage from './pages/CoachPage';
import CoacheePage from './pages/CoacheePage';
import PublicCalendarPage from './components/PublicCalendarPage';
import MarketplacePage from './pages/MarketplacePage';
import AppSelection from './components/AppSelection';
import type { AppMode } from './components/AppSelection';

type AppState = 'loading' | 'login' | 'app' | 'reset_password' | 'app_selection';

async function ensureDefaultThreads(userId: string) {
  const { data: existing } = await supabase.from('goals').select('id,is_general,is_all_thread').eq('user_id', userId);
  const rows = (existing ?? []) as any[];

  // Remove duplicate General threads (keep only the first one)
  const generalRows = rows.filter((r: any) => r.is_general);
  if (generalRows.length > 1) {
    const [, ...extras] = generalRows;
    await supabase.from('goals').delete().in('id', extras.map((r: any) => r.id));
  }
  const allRows = rows.filter((r: any) => r.is_all_thread);
  if (allRows.length > 1) {
    const [, ...extras] = allRows;
    await supabase.from('goals').delete().in('id', extras.map((r: any) => r.id));
  }

  if (generalRows.length === 0) {
    await supabase.from('goals').insert({ user_id: userId, title: 'General', is_general: true, is_all_thread: false, target_date: null });
  }
  if (allRows.length === 0) {
    await supabase.from('goals').insert({ user_id: userId, title: 'All', is_general: false, is_all_thread: true, target_date: null });
  }
}

function PublicCalendarWrapper() {
  const { slug } = useParams();
  return slug ? <PublicCalendarPage slug={slug} /> : null;
}

export default function App() {
  const [appState, setAppState] = useState<AppState>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [defaultRoute, setDefaultRoute] = useState<string>('/goals');
  const [appMode, setAppMode] = useState<AppMode>('parker');
  const [showSplash, setShowSplash] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const [isMaintenance, setIsMaintenance] = useState(false);

  const resolveState = async (u: User | null) => {
    if (!u) { setUser(null); setAppState('login'); return; }
    setUser(u);

    // Check maintenance / banned
    const [{ data: bannedRow }, { data: maintenanceRow }] = await Promise.all([
      supabase.from('banned_users').select('email').eq('email', u.email ?? '').maybeSingle(),
      supabase.from('admin_controls').select('value').eq('key', 'global_maintenance').maybeSingle(),
    ]);
    if (maintenanceRow?.value === 'true' && u.email !== 'deepagster@gmail.com') { setIsMaintenance(true); return; }
    if (bannedRow) { setIsBanned(true); return; }

    const { data } = await supabase.from('user_profiles').select('*').eq('id', u.id).maybeSingle();
    // Auto-create a minimal profile if none exists (onboarding screen removed)
    let profileData = data as UserProfile | null;
    if (!profileData) {
      const fullName = (u.user_metadata?.full_name as string) || (u.user_metadata?.first_name ?? '') + ' ' + (u.user_metadata?.last_name ?? '');
      await supabase.from('user_profiles').upsert({
        id: u.id,
        full_name: fullName.trim(),
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      });
      const { data: newData } = await supabase.from('user_profiles').select('*').eq('id', u.id).maybeSingle();
      profileData = newData as UserProfile | null;
    }
    if (profileData) {
      setProfile(profileData);
      await ensureDefaultThreads(u.id);
      const { count } = await supabase.from('goals').select('id', { count: 'exact', head: true }).eq('user_id', u.id);
      setDefaultRoute((count ?? 0) > 0 ? '/parked-thoughts' : '/goals');
      // Determine app mode from preferred_app
      const ADMIN_EMAIL = 'deepagster@gmail.com';
      const isUserAdmin = u.email === ADMIN_EMAIL;
      const preferred = (profileData as any).preferred_app as AppMode | null;
      // Non-admin users always go to Buddy — no Parker option
      if (preferred === 'parker' && !isUserAdmin) {
        setAppMode('buddy');
        const { data: coachRow } = await supabase.from('coaches').select('id').eq('email', u.email).eq('is_active', true).maybeSingle();
        setDefaultRoute(coachRow ? '/coach' : '/coachee');
      } else if (preferred === 'buddy') {
        setAppMode('buddy');
        const { data: coachRow } = await supabase.from('coaches').select('id').eq('email', u.email).eq('is_active', true).maybeSingle();
        setDefaultRoute(coachRow ? '/coach' : '/coachee');
      } else if (preferred === 'parker') {
        setAppMode('parker');
        setDefaultRoute('/parked-thoughts');
      } else {
        // No default chosen — non-admins auto-land on Buddy, admins get selection
        if (!isUserAdmin) {
          setAppMode('buddy');
          const { data: coachRow } = await supabase.from('coaches').select('id').eq('email', u.email).eq('is_active', true).maybeSingle();
          setDefaultRoute(coachRow ? '/coach' : '/coachee');
        } else {
          setAppState('app_selection');
          return;
        }
      }
      if (!sessionStorage.getItem('nudged_splash_shown')) {
        sessionStorage.setItem('nudged_splash_shown', '1');
        setShowSplash(true);
      }
      setAppState('app');
    } else {
      setAppState('app');
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => resolveState(session?.user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage && session?.access_token) {
          try { chrome.runtime.sendMessage({ type: 'STORE_AUTH', token: session.access_token, userId: session.user!.id, email: session.user!.email }); } catch { /* not extension */ }
        }
        if (event === 'PASSWORD_RECOVERY') { setAppState('reset_password'); return; }
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (event === 'SIGNED_IN' && session?.user) {
            const loginKey = `nudged_login_tracked_${session.user.id}`;
            if (!sessionStorage.getItem(loginKey)) {
              sessionStorage.setItem(loginKey, '1');
              supabase.from('user_login_events').insert({ user_id: session.user.id, email: session.user.email ?? null }).then(() => {});
            }
          }
          await resolveState(session?.user ?? null);
        }
        else if (event === 'SIGNED_OUT') await resolveState(null);
      })();
    });
    return () => subscription.unsubscribe();
  }, []);

  if (isMaintenance) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 text-center">
      <div>
        <img src="/icons/ChatGPT_Image_Jul_5,_2026,_11_50_00_AM.png" alt="Nudged" className="w-16 h-16 mx-auto mb-4 object-contain" />
        <h1 className="text-xl font-bold text-gray-800 mb-2">Sorry for the inconvenience.</h1>
        <p className="text-gray-500">Nudged is under maintenance, we will come back soon.</p>
      </div>
    </div>
  );

  if (isBanned) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 text-center">
      <div>
        <img src="/icons/ChatGPT_Image_Jul_5,_2026,_11_50_00_AM.png" alt="Nudged" className="w-16 h-16 mx-auto mb-4 object-contain" />
        <h1 className="text-xl font-bold text-gray-800 mb-2">Access Restricted</h1>
        <p className="text-gray-500">Your account has been restricted. Please contact support.</p>
      </div>
    </div>
  );

  // Public calendar route — checked FIRST before any auth state.
  // Uses hash-based routing (/#/calendar/slug) so it works in Bolt preview without server-side SPA fallback.
  const hash = typeof window !== 'undefined' ? window.location.hash : '';
  const isPublicRoute = hash.startsWith('#/calendar/');

  if (isPublicRoute) {
    return (
      <HashRouter>
        <Routes>
          <Route path="/calendar/:slug" element={<PublicCalendarWrapper />} />
        </Routes>
      </HashRouter>
    );
  }

  if (appState === 'loading') return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (appState === 'reset_password') return <ResetPasswordPage onDone={() => supabase.auth.getUser().then(({ data }) => resolveState(data.user))} />;
  if (appState === 'login') return <LoginPage onAuth={() => supabase.auth.getUser().then(({ data }) => resolveState(data.user))} />;
  if (appState === 'app_selection' && user) return (
    <AppSelection
      user={user}
      onSelect={async (mode: AppMode) => {
        setAppMode(mode);
        if (mode === 'buddy') {
          const { data: coachRow } = await supabase.from('coaches').select('id').eq('email', user.email).eq('is_active', true).maybeSingle();
          setDefaultRoute(coachRow ? '/coach' : '/coachee');
        } else { setDefaultRoute('/parked-thoughts'); }
        if (!sessionStorage.getItem('nudged_splash_shown')) {
          sessionStorage.setItem('nudged_splash_shown', '1');
          setShowSplash(true);
        }
        setAppState('app');
      }}
    />
  );

  if (!user || !profile) return null;

  return (
    <>
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell user={user} profile={profile} appMode={appMode} onSwitchApp={(mode: AppMode) => {
            setAppMode(mode);
            if (mode === 'buddy') {
              supabase.from('coaches').select('id').eq('email', user.email).eq('is_active', true).maybeSingle().then(({ data }) => {
                setDefaultRoute(data ? '/coach' : '/coachee');
              });
            } else { setDefaultRoute('/parked-thoughts'); }
          }} />}>
            <Route path="/" element={<Navigate to={defaultRoute} replace />} />
            <Route path="/goals" element={<GoalPage user={user} profile={profile} />} />
            <Route path="/parked-thoughts" element={<ParkedThoughtsPage user={user} profile={profile} />} />
            <Route path="/bulk-upload" element={<BulkUploadPage user={user} />} />
            <Route path="/profile" element={<ProfilePage user={user} />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/admin" element={<AdminPage user={user} />} />
            <Route path="/coach" element={<CoachPage user={user} />} />
            <Route path="/coachee" element={<CoacheePage user={user} />} />
            <Route path="/marketplace" element={<MarketplacePage user={user} />} />
          </Route>
          <Route path="/de-distract" element={<DeDistractPage user={user} profile={profile} />} />
          {/* Public calendar route also accessible inside BrowserRouter for authenticated users */}
          <Route path="/calendar/:slug" element={<PublicCalendarWrapper />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}
