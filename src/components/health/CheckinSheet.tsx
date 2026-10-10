import { useState } from 'react';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { sleepHours, useHealth } from '@/lib/health';
import { recovery } from '@/lib/recovery';
import { useTrain } from '@/lib/train';
import { useSettings } from '@/theme/settings';

import { TimeField } from '../food/TimeField';
import { Icon, type IconName, Mark } from '../Icon';
import { Sheet } from '../Sheet';
import { Text } from '../Text';
import { useToast } from '../Toast';
import { useRecovery } from '../train/RecoveryCard';
import { useToday } from '../train/WorkoutCard';
import { Button, Card, Label, ProgDots, Row, Segmented } from '../ui';
import { Wheel } from '../Wheel';
import { Choices, fmtDur, WeightWheel } from './bits';

/** Morning check-in: weight, sleep, how you feel (design: SH.checkin). Mounted once at the root. */
export function CheckinSheet() {
  const health = useHealth();
  return (
    <Sheet open={health.checkinOpen} onClose={() => health.setCheckinOpen(false)}>
      {health.checkinOpen ? <Steps /> : null}
    </Sheet>
  );
}

function Steps() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { profile } = useAuth();
  const health = useHealth();
  const train = useTrain();
  const today = useToday();
  const { input } = useRecovery();
  const prev = health.checkins.at(-1);
  const [step, setStep] = useState(0);
  const [weight, setWeight] = useState(() => health.weights.at(-1)?.value ?? Number(profile?.weight_kg ?? 75));
  const [mode, setMode] = useState<'times' | 'hours'>('times');
  const [bed, setBed] = useState(prev?.bed ?? '23:00');
  const [wake, setWake] = useState(prev?.wake ?? '07:00');
  const [hm, setHm] = useState<[number, number]>([7, 0]);
  const [quality, setQuality] = useState<number | null>(1);
  const [energy, setEnergy] = useState<number | null>(null);
  const [sore, setSore] = useState<number | null>(null);
  const [skip, setSkip] = useState({ w: false, s: false });
  const hours = mode === 'times' ? sleepHours(bed, wake) : hm[0] + hm[1] / 60;
  const tired = energy === 0 || sore === 2;
  const canLighten = !!today.name && !today.done && !today.deload;

  const finish = async (skipFeel: boolean) => {
    const sleepPart = skip.s ? {} : { sleep_h: Math.round(hours * 10) / 10, sleep_q: quality, ...(mode === 'times' ? { bed, wake } : {}) };
    const feel = skipFeel ? {} : { energy, sore };
    const ci = { day: train.today, sleep: skip.s ? null : hours, sore: skipFeel ? null : sore, energy: skipFeel ? null : energy };
    const score = recovery({ ...input, checkin: ci }).score;
    if (!skip.w) health.logWeight(weight);
    const lighter = !skipFeel && tired && canLighten;
    if (lighter) train.updatePlan({ light: train.today });
    const ok = await health.saveCheckin({ ...sleepPart, ...feel, score });
    health.setCheckinOpen(false);
    if (!ok) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
    const skipped = [skip.w && 'weight', skip.s && 'sleep', skipFeel && 'how you feel'].filter(Boolean) as string[];
    toast(
      skipped.length === 3
        ? t('Check-in skipped for today. See you tomorrow.')
        : lighter
          ? t('Check-in saved. Today’s workout is lighter.')
          : skipped.length
            ? t('Check-in saved. Skipped {x}.', { x: skipped.map((x) => t(x)).join(t(' and ')) })
            : t('Check-in saved. Have a strong day.'),
      { ai: true },
    );
  };

  const head = (icon: IconName, n: number, title: string) => (
    <>
      <ProgDots step={step} />
      <Row gap={8}>
        <Icon name={icon} size={20} color={c.cobalt} />
        <Text variant="small" weight={700} color="sec">
          {t('Step {n} of 3', { n })}
        </Text>
      </Row>
      <Text variant="h1" style={{ marginTop: 4 }}>
        {title}
      </Text>
    </>
  );

  if (step === 0)
    return (
      <View>
        {head('scale', 1, t('Morning weight'))}
        <Card style={{ marginTop: 16, paddingVertical: 4 }}>
          <WeightWheel value={weight} onChange={setWeight} />
        </Card>
        <Row gap={8} style={{ alignItems: 'flex-start' }}>
          <Icon name="info" size={18} color={c.sec} />
          <Text variant="small" color="sec" style={{ flex: 1 }}>
            {t('Weigh yourself after using the bathroom, before eating or drinking.')}
          </Text>
        </Row>
        <Button title={t('Next')} style={{ marginTop: 16 }} onPress={() => (setSkip((s) => ({ ...s, w: false })), setStep(1))} />
        <Button kind="ghost" title={t('Skip weight today')} style={{ marginTop: 4 }} onPress={() => (setSkip((s) => ({ ...s, w: true })), setStep(1))} />
      </View>
    );

  if (step === 1)
    return (
      <View>
        {head('moon', 2, t('How did you sleep?'))}
        <View style={{ marginTop: 12 }}>
          <Segmented<'times' | 'hours'>
            value={mode}
            options={[
              { value: 'times', label: t('Bed and wake time') },
              { value: 'hours', label: t('Just hours') },
            ]}
            onChange={setMode}
          />
        </View>
        {mode === 'times' ? (
          <Card style={{ marginTop: 12 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text weight={700}>{t('Went to sleep')}</Text>
              <TimeField value={bed} onChange={setBed} label={t('Went to sleep')} />
            </Row>
            <Row style={{ justifyContent: 'space-between', marginTop: 10 }}>
              <Text weight={700}>{t('Woke up')}</Text>
              <TimeField value={wake} onChange={setWake} label={t('Woke up')} />
            </Row>
          </Card>
        ) : (
          <Card style={{ marginTop: 12, paddingVertical: 4 }}>
            <Row gap={0} style={{ justifyContent: 'center' }}>
              <Wheel
                columns={[
                  { items: Array.from({ length: 17 }, (_, i) => ({ value: i, label: `${i} ${t('h')}` })), selected: hm[0], width: 96 },
                  { items: Array.from({ length: 12 }, (_, i) => ({ value: i * 5, label: `${String(i * 5).padStart(2, '0')} ${t('min')}` })), selected: hm[1], width: 110 },
                ]}
                onChange={([h, m]) => setHm([h, m])}
              />
            </Row>
          </Card>
        )}
        <Row style={{ justifyContent: 'space-between', paddingHorizontal: 6, marginTop: 4 }}>
          <Text weight={700}>{t('Total sleep')}</Text>
          <Text num size={18}>
            {fmtDur(hours, t)}
          </Text>
        </Row>
        <Label>{t('Sleep quality')}</Label>
        <Choices options={['Poor', 'Okay', 'Great']} value={quality} onChange={setQuality} />
        <Button title={t('Next')} style={{ marginTop: 20 }} onPress={() => (setSkip((s) => ({ ...s, s: false })), setStep(2))} />
        <Button kind="ghost" title={t('Skip sleep today')} style={{ marginTop: 4 }} onPress={() => (setSkip((s) => ({ ...s, s: true })), setStep(2))} />
      </View>
    );

  return (
    <View>
      {head('bolt', 3, t('How do you feel?'))}
      <Label>{t('Energy')}</Label>
      <Choices options={['Tired', 'Normal', 'Great']} value={energy} onChange={setEnergy} />
      <Label>{t('Muscle soreness')}</Label>
      <Choices options={['None', 'A little', 'Very sore']} value={sore} onChange={setSore} />
      {tired && canLighten ? (
        <Card style={{ marginTop: 16, flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
          <Mark size={24} color={c.cobalt} stroke={5} />
          <View style={{ flex: 1 }}>
            <Text weight={700}>{t('I’ll make today’s workout lighter.')}</Text>
            <Text variant="small" color="sec" style={{ marginTop: 4 }}>
              {t('One set less per exercise and about 10% less weight. Rest well tonight.')}
            </Text>
          </View>
        </Card>
      ) : null}
      <Button title={t('Done')} disabled={energy === null || sore === null} style={{ marginTop: 16 }} onPress={() => finish(false)} />
      <Button kind="ghost" title={t('Skip and finish')} style={{ marginTop: 4 }} onPress={() => finish(true)} />
    </View>
  );
}
