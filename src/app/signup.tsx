import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Field, PasswordMeter } from '@/components/Field';
import { Icon } from '@/components/Icon';
import { OtpInput } from '@/components/OtpInput';
import { PhoneField } from '@/components/PhoneField';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, ErrorText, Label, Option, ProgDots, Row, Segmented } from '@/components/ui';
import { Wheel } from '@/components/Wheel';
import { useT } from '@/i18n';
import { profileComplete, useAuth } from '@/lib/auth';
import { useSignupDraft } from '@/lib/signupDraft';
import {
  ageFrom,
  cleanNumber,
  cleanUsername,
  daysIn,
  type Dob,
  dobToIso,
  emailError,
  fullPhone,
  heightError,
  passwordError,
  phoneMessage,
  usernameError,
  weightError,
} from '@/lib/validation';
import { useSettings } from '@/theme/settings';

type Step = 0 | 1 | 2;
type Errors = Record<string, string | undefined>;

export default function SignUp() {
  const { t } = useT();
  const auth = useAuth();
  const { step: stepParam } = useLocalSearchParams<{ step?: string }>();
  const [step, setStep] = useState<Step>(stepParam === 'about' ? 2 : 0);

  // Logged in with a finished profile: nothing to do here.
  if (auth.session && profileComplete(auth.profile)) return <Redirect href="/home" />;
  // Step 3 needs a logged-in user.
  if (step === 2 && !auth.session && !auth.loading) return <Redirect href="/welcome" />;

  return (
    <Screen title={t('Create account')} back={step !== 2} onBack={step === 1 ? () => setStep(0) : undefined}>
      <ProgDots step={step} />
      {step === 0 ? <Basics onNext={() => setStep(1)} /> : null}
      {step === 1 ? <Verify onBack={() => setStep(0)} onVerified={() => setStep(2)} /> : null}
      {step === 2 ? <About /> : null}
    </Screen>
  );
}

/* ---------- shared form state across steps 1 and 2 ---------- */
const form = { username: '', name: '', email: '', iso: 'SA', phone: '', password: '', password2: '' };

/* ---------- Step 1: the basics ---------- */
function Basics({ onNext }: { onNext: () => void }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const { usernameAvailable } = useAuth();
  const [f, setF] = useState(form);
  const [e, setE] = useState<Errors>({});
  const [userState, setUserState] = useState<'idle' | 'checking' | 'free' | 'taken'>('idle');
  const [busy, setBusy] = useState(false);
  const check = useRef<ReturnType<typeof setTimeout>>(undefined);

  const set = (k: keyof typeof form, v: string) => {
    const next = { ...f, [k]: v };
    Object.assign(form, next);
    setF(next);
    if (e[k]) setE({ ...e, [k]: undefined });
  };

  const onUsername = (raw: string) => {
    const u = cleanUsername(raw);
    set('username', u);
    clearTimeout(check.current);
    if (!u || usernameError(u)) return setUserState('idle');
    setUserState('checking');
    check.current = setTimeout(async () => {
      const ok = await usernameAvailable(u);
      if (form.username === u) setUserState(ok === false ? 'taken' : ok ? 'free' : 'idle');
    }, 450);
  };

  const next = async () => {
    const err: Errors = {};
    const ue = usernameError(f.username);
    if (ue) err.username = ue;
    else if (userState === 'taken') err.username = 'taken';
    const ee = emailError(f.email);
    if (ee) err.email = ee;
    const [pk, pm] = phoneMessage(f.iso, f.phone, true);
    if (pk === 'bad') err.phone = pm;
    const pe = passwordError(f.password);
    if (pe) err.password = pe;
    else if (f.password2 !== f.password) err.password2 = f.password2 ? 'Passwords don’t match' : 'Type your password again.';
    setE(err);
    if (Object.keys(err).length) return;

    setBusy(true);
    const ok = await usernameAvailable(f.username);
    setBusy(false);
    if (ok === false) {
      setUserState('taken');
      setE({ username: 'taken' });
      return;
    }
    onNext();
  };

  const suggestions = [`${f.username.replace(/[._]+$/, '')}_fit`, `${f.username.replace(/[._]+$/, '')}.gym`, `${f.username.replace(/[._]+$/, '')}26`];
  const userHint = (() => {
    const taken = userState === 'taken' || e.username === 'taken';
    if (taken)
      return (
        <View>
          <Text variant="small" weight={700} color="down">
            {t('@{u} is taken. Try:', { u: f.username })}
          </Text>
          <Row gap={6} style={{ flexWrap: 'wrap', marginTop: 4 }}>
            {suggestions.map((s) => (
              <Pressable key={s} onPress={() => onUsername(s)} style={{ backgroundColor: c.card, borderRadius: 14, height: 28, paddingHorizontal: 10, justifyContent: 'center' }}>
                <Text variant="small" weight={600}>{`@${s}`}</Text>
              </Pressable>
            ))}
          </Row>
        </View>
      );
    if (e.username) return <Text variant="small" weight={700} color="down">{t(e.username)}</Text>;
    if (!f.username) return <Text variant="small" weight={600} color="sec">{t('This is how friends find you in Gym Bros. You can change it later.')}</Text>;
    const r = usernameError(f.username);
    if (r) return <Text variant="small" weight={700} color="sec">{t(r)}</Text>;
    if (userState === 'checking') return <Text variant="small" weight={700} color="sec">{t('Checking…')}</Text>;
    if (userState === 'free')
      return (
        <Row gap={4}>
          <Icon name="check" size={15} color={c.up} strokeWidth={2.6} />
          <Text variant="small" weight={700} color="up">{t('@{u} is available', { u: f.username })}</Text>
        </Row>
      );
    return null;
  })();

  const match = f.password2 ? (f.password2 === f.password ? 'ok' : f.password2.length >= f.password.length || !f.password.startsWith(f.password2) ? 'bad' : '') : '';

  return (
    <View>
      <Text variant="h1">{t('Let’s get you set up')}</Text>
      <Text color="sec" style={{ marginTop: 4 }}>
        {t('Just the basics. We ask the rest only when you need it.')}
      </Text>

      <Field
        label={t('Username')}
        prefix="@"
        value={f.username}
        onChangeText={onUsername}
        placeholder="omar_fit"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username-new"
        maxLength={20}
        ltr
        invalid={!!e.username || userState === 'taken'}
        hint={userHint}
      />
      <Field label={t('Name')} optional={t('(optional)')} value={f.name} onChangeText={(v) => set('name', v)} placeholder={t('Omar')} autoComplete="given-name" maxLength={60} />
      <Field
        label={t('Email')}
        value={f.email}
        onChangeText={(v) => set('email', v.trim())}
        placeholder="you@example.com"
        keyboardType="email-address"
        inputMode="email"
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        ltr
        error={e.email ? t(e.email) : null}
      />
      <PhoneField
        iso={f.iso}
        digits={f.phone}
        onChange={(iso, d) => {
          const next = { ...f, iso, phone: d };
          Object.assign(form, next);
          setF(next);
          if (e.phone) setE({ ...e, phone: undefined });
        }}
        forceCheck={!!e.phone}
      />
      <Field
        label={t('Password')}
        value={f.password}
        onChangeText={(v) => set('password', v)}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        autoCapitalize="none"
        ltr
        error={e.password ? t(e.password) : null}
        hint={<PasswordMeter value={f.password} />}
      />
      <Field
        label={t('Confirm password')}
        value={f.password2}
        onChangeText={(v) => set('password2', v)}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        autoCapitalize="none"
        ltr
        error={e.password2 ? t(e.password2) : match === 'bad' ? t('Passwords don’t match') : null}
        hint={
          match === 'ok' ? (
            <Row gap={4}>
              <Icon name="check" size={15} color={c.up} strokeWidth={2.6} />
              <Text variant="small" weight={700} color="up">{t('Passwords match')}</Text>
            </Row>
          ) : null
        }
      />
      <View style={{ marginTop: 24 }}>
        <Button title={t('Next')} onPress={next} loading={busy} />
      </View>
      <Text variant="small" color="sec" center style={{ marginTop: 16 }}>
        {t('By continuing you agree to the Terms and Privacy Policy.')}
      </Text>
    </View>
  );
}

/* ---------- Step 2: verify with a 6-digit code ---------- */
function Verify({ onBack, onVerified }: { onBack: () => void; onVerified: () => void }) {
  const { t, lang } = useT();
  const auth = useAuth();
  const toast = useToast();
  const { accountType } = useSignupDraft();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);

  const send = async () => {
    setBusy(true);
    setError(null);
    const r = await auth.signUp({
      email: form.email,
      password: form.password,
      username: form.username,
      name: form.name,
      phone: fullPhone(form.iso, form.phone),
      accountType: accountType ?? 'member',
      language: lang,
    });
    setBusy(false);
    if (r.error) return setError(r.error);
    setSent(true);
    setLeft(30);
  };

  const verify = async (v: string) => {
    setBusy(true);
    setError(null);
    const r = await auth.verifySignup(form.email, v);
    setBusy(false);
    if (r.error) {
      setError(r.error);
      setCode('');
      return;
    }
    form.password = '';
    form.password2 = '';
    toast(t('Email verified'), { icon: 'check' });
    onVerified();
  };

  const resend = async () => {
    const r = await auth.resendSignup(form.email);
    if (r.error) return setError(r.error);
    setLeft(30);
    toast(t('New code sent'), { icon: 'mail' });
  };

  if (!sent)
    return (
      <View>
        <Text variant="h1">{t('Verify your account')}</Text>
        <Text color="sec" style={{ marginTop: 4 }}>
          {t('We’ll send you a 6-digit code. Where should it go?')}
        </Text>
        <View style={{ marginTop: 16 }}>
          <Option icon="mail" title={t('Email')} subtitle={form.email} selected />
          <Option icon="phone" title={t('Text message (SMS)')} subtitle={t('Coming soon')} disabled />
        </View>
        {error ? <ErrorText>{t(error)}</ErrorText> : null}
        <View style={{ marginTop: 24 }}>
          <Button title={t('Send code')} onPress={send} loading={busy} />
        </View>
        <Button title={t('Change my details')} kind="ghost" style={{ marginTop: 8 }} onPress={onBack} />
      </View>
    );

  return (
    <View>
      <Text variant="h1">{t('Enter the code')}</Text>
      <Text color="sec" style={{ marginTop: 4 }}>
        {t('We sent a 6-digit code to')} <Text weight={700}>{form.email}</Text>
      </Text>
      <OtpInput value={code} onChange={(v) => { setCode(v); setError(null); }} onComplete={verify} error={!!error} />
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
          <Pressable onPress={resend} hitSlop={8}>
            <Text variant="small" weight={700} color="link">{t('Resend code')}</Text>
          </Pressable>
        )}
      </View>
      <Text variant="xs" color="sec" center style={{ marginTop: 8 }}>
        {t('Can’t find it? Check your spam folder.')}
      </Text>
      <Button title={t('Change my details')} kind="ghost" style={{ marginTop: 16 }} onPress={onBack} />
    </View>
  );
}

/* ---------- Step 3: a bit about you ---------- */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function About() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const auth = useAuth();
  const toast = useToast();
  const [gender, setGender] = useState<'male' | 'female' | null>(auth.profile?.gender ?? null);
  const [dob, setDob] = useState<Dob | null>(null);
  const [dobOpen, setDobOpen] = useState(false);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [e, setE] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const isCoach = auth.profile?.account_type === 'coach';
  const thisYear = new Date().getFullYear();

  const liveHeight = height && (Number(height) > 230 || (height.length >= 3 && Number(height) < 120)) ? 'Height must be 120 to 230 cm.' : '';
  const liveWeight = weight && (parseFloat(weight) > 250 || (weight.replace('.', '').length >= 2 && parseFloat(weight) < 30)) ? 'Weight must be 30 to 250 kg.' : '';

  const save = async () => {
    const err: Errors = {};
    if (!gender) err.gender = 'Choose one.';
    if (!dob) err.dob = 'Pick your date of birth.';
    else {
      const a = ageFrom(dob);
      if (!(a >= 13 && a <= 100)) err.dob = 'You need to be 13 to 100 years old.';
    }
    const he = heightError(height);
    if (he) err.height = he;
    const we = weightError(weight);
    if (we) err.weight = we;
    setE(err);
    if (Object.keys(err).length) return;
    setBusy(true);
    const r = await auth.updateProfile({
      gender,
      date_of_birth: dobToIso(dob!),
      height_cm: Number(height),
      weight_kg: Math.round(parseFloat(weight) * 10) / 10,
    });
    setBusy(false);
    if (r.error) return setE({ save: r.error });
    toast(t('Welcome to Gymi'), { icon: 'check' });
    router.replace('/home');
  };

  return (
    <View>
      <Text variant="h1">{t('A bit about you')}</Text>
      <Text color="sec" style={{ marginTop: 4 }}>
        {t('We use this to work out your calories. You can change it later.')}
      </Text>
      {isCoach ? (
        <Card style={{ marginTop: 16, flexDirection: 'row', gap: 12, alignItems: 'flex-start', padding: 14 }}>
          <Icon name="info" size={18} color={c.cobalt} />
          <Text variant="small" style={{ flex: 1 }}>
            {t('Our team checks every coach before they can take clients. You can use Gymi for your own training while you wait.')}
          </Text>
        </Card>
      ) : null}

      <Label>{t('Gender')}</Label>
      <Segmented
        value={gender}
        options={[
          { value: 'male', label: t('Male') },
          { value: 'female', label: t('Female') },
        ]}
        onChange={(g) => {
          setGender(g);
          setE({ ...e, gender: undefined });
        }}
      />
      <ErrorText>{e.gender ? t(e.gender) : null}</ErrorText>

      <Label>{t('Date of birth')}</Label>
      <View style={{ backgroundColor: c.card, borderRadius: 22, overflow: 'hidden', borderWidth: e.dob ? 1.5 : 0, borderColor: c.down }}>
        <Pressable
          onPress={() => {
            setDobOpen(!dobOpen);
            if (!dob) setDob({ m: 1, d: 1, y: 1997 });
            setE({ ...e, dob: undefined });
          }}
          accessibilityState={{ expanded: dobOpen }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 16 }}>
          <Text weight={dob ? 700 : 400} color={dob ? 'text' : 'sec'} style={{ flex: 1 }}>
            {dob ? `${t(MONTHS[dob.m - 1])} ${dob.d}, ${dob.y}` : t('Choose your birthday')}
          </Text>
          {dob ? (
            <Text variant="small" weight={700} color="sec">
              {t('{n} years old', { n: ageFrom(dob) })}
            </Text>
          ) : null}
          <View style={{ transform: [{ rotate: dobOpen ? '180deg' : '0deg' }] }}>
            <Icon name="chevd" size={18} color={c.sec} />
          </View>
        </Pressable>
        {dobOpen && dob ? (
          <View style={{ paddingBottom: 8 }}>
            <Wheel
              columns={[
                { items: MONTHS.map((n, i) => ({ value: i + 1, label: t(n) })), selected: dob.m, width: 80 },
                { items: Array.from({ length: 31 }, (_, i) => ({ value: i + 1, label: String(i + 1) })), selected: dob.d, width: 60 },
                { items: Array.from({ length: thisYear - 1920 + 1 }, (_, i) => ({ value: 1920 + i, label: String(1920 + i) })), selected: dob.y, width: 90 },
              ]}
              onChange={([m, d, y]) => setDob({ m, y, d: Math.min(d, daysIn(m, y)) })}
            />
          </View>
        ) : null}
      </View>
      <ErrorText>{e.dob ? t(e.dob) : null}</ErrorText>

      <Field
        label={t('Height')}
        unit={t('cm')}
        value={height}
        onChangeText={(v) => {
          setHeight(cleanNumber(v, false));
          setE({ ...e, height: undefined });
        }}
        placeholder="178"
        keyboardType="number-pad"
        inputMode="numeric"
        ltr
        error={e.height ? t(e.height) : liveHeight ? t(liveHeight) : null}
      />
      <Field
        label={t('Weight')}
        unit={t('kg')}
        value={weight}
        onChangeText={(v) => {
          setWeight(cleanNumber(v, true));
          setE({ ...e, weight: undefined });
        }}
        placeholder="80.5"
        keyboardType="decimal-pad"
        inputMode="decimal"
        ltr
        error={e.weight ? t(e.weight) : liveWeight ? t(liveWeight) : null}
        hint={t('Your weight today. You can log it every morning after this.')}
      />
      <ErrorText>{e.save ? t(e.save) : null}</ErrorText>
      <View style={{ marginTop: 24 }}>
        <Button title={t('Continue')} onPress={save} loading={busy} />
      </View>
    </View>
  );
}
