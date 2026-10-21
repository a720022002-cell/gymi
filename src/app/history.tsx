import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Button, Card, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { fmt } from '@/lib/nutrition';
import type { WorkoutLog } from '@/lib/train';
import { workoutTitle } from '@/lib/training';
import { useWeight } from '@/lib/units';
import { loadWorkoutPage } from '@/lib/workoutHistory';
import { useSettings } from '@/theme/settings';

/** Every workout you've done, newest first, by month. Tap one to see its exercises and sets. */
export default function WorkoutHistory() {
  const { t, lang } = useT();
  const W = useWeight();
  const { colors: c } = useSettings();
  const [rows, setRows] = useState<WorkoutLog[] | null>(null);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const locale = lang === 'ar' ? 'ar-u-nu-latn' : 'en-US';

  const load = useCallback(async (before?: string) => {
    setBusy(true);
    const r = await loadWorkoutPage(before);
    setBusy(false);
    if (!r) return setFailed(true);
    setFailed(false);
    setRows((old) => (before ? [...(old ?? []), ...r.rows] : r.rows));
    setMore(r.more);
  }, []);

  // The first page, as the screen opens.
  useEffect(() => {
    let live = true;
    loadWorkoutPage().then((r) => {
      if (!live) return;
      if (!r) return setFailed(true);
      setRows(r.rows);
      setMore(r.more);
    });
    return () => {
      live = false;
    };
  }, []);

  const month = (day: string) => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(`${day}T12:00:00`));
  const date = (day: string) => new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(`${day}T12:00:00`));

  if (rows == null)
    return (
      <Screen title={t('Workout history')} back>
        {failed ? (
          <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
            <Text color="sec" center>
              {t('You’re offline. Check your connection and try again.')}
            </Text>
            <Button title={t('Try again')} style={{ marginTop: 14, alignSelf: 'stretch' }} onPress={() => load()} />
          </Card>
        ) : (
          <ActivityIndicator color={c.cobalt} style={{ marginTop: 40 }} />
        )}
      </Screen>
    );

  if (!rows.length)
    return (
      <Screen title={t('Workout history')} back>
        <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
          <Icon name="train" size={30} color={c.cobalt} />
          <Text weight={700} center style={{ marginTop: 10 }}>
            {t('No workouts yet')}
          </Text>
          <Text variant="small" color="sec" center style={{ marginTop: 4 }}>
            {t('Your workouts will show here with every set you did.')}
          </Text>
          <Button title={t('Open Train')} style={{ marginTop: 14, alignSelf: 'stretch' }} onPress={() => router.replace('/train')} />
        </Card>
      </Screen>
    );

  // Month headers between the rows. Rows come in the order they were started, and a workout can count for an earlier
  // day, so each month is one group (never twice), newest day first.
  const groups: { m: string; items: WorkoutLog[] }[] = [];
  for (const w of rows) {
    const m = month(w.day);
    const g = groups.find((x) => x.m === m) ?? (groups.push({ m, items: [] }), groups[groups.length - 1]);
    g.items.push(w);
  }
  for (const g of groups) g.items.sort((a, b) => b.day.localeCompare(a.day) || b.started_at.localeCompare(a.started_at));

  return (
    <Screen title={t('Workout history')} back>
      {groups.map((g) => (
        <View key={g.m} style={{ marginBottom: 6 }}>
          <Text variant="small" weight={700} color="sec" style={{ marginTop: 10, marginBottom: 8, marginHorizontal: 4 }}>
            {g.m} · {t('{n} workouts', { n: g.items.length })}
          </Text>
          <View style={{ backgroundColor: c.card, borderRadius: 22, overflow: 'hidden' }}>
            {g.items.map((w, i) => (
              <Springy
                key={w.id}
                onPress={() => router.push({ pathname: '/workout-log', params: { id: w.id } })}
                scaleTo={0.99}
                accessibilityLabel={`${workoutTitle(w.name, t)}, ${date(w.day)}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 70, paddingVertical: 12, paddingHorizontal: 16, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
                <View style={{ width: 44, alignItems: 'center' }}>
                  <Text num size={20}>
                    {Number(w.day.slice(8))}
                  </Text>
                  <Text variant="xs" color="sec">
                    {new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(`${w.day}T12:00:00`))}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text weight={700} numberOfLines={1}>
                    {workoutTitle(w.name, t)}
                  </Text>
                  <Text variant="small" color="sec" numberOfLines={1}>
                    {[t('{n} min', { n: w.minutes }), `${fmt(W.num(w.volume))} ${W.label}`, t('{n} sets', { n: w.sets_done })].join(' · ')}
                  </Text>
                </View>
                {w.prs.length ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <Icon name="trophy" size={16} color={c.cobalt} />
                    <Text variant="xs" weight={700} style={{ color: c.cobalt }}>
                      {w.prs.length}
                    </Text>
                  </View>
                ) : null}
                <Icon name="chev" size={18} color={c.sec} />
              </Springy>
            ))}
          </View>
        </View>
      ))}
      {more ? <Button kind="glass" title={t('Show older workouts')} loading={busy} style={{ marginTop: 10 }} onPress={() => load(rows.at(-1)?.started_at)} /> : null}
      {failed && rows.length ? (
        <Text variant="small" color="sec" center style={{ marginTop: 8 }}>
          {t('Couldn’t load more. Please try again.')}
        </Text>
      ) : null}
    </Screen>
  );
}
