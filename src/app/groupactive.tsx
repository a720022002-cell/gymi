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
import { Button, Card, Chip, Row, Springy } from '@/components/ui';
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
import { postActivity, setSessionStatus } from '@/lib/social';
import { useTrain, type WorkoutLog } from '@/lib/train';
import { exInfo, exMuscle, muscleLabel, workoutKcal } from '@/lib/training';
import { useWeight } from '@/lib/units';
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
  const minutes = startedAt ? Math.max(5, Math.min(600, Math.round((now - new Date(startedAt).getTime()) / 60000))) : 45;
  return { minutes, start: startedAt ?? new Date(now - minutes * 60000).toISOString() };
}

type Data = { id: string; g: GroupSessionFull | null; board: BoardMember[] };

/** Live group workout: take turns, log your own weights, see everyone's sets (design: groupactive). */
export default function GroupActive() {
  const { t, lang } = useT();
  const W = useWeight();
  const { colors: c } = useSettings();
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
  const [edit, setEdit] = useState(false);
  const [swap, setSwap] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
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
    const w = exInfo({ id: e.id }, lang).timed || e.type === 2 ? 0 : W.toKg(+(typed[key]?.w ?? '')) || lw;
    const r = +(typed[key]?.r ?? '') || s.reps;
    setMySets(e.id, { ...s, sets: s.sets.map((x, j) => (j === si ? { w, r, done: true } : x)) });
  };
  const editSets = (a: 'add' | 'del' | 'r+' | 'r-') => {
    const s = { ...mySets, sets: [...mySets.sets] };
    if (a === 'add' && s.sets.length < 10) s.sets.push({ w: null, r: null, done: false });
    if (a === 'del') {
      const i = s.sets.map((x) => x.done).lastIndexOf(false);
      if (s.sets.length > 1 && i >= 0) s.sets.splice(i, 1);
    }
    if (a === 'r+') s.reps = Math.min(300, s.reps + (timed ? 5 : 1));
    if (a === 'r-') s.reps = Math.max(1, s.reps - (timed ? 5 : 1));
    setMySets(ex.id, s);
  };

  // Save my sets as a normal workout: real weights, volume and records.
  const finish = async () => {
    setConfirm(false);
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
        exercises.push({ id: x.id, n, sets: done });
      }
      if (sets) {
        const { minutes, start } = sessionTime(g.started_at);
        const log = await train.addLog({
          day: train.today,
          name: 'Together',
          started_at: start,
          minutes,
          volume: Math.round(volume * 10) / 10,
          sets_done: sets,
          kcal: workoutKcal(minutes, Number(profile?.weight_kg ?? 75)),
          exercises,
          prs,
          ups: 0,
          downs: 0,
        });
        if (!log) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
        setSaved(log.id);
        const names = others.filter((m) => m.joined).map((m) => m.name || m.username);
        if (names.length) postActivity('post', t('Trained together with {n}', { n: names.join(t(', ')) })).catch(() => {});
        if (host) await setSessionStatus(id, 'done');
        toast(t('Group workout saved'), { icon: 'users' });
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
          <Springy onPress={() => setConfirm(true)} scaleTo={1.08}>
            <Glass style={{ height: 44, borderRadius: 22, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' }}>
              <Text weight={700}>{t('Finish')}</Text>
            </Glass>
          </Springy>
        }>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="small" weight={700} color="sec">
            {t('Exercise {a} of {b}', { a: cur + 1, b: g.workout.length })}
          </Text>
          <Row gap={4}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: g.status === 'live' ? c.up : c.sec }} />
            <Text variant="xs" weight={700} color="sec">
              {others.length === 1 ? t('Live with 1 friend') : t('Live with {n} friends', { n: others.length })}
            </Text>
          </Row>
        </Row>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8, marginHorizontal: -16 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
          {g.workout.map((x, i) => (
            <Chip key={`${x.id}-${i}`} title={`${i < cur || (finished && i === cur) ? '✓ ' : ''}${exName(x)}`} on={v === i} onPress={() => setView(i)} />
          ))}
        </ScrollView>

        <Card style={{ marginTop: 12 }}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text variant="xs" weight={700} color="sec">
                {muscleLabel(exMuscle(ex.id, exInfo({ id: ex.id, n: ex.n }, lang).muscle), lang, t)}
              </Text>
              <Text variant="h2">{exName(ex)}</Text>
            </View>
            {host && alts.length ? (
              <Springy onPress={() => setSwap(true)}>
                <Text variant="small" weight={700} color="link">
                  {t('Swap')}
                </Text>
              </Springy>
            ) : null}
          </Row>
          <Row style={{ justifyContent: 'space-between', marginTop: 16 }}>
            <Text weight={700}>{t('You')}</Text>
            <Springy onPress={() => setEdit(!edit)}>
              <Text variant="small" weight={700} color="link">
                {t(edit ? 'Done' : 'Edit my sets')}
              </Text>
            </Springy>
          </Row>
          {edit ? (
            <View style={{ marginTop: 8, backgroundColor: c.inset, borderRadius: 14, padding: 12 }}>
              {(
                [
                  [t('Sets'), mySets.sets.length, 'del', 'add', t('Remove a set'), t('Add a set')],
                  [t(timed ? 'Target seconds' : 'Target reps'), mySets.reps, 'r-', 'r+', t('Less'), t('More')],
                ] as const
              ).map(([label, val, minus, plus, la, lb], k) => (
                <Row key={label} style={{ justifyContent: 'space-between', marginTop: k ? 8 : 0 }}>
                  <Text variant="small" weight={700}>
                    {label}
                  </Text>
                  <Row gap={8}>
                    <Springy onPress={() => editSets(minus)} accessibilityLabel={la} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="minus" size={16} strokeWidth={2.2} />
                    </Springy>
                    <Text num style={{ minWidth: 28, textAlign: 'center' }}>
                      {val}
                    </Text>
                    <Springy onPress={() => editSets(plus)} accessibilityLabel={lb} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="plus" size={16} strokeWidth={2.2} />
                    </Springy>
                  </Row>
                </Row>
              ))}
              <Text variant="xs" color="sec" style={{ marginTop: 8 }}>
                {t('Changes sync to everyone’s phone.')}
              </Text>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', marginTop: 10, marginBottom: 4 }}>
            <Text variant="xs" weight={700} color="sec" center style={{ width: 36 }}>
              {t('Set')}
            </Text>
            <Text variant="xs" weight={700} color="sec" center style={{ flex: 1 }}>
              {timed ? '—' : W.label}
            </Text>
            <Text variant="xs" weight={700} color="sec" center style={{ flex: 1 }}>
              {t(timed ? 'seconds' : 'reps')}
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
