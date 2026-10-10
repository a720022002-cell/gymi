import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Thinking } from '@/components/food/Thinking';
import { Icon } from '@/components/Icon';
import { Bar } from '@/components/Ring';
import { Screen } from '@/components/Screen';
import { Avatar } from '@/components/social/Avatar';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Row } from '@/components/ui';
import { useT } from '@/i18n';
import { useFood } from '@/lib/food';
import { useAuth } from '@/lib/auth';
import { fmt } from '@/lib/nutrition';
import { shortDate } from '@/lib/progress';
import { CH_TITLE, CH_UNIT, type Challenge, challengeBoard, challengeInfo, daysLeft, leaveChallenge } from '@/lib/social';
import { useSettings } from '@/theme/settings';

type Data = { id: string; info: Pick<Challenge, 'id' | 'kind' | 'start_day' | 'end_day'> | null; board: { user_id: string; name: string | null; value: number }[] };

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

  useEffect(() => {
    let alive = true;
    Promise.all([challengeInfo(id), challengeBoard(id)]).then(([info, board]) => alive && setData({ id, info, board: board.sort((a, b) => b.value - a.value) }));
    return () => {
      alive = false;
    };
  }, [id]);

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
  const max = Math.max(...d.board.map((b) => b.value), 1);
  return (
    <Screen title={t('Challenge')} back>
      <View style={{ alignItems: 'center' }}>
        <Icon name="trophy" size={40} color={c.cobalt} />
        <Text variant="h1" center style={{ marginTop: 8 }}>
          {t(CH_TITLE[ch.kind])}
        </Text>
        <Text variant="small" color="sec">
          {`${shortDate(ch.start_day, lang)} – ${shortDate(ch.end_day, lang)}, `}
          {left > 0 ? t('{n} days left', { n: left }) : t('Finished')}
        </Text>
      </View>
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
                <Text variant="small" weight={700} num>{`${fmt(b.value)} ${t(CH_UNIT[ch.kind])}`}</Text>
              </Row>
              <View style={{ marginTop: 8 }}>
                <Bar value={b.value} max={max} color={mine ? c.cobalt : c.sec} />
              </View>
            </View>
          </Card>
        );
      })}
      <Text variant="xs" color="sec" center style={{ marginTop: 4 }}>
        {t(ch.kind === 'steps' ? 'Steps count from what each person logs in Cardio and steps.' : 'Counts workouts finished in Gymi during the challenge.')}
      </Text>
      <Button
        kind="ghost"
        title={t('Leave challenge')}
        color={c.down}
        style={{ marginTop: 12 }}
        onPress={async () => {
          if (me) await leaveChallenge(ch.id, me);
          toast(t('You left the challenge'), { icon: 'trophy' });
          router.back();
        }}
      />
    </Screen>
  );
}
