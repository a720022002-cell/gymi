import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';

import { useToast } from '@/components/Toast';
import { useT } from '@/i18n';
import { currentSet, histFor, logSet, ltrNums, setAdvice } from '@/lib/activeWorkout';
import { restDone } from '@/lib/beep';
import { useFood } from '@/lib/food';
import { useTrain } from '@/lib/train';
import { exInfo } from '@/lib/training';
import { useWeight } from '@/lib/units';
import { onWorkoutAction, syncWorkoutActivity } from '@/lib/widgetSync';
import type { WorkoutAction } from '@/widgets/WorkoutActivity';
import { useSettings } from '@/theme/settings';

const REST_ID = 'adro-rest-end';
// One change at a time, so a cancel never lands after the newer schedule.
let restChain: Promise<unknown> = Promise.resolve();
const queueRest = (fn: () => Promise<unknown>) => (restChain = restChain.then(fn).catch(() => {}));

/** A notification when the rest ends, for when the app isn't on screen (locked phone, another app). Replaces any earlier one. */
function scheduleRestEnd(end: number, title: string, body: string) {
  if (Platform.OS === 'web') return;
  queueRest(async () => {
    await Notifications.cancelScheduledNotificationAsync(REST_ID).catch(() => {});
    if (end - Date.now() < 1000) return;
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted && perm.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL) return;
    if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('rest', { name: 'Rest timer', importance: Notifications.AndroidImportance.HIGH });
    await Notifications.scheduleNotificationAsync({
      identifier: REST_ID,
      content: { title, body, sound: true, data: { route: '/active' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: end, channelId: 'rest' },
    });
  });
}
function cancelRestEnd() {
  if (Platform.OS === 'web') return;
  queueRest(() => Notifications.cancelScheduledNotificationAsync(REST_ID));
}
/** Asked once, at the first rest, while the app is open (it can't ask from the background). */
function askRestPermission() {
  if (Platform.OS === 'web') return;
  queueRest(async () => {
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted && perm.status === 'undetermined' && perm.canAskAgain) await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: false, allowSound: true } });
  });
}

/** The workout in progress, whatever screen you're on: ends the rest when its time is up (beep and toast), and keeps
 * the Live Activity (iPhone) and its buttons working. Renders nothing. */
export function WorkoutLive() {
  const { t } = useT();
  const toast = useToast();
  const { rest, setRest } = useTrain();

  // The rest ends right on time (a timer for its end, not a check every moment).
  useEffect(() => {
    if (!rest) return;
    const id = setTimeout(
      () => {
        setRest(null);
        restDone();
        toast(t('Rest done. Next set.'), { icon: 'timer' });
      },
      Math.max(0, rest.end - Date.now()),
    );
    return () => clearTimeout(id);
  }, [rest, setRest, toast, t]);

  // Away from the app (locked, or another app open): a notification at the rest's end. It's moved by +30 s and taken
  // away by Skip or a new set (here or on the Live Activity), and when you come back to the app (the toast says it then).
  useEffect(() => {
    if (rest && AppState.currentState === 'active') askRestPermission();
    const sync = (st: AppStateStatus) => {
      if (rest && st !== 'active') scheduleRestEnd(rest.end, t('Rest done'), t('Rest done. Next set.'));
      else cancelRestEnd();
    };
    sync(AppState.currentState);
    const sub = AppState.addEventListener('change', sync);
    return () => sub.remove();
  }, [rest, t]);

  if (Platform.OS !== 'ios') return null;
  return <LiveActivity />;
}

function LiveActivity() {
  const { t, lang } = useT();
  const toast = useToast();
  const train = useTrain();
  const food = useFood();
  const W = useWeight();
  const { liveActivity } = useSettings();
  const s = train.session;
  const rest = train.rest;

  // The workout on the Lock Screen and in the Dynamic Island (iPhone): the exercise you're on, the set and its
  // target, the workout clock, and the rest countdown while you rest. Updates when a set or the rest changes.
  useEffect(() => {
    if (!s) return;
    // Turned off in You → Widgets.
    if (!liveActivity) return syncWorkoutActivity(null);
    const cur = currentSet(s);
    const x = cur ? s.ex[cur.ei] : null;
    const st = x && cur ? x.sets[cur.si] : null;
    const w = st ? +(st.w || st.lw) || 0 : 0;
    const r = st ? +(st.r || st.lr) || 0 : 0;
    const xi = x ? exInfo(x, lang) : null;
    const timed = xi?.timed ?? false;
    // The coach's tip under the exercise, the same one the workout screen shows.
    const adv = x && xi ? setAdvice(x, timed, xi.type === 'Bodyweight', histFor(train.logs, train.plan, x.id), t, W) : null;
    syncWorkoutActivity({
      workout: s.home ? t('Home workout') : s.name === 'Together' ? t('Train together') : t('{w} workout', { w: t(s.name) }),
      exercise: x ? exInfo(x, lang).name : t('All sets done'),
      // Working sets only: warm-ups have their own label and don't count.
      set: x && st && cur ? (st.warm ? t('Warm-up') : t('Set {a} of {b}', { a: x.sets.slice(0, cur.si + 1).filter((y) => !y.warm).length, b: x.sets.filter((y) => !y.warm).length })) : t('Tap Finish to save'),
      target: st && r ? (w > 0 ? `${W.show(w)} ${W.label} × ${r}` : `× ${r}`) : '',
      wText: st && w > 0 ? `${W.show(w)} ${W.label}` : '',
      rText: timed ? `${r} ${t('s')}` : `× ${r}`,
      canLog: !!st,
      tip: ltrNums(adv?.text ?? ''),
      tipTone: adv?.tone ?? 'ok',
      water: food.day === food.today ? `${Math.round(food.water / 50) / 20} ${t('L')}` : '',
      startedAt: s.start,
      restEnd: rest?.end ?? null,
      restStart: rest ? rest.end - rest.total * 1000 : null,
      done: s.ex.reduce((a, e) => a + e.sets.filter((y) => y.done).length, 0),
      total: s.ex.reduce((a, e) => a + e.sets.length, 0),
      L: { rest: t('Rest'), next: t('Next'), sets: t('sets'), done: t('Done'), skip: t('Skip') },
    });
  }, [s, rest, lang, t, W, train.logs, train.plan, food.day, food.today, food.water, liveActivity]);

  // The buttons on the Live Activity (iPhone, iOS 17+): change the set you're on, log it, or skip the rest, without
  // opening the app. They read the latest workout from a ref, so the listener is set up once.
  const latest = useRef({ s, train, W, lang, toast, t, food });
  useEffect(() => {
    latest.current = { s, train, W, lang, toast, t, food };
  });
  useEffect(
    () =>
      onWorkoutAction((a: WorkoutAction) => {
        const { s, train, W, lang, toast, t, food } = latest.current;
        if (!s) return;
        // Taps in a row each build on the one before, before the screen catches up.
        const save = (next: typeof s) => {
          train.setSession(next);
          latest.current = { ...latest.current, s: next };
        };
        // A glass of water goes to today's water, like the water button on the workout screen.
        if (a === 'water') return void food.addWater(250, 'Water', food.today);
        if (a === 'skip') return train.setRest(null);
        const cur = currentSet(s);
        if (!cur) return;
        const x = s.ex[cur.ei];
        const st = x.sets[cur.si];
        if (a === 'done') {
          const { next, restFor, needWeight } = logSet(s, cur.ei, cur.si, lang);
          // No weight for a weighted exercise: nothing is logged (never 0 kg), and the card stays on this set.
          if (needWeight) return;
          save(next);
          // A new rest starts (or none after the last set), so a rest left showing on a locked phone is cleared.
          train.setRest(restFor ? { end: Date.now() + restFor * 1000, total: restFor } : null);
          if (!restFor) toast(t('All sets done. Tap Finish.'), { ai: true });
          return;
        }
        let k: 'w' | 'r';
        let v: string;
        if (a === 'w-' || a === 'w+') {
          // One plate jump in your unit (2.5 kg or 5 lb), kept in kg.
          const shown = W.num(+(st.w || st.lw) || 0) + (a === 'w+' ? 1 : -1) * (W.unit === 'lb' ? 5 : 2.5);
          k = 'w';
          v = String(W.toKg(Math.max(0, shown)));
        } else {
          const by = exInfo(x, lang).timed ? 5 : 1;
          k = 'r';
          v = String(Math.max(1, (+(st.r || st.lr) || 0) + (a === 'r+' ? by : -by)));
        }
        save({ ...s, ex: s.ex.map((e, i) => (i !== cur.ei ? e : { ...e, sets: e.sets.map((y, j) => (j === cur.si ? { ...y, [k]: v } : y)) })) });
      }),
    [],
  );

  return null;
}
