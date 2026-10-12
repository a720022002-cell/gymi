import { getCalendars, getLocales } from 'expo-localization';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { useFood } from '@/lib/food';
import { addDays, localDay } from '@/lib/nutrition';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/theme/settings';

import { Glass } from './Glass';
import { Icon } from './Icon';
import { Ring } from './Ring';
import { Sheet } from './Sheet';
import { Text } from './Text';
import { Button, Row, Springy } from './ui';

const fmtDay = (day: string, lang: 'en' | 'ar', o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en-US', o).format(new Date(`${day}T12:00:00`));

/** The day a week starts on (0 = Sunday): Sunday in Arabic, otherwise what the phone's region uses (Sunday if it doesn't say). */
export function firstWeekday(lang: 'en' | 'ar') {
  if (lang === 'ar') return 0;
  const fw = getCalendars()[0]?.firstWeekday;
  if (fw) return (fw - 1) % 7;
  // Some browsers only have the newer getWeekInfo() (Monday = 1 … Sunday = 7).
  try {
    const tag = getLocales()[0]?.languageTag;
    const loc = tag ? (new Intl.Locale(tag) as Intl.Locale & { getWeekInfo?: () => { firstDay: number }; weekInfo?: { firstDay: number } }) : null;
    const d = loc?.getWeekInfo?.().firstDay ?? loc?.weekInfo?.firstDay;
    if (d) return d % 7;
  } catch {}
  return 0;
}

/** The first day of the week that holds `day`. */
const startOfWeek = (day: string, first: number) => addDays(day, -((new Date(`${day}T12:00:00`).getDay() - first + 7) % 7));

/** One week, always in the same order (Sunday first in Arabic): tap a day, ‹ › for the week before or after, the month for the calendar.
 * Each day has a small ring for how much of that day's calories you ate. Logs, water and cardio follow the day you pick. */
export function DayNav() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const food = useFood();
  const [cal, setCal] = useState(false);
  // The week holding the picked day, in a fixed order; days still to come are shown faded.
  const start = startOfWeek(food.day, firstWeekday(lang));
  const end = addDays(start, 6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const lastWeek = end >= food.today;
  const [eaten, setEaten] = useState<{ start: string; kcal: Record<string, number> } | null>(null);
  const count = food.logs.length;

  useEffect(() => {
    let alive = true;
    supabase
      .from('food_logs')
      .select('day,kcal')
      .gte('day', start)
      .lte('day', end)
      .then(({ data }) => {
        if (!alive) return;
        const kcal: Record<string, number> = {};
        for (const x of (data ?? []) as { day: string; kcal: number }[]) kcal[x.day] = (kcal[x.day] ?? 0) + +x.kcal;
        setEaten({ start, kcal });
      });
    return () => {
      alive = false;
    };
  }, [start, end, count]);

  // Same weekday in the week before or after (never past today).
  const week = (n: number) => {
    const d = addDays(food.day, n * 7);
    food.setDay(d > food.today ? food.today : d);
  };
  const chevron = (n: -1 | 1) => (
    <Springy
      disabled={n === 1 && lastWeek}
      onPress={() => week(n)}
      scaleTo={0.85}
      accessibilityLabel={t(n === -1 ? 'Week before' : 'Next week')}
      style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', opacity: n === 1 && lastWeek ? 0.25 : 1 }}>
      <Icon name={n === -1 ? 'back' : 'chev'} size={17} color={c.sec} strokeWidth={2.4} />
    </Springy>
  );

  return (
    <View style={{ marginBottom: 14, backgroundColor: c.card, borderRadius: 22, paddingTop: 8, paddingBottom: 10, paddingHorizontal: 6 }}>
      <Row style={{ justifyContent: 'space-between', paddingHorizontal: 4 }}>
        <Springy onPress={() => setCal(true)} scaleTo={0.97} accessibilityLabel={t('Pick a day')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 6 }}>
          <Text weight={700}>{fmtDay(food.day, lang, { month: 'long', year: 'numeric' })}</Text>
          <Icon name="chevd" size={15} color={c.sec} strokeWidth={2.4} />
        </Springy>
        <Row gap={2}>
          {!food.isToday ? (
            <Springy onPress={() => food.setDay(food.today)} style={{ paddingHorizontal: 10, height: 28, borderRadius: 14, justifyContent: 'center', backgroundColor: 'rgba(51,85,255,0.14)', marginEnd: 4 }}>
              <Text variant="xs" weight={700} style={{ color: c.cobalt }}>
                {t('Today')}
              </Text>
            </Springy>
          ) : null}
          {chevron(-1)}
          {chevron(1)}
        </Row>
      </Row>
      <View style={{ flexDirection: 'row', marginTop: 4, marginBottom: 2 }}>
        {days.map((d) => {
          const sel = d === food.day;
          const today = d === food.today;
          const future = d > food.today;
          const k = eaten?.start === start ? (eaten.kcal[d] ?? 0) : 0;
          const goal = food.dayGoal(d);
          const closed = goal > 0 && k >= goal * 0.95 && k <= goal * 1.1;
          return (
            <Springy
              key={d}
              disabled={future}
              onPress={() => food.setDay(d)}
              scaleTo={0.9}
              accessibilityLabel={fmtDay(d, lang, { weekday: 'long', month: 'long', day: 'numeric' })}
              accessibilityState={{ selected: sel }}
              style={{ flex: 1, alignItems: 'center', gap: 4, opacity: future ? 0.3 : 1 }}>
              <Text variant="xs" weight={700} color={sel || today ? undefined : 'sec'} style={today && !sel ? { color: c.cobalt } : undefined}>
                {fmtDay(d, lang, { weekday: lang === 'ar' ? 'short' : 'narrow' })}
              </Text>
              {future ? (
                <View style={{ width: 42, height: 42, alignItems: 'center', justifyContent: 'center' }}>
                  <Text num size={15} weight={600}>
                    {Number(d.slice(8))}
                  </Text>
                </View>
              ) : (
                <Ring value={k} max={goal} size={42} stroke={3} color={closed ? '#22C55E' : c.cobalt}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: sel ? (today ? c.cobalt : c.text) : 'transparent' }}>
                    <Text num size={15} weight={sel || today ? 800 : 600} style={{ color: sel ? (today ? '#FFFFFF' : c.bg) : today ? c.cobalt : c.text }}>
                      {Number(d.slice(8))}
                    </Text>
                  </View>
                </Ring>
              )}
            </Springy>
          );
        })}
      </View>
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
  const first0 = firstWeekday(lang);
  const lead = (new Date(y, m - 1, 1).getDay() - first0 + 7) % 7;
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
  const weekdays = Array.from({ length: 7 }, (_, i) => fmtDay(addDays('2026-10-04', i + first0), lang, { weekday: 'narrow' }));
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
