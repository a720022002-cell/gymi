import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { cleanSocials, SocialFields } from '@/components/coach/Socials';
import { Field } from '@/components/Field';
import { Icon } from '@/components/Icon';
import { List, ListRow } from '@/components/social/List';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Chip, ErrorText, Label, Row, Segmented, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { GymHoursEditor } from '@/components/coach/GymHours';
import { applyCoach, type CertFile, type GymHours, SPECIALTIES, uploadCert } from '@/lib/coaching';
import { useSettings } from '@/theme/settings';

const YEARS = ['Under 1', '1 to 2', '3 to 5', '6 to 10', 'Over 10'];

/** Apply as a coach: the Adro team checks it, then you can take clients (design: coachapply). */
export default function CoachApply() {
  const { t } = useT();
  const toast = useToast();
  const { colors: c } = useSettings();
  const { refreshProfile, session } = useAuth();
  const [files, setFiles] = useState<CertFile[]>([]);
  const [up, setUp] = useState(false);
  const [type, setType] = useState('Personal');
  const [gym, setGym] = useState('');
  const [city, setCity] = useState('');
  const [years, setYears] = useState<string | null>(null);
  const [spec, setSpec] = useState<string[]>([]);
  const [certs, setCerts] = useState('');
  const [bio, setBio] = useState('');
  const [socials, setSocials] = useState<Record<string, string>>({ Instagram: '' });
  const [hours, setHours] = useState<GymHours[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!years) return setErr(t('Pick how long you’ve been coaching.'));
    if (type !== 'Online' && !gym.trim()) return setErr(t('Write the gym you coach at.'));
    if (!spec.length) return setErr(t('Pick at least one thing you help with.'));
    setErr(null);
    setBusy(true);
    const ok = await applyCoach({ coach_type: type, gym: gym.trim(), city: city.trim(), years, specialties: spec, certs: certs.trim(), cert_files: files, socials: cleanSocials(socials), bio: bio.trim(), hours: type === 'Online' ? [] : hours.filter((h) => h.days.length) });
    setBusy(false);
    if (!ok) return toast(t('Couldn’t send. Please try again.'), { icon: 'warn' });
    await refreshProfile().catch(() => null);
    toast(t('Application sent. We usually reply within 2 days.'), { icon: 'check' });
    router.replace('/coachapp');
  };
  const pick = async () => {
    const uid = session?.user.id;
    if (!uid || files.length >= 5) return;
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
    const a = r.canceled ? null : r.assets?.[0];
    if (!a) return;
    if (a.size && a.size > 10 * 1024 * 1024) return toast(t('That file is too big. The limit is 10 MB.'), { icon: 'warn' });
    setUp(true);
    const f = await uploadCert(uid, { name: a.name, uri: a.uri, mimeType: a.mimeType, file: a.file });
    setUp(false);
    if (!f) return toast(t('Couldn’t upload. Please try again.'), { icon: 'warn' });
    setFiles([...files, f]);
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
      {type !== 'Online' ? (
        <>
          <Label optional={t('(optional)')}>{t('When you’re at the gym')}</Label>
          <GymHoursEditor value={hours} onChange={setHours} />
          <Text variant="xs" color="sec" style={{ marginTop: 6, marginHorizontal: 4 }}>
            {t('Clients can ask to meet you at these times.')}
          </Text>
        </>
      ) : null}
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
      <Label optional={t('(optional)')}>{t('Certificates')}</Label>
      <List>
        {files.map((f, i) => (
          <ListRow key={f.path} first={!i}>
            <Icon name="doc" size={18} />
            <Text variant="small" weight={700} style={{ flex: 1 }} numberOfLines={1}>
              {f.name}
            </Text>
            <Springy accessibilityLabel={t('Remove')} onPress={() => setFiles(files.filter((x) => x.path !== f.path))} style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="close" size={14} color={c.sec} strokeWidth={2.2} />
            </Springy>
          </ListRow>
        ))}
        {files.length < 5 ? (
          <ListRow first={!files.length} onPress={up ? undefined : pick}>
            <Icon name="upload" size={18} color={c.cobalt} />
            <View style={{ flex: 1 }}>
              <Text weight={700}>{t(up ? 'Uploading…' : 'Upload a certificate')}</Text>
              <Text variant="xs" color="sec">
                {t('PDF or photo. For example: ACE, NASM, ISSA, or a local license')}
              </Text>
            </View>
          </ListRow>
        ) : null}
      </List>
      <Field label={t('Certificate names')} optional={t('(optional)')} value={certs} onChangeText={setCerts} placeholder={t('For example: NASM-CPT 2022, ACE Nutrition')} maxLength={500} multiline style={{ minHeight: 70, textAlignVertical: 'top' }} />
      <Field label={t('About you')} optional={t('(optional)')} value={bio} onChangeText={setBio} placeholder={t('How you coach and who you help best')} maxLength={600} multiline style={{ minHeight: 90, textAlignVertical: 'top' }} />
      <Label optional={t('(optional)')}>{t('Social media and website')}</Label>
      <SocialFields value={socials} onChange={setSocials} />
      <ErrorText>{err}</ErrorText>
      <Button title={t('Send application')} loading={busy} disabled={up} style={{ marginTop: 16 }} onPress={send} />
    </Screen>
  );
}
