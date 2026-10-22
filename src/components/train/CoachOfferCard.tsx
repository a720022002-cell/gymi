import { router } from 'expo-router';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { useTrain } from '@/lib/train';
import { workoutTitle } from '@/lib/training';
import { useSettings } from '@/theme/settings';

import { Mark } from '../Icon';
import { Text } from '../Text';
import { useToast } from '../Toast';
import { Button, Card, Row, Springy } from '../ui';

/** "Your coach sent a new program" with Use it / Not now. Nothing changes until you answer; My program keeps it. */
export function CoachOfferCard() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const train = useTrain();
  const o = train.coachOffer;
  if (!o) return null;
  const name = o.coachName || t('Your coach');
  return (
    <Card style={{ backgroundColor: c.gAi }}>
      <Row gap={10} style={{ alignItems: 'flex-start' }}>
        <Mark size={22} color={c.cobalt} stroke={4.6} />
        <View style={{ flex: 1 }}>
          <Text weight={700}>{o.update ? t('{n} updated your program', { n: name }) : t('{n} sent a new program', { n: name })}</Text>
          <Text variant="small" color="sec" style={{ marginTop: 4 }}>
            {[o.prog.name, t('{n} days a week', { n: o.days }), t('{n} exercises', { n: o.exercises })].join(' · ')}
          </Text>
        </View>
      </Row>
      <View style={{ marginTop: 12, backgroundColor: c.inset, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12 }}>
        {o.prog.days
          .filter((d) => d.ex.length)
          .map((d, i) => (
            <Row key={`${d.name}${i}`} style={{ justifyContent: 'space-between', paddingVertical: 3 }}>
              <Text variant="small" weight={700} numberOfLines={1} style={{ flex: 1 }}>
                {workoutTitle(d.name, t)}
              </Text>
              <Text variant="small" color="sec">
                {t('{n} exercises', { n: d.ex.length })}
              </Text>
            </Row>
          ))}
      </View>
      <Text variant="xs" color="sec" style={{ marginTop: 8 }}>
        {t('It replaces your weekly plan. Your injuries, history and records stay.')}
      </Text>
      <Row gap={8} style={{ marginTop: 12 }}>
        <View style={{ flex: 1 }}>
          <Button
            small
            kind="soft"
            title={t('Not now')}
            style={{ alignSelf: 'stretch' }}
            onPress={() => {
              train.declineCoach();
              toast(t('Okay. You can find it in My program.'), { icon: 'check' });
            }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            small
            title={t('Use it')}
            style={{ alignSelf: 'stretch' }}
            onPress={async () => {
              const ok = await train.acceptCoach();
              toast(ok ? t('Your training plan is now {p}', { p: o.prog.name }) : t('Couldn’t save. Please try again.'), { icon: ok ? 'check' : 'warn' });
            }}
          />
        </View>
      </Row>
      <Springy onPress={() => router.push('/myprog')} style={{ marginTop: 10, alignSelf: 'center' }}>
        <Text variant="small" weight={700} color="link">
          {t('See the full program')}
        </Text>
      </Springy>
    </Card>
  );
}
