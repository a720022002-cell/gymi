import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Share, TextInput, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, ErrorText, Row } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/theme/settings';

const TABLES = [
  'profiles', 'food_plans', 'food_logs', 'saved_meals', 'calorie_moves', 'water_logs', 'train_plans', 'workout_logs', 'cardio_logs', 'step_logs',
  'chat_messages', 'checkins', 'measurements', 'progress_photos', 'supplements', 'blood_tests', 'friend_share', 'activities', 'cycle_settings', 'cycle_periods', 'cycle_logs',
];

/** Privacy and data: download everything, or delete the account (design: privacy). */
export default function Privacy() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { session, logOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [typed, setTyped] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const download = async () => {
    if (!session) return;
    setBusy(true);
    const out: Record<string, unknown> = { exported_at: new Date().toISOString(), user: { id: session.user.id, email: session.user.email } };
    for (const tb of TABLES) {
      const { data } = await supabase.from(tb).select('*').limit(10000);
      out[tb] = data ?? [];
    }
    setBusy(false);
    const text = JSON.stringify(out, null, 2);
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `gymi-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast(t('Your data file is downloading'), { icon: 'download' });
    } else await Share.share({ message: text, title: 'Gymi data' });
  };

  const del = async () => {
    setDeleting(true);
    setErr(null);
    const { error } = await supabase.functions.invoke('account', { body: { action: 'delete', confirm: 'DELETE' } });
    setDeleting(false);
    if (error) return setErr(t('Couldn’t delete. Please try again.'));
    setStep(0);
    await logOut().catch(() => {});
    router.replace('/welcome');
    setTimeout(() => toast(t('Your account and data were deleted'), { icon: 'trash' }), 500);
  };

  return (
    <Screen title={t('Privacy and data')} back>
      <Text color="sec" style={{ marginTop: -8 }}>
        {t('Your data belongs to you.')}
      </Text>
      <Card style={{ marginTop: 16 }}>
        <Row>
          <Icon name="download" size={20} color={c.cobalt} />
          <View style={{ flex: 1 }}>
            <Text weight={700}>{t('Download my data')}</Text>
            <Text variant="small" color="sec">
              {t('Food, workouts, weight, sleep and health, as a file.')}
            </Text>
          </View>
        </Row>
        <Button kind="soft" title={t(busy ? 'Preparing…' : 'Download')} loading={busy} style={{ marginTop: 12 }} onPress={download} />
      </Card>
      <Card>
        <Row>
          <Icon name="trash" size={20} color={c.down} />
          <View style={{ flex: 1 }}>
            <Text weight={700}>{t('Delete my account')}</Text>
            <Text variant="small" color="sec">
              {t('Removes your account and all your data. This can’t be undone.')}
            </Text>
          </View>
        </Row>
        <Button kind="danger" title={t('Delete my account')} style={{ marginTop: 12 }} onPress={() => (setTyped(''), setStep(1))} />
      </Card>
      <Text variant="xs" color="sec" style={{ marginHorizontal: 4 }}>
        {t('AI photos are sent to the AI to read them and are not kept by Gymi. Progress photos are private to you.')}
      </Text>
      <Sheet open={step > 0} onClose={() => setStep(0)}>
        {step === 1 ? (
          <View style={{ alignItems: 'center' }}>
            <Icon name="warn" size={30} color={c.down} />
            <Text variant="h2" center style={{ marginTop: 8 }}>
              {t('Delete your account?')}
            </Text>
            <Text color="sec" center style={{ marginTop: 4 }}>
              {t('All your food logs, workouts, progress photos and health data will be deleted for good.')}
            </Text>
            <Button kind="danger" title={t('Continue')} style={{ marginTop: 16, alignSelf: 'stretch' }} onPress={() => setStep(2)} />
            <Button kind="ghost" title={t('Keep my account')} style={{ marginTop: 8, alignSelf: 'stretch' }} onPress={() => setStep(0)} />
          </View>
        ) : (
          <View>
            <Text variant="h2" center>
              {t('Type DELETE to confirm')}
            </Text>
            <Text color="sec" center style={{ marginTop: 4 }}>
              {t('This is the last step.')}
            </Text>
            <TextInput
              value={typed}
              onChangeText={setTyped}
              autoCapitalize="characters"
              placeholder="DELETE"
              placeholderTextColor={c.sec}
              style={{ marginTop: 12, height: 52, borderRadius: 16, backgroundColor: c.card, textAlign: 'center', fontSize: 18, letterSpacing: 2, fontFamily: 'Sora_600SemiBold', color: c.text }}
            />
            <ErrorText>{err}</ErrorText>
            <Button kind="danger" title={t('Delete for good')} loading={deleting} disabled={typed.trim().toUpperCase() !== 'DELETE'} style={{ marginTop: 12 }} onPress={del} />
            <Button kind="ghost" title={t('Cancel')} style={{ marginTop: 8 }} onPress={() => setStep(0)} />
          </View>
        )}
      </Sheet>
    </Screen>
  );
}
