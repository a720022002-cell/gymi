import { useState } from 'react';
import { View } from 'react-native';

import { Field, PasswordMeter } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { List, ListRow } from '@/components/social/List';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, ErrorText } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { cleanUsername, emailError, passwordError, usernameError } from '@/lib/validation';
import { useSettings } from '@/theme/settings';

type K = 'name' | 'username' | 'phone' | 'email' | 'password';

/** Account details: name, username, email, phone and password (design: account). */
export default function Account() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { profile, session, updateProfile, usernameAvailable } = useAuth();
  const [open, setOpen] = useState<K | null>(null);
  const [v, setV] = useState('');
  const [v2, setV2] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const start = (k: K) => {
    setOpen(k);
    setErr(null);
    setV2('');
    setV(k === 'password' ? '' : k === 'email' ? (session?.user.email ?? '') : ((profile?.[k] as string | null) ?? ''));
  };

  const save = async () => {
    if (!open) return;
    setErr(null);
    setBusy(true);
    try {
      if (open === 'name') {
        if (!v.trim()) return setErr(t('Enter your name.'));
        const r = await updateProfile({ name: v.trim().slice(0, 60) });
        if (r.error) return setErr(t(r.error));
      } else if (open === 'username') {
        const u = cleanUsername(v);
        const e = usernameError(u);
        if (e) return setErr(t(e));
        if (u !== profile?.username) {
          const free = await usernameAvailable(u);
          if (!free) return setErr(t('That username is taken.'));
          const r = await updateProfile({ username: u });
          if (r.error) return setErr(t(r.error));
        }
      } else if (open === 'phone') {
        const p = v.replace(/[^\d+ ]/g, '').trim().slice(0, 20);
        const r = await updateProfile({ phone: p || null });
        if (r.error) return setErr(t(r.error));
      } else if (open === 'email') {
        const e = emailError(v);
        if (e) return setErr(t(e));
        const { error } = await supabase.auth.updateUser({ email: v.trim().toLowerCase() });
        if (error) return setErr(t('Couldn’t change the email. It may already be used.'));
        setOpen(null);
        return toast(t('Check both inboxes to confirm the new email.'), { icon: 'mail' });
      } else if (open === 'password') {
        const e = passwordError(v);
        if (e) return setErr(t(e));
        if (v !== v2) return setErr(t('The passwords don’t match.'));
        const { error } = await supabase.auth.updateUser({ password: v });
        if (error) return setErr(t('Couldn’t change the password. Log out and in again, then try.'));
      }
      setOpen(null);
      toast(t('Saved'), { icon: 'check' });
    } finally {
      setBusy(false);
    }
  };

  const rows: [K, string, string][] = [
    ['name', 'Name', profile?.name || t('Not set')],
    ['username', 'Username', `@${profile?.username ?? ''}`],
    ['email', 'Email', session?.user.email ?? ''],
    ['phone', 'Phone number', profile?.phone || t('Not set')],
    ['password', 'Password', '••••••••'],
  ];
  return (
    <Screen title={t('Account details')} back>
      <List>
        {rows.map(([k, n, val], i) => (
          <ListRow key={k} first={!i} onPress={() => start(k)}>
            <Text weight={700} style={{ flex: 1 }}>
              {t(n)}
            </Text>
            <Text variant="small" color="sec" numberOfLines={1} style={{ maxWidth: '55%', writingDirection: 'ltr' } as object}>
              {val}
            </Text>
          </ListRow>
        ))}
      </List>
      <Text variant="xs" color="sec" style={{ marginHorizontal: 4 }}>
        {t('Your username is how friends find you in Gym Bros.')}
      </Text>
      <Sheet open={!!open} onClose={() => setOpen(null)}>
        {open ? (
          <View>
            <Text variant="h2">{t(open === 'password' ? 'Change password' : open === 'email' ? 'Change email' : open === 'username' ? 'Change username' : open === 'phone' ? 'Phone number' : 'Name')}</Text>
            {open === 'password' ? (
              <>
                <Field label={t('New password')} value={v} onChangeText={setV} secureTextEntry autoCapitalize="none" />
                <PasswordMeter value={v} />
                <Field label={t('Type it again')} value={v2} onChangeText={setV2} secureTextEntry autoCapitalize="none" />
              </>
            ) : (
              <Field
                label={t(open === 'email' ? 'Email' : open === 'username' ? 'Username' : open === 'phone' ? 'Phone number' : 'Name')}
                value={v}
                onChangeText={(x) => setV(open === 'username' ? cleanUsername(x) : x)}
                prefix={open === 'username' ? '@' : undefined}
                autoCapitalize={open === 'name' ? 'words' : 'none'}
                keyboardType={open === 'email' ? 'email-address' : open === 'phone' ? 'phone-pad' : 'default'}
                ltr={open !== 'name'}
                maxLength={open === 'username' ? 20 : 60}
              />
            )}
            {open === 'email' ? (
              <Text variant="small" color="sec" style={{ marginTop: 8 }}>
                {t('We’ll send a link to the new email. The change happens when you open it.')}
              </Text>
            ) : null}
            <ErrorText>{err}</ErrorText>
            <Button title={t('Save')} loading={busy} style={{ marginTop: 16 }} onPress={save} />
            <Button kind="ghost" title={t('Cancel')} style={{ marginTop: 8 }} onPress={() => setOpen(null)} />
          </View>
        ) : null}
      </Sheet>
      <View style={{ height: 1, backgroundColor: c.bg }} />
    </Screen>
  );
}
