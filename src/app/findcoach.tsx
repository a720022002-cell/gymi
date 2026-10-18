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
import { type CoachCard, fromPrice, listCoaches, redeemCode, SPECIALTIES, spotsLeft } from '@/lib/coaching';
import { fmt } from '@/lib/nutrition';
import { useSettings } from '@/theme/settings';

/** Find a coach: search, filter, spots left, or join with a code (design: findcoach). */
export default function FindCoach() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const [list, setList] = useState<CoachCard[] | null>(null);
  const [f, setF] = useState('All');
  const [q, setQ] = useState('');
  const [code, setCode] = useState(false);

  useEffect(() => {
    let alive = true;
    listCoaches().then((x) => alive && setList(x));
    return () => {
      alive = false;
    };
  }, []);

  const needle = q.trim().toLowerCase();
  const shown = (list ?? [])
    .filter((k) => f === 'All' || (f === 'Online' ? k.coach_type !== 'Personal' : f === 'In person' ? k.coach_type !== 'Online' : k.specialties.includes(f)))
    .filter((k) => !needle || [k.name, k.username, k.gym, k.city, k.headline, ...k.specialties, ...k.specialties.map((s) => t(s))].join(' ').toLowerCase().includes(needle));
  return (
    <Screen title={t('Find a coach')} back>
      <Row gap={8} style={{ height: 48, borderRadius: 16, backgroundColor: c.card, paddingHorizontal: 14, marginBottom: 10 }}>
        <Icon name="search" size={18} color={c.sec} />
        <TextInput value={q} onChangeText={setQ} placeholder={t('Search by name, gym or goal')} placeholderTextColor={c.sec} style={{ flex: 1, height: 46, fontSize: 16, color: c.text }} />
      </Row>
      <Row gap={8} style={{ flexWrap: 'wrap', marginBottom: 12 }}>
        {['All', 'Online', 'In person', ...SPECIALTIES].map((s) => (
          <Chip key={s} title={t(s)} on={f === s} onPress={() => setF(s)} />
        ))}
      </Row>
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
      {!list ? (
        <Thinking message={t('Loading')} />
      ) : shown.length ? (
        shown.map((k) => {
          const left = spotsLeft(k);
          const price = fromPrice(k.packages) ?? k.price_month;
          return (
            <Card key={k.id} onPress={() => router.push({ pathname: '/coachpage', params: { id: k.id } })}>
              <Row>
                <Avatar id={k.id} name={k.name || k.username} size={52} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text weight={700}>{k.name || k.username}</Text>
                  <Text variant="xs" color="sec" numberOfLines={1}>
                    {k.coach_type === 'Online' ? t('Online') : k.coach_type === 'Both' ? t('Online and at {g}', { g: k.gym || k.city }) : [k.gym, k.city].filter(Boolean).join(', ') || `@${k.username}`}
                  </Text>
                </View>
                {price ? (
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text num size={18}>
                      {fmt(price)}
                    </Text>
                    <Text variant="xs" weight={700} color="sec">
                      {t('SAR / month')}
                    </Text>
                  </View>
                ) : null}
              </Row>
              {k.headline ? (
                <Text variant="small" style={{ marginTop: 8 }}>
                  {k.headline}
                </Text>
              ) : null}
              <Row style={{ justifyContent: 'space-between', marginTop: 8 }}>
                <Row gap={6} style={{ flexShrink: 1, flexWrap: 'wrap' }}>
                  {k.specialties.slice(0, 2).map((s) => (
                    <View key={s} style={{ backgroundColor: c.inset, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text variant="xs" weight={700}>
                        {t(s)}
                      </Text>
                    </View>
                  ))}
                </Row>
                <Text variant="xs" weight={700} color={left <= 2 ? 'down' : 'up'}>
                  {t(left === 1 ? '{n} spot left' : '{n} spots left', { n: left })}
                </Text>
              </Row>
            </Card>
          );
        })
      ) : list.length ? (
        <Card style={{ alignItems: 'center' }}>
          <Text variant="small" color="sec" center>
            {t('No coaches match. Try another filter.')}
          </Text>
        </Card>
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
      <Text variant="xs" color="sec" center style={{ marginTop: 12 }}>
        {t('Only coaches checked by the Gymi team are listed. Full coaches are hidden until a spot opens.')}
      </Text>
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
        onChangeText={(x) => (setV(x.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 13)), setErr(null))}
        placeholder="GYMI-XXXXXXXX"
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
          setErr(t(r === 'has_coach' ? 'You already have a coach. End that first.' : r === 'full' ? 'This coach is full right now. Check back soon.' : r === 'self' ? 'That’s your own code.' : r === 'slow' ? 'Too many tries. Wait an hour and try again.' : 'That code isn’t right or was already used.'));
        }}
      />
    </Sheet>
  );
}
