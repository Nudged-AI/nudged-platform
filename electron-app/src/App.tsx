import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { ipc } from './lib/ipc';
import { supabase, type UserProfile } from './lib/supabase';
import AppShell from './components/AppShell';
import DashboardPage from './pages/DashboardPage';
import NewSessionPage from './pages/NewSessionPage';
import SessionActivePage from './pages/SessionActivePage';
import ParkedThoughtsPage from './pages/ParkedThoughtsPage';
import HistoryPage from './pages/HistoryPage';
import SettingsPage from './pages/SettingsPage';
import LoginPage from './pages/LoginPage';
import OnboardingPage from './pages/OnboardingPage';
import ProfilePage from './pages/ProfilePage';
import VisionBoardViewPage from './pages/VisionBoardViewPage';
import VisionBoardEditPage from './pages/VisionBoardEditPage';
import NudgesPage from './pages/NudgesPage';
import GoodNewsPage from './pages/GoodNewsPage';

type AppState = 'loading' | 'login' | 'onboarding' | 'app' | 'vision-setup';

export default function App() {
  const [appState, setAppState] = useState<AppState>('loading');
  const [localUserId, setLocalUserId] = useState<string>('');
  const [supabaseUserId, setSupabaseUserId] = useState<string>('');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [prefillName, setPrefillName] = useState('');

  useEffect(() => {
    ipc.getUser().then((u) => setLocalUserId(u.id));
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        handleAuthUser(session.user.id, session.user.user_metadata);
      } else {
        setAppState('login');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setAppState('login');
        setSupabaseUserId('');
        setProfile(null);
        return;
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        (async () => {
          await handleAuthUser(session.user.id, session.user.user_metadata);
        })();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleAuthUser(uid: string, metadata: Record<string, unknown>) {
    setSupabaseUserId(uid);
    const metaName = (metadata?.full_name as string) ||
      [metadata?.first_name, metadata?.last_name].filter(Boolean).join(' ') || '';
    setPrefillName(metaName);

    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle();

    if (data && (data as UserProfile).onboarding_completed) {
      setProfile(data as UserProfile);
      // Check if user has any visions — if not, go to vision setup first
      const { count } = await supabase
        .from('visions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', uid)
        .eq('status', 'active');
      if ((count ?? 0) === 0) {
        setAppState('vision-setup');
      } else {
        setAppState('app');
      }
    } else {
      setAppState('onboarding');
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (appState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (appState === 'login') {
    return <LoginPage onAuth={() => { /* handled by onAuthStateChange */ }} />;
  }

  if (appState === 'onboarding') {
    return (
      <OnboardingPage
        userId={supabaseUserId}
        prefillName={prefillName}
        onComplete={(p) => {
          setProfile(p);
          setAppState('vision-setup');
        }}
      />
    );
  }

  if (appState === 'vision-setup') {
    return (
      <VisionBoardEditPage
        userId={supabaseUserId}
        profile={profile!}
        onComplete={() => setAppState('app')}
        onBack={() => setAppState('app')}
      />
    );
  }

  const userId = localUserId || supabaseUserId;

  return (
    <HashRouter>
      <AppRoutes
        userId={userId}
        supabaseUserId={supabaseUserId}
        profile={profile!}
        setProfile={setProfile}
        handleSignOut={handleSignOut}
      />
    </HashRouter>
  );
}

function AppRoutes({
  userId, supabaseUserId, profile, setProfile, handleSignOut,
}: {
  userId: string;
  supabaseUserId: string;
  profile: UserProfile;
  setProfile: (p: UserProfile) => void;
  handleSignOut: () => void;
}) {
  const navigate = useNavigate();

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<DashboardPage userId={userId} />} />
        <Route
          path="/vision-board"
          element={
            <VisionBoardViewPage
              userId={supabaseUserId}
              profile={profile}
              onAddVision={() => navigate('/vision-board/new')}
              onEditVision={(id) => navigate(`/vision-board/edit/${id}`)}
            />
          }
        />
        <Route path="/nudges" element={<NudgesPage userId={supabaseUserId} profile={profile} onViewRoadmap={(id) => navigate(`/vision-board/edit/${id}`)} />} />
        <Route path="/good-news" element={<GoodNewsPage userId={supabaseUserId} profile={profile} />} />
        <Route path="/new-session" element={<NewSessionPage userId={userId} />} />
        <Route path="/session/active" element={<SessionActivePage userId={userId} />} />
        <Route path="/parked-thoughts" element={<ParkedThoughtsPage userId={userId} />} />
        <Route path="/history" element={<HistoryPage userId={userId} />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route
          path="/profile"
          element={
            profile ? (
              <ProfilePage
                profile={profile}
                onProfileUpdate={(p) => setProfile(p)}
                onSignOut={handleSignOut}
              />
            ) : null
          }
        />
      </Route>
      {/* Full-screen vision board edit (outside AppShell) */}
      <Route
        path="/vision-board/new"
        element={
          <VisionBoardEditPage
            userId={supabaseUserId}
            profile={profile}
            onComplete={() => navigate('/vision-board')}
            onBack={() => navigate('/vision-board')}
          />
        }
      />
      <Route
        path="/vision-board/edit/:visionId"
        element={
          <VisionBoardEditRouteWrapper
            userId={supabaseUserId}
            profile={profile}
            onComplete={() => navigate('/vision-board')}
            onBack={() => navigate('/vision-board')}
          />
        }
      />
    </Routes>
  );
}

function VisionBoardEditRouteWrapper({
  userId, profile, onComplete, onBack,
}: {
  userId: string; profile: UserProfile; onComplete: () => void; onBack: () => void;
}) {
  const { visionId } = useParams();
  return (
    <VisionBoardEditPage
      userId={userId}
      profile={profile}
      visionId={visionId}
      onComplete={onComplete}
      onBack={onBack}
    />
  );
}

// Need useParams from react-router-dom - already imported above
