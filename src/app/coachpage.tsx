import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { hoursText } from '@/components/coach/GymHours';
import { SocialRow } from '@/components/coach/Socials';
import { Thinking } from '@/components/food/Thinking';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Avatar } from '@/components/social/Avatar';
import { ReportSheet } from '@/components/social/ReportSheet';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Row } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { activePackages, type CoachCard, coachCard, myCoach, type MyCoach, requestCoach, requestCoachPackage, spotsLeft } from '@/lib/coaching';
import { fmt } from '@/lib/nutrition';
import { useSettings } from '@/theme/settings';

/** A coach's page: spots, program, packages and a request button (design: coachpage). Also the coach's own preview. */
export default function CoachPage() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { session } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [report, setReport] = useState(false);
  const [k, setK] = useState<{ id: string; v: CoachCard | null; mine: MyCoach | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [pkg, setPkg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([coachCard(id), myCoach()]).then(([v, mine]) => alive && setK({ id, v, mine }));
    return () => {
      alive = false;
    };
  }, [id]);

  const v = k?.id === id ? k.v : undefined;
  if (v === undefined)
    return (
      <Screen title="" back>
        <Thinking message={t('Loading')} />
      </Screen>
    );
  if (!v)
    return (
      <Screen title={t('Coach')} back>
        <Card style={{ alignItems: 'center' }}>
          <Text color="sec">{t('This coach isn’t available.')}</Text>
        </Card>
      </Screen>
    );
  const name = v.name || v.username;
  const left = spotsLeft(v);
  const full = left <= 0;
  const self = v.id === session?.user.id;
  const mine = k?.mine;
  const withThem = mine?.coach_id === v.id ? mine : null;
  const pk = activePackages(v.packages);
  const sel = pkg ?? pk[0]?.id ?? null;
  const where = v.coach_type === 'Online' ? t('Online coach') : v.coach_type === 'Both' ? t('Online and at {g}', { g: v.gym || v.city }) : v.gym ? t('Personal coach at {g}', { g: v.gym }) : t('Personal coach');

  const ask = async () => {
    setBusy(true);
    const chosen = pk.find((x) => x.id === sel);
    const r = chosen ? await requestCoachPackage(v.id, chosen.name) : await requestCoach(v.id);
    setBusy(false);
    if (r === 'ok') {
      toast(t('Request sent. {n} will reply soon.', { n: name }), { icon: 'send' });
      return router.replace('/mycoach');
    }
    toast(t(r === 'has_coach' ? 'You already have a coach. End that first.' : r === 'full' ? 'This coach is full right now. Check back soon.' : 'Couldn’t save. Please try again.'), { icon: 'warn' });
  };

  return (
    <Screen title={name} back>
      {self ? (
        <Card style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <Icon name="eye" size={18} color={c.cobalt} />
          <Text variant="small" style={{ flex: 1 }}>
            {t(v.listed ? 'Preview: this is how members see your page.' : 'Preview: you’re hidden from Find a coach right now.')}
          </Text>
        </Card>
      ) : null}
      <View style={{ alignItems: 'center' }}>
        <Avatar id={v.id} name={name} size={84} />
        <Text variant="h1" style={{ marginTop: 12 }}>
          {name}
        </Text>
        <Text variant="small" color="sec">
          {where}
        </Text>
        <Row gap={10} style={{ marginTop: 6 }}>
          <Row gap={4}>
            <Icon name="check" size={14} color={c.up} strokeWidth={2.6} />
            <Text variant="small" weight={700} color="up">
              {t('Checked by Adro')}
            </Text>
          </Row>
          <Text variant="small" weight={700} color={left <= 2 ? 'down' : 'up'}>
            {full ? t('Full') : t(left === 1 ? '{n} spot left' : '{n} spots left', { n: left })}
          </Text>
        </Row>
        {v.bio ? (
          <Text variant="small" center style={{ marginTop: 8, maxWidth: 310 }}>
            {v.bio}
          </Text>
        ) : null}
        <SocialRow value={v.socials} center />
      </View>
      <Row gap={8} style={{ marginTop: 16 }}>
        {[
          [v.years != null ? t('{n} years', { n: v.years }) : '–', t('Experience')],
          [String(v.clients), t('Clients')],
        ].map(([a, b]) => (
          <View key={b} style={{ flex: 1, backgroundColor: c.card, borderRadius: 18, padding: 12, alignItems: 'center' }}>
            <Text num size={17}>
              {a}
            </Text>
            <Text variant="xs" weight={700} color="sec">
              {b}
            </Text>
          </View>
        ))}
      </Row>
      {v.headline || v.about || v.specialties.length ? (
        <>
          <Text variant="small" weight={700} color="sec" style={{ marginHorizontal: 4, marginTop: 16, marginBottom: 8 }}>
            {t('The program')}
          </Text>
          <Card>
            {v.headline ? <Text weight={700}>{v.headline}</Text> : null}
            {v.about ? (
              <Text variant="small" color="sec" style={{ marginTop: 4 }}>
                {v.about}
              </Text>
            ) : null}
            {v.specialties.length ? (
              <Row gap={6} style={{ flexWrap: 'wrap', marginTop: 8 }}>
                {v.specialties.map((s) => (
                  <View key={s} style={{ backgroundColor: c.inset, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text variant="xs" weight={700}>
                      {t(s)}
                    </Text>
                  </View>
                ))}
              </Row>
            ) : null}
          </Card>
        </>
      ) : null}
      {v.coach_type !== 'Online' && v.hours?.length ? (
        <Card style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <Icon name="clock" size={18} color={c.sec} />
          <View style={{ flex: 1 }}>
            <Text variant="small" weight={700}>
              {v.gym ? t('At {g}', { g: v.gym }) : t('At the gym')}
            </Text>
            <Text variant="xs" color="sec">
              {hoursText(v.hours, t, lang)}
            </Text>
          </View>
        </Card>
      ) : null}
      {pk.length ? (
        <>
          <Text variant="small" weight={700} color="sec" style={{ marginHorizontal: 4, marginTop: 8, marginBottom: 8 }}>
            {t('Packages')}
          </Text>
          {pk.map((x) => (
            <Card key={x.id} onPress={() => setPkg(x.id)} style={{ borderWidth: 2, borderColor: sel === x.id ? c.cobalt : 'transparent' }}>
              <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Text weight={700}>{t(x.name)}</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text num size={20}>{`${fmt(x.price)} ${t('SAR')}`}</Text>
                  {(x.months ?? 1) > 1 ? (
                    <Text variant="xs" color="sec">
                      {t('{n} SAR a month', { n: fmt(Math.round(x.price / (x.months ?? 1))) })}
                    </Text>
                  ) : null}
                </View>
              </Row>
              {(x.inc ?? []).map((i) => (
                <Row key={i} gap={8} style={{ marginTop: 4 }}>
                  <Icon name="check" size={14} color={c.up} strokeWidth={2.6} />
                  <Text variant="small">{i === 'In-person sessions' ? t('{n} in-person sessions a month', { n: v.sessions ?? 2 }) : t(i)}</Text>
                </Row>
              ))}
              {x.desc ? (
                <Text variant="small" color="sec" style={{ marginTop: 6 }}>
                  {x.desc}
                </Text>
              ) : null}
            </Card>
          ))}
        </>
      ) : null}
      <Card style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
        <Icon name="info" size={18} color={c.sec} />
        <Text variant="small" color="sec" style={{ flex: 1 }}>
          {t('If you join, this coach sees your food, workouts, weight and sleep. Cycle data and health tests stay private. Payment is agreed with the coach directly for now.')}
        </Text>
      </Card>
      {self ? null : withThem ? (
        <Card style={{ alignItems: 'center' }}>
          <Text variant="small" weight={700} center>
            {withThem.status === 'active' ? t('You’re training with {n}.', { n: name }) : t('Request sent, waiting for a reply')}
          </Text>
        </Card>
      ) : mine?.status === 'active' ? (
        <Card style={{ alignItems: 'center' }}>
          <Text variant="small" color="sec" center>
            {t('You already have a coach. Leave them first to switch.')}
          </Text>
        </Card>
      ) : full ? (
        <Card style={{ alignItems: 'center' }}>
          <Text variant="small" color="sec" center>
            {t('This coach is full right now. Check back soon.')}
          </Text>
        </Card>
      ) : (
        <Button icon="send" title={t('Ask {n} to coach me', { n: name })} loading={busy} onPress={ask} />
      )}
      <Button kind="ghost" small icon="warn" title={t('Report this coach')} color={c.sec} style={{ marginTop: 8, alignSelf: 'center' }} onPress={() => setReport(true)} />
      <ReportSheet open={report} onClose={() => setReport(false)} user={id} name={name} kind="coach" />
    </Screen>
  );
}
