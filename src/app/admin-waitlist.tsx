import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { TextInput } from '@/components/TextInput';

import { Stepper } from '@/components/food/Stepper';
import { Thinking } from '@/components/food/Thinking';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Row, Springy, Toggle } from '@/components/ui';
import { useT } from '@/i18n';
import { useIsAdmin } from '@/lib/admin';
import { letIn, saveGateCode, setGateOn, waitBoard, type WaitBoard, type WaitRow } from '@/lib/gate';
import { useSettings } from '@/theme/settings';

const randCode = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

/** The team's waitlist: the gate switch, shared codes, numbers, and letting people in by priority. */
export default function AdminWaitlist() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const admin = useIsAdmin();
  const [b, setB] = useState<WaitBoard | null>(null);
  const [n, setN] = useState(10);
  const [busy, setBusy] = useState<string | null>(null);
  const [code, setCode] = useState(randCode());
  const [label, setLabel] = useState('');
  const [max, setMax] = useState('');
  const load = useCallback(() => {
    waitBoard().then(setB);
  }, []);
  useFocusEffect(
    useCallback(() => {
      if (admin) load();
    }, [admin, load]),
  );
  if (!admin)
    return (
      <Screen title={t('Waitlist')} back>
        <Text color="sec">{t('Only the Adro team can open this.')}</Text>
      </Screen>
    );
  if (!b)
    return (
      <Screen title={t('Waitlist')} back>
        <Thinking message={t('Loading')} />
      </Screen>
    );

  const day = (iso: string) => new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en-US', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
  const waiting = b.list.filter((x) => !x.invited_at);
  const invite = async (rows: WaitRow[]) => {
    if (!rows.length || busy) return;
    setBusy('invite');
    const sent = await letIn(rows.map((x) => x.id));
    setBusy(null);
    if (sent == null) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
    toast(t('{n} let in, {m} emails sent', { n: rows.length, m: sent }), { icon: 'check' });
    load();
  };
  const stat = (k: string, v: number) => (
    <View style={{ width: '33.33%', padding: 4 }}>
      <View style={{ backgroundColor: c.inset, borderRadius: 14, padding: 10 }}>
        <Text num size={20} weight={800}>
          {v}
        </Text>
        <Text variant="xs" color="sec">
          {k}
        </Text>
      </View>
    </View>
  );
  const field = { height: 44, borderRadius: 12, backgroundColor: c.inset, paddingHorizontal: 12, fontSize: 15, color: c.text } as const;

  return (
    <Screen title={t('Waitlist')} back>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text weight={700}>{t('Invite-only gate')}</Text>
            <Text variant="small" color="sec">
              {b.on ? t('On: new people need a code before they can sign up.') : t('Off: anyone can sign up.')}
            </Text>
          </View>
          <Toggle
            value={b.on}
            label={t('Invite-only gate')}
            onChange={async (on) => {
              if (await setGateOn(on)) load();
            }}
          />
        </Row>
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', margin: -4 }}>
          {stat(t('On the list'), b.total)}
          {stat(t('Today'), b.today)}
          {stat(t('This week'), b.week)}
          {stat(t('From a friend'), b.from_friends)}
          {stat(t('Let in'), b.invited)}
          {stat(t('Opened Adro'), b.opened)}
        </View>
      </Card>

      <Text variant="small" weight={700} color="sec" style={{ marginHorizontal: 4, marginTop: 6, marginBottom: 6 }}>
        {t('Let people in')}
      </Text>
      <Card>
        <Text variant="small" color="sec">
          {t('Top of the list first: most friends brought, then who joined first. Each gets a personal code by email.')}
        </Text>
        <View style={{ marginTop: 10 }}>
          <Stepper minusDisabled={n <= 1} onMinus={() => setN(Math.max(1, n - 5 >= 1 ? n - 5 : n - 1))} onPlus={() => setN(Math.min(200, n + 5))}>
            <Text variant="h2" num>
              {n}
            </Text>
          </Stepper>
        </View>
        <Button kind="cobalt" title={t('Let in the top {n}', { n: Math.min(n, waiting.length) })} disabled={!waiting.length} loading={busy === 'invite'} style={{ marginTop: 10 }} onPress={() => invite(waiting.slice(0, n))} />
      </Card>

      <Text variant="small" weight={700} color="sec" style={{ marginHorizontal: 4, marginTop: 6, marginBottom: 6 }}>
        {t('Shared codes')}
      </Text>
      <Card>
        {b.codes.map((x, i) => (
          <Row key={x.code} style={{ paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
            <View style={{ flex: 1 }}>
              <Text weight={800} style={{ letterSpacing: 2 }}>
                {x.code}
              </Text>
              <Text variant="xs" color="sec">
                {`${x.label ? `${x.label}${t(', ')}` : ''}${x.max ? t('{a} of {b} used', { a: x.uses, b: x.max }) : t('{a} used, no limit', { a: x.uses })}`}
              </Text>
            </View>
            <Toggle value={x.active} label={x.code} onChange={async (on) => (await saveGateCode(x.code, x.label, x.max, on)) && load()} />
          </Row>
        ))}
        <Text variant="xs" weight={700} color="sec" style={{ marginTop: b.codes.length ? 12 : 0 }}>
          {t('New code')}
        </Text>
        <Row gap={8} style={{ marginTop: 6 }}>
          <TextInput value={code} onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16))} autoCapitalize="characters" style={[field, { flex: 1, minWidth: 0, letterSpacing: 2 }]} />
          <Button small kind="soft" title={t('New')} onPress={() => setCode(randCode())} />
        </Row>
        <Row gap={8} style={{ marginTop: 8 }}>
          <TextInput value={label} onChangeText={(v) => setLabel(v.slice(0, 60))} placeholder={t('For whom, e.g. First 30 friends')} placeholderTextColor={c.sec} style={[field, { flex: 2, minWidth: 0 }]} />
          <TextInput value={max} onChangeText={(v) => setMax(v.replace(/\D/g, '').slice(0, 5))} placeholder={t('Max uses')} placeholderTextColor={c.sec} inputMode="numeric" style={[field, { flex: 1, minWidth: 0 }]} />
        </Row>
        <Button
          small
          kind="soft"
          icon="plus"
          title={t('Add code')}
          disabled={code.length < 4}
          style={{ marginTop: 8 }}
          onPress={async () => {
            if (!(await saveGateCode(code, label.trim(), max ? Number(max) : null))) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
            setCode(randCode());
            setLabel('');
            setMax('');
            load();
          }}
        />
      </Card>

      <Text variant="small" weight={700} color="sec" style={{ marginHorizontal: 4, marginTop: 6, marginBottom: 6 }}>
        {t('The list ({n})', { n: b.total })}
      </Text>
      <Card style={{ marginBottom: 24 }}>
        {b.list.length ? (
          b.list.map((x, i) => (
            <Row key={x.id} gap={10} style={{ paddingVertical: 9, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text weight={700} numberOfLines={1}>
                  {x.email}
                </Text>
                <Text variant="xs" color="sec">
                  {`${day(x.created_at)}${t(', ')}${t('code {c}', { c: x.ref })}${x.ref_by ? `${t(', ')}${t('from {c}', { c: x.ref_by })}` : ''}`}
                </Text>
                <Text variant="xs" weight={700} color={x.used_at ? c.up : x.invited_at ? c.cobalt : 'sec'}>
                  {x.used_at ? t('Opened Adro {d}', { d: day(x.used_at) }) : x.invited_at ? t('Let in, code {c}', { c: x.invite ?? '' }) : t('Waiting')}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text weight={800} num color={x.friends ? c.up : c.sec}>
                  {x.friends === 1 ? t('1 friend') : t('{n} friends', { n: x.friends })}
                </Text>
                {!x.invited_at ? (
                  <Springy onPress={() => invite([x])} accessibilityRole="button" style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: c.inset }}>
                    <Text variant="xs" weight={700}>
                      {t('Let in')}
                    </Text>
                  </Springy>
                ) : null}
              </View>
            </Row>
          ))
        ) : (
          <Text color="sec">{t('No one on the list yet.')}</Text>
        )}
      </Card>
    </Screen>
  );
}
