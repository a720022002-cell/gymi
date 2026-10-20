import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { Thinking } from '@/components/food/Thinking';
import { Icon } from '@/components/Icon';
import { Bar } from '@/components/Ring';
import { Field } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Avatar } from '@/components/social/Avatar';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Row } from '@/components/ui';
import { useT } from '@/i18n';
import { useFood } from '@/lib/food';
import { useAuth } from '@/lib/auth';
import { fmt } from '@/lib/nutrition';
import { shortDate } from '@/lib/progress';
import { CH_PCT, CH_UNIT, challengeBoard, challengeInfo, type ChallengeInfo, type ChallengeRow, challengeTitle, daysLeft, leaveChallenge, nudgeChallenge, setChallengeGoal } from '@/lib/social';
import { useSettings } from '@/theme/settings';
import { goBack } from '@/lib/nav';

type Data = { id: string; info: ChallengeInfo | null; board: ChallengeRow[] };

const NOTE: Record<ChallengeInfo['kind'], string> = {
  steps: 'Steps count from what each person logs in Cardio and steps.',
  workouts: 'Counts workouts finished in Adro during the challenge.',
  volume: 'Counts workouts finished in Adro during the challenge.',
  exercise: 'Kilos added to your heaviest set, compared with your best in the 90 days before the challenge.',
  weight: 'Each person is scored by how far they got from their start weight toward their own goal. Goals stay private.',
  progress: 'How much stronger each person got, compared with their best lifts in the 60 days before the challenge.',
};

/** Challenge leaderboard (design: challenge). Numbers come from what each person logged. */
export default function ChallengeScreen() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { session } = useAuth();
  const me = session?.user.id;
  const { today } = useFood();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<Data | null>(null);
  const [goalOpen, setGoalOpen] = useState(false);
  const [goal, setGoal] = useState('');
  const [nudging, setNudging] = useState(false);

  const load = useCallback(async () => {
    const [info, board] = await Promise.all([challengeInfo(id), challengeBoard(id)]);
    setData({ id, info, board: board.sort((a, b) => b.value - a.value) });
  }, [id]);
  useEffect(() => {
    let alive = true;
    (async () => {
      if (alive) await load();
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  const d = data?.id === id ? data : null;
  if (!d)
    return (
      <Screen title="" back>
        <Thinking message={t('Loading')} />
      </Screen>
    );
  if (!d.info)
    return (
      <Screen title={t('Challenge')} back>
        <Card style={{ alignItems: 'center' }}>
          <Text color="sec">{t('This challenge isn’t available.')}</Text>
        </Card>
      </Screen>
    );
  const ch = d.info;
  const left = daysLeft(ch.end_day, today);
  const pct = CH_PCT.includes(ch.kind);
  const max = pct ? 100 : Math.max(...d.board.map((b) => b.value), 1);
  const myRow = d.board.find((b) => b.user_id === me);
  const goalKg = Number(goal.replace(',', '.'));
  const others = d.board.length > 1;
  return (
    <Screen title={t('Challenge')} back>
      <View style={{ alignItems: 'center' }}>
        <Icon name="trophy" size={40} color={c.cobalt} />
        <Text variant="h1" center style={{ marginTop: 8 }}>
          {challengeTitle(ch, t)}
        </Text>
        <Text variant="small" color="sec">
          {`${shortDate(ch.start_day, lang)} – ${shortDate(ch.end_day, lang)}, `}
          {left > 0 ? t('{n} days left', { n: left }) : t('Finished')}
        </Text>
      </View>
      {ch.kind === 'weight' && myRow && !myRow.has_goal ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 }}>
          <Icon name="scale" size={20} color={c.cobalt} />
          <Text variant="small" style={{ flex: 1 }}>
            {t('Set your goal weight to get a score. Only you see it.')}
          </Text>
          <Button small title={t('Set goal')} onPress={() => (setGoal(''), setGoalOpen(true))} />
        </Card>
      ) : null}
      <Text variant="small" weight={700} color="sec" style={{ marginTop: 20, marginBottom: 8, marginHorizontal: 4 }}>
        {t('Leaderboard')}
      </Text>
      {d.board.map((b, i) => {
        const mine = b.user_id === me;
        return (
          <Card key={b.user_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: mine ? 2 : 0, borderColor: c.cobalt }}>
            <Text num weight={700} style={{ width: 22 }}>
              {i + 1}
            </Text>
            <Avatar id={b.user_id} name={b.name || '?'} size={36} />
            <View style={{ flex: 1 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text weight={700}>{mine ? t('You') : b.name}</Text>
                <Text variant="small" weight={700} num>
                  {ch.kind === 'weight' && !b.has_goal ? t('No goal yet') : pct ? `${fmt(b.value)}${t(CH_UNIT[ch.kind])}` : `${fmt(b.value)} ${t(CH_UNIT[ch.kind])}`}
                </Text>
              </Row>
              <View style={{ marginTop: 8 }}>
                <Bar value={b.value} max={max} color={mine ? c.cobalt : c.sec} />
              </View>
            </View>
          </Card>
        );
      })}
      <Text variant="xs" color="sec" center style={{ marginTop: 4 }}>
        {t(NOTE[ch.kind])}
      </Text>
      {ch.kind === 'weight' && myRow?.goal != null ? (
        <Button small kind="ghost" title={t('Your goal: {n} kg. Change', { n: fmt(myRow.goal) })} style={{ alignSelf: 'center', marginTop: 4 }} onPress={() => (setGoal(String(myRow.goal)), setGoalOpen(true))} />
      ) : null}
      {left > 0 && others ? (
        <Button
          kind="glass"
          icon="bell"
          title={t('Nudge friends')}
          loading={nudging}
          style={{ marginTop: 12 }}
          onPress={async () => {
            setNudging(true);
            const r = await nudgeChallenge(ch.id);
            setNudging(false);
            if (r === 'sent') toast(t('Nudge sent'), { icon: 'bell' });
            else if (r === 'already') toast(t('You already nudged today. Try again tomorrow.'), { icon: 'bell' });
            else toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
          }}
        />
      ) : null}
      <Button
        kind="ghost"
        title={t('Leave challenge')}
        color={c.down}
        style={{ marginTop: 12 }}
        onPress={async () => {
          if (me) await leaveChallenge(ch.id, me);
          toast(t('You left the challenge'), { icon: 'trophy' });
          goBack();
        }}
      />
      <Sheet open={goalOpen} onClose={() => setGoalOpen(false)}>
        <Text variant="h2">{t('Your goal weight')}</Text>
        <Field
          value={goal}
          onChangeText={(v) => setGoal(v.replace(/[^0-9.,]/g, '').slice(0, 5))}
          placeholder="70"
          keyboardType="decimal-pad"
          unit={t('kg')}
          ltr
          hint={t('Only you see your goal. Friends set their own. Everyone is scored by how far they get toward it.')}
        />
        <Button
          title={t('Save')}
          disabled={!(goalKg >= 30 && goalKg <= 250)}
          style={{ marginTop: 12 }}
          onPress={async () => {
            const ok = await setChallengeGoal(ch.id, goalKg);
            setGoalOpen(false);
            toast(ok ? t('Saved') : t('Couldn’t save. Please try again.'), { icon: ok ? 'check' : 'warn' });
            load();
          }}
        />
      </Sheet>
    </Screen>
  );
}
