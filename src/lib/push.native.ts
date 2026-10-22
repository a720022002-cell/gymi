import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from './supabase';

/** Phone apps get message notifications from the server (Expo push). */
export const pushSupported = true;

export type PushSettings = { messages: boolean; quiet: { on: boolean; from: string; to: string } | null };

// This phone's token once known, so signing out can remove it without asking Expo again.
let current: string | null = null;

const projectId = (): string | undefined => Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

async function allowed() {
  const perm = await Notifications.getPermissionsAsync();
  return perm.granted || perm.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

/**
 * Save this phone's push token for the signed-in person, with their message settings. Never asks for permission
 * (that happens at the end of sign-up and in Notifications); answers whether the phone is registered.
 */
export async function registerPush(s: PushSettings): Promise<boolean> {
  try {
    if (!(await allowed())) return false;
    const id = projectId();
    // No EAS project id yet (run "eas init" once): no push, local reminders still work.
    if (!id) return false;
    if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('messages', { name: 'Messages', importance: Notifications.AndroidImportance.HIGH });
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    current = token;
    let tz: string | null = null;
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
    } catch {}
    const { data } = await supabase.rpc('save_push_token', { p_token: token, p_platform: Platform.OS, p_messages: s.messages, p_quiet: s.quiet, p_tz: tz });
    return data === true;
  } catch {
    // Offline or Expo unreachable: tried again next time the app opens.
    return false;
  }
}

/** Signing out: this phone stops getting the person's messages. Call before signing out (needs the session). */
export async function unregisterPush() {
  try {
    let token = current;
    const id = projectId();
    if (!token && id && (await allowed())) token = (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
    if (token) await supabase.from('push_tokens').delete().eq('token', token);
  } catch {}
  current = null;
}

type Tap = { id: string; route: string };
const tapOf = (r: Notifications.NotificationResponse | null): Tap | null => {
  const data = r?.notification.request.content.data as { type?: unknown; route?: unknown } | undefined;
  if (!r || data?.type !== 'coach_message' || typeof data.route !== 'string' || !data.route.startsWith('/thread')) return null;
  return { id: r.notification.request.identifier, route: data.route };
};
const handled = new Set<string>();

/** Tapping a message notification opens that chat, also when the tap started the app. */
export function listenPushTaps(go: (route: string) => void) {
  const open = (t: Tap | null) => {
    if (!t || handled.has(t.id)) return;
    handled.add(t.id);
    go(t.route);
  };
  open(tapOf(Notifications.getLastNotificationResponse()));
  const sub = Notifications.addNotificationResponseReceivedListener((r) => open(tapOf(r)));
  return () => sub.remove();
}
