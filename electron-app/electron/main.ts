import { app, BrowserWindow, Tray, Menu, nativeImage, dialog, systemPreferences } from 'electron';
import path from 'path';
import { execFileSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { createMainWindow, createOverlayWindow, getMainWindow } from './windows';

function runAppleScript(script: string, timeoutMs = 3000): string {
  const tmpFile = path.join(tmpdir(), `ro_main_${Date.now()}.scpt`);
  try {
    writeFileSync(tmpFile, script, 'utf8');
    return execFileSync('osascript', [tmpFile], { timeout: timeoutMs, stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();
  } finally {
    try { unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}
import { registerIpcHandlers } from './ipc-handlers';
import { restoreSessionIfActive, getActiveSessionState, endSession } from './session-engine';
import { getDb } from './db';
import { getLocalUser } from './local-user';

let tray: Tray | null = null;

function createTray(): void {
  const iconPath = path.join(__dirname, '../public/tray-icon.png');
  let trayIcon: Electron.NativeImage;
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) throw new Error('empty');
  } catch {
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('Return On');
  updateTrayMenu();
}

function updateTrayMenu(): void {
  if (!tray) return;
  const session = getActiveSessionState();

  const menu = Menu.buildFromTemplate([
    {
      label: session ? `Active: ${session.goal.slice(0, 30)}` : 'No active session',
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Open Return On',
      click: () => {
        const win = getMainWindow();
        if (win) { win.show(); win.focus(); } else { createMainWindow(); }
      },
    },
    ...(session ? [
      {
        label: 'End Session',
        click: () => endSession('abandoned'),
      },
    ] : []),
    { type: 'separator' as const },
    {
      label: 'Quit',
      click: () => {
        app.isQuiting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(menu);
}

async function requestAccessibilityPermission(): Promise<void> {
  if (process.platform !== 'darwin') return;

  const trusted = systemPreferences.isTrustedAccessibilityClient(false);
  if (trusted) return;

  const result = await dialog.showMessageBox({
    type: 'info',
    title: 'Accessibility Permission Required',
    message: 'Return On needs Accessibility access to detect which app you\'re using.',
    detail: 'This is how Return On knows when you\'re deviating from your focus session. Click "Open System Settings" to grant access, then re-launch the app.',
    buttons: ['Open System Settings', 'Skip for now'],
    defaultId: 0,
  });

  if (result.response === 0) {
    systemPreferences.isTrustedAccessibilityClient(true);
  }
}

async function requestAutomationPermission(): Promise<void> {
  if (process.platform !== 'darwin') return;

  try {
    runAppleScript(`tell application "Google Chrome" to get name`);
  } catch {
    await dialog.showMessageBox({
      type: 'info',
      title: 'Chrome Automation Permission Required',
      message: 'Return On needs permission to control Google Chrome.',
      detail: 'This lets the Return button bring you back to the right Chrome tab.\n\nGo to: System Settings → Privacy & Security → Automation\nEnable "Google Chrome" under "Return On".\n\nThen re-launch the app.',
      buttons: ['OK'],
    });
  }
}

app.whenReady().then(async () => {
  // Initialize DB early
  getDb();
  getLocalUser();

  // Register all IPC handlers
  registerIpcHandlers();

  // Create main window
  createMainWindow();

  // Create overlay window immediately so widget is always visible
  createOverlayWindow();

  // Create tray
  createTray();

  // Request accessibility permission on macOS
  await requestAccessibilityPermission();

  // Request automation permission for Chrome (needed for tab switching / Return)
  await requestAutomationPermission();

  // Restore any active session from previous run
  setTimeout(async () => {
    await restoreSessionIfActive();
    updateTrayMenu();
  }, 1000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    else { const win = getMainWindow(); win?.show(); win?.focus(); }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  app.isQuiting = true;
});

// Extend app type for isQuiting flag
declare global {
  namespace Electron {
    interface App {
      isQuiting?: boolean;
    }
  }
}
