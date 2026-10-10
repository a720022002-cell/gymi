import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Field } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Chip, ErrorText, Label, Row, Segmented } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { applyCoach, SOCIALS, SPECIALTIES } from '@/lib/coaching';

const YEARS = ['Under 1', '1 to 2', '3 to 5', '6 to 10', 'Over 10'];

/** Apply as a coach: the Gymi team checks it, then you can take clients (design: coachapply). */
export default function CoachApply() {
  const { t } = useT();
  const toast = useToast();
  const { refreshProfile } = useAuth();
  const [type, setType] = useState('Personal');
  const [gym, setGym] = useState('');
  const [city, setCity] = useState('');
  const [years, setYears] = useState<string | null>(null);
  const [spec, setSpec] = useState<string[]>([]);
  const [certs, setCerts] = useState('');
  const [bio, setBio] = useState('');
  const [socials, setSocials] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!years) return setErr(t('Pick how long you’ve been coaching.'));
    if (type !== 'Online' && !gym.trim()) return setErr(t('Write the gym you coach at.'));
    if (!spec.length) return setErr(t('Pick at least one thing you help with.'));
    setErr(null);
    setBusy(true);
    const ok = await applyCoach({ coach_type: type, gym: gym.trim(), city: city.trim(), years, specialties: spec, certs: certs.trim(), socials, bio: bio.trim() });
    setBusy(false);
    if (!ok) return toast(t('Couldn’t send. Please try again.'), { icon: 'warn' });
    await refreshProfile().catch(() => null);
    toast(t('Application sent. We usually reply within 2 days.'), { icon: 'check' });
    router.replace('/coachapp');
  };
  return (
    <Screen title={t('Apply as a coach')} back>
      <Text color="sec" style={{ marginTop: -8 }}>
        {t('Tell us about your coaching. Our team checks every coach before they can take clients.')}
      </Text>
      <Label>{t('How you coach')}</Label>
      <Segmented<string>
        value={type}
        options={[
          { value: 'Personal', label: t('In person') },
          { value: 'Online', label: t('Online') },
          { value: 'Both', label: t('Both') },
        ]}
        onChange={setType}
      />
      {type !== 'Online' ? <Field label={t('The gym you coach at')} value={gym} onChangeText={setGym} placeholder={t('Fitness Time, Olaya')} maxLength={80} /> : null}
      <Field label={t('City')} value={city} onChangeText={setCity} placeholder={t('Riyadh')} maxLength={60} />
      <Label>{t('Years coaching')}</Label>
      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        {YEARS.map((y) => (
          <Chip key={y} title={t(y)} on={years === y} onPress={() => setYears(y)} />
        ))}
      </Row>
      <Label>{t('What you help with')}</Label>
      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        {SPECIALTIES.map((s) => (
          <Chip key={s} title={t(s)} on={spec.includes(s)} onPress={() => setSpec(spec.includes(s) ? spec.filter((x) => x !== s) : [...spec, s])} />
        ))}
      </Row>
      <Field label={t('Certificates')} optional={t('(optional)')} value={certs} onChangeText={setCerts} placeholder={t('For example: NASM-CPT 2022, ACE Nutrition')} maxLength={500} multiline style={{ minHeight: 70, textAlignVertical: 'top' }} />
      <Field label={t('About you')} optional={t('(optional)')} value={bio} onChangeText={setBio} placeholder={t('How you coach and who you help best')} maxLength={600} multiline style={{ minHeight: 90, textAlignVertical: 'top' }} />
      <Label optional={t('(optional)')}>{t('Social media and website')}</Label>
      {SOCIALS.slice(0, 4).map(([k, ph]) => (
        <View key={k}>
          <Field label={k} value={socials[k] ?? ''} onChangeText={(x) => setSocials({ ...socials, [k]: x.slice(0, 80) })} placeholder={ph} autoCapitalize="none" ltr />
        </View>
      ))}
      <ErrorText>{err}</ErrorText>
      <Button title={t('Send application')} loading={busy} style={{ marginTop: 16 }} onPress={send} />
    </Screen>
  );
}
