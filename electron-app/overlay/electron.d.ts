export {};

declare global {
  interface Window {
    overlayAPI: {
      snooze: (seconds: number) => Promise<{ ok: boolean }>;
      addApp: (args: { appName: string; bundleId: string; url?: string }) => Promise<{ ok: boolean }>;
      parkThought: (args: { content: string }) => Promise<{ ok: boolean }>;
      userReturned: () => Promise<{ ok: boolean }>;
      setPosition: (args: { x: number; y: number }) => Promise<{ ok: boolean }>;
      getActiveWindow: () => Promise<{ appName: string; bundleId: string; url?: string } | null>;
      sessionStart: (payload: { goal: string; end_minutes: number; allowed_apps: unknown[]; tolerance_seconds: number }) => Promise<{ id: string }>;
      sessionExtend: (payload: { extra_minutes: number }) => Promise<{ ok: boolean }>;
      sessionEnd: (payload: { status: string; goalAchieved?: boolean | null }) => Promise<{ ok: boolean }>;
      settingsGet: () => Promise<Record<string, string>>;
      settingsSet: (partial: Record<string, string>) => Promise<{ ok: boolean }>;
      dbSessionsList: (args: { limit?: number }) => Promise<unknown[]>;
      getScreenSize: () => Promise<{ width: number; height: number }>;
      onShowReminder: (cb: (data: unknown) => void) => () => void;
      onHideReminder: (cb: () => void) => () => void;
      onShowIdle: (cb: (data: unknown) => void) => () => void;
      onSessionStarted: (cb: (session: unknown) => void) => () => void;
      onSessionEnded: (cb: () => void) => () => void;
      onTimerTick: (cb: (data: unknown) => void) => () => void;
      onMessage: (cb: (data: unknown) => void) => () => void;
      onSessionExtended: (cb: (data: unknown) => void) => () => void;
      onSessionTimeUp: (cb: () => void) => () => void;
      onBadgesEarned: (cb: (badges: string[]) => void) => () => void;
    };
    electronAPI: {
      getUser: () => Promise<{ id: string }>;
      sessionStart: (payload: unknown) => Promise<{ id: string }>;
      sessionEnd: (payload: unknown) => Promise<{ ok: boolean }>;
      sessionExtend: (payload: unknown) => Promise<{ ok: boolean }>;
      sessionGetActive: () => Promise<unknown>;
      dbSessionsList: (args: unknown) => Promise<unknown[]>;
      dbSessionsGet: (args: unknown) => Promise<unknown>;
      dbThoughtsList: (args: unknown) => Promise<unknown[]>;
      dbThoughtsUpdate: (args: unknown) => Promise<{ ok: boolean }>;
      dbThoughtsDelete: (args: unknown) => Promise<{ ok: boolean }>;
      dbThoughtsBulkTheme: (args: unknown) => Promise<{ ok: boolean }>;
      settingsGet: () => Promise<Record<string, string>>;
      settingsSet: (partial: unknown) => Promise<{ ok: boolean }>;
      windowGetActive: () => Promise<unknown>;
      onSessionChanged: (cb: (session: unknown) => void) => () => void;
      onSessionTimeUp: (cb: () => void) => () => void;
    };
    debugAPI: {
      chromeTest: () => Promise<unknown[]>;
    };
  }
}
