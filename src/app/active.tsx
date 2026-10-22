import { router } from 'expo-router';
import { type ComponentProps, useEffect, useMemo, useRef, useState } from 'react';
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
import { CutLine, LastNoteLine, NoteInput } from '@/components/train/ExNotes';
import { Button, Card, Row, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { histFor, logSet, ltrNums, REST, setAdvice } from '@/lib/activeWorkout';
import { toPlanEx } from '@/lib/exercisesDb';
import { type Rest, type Session, type SessionEx, useTrain, vsLastTime } from '@/lib/train';
import { useFood } from '@/lib/food';
import { exInfo, type PlanEx, topReps } from '@/lib/training';
import { useWeight } from '@/lib/units';
import { useSettings } from '@/theme/settings';
import { goBack } from '@/lib/nav';

const digits = (v: string, dec: boolean) => {
  const d = v
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[,٫]/g, '.')
    .replace(dec ? /[^\d.]/g : /\D/g, '');
  // Only the first dot counts ("1.2.5" is 1.25, not "not a number").
  const [a, ...b] = d.split('.');
  return (b.length ? `${a}.${b.join('')}` : a).slice(0, 6);
};

type W = ReturnType<typeof useWeight>;

/** The workout in progress (design: active). */
export default function Active() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const train = useTrain();
  const W = useWeight();
  const s = train.session;
  // The rest timer is kept with the workout (lib/train), so the Live Activity can start and skip it too.
  const { rest, setRest } = train;
  const [confirm, setConfirm] = useState(false);
  // Finish with sets still to do, and throwing the workout away.
  const [early, setEarly] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [saving, setSaving] = useState(false);
  // The weight boxes ("exercise:set"), to put the cursor in one that needs a weight.
  const wRefs = useRef<Record<string, TextInput | null>>({});
  // The set whose number was tapped: make it a warm-up or a working set, or delete it.
  const [setMenu, setSetMenu] = useState<{ ei: number; si: number } | null>(null);
  // Swapping an exercise mid-workout: which one, then whether to keep the change in your plan.
  const [swapFor, setSwapFor] = useState<number | null>(null);
  const [swapped, setSwapped] = useState<{ oldId: string; ex: PlanEx; name: string } | null>(null);
  // The exercise whose trash button was tapped: remove it today, or from your plan too.
  const [removeFor, setRemoveFor] = useState<number | null>(null);
  const food = useFood();
  const [waterOpen, setWaterOpen] = useState(false);
  // The note being written: an exercise ("2") or one of its sets ("2:1").
  const [noteAt, setNoteAt] = useState<string | null>(null);

  // Coach advice, history and the up/down arrow for each exercise, worked out when the workout changes (not every second).
  const perEx = useMemo(
    () =>
      (s?.ex ?? []).map((x) => {
        const info = exInfo(x, lang);
        const hist = histFor(train.logs, train.plan, x.id);
        return { adv: setAdvice(x, info.timed, info.type === 'Bodyweight', hist, t, W), arrow: vsLastTime(x, hist[0]) };
      }),
    [s, train.logs, train.plan, W, lang, t],
  );

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

  const update = (fn: (x: Session) => Session) => train.setSession(fn(s));
  // Change the order mid-workout: move an exercise up or down (its sets go with it).
  const move = (ei: number, d: -1 | 1) => {
    setNoteAt(null);
    update((x) => {
      const j = ei + d;
      if (j < 0 || j >= x.ex.length) return x;
      const ex = [...x.ex];
      [ex[ei], ex[j]] = [ex[j], ex[ei]];
      return { ...x, ex };
    });
  };
  // Water you drink while training goes to today's water.
  const drink = async (ml: number) => {
    setWaterOpen(false);
    await food.addWater(ml, 'Water', food.today);
    toast(t('+{n} ml water', { n: ml }), { icon: 'drop' });
  };
  const setField = (ei: number, si: number, k: 'w' | 'r', v: string) =>
    update((x) => ({ ...x, ex: x.ex.map((e, i) => (i !== ei ? e : { ...e, sets: e.sets.map((st, j) => (j === si ? { ...st, [k]: v } : st)) })) }));

  // A note on an exercise, or on one set (si). Saved with the workout.
  const setNote = (ei: number, si: number | null, v: string) =>
    update((x) => ({ ...x, ex: x.ex.map((e, i) => (i !== ei ? e : si == null ? { ...e, note: v } : { ...e, sets: e.sets.map((st, j) => (j === si ? { ...st, note: v } : st)) })) }));
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
      const ref: { lw: number; lr: number; pw?: number; pr?: number } = work[work.length - 1] ?? sets[sets.length - 1] ?? { lw: 0, lr: topReps(s.ex[ei].reps) };
      if (!warm) return [...sets, { w: '', r: '', done: false, lw: ref.lw, lr: ref.lr, ...(ref.pw != null ? { pw: ref.pw, pr: ref.pr } : {}) }];
      const firstWork = sets.findIndex((y) => !y.warm);
      const at = firstWork < 0 ? sets.length : firstWork;
      const warmSet = { w: '', r: '', done: false, lw: ref.lw ? Math.round(ref.lw * 0.5 * 2) / 2 : 0, lr: Math.max(ref.lr, 12), warm: true };
      return [...sets.slice(0, at), warmSet, ...sets.slice(at)];
    });
  const markSet = (ei: number, si: number) => {
    const st = s.ex[ei].sets[si];
    if (st.done) return update((ss) => ({ ...ss, ex: ss.ex.map((e, i) => (i !== ei ? e : { ...e, sets: e.sets.map((y, j) => (j === si ? { ...y, done: false } : y)) })) }));
    const { next, restFor, needWeight } = logSet(s, ei, si, lang);
    // No weight typed and none from last time: ask for it instead of saving 0 kg.
    if (needWeight) {
      toast(t('Enter the weight for this set first.'), { icon: 'warn' });
      wRefs.current[`${ei}:${si}`]?.focus();
      return;
    }
    train.setSession(next);
    if (restFor) setRest({ end: Date.now() + restFor * 1000, total: restFor });
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
      return { w: '', r: '', done: false, lw: l?.w ?? 0, lr: l?.r ?? (y.warm ? 12 : topReps(old.reps)), ...(l ? { pw: l.w, pr: l.r } : {}), warm: y.warm || undefined };
    });
    const nx: SessionEx = { ...pe, reps: old.reps, tip: false, sets };
    update((x) => ({ ...x, ex: done.length ? [...x.ex.slice(0, ei), { ...old, sets: done }, nx, ...x.ex.slice(ei + 1)] : x.ex.map((e, i) => (i === ei ? nx : e)) }));
  };
  const removeEx = (ei: number, fromPlan: boolean) => {
    const old = s.ex[ei];
    setRemoveFor(null);
    setNoteAt(null);
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

  const left = s.ex.reduce((a, x) => a + x.sets.filter((y) => !y.done).length, 0);
  const finish = async (sure?: boolean) => {
    if (!workDone) return setConfirm(true);
    // Sets still to do: ask first.
    if (left && !sure) return setEarly(true);
    setEarly(false);
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
          <Springy onPress={() => finish()} disabled={saving} scaleTo={1.08}>
            <Glass style={{ height: 44, borderRadius: 22, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' }}>
              <Text weight={700}>{t(saving ? 'Saving…' : 'Finish')}</Text>
            </Glass>
          </Springy>
        }>
        <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <Text variant="small" weight={700} color="sec">
            {t('{a} of {b} sets', { a: dn, b: tot })}
          </Text>
          <Elapsed start={s.start} />
        </Row>
        <Bar value={dn} max={tot} color={c.cobalt} />
        <View style={{ height: 14 }} />
        {s.ex.map((x, ei) => {
          const info = exInfo(x, lang);
          const a = perEx[ei]?.arrow;
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
                  {s.ex.length > 1 ? (
                    <View style={{ alignItems: 'center' }}>
                      <Springy onPress={() => move(ei, -1)} disabled={!ei} scaleTo={0.9} accessibilityRole="button" accessibilityLabel={t('Move {x} up', { x: info.name })} style={{ width: 30, height: 20, alignItems: 'center', justifyContent: 'center', opacity: ei ? 1 : 0.25 }}>
                        <Icon name="chevup" size={16} color={c.sec} strokeWidth={2.4} />
                      </Springy>
                      <Springy onPress={() => move(ei, 1)} disabled={ei === s.ex.length - 1} scaleTo={0.9} accessibilityRole="button" accessibilityLabel={t('Move {x} down', { x: info.name })} style={{ width: 30, height: 20, alignItems: 'center', justifyContent: 'center', opacity: ei === s.ex.length - 1 ? 0.25 : 1 }}>
                        <Icon name="chevd" size={16} color={c.sec} strokeWidth={2.4} />
                      </Springy>
                    </View>
                  ) : null}
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
              <LastNoteLine note={train.lastNotes[x.id]} />
              <CutLine cut={x.cut} deload={!!s.deload} />
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
                <View key={si}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, opacity: st.done ? 0.65 : 1 }}>
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
                      inputRef={(r) => {
                        wRefs.current[`${ei}:${si}`] = r;
                      }}
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
                  {noteAt === `${ei}:${si}` ? (
                    <View style={{ marginTop: 6, marginStart: 36 }}>
                      <NoteInput autoFocus value={st.note ?? ''} onChange={(v) => setNote(ei, si, v)} onDone={() => setNoteAt(null)} placeholder={t('Note for this set')} />
                    </View>
                  ) : st.note?.trim() ? (
                    <Springy onPress={() => setNoteAt(`${ei}:${si}`)} accessibilityRole="button" accessibilityLabel={t('Edit note')} style={{ marginTop: 4, marginStart: 36 }}>
                      <Text variant="xs" color="sec" numberOfLines={2}>
                        {st.note}
                      </Text>
                    </Springy>
                  ) : null}
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
              {noteAt === `${ei}` ? (
                <View style={{ marginTop: 10 }}>
                  <NoteInput autoFocus value={x.note ?? ''} onChange={(v) => setNote(ei, null, v)} onDone={() => setNoteAt(null)} placeholder={t('Like “narrow grip” or “shoulder hurt”')} />
                </View>
              ) : (
                <Springy onPress={() => setNoteAt(`${ei}`)} accessibilityRole="button" accessibilityLabel={t(x.note?.trim() ? 'Edit note' : 'Add note')} style={{ marginTop: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 6, alignSelf: x.note?.trim() ? 'stretch' : 'flex-start' }}>
                  <View style={{ marginTop: 2 }}>
                    <Icon name="edit" size={14} color={c.cobalt} />
                  </View>
                  <Text variant="small" weight={x.note?.trim() ? 400 : 700} color={x.note?.trim() ? 'text' : 'link'} style={x.note?.trim() ? { flex: 1 } : undefined}>
                    {x.note?.trim() ? x.note : t('Add note')}
                  </Text>
                </Springy>
              )}
              {(() => {
                const adv = perEx[ei]?.adv;
                if (!adv) return null;
                const tc = adv.tone === 'up' ? c.up : adv.tone === 'down' ? '#F59E0B' : c.cobalt;
                return (
                  <Row gap={10} style={{ marginTop: 12, backgroundColor: c.inset, borderRadius: 14, padding: 10, borderStartWidth: 3, borderStartColor: tc }}>
                    {adv.tone === 'up' ? <Icon name="up" size={18} color={tc} strokeWidth={2.6} /> : adv.tone === 'down' ? <Icon name="down" size={18} color={tc} strokeWidth={2.6} /> : <Mark size={18} color={tc} stroke={4} />}
                    <Text variant="small" weight={700} style={{ flex: 1 }}>
                      {ltrNums(adv.text)}
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
        {workDone ? <Button kind="ghost" icon="trash" title={t('Discard workout')} color={c.down} style={{ marginTop: 4 }} onPress={() => setDiscard(true)} /> : null}
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
            <RestRing rest={rest} />
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
            <Springy onPress={() => setWaterOpen(true)} accessibilityRole="button" accessibilityLabel={t('Log water')} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(56,189,248,0.16)' }}>
              <Icon name="drop" size={20} color="#38BDF8" />
            </Springy>
            <Button small kind="glass" icon="timer" title={t('Rest')} onPress={() => setRest({ end: Date.now() + REST * 1000, total: REST })} />
          </Glass>
        )}
      </View>

      <Sheet open={waterOpen} onClose={() => setWaterOpen(false)}>
        <Text variant="h2" center>
          {t('How much did you drink?')}
        </Text>
        {food.isToday ? (
          <Text color="sec" center style={{ marginTop: 4 }}>
            {t('{n} ml so far today', { n: food.water })}
          </Text>
        ) : null}
        <Row gap={8} style={{ marginTop: 16 }}>
          {[150, 250, 500, 750].map((ml) => (
            <View key={ml} style={{ flex: 1 }}>
              <Button kind="soft" title={`${ml}`} style={{ alignSelf: 'stretch' }} onPress={() => drink(ml)} />
            </View>
          ))}
        </Row>
        <Text variant="xs" color="sec" center style={{ marginTop: 8 }}>
          {t('ml')}
        </Text>
      </Sheet>

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
                  kind="soft"
                  icon="edit"
                  title={t(st.note?.trim() ? 'Edit note' : 'Add a note to this set')}
                  color={c.text}
                  style={{ marginTop: 8 }}
                  onPress={() => {
                    setNoteAt(`${ei}:${si}`);
                    setSetMenu(null);
                  }}
                />
                <Button
                  kind="ghost"
                  icon="trash"
                  title={t('Delete set')}
                  color={c.down}
                  // One set always stays, like Remove set.
                  disabled={s.ex[ei].sets.length <= 1}
                  style={{ marginTop: 8 }}
                  onPress={() => {
                    editSets(ei, (sets) => sets.filter((_, j) => j !== si));
                    setNoteAt(null);
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

      <Sheet open={early} onClose={() => setEarly(false)}>
        <Text variant="h2">{t('Finish the workout?')}</Text>
        <Text color="sec" style={{ marginTop: 4 }}>
          {left === 1 ? t('1 set isn’t done yet. Only the sets you finished are saved.') : t('{n} sets aren’t done yet. Only the sets you finished are saved.', { n: left })}
        </Text>
        <Button title={t('Keep training')} style={{ marginTop: 16 }} onPress={() => setEarly(false)} />
        <Button kind="glass" title={t('Finish and save')} style={{ marginTop: 8 }} onPress={() => finish(true)} />
      </Sheet>

      <Sheet open={discard} onClose={() => setDiscard(false)}>
        <Text variant="h2">{t('Discard this workout?')}</Text>
        <Text color="sec" style={{ marginTop: 4 }}>
          {t('Nothing from it is saved. This can’t be undone.')}
        </Text>
        <Button title={t('Keep training')} style={{ marginTop: 16 }} onPress={() => setDiscard(false)} />
        <Button
          kind="ghost"
          icon="trash"
          title={t('Discard workout')}
          color={c.down}
          style={{ marginTop: 8 }}
          onPress={() => {
            setDiscard(false);
            setRest(null);
            train.discardSession();
            router.replace('/train');
          }}
        />
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
            goBack();
          }}
        />
      </Sheet>
    </View>
  );
}

/** The weight box. It shows and takes your unit (kg or lb) while the set keeps kg. */
function WeightInput({ value, onChange, W, inputRef, ...rest }: { value: string; onChange: (kg: string) => void; W: W; inputRef?: (r: TextInput | null) => void } & Omit<ComponentProps<typeof TextInput>, 'value' | 'onChangeText' | 'onChange'>) {
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
      ref={inputRef}
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

/** The workout clock, ticking by itself so the screen doesn't redraw every second. */
function Elapsed({ start }: { start: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const secs = Math.max(0, Math.floor((now - start) / 1000));
  return (
    <Text variant="small" weight={700} color="sec" num>
      {`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`}
    </Text>
  );
}

/** The rest countdown ring. The rest itself ends in components/WorkoutLive (beep and toast). */
function RestRing({ rest }: { rest: Rest }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, Math.ceil((rest.end - now) / 1000));
  return (
    <View style={{ alignItems: 'center', marginTop: 4, marginBottom: 14 }}>
      <Ring value={left} max={rest.total} size={150} stroke={10}>
        <Text num size={44}>{`${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`}</Text>
      </Ring>
    </View>
  );
}
