// Phones: read the watch's newest data in the background (the phone decides when, roughly hourly at best), and send
// one note in the morning about how ready you are, once last night's readings are in.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundTask from 'expo-background-task';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

import { translate } from '@/i18n';

import { type DeviceDay, deviceBrief, illnessCheck, syncInBackground } from './devices';
import { localDay } from './nutrition';
import { loadPrefs } from './reminders.shared';
import { supabase } from './supabase';

const TASK = 'gymi-health-sync';

// Defined when this file loads (the app's first import), so it also runs when the phone wakes Gymi in the background.
TaskManager.defineTask(TASK, async () => {
  try {
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user.id;
    if (!uid) return BackgroundTask.BackgroundTaskResult.Success;
    const days = await syncInBackground(uid);
    if (days) await morningNote(uid, days);
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function startBackgroundSync() {
  try {
    if (!(await TaskManager.isTaskRegisteredAsync(TASK))) await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: 60 });
  } catch {}
}

export async function stopBackgroundSync() {
  try {
    if (await TaskManager.isTaskRegisteredAsync(TASK)) await BackgroundTask.unregisterTaskAsync(TASK);
  } catch {}
}

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Between 5 and 12 in the morning, once a day, when last night's readings are in: a short note on how ready you are.
 * Only when the daily check-in reminder is on, outside quiet hours, and notifications are allowed.
 */
async function morningNote(uid: string, days: DeviceDay[]) {
  const now = new Date();
  const today = localDay(now);
  const hour = now.getHours();
  if (hour < 5 || hour >= 12) return;
  const night = days.find((d) => d.day === today && (d.hrv != null || d.hr_rest != null || d.sleep_h != null || d.recovery != null));
  if (!night) return;
  const key = `gymi.morningNote.${uid}`;
  if ((await AsyncStorage.getItem(key).catch(() => null)) === today) return;
  const prefs = await loadPrefs(uid);
  if (!prefs.on || !prefs.checkin.on) return;
  if (prefs.quiet.on) {
    const m = hour * 60 + now.getMinutes();
    const a = toMin(prefs.quiet.from);
    const b = toMin(prefs.quiet.to);
    if (a > b ? m >= a || m < b : m >= a && m < b) return;
  }
  if (!(await Notifications.getPermissionsAsync()).granted) return;
  const settings = await AsyncStorage.getItem('gymi.settings.v1').catch(() => null);
  const lang: 'en' | 'ar' = settings && JSON.parse(settings).lang === 'ar' ? 'ar' : 'en';
  const t = (s: string, v?: Record<string, string | number>) => translate(lang, s, v);
  const brief = deviceBrief(days, today);
  const sick = illnessCheck(days, today);
  const sleep = night.sleep_h != null ? t('You slept {h} h.', { h: Math.round(night.sleep_h * 10) / 10 }) : '';
  const [title, body] = sick
    ? [t('Your body may be fighting something'), t('Rest, drink water and sleep early. Open Gymi to see why.')]
    : brief?.readiness === 'low'
      ? [t('Take it easier today'), `${sleep} ${t('Your watch says you haven’t fully recovered. Open Gymi to make today’s workout lighter.')}`.trim()]
      : brief?.readiness === 'good'
        ? [t('Ready to train hard'), `${sleep} ${t('Your watch says you recovered well. A good day to push.')}`.trim()]
        : [t('Good morning'), `${sleep} ${t('Your readings look normal today.')}`.trim()];
  await Notifications.scheduleNotificationAsync({ content: { title, body, data: { url: '/recovery' } }, trigger: null });
  await AsyncStorage.setItem(key, today).catch(() => {});
}
