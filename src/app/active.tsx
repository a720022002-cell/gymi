import { router } from 'expo-router';
import { type ComponentProps, useEffect, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass } from '@/components/Glass';
import { Icon, Mark } from '@/components/Icon';
import { Bar, Ring } from '@/components/Ring';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { fontFor, Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { ExercisePicker } from '@/components/train/ExercisePicker';
import { Button, Card, Row, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { restDone } from '@/lib/beep';
import { toPlanEx } from '@/lib/exercisesDb';
import { type Session, type SessionEx, useTrain } from '@/lib/train';
import { exInfo, type PlanEx, rangeText, topReps } from '@/lib/training';
import { useWeight } from '@/lib/units';
import { useSettings } from '@/theme/settings';

const REST = 90;
const digits = (v: string, dec: boolean) =>
  v
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[,٫]/g, '.')
    .replace(dec ? /[^\d.]/g : /\D/g, '')
    .slice(0, 6);

/** Did this exercise go up or down against last time? (design: exArrow) */
function arrow(x: SessionEx): 'up' | 'down' | 'same' | null {
  const done = x.sets.filter((s) => s.done && !s.warm);
  if (!done.length) return null;
  const v = done.reduce((a, s) => a + (+s.w || 0) * (+s.r || 0) + (+s.r || 0) * 0.01, 0);
  const l = done.reduce((a, s) => a + s.lw * s.lr + s.lr * 0.01, 0);
  if (Math.abs(v - l) < 0.001) return 'same';
  return v > l ? 'up' : 'down';
}

type Tone = 'up' | 'ok' | 'down';
type Tr = (k: string, v?: Record<string, string | number>) => string;
type W = ReturnType<typeof useWeight>;

/** Coach advice for an exercise, from its last finished working set: reps against the target range,
 * the weight jump from the set before, and last time's numbers. Updates after every set. */
function setAdvice(x: SessionEx, timed: boolean, bodyweight: boolean, t: Tr, W: W): { text: string; tone: Tone } | null {
  const a = adviceKg(x, timed, bodyweight, t, W);
  // Written in kg; shown in lb when you picked pounds.
  return a ? { ...a, text: W.words(a.text) } : null;
}

function adviceKg(x: SessionEx, timed: boolean, bodyweight: boolean, t: Tr, W: W): { text: string; tone: Tone } | null {
  const kg = W.show;
  const work = x.sets.filter((y) => !y.warm);
  const done = work.filter((y) => y.done);
  if (!done.length) return null;
  const nums = String(x.reps).match(/\d+/g)?.map(Number) ?? [10];
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  const last = done[done.length - 1];
  const prev = done.length > 1 ? done[done.length - 2] : null;
  const w = +last.w || 0;
  const r = +last.r || 0;
  const step = W.step;
  const finished = done.length === work.length;

  if (timed) {
    if (r >= hi + 10) return { text: t('{r} s, strong hold. Add 10 seconds next set.', { r }), tone: 'up' };
    if (r >= hi) return { text: t('{r} s, you hit the target. Keep it steady.', { r }), tone: 'ok' };
    return { text: t('{r} s. Rest a little longer and aim for {hi} s.', { r, hi }), tone: 'down' };
  }
  if (bodyweight || w <= 0) {
    if (r > hi + 2) return { text: t('{r} reps, too easy. Slow it down or add weight.', { r }), tone: 'up' };
    if (r >= lo) return { text: finished ? t('All sets done. Nice work.') : t('{r} reps, right in the range. Same again.', { r }), tone: 'ok' };
    return { text: t('{r} reps. Rest a bit longer before the next set.', { r }), tone: 'down' };
  }
  // Better than last time's matching set?
  const beat = last.lw > 0 && (w > last.lw || (w === last.lw && r > last.lr)) ? (w > last.lw ? t('+{n} kg on last time. ', { n: kg(w - last.lw) }) : t('+{n} reps on last time. ', { n: r - last.lr })) : '';
  if (finished) {
    const allTop = done.every((y) => (+y.r || 0) >= hi);
    if (allTop) return { text: `${beat}${t('Every set hit {hi} reps. Next time start at {w} kg.', { hi, w: kg(w + step) })}`, tone: 'up' };
    if (r >= lo) return { text: `${beat}${t('Done. Top set {w} kg × {r}. Stay at {w} kg until you get {hi} reps.', { w: kg(w), r, hi })}`, tone: 'ok' };
    return { text: t('Done. The last set was heavy ({r} reps). Next time use {w} kg.', { r, w: kg(Math.max(0, w - step)) }), tone: 'down' };
  }
  if (r > hi + 2) return { text: `${beat}${t('{r} reps is too light for {range}. Go up to {w} kg next set.', { r, range: rangeText(lo, hi), w: kg(w + step * 2) })}`, tone: 'up' };
  if (r > hi) return { text: `${beat}${t('{r} reps, above {hi}. Add {s} kg next set ({w} kg).', { r, hi, s: kg(step), w: kg(w + step) })}`, tone: 'up' };
  if (r === hi) return { text: `${beat}${t('Top of the range. Try {w} kg next set.', { w: kg(w + step) })}`, tone: 'up' };
  if (r >= lo) {
    if (prev && w > (+prev.w || 0)) return { text: `${beat}${t('Good jump to {w} kg, {r} reps is right in the range. Stay here.', { w: kg(w), r })}`, tone: 'ok' };
    return { text: `${beat}${t('{r} reps, in the range. Stay at {w} kg and aim for {n}.', { r, w: kg(w), n: Math.min(hi, r + 1) })}`, tone: 'ok' };
  }
  return { text: t('{r} reps is below {lo}. Drop to {w} kg so you can do {lo} or more.', { r, lo, w: kg(Math.max(0, w - step)) }), tone: 'down' };
}

/** The workout in progress (design: active). */
export default function Active() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const train = useTrain();
  const W = useWeight();
  const s = train.session;
  const [now, setNow] = useState(() => Date.now());
  const [rest, setRest] = useState<{ end: number; total: number } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  // The set whose number was tapped: make it a warm-up or a working set, or delete it.
  const [setMenu, setSetMenu] = useState<{ ei: number; si: number } | null>(null);
  // Swapping an exercise mid-workout: which one, then whether to keep the change in your plan.
  const [swapFor, setSwapFor] = useState<number | null>(null);
  const [swapped, setSwapped] = useState<{ oldId: string; ex: PlanEx; name: string } | null>(null);
  // The exercise whose trash button was tapped: remove it today, or from your plan too.
  const [removeFor, setRemoveFor] = useState<number | null>(null);

  // Tick every quarter second; end the rest when its time is up.
  const restRef = useRef(rest);
  useEffect(() => {
    restRef.current = rest;
  }, [rest]);
  useEffect(() => {
    const id = setInterval(() => {
      const n = Date.now();
      setNow(n);
      const r = restRef.current;
      if (r && n >= r.end) {
        restRef.current = null;
        setRest(null);
        restDone();
        toast(t('Rest done. Next set.'), { icon: 'timer' });
      }
    }, 250);
    return () => clearInterval(id);
  }, [toast, t]);
  const left = rest ? Math.max(0, Math.ceil((rest.end - now) / 1000)) : 0;

  if (!s)
    return (
      <Screen title={t('Workout')} back>
        <Text color="sec">{t('No workout in progress.')}</Text>
        <Button title={t('Back to Train')} style={{ marginTop: 16 }} onPress={() => router.replace('/train')} />
      </Screen>
    );

  const tot = s.ex.reduce((a, x) => a + x.sets.length, 0);
  const dn = s.ex.reduce((a, x) => a + x.sets.filter((y) => y.done).length, 0);
  // Only working sets make a workout: warm-ups alone don't save a log, mark the day done or raise the streak.
  const workDone = s.ex.reduce((a, x) => a + x.sets.filter((y) => y.done && !y.warm).length, 0);
  const secs = Math.floor((now - s.start) / 1000);
  const elapsed = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;

  const update = (fn: (x: Session) => Session) => train.setSession(fn(s));
  const setField = (ei: number, si: number, k: 'w' | 'r', v: string) =>
    update((x) => ({ ...x, ex: x.ex.map((e, i) => (i !== ei ? e : { ...e, sets: e.sets.map((st, j) => (j === si ? { ...st, [k]: v } : st)) })) }));

  const editSets = (ei: number, fn: (sets: SessionEx['sets']) => SessionEx['sets']) => update((x) => ({ ...x, ex: x.ex.map((e, i) => (i !== ei ? e : { ...e, sets: fn(e.sets) })) }));
  // "Remove set": the last working set you haven't done yet (or the last set if they're all done). One set always stays.
  const removeSet = (ei: number) =>
    editSets(ei, (sets) => {
      if (sets.length <= 1) return sets;
      let k = -1;
      for (let j = sets.length - 1; j >= 0; j--) if (!sets[j].done && !sets[j].warm) { k = j; break; }
      if (k < 0) k = sets.length - 1;
      return sets.filter((_, j) => j !== k);
    });
  // A new working set copies the last one's targets; a warm-up goes before the working sets, lighter and with more reps.
  const addSet = (ei: number, warm: boolean) =>
    editSets(ei, (sets) => {
      const work = sets.filter((y) => !y.warm);
      const ref = work[work.length - 1] ?? sets[sets.length - 1] ?? { lw: 0, lr: topReps(s.ex[ei].reps) };
      if (!warm) return [...sets, { w: '', r: '', done: false, lw: ref.lw, lr: ref.lr }];
      const firstWork = sets.findIndex((y) => !y.warm);
      const at = firstWork < 0 ? sets.length : firstWork;
      const warmSet = { w: '', r: '', done: false, lw: ref.lw ? Math.round(ref.lw * 0.5 * 2) / 2 : 0, lr: Math.max(ref.lr, 12), warm: true };
      return [...sets.slice(0, at), warmSet, ...sets.slice(at)];
    });
  const markSet = (ei: number, si: number) => {
    const x = s.ex[ei];
    const st = x.sets[si];
    const info = exInfo(x, lang);
    if (st.done) return update((ss) => ({ ...ss, ex: ss.ex.map((e, i) => (i !== ei ? e : { ...e, sets: e.sets.map((y, j) => (j === si ? { ...y, done: false } : y)) })) }));
    const w = st.w === '' ? String(st.lw || 0) : st.w;
    const r = st.r === '' ? String(st.lr) : st.r;
    const easy = !st.warm && +r >= topReps(x.reps) && +w >= st.lw && info.type !== 'Bodyweight' && !info.timed && +w > 0;
    const next: Session = {
      ...s,
      ex: s.ex.map((e, i) => (i !== ei ? e : { ...e, tip: e.tip || easy, sets: e.sets.map((y, j) => (j === si ? { ...y, w, r, done: true } : y)) })),
    };
    train.setSession(next);
    const more = next.ex.some((e) => e.sets.some((z) => !z.done));
    // Shorter rest after a warm-up set.
    const restFor = st.warm ? 45 : REST;
    if (more) setRest({ end: Date.now() + restFor * 1000, total: restFor });
    else toast(t('All sets done. Tap Finish.'), { ai: true });
  };

  // Put another exercise in place of this one. Finished sets stay with the old exercise; the rest move to the new one.
  const swapEx = (ei: number, pe: PlanEx) => {
    const old = s.ex[ei];
    const done = old.sets.filter((y) => y.done);
    const left = old.sets.filter((y) => !y.done);
    const prev = train.last[pe.id] ?? [];
    let k = 0;
    const sets = (left.length ? left : [{ warm: false }]).map((y) => {
      const l = y.warm ? undefined : prev[k++];
      return { w: '', r: '', done: false, lw: l?.w ?? 0, lr: l?.r ?? (y.warm ? 12 : topReps(old.reps)), warm: y.warm || undefined };
    });
    const nx: SessionEx = { ...pe, reps: old.reps, tip: false, sets };
    update((x) => ({ ...x, ex: done.length ? [...x.ex.slice(0, ei), { ...old, sets: done }, nx, ...x.ex.slice(ei + 1)] : x.ex.map((e, i) => (i === ei ? nx : e)) }));
  };
  const removeEx = (ei: number, fromPlan: boolean) => {
    const old = s.ex[ei];
    setRemoveFor(null);
    if (!old) return;
    update((x) => ({ ...x, ex: x.ex.filter((_, i) => i !== ei) }));
    const p = train.plan;
    const w = p?.workouts[s.name];
    if (fromPlan && p && w) train.updatePlan({ workouts: { ...p.workouts, [s.name]: { ...w, ex: w.ex.filter((y) => y.id !== old.id) } } });
    toast(t(fromPlan ? 'Removed {x} from your plan' : 'Removed {x}', { x: exInfo(old, lang).name }), { icon: 'trash' });
  };
  const canAlways = (oldId: string) => !s.home && !!train.plan?.workouts[s.name]?.ex.some((y) => y.id === oldId);
  const keepAlways = () => {
    const p = train.plan;
    const w = p?.workouts[s.name];
    if (!swapped || !p || !w) return setSwapped(null);
    const ex = w.ex.map((y) => (y.id === swapped.oldId ? { ...swapped.ex, sets: y.sets, reps: y.reps } : y));
    train.updatePlan({ workouts: { ...p.workouts, [s.name]: { ...w, ex } } });
    toast(t('Saved to your plan'), { icon: 'check' });
    setSwapped(null);
  };

  const finish = async () => {
    if (!workDone) return setConfirm(true);
    setSaving(true);
    const names = Object.fromEntries(s.ex.map((x) => [x.id, exInfo(x, 'en').name]));
    const log = await train.finishWorkout(names);
    setSaving(false);
    if (!log) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
    setRest(null);
    router.replace({ pathname: '/summary', params: { id: log.id } });
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen
        title={s.home ? t('Home workout') : s.name === 'Together' ? t('Train together') : t('{w} workout', { w: t(s.name) })}
        back
        right={
          <Springy onPress={finish} disabled={saving} scaleTo={1.08}>
            <Glass style={{ height: 44, borderRadius: 22, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' }}>
              <Text weight={700}>{t(saving ? 'Saving…' : 'Finish')}</Text>
            </Glass>
          </Springy>
        }>
        <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <Text variant="small" weight={700} color="sec">
            {t('{a} of {b} sets', { a: dn, b: tot })}
          </Text>
          <Text variant="small" weight={700} color="sec" num>
            {elapsed}
          </Text>
        </Row>
        <Bar value={dn} max={tot} color={c.cobalt} />
        <View style={{ height: 14 }} />
        {s.ex.map((x, ei) => {
          const info = exInfo(x, lang);
          const a = arrow(x);
          const mach = info.mach[train.plan?.machines[x.id] ?? 0];
          return (
            <Card key={`${x.id}-${ei}`}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Row gap={6} style={{ flex: 1 }}>
                  {x.id.startsWith('custom:') ? (
                    <Text variant="h3" style={{ flexShrink: 1 }}>
                      {info.name}
                    </Text>
                  ) : (
                    // Tap the name for pictures and how to do it; the workout keeps going.
                    <Springy
                      onPress={() => router.push({ pathname: '/exercise', params: { id: x.id } })}
                      accessibilityRole="button"
                      accessibilityLabel={t('How to do {x}', { x: info.name })}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
                      <Text variant="h3" style={{ flexShrink: 1 }}>
                        {info.name}
                      </Text>
                      <Icon name="info" size={16} color={c.sec} />
                    </Springy>
                  )}
                  {a === 'up' ? <Icon name="up" size={18} color={c.up} strokeWidth={2.6} /> : a === 'down' ? <Icon name="down" size={18} color={c.down} strokeWidth={2.6} /> : a === 'same' ? <Text variant="small" weight={700} color="sec">{t('same')}</Text> : null}
                </Row>
                <Row gap={4}>
                  <Text variant="small" weight={700} color="sec">
                    {info.timed ? `${x.reps} ${t('s')}` : x.reps}
                  </Text>
                  <Springy
                    onPress={() => setSwapFor(ei)}
                    scaleTo={0.9}
                    accessibilityRole="button"
                    accessibilityLabel={t('Replace {x}', { x: info.name })}
                    style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="swap" size={18} color={c.cobalt} />
                  </Springy>
{s.ex.length > 1 ? (
                  <Springy
                    onPress={() => setRemoveFor(ei)}
                    scaleTo={0.9}
                    accessibilityRole="button"
                    accessibilityLabel={t('Remove {x}', { x: info.name })}
                    style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="trash" size={18} color={c.down} />
                  </Springy>
                  ) : null}
                </Row>
              </Row>
              {mach ? (
                <Text variant="xs" color="sec">
                  {lang === 'ar' ? mach[1] : mach[0]}
                </Text>
              ) : null}
              <View style={{ flexDirection: 'row', marginTop: 12, marginBottom: 4 }}>
                <Text variant="xs" weight={700} color="sec" center style={{ width: 36 }}>
                  {t('Set')}
                </Text>
                <Text variant="xs" weight={700} color="sec" center style={{ flex: 1 }}>
                  {info.timed ? '—' : W.label}
                </Text>
                <Text variant="xs" weight={700} color="sec" center style={{ flex: 1 }}>
                  {t(info.timed ? 'seconds' : 'reps')}
                </Text>
                <View style={{ width: 52 }} />
              </View>
              {x.sets.map((st, si) => (
                <View key={si} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, opacity: st.done ? 0.65 : 1 }}>
                  <Springy
                    onPress={() => setSetMenu({ ei, si })}
                    scaleTo={0.9}
                    accessibilityLabel={t(st.warm ? 'Warm-up set options' : 'Set {n} options', { n: x.sets.slice(0, si + 1).filter((y) => !y.warm).length })}
                    style={{ width: 28, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: st.warm ? 'rgba(245,158,11,0.18)' : 'transparent' }}>
                    {st.warm ? (
                      <Text weight={800} style={{ color: '#F59E0B' }}>
                        {t('W')}
                      </Text>
                    ) : (
                      <Text num center>
                        {x.sets.slice(0, si + 1).filter((y) => !y.warm).length}
                      </Text>
                    )}
                  </Springy>
                  <WeightInput
                    key={`${si}-${W.unit}`}
                    value={st.w}
                    W={W}
                    editable={!info.timed}
                    onChange={(v) => setField(ei, si, 'w', v)}
                    placeholder={info.timed ? '—' : st.lw ? W.show(st.lw) : '—'}
                    placeholderTextColor={c.sec}
                    inputMode="decimal"
                    keyboardType="decimal-pad"
                    accessibilityLabel={t('Weight set {n}', { n: si + 1 })}
                    style={{ flex: 1, flexBasis: 0, minWidth: 0, width: 0, height: 44, borderRadius: 12, backgroundColor: c.inset, textAlign: 'center', fontFamily: fontFor('sora', 600), fontSize: 17, color: c.text, outlineStyle: 'none' } as object}
                  />
                  <TextInput
                    value={st.r}
                    onChangeText={(v) => setField(ei, si, 'r', digits(v, false))}
                    placeholder={String(st.lr)}
                    placeholderTextColor={c.sec}
                    inputMode="numeric"
                    keyboardType="number-pad"
                    accessibilityLabel={t('Reps set {n}', { n: si + 1 })}
                    style={{ flex: 1, flexBasis: 0, minWidth: 0, width: 0, height: 44, borderRadius: 12, backgroundColor: c.inset, textAlign: 'center', fontFamily: fontFor('sora', 600), fontSize: 17, color: c.text, outlineStyle: 'none' } as object}
                  />
                  <Springy
                    onPress={() => markSet(ei, si)}
                    scaleTo={0.9}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: st.done }}
                    accessibilityLabel={t('Finish set {n}', { n: si + 1 })}
                    style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: st.done ? c.cobalt : c.inset }}>
                    <Icon name="check" size={20} color={st.done ? '#FFFFFF' : c.sec} strokeWidth={2.6} />
                  </Springy>
                </View>
              ))}
              <Row gap={8} style={{ marginTop: 10 }}>
                <Springy onPress={() => addSet(ei, false)} scaleTo={0.97} style={{ flex: 1, height: 40, borderRadius: 12, backgroundColor: c.inset, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Icon name="plus" size={16} color={c.text} />
                  <Text variant="small" weight={700}>
                    {t('Add set')}
                  </Text>
                </Springy>
                <Springy
                  disabled={x.sets.length <= 1}
                  onPress={() => removeSet(ei)}
                  scaleTo={0.97}
                  style={{ flex: 1, height: 40, borderRadius: 12, backgroundColor: c.inset, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: x.sets.length <= 1 ? 0.4 : 1 }}>
                  <Icon name="minus" size={16} color={c.down} />
                  <Text variant="small" weight={700}>
                    {t('Remove set')}
                  </Text>
                </Springy>
                <Springy onPress={() => addSet(ei, true)} scaleTo={0.97} style={{ flex: 1, height: 40, borderRadius: 12, backgroundColor: c.inset, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Icon name="flame" size={16} color="#F59E0B" />
                  <Text variant="small" weight={700}>
                    {t('Warm-up')}
                  </Text>
                </Springy>
              </Row>
              {(() => {
                const adv = setAdvice(x, info.timed, info.type === 'Bodyweight', t, W);
                if (!adv) return null;
                const tc = adv.tone === 'up' ? c.up : adv.tone === 'down' ? '#F59E0B' : c.cobalt;
                return (
                  <Row gap={10} style={{ marginTop: 12, backgroundColor: c.inset, borderRadius: 14, padding: 10, borderStartWidth: 3, borderStartColor: tc }}>
                    {adv.tone === 'up' ? <Icon name="up" size={18} color={tc} strokeWidth={2.6} /> : adv.tone === 'down' ? <Icon name="down" size={18} color={tc} strokeWidth={2.6} /> : <Mark size={18} color={tc} stroke={4} />}
                    <Text variant="small" weight={700} style={{ flex: 1 }}>
                      {adv.text}
                    </Text>
                  </Row>
                );
              })()}
            </Card>
          );
        })}
        <Card onPress={() => router.push({ pathname: '/machine', params: { live: '1' } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="camera" size={20} color={c.cobalt} />
          </View>
          <View style={{ flex: 1 }}>
            <Text weight={700}>{t('Don’t know a machine?')}</Text>
            <Text variant="small" color="sec">
              {t('Take a photo. I’ll name it and add it to this workout.')}
            </Text>
          </View>
          <Icon name="chev" size={18} color={c.sec} />
        </Card>
        <View style={{ height: rest ? 300 : 90 }} />
      </Screen>

      <View pointerEvents="box-none" style={{ position: 'absolute', left: 16, right: 16, bottom: 20 + insets.bottom }}>
        {rest ? (
          <Glass style={{ borderRadius: 32, padding: 16 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text weight={700}>{t('Rest')}</Text>
              <Springy onPress={() => setRest(null)} accessibilityLabel={t('Close')} style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="close" size={18} strokeWidth={2.2} />
              </Springy>
            </Row>
            <View style={{ alignItems: 'center', marginTop: 4, marginBottom: 14 }}>
              <Ring value={left} max={rest.total} size={150} stroke={10}>
                <Text num size={44}>{`${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`}</Text>
              </Ring>
            </View>
            <Row gap={10}>
              <View style={{ flex: 1 }}>
                <Button kind="soft" title={t('+30 s')} style={{ alignSelf: 'stretch' }} onPress={() => setRest({ end: rest.end + 30000, total: rest.total + 30 })} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title={t('Skip')} style={{ alignSelf: 'stretch' }} onPress={() => setRest(null)} />
              </View>
            </Row>
          </Glass>
        ) : (
          <Glass style={{ borderRadius: 32, paddingVertical: 8, paddingEnd: 8, paddingStart: 18, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Text variant="small" weight={700}>
                {t('{a} of {b} sets done', { a: dn, b: tot })}
              </Text>
              <Text variant="small" color="sec">
                {t('Tap ✓ after each set')}
              </Text>
            </View>
            <Button small kind="glass" icon="timer" title={t('Rest')} onPress={() => setRest({ end: Date.now() + REST * 1000, total: REST })} />
          </Glass>
        )}
      </View>

      <Sheet open={!!setMenu} onClose={() => setSetMenu(null)}>
        {setMenu && s.ex[setMenu.ei]?.sets[setMenu.si] ? (
          (() => {
            const { ei, si } = setMenu;
            const st = s.ex[ei].sets[si];
            return (
              <View>
                <Text variant="h2">{exInfo(s.ex[ei], lang).name}</Text>
                <Text color="sec" style={{ marginTop: 4 }}>
                  {t(st.warm ? 'Warm-up sets don’t count toward volume, records or next time’s numbers.' : 'Working sets count toward your volume and progress.')}
                </Text>
                <Button
                  kind="soft"
                  icon={st.warm ? 'check' : 'flame'}
                  title={t(st.warm ? 'Make it a working set' : 'Make it a warm-up set')}
                  color={c.text}
                  style={{ marginTop: 16 }}
                  onPress={() => {
                    editSets(ei, (sets) => sets.map((y, j) => (j === si ? { ...y, warm: !y.warm } : y)));
                    setSetMenu(null);
                  }}
                />
                <Button
                  kind="ghost"
                  icon="trash"
                  title={t('Delete set')}
                  color={c.down}
                  style={{ marginTop: 8 }}
                  onPress={() => {
                    editSets(ei, (sets) => sets.filter((_, j) => j !== si));
                    setSetMenu(null);
                  }}
                />
              </View>
            );
          })()
        ) : null}
      </Sheet>

      <ExercisePicker
        open={swapFor !== null}
        replacing
        like={swapFor !== null && s.ex[swapFor] ? (({ name, muscle }) => ({ id: s.ex[swapFor].id, name, muscle }))(exInfo(s.ex[swapFor], lang)) : null}
        title={swapFor !== null && s.ex[swapFor] ? t('Replace {x}', { x: exInfo(s.ex[swapFor], lang).name }) : ''}
        exclude={s.ex.map((x) => x.id)}
        injuries={train.plan?.injuries}
        onClose={() => setSwapFor(null)}
        onPick={(e) => {
          if (swapFor === null || !s.ex[swapFor]) return setSwapFor(null);
          const oldId = s.ex[swapFor].id;
          const pe = toPlanEx(e);
          swapEx(swapFor, pe);
          setSwapFor(null);
          const name = e.name_ar && lang === 'ar' ? e.name_ar : e.name_en;
          if (canAlways(oldId)) setSwapped({ oldId, ex: pe, name });
          else toast(t('{x} swapped in', { x: name }), { icon: 'check' });
        }}
      />

      <Sheet open={removeFor !== null} onClose={() => setRemoveFor(null)}>
        {removeFor !== null && s.ex[removeFor] ? (
          <View>
            <Text variant="h2">{t('Remove {x}?', { x: exInfo(s.ex[removeFor], lang).name })}</Text>
            <Text color="sec" style={{ marginTop: 4 }}>
              {s.ex[removeFor].sets.some((y) => y.done) ? t('The sets you finished for it won’t be saved.') : t('It comes off today’s workout.')}
            </Text>
            <Button kind="soft" icon="trash" title={t('Remove for today')} color={c.down} style={{ marginTop: 16 }} onPress={() => removeEx(removeFor, false)} />
            {canAlways(s.ex[removeFor].id) ? (
              <Button kind="soft" icon="trash" title={t('Remove from my plan too')} color={c.down} style={{ marginTop: 8 }} onPress={() => removeEx(removeFor, true)} />
            ) : null}
            <Button kind="ghost" title={t('Keep it')} color={c.text} style={{ marginTop: 8 }} onPress={() => setRemoveFor(null)} />
          </View>
        ) : null}
      </Sheet>

      <Sheet open={!!swapped} onClose={() => setSwapped(null)}>
        <Text variant="h2">{t('{x} swapped in', { x: swapped?.name ?? '' })}</Text>
        <Text color="sec" style={{ marginTop: 4 }}>
          {t('Keep this change for every {w} workout, or just today?', { w: t(s.name) })}
        </Text>
        <Button title={t('Only this time')} style={{ marginTop: 16 }} onPress={() => setSwapped(null)} />
        <Button kind="soft" icon="check" title={t('Always (update my plan)')} color={c.text} style={{ marginTop: 8 }} onPress={keepAlways} />
      </Sheet>

      <Sheet open={confirm} onClose={() => setConfirm(false)}>
        <Text variant="h2">{t('Finish without logging?')}</Text>
        <Text color="sec" style={{ marginTop: 4 }}>
          {dn ? t('Warm-up sets don’t count. Finish at least one working set to save this workout.') : t('You haven’t finished any sets yet.')}
        </Text>
        <Button title={t('Keep training')} style={{ marginTop: 16 }} onPress={() => setConfirm(false)} />
        <Button
          kind="glass"
          title={t('End workout')}
          style={{ marginTop: 8 }}
          onPress={() => {
            setConfirm(false);
            setRest(null);
            train.setSession(null);
            router.back();
          }}
        />
      </Sheet>
    </View>
  );
}

/** The weight box. It shows and takes your unit (kg or lb) while the set keeps kg. */
function WeightInput({ value, onChange, W, ...rest }: { value: string; onChange: (kg: string) => void; W: W } & Omit<ComponentProps<typeof TextInput>, 'value' | 'onChangeText' | 'onChange'>) {
  const shown = (v: string) => (v ? W.show(+v) : '');
  const [text, setText] = useState(() => shown(value));
  const [seen, setSeen] = useState(value);
  // Changed from outside ("same as last time"): show the new number.
  if (value !== seen) {
    setSeen(value);
    setText(shown(value));
  }
  return (
    <TextInput
      {...rest}
      value={W.unit === 'kg' ? value : text}
      onChangeText={(v) => {
        const d = digits(v, true);
        const kg = W.unit === 'kg' || !d ? d : String(W.toKg(+d) || '');
        setText(d);
        setSeen(kg);
        onChange(kg);
      }}
    />
  );
}
