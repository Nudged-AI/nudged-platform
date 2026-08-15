// Typed wrappers around window.electronAPI

export interface AllowedApp {
  appName: string;
  bundleId?: string;
  url?: string;
}

export interface SessionRow {
  id: string;
  user_id: string;
  goal: string;
  end_minutes: number;
  allowed_apps: AllowedApp[];
  tolerance_seconds: number;
  status: string;
  last_active_app: string;
  started_at: string;
  ended_at?: string | null;
  returns_raised?: number;
  returns_made?: number;
  goal_achieved?: number | null;
  focused_seconds?: number | null;
}

export interface ThoughtRow {
  id: string;
  user_id: string;
  session_id: string | null;
  content: string;
  status: 'pending' | 'accepted' | 'rejected';
  theme: string | null;
  created_at: string;
  reviewed_at: string | null;
}

const api = () => window.electronAPI;

export const ipc = {
  getUser: () => api().getUser(),

  sessionStart: (payload: { goal: string; end_minutes: number; allowed_apps: AllowedApp[]; tolerance_seconds: number }) =>
    api().sessionStart(payload) as Promise<{ id: string }>,

  sessionEnd: (status: 'completed' | 'abandoned', goalAchieved?: boolean | null) =>
    api().sessionEnd({ status, goalAchieved }) as Promise<{ ok: boolean }>,

  sessionExtend: (extraMinutes: number) =>
    api().sessionExtend({ extra_minutes: extraMinutes }) as Promise<{ ok: boolean }>,

  sessionGetActive: () =>
    api().sessionGetActive() as Promise<SessionRow | null>,

  dbSessionsList: (args?: { limit?: number }) =>
    api().dbSessionsList(args) as Promise<SessionRow[]>,

  dbSessionsGet: (id: string) =>
    api().dbSessionsGet({ id }) as Promise<SessionRow | null>,

  dbThoughtsList: () =>
    api().dbThoughtsList() as Promise<ThoughtRow[]>,

  dbThoughtsUpdate: (id: string, updates: Partial<Pick<ThoughtRow, 'status' | 'theme'>>) =>
    api().dbThoughtsUpdate({ id, updates }) as Promise<{ ok: boolean }>,

  dbThoughtsDelete: (id: string) =>
    api().dbThoughtsDelete({ id }) as Promise<{ ok: boolean }>,

  dbThoughtsBulkTheme: (ids: string[], theme: string) =>
    api().dbThoughtsBulkTheme({ ids, theme }) as Promise<{ ok: boolean }>,

  settingsGet: () => api().settingsGet(),

  settingsSet: (partial: Record<string, string>) =>
    api().settingsSet(partial) as Promise<{ ok: boolean }>,

  onSessionChanged: (cb: (session: SessionRow | null) => void) =>
    api().onSessionChanged((s) => cb(s as SessionRow | null)),

  onSessionTimeUp: (cb: () => void) =>
    api().onSessionTimeUp(cb),

  onBadgesEarned: (cb: (badges: string[]) => void) =>
    api().onBadgesEarned(cb),
};
