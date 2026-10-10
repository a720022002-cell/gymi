import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Field } from '@/components/Field';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Chip, Row, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { useTrain } from '@/lib/train';
import { exInfo, muscleLabel, type PlanEx } from '@/lib/training';
import { useSettings } from '@/theme/settings';

type Level = 'Beginner' | 'Intermediate' | 'Advanced';
type Person = { name: string; level: Level; me?: boolean };
const LEVELS: Level[] = ['Beginner', 'Intermediate', 'Advanced'];
const COLORS = ['#3355FF', '#15803D', '#B45309', '#7C3AED', '#DB2777'];

/** One full-body workout for the group (design: together). 1 = main lift, 0 = extra, 2 = timed. */
const TOG: [string, number][] = [
  ['bench', 1],
  ['pulldown', 1],
  ['squat', 1],
  ['shoulder', 0],
  ['cablerow', 0],
  ['plank', 2],
];
function scheme(level: Level, type: number): { sets: number; reps: number; timed: boolean } {
  if (type === 2) return { sets: 3, reps: level === 'Beginner' ? 30 : level === 'Advanced' ? 60 : 45, timed: true };
  if (type === 1) return { Beginner: { sets: 3, reps: 10 }, Intermediate: { sets: 4, reps: 8 }, Advanced: { sets: 4, reps: 6 } }[level] as { sets: number; reps: number } & { timed: false };
  return { sets: 3, reps: level === 'Advanced' ? 10 : 12, timed: false };
}

/** Train together: one workout for up to 5 people, the right sets and reps for each level. */
export default function Together() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { profile } = useAuth();
  const train = useTrain();
  const [myLevel, setMyLevel] = useState<Level>('Intermediate');
  const [people, setPeople] = useState<Person[]>([]);
  const [name, setName] = useState('');
  const [level, setLevel] = useState<Level>('Intermediate');
  const [ready, setReady] = useState(false);
  const all: Person[] = [{ name: t('You'), level: myLevel, me: true }, ...people];

  const addPerson = () => {
    const n = name.trim().slice(0, 20);
    if (!n) return;
    if (people.length >= 4) return toast(t('Up to 4 friends at a time'), { icon: 'info' });
    setPeople([...people, { name: n, level }]);
    setName('');
  };

  const start = () => {
    if (train.session) return router.replace('/active');
    const ex: PlanEx[] = TOG.map(([id, type]) => {
      const s = scheme(myLevel, type);
      return { id, sets: s.sets, reps: String(s.reps) };
    });
    train.startWorkout('Together', false, false, { ex });
    router.replace('/active');
  };

  const avatar = (p: Person, i: number, size = 36) => (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: COLORS[i % COLORS.length], alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.bg }}>
      <Text weight={700} size={size * 0.4} color="#FFFFFF">
        {(p.me ? profile?.name || p.name : p.name).slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );

  if (!ready)
    return (
      <Screen title={t('Train together')} back>
        <Text color="sec">{t('Add up to 4 friends. I’ll build one workout for the whole group, with the right sets and reps for each person’s level.')}</Text>
        <Text variant="small" weight={700} color="sec" style={{ marginTop: 18, marginBottom: 8 }}>
          {t('Your level')}
        </Text>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          {LEVELS.map((l) => (
            <Chip key={l} title={t(l)} on={myLevel === l} onPress={() => setMyLevel(l)} />
          ))}
        </Row>
        {people.length ? (
          <View style={{ marginTop: 16, backgroundColor: c.card, borderRadius: 22, overflow: 'hidden' }}>
            {people.map((p, i) => (
              <Row key={`${p.name}-${i}`} gap={12} style={{ minHeight: 56, paddingHorizontal: 14, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
                {avatar(p, i + 1)}
                <View style={{ flex: 1 }}>
                  <Text weight={700}>{p.name}</Text>
                  <Text variant="small" color="sec">
                    {t(p.level)}
                  </Text>
                </View>
                <Springy onPress={() => setPeople(people.filter((_, j) => j !== i))} accessibilityLabel={t('Remove {name}', { name: p.name })} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="close" size={16} color={c.sec} strokeWidth={2.2} />
                </Springy>
              </Row>
            ))}
          </View>
        ) : null}
        <Card style={{ marginTop: 16 }}>
          <Field label={t('Friend’s name')} value={name} onChangeText={setName} onSubmitEditing={addPerson} placeholder={t('Ahmed')} maxLength={20} />
          <Row gap={8} style={{ flexWrap: 'wrap', marginTop: 10 }}>
            {LEVELS.map((l) => (
              <Chip key={l} title={t(l)} on={level === l} onPress={() => setLevel(l)} />
            ))}
          </Row>
          <Button small kind="soft" icon="plus" title={t('Add friend')} disabled={!name.trim()} style={{ marginTop: 12, alignSelf: 'stretch' }} onPress={addPerson} />
        </Card>
        <Text variant="small" weight={700} color="sec" center style={{ marginTop: 8 }}>
          {people.length ? t('{n} people, including you', { n: people.length + 1 }) : t('Add at least one friend')}
        </Text>
        <Button title={t('Build our workout')} disabled={!people.length} style={{ marginTop: 16 }} onPress={() => setReady(true)} />
        <Text variant="xs" color="sec" center style={{ marginTop: 10 }}>
          {t('Inviting friends from the app and syncing everyone’s phone come with Gym Bros.')}
        </Text>
      </Screen>
    );

  const names = people.length === 1 ? people[0].name : `${people.slice(0, -1).map((p) => p.name).join(t(', '))} ${t('and')} ${people[people.length - 1].name}`;
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
            <Text variant="xs" weight={700} color="sec">{`${i + 1}. ${muscleLabel(info.muscle, lang, t)}`}</Text>
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
      <Button icon="play" title={t('Start together now')} style={{ marginTop: 16 }} onPress={start} />
      <Button kind="glass" title={t('Change people')} style={{ marginTop: 8 }} onPress={() => setReady(false)} />
    </Screen>
  );
}
