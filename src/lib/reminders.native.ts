import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export * from './reminders.shared';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

export const remindersSupported = true;

/** Replace all scheduled reminders with these (daily, local on the phone). */
export async function scheduleReminders(list: { title: string; body: string; time: string; route?: string }[], ask = false): Promise<'ok' | 'denied' | 'unsupported'> {
  let perm = await Notifications.getPermissionsAsync();
  if (!perm.granted && ask) perm = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: false, allowSound: true } });
  const ok = perm.granted || perm.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  if (!ok) return 'denied';
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('reminders', { name: 'Reminders', importance: Notifications.AndroidImportance.HIGH });
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const r of list) {
    const [hour, minute] = r.time.split(':').map(Number);
    await Notifications.scheduleNotificationAsync({
      content: { title: r.title, body: r.body, data: { route: r.route } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: 'reminders' },
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
