import { type ReactNode, useEffect, useState } from 'react';
import { View } from 'react-native';

import { TimeField } from '@/components/food/TimeField';
import { Thinking } from '@/components/food/Thinking';
import { Icon, type IconName } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { List, ListRow } from '@/components/social/List';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Chip, Row, Toggle } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { type CoachNotif, getCoachNotif, saveCoachNotif } from '@/lib/coaching';
import { syncCoachAlerts } from '@/lib/coachNotify';
import { fmtTime } from '@/lib/nutrition';
import { DAYS } from '@/lib/training';
import { useSettings } from '@/theme/settings';

const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Coach notification settings, saved to the account (design: cnotif). Daily summary and weekly ranking are scheduled on the phone;
 * low commitment and no food logged mark clients in the Clients tab. Only settings that do something are shown. */
export default function CoachNotifScreen() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { session } = useAuth();
  const uid = session?.user.id;
  const [n, setN] = useState<CoachNotif | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    getCoachNotif().then((v) => alive && setN(v));
    return () => {
      alive = false;
    };
  }, []);

  if (!n)
    return (
      <Screen title={t('Notifications')} back>
        <Thinking message={t('Loading')} />
      </Screen>
    );
  const set = (patch: Partial<CoachNotif>) => {
    setN({ ...n, ...patch });
    setDirty(true);
  };
  const row = (icon: IconName, title: string, sub: string, on: boolean, flip: (v: boolean) => void, extra?: ReactNode, first?: boolean) => (
    <ListRow first={first}>
      <View style={{ flex: 1 }}>
        <Row gap={12} style={{ alignItems: 'flex-start' }}>
          <Icon name={icon} size={18} color={c.sec} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text weight={700}>{title}</Text>
            <Text variant="small" color="sec">
              {sub}
            </Text>
          </View>
          <Toggle value={on} onChange={flip} label={title} />
        </Row>
        {on && extra ? <View style={{ paddingTop: 10, paddingLeft: 30 }}>{extra}</View> : null}
      </View>
    </ListRow>
  );
  const chips = <V extends number>(vals: V[], cur: V, pick: (v: V) => void, label: (v: V) => string) => (
    <Row gap={6} style={{ flexWrap: 'wrap' }}>
      {vals.map((v) => (
        <Chip key={v} title={label(v)} on={cur === v} onPress={() => pick(v)} />
      ))}
    </Row>
  );
  const head = (s: string) => (
    <Text variant="small" weight={700} color="sec" style={{ marginTop: 18, marginBottom: 8, marginHorizontal: 4 }}>
      {s}
    </Text>
  );
  const time = (v: string, pick: (v: string) => void, label: string) => (
    <View style={{ width: 130 }}>
      <TimeField value={v} onChange={pick} label={label} height={36} />
    </View>
  );

  return (
    <Screen title={t('Notifications')} back>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Icon name="bell" size={20} color={c.cobalt} />
        <View style={{ flex: 1 }}>
          <Text weight={700}>{t('Allow notifications')}</Text>
          <Text variant="small" color="sec">
            {t('Turn off to pause everything')}
          </Text>
        </View>
        <Toggle value={n.on} onChange={(v) => set({ on: v })} label={t('Allow notifications')} />
      </Card>
      <View style={{ opacity: n.on ? 1 : 0.45 }} pointerEvents={n.on ? 'auto' : 'none'}>
        {head(t('Client alerts'))}
        <List>
          {row('send', t('New messages'), t('When a client sends you a message'), n.msgs, (v) => set({ msgs: v }), undefined, true)}
          {row(
            'warn',
            t('Low commitment'),
            t('When a client drops under {n}%', { n: n.low.th }),
            n.low.on,
            (v) => set({ low: { ...n.low, on: v } }),
            <View>
              <Text variant="xs" weight={700} color="sec" style={{ marginBottom: 6 }}>
                {t('Alert me under')}
              </Text>
              {chips([30, 40, 50, 60, 70, 80], n.low.th, (v) => set({ low: { ...n.low, th: v } }), (v) => `${v}%`)}
            </View>,
          )}
          {row(
            'food',
            t('No food logged'),
            t(n.nofood.n > 1 ? 'When a client logs nothing for {n} days' : 'When a client logs nothing for {n} day', { n: n.nofood.n }),
            n.nofood.on,
            (v) => set({ nofood: { ...n.nofood, on: v } }),
            chips([1, 2, 3], n.nofood.n, (v) => set({ nofood: { ...n.nofood, n: v } }), (v) => t(v > 1 ? '{n} days' : '{n} day', { n: v })),
          )}
        </List>
        {head(t('Summaries'))}
        <List>
          {row(
            'grid',
            t('Daily summary'),
            t('Every day at {t}: who trained, who logged food', { t: fmtTime(n.daily.t, lang) }),
            n.daily.on,
            (v) => set({ daily: { ...n.daily, on: v } }),
            time(n.daily.t, (v) => set({ daily: { ...n.daily, t: v } }), t('Time')),
            true,
          )}
          {row(
            'star',
            t('Weekly ranking'),
            t('{d} at {t}: your clients ranked by commitment', { d: t(DAYS_LONG[n.weekly.day]), t: fmtTime(n.weekly.t, lang) }),
            n.weekly.on,
            (v) => set({ weekly: { ...n.weekly, on: v } }),
            <View style={{ gap: 8 }}>
              {chips([0, 1, 2, 3, 4, 5, 6], n.weekly.day, (v) => set({ weekly: { ...n.weekly, day: v } }), (v) => t(DAYS[v]))}
              {time(n.weekly.t, (v) => set({ weekly: { ...n.weekly, t: v } }), t('Time'))}
            </View>,
          )}
        </List>
        {head(t('Quiet hours'))}
        <List>
          {row(
            'moon',
            t('Don’t disturb me'),
            n.quiet.on ? t('{a} to {b}. Alerts wait until morning.', { a: fmtTime(n.quiet.from, lang), b: fmtTime(n.quiet.to, lang) }) : t('Off'),
            n.quiet.on,
            (v) => set({ quiet: { ...n.quiet, on: v } }),
            <Row gap={8} style={{ flexWrap: 'wrap' }}>
              <Text variant="xs" weight={700} color="sec">
                {t('From')}
              </Text>
              {time(n.quiet.from, (v) => set({ quiet: { ...n.quiet, from: v } }), t('From'))}
              <Text variant="xs" weight={700} color="sec">
                {t('to')}
              </Text>
              {time(n.quiet.to, (v) => set({ quiet: { ...n.quiet, to: v } }), t('To'))}
            </Row>,
            true,
          )}
        </List>
      </View>
      <Text variant="xs" color="sec" style={{ marginHorizontal: 4 }}>
        {t('Summaries arrive on the phone app.')}
      </Text>
      <Button
        title={t('Save')}
        disabled={!dirty}
        loading={busy}
        style={{ marginTop: 12 }}
        onPress={async () => {
          if (!uid) return;
          setBusy(true);
          const ok = await saveCoachNotif(uid, n);
          if (ok) {
            const r = await syncCoachAlerts(
              n,
              { dailyTitle: t('Daily summary'), dailyBody: t('See who trained and who logged food today.'), weeklyTitle: t('Weekly ranking'), weeklyBody: t('Your clients ranked by commitment this week.') },
              true,
            ).catch(() => 'unsupported' as const);
            if (r === 'denied') toast(t('Turn on notifications for Adro in your phone settings.'), { icon: 'bell' });
          }
          setBusy(false);
          if (ok) setDirty(false);
          toast(ok ? t('Saved') : t('Couldn’t save. Please try again.'), { icon: ok ? 'check' : 'warn' });
        }}
      />
    </Screen>
  );
}
