import { sendToOverlay, sendToMain, showOverlay, hideOverlay } from './windows';
import { updateSession, getActiveSession, insertSession } from './db-queries';
import {
  startWindowTracking, stopWindowTracking, getCurrentWindow,
  isChrome, activateApp, activateChromeTabByUrl, openUrlInChrome,
  getAllChromeTabUrls, isIdleExempt,
  type ActiveWindowInfo,
} from './window-tracker';
import { startIdleDetection, stopIdleDetection } from './idle-detector';
import { getLocalUser } from './local-user';

export interface AllowedApp {
  appName: string;
  bundleId?: string;
  url?: string;
}

export interface ActiveSession {
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
  returns_raised: number;
  returns_made: number;
}

interface DeviationState {
  appName: string;
  bundleId: string;
  startedAt: number;
  timerHandle?: ReturnType<typeof setTimeout>;
  reminded: boolean;
}

let activeSession: ActiveSession | null = null;
let deviationState: DeviationState | null = null;
let sessionExpiryHandle: ReturnType<typeof setTimeout> | null = null;
let timerTickHandle: ReturnType<typeof setInterval> | null = null;

// Last Chrome tab URL the user was on that was permitted (for Return scenario 1)
let lastAllowedChromeUrl: string | null = null;

// Timestamp of last confirmed activity in a native allowed app (Slack, Teams, etc.)
// Used for idle scenario 4: if there was recent activity in an allowed native app,
// suppress the idle reminder.
let lastNativeAllowedActivityAt = 0;

// Focus clock: tracks seconds spent on permissible apps
let focusedSeconds = 0;
let focusSegmentStart: number | null = null; // ms timestamp when current allowed segment began

export function getActiveSessionState(): ActiveSession | null {
  return activeSession;
}

/** Commit elapsed time of current focus segment. toleranceSec caps idle bleed. */
function commitFocusSegment(toleranceSec: number): void {
  if (focusSegmentStart === null) return;
  const elapsed = Math.floor((Date.now() - focusSegmentStart) / 1000);
  focusedSeconds += Math.min(elapsed, toleranceSec);
  focusSegmentStart = null;
}

function resetFocusClock(): void {
  focusedSeconds = 0;
  focusSegmentStart = null;
}

export async function startSession(sessionData: Omit<ActiveSession, 'user_id'>): Promise<ActiveSession> {
  const user = getLocalUser();
  const session: ActiveSession = { ...sessionData, user_id: user.id, returns_raised: 0, returns_made: 0 };

  const row = await insertSession({
    user_id: session.user_id,
    goal: session.goal,
    end_minutes: session.end_minutes,
    allowed_apps: JSON.stringify(session.allowed_apps),
    tolerance_seconds: session.tolerance_seconds,
    status: 'active',
    last_active_app: session.last_active_app,
    started_at: session.started_at,
    ended_at: null,
    returns_raised: 0,
    returns_made: 0,
    goal_achieved: null,
    focused_seconds: 0,
  });
  session.id = row.id;
  activeSession = session;
  lastAllowedChromeUrl = null;
  lastNativeAllowedActivityAt = 0;
  resetFocusClock();

  scheduleSessionExpiry();
  startWindowTracking(onWindowChanged);
  startIdleDetection(onIdleDetected);
  showOverlay();

  setTimeout(() => {
    sendToOverlay('overlay:session-started', activeSession);
    startTimerTick();
  }, 600);

  sendToMain('app:session-changed', activeSession);
  return session;
}

export async function endSession(status: 'completed' | 'abandoned', goalAchieved: boolean | null = null): Promise<void> {
  if (!activeSession) return;

  clearDeviationTimer();
  stopWindowTracking();
  stopIdleDetection();
  clearSessionExpiry();
  stopTimerTick();

  // Commit any open focus segment before saving
  if (activeSession) commitFocusSegment(activeSession.tolerance_seconds);

  const ga = goalAchieved === null ? null : goalAchieved ? 1 : 0;
  await updateSession(activeSession.id, { status, ended_at: new Date().toISOString(), goal_achieved: ga as number | null, focused_seconds: focusedSeconds });

  // Compute badges
  const badges: string[] = [];
  if (status === 'completed') {
    if ((activeSession.returns_raised ?? 0) === 0) badges.push('Rock Focus');
    if ((activeSession.returns_raised ?? 0) > 0 &&
        (activeSession.returns_made ?? 0) / activeSession.returns_raised >= 0.9) badges.push('Quick Comeback');
    if (goalAchieved === true) badges.push('Super Session');
  }

  activeSession.status = status;
  activeSession.ended_at = new Date().toISOString();

  if (badges.length > 0) {
    sendToOverlay('overlay:badges-earned', badges);
    sendToMain('app:badges-earned', badges);
  }

  sendToOverlay('overlay:session-ended');
  sendToMain('app:session-changed', null);

  setTimeout(() => hideOverlay(), 4000);
  activeSession = null;
  deviationState = null;
  lastAllowedChromeUrl = null;
  lastNativeAllowedActivityAt = 0;
  resetFocusClock();
}

export async function restoreSessionIfActive(): Promise<void> {
  const user = getLocalUser();
  const row = await getActiveSession(user.id);
  if (!row) return;

  const started = new Date(row.started_at).getTime();
  const endMs = row.end_minutes * 60 * 1000;
  if (Date.now() >= started + endMs) {
    await updateSession(row.id, { status: 'completed', ended_at: new Date().toISOString() });
    return;
  }

  activeSession = {
    id: row.id,
    user_id: row.user_id,
    goal: row.goal,
    end_minutes: row.end_minutes,
    allowed_apps: safeParseApps(row.allowed_apps),
    tolerance_seconds: row.tolerance_seconds,
    status: row.status,
    last_active_app: row.last_active_app,
    started_at: row.started_at,
    ended_at: row.ended_at ?? undefined,
    returns_raised: row.returns_raised ?? 0,
    returns_made: row.returns_made ?? 0,
  };
  lastAllowedChromeUrl = null;
  lastNativeAllowedActivityAt = 0;
  resetFocusClock();

  scheduleSessionExpiry();
  startWindowTracking(onWindowChanged);
  startIdleDetection(onIdleDetected);
  showOverlay();

  setTimeout(() => {
    sendToOverlay('overlay:session-started', activeSession);
    startTimerTick();
  }, 800);
}

function scheduleSessionExpiry(): void {
  if (!activeSession) return;
  clearSessionExpiry();
  const started = new Date(activeSession.started_at).getTime();
  const remaining = started + activeSession.end_minutes * 60 * 1000 - Date.now();
  // Signal the renderer that time is up — it will show the goal prompt and call sessionEnd.
  // We stop tracking (window/idle) but leave status=active until renderer confirms.
  if (remaining <= 0) { onSessionTimeUp(); return; }
  sessionExpiryHandle = setTimeout(() => onSessionTimeUp(), remaining);
}

function onSessionTimeUp(): void {
  if (!activeSession) return;
  stopWindowTracking();
  stopIdleDetection();
  stopTimerTick();
  clearDeviationTimer();
  deviationState = null;
  sendToMain('app:session-time-up', { sessionId: activeSession.id });
  sendToOverlay('overlay:hide-reminder');
  sendToOverlay('overlay:session-time-up');
}

function clearSessionExpiry(): void {
  if (sessionExpiryHandle) { clearTimeout(sessionExpiryHandle); sessionExpiryHandle = null; }
}

function startTimerTick(): void {
  if (timerTickHandle) return;
  timerTickHandle = setInterval(() => {
    if (!activeSession) return;
    const started = new Date(activeSession.started_at).getTime();
    const remaining = Math.max(0, Math.floor((started + activeSession.end_minutes * 60 * 1000 - Date.now()) / 1000));
    sendToOverlay('overlay:timer-tick', { remainingSeconds: remaining });
  }, 1000);
}

function stopTimerTick(): void {
  if (timerTickHandle) { clearInterval(timerTickHandle); timerTickHandle = null; }
}

/** Returns the allowed URL patterns (browser-based sites), normalized to bare hostnames. */
function getAllowedUrls(allowedApps: AllowedApp[]): string[] {
  return allowedApps.filter((a) => a.url).map((a) => normalizeUrlPattern(a.url!));
}

/**
 * Check whether the current window is on an allowed app or site.
 *
 * Chrome is "transparent": only allowed if the active tab URL matches a declared site.
 * All other apps are checked by bundleId / appName.
 */
function isAllowedInfo(info: ActiveWindowInfo, allowedApps: AllowedApp[]): boolean {
  if (isChrome(info)) {
    if (!info.url) return false;
    const urlLower = info.url.toLowerCase();
    return allowedUrls(allowedApps).some((pattern) => urlLower.includes(pattern.toLowerCase()));
  }

  const nameLower = info.appName.toLowerCase();
  const idLower = info.bundleId.toLowerCase();
  return allowedApps.some((a) => {
    if (a.bundleId && idLower === a.bundleId.toLowerCase()) return true;
    if (a.appName && nameLower === a.appName.toLowerCase()) return true;
    return false;
  });
}

function allowedUrls(allowedApps: AllowedApp[]): string[] {
  return allowedApps
    .filter((a) => a.url)
    .map((a) => normalizeUrlPattern(a.url!));
}

/** Strip scheme, www, and trailing slash so stored URLs always match as bare hostnames. */
function normalizeUrlPattern(raw: string): string {
  return raw
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '')
    .toLowerCase();
}

function domainOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

function onWindowChanged(info: ActiveWindowInfo | null): void {
  if (!activeSession || activeSession.status !== 'active') return;
  if (!info) return;

  if (isAllowedInfo(info, activeSession.allowed_apps)) {
    // Start focus segment if not already running
    if (focusSegmentStart === null) focusSegmentStart = Date.now();

    // Track the last allowed Chrome URL separately
    if (isChrome(info) && info.url) {
      lastAllowedChromeUrl = info.url;
    }

    // Track activity in native allowed apps for idle suppression (scenario 4)
    if (!isChrome(info)) {
      lastNativeAllowedActivityAt = Date.now();
    }

    const label = isChrome(info) && info.url ? domainOf(info.url) : info.appName;
    activeSession.last_active_app = label;
    void updateSession(activeSession.id, { last_active_app: label });

    if (deviationState) {
      clearDeviationTimer();
      deviationState = null;
      sendToOverlay('overlay:hide-reminder');
      sendToOverlay('overlay:message', { text: 'Back on track!', type: 'success' });
    }
  } else {
    // Leaving allowed app — commit focus segment
    commitFocusSegment(activeSession.tolerance_seconds);

    clearDeviationTimer();
    deviationState = null;
    const displayName = isChrome(info) && info.url ? domainOf(info.url) : info.appName;
    startDeviationTracking(displayName, info.bundleId);
  }
}

function startDeviationTracking(appName: string, bundleId: string): void {
  if (!activeSession) return;
  deviationState = { appName, bundleId, startedAt: Date.now(), reminded: false };
  scheduleReminder(activeSession.tolerance_seconds * 1000);
}

function scheduleReminder(delayMs: number): void {
  if (!deviationState || !activeSession) return;

  if (deviationState.timerHandle) {
    clearTimeout(deviationState.timerHandle);
    deviationState.timerHandle = undefined;
  }

  deviationState.timerHandle = setTimeout(() => {
    if (!deviationState || !activeSession) return;
    deviationState.reminded = true;
    // Count each reminder shown as a "return raised"
    activeSession.returns_raised = (activeSession.returns_raised ?? 0) + 1;
    void updateSession(activeSession.id, { returns_raised: activeSession.returns_raised });
    sendToOverlay('overlay:show-reminder', {
      goal: activeSession.goal,
      currentApp: deviationState.appName,
      deviationSeconds: Math.floor((Date.now() - deviationState.startedAt) / 1000),
    });
    // Re-fire every tolerance interval until user returns or snoozes
    scheduleReminder(activeSession.tolerance_seconds * 1000);
  }, delayMs);
}

function clearDeviationTimer(): void {
  if (deviationState?.timerHandle) {
    clearTimeout(deviationState.timerHandle);
    deviationState.timerHandle = undefined;
  }
}

function onIdleDetected(): void {
  if (!activeSession) return;

  const current = getCurrentWindow();
  const onAllowed = current ? isAllowedInfo(current, activeSession.allowed_apps) : false;

  // Scenario 4: if the user is on an allowed site in Chrome but idle,
  // suppress the reminder if there has been activity in a native allowed app
  // (Teams, Slack, etc.) in the last 90 seconds.
  if (onAllowed && isChrome(current)) {
    const recentNativeActivity = Date.now() - lastNativeAllowedActivityAt < 90_000;
    if (recentNativeActivity) return; // They're working in Teams/Slack — don't interrupt
  }

  // Idle on allowed app: commit segment — the tolerance window was already active,
  // so cap at tolerance_seconds worth of focus credit then stop the clock.
  if (onAllowed) {
    commitFocusSegment(activeSession.tolerance_seconds);
  }

  sendToOverlay('overlay:show-idle', { onAllowedApp: onAllowed });
  sendToOverlay('overlay:message', { text: 'You seem idle — still working?', type: 'warn' });
}

export async function extendSession(extraMinutes: number): Promise<void> {
  if (!activeSession || extraMinutes < 1) return;
  activeSession.end_minutes = activeSession.end_minutes + extraMinutes;
  await updateSession(activeSession.id, { end_minutes: activeSession.end_minutes });
  scheduleSessionExpiry();
  sendToOverlay('overlay:session-extended', { end_minutes: activeSession.end_minutes });
  sendToMain('app:session-changed', activeSession);
}

export function handleSnooze(seconds = 60): void {
  if (!activeSession) return;
  clearDeviationTimer();
  if (deviationState) deviationState.reminded = false;
  // Re-fire only for this specific non-allowed app after snooze expires
  scheduleReminder(seconds * 1000);
  sendToOverlay('overlay:hide-reminder');
}

/**
 * Return logic — 4 scenarios:
 *
 * 1. User was on a permitted Chrome site earlier this session
 *    → activate that exact tab in Chrome
 *
 * 2. No prior allowed Chrome URL, but a permitted site is open in Chrome right now
 *    → activate the highest-ranked (first in session config) open Chrome tab
 *
 * 3. No permitted site is open in Chrome at all
 *    → open the highest-ranked URL entry as a new Chrome tab
 *
 * 4. Idle while on a permitted Chrome site (onAllowedApp=true, idle reminder)
 *    → return to that same Chrome tab (which is already open and correct)
 */
export function handleUserReturned(): void {
  if (activeSession && deviationState?.reminded) {
    activeSession.returns_made = (activeSession.returns_made ?? 0) + 1;
    void updateSession(activeSession.id, { returns_made: activeSession.returns_made });
  }
  clearDeviationTimer();
  deviationState = null;
  // Restart focus clock when user explicitly returns
  focusSegmentStart = Date.now();
  sendToOverlay('overlay:hide-reminder');

  if (!activeSession) return;

  const urlEntries = getAllowedUrls(activeSession.allowed_apps);

  // Scenario 1: we tracked the last allowed Chrome tab this session — go straight back to it
  if (lastAllowedChromeUrl) {
    const activated = activateChromeTabByUrl(lastAllowedChromeUrl);
    const label = domainOf(lastAllowedChromeUrl);
    sendToOverlay('overlay:message', {
      text: activated ? `Returned to ${label}` : `Try returning to ${label} in Chrome`,
      type: 'success',
    });
    return;
  }

  if (urlEntries.length > 0) {
    const openTabs = getAllChromeTabUrls();

    // Scenario 2: find the best open tab — prefer the currently focused Chrome tab if it matches,
    // then fall back to highest-ranked pattern match among all open tabs.
    const currentChromeUrl = getCurrentWindow();
    const currentUrl = isChrome(currentChromeUrl) ? (currentChromeUrl?.url ?? '') : '';

    // Check if the current tab already matches an allowed pattern
    if (currentUrl) {
      const currentLower = currentUrl.toLowerCase();
      const matchesCurrent = urlEntries.some((p) => currentLower.includes(p.toLowerCase()));
      if (matchesCurrent) {
        // User is already on an allowed site (idle case) — just activate Chrome
        activateChromeTabByUrl(currentUrl);
        sendToOverlay('overlay:message', { text: `Back to ${domainOf(currentUrl)}`, type: 'success' });
        return;
      }
    }

    // Scan all open tabs for the highest-ranked allowed URL
    for (const pattern of urlEntries) {
      const matchingTab = openTabs.find((tab) => tab.toLowerCase().includes(pattern.toLowerCase()));
      if (matchingTab) {
        activateChromeTabByUrl(matchingTab);
        sendToOverlay('overlay:message', { text: `Returned to ${domainOf(matchingTab)}`, type: 'success' });
        return;
      }
    }

    // Scenario 3: no matching tab open — open the highest-ranked URL in a new Chrome tab
    const topUrl = urlEntries[0];
    const fullUrl = topUrl.startsWith('http') ? topUrl : `https://${topUrl}`;
    openUrlInChrome(fullUrl);
    sendToOverlay('overlay:message', { text: `Opening ${topUrl} in Chrome…`, type: 'success' });
    return;
  }

  // No URL entries — user declared only native apps. Activate the first native allowed app.
  const firstNative = activeSession.allowed_apps.find((a) => !a.url && a.appName);
  if (firstNative) {
    activateApp(firstNative.appName);
    sendToOverlay('overlay:message', { text: `Returned to ${firstNative.appName}`, type: 'success' });
  } else {
    sendToOverlay('overlay:message', { text: 'Back on track!', type: 'success' });
  }
}

export async function handleAddApp(appName: string, bundleId: string, urlOverride?: string): Promise<void> {
  if (!activeSession) return;

  const current = getCurrentWindow();

  // Adding a Chrome site (either via urlOverride from overlay, or auto-detect from current tab)
  const inChrome = current && isChrome(current) && current.url;
  const domain = urlOverride
    ? normalizeUrlPattern(urlOverride)
    : inChrome
      ? (() => { try { return new URL(current.url!).hostname.replace(/^www\./, ''); } catch { return ''; } })()
      : '';

  if (domain) {
    const alreadyAllowed = activeSession.allowed_apps.some(
      (a) => a.url && normalizeUrlPattern(a.url) === domain
    );
    if (!alreadyAllowed) {
      activeSession.allowed_apps.push({ appName: domain, bundleId: 'com.google.Chrome', url: domain });
      await updateSession(activeSession.id, { allowed_apps: JSON.stringify(activeSession.allowed_apps) });
    }
    if (inChrome) {
      lastAllowedChromeUrl = current.url!;
      activeSession.last_active_app = domain;
      void updateSession(activeSession.id, { last_active_app: domain });
    }
    clearDeviationTimer();
    deviationState = null;
    sendToOverlay('overlay:hide-reminder');
    sendToOverlay('overlay:message', { text: `Added ${domain} as allowed`, type: 'success' });
    return;
  }

  // Native app
  const alreadyAllowed = activeSession.allowed_apps.some(
    (a) => a.appName.toLowerCase() === appName.toLowerCase() || (a.bundleId && a.bundleId === bundleId)
  );
  if (!alreadyAllowed) {
    activeSession.allowed_apps.push({ appName, bundleId });
    await updateSession(activeSession.id, { allowed_apps: JSON.stringify(activeSession.allowed_apps) });
  }
  lastNativeAllowedActivityAt = Date.now();
  if (current) {
    activeSession.last_active_app = current.appName;
    void updateSession(activeSession.id, { last_active_app: current.appName });
  }
  clearDeviationTimer();
  deviationState = null;
  sendToOverlay('overlay:hide-reminder');
  sendToOverlay('overlay:message', { text: `Added ${appName} as allowed`, type: 'success' });
}

function safeParseApps(raw: string): AllowedApp[] {
  try { return JSON.parse(raw) as AllowedApp[]; } catch { return []; }
}
