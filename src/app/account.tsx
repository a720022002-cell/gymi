import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Field, PasswordMeter } from '@/components/Field';
import { Icon, type IconName } from '@/components/Icon';
import { OtpInput } from '@/components/OtpInput';
import { PhoneField } from '@/components/PhoneField';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { List, ListRow } from '@/components/social/List';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, ErrorText, Row, Segmented } from '@/components/ui';
import { Wheel } from '@/components/Wheel';
import { useT } from '@/i18n';
import { type Profile, useAuth } from '@/lib/auth';
import { EMAIL_CODES } from '@/lib/config';
import { COUNTRIES } from '@/lib/countries';
import { useFood } from '@/lib/food';
import { ageFromIso, recalcTargets } from '@/lib/nutrition';
import { supabase } from '@/lib/supabase';
import { ageFrom, cleanUsername, daysIn, type Dob, dobToIso, emailError, fullPhone, passwordError, phoneMessage, usernameError } from '@/lib/validation';
import { useSettings } from '@/theme/settings';

type K = 'name' | 'username' | 'email' | 'phone' | 'password' | 'gender' | 'dob' | 'height';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "+966 55 123 4567" back to the country and digits for the phone field. */
function splitPhone(p: string | null | undefined): { iso: string; digits: string } {
  const d = (p ?? '').replace(/\D/g, '');
  const hit = [...COUNTRIES].sort((a, b) => b.code.length - a.code.length).find((c) => d.startsWith(c.code));
  return hit ? { iso: hit.iso, digits: d.slice(hit.code.length) } : { iso: 'SA', digits: '' };
}
const isoToDob = (iso: string | null | undefined): Dob | null => {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
};

/** Account details: name, username, email, phone, password, and gender, birthday and height (design: account). */
export default function Account() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { profile, session, updateProfile } = useAuth();
  const food = useFood();
  const [open, setOpen] = useState<K | null>(null);

  const user = session?.user;
  const emailOk = !!user?.email_confirmed_at && !user?.new_email;
  const dob = isoToDob(profile?.date_of_birth);

  // Changing gender, birthday or height updates your calories and water (unless your coach set them).
  // Only the numbers are worked out again: your meals, recipes and anything you changed by hand stay.
  const savePerson = async (patch: Partial<Profile>) => {
    const prev = food.person;
    const r = await updateProfile(patch);
    if (r.error) return r.error;
    if (food.setupDone && !food.coachTargets) {
      const next = { ...profile, ...patch };
      await food.savePlan(recalcTargets(food.plan, { gender: next.gender ?? null, age: ageFromIso(next.date_of_birth), height: Number(next.height_cm ?? 175) }, { prev }));
      toast(t('Saved. Your calorie and protein targets are updated.'), { icon: 'check' });
    } else toast(t('Saved'), { icon: 'check' });
    setOpen(null);
    return null;
  };

  const chip = (ok: boolean) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, height: 22, borderRadius: 11, backgroundColor: ok ? `${c.up}22` : '#F59E0B22' }}>
      {ok ? <Icon name="check" size={12} color={c.up} strokeWidth={2.6} /> : null}
      <Text variant="xs" weight={700} color={ok ? c.up : '#B45309'}>
        {ok ? t('Verified') : t('Not verified')}
      </Text>
    </View>
  );
  const row = (k: K, icon: IconName, title: string, value: string, right?: React.ReactNode, first?: boolean) => (
    <ListRow key={k} first={first} onPress={() => setOpen(k)}>
      <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={18} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text weight={700}>{title}</Text>
        <Text variant="small" color="sec" numberOfLines={1} style={{ writingDirection: k === 'email' || k === 'phone' || k === 'username' ? 'ltr' : undefined } as object}>
          {value}
        </Text>
      </View>
      {right}
      <Icon name="chev" size={16} color={c.sec} />
    </ListRow>
  );

  return (
    <Screen title={t('Account details')} back>
      <List>
        {row('name', 'user', t('Name'), profile?.name || t('Not set'), null, true)}
        {row('username', 'key', t('Username'), `@${profile?.username ?? ''}`)}
        {row('email', 'mail', t('Email'), user?.new_email ? t('{a}, changing to {b}', { a: user.email ?? '', b: user.new_email }) : (user?.email ?? ''), chip(emailOk))}
        {row('phone', 'phone', t('Phone number'), profile?.phone || t('Not set'), profile?.phone ? chip(false) : null)}
        {row('password', 'lock', t('Password'), t('Set'))}
      </List>
      <Text variant="small" weight={700} color="sec" style={{ marginTop: 6, marginBottom: 8, marginHorizontal: 4 }}>
        {t('About you')}
      </Text>
      <List>
        {row('gender', 'body', t('Gender'), profile?.gender ? t(profile.gender === 'male' ? 'Male' : 'Female') : t('Not set'), null, true)}
        {row('dob', 'cal', t('Date of birth'), dob ? `${t(MONTHS[dob.m - 1])} ${dob.d}, ${dob.y}, ${t('{n} years old', { n: ageFrom(dob) })}` : t('Not set'))}
        {row('height', 'ruler', t('Height'), profile?.height_cm ? `${Number(profile.height_cm)} ${t('cm')}` : t('Not set'))}
      </List>
      <Text variant="xs" color="sec" style={{ marginHorizontal: 4 }}>
        {t('Changing your details can update your calorie and protein targets.')}
      </Text>

      <Sheet open={!!open} onClose={() => setOpen(null)}>
        {open === 'name' ? <NameSheet onClose={() => setOpen(null)} /> : null}
        {open === 'username' ? <UsernameSheet onClose={() => setOpen(null)} /> : null}
        {open === 'email' ? <EmailSheet onClose={() => setOpen(null)} /> : null}
        {open === 'phone' ? <PhoneSheet onClose={() => setOpen(null)} /> : null}
        {open === 'password' ? <PasswordSheet onClose={() => setOpen(null)} /> : null}
        {open === 'gender' || open === 'dob' || open === 'height' ? <PersonSheet k={open} onSave={savePerson} onClose={() => setOpen(null)} /> : null}
      </Sheet>
    </Screen>
  );
}

function NameSheet({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const toast = useToast();
  const { profile, updateProfile } = useAuth();
  const [v, setV] = useState(profile?.name ?? '');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <View>
      <Text variant="h2">{t('Name')}</Text>
      <Text variant="small" color="sec" style={{ marginTop: 4 }}>
        {t('Optional. Friends see your name next to your username.')}
      </Text>
      <Field value={v} onChangeText={setV} placeholder={t('Your name')} autoComplete="name" maxLength={60} />
      <ErrorText>{err}</ErrorText>
      <Button
        title={t('Save')}
        loading={busy}
        style={{ marginTop: 16 }}
        onPress={async () => {
          setBusy(true);
          const r = await updateProfile({ name: v.trim() || null });
          setBusy(false);
          if (r.error) return setErr(t(r.error));
          onClose();
          toast(t('Saved'), { icon: 'check' });
        }}
      />
      <Button kind="ghost" title={t('Cancel')} style={{ marginTop: 8 }} onPress={onClose} />
    </View>
  );
}

/** Change username with a live check and suggestions (design: SH.chuser). */
function UsernameSheet({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { profile, updateProfile, usernameAvailable } = useAuth();
  const mine = profile?.username ?? '';
  const [v, setV] = useState(mine);
  const [state, setState] = useState<'same' | 'checking' | 'free' | 'taken' | 'bad' | 'idle'>('same');
  const [sugg, setSugg] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef(mine);
  useEffect(() => () => clearTimeout(timer.current), []);

  const onType = (raw: string) => {
    const u = cleanUsername(raw);
    setV(u);
    latest.current = u;
    clearTimeout(timer.current);
    if (u === mine) return setState('same');
    if (usernameError(u)) return setState('bad');
    setState('checking');
    timer.current = setTimeout(async () => {
      const ok = await usernameAvailable(u);
      if (latest.current !== u) return;
      if (ok !== false) return setState(ok ? 'free' : 'idle');
      setState('taken');
      const b = u.replace(/[._]+$/, '') || 'gymi';
      const tries = [`${b}_fit`, `${b}.gym`, `${b}26`].filter((x) => !usernameError(x));
      const free = await Promise.all(tries.map(async (x) => ((await usernameAvailable(x)) ? x : null)));
      if (latest.current === u) setSugg(free.filter(Boolean).slice(0, 3) as string[]);
    }, 450);
  };

  const msg =
    state === 'same' ? (
      <Text variant="small" weight={700} color="sec">{t('This is your username now.')}</Text>
    ) : state === 'bad' ? (
      <Text variant="small" weight={700} color="down">{t(usernameError(v))}</Text>
    ) : state === 'checking' ? (
      <Text variant="small" weight={700} color="sec">{t('Checking…')}</Text>
    ) : state === 'free' ? (
      <Row gap={4}>
        <Icon name="check" size={15} color={c.up} strokeWidth={2.6} />
        <Text variant="small" weight={700} color="up">{t('@{u} is available', { u: v })}</Text>
      </Row>
    ) : state === 'taken' ? (
      <View>
        <Text variant="small" weight={700} color="down">{t('@{u} is taken. Try:', { u: v })}</Text>
        <Row gap={6} style={{ flexWrap: 'wrap', marginTop: 4 }}>
          {sugg.map((s) => (
            <Pressable key={s} onPress={() => onType(s)} style={{ backgroundColor: c.inset, borderRadius: 14, height: 28, paddingHorizontal: 10, justifyContent: 'center' }}>
              <Text variant="small" weight={600}>{`@${s}`}</Text>
            </Pressable>
          ))}
        </Row>
      </View>
    ) : null;

  return (
    <View>
      <Text variant="h2">{t('Change username')}</Text>
      <Text variant="small" color="sec" style={{ marginTop: 4 }}>
        {t('Friends find you with it. Your old username stops working right away.')}
      </Text>
      <Field value={v} onChangeText={onType} prefix="@" autoCapitalize="none" autoCorrect={false} maxLength={20} ltr invalid={state === 'taken' || state === 'bad'} hint={msg} />
      <Text variant="xs" color="sec" style={{ marginTop: 8 }}>
        {t('3 to 20 characters. Letters, numbers, dots and underscores. Start with a letter.')}
      </Text>
      <Button
        title={t('Save')}
        disabled={state !== 'free'}
        loading={busy}
        style={{ marginTop: 16 }}
        onPress={async () => {
          setBusy(true);
          const r = await updateProfile({ username: v });
          setBusy(false);
          if (r.error) return setState('taken');
          onClose();
          toast(t('Username changed to @{u}', { u: v }), { icon: 'check' });
        }}
      />
      <Button kind="ghost" title={t('Cancel')} style={{ marginTop: 8 }} onPress={onClose} />
    </View>
  );
}

/** New email: a 6-digit code to the new address when email codes are on, otherwise a confirm link (design: SH.contact). */
function EmailSheet({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const toast = useToast();
  const { session, refreshProfile } = useAuth();
  const cur = session?.user.email ?? '';
  const [step, setStep] = useState<'enter' | 'code'>('enter');
  const [v, setV] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const e = v.trim().toLowerCase();
    if (emailError(e)) return setErr(t('Enter a valid email.'));
    if (e === cur) return setErr(t('That’s already your email.'));
    setBusy(true);
    setErr(null);
    const { error } = await supabase.auth.updateUser({ email: e });
    setBusy(false);
    if (error) return setErr(t('Couldn’t change the email. It may already be used.'));
    if (EMAIL_CODES) return setStep('code');
    onClose();
    toast(t('Check both inboxes to confirm the new email.'), { icon: 'mail' });
  };
  const verify = async (token: string) => {
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ email: v.trim().toLowerCase(), token, type: 'email_change' });
    setBusy(false);
    if (error) {
      setCode('');
      return setErr(t('That code is wrong or expired. Try again or resend it.'));
    }
    await refreshProfile();
    onClose();
    toast(t('Email updated and verified'), { icon: 'check' });
  };

  if (step === 'code')
    return (
      <View>
        <Text variant="h2">{t('Enter the code')}</Text>
        <Text variant="small" color="sec" style={{ marginTop: 4 }}>
          {t('We sent a 6-digit code to')} <Text weight={700}>{v}</Text>
        </Text>
        <OtpInput value={code} onChange={(x) => { setCode(x); setErr(null); }} onComplete={verify} error={!!err} />
        <ErrorText>{busy ? t('Checking…') : err}</ErrorText>
        <Button kind="ghost" title={t('Change email')} style={{ marginTop: 8 }} onPress={() => setStep('enter')} />
      </View>
    );
  return (
    <View>
      <Text variant="h2">{t('Change email')}</Text>
      <Text variant="small" color="sec" style={{ marginTop: 4 }}>
        {EMAIL_CODES
          ? t('Now: {x}. We’ll send a code to the new email to confirm it’s yours.', { x: cur })
          : t('Now: {x}. We’ll send a link to the new email. The change happens when you open it.', { x: cur })}
      </Text>
      <Field value={v} onChangeText={(x) => { setV(x.trim()); setErr(null); }} placeholder="new@example.com" keyboardType="email-address" inputMode="email" autoCapitalize="none" autoComplete="email" ltr />
      <ErrorText>{err}</ErrorText>
      <Button title={EMAIL_CODES ? t('Send code') : t('Send link')} loading={busy} style={{ marginTop: 16 }} onPress={send} />
      <Button kind="ghost" title={t('Cancel')} style={{ marginTop: 8 }} onPress={onClose} />
    </View>
  );
}

/** Phone number with the country code picker. Checking it by text message comes later. */
function PhoneSheet({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const toast = useToast();
  const { profile, updateProfile } = useAuth();
  const start = splitPhone(profile?.phone);
  const [iso, setIso] = useState(start.iso);
  const [digits, setDigits] = useState(start.digits);
  const [check, setCheck] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <View>
      <Text variant="h2">{t('Change phone number')}</Text>
      <Text variant="small" color="sec" style={{ marginTop: 4 }}>
        {profile?.phone ? t('Now: {x}.', { x: profile.phone }) : ''} {t('Checking it with a text message is coming soon.')}
      </Text>
      <PhoneField iso={iso} digits={digits} onChange={(i, d) => { setIso(i); setDigits(d); setErr(null); }} forceCheck={check} />
      <ErrorText>{err}</ErrorText>
      <Button
        title={t('Save')}
        loading={busy}
        style={{ marginTop: 16 }}
        onPress={async () => {
          setCheck(true);
          if (phoneMessage(iso, digits, true)[0] === 'bad') return;
          const p = fullPhone(iso, digits);
          if (p === profile?.phone) return setErr(t('That’s already your number.'));
          setBusy(true);
          const r = await updateProfile({ phone: p });
          setBusy(false);
          if (r.error) return setErr(t(r.error));
          onClose();
          toast(t('Phone number updated'), { icon: 'check' });
        }}
      />
      <Button kind="ghost" title={t('Cancel')} style={{ marginTop: 8 }} onPress={onClose} />
    </View>
  );
}

/** Change password: your current one first (design: SH.password). */
function PasswordSheet({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const toast = useToast();
  const { session, sendReset } = useAuth();
  const [cur, setCur] = useState('');
  const [n1, setN1] = useState('');
  const [n2, setN2] = useState('');
  const [e, setE] = useState<{ cur?: string; n1?: string; n2?: string }>({});
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const er: typeof e = {};
    if (!cur) er.cur = 'Enter your current password.';
    const pe = passwordError(n1);
    if (pe) er.n1 = pe;
    else if (n1 !== n2) er.n2 = 'The passwords don’t match.';
    setE(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    // The server checks your current password too (not just the app).
    const { error } = await supabase.auth.updateUser({ password: n1, current_password: cur });
    setBusy(false);
    if (error && (error.code === 'current_password_invalid' || error.code === 'current_password_required')) return setE({ cur: 'That password is not right.' });
    if (error) return setE({ n1: error.message.toLowerCase().includes('different') ? 'Use a password you haven’t used here before.' : 'Couldn’t change the password. Please try again.' });
    onClose();
    toast(t('Password saved'), { icon: 'lock' });
  };
  return (
    <View>
      <Text variant="h2">{t('Change password')}</Text>
      <Field label={t('Current password')} value={cur} onChangeText={setCur} secureTextEntry autoComplete="current-password" autoCapitalize="none" ltr error={e.cur ? t(e.cur) : null} />
      <Field label={t('New password')} value={n1} onChangeText={setN1} secureTextEntry autoComplete="new-password" autoCapitalize="none" ltr error={e.n1 ? t(e.n1) : null} hint={<PasswordMeter value={n1} />} />
      <Field label={t('Confirm new password')} value={n2} onChangeText={setN2} secureTextEntry autoComplete="new-password" autoCapitalize="none" ltr error={e.n2 ? t(e.n2) : null} />
      <Button title={t('Save password')} loading={busy} style={{ marginTop: 16 }} onPress={save} />
      <Button
        kind="ghost"
        title={t('Forgot current password?')}
        style={{ marginTop: 8 }}
        onPress={async () => {
          const email = session?.user.email ?? '';
          const r = await sendReset(email);
          onClose();
          toast(r.error ? t(r.error) : t('Reset link sent to {e}', { e: email }), { icon: 'mail' });
        }}
      />
    </View>
  );
}

/** Gender, date of birth (wheel like sign up) or height (design: SH.pfield). */
function PersonSheet({ k, onSave, onClose }: { k: 'gender' | 'dob' | 'height'; onSave: (p: Partial<Profile>) => Promise<string | null>; onClose: () => void }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const { profile } = useAuth();
  const [gender, setGender] = useState<'male' | 'female' | null>(profile?.gender ?? null);
  const [dob, setDob] = useState<Dob>(isoToDob(profile?.date_of_birth) ?? { y: 1997, m: 1, d: 1 });
  const [height, setHeight] = useState(profile?.height_cm ? String(Number(profile.height_cm)) : '');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const thisYear = new Date().getFullYear();

  const save = async () => {
    let patch: Partial<Profile>;
    if (k === 'gender') {
      if (!gender) return setErr(t('Choose one.'));
      patch = { gender };
    } else if (k === 'dob') {
      const a = ageFrom(dob);
      if (a < 13 || a > 100) return setErr(t('You need to be 13 to 100 years old.'));
      patch = { date_of_birth: dobToIso(dob) };
    } else {
      const h = Number(height);
      if (!(h >= 120 && h <= 230)) return setErr(t('Height must be 120 to 230 cm.'));
      patch = { height_cm: h };
    }
    setBusy(true);
    const e = await onSave(patch);
    setBusy(false);
    if (e) setErr(t(e));
  };

  return (
    <View>
      <Text variant="h2">{k === 'gender' ? t('Gender') : k === 'dob' ? t('Date of birth') : t('Height')}</Text>
      {k === 'gender' ? (
        <View style={{ marginTop: 12 }}>
          <Segmented
            value={gender}
            options={[
              { value: 'male', label: t('Male') },
              { value: 'female', label: t('Female') },
            ]}
            onChange={setGender}
          />
        </View>
      ) : k === 'dob' ? (
        <View style={{ marginTop: 12, backgroundColor: c.card, borderRadius: 22, paddingVertical: 8 }}>
          <Wheel
            columns={[
              { items: MONTHS.map((n, i) => ({ value: i + 1, label: t(n) })), selected: dob.m, width: 80 },
              { items: Array.from({ length: 31 }, (_, i) => ({ value: i + 1, label: String(i + 1) })), selected: dob.d, width: 60 },
              { items: Array.from({ length: thisYear - 1920 + 1 }, (_, i) => ({ value: 1920 + i, label: String(1920 + i) })), selected: dob.y, width: 90 },
            ]}
            onChange={([m, d, y]) => setDob({ m, y, d: Math.min(d, daysIn(m, y)) })}
          />
          <Text variant="small" weight={700} color="sec" center>
            {t('{n} years old', { n: ageFrom(dob) })}
          </Text>
        </View>
      ) : (
        <Field value={height} onChangeText={(v) => setHeight(v.replace(/\D/g, '').slice(0, 3))} unit={t('cm')} keyboardType="number-pad" inputMode="numeric" placeholder="178" ltr />
      )}
      <ErrorText>{err}</ErrorText>
      <Button title={t('Save')} loading={busy} style={{ marginTop: 16 }} onPress={save} />
      <Button kind="ghost" title={t('Cancel')} style={{ marginTop: 8 }} onPress={onClose} />
    </View>
  );
}
