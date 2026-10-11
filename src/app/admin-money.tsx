import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { Thinking } from '@/components/food/Thinking';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Chip, NavButton, Row, Segmented } from '@/components/ui';
import { useT } from '@/i18n';
import { balances, catIcon, type Expense, listExpenses, listPartners, type Partner, setShareSettled, sar, toSar, useIsAdmin } from '@/lib/admin';
import { shortDate } from '@/lib/progress';
import { useSettings } from '@/theme/settings';

/** Accounting for the three partners: purchases, who paid, how it's split, and who owes whom. */
export default function AdminMoney() {
  const { t } = useT();
  const admin = useIsAdmin();
  const [tab, setTab] = useState<'list' | 'balance'>('list');
  const [d, setD] = useState<{ partners: Partner[]; list: Expense[] } | null>(null);
  const load = useCallback(async () => {
    const [partners, list] = await Promise.all([listPartners(), listExpenses()]);
    setD({ partners, list });
  }, []);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      Promise.all([listPartners(), listExpenses()]).then(([partners, list]) => alive && setD({ partners, list }));
      return () => {
        alive = false;
      };
    }, []),
  );
  if (!admin)
    return (
      <Screen title={t('Accounting')} back>
        <Text color="sec">{t('Only the Gymi team can open this page.')}</Text>
      </Screen>
    );
  return (
    <Screen title={t('Accounting')} back right={<NavButton icon="plus" label={t('Add a purchase')} onPress={() => router.push('/admin-expense')} />}>
      <Segmented<'list' | 'balance'>
        value={tab}
        options={[
          { value: 'list', label: t('Purchases') },
          { value: 'balance', label: t('Who owes whom') },
        ]}
        onChange={setTab}
      />
      <View style={{ height: 14 }} />
      {!d ? <Thinking message={t('Loading')} /> : tab === 'list' ? <Purchases partners={d.partners} list={d.list} /> : <Balances partners={d.partners} list={d.list} reload={load} />}
    </Screen>
  );
}

function Purchases({ partners, list }: { partners: Partner[]; list: Expense[] }) {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const [f, setF] = useState<string>('all');
  const name = (id: string | null) => partners.find((p) => p.id === id)?.name ?? '—';
  const cats = [...new Set(list.map((e) => e.category))];
  const shown = list.filter((e) => (f === 'all' ? true : f === 'planned' ? !e.bought : f === 'open' ? e.bought && e.shares.some((s) => !s.settled && s.partner_id !== e.paid_by) : e.category === f));
  const total = shown.filter((e) => e.bought).reduce((a, e) => a + toSar(e.amount, e.currency), 0);
  const planned = shown.filter((e) => !e.bought).reduce((a, e) => a + toSar(e.amount, e.currency), 0);
  if (!list.length)
    return (
      <Card style={{ alignItems: 'center', paddingVertical: 26 }}>
        <Icon name="doc" size={30} color={c.sec} />
        <Text variant="h3" style={{ marginTop: 8 }}>
          {t('No purchases yet')}
        </Text>
        <Text variant="small" color="sec" center style={{ marginTop: 4 }}>
          {t('Add what each of you bought for Gymi, and how you split it.')}
        </Text>
        <Button small icon="plus" title={t('Add a purchase')} style={{ marginTop: 12, alignSelf: 'center' }} onPress={() => router.push('/admin-expense')} />
      </Card>
    );
  return (
    <View>
      <Row gap={8}>
        <Card style={{ flex: 1 }}>
          <Text variant="xs" weight={700} color="sec">
            {t('Spent')}
          </Text>
          <Text num size={22}>{`${sar(total)} ${t('SAR')}`}</Text>
        </Card>
        <Card style={{ flex: 1 }}>
          <Text variant="xs" weight={700} color="sec">
            {t('Not bought yet')}
          </Text>
          <Text num size={22}>{`${sar(planned)} ${t('SAR')}`}</Text>
        </Card>
      </Row>
      <Row gap={8} style={{ flexWrap: 'wrap', marginBottom: 12 }}>
        <Chip title={t('All')} on={f === 'all'} onPress={() => setF('all')} />
        <Chip title={t('Still owed')} on={f === 'open'} onPress={() => setF('open')} />
        <Chip title={t('Not bought yet')} on={f === 'planned'} onPress={() => setF('planned')} />
        {cats.map((x) => (
          <Chip key={x} title={t(x)} on={f === x} onPress={() => setF(x)} />
        ))}
      </Row>
      <View style={{ backgroundColor: c.card, borderRadius: 22, overflow: 'hidden' }}>
        {shown.map((e, i) => {
          const open = e.bought ? e.shares.filter((s) => !s.settled && s.partner_id !== e.paid_by).length : 0;
          return (
            <Card
              key={e.id}
              onPress={() => router.push({ pathname: '/admin-expense', params: { id: e.id } })}
              style={{ marginBottom: 0, borderRadius: 0, borderTopWidth: i ? 1 : 0, borderTopColor: c.line, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={catIcon(e.category)} size={18} color={c.cobalt} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text weight={700} numberOfLines={1}>
                  {e.title}
                </Text>
                <Text variant="xs" color="sec" numberOfLines={1}>
                  {[shortDate(e.day, lang), t(e.category), e.bought ? t('Paid by {n}', { n: name(e.paid_by) }) : t('Not bought yet')].join(' · ')}
                </Text>
                {open ? (
                  <Text variant="xs" weight={700} style={{ color: c.down }}>
                    {t('{n} still owe their part', { n: open })}
                  </Text>
                ) : null}
              </View>
              <Text num size={16}>{`${sar(e.amount)} ${t(e.currency)}`}</Text>
            </Card>
          );
        })}
      </View>
    </View>
  );
}

function Balances({ partners, list, reload }: { partners: Partner[]; list: Expense[]; reload: () => void }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const b = balances(partners, list);
  const name = (id: string) => partners.find((p) => p.id === id)?.name ?? id;
  const byCat = Object.entries(
    list.filter((e) => e.bought).reduce<Record<string, number>>((a, e) => ({ ...a, [e.category]: (a[e.category] ?? 0) + toSar(e.amount, e.currency) }), {}),
  ).sort((x, y) => y[1] - x[1]);
  const top = byCat[0]?.[1] ?? 1;

  // Mark every open share from one person to another as paid back.
  const markPaid = async (from: string, to: string) => {
    const open = list.filter((e) => e.bought && e.paid_by === to).flatMap((e) => e.shares.filter((s) => s.partner_id === from && !s.settled).map(() => e.id));
    if (!open.length) return toast(t('Settle it from each purchase: these amounts pass through another person.'), { icon: 'info' });
    await Promise.all(open.map((id) => setShareSettled(id, from, true)));
    toast(t('Marked as paid'), { icon: 'check' });
    reload();
  };

  return (
    <View>
      {partners.map((p) => {
        const n = b.net[p.id] ?? 0;
        return (
          <Card key={p.id}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text variant="h3">{p.name}</Text>
              <Text weight={700} style={{ color: n > 0.005 ? c.up : n < -0.005 ? c.down : c.sec }}>
                {n > 0.005 ? t('Gets back {a} SAR', { a: sar(n) }) : n < -0.005 ? t('Owes {a} SAR', { a: sar(-n) }) : t('All settled')}
              </Text>
            </Row>
            <Row gap={8} style={{ marginTop: 10 }}>
              {(
                [
                  ['Paid', b.paid[p.id] ?? 0],
                  ['Their part', b.part[p.id] ?? 0],
                ] as const
              ).map(([l, v]) => (
                <View key={l} style={{ flex: 1, backgroundColor: c.inset, borderRadius: 14, padding: 10 }}>
                  <Text num size={17}>{`${sar(v)} ${t('SAR')}`}</Text>
                  <Text variant="xs" weight={700} color="sec">
                    {t(l)}
                  </Text>
                </View>
              ))}
            </Row>
          </Card>
        );
      })}
      <Text variant="small" weight={700} color="sec" style={{ marginTop: 8, marginBottom: 8, marginHorizontal: 4 }}>
        {t('To settle up')}
      </Text>
      {b.settle.length ? (
        b.settle.map((s) => (
          <Card key={`${s.from}-${s.to}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Icon name="send" size={18} color={c.cobalt} />
            <Text weight={700} style={{ flex: 1 }}>
              {t('{a} pays {b} {n} SAR', { a: name(s.from), b: name(s.to), n: sar(s.amount) })}
            </Text>
            <Button small kind="soft" title={t('Mark paid')} onPress={() => markPaid(s.from, s.to)} />
          </Card>
        ))
      ) : (
        <Card style={{ alignItems: 'center' }}>
          <Text color="sec">{t('Nobody owes anything.')}</Text>
        </Card>
      )}
      {byCat.length ? (
        <>
          <Text variant="small" weight={700} color="sec" style={{ marginTop: 8, marginBottom: 8, marginHorizontal: 4 }}>
            {t('Spent by category')}
          </Text>
          <Card>
            {byCat.map(([cat, v], i) => (
              <View key={cat} style={{ marginTop: i ? 12 : 0 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Row gap={6}>
                    <Icon name={catIcon(cat)} size={15} color={c.sec} />
                    <Text variant="small" weight={700}>
                      {t(cat)}
                    </Text>
                  </Row>
                  <Text variant="small" num>{`${sar(v)} ${t('SAR')}`}</Text>
                </Row>
                <View style={{ height: 8, borderRadius: 4, backgroundColor: c.inset, marginTop: 6, overflow: 'hidden' }}>
                  <View style={{ width: `${Math.max(3, (v / top) * 100)}%`, height: '100%', backgroundColor: c.cobalt, borderRadius: 4 }} />
                </View>
              </View>
            ))}
          </Card>
        </>
      ) : null}
      <Text variant="xs" color="sec" style={{ marginHorizontal: 4 }}>
        {t('Dollar amounts are counted at 3.75 SAR. Only bought purchases count.')}
      </Text>
    </View>
  );
}
