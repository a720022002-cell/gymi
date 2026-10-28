import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useT } from '@/i18n';
import { type AiError, aiErrorText, askAI } from '@/lib/ai';
import { useSettings } from '@/theme/settings';

import { Icon } from '../Icon';
import { Text } from '../Text';
import { Button, Card, Row } from '../ui';

type Insight = { summary: string; points: string[]; tip: string };

/**
 * The coach's analysis of one reading over its last 30 days. Asked once and kept until the numbers change
 * (counted readings like steps only when a past day changes, so walking today doesn't ask again).
 */
export function ReadingInsight({
  id,
  day,
  data,
  ready,
  task = 'reading_insight',
}: {
  id: string;
  day: string;
  /** For a reading: its 30 days (`series`). For measurements (task measure_insight): the request itself. */
  data: Record<string, unknown> & { series?: (number | null)[]; counted?: boolean; liveToday?: boolean };
  ready: boolean;
  task?: 'reading_insight' | 'measure_insight';
}) {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const [v, setV] = useState<Insight | null>(null);
  const [err, setErr] = useState<AiError | null>(null);
  const [busy, setBusy] = useState(false);
  const key = `ai-reading:${id}:${lang}`;
  // Today's number left out when it moves all day (counted readings, the live recovery score): asked again tomorrow.
  const sig = task === 'measure_insight' ? JSON.stringify(data) : `${day}|${JSON.stringify(data.counted || data.liveToday ? (data.series ?? []).slice(0, -1) : data.series)}`;

  const ask = async (alive: () => boolean) => {
    setBusy(true);
    setErr(null);
    const { result, error } = await askAI<Insight>(task, task === 'measure_insight' ? { lang, ...data } : { lang, data });
    if (!alive()) return;
    setBusy(false);
    if (error || !result?.summary) return setErr(error ?? 'failed');
    setV(result);
    AsyncStorage.setItem(key, JSON.stringify({ sig, v: result })).catch(() => {});
  };

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    (async () => {
      const saved = await AsyncStorage.getItem(key).catch(() => null);
      const s = saved ? (JSON.parse(saved) as { sig: string; v: Insight }) : null;
      if (!alive) return;
      if (s?.sig === sig) return setV(s.v);
      await ask(() => alive);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, key, sig]);

  return (
    <Card>
      <Row gap={8}>
        <Icon name="sparkle" size={20} color={c.cobalt} />
        <Text weight={700} style={{ flex: 1 }}>
          {t('Adro’s analysis')}
        </Text>
      </Row>
      {v ? (
        <View style={{ marginTop: 8, gap: 8 }}>
          <Text>{v.summary}</Text>
          {v.points.map((p) => (
            <Row key={p} gap={8} style={{ alignItems: 'flex-start' }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.cobalt, marginTop: 8 }} />
              <Text variant="small" style={{ flex: 1 }}>
                {p}
              </Text>
            </Row>
          ))}
          {v.tip ? (
            <View style={{ backgroundColor: c.inset, borderRadius: 14, padding: 10 }}>
              <Text variant="xs" weight={700} color="sec">
                {t('Try this')}
              </Text>
              <Text variant="small" weight={600} style={{ marginTop: 2 }}>
                {v.tip}
              </Text>
            </View>
          ) : null}
        </View>
      ) : err ? (
        <View style={{ marginTop: 8 }}>
          <Text variant="small" color="sec">
            {t(aiErrorText(err))}
          </Text>
          {err !== 'consent' && err !== 'ai_off' ? <Button small kind="soft" title={t('Try again')} style={{ marginTop: 8, alignSelf: 'flex-start' }} onPress={() => ask(() => true)} /> : null}
        </View>
      ) : (
        <Row gap={8} style={{ marginTop: 10 }}>
          <ActivityIndicator color={c.cobalt} />
          <Text variant="small" color="sec">
            {t(busy ? 'Reading your numbers…' : 'Getting your numbers…')}
          </Text>
        </Row>
      )}
    </Card>
  );
}
