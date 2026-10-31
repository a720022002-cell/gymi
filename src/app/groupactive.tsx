import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { ExercisePicker } from '@/components/train/ExercisePicker';
import { Button, Card, Row, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import {
  type BoardMember,
  cardioSportOf,
  exOf,
  getGroupWorkout,
  GROUP_ALT,
  groupBoard,
  type GroupChange,
  groupChanges,
  type GroupEx,
  groupExName,
  groupNudge,
  type GroupSessionFull,
  groupTurn,
  isCardio,
  joinGroupWorkout,
  type MySets,
  pingGroup,
  saveMySets,
  setsOf,
} from '@/lib/groupWorkout';
import { toPlanEx } from '@/lib/exercisesDb';
import { setSessionStatus } from '@/lib/social';
import { useTrain, type WorkoutLog } from '@/lib/train';
import { sportInfo } from '@/lib/sports';
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

// The last copy of each group workout, so coming back to it (from another screen or after leaving the app) shows it
// right away while the fresh copy loads, instead of a loading screen.
const cache = new Map<string, Data>();
const cacheKey = (id: string) => `adro.group.${id}`;

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
  const [d, setD] = useState<Data | null>(() => cache.get(id) ?? null);
  // My sets as I edit them (the server copy lags a few seconds behind).
  const [mine, setMine] = useState<{ id: string; sets: Record<string, MySets> } | null>(() => {
    const x = cache.get(id);
    return x ? { id, sets: x.board.find((m) => m.user_id === me)?.sets ?? {} } : null;
  });
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
  // Friends' changes (a set added or removed, an exercise swapped) waiting for your answer: do the same or not.
  const prevBoard = useRef<BoardMember[] | null>(null);
  const [asks, setAsks] = useState<GroupChange[]>([]);
  const [otherPick, setOtherPick] = useState(false);

  // After the app was closed: the copy saved on the phone, until the fresh one arrives.
  useEffect(() => {
    if (cache.has(id)) return;
    AsyncStorage.getItem(cacheKey(id))
      .then((v) => {
        if (!v || cache.has(id)) return;
        const x = JSON.parse(v) as Data;
        setD((cur) => cur ?? x);
        setMine((m) => m ?? { id, sets: x.board.find((b) => b.user_id === me)?.sets ?? {} });
      })
      .catch(() => {});
  }, [id, me]);

  const load = useCallback(async () => {
    const [g, board] = await Promise.all([getGroupWorkout(id), groupBoard(id)]);
    const x = { id, g, board };
    cache.set(id, x);
    if (g && g.status !== 'done') AsyncStorage.setItem(cacheKey(id), JSON.stringify(x)).catch(() => {});
    else AsyncStorage.removeItem(cacheKey(id)).catch(() => {});
    const before = prevBoard.current;
    prevBoard.current = board;
    if (before && g?.status === 'live') {
      const ch = groupChanges(g.workout, before, board, me);
      if (ch.length) setAsks((a) => [...a, ...ch.filter((c) => !a.some((y) => y.key === c.key))].slice(-5));
    }
    setD(x);
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
  const exName = (x: GroupEx) => groupExName(x, lang, t);
  // "I'm here, starting without you": everyone who hasn't joined gets a notification.
  const ping = async () => {
    const r = await pingGroup(id);
    toast(t(r === 'ok' ? 'Sent. They’ll get a notification.' : r === 'wait' ? 'Sent already. Give them a minute.' : 'Couldn’t send. Please try again.'), { icon: r === 'none' ? 'warn' : 'bell' });
  };

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
            {t(g.status === 'live' ? 'They already started' : 'Waiting for everyone')}
          </Text>
          <Text variant="small" color="sec" center style={{ marginTop: 4 }}>
            {t(g.status === 'live' ? 'Join now and train with them. You start from the exercise they’re on.' : 'Each person taps Start on their own phone. The workout begins when everyone is in.')}
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
            title={t(g.status === 'live' ? 'Join now' : 'Start')}
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
            icon="bell"
            title={t('I’m here. Start without them')}
            style={{ marginTop: 8 }}
            onPress={async () => {
              await setSessionStatus(id, 'live');
              await ping();
              load();
            }}
          />
        ) : null}
        {meRow?.joined && !host && g.status === 'open' ? <Button kind="glass" icon="bell" title={t('Tell them I’m here')} style={{ marginTop: 8 }} onPress={ping} /> : null}
        {host && g.status === 'open' ? (
          <Text variant="xs" color="sec" center style={{ marginTop: 6 }}>
            {t('They get a notification and can join any time.')}
          </Text>
        ) : null}
        {g.status === 'done' ? <Button kind="ghost" title={t('Close')} style={{ marginTop: 8 }} onPress={() => router.replace('/friends')} /> : null}
      </Screen>
    );

  const { cur, turn, finished } = groupTurn(g.workout, board);
  const v = Math.min(view ?? cur, g.workout.length - 1);
  const slot = g.workout[v];
  // Your own exercise for this spot: the group's, or the one you swapped in.
  const ex = exOf(meRow, slot);
  const mySets = setsOf(meRow, slot);
  const cardio = isCardio(ex);
  const timed = cardio || exInfo({ id: ex.id }, lang).timed || ex.type === 2;
  const nudge = groupNudge(slot, meRow, others);
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
    const key = `${slot.id}:${si}`;
    if (st.done) return setMySets(slot.id, { ...mySets, sets: mySets.sets.map((x, j) => (j === si ? { ...x, done: false } : x)) });
    const lw = last[si]?.w ?? last[last.length - 1]?.w ?? 0;
    const w = timed ? 0 : W.toKg(+(typed[key]?.w ?? '')) || st.w || lw || 0;
    const r = +(typed[key]?.r ?? '') || st.r || mySets.reps;
    setMySets(slot.id, { ...mySets, sets: mySets.sets.map((x, j) => (j === si ? { w, r, done: true } : x)) });
    if (v === cur) setView(null);
  };
  const doneSet = () => {
    setView(null);
    const e0 = g.workout[cur];
    const e = exOf(meRow, e0);
    const s = setsOf(meRow, e0);
    const si = s.sets.findIndex((x) => !x.done);
    if (si < 0) return;
    const lw = (train.last[e.id] ?? [])[si]?.w ?? 0;
    const key = `${e0.id}:${si}`;
    const w = isCardio(e) || exInfo({ id: e.id }, lang).timed || e.type === 2 ? 0 : Wf(e.id).toKg(+(typed[key]?.w ?? '')) || lw;
    const r = +(typed[key]?.r ?? '') || s.reps;
    setMySets(e0.id, { ...s, sets: s.sets.map((x, j) => (j === si ? { w, r, done: true } : x)) });
  };
  const editSets = (a: 'add' | 'del') => {
    const s = { ...mySets, sets: [...mySets.sets] };
    if (a === 'add' && s.sets.length < 10) s.sets.push({ w: null, r: null, done: false });
    if (a === 'del') {
      const i = s.sets.map((x) => x.done).lastIndexOf(false);
      if (s.sets.length > 1 && i >= 0) s.sets.splice(i, 1);
    }
    setMySets(slot.id, s);
  };
  /** Change one exercise's sets the way a friend did (or your own swap). alt null: back to the group's exercise. */
  const applyTo = (exId: string, kind: GroupChange['kind'], alt?: GroupEx | null) => {
    const e = g.workout.find((x) => x.id === exId);
    if (!e) return;
    const s0 = setsOf(meRow, e);
    const s = { ...s0, sets: [...s0.sets] };
    if (kind === 'add' && s.sets.length < 10) s.sets.push({ w: null, r: null, done: false });
    if (kind === 'del') {
      const i = s.sets.map((x) => x.done).lastIndexOf(false);
      if (s.sets.length > 1 && i >= 0) s.sets.splice(i, 1);
    }
    if (kind === 'swap') {
      if (alt) s.alt = alt;
      else delete s.alt;
    }
    setMySets(exId, s);
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
      for (const x0 of g.workout) {
        const x = exOf(meRow, x0);
        const done = setsOf(meRow, x0)
          .sets.filter((s) => s.done)
          .map((s) => ({ w: s.w ?? 0, r: s.r ?? 0 }));
        if (!done.length) continue;
        if (isCardio(x)) {
          // Cardio: saved as a timed round (its minutes in seconds).
          const n = sportInfo(cardioSportOf(x)).name;
          sets += done.length;
          exercises.push({ id: x.id, n, time: true, sets: done.map((s) => ({ w: 0, r: s.r * 60 })) });
          continue;
        }
        const n = exInfo({ id: x.id, n: x.n, ar: x.ar, m: x.m }, 'en').name;
        sets += done.length;
        done.forEach((s) => (volume += s.w * s.r));
        const top = Math.max(...done.map((s) => s.w));
        const prev = train.best[x.id] ?? 0;
        if (top > prev && prev > 0) prs.push({ id: x.id, n, w: top });
        const info = exInfo({ id: x.id, n: x.n, m: x.m }, 'en');
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

  const alts = (GROUP_ALT[slot.id] ?? []).filter((a) => a !== ex.id && !g.workout.some((x) => x.id === a));
  // The first change from a friend that still makes a difference to you.
  const ask = asks.find((a) => {
    const e = g.workout.find((x) => x.id === a.exId);
    if (!e) return false;
    const s0 = setsOf(meRow, e);
    if (a.kind === 'swap') return (s0.alt?.id ?? '') !== (a.alt?.id ?? '');
    if (a.kind === 'del') return s0.sets.length > 1 && s0.sets.some((x) => !x.done);
    return s0.sets.length < 10;
  });
  const dropAsk = (k: string) => setAsks((a) => a.filter((x) => x.key !== k));
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
              disabled={cardio}
              onPress={() => router.push({ pathname: '/exercise', params: { id: ex.id } })}
              accessibilityRole="button"
              accessibilityLabel={t('How to do {x}', { x: exName(ex) })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
              <Text variant="h3" style={{ flexShrink: 1 }}>
                {exName(ex)}
              </Text>
              {cardio ? null : <Icon name="info" size={16} color={c.sec} />}
            </Springy>
            {!cardio ? (
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
            {cardio ? t('Cardio, everyone at the same time') : muscleLabel(exMuscle(ex.id, exInfo({ id: ex.id, n: ex.n }, lang).muscle), lang, t)}
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
              {`${t(cardio ? 'minutes' : timed ? 'seconds' : 'reps')} ${mySets.reps}`}
            </Text>
            <View style={{ width: 52 }} />
          </View>
          {mySets.sets.map((st, si) => {
            const key = `${slot.id}:${si}`;
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
          <Row gap={8} style={{ marginTop: 10, display: cardio ? 'none' : 'flex' }}>
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
            const s = setsOf(m, slot);
            const theirs = exOf(m, slot);
            const n = s.sets.filter((x) => x.done).length;
            return (
              <Row key={m.user_id} gap={10} style={{ paddingVertical: 6 }}>
                <Avatar id={m.user_id} name={m.name || m.username} size={30} />
                <View style={{ flex: 1 }}>
                  <Text variant="small" weight={700} numberOfLines={1}>
                    {nameOf(m)}
                    {theirs.id !== ex.id ? <Text variant="xs" color="sec">{`  ${exName(theirs)}`}</Text> : null}
                  </Text>
                  <Text variant="xs" color="sec">
                    {m.joined
                      ? cardio
                        ? t(n ? 'Done, {m} min' : 'On it, {m} min', { m: s.sets[0]?.r ?? s.reps })
                        : `${s.sets.length} × ${s.reps} ${timed ? t('s') : t('reps')}${t(', ')}${t('set {a} of {b}', { a: Math.min(n + 1, s.sets.length), b: s.sets.length })}`
                      : t('Hasn’t joined yet')}
                  </Text>
                </View>
                {!m.joined ? (
                  <Springy onPress={ping} accessibilityRole="button" style={{ height: 30, paddingHorizontal: 12, borderRadius: 15, backgroundColor: c.inset, justifyContent: 'center' }}>
                    <Text variant="xs" weight={700}>
                      {t('Remind')}
                    </Text>
                  </Springy>
                ) : null}
                <Row gap={3}>
                  {s.sets.map((x, k) => (
                    <View key={k} style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: x.done ? c.cobalt : c.inset }} />
                  ))}
                </Row>
              </Row>
            );
          })}
        </Card>
        {nudge ? (
          <Card style={{ backgroundColor: c.gAi, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Mark size={26} color={c.cobalt} stroke={5} />
            <Text variant="small" weight={600} style={{ flex: 1 }}>
              {nudge.kind === 'behind'
                ? t('{n} did {w} on this, {d} more than you. You can add a little on your next set.', { n: nameOf(nudge.who), w: W.text(nudge.kg), d: W.text(nudge.diff) })
                : nudge.kind === 'reps'
                  ? t('Same weight as {n}, but {n} did {r} more reps. One more rep and you’re level.', { n: nameOf(nudge.who), r: nudge.reps })
                  : t('You’re ahead of {n} by {d} on this one. Keep it up.', { n: nameOf(nudge.who), d: W.text(nudge.diff) })}
            </Text>
          </Card>
        ) : null}
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
        ) : isCardio(g.workout[cur]) && !setsOf(meRow, g.workout[cur]).sets.every((x) => x.done) ? (
          <Glass style={{ borderRadius: 32, paddingVertical: 8, paddingEnd: 8, paddingStart: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Mark size={26} color={c.cobalt} stroke={5} />
            <View style={{ flex: 1 }}>
              <Text weight={700}>{t('Everyone together')}</Text>
              <Text variant="small" color="sec" numberOfLines={1}>
                {t('{x}, {m} min', { x: exName(g.workout[cur]), m: setsOf(meRow, g.workout[cur]).reps })}
              </Text>
            </View>
            <Button small icon="check" title={t('Done')} onPress={doneSet} />
          </Glass>
        ) : turn?.user_id === me ? (
          <Glass style={{ borderRadius: 32, paddingVertical: 8, paddingEnd: 8, paddingStart: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Mark size={26} color={c.cobalt} stroke={5} />
            <View style={{ flex: 1 }}>
              <Text weight={700}>{t('Your turn')}</Text>
              <Text variant="small" color="sec" numberOfLines={1}>
                {t('{x}, set {a} of {b}', { x: exName(exOf(meRow, g.workout[cur])), a: (turnSets?.sets.filter((x) => x.done).length ?? 0) + 1, b: turnSets?.sets.length ?? 0 })}
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
          {t('Machine busy? Pick another exercise. Your friends get asked if they want to change too.')}
        </Text>
        {mySets.alt ? (
          <Button
            kind="glass"
            title={t('Back to {x}', { x: exName(slot) })}
            style={{ marginTop: 8 }}
            onPress={() => {
              setSwap(false);
              applyTo(slot.id, 'swap', null);
            }}
          />
        ) : null}
        {alts.map((a) => (
          <Button
            key={a}
            kind="glass"
            title={exInfo({ id: a }, lang).name}
            style={{ marginTop: 8 }}
            onPress={() => {
              setSwap(false);
              applyTo(slot.id, 'swap', { id: a, type: slot.type });
            }}
          />
        ))}
        <Button
          kind="glass"
          icon="search"
          title={t('Other exercise')}
          style={{ marginTop: 8 }}
          onPress={() => {
            setSwap(false);
            setOtherPick(true);
          }}
        />
        <Button kind="soft" title={t('Cancel')} style={{ marginTop: 8 }} onPress={() => setSwap(false)} />
      </Sheet>
      <ExercisePicker
        open={otherPick}
        replacing
        like={(({ name, muscle }) => ({ id: ex.id, name, muscle }))(exInfo({ id: ex.id, n: ex.n, ar: ex.ar, m: ex.m }, lang))}
        title={t('Replace {x}', { x: exName(ex) })}
        onClose={() => setOtherPick(false)}
        onPick={(e) => {
          setOtherPick(false);
          const pe = toPlanEx(e);
          applyTo(slot.id, 'swap', { id: pe.id, type: slot.type, ...(pe.n ? { n: pe.n, ar: pe.ar, m: pe.m } : {}) });
        }}
      />

      {/* A friend changed something: do the same? */}
      <Sheet open={!!ask} onClose={() => ask && dropAsk(ask.key)}>
        {ask ? (
          <View>
            <Text variant="h2">
              {ask.kind === 'add'
                ? t('{n} added a set', { n: ask.who })
                : ask.kind === 'del'
                  ? t('{n} removed a set', { n: ask.who })
                  : t('{n} changed an exercise', { n: ask.who })}
            </Text>
            <Text color="sec" style={{ marginTop: 4 }}>
              {(() => {
                const e = g.workout.find((x) => x.id === ask.exId) as GroupEx;
                const name = exName(exOf(meRow, e));
                if (ask.kind === 'add') return t('On {x}. Add one to yours too?', { x: name });
                if (ask.kind === 'del') return t('On {x}. Remove one from yours too?', { x: name });
                return t('{x} to {y}. Change yours too?', { x: name, y: exName(ask.alt ?? e) });
              })()}
            </Text>
            <Button
              icon="check"
              title={t('Yes, same for me')}
              style={{ marginTop: 16 }}
              onPress={() => {
                applyTo(ask.exId, ask.kind, ask.alt);
                dropAsk(ask.key);
              }}
            />
            <Button kind="glass" title={t('No, keep mine')} style={{ marginTop: 8 }} onPress={() => dropAsk(ask.key)} />
          </View>
        ) : null}
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
