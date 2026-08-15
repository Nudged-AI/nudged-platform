import React, { useState, useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Target, LayoutDashboard, Plus, Brain, History, Menu, X, Settings, Medal, Zap, Star, User, Eye, Bell, Newspaper } from 'lucide-react';
import { ipc } from '../lib/ipc';

const BADGE_META: Record<string, { icon: React.ElementType; gradient: string; desc: string }> = {
  'Rock Focus':     { icon: Medal, gradient: 'from-yellow-400 to-amber-500', desc: 'Zero deviations — pure focus!' },
  'Quick Comeback': { icon: Zap,   gradient: 'from-blue-400 to-cyan-500',   desc: '90%+ return rate — great discipline!' },
  'Super Session':  { icon: Star,  gradient: 'from-green-400 to-teal-500',  desc: 'Goal achieved — mission complete!' },
};

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { to: '/vision-board', icon: Eye, label: 'Vision Board', exact: false },
  { to: '/nudges', icon: Bell, label: 'Nudges', exact: false },
  { to: '/good-news', icon: Newspaper, label: 'Good News', exact: false },
  { to: '/new-session', icon: Plus, label: 'New Session', exact: false },
  { to: '/parked-thoughts', icon: Brain, label: 'Parked Thoughts', exact: false },
  { to: '/history', icon: History, label: 'History', exact: false },
  { to: '/settings', icon: Settings, label: 'Settings', exact: false },
  { to: '/profile', icon: User, label: 'Profile', exact: false },
];

export default function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [badgeToast, setBadgeToast] = useState<string[]>([]);

  useEffect(() => {
    const unsub = ipc.onBadgesEarned((badges) => {
      setBadgeToast(badges);
      setTimeout(() => setBadgeToast([]), 6000);
    });
    return unsub;
  }, []);

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar – desktop */}
      <aside className="hidden md:flex flex-col w-60 bg-white border-r border-gray-100 shadow-sm">
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-gray-100">
          <div className="w-8 h-8 bg-gradient-to-br from-teal-700 to-teal-500 rounded-lg flex items-center justify-center shadow-sm">
            <Target className="w-4 h-4 text-white" strokeWidth={2.2} />
          </div>
          <span className="text-base font-bold text-gray-900 tracking-tight">Calm On</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(({ to, icon: Icon, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive ? 'bg-teal-50 text-teal-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-gray-100">
          <p className="text-xs text-gray-400">Calm On Desktop v1.0</p>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-gradient-to-br from-teal-700 to-teal-500 rounded-lg flex items-center justify-center">
            <Target className="w-3.5 h-3.5 text-white" strokeWidth={2.2} />
          </div>
          <span className="font-bold text-gray-900 text-sm">Calm On</span>
        </div>
        <button onClick={() => setMobileOpen(true)} className="p-1.5 text-gray-600 hover:text-gray-900">
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-72 bg-white flex flex-col h-full shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-gradient-to-br from-teal-700 to-teal-500 rounded-lg flex items-center justify-center">
                  <Target className="w-3.5 h-3.5 text-white" strokeWidth={2.2} />
                </div>
                <span className="font-bold text-gray-900">Calm On</span>
              </div>
              <button onClick={() => setMobileOpen(false)} className="p-1.5 text-gray-500 hover:text-gray-900">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-0.5">
              {navItems.map(({ to, icon: Icon, label, exact }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={exact}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${
                      isActive ? 'bg-teal-50 text-teal-700' : 'text-gray-600 hover:bg-gray-50'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </NavLink>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 md:overflow-y-auto">
        <div className="md:pt-0 pt-14">
          <Outlet />
        </div>
      </main>

      {/* Badge celebration toast */}
      {badgeToast.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2"
          style={{ animation: 'badgeToastIn 0.4s cubic-bezier(0.34,1.56,0.64,1)' }}>
          {badgeToast.map((badge) => {
            const meta = BADGE_META[badge] ?? { icon: Star, gradient: 'from-gray-400 to-gray-500', desc: '' };
            const Icon = meta.icon;
            return (
              <div key={badge} className="flex items-center gap-3 bg-white rounded-2xl shadow-2xl border border-gray-100 px-4 py-3 min-w-64">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${meta.gradient} flex items-center justify-center flex-shrink-0 shadow-md`}>
                  <Icon className="w-5 h-5 text-white" strokeWidth={2.2} />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">{badge}</p>
                  <p className="text-xs text-gray-500">{meta.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <style>{`
        @keyframes badgeToastIn {
          0%   { transform: translateY(24px) scale(0.9); opacity: 0; }
          60%  { transform: translateY(-4px) scale(1.02); opacity: 1; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
