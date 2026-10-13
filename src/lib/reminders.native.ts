import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { Reminder } from './reminders.shared';

export * from './reminders.shared';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

export const remindersSupported = true;
const PREFIX = 'gymi-rem-';
// Older versions scheduled reminders with random ids; clear those once too.
const LEGACY = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;
const OUR_ROUTES = ['/home', '/water', '/food', '/train', '/vitamins'];

/** Replace all scheduled reminders with these (daily, weekly with weekday, or monthly with monthDay; local on the phone). */
export async function scheduleReminders(list: Reminder[], ask = false): Promise<'ok' | 'denied' | 'unsupported'> {
  let perm = await Notifications.getPermissionsAsync();
  if (!perm.granted && ask) perm = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: false, allowSound: true } });
  const ok = perm.granted || perm.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  if (!ok) return 'denied';
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('reminders', { name: 'Reminders', importance: Notifications.AndroidImportance.HIGH });
  // Only replace our own reminders (cycle and coach notifications have their own ids).
  const mine = (await Notifications.getAllScheduledNotificationsAsync()).filter(
    (n) => n.identifier.startsWith(PREFIX) || (LEGACY.test(n.identifier) && OUR_ROUTES.includes(String(n.content.data?.route))),
  );
  await Promise.all(mine.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})));
  let i = 0;
  for (const r of list) {
    const [hour, minute] = r.time.split(':').map(Number);
    await Notifications.scheduleNotificationAsync({
      identifier: `${PREFIX}${i++}`,
      content: { title: r.title, body: r.body, data: { route: r.route }, sound: r.sound !== false },
      trigger: r.weekday
        ? { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: r.weekday, hour, minute, channelId: 'reminders' }
        : r.monthDay
          ? { type: Notifications.SchedulableTriggerInputTypes.MONTHLY, day: r.monthDay, hour, minute, channelId: 'reminders' }
          : { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: 'reminders' },
    });
  }
  return 'ok';
}

/** Open the right screen when a reminder is tapped. */
export function listenReminderTaps(go: (route: string) => void) {
  const sub = Notifications.addNotificationResponseReceivedListener((r) => {
    const route = r.notification.request.content.data?.route;
    if (typeof route === 'string') go(route);
  });
  return () => sub.remove();
}
