import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useState } from 'react';
import { Share, View } from 'react-native';

import { Field } from '@/components/Field';
import { Thinking } from '@/components/food/Thinking';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Chip, Row, Segmented } from '@/components/ui';
import { useT } from '@/i18n';
import { useIsAdmin } from '@/lib/admin';
import { addDays, localDay } from '@/lib/nutrition';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/theme/settings';

type Custom = { id: string; code: string; limit: number; expires: string | null; active: boolean; used: number };
type Batch = { id: string; count: number; expires: string | null; active: boolean; env: string; created: string };
type Offer = { id: string; plan: 'monthly' | 'yearly'; name: string; duration: string; who: string[]; custom: Custom[]; batches: Batch[] };

/** Apple's free times for an offer code. */
const FREE: [string, string][] = [
  ['THREE_DAYS', '3 days'],
  ['ONE_WEEK', '1 week'],
  ['TWO_WEEKS', '2 weeks'],
  ['ONE_MONTH', '1 month'],
  ['TWO_MONTHS', '2 months'],
  ['THREE_MONTHS', '3 months'],
  ['SIX_MONTHS', '6 months'],
  ['ONE_YEAR', '1 year'],
];
const WHO: [string, string][] = [
  ['NEW', 'New people'],
  ['EXPIRED', 'Ended subscriptions'],
  ['EXISTING', 'Current subscribers'],
];
/** A code typed into this link opens the App Store with the code filled in. */
const redeemLink = (code: string) => `https://apps.apple.com/redeem?ctx=offercodes&id=6826500429&code=${encodeURIComponent(code)}`;

async function call<T>(body: Record<string, unknown>): Promise<{ data?: T; error?: string; detail?: string }> {
  const { data, error } = await supabase.functions.invoke('offer-codes', { body });
  if (!error) return { data: data as T };
  try {
    const j = await (error as { context?: Response }).context?.json();
    return { error: j?.error ?? 'failed', detail: j?.detail };
  } catch {
    return { error: 'failed' };
  }
}

/** Adro+ free codes (Apple Offer Codes): make a named code or a batch of one-time codes and see how they're used. */
export default function AdminCodes() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const admin = useIsAdmin();
  const [offers, setOffers] = useState<Offer[] | null | undefined>(undefined);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [kind, setKind] = useState<'custom' | 'onetime'>('custom');
  const [code, setCode] = useState('');
  const [free, setFree] = useState('ONE_MONTH');
  const [plan, setPlan] = useState<'monthly' | 'yearly'>('monthly');
  const [count, setCount] = useState('100');
  const [ends, setEnds] = useState<number>(0);
  const [who, setWho] = useState<string[]>(['NEW', 'EXPIRED']);
  const [sandbox, setSandbox] = useState(false);
  const [busy, setBusy] = useState(false);

  const show = useCallback((r: Awaited<ReturnType<typeof call<{ offers: Offer[]; ready: boolean }>>>) => {
    if (r.error) {
      setSetupError(r.error === 'not_set_up' ? t('The App Store Connect API key isn’t added yet (Supabase secrets ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY).') : (r.detail ?? t('Couldn’t reach Apple. Try again.')));
      setOffers(null);
      return;
    }
    setSetupError(r.data?.ready ? null : t('Make the two plans in App Store Connect first (adro_monthly and adro_yearly).'));
    setOffers(r.data?.offers ?? []);
  }, [t]);
  const load = useCallback(() => call<{ offers: Offer[]; ready: boolean }>({ action: 'list' }).then(show), [show]);
  useEffect(() => {
    if (admin) call<{ offers: Offer[]; ready: boolean }>({ action: 'list' }).then(show);
  }, [admin, show]);

  if (!admin)
    return (
      <Screen title={t('Free codes')} back>
        <Text color="sec">{t('Only the Adro team can open this page.')}</Text>
      </Screen>
    );

  const n = Math.round(Number(count));
  const okCount = kind === 'custom' ? n >= 1 && n <= 25000 : n >= 500 && n <= 25000;
  const okCode = kind === 'onetime' || /^[A-Z0-9]{3,64}$/.test(code);
  // One-time codes must end (6 months at most); a named code may last until you stop it.
  const endOptions = kind === 'onetime' ? [1, 3, 6] : [0, 1, 3, 6, 12];
  const endsIn = kind === 'onetime' && !ends ? 3 : ends;
  const expires = endsIn ? addDays(localDay(new Date()), Math.round(endsIn * 30.4)) : null;

  const create = async () => {
    if (busy || !okCount || !okCode || !who.length) return;
    setBusy(true);
    const r = await call<{ code?: string; batch?: string }>({ action: 'create', kind, plan, duration: free, code, count: n, expires, who, sandbox });
    setBusy(false);
    if (r.error) return toast(r.detail ?? t('Couldn’t make the code.'), { icon: 'warn' });
    toast(kind === 'custom' ? t('Code {c} is ready.', { c: code }) : t('Apple is making the codes. Download them here in a few minutes.'), { icon: 'check' });
    setCode('');
    load();
  };
  const share = async (text: string) => {
    await Clipboard.setStringAsync(text).catch(() => {});
    Share.share({ message: text }).catch(() => {});
  };
  const download = async (b: Batch) => {
    const r = await call<{ csv: string }>({ action: 'values', id: b.id });
    if (r.error || !r.data?.csv) return toast(t('Not ready yet. Apple takes a few minutes to make them.'), { icon: 'warn' });
    share(r.data.csv);
  };
  const stop = async (id: string, batch: boolean) => {
    const r = await call({ action: 'stop', id, batch });
    if (r.error) return toast(r.detail ?? t('Couldn’t stop it.'), { icon: 'warn' });
    toast(t('Stopped. Nobody can use it any more.'), { icon: 'check' });
    load();
  };
  const freeLabel = (d: string) => t(FREE.find(([k]) => k === d)?.[1] ?? d);

  return (
    <Screen title={t('Free codes')} back>
      <Text color="sec" style={{ marginTop: -8 }}>
        {t('Apple codes for free Adro+. After the free time it renews at the normal price unless the person cancels.')}
      </Text>
      {setupError ? (
        <Card style={{ marginTop: 12, backgroundColor: c.inset }}>
          <Text variant="small">{setupError}</Text>
        </Card>
      ) : null}

      <Card style={{ marginTop: 12 }}>
        <Text variant="h3">{t('New code')}</Text>
        <View style={{ marginTop: 10 }}>
          <Segmented<'custom' | 'onetime'>
            value={kind}
            options={[
              { value: 'custom', label: t('Named code') },
              { value: 'onetime', label: t('One-time codes') },
            ]}
            onChange={(k) => {
              setKind(k);
              setCount(k === 'custom' ? '100' : '500');
              setEnds(k === 'custom' ? 0 : 3);
            }}
          />
        </View>
        <Text variant="xs" color="sec" style={{ marginTop: 6 }}>
          {t(kind === 'custom' ? 'One code many people can type, like ADRO2026. Good for influencers.' : 'Apple makes random codes, each used once. Good for giving to people one by one.')}
        </Text>
        {kind === 'custom' ? <Field label={t('Code')} value={code} onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="ADRO2026" autoCapitalize="characters" autoCorrect={false} ltr style={{ marginTop: 10 }} /> : null}

        <Text variant="small" weight={700} style={{ marginTop: 12 }}>
          {t('Free time')}
        </Text>
        <Row gap={6} style={{ flexWrap: 'wrap', marginTop: 6 }}>
          {FREE.map(([k, l]) => (
            <Chip key={k} title={t(l)} on={free === k} onPress={() => setFree(k)} />
          ))}
        </Row>

        <Text variant="small" weight={700} style={{ marginTop: 12 }}>
          {t('Then it continues as')}
        </Text>
        <Row gap={6} style={{ marginTop: 6 }}>
          <Chip title={t('Monthly, 29 SAR')} on={plan === 'monthly'} onPress={() => setPlan('monthly')} />
          <Chip title={t('Yearly, 299 SAR')} on={plan === 'yearly'} onPress={() => setPlan('yearly')} />
        </Row>

        <Field label={t(kind === 'custom' ? 'How many people can use it' : 'How many codes (500 to 25,000)')} value={count} onChangeText={(v) => setCount(v.replace(/\D/g, ''))} keyboardType="number-pad" inputMode="numeric" ltr style={{ marginTop: 12 }} />

        <Text variant="small" weight={700} style={{ marginTop: 12 }}>
          {t('Ends')}
        </Text>
        <Row gap={6} style={{ flexWrap: 'wrap', marginTop: 6 }}>
          {endOptions.map((m) => (
            <Chip key={m} title={m ? t(m === 12 ? 'In 1 year' : m === 1 ? 'In 1 month' : 'In {n} months', { n: m }) : t('Until I stop it')} on={endsIn === m} onPress={() => setEnds(m)} />
          ))}
        </Row>

        <Text variant="small" weight={700} style={{ marginTop: 12 }}>
          {t('Who can use it')}
        </Text>
        <Row gap={6} style={{ flexWrap: 'wrap', marginTop: 6 }}>
          {WHO.map(([k, l]) => (
            <Chip key={k} title={t(l)} on={who.includes(k)} onPress={() => setWho(who.includes(k) ? who.filter((x) => x !== k) : [...who, k])} />
          ))}
        </Row>
        {kind === 'onetime' ? (
          <Row gap={6} style={{ marginTop: 10 }}>
            <Chip title={t('Test codes (sandbox)')} on={sandbox} onPress={() => setSandbox(!sandbox)} />
          </Row>
        ) : null}

        <Button kind="cobalt" title={t(busy ? 'One moment…' : 'Make the code')} disabled={busy || !okCount || !okCode || !who.length || !!setupError} style={{ marginTop: 14 }} onPress={create} />
      </Card>

      {offers === undefined ? (
        <Thinking message={t('Loading codes from Apple')} />
      ) : offers?.length ? (
        offers.map((o) => (
          <View key={o.id}>
            {o.custom.map((x) => (
              <Card key={x.id} style={{ opacity: x.active ? 1 : 0.55 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text variant="h3" style={{ letterSpacing: 1 }}>
                    {x.code}
                  </Text>
                  <Text variant="xs" weight={700} color={x.active ? 'up' : 'sec'}>
                    {t(x.active ? 'Active' : 'Stopped')}
                  </Text>
                </Row>
                <Text variant="small" color="sec">
                  {t('{f} free, then {p}', { f: freeLabel(o.duration), p: t(o.plan === 'yearly' ? 'yearly' : 'monthly') })}
                </Text>
                <Text variant="small" style={{ marginTop: 4 }}>
                  {t('Used {a} of {b}', { a: x.used, b: x.limit })}
                  {x.expires ? `  ·  ${t('ends {d}', { d: x.expires })}` : ''}
                </Text>
                {x.active ? (
                  <Row gap={8} style={{ marginTop: 10 }}>
                    <Button small kind="soft" color={c.text} title={t('Share link')} onPress={() => share(redeemLink(x.code))} />
                    <Button small kind="ghost" color={c.down} title={t('Stop')} onPress={() => stop(x.id, false)} />
                  </Row>
                ) : null}
              </Card>
            ))}
            {o.batches.map((b) => (
              <Card key={b.id} style={{ opacity: b.active ? 1 : 0.55 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text variant="h3">{t('{n} one-time codes', { n: b.count })}</Text>
                  <Text variant="xs" weight={700} color={b.env === 'SANDBOX' ? 'sec' : b.active ? 'up' : 'sec'}>
                    {b.env === 'SANDBOX' ? t('Test') : t(b.active ? 'Active' : 'Stopped')}
                  </Text>
                </Row>
                <Text variant="small" color="sec">
                  {t('{f} free, then {p}', { f: freeLabel(o.duration), p: t(o.plan === 'yearly' ? 'yearly' : 'monthly') })}
                  {b.expires ? `  ·  ${t('ends {d}', { d: b.expires })}` : ''}
                </Text>
                {b.active ? (
                  <Row gap={8} style={{ marginTop: 10 }}>
                    <Button small kind="soft" color={c.text} title={t('Download codes')} onPress={() => download(b)} />
                    <Button small kind="ghost" color={c.down} title={t('Stop')} onPress={() => stop(b.id, true)} />
                  </Row>
                ) : null}
              </Card>
            ))}
          </View>
        ))
      ) : offers ? (
        <Text color="sec" center style={{ marginTop: 12 }}>
          {t('No codes yet.')}
        </Text>
      ) : null}
    </Screen>
  );
}
