/**
 * Browser notification + sound alert for long-running batch completions.
 */

const SOUND_KEY = 'gridarena-sound-enabled';
const BROWSER_NOTIF_KEY = 'gridarena-browser-notif-enabled';

export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const val = localStorage.getItem(SOUND_KEY);
  return val === null ? true : val === 'true';
}

export function setSoundEnabled(enabled: boolean) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SOUND_KEY, String(enabled));
}

export function isBrowserNotifEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const val = localStorage.getItem(BROWSER_NOTIF_KEY);
  return val === null ? true : val === 'true';
}

export function setBrowserNotifEnabled(enabled: boolean) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(BROWSER_NOTIF_KEY, String(enabled));
}

export async function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'granted') return;
  if (Notification.permission !== 'denied') {
    await Notification.requestPermission();
  }
}

export function sendBrowserNotification(title: string, body?: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (!isBrowserNotifEnabled()) return;
  if (Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible') return;
  try {
    new Notification(title, { body, icon: '/favicon.ico' });
  } catch {
    // Notification constructor may fail in some contexts
  }
}

export function playCompletionSound() {
  if (typeof window === 'undefined') return;
  if (!isSoundEnabled()) return;
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587, ctx.currentTime);
    osc.frequency.setValueAtTime(784, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // AudioContext may not be available
  }
}

export function notifyBatchComplete(succeeded: number, failed: number) {
  playCompletionSound();
  sendBrowserNotification(
    'Batch execution complete',
    `${succeeded} succeeded, ${failed} failed`
  );
}
