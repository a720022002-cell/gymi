import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { Thinking } from '@/components/food/Thinking';
import { Icon } from '@/components/Icon';
import { Bar } from '@/components/Ring';
import { Screen } from '@/components/Screen';
import { Avatar } from '@/components/social/Avatar';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Row, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { localDay } from '@/lib/nutrition';
import { getGroupSession, type GroupSession, postActivity, sessionBoard, type SessionMember, setSessionStatus, updateMySession } from '@/lib/social';
import { supabase } from '@/lib/supabase';
import { scheme } from '@/lib/together';
import { exInfo, muscleLabel, workoutKcal } from '@/lib/training';
import { useSettings } from '@/theme/settings';

/** When the group workout started and how long it has run (45 min if it never started). */
function sessionTime(startedAt: string | null) {
  const now = Date.now();
  const start = startedAt ? new Date(startedAt) : new Date(now - 45 * 60000);
  return { start, minutes: Math.max(5, Math.min(600, Math.round((now - start.getTime()) / 60000))) };
}

/** Live group workout: everyone ticks their own sets and sees the others' progress (design: groupactive). */
export default function GroupActive() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { session, profile } = useAuth();
  const me = session?.user.id ?? '';
  const { id } = useLocalSearchParams<{ id: string }>();
  const [s, setS] = useState<{ id: string; g: GroupSession | null; board: SessionMember[] } | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const [g, board] = await Promise.all([getGroupSession(id), sessionBoard(id)]);
    setS({ id, g, board });
  }, [id]);
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (alive) await load();
    };
    tick();
    const iv = setInterval(tick, 4000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [load]);

  const d = s?.id === id ? s : null;
  if (!d)
    return (
      <Screen title={t('Group workout')} back>
        <Thinking message={t('Loading')} />
      </Screen>
    );
  if (!d.g)
    return (
      <Screen title={t('Group workout')} back>
        <Card style={{ alignItems: 'center' }}>
          <Text color="sec">{t('No group workout running.')}</Text>
        </Card>
      </Screen>
    );
  const g = d.g;
  const mine = d.board.find((m) => m.user_id === me);
  const host = g.host === me;
  const total = (lvl: SessionMember['level']) => g.workout.reduce((a, x) => a + scheme(lvl, x.type).sets, 0);
  const doneOf = (m: SessionMember) => Object.values(m.done ?? {}).reduce((a, n) => a + n, 0);

  const tick = async (exId: string, sets: number) => {
    if (!mine) return;
    const cur = mine.done?.[exId] ?? 0;
    const next = { ...(mine.done ?? {}), [exId]: cur >= sets ? 0 : cur + 1 };
    setS({ ...d, board: d.board.map((m) => (m.user_id === me ? { ...m, done: next } : m)) });
    await updateMySession(id, me, { done: next });
  };

  const save = async () => {
    if (!mine) return;
    const { start, minutes } = sessionTime(g.started_at);
    const exercises = g.workout.map((x) => {
      const sc = scheme(mine.level, x.type);
      return { id: x.id, n: exInfo({ id: x.id }, 'en').name, sets: Array.from({ length: Math.min(sc.sets, mine.done?.[x.id] ?? 0) }, () => ({ w: 0, r: sc.reps })) };
    });
    const sets = exercises.reduce((a, e) => a + e.sets.length, 0);
    const { error } = await supabase.from('workout_logs').insert({ day: localDay(), name: 'Full body', started_at: start.toISOString(), minutes, volume: 0, sets_done: sets, kcal: workoutKcal(minutes, Number(profile?.weight_kg ?? 75)), exercises });
    if (error) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
    const others = d.board.filter((m) => m.user_id !== me && m.joined).map((m) => m.name || m.username);
    if (others.length) await postActivity('post', t('Trained together with {n}', { n: others.join(t(', ')) }));
    setSaved(true);
    toast(t('Saved to your workouts'), { icon: 'check' });
  };

  return (
    <Screen title={t('Group workout')} back>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text weight={700}>{t(g.status === 'open' ? 'Waiting to start' : g.status === 'live' ? 'Live now' : 'Finished')}</Text>
          {g.status === 'live' ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.up }} /> : null}
        </Row>
        {d.board.map((m) => {
          const tot = total(m.level);
          const dn = doneOf(m);
          return (
            <Row key={m.user_id} gap={10} style={{ marginTop: 12 }}>
              <Avatar id={m.user_id} name={m.name || m.username} size={30} />
              <View style={{ flex: 1 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text variant="small" weight={700}>
                    {m.user_id === me ? t('You') : m.name || m.username}
                    {m.user_id === g.host ? <Text variant="xs" color="sec">{`  ${t('Host')}`}</Text> : null}
                  </Text>
                  <Text variant="xs" weight={700} color="sec" num>
                    {m.joined ? `${dn}/${tot}` : t('Invited')}
                  </Text>
                </Row>
                <View style={{ marginTop: 4 }}>
                  <Bar value={dn} max={tot} color={m.user_id === me ? c.cobalt : c.sec} />
                </View>
              </View>
            </Row>
          );
        })}
      </Card>
      {mine && !mine.joined ? (
        <Button
          icon="users"
          title={t('Join the workout')}
          onPress={async () => {
            await updateMySession(id, me, { joined: true });
            load();
          }}
        />
      ) : null}
      {host && g.status === 'open' ? <Button icon="play" title={t('Start for everyone')} onPress={async () => (await setSessionStatus(id, 'live'), load())} /> : null}
      {mine?.joined
        ? g.workout.map((x, i) => {
            const info = exInfo({ id: x.id }, lang);
            const sc = scheme(mine.level, x.type);
            const dn = mine.done?.[x.id] ?? 0;
            return (
              <Card key={x.id}>
                <Text variant="xs" weight={700} color="sec">{`${i + 1}. ${muscleLabel(info.muscle, lang, t)}`}</Text>
                <Text variant="h3">{info.name}</Text>
                <Text variant="small" color="sec">
                  {sc.timed ? t('{a} rounds × {b} s', { a: sc.sets, b: sc.reps }) : t('{a} sets × {b} reps', { a: sc.sets, b: sc.reps })}
                </Text>
                <Row gap={8} style={{ marginTop: 10, flexWrap: 'wrap' }}>
                  {Array.from({ length: sc.sets }, (_, k) => (
                    <Springy
                      key={k}
                      accessibilityLabel={t('Set {n}', { n: k + 1 })}
                      onPress={() => tick(x.id, sc.sets)}
                      style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: k < dn ? c.cobalt : c.inset }}>
                      {k < dn ? <Icon name="check" size={18} color="#FFFFFF" strokeWidth={2.6} /> : <Text num size={14}>{`${k + 1}`}</Text>}
                    </Springy>
                  ))}
                </Row>
              </Card>
            );
          })
        : null}
      {mine?.joined && !saved ? <Button kind={host ? 'glass' : 'primary'} icon="check" title={t('Save to my workouts')} style={{ marginTop: 8 }} onPress={save} /> : null}
      {host && g.status !== 'done' ? (
        <Button
          title={t('Finish for everyone')}
          style={{ marginTop: 8 }}
          onPress={async () => {
            await setSessionStatus(id, 'done');
            toast(t('Group workout finished'), { icon: 'trophy' });
            if (saved) router.replace('/friends');
            else load();
          }}
        />
      ) : null}
      {g.status === 'done' ? <Button kind="ghost" title={t('Close')} style={{ marginTop: 8 }} onPress={() => router.replace('/friends')} /> : null}
      <Text variant="xs" color="sec" center style={{ marginTop: 8 }}>
        {t('Tap a circle each time you finish a set. Everyone sees it in a few seconds.')}
      </Text>
    </Screen>
  );
}
