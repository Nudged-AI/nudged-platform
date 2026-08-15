import { BrowserWindow, screen } from 'electron';
import path from 'path';

const isDev = process.env.NODE_ENV === 'development';

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;

export function createMainWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#f9fafb',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/renderer/index.html'));
  }

  mainWindow.on('closed', () => { mainWindow = null; });

  return mainWindow;
}

export function createOverlayWindow(): BrowserWindow {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;

  // Fixed size: wide enough for the panel (300px) + padding, tall enough for
  // the widget bar + parked-thought panel stacked above it.
  const W = 340;
  const H = 480;

  overlayWindow = new BrowserWindow({
    width: W,
    height: H,
    x: sw - W - 12,
    y: sh - H - 12,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  if (isDev) {
    overlayWindow.loadURL('http://localhost:5174');
  } else {
    overlayWindow.loadFile(path.join(__dirname, '../dist/overlay/overlay.html'));
  }

  overlayWindow.on('closed', () => { overlayWindow = null; });

  return overlayWindow;
}

export function getMainWindow(): BrowserWindow | null { return mainWindow; }
export function getOverlayWindow(): BrowserWindow | null { return overlayWindow; }

export function showOverlay(): void {
  if (!overlayWindow) createOverlayWindow();
  overlayWindow?.show();
}

export function hideOverlay(): void {
  // Keep the overlay window visible but just send a session-ended event.
  // The overlay will render the idle/no-session state instead of hiding.
}

export function setOverlaySize(width: number, height: number): void {
  overlayWindow?.setSize(width, height);
}

export function setOverlayPosition(x: number, y: number): void {
  overlayWindow?.setPosition(Math.round(x), Math.round(y));
}

export function sendToOverlay(channel: string, ...args: unknown[]): void {
  overlayWindow?.webContents.send(channel, ...args);
}

export function sendToMain(channel: string, ...args: unknown[]): void {
  mainWindow?.webContents.send(channel, ...args);
}
