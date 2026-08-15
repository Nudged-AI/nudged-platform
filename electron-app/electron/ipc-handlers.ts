import { ipcMain, screen } from 'electron';
import { execSync, execFileSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

function runAppleScript(script: string, timeoutMs = 3000): string {
  const tmpFile = join(tmpdir(), `ro_dbg_${Date.now()}.scpt`);
  try {
    writeFileSync(tmpFile, script, 'utf8');
    return execFileSync('osascript', [tmpFile], { timeout: timeoutMs, stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();
  } finally {
    try { unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}
import { getLocalUser } from './local-user';
import {
  insertThought, updateThought, deleteThought, bulkUpdateThoughtTheme,
  listThoughts, listSessions, getSessionById, countPendingThoughts,
  getSetting, setSetting,
} from './db-queries';
import {
  startSession, endSession, getActiveSessionState,
  handleSnooze, handleUserReturned, handleAddApp, extendSession,
  type AllowedApp,
} from './session-engine';
import { getCurrentWindow, getAllChromeTabUrls, activateChromeTabByUrl } from './window-tracker';
import { setOverlayPosition as setWinOverlayPosition } from './windows';

export function registerIpcHandlers(): void {

  ipcMain.handle('user:get', () => {
    const user = getLocalUser();
    return { id: user.id };
  });

  ipcMain.handle('session:start', async (_e, payload: {
    goal: string;
    end_minutes: number;
    allowed_apps: AllowedApp[];
    tolerance_seconds: number;
  }) => {
    if (getActiveSessionState()) {
      return { error: 'A session is already running. End it before starting a new one.' };
    }
    const session = await startSession({
      id: '',
      goal: payload.goal,
      end_minutes: payload.end_minutes,
      allowed_apps: payload.allowed_apps,
      tolerance_seconds: payload.tolerance_seconds,
      status: 'active',
      last_active_app: '',
      started_at: new Date().toISOString(),
      returns_raised: 0,
      returns_made: 0,
    });
    return { id: session.id };
  });

  ipcMain.handle('session:extend', async (_e, payload: { extra_minutes: number }) => {
    await extendSession(payload.extra_minutes);
    return { ok: true };
  });

  ipcMain.handle('session:end', async (_e, payload: { status: 'completed' | 'abandoned'; goalAchieved?: boolean | null }) => {
    await endSession(payload.status, payload.goalAchieved ?? null);
    return { ok: true };
  });

  ipcMain.handle('session:get-active', () => {
    return getActiveSessionState();
  });

  ipcMain.handle('db:sessions:list', async (_e, args?: { limit?: number }) => {
    const user = getLocalUser();
    const rows = await listSessions(user.id, args?.limit ?? 50);
    return rows.map((r) => ({ ...r, allowed_apps: safeParseApps(r.allowed_apps) }));
  });

  ipcMain.handle('db:sessions:get', async (_e, args: { id: string }) => {
    const row = await getSessionById(args.id);
    if (!row) return null;
    return { ...row, allowed_apps: safeParseApps(row.allowed_apps) };
  });

  ipcMain.handle('db:thoughts:list', async () => {
    const user = getLocalUser();
    return listThoughts(user.id);
  });

  ipcMain.handle('db:thoughts:count-pending', async () => {
    const user = getLocalUser();
    return countPendingThoughts(user.id);
  });

  ipcMain.handle('db:thoughts:update', async (_e, args: { id: string; updates: Record<string, unknown> }) => {
    await updateThought(args.id, {
      ...(args.updates.status !== undefined && { status: args.updates.status as string }),
      ...(args.updates.theme !== undefined && { theme: args.updates.theme as string | null }),
      reviewed_at: new Date().toISOString(),
    });
    return { ok: true };
  });

  ipcMain.handle('db:thoughts:delete', async (_e, args: { id: string }) => {
    await deleteThought(args.id);
    return { ok: true };
  });

  ipcMain.handle('db:thoughts:bulk-theme', async (_e, args: { ids: string[]; theme: string }) => {
    await bulkUpdateThoughtTheme(args.ids, args.theme);
    return { ok: true };
  });

  ipcMain.handle('overlay:snooze', (_e, seconds: number) => {
    handleSnooze(typeof seconds === 'number' && seconds > 0 ? seconds : 60);
    return { ok: true };
  });

  ipcMain.handle('overlay:user-returned', () => {
    handleUserReturned();
    return { ok: true };
  });

  ipcMain.handle('overlay:add-app', async (_e, args: { appName: string; bundleId: string; url?: string }) => {
    await handleAddApp(args.appName, args.bundleId, args.url);
    return { ok: true };
  });

  ipcMain.handle('overlay:park-thought', async (_e, args: { content: string }) => {
    const user = getLocalUser();
    const session = getActiveSessionState();
    await insertThought({
      user_id: user.id,
      session_id: session?.id ?? null,
      content: args.content,
      status: 'pending',
      theme: null,
      created_at: new Date().toISOString(),
      reviewed_at: null,
    });
    return { ok: true };
  });

  ipcMain.handle('overlay:set-position', (_e, args: { x: number; y: number }) => {
    setWinOverlayPosition(args.x, args.y);
    return { ok: true };
  });

  ipcMain.handle('overlay:get-screen-size', () => {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    return { width, height };
  });

  ipcMain.handle('window:get-active', () => {
    return getCurrentWindow();
  });

  ipcMain.handle('settings:get', async () => {
    const [idleExemptApps, defaultTolerance, defaultSessionDuration] = await Promise.all([
      getSetting('idle_exempt_apps', '[]'),
      getSetting('default_tolerance', '20'),
      getSetting('default_session_duration', '25'),
    ]);
    return { idleExemptApps, defaultTolerance, defaultSessionDuration };
  });

  ipcMain.handle('settings:set', async (_e, partial: Record<string, string>) => {
    for (const [key, value] of Object.entries(partial)) {
      await setSetting(key, value);
    }
    return { ok: true };
  });
}

function safeParseApps(raw: string): AllowedApp[] {
  try { return JSON.parse(raw) as AllowedApp[]; } catch { return []; }
}

// ---------------------------------------------------------------------------
// Debug: Chrome automation diagnostics
// ---------------------------------------------------------------------------

interface DebugStep {
  label: string;
  ok: boolean;
  detail: string;
}

ipcMain.handle('debug:chrome-test', (): DebugStep[] => {
  const steps: DebugStep[] = [];

  // Step 1: Can we read the frontmost app via System Events?
  try {
    const frontApp = runAppleScript(`tell application "System Events" to get name of first application process whose frontmost is true`);
    steps.push({ label: 'System Events (frontmost app)', ok: true, detail: frontApp });
  } catch (e) {
    steps.push({ label: 'System Events (frontmost app)', ok: false, detail: String(e) });
  }

  // Step 2: Is Chrome running?
  try {
    const running = runAppleScript(`tell application "System Events" to (name of processes) contains "Google Chrome"`);
    const isRunning = running === 'true';
    steps.push({ label: 'Google Chrome is running', ok: isRunning, detail: isRunning ? 'yes' : 'Chrome is not open' });
    if (!isRunning) return steps;
  } catch (e) {
    steps.push({ label: 'Google Chrome is running', ok: false, detail: String(e) });
    return steps;
  }

  // Step 3: Can we get Chrome's name (Automation permission check)?
  try {
    const name = runAppleScript(`tell application "Google Chrome" to get name`);
    steps.push({ label: 'Automation permission for Chrome', ok: true, detail: name });
  } catch (e) {
    steps.push({
      label: 'Automation permission for Chrome',
      ok: false,
      detail: `FAILED — go to System Settings → Privacy & Security → Automation and enable Google Chrome under Return On. Error: ${String(e)}`,
    });
    return steps;
  }

  // Step 4: Can we read the front tab URL?
  try {
    const url = runAppleScript(`tell application "Google Chrome" to get URL of active tab of front window`);
    steps.push({ label: 'Read front tab URL', ok: true, detail: url });
  } catch (e) {
    steps.push({ label: 'Read front tab URL', ok: false, detail: String(e) });
  }

  // Step 5: Can we enumerate all tabs?
  try {
    const tabs = getAllChromeTabUrls();
    steps.push({
      label: `Enumerate all Chrome tabs (${tabs.length} found)`,
      ok: tabs.length >= 0,
      detail: tabs.length > 0 ? tabs.slice(0, 5).join('\n') + (tabs.length > 5 ? `\n…and ${tabs.length - 5} more` : '') : '(no tabs open)',
    });
  } catch (e) {
    steps.push({ label: 'Enumerate all Chrome tabs', ok: false, detail: String(e) });
  }

  // Step 6: Can we activate a tab by URL?
  try {
    const frontUrl = runAppleScript(`tell application "Google Chrome" to get URL of active tab of front window`);
    if (frontUrl) {
      const domain = (() => { try { return new URL(frontUrl).hostname; } catch { return frontUrl; } })();
      const activated = activateChromeTabByUrl(domain);
      steps.push({ label: 'Activate tab by URL pattern', ok: activated, detail: activated ? `activated tab matching "${domain}"` : 'activateChromeTabByUrl returned false' });
    } else {
      steps.push({ label: 'Activate tab by URL pattern', ok: false, detail: 'no front tab URL available' });
    }
  } catch (e) {
    steps.push({ label: 'Activate tab by URL pattern', ok: false, detail: String(e) });
  }

  return steps;
});
