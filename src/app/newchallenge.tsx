import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Choices } from '@/components/health/bits';
import { Field } from '@/components/Field';
import { Icon, type IconName } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { FriendPicker } from '@/components/social/FriendPicker';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Chip, Label, Row, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { type ChallengeKind, createChallenge } from '@/lib/social';
import { useSettings } from '@/theme/settings';

const KINDS: [ChallengeKind, string, IconName][] = [
  ['exercise', 'Exercise', 'train'],
  ['weight', 'Weight', 'scale'],
  ['steps', 'Steps', 'walk'],
  ['progress', 'Progress', 'up'],
];
const DESC: Partial<Record<ChallengeKind, string>> = {
  weight: 'Who gets closest to their own weight goal. Fair for every goal.',
  steps: 'Who walks the most steps.',
  progress: 'Who improves the most, as a percentage of where they started.',
};
/** Lifts you can race on. Ids match the exercise list. */
const LIFTS: [string, string][] = [
  ['bench', 'Bench press'],
  ['squat', 'Back squat'],
  ['deadlift', 'Deadlift'],
  ['ohp', 'Overhead press'],
  ['hipthrust', 'Hip thrust'],
  ['legpress', 'Leg press'],
  ['pulldown', 'Lat pulldown'],
  ['row', 'Barbell row'],
];
const DAYS = [7, 14, 30];

/** Start a challenge with friends (design: newchallenge). */
export default function NewChallenge() {
  const { t } = useT();
  const toast = useToast();
  const { colors: c } = useSettings();
  const { profile } = useAuth();
  const p = useLocalSearchParams<{ f?: string; group?: string }>();
  const [kind, setKind] = useState(2);
  const [lift, setLift] = useState(0);
  const [goal, setGoal] = useState('');
  const [dur, setDur] = useState(0);
  const [fr, setFr] = useState<string[]>(() => (p.group ? p.group.split(',').filter(Boolean) : p.f ? [p.f] : []));
  const [busy, setBusy] = useState(false);
  const k = KINDS[kind][0];
  const goalKg = Number(goal.replace(',', '.'));
  const goalOk = goalKg >= 30 && goalKg <= 250;
  return (
    <Screen title={t('New challenge')} back>
      <Label>{t('Type')}</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {KINDS.map(([id, n, i], idx) => {
          const on = idx === kind;
          return (
            <Springy
              key={id}
              onPress={() => setKind(idx)}
              scaleTo={1.04}
              accessibilityState={{ selected: on }}
              style={{ width: '48.5%', height: 56, borderRadius: 16, backgroundColor: on ? c.text : c.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Icon name={i} size={20} color={on ? c.bg : c.text} />
              <Text weight={600} color={on ? c.bg : c.text}>
                {t(n)}
              </Text>
            </Springy>
          );
        })}
      </View>
      <Text variant="small" color="sec" style={{ marginTop: 8, marginHorizontal: 4 }}>
        {k === 'exercise' ? t('Who adds the most weight to {x}.', { x: t(LIFTS[lift][1]).toLowerCase() }) : t(DESC[k] ?? '')}
      </Text>
      {k === 'exercise' ? (
        <>
          <Label>{t('Exercise')}</Label>
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            {LIFTS.map(([id, n], i) => (
              <Chip key={id} title={t(n)} on={i === lift} onPress={() => setLift(i)} />
            ))}
          </Row>
          <Text variant="xs" color="sec" style={{ marginTop: 8, marginHorizontal: 4 }}>
            {t('Counts the heaviest set you log in Gymi, compared with your best before the challenge.')}
          </Text>
        </>
      ) : k === 'weight' ? (
        <>
          <Field
            label={t('Your goal weight')}
            value={goal}
            onChangeText={(v) => setGoal(v.replace(/[^0-9.,]/g, '').slice(0, 5))}
            placeholder={profile?.weight_kg ? String(profile.weight_kg) : '70'}
            keyboardType="decimal-pad"
            unit={t('kg')}
            ltr
            hint={t('Only you see your goal. Friends set their own. Everyone is scored by how far they get toward it.')}
          />
        </>
      ) : null}
      <Label>{t('Duration')}</Label>
      <Choices options={['1 week', '2 weeks', '30 days']} value={dur} onChange={setDur} />
      <Label>{t('Friends')}</Label>
      <FriendPicker value={fr} onChange={setFr} />
      <Button
        icon="trophy"
        title={t('Start challenge')}
        disabled={!fr.length || (k === 'weight' && !goalOk)}
        loading={busy}
        onPress={async () => {
          setBusy(true);
          const id = await createChallenge(k, DAYS[dur], fr, k === 'exercise' ? { exercise: LIFTS[lift][0], exerciseName: LIFTS[lift][1] } : k === 'weight' ? { goal: goalKg } : undefined);
          setBusy(false);
          if (!id) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
          toast(t('Challenge sent to your friends'), { icon: 'trophy' });
          router.replace({ pathname: '/challenge', params: { id } });
        }}
      />
    </Screen>
  );
}
