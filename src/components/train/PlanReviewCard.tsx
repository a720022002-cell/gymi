import { useEffect } from 'react';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { changeLine } from '@/lib/coachPlan';
import { useFood } from '@/lib/food';
import { useHealth } from '@/lib/health';
import { reviewDue, runReview } from '@/lib/planReview';
import { useTrain } from '@/lib/train';
import { useSettings } from '@/theme/settings';

import { Icon, Mark } from '../Icon';
import { Text } from '../Text';
import { useToast } from '../Toast';
import { Button, Card, Row } from '../ui';

export const goalWord = (g: number | undefined) => (g == null ? 'maintain' : g <= 1 ? 'bulk' : g >= 3 ? 'cut' : 'maintain');

/** Runs the weekly plan check when it's due (a week since the last one, 3+ workouts done). */
export function usePlanReview() {
  const train = useTrain();
  const food = useFood();
  const health = useHealth();
  const { lang } = useT();
  const due = train.ready && reviewDue(train.plan, train.logs, train.today);
  useEffect(() => {
    if (!due || !train.plan) return;
    runReview(train.plan, train.logs, health.checkins, train.today, goalWord(food.plan.goal), lang).then((next) => {
      if (next) train.savePlan(next);
    });
    // Once when it becomes due; the plan changes after it runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [due]);
}

/** "Your plan was updated": what the weekly check changed and why, with Undo. */
export function PlanReviewCard() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const train = useTrain();
  usePlanReview();
  const p = train.plan;
  const r = p?.review;
  if (!p || !r || r.seen) return null;
  const changed = r.changes.length > 0;
  const done = () => train.updatePlan({ review: { ...r, seen: true } });
  const undo = () => {
    train.updatePlan({ workouts: r.prev.workouts, deload: r.prev.deload, light: r.prev.light, review: { ...r, seen: true } });
    toast(t('Your plan is back to how it was.'), { icon: 'check' });
  };
  return (
    <Card style={{ backgroundColor: c.gAi }}>
      <Row gap={10}>
        <Mark size={22} color={c.cobalt} stroke={4.5} />
        <Text weight={700} style={{ flex: 1 }}>
          {changed ? t('Your plan was updated from your results') : t('Weekly check: your plan stays the same')}
        </Text>
      </Row>
      {r.summary ? (
        <Text variant="small" style={{ marginTop: 8 }}>
          {r.summary}
        </Text>
      ) : null}
      {changed ? (
        <View style={{ marginTop: 10, gap: 6 }}>
          {r.changes.map((x, i) => (
            <Row key={i} gap={8} style={{ alignItems: 'flex-start' }}>
              <Icon name="check" size={15} color={c.cobalt} strokeWidth={2.4} />
              <Text variant="small" weight={600} style={{ flex: 1 }}>
                {changeLine(x, { ...p, workouts: r.prev.workouts }, lang, t)}
              </Text>
            </Row>
          ))}
        </View>
      ) : null}
      <Row gap={8} style={{ marginTop: 12 }}>
        <Button small title={t('Got it')} style={{ flex: 1 }} onPress={done} />
        {changed ? <Button small kind="glass" title={t('Undo')} style={{ flex: 1 }} onPress={undo} /> : null}
      </Row>
    </Card>
  );
}
