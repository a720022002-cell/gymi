import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { pokeReminders, type Reminder } from './reminders.shared';

export * from './reminders.shared';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

export const remindersSupported = true;
const PREFIX = 'adro-rem-';
// Older versions scheduled reminders with random ids; clear those once too.
const LEGACY = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;
const OUR_ROUTES = ['/home', '/water', '/food', '/train', '/vitamins'];

/** Is Adro allowed to show notifications? 'undetermined' = never asked yet. */
export async function notifPermission(): Promise<'granted' | 'denied' | 'undetermined' | 'unsupported'> {
  const perm = await Notifications.getPermissionsAsync().catch(() => null);
  if (!perm) return 'unsupported';
  if (perm.granted || perm.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return 'granted';
  return perm.canAskAgain && perm.status !== 'denied' ? 'undetermined' : 'denied';
}

/** Ask the phone once (at the end of sign-up); answers whether reminders can show. */
export async function askNotifPermission(): Promise<boolean> {
  try {
    let perm = await Notifications.getPermissionsAsync();
    if (perm.granted) return true;
    if (perm.canAskAgain) perm = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: false, allowSound: true } });
    const ok = perm.granted || perm.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
    // Just allowed: schedule what's already set.
    if (ok) pokeReminders();
    return ok;
  } catch {
    return false;
  }
}

/** Replace all scheduled reminders with these (daily, weekly, monthly, yearly or once on a date; local on the phone). */
export async function scheduleReminders(list: Reminder[], ask = false): Promise<'ok' | 'denied' | 'unsupported'> {
  let perm = await Notifications.getPermissionsAsync();
  if (!perm.granted && ask) perm = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: false, allowSound: true } });
  const ok = perm.granted || perm.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  if (!ok) return 'denied';
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', { name: 'Reminders', importance: Notifications.AndroidImportance.HIGH });
    // Android plays the channel's sound, so reminders set to silent go on their own channel without one.
    await Notifications.setNotificationChannelAsync('reminders-silent', { name: 'Silent reminders', importance: Notifications.AndroidImportance.HIGH, sound: null, enableVibrate: false });
  }
  // Only replace our own reminders (cycle and coach notifications have their own ids).
  const mine = (await Notifications.getAllScheduledNotificationsAsync()).filter(
    (n) => n.identifier.startsWith(PREFIX) || (LEGACY.test(n.identifier) && OUR_ROUTES.includes(String(n.content.data?.route))),
  );
  await Promise.all(mine.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})));
  let i = 0;
  for (const r of list) {
    const [hour, minute] = r.time.split(':').map(Number);
    const channelId = r.sound === false ? 'reminders-silent' : 'reminders';
    const T = Notifications.SchedulableTriggerInputTypes;
    let trigger: Notifications.SchedulableNotificationTriggerInput;
    if (r.date) {
      // Once, on that day: skipped when the time has passed.
      const [y, mo, d] = r.date.split('-').map(Number);
      const at = new Date(y, mo - 1, d, hour, minute);
      if (at.getTime() <= Date.now()) continue;
      trigger = { type: T.DATE, date: at, channelId };
    } else if (r.weekday) trigger = { type: T.WEEKLY, weekday: r.weekday, hour, minute, channelId };
    else if (r.monthDay && r.month) trigger = { type: T.YEARLY, month: r.month - 1, day: r.monthDay, hour, minute, channelId };
    else if (r.monthDay) trigger = { type: T.MONTHLY, day: r.monthDay, hour, minute, channelId };
    else trigger = { type: T.DAILY, hour, minute, channelId };
    await Notifications.scheduleNotificationAsync({
      identifier: `${PREFIX}${i++}`,
      content: { title: r.title, body: r.body, data: { route: r.route }, sound: r.sound !== false },
      trigger,
    }).catch(() => {});
  }
  return 'ok';
}

/** Signing out: every notification Adro scheduled on this phone stops (the next person here mustn't get yours). */
export async function cancelAllReminders() {
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
}

/** Open the right screen when a reminder is tapped. */
export function listenReminderTaps(go: (route: string) => void) {
  const sub = Notifications.addNotificationResponseReceivedListener((r) => {
    // Message notifications (from the server) are opened by PushSync.
    if (r.notification.request.content.data?.type === 'coach_message') return;
    const route = r.notification.request.content.data?.route;
    if (typeof route === 'string') go(route);
  });
  return () => sub.remove();
}
