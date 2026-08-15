import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Brain, Newspaper, BookOpen, Sparkles } from 'lucide-react';
import { supabase } from '../supabase';

interface Props {
  userId: string;
  hasVisions: boolean;
}

const TILES = [
  {
    id: 'ritual',
    label: 'My Ritual',
    sub: '5-min personalised ritual',
    icon: Sparkles,
    color: 'from-violet-50 to-purple-50',
    iconBg: 'bg-violet-100',
    iconColor: 'text-violet-500',
    disabled: false,
  },
  {
    id: 'vision',
    label: 'Vision Board',
    sub: 'View & track your visions',
    icon: Eye,
    color: 'from-teal-50 to-emerald-50',
    iconBg: 'bg-teal-100',
    iconColor: 'text-teal-600',
    disabled: false,
  },
  {
    id: 'harry',
    label: 'Wise Harry',
    sub: 'Chat with your mentor',
    icon: null,
    color: 'from-sky-50 to-cyan-50',
    iconBg: 'bg-sky-100',
    iconColor: 'text-sky-600',
    disabled: false,
  },
  {
    id: 'diary',
    label: 'My Diary',
    sub: 'Write & reflect',
    icon: BookOpen,
    color: 'from-amber-50 to-yellow-50',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    disabled: false,
  },
  {
    id: 'news',
    label: 'Good News',
    sub: 'Positive news for you',
    icon: Newspaper,
    color: 'from-green-50 to-emerald-50',
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
    disabled: false,
  },
  {
    id: 'park',
    label: 'Park Thoughts',
    sub: 'Capture ideas & insights',
    icon: Brain,
    color: 'from-orange-50 to-amber-50',
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-500',
    disabled: false,
  },
];

export default function LandingPage({ userId, hasVisions }: Props) {
  const navigate = useNavigate();
  const [visionCount, setVisionCount] = useState(hasVisions ? 1 : 0);

  useEffect(() => {
    supabase
      .from('visions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'active')
      .then(({ count }) => setVisionCount(count ?? 0));
  }, [userId]);

  const handleTile = (id: string) => {
    if (id === 'ritual') { navigate('/ritual'); return; }
    if (id === 'vision') { navigate('/vision-board'); return; }
    if (id === 'harry') {
      window.dispatchEvent(new CustomEvent('open-wise-harry'));
      return;
    }
    if (id === 'diary') { navigate('/parked-thoughts?tab=diary'); return; }
    if (id === 'news') { navigate('/good-news'); return; }
    if (id === 'park') { navigate('/parked-thoughts'); return; }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-emerald-50 flex flex-col items-center justify-center px-5 py-12 relative overflow-hidden">
      {/* Decorative circles */}
      <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-teal-100/30 translate-x-1/3 -translate-y-1/3 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-56 h-56 rounded-full bg-emerald-100/40 -translate-x-1/3 translate-y-1/3 pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="w-14 h-14 bg-gradient-to-br from-teal-700 to-teal-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-teal-200">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 5a3 3 0 110 6 3 3 0 010-6zm0 13a7.96 7.96 0 01-5.5-2.19C6.83 15.88 9.28 15 12 15s5.17.88 5.5 1.81A7.96 7.96 0 0112 20z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">What would you like to do?</h1>
          <p className="text-sm text-gray-500 mt-1.5">Choose your focus for today</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {TILES.map((tile) => {
            const isDisabled = tile.disabled || (tile.id === 'park' && visionCount === 0);
            const Icon = tile.icon;
            return (
              <button
                key={tile.id}
                onClick={() => !isDisabled && handleTile(tile.id)}
                disabled={isDisabled}
                className={`relative flex flex-col items-start gap-2.5 bg-gradient-to-br ${tile.color} border border-white/80 rounded-2xl px-4 py-4 shadow-sm text-left transition-all duration-200 ${
                  isDisabled
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:shadow-md hover:scale-[1.02] active:scale-[0.98] cursor-pointer'
                }`}
              >
                {isDisabled && (
                  <span className="absolute top-2.5 right-2.5 text-gray-400">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                  </span>
                )}

                {tile.id === 'harry' ? (
                  <div className={`w-10 h-10 rounded-xl ${tile.iconBg} flex items-center justify-center flex-shrink-0 overflow-hidden`}>
                    <img
                      src="/image.png"
                      alt="Harry"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                ) : Icon ? (
                  <div className={`w-10 h-10 rounded-xl ${tile.iconBg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-5 h-5 ${tile.iconColor}`} />
                  </div>
                ) : null}

                <div>
                  <p className="text-sm font-bold text-gray-900 leading-tight">{tile.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-snug">{tile.sub}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
