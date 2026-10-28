import { useState } from 'react';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { loadCycle, saveLog } from '@/lib/cycle';
import { useCycleToday } from '@/lib/cyclePhase';
import { useDevices } from '@/lib/devices';
import { addDays } from '@/lib/nutrition';
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
import { Button, Card, Chip, Label, ProgDots, Row, Segmented } from '../ui';
import { Wheel } from '../Wheel';
import { Choices, fmtDur, WeightWheel } from './bits';

/** Daily check-in: weight, sleep, how you feel (design: SH.checkin). Mounted once at the root. */
export function CheckinSheet() {
  const health = useHealth();
  return (
    <Sheet open={health.checkinOpen} onClose={() => health.setCheckinOpen(false)}>
      {health.checkinOpen ? <Steps /> : null}
    </Sheet>
  );
}

/** One optional tap for women who track their cycle (saved to the cycle log). */
const CY_QUICK = ['Cramps', 'Headache', 'Bloating', 'Cravings', 'Fatigue'];

function Steps() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { profile, session } = useAuth();
  const cycle = useCycleToday();
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const health = useHealth();
  const train = useTrain();
  const today = useToday();
  const { input } = useRecovery();
  const prev = health.checkins.at(-1);
  // Last night from the watch, when it measured it: the sleep step starts from it.
  const dev = useDevices(session?.user.id);
  const night = dev.days.find((d) => d.day === train.today);
  const watchH = night?.sleep_h != null && night.sleep_h > 0 ? night.sleep_h : null;
  const clock = (m: number) => {
    const x = ((Math.round(m / 5) * 5) % 1440 + 1440) % 1440;
    return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
  };
  // A smart scale sends weights by itself: then the weight is only logged when you change it.
  const scale = dev.days.some((d) => d.weight != null && d.day >= addDays(train.today, -14));
  const [step, setStep] = useState(0);
  const [weight0] = useState(() => night?.weight ?? health.weights.at(-1)?.value ?? Number(profile?.weight_kg ?? 75));
  const [weight, setWeight] = useState(weight0);
  const weightSet = Math.abs(weight - weight0) >= 0.05;
  const [mode, setMode] = useState<'times' | 'hours'>(() => (watchH != null && night?.bed_min == null ? 'hours' : 'times'));
  const [bed, setBed] = useState(() => (watchH != null && night?.bed_min != null ? clock(night.bed_min) : (prev?.bed ?? '23:00')));
  const [wake, setWake] = useState(() => (watchH != null && night?.bed_min != null ? clock(night.bed_min + watchH * 60) : (prev?.wake ?? '07:00')));
  const [hm, setHm] = useState<[number, number]>(() => {
    if (watchH == null) return [7, 0];
    const m = Math.round((watchH * 60) / 5) * 5;
    return [Math.min(16, Math.floor(m / 60)), m % 60];
  });
  const [quality, setQuality] = useState<number | null>(1);
  const [energy, setEnergy] = useState<number | null>(null);
  const [sore, setSore] = useState<number | null>(null);
  const [skip, setSkip] = useState({ w: false, s: false });
  const hours = mode === 'times' ? sleepHours(bed, wake) : hm[0] + hm[1] / 60;
  // Sleep comes first. When the watch measured last night, Adro writes it down by itself and doesn't ask.
  // The watch's night can arrive a moment after the sheet opens: the steps are fixed once you move on.
  const [locked, setLocked] = useState<boolean | null>(null);
  const auto = (locked ?? watchH != null) && watchH != null;
  const flow = auto ? (['weight', 'feel'] as const) : (['sleep', 'weight', 'feel'] as const);
  const at = Math.min(step, flow.length - 1);
  const kind = flow[at];
  const next = () => {
    if (locked === null) setLocked(auto);
    setStep(at + 1);
  };
  const tired = energy === 0 || sore === 2;
  const canLighten = !!today.name && !today.done && !today.deload;

  const finish = async (skipFeel: boolean) => {
    const sleepPart = auto
      ? { sleep_h: Math.round(watchH * 10) / 10, ...(night?.bed_min != null ? { bed: clock(night.bed_min), wake: clock(night.bed_min + watchH * 60) } : {}) }
      : skip.s
        ? {}
        : { sleep_h: Math.round(hours * 10) / 10, sleep_q: quality, ...(mode === 'times' ? { bed, wake } : {}) };
    const feel = skipFeel ? {} : { energy, sore };
    const ci = { day: train.today, sleep: auto ? watchH : skip.s ? null : hours, sore: skipFeel ? null : sore, energy: skipFeel ? null : energy };
    const score = recovery({ ...input, checkin: ci }).score;
    // Not a weight you didn't touch when a scale sends one (it would block today's scale reading).
    if (!skip.w && (weightSet || !scale)) health.logWeight(weight);
    const lighter = !skipFeel && tired && canLighten;
    if (lighter) train.updatePlan({ light: train.today });
    const ok = await health.saveCheckin({ ...sleepPart, ...feel, score });
    if (symptoms.length && session) {
      // Add to today's cycle log without losing what's already there.
      loadCycle(session.user.id)
        .then((cy) => {
          const log = cy.logs?.[train.today] ?? {};
          return saveLog(train.today, { ...log, Symptoms: [...new Set([...(log.Symptoms ?? []), ...symptoms])] });
        })
        .catch(() => {});
    }
    health.setCheckinOpen(false);
    if (!ok) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
    const skipped = [skip.w && 'weight', !auto && skip.s && 'sleep', skipFeel && 'how you feel'].filter(Boolean) as string[];
    toast(
      skipped.length === flow.length
        ? t('Check-in skipped for today. See you tomorrow.')
        : lighter
          ? t('Check-in saved. Today’s workout is lighter.')
          : skipped.length
            ? t('Check-in saved. Skipped {x}.', { x: skipped.map((x) => t(x)).join(t(' and ')) })
            : t('Check-in saved. Have a strong day.'),
      { ai: true },
    );
  };

  const head = (icon: IconName, title: string) => (
    <>
      <ProgDots step={at} total={flow.length} />
      <Row gap={8}>
        <Icon name={icon} size={20} color={c.cobalt} />
        <Text variant="small" weight={700} color="sec">
          {t('Step {n} of {m}', { n: at + 1, m: flow.length })}
        </Text>
      </Row>
      <Text variant="h1" style={{ marginTop: 4 }}>
        {title}
      </Text>
    </>
  );

  if (kind === 'weight')
    return (
      <View>
        {head('scale', t('Morning weight'))}
        {auto ? (
          <Row gap={6} style={{ marginTop: 6 }}>
            <Icon name="moon" size={16} color={c.cobalt} />
            <Text variant="small" color="sec">
              {t('Sleep from your watch: {h}', { h: fmtDur(watchH, t) })}
            </Text>
          </Row>
        ) : null}
        <Card style={{ marginTop: 16, paddingVertical: 4 }}>
          <WeightWheel
            value={weight}
            onChange={setWeight}
          />
        </Card>
        <Row gap={8} style={{ alignItems: 'flex-start' }}>
          <Icon name="info" size={18} color={c.sec} />
          <Text variant="small" color="sec" style={{ flex: 1 }}>
            {t('Weigh yourself after using the bathroom, before eating or drinking.')}
          </Text>
        </Row>
        <Button title={t('Next')} style={{ marginTop: 16 }} onPress={() => (setSkip((s) => ({ ...s, w: false })), next())} />
        <Button kind="ghost" title={t('Skip weight today')} style={{ marginTop: 4 }} onPress={() => (setSkip((s) => ({ ...s, w: true })), next())} />
      </View>
    );

  if (kind === 'sleep')
    return (
      <View>
        {head('moon', t('How did you sleep?'))}
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
        <Button title={t('Next')} style={{ marginTop: 20 }} onPress={() => (setSkip((s) => ({ ...s, s: false })), next())} />
        <Button kind="ghost" title={t('Skip sleep today')} style={{ marginTop: 4 }} onPress={() => (setSkip((s) => ({ ...s, s: true })), next())} />
      </View>
    );

  return (
    <View>
      {head('bolt', t('How do you feel?'))}
      <Label>{t('Energy')}</Label>
      <Choices options={['Tired', 'Normal', 'Great']} value={energy} onChange={setEnergy} />
      <Label>{t('Muscle soreness')}</Label>
      <Choices options={['None', 'A little', 'Very sore']} value={sore} onChange={setSore} />
      {cycle ? (
        <>
          <Label optional={t('Optional')}>{t('Any cycle symptoms?')}</Label>
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            {CY_QUICK.map((x) => (
              <Chip key={x} title={t(x)} on={symptoms.includes(x)} onPress={() => setSymptoms((xs) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]))} />
            ))}
          </Row>
        </>
      ) : null}
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
