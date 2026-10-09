import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Field, PasswordMeter } from '@/components/Field';
import { OtpInput } from '@/components/OtpInput';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, ErrorText } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { emailError, passwordError } from '@/lib/validation';

type Mode = 'login' | 'forgot' | 'reset';

export default function LogIn() {
  const { t } = useT();
  const auth = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>('login');
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPw, setNewPw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (auth.session && mode === 'login' && !busy) return <Redirect href="/" />;

  const logIn = async () => {
    if (!id.trim()) return setError('Enter your email or username.');
    if (!pw) return setError('Enter your password.');
    setError(null);
    setBusy(true);
    const r = await auth.logIn(id, pw);
    setBusy(false);
    if (r.error) return setError(r.error);
    toast(t('Welcome back'), { icon: 'check' });
    router.replace('/');
  };

  const sendReset = async () => {
    if (emailError(email)) return setError(emailError(email));
    setError(null);
    setBusy(true);
    const r = await auth.sendReset(email);
    setBusy(false);
    if (r.error) return setError(r.error);
    setMode('reset');
  };

  const saveNew = async () => {
    if (code.length !== 6) return setError('Enter the 6-digit code.');
    if (passwordError(newPw)) return setError(passwordError(newPw));
    setError(null);
    setBusy(true);
    const r = await auth.resetWithCode(email, code, newPw);
    setBusy(false);
    if (r.error) return setError(r.error);
    toast(t('Password changed'), { icon: 'check' });
    router.replace('/');
  };

  const back = mode === 'login' ? undefined : () => { setMode(mode === 'reset' ? 'forgot' : 'login'); setError(null); };

  return (
    <Screen title={t(mode === 'login' ? 'Log in' : 'Forgot password')} back onBack={back}>
      {mode === 'login' ? (
        <View>
          <Text variant="h1">{t('Welcome back')}</Text>
          <Text color="sec" style={{ marginTop: 4 }}>
            {t('Log in to pick up where you left off.')}
          </Text>
          <Field
            label={t('Email or username')}
            value={id}
            onChangeText={(v) => { setId(v); setError(null); }}
            placeholder={t('you@example.com or @username')}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            inputMode="email"
            ltr
          />
          <Field
            label={t('Password')}
            value={pw}
            onChangeText={(v) => { setPw(v); setError(null); }}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            autoCapitalize="none"
            onSubmitEditing={logIn}
            ltr
          />
          <ErrorText>{error ? t(error) : null}</ErrorText>
          <View style={{ marginTop: 16 }}>
            <Button title={t('Log in')} onPress={logIn} loading={busy} />
          </View>
          <Button
            title={t('Forgot password')}
            kind="glass"
            style={{ marginTop: 8 }}
            onPress={() => {
              setEmail(id.includes('@') ? id.trim() : '');
              setError(null);
              setMode('forgot');
            }}
          />
        </View>
      ) : mode === 'forgot' ? (
        <View>
          <Text variant="h1">{t('Reset your password')}</Text>
          <Text color="sec" style={{ marginTop: 4 }}>
            {t('We’ll email you a 6-digit code.')}
          </Text>
          <Field
            label={t('Email')}
            value={email}
            onChangeText={(v) => { setEmail(v.trim()); setError(null); }}
            placeholder="you@example.com"
            keyboardType="email-address"
            inputMode="email"
            autoCapitalize="none"
            autoComplete="email"
            ltr
          />
          <ErrorText>{error ? t(error) : null}</ErrorText>
          <View style={{ marginTop: 24 }}>
            <Button title={t('Send code')} onPress={sendReset} loading={busy} />
          </View>
        </View>
      ) : (
        <View>
          <Text variant="h1">{t('Enter the code')}</Text>
          <Text color="sec" style={{ marginTop: 4 }}>
            {t('We sent a 6-digit code to')} <Text weight={700}>{email}</Text>
          </Text>
          <OtpInput value={code} onChange={(v) => { setCode(v); setError(null); }} />
          <Field
            label={t('New password')}
            value={newPw}
            onChangeText={(v) => { setNewPw(v); setError(null); }}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            autoCapitalize="none"
            ltr
            hint={<PasswordMeter value={newPw} />}
          />
          <ErrorText>{error ? t(error) : null}</ErrorText>
          <View style={{ marginTop: 24 }}>
            <Button title={t('Save new password')} onPress={saveNew} loading={busy} />
          </View>
        </View>
      )}
    </Screen>
  );
}
