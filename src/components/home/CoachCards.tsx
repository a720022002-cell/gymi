import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icon, type IconName, Mark } from '@/components/Icon';
import { hoursText } from '@/components/coach/GymHours';
import { Avatar } from '@/components/social/Avatar';
import { Text } from '@/components/Text';
import { Button, Card, Row, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { useFood } from '@/lib/food';
import { useCoachMode } from '@/lib/coachMode';
import { type Application, type MyCoach, myCoachPlans } from '@/lib/coaching';
import { useSettings } from '@/theme/settings';

/** Coach application status for people who applied (design: coachAppCard). */
export function CoachAppCard({ app }: { app: Application | null | undefined }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const { profile } = useAuth();
  const [, setCoachMode] = useCoachMode();
  if (app === undefined || !profile) return null;
  const st = profile.account_type === 'coach' ? profile.coach_status : app?.status === 'rejected' ? 'rejected' : null;
  if (st === 'approved')
    return (
      <Card style={{ backgroundColor: c.inset }}>
        <Row gap={12}>
          <Icon name="check" size={26} color={c.up} strokeWidth={2.6} />
          <View style={{ flex: 1 }}>
            <Text weight={700}>{t('You’re approved as a coach')}</Text>
            <Text variant="small" color="sec">
              {t('You can add clients and send them plans.')}
            </Text>
          </View>
        </Row>
        <Button title={t('Open coach view')} style={{ marginTop: 12 }} onPress={() => (setCoachMode(true), router.replace('/cclients'))} />
      </Card>
    );
  const card = (icon: IconName, title: string, sub: string, to: '/coachapp' | '/coachapply', blue?: boolean) => (
    <Card onPress={() => router.push(to)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: blue ? c.cobalt : c.inset, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={18} color={blue ? '#FFFFFF' : c.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text weight={700}>{title}</Text>
        <Text variant="small" color="sec">
          {sub}
        </Text>
      </View>
      <Icon name="chev" size={18} color={c.sec} />
    </Card>
  );
  if (st === 'pending')
    // Signed up as a coach but never sent the application: finish it.
    return app ? card('clock', t('Coach application under review'), t('Usually within 2 days. We’ll notify you.'), '/coachapp', true) : card('coach', t('Finish your coach application'), t('Tell us how you coach. It takes 2 minutes.'), '/coachapply', true);
  if (st === 'rejected') return card('info', t('Coach application not approved'), t('See why and apply again'), '/coachapp');
  return null;
}

/** Your coach: message, gym hours with Meet, and their plans (design: coachCardMember). */
export function CoachCard({ k }: { k: MyCoach }) {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const food = useFood();
  const [plans, setPlans] = useState<{ program: string | null; meals: string | null } | null>(null);
  useEffect(() => {
    let alive = true;
    myCoachPlans().then((p) => alive && setPlans({ program: p?.program?.name ?? null, meals: p?.meals?.name ?? null }));
    return () => {
      alive = false;
    };
  }, [k.id]);
  const name = k.name || k.username;
  const inPerson = k.coach_type !== 'Online' && k.hours?.length;
  return (
    <Card>
      <Row gap={12}>
        <Avatar id={k.coach_id} name={name} size={44} />
        <View style={{ flex: 1 }}>
          <Text variant="xs" weight={700} color="sec">
            {k.coach_type === 'Online' ? t('Your coach, online') : t('Your coach')}
          </Text>
          <Text weight={700}>{name}</Text>
        </View>
        <Button small kind="glass" icon="send" title={t('Message')} onPress={() => router.push({ pathname: '/thread', params: { link: k.id, name } })} />
      </Row>
      {inPerson ? (
        <Row gap={10} style={{ marginTop: 12, backgroundColor: c.inset, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12 }}>
          <Icon name="clock" size={18} color={c.cobalt} />
          <View style={{ flex: 1 }}>
            <Text variant="small" weight={700}>
              {k.gym ? t('At {g}', { g: k.gym }) : t('At the gym')}
            </Text>
            <Text variant="xs" color="sec">
              {hoursText(k.hours, t, lang)}
            </Text>
          </View>
          <Button small title={t('Meet')} onPress={() => router.push('/mycoach')} />
        </Row>
      ) : null}
      {plans?.program || plans?.meals ? (
        <View style={{ marginTop: 12, backgroundColor: c.inset, borderRadius: 16, overflow: 'hidden' }}>
          {plans.program ? (
            <Pressable onPress={() => router.push('/myprog')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
              <Icon name="train" size={18} />
              <View style={{ flex: 1 }}>
                <Text weight={700}>{plans.program}</Text>
                <Text variant="xs" color="sec">
                  {t('Workout program from your coach')}
                </Text>
              </View>
              <Icon name="chev" size={16} color={c.sec} />
            </Pressable>
          ) : null}
          {plans.meals ? (
            <Pressable onPress={() => router.push('/mymeals')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
              <Icon name="food" size={18} />
              <View style={{ flex: 1 }}>
                <Text weight={700}>{plans.meals}</Text>
                <Text variant="xs" color="sec">
                  {t('Meal plan from your coach')}
                </Text>
              </View>
              <Icon name="chev" size={16} color={c.sec} />
            </Pressable>
          ) : null}
        </View>
      ) : (
        <Text variant="small" color="sec" style={{ marginTop: 8 }}>
          {food.coachTargets ? t('Your calories and protein are set by {n}.', { n: name }) : t('Your coach sees your food, workouts, weight, sleep and check-ins, steps, water, goal and allergies. Cycle data and blood tests stay private.')}
        </Text>
      )}
    </Card>
  );
}

/** Your coach, as one compact row at the top of Home: opens My coach; the chat button shows new messages. */
export function CoachRow({ k, unread }: { k: MyCoach; unread: number }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const name = k.name || k.username;
  const chat = () => router.push({ pathname: '/thread', params: { link: k.id, name } });
  return (
    <Card onPress={() => router.push('/mycoach')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Avatar id={k.coach_id} name={name} size={40} />
      <View style={{ flex: 1 }}>
        <Text weight={700} numberOfLines={1}>
          {t('Your coach {n}', { n: name })}
        </Text>
        <Text variant="small" color={unread ? 'link' : 'sec'} weight={unread ? 700 : undefined} numberOfLines={1}>
          {unread ? t(unread === 1 ? '1 new message' : '{n} new messages', { n: unread }) : t('Your plans, chat and check-ins')}
        </Text>
      </View>
      <Springy onPress={chat} accessibilityLabel={unread ? t('{n} new messages', { n: unread }) : t('Message')} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: unread ? c.cobalt : c.inset, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="send" size={17} color={unread ? '#FFFFFF' : c.text} />
        {unread ? (
          <View style={{ position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: c.down, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.card }}>
            <Text size={11} weight={700} color="#FFFFFF">
              {String(unread)}
            </Text>
          </View>
        ) : null}
      </Springy>
    </Card>
  );
}

export function CheckinCard({ onStart }: { onStart: () => void }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  return (
    <Card style={{ backgroundColor: c.cobalt, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Mark size={38} color="#FFFFFF" stroke={7} />
      <View style={{ flex: 1 }}>
        <Text variant="h3" color="#FFFFFF">
          {t('Daily check-in')}
        </Text>
        <Text variant="small" color="rgba(255,255,255,0.85)">
          {t('Weight, sleep and energy. Under 30 seconds.')}
        </Text>
      </View>
      <Springy onPress={onStart} style={{ height: 40, borderRadius: 20, paddingHorizontal: 14, backgroundColor: '#FFFFFF', justifyContent: 'center' }}>
        <Text weight={700} size={14} color="#0A0A0B">
          {t('Start')}
        </Text>
      </Springy>
    </Card>
  );
}

export function CoachSetCard({ name }: { name: string }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  return (
    <Card onPress={() => router.push('/mycoach')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Icon name="coach" size={22} color={c.cobalt} />
      <Text variant="small" style={{ flex: 1 }}>
        {t('Your calories and protein are set by {n}.', { n: name })}
      </Text>
      <Icon name="chev" size={18} color={c.sec} />
    </Card>
  );
}
