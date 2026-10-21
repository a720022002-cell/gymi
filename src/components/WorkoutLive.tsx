import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

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
      set: x && st && cur ? (st.warm ? t('Warm-up') : t('Set {a} of {b}', { a: cur.si + 1, b: x.sets.length })) : t('Tap Finish to save'),
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
          const { next, restFor } = logSet(s, cur.ei, cur.si, lang);
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
