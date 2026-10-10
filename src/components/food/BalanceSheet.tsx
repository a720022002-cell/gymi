import { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';

import { useT } from '@/i18n';
import { useFood } from '@/lib/food';
import { addDays, fmt } from '@/lib/nutrition';
import { useSettings } from '@/theme/settings';

import { Icon } from '../Icon';
import { Sheet } from '../Sheet';
import { fontFor, Text } from '../Text';
import { useToast } from '../Toast';
import { Button, Chip, Label, Segmented, Springy } from '../ui';

/** Over or under today's calories: move them to other days, or have a free meal. Design: SH.balance. */
export function BalanceSheet() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const food = useFood();
  const kind = food.balance;
  const under = kind === 'under';
  const amt = Math.max(0, Math.round(under ? food.kcalLeft : -food.kcalLeft));
  const days = useMemo(() => [1, 2, 3, 4].map((n) => addDays(food.today, n)), [food.today]);
  const dayName = (d: string) => {
    const [y, m, dd] = d.split('-').map(Number);
    return new Intl.DateTimeFormat(lang === 'ar' ? 'ar' : 'en-US', { weekday: 'short' }).format(new Date(y, m - 1, dd));
  };
  const [mode, setMode] = useState<'tomorrow' | 'split'>('tomorrow');
  const [picked, setPicked] = useState<string[]>([]);
  const [split, setSplit] = useState<'even' | 'custom'>('even');
  const [custom, setCustom] = useState<Record<string, number>>({});
  const [freeAsk, setFreeAsk] = useState(false);
  const sel = picked.length ? picked : days.slice(0, 2);
  const sign = under ? 1 : -1;

  const even = (n: number, ds: string[]) => {
    const base = Math.floor(n / ds.length / 10) * 10;
    const r: Record<string, number> = {};
    ds.forEach((d) => (r[d] = base));
    r[ds[0]] += n - base * ds.length;
    return r;
  };
  const alloc: Record<string, number> = mode === 'tomorrow' ? { [days[0]]: amt } : split === 'even' ? even(amt, sel) : Object.fromEntries(sel.map((d) => [d, custom[d] ?? even(amt, sel)[d]]));
  const left = amt - Object.values(alloc).reduce((a, b) => a + (b || 0), 0);
  const heavy = Object.values(alloc).some((v) => v > 500);
  const proteinLeft = Math.max(0, Math.round(food.target.p - food.eaten.p));

  const close = () => {
    food.openBalance(null);
    setFreeAsk(false);
  };

  const confirm = async () => {
    if (left !== 0) return;
    const rows = Object.entries(alloc)
      .filter(([, v]) => v > 0)
      .map(([day, v]) => ({ day, kcal: sign * v }));
    const added = await food.addMoves(rows);
    close();
    toast(rows.map((r) => `${dayName(r.day)} ${r.kcal > 0 ? '+' : '−'}${fmt(Math.abs(r.kcal))}`).join(', ') + ` ${t('kcal')}`, {
      icon: 'cal',
      undo: () => food.removeMoves(added.map((a) => a.id)),
    });
  };

  return (
    <Sheet open={!!kind && amt > 0} onClose={close}>
      {freeAsk ? (
        <View>
          <View style={{ alignItems: 'center' }}>
            <Icon name="warn" size={30} color={c.down} />
            <Text variant="h2" center style={{ marginTop: 8 }}>
              {t('Your protein isn’t done')}
            </Text>
            <Text variant="small" color="sec" center style={{ marginTop: 4 }}>
              {t('You still need {n} g of protein today. Protein helps you keep muscle, so try to fit some into your free meal.', { n: proteinLeft })}
            </Text>
          </View>
          <Button
            title={t('Have it anyway')}
            style={{ marginTop: 16 }}
            onPress={() => {
              close();
              toast(t('Enjoy it. Anything up to {n} kcal fits today.', { n: fmt(amt) }), { ai: true });
            }}
          />
          <Button title={t('Cancel')} kind="ghost" style={{ marginTop: 8 }} onPress={() => setFreeAsk(false)} />
        </View>
      ) : (
        <View>
          <View style={{ alignItems: 'center' }}>
            <Icon name="info" size={30} color={c.cobalt} />
            <Text variant="h2" center style={{ marginTop: 8 }}>
              {under ? t('You have {n} kcal left today', { n: fmt(amt) }) : t('You’re {n} kcal over today', { n: fmt(amt) })}
            </Text>
            <Text variant="small" color="sec" center style={{ marginTop: 4 }}>
              {t(under ? 'Add them to other days this week, or enjoy a free meal.' : 'Take it from other days this week. One day won’t undo your progress.')}
            </Text>
          </View>
          <View style={{ marginTop: 16 }}>
            <Segmented
              value={mode}
              options={[
                { value: 'tomorrow', label: t('Tomorrow only') },
                { value: 'split', label: t('Split across days') },
              ]}
              onChange={setMode}
            />
          </View>
          {mode === 'split' ? (
            <View>
              <Label>{t('Which days?')}</Label>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {days.map((d) => (
                  <View key={d} style={{ flex: 1 }}>
                    <Chip
                      title={dayName(d)}
                      on={sel.includes(d)}
                      onPress={() => {
                        if (sel.includes(d)) {
                          if (sel.length === 1) return toast(t('Pick at least one day'), { icon: 'info' });
                          setPicked(sel.filter((x) => x !== d));
                        } else setPicked(days.filter((x) => x === d || sel.includes(x)));
                        setCustom({});
                      }}
                    />
                  </View>
                ))}
              </View>
              <Label>{t('How to split')}</Label>
              <Segmented
                value={split}
                options={[
                  { value: 'even', label: t('Evenly') },
                  { value: 'custom', label: t('I’ll choose') },
                ]}
                onChange={setSplit}
              />
            </View>
          ) : null}
          <View style={{ marginTop: 12, backgroundColor: 'rgba(127,127,135,0.1)', borderRadius: 22, overflow: 'hidden' }}>
            {Object.entries(alloc).map(([d, v], i) => {
              const g = food.dayGoal(d);
              return (
                <View key={d} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 60, paddingHorizontal: 16, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
                  <View style={{ flex: 1 }}>
                    <Text weight={700}>
                      {dayName(d)}
                      {d === days[0] ? <Text variant="small" color="sec">{` (${t('tomorrow')})`}</Text> : null}
                    </Text>
                    <Text variant="xs" color="sec">
                      {t('Goal {a} → {b} kcal', { a: fmt(g), b: fmt(g + sign * (v || 0)) })}
                    </Text>
                  </View>
                  {mode === 'split' && split === 'custom' ? (
                    <TextInput
                      value={String(v)}
                      onChangeText={(x) => setCustom({ ...Object.fromEntries(sel.map((k) => [k, alloc[k]])), [d]: Math.max(0, +x.replace(/[^\d]/g, '') || 0) })}
                      inputMode="numeric"
                      keyboardType="number-pad"
                      style={{ width: 80, height: 44, borderRadius: 12, backgroundColor: 'rgba(127,127,135,0.12)', textAlign: 'center', fontFamily: fontFor('sora', 600), fontSize: 16, color: c.text, outlineStyle: 'none' } as object}
                    />
                  ) : (
                    <Text num color={under ? 'cobalt' : 'text'}>{`${under ? '+' : '−'}${fmt(v)}`}</Text>
                  )}
                </View>
              );
            })}
          </View>
          {mode === 'split' && split === 'custom' ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6, marginTop: 8 }}>
              <Text variant="small" weight={700} color="sec">
                {t('Still to place')}
              </Text>
              <Text variant="small" weight={700} num color={left === 0 ? 'up' : 'down'}>
                {left === 0 ? t('All placed') : `${left > 0 ? '' : '−'}${fmt(Math.abs(left))} ${t('kcal')}`}
              </Text>
            </View>
          ) : null}
          {heavy && !under ? (
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, alignItems: 'flex-start' }}>
              <Icon name="info" size={16} color={c.sec} />
              <Text variant="small" color="sec" style={{ flex: 1 }}>
                {t('Taking more than 500 kcal from one day can leave you very hungry. Splitting it is easier.')}
              </Text>
            </View>
          ) : null}
          <Button
            title={left !== 0 ? (left > 0 ? t('Place {n} more kcal', { n: fmt(left) }) : t('{n} kcal too many', { n: fmt(-left) })) : under ? t('Add {n} kcal to other days', { n: fmt(amt) }) : t('Take {n} kcal from other days', { n: fmt(amt) })}
            disabled={left !== 0}
            style={{ marginTop: 16 }}
            onPress={confirm}
          />
          {under ? (
            <View>
              <Button
                title={t('Have a free meal')}
                kind="cobalt"
                style={{ marginTop: 8 }}
                onPress={() => {
                  if (proteinLeft > 0) return setFreeAsk(true);
                  close();
                  toast(t('Enjoy it. Anything up to {n} kcal fits today.', { n: fmt(amt) }), { ai: true });
                }}
              />
              {proteinLeft > 0 ? (
                <Text variant="small" color="sec" center style={{ marginTop: 8 }}>
                  {t('Your protein isn’t done yet:')} <Text variant="small" weight={700}>{t('{n} g left.', { n: proteinLeft })}</Text>
                </Text>
              ) : null}
            </View>
          ) : null}
          <Springy onPress={close} style={{ alignSelf: 'center', marginTop: 12, padding: 8 }}>
            <Text weight={700} color="sec">
              {t('Not now')}
            </Text>
          </Springy>
        </View>
      )}
    </Sheet>
  );
}
