import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Field, PasswordMeter } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, ErrorText } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { passwordError } from '@/lib/validation';

/** Where the "Reset password" email link lands. The link logs you in, then you pick a new password. */
export default function ResetPassword() {
  const { t } = useT();
  const auth = useAuth();
  const toast = useToast();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const pe = passwordError(pw);
    if (pe) return setError(pe);
    if (pw !== pw2) return setError('Passwords don’t match');
    setError(null);
    setBusy(true);
    const r = await auth.setNewPassword(pw);
    setBusy(false);
    if (r.error) return setError(r.error);
    toast(t('Password changed'), { icon: 'check' });
    router.replace('/');
  };

  return (
    <Screen title={t('Forgot password')}>
      {auth.loading ? null : !auth.session ? (
        <View>
          <Text variant="h1">{t('This link has expired')}</Text>
          <Text color="sec" style={{ marginTop: 4 }}>
            {t('Ask for a new one from the log in screen.')}
          </Text>
          <Button title={t('Back to log in')} style={{ marginTop: 24 }} onPress={() => router.replace('/login')} />
        </View>
      ) : (
        <View>
          <Text variant="h1">{t('Choose a new password')}</Text>
          <Field
            label={t('New password')}
            value={pw}
            onChangeText={(v) => { setPw(v); setError(null); }}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            autoCapitalize="none"
            ltr
            hint={<PasswordMeter value={pw} />}
          />
          <Field
            label={t('Confirm password')}
            value={pw2}
            onChangeText={(v) => { setPw2(v); setError(null); }}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            autoCapitalize="none"
            ltr
          />
          <ErrorText>{error ? t(error) : null}</ErrorText>
          <View style={{ marginTop: 24 }}>
            <Button title={t('Save new password')} onPress={save} loading={busy} />
          </View>
        </View>
      )}
    </Screen>
  );
}
