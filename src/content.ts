// Content script injected into every page
// Provides: reminder overlay, always-visible floating widget, idle detection, thought parking,
// session extension from widget, new session from widget

let reminderEl: HTMLElement | null = null;
let happyFaceEl: HTMLElement | null = null;
let widgetEl: HTMLElement | null = null;
let currentPageUrl = window.location.href;

// Idle tracking
let lastActivityTime = Date.now();
let idleCheckInterval: ReturnType<typeof setInterval> | null = null;
const IDLE_THRESHOLD_MS = 60 * 1000;

// Widget position (persisted across panel toggles)
let widgetX = -1;
let widgetY = -1;

// Widget panel state
type PanelView = 'messages' | 'extend' | 'newsession';
let currentPanelView: PanelView = 'messages';
let isPanelOpen = false;

// Desktop app domains that count as active
const DESKTOP_APP_DOMAINS = ['teams.microsoft.com', 'app.slack.com', 'zoom.us', 'meet.google.com'];

// ──────────────────────────────────────────────
// CSS
// ──────────────────────────────────────────────
function createStyles(): HTMLStyleElement {
  const style = document.createElement('style');
  style.textContent = `
    #returnon-overlay {
      position: fixed;
      bottom: 28px;
      right: 28px;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      animation: returnon-slide-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    @keyframes returnon-slide-in {
      from { transform: translateY(120px); opacity: 0; }
      to   { transform: translateY(0);    opacity: 1; }
    }
    @keyframes returnon-slide-out {
      from { transform: translateY(0);    opacity: 1; }
      to   { transform: translateY(120px); opacity: 0; }
    }
    #returnon-overlay.returnon-hiding {
      animation: returnon-slide-out 0.25s ease forwards;
    }
    #returnon-chat {
      background: #fff;
      border-radius: 18px 18px 4px 18px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10);
      padding: 18px 20px 14px;
      max-width: 340px;
      min-width: 290px;
      border: 1.5px solid #e5e7eb;
    }
    #returnon-header {
      display: flex; align-items: center; gap: 8px; margin-bottom: 10px;
    }
    #returnon-logo {
      width: 28px; height: 28px;
      background: linear-gradient(135deg, #0f766e 0%, #14b8a6 100%);
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    #returnon-logo svg { width:16px;height:16px;fill:none;stroke:#fff;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round; }
    #returnon-app-name { font-size:12px;font-weight:700;color:#0f766e;letter-spacing:0.04em;text-transform:uppercase; }
    #returnon-message { font-size:14px;color:#374151;line-height:1.55;margin-bottom:14px; }
    #returnon-message strong { color:#111827; }
    #returnon-countdown-bar { height:3px;background:#f3f4f6;border-radius:9999px;margin-bottom:12px;overflow:hidden; }
    #returnon-countdown-fill { height:100%;background:linear-gradient(90deg,#0f766e,#14b8a6);border-radius:9999px;transition:width 1s linear; }
    #returnon-actions { display:flex;flex-direction:column;gap:7px; }
    #returnon-actions-row1 { display:flex;gap:7px; }
    #returnon-return-btn {
      flex:1;background:linear-gradient(135deg,#0f766e 0%,#14b8a6 100%);color:#fff;border:none;border-radius:10px;
      padding:9px 14px;font-size:13px;font-weight:600;cursor:pointer;transition:opacity 0.15s,transform 0.12s;
      box-shadow:0 2px 8px rgba(15,118,110,0.25);
    }
    #returnon-return-btn:hover { opacity:0.9;transform:translateY(-1px); }
    #returnon-snooze-btn {
      background:#fff7ed;color:#c2410c;border:1.5px solid #fed7aa;border-radius:10px;
      padding:9px 12px;font-size:13px;font-weight:500;cursor:pointer;transition:background 0.15s;white-space:nowrap;
    }
    #returnon-snooze-btn:hover { background:#ffedd5; }
    #returnon-snooze-count { font-size:10px;background:#fed7aa;color:#9a3412;border-radius:9999px;padding:1px 6px;font-weight:700;margin-left:4px; }
    #returnon-add-btn {
      width:100%;background:#f0fdf4;color:#15803d;border:1.5px solid #bbf7d0;border-radius:10px;
      padding:8px 14px;font-size:12px;font-weight:500;cursor:pointer;transition:background 0.15s;text-align:center;
    }
    #returnon-add-btn:hover { background:#dcfce7; }
    #returnon-happy {
      position:fixed;bottom:28px;right:28px;z-index:2147483647;background:#fff;border-radius:18px;
      box-shadow:0 8px 32px rgba(0,0,0,0.14);border:1.5px solid #e5e7eb;padding:20px 28px;
      display:flex;flex-direction:column;align-items:center;gap:8px;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      animation:returnon-slide-in 0.35s cubic-bezier(0.34,1.56,0.64,1);
    }
    #returnon-happy-emoji { font-size:48px;line-height:1; }
    #returnon-happy-text { font-size:14px;font-weight:600;color:#0f766e;text-align:center; }
    #returnon-added-toast {
      position:fixed;bottom:28px;right:28px;z-index:2147483647;background:#f0fdf4;border:1.5px solid #bbf7d0;
      border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,0.10);padding:12px 18px;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;font-weight:600;color:#166534;
      animation:returnon-slide-in 0.3s cubic-bezier(0.34,1.56,0.64,1);
    }

    /* ── Floating Widget ── */
    #returnon-widget {
      position: fixed;
      z-index: 2147483646;
      right: 16px;
      bottom: 80px;
      /* cursor set dynamically */
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      user-select: none;
      touch-action: none;
    }
    #returnon-widget-face {
      width: 48px;
      height: 48px;
      background: linear-gradient(135deg, #0f766e 0%, #14b8a6 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 16px rgba(15,118,110,0.4);
      font-size: 22px;
      transition: transform 0.15s, box-shadow 0.15s;
      position: relative;
      cursor: pointer;
    }
    #returnon-widget-face:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 24px rgba(15,118,110,0.5);
    }
    #returnon-widget-face.no-session {
      background: linear-gradient(135deg, #64748b 0%, #94a3b8 100%);
      box-shadow: 0 4px 16px rgba(100,116,139,0.35);
    }
    #returnon-widget-face.no-session:hover {
      box-shadow: 0 6px 24px rgba(100,116,139,0.45);
    }
    #returnon-widget-badge {
      position: absolute; top: -4px; right: -4px;
      width: 16px; height: 16px;
      background: #ef4444; border-radius: 50%; border: 2px solid white;
      font-size: 9px; font-weight: 700; color: white;
      display: flex; align-items: center; justify-content: center;
    }
    #returnon-widget-panel {
      position: absolute;
      right: 0;
      bottom: 56px;
      width: 300px;
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.18);
      border: 1.5px solid #e5e7eb;
      overflow: hidden;
      animation: returnon-panel-in 0.2s cubic-bezier(0.34,1.56,0.64,1);
    }
    @keyframes returnon-panel-in {
      from { transform: scale(0.85) translateY(16px); opacity:0; }
      to   { transform: scale(1) translateY(0);       opacity:1; }
    }
    #returnon-widget-panel-header {
      background: linear-gradient(135deg, #0f766e 0%, #14b8a6 100%);
      padding: 10px 14px;
      display: flex; align-items: center; justify-content: space-between;
    }
    #returnon-widget-panel-header.no-session-header {
      background: linear-gradient(135deg, #475569 0%, #64748b 100%);
    }
    #returnon-widget-goal {
      font-size: 11px; color: rgba(255,255,255,0.9); font-weight: 600;
      max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    #returnon-widget-timer {
      font-size: 11px; color: rgba(255,255,255,0.85); font-weight: 700;
      font-variant-numeric: tabular-nums; background: rgba(0,0,0,0.15);
      padding: 2px 8px; border-radius: 9999px;
    }
    #returnon-widget-tab-bar {
      display: flex; border-bottom: 1px solid #f3f4f6; background: #fafafa;
    }
    .returnon-tab-btn {
      flex: 1; padding: 8px 4px; border: none; background: transparent;
      font-size: 11px; font-weight: 500; color: #6b7280; cursor: pointer;
      border-bottom: 2px solid transparent; transition: color 0.15s, border-color 0.15s;
      font-family: inherit;
    }
    .returnon-tab-btn:hover { color: #111827; }
    .returnon-tab-btn.active { color: #0f766e; border-bottom-color: #0f766e; font-weight: 600; }
    #returnon-widget-messages {
      padding: 10px 14px; max-height: 120px; overflow-y: auto; border-bottom: 1px solid #f3f4f6;
    }
    .returnon-msg { font-size: 12px; color: #374151; padding: 4px 0; border-bottom: 1px solid #f9fafb; line-height: 1.4; }
    .returnon-msg:last-child { border-bottom: none; }
    .returnon-msg.warn { color: #b45309; }
    .returnon-msg.success { color: #15803d; }
    #returnon-parking-area { padding: 10px 14px; }
    #returnon-parking-label {
      font-size: 10px; font-weight: 600; color: #9ca3af; text-transform: uppercase;
      letter-spacing: 0.06em; margin-bottom: 6px; display: flex; align-items: center; gap: 4px;
    }
    #returnon-parking-textarea {
      width: 100%; height: 60px; resize: none; border: 1.5px solid #e5e7eb; border-radius: 10px;
      padding: 8px 10px; font-size: 12px; color: #374151; font-family: inherit; outline: none;
      transition: border-color 0.15s; background: #fafafa;
    }
    #returnon-parking-textarea:focus { border-color: #0f766e; background: #fff; }
    #returnon-parking-submit {
      margin-top: 6px; width: 100%;
      background: linear-gradient(135deg, #0f766e 0%, #14b8a6 100%);
      color: #fff; border: none; border-radius: 8px; padding: 6px;
      font-size: 12px; font-weight: 600; cursor: pointer; transition: opacity 0.15s; font-family: inherit;
    }
    #returnon-parking-submit:hover { opacity: 0.9; }
    #returnon-parking-submit:disabled { opacity: 0.5; cursor: not-allowed; }

    /* Extend panel */
    #returnon-extend-area { padding: 10px 14px; }
    .returnon-extend-label {
      font-size: 10px; font-weight: 600; color: #9ca3af; text-transform: uppercase;
      letter-spacing: 0.06em; margin-bottom: 6px;
    }
    .returnon-extend-presets { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
    .returnon-preset-btn {
      padding: 5px 10px; border: 1.5px solid #e5e7eb; border-radius: 8px;
      background: #fff; color: #374151; font-size: 11px; font-weight: 500; cursor: pointer;
      transition: all 0.15s; font-family: inherit;
    }
    .returnon-preset-btn:hover { border-color: #0f766e; color: #0f766e; background: #f0fdf4; }
    .returnon-preset-btn.selected { border-color: #0f766e; background: #0f766e; color: #fff; }
    .returnon-extend-custom-row { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
    .returnon-extend-custom-row input {
      flex: 1; border: 1.5px solid #e5e7eb; border-radius: 8px; padding: 5px 8px;
      font-size: 12px; color: #374151; outline: none; font-family: inherit;
    }
    .returnon-extend-custom-row input:focus { border-color: #0f766e; }
    .returnon-extend-custom-row span { font-size: 11px; color: #9ca3af; }
    .returnon-action-btn {
      width: 100%; background: linear-gradient(135deg, #0f766e 0%, #14b8a6 100%);
      color: #fff; border: none; border-radius: 8px; padding: 7px;
      font-size: 12px; font-weight: 600; cursor: pointer; transition: opacity 0.15s; font-family: inherit;
    }
    .returnon-action-btn:hover { opacity: 0.9; }
    .returnon-action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .returnon-action-btn.secondary {
      background: #f3f4f6; color: #374151; margin-top: 6px;
    }
    .returnon-action-btn.secondary:hover { background: #e5e7eb; }
    .returnon-hint-text { font-size: 10px; color: #9ca3af; margin-bottom: 8px; line-height: 1.4; }

    /* New session panel */
    #returnon-newsession-area { padding: 10px 14px; }
    .returnon-field-label { font-size: 10px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
    .returnon-text-input {
      width: 100%; border: 1.5px solid #e5e7eb; border-radius: 10px;
      padding: 7px 10px; font-size: 12px; color: #374151; font-family: inherit; outline: none;
      transition: border-color 0.15s; background: #fafafa; margin-bottom: 8px;
    }
    .returnon-text-input:focus { border-color: #0f766e; background: #fff; }
    .returnon-dur-presets { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 8px; }
    .returnon-info-note {
      font-size: 10px; color: #6b7280; background: #f9fafb; border: 1px solid #e5e7eb;
      border-radius: 8px; padding: 6px 8px; margin-bottom: 8px; line-height: 1.4;
    }
  `;
  return style;
}

function ensureStyles() {
  if (!document.getElementById('returnon-styles')) {
    const styles = createStyles();
    styles.id = 'returnon-styles';
    (document.head || document.documentElement).appendChild(styles);
  }
}

function normalizeDomain(url: string): string {
  try {
    const u = new URL(url.startsWith('http') ? url : 'https://' + url);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// ──────────────────────────────────────────────
// Idle detection
// ──────────────────────────────────────────────
function recordActivity() { lastActivityTime = Date.now(); }

function isDesktopApp(url: string): boolean {
  const host = normalizeDomain(url);
  return DESKTOP_APP_DOMAINS.some((d) => host === d || host.endsWith('.' + d));
}

function startIdleTracking() {
  if (idleCheckInterval) return;
  document.addEventListener('mousemove', recordActivity, { passive: true });
  document.addEventListener('keydown', recordActivity, { passive: true });
  document.addEventListener('click', recordActivity, { passive: true });
  document.addEventListener('scroll', recordActivity, { passive: true });
  document.addEventListener('touchstart', recordActivity, { passive: true });

  idleCheckInterval = setInterval(() => {
    const idle = Date.now() - lastActivityTime;
    if (idle >= IDLE_THRESHOLD_MS && !isDesktopApp(window.location.href)) {
      chrome.runtime.sendMessage({ type: 'IDLE_DETECTED', idleMs: idle }, () => { chrome.runtime.lastError; });
    }
  }, 10000);
}

function stopIdleTracking() {
  if (idleCheckInterval) { clearInterval(idleCheckInterval); idleCheckInterval = null; }
  document.removeEventListener('mousemove', recordActivity);
  document.removeEventListener('keydown', recordActivity);
  document.removeEventListener('click', recordActivity);
  document.removeEventListener('scroll', recordActivity);
  document.removeEventListener('touchstart', recordActivity);
}

// ──────────────────────────────────────────────
// Reminder overlay
// ──────────────────────────────────────────────
let snoozeCount = 0;
let countdownInterval: ReturnType<typeof setInterval> | null = null;
let countdownSecs = 10;

function showReminder() {
  if (reminderEl) return;
  currentPageUrl = window.location.href;
  ensureStyles();
  countdownSecs = 10;

  const wrapper = document.createElement('div');
  wrapper.id = 'returnon-overlay';
  const chat = document.createElement('div');
  chat.id = 'returnon-chat';

  const header = document.createElement('div');
  header.id = 'returnon-header';
  const logo = document.createElement('div');
  logo.id = 'returnon-logo';
  logo.innerHTML = `<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`;
  const appName = document.createElement('span');
  appName.id = 'returnon-app-name';
  appName.textContent = 'Return On';
  header.appendChild(logo);
  header.appendChild(appName);

  const countdownBar = document.createElement('div');
  countdownBar.id = 'returnon-countdown-bar';
  const countdownFill = document.createElement('div');
  countdownFill.id = 'returnon-countdown-fill';
  countdownFill.style.width = '100%';
  countdownBar.appendChild(countdownFill);

  const msg = document.createElement('div');
  msg.id = 'returnon-message';
  msg.innerHTML = `<strong>Gentle reminder</strong> — you seem to be deviating from your focus session. Click <strong>Return</strong> to get back on track.`;

  const actions = document.createElement('div');
  actions.id = 'returnon-actions';
  const row1 = document.createElement('div');
  row1.id = 'returnon-actions-row1';

  const returnBtn = document.createElement('button');
  returnBtn.id = 'returnon-return-btn';
  returnBtn.textContent = 'Return';
  returnBtn.autofocus = true;

  const snoozeBtn = document.createElement('button');
  snoozeBtn.id = 'returnon-snooze-btn';
  const snoozeSpan = document.createElement('span');
  snoozeSpan.textContent = 'Snooze 60s';
  snoozeBtn.appendChild(snoozeSpan);
  if (snoozeCount > 0) {
    const badge = document.createElement('span');
    badge.id = 'returnon-snooze-count';
    badge.textContent = String(snoozeCount);
    snoozeBtn.appendChild(badge);
  }

  const domain = normalizeDomain(currentPageUrl);
  const addBtn = document.createElement('button');
  addBtn.id = 'returnon-add-btn';
  addBtn.textContent = `Add "${domain}" as permissible site`;

  returnBtn.addEventListener('click', () => handleReturn());
  snoozeBtn.addEventListener('click', () => handleSnooze());
  addBtn.addEventListener('click', () => handleAddSite(domain));

  row1.appendChild(returnBtn);
  row1.appendChild(snoozeBtn);
  actions.appendChild(row1);
  actions.appendChild(addBtn);

  chat.appendChild(header);
  chat.appendChild(countdownBar);
  chat.appendChild(msg);
  chat.appendChild(actions);
  wrapper.appendChild(chat);
  document.body.appendChild(wrapper);
  reminderEl = wrapper;

  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    countdownSecs--;
    const pct = (countdownSecs / 10) * 100;
    countdownFill.style.width = pct + '%';
    if (countdownSecs <= 3) countdownFill.style.background = '#ef4444';
    if (countdownSecs <= 0) {
      clearInterval(countdownInterval!);
      countdownInterval = null;
      handleReturn();
    }
  }, 1000);

  setTimeout(() => returnBtn.focus(), 50);
  addWidgetMessage('Reminder: check your focus goal!', 'warn');
}

function handleReturn() {
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  hideReminder();
  showHappyFace();
  chrome.runtime.sendMessage({ type: 'USER_RETURNED' });
}

function handleSnooze() {
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  snoozeCount++;
  hideReminder();
  chrome.runtime.sendMessage({ type: 'SNOOZE' });
  addWidgetMessage(`Snoozed (${snoozeCount}x) — resuming in 60s`, 'warn');
}

function handleAddSite(domain: string) {
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  hideReminder();
  chrome.runtime.sendMessage({ type: 'ADD_PERMISSIBLE_SITE', domain }, () => {
    showAddedToast(domain);
    addWidgetMessage(`Added "${domain}" to allowed sites`, 'success');
  });
}

function showHappyFace() {
  if (happyFaceEl) return;
  ensureStyles();
  const el = document.createElement('div');
  el.id = 'returnon-happy';
  const emoji = document.createElement('div');
  emoji.id = 'returnon-happy-emoji';
  emoji.textContent = '😊';
  const text = document.createElement('div');
  text.id = 'returnon-happy-text';
  text.textContent = 'Great! Back on track!';
  el.appendChild(emoji);
  el.appendChild(text);
  document.body.appendChild(el);
  happyFaceEl = el;
  setTimeout(() => { happyFaceEl?.remove(); happyFaceEl = null; }, 3000);
  addWidgetMessage('Great — back on track!', 'success');
}

function showAddedToast(domain: string) {
  ensureStyles();
  const toast = document.createElement('div');
  toast.id = 'returnon-added-toast';
  toast.textContent = `"${domain}" added as a permissible site`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function hideReminder() {
  if (!reminderEl) return;
  reminderEl.classList.add('returnon-hiding');
  setTimeout(() => { reminderEl?.remove(); reminderEl = null; }, 260);
}

// ──────────────────────────────────────────────
// Widget messages
// ──────────────────────────────────────────────
let widgetMessages: Array<{ text: string; type: string }> = [];
let widgetTimerInterval: ReturnType<typeof setInterval> | null = null;
let currentSession: {
  id: string; goal: string; started_at: string; end_minutes: number;
  allowed_sites: string[]; tolerance_seconds: number;
  extensions?: Array<{ added_minutes: number; extended_at: string }>;
} | null = null;

function addWidgetMessage(text: string, type = '') {
  widgetMessages.unshift({ text, type });
  if (widgetMessages.length > 20) widgetMessages.pop();
  renderWidgetMessages();
}

function renderWidgetMessages() {
  const el = document.getElementById('returnon-widget-messages');
  if (!el) return;
  el.innerHTML = '';
  if (widgetMessages.length === 0) {
    const p = document.createElement('p');
    p.className = 'returnon-msg';
    p.style.color = '#9ca3af';
    p.textContent = currentSession ? 'Session active — staying on track.' : 'No active session. Park thoughts or start one.';
    el.appendChild(p);
    return;
  }
  widgetMessages.forEach(({ text, type }) => {
    const p = document.createElement('p');
    p.className = 'returnon-msg ' + type;
    p.textContent = text;
    el.appendChild(p);
  });
}

function getTotalExtended(): number {
  return (currentSession?.extensions ?? []).reduce((s, e) => s + e.added_minutes, 0);
}

function formatTimer(startedAt: string, endMinutes: number): string {
  const totalExtended = getTotalExtended();
  const end = new Date(startedAt).getTime() + (endMinutes + totalExtended) * 60 * 1000;
  const rem = Math.max(0, Math.floor((end - Date.now()) / 1000));
  const m = Math.floor(rem / 60);
  const s = rem % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updateWidgetBadge(count: number) {
  let badge = document.getElementById('returnon-widget-badge');
  const face = document.getElementById('returnon-widget-face');
  if (!face) return;
  if (count <= 0) { badge?.remove(); return; }
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'returnon-widget-badge';
    face.appendChild(badge);
  }
  badge.textContent = count > 9 ? '9+' : String(count);
}

// ──────────────────────────────────────────────
// Widget — always visible
// ──────────────────────────────────────────────
function ensureWidget() {
  if (widgetEl) return;
  ensureStyles();

  const widget = document.createElement('div');
  widget.id = 'returnon-widget';

  // Position — use saved or default bottom-right
  if (widgetX >= 0 && widgetY >= 0) {
    widget.style.right = 'auto';
    widget.style.bottom = 'auto';
    widget.style.left = widgetX + 'px';
    widget.style.top = widgetY + 'px';
  }

  const face = document.createElement('div');
  face.id = 'returnon-widget-face';
  if (!currentSession) face.classList.add('no-session');
  face.textContent = '😊';
  face.title = 'Return On — click to open';
  widget.appendChild(face);

  // ── Drag: grab from exact pointer-down position ──
  let dragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  widget.addEventListener('pointerdown', (e: PointerEvent) => {
    // Don't drag if clicking inside panel or buttons
    if ((e.target as HTMLElement).closest('#returnon-widget-panel')) return;

    e.preventDefault();
    dragging = false;
    dragStartX = e.clientX;
    dragStartY = e.clientY;

    const rect = widget.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;

    widget.setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      const dx = Math.abs(ev.clientX - dragStartX);
      const dy = Math.abs(ev.clientY - dragStartY);
      if (dx > 4 || dy > 4) dragging = true;
      if (!dragging) return;

      widget.style.cursor = 'grabbing';
      widget.style.right = 'auto';
      widget.style.bottom = 'auto';
      const nx = ev.clientX - dragOffsetX;
      const ny = ev.clientY - dragOffsetY;
      // Clamp within viewport
      const maxX = window.innerWidth - widget.offsetWidth;
      const maxY = window.innerHeight - widget.offsetHeight;
      widgetX = Math.max(0, Math.min(nx, maxX));
      widgetY = Math.max(0, Math.min(ny, maxY));
      widget.style.left = widgetX + 'px';
      widget.style.top = widgetY + 'px';
    };

    const onUp = (_ev: PointerEvent) => {
      widget.style.cursor = '';
      widget.removeEventListener('pointermove', onMove);
      widget.removeEventListener('pointerup', onUp);
      // Small delay so click handler can check dragging flag
      setTimeout(() => { dragging = false; }, 50);
    };

    widget.addEventListener('pointermove', onMove);
    widget.addEventListener('pointerup', onUp);
  });

  // Click to toggle panel (only if not dragging)
  face.addEventListener('click', () => {
    if (dragging) return;
    togglePanel(widget);
  });

  document.body.appendChild(widget);
  widgetEl = widget;

  // Live timer update
  if (widgetTimerInterval) clearInterval(widgetTimerInterval);
  widgetTimerInterval = setInterval(() => {
    const timerEl = document.getElementById('returnon-widget-timer');
    if (timerEl && currentSession) {
      timerEl.textContent = formatTimer(currentSession.started_at, currentSession.end_minutes);
    }
  }, 1000);
}

function updateWidgetFaceStyle() {
  const face = document.getElementById('returnon-widget-face');
  if (!face) return;
  if (currentSession) {
    face.classList.remove('no-session');
  } else {
    face.classList.add('no-session');
  }
}

// ──────────────────────────────────────────────
// Panel rendering
// ──────────────────────────────────────────────
function togglePanel(widget: HTMLElement) {
  const existing = document.getElementById('returnon-widget-panel');
  if (existing) {
    existing.remove();
    isPanelOpen = false;
    return;
  }
  isPanelOpen = true;
  renderPanel(widget);
}

function renderPanel(widget: HTMLElement) {
  // Remove any existing panel
  document.getElementById('returnon-widget-panel')?.remove();

  const panel = document.createElement('div');
  panel.id = 'returnon-widget-panel';

  // Header
  const header = document.createElement('div');
  header.id = 'returnon-widget-panel-header';
  if (!currentSession) header.classList.add('no-session-header');

  const goalSpan = document.createElement('span');
  goalSpan.id = 'returnon-widget-goal';
  goalSpan.textContent = currentSession ? currentSession.goal : 'Return On';

  if (currentSession) {
    const timer = document.createElement('span');
    timer.id = 'returnon-widget-timer';
    timer.textContent = formatTimer(currentSession.started_at, currentSession.end_minutes);
    header.appendChild(goalSpan);
    header.appendChild(timer);
  } else {
    goalSpan.style.fontSize = '12px';
    goalSpan.style.fontWeight = '700';
    goalSpan.textContent = 'Return On';
    const sub = document.createElement('span');
    sub.style.cssText = 'font-size:10px;color:rgba(255,255,255,0.7)';
    sub.textContent = 'No active session';
    const col = document.createElement('div');
    col.appendChild(goalSpan);
    col.appendChild(sub);
    header.appendChild(col);
  }
  panel.appendChild(header);

  // Tab bar
  const tabBar = document.createElement('div');
  tabBar.id = 'returnon-widget-tab-bar';

  const tabs: Array<{ id: PanelView; label: string; show: boolean }> = [
    { id: 'messages', label: currentSession ? '💬 Activity' : '💬 Thoughts', show: true },
    { id: 'extend', label: '⏱ Extend', show: !!currentSession },
    { id: 'newsession', label: '🎯 New Session', show: !currentSession },
  ];

  tabs.filter((t) => t.show).forEach(({ id, label }) => {
    const btn = document.createElement('button');
    btn.className = 'returnon-tab-btn' + (currentPanelView === id ? ' active' : '');
    btn.textContent = label;
    btn.addEventListener('click', () => {
      currentPanelView = id;
      renderPanel(widget);
    });
    tabBar.appendChild(btn);
  });
  panel.appendChild(tabBar);

  // Content
  if (currentPanelView === 'messages') {
    renderMessagesContent(panel);
  } else if (currentPanelView === 'extend' && currentSession) {
    renderExtendContent(panel, widget);
  } else if (currentPanelView === 'newsession') {
    renderNewSessionContent(panel, widget);
  }

  widget.appendChild(panel);
  renderWidgetMessages();

  // Close on outside click
  const outsideHandler = (e: MouseEvent) => {
    if (!panel.contains(e.target as Node) && !widgetEl!.contains(e.target as Node)) {
      panel.remove();
      isPanelOpen = false;
      document.removeEventListener('click', outsideHandler);
    }
  };
  setTimeout(() => document.addEventListener('click', outsideHandler), 100);
}

function renderMessagesContent(panel: HTMLElement) {
  // Messages list
  const messages = document.createElement('div');
  messages.id = 'returnon-widget-messages';
  panel.appendChild(messages);

  // Parking area
  const parkingArea = document.createElement('div');
  parkingArea.id = 'returnon-parking-area';

  const parkingLabel = document.createElement('div');
  parkingLabel.id = 'returnon-parking-label';
  parkingLabel.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z"/><path d="M12 16v-4M12 8h.01"/></svg> Park a thought`;

  const textarea = document.createElement('textarea');
  textarea.id = 'returnon-parking-textarea';
  textarea.placeholder = 'Jot a thought to revisit later…';

  const submitBtn = document.createElement('button');
  submitBtn.id = 'returnon-parking-submit';
  submitBtn.textContent = 'Park it';
  submitBtn.disabled = true;

  textarea.addEventListener('input', () => { submitBtn.disabled = !textarea.value.trim(); });
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      submitParkedThought(textarea, submitBtn);
    }
  });
  submitBtn.addEventListener('click', () => submitParkedThought(textarea, submitBtn));

  parkingArea.appendChild(parkingLabel);
  parkingArea.appendChild(textarea);
  parkingArea.appendChild(submitBtn);
  panel.appendChild(parkingArea);
}

function renderExtendContent(panel: HTMLElement, widget: HTMLElement) {
  const area = document.createElement('div');
  area.id = 'returnon-extend-area';

  const label = document.createElement('div');
  label.className = 'returnon-extend-label';
  label.textContent = 'Add time to session';
  area.appendChild(label);

  const hint = document.createElement('div');
  hint.className = 'returnon-hint-text';
  hint.textContent = 'Allowed sites and apps stay the same. Default from settings shown.';
  area.appendChild(hint);

  let selectedPreset = 25;

  // Read default from storage
  chrome.storage.local.get(['returnon_default_duration'], (res) => {
    if (res.returnon_default_duration) {
      selectedPreset = res.returnon_default_duration;
      renderPresets();
    }
  });

  const presetsDiv = document.createElement('div');
  presetsDiv.className = 'returnon-extend-presets';

  function renderPresets() {
    presetsDiv.innerHTML = '';
    [5, 10, 15, selectedPreset].filter((v, i, a) => a.indexOf(v) === i).forEach((p) => {
      const btn = document.createElement('button');
      btn.className = 'returnon-preset-btn' + (selectedPreset === p ? ' selected' : '');
      btn.textContent = `+${p} min`;
      btn.addEventListener('click', () => {
        selectedPreset = p;
        customInput.value = '';
        renderPresets();
      });
      presetsDiv.appendChild(btn);
    });
  }
  renderPresets();
  area.appendChild(presetsDiv);

  const customRow = document.createElement('div');
  customRow.className = 'returnon-extend-custom-row';
  const customInput = document.createElement('input');
  customInput.type = 'number';
  customInput.min = '1';
  customInput.placeholder = 'Custom';
  customInput.addEventListener('input', () => { if (customInput.value) selectedPreset = -1; });
  const unitSpan = document.createElement('span');
  unitSpan.textContent = 'min';
  customRow.appendChild(customInput);
  customRow.appendChild(unitSpan);
  area.appendChild(customRow);

  const extendBtn = document.createElement('button');
  extendBtn.className = 'returnon-action-btn';
  extendBtn.textContent = 'Extend Session';
  extendBtn.addEventListener('click', () => {
    const mins = customInput.value ? parseInt(customInput.value) : selectedPreset;
    if (!mins || mins < 1 || !currentSession) return;
    extendBtn.disabled = true;
    extendBtn.textContent = 'Extending…';

    const extension = { added_minutes: mins, extended_at: new Date().toISOString() };
    const updatedExtensions = [...(currentSession.extensions ?? []), extension];
    const newEndMinutes = currentSession.end_minutes + mins;
    const updatedSession = { ...currentSession, end_minutes: newEndMinutes, extensions: updatedExtensions };

    chrome.runtime.sendMessage({ type: 'SESSION_EXTEND', session: updatedSession }, () => {
      chrome.runtime.lastError;
    });
    chrome.storage.local.set({ returnon_session: updatedSession });
    currentSession = updatedSession;

    addWidgetMessage(`Session extended by ${mins} min`, 'success');
    extendBtn.textContent = '✓ Extended!';
    setTimeout(() => {
      currentPanelView = 'messages';
      renderPanel(widget);
    }, 1200);
  });
  area.appendChild(extendBtn);

  panel.appendChild(area);
}

function renderNewSessionContent(panel: HTMLElement, widget: HTMLElement) {
  const area = document.createElement('div');
  area.id = 'returnon-newsession-area';

  const infoNote = document.createElement('div');
  infoNote.className = 'returnon-info-note';
  infoNote.textContent = 'Allowed sites, apps and reminder tolerance are taken from your last session. Configure them fully in the app.';
  area.appendChild(infoNote);

  const goalLabel = document.createElement('div');
  goalLabel.className = 'returnon-field-label';
  goalLabel.textContent = 'Session Goal';
  area.appendChild(goalLabel);

  const goalInput = document.createElement('input');
  goalInput.type = 'text';
  goalInput.className = 'returnon-text-input';
  goalInput.placeholder = 'e.g. Write Q3 report intro';
  area.appendChild(goalInput);

  const durLabel = document.createElement('div');
  durLabel.className = 'returnon-field-label';
  durLabel.textContent = 'Duration (from settings default)';
  area.appendChild(durLabel);

  let selectedDur = 25;

  // Read default duration from storage
  chrome.storage.local.get(['returnon_default_duration'], (res) => {
    if (res.returnon_default_duration) {
      selectedDur = res.returnon_default_duration;
      renderDurPresets();
    }
  });

  const durPresetsDiv = document.createElement('div');
  durPresetsDiv.className = 'returnon-dur-presets';

  function renderDurPresets() {
    durPresetsDiv.innerHTML = '';
    [15, 25, selectedDur].filter((v, i, a) => a.indexOf(v) === i && v > 0).forEach((p) => {
      const btn = document.createElement('button');
      btn.className = 'returnon-preset-btn' + (selectedDur === p ? ' selected' : '');
      btn.textContent = `${p} min`;
      btn.addEventListener('click', () => {
        selectedDur = p;
        durCustomInput.value = '';
        renderDurPresets();
      });
      durPresetsDiv.appendChild(btn);
    });
  }
  renderDurPresets();
  area.appendChild(durPresetsDiv);

  const durCustomRow = document.createElement('div');
  durCustomRow.className = 'returnon-extend-custom-row';
  const durCustomInput = document.createElement('input');
  durCustomInput.type = 'number';
  durCustomInput.min = '1';
  durCustomInput.placeholder = 'Custom';
  durCustomInput.addEventListener('input', () => { if (durCustomInput.value) selectedDur = -1; });
  const durUnit = document.createElement('span');
  durUnit.textContent = 'min';
  durCustomRow.appendChild(durCustomInput);
  durCustomRow.appendChild(durUnit);
  area.appendChild(durCustomRow);

  const startBtn = document.createElement('button');
  startBtn.className = 'returnon-action-btn';
  startBtn.textContent = 'Start Session';
  startBtn.addEventListener('click', async () => {
    const goal = goalInput.value.trim();
    if (!goal) { goalInput.style.borderColor = '#ef4444'; goalInput.focus(); return; }
    goalInput.style.borderColor = '';
    const mins = durCustomInput.value ? parseInt(durCustomInput.value) : selectedDur;
    if (!mins || mins < 1) return;

    startBtn.disabled = true;
    startBtn.textContent = 'Starting…';

    // Get last session data for allowed sites/tolerance
    chrome.storage.local.get(['returnon_supabase_token', 'returnon_user_id'], async (res) => {
      const token = res.returnon_supabase_token as string | undefined;
      const userId = res.returnon_user_id as string | undefined;
      if (!token || !userId) {
        startBtn.disabled = false;
        startBtn.textContent = 'Start Session';
        addWidgetMessage('Please open the app to log in first.', 'warn');
        return;
      }

      const supabaseUrl = 'https://xzqgauucrhgfcwkgwapn.supabase.co';
      const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6cWdhdXVjcmhnZmN3a2d3YXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxNzk3NjIsImV4cCI6MjA5NDc1NTc2Mn0.1HZIRkIa2jfrvWTrhpB-sEFBcSIlVqQi6sL4-hzy020';

      // Fetch last session for sites/tolerance
      let allowedSites: string[] = [];
      let toleranceSecs = 20;
      try {
        const lastResp = await fetch(
          `${supabaseUrl}/rest/v1/sessions?user_id=eq.${userId}&status=neq.active&select=allowed_sites,tolerance_seconds&order=started_at.desc&limit=1`,
          { headers: { apikey: anonKey, Authorization: `Bearer ${token}` } }
        );
        if (lastResp.ok) {
          const rows = await lastResp.json();
          if (rows?.length) {
            allowedSites = rows[0].allowed_sites ?? [];
            toleranceSecs = rows[0].tolerance_seconds ?? 20;
          }
        }
      } catch { /* silent */ }

      const sessionData = {
        user_id: userId,
        goal,
        end_minutes: mins,
        allowed_sites: allowedSites,
        tolerance_seconds: toleranceSecs,
        status: 'active',
        last_allowed_url: allowedSites[0] ? (allowedSites[0].startsWith('http') ? allowedSites[0] : 'https://' + allowedSites[0]) : '',
        started_at: new Date().toISOString(),
        extensions: [],
      };

      try {
        const resp = await fetch(`${supabaseUrl}/rest/v1/sessions`, {
          method: 'POST',
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          body: JSON.stringify(sessionData),
        });
        if (!resp.ok) throw new Error('DB error');
        const rows = await resp.json();
        const newSession = { ...sessionData, id: rows[0].id };

        chrome.storage.local.set({ returnon_session: newSession });
        chrome.runtime.sendMessage({ type: 'SESSION_START', session: newSession });
        currentSession = newSession;
        snoozeCount = 0;
        updateWidgetFaceStyle();
        addWidgetMessage(`Session started: "${goal}"`, 'success');
        currentPanelView = 'messages';
        renderPanel(widget);
        startIdleTracking();
      } catch {
        startBtn.disabled = false;
        startBtn.textContent = 'Start Session';
        addWidgetMessage('Failed to start session. Try in the app.', 'warn');
      }
    });
  });
  area.appendChild(startBtn);

  panel.appendChild(area);
}

function submitParkedThought(textarea: HTMLTextAreaElement, btn: HTMLButtonElement) {
  const content = textarea.value.trim();
  if (!content) return;
  btn.textContent = 'Parking…';
  btn.disabled = true;

  chrome.runtime.sendMessage({ type: 'PARK_THOUGHT', content }, (resp) => {
    if (resp?.ok) {
      textarea.value = '';
      btn.textContent = 'Park it';
      btn.disabled = true;
      addWidgetMessage(`Thought parked: "${content.slice(0, 40)}${content.length > 40 ? '…' : ''}"`, 'success');
      updateWidgetBadge((parseInt(document.getElementById('returnon-widget-badge')?.textContent ?? '0') || 0) + 1);
    } else {
      btn.textContent = 'Park it';
      btn.disabled = false;
      addWidgetMessage('Could not park thought — are you logged in?', 'warn');
    }
  });
}

// ──────────────────────────────────────────────
// Session lifecycle
// ──────────────────────────────────────────────
function onSessionStart(session: typeof currentSession) {
  currentSession = session;
  updateWidgetFaceStyle();
  // Rerender open panel if any
  if (isPanelOpen && widgetEl) {
    currentPanelView = 'messages';
    renderPanel(widgetEl);
  }
}

function onSessionEnd() {
  currentSession = null;
  updateWidgetFaceStyle();
  if (isPanelOpen && widgetEl) {
    currentPanelView = 'messages';
    renderPanel(widgetEl);
  }
}

// ──────────────────────────────────────────────
// Message listener
// ──────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'SHOW_REMINDER') showReminder();
  if (message.type === 'HIDE_REMINDER') hideReminder();

  if (message.type === 'SESSION_START') {
    snoozeCount = 0;
    startIdleTracking();
    onSessionStart(message.session);
    addWidgetMessage(`Session started: "${message.session.goal}"`, 'success');
  }

  if (message.type === 'SESSION_END') {
    hideReminder();
    stopIdleTracking();
    onSessionEnd();
    addWidgetMessage('Session ended.', '');
  }

  if (message.type === 'SESSION_EXTEND') {
    if (message.session) {
      currentSession = message.session;
      const added = message.session.extensions?.slice(-1)[0]?.added_minutes ?? 0;
      addWidgetMessage(`Session extended by ${added} min`, 'success');
    }
  }

  if (message.type === 'SHOW_IDLE_REMINDER') {
    addWidgetMessage('You seem idle — are you still working?', 'warn');
    showReminder();
  }

  if (message.type === 'COUNTDOWN_WARNING') {
    addWidgetMessage(`${message.seconds}s before reminder`, 'warn');
  }
});

// ──────────────────────────────────────────────
// Initialise — always create widget, session or not
// ──────────────────────────────────────────────
chrome.storage.local.get(['returnon_session', 'returnon_default_duration'], (result) => {
  const s = result.returnon_session;
  if (s && s.status === 'active') {
    const end = new Date(s.started_at).getTime() + s.end_minutes * 60 * 1000;
    if (Date.now() < end) {
      currentSession = s;
      startIdleTracking();
    }
  }
  // Always create the widget, regardless of session state
  ensureWidget();
});
