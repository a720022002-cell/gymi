import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/lib/auth';
import { listenPushTaps, pushSupported, registerPush } from '@/lib/push';
import { loadPrefs, onPrefs, onRemindersPoke } from '@/lib/reminders';

// What was last saved (and when), so coming back to the app doesn't save the same thing again.
let last: { key: string; at: number } | null = null;

/**
 * Phone apps: register this phone for message notifications while you're signed in (with your Notifications
 * choices: all off, coach messages off, quiet hours), and open the chat when one is tapped. Does nothing on the web.
 */
export function PushSync() {
  const { session } = useAuth();
  const uid = session?.user.id;
  const [rev, setRev] = useState(0);

  useEffect(() => listenPushTaps((route) => router.push(route as never)), []);
  useEffect(() => onPrefs(() => setRev((r) => r + 1)), []);
  // Notifications just allowed (end of sign-up, or back from the phone's settings): register then.
  useEffect(() => onRemindersPoke(() => setRev((r) => r + 1)), []);
  useEffect(() => {
    if (!pushSupported) return;
    const sub = AppState.addEventListener('change', (st) => st === 'active' && setRev((r) => r + 1));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    // Signed out: the token was removed, so the next sign-in saves it again.
    if (!uid) last = null;
    if (!pushSupported || !uid) return;
    const id = setTimeout(async () => {
      const p = await loadPrefs(uid);
      const settings = { messages: p.on && p.messages.on, quiet: p.quiet.on ? p.quiet : null };
      const key = `${uid}|${JSON.stringify(settings)}`;
      if (last?.key === key && Date.now() - last.at < 6 * 3600e3) return;
      if (await registerPush(settings)) last = { key, at: Date.now() };
    }, 2000);
    return () => clearTimeout(id);
  }, [uid, rev]);
  return null;
}
