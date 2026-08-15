import { powerMonitor } from 'electron';
import { isIdleExempt, getCurrentWindow } from './window-tracker';

const IDLE_THRESHOLD_SECONDS = 60;
const IDLE_COOLDOWN_MS = 90 * 1000;

let idleCheckInterval: ReturnType<typeof setInterval> | null = null;
let lastIdleReminderAt = 0;
let onIdleCallback: (() => void) | null = null;

export function startIdleDetection(onIdle: () => void): void {
  if (idleCheckInterval) return;
  onIdleCallback = onIdle;

  idleCheckInterval = setInterval(() => {
    const idleSeconds = powerMonitor.getSystemIdleTime();
    if (idleSeconds < IDLE_THRESHOLD_SECONDS) return;

    const now = Date.now();
    if (now - lastIdleReminderAt < IDLE_COOLDOWN_MS) return;

    const activeWindow = getCurrentWindow();
    if (isIdleExempt(activeWindow)) return;

    lastIdleReminderAt = now;
    onIdleCallback?.();
  }, 10_000);
}

export function stopIdleDetection(): void {
  if (idleCheckInterval) { clearInterval(idleCheckInterval); idleCheckInterval = null; }
  onIdleCallback = null;
  lastIdleReminderAt = 0;
}

export function resetIdleCooldown(): void {
  lastIdleReminderAt = 0;
}
