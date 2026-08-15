import { execSync, execFileSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

export interface ActiveWindowInfo {
  appName: string;
  bundleId: string;
  title: string;
  url?: string;
}

let pollInterval: ReturnType<typeof setInterval> | null = null;
let onChangeCallback: ((info: ActiveWindowInfo | null) => void) | null = null;
// Include URL in key so Chrome tab switches trigger re-evaluation
let lastKey = '';

// Only Chrome is treated as a "transparent" browser.
export const CHROME_BUNDLE_ID = 'com.google.Chrome';

export const IDLE_EXEMPT_BUNDLE_IDS = new Set([
  'com.tinyspeck.slackmacgui',
  'com.microsoft.teams2',
  'com.microsoft.teams',
  'us.zoom.xos',
  'com.apple.FaceTime',
  'com.webex.meetingmanager',
]);

export const IDLE_EXEMPT_APP_NAMES = new Set([
  'Slack',
  'Microsoft Teams',
  'Zoom',
  'FaceTime',
  'Webex',
]);

/**
 * Run an AppleScript by writing it to a temp file and executing with `osascript`.
 * This avoids all shell-escaping issues that plague the -e flag approach.
 */
function runAppleScript(script: string, timeoutMs = 3000): string {
  const tmpFile = join(tmpdir(), `ro_${Date.now()}_${Math.random().toString(36).slice(2)}.scpt`);
  try {
    writeFileSync(tmpFile, script, 'utf8');
    const result = execFileSync('osascript', [tmpFile], {
      timeout: timeoutMs,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result.toString().trim();
  } finally {
    try { unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

function getChromeFrontTabUrl(): string {
  try {
    return runAppleScript(`tell application "Google Chrome" to get URL of active tab of front window`);
  } catch {
    return '';
  }
}

/**
 * Returns all tab URLs currently open in Chrome across all windows,
 * ordered by window index (front window first) then tab index.
 */
export function getAllChromeTabUrls(): string[] {
  try {
    const script = `
tell application "Google Chrome"
  set tabUrls to {}
  repeat with w in windows
    repeat with t in tabs of w
      set end of tabUrls to URL of t
    end repeat
  end repeat
  return tabUrls
end tell`;
    const raw = runAppleScript(script, 4000);
    if (!raw) return [];
    return raw.split(', ').map((u) => u.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Activate a specific Chrome tab by URL pattern.
 * Searches all windows for a tab whose URL contains `urlPattern`,
 * then brings that window and tab to front.
 * Returns true if found and activated.
 */
export function activateChromeTabByUrl(urlPattern: string): boolean {
  try {
    const script = `
tell application "Google Chrome"
  set found to false
  repeat with w in windows
    set tabIndex to 0
    repeat with t in tabs of w
      set tabIndex to tabIndex + 1
      if URL of t contains "${urlPattern.replace(/"/g, '\\"')}" then
        set active tab index of w to tabIndex
        set index of w to 1
        activate
        set found to true
        exit repeat
      end if
    end repeat
    if found then exit repeat
  end repeat
end tell`;
    runAppleScript(script, 4000);
    return true;
  } catch (e) {
    console.error('[window-tracker] activateChromeTabByUrl failed:', e);
    return false;
  }
}

/**
 * Open a URL in a new Chrome tab (Chrome must already be running).
 * Falls back to `open` command if Chrome invocation fails.
 */
export function openUrlInChrome(url: string): boolean {
  try {
    const script = `
tell application "Google Chrome"
  open location "${url.replace(/"/g, '\\"')}"
  activate
end tell`;
    runAppleScript(script, 4000);
    return true;
  } catch (e) {
    console.error('[window-tracker] openUrlInChrome AppleScript failed, trying open command:', e);
    try {
      execFileSync('open', ['-a', 'Google Chrome', url], { timeout: 3000 });
      return true;
    } catch (e2) {
      console.error('[window-tracker] openUrlInChrome open command also failed:', e2);
      return false;
    }
  }
}

/**
 * Activate a native app by name (macOS).
 */
export function activateApp(appName: string): boolean {
  if (process.platform !== 'darwin') return false;
  try {
    runAppleScript(`tell application "${appName.replace(/"/g, '\\"')}" to activate`, 3000);
    return true;
  } catch (e) {
    console.error('[window-tracker] activateApp failed:', e);
    return false;
  }
}

function getActiveWindowMac(): ActiveWindowInfo | null {
  try {
    const script = `
tell application "System Events"
  set frontApp to first application process whose frontmost is true
  set appName to name of frontApp
  set bundleId to bundle identifier of frontApp
end tell
return appName & "|" & bundleId`;
    const result = runAppleScript(script, 2000);

    const parts = result.split('|');
    if (parts.length < 2) return null;

    const appName = parts[0].trim();
    const bundleId = parts[1].trim();

    let url: string | undefined;
    if (bundleId === CHROME_BUNDLE_ID || appName === 'Google Chrome') {
      const raw = getChromeFrontTabUrl();
      if (raw) url = raw;
    }

    return { appName, bundleId, title: appName, url };
  } catch {
    return null;
  }
}

function getActiveWindowWindows(): ActiveWindowInfo | null {
  try {
    const script = `
Add-Type @"
  using System;
  using System.Runtime.InteropServices;
  using System.Text;
  public class Win32 {
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
  }
"@
$hwnd = [Win32]::GetForegroundWindow()
$pid = 0
[Win32]::GetWindowThreadProcessId($hwnd, [ref]$pid) | Out-Null
$proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
$proc.Name + "|" + $proc.MainWindowTitle
`;
    const result = execSync(`powershell -command "${script}"`, {
      timeout: 2000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).toString().trim();

    const parts = result.split('|');
    return {
      appName: parts[0]?.trim() ?? '',
      bundleId: parts[0]?.trim() ?? '',
      title: parts[1]?.trim() ?? '',
    };
  } catch {
    return null;
  }
}

export function getCurrentWindow(): ActiveWindowInfo | null {
  if (process.platform === 'darwin') return getActiveWindowMac();
  if (process.platform === 'win32') return getActiveWindowWindows();
  return null;
}

export function isChrome(info: ActiveWindowInfo | null): boolean {
  if (!info) return false;
  return info.bundleId === CHROME_BUNDLE_ID || info.appName === 'Google Chrome';
}

export function startWindowTracking(onChange: (info: ActiveWindowInfo | null) => void): void {
  if (pollInterval) return;
  onChangeCallback = onChange;
  pollInterval = setInterval(() => {
    const info = getCurrentWindow();
    const currentKey = isChrome(info) && info?.url
      ? `${info.bundleId}|${info.url}`
      : (info?.bundleId ?? '');
    if (currentKey !== lastKey) {
      lastKey = currentKey;
      onChangeCallback?.(info);
    }
  }, 1000);
}

export function stopWindowTracking(): void {
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
  onChangeCallback = null;
  lastKey = '';
}

export function isIdleExempt(info: ActiveWindowInfo | null): boolean {
  if (!info) return false;
  return IDLE_EXEMPT_BUNDLE_IDS.has(info.bundleId) || IDLE_EXEMPT_APP_NAMES.has(info.appName);
}
