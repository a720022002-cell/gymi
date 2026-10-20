import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { BarChart } from '@/components/Charts';
import { Thinking } from '@/components/food/Thinking';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Card, Row, Segmented } from '@/components/ui';
import { useT } from '@/i18n';
import { type AiCosts, aiCosts, type AiCredits, aiCredits, sar, USD_SAR, useIsAdmin } from '@/lib/admin';
import { addDays, fmt, localDay } from '@/lib/nutrition';
import { useSettings } from '@/theme/settings';

type Range = 'today' | 'week' | 'month' | 'all';
const TASKS: Record<string, string> = {
  chat: 'AI coach chat',
  meal_photo: 'Meal photo',
  food_text: 'Type what you ate',
  label_photo: 'Label photo',
  machine: 'Unknown machine',
  plan: 'Training plan builder',
  report: 'Weekly report',
  blood: 'Blood test reading',
};
const usd = (v: number) => `$${v < 1 ? v.toFixed(4) : v.toFixed(2)}`;

/** What the AI costs in real money: OpenRouter balance, spend per day and per feature. */
export default function AdminAi() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const admin = useIsAdmin();
  const [range, setRange] = useState<Range>('week');
  const [d, setD] = useState<{ range: Range; costs: AiCosts | null } | null>(null);
  const [credits, setCredits] = useState<AiCredits | null | undefined>(undefined);
  const today = localDay();
  const from = range === 'today' ? today : range === 'week' ? addDays(today, -6) : range === 'month' ? addDays(today, -29) : '2020-01-01';

  useEffect(() => {
    if (!admin) return;
    let alive = true;
    aiCosts(from, today).then((costs) => alive && setD({ range, costs }));
    return () => {
      alive = false;
    };
  }, [admin, from, today, range]);
  useEffect(() => {
    if (!admin) return;
    let alive = true;
    aiCredits().then((v) => alive && setCredits(v));
    return () => {
      alive = false;
    };
  }, [admin]);

  if (!admin)
    return (
      <Screen title={t('AI costs')} back>
        <Text color="sec">{t('Only the Adro team can open this page.')}</Text>
      </Screen>
    );
  const k = d?.range === range ? d.costs : undefined;
  const left = credits?.credits != null && credits.used != null ? credits.credits - credits.used : null;
  const days = Array.from({ length: range === 'today' ? 1 : range === 'week' ? 7 : 30 }, (_, i) => addDays(today, i - (range === 'today' ? 0 : range === 'week' ? 6 : 29)));
  const byDay = new Map((k?.days ?? []).map((x) => [String(x.day), Number(x.cost)]));

  return (
    <Screen title={t('AI costs')} back>
      <Card>
        <Row gap={8}>
          <Icon name="sparkle" size={18} color={c.cobalt} />
          <Text weight={700}>{t('OpenRouter account')}</Text>
        </Row>
        {credits === undefined ? (
          <Text color="sec" style={{ marginTop: 8 }}>
            {t('Loading')}
          </Text>
        ) : !credits?.connected ? (
          <Text color="sec" style={{ marginTop: 8 }}>
            {t('Couldn’t reach OpenRouter. Check that the OpenRouter key is set in Supabase.')}
          </Text>
        ) : (
          <>
            <Row gap={8} style={{ marginTop: 10 }}>
              {(
                [
                  ['Balance left', left],
                  ['Used in total', credits.used ?? credits.key_usage ?? null],
                ] as const
              ).map(([l, v]) => (
                <View key={l} style={{ flex: 1, backgroundColor: c.inset, borderRadius: 14, padding: 10 }}>
                  <Text num size={20}>
                    {v == null ? '—' : usd(v)}
                  </Text>
                  <Text variant="xs" color="sec">
                    {v == null ? '' : `${sar(v * USD_SAR)} ${t('SAR')}`}
                  </Text>
                  <Text variant="xs" weight={700} color="sec">
                    {t(l)}
                  </Text>
                </View>
              ))}
            </Row>
            {credits.model ? (
              <Text variant="xs" color="sec" style={{ marginTop: 8 }}>
                {t('Model: {m}', { m: credits.model })}
              </Text>
            ) : null}
          </>
        )}
      </Card>
      <Segmented<Range>
        value={range}
        options={[
          { value: 'today', label: t('Today') },
          { value: 'week', label: t('7 days') },
          { value: 'month', label: t('30 days') },
          { value: 'all', label: t('All') },
        ]}
        onChange={setRange}
      />
      <View style={{ height: 12 }} />
      {k === undefined ? (
        <Thinking message={t('Loading')} />
      ) : !k ? (
        <Card>
          <Text color="sec">{t('Couldn’t load. Please try again.')}</Text>
        </Card>
      ) : (
        <>
          <Card>
            <Text variant="xs" weight={700} color="sec">
              {t('Spent on AI')}
            </Text>
            <Text num size={32}>
              {usd(Number(k.total.cost))}
            </Text>
            <Text variant="small" color="sec">{`${sar(Number(k.total.cost) * USD_SAR)} ${t('SAR')}`}</Text>
            <Row gap={8} style={{ marginTop: 12, flexWrap: 'wrap' }}>
              {(
                [
                  ['Requests', fmt(Number(k.total.calls))],
                  ['Tokens', fmt(Number(k.total.prompt) + Number(k.total.completion))],
                  ['Per request', k.total.calls ? usd(Number(k.total.cost) / Number(k.total.calls)) : '—'],
                  ['People', fmt(Number(k.total.users))],
                  ['Failed', fmt(Number(k.total.errors))],
                ] as const
              ).map(([l, v]) => (
                <View key={l} style={{ minWidth: '30%', flexGrow: 1, backgroundColor: c.inset, borderRadius: 14, padding: 10 }}>
                  <Text num size={16}>
                    {v}
                  </Text>
                  <Text variant="xs" weight={700} color="sec">
                    {t(l)}
                  </Text>
                </View>
              ))}
            </Row>
          </Card>
          {range !== 'today' && range !== 'all' ? (
            <Card>
              <Text weight={700} style={{ marginBottom: 10 }}>
                {t('Cost per day (US cents)')}
              </Text>
              <BarChart values={days.map((x) => Math.round((byDay.get(x) ?? 0) * 10000) / 100)} labels={days.map((x, i) => (range === 'week' || i % 5 === 0 ? String(Number(x.slice(8))) : ''))} highlight={days.length - 1} />
            </Card>
          ) : null}
          <Text variant="small" weight={700} color="sec" style={{ marginTop: 8, marginBottom: 8, marginHorizontal: 4 }}>
            {t('By feature')}
          </Text>
          <Card>
            {k.tasks.length ? (
              k.tasks.map((x, i) => (
                <Row key={x.task} style={{ marginTop: i ? 12 : 0, justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text variant="small" weight={700}>
                      {t(TASKS[x.task] ?? x.task)}
                    </Text>
                    <Text variant="xs" color="sec">
                      {t('{n} requests · {k} tokens', { n: fmt(Number(x.calls)), k: fmt(Number(x.tokens)) })}
                    </Text>
                  </View>
                  <Text num>{usd(Number(x.cost))}</Text>
                </Row>
              ))
            ) : (
              <Text color="sec">{t('No AI requests in this period.')}</Text>
            )}
          </Card>
          {k.errors.length ? (
            <>
              <Text variant="small" weight={700} color="sec" style={{ marginTop: 8, marginBottom: 8, marginHorizontal: 4 }}>
                {t('Recent failed requests')}
              </Text>
              <Card>
                {k.errors.map((x, i) => (
                  <View key={`${x.at}-${i}`} style={{ marginTop: i ? 10 : 0 }}>
                    <Text variant="small" weight={700}>{`${t(TASKS[x.task] ?? x.task)} · ${new Date(x.at).toLocaleString()}`}</Text>
                    <Text variant="xs" color="sec" numberOfLines={2}>
                      {x.error ?? ''}
                    </Text>
                  </View>
                ))}
              </Card>
            </>
          ) : null}
          <Text variant="xs" color="sec" style={{ marginHorizontal: 4 }}>
            {t('Costs are recorded per request from today. The OpenRouter balance shows everything, including older use.')}
          </Text>
        </>
      )}
    </Screen>
  );
}
