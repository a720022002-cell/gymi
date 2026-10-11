import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { CycleReminders } from './cycle';
import { addDays } from './nutrition';

export type CyclePlan = { next: string; fertileFrom: string; cycle: number } | null;
export type CycleReminderTexts = { period: string; fertile: string; log: string; visit: string; title: string };

export const cycleRemindersSupported = true;
const PREFIX = 'gymi-cycle-';

/** 9:00 in the morning on a day, if it's still ahead. */
const morning = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  const at = new Date(y, m - 1, d, 9, 0, 0);
  return at.getTime() > Date.now() + 60_000 ? at : null;
};

/**
 * Replace only the cycle reminders (other reminders stay): period coming (2 days before),
 * fertile window (when it starts), daily log at 9 PM, and the next doctor visit (pregnancy).
 * Texts stay discreet because they can show on the lock screen.
 */
export async function scheduleCycleReminders(r: CycleReminders, plan: CyclePlan, texts: CycleReminderTexts, visit?: string | null, ask = false): Promise<'ok' | 'denied' | 'unsupported'> {
  const want = !!(r.period || r.fertile || r.log || visit);
  let perm = await Notifications.getPermissionsAsync();
  if (!perm.granted && ask && want) perm = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: false, allowSound: true } });
  const ok = perm.granted || perm.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  const old = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(old.filter((n) => n.identifier.startsWith(PREFIX)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  if (!want) return 'ok';
  if (!ok) return 'denied';
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('reminders', { name: 'Reminders', importance: Notifications.AndroidImportance.HIGH });
  const at = async (id: string, body: string, date: Date | null) => {
    if (!date) return;
    await Notifications.scheduleNotificationAsync({
      identifier: PREFIX + id,
      content: { title: texts.title, body, data: { route: '/period' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: 'reminders' },
    });
  };
  if (plan && r.period) {
    // This cycle and the next one, so it still works if the app isn't opened for a while.
    await at('period1', texts.period, morning(addDays(plan.next, -2)));
    await at('period2', texts.period, morning(addDays(plan.next, plan.cycle - 2)));
  }
  if (plan && r.fertile) {
    await at('fertile1', texts.fertile, morning(plan.fertileFrom));
    await at('fertile2', texts.fertile, morning(addDays(plan.fertileFrom, plan.cycle)));
  }
  if (visit) await at('visit', texts.visit, morning(addDays(visit, -1)));
  if (r.log)
    await Notifications.scheduleNotificationAsync({
      identifier: PREFIX + 'log',
      content: { title: texts.title, body: texts.log, data: { route: '/period' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 21, minute: 0, channelId: 'reminders' },
    });
  return 'ok';
}
