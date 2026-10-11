import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { useFood } from '@/lib/food';
import { addDays, localDay } from '@/lib/nutrition';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/theme/settings';

import { Glass } from './Glass';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { Text } from './Text';
import { Button, Row, Springy } from './ui';

const fmtDay = (day: string, lang: 'en' | 'ar', o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en-US', o).format(new Date(`${day}T12:00:00`));

/** "Today", "Yesterday", or the date. */
export function useDayLabel() {
  const { t, lang } = useT();
  const food = useFood();
  return (day: string, long = false) =>
    day === food.today ? t('Today') : day === addDays(food.today, -1) ? t('Yesterday') : fmtDay(day, lang, long ? { weekday: 'long', month: 'short', day: 'numeric' } : { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Go back and forward one day, or tap the date for the calendar. Logs, water and cardio follow the day you pick. */
export function DayNav() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const food = useFood();
  const label = useDayLabel();
  const [cal, setCal] = useState(false);
  const arrow = (dir: -1 | 1) => {
    const off = dir === 1 && food.isToday;
    return (
      <Springy
        disabled={off}
        onPress={() => food.setDay(addDays(food.day, dir))}
        scaleTo={0.9}
        accessibilityLabel={t(dir === -1 ? 'Day before' : 'Next day')}
        style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.card, opacity: off ? 0.35 : 1 }}>
        <Icon name={dir === -1 ? 'back' : 'chev'} size={20} strokeWidth={2.2} />
      </Springy>
    );
  };
  return (
    <View style={{ marginBottom: 14 }}>
      <Row gap={8}>
        {arrow(-1)}
        <Springy
          onPress={() => setCal(true)}
          scaleTo={0.98}
          accessibilityLabel={t('Pick a day')}
          style={{ flex: 1, height: 44, borderRadius: 22, backgroundColor: c.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Icon name="cal" size={18} color={c.cobalt} />
          <Text weight={700}>{label(food.day, true)}</Text>
        </Springy>
        {arrow(1)}
      </Row>
      {!food.isToday ? (
        <Springy onPress={() => food.setDay(food.today)} style={{ alignSelf: 'center', marginTop: 8, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14, backgroundColor: 'rgba(51,85,255,0.14)' }}>
          <Text variant="small" weight={700} style={{ color: c.cobalt }}>
            {t('Back to today')}
          </Text>
        </Springy>
      ) : null}
      <CalendarSheet key={food.day} open={cal} onClose={() => setCal(false)} />
    </View>
  );
}

/** The calendar button for the top bar. */
export function CalendarButton() {
  const { t } = useT();
  const food = useFood();
  const [cal, setCal] = useState(false);
  return (
    <>
      <Springy onPress={() => setCal(true)} scaleTo={1.08} accessibilityLabel={t('Pick a day')}>
        <Glass style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="cal" />
        </Glass>
      </Springy>
      <CalendarSheet key={food.day} open={cal} onClose={() => setCal(false)} />
    </>
  );
}

/** A month to pick a day from. Days with food logged have a dot; future days can't be picked. */
export function CalendarSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const food = useFood();
  const [month, setMonth] = useState(() => food.day.slice(0, 7));
  const [logged, setLogged] = useState<{ month: string; days: Set<string> } | null>(null);
  const first = `${month}-01`;
  const [y, m] = month.split('-').map(Number);
  const daysIn = new Date(y, m, 0).getDate();
  const lead = new Date(y, m - 1, 1).getDay();
  const last = `${month}-${String(daysIn).padStart(2, '0')}`;
  const thisMonth = food.today.slice(0, 7);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    supabase
      .from('food_logs')
      .select('day')
      .gte('day', first)
      .lte('day', last)
      .then(({ data }) => alive && setLogged({ month, days: new Set((data ?? []).map((x: { day: string }) => x.day)) }));
    return () => {
      alive = false;
    };
  }, [open, month, first, last]);

  const shift = (n: number) => setMonth(localDay(new Date(y, m - 1 + n, 1)).slice(0, 7));
  const pick = (d: string) => {
    food.setDay(d);
    onClose();
  };
  const weekdays = Array.from({ length: 7 }, (_, i) => fmtDay(addDays('2026-10-04', i), lang, { weekday: 'narrow' }));
  const cells = [...Array.from({ length: lead }, () => null), ...Array.from({ length: daysIn }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)];

  return (
    <Sheet open={open} onClose={onClose}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Springy onPress={() => shift(-1)} accessibilityLabel={t('Month before')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="back" size={20} strokeWidth={2.2} />
        </Springy>
        <Text variant="h3">{fmtDay(first, lang, { month: 'long', year: 'numeric' })}</Text>
        <Springy
          disabled={month >= thisMonth}
          onPress={() => shift(1)}
          accessibilityLabel={t('Next month')}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: month >= thisMonth ? 0.3 : 1 }}>
          <Icon name="chev" size={20} strokeWidth={2.2} />
        </Springy>
      </Row>
      <View style={{ flexDirection: 'row', marginTop: 8 }}>
        {weekdays.map((w, i) => (
          <Text key={i} variant="xs" weight={700} color="sec" center style={{ width: `${100 / 7}%` }}>
            {w}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
        {cells.map((d, i) => {
          if (!d) return <View key={`e${i}`} style={{ width: `${100 / 7}%`, height: 48 }} />;
          const future = d > food.today;
          const sel = d === food.day;
          const has = logged?.month === month && logged.days.has(d);
          return (
            <View key={d} style={{ width: `${100 / 7}%`, height: 48, alignItems: 'center', justifyContent: 'center' }}>
              <Springy
                disabled={future}
                onPress={() => pick(d)}
                scaleTo={0.9}
                accessibilityLabel={fmtDay(d, lang, { weekday: 'long', month: 'long', day: 'numeric' })}
                style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: sel ? c.cobalt : 'transparent', borderWidth: d === food.today && !sel ? 1.5 : 0, borderColor: c.cobalt, opacity: future ? 0.3 : 1 }}>
                <Text num size={15} weight={sel ? 800 : 600} style={sel ? { color: '#FFFFFF' } : undefined}>
                  {Number(d.slice(8))}
                </Text>
                {has ? <View style={{ position: 'absolute', bottom: 5, width: 4, height: 4, borderRadius: 2, backgroundColor: sel ? '#FFFFFF' : c.cobalt }} /> : null}
              </Springy>
            </View>
          );
        })}
      </View>
      <Text variant="xs" color="sec" style={{ marginTop: 6, marginHorizontal: 4 }}>
        {t('A dot means you logged food that day.')}
      </Text>
      {!food.isToday ? <Button kind="soft" title={t('Back to today')} color={c.text} style={{ marginTop: 12 }} onPress={() => pick(food.today)} /> : null}
    </Sheet>
  );
}
