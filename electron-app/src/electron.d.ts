export {};

declare global {
  interface Window {
    electronAPI: {
      getUser: () => Promise<{ id: string }>;
      sessionStart: (payload: unknown) => Promise<{ id: string }>;
      sessionEnd: (payload: unknown) => Promise<{ ok: boolean }>;
      sessionExtend: (payload: unknown) => Promise<{ ok: boolean }>;
      sessionGetActive: () => Promise<unknown>;
      dbSessionsList: (args?: unknown) => Promise<unknown[]>;
      dbSessionsGet: (args: unknown) => Promise<unknown>;
      dbThoughtsList: (args?: unknown) => Promise<unknown[]>;
      dbThoughtsUpdate: (args: unknown) => Promise<{ ok: boolean }>;
      dbThoughtsDelete: (args: unknown) => Promise<{ ok: boolean }>;
      dbThoughtsBulkTheme: (args: unknown) => Promise<{ ok: boolean }>;
      settingsGet: () => Promise<Record<string, string>>;
      settingsSet: (partial: unknown) => Promise<{ ok: boolean }>;
      windowGetActive: () => Promise<unknown>;
      onSessionChanged: (cb: (session: unknown) => void) => () => void;
      onSessionTimeUp: (cb: () => void) => () => void;
      onBadgesEarned: (cb: (badges: string[]) => void) => () => void;
    };
    debugAPI: {
      chromeTest: () => Promise<unknown[]>;
    };
  }
}
