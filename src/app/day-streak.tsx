import { useState } from 'react';
import { Share, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Ring } from '@/components/Ring';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Button, Card, Row } from '@/components/ui';
import { useT } from '@/i18n';
import { addDays } from '@/lib/nutrition';
import { BIG_MILESTONES, MILESTONE_NAME, MILESTONES, milestoneOf } from '@/lib/streakMilestones';
import { DAYS, weekStart } from '@/lib/training';
import { useStreaks } from '@/lib/useProgress';
import { useSettings } from '@/theme/settings';

/** Day streak: days in a row with something logged, this week, and the milestones on your journey. */
export default function DayStreak() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const s = useStreaks();
  const [all, setAll] = useState(false);
  const today = s.x.today;
  const n = s.overall;
  const m = milestoneOf(n);
  // Today doesn't break it until it's over, so the streak may end yesterday.
  const started = n ? addDays(today, s.active.has(today) ? -(n - 1) : -n) : null;
  const date = (d: string, year = false) =>
    new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en-US', { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}) }).format(new Date(`${d}T12:00:00`));
  const ws = weekStart(today);
  // The journey: everything reached, the next one, and a few more (or all of them).
  const nextIdx = m.next ? MILESTONES.indexOf(m.next as (typeof MILESTONES)[number]) : MILESTONES.length;
  const shown = all ? MILESTONES : MILESTONES.slice(0, Math.min(MILESTONES.length, nextIdx + 3));

  const tile = (icon: 'trophy' | 'cal' | 'crown', value: string, label: string) => (
    <View style={{ flex: 1, backgroundColor: c.inset, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center' }}>
      <Icon name={icon} size={18} color={c.cobalt} strokeWidth={2} />
      <Text num size={17} style={{ marginTop: 6 }} numberOfLines={1}>
        {value}
      </Text>
      <Text variant="xs" weight={700} color="sec" center>
        {label}
      </Text>
    </View>
  );

  return (
    <Screen title={t('Day streak')} back>
      {/* The ring fills up on the way to the next milestone. */}
      <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
        <Ring value={m.next ? n - m.reached : 1} max={m.next ? m.next - m.reached : 1} size={200} stroke={16} color={c.cobalt}>
          <Icon name="flame" size={26} color={c.cobalt} strokeWidth={2} />
          <Text num size={52} style={{ letterSpacing: -1.5 }}>
            {String(n)}
          </Text>
          <Text variant="xs" weight={700} color="sec">
            {t('days in a row')}
          </Text>
        </Ring>
        <View style={{ marginTop: 16, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: c.inset }}>
          <Text variant="small" weight={700} center>
            {n === 0
              ? t('Log something today to start')
              : m.next
                ? t(m.toGo === 1 ? '1 day to {name}' : '{n} days to {name}', { n: m.toGo, name: t(MILESTONE_NAME[m.next]) })
                : t('Every milestone reached')}
          </Text>
        </View>
        <Text variant="small" color="sec" center style={{ marginTop: 10, paddingHorizontal: 8 }}>
          {t('Any day you log something counts: food, a workout, water, or your check-in.')}
        </Text>
      </Card>

      <Row gap={8} style={{ marginTop: 4 }}>
        {tile('trophy', String(s.best), t('Best streak'))}
        {tile('cal', started ? date(started) : '–', t('Started'))}
        {tile('crown', `${m.unlocked}/${MILESTONES.length}`, t('Milestones'))}
      </Row>

      {/* This week: filled for each day you logged something. */}
      <Card style={{ marginTop: 12 }}>
        <Text weight={700}>{t('This week')}</Text>
        <Row style={{ justifyContent: 'space-between', marginTop: 12 }}>
          {DAYS.map((dn, i) => {
            const d = addDays(ws, i);
            const on = s.active.has(d);
            const isToday = d === today;
            return (
              <View key={dn} style={{ alignItems: 'center', gap: 6 }}>
                <View
                  style={[
                    { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
                    on ? { backgroundColor: c.cobalt } : isToday ? { borderWidth: 2.5, borderColor: c.cobalt } : d > today ? { borderWidth: 2, borderColor: c.line, borderStyle: 'dashed' } : { backgroundColor: c.inset },
                  ]}>
                  {on ? <Icon name="check" size={16} color="#FFFFFF" strokeWidth={2.6} /> : null}
                </View>
                <Text variant="xs" weight={700} color={isToday ? undefined : 'sec'}>
                  {t(dn)}
                </Text>
              </View>
            );
          })}
        </Row>
      </Card>

      {/* Your journey: one step per milestone. */}
      <Text variant="h3" style={{ marginTop: 20, marginBottom: 10, marginHorizontal: 4 }}>
        {t('Your journey')}
      </Text>
      <Card style={{ paddingVertical: 8 }}>
        {shown.map((d, i) => {
          const done = n >= d;
          const isNext = d === m.next;
          const last = i === shown.length - 1;
          return (
            <Row key={d} gap={12} style={{ alignItems: 'stretch' }}>
              {/* The path: a node, and a line down to the next one. */}
              <View style={{ width: 34, alignItems: 'center' }}>
                <View
                  style={[
                    { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
                    done ? { backgroundColor: c.cobalt } : isNext ? { borderWidth: 2.5, borderColor: c.cobalt } : { backgroundColor: c.inset },
                  ]}>
                  <Icon
                    name={done ? (BIG_MILESTONES.has(d) ? 'crown' : 'check') : isNext ? 'flame' : 'lock'}
                    size={done ? 16 : 15}
                    color={done ? '#FFFFFF' : isNext ? c.cobalt : c.sec}
                    strokeWidth={2.4}
                  />
                </View>
                {!last ? <View style={{ flex: 1, width: 2.5, minHeight: 14, marginTop: 4, borderRadius: 2, backgroundColor: done && n >= (shown[i + 1] ?? Infinity) ? c.cobalt : c.line }} /> : null}
              </View>
              <View style={{ flex: 1, paddingTop: 8, paddingBottom: last ? 8 : 14 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text weight={700} style={{ opacity: done || isNext ? 1 : 0.6 }}>
                    {t(MILESTONE_NAME[d])}
                  </Text>
                  <Text num variant="small" color="sec">
                    {t('{n} days', { n: d })}
                  </Text>
                </Row>
                {done && started && n >= d ? (
                  <Text variant="xs" color="sec">
                    {t('Reached {date}', { date: date(addDays(started, d - 1), true) })}
                  </Text>
                ) : isNext ? (
                  <View>
                    <View style={{ height: 6, borderRadius: 3, backgroundColor: c.inset, marginTop: 6, overflow: 'hidden' }}>
                      <View style={{ width: `${Math.round(m.frac * 100)}%`, height: 6, borderRadius: 3, backgroundColor: c.cobalt }} />
                    </View>
                    <Text variant="xs" color="sec" style={{ marginTop: 4 }}>
                      {t(m.toGo === 1 ? 'Tomorrow, if you log something' : 'In {n} days', { n: m.toGo })}
                    </Text>
                  </View>
                ) : (
                  <Text variant="xs" color="sec" style={{ opacity: 0.7 }}>
                    {t('Locked')}
                  </Text>
                )}
              </View>
            </Row>
          );
        })}
      </Card>
      {shown.length < MILESTONES.length ? (
        <Button small kind="ghost" title={t('Show all milestones')} color={c.text} style={{ marginTop: 6, alignSelf: 'center' }} onPress={() => setAll(true)} />
      ) : null}

      <Button
        kind="soft"
        icon="share"
        title={t('Share your streak')}
        color={c.text}
        style={{ marginTop: 14 }}
        onPress={() => Share.share({ message: t('I’m on a {n}-day streak on Adro 🔥 adroapp.com', { n }) }).catch(() => {})}
      />
    </Screen>
  );
}
