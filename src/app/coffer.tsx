import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';

import { Stepper } from '@/components/food/Stepper';
import { Icon } from '@/components/Icon';
import { Bar } from '@/components/Ring';
import { Screen } from '@/components/Screen';
import { List, ListRow } from '@/components/social/List';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Chip, Label, Row, Toggle } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { type CoachProfile, coachList, EMPTY_COACH, fromPrice, getCoachProfile, INCLUDES, normalizePackages, type Package, saveCoachProfile } from '@/lib/coaching';
import { fmt } from '@/lib/nutrition';
import { useSettings } from '@/theme/settings';
import { goBack } from '@/lib/nav';

/** Listing, spots and packages: what members see and pick in Find a coach (design: coffer). */
export default function CoachOffer() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { session } = useAuth();
  const uid = session?.user.id;
  const [p, setP] = useState<CoachProfile | null>(null);
  const [used, setUsed] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!uid) return;
    let alive = true;
    Promise.all([getCoachProfile(uid), coachList()]).then(([v, l]) => {
      if (!alive) return;
      const base = { ...EMPTY_COACH, ...(v ?? {}) };
      setP({ ...base, packages: normalizePackages(base.packages) });
      setUsed(l.filter((x) => x.status === 'active').length);
    });
    return () => {
      alive = false;
    };
  }, [uid]);
  const v = p ?? { ...EMPTY_COACH, packages: normalizePackages([]) };
  const set = (patch: Partial<CoachProfile>) => setP({ ...v, ...patch });
  const setPkg = (id: string, patch: Partial<Package>) => set({ packages: v.packages.map((x) => (x.id === id ? { ...x, ...patch } : x)) });
  const field = { height: 44, borderRadius: 12, backgroundColor: c.inset, paddingHorizontal: 12, fontSize: 15, color: c.text } as const;
  const num = (s: string) => Number(s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/\D/g, '')) || 0;
  const full = used >= v.max_clients;
  const shown = v.listed && !full;
  const left = v.max_clients - used;
  const relist = v.auto_relist !== false;
  const sessionsOn = v.packages.some((x) => x.on && x.inc?.includes('In-person sessions'));

  const save = async () => {
    if (!uid) return false;
    setBusy(true);
    const ok = await saveCoachProfile(uid, { ...v, headline: (v.headline ?? '').trim(), about: (v.about ?? '').trim(), price_month: fromPrice(v.packages) ?? v.price_month });
    setBusy(false);
    if (!ok) toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
    return ok;
  };

  return (
    <Screen title={t('Listing and packages')} back>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text weight={700}>{t('Your spots')}</Text>
          <Text num size={20}>{`${used} / ${v.max_clients}`}</Text>
        </Row>
        <View style={{ marginTop: 8 }}>
          <Bar value={used} max={v.max_clients} color={full ? c.down : c.cobalt} />
        </View>
        <Text variant="small" weight={700} style={{ marginTop: 12 }}>
          {t('Most clients I take')}
        </Text>
        <View style={{ marginTop: 6 }}>
          <Stepper onMinus={() => set({ max_clients: Math.max(1, v.max_clients - 1) })} onPlus={() => set({ max_clients: Math.min(500, v.max_clients + 1) })} labels={[t('Less'), t('More')]}>
            <Text num size={24}>
              {v.max_clients}
            </Text>
          </Stepper>
        </View>
        <Row gap={8} style={{ marginTop: 10, alignItems: 'flex-start' }}>
          <Icon name={shown ? 'eye' : 'eyeoff'} size={18} color={shown ? c.up : c.down} />
          <Text variant="small" style={{ flex: 1 }}>
            {!v.listed
              ? t('You’re hidden from Find a coach.')
              : full
                ? `${t('You’re full, so you’re hidden from Find a coach.')}${relist ? ` ${t('You’ll show again as soon as a spot opens.')}` : ''}`
                : t(left === 1 ? 'You show in Find a coach with {n} spot left.' : 'You show in Find a coach with {n} spots left.', { n: left })}
          </Text>
        </Row>
      </Card>
      <List>
        <ListRow first>
          <View style={{ flex: 1 }}>
            <Text weight={700}>{t('Show me in Find a coach')}</Text>
            <Text variant="xs" color="sec">
              {t('Clients can find you and subscribe')}
            </Text>
          </View>
          <Toggle value={v.listed} onChange={(x) => set({ listed: x })} label={t('Show me in Find a coach')} />
        </ListRow>
        <ListRow>
          <View style={{ flex: 1 }}>
            <Text weight={700}>{t('Show again when a spot opens')}</Text>
            <Text variant="xs" color="sec">
              {t('When a client leaves and you’re under your limit')}
            </Text>
          </View>
          <Toggle value={relist} onChange={(x) => set({ auto_relist: x })} label={t('Show again when a spot opens')} />
        </ListRow>
      </List>
      <Text variant="small" weight={700} color="sec" style={{ marginHorizontal: 4 }}>
        {t('Your program')}
      </Text>
      <Label>{t('Headline')}</Label>
      <TextInput value={v.headline ?? ''} onChangeText={(s) => set({ headline: s.slice(0, 60) })} placeholder={t('Lose fat and get strong in 12 weeks')} placeholderTextColor={c.sec} style={[field, { backgroundColor: c.card, height: 50, borderRadius: 16 }]} />
      <Label>{t('What clients get')}</Label>
      <TextInput
        value={v.about ?? ''}
        onChangeText={(s) => set({ about: s.slice(0, 300) })}
        placeholder={t('A plan built around your schedule and the food you like. I check your logs every week and adjust.')}
        placeholderTextColor={c.sec}
        multiline
        style={[field, { backgroundColor: c.card, borderRadius: 16, height: 100, paddingTop: 12, textAlignVertical: 'top' }]}
      />
      <Text variant="small" weight={700} color="sec" style={{ marginTop: 18, marginHorizontal: 4 }}>
        {t('Packages')}
      </Text>
      <Text variant="small" color="sec" style={{ marginHorizontal: 4, marginBottom: 10 }}>
        {t('Turn on the ones you offer. Set a price and what each includes.')}
      </Text>
      {v.packages.map((x) => (
        <Card key={x.id}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text weight={700}>{t(x.name)}</Text>
            <Toggle value={!!x.on} onChange={(on) => setPkg(x.id, { on })} label={t(x.name)} />
          </Row>
          {x.on ? (
            <>
              <Row gap={8} style={{ marginTop: 8 }}>
                <TextInput value={x.price ? String(x.price) : ''} onChangeText={(s) => setPkg(x.id, { price: Math.min(100000, num(s)) })} inputMode="numeric" placeholder="0" placeholderTextColor={c.sec} style={[field, { flex: 1 }]} />
                <Text weight={700} color="sec">
                  {t('SAR')}
                </Text>
              </Row>
              {(x.months ?? 1) > 1 && x.price ? (
                <Text variant="xs" color="sec" style={{ marginTop: 4 }}>
                  {t('{n} SAR a month', { n: fmt(Math.round(x.price / (x.months ?? 1))) })}
                </Text>
              ) : null}
              <Text variant="xs" weight={700} color="sec" style={{ marginTop: 12, marginBottom: 6 }}>
                {t('Includes')}
              </Text>
              <Row gap={6} style={{ flexWrap: 'wrap' }}>
                {INCLUDES.map((i) => {
                  const on = !!x.inc?.includes(i);
                  return <Chip key={i} title={`${on ? '✓ ' : ''}${t(i)}`} on={on} onPress={() => setPkg(x.id, { inc: on ? (x.inc ?? []).filter((z) => z !== i) : [...(x.inc ?? []), i] })} />;
                })}
              </Row>
            </>
          ) : null}
        </Card>
      ))}
      {sessionsOn ? (
        <Card>
          <Text variant="small" weight={700}>
            {t('In-person sessions a month')}
          </Text>
          <View style={{ marginTop: 6 }}>
            <Stepper onMinus={() => set({ sessions: Math.max(1, (v.sessions ?? 2) - 1) })} onPlus={() => set({ sessions: Math.min(30, (v.sessions ?? 2) + 1) })} labels={[t('Less'), t('More')]}>
              <Text num size={24}>
                {v.sessions ?? 2}
              </Text>
            </Stepper>
          </View>
        </Card>
      ) : null}
      <Text variant="xs" color="sec" style={{ marginTop: 4, marginHorizontal: 4 }}>
        {t('Clients pay you directly for now. In-app payments come with the store release.')}
      </Text>
      <Row gap={10} style={{ marginTop: 12 }}>
        <Button
          kind="glass"
          icon="eye"
          title={t('Preview')}
          style={{ flex: 1 }}
          onPress={async () => {
            if (uid && (await save())) router.push({ pathname: '/coachpage', params: { id: uid } });
          }}
        />
        <Button
          title={t('Save')}
          loading={busy}
          style={{ flex: 1 }}
          onPress={async () => {
            if (await save()) {
              toast(t('Listing saved'), { icon: 'check' });
              goBack();
            }
          }}
        />
      </Row>
    </Screen>
  );
}
