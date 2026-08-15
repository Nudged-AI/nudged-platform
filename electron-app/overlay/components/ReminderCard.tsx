import React, { useEffect, useState } from 'react';
import { RotateCcw, Clock, Plus, ChevronDown } from 'lucide-react';

interface Props {
  reminder: { goal: string; currentApp: string; deviationSeconds: number } | null;
  isIdle: boolean;
  idleOnAllowedApp?: boolean;
  currentApp: string;
  onReturn: () => void;
  onSnooze: (seconds: number) => void;
  onAddApp: (appName: string, bundleId: string, url?: string) => void;
}

export default function ReminderCard({ reminder, isIdle, idleOnAllowedApp, onReturn, onSnooze, onAddApp }: Props) {
  const [activeApp, setActiveApp] = useState<{ appName: string; bundleId: string; url?: string } | null>(null);
  const [animKey, setAnimKey] = useState(0);
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false);

  useEffect(() => {
    setAnimKey((k) => k + 1);
    setShowSnoozeMenu(false);
    window.overlayAPI.getActiveWindow().then((info: unknown) => {
      const w = info as { appName: string; bundleId: string; url?: string } | null;
      if (w) setActiveApp(w);
    });
  }, [reminder, isIdle]);

  const isInChrome = activeApp?.bundleId === 'com.google.Chrome' || activeApp?.appName === 'Google Chrome';
  const chromeUrl = isInChrome ? activeApp?.url : undefined;
  const chromeDomain = chromeUrl
    ? (() => { try { return new URL(chromeUrl).hostname.replace(/^www\./, ''); } catch { return chromeUrl; } })()
    : null;

  const handleSnooze = (secs: number) => {
    setShowSnoozeMenu(false);
    onSnooze(secs);
  };

  return (
    <div key={animKey} className="flex items-end justify-end w-full h-full pr-3 pb-3">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden w-72"
        style={{ animation: 'slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 pt-3 pb-2 bg-gradient-to-r from-teal-700 to-teal-500">
          <div className="w-6 h-6 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <RotateCcw className="w-3 h-3 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-white text-xs font-bold uppercase tracking-wider">Return On</span>
          {reminder && (
            <span className="ml-auto text-white/70 text-[10px] flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {reminder.deviationSeconds}s away
            </span>
          )}
        </div>

        {/* Message */}
        <div className="px-4 py-3">
          <p className="text-sm text-gray-700 leading-snug">
            {isIdle
              ? <><span className="font-semibold">You seem idle</span> — still working on your session?</>
              : <><span className="font-semibold">Hey, stay focused!</span> You drifted to <span className="font-semibold text-orange-600">{reminder?.currentApp}</span>. Get back to your session.</>
            }
          </p>
          {reminder && (
            <p className="text-[11px] text-gray-400 mt-1 truncate" title={reminder.goal}>
              Goal: {reminder.goal}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="px-3 pb-3 space-y-2">
          <div className="flex gap-2">
            <button
              onClick={onReturn}
              className="flex-1 bg-gradient-to-r from-teal-700 to-teal-500 text-white text-sm font-semibold py-2 rounded-xl hover:opacity-90 transition-opacity shadow-sm"
            >
              Return
            </button>

            {/* Snooze button with dropdown */}
            <div className="relative">
              <div className="flex rounded-xl overflow-hidden border border-orange-200">
                <button
                  onClick={() => handleSnooze(60)}
                  className="bg-orange-50 text-orange-700 text-sm font-medium px-3 py-2 hover:bg-orange-100 transition-colors whitespace-nowrap"
                >
                  Snooze 60s
                </button>
                <button
                  onClick={() => setShowSnoozeMenu((v) => !v)}
                  className="bg-orange-50 text-orange-700 px-1.5 py-2 hover:bg-orange-100 transition-colors border-l border-orange-200"
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>
              {showSnoozeMenu && (
                <div className="absolute bottom-full right-0 mb-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-10 min-w-[120px]">
                  {[60, 90, 120].map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSnooze(s)}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-700 transition-colors"
                    >
                      Snooze {s}s
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Allow current Chrome site */}
          {!isIdle && !idleOnAllowedApp && isInChrome && chromeDomain && (
            <button
              onClick={() => onAddApp('com.google.Chrome', 'com.google.Chrome', chromeDomain)}
              className="w-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium py-2 px-3 rounded-xl hover:bg-blue-100 transition-colors flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3 h-3" />
              Allow &quot;{chromeDomain}&quot; for this session
            </button>
          )}

          {/* Allow current native app (not Chrome) */}
          {!isIdle && !idleOnAllowedApp && activeApp && !isInChrome && (
            <button
              onClick={() => onAddApp(activeApp.appName, activeApp.bundleId)}
              className="w-full bg-green-50 border border-green-200 text-green-700 text-xs font-medium py-2 px-3 rounded-xl hover:bg-green-100 transition-colors flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3 h-3" />
              Allow &quot;{activeApp.appName}&quot; for this session
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(16px) scale(0.95); opacity: 0; }
          to   { transform: translateY(0) scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
