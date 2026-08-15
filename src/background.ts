// Background service worker for Return On extension

interface StoredSession {
  id: string;
  goal: string;
  end_minutes: number;
  allowed_sites: string[];
  tolerance_seconds: number;
  status: string;
  last_allowed_url: string;
  last_allowed_tab_id: number;
  started_at: string;
  ended_at?: string;
  user_id?: string;
  user_email?: string;
}

interface DeviationState {
  tabId: number;
  url: string;
  startedAt: number;
  timerHandle?: ReturnType<typeof setTimeout>;
  reminded: boolean;
  snoozedUntil?: number;
}

let activeSession: StoredSession | null = null;
let deviationState: DeviationState | null = null;
let idleReminderHandle: ReturnType<typeof setTimeout> | null = null;
let lastIdleReminderAt = 0;
const IDLE_REMINDER_COOLDOWN_MS = 90 * 1000; // don't spam idle reminders

// Desktop apps treated as activity (don't fire idle if user is on these)
const DESKTOP_APP_DOMAINS = ['teams.microsoft.com', 'app.slack.com', 'zoom.us', 'meet.google.com'];

// Restore session from storage on startup
chrome.storage.local.get(['returnon_session'], (result) => {
  if (result.returnon_session) {
    activeSession = result.returnon_session as StoredSession;
    checkSessionExpiry();
  }
});

// Cross-device: poll Supabase every 30s for sessions declared from other devices
// Uses the extension's stored auth token if available
function pollRemoteSessions() {
  chrome.storage.local.get(['returnon_user_email', 'returnon_supabase_token'], async (res) => {
    const email = res.returnon_user_email as string | undefined;
    const token = res.returnon_supabase_token as string | undefined;
    if (!email || !token || activeSession) return;

    try {
      const supabaseUrl = 'https://xzqgauucrhgfcwkgwapn.supabase.co';
      const resp = await fetch(
        `${supabaseUrl}/rest/v1/sessions?user_email=eq.${encodeURIComponent(email)}&status=eq.active&select=*&order=started_at.desc&limit=1`,
        { headers: { apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6cWdhdXVjcmhnZmN3a2d3YXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc2NDU2ODQsImV4cCI6MjA2MzIyMTY4NH0.bnSPPwUYuX1PeVLyN6VINv1w1hqbG8bHFGLbJVLb2KM', Authorization: `Bearer ${token}` } }
      );
      if (!resp.ok) return;
      const rows = await resp.json();
      if (!rows?.length) return;
      const remoteSession = rows[0] as StoredSession;
      const end = new Date(remoteSession.started_at).getTime() + remoteSession.end_minutes * 60 * 1000;
      if (Date.now() >= end) return;

      // Start it locally
      activeSession = { ...remoteSession, last_allowed_tab_id: 0 };
      chrome.storage.local.set({ returnon_session: activeSession });
      checkSessionExpiry();
      broadcastToTabs({ type: 'SESSION_START', session: activeSession });
    } catch {
      // silent
    }
  });
}

// Poll every 30 seconds
setInterval(pollRemoteSessions, 30000);

function broadcastToTabs(msg: object) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.id) chrome.tabs.sendMessage(tab.id, msg, () => { chrome.runtime.lastError; });
    });
  });
}

function checkSessionExpiry() {
  if (!activeSession) return;
  const started = new Date(activeSession.started_at).getTime();
  const endMs = activeSession.end_minutes * 60 * 1000;
  const remaining = started + endMs - Date.now();
  if (remaining <= 0) {
    endSession();
  } else {
    setTimeout(endSession, remaining);
  }
}

function endSession() {
  if (!activeSession) return;
  activeSession.status = 'completed';
  activeSession.ended_at = new Date().toISOString();
  chrome.storage.local.set({ returnon_session: activeSession });
  broadcastToTabs({ type: 'SESSION_END' });
  activeSession = null;
  deviationState = null;
  if (idleReminderHandle) { clearTimeout(idleReminderHandle); idleReminderHandle = null; }
  chrome.storage.local.remove('returnon_session');
}

function normalizeDomain(url: string): string {
  try {
    const u = new URL(url.startsWith('http') ? url : 'https://' + url);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^www\./, '');
  }
}

function isDesktopApp(url: string): boolean {
  const host = normalizeDomain(url);
  return DESKTOP_APP_DOMAINS.some((d) => host === d || host.endsWith('.' + d));
}

function isAllowed(url: string, allowedSites: string[]): boolean {
  if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('edge://')) return true;
  const visitedHost = normalizeDomain(url);
  return allowedSites.some((site) => {
    const allowedHost = normalizeDomain(site);
    return visitedHost === allowedHost || visitedHost.endsWith('.' + allowedHost);
  });
}

function clearDeviationTimer() {
  if (deviationState?.timerHandle) clearTimeout(deviationState.timerHandle);
}

function findBestAllowedTab(allowedSites: string[], callback: (tabId: number | null) => void) {
  chrome.tabs.query({}, (tabs) => {
    const domainTabMap = new Map<string, number[]>();
    for (const tab of tabs) {
      if (!tab.url || !tab.id) continue;
      const host = normalizeDomain(tab.url);
      for (const site of allowedSites) {
        const allowedHost = normalizeDomain(site);
        if (host === allowedHost || host.endsWith('.' + allowedHost)) {
          const key = normalizeDomain(site);
          if (!domainTabMap.has(key)) domainTabMap.set(key, []);
          domainTabMap.get(key)!.push(tab.id);
          break;
        }
      }
    }
    for (const site of allowedSites) {
      const key = normalizeDomain(site);
      const tabIds = domainTabMap.get(key);
      if (tabIds && tabIds.length > 0) { callback(tabIds[0]); return; }
    }
    callback(null);
  });
}

// Check if any desktop app tab is active (user may be working in Teams/Slack)
function hasActiveDesktopAppTab(callback: (active: boolean) => void) {
  chrome.tabs.query({ active: true }, (tabs) => {
    callback(tabs.some((t) => t.url && isDesktopApp(t.url)));
  });
}

function scheduleReminder(tabId: number, delayMs: number) {
  if (!deviationState || !activeSession) return;

  // Send countdown warning 10s before
  if (delayMs > 10000) {
    setTimeout(() => {
      chrome.tabs.sendMessage(tabId, { type: 'COUNTDOWN_WARNING', seconds: 10 }, () => { chrome.runtime.lastError; });
    }, delayMs - 10000);
  }

  deviationState.timerHandle = setTimeout(() => {
    if (!deviationState || !activeSession) return;
    deviationState.reminded = true;
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError || !tab) return;
      chrome.tabs.sendMessage(tabId, { type: 'SHOW_REMINDER', currentUrl: tab.url || '' }, () => { chrome.runtime.lastError; });
      deviationState!.reminded = false;
      scheduleReminder(tabId, activeSession!.tolerance_seconds * 1000);
    });
  }, delayMs);
}

function startDeviationTracking(tabId: number, url: string) {
  if (!activeSession) return;
  clearDeviationTimer();
  deviationState = { tabId, url, startedAt: Date.now(), reminded: false };
  scheduleReminder(tabId, activeSession.tolerance_seconds * 1000);
}

function onAllowedUrl(tabId: number, url: string) {
  if (!activeSession) return;
  activeSession.last_allowed_url = url;
  activeSession.last_allowed_tab_id = tabId;
  chrome.storage.local.set({ returnon_session: activeSession });
  if (deviationState) { clearDeviationTimer(); deviationState = null; }
  chrome.tabs.sendMessage(tabId, { type: 'HIDE_REMINDER' }, () => { chrome.runtime.lastError; });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;
  if (!activeSession || activeSession.status !== 'active') return;
  const url = tab.url;
  if (isAllowed(url, activeSession.allowed_sites)) {
    onAllowedUrl(tabId, url);
  } else {
    clearDeviationTimer();
    deviationState = null;
    startDeviationTracking(tabId, url);
  }
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  if (!activeSession || activeSession.status !== 'active') return;
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError || !tab?.url) return;
    const url = tab.url;
    if (isAllowed(url, activeSession!.allowed_sites)) {
      onAllowedUrl(tabId, url);
    } else {
      clearDeviationTimer();
      deviationState = null;
      startDeviationTracking(tabId, url);
    }
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SESSION_START') {
    activeSession = message.session as StoredSession;
    deviationState = null;
    chrome.storage.local.set({ returnon_session: activeSession });
    checkSessionExpiry();
    // Broadcast to all tabs so widget appears everywhere
    broadcastToTabs({ type: 'SESSION_START', session: activeSession });
    sendResponse({ ok: true });
  }

  if (message.type === 'SESSION_END') {
    endSession();
    sendResponse({ ok: true });
  }

  if (message.type === 'SESSION_EXTEND') {
    // Update the in-memory session with extended end_minutes
    if (activeSession && message.session) {
      activeSession = { ...activeSession, ...message.session };
      chrome.storage.local.set({ returnon_session: activeSession });
      // Re-schedule expiry with new duration
      checkSessionExpiry();
      // Update widget timer in all tabs
      broadcastToTabs({ type: 'SESSION_EXTEND', session: activeSession });
    }
    sendResponse({ ok: true });
  }

  if (message.type === 'GET_SESSION') {
    sendResponse({ session: activeSession });
  }

  if (message.type === 'USER_RETURNED') {
    clearDeviationTimer();
    deviationState = null;
    if (activeSession?.last_allowed_tab_id) {
      const targetTabId = activeSession.last_allowed_tab_id;
      chrome.tabs.get(targetTabId, (tab) => {
        if (chrome.runtime.lastError || !tab) {
          returnToFallback(sender.tab?.id);
          return;
        }
        chrome.tabs.update(targetTabId, { active: true });
        if (tab.windowId) chrome.windows.update(tab.windowId, { focused: true });
      });
    } else {
      returnToFallback(sender.tab?.id);
    }
    sendResponse({ ok: true });
  }

  if (message.type === 'SNOOZE') {
    if (!deviationState || !activeSession) { sendResponse({ ok: false }); return true; }
    clearDeviationTimer();
    const snoozeMs = 60 * 1000;
    deviationState.reminded = false;
    const tabId = deviationState.tabId;
    scheduleReminder(tabId, snoozeMs);
    sendResponse({ ok: true });
  }

  if (message.type === 'ADD_PERMISSIBLE_SITE') {
    if (!activeSession) { sendResponse({ ok: false }); return true; }
    const domain: string = message.domain;
    if (!activeSession.allowed_sites.includes(domain)) {
      activeSession.allowed_sites.push(domain);
      chrome.storage.local.set({ returnon_session: activeSession });
    }
    if (sender.tab?.id && sender.tab.url) onAllowedUrl(sender.tab.id, sender.tab.url);
    sendResponse({ ok: true });
  }

  if (message.type === 'IDLE_DETECTED') {
    if (!activeSession) { sendResponse({ ok: false }); return true; }
    // Don't re-fire idle reminder if we fired one recently or user is on desktop app
    const now = Date.now();
    if (now - lastIdleReminderAt < IDLE_REMINDER_COOLDOWN_MS) { sendResponse({ ok: false }); return true; }

    hasActiveDesktopAppTab((hasApp) => {
      if (hasApp) { sendResponse({ ok: false }); return; }
      lastIdleReminderAt = now;
      // Send idle reminder to active tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]?.id) return;
        chrome.tabs.sendMessage(tabs[0].id, { type: 'SHOW_IDLE_REMINDER' }, () => { chrome.runtime.lastError; });
      });
      sendResponse({ ok: true });
    });
    return true; // async
  }

  if (message.type === 'PARK_THOUGHT') {
    if (!activeSession) { sendResponse({ ok: false }); return true; }
    const content: string = message.content;

    // Save to supabase via fetch if we have user info
    chrome.storage.local.get(['returnon_supabase_token', 'returnon_user_id'], async (res) => {
      const token = res.returnon_supabase_token as string | undefined;
      const userId = res.returnon_user_id as string | undefined;
      if (!token || !userId) { sendResponse({ ok: false }); return; }

      try {
        const supabaseUrl = 'https://xzqgauucrhgfcwkgwapn.supabase.co';
        const resp = await fetch(`${supabaseUrl}/rest/v1/parked_thoughts`, {
          method: 'POST',
          headers: {
            apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6cWdhdXVjcmhnZmN3a2d3YXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc2NDU2ODQsImV4cCI6MjA2MzIyMTY4NH0.bnSPPwUYuX1PeVLyN6VINv1w1hqbG8bHFGLbJVLb2KM',
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ user_id: userId, session_id: activeSession!.id, content }),
        });
        sendResponse({ ok: resp.ok });
      } catch {
        sendResponse({ ok: false });
      }
    });
    return true; // async
  }

  if (message.type === 'STORE_AUTH') {
    // Store auth token and user info from PWA for cross-device use
    chrome.storage.local.set({
      returnon_supabase_token: message.token,
      returnon_user_id: message.userId,
      returnon_user_email: message.email,
    });
    sendResponse({ ok: true });
  }

  return true;
});

function returnToFallback(currentTabId?: number) {
  if (!activeSession) return;
  findBestAllowedTab(activeSession.allowed_sites, (tabId) => {
    if (tabId !== null) {
      chrome.tabs.update(tabId, { active: true });
      chrome.tabs.get(tabId, (tab) => {
        if (!chrome.runtime.lastError && tab.windowId) chrome.windows.update(tab.windowId, { focused: true });
      });
    } else {
      const topSite = activeSession!.allowed_sites[0];
      if (topSite) {
        const url = topSite.startsWith('http') ? topSite : 'https://' + topSite;
        chrome.tabs.create({ url });
      }
    }
  });
}
