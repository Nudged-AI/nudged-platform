import React, { useEffect, useState } from 'react';
import FloatingWidget, { type Corner } from './components/FloatingWidget';
import ReminderCard from './components/ReminderCard';

const OVERLAY_W = 340;
const OVERLAY_H = 480;
const MARGIN = 12;

function computePosition(corner: Corner, sw: number, sh: number): { x: number; y: number } {
  switch (corner) {
    case 'bottom-right': return { x: sw - OVERLAY_W - MARGIN, y: sh - OVERLAY_H - MARGIN };
    case 'bottom-left':  return { x: MARGIN, y: sh - OVERLAY_H - MARGIN };
    case 'top-right':    return { x: sw - OVERLAY_W - MARGIN, y: MARGIN };
    case 'top-left':     return { x: MARGIN, y: MARGIN };
  }
}

interface SessionInfo {
  id: string;
  goal: string;
  started_at: string;
  end_minutes: number;
}

interface ReminderData {
  goal: string;
  currentApp: string;
  deviationSeconds: number;
}

interface Message {
  id: number;
  text: string;
  type: 'info' | 'warn' | 'success';
}

export default function OverlayApp() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [reminder, setReminder] = useState<ReminderData | null>(null);
  const [showIdle, setShowIdle] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [parkedCount, setParkedCount] = useState(0);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isMinimised, setIsMinimised] = useState(false);
  const [idleOnAllowed, setIdleOnAllowed] = useState(false);
  const [defaultExtendMinutes, setDefaultExtendMinutes] = useState(25);
  const [lastSessionApps, setLastSessionApps] = useState<unknown[]>([]);
  const [lastSessionTolerance, setLastSessionTolerance] = useState(20);
  const [currentCorner, setCurrentCorner] = useState<Corner>('bottom-right');
  const [screenSize, setScreenSize] = useState({ width: 1440, height: 900 });
  const [sessionTimeUp, setSessionTimeUp] = useState(false);
  const [earnedBadges, setEarnedBadges] = useState<string[]>([]);

  useEffect(() => {
    if (!window.overlayAPI) return;
    Promise.all([
      window.overlayAPI.settingsGet(),
      window.overlayAPI.dbSessionsList({ limit: 1 }),
      window.overlayAPI.getScreenSize(),
    ]).then(([settings, sessions, size]) => {
      const dur = parseInt(settings.defaultSessionDuration ?? '25');
      if (!isNaN(dur) && dur > 0) setDefaultExtendMinutes(dur);
      const lastSession = (sessions as Array<{ allowed_apps?: unknown[]; tolerance_seconds?: number }>)[0];
      if (lastSession?.allowed_apps && lastSession.allowed_apps.length > 0) {
        setLastSessionApps(lastSession.allowed_apps);
      }
      if (lastSession?.tolerance_seconds) {
        setLastSessionTolerance(lastSession.tolerance_seconds);
      }
      setScreenSize(size);
      const savedCorner = (settings.widgetCorner ?? 'bottom-right') as Corner;
      setCurrentCorner(savedCorner);
    }).catch(() => {});
  }, []);

  const addMessage = (text: string, type: Message['type'] = 'info') => {
    setMessages((prev) => [{ id: Date.now(), text, type }, ...prev].slice(0, 20));
  };

  useEffect(() => {
    if (!window.overlayAPI) return;

    const unsubs = [
      window.overlayAPI.onSessionStarted((s: unknown) => {
        const sess = s as SessionInfo;
        setSession(sess);
        setReminder(null);
        setShowIdle(false);
        setMessages([]);
        setIsMinimised(false);
        setSessionTimeUp(false);
        setParkedCount(0);
        const start = new Date(sess.started_at).getTime();
        setRemainingSeconds(Math.max(0, Math.floor((start + sess.end_minutes * 60 * 1000 - Date.now()) / 1000)));
        addMessage(`Session started: "${sess.goal}"`, 'success');
      }),

      window.overlayAPI.onSessionEnded(() => {
        setSession(null);
        setReminder(null);
        setShowIdle(false);
        setIsPanelOpen(false);
        setIsMinimised(false);
        setSessionTimeUp(false);
        // Refresh last session data so next quick-start inherits apps
        window.overlayAPI.dbSessionsList({ limit: 1 }).then((sessions) => {
          const last = (sessions as Array<{ allowed_apps?: unknown[]; tolerance_seconds?: number }>)[0];
          if (last?.allowed_apps && last.allowed_apps.length > 0) setLastSessionApps(last.allowed_apps);
          if (last?.tolerance_seconds) setLastSessionTolerance(last.tolerance_seconds);
        }).catch(() => {});
      }),

      window.overlayAPI.onShowReminder((data: unknown) => {
        setReminder(data as ReminderData);
        setShowIdle(false);
        addMessage('Gentle reminder — check your focus!', 'warn');
      }),

      window.overlayAPI.onHideReminder(() => {
        setReminder(null);
        setShowIdle(false);
        setIdleOnAllowed(false);
      }),

      window.overlayAPI.onShowIdle((data: unknown) => {
        const d = data as { onAllowedApp?: boolean } | null;
        setIdleOnAllowed(d?.onAllowedApp ?? false);
        setShowIdle(true);
        addMessage('You seem idle — still working?', 'warn');
      }),

      window.overlayAPI.onTimerTick((data: unknown) => {
        const d = data as { remainingSeconds: number };
        setRemainingSeconds(d.remainingSeconds);
      }),

      window.overlayAPI.onMessage((data: unknown) => {
        const d = data as { text: string; type: Message['type'] };
        addMessage(d.text, d.type);
      }),

      window.overlayAPI.onSessionExtended((data: unknown) => {
        const d = data as { end_minutes: number };
        setSession((prev) => prev ? { ...prev, end_minutes: d.end_minutes } : prev);
      }),

      window.overlayAPI.onSessionTimeUp(() => {
        setSessionTimeUp(true);
      }),

      window.overlayAPI.onBadgesEarned((badges: string[]) => {
        setEarnedBadges(badges);
        setTimeout(() => setEarnedBadges([]), 6000);
      }),
    ];

    return () => unsubs.forEach((u) => u?.());
  }, []);

  const showReminder = reminder !== null || showIdle;

  const handleMoveToCorner = async (corner: Corner) => {
    const pos = computePosition(corner, screenSize.width, screenSize.height);
    await window.overlayAPI.setPosition({ x: pos.x, y: pos.y });
    await window.overlayAPI.settingsSet({ widgetCorner: corner });
    setCurrentCorner(corner);
  };

  if (!session) {
    return (
      <FloatingWidget
        session={null}
        remainingSeconds={0}
        messages={[]}
        parkedCount={0}
        isPanelOpen={false}
        isMinimised={false}
        onTogglePanel={() => {}}
        onMinimise={() => {}}
        onExpand={() => {}}
        onParkThought={async (content: string) => {
          const res = await window.overlayAPI.parkThought({ content });
          return res?.ok ?? false;
        }}
        onStartSession={async (goal, minutes) => {
          const apps = lastSessionApps.length > 0 ? lastSessionApps : [];
          const tol = lastSessionTolerance > 0 ? lastSessionTolerance : 20;
          await window.overlayAPI.sessionStart({ goal, end_minutes: minutes, allowed_apps: apps, tolerance_seconds: tol });
        }}
        currentCorner={currentCorner}
        onMoveToCorner={handleMoveToCorner}
        earnedBadges={earnedBadges}
        onDismissBadges={() => setEarnedBadges([])}
      />
    );
  }

  return (
    <div className="w-full h-full relative">
      {showReminder ? (
        <ReminderCard
          reminder={reminder}
          isIdle={showIdle && !reminder}
          idleOnAllowedApp={idleOnAllowed}
          currentApp={reminder?.currentApp ?? ''}
          onReturn={() => {
            window.overlayAPI.userReturned();
            setReminder(null);
            setShowIdle(false);
          }}
          onSnooze={(seconds: number) => {
            window.overlayAPI.snooze(seconds);
            setReminder(null);
            setShowIdle(false);
            addMessage(`Snoozed for ${seconds}s`, 'warn');
          }}
          onAddApp={async (appName: string, bundleId: string, url?: string) => {
            await window.overlayAPI.addApp({ appName, bundleId, url });
            setReminder(null);
            addMessage(`Added "${url ?? appName}" to allowed apps`, 'success');
          }}
        />
      ) : (
        <FloatingWidget
          session={session}
          remainingSeconds={remainingSeconds}
          messages={messages}
          parkedCount={parkedCount}
          isPanelOpen={isPanelOpen}
          isMinimised={isMinimised}
          sessionTimeUp={sessionTimeUp}
          onTogglePanel={() => setIsPanelOpen((v) => !v)}
          onMinimise={() => setIsMinimised(true)}
          onExpand={() => setIsMinimised(false)}
          onParkThought={async (content: string) => {
            const res = await window.overlayAPI.parkThought({ content });
            if (res?.ok) { setParkedCount((c) => c + 1); addMessage('Thought parked', 'success'); }
            return res?.ok ?? false;
          }}
          onExtendSession={async (minutes: number) => {
            setSessionTimeUp(false);
            await window.overlayAPI.sessionExtend({ extra_minutes: minutes });
            addMessage(`Session extended by ${minutes}m`, 'success');
          }}
          onFinishSession={async (achieved: boolean | null) => {
            await window.overlayAPI.sessionEnd({ status: 'completed', goalAchieved: achieved });
            setSessionTimeUp(false);
          }}
          defaultExtendMinutes={defaultExtendMinutes}
          currentCorner={currentCorner}
          onMoveToCorner={handleMoveToCorner}
          earnedBadges={earnedBadges}
          onDismissBadges={() => setEarnedBadges([])}
        />
      )}
    </div>
  );
}
