import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Thinking } from '@/components/food/Thinking';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Row } from '@/components/ui';
import { useT } from '@/i18n';
import { myCoachPlans, type Program } from '@/lib/coaching';
import { useTrain } from '@/lib/train';
import { DAYS, type Day, exInfo, SPREAD, type TrainPlan, type Workout, workoutMinutes } from '@/lib/training';
import { useSettings } from '@/theme/settings';

/** Turn a coach's program into your weekly plan. */
function toPlan(p: Program): TrainPlan {
  const days = p.days.filter((d) => d.ex.length).slice(0, 6);
  const n = Math.max(1, days.length);
  const spots = n === 1 ? [1] : SPREAD[n];
  const week: Day[] = DAYS.map(() => ({ w: null, lock: false }));
  const workouts: Record<string, Workout> = {};
  days.forEach((d, i) => {
    let name = d.name.trim() || `Day ${i + 1}`;
    while (workouts[name]) name = `${name} ${i + 1}`;
    workouts[name] = { ex: d.ex, focus: '', min: workoutMinutes(d.ex) };
    week[spots[i]].w = name;
  });
  return { days: n, injuries: [], split: p.name, week, workouts, machines: {}, homeMode: false, skipped: {}, dismiss: {} };
}

/** Client: the workout program your coach gave you (design: myprog). */
export default function MyProgram() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const train = useTrain();
  const [p, setP] = useState<Program | null | undefined>(undefined);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    let alive = true;
    myCoachPlans().then((x) => alive && setP(x?.program ?? null));
    return () => {
      alive = false;
    };
  }, []);
  if (p === undefined)
    return (
      <Screen title={t('My program')} back>
        <Thinking message={t('Loading')} />
      </Screen>
    );
  if (!p)
    return (
      <Screen title={t('My program')} back>
        <Card style={{ alignItems: 'center' }}>
          <Text color="sec" center>
            {t('Your coach hasn’t sent you a program yet.')}
          </Text>
        </Card>
      </Screen>
    );
  const using = train.plan?.split === p.name;
  return (
    <Screen title={p.name} back>
      <Text variant="small" color="sec" style={{ marginTop: -8, marginBottom: 12 }}>
        {t('From your coach. {n} training days a week.', { n: p.days.length })}
      </Text>
      {p.days.map((d, i) => (
        <Card key={i}>
          <Text weight={700}>{d.name}</Text>
          {d.ex.map((x, j) => (
            <Row key={`${x.id}${j}`} style={{ marginTop: 8 }}>
              <Icon name="train" size={16} color={c.cobalt} />
              <Text variant="small" weight={700} style={{ flex: 1 }}>
                {exInfo(x, lang).name}
              </Text>
              <Text variant="small" color="sec" num>{`${x.sets} × ${x.reps}`}</Text>
            </Row>
          ))}
        </Card>
      ))}
      <Button icon="check" title={t(using ? 'Update my plan with the latest version' : 'Use as my training plan')} onPress={() => setConfirm(true)} />
      <Sheet open={confirm} onClose={() => setConfirm(false)}>
        <Text variant="h2" center>
          {t('Use your coach’s program?')}
        </Text>
        <Text color="sec" center style={{ marginTop: 4 }}>
          {t('It replaces your current weekly plan. Your workout history and records stay.')}
        </Text>
        <Button
          title={t('Use it')}
          style={{ marginTop: 16 }}
          onPress={async () => {
            const ok = await train.savePlan({ ...toPlan(p), since: train.today }, true);
            setConfirm(false);
            toast(ok ? t('Your training plan is now {p}', { p: p.name }) : t('Couldn’t save. Please try again.'), { icon: ok ? 'check' : 'warn' });
            if (ok) router.replace('/train');
          }}
        />
        <Button kind="ghost" title={t('Cancel')} style={{ marginTop: 8 }} onPress={() => setConfirm(false)} />
      </Sheet>
      <View style={{ height: 12 }} />
    </Screen>
  );
}
