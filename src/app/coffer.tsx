import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';

import { Stepper } from '@/components/food/Stepper';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Row, Springy, Toggle } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { type CoachProfile, EMPTY_COACH, getCoachProfile, type Package, saveCoachProfile } from '@/lib/coaching';
import { useSettings } from '@/theme/settings';

/** Listing and packages: what members can pick when they ask you to coach them (design: coffer). */
export default function CoachOffer() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { session } = useAuth();
  const uid = session?.user.id;
  const [p, setP] = useState<CoachProfile | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!uid) return;
    let alive = true;
    getCoachProfile(uid).then((v) => alive && setP({ ...EMPTY_COACH, ...(v ?? {}) }));
    return () => {
      alive = false;
    };
  }, [uid]);
  const v = p ?? EMPTY_COACH;
  const set = (patch: Partial<CoachProfile>) => setP({ ...v, ...patch });
  const setPkg = (i: number, patch: Partial<Package>) => set({ packages: v.packages.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const field = { height: 44, borderRadius: 12, backgroundColor: c.inset, paddingHorizontal: 12, fontSize: 15, color: c.text } as const;
  const num = (s: string) => Number(s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/\D/g, '')) || 0;
  return (
    <Screen title={t('Listing and packages')} back>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text weight={700}>{t('Show me in Find a coach')}</Text>
          <Text variant="xs" color="sec">
            {t('Turn off to work only with clients you invite')}
          </Text>
        </View>
        <Toggle value={v.listed} onChange={(x) => set({ listed: x })} label={t('Show me in Find a coach')} />
      </Card>
      <Text weight={700} style={{ marginTop: 8 }}>
        {t('How many clients can you take?')}
      </Text>
      <Card style={{ marginTop: 8 }}>
        <Stepper onMinus={() => set({ max_clients: Math.max(1, v.max_clients - 1) })} onPlus={() => set({ max_clients: Math.min(500, v.max_clients + 1) })} labels={[t('Less'), t('More')]}>
          <Text num size={26}>
            {v.max_clients}
          </Text>
        </Stepper>
        <Text variant="xs" color="sec" center style={{ marginTop: 6 }}>
          {t('When you’re full, you’re hidden from Find a coach.')}
        </Text>
      </Card>
      <Text variant="small" weight={700} color="sec" style={{ marginTop: 8, marginBottom: 8, marginHorizontal: 4 }}>
        {t('Packages')}
      </Text>
      {v.packages.map((x, i) => (
        <Card key={x.id}>
          <Row>
            <TextInput value={x.name} onChangeText={(s) => setPkg(i, { name: s.slice(0, 40) })} placeholder={t('Package name')} placeholderTextColor={c.sec} style={[field, { flex: 1 }]} />
            <Springy accessibilityLabel={t('Delete')} onPress={() => set({ packages: v.packages.filter((_, j) => j !== i) })} style={{ width: 36, alignItems: 'center' }}>
              <Icon name="trash" size={18} color={c.down} />
            </Springy>
          </Row>
          <Row gap={8} style={{ marginTop: 8 }}>
            <View style={{ flex: 1 }}>
              <Text variant="xs" weight={700} color="sec">
                {t('Price (SAR)')}
              </Text>
              <TextInput value={x.price ? String(x.price) : ''} onChangeText={(s) => setPkg(i, { price: Math.min(100000, num(s)) })} inputMode="numeric" style={[field, { marginTop: 4 }]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="xs" weight={700} color="sec">
                {t('Weeks')}
              </Text>
              <TextInput value={x.weeks ? String(x.weeks) : ''} onChangeText={(s) => setPkg(i, { weeks: Math.min(52, num(s)) })} inputMode="numeric" style={[field, { marginTop: 4 }]} />
            </View>
          </Row>
          <TextInput
            value={x.desc}
            onChangeText={(s) => setPkg(i, { desc: s.slice(0, 200) })}
            placeholder={t('What’s included, for example: weekly check-in and a meal plan')}
            placeholderTextColor={c.sec}
            multiline
            style={[field, { marginTop: 8, height: 70, paddingTop: 10, textAlignVertical: 'top' }]}
          />
        </Card>
      ))}
      {v.packages.length < 5 ? <Button kind="soft" icon="plus" title={t('Add a package')} onPress={() => set({ packages: [...v.packages, { id: `k${Date.now()}`, name: '', price: 0, weeks: 4, desc: '' }] })} /> : null}
      <Text variant="xs" color="sec" style={{ marginTop: 8, marginHorizontal: 4 }}>
        {t('Clients pay you directly for now. In-app payments come with the store release.')}
      </Text>
      <Button
        title={t('Save')}
        loading={busy}
        style={{ marginTop: 12 }}
        onPress={async () => {
          if (!uid) return;
          setBusy(true);
          const clean = { ...v, packages: v.packages.filter((x) => x.name.trim()), price_month: v.packages.find((x) => x.name.trim())?.price ?? v.price_month };
          const ok = await saveCoachProfile(uid, clean);
          setBusy(false);
          toast(ok ? t('Saved') : t('Couldn’t save. Please try again.'), { icon: ok ? 'check' : 'warn' });
          if (ok) router.back();
        }}
      />
    </Screen>
  );
}
