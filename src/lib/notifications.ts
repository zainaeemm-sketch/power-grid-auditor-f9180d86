/**
 * Browser notification + sound alert for long-running batch completions.
 */

let notificationPermission: NotificationPermission = 'default';

export async function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    notificationPermission = 'granted';
    return;
  }
  if (Notification.permission !== 'denied') {
    const perm = await Notification.requestPermission();
    notificationPermission = perm;
  }
}

export function sendBrowserNotification(title: string, body?: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  // Only notify when tab is not focused
  if (document.visibilityState === 'visible') return;
  try {
    new Notification(title, { body, icon: '/favicon.ico' });
  } catch {
    // Notification constructor may fail in some contexts
  }
}

export function playCompletionSound() {
  if (typeof window === 'undefined') return;
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    // Two-tone chime
    osc.frequency.setValueAtTime(587, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(784, ctx.currentTime + 0.15); // G5
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
