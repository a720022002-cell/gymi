import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { useTrain } from '@/lib/train';
import { aiErrorText, askAI } from '@/lib/ai';
import { DAYS, type Day, EX, INJURIES, onceNote, planFromSplit, planOwn, SPLITS, SPREAD, type TrainPlan, workoutMinutes } from '@/lib/training';
import { useSettings } from '@/theme/settings';

import { Thinking } from '../food/Thinking';
import { Icon, Mark } from '../Icon';
import { Screen } from '../Screen';
import { Text } from '../Text';
import { useToast } from '../Toast';
import { Button, Card, Chip, Option, ProgDots, Row, Springy } from '../ui';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** First time in Train: days a week, injuries, split (design: trainsetup). */
export function TrainSetup({ inTab, onDone, onCancel }: { inTab?: boolean; onDone?: () => void; onCancel?: () => void }) {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const train = useTrain();
  const [step, setStep] = useState(0);
  const [days, setDays] = useState(train.plan?.days ?? 3);
  const [injuries, setInjuries] = useState<string[]>(train.plan?.injuries ?? []);
  const [pick, setPick] = useState<number | 'own' | 'ai' | null>(null);
  const [thinking, setThinking] = useState<string | null>(null);

  const toggle = (x: string) => setInjuries(x === 'None' ? [] : injuries.includes(x) ? injuries.filter((y) => y !== x) : [...injuries, x]);

  /** Ask the AI for a plan; check every exercise exists. Falls back to a ready-made split. */
  const aiPlan = async (): Promise<TrainPlan | null> => {
    const exercises = Object.values(EX).map((e) => ({ id: e.id, name: e.en, muscle: e.m, equipment: e.t, avoidFor: e.stress ?? [] }));
    const { result, error } = await askAI<{ split: string; week: { day: number; workout: string }[]; workouts: { name: string; focus?: string; ex: { id: string; sets: number; reps: string }[] }[] }>('plan', { days, injuries, exercises, lang });
    if (error || !result) {
      toast(t(aiErrorText(error ?? 'failed')), { icon: 'warn' });
      return null;
    }
    const workouts: TrainPlan['workouts'] = {};
    for (const w of result.workouts ?? []) {
      const name = String(w.name ?? '').trim().slice(0, 20);
      const ex = (w.ex ?? []).filter((x) => EX[x.id]).map((x) => ({ id: x.id, sets: Math.min(8, Math.max(1, Math.round(+x.sets || 3))), reps: String(x.reps || '8–12').slice(0, 7) }));
      if (name && ex.length) workouts[name] = { ex, focus: String(w.focus ?? '').slice(0, 60), min: workoutMinutes(ex) };
    }
    const week: Day[] = DAYS.map(() => ({ w: null, lock: false }));
    for (const d of result.week ?? []) if (d.day >= 0 && d.day <= 6 && workouts[d.workout]) week[d.day].w = d.workout;
    if (!week.some((d) => d.w)) {
      toast(t('The AI plan didn’t work out, so I used a ready-made one.'), { icon: 'info' });
      return null;
    }
    return { days, injuries, split: String(result.split || 'AI plan').slice(0, 40), week, workouts, machines: {}, homeMode: false, skipped: {}, dismiss: {} };
  };

  const build = async () => {
    if (pick === null) return;
    const steps = pick === 'ai' ? ['Choosing your split', 'Spreading it across the week', 'Picking your exercises'] : ['Spreading it across the week', 'Picking your exercises'];
    setThinking(steps[0]);
    let i = 0;
    const tick = setInterval(() => setThinking(steps[Math.min(++i, steps.length - 1)]), 900);
    const minWait = wait(steps.length * 700);
    let plan: TrainPlan | null = null;
    if (pick === 'ai') plan = await aiPlan();
    await minWait;
    clearInterval(tick);
    const best = { 2: 1, 3: 0, 4: 0, 5: 0, 6: 0 }[days] ?? 0;
    if (!plan) {
      const k = pick === 'ai' ? best : pick;
      plan = k === 'own' ? planOwn(days, injuries) : planFromSplit(days, injuries, SPLITS[days][k as number][0], SPLITS[days][k as number][1]);
    }
    const ok = await train.savePlan({ ...plan, since: train.today }, true);
    setThinking(null);
    setStep(0);
    if (!ok) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
    onDone?.();
    router.push({ pathname: '/weekplan', params: { fresh: '1' } });
    if (pick === 'own') {
      setTimeout(() => router.push({ pathname: '/day-edit', params: { d: String(SPREAD[days][0]) } }), 400);
      toast(t('Name each workout and add your exercises. Drag days to move them.'), { icon: 'edit' });
    } else toast(t('Your plan is ready. Drag days to fit your week.'), { ai: true });
  };

  const title = t(inTab ? 'Set up training' : 'Training setup');
  const back = step > 0 ? () => setStep(step - 1) : onCancel ? onCancel : inTab ? undefined : () => router.back();

  if (thinking)
    return (
      <Screen title={title} tabs={inTab}>
        <View style={{ paddingTop: 100 }}>
          <Thinking message={t(thinking)} />
        </View>
      </Screen>
    );

  return (
    <Screen title={title} back={!!back} onBack={back} tabs={inTab}>
      <ProgDots step={step} total={3} />
      <Text variant="small" weight={700} color="sec">
        {t('Step {n} of {total}', { n: step + 1, total: 3 })}
      </Text>

      {step === 0 ? (
        <View>
          <Text variant="h1" style={{ marginTop: 4 }}>
            {t('How many days a week?')}
          </Text>
          <Text color="sec" style={{ marginTop: 4, marginBottom: 16 }}>
            {t('Pick what you can keep up, not your best week.')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {[2, 3, 4, 5, 6].map((d) => (
              <Springy
                key={d}
                onPress={() => {
                  setDays(d);
                  setPick(null);
                }}
                scaleTo={0.97}
                accessibilityState={{ selected: days === d }}
                style={{ width: '30%', flexGrow: 1, alignItems: 'center', paddingVertical: 16, backgroundColor: c.card, borderRadius: 22, borderWidth: 2, borderColor: days === d ? c.cobalt : 'transparent' }}>
                <Text num size={34} color={days === d ? c.cobalt : c.text}>
                  {d}
                </Text>
                <Text variant="small" weight={700} color="sec">
                  {t('days')}
                </Text>
              </Springy>
            ))}
          </View>
          <Button title={t('Next')} style={{ marginTop: 24 }} onPress={() => setStep(1)} />
        </View>
      ) : null}

      {step === 1 ? (
        <View>
          <Text variant="h1" style={{ marginTop: 4 }}>
            {t('Any injuries or pain?')}
          </Text>
          <Text color="sec" style={{ marginTop: 4, marginBottom: 16 }}>
            {t('We swap out exercises that stress these areas.')}
          </Text>
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            {['None', ...INJURIES].map((x) => (
              <Chip key={x} title={t(x)} on={x === 'None' ? !injuries.length : injuries.includes(x)} onPress={() => toggle(x)} />
            ))}
          </Row>
          {injuries.length ? (
            <Card style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 16 }}>
              <Icon name="info" size={20} color={c.cobalt} />
              <Text variant="small" style={{ flex: 1 }}>
                {t('Exercises that load these areas will be replaced: {x}. If the pain is sharp or new, please see a doctor first.', { x: injuries.map((x) => t(x)).join(t(', ')) })}
              </Text>
            </Card>
          ) : null}
          <Button title={t('Next')} style={{ marginTop: 24 }} onPress={() => setStep(2)} />
        </View>
      ) : null}

      {step === 2 ? (
        <View>
          <Text variant="h1" style={{ marginTop: 4 }}>
            {t('Choose your split')}
          </Text>
          <Text color="sec" style={{ marginTop: 4, marginBottom: 16 }}>
            {t('Only splits that fit {n} days a week.', { n: days })}
          </Text>
          <Option
            title={t('Let the AI build it')}
            subtitle={t('Picks the split, spreads it across your week and chooses every exercise.')}
            selected={pick === 'ai'}
            onPress={() => setPick('ai')}
            right={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Mark size={24} color={c.cobalt} stroke={5} />
              </View>
            }
          />
          {SPLITS[days].map(([label, seq], i) => (
            <Option key={label} title={t(label)} subtitle={t(onceNote(seq) ? 'Each muscle once a week' : 'Each muscle about twice a week')} selected={pick === i} onPress={() => setPick(i)} />
          ))}
          <Option icon="edit" title={t('I’ll build it myself')} subtitle={t('Pick your days, name your workouts and choose every exercise.')} selected={pick === 'own'} onPress={() => setPick('own')} />
          <Button title={t(pick === 'own' ? 'Start building' : 'Build my plan')} disabled={pick === null} style={{ marginTop: 16 }} onPress={build} />
        </View>
      ) : null}
    </Screen>
  );
}
