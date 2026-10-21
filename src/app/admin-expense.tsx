import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';

import { Field } from '@/components/Field';
import { Thinking } from '@/components/food/Thinking';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { fontFor, Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Chip, ErrorText, Label, Row, Segmented, Toggle } from '@/components/ui';
import { useT } from '@/i18n';
import { deleteExpense, equalShares, EXPENSE_CATEGORIES, type Expense, listExpenses, listPartners, type Partner, sar, saveExpense, type Share, useIsAdmin } from '@/lib/admin';
import { useAuth } from '@/lib/auth';
import { localDay } from '@/lib/nutrition';
import { useSettings } from '@/theme/settings';
import { goBack } from '@/lib/nav';

type Draft = Omit<Expense, 'id' | 'created_by' | 'shares'> & { id?: string; people: string[]; custom: Record<string, string>; settled: Record<string, boolean>; amountText: string };

const num = (s: string) => Number(s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[^\d.]/g, '')) || 0;

/** Add or edit one purchase: what, how much, who paid, bought or not, and how it's split between Ali, Hamdan and Ahmed. */
export default function AdminExpense() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { session } = useAuth();
  const admin = useIsAdmin();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [partners, setPartners] = useState<Partner[] | null>(null);
  const [d, setD] = useState<Draft | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [ps, list] = await Promise.all([listPartners(), id ? listExpenses() : Promise.resolve([] as Expense[])]);
      if (!alive) return;
      setPartners(ps);
      const e = id ? list.find((x) => x.id === id) : undefined;
      const me = ps.find((p) => p.user_id === session?.user.id)?.id ?? null;
      setD(
        e
          ? {
              ...e,
              amountText: String(e.amount),
              people: e.shares.map((s) => s.partner_id),
              custom: Object.fromEntries(e.shares.map((s) => [s.partner_id, String(s.amount)])),
              settled: Object.fromEntries(e.shares.map((s) => [s.partner_id, s.settled])),
            }
          : {
              day: localDay(),
              title: '',
              category: 'Servers & hosting',
              amount: 0,
              amountText: '',
              currency: 'SAR',
              paid_by: me,
              bought: true,
              split: 'equal',
              note: '',
              people: ps.map((p) => p.id),
              custom: {},
              settled: {},
            },
      );
    })();
    return () => {
      alive = false;
    };
  }, [id, session?.user.id]);

  // Same gate as the other admin pages (the server checks too).
  if (!admin)
    return (
      <Screen title={t('Purchase')} back>
        <Text color="sec">{t('Only the Adro team can open this page.')}</Text>
      </Screen>
    );
  if (!partners || !d)
    return (
      <Screen title={t('Purchase')} back>
        <Thinking message={t('Loading')} />
      </Screen>
    );
  const set = (p: Partial<Draft>) => setD({ ...d, ...p });
  const amount = num(d.amountText);
  const shares: Share[] =
    d.split === 'equal'
      ? equalShares(amount, d.people)
      : d.split === 'one'
        ? d.people.slice(0, 1).map((p) => ({ partner_id: p, amount, settled: false }))
        : d.people.map((p) => ({ partner_id: p, amount: num(d.custom[p] ?? ''), settled: false }));
  const withSettled = shares.map((s) => ({ ...s, settled: s.partner_id === d.paid_by ? true : !!d.settled[s.partner_id] }));
  const sum = shares.reduce((a, s) => a + s.amount, 0);
  const left = Math.round((amount - sum) * 100) / 100;
  const name = (pid: string) => partners.find((p) => p.id === pid)?.name ?? pid;
  const box = { height: 44, borderRadius: 12, backgroundColor: c.inset, paddingHorizontal: 12, fontSize: 16, color: c.text, fontFamily: fontFor('sora', 600), textAlign: 'center' } as const;

  const save = async () => {
    setErr(null);
    if (!d.title.trim()) return setErr(t('Write what you bought.'));
    if (amount <= 0) return setErr(t('Enter the amount.'));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.day)) return setErr(t('Write the date like 2026-10-11.'));
    if (d.bought && !d.paid_by) return setErr(t('Pick who paid.'));
    if (!d.people.length) return setErr(t('Pick who shares the cost.'));
    if (d.split === 'custom' && Math.abs(left) > 0.009) return setErr(t('The parts must add up to the amount ({n} left).', { n: sar(left) }));
    setBusy(true);
    const ok = await saveExpense({ id: d.id, day: d.day, title: d.title, category: d.category, amount, currency: d.currency, paid_by: d.paid_by, bought: d.bought, split: d.split, note: d.note, shares: withSettled });
    setBusy(false);
    if (!ok) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
    toast(t('Purchase saved'), { icon: 'check' });
    goBack();
  };

  return (
    <Screen title={t(d.id ? 'Edit purchase' : 'Add a purchase')} back>
      <Field label={t('What did you buy?')} value={d.title} onChangeText={(v) => set({ title: v })} placeholder={t('For example: Supabase Pro plan, October')} maxLength={120} />
      <Label>{t('Amount')}</Label>
      <TextInput value={d.amountText} onChangeText={(v) => set({ amountText: v.replace(/[^\d.٠-٩]/g, '') })} inputMode="decimal" placeholder="0" placeholderTextColor={c.sec} style={[box, { height: 54, fontSize: 24, marginBottom: 8 }]} />
      <Segmented<'SAR' | 'USD'>
        value={d.currency}
        options={[
          { value: 'SAR', label: t('SAR (riyal)') },
          { value: 'USD', label: t('USD (dollar)') },
        ]}
        onChange={(v) => set({ currency: v })}
      />
      <Label>{t('Category')}</Label>
      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        {EXPENSE_CATEGORIES.map(([k]) => (
          <Chip key={k} title={t(k)} on={d.category === k} onPress={() => set({ category: k })} />
        ))}
      </Row>
      <Field label={t('Date')} value={d.day} onChangeText={(v) => set({ day: v.replace(/[^\d-]/g, '').slice(0, 10) })} placeholder="2026-10-11" ltr keyboardType="numbers-and-punctuation" />
      <Label>{t('Did you buy it?')}</Label>
      <Segmented<'yes' | 'no'>
        value={d.bought ? 'yes' : 'no'}
        options={[
          { value: 'yes', label: t('Bought') },
          { value: 'no', label: t('Not bought yet') },
        ]}
        onChange={(v) => set({ bought: v === 'yes' })}
      />
      <Label>{t(d.bought ? 'Who paid?' : 'Who will buy it?')}</Label>
      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        {partners.map((p) => (
          <Chip key={p.id} title={p.name} on={d.paid_by === p.id} onPress={() => set({ paid_by: p.id })} />
        ))}
      </Row>
      <Label>{t('How do you split it?')}</Label>
      <Segmented<Draft['split']>
        value={d.split}
        options={[
          { value: 'equal', label: t('Equally') },
          { value: 'custom', label: t('Set amounts') },
          { value: 'one', label: t('One person') },
        ]}
        onChange={(v) => set({ split: v, people: v === 'one' ? d.people.slice(0, 1).length ? d.people.slice(0, 1) : partners.slice(0, 1).map((p) => p.id) : d.people })}
      />
      <Text variant="xs" weight={700} color="sec" style={{ marginTop: 12, marginHorizontal: 4 }}>
        {t(d.split === 'one' ? 'Who pays all of it?' : 'Who shares the cost?')}
      </Text>
      <Row gap={8} style={{ flexWrap: 'wrap', marginTop: 6 }}>
        {partners.map((p) => {
          const on = d.people.includes(p.id);
          return (
            <Chip
              key={p.id}
              title={p.name}
              on={on}
              onPress={() => set({ people: d.split === 'one' ? [p.id] : on ? d.people.filter((x) => x !== p.id) : partners.map((x) => x.id).filter((x) => x === p.id || d.people.includes(x)) })}
            />
          );
        })}
      </Row>
      <Card style={{ marginTop: 12 }}>
        {withSettled.map((s, i) => (
          <Row key={s.partner_id} gap={10} style={{ marginTop: i ? 12 : 0 }}>
            <Text weight={700} style={{ flex: 1 }}>
              {name(s.partner_id)}
            </Text>
            {d.split === 'custom' ? (
              <TextInput value={d.custom[s.partner_id] ?? ''} onChangeText={(v) => set({ custom: { ...d.custom, [s.partner_id]: v.replace(/[^\d.٠-٩]/g, '') } })} inputMode="decimal" placeholder="0" placeholderTextColor={c.sec} style={[box, { width: 100 }]} />
            ) : (
              <Text num>{sar(s.amount)}</Text>
            )}
            <Text variant="small" color="sec">
              {t(d.currency)}
            </Text>
            {d.bought ? (
              s.partner_id === d.paid_by ? (
                <Text variant="xs" weight={700} color="sec" style={{ width: 82, textAlign: 'right' }}>
                  {t('Paid it')}
                </Text>
              ) : (
                <View style={{ width: 82, alignItems: 'flex-end' }}>
                  <Toggle value={s.settled} label={t('Paid back')} onChange={(v) => set({ settled: { ...d.settled, [s.partner_id]: v } })} />
                </View>
              )
            ) : null}
          </Row>
        ))}
        {d.split === 'custom' ? (
          <Text variant="xs" weight={700} style={{ marginTop: 10, color: Math.abs(left) > 0.009 ? c.down : c.up }}>
            {Math.abs(left) > 0.009 ? t('{n} left to split', { n: sar(left) }) : t('Adds up')}
          </Text>
        ) : null}
        {d.bought ? (
          <Text variant="xs" color="sec" style={{ marginTop: 10 }}>
            {t('Turn on "Paid back" when that person has given their part to whoever paid.')}
          </Text>
        ) : null}
      </Card>
      <Field label={t('Note')} optional={t('(optional)')} value={d.note} onChangeText={(v) => set({ note: v })} placeholder={t('Invoice number, link, anything useful')} maxLength={500} multiline style={{ minHeight: 70, textAlignVertical: 'top' }} />
      <ErrorText>{err}</ErrorText>
      <Button title={t('Save')} loading={busy} style={{ marginTop: 16 }} onPress={save} />
      {d.id ? <Button kind="ghost" icon="trash" title={t('Delete purchase')} color={c.down} style={{ marginTop: 8 }} onPress={() => setConfirm(true)} /> : null}
      <Sheet open={confirm} onClose={() => setConfirm(false)}>
        <View style={{ alignItems: 'center' }}>
          <Icon name="trash" size={28} color={c.down} />
          <Text variant="h2" center style={{ marginTop: 8 }}>
            {t('Delete {n}?', { n: d.title })}
          </Text>
          <Text color="sec" center style={{ marginTop: 4 }}>
            {t('The balances will change for everyone.')}
          </Text>
        </View>
        <Button
          kind="danger"
          title={t('Delete')}
          style={{ marginTop: 16 }}
          onPress={async () => {
            setConfirm(false);
            if (d.id && (await deleteExpense(d.id))) {
              toast(t('Purchase deleted'), { icon: 'trash' });
              goBack();
            } else toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
          }}
        />
        <Button kind="ghost" title={t('Cancel')} style={{ marginTop: 8 }} onPress={() => setConfirm(false)} />
      </Sheet>
    </Screen>
  );
}
