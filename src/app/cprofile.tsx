import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Field } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Chip, Label, Row, Toggle } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { type CoachProfile, getCoachProfile, saveCoachProfile, SPECIALTIES } from '@/lib/coaching';

const EMPTY: CoachProfile = { bio: '', specialties: [], city: '', gym: '', price_month: null, years: null, listed: true };

/** Coach profile members see in Find a coach (design: cprofile). */
export default function CoachProfileScreen() {
  const { t } = useT();
  const toast = useToast();
  const { session } = useAuth();
  const uid = session?.user.id;
  const [p, setP] = useState<CoachProfile | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!uid) return;
    let alive = true;
    getCoachProfile(uid).then((v) => alive && setP(v ?? EMPTY));
    return () => {
      alive = false;
    };
  }, [uid]);

  const v = p ?? EMPTY;
  const set = (patch: Partial<CoachProfile>) => setP({ ...v, ...patch });
  const num = (s: string, max: number) => {
    const n = parseInt(s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/\D/g, ''), 10);
    return Number.isFinite(n) ? Math.min(max, n) : null;
  };
  return (
    <Screen title={t('Coach profile')} back>
      <Field label={t('About you')} value={v.bio} onChangeText={(x) => set({ bio: x })} placeholder={t('How you coach and who you help best')} multiline maxLength={600} style={{ minHeight: 110, textAlignVertical: 'top' }} />
      <Label>{t('What you help with')}</Label>
      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        {SPECIALTIES.map((s) => (
          <Chip key={s} title={t(s)} on={v.specialties.includes(s)} onPress={() => set({ specialties: v.specialties.includes(s) ? v.specialties.filter((x) => x !== s) : [...v.specialties, s] })} />
        ))}
      </Row>
      <Field label={t('Gym')} value={v.gym} onChangeText={(x) => set({ gym: x })} placeholder={t('Fitness Time, Olaya')} maxLength={80} />
      <Field label={t('City')} value={v.city} onChangeText={(x) => set({ city: x })} placeholder={t('Riyadh')} maxLength={60} />
      <Row gap={10}>
        <View style={{ flex: 1 }}>
          <Field label={t('Price a month (SAR)')} value={v.price_month == null ? '' : String(v.price_month)} onChangeText={(x) => set({ price_month: num(x, 100000) })} keyboardType="number-pad" ltr />
        </View>
        <View style={{ flex: 1 }}>
          <Field label={t('Years coaching')} value={v.years == null ? '' : String(v.years)} onChangeText={(x) => set({ years: num(x, 60) })} keyboardType="number-pad" ltr />
        </View>
      </Row>
      <Card style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text weight={700}>{t('Show me in Find a coach')}</Text>
          <Text variant="xs" color="sec">
            {t('Turn off to work only with clients you invite')}
          </Text>
        </View>
        <Toggle value={v.listed} onChange={(x) => set({ listed: x })} label={t('Show me in Find a coach')} />
      </Card>
      <Button
        title={t('Save')}
        loading={busy}
        onPress={async () => {
          if (!uid) return;
          setBusy(true);
          const ok = await saveCoachProfile(uid, v);
          setBusy(false);
          toast(ok ? t('Coach profile saved') : t('Couldn’t save. Please try again.'), { icon: ok ? 'check' : 'warn' });
          if (ok) router.back();
        }}
      />
    </Screen>
  );
}
