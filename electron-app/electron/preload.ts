import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // User
  getUser: () => ipcRenderer.invoke('user:get'),

  // Sessions
  sessionStart: (payload: unknown) => ipcRenderer.invoke('session:start', payload),
  sessionEnd: (payload: unknown) => ipcRenderer.invoke('session:end', payload),
  sessionExtend: (payload: unknown) => ipcRenderer.invoke('session:extend', payload),
  sessionGetActive: () => ipcRenderer.invoke('session:get-active'),

  // DB reads
  dbSessionsList: (args: unknown) => ipcRenderer.invoke('db:sessions:list', args),
  dbSessionsGet: (args: unknown) => ipcRenderer.invoke('db:sessions:get', args),
  dbThoughtsList: (args: unknown) => ipcRenderer.invoke('db:thoughts:list', args),
  dbThoughtsUpdate: (args: unknown) => ipcRenderer.invoke('db:thoughts:update', args),
  dbThoughtsDelete: (args: unknown) => ipcRenderer.invoke('db:thoughts:delete', args),
  dbThoughtsBulkTheme: (args: unknown) => ipcRenderer.invoke('db:thoughts:bulk-theme', args),

  // Settings
  settingsGet: () => ipcRenderer.invoke('settings:get'),
  settingsSet: (partial: unknown) => ipcRenderer.invoke('settings:set', partial),

  // Window info
  windowGetActive: () => ipcRenderer.invoke('window:get-active'),

  // Push events from main to renderer
  onSessionChanged: (cb: (session: unknown) => void) => {
    const handler = (_: Electron.IpcRendererEvent, session: unknown) => cb(session);
    ipcRenderer.on('app:session-changed', handler);
    return () => ipcRenderer.removeListener('app:session-changed', handler);
  },

  onSessionTimeUp: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on('app:session-time-up', handler);
    return () => ipcRenderer.removeListener('app:session-time-up', handler);
  },

  onBadgesEarned: (cb: (badges: string[]) => void) => {
    const handler = (_: Electron.IpcRendererEvent, badges: string[]) => cb(badges);
    ipcRenderer.on('app:badges-earned', handler);
    return () => ipcRenderer.removeListener('app:badges-earned', handler);
  },
});

contextBridge.exposeInMainWorld('debugAPI', {
  chromeTest: () => ipcRenderer.invoke('debug:chrome-test'),
});

// Overlay-specific API (only used in overlay window)
contextBridge.exposeInMainWorld('overlayAPI', {
  snooze: (seconds: number) => ipcRenderer.invoke('overlay:snooze', seconds),
  addApp: (args: unknown) => ipcRenderer.invoke('overlay:add-app', args),
  parkThought: (args: unknown) => ipcRenderer.invoke('overlay:park-thought', args),
  userReturned: () => ipcRenderer.invoke('overlay:user-returned'),
  setPosition: (args: unknown) => ipcRenderer.invoke('overlay:set-position', args),
  getActiveWindow: () => ipcRenderer.invoke('window:get-active'),

  onShowReminder: (cb: (data: unknown) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: unknown) => cb(data);
    ipcRenderer.on('overlay:show-reminder', handler);
    return () => ipcRenderer.removeListener('overlay:show-reminder', handler);
  },
  onHideReminder: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on('overlay:hide-reminder', handler);
    return () => ipcRenderer.removeListener('overlay:hide-reminder', handler);
  },
  onShowIdle: (cb: (data: unknown) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: unknown) => cb(data);
    ipcRenderer.on('overlay:show-idle', handler);
    return () => ipcRenderer.removeListener('overlay:show-idle', handler);
  },
  onSessionStarted: (cb: (session: unknown) => void) => {
    const handler = (_: Electron.IpcRendererEvent, session: unknown) => cb(session);
    ipcRenderer.on('overlay:session-started', handler);
    return () => ipcRenderer.removeListener('overlay:session-started', handler);
  },
  onSessionEnded: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on('overlay:session-ended', handler);
    return () => ipcRenderer.removeListener('overlay:session-ended', handler);
  },
  onTimerTick: (cb: (data: unknown) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: unknown) => cb(data);
    ipcRenderer.on('overlay:timer-tick', handler);
    return () => ipcRenderer.removeListener('overlay:timer-tick', handler);
  },
  onMessage: (cb: (data: unknown) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: unknown) => cb(data);
    ipcRenderer.on('overlay:message', handler);
    return () => ipcRenderer.removeListener('overlay:message', handler);
  },

  onSessionExtended: (cb: (data: unknown) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: unknown) => cb(data);
    ipcRenderer.on('overlay:session-extended', handler);
    return () => ipcRenderer.removeListener('overlay:session-extended', handler);
  },

  sessionStart: (payload: unknown) => ipcRenderer.invoke('session:start', payload),
  sessionExtend: (payload: unknown) => ipcRenderer.invoke('session:extend', payload),
  sessionEnd: (payload: unknown) => ipcRenderer.invoke('session:end', payload),
  settingsGet: () => ipcRenderer.invoke('settings:get'),
  settingsSet: (partial: unknown) => ipcRenderer.invoke('settings:set', partial),
  dbSessionsList: (args: unknown) => ipcRenderer.invoke('db:sessions:list', args),
  getScreenSize: () => ipcRenderer.invoke('overlay:get-screen-size'),

  onSessionTimeUp: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on('overlay:session-time-up', handler);
    return () => ipcRenderer.removeListener('overlay:session-time-up', handler);
  },

  onBadgesEarned: (cb: (badges: string[]) => void) => {
    const handler = (_: Electron.IpcRendererEvent, badges: string[]) => cb(badges);
    ipcRenderer.on('overlay:badges-earned', handler);
    return () => ipcRenderer.removeListener('overlay:badges-earned', handler);
  },
});
