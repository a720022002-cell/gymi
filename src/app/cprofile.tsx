import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { GymHoursEditor } from '@/components/coach/GymHours';
import { Field } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Chip, Label, Row, Segmented } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { type CoachProfile, EMPTY_COACH, getCoachProfile, saveCoachProfile, SOCIALS, SPECIALTIES } from '@/lib/coaching';

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
    getCoachProfile(uid).then((v) => alive && setP({ ...EMPTY_COACH, ...(v ?? {}) }));
    return () => {
      alive = false;
    };
  }, [uid]);

  const v = p ?? EMPTY_COACH;
  const set = (patch: Partial<CoachProfile>) => setP({ ...v, ...patch });
  const num = (s: string, max: number) => {
    const n = parseInt(s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/\D/g, ''), 10);
    return Number.isFinite(n) ? Math.min(max, n) : null;
  };
  return (
    <Screen title={t('Coach profile')} back>
      <Field label={t('About you')} value={v.bio} onChangeText={(x) => set({ bio: x })} placeholder={t('How you coach and who you help best')} multiline maxLength={600} style={{ minHeight: 110, textAlignVertical: 'top' }} />
      <Label>{t('How you coach')}</Label>
      <Segmented<string>
        value={v.coach_type}
        options={[
          { value: 'Personal', label: t('In person') },
          { value: 'Online', label: t('Online') },
          { value: 'Both', label: t('Both') },
        ]}
        onChange={(x) => set({ coach_type: x })}
      />
      <Label>{t('What you help with')}</Label>
      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        {SPECIALTIES.map((s) => (
          <Chip key={s} title={t(s)} on={v.specialties.includes(s)} onPress={() => set({ specialties: v.specialties.includes(s) ? v.specialties.filter((x) => x !== s) : [...v.specialties, s] })} />
        ))}
      </Row>
      {v.coach_type !== 'Online' ? <Field label={t('Gym')} value={v.gym} onChangeText={(x) => set({ gym: x })} placeholder={t('Fitness Time, Olaya')} maxLength={80} /> : null}
      {v.coach_type !== 'Online' ? (
        <>
          <Label>{t('When you’re at the gym')}</Label>
          <GymHoursEditor value={v.hours ?? []} onChange={(h) => set({ hours: h })} />
          <Text variant="xs" color="sec" style={{ marginTop: 6, marginHorizontal: 4 }}>
            {t('Clients can ask to meet you at these times.')}
          </Text>
        </>
      ) : null}
      <Field label={t('City')} value={v.city} onChangeText={(x) => set({ city: x })} placeholder={t('Riyadh')} maxLength={60} />
      <Field label={t('Years coaching')} value={v.years == null ? '' : String(v.years)} onChangeText={(x) => set({ years: num(x, 60) })} keyboardType="number-pad" ltr />
      <Label>{t('Social media and website')}</Label>
      {SOCIALS.map(([k, ph]) => (
        <View key={k}>
          <Field
            label={k}
            value={v.socials[k] ?? ''}
            onChangeText={(x) => {
              const s = { ...v.socials, [k]: x.slice(0, 80) };
              if (!x) delete s[k];
              set({ socials: s });
            }}
            placeholder={ph}
            autoCapitalize="none"
            ltr
          />
        </View>
      ))}
      <Button kind="glass" title={t('Listing and packages')} style={{ marginTop: 16 }} onPress={() => router.push('/coffer')} />
      <Button
        title={t('Save')}
        loading={busy}
        style={{ marginTop: 8 }}
        onPress={async () => {
          if (!uid) return;
          setBusy(true);
          const ok = await saveCoachProfile(uid, { ...v, hours: v.coach_type === 'Online' ? [] : (v.hours ?? []).filter((h) => h.days.length) });
          setBusy(false);
          toast(ok ? t('Coach profile saved') : t('Couldn’t save. Please try again.'), { icon: ok ? 'check' : 'warn' });
          if (ok) router.back();
        }}
      />
    </Screen>
  );
}
