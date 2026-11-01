import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { Thinking } from '@/components/food/Thinking';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Avatar } from '@/components/social/Avatar';
import { Text } from '@/components/Text';
import { Card, Row } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { type ClientLink, coachList, type CoachProfile, earningsOf, getCoachProfile, normalizePackages, payoutDate, pkgPricing } from '@/lib/coaching';
import { fmt } from '@/lib/nutrition';
import { useSettings } from '@/theme/settings';

/** A coach's subscribers and money: what's coming at the next payout (start of each month), by package and by month. */
export default function CoachEarnings() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const { session } = useAuth();
  const uid = session?.user.id;
  const [d, setD] = useState<{ p: CoachProfile | null; l: ClientLink[] } | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!uid) return;
      let alive = true;
      Promise.all([getCoachProfile(uid), coachList()]).then(([p, l]) => alive && setD({ p, l }));
      return () => {
        alive = false;
      };
    }, [uid]),
  );
  if (!d)
    return (
      <Screen title={t('Earnings')} back>
        <Thinking message={t('Loading')} />
      </Screen>
    );

  const loc = lang === 'ar' ? 'ar-u-nu-latn' : 'en-US';
  const day = (x: Date) => new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short', year: 'numeric' }).format(x);
  const month = (x: Date) => new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric' }).format(x);
  const sar = (n: number) => `${fmt(n)} ${t('SAR')}`;
  const now = new Date();
  const all = earningsOf(d.l, d.p?.packages);
  const monthKey = (x: Date) => `${x.getFullYear()}-${x.getMonth()}`;
  const thisMonth = all.filter((e) => monthKey(e.start) === monthKey(now));
  const next = payoutDate(now);
  const nextSum = thisMonth.reduce((a, e) => a + e.coach, 0);
  const paid = all.filter((e) => e.payout <= now).reduce((a, e) => a + e.coach, 0);
  const active = all.filter((e) => e.end > now);
  const total = all.reduce((a, e) => a + e.coach, 0);
  // The last 6 months, newest first.
  const months = Array.from({ length: 6 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - i, 1)).map((m) => {
    const list = all.filter((e) => monthKey(e.start) === monthKey(m));
    return { m, n: list.length, sum: list.reduce((a, e) => a + e.coach, 0), paidOn: payoutDate(m) };
  });
  const pk = normalizePackages(d.p?.packages).filter((x) => x.on || all.some((e) => e.pkg.id === x.id));

  const stat = (label: string, value: string, sub?: string) => (
    <Card style={{ flex: 1, minWidth: 0 }}>
      <Text variant="xs" weight={700} color="sec">
        {label}
      </Text>
      <Text num size={22} weight={800} style={{ marginTop: 4 }}>
        {value}
      </Text>
      {sub ? (
        <Text variant="xs" color="sec" style={{ marginTop: 2 }}>
          {sub}
        </Text>
      ) : null}
    </Card>
  );

  return (
    <Screen title={t('Earnings')} back>
      <Card style={{ backgroundColor: c.gAi }}>
        <Row gap={10}>
          <Icon name="cal" size={20} color={c.cobalt} />
          <Text variant="small" weight={700} color="sec">
            {t('Next payout: {d}', { d: day(next) })}
          </Text>
        </Row>
        <Text num size={34} weight={800} style={{ marginTop: 8 }}>
          {sar(nextSum)}
        </Text>
        <Text variant="small" color="sec" style={{ marginTop: 2 }}>
          {t(thisMonth.length === 1 ? 'From 1 subscription this month. Paid at the start of every month.' : 'From {n} subscriptions this month. Paid at the start of every month.', { n: thisMonth.length })}
        </Text>
      </Card>
      <Row gap={10}>
        {stat(t('Active clients'), String(active.length), t('{n} new this month', { n: thisMonth.length }))}
        {stat(t('Paid to you'), sar(paid), t('All time'))}
      </Row>
      <Row gap={10}>
        {stat(t('Total earned'), sar(total), t(all.length === 1 ? '1 subscription' : '{n} subscriptions', { n: all.length }))}
        {stat(t('Members paid'), sar(all.reduce((a, e) => a + e.client, 0)), t('With Adro’s fees and Adro+'))}
      </Row>

      <Text variant="small" weight={700} color="sec" style={{ marginHorizontal: 4, marginTop: 10, marginBottom: 8 }}>
        {t('By package')}
      </Text>
      <Card>
        {pk.length ? (
          pk.map((x, i) => {
            const list = all.filter((e) => e.pkg.id === x.id);
            const pr = pkgPricing(x);
            return (
              <View key={x.id} style={{ paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text weight={700}>{t(x.name)}</Text>
                  <Text weight={800} num>
                    {t(list.length === 1 ? '1 client' : '{n} clients', { n: list.length })}
                  </Text>
                </Row>
                <Text variant="xs" color="sec" style={{ marginTop: 2 }}>
                  {x.price ? t('Members pay {a}, you get {b} each', { a: sar(pr.client), b: sar(pr.coach) }) : t('No price set')}
                </Text>
                <Text variant="xs" weight={700} style={{ marginTop: 2 }}>
                  {t('Earned: {n}', { n: sar(list.reduce((a, e) => a + e.coach, 0)) })}
                </Text>
              </View>
            );
          })
        ) : (
          <Text color="sec">{t('No packages yet.')}</Text>
        )}
      </Card>

      <Text variant="small" weight={700} color="sec" style={{ marginHorizontal: 4, marginTop: 10, marginBottom: 8 }}>
        {t('By month')}
      </Text>
      <Card>
        {months.map((m, i) => (
          <Row key={i} style={{ justifyContent: 'space-between', paddingVertical: 9, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
            <View style={{ flex: 1 }}>
              <Text weight={700}>{month(m.m)}</Text>
              <Text variant="xs" color="sec">
                {t(m.n === 1 ? '1 subscription' : '{n} subscriptions', { n: m.n })}
                {t(', ')}
                {m.paidOn <= now ? t('paid {d}', { d: day(m.paidOn) }) : t('paid on {d}', { d: day(m.paidOn) })}
              </Text>
            </View>
            <Text weight={800} num color={m.sum ? c.up : c.sec}>
              {sar(m.sum)}
            </Text>
          </Row>
        ))}
      </Card>

      <Text variant="small" weight={700} color="sec" style={{ marginHorizontal: 4, marginTop: 10, marginBottom: 8 }}>
        {t('Subscribers')}
      </Text>
      <Card style={{ marginBottom: 24 }}>
        {all.length ? (
          all.map((e, i) => {
            const nm = e.link.name || e.link.username || t('Client');
            const on = e.end > now;
            return (
              <Row key={e.link.id} gap={10} style={{ paddingVertical: 9, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
                <Avatar id={e.link.client_id ?? e.link.id} name={nm} size={36} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text weight={700} numberOfLines={1}>
                    {nm}
                  </Text>
                  <Text variant="xs" color="sec">
                    {`${t(e.pkg.name)}${t(', ')}${day(e.start)}`}
                  </Text>
                  <Text variant="xs" color={on ? 'sec' : 'down'}>
                    {on ? t('Ends {d}', { d: day(e.end) }) : t('Ended {d}', { d: day(e.end) })}
                  </Text>
                </View>
                <Text weight={800} num color={c.up}>
                  {sar(e.coach)}
                </Text>
              </Row>
            );
          })
        ) : (
          <Text color="sec">{t('No subscribers yet. They show here when someone picks a package.')}</Text>
        )}
      </Card>
    </Screen>
  );
}
