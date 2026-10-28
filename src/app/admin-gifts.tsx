import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { Field } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Chip, Row } from '@/components/ui';
import { useT } from '@/i18n';
import { useIsAdmin } from '@/lib/admin';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/theme/settings';

type Gift = { id: string; username: string; name: string | null; days: number; starts_at: string; ends_at: string; note: string | null; created_at: string };

const LENGTHS: [number, string][] = [
  [7, '1 week'],
  [14, '2 weeks'],
  [30, '1 month'],
  [90, '3 months'],
  [180, '6 months'],
  [365, '1 year'],
];

/**
 * Gift Adro+ to someone by username, for a set time: no Apple subscription, nothing to pay, nothing renews. When it
 * ends they're back on the regular version. A second gift starts when the first ends.
 */
export default function AdminGifts() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const admin = useIsAdmin();
  const [user, setUser] = useState('');
  const [days, setDays] = useState(30);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  // The gifts and when they were loaded (to tell which are still on).
  const [list, setList] = useState<{ at: number; gifts: Gift[] } | null>(null);
  const date = (d: string) => new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(d));

  const load = useCallback(() => supabase.rpc('admin_gifts').then(({ data }) => setList({ at: Date.now(), gifts: (data as Gift[] | null) ?? [] })), []);
  useEffect(() => {
    if (admin) load();
  }, [admin, load]);

  if (!admin)
    return (
      <Screen title={t('Gift Adro+')} back>
        <Text color="sec">{t('Only the Adro team can open this page.')}</Text>
      </Screen>
    );

  const give = async () => {
    if (busy || !user.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('admin_give_gift', { p_username: user.trim(), p_days: days, p_note: note.trim() || null });
    setBusy(false);
    const r = data as { error?: string; username?: string; ends_at?: string } | null;
    if (error || !r) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
    if (r.error === 'no_user') return toast(t('No one with that username.'), { icon: 'warn' });
    toast(t('Adro+ for @{u} until {d}', { u: r.username ?? '', d: date(r.ends_at as string) }), { icon: 'star' });
    setUser('');
    setNote('');
    load();
  };

  const end = async (g: Gift) => {
    const { error } = await supabase.rpc('admin_end_gift', { p_id: g.id });
    if (error) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
    toast(t('Gift ended'), { icon: 'check' });
    load();
  };

  return (
    <Screen title={t('Gift Adro+')} back>
      <Text color="sec" style={{ marginTop: -8 }}>
        {t('Full Adro+ for a set time, with no subscription and nothing to pay. When it ends, they go back to the regular version.')}
      </Text>
      <Card style={{ marginTop: 12 }}>
        <Field label={t('Username')} value={user} onChangeText={setUser} autoCapitalize="none" autoCorrect={false} placeholder="@username" />
        <Text variant="small" weight={700} color="sec" style={{ marginTop: 14, marginBottom: 8 }}>
          {t('How long')}
        </Text>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          {LENGTHS.map(([d, l]) => (
            <Chip key={d} title={t(l)} on={days === d} onPress={() => setDays(d)} />
          ))}
        </Row>
        <View style={{ marginTop: 14 }}>
          <Field label={t('Note')} optional={t('(optional)')} value={note} onChangeText={setNote} maxLength={200} placeholder={t('For example: influencer, friend, competition winner')} />
        </View>
        <Button icon="star" title={t('Give Adro+')} loading={busy} disabled={!user.trim()} style={{ marginTop: 14 }} onPress={give} />
      </Card>

      <Text variant="small" weight={700} color="sec" style={{ marginTop: 18, marginBottom: 8, marginHorizontal: 4 }}>
        {t('Gifts')}
      </Text>
      {list === null ? null : list.gifts.length ? (
        <View style={{ backgroundColor: c.card, borderRadius: 22, overflow: 'hidden' }}>
          {list.gifts.map((g, i) => {
            const on = new Date(g.ends_at).getTime() > list.at;
            const later = new Date(g.starts_at).getTime() > list.at;
            return (
              <Row key={g.id} gap={10} style={{ paddingVertical: 12, paddingHorizontal: 16, borderTopWidth: i ? 1 : 0, borderTopColor: c.line, alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text weight={700}>{`@${g.username}`}</Text>
                  <Text variant="small" color="sec">
                    {later ? t('Starts {a}, ends {b}', { a: date(g.starts_at), b: date(g.ends_at) }) : on ? t('Until {d}', { d: date(g.ends_at) }) : t('Ended {d}', { d: date(g.ends_at) })}
                  </Text>
                  {g.note ? (
                    <Text variant="xs" color="sec" numberOfLines={1}>
                      {g.note}
                    </Text>
                  ) : null}
                </View>
                {on ? <Button small kind="soft" title={t('End')} color={c.down} onPress={() => end(g)} /> : null}
              </Row>
            );
          })}
        </View>
      ) : (
        <Text variant="small" color="sec" style={{ marginHorizontal: 4 }}>
          {t('No gifts yet.')}
        </Text>
      )}
      <Text variant="xs" color="sec" style={{ marginTop: 12, marginHorizontal: 4 }}>
        {t('Before launch every feature is open to everyone, so a gift shows its effect once subscriptions start.')}
      </Text>
    </Screen>
  );
}
