import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom';
import { Target, Brain, CircleUser as UserCircle, Shield, LogOut, Menu, X, BookOpen, Info, DollarSign, Upload, Layers, Zap, MessageSquare, GraduationCap, Leaf, ShoppingBag, Home, Users } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import type { UserProfile } from '../supabase';
import { supabase } from '../supabase';
import NotificationBell from './NotificationBell';
import TutorialModal from './TutorialModal';
import FeedbackWidget from './FeedbackWidget';
import type { AppMode } from './AppSelection';

const ADMIN_EMAIL = 'deepagster@gmail.com';

interface Props {
  user: User;
  profile: UserProfile;
  appMode: AppMode;
  onSwitchApp: (mode: AppMode) => void;
}

const ANIMAL_IMAGES: Record<string, string> = {
  Lion:      'https://images.pexels.com/photos/247502/pexels-photo-247502.jpeg?auto=compress&cs=tinysrgb&w=300',
  Tiger:     'https://images.pexels.com/photos/145939/pexels-photo-145939.jpeg?auto=compress&cs=tinysrgb&w=300',
  Elephant:  'https://images.pexels.com/photos/66898/elephant-cub-tsavo-kenya-66898.jpeg?auto=compress&cs=tinysrgb&w=300',
  Eagle:     'https://images.pexels.com/photos/1094570/pexels-photo-1094570.jpeg?auto=compress&cs=tinysrgb&w=300',
  Horse:     'https://images.pexels.com/photos/635499/pexels-photo-635499.jpeg?auto=compress&cs=tinysrgb&w=300',
  Dolphin:   'https://images.pexels.com/photos/64219/dolphin-marine-mammals-water-sea-64219.jpeg?auto=compress&cs=tinysrgb&w=300',
  Butterfly: 'https://images.pexels.com/photos/56866/garden-rose-red-pink-56866.jpeg?auto=compress&cs=tinysrgb&w=300',
  Wolf:      'https://images.pexels.com/photos/2295744/pexels-photo-2295744.jpeg?auto=compress&cs=tinysrgb&w=300',
  Owl:       'https://images.pexels.com/photos/1202581/pexels-photo-1202581.jpeg?auto=compress&cs=tinysrgb&w=300',
  Dog:       'https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg?auto=compress&cs=tinysrgb&w=300',
};

const SIDEBAR_QUOTES = [
  { text: 'The future depends on what you do today.', author: 'Mahatma Gandhi' },
  { text: "It always seems impossible until it's done.", author: 'Nelson Mandela' },
  { text: "Believe you can and you're halfway there.", author: 'Theodore Roosevelt' },
  { text: "Your time is limited, so don't waste it living someone else's life.", author: 'Steve Jobs' },
  { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
  { text: 'In the middle of every difficulty lies opportunity.', author: 'Albert Einstein' },
  { text: 'The secret of getting ahead is getting started.', author: 'Mark Twain' },
  { text: 'Success is not final, failure is not fatal: it is the courage to continue that counts.', author: 'Winston Churchill' },
  { text: 'What you get by achieving your goals is not as important as what you become by achieving them.', author: 'Zig Ziglar' },
];

function getSessionQuote() {
  const key = 'nudged_quote_idx';
  let idx = parseInt(sessionStorage.getItem(key) ?? '-1');
  if (idx < 0) {
    idx = Math.floor(Math.random() * SIDEBAR_QUOTES.length);
    sessionStorage.setItem(key, String(idx));
  }
  return SIDEBAR_QUOTES[idx % SIDEBAR_QUOTES.length];
}

function SpiritCard({ profile }: { profile: UserProfile }) {
  const animalImg = profile.spirit_animal ? ANIMAL_IMAGES[profile.spirit_animal] : null;
  if (!animalImg || !profile.life_purpose) return null;
  return (
    <div className="mx-3 mb-2 rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
      <div className="relative h-24">
        <img src={animalImg} alt={profile.spirit_animal ?? ''} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-2 left-3">
          <span className="text-white/70 text-xs">I am a</span>
          <span className="ml-1 text-white font-black text-base drop-shadow">{profile.spirit_animal}</span>
        </div>
      </div>
      <div className="bg-gradient-to-br from-teal-700 to-teal-600 px-3 py-2.5">
        <p className="text-white/60 text-[10px] font-semibold uppercase tracking-wider mb-0.5">My Purpose</p>
        <p className="text-white/90 text-xs italic leading-relaxed">"{profile.life_purpose}"</p>
      </div>
    </div>
  );
}

export default function AppShell({ user, profile, appMode, onSwitchApp }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [quote] = useState(() => getSessionQuote());
  const [balance, setBalance] = useState<number | null>(null);
  const [isCoach, setIsCoach] = useState(false);
  const isAdmin = user.email === ADMIN_EMAIL;
  const navigate = useNavigate();

  // Auto-open tutorial on first-ever visit
  useEffect(() => {
    const key = `nudged_tutorial_shown_${user.id}`;
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, '1');
      setTutorialOpen(true);
    }
  }, [user.id]);

  useEffect(() => {
    if (isAdmin) return;
    supabase.from('user_credits').select('balance_usd,is_exempt').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => { if (data) setBalance(data.is_exempt ? null : data.balance_usd); });
  }, [user.id, isAdmin]);

  useEffect(() => {
    supabase.from('coaches').select('id').eq('email', user.email ?? '').eq('is_active', true).maybeSingle()
      .then(({ data }) => setIsCoach(!!data));
  }, [user.email]);

  const isBuddy = appMode === 'buddy';

  const navItems = isBuddy ? [
    ...(isAdmin ? [{ to: '/admin', icon: Shield, label: 'Admin' }] : []),
    ...(isCoach ? [{ to: '/coach', icon: GraduationCap, label: 'Coach' }] : []),
    { to: '/profile', icon: UserCircle, label: 'Profile' },
    { to: '/about', icon: Info, label: 'About' },
  ] : [
    { to: '/goals', icon: Layers, label: 'Threads' },
    { to: '/parked-thoughts', icon: Brain, label: 'Park Thoughts' },
    { to: '/bulk-upload', icon: Upload, label: 'Bulk Upload' },
    { to: '/profile', icon: UserCircle, label: 'Profile' },
    { to: '/about', icon: Info, label: 'About' },
    ...(isAdmin ? [{ to: '/admin', icon: Shield, label: 'Admin' }] : []),
    ...(isCoach ? [{ to: '/coach', icon: GraduationCap, label: 'Coach' }] : []),
  ];

  const brandName = isBuddy ? 'Buddy' : 'Parker';

  const handleHome = () => {
    setMobileOpen(false);
    setShowSwitcher(true);
  };
  const [showSwitcher, setShowSwitcher] = useState(false);

  const renderNav = (onClick?: () => void) =>
    navItems.map(({ to, icon: Icon, label }) => (
      <NavLink
        key={to}
        to={to}
        onClick={onClick}
        className={({ isActive }) =>
          `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
            isActive
              ? 'bg-teal-50 text-teal-700'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`
        }
      >
        <Icon className="w-4 h-4 flex-shrink-0" />
        {label}
      </NavLink>
    ));

  return (
    <div className="min-h-screen flex bg-gray-50 overflow-x-hidden">
      {/* Sidebar – desktop */}
      <aside className="hidden md:flex flex-col w-60 bg-white border-r border-gray-100 shadow-sm flex-shrink-0">
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <img src="/icons/ChatGPT_Image_Jul_5,_2026,_11_50_00_AM.png" alt="Nudged" className="w-12 h-12 rounded-xl object-contain shadow-sm" />
            <div className="flex flex-col leading-tight">
              <span className="text-xl font-black text-gray-900 tracking-tight">{brandName}</span>
              <span className="text-[10px] text-gray-400 font-medium tracking-wide">by Nudged</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setTutorialOpen(true)} className="p-1.5 text-gray-400 hover:text-teal-600 rounded-lg transition" title="Tutorial">
              <BookOpen className="w-4 h-4" />
            </button>
            <NotificationBell user={user} />
          </div>
        </div>

        {balance !== null && (
          <div className="mx-3 mt-3 mb-1 flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
            <DollarSign className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
            <span className="text-xs text-emerald-700 font-semibold">Balance: ${balance.toFixed(3)}</span>
            {balance < 0.1 && <span className="ml-auto text-xs text-amber-600 font-medium">Low</span>}
          </div>
        )}

        <nav className="px-3 py-4 space-y-0.5">
          {renderNav()}
        </nav>

        {isBuddy && (
          <>
            <div className="px-3 mb-1">
              <Link
                to="/marketplace"
                className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold shadow-sm hover:from-amber-600 hover:to-orange-600 transition-all"
              >
                <ShoppingBag className="w-4 h-4 flex-shrink-0" />
                Nudged Marketplace
              </Link>
            </div>
            <div className="px-3 mb-3">
              <Link
                to="/coachee"
                className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-white text-sm font-semibold shadow-sm hover:from-teal-600 hover:to-emerald-600 transition-all"
              >
                <Leaf className="w-4 h-4 flex-shrink-0" />
                Coachee View
              </Link>
            </div>
          </>
        )}

        {!isBuddy && (
          <div className="px-3 mb-2">
            <button
              onClick={handleHome}
              className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-white text-sm font-bold shadow-sm hover:from-teal-600 hover:to-emerald-600 transition-all"
            >
              <Home className="w-4 h-4 flex-shrink-0" />
              Go to Buddy
            </button>
          </div>
        )}

        {isBuddy && isAdmin && (
          <div className="px-3 mb-2">
            <button
              onClick={handleHome}
              className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-sm font-bold hover:bg-amber-100 transition-all"
            >
              <Home className="w-4 h-4 flex-shrink-0" />
              Go to Parker
            </button>
          </div>
        )}

        <div className="px-3 mb-2">
          {feedbackOpen ? (
            <div className="border border-gray-100 rounded-2xl shadow-sm bg-white pt-3">
              <FeedbackWidget user={user} onClose={() => setFeedbackOpen(false)} />
            </div>
          ) : (
            <button
              onClick={() => setFeedbackOpen(true)}
              className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-all"
            >
              <MessageSquare className="w-4 h-4 flex-shrink-0 text-teal-500" />
              Send Feedback
            </button>
          )}
        </div>

        <div className="flex-1" />

        <div className="px-4 py-3 border-t border-gray-50">
          <div className="bg-teal-50 rounded-2xl px-3 py-3">
            <p className="text-xs text-gray-500 italic leading-relaxed">"{quote.text}"</p>
            <p className="text-xs text-teal-600 font-semibold mt-1.5">— {quote.author}</p>
          </div>
        </div>

        <div className="px-3 pb-4 border-t border-gray-50 pt-2">
          <button
            onClick={() => supabase.auth.signOut()}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <img src="/icons/ChatGPT_Image_Jul_5,_2026,_11_50_00_AM.png" alt="Nudged" className="w-9 h-9 rounded-xl object-contain" />
          <div className="flex flex-col leading-tight">
            <span className="font-black text-gray-900 text-lg tracking-tight">{brandName}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {balance !== null && (
            <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${balance < 0.1 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
              ${balance.toFixed(2)}
            </span>
          )}
          <button onClick={() => setTutorialOpen(true)} className="p-1.5 text-gray-500 hover:text-teal-600 transition" title="Tutorial">
            <BookOpen className="w-4 h-4" />
          </button>
          <NotificationBell user={user} />
          <button onClick={() => setMobileOpen(true)} className="p-1.5 text-gray-600 hover:text-gray-900">
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 bg-white flex flex-col h-full shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <img src="/icons/ChatGPT_Image_Jul_5,_2026,_11_50_00_AM.png" alt="Nudged" className="w-10 h-10 rounded-xl object-contain" />
                <div className="flex flex-col leading-tight">
                  <span className="font-black text-gray-900 text-lg tracking-tight">{brandName}</span>
                  <span className="text-[10px] text-gray-400 font-medium">by Nudged</span>
                </div>
              </div>
              <button onClick={() => setMobileOpen(false)} className="p-1.5 text-gray-500 hover:text-gray-900">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="px-3 py-4 space-y-0.5">
              {renderNav(() => setMobileOpen(false))}
            </nav>
            {isBuddy && (
              <>
                <div className="px-3 mb-1">
                  <Link
                    to="/marketplace"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold shadow-sm hover:from-amber-600 hover:to-orange-600 transition-all"
                  >
                    <ShoppingBag className="w-4 h-4 flex-shrink-0" />
                    Nudged Marketplace
                  </Link>
                </div>
                <div className="px-3 mb-3">
                  <Link
                    to="/coachee"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-white text-sm font-semibold shadow-sm hover:from-teal-600 hover:to-emerald-600 transition-all"
                  >
                    <Leaf className="w-4 h-4 flex-shrink-0" />
                    Coachee View
                  </Link>
                </div>
              </>
            )}
            {isAdmin ? (
              <div className="px-3 mb-2">
                <button
                  onClick={handleHome}
                  className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-white text-sm font-bold shadow-sm hover:from-teal-600 hover:to-emerald-600 transition-all"
                >
                  <Home className="w-4 h-4 flex-shrink-0" />
                  Switch App
                </button>
              </div>
            ) : null}
            <div className="px-3 mb-2">
              <button
                onClick={() => { setMobileOpen(false); setFeedbackOpen(true); }}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-all"
              >
                <MessageSquare className="w-4 h-4 flex-shrink-0 text-teal-500" />
                Send Feedback
              </button>
            </div>
            <SpiritCard profile={profile} />
            <div className="flex-1" />
            <div className="px-4 py-3 border-t border-gray-50">
              <div className="bg-teal-50 rounded-2xl px-3 py-3">
                <p className="text-xs text-gray-500 italic leading-relaxed">"{quote.text}"</p>
                <p className="text-xs text-teal-600 font-semibold mt-1.5">— {quote.author}</p>
              </div>
            </div>
            <div className="px-3 pb-4 border-t border-gray-50 pt-2">
              <button
                onClick={() => { setMobileOpen(false); supabase.auth.signOut(); }}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all"
              >
                <LogOut className="w-4 h-4" /> Sign out
              </button>
            </div>
          </aside>
        </div>
      )}

      <main className="flex-1 min-w-0 overflow-x-hidden">
        <div className="md:pt-0 pt-14">
          <Outlet />
        </div>
      </main>

      {showSwitcher && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowSwitcher(false)} />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6">
            <button onClick={() => setShowSwitcher(false)} className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-900">
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Switch App</h2>
            <p className="text-sm text-gray-500 mb-4">Choose which Nudged app you'd like to use. You can change your default anytime in Profile.</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { onSwitchApp('buddy'); navigate('/marketplace'); setShowSwitcher(false); }}
                className={`p-4 rounded-2xl border-2 text-left transition-all ${appMode === 'buddy' ? 'border-teal-500 bg-teal-50' : 'border-gray-100 hover:border-teal-200'}`}
              >
                <Users className="w-5 h-5 text-teal-600 mb-2" />
                <p className="text-sm font-bold text-gray-900">Buddy</p>
                <p className="text-xs text-gray-500">Marketplace & Coachee</p>
              </button>
              <button
                onClick={() => { onSwitchApp('parker'); navigate('/parked-thoughts'); setShowSwitcher(false); }}
                className={`p-4 rounded-2xl border-2 text-left transition-all ${appMode === 'parker' ? 'border-amber-500 bg-amber-50' : 'border-gray-100 hover:border-amber-200'}`}
              >
                <Brain className="w-5 h-5 text-amber-600 mb-2" />
                <p className="text-sm font-bold text-gray-900">Parker</p>
                <p className="text-xs text-gray-500">Threads & Parking</p>
              </button>
            </div>
          </div>
        </div>
      )}

      {tutorialOpen && <TutorialModal onClose={() => setTutorialOpen(false)} />}

      {/* Feedback modal for mobile */}
      {feedbackOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex items-end justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setFeedbackOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden pt-3">
            <FeedbackWidget user={user} onClose={() => setFeedbackOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
