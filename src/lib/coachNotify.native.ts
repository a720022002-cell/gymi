import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { CoachNotif } from './coaching';

export type CoachAlertTexts = { dailyTitle: string; dailyBody: string; weeklyTitle: string; weeklyBody: string };

const DAILY = 'gymi-coach-daily';
const WEEKLY = 'gymi-coach-weekly';
const mins = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** A time inside quiet hours moves to when quiet hours end. */
function outsideQuiet(t: string, q: CoachNotif['quiet']) {
  if (!q.on) return t;
  const x = mins(t);
  const a = mins(q.from);
  const b = mins(q.to);
  const inside = a <= b ? x >= a && x < b : x >= a || x < b;
  return inside ? q.to : t;
}

/** Phone: schedule the coach's daily summary and weekly ranking as local notifications (only ours are replaced). */
export async function syncCoachAlerts(n: CoachNotif, texts: CoachAlertTexts, ask = false): Promise<'ok' | 'denied' | 'unsupported'> {
  await Notifications.cancelScheduledNotificationAsync(DAILY).catch(() => {});
  await Notifications.cancelScheduledNotificationAsync(WEEKLY).catch(() => {});
  if (!n.on || (!n.daily.on && !n.weekly.on)) return 'ok';
  let perm = await Notifications.getPermissionsAsync();
  if (!perm.granted && ask) perm = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: false, allowSound: true } });
  const ok = perm.granted || perm.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  if (!ok) return 'denied';
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('coach', { name: 'Coach', importance: Notifications.AndroidImportance.DEFAULT });
  if (n.daily.on) {
    const [hour, minute] = outsideQuiet(n.daily.t, n.quiet).split(':').map(Number);
    await Notifications.scheduleNotificationAsync({
      identifier: DAILY,
      content: { title: texts.dailyTitle, body: texts.dailyBody, data: { route: '/cclients' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: 'coach' },
    });
  }
  if (n.weekly.on) {
    const [hour, minute] = outsideQuiet(n.weekly.t, n.quiet).split(':').map(Number);
    await Notifications.scheduleNotificationAsync({
      identifier: WEEKLY,
      content: { title: texts.weeklyTitle, body: texts.weeklyBody, data: { route: '/cclients' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: n.weekly.day + 1, hour, minute, channelId: 'coach' },
    });
  }
  return 'ok';
}
