import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Thinking } from '@/components/food/Thinking';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Avatar } from '@/components/social/Avatar';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Row } from '@/components/ui';
import { useT } from '@/i18n';
import { type CoachCard, listCoaches, requestCoach } from '@/lib/coaching';
import { fmt } from '@/lib/nutrition';
import { useSettings } from '@/theme/settings';

/** A coach's page with a request button (design: coachpage). */
export default function CoachPage() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [k, setK] = useState<{ id: string; v: CoachCard | null } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    listCoaches().then((l) => alive && setK({ id, v: l.find((x) => x.id === id) ?? null }));
    return () => {
      alive = false;
    };
  }, [id]);

  const v = k?.id === id ? k.v : undefined;
  if (v === undefined)
    return (
      <Screen title="" back>
        <Thinking message={t('Loading')} />
      </Screen>
    );
  if (!v)
    return (
      <Screen title={t('Coach')} back>
        <Card style={{ alignItems: 'center' }}>
          <Text color="sec">{t('This coach isn’t available.')}</Text>
        </Card>
      </Screen>
    );
  const name = v.name || v.username;
  return (
    <Screen title={name} back>
      <View style={{ alignItems: 'center' }}>
        <Avatar id={v.id} name={name} size={84} />
        <Text variant="h1" style={{ marginTop: 12 }}>
          {name}
        </Text>
        <Row gap={6} style={{ marginTop: 4 }}>
          <Icon name="check" size={14} color={c.up} strokeWidth={2.6} />
          <Text variant="small" weight={700} color="up">
            {t('Checked by Gymi')}
          </Text>
        </Row>
      </View>
      <Row gap={8} style={{ marginTop: 16 }}>
        {[
          [v.years != null ? t('{n} years', { n: v.years }) : '–', t('Experience')],
          [String(v.clients), t('Clients')],
          [v.price_month ? t('{n} SAR', { n: fmt(v.price_month) }) : '–', t('A month')],
        ].map(([a, b]) => (
          <View key={b} style={{ flex: 1, backgroundColor: c.card, borderRadius: 18, padding: 12, alignItems: 'center' }}>
            <Text num size={17}>
              {a}
            </Text>
            <Text variant="xs" weight={700} color="sec">
              {b}
            </Text>
          </View>
        ))}
      </Row>
      {v.bio ? (
        <Card style={{ marginTop: 12 }}>
          <Text variant="small">{v.bio}</Text>
        </Card>
      ) : null}
      {v.specialties.length ? (
        <Row gap={6} style={{ flexWrap: 'wrap', marginTop: 4, marginBottom: 12 }}>
          {v.specialties.map((s) => (
            <View key={s} style={{ backgroundColor: c.card, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Text variant="small" weight={700}>
                {t(s)}
              </Text>
            </View>
          ))}
        </Row>
      ) : null}
      {[v.gym, v.city].some(Boolean) ? (
        <Row gap={8} style={{ marginHorizontal: 4, marginBottom: 12 }}>
          <Icon name="train" size={16} color={c.sec} />
          <Text variant="small" color="sec">
            {[v.gym, v.city].filter(Boolean).join(', ')}
          </Text>
        </Row>
      ) : null}
      <Card style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
        <Icon name="info" size={18} color={c.sec} />
        <Text variant="small" color="sec" style={{ flex: 1 }}>
          {t('If you join, this coach sees your food, workouts, weight and sleep. Cycle data and health tests stay private. Payment is agreed with the coach directly for now.')}
        </Text>
      </Card>
      <Button
        icon="send"
        title={t('Ask {n} to coach me', { n: name })}
        loading={busy}
        onPress={async () => {
          setBusy(true);
          const r = await requestCoach(v.id);
          setBusy(false);
          if (r === 'ok') {
            toast(t('Request sent. {n} will reply soon.', { n: name }), { icon: 'send' });
            return router.replace('/mycoach');
          }
          toast(t(r === 'has_coach' ? 'You already have a coach. End that first.' : 'Couldn’t save. Please try again.'), { icon: 'warn' });
        }}
      />
    </Screen>
  );
}
