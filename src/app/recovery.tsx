import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { BarChart, LineChart } from '@/components/Charts';
import { Stepper } from '@/components/food/Stepper';
import { IllnessCard } from '@/components/health/IllnessCard';
import { ScoreParts } from '@/components/health/ScoreParts';
import { Icon, type IconName, Mark } from '@/components/Icon';
import { Bar, Ring } from '@/components/Ring';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { useRecovery } from '@/components/train/RecoveryCard';
import { useToday } from '@/components/train/WorkoutCard';
import { Button, Card, Chip, Row } from '@/components/ui';
import { useT } from '@/i18n';
import { useCycleToday } from '@/lib/cyclePhase';
import { type DeviceDay, latestDeviceReadings } from '@/lib/devices';
import { useHealth } from '@/lib/health';
import { addDays } from '@/lib/nutrition';
import { dailyLoad, hoursToReady, muscleReady, REC_TOOLS, recLabel, recovery, recTips } from '@/lib/recovery';
import { useTrain } from '@/lib/train';
import { muscleLabel, MUSCLES } from '@/lib/training';
import { useSettings } from '@/theme/settings';

/** Recovery score, what's in it, muscle readiness and tips (design: recovery). */
export default function RecoveryScreen() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const train = useTrain();
  const today = useToday();
  const { input, r, watchSleep } = useRecovery();
  const health = useHealth();
  const ci = health.todayCheckin;
  // Sleep you logged, else your watch's, else 7 h; it follows them as they load until you change it yourself.
  const [typed, setTyped] = useState<number | null>(null);
  const sleep = typed ?? ci?.sleep_h ?? watchSleep ?? 7;
  const setSleep = (h: number) => setTyped(h);
  const [sore, setSore] = useState<number | null>(ci?.sore ?? null);
  const [energy, setEnergy] = useState<number | null>(ci?.energy ?? null);
  const [label, tone] = recLabel(r.score);
  const ready = muscleReady(train.logs, train.today);
  const cycle = useCycleToday();
  const tips = recTips(r, input, cycle);
  const [dev, setDev] = useState<DeviceDay[]>([]);
  useEffect(() => {
    let alive = true;
    latestDeviceReadings()
      .then((x) => alive && setDev(x.days))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const days7 = Array.from({ length: 7 }, (_, i) => addDays(train.today, i - 6));
  const dayLabel = (d: string) => t(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(`${d}T12:00:00`).getDay()]).slice(0, 2);
  const ciOf = (d: string) => health.checkins.find((x) => x.day === d);
  const sleep7 = days7.map((d) => ciOf(d)?.sleep_h ?? dev.find((x) => x.day === d)?.sleep_h ?? null);
  const score7 = days7.map((d) => (d === train.today ? r.score : (ciOf(d)?.score ?? null)));
  const hrv7 = days7.map((d) => dev.find((x) => x.day === d)?.hrv ?? null);
  const rhr7 = days7.map((d) => dev.find((x) => x.day === d)?.hr_rest ?? null);
  const fill = (xs: (number | null)[]) => xs.filter((x): x is number => x != null);
  const load = dailyLoad(train.logs, train.today, 14);
  const toggleTool = (k: string) => {
    const on = train.recTools.includes(k);
    const next = on ? train.recTools.filter((x) => x !== k) : [...train.recTools, k];
    train.setRecTools(next);
    if (!on) {
      const sc = recovery({ ...input, tools: next }).score;
      toast(t('{x} logged. Recovery {n}%', { x: t(REC_TOOLS.find((x) => x[0] === k)![1]), n: sc }), { icon: 'check' });
    }
  };
  const canLighten = !!today.name && !today.done && !today.light && !today.deload && r.score < 60;

  const save = () => {
    if (sore === null || energy === null) return;
    // Sleep is saved only when you set it (or logged it before), so a default never hides your watch's sleep.
    const own = typed != null || ci?.sleep_h != null;
    const score = recovery({ ...input, checkin: { day: train.today, sleep: own ? sleep : watchSleep, sore, energy } }).score;
    health.saveCheckin({ ...(own ? { sleep_h: sleep } : {}), sore, energy, score });
    toast(t('Saved. Your score is updated.'), { icon: 'check' });
  };

  const head = (s: string) => (
    <Text variant="small" weight={700} color="sec" style={{ marginTop: 20, marginBottom: 8, marginHorizontal: 4 }}>
      {s}
    </Text>
  );

  return (
    <Screen title={t('Recovery')} back>
      <IllnessCard />
      <Card style={{ alignItems: 'center', paddingVertical: 22 }}>
        <Ring value={r.score} max={100} size={160} stroke={15} color={r.score >= 60 ? c.cobalt : c.down}>
          <Text num size={40}>{`${r.score}%`}</Text>
          <Text variant="xs" weight={700} color="sec">
            {t('recovered')}
          </Text>
        </Ring>
        <Text variant="h2" color={tone === 'down' ? 'down' : tone === 'up' ? 'up' : 'text'} style={{ marginTop: 12 }}>
          {t(label)}
        </Text>
        <Text variant="small" color="sec" center style={{ marginTop: 4 }}>
          {t('Based on your sleep, soreness, energy, training load and food.')}
        </Text>
      </Card>
      {canLighten ? (
        <Button
          kind="soft"
          icon="bolt"
          title={t('Make today’s workout lighter')}
          onPress={() => {
            train.updatePlan({ light: train.today });
            toast(t('Lighter today: one set less and about 10% less weight.'), { ai: true });
          }}
        />
      ) : null}

      {head(t('How do you feel today?'))}
      <Card>
        <Text weight={700}>{t('Sleep last night')}</Text>
        <View style={{ marginTop: 8 }}>
          <Stepper onMinus={() => setSleep(Math.max(0, sleep - 0.5))} onPlus={() => setSleep(Math.min(14, sleep + 0.5))} bg={c.inset} labels={[t('Less'), t('More')]}>
            <Text num size={28} style={{ width: 90, textAlign: 'center' }}>{`${sleep} ${t('h')}`}</Text>
          </Stepper>
        </View>
        <Text weight={700} style={{ marginTop: 14 }}>
          {t('Sore muscles?')}
        </Text>
        <Row gap={8} style={{ marginTop: 8, flexWrap: 'wrap' }}>
          {['None', 'A little', 'Very sore'].map((x, i) => (
            <Chip key={x} title={t(x)} on={sore === i} onPress={() => setSore(i)} />
          ))}
        </Row>
        <Text weight={700} style={{ marginTop: 14 }}>
          {t('Energy')}
        </Text>
        <Row gap={8} style={{ marginTop: 8, flexWrap: 'wrap' }}>
          {['Tired', 'Normal', 'Great'].map((x, i) => (
            <Chip key={x} title={t(x)} on={energy === i} onPress={() => setEnergy(i)} />
          ))}
        </Row>
        <Button title={t(ci ? 'Update' : 'Save')} disabled={sore === null || energy === null} style={{ marginTop: 16 }} onPress={save} />
      </Card>

      {head(t('What’s in your score'))}
      <ScoreParts parts={r.parts} />

      {head(t('Muscles ready to train'))}
      <Card>
        {MUSCLES.map((m) => (
          <View key={m} style={{ marginTop: 6 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text variant="small" weight={700}>
                {muscleLabel(m, lang, t)}
              </Text>
              <Text variant="small" weight={700} num color={ready[m] >= 80 ? 'up' : 'sec'}>
                {hoursToReady(ready[m]) ? t('~{n} h', { n: hoursToReady(ready[m]) }) : t('Ready')}
              </Text>
            </Row>
            <View style={{ marginTop: 4 }}>
              <Bar value={ready[m]} max={100} color={ready[m] >= 80 ? c.up : ready[m] >= 55 ? '#D97706' : c.down} />
            </View>
          </View>
        ))}
        <Text variant="xs" color="sec" style={{ marginTop: 12 }}>
          {t('Green is ready. Hours show roughly when it’s fully recovered.')}
        </Text>
      </Card>

      {head(t('Recover faster'))}
      {tips.map((x) => (
        <Card key={x.title} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
          <Icon name={x.icon as IconName} size={20} color={c.cobalt} />
          <View style={{ flex: 1 }}>
            <Text weight={700}>{t(x.title)}</Text>
            <Text variant="small" color="sec" style={{ marginTop: 2 }}>
              {t(x.body, x.vars)}
            </Text>
          </View>
        </Card>
      ))}
      <Button kind="glass" title={t('Ask the coach about recovery')} style={{ marginTop: 4 }} onPress={() => router.push({ pathname: '/coach', params: { ask: t('How can I recover faster?') } })} />

      {head(t('Log recovery'))}
      <Text variant="small" color="sec" style={{ marginTop: -4, marginBottom: 10, marginHorizontal: 4 }}>
        {t('What did you do today? It’s added to your score.')}
      </Text>
      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        {REC_TOOLS.map(([k, n]) => (
          <Chip key={k} title={`${train.recTools.includes(k) ? '✓ ' : ''}${t(n)}`} on={train.recTools.includes(k)} onPress={() => toggleTool(k)} />
        ))}
      </Row>
      {r.bonus ? (
        <Text variant="xs" color="sec" style={{ marginTop: 8, marginHorizontal: 4 }}>
          {t('+{n} to today’s score', { n: r.bonus })}
        </Text>
      ) : null}

      {head(t('Last 7 days'))}
      <Row gap={10} style={{ alignItems: 'stretch' }}>
        {(fill(hrv7).length >= 2
          ? [
              [t('HRV (ms)'), hrv7],
              [t('Resting HR (bpm)'), rhr7],
            ]
          : [
              [t('Sleep (h)'), sleep7],
              [t('Recovery'), score7],
            ]
        ).map(([label, xs]) => (
          <Card key={label as string} style={{ flex: 1, marginBottom: 0 }}>
            <Text variant="xs" weight={700} color="sec">
              {label as string}
            </Text>
            {fill(xs as (number | null)[]).length >= 2 ? (
              <LineChart values={fill(xs as (number | null)[])} height={80} />
            ) : (
              <Text variant="xs" color="sec" style={{ marginTop: 12 }}>
                {t('Not enough data yet')}
              </Text>
            )}
          </Card>
        ))}
      </Row>
      <Card style={{ marginTop: 12 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="small" weight={700}>
            {t('Training load, 14 days')}
          </Text>
          <Text variant="xs" weight={700} color="sec">
            {r.early ? t('Building your baseline') : t('{n}× usual', { n: Math.round(r.acwr * 10) / 10 })}
          </Text>
        </Row>
        <View style={{ marginTop: 8 }}>
          <BarChart values={load.map((x) => x.volume || (x.minutes ? x.minutes * 10 : 0))} labels={load.map((x, i) => (i % 2 ? '' : dayLabel(x.day)))} highlight={load.length - 1} height={120} />
        </View>
      </Card>
      <Row gap={8} style={{ justifyContent: 'center', marginTop: 8 }}>
        <Mark size={14} color={c.sec} stroke={3} />
        <Text variant="xs" color="sec" center>
          {t(dev.length ? 'Heart and sleep data from your phone’s health app.' : 'Connect Apple Health or Health Connect for real heart data.')} {t('Not medical advice.')}
        </Text>
      </Row>
    </Screen>
  );
}
