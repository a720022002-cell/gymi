// Phones: show a sample reminder in a few seconds, so you can see what it looks like.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export async function previewNotification(title: string, body: string): Promise<'ok' | 'denied' | 'unsupported'> {
  let perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) perm = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: false, allowSound: true } });
  if (!perm.granted && perm.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL) return 'denied';
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('reminders', { name: 'Reminders', importance: Notifications.AndroidImportance.HIGH });
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data: { route: '/vitamins' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3, channelId: 'reminders' },
  });
  return 'ok';
}
