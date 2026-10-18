import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { LogSheet, PastSheet } from '@/components/period/LogSheets';
import { AfterBirth, Pregnancy } from '@/components/period/Pregnancy';
import { ROSE, type State } from '@/components/period/shared';
import { Ring } from '@/components/Ring';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Chip, Row } from '@/components/ui';
import { useT } from '@/i18n';
import { CY_PLAN, cycleNow, deletePeriod, endPeriod, nextFertile, saveSettings, startPeriod } from '@/lib/cycle';
import { useFood } from '@/lib/food';
import { shortDate } from '@/lib/progress';
import { useSettings } from '@/theme/settings';

export function TodayTab({ st, reload, uid }: { st: State; reload: () => void; uid: string }) {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { today } = useFood();
  const [logOpen, setLogOpen] = useState(false);
  const [pastOpen, setPastOpen] = useState(false);
  const s = st.settings;
  if (s.mode === 'preg') return <Pregnancy s={s} save={async (next) => (await saveSettings(uid, next), reload())} />;
  if (s.mode === 'post') return <AfterBirth week={s.post_week ?? 2} set={async (w) => (await saveSettings(uid, { ...s, post_week: w }), reload())} />;
  const now = cycleNow(st.periods, s, today);
  const lg = st.logs[today] ?? {};
  const logged = Object.values(lg).flat();
  const ttc = s.mode === 'ttc';
  const fw = now ? nextFertile(now, today) : null;

  const start = async () => {
    const p = await startPeriod(today);
    if (!p) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
    toast(t('Period start logged. Predictions updated.'), { icon: 'drop', undo: async () => (await deletePeriod(p.id), reload()) });
    reload();
  };

  return (
    <View>
      {s.mode === 'peri' ? (
        <Card style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
          <Icon name="moon" size={20} color={c.cobalt} />
          <Text variant="small" style={{ flex: 1 }}>
            {t('In perimenopause cycles can get shorter, longer or skip. Predictions are less exact, so keep logging. Strength training and enough protein matter more now for bones and muscle.')}
          </Text>
        </Card>
      ) : null}
      {now ? (
        <Card style={{ alignItems: 'center', paddingVertical: 22 }}>
          <Ring value={Math.min(now.day, now.cycle)} max={now.cycle} size={170} stroke={15} color={now.phase === 'Period' ? ROSE : c.cobalt}>
            <Text variant="small" weight={700} color="sec">
              {t('Day')}
            </Text>
            <Text num size={40}>
              {now.day}
            </Text>
            <Text variant="small" weight={700} color="sec">
              {t('{p} phase', { p: t(now.phase) })}
            </Text>
          </Ring>
          <Text variant="h3" style={{ marginTop: 16 }}>
            {now.phase === 'Period' ? t('Period day {n}', { n: now.day }) : now.late ? t('Your period is {n} days late', { n: -now.untilNext }) : now.untilNext > 0 ? t('Next period in {n} days', { n: now.untilNext }) : t('Your period could start any day')}
          </Text>
          <Text variant="small" color="sec">
            {t('Expected {d}', { d: shortDate(now.next, lang) })}
          </Text>
          {ttc ? (
            <Row gap={10} style={{ marginTop: 16, alignSelf: 'stretch' }}>
              <View style={{ flex: 1, backgroundColor: c.inset, borderRadius: 14, padding: 10 }}>
                <Text variant="xs" weight={700} color="sec">
                  {t('Chance to get pregnant today')}
                </Text>
                <Text weight={700} color={today >= now.fertileFrom && today <= now.fertileTo ? c.cobalt : 'text'}>
                  {t(today === now.ovDay ? 'Highest' : today >= now.fertileFrom && today <= now.fertileTo ? 'High' : 'Low')}
                </Text>
              </View>
              <View style={{ flex: 1, backgroundColor: c.inset, borderRadius: 14, padding: 10 }}>
                <Text variant="xs" weight={700} color="sec">
                  {fw?.next ? t('Next fertile window') : t('Fertile window')}
                </Text>
                <Text weight={700}>{`${shortDate(fw?.from ?? now.fertileFrom, lang)} – ${shortDate(fw?.to ?? now.fertileTo, lang)}`}</Text>
                <Text variant="xs" color="sec">
                  {t('Ovulation about {d}', { d: shortDate(fw?.ov ?? now.ovDay, lang) })}
                </Text>
              </View>
            </Row>
          ) : null}
          <Row gap={8} style={{ marginTop: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
            {now.phase === 'Period' && now.open ? (
              <Button
                small
                kind="soft"
                title={t('My period ended')}
                onPress={async () => {
                  await endPeriod(now.last.id, today);
                  toast(t('Period length saved: {n} days', { n: now.day }), { icon: 'check' });
                  reload();
                }}
              />
            ) : now.phase !== 'Period' ? (
              <Button small kind="danger" icon="drop" title={t('Period started today')} onPress={start} />
            ) : null}
            <Button small kind="glass" icon="plus" title={t('Log today')} onPress={() => setLogOpen(true)} />
          </Row>
        </Card>
      ) : (
        <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
          <Icon name="drop" size={34} color={ROSE} />
          <Text variant="h3" style={{ marginTop: 8 }}>
            {t('When did your last period start?')}
          </Text>
          <Text variant="small" color="sec" center style={{ marginTop: 4 }}>
            {t('Add it to see your phase and when the next one is due.')}
          </Text>
          <Row gap={8} style={{ marginTop: 12 }}>
            <Button small icon="drop" title={t('It started today')} onPress={start} />
            <Button small kind="glass" title={t('Add a past period')} onPress={() => setPastOpen(true)} />
          </Row>
        </Card>
      )}
      {logged.length ? (
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="small" weight={700}>
              {t('Logged today')}
            </Text>
            <Button small kind="ghost" title={t('Edit')} onPress={() => setLogOpen(true)} />
          </Row>
          <Row gap={6} style={{ flexWrap: 'wrap', marginTop: 4 }}>
            {logged.map((x) => (
              <Chip key={x} title={t(x)} on />
            ))}
          </Row>
        </Card>
      ) : null}
      {now ? (
        <>
          <Text variant="small" weight={700} color="sec" style={{ marginTop: 8, marginBottom: 8, marginHorizontal: 4 }}>
            {t('How it changes your coaching today')}
          </Text>
          <Card>
            <Text variant="small" color="sec">
              {t('Day {n}, {p} phase. Your food, training and recovery advice use this.', { n: now.day, p: t(now.phase).toLowerCase() })}
            </Text>
            {(
              [
                ['train', 'Training', CY_PLAN[now.phase].t, '/train', 'Open training'],
                ['food', 'Food', CY_PLAN[now.phase].f, '/food', 'Open food'],
                ['pulse', 'Recovery', CY_PLAN[now.phase].r, '/recovery', 'Open recovery'],
              ] as const
            ).map(([i, n, x, to, label]) => (
              <Row key={n} gap={12} style={{ alignItems: 'flex-start', marginTop: 12 }}>
                <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: c.cobalt, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={i} size={17} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="small" weight={700}>
                    {t(n)}
                  </Text>
                  <Text variant="small" color="sec">
                    {t(x)}
                  </Text>
                  <Text variant="small" weight={700} color="link" onPress={() => router.push(to)} accessibilityRole="link" style={{ marginTop: 2 }}>
                    {t(label)}
                  </Text>
                </View>
              </Row>
            ))}
          </Card>
          {now.phase === 'Luteal' ? (
            <Card style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <Icon name="scale" size={20} color={c.cobalt} />
              <Text variant="small" style={{ flex: 1 }}>
                {t('If the scale goes up this week, it’s likely water. Your coach won’t cut calories because of it.')}
              </Text>
            </Card>
          ) : null}
          <Text variant="small" weight={700} color="sec" style={{ marginTop: 8, marginBottom: 8, marginHorizontal: 4 }}>
            {t('Ask the coach')}
          </Text>
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            {(ttc ? ['When should I train hard while trying?', 'What should I eat to support fertility?'] : s.mode === 'peri' ? ['Why is my sleep worse?', 'How should I train in perimenopause?'] : ['Why am I hungrier this week?', 'Can I train hard on my period?', 'Why did my weight go up?']).map((q) => (
              <Chip key={q} title={t(q)} onPress={() => router.push({ pathname: '/coach', params: { ask: t(q) } })} />
            ))}
          </Row>
        </>
      ) : null}
      <Sheet open={logOpen} onClose={() => setLogOpen(false)}>
        {logOpen ? <LogSheet day={today} init={lg} onDone={() => (setLogOpen(false), reload())} /> : null}
      </Sheet>
      <Sheet open={pastOpen} onClose={() => setPastOpen(false)}>
        {pastOpen ? <PastSheet onDone={() => (setPastOpen(false), reload())} /> : null}
      </Sheet>
    </View>
  );
}
