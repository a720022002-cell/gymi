import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Field, PasswordMeter } from '@/components/Field';
import { OtpInput } from '@/components/OtpInput';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, ErrorText, Toggle } from '@/components/ui';
import { useT } from '@/i18n';
import { maskEmail, useAuth } from '@/lib/auth';
import { EMAIL_CODES } from '@/lib/config';
import { emailError, passwordError } from '@/lib/validation';
import { useSettings } from '@/theme/settings';

type Mode = 'login' | 'code' | 'forgot' | 'reset' | 'sent';

export default function LogIn() {
  const { t } = useT();
  const auth = useAuth();
  const toast = useToast();
  const { colors: c } = useSettings();
  const [mode, setMode] = useState<Mode>('login');
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPw, setNewPw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Login code (new phone): where it went, the code, and "don't ask again on this phone".
  const [codeTo, setCodeTo] = useState('');
  // Email not confirmed yet: where to resend the sign-up link.
  const [unconfirmed, setUnconfirmed] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [trust, setTrust] = useState(true);
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);

  if (auth.session && mode === 'login' && !busy) return <Redirect href="/" />;

  const logIn = async () => {
    if (!id.trim()) return setError('Enter your email or username.');
    if (!pw) return setError('Enter your password.');
    setError(null);
    setBusy(true);
    const r = await auth.logIn(id, pw);
    setBusy(false);
    setUnconfirmed(r.error && /confirm your email/i.test(r.error) && r.email ? r.email : null);
    if (r.error) return setError(r.error);
    if (r.codeFailed) toast(t('We couldn’t send a login code, so you’re logged in without one.'), { icon: 'info' });
    if (r.code) {
      setCodeTo(r.code);
      setCode('');
      setLeft(30);
      setMode('code');
      return;
    }
    toast(t('Welcome back'), { icon: 'check' });
    router.replace('/');
  };

  const checkCode = async (v: string) => {
    setBusy(true);
    setError(null);
    const r = await auth.verifyLoginCode(codeTo, v, trust);
    setBusy(false);
    if (r.error) {
      setCode('');
      return setError(r.error);
    }
    toast(t('Verified. Welcome back.'), { icon: 'check' });
    router.replace('/');
  };

  const resendCode = async () => {
    if (resending) return;
    setResending(true);
    const r = await auth.sendLoginCode(codeTo);
    setResending(false);
    if (r.error) return setError(r.error);
    setLeft(30);
    toast(t('New code sent'), { icon: 'mail' });
  };

  const resendConfirm = async () => {
    if (!unconfirmed || resending) return;
    setResending(true);
    const r = await auth.resendSignup(unconfirmed);
    setResending(false);
    if (r.error) return setError(r.error);
    toast(t(EMAIL_CODES ? 'New code sent' : 'New link sent'), { icon: 'mail' });
  };

  const sendReset = async () => {
    if (emailError(email)) return setError(emailError(email));
    setError(null);
    setBusy(true);
    const r = await auth.sendReset(email);
    setBusy(false);
    if (r.error) return setError(r.error);
    setMode(EMAIL_CODES ? 'reset' : 'sent');
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

  const back = mode === 'login' ? undefined : () => { setMode(mode === 'reset' || mode === 'sent' ? 'forgot' : 'login'); setError(null); };
  const otherAccount = () => {
    setMode('login');
    setId('');
    setPw('');
    setCode('');
    setError(null);
  };

  return (
    <Screen title={t(mode === 'login' || mode === 'code' ? 'Log in' : 'Forgot password')} back onBack={back}>
      {mode === 'code' ? (
        <View>
          <Text variant="h1">{t('Check it’s you')}</Text>
          <Text color="sec" style={{ marginTop: 4 }}>
            {t('We sent a 6-digit code to')} <Text weight={700}>{maskEmail(codeTo)}</Text>
          </Text>
          <OtpInput value={code} onChange={(v) => { setCode(v); setError(null); }} onComplete={checkCode} error={!!error} />
          <View style={{ minHeight: 18, marginTop: 6 }}>
            {busy ? (
              <Text variant="small" color="sec" center>{t('Checking…')}</Text>
            ) : error ? (
              <Text size={12.5} weight={600} color="down" center>{t(error)}</Text>
            ) : null}
          </View>
          <View style={{ alignItems: 'center', marginTop: 4 }}>
            {left > 0 ? (
              <Text variant="small" weight={700} color="sec">{t('Resend code in 0:{s}', { s: String(left).padStart(2, '0') })}</Text>
            ) : (
              <Pressable onPress={resendCode} disabled={resending} hitSlop={8}>
                <Text variant="small" weight={700} color="link">{t('Resend code')}</Text>
              </Pressable>
            )}
          </View>
          <Button title={t('Send the code by text message instead')} kind="ghost" style={{ marginTop: 16 }} onPress={() => toast(t('Text messages are coming soon. Use the email code for now.'), { icon: 'info' })} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 12 }}>
            <Toggle value={trust} onChange={setTrust} label={t('Don’t ask for a code on this phone again')} />
            <Text variant="small" style={{ flexShrink: 1 }}>{t('Don’t ask for a code on this phone again')}</Text>
          </View>
          <Button title={t('Use a different account')} kind="ghost" color={c.sec} style={{ marginTop: 8 }} onPress={otherAccount} />
        </View>
      ) : mode === 'login' ? (
        <View>
          <Text variant="h1">{t('Welcome back')}</Text>
          <Text color="sec" style={{ marginTop: 4 }}>
            {t('Log in to pick up where you left off.')}
          </Text>
          <Field
            label={t('Email or username')}
            value={id}
            onChangeText={(v) => { setId(v); setError(null); setUnconfirmed(null); }}
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
          {unconfirmed && error ? <Button title={t('Resend link')} kind="soft" small loading={resending} style={{ marginTop: 8, alignSelf: 'flex-start' }} onPress={resendConfirm} /> : null}
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
            {t(EMAIL_CODES ? 'We’ll email you a 6-digit code.' : 'We’ll email you a link to set a new password.')}
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
            <Button title={t(EMAIL_CODES ? 'Send code' : 'Send link')} onPress={sendReset} loading={busy} />
          </View>
        </View>
      ) : mode === 'sent' ? (
        <View>
          <Text variant="h1">{t('Check your email')}</Text>
          <Text color="sec" style={{ marginTop: 4 }}>
            {t('We sent a link to')} <Text weight={700}>{email}</Text>
            {'. '}
            {t('Open it on this phone to choose a new password.')}
          </Text>
          <Text variant="xs" color="sec" style={{ marginTop: 12 }}>
            {t('Can’t find it? Check your spam folder.')}
          </Text>
          <Button title={t('Back to log in')} kind="soft" style={{ marginTop: 24 }} onPress={() => setMode('login')} />
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
