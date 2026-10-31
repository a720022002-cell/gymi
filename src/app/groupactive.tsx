import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Thinking } from '@/components/food/Thinking';
import { Glass } from '@/components/Glass';
import { Icon, Mark } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Avatar } from '@/components/social/Avatar';
import { fontFor, Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Bar } from '@/components/Ring';
import { Elapsed } from '@/components/train/Elapsed';
import { Button, Card, Row, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import {
  type BoardMember,
  getGroupWorkout,
  GROUP_ALT,
  groupBoard,
  type GroupEx,
  type GroupSessionFull,
  groupTurn,
  joinGroupWorkout,
  type MySets,
  saveMySets,
  setsOf,
  swapGroupExercise,
} from '@/lib/groupWorkout';
import { setSessionStatus } from '@/lib/social';
import { useTrain, type WorkoutLog } from '@/lib/train';
import { exInfo, exMuscle, muscleLabel, workoutKcal } from '@/lib/training';
import { useExerciseWeight } from '@/lib/units';
import { useSettings } from '@/theme/settings';

const digits = (v: string, dec: boolean) =>
  v
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[,٫]/g, '.')
    .replace(dec ? /[^\d.]/g : /\D/g, '')
    .slice(0, 6);

/** When the group workout started and minutes since (45 min if it never started). */
function sessionTime(startedAt: string | null) {
  const now = Date.now();
  const minutes = startedAt ? Math.max(5, Math.min(240, Math.round((now - new Date(startedAt).getTime()) / 60000))) : 45;
  return { minutes, start: startedAt ?? new Date(now - minutes * 60000).toISOString() };
}

type Data = { id: string; g: GroupSessionFull | null; board: BoardMember[] };

/** Live group workout: take turns, log your own weights, see everyone's sets (design: groupactive). */
export default function GroupActive() {
  const { t, lang } = useT();
  const Wf = useExerciseWeight();
  const { colors: c, setExUnit } = useSettings();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { session, profile } = useAuth();
  const train = useTrain();
  const me = session?.user.id ?? '';
  const { id } = useLocalSearchParams<{ id: string }>();
  const [d, setD] = useState<Data | null>(null);
  // My sets as I edit them (the server copy lags a few seconds behind).
  const [mine, setMine] = useState<{ id: string; sets: Record<string, MySets> } | null>(null);
  // Typed but not yet finished weights and reps: "exId:set" → value.
  const [typed, setTyped] = useState<Record<string, { w?: string; r?: string }>>({});
  const [view, setView] = useState<number | null>(null);
  const [swap, setSwap] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  // A save in progress: a second tap on Finish doesn't save the workout again.
  const finishing = useRef(false);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastStatus = useRef<string | null>(null);

  const load = useCallback(async () => {
    const [g, board] = await Promise.all([getGroupWorkout(id), groupBoard(id)]);
    setD({ id, g, board });
    setMine((m) => (m && m.id === id ? m : { id, sets: board.find((x) => x.user_id === me)?.sets ?? {} }));
    if (g && lastStatus.current === 'open' && g.status === 'live') toast(t('Everyone is in. Let’s go.'), { ai: true });
    lastStatus.current = g?.status ?? null;
  }, [id, me, toast, t]);
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (alive) await load();
    };
    tick();
    const iv = setInterval(tick, 3000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [load]);

  const data = d?.id === id ? d : null;
  if (!data)
    return (
      <Screen title={t('Group workout')} back>
        <Thinking message={t('Loading')} />
      </Screen>
    );
  if (!data.g)
    return (
      <Screen title={t('Group workout')} back>
        <Card style={{ alignItems: 'center' }}>
          <Text color="sec">{t('No group workout running.')}</Text>
        </Card>
      </Screen>
    );
  const g = data.g;
  const host = g.host === me;
  const my = mine?.id === id ? mine.sets : {};
  // The board with my latest sets in it.
  const board = data.board.map((m) => (m.user_id === me ? { ...m, sets: my } : m));
  const meRow = board.find((m) => m.user_id === me);
  const others = board.filter((m) => m.user_id !== me);
  const nameOf = (m: BoardMember) => (m.user_id === me ? t('You') : m.name || m.username);
  const exName = (x: GroupEx) => exInfo({ id: x.id, n: x.n }, lang).name;

  const writeMine = (sets: Record<string, MySets>) => {
    setMine({ id, sets });
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveMySets(id, me, sets).catch(() => {});
    }, 400);
  };

  // Not joined yet, or waiting for everyone to tap Start.
  if (!meRow?.joined || g.status === 'open')
    return (
      <Screen title={t('Group workout')} back>
        <View style={{ alignItems: 'center', marginTop: 8 }}>
          <Mark size={48} color={c.cobalt} stroke={9} />
          <Text variant="h2" center style={{ marginTop: 12 }}>
            {t('Waiting for everyone')}
          </Text>
          <Text variant="small" color="sec" center style={{ marginTop: 4 }}>
            {t('Each person taps Start on their own phone. The workout begins when everyone is in.')}
          </Text>
        </View>
        <View style={{ marginTop: 16, backgroundColor: c.card, borderRadius: 22, overflow: 'hidden' }}>
          {board.map((m, i) => (
            <Row key={m.user_id} gap={12} style={{ minHeight: 60, paddingHorizontal: 14, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
              <Avatar id={m.user_id} name={m.name || m.username} size={40} />
              <Text weight={700} style={{ flex: 1 }}>
                {nameOf(m)}
                {m.user_id === g.host ? <Text variant="xs" color="sec">{`  ${t('Host')}`}</Text> : null}
              </Text>
              {m.joined ? (
                <Row gap={4} style={{ backgroundColor: c.inset, borderRadius: 12, paddingHorizontal: 8, height: 26 }}>
                  <Icon name="check" size={13} color={c.up} strokeWidth={2.6} />
                  <Text variant="xs" weight={700}>
                    {t('Ready')}
                  </Text>
                </Row>
              ) : (
                <Text variant="small" weight={700} color="sec">
                  {t('Joining')}
                </Text>
              )}
            </Row>
          ))}
        </View>
        {meRow && !meRow.joined && g.status !== 'done' ? (
          <Button
            icon="play"
            title={t('Start')}
            style={{ marginTop: 12 }}
            onPress={async () => {
              await joinGroupWorkout(id);
              load();
            }}
          />
        ) : null}
        {host && g.status === 'open' ? (
          <Button
            kind="glass"
            title={t('Start without waiting')}
            style={{ marginTop: 8 }}
            onPress={async () => {
              await setSessionStatus(id, 'live');
              load();
            }}
          />
        ) : null}
        {g.status === 'done' ? <Button kind="ghost" title={t('Close')} style={{ marginTop: 8 }} onPress={() => router.replace('/friends')} /> : null}
      </Screen>
    );

  const { cur, turn, finished } = groupTurn(g.workout, board);
  const v = Math.min(view ?? cur, g.workout.length - 1);
  const ex = g.workout[v];
  const mySets = setsOf(meRow, ex);
  const timed = exInfo({ id: ex.id }, lang).timed || ex.type === 2;
  // Each exercise in its own unit (kg or lb, switched on its card), like a solo workout.
  const W = Wf(ex.id);
  // Your sets across the whole workout, for the bar at the top.
  const allMine = g.workout.map((x) => setsOf(meRow, x).sets);
  const tot = allMine.reduce((a, x) => a + x.length, 0);
  const dn = allMine.reduce((a, x) => a + x.filter((y) => y.done).length, 0);
  const exDone = (i: number) => allMine[i].length > 0 && allMine[i].every((y) => y.done);
  const last = train.last[ex.id] ?? [];

  const setMySets = (exId: string, s: MySets) => writeMine({ ...my, [exId]: s });
  const markSet = (si: number) => {
    const st = mySets.sets[si];
    const key = `${ex.id}:${si}`;
    if (st.done) return setMySets(ex.id, { ...mySets, sets: mySets.sets.map((x, j) => (j === si ? { ...x, done: false } : x)) });
    const lw = last[si]?.w ?? last[last.length - 1]?.w ?? 0;
    const w = timed ? 0 : W.toKg(+(typed[key]?.w ?? '')) || st.w || lw || 0;
    const r = +(typed[key]?.r ?? '') || st.r || mySets.reps;
    setMySets(ex.id, { ...mySets, sets: mySets.sets.map((x, j) => (j === si ? { w, r, done: true } : x)) });
    if (v === cur) setView(null);
  };
  const doneSet = () => {
    setView(null);
    const e = g.workout[cur];
    const s = setsOf(meRow, e);
    const si = s.sets.findIndex((x) => !x.done);
    if (si < 0) return;
    const lw = (train.last[e.id] ?? [])[si]?.w ?? 0;
    const key = `${e.id}:${si}`;
    const w = exInfo({ id: e.id }, lang).timed || e.type === 2 ? 0 : Wf(e.id).toKg(+(typed[key]?.w ?? '')) || lw;
    const r = +(typed[key]?.r ?? '') || s.reps;
    setMySets(e.id, { ...s, sets: s.sets.map((x, j) => (j === si ? { w, r, done: true } : x)) });
  };
  const editSets = (a: 'add' | 'del') => {
    const s = { ...mySets, sets: [...mySets.sets] };
    if (a === 'add' && s.sets.length < 10) s.sets.push({ w: null, r: null, done: false });
    if (a === 'del') {
      const i = s.sets.map((x) => x.done).lastIndexOf(false);
      if (s.sets.length > 1 && i >= 0) s.sets.splice(i, 1);
    }
    setMySets(ex.id, s);
  };

  // Save my sets as a normal workout: real weights, volume and records.
  const finish = async () => {
    setConfirm(false);
    if (finishing.current) return;
    finishing.current = true;
    setSaving(true);
    try {
      await saveGroup();
    } finally {
      finishing.current = false;
      setSaving(false);
    }
  };
  const saveGroup = async () => {
    if (!saved) {
      const exercises: WorkoutLog['exercises'] = [];
      const prs: WorkoutLog['prs'] = [];
      let volume = 0;
      let sets = 0;
      for (const x of g.workout) {
        const done = setsOf(meRow, x)
          .sets.filter((s) => s.done)
          .map((s) => ({ w: s.w ?? 0, r: s.r ?? 0 }));
        if (!done.length) continue;
        const n = exInfo({ id: x.id, n: x.n }, 'en').name;
        sets += done.length;
        done.forEach((s) => (volume += s.w * s.r));
        const top = Math.max(...done.map((s) => s.w));
        const prev = train.best[x.id] ?? 0;
        if (top > prev && prev > 0) prs.push({ id: x.id, n, w: top });
        const info = exInfo({ id: x.id, n: x.n }, 'en');
        exercises.push({ id: x.id, n, ...(info.muscle !== 'Other' ? { m: info.muscle } : {}), ...(info.timed || x.type === 2 ? { time: true } : {}), sets: done });
      }
      if (sets) {
        const { minutes, start } = sessionTime(g.started_at);
        // Same calories as a normal workout: realistic minutes and 80 kg when your weight isn't set.
        const kcalMin = Math.min(minutes, 180, Math.max(30, sets * 6));
        const res = await train.addLog({
          day: train.today,
          name: 'Together',
          started_at: start,
          minutes,
          volume: Math.round(volume * 10) / 10,
          sets_done: sets,
          kcal: workoutKcal(kcalMin, Number(profile?.weight_kg ?? 80)),
          exercises,
          prs,
          ups: 0,
          downs: 0,
          // Saved once per group workout (the database refuses a second one).
          group_session: id,
        });
        if (!res) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
        const { log, dup } = res;
        setSaved(log.id);
        // Health app and friends' feed (if you share workouts) are handled like any workout, in lib/train.
        if (host) await setSessionStatus(id, 'done');
        toast(t(dup ? 'This group workout is already saved' : 'Group workout saved'), { icon: 'users' });
        return router.replace({ pathname: '/summary', params: { id: log.id } });
      }
    }
    if (host) await setSessionStatus(id, 'done');
    router.replace('/train');
  };

  const alts = (GROUP_ALT[ex.id] ?? []).filter((a) => !g.workout.some((x) => x.id === a));
  const turnSets = turn ? setsOf(turn, g.workout[cur]) : null;

  return (
    <View style={{ flex: 1 }}>
      <Screen
        title={t('Group workout')}
        back
        right={
          <Springy onPress={() => setConfirm(true)} disabled={saving} scaleTo={1.08}>
            <Glass style={{ height: 44, borderRadius: 22, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' }}>
              <Text weight={700}>{t(saving ? 'Saving…' : 'Finish')}</Text>
            </Glass>
          </Springy>
        }>
        <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <Text variant="small" weight={700} color="sec">
            {t('{a} of {b} sets', { a: dn, b: tot })}
          </Text>
          <Row gap={10}>
            <Row gap={4}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: g.status === 'live' ? c.up : c.sec }} />
              <Text variant="xs" weight={700} color="sec">
                {others.length === 1 ? t('Live with 1 friend') : t('Live with {n} friends', { n: others.length })}
              </Text>
            </Row>
            {g.started_at ? <Elapsed start={new Date(g.started_at).getTime()} /> : null}
          </Row>
        </Row>
        <Bar value={dn} max={tot} color={c.cobalt} />
        {/* The exercises: tap one to see it. A green check once all your sets on it are done. */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginHorizontal: -20, marginTop: 14, marginBottom: 12 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
          {g.workout.map((x, i) => {
            const on = v === i;
            const done = exDone(i);
            return (
              <Springy
                key={`${x.id}-${i}`}
                onPress={() => setView(i)}
                scaleTo={0.96}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, paddingStart: 6, paddingEnd: 14, borderRadius: 20, backgroundColor: on ? c.text : c.card }}>
                <View style={[{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, done ? { backgroundColor: c.up } : { borderWidth: 2, borderColor: on ? c.cobalt : c.line }]}>
                  {done ? (
                    <Icon name="check" size={14} color="#FFFFFF" strokeWidth={3} />
                  ) : (
                    <Text num size={12} color={on ? c.cobalt : 'sec'}>
                      {i + 1}
                    </Text>
                  )}
                </View>
                <Text weight={700} size={14} color={on ? c.bg : c.text} numberOfLines={1}>
                  {exName(x)}
                </Text>
              </Springy>
            );
          })}
        </ScrollView>

        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            {/* Tap the name for pictures and how to do it; the workout keeps going. */}
            <Springy
              onPress={() => router.push({ pathname: '/exercise', params: { id: ex.id } })}
              accessibilityRole="button"
              accessibilityLabel={t('How to do {x}', { x: exName(ex) })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
              <Text variant="h3" style={{ flexShrink: 1 }}>
                {exName(ex)}
              </Text>
              <Icon name="info" size={16} color={c.sec} />
            </Springy>
            {host && alts.length ? (
              <Springy
                onPress={() => setSwap(true)}
                scaleTo={0.9}
                accessibilityRole="button"
                accessibilityLabel={t('Swap {x}', { x: exName(ex) })}
                style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="swap" size={18} color={c.cobalt} />
              </Springy>
            ) : null}
          </Row>
          <Text variant="xs" color="sec">
            {muscleLabel(exMuscle(ex.id, exInfo({ id: ex.id, n: ex.n }, lang).muscle), lang, t)}
          </Text>
          <View style={{ flexDirection: 'row', marginTop: 12, marginBottom: 4 }}>
            <Text variant="xs" weight={700} color="sec" center style={{ width: 36 }}>
              {t('Set')}
            </Text>
            {timed ? (
              <Text variant="xs" weight={700} color="sec" center style={{ flex: 1 }}>
                —
              </Text>
            ) : (
              // kg or lb for this exercise only: sets stay saved in kg.
              <View style={{ flex: 1, alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', borderRadius: 10, padding: 2, backgroundColor: c.inset }}>
                  {(['kg', 'lb'] as const).map((u) => (
                    <Springy
                      key={u}
                      onPress={() => setExUnit(ex.id, u)}
                      scaleTo={0.94}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: W.unit === u }}
                      accessibilityLabel={t(u)}
                      style={{ paddingHorizontal: 10, height: 22, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: W.unit === u ? c.text : 'transparent' }}>
                      <Text variant="xs" weight={700} color={W.unit === u ? c.bg : c.sec}>
                        {t(u)}
                      </Text>
                    </Springy>
                  ))}
                </View>
              </View>
            )}
            <Text variant="xs" weight={700} color="sec" center style={{ flex: 1 }}>
              {`${t(timed ? 'seconds' : 'reps')} ${mySets.reps}`}
            </Text>
            <View style={{ width: 52 }} />
          </View>
          {mySets.sets.map((st, si) => {
            const key = `${ex.id}:${si}`;
            const lw = last[si]?.w ?? last[last.length - 1]?.w ?? 0;
            return (
              <View key={si} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, opacity: st.done ? 0.65 : 1 }}>
                <Text num center style={{ width: 28 }}>
                  {si + 1}
                </Text>
                <TextInput
                  value={st.done ? (timed || st.w == null ? '' : W.show(+st.w)) : (typed[key]?.w ?? '')}
                  editable={!timed && !st.done}
                  onChangeText={(x) => setTyped({ ...typed, [key]: { ...typed[key], w: digits(x, true) } })}
                  placeholder={timed ? '—' : lw ? W.show(lw) : '—'}
                  placeholderTextColor={c.sec}
                  inputMode="decimal"
                  keyboardType="decimal-pad"
                  accessibilityLabel={t('Weight set {n}', { n: si + 1 })}
                  style={{ flex: 1, flexBasis: 0, minWidth: 0, width: 0, height: 44, borderRadius: 12, backgroundColor: c.inset, textAlign: 'center', fontFamily: fontFor('sora', 600), fontSize: 17, color: c.text, outlineStyle: 'none' } as object}
                />
                <TextInput
                  value={st.done ? String(st.r ?? '') : (typed[key]?.r ?? '')}
                  editable={!st.done}
                  onChangeText={(x) => setTyped({ ...typed, [key]: { ...typed[key], r: digits(x, false) } })}
                  placeholder={String(mySets.reps)}
                  placeholderTextColor={c.sec}
                  inputMode="numeric"
                  keyboardType="number-pad"
                  accessibilityLabel={t('Reps set {n}', { n: si + 1 })}
                  style={{ flex: 1, flexBasis: 0, minWidth: 0, width: 0, height: 44, borderRadius: 12, backgroundColor: c.inset, textAlign: 'center', fontFamily: fontFor('sora', 600), fontSize: 17, color: c.text, outlineStyle: 'none' } as object}
                />
                <Springy
                  onPress={() => markSet(si)}
                  scaleTo={0.9}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: st.done }}
                  accessibilityLabel={t('Finish set {n}', { n: si + 1 })}
                  style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: st.done ? c.cobalt : c.inset }}>
                  <Icon name="check" size={20} color={st.done ? '#FFFFFF' : c.sec} strokeWidth={2.6} />
                </Springy>
              </View>
            );
          })}
          <Row gap={8} style={{ marginTop: 10 }}>
            <Springy onPress={() => editSets('add')} scaleTo={0.97} style={{ flex: 1, height: 40, borderRadius: 12, backgroundColor: c.inset, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Icon name="plus" size={16} color={c.text} />
              <Text variant="small" weight={700}>
                {t('Add set')}
              </Text>
            </Springy>
            <Springy
              disabled={mySets.sets.length <= 1}
              onPress={() => editSets('del')}
              scaleTo={0.97}
              style={{ flex: 1, height: 40, borderRadius: 12, backgroundColor: c.inset, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: mySets.sets.length <= 1 ? 0.4 : 1 }}>
              <Icon name="minus" size={16} color={c.down} />
              <Text variant="small" weight={700}>
                {t('Remove set')}
              </Text>
            </Springy>
          </Row>
          <View style={{ height: 1, backgroundColor: c.line, marginVertical: 12 }} />
          {others.map((m) => {
            const s = setsOf(m, ex);
            const n = s.sets.filter((x) => x.done).length;
            return (
              <Row key={m.user_id} gap={10} style={{ paddingVertical: 6 }}>
                <Avatar id={m.user_id} name={m.name || m.username} size={30} />
                <View style={{ flex: 1 }}>
                  <Text variant="small" weight={700}>
                    {nameOf(m)}
                  </Text>
                  <Text variant="xs" color="sec">
                    {m.joined
                      ? `${s.sets.length} × ${s.reps} ${timed ? t('s') : t('reps')}, ${t('set {a} of {b}', { a: Math.min(n + 1, s.sets.length), b: s.sets.length })}`
                      : t('Hasn’t joined yet')}
                  </Text>
                </View>
                <Row gap={3}>
                  {s.sets.map((x, k) => (
                    <View key={k} style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: x.done ? c.cobalt : c.inset }} />
                  ))}
                </Row>
              </Row>
            );
          })}
        </Card>
        {v < g.workout.length - 1 ? <Button title={t('Next: {x}', { x: exName(g.workout[v + 1]) })} style={{ marginBottom: 4 }} onPress={() => setView(v + 1)} /> : null}
        {/* Which exercise you're on; green ones are done. */}
        <Row gap={6} style={{ justifyContent: 'center', marginTop: 10, marginBottom: 14 }}>
          {g.workout.map((x, i) => (
            <View key={i} style={{ width: i === v ? 20 : 7, height: 7, borderRadius: 4, backgroundColor: i === v ? c.text : exDone(i) ? c.up : c.line }} />
          ))}
        </Row>
        <View style={{ height: 100 }} />
      </Screen>

      <View pointerEvents="box-none" style={{ position: 'absolute', left: 16, right: 16, bottom: 20 + insets.bottom }}>
        {finished ? (
          <Glass style={{ borderRadius: 32, paddingVertical: 8, paddingEnd: 8, paddingStart: 18, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text weight={700} style={{ flex: 1 }}>
              {t('Workout complete')}
            </Text>
            <Button small title={t('Finish')} onPress={() => setConfirm(true)} />
          </Glass>
        ) : turn?.user_id === me ? (
          <Glass style={{ borderRadius: 32, paddingVertical: 8, paddingEnd: 8, paddingStart: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Mark size={26} color={c.cobalt} stroke={5} />
            <View style={{ flex: 1 }}>
              <Text weight={700}>{t('Your turn')}</Text>
              <Text variant="small" color="sec" numberOfLines={1}>
                {t('{x}, set {a} of {b}', { x: exName(g.workout[cur]), a: (turnSets?.sets.filter((x) => x.done).length ?? 0) + 1, b: turnSets?.sets.length ?? 0 })}
              </Text>
            </View>
            <Button small icon="check" title={t('Done set')} onPress={doneSet} />
          </Glass>
        ) : turn ? (
          <Glass style={{ borderRadius: 32, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Avatar id={turn.user_id} name={turn.name || turn.username} size={34} />
            <View style={{ flex: 1 }}>
              <Text weight={700}>{t('{n} is lifting', { n: turn.name || turn.username })}</Text>
              <Text variant="small" color="sec">
                {others.length > 1 ? t('Rest up. You’re next soon.') : t('Rest up. You’re next.')}
              </Text>
            </View>
          </Glass>
        ) : null}
      </View>

      <Sheet open={swap} onClose={() => setSwap(false)}>
        <Text variant="h2">{t('Swap {x}', { x: exName(ex) })}</Text>
        <Text variant="small" color="sec" style={{ marginTop: 4 }}>
          {t('Machine busy? Pick another exercise. It changes for everyone in the group.')}
        </Text>
        {alts.map((a) => (
          <Button
            key={a}
            kind="glass"
            title={exInfo({ id: a }, lang).name}
            style={{ marginTop: 8 }}
            onPress={async () => {
              setSwap(false);
              const ok = await swapGroupExercise(id, v, { id: a, type: ex.type });
              if (!ok) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
              toast(t('Changed to {x} for everyone', { x: exInfo({ id: a }, lang).name }), { icon: 'users' });
              load();
            }}
          />
        ))}
        <Button kind="soft" title={t('Cancel')} style={{ marginTop: 8 }} onPress={() => setSwap(false)} />
      </Sheet>

      <Sheet open={confirm} onClose={() => setConfirm(false)}>
        <Text variant="h2">{t(host ? 'Finish the group workout?' : 'Finish your workout?')}</Text>
        <Text color="sec" style={{ marginTop: 4 }}>
          {t('Everyone’s sets are saved to their own history.')}
        </Text>
        <Button title={t('Finish')} style={{ marginTop: 16 }} onPress={finish} />
        <Button kind="glass" title={t('Keep going')} style={{ marginTop: 8 }} onPress={() => setConfirm(false)} />
      </Sheet>
    </View>
  );
}
