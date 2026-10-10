import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';

import { Thinking } from '@/components/food/Thinking';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Avatar } from '@/components/social/Avatar';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Chip, ErrorText, Row } from '@/components/ui';
import { useT } from '@/i18n';
import { type CoachCard, listCoaches, redeemCode, SPECIALTIES } from '@/lib/coaching';
import { fmt } from '@/lib/nutrition';
import { useSettings } from '@/theme/settings';

/** Find a coach: approved coaches, filter by what they help with, or join with a code (design: findcoach). */
export default function FindCoach() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const [list, setList] = useState<CoachCard[] | null>(null);
  const [f, setF] = useState('All');
  const [code, setCode] = useState(false);

  useEffect(() => {
    let alive = true;
    listCoaches().then((x) => alive && setList(x));
    return () => {
      alive = false;
    };
  }, []);

  const shown = (list ?? []).filter((k) => f === 'All' || k.specialties.includes(f));
  return (
    <Screen title={t('Find a coach')} back>
      <Card onPress={() => setCode(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: c.cobalt, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="key" size={18} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text weight={700}>{t('Have a code from your coach?')}</Text>
          <Text variant="small" color="sec">
            {t('Enter it to connect')}
          </Text>
        </View>
        <Icon name="chev" size={18} color={c.sec} />
      </Card>
      <Row gap={8} style={{ flexWrap: 'wrap', marginBottom: 12 }}>
        {['All', ...SPECIALTIES].map((s) => (
          <Chip key={s} title={t(s)} on={f === s} onPress={() => setF(s)} />
        ))}
      </Row>
      {!list ? (
        <Thinking message={t('Loading')} />
      ) : shown.length ? (
        shown.map((k) => (
          <Card key={k.id} onPress={() => router.push({ pathname: '/coachpage', params: { id: k.id } })}>
            <Row>
              <Avatar id={k.id} name={k.name || k.username} size={48} />
              <View style={{ flex: 1 }}>
                <Text weight={700}>{k.name || k.username}</Text>
                <Text variant="small" color="sec" numberOfLines={1}>
                  {[k.gym, k.city].filter(Boolean).join(', ') || `@${k.username}`}
                </Text>
              </View>
              {k.price_month ? <Text variant="small" weight={700}>{t('{n} SAR/mo', { n: fmt(k.price_month) })}</Text> : null}
            </Row>
            {k.specialties.length ? (
              <Row gap={6} style={{ flexWrap: 'wrap', marginTop: 10 }}>
                {k.specialties.slice(0, 4).map((s) => (
                  <View key={s} style={{ backgroundColor: c.inset, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text variant="xs" weight={700}>
                      {t(s)}
                    </Text>
                  </View>
                ))}
              </Row>
            ) : null}
          </Card>
        ))
      ) : (
        <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
          <Icon name="coach" size={30} color={c.sec} />
          <Text variant="h3" style={{ marginTop: 8 }}>
            {t('No coaches here yet')}
          </Text>
          <Text variant="small" color="sec" center style={{ marginTop: 4 }}>
            {t('Coaches show up here after our team checks them. If you already have a coach, ask them for a code.')}
          </Text>
        </Card>
      )}
      <CodeSheet open={code} onClose={() => setCode(false)} />
    </Screen>
  );
}

export function CodeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const [v, setV] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open={open} onClose={onClose}>
      <View style={{ alignItems: 'center' }}>
        <Icon name="key" size={34} color={c.cobalt} />
        <Text variant="h2" style={{ marginTop: 8 }}>
          {t('Enter your coach’s code')}
        </Text>
        <Text variant="small" color="sec" center style={{ marginTop: 4 }}>
          {t('Your coach will see your food, workouts, weight and sleep so they can guide you. Cycle data stays private.')}
        </Text>
      </View>
      <TextInput
        value={v}
        onChangeText={(x) => (setV(x.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 9)), setErr(null))}
        placeholder="GYMI-XXXX"
        placeholderTextColor={c.sec}
        autoCapitalize="characters"
        autoCorrect={false}
        style={{ marginTop: 16, height: 56, borderRadius: 16, backgroundColor: c.card, textAlign: 'center', fontSize: 22, letterSpacing: 2, fontFamily: 'Sora_600SemiBold', color: c.text }}
      />
      <ErrorText>{err}</ErrorText>
      <Button
        title={t('Connect')}
        loading={busy}
        disabled={v.length < 9}
        style={{ marginTop: 16 }}
        onPress={async () => {
          setBusy(true);
          const r = await redeemCode(v);
          setBusy(false);
          if (r === 'ok') {
            onClose();
            toast(t('You’re connected with your coach'), { ai: true });
            return router.replace('/mycoach');
          }
          setErr(t(r === 'has_coach' ? 'You already have a coach. End that first.' : r === 'self' ? 'That’s your own code.' : 'That code isn’t right or was already used.'));
        }}
      />
    </Sheet>
  );
}
