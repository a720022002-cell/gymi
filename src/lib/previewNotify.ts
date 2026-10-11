// Web: a browser notification when allowed; otherwise the screen shows the preview itself.
export async function previewNotification(title: string, body: string): Promise<'ok' | 'denied' | 'unsupported'> {
  const N = (globalThis as { Notification?: { permission: string; requestPermission: () => Promise<string>; new (t: string, o?: { body?: string }): unknown } }).Notification;
  if (!N) return 'unsupported';
  const p = N.permission === 'granted' ? 'granted' : await N.requestPermission().catch(() => 'denied');
  if (p !== 'granted') return 'denied';
  try {
    new N(title, { body });
    return 'ok';
  } catch {
    return 'unsupported';
  }
}
