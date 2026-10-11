import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Field } from '@/components/Field';
import { TimeField } from '@/components/food/TimeField';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Avatar } from '@/components/social/Avatar';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Chip, Row, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { friendLevels, startGroupWorkout } from '@/lib/groupWorkout';
import { addDays, fmtTime } from '@/lib/nutrition';
import { displayName, type FriendRow, myFriends } from '@/lib/social';
import { COLORS, LEVELS, type Level, type Person, scheme, TOG } from '@/lib/together';
import { useTrain } from '@/lib/train';
import { DAYS, DAYS_LONG, exInfo, exMuscle, muscleLabel, type PlanEx } from '@/lib/training';
import { useSettings } from '@/theme/settings';

/** A person in the group. known: their level comes from their own plan or history. */
type P = Person & { known?: boolean; username?: string };

/** Train together: one workout for up to 5 people, the right sets and reps for each level. */
export default function Together() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { profile, session } = useAuth();
  const train = useTrain();
  const params = useLocalSearchParams<{ friend?: string; members?: string }>();
  // Your level is the one in your training plan; without one, it comes from how much you trained in the last 6 months.
  const recent = train.logs.length;
  const myLevel: Level = train.plan?.level ?? (recent >= 60 ? 'Advanced' : recent >= 12 ? 'Intermediate' : 'Beginner');
  const [people, setPeople] = useState<P[]>([]);
  const [name, setName] = useState('');
  const [level, setLevel] = useState<Level>('Intermediate');
  const [ready, setReady] = useState(false);
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [levels, setLevels] = useState<Record<string, Level>>({});
  const [day, setDay] = useState(0);
  const [time, setTime] = useState('18:30');
  const [busy, setBusy] = useState(false);

  // Friends and their levels; friends passed in (from a friend's page or a group) are picked already.
  useEffect(() => {
    let alive = true;
    (async () => {
      const f = (await myFriends()).filter((x) => x.status === 'accepted');
      const lv = await friendLevels(f.map((x) => x.id));
      if (!alive) return;
      setFriends(f);
      setLevels(lv);
      const want = [params.friend, ...(params.members ?? '').split(',')].filter((x): x is string => !!x && x !== session?.user.id);
      const pre = f.filter((x) => want.includes(x.id)).slice(0, 4);
      if (pre.length) {
        setPeople(pre.map((x) => ({ name: displayName(x), username: x.username, id: x.id, level: lv[x.id] ?? 'Beginner', known: true })));
        setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [params.friend, params.members, session?.user.id]);

  const all: P[] = [{ name: t('You'), level: myLevel, me: true }, ...people];
  const appFriends = people.filter((p) => p.id);

  const addPerson = () => {
    const n = name.trim().slice(0, 20);
    if (!n) return;
    if (people.length >= 4) return toast(t('Up to 4 friends at a time'), { icon: 'info' });
    setPeople([...people, { name: n, level }]);
    setName('');
  };
  const togglePick = (f: FriendRow) => {
    if (people.some((p) => p.id === f.id)) return setPeople(people.filter((p) => p.id !== f.id));
    if (people.length >= 4) return toast(t('Up to 4 friends at a time'), { icon: 'info' });
    setPeople([...people, { name: displayName(f), username: f.username, id: f.id, level: levels[f.id] ?? 'Beginner', known: true }]);
  };

  const workout = TOG.map(([id, type]) => ({ id, type }));
  const startLocal = () => {
    if (train.session) return router.replace('/active');
    const ex: PlanEx[] = TOG.map(([id, type]) => {
      const s = scheme(myLevel, type);
      return { id, sets: s.sets, reps: String(s.reps) };
    });
    train.startWorkout('Together', false, false, { ex });
    router.replace('/active');
  };
  const startLive = async () => {
    setBusy(true);
    const sid = await startGroupWorkout(workout, appFriends.map((p) => p.id as string), appFriends.map((p) => p.level), myLevel);
    setBusy(false);
    if (!sid) return toast(t('Couldn’t start. Please try again.'), { icon: 'warn' });
    toast(t('Invite sent. Friends join from Gym Bros.'), { icon: 'users' });
    router.replace({ pathname: '/groupactive', params: { id: sid } });
  };

  // When: today, tomorrow, then the next days of the week.
  const dayLabel = (i: number) => (i === 0 ? t('Today') : i === 1 ? t('Tomorrow') : t(DAYS[(train.todayIdx + i) % 7]));
  const whenText = (i: number) => {
    const d = i === 0 ? t('today') : i === 1 ? t('tomorrow') : t(DAYS_LONG[(train.todayIdx + i) % 7]);
    return t('{d} at {t}', { d, t: fmtTime(time, lang) });
  };
  const names = people.length === 1 ? people[0]?.name : `${people.slice(0, -1).map((p) => p.name).join(t(', '))} ${t('and')} ${people[people.length - 1]?.name}`;
  const sendInvite = async () => {
    const [h, m] = time.split(':').map(Number);
    const [y, mo, d] = addDays(train.today, day).split('-').map(Number);
    const at = new Date(y, mo - 1, d, h, m);
    if (at.getTime() < Date.now()) return toast(t('That time has passed. Pick a later time.'), { icon: 'clock' });
    setBusy(true);
    const sid = await startGroupWorkout(workout, appFriends.map((p) => p.id as string), appFriends.map((p) => p.level), myLevel, at);
    setBusy(false);
    if (!sid) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
    toast(t('Invite sent to {names} for {when}', { names: appFriends.map((p) => p.name).join(t(', ')), when: whenText(day) }), { icon: 'users', action: { label: t('View'), fn: () => router.replace('/train') } });
  };

  const avatar = (p: P, i: number, size = 36) =>
    p.id ? (
      <View style={{ borderWidth: 2, borderColor: c.bg, borderRadius: size / 2 + 2 }}>
        <Avatar id={p.id} name={p.name} size={size} />
      </View>
    ) : p.me && session ? (
      <View style={{ borderWidth: 2, borderColor: c.bg, borderRadius: size / 2 + 2 }}>
        <Avatar id={session.user.id} name={profile?.name || p.name} size={size} />
      </View>
    ) : (
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: COLORS[i % COLORS.length], alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.bg }}>
        <Text weight={700} size={size * 0.4} color="#FFFFFF">
          {p.name.slice(0, 1).toUpperCase()}
        </Text>
      </View>
    );

  if (!ready)
    return (
      <Screen title={t('Train together')} back>
        <Text color="sec">{t('Pick up to 4 friends. I’ll build one workout for the whole group, with the right sets and reps for each person’s level.')}</Text>
        <Text variant="small" color="sec" style={{ marginTop: 12 }}>
          {t('Your level: {l}. Everyone’s level comes from their training plan.', { l: t(myLevel) })}
        </Text>
        {friends.length ? (
          <View style={{ marginTop: 16, backgroundColor: c.card, borderRadius: 22, overflow: 'hidden' }}>
            {friends.map((f, i) => {
              const on = people.some((p) => p.id === f.id);
              return (
                <View key={f.id} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: c.line, paddingHorizontal: 14, paddingVertical: 10 }}>
                  <Springy onPress={() => togglePick(f)} scaleTo={0.99} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Avatar id={f.id} name={displayName(f)} size={40} />
                    <View style={{ flex: 1 }}>
                      <Text weight={700} numberOfLines={1}>
                        {displayName(f)} <Text variant="small" color="sec">{`@${f.username}`}</Text>
                      </Text>
                      <Text variant="small" color="sec">
                        {t(levels[f.id] ?? 'Beginner')}
                      </Text>
                    </View>
                    <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.cobalt : 'transparent', borderWidth: on ? 0 : 2, borderColor: c.line }}>
                      {on ? <Icon name="check" size={14} color="#FFFFFF" strokeWidth={3} /> : null}
                    </View>
                  </Springy>
                </View>
              );
            })}
          </View>
        ) : null}
        {people.filter((p) => !p.id).length ? (
          <View style={{ marginTop: 16, backgroundColor: c.card, borderRadius: 22, overflow: 'hidden' }}>
            {people
              .filter((p) => !p.id)
              .map((p, i) => (
                <Row key={`${p.name}-${i}`} gap={12} style={{ minHeight: 56, paddingHorizontal: 14, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
                  {avatar(p, i + 1)}
                  <View style={{ flex: 1 }}>
                    <Text weight={700}>{p.name}</Text>
                    <Text variant="small" color="sec">
                      {t(p.level)}
                    </Text>
                  </View>
                  <Springy onPress={() => setPeople(people.filter((x) => x !== p))} accessibilityLabel={t('Remove {name}', { name: p.name })} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="close" size={16} color={c.sec} strokeWidth={2.2} />
                  </Springy>
                </Row>
              ))}
          </View>
        ) : null}
        <Card style={{ marginTop: 16 }}>
          <Field label={t('Friend not on Gymi?')} value={name} onChangeText={setName} onSubmitEditing={addPerson} placeholder={t('Ahmed')} maxLength={20} />
          <Row gap={8} style={{ flexWrap: 'wrap', marginTop: 10 }}>
            {LEVELS.map((l) => (
              <Chip key={l} title={t(l)} on={level === l} onPress={() => setLevel(l)} />
            ))}
          </Row>
          <Button small kind="soft" icon="plus" title={t('Add friend')} disabled={!name.trim()} style={{ marginTop: 12, alignSelf: 'stretch' }} onPress={addPerson} />
        </Card>
        <Text variant="small" weight={700} color="sec" center style={{ marginTop: 8 }}>
          {people.length ? t('{n} people, including you', { n: people.length + 1 }) : t('Choose at least one friend')}
        </Text>
        <Button title={t('Build our workout')} disabled={!people.length} style={{ marginTop: 16 }} onPress={() => setReady(true)} />
      </Screen>
    );

  return (
    <Screen title={t('Train together')} back onBack={() => setReady(false)}>
      <Row gap={0} style={{ justifyContent: 'center' }}>
        {all.map((p, i) => (
          <View key={i} style={{ marginStart: i ? -12 : 0 }}>
            {avatar(p, i, 48)}
          </View>
        ))}
      </Row>
      <Text variant="h2" center style={{ marginTop: 12 }}>
        {t('Full body with {names}', { names })}
      </Text>
      <Text variant="small" color="sec" center style={{ marginTop: 4 }}>
        {t('{n} exercises, about {m} min. Take turns: while one person lifts, the others rest.', { n: TOG.length, m: 45 + all.length * 8 })}
      </Text>
      <Card style={{ marginTop: 16 }}>
        <Text variant="xs" weight={700} color="sec">
          {t('Turn order each set')}
        </Text>
        <Row gap={6} style={{ marginTop: 8, flexWrap: 'wrap' }}>
          {all.map((p, i) => (
            <Row key={i} gap={6}>
              {i ? <Icon name="chev" size={14} color={c.sec} /> : null}
              <View style={{ backgroundColor: c.inset, borderRadius: 12, paddingHorizontal: 10, height: 26, justifyContent: 'center' }}>
                <Text variant="xs" weight={700}>
                  {p.name}
                </Text>
              </View>
            </Row>
          ))}
        </Row>
      </Card>
      {TOG.map(([id, type], i) => {
        const info = exInfo({ id }, lang);
        return (
          <Card key={id}>
            <Text variant="xs" weight={700} color="sec">{`${i + 1}. ${muscleLabel(exMuscle(id, info.muscle), lang, t)}`}</Text>
            <Text variant="h3">{info.name}</Text>
            <View style={{ marginTop: 8 }}>
              {all.map((p, j) => {
                const s = scheme(p.level, type);
                return (
                  <Row key={j} gap={10} style={{ paddingVertical: 7, borderTopWidth: 1, borderTopColor: c.line }}>
                    {avatar(p, j, 28)}
                    <Text variant="small" weight={700} style={{ flex: 1 }}>
                      {p.name}
                    </Text>
                    <Text variant="small" num>
                      {s.timed ? t('{a} rounds × {b} s', { a: s.sets, b: s.reps }) : t('{a} sets × {b} reps', { a: s.sets, b: s.reps })}
                    </Text>
                  </Row>
                );
              })}
            </View>
          </Card>
        );
      })}
      <Row gap={8} style={{ alignItems: 'flex-start', paddingHorizontal: 4 }}>
        <Icon name="info" size={16} color={c.sec} />
        <Text variant="small" color="sec" style={{ flex: 1 }}>
          {t('Everyone picks their own weight. When you start, your last weights show in grey like always.')}
        </Text>
      </Row>
      {appFriends.length ? (
        <View>
          <Text variant="small" weight={700} color="sec" style={{ marginTop: 20, marginBottom: 8, marginHorizontal: 4 }}>
            {t('When')}
          </Text>
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Chip key={i} title={dayLabel(i)} on={day === i} onPress={() => setDay(i)} />
            ))}
          </Row>
          <Card style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text weight={700}>{t('Start time')}</Text>
            <TimeField value={time} onChange={setTime} label={t('Start time')} />
          </Card>
          <Button title={t('Send invite for {when}', { when: whenText(day) })} loading={busy} style={{ marginTop: 8 }} onPress={sendInvite} />
          <Button kind="cobalt" icon="play" title={t('Start together now')} disabled={busy} style={{ marginTop: 8 }} onPress={startLive} />
          <Button kind="glass" title={t('Start on my phone only')} style={{ marginTop: 8 }} onPress={startLocal} />
        </View>
      ) : (
        <Button icon="play" title={t('Start together now')} style={{ marginTop: 16 }} onPress={startLocal} />
      )}
      <Button kind="glass" title={t('Change people')} style={{ marginTop: 8 }} onPress={() => setReady(false)} />
    </Screen>
  );
}
