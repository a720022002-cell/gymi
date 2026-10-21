import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { GymHoursEditor } from '@/components/coach/GymHours';
import { Field, PasswordMeter } from '@/components/Field';
import { Icon } from '@/components/Icon';
import { OtpInput } from '@/components/OtpInput';
import { PhoneField } from '@/components/PhoneField';
import { Screen } from '@/components/Screen';
import { DeviceStep, HealthStep } from '@/components/signup/ConnectSteps';
import { form, resetSignupForm, sent } from '@/components/signup/form';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Chip, ErrorText, Label, Option, ProgDots, Row, Segmented, Springy } from '@/components/ui';
import { Wheel } from '@/components/Wheel';
import { useT } from '@/i18n';
import { EMAIL_CODES } from '@/lib/config';
import { profileComplete, useAuth } from '@/lib/auth';
import { applyCoach, type GymHours, myApplication, SOCIALS, SPECIALTIES } from '@/lib/coaching';
import { askNotifPermission } from '@/lib/reminders';
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

type Step = 0 | 1 | 2 | 3 | 4;
type Errors = Record<string, string | undefined>;

export default function SignUp() {
  const { t } = useT();
  const auth = useAuth();
  const { step: stepParam } = useLocalSearchParams<{ step?: string }>();
  const [step, setStep] = useState<Step>(stepParam === 'about' ? 2 : stepParam === 'devices' ? 4 : 0);
  // Back from a band's or ring's sign-in (it opens /signup?step=devices again).
  const [seenParam, setSeenParam] = useState(stepParam);
  if (stepParam !== seenParam) {
    setSeenParam(stepParam);
    if (stepParam === 'devices') setStep(4);
  }
  const { accountType } = useSignupDraft();
  const isCoach = (auth.profile?.account_type ?? accountType) === 'coach';
  const done = async () => {
    resetSignupForm();
    // Sign-up is done: ask once for notifications so your reminders can show.
    await askNotifPermission().catch(() => false);
    router.replace({ pathname: '/home', params: { welcome: '1' } });
  };
  // Step 3 is a dead end for someone who signed in with the wrong account: let them log out.
  const [leaving, setLeaving] = useState(false);
  const switchAccount = async () => {
    if (leaving) return;
    setLeaving(true);
    await auth.logOut().catch(() => {});
    if (router.canDismiss()) router.dismissAll();
    router.replace('/welcome');
  };

  // Logged in with a finished profile: nothing to do here (coaches still send their application on step 3, and
  // everyone else can still connect a health app and a device on steps 4 and 5).
  if (auth.session && profileComplete(auth.profile) && !(isCoach && step === 2) && !(!isCoach && step >= 3)) return <Redirect href="/home" />;
  // Step 3 and on need a logged-in user.
  if (step >= 2 && !auth.session && !auth.loading) return <Redirect href="/welcome" />;

  return (
    <Screen title={t(step >= 3 ? 'Connect' : 'Create account')} back={step < 2} onBack={step === 1 ? () => setStep(0) : undefined}>
      <ProgDots step={step} total={isCoach ? 3 : 5} />
      {step === 0 ? <Basics onNext={() => setStep(1)} /> : null}
      {step === 1 ? <Verify onBack={() => setStep(0)} onVerified={() => setStep(2)} /> : null}
      {step === 2 ? isCoach ? <CoachApplication /> : <About onDone={() => setStep(3)} /> : null}
      {step === 2 ? <Button title={t('Log out / Use another account')} kind="ghost" style={{ marginTop: 8 }} loading={leaving} onPress={switchAccount} /> : null}
      {step === 3 ? <HealthStep onNext={() => setStep(4)} /> : null}
      {step === 4 ? <DeviceStep onDone={done} /> : null}
    </Screen>
  );
}

/* ---------- shared form state across steps 1 and 2 lives in components/signup/form ---------- */

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

  // Once the code or link is sent, your account (and username) exists, so it would show as taken.
  const locked = !!sent.to;

  const onUsername = (raw: string) => {
    const u = cleanUsername(raw);
    set('username', u);
    clearTimeout(check.current);
    if (!u || usernameError(u)) return setUserState('idle');
    if (u === sent.to?.username) return setUserState('free');
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

    if (f.username === sent.to?.username) return onNext();
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

  // A different email means a new account, with a new username.
  const startOver = () => {
    sent.to = null;
    const next = { ...f, email: '', username: '' };
    Object.assign(form, next);
    setF(next);
    setUserState('idle');
  };

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
        editable={!locked}
        invalid={!!e.username || userState === 'taken'}
        hint={locked ? <Text variant="small" weight={600} color="sec">{t('Your account was made with this username. You can change it later in Account.')}</Text> : userHint}
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
        editable={!locked}
        error={e.email ? t(e.email) : null}
        hint={locked ? <Text variant="small" weight={600} color="sec">{t(EMAIL_CODES ? 'We already sent a code here. Tap Next to enter it or get a new one.' : 'We already sent a link here. Tap Next to check it or get a new one.')}</Text> : null}
      />
      {locked ? (
        <Pressable onPress={startOver} hitSlop={8} style={{ alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center', marginTop: -4, marginHorizontal: 4 }}>
          <Text variant="small" weight={700} color="link">{t('Use a different email')}</Text>
        </Pressable>
      ) : null}
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
        editable={!locked}
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
        editable={!locked}
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
        {t('By continuing you agree to the')}{' '}
        <Text variant="small" weight={700} color="link" onPress={() => router.push({ pathname: '/legal', params: { doc: 'terms' } })} accessibilityRole="link">
          {t('Terms')}
        </Text>{' '}
        {t('and')}{' '}
        <Text variant="small" weight={700} color="link" onPress={() => router.push('/legal')} accessibilityRole="link">
          {t('Privacy Policy')}
        </Text>
        .
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
  // Already sent (you went back and pressed Next again): show the code or link screen, with Resend.
  const [isSent, setSent] = useState(!!sent.to && sent.to.email === form.email);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
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
    sent.to = { username: form.username, email: form.email };
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
    if (resending) return;
    setResending(true);
    const r = await auth.resendSignup(form.email);
    setResending(false);
    if (r.error) return setError(r.error);
    setLeft(30);
    toast(t(EMAIL_CODES ? 'New code sent' : 'New link sent'), { icon: 'mail' });
  };

  // Link mode: tapping the link in another tab logs this tab in too; move on when it does.
  const loggedIn = !!auth.session;
  useEffect(() => {
    if (!EMAIL_CODES && isSent && loggedIn) {
      form.password = '';
      form.password2 = '';
      onVerified();
    }
  }, [isSent, loggedIn, onVerified]);

  const checkLink = async () => {
    setBusy(true);
    setError(null);
    const r = await auth.checkConfirmed(form.email, form.password);
    setBusy(false);
    if (r.error) return setError(r.error);
    toast(t('Email confirmed'), { icon: 'check' });
  };

  if (!isSent)
    return (
      <View>
        <Text variant="h1">{t('Verify your account')}</Text>
        <Text color="sec" style={{ marginTop: 4 }}>
          {t(EMAIL_CODES ? 'We’ll send you a 6-digit code. Where should it go?' : 'We’ll email you a link to confirm it’s you.')}
        </Text>
        <View style={{ marginTop: 16 }}>
          <Option icon="mail" title={t('Email')} subtitle={form.email} selected />
          <Option icon="phone" title={t('Text message (SMS)')} subtitle={t('Coming soon')} disabled />
        </View>
        {error ? <ErrorText>{t(error)}</ErrorText> : null}
        <View style={{ marginTop: 24 }}>
          <Button title={t(EMAIL_CODES ? 'Send code' : 'Send link')} onPress={send} loading={busy} />
        </View>
        <Button title={t('Change my details')} kind="ghost" style={{ marginTop: 8 }} onPress={onBack} />
      </View>
    );

  if (!EMAIL_CODES)
    return (
      <View>
        <Text variant="h1">{t('Check your email')}</Text>
        <Text color="sec" style={{ marginTop: 4 }}>
          {t('We sent a link to')} <Text weight={700}>{form.email}</Text>
          {'. '}
          {t('Open it on this phone and tap “Confirm email address”. It brings you back here.')}
        </Text>
        {error ? <ErrorText>{t(error)}</ErrorText> : null}
        <View style={{ marginTop: 24 }}>
          <Button title={t('I’ve confirmed my email')} onPress={checkLink} loading={busy} />
        </View>
        <View style={{ alignItems: 'center', marginTop: 16 }}>
          {left > 0 ? (
            <Text variant="small" weight={700} color="sec">{t('Resend link in 0:{s}', { s: String(left).padStart(2, '0') })}</Text>
          ) : (
            <Pressable onPress={resend} disabled={resending} hitSlop={8}>
              <Text variant="small" weight={700} color="link">{t('Resend link')}</Text>
            </Pressable>
          )}
        </View>
        <Text variant="xs" color="sec" center style={{ marginTop: 8 }}>
          {t('Can’t find it? Check your spam folder.')}
        </Text>
        <Button title={t('Change my details')} kind="ghost" style={{ marginTop: 16 }} onPress={onBack} />
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
          <Pressable onPress={resend} disabled={resending} hitSlop={8}>
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
/** The Terms say you must be 16 or older (legal.tsx). */
const MIN_AGE = 16;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function About({ onDone }: { onDone: () => void }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const auth = useAuth();
  const toast = useToast();
  const [gender, setGender] = useState<'male' | 'female' | null>(auth.profile?.gender ?? null);
  const [dob, setDob] = useState<Dob | null>(null);
  // The wheel starts on a sample date; it only counts once you've moved it.
  const [dobPicked, setDobPicked] = useState(false);
  const [dobOpen, setDobOpen] = useState(false);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [e, setE] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const thisYear = new Date().getFullYear();

  const liveHeight = height && (Number(height) > 230 || (height.length >= 3 && Number(height) < 120)) ? 'Height must be 120 to 230 cm.' : '';
  const liveWeight = weight && (parseFloat(weight) > 250 || (weight.replace('.', '').length >= 2 && parseFloat(weight) < 30)) ? 'Weight must be 30 to 250 kg.' : '';

  const save = async () => {
    const err: Errors = {};
    if (!gender) err.gender = 'Choose one.';
    if (!dob || !dobPicked) err.dob = 'Pick your date of birth.';
    else {
      const a = ageFrom(dob);
      if (!(a >= MIN_AGE && a <= 100)) err.dob = 'You need to be 16 to 100 years old.';
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
    toast(t('Welcome to Adro'), { icon: 'check' });
    // Next: connect a health app and a device; then Home asks "Got an invite code?" and opens the daily check-in.
    onDone();
  };

  return (
    <View>
      <Text variant="h1">{t('A bit about you')}</Text>
      <Text color="sec" style={{ marginTop: 4 }}>
        {t('We use this to work out your calories. You can change it later.')}
      </Text>

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
          <Text weight={dob && dobPicked ? 700 : 400} color={dob && dobPicked ? 'text' : 'sec'} style={{ flex: 1 }}>
            {dob && dobPicked ? `${t(MONTHS[dob.m - 1])} ${dob.d}, ${dob.y}` : t('Choose your birthday')}
          </Text>
          {dob && dobPicked ? (
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
              onChange={([m, d, y]) => {
                setDob({ m, y, d: Math.min(d, daysIn(m, y)) });
                setDobPicked(true);
              }}
            />
          </View>
        ) : null}
      </View>
      <ErrorText>{e.dob ? t(e.dob) : null}</ErrorText>
      {dob && dobPicked && !e.dob && ageFrom(dob) >= MIN_AGE && ageFrom(dob) < 18 ? (
        <Text variant="small" color="sec" style={{ marginTop: 2, marginHorizontal: 4 }}>
          {t('Under 18: we keep you at maintenance so you have energy to grow.')}
        </Text>
      ) : null}

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

/* ---------- Step 3 for coaches: the coach application, in two pages ---------- */
const COACH_TYPES: { k: string; name: string; desc: string; icon: 'user' | 'globe' | 'users' }[] = [
  { k: 'Personal', name: 'Personal coach', desc: 'In person at a gym', icon: 'user' },
  { k: 'Online', name: 'Online coach', desc: 'Plans and check-ins in the app', icon: 'globe' },
  { k: 'Both', name: 'Both', desc: 'In person and online', icon: 'users' },
];
// Same choices as the coach application screen (the Adro team's review reads these).
const YEARS = ['Under 1', '1 to 2', '3 to 5', '6 to 10', 'Over 10'];

function CoachApplication() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const auth = useAuth();
  const toast = useToast();
  const [page, setPage] = useState(0);
  const [type, setType] = useState<string | null>(null);
  const [gym, setGym] = useState('');
  const [hours, setHours] = useState<GymHours[]>([]);
  const [years, setYears] = useState<string | null>(null);
  const [spec, setSpec] = useState<string[]>([]);
  const [certs, setCerts] = useState('');
  const [socials, setSocials] = useState<Record<string, string>>({});
  const [bio, setBio] = useState('');
  const [e, setE] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [hasApp, setHasApp] = useState(false);

  // Already applied (e.g. came back through the email link): go home.
  useEffect(() => {
    let alive = true;
    myApplication().then((a) => alive && a && setHasApp(true));
    return () => {
      alive = false;
    };
  }, []);
  if (hasApp) return <Redirect href="/home" />;

  const check = () => {
    const er: Errors = {};
    if (!type) er.ctype = 'Pick how you coach.';
    else if (type !== 'Online' && !gym.trim()) er.gym = 'Add the gym you coach at.';
    if (!years) er.cyears = 'Pick one.';
    setE(er);
    return !Object.keys(er).length;
  };

  const next = async () => {
    if (!check()) return setPage(0);
    if (page === 0) return setPage(1);
    setBusy(true);
    const clean = Object.fromEntries(Object.entries(socials).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v));
    const ok = await applyCoach({
      coach_type: type!,
      gym: type === 'Online' ? '' : gym.trim(),
      city: '',
      years: years!,
      specialties: spec,
      certs: certs.trim(),
      socials: clean,
      bio: bio.trim(),
      hours: type === 'Online' ? [] : hours.filter((h) => h.days.length),
    });
    setBusy(false);
    if (!ok) return setE({ save: 'Couldn’t send. Please try again.' });
    await auth.refreshProfile().catch(() => null);
    toast(t('Application sent. We usually reply within 2 days.'), { icon: 'check' });
    // Sign-up is done for coaches here: ask once for notifications.
    resetSignupForm();
    await askNotifPermission().catch(() => false);
    router.replace('/home');
    setTimeout(() => router.push('/coachapp'), 400);
  };

  return (
    <View>
      <Text variant="h1">{t(page ? 'Proof and links' : 'Your coach application')}</Text>
      <Text color="sec" style={{ marginTop: 4 }}>
        {t(page ? 'Optional, but it helps us approve you faster.' : 'Tell us how you coach. It takes 2 minutes.')}
      </Text>
      {page === 0 ? (
        <>
          <Card style={{ marginTop: 16, flexDirection: 'row', gap: 12, alignItems: 'flex-start', padding: 14 }}>
            <Icon name="info" size={18} color={c.cobalt} />
            <Text variant="small" style={{ flex: 1 }}>
              {t('Our team checks every coach before they can take clients. You can use Adro for your own training while you wait.')}
            </Text>
          </Card>
          <Label>{t('How do you coach?')}</Label>
          <Row gap={8} style={{ alignItems: 'stretch' }}>
            {COACH_TYPES.map((x) => (
              <Springy
                key={x.k}
                onPress={() => {
                  setType(x.k);
                  setE({ ...e, ctype: undefined });
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: type === x.k }}
                style={{ flex: 1, backgroundColor: c.card, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center', borderWidth: 2, borderColor: type === x.k ? c.cobalt : 'transparent' }}>
                <Icon name={x.icon} size={22} color={type === x.k ? c.cobalt : c.sec} />
                <Text variant="small" weight={700} center style={{ marginTop: 4 }}>
                  {t(x.name)}
                </Text>
                <Text variant="xs" color="sec" center style={{ marginTop: 2, lineHeight: 15 }}>
                  {t(x.desc)}
                </Text>
              </Springy>
            ))}
          </Row>
          <ErrorText>{e.ctype ? t(e.ctype) : null}</ErrorText>
          {type && type !== 'Online' ? (
            <>
              <Field
                label={t('The gym you coach at')}
                value={gym}
                onChangeText={(v) => {
                  setGym(v);
                  setE({ ...e, gym: undefined });
                }}
                placeholder={t('Fitness Time, Olaya')}
                maxLength={80}
                error={e.gym ? t(e.gym) : null}
              />
              <Label optional={t('(optional)')}>{t('When you’re at the gym')}</Label>
              <Text variant="xs" color="sec" style={{ marginTop: -4, marginBottom: 8, marginHorizontal: 4 }}>
                {t('Clients can ask to meet you at these times.')}
              </Text>
              <GymHoursEditor value={hours} onChange={setHours} />
            </>
          ) : null}
          <Label>{t('Years coaching')}</Label>
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            {YEARS.map((y) => (
              <Chip
                key={y}
                title={t(y)}
                on={years === y}
                onPress={() => {
                  setYears(y);
                  setE({ ...e, cyears: undefined });
                }}
              />
            ))}
          </Row>
          <ErrorText>{e.cyears ? t(e.cyears) : null}</ErrorText>
          <Label>{t('You specialize in')}</Label>
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            {SPECIALTIES.map((x) => (
              <Chip key={x} title={t(x)} on={spec.includes(x)} onPress={() => setSpec(spec.includes(x) ? spec.filter((y) => y !== x) : [...spec, x])} />
            ))}
          </Row>
        </>
      ) : (
        <>
          <Field
            label={t('Certificates')}
            optional={t('(optional)')}
            value={certs}
            onChangeText={setCerts}
            placeholder={t('For example: ACE, NASM, ISSA, or a local license')}
            multiline
            maxLength={500}
            style={{ minHeight: 72, paddingTop: 12 }}
          />
          <Label optional={t('(optional)')}>{t('Social media and website')}</Label>
          {SOCIALS.slice(0, 4).map(([k, ph]) => (
            <Field key={k} label={k} value={socials[k] ?? ''} onChangeText={(v) => setSocials({ ...socials, [k]: v })} placeholder={ph} autoCapitalize="none" autoCorrect={false} maxLength={80} ltr />
          ))}
          <Field label={t('About you')} optional={t('(optional)')} value={bio} onChangeText={setBio} placeholder={t('Who you coach and how')} multiline maxLength={200} style={{ minHeight: 84, paddingTop: 12 }} />
        </>
      )}
      <ErrorText>{e.save ? t(e.save) : null}</ErrorText>
      <View style={{ marginTop: 24 }}>
        <Button title={t(page ? 'Send application' : 'Next')} onPress={next} loading={busy} />
      </View>
      {page ? <Button title={t('Back')} kind="ghost" style={{ marginTop: 8 }} onPress={() => setPage(0)} /> : null}
    </View>
  );
}
