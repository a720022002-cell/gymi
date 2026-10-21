import { Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { Glass } from '@/components/Glass';
import { Icon } from '@/components/Icon';
import { FreeMonthAlert } from '@/components/FreeMonthAlert';
import { RecapGate } from '@/components/RecapGate';
import { InviteCodeSheet } from '@/components/InviteCodeSheet';
import { CalendarButton, DayNav } from '@/components/DayNav';
import { CheckinCard, CoachAppCard, CoachCard, CoachSetCard } from '@/components/home/CoachCards';
import { DayRecap } from '@/components/home/DayRecap';
import { CycleCard, ReadingsCard, StreaksCard, TipCard, WaterCard } from '@/components/home/InfoCards';
import { MainCard } from '@/components/home/MainCard';
import { Screen } from '@/components/Screen';
import { Avatar } from '@/components/social/Avatar';
import { Text } from '@/components/Text';
import { MissedCard, WorkoutCard } from '@/components/train/WorkoutCard';
import { Button, Card, Row, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { useFood } from '@/lib/food';
import { useHealth } from '@/lib/health';
import { useCoachMode } from '@/lib/coachMode';
import { type Application, type MyCoach, myApplication, myCoach } from '@/lib/coaching';
import { useHomeLayout } from '@/lib/homeLayout';
import { fastTimes } from '@/lib/prayer';
import { fmtTime } from '@/lib/nutrition';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Home() {
  const { t, lang } = useT();
  const { profile } = useAuth();
  const food = useFood();
  const health = useHealth();
  const [layout] = useHomeLayout();
  const [coachMode] = useCoachMode();
  const { welcome } = useLocalSearchParams<{ welcome?: string }>();
  // Right after sign up: "Got an invite code?", then the daily check-in.
  const [askCode, setAskCode] = useState(welcome === '1');
  const [coach, setCoach] = useState<MyCoach | null>(null);
  const [app, setApp] = useState<Application | null | undefined>(undefined);
  const uid = profile?.id;
  useFocusEffect(
    useCallback(() => {
      if (!uid) return;
      let alive = true;
      myCoach().then((k) => alive && setCoach(k && k.status === 'active' ? k : null));
      myApplication().then((a) => alive && setApp(a));
      return () => {
        alive = false;
      };
    }, [uid]),
  );

  if (coachMode && profile?.account_type === 'coach' && profile.coach_status === 'approved') return <Redirect href="/cclients" />;
  const name = profile?.name || profile?.username || '';
  const date = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en-US', { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date(`${food.day}T12:00:00`));
  // Looking back at an earlier day: its food, water, cardio and workouts; today's prompts are hidden.
  const past = !food.isToday;
  const ramadan = food.plan.ramadan ? fastTimes(food.plan.city, food.today) : null;
  const rings = layout.rings;

  return (
    <Screen
      title={date}
      large
      tabs
      left={<CalendarButton />}
      pre={
        <Row style={{ justifyContent: 'space-between', marginTop: 2 }}>
          <Text weight={700} color="sec">
            {t(greeting())}
            {name ? `, ${name}` : ''}
          </Text>
        </Row>
      }
      right={
        <Springy onPress={() => router.push('/you')} scaleTo={1.08} accessibilityLabel={t('Profile and settings')}>
          {profile?.avatar_url ? (
            <Avatar id={uid ?? ''} name={name} size={44} url={profile.avatar_url} />
          ) : (
            <Glass style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
              <Text variant="h3" size={16}>
                {(name[0] ?? '?').toUpperCase()}
              </Text>
            </Glass>
          )}
        </Springy>
      }>
      <DayNav />
      {past ? null : (
        <>
          {/* Until today's check-in is done (only a sleep logged from the chat has no score yet). */}
          {health.ready && health.todayCheckin?.score == null && !askCode ? <CheckinCard onStart={() => health.setCheckinOpen(true)} /> : null}
          <CoachAppCard app={app} />
          {coach ? <CoachCard k={coach} /> : food.coachTargets ? <CoachSetCard name={food.coachTargets.name} /> : null}
        </>
      )}
      {!past && ramadan ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Icon name="moon" size={22} />
          <Text variant="small" style={{ flex: 1 }}>
            <Text variant="small" weight={700}>
              {t('Ramadan mode is on.')}
            </Text>{' '}
            {t('Iftar at {a}, suhoor ends {b}.', { a: fmtTime(ramadan.maghrib, lang), b: fmtTime(ramadan.fajr, lang) })}
          </Text>
        </Card>
      ) : null}
      {layout.order
        .filter((k) => !layout.hidden.includes(k) && !(k === 'water' && rings.length > 1 && rings.includes('water')))
        .filter((k) => !past || k === 'calories' || k === 'water' || k === 'workout')
        .filter((k) => k !== 'cycle' || profile?.gender === 'female')
        .map((k) =>
          k === 'calories' ? (
            <MainCard key={k} />
          ) : k === 'water' ? (
            <WaterCard key={k} />
          ) : k === 'workout' ? (
            past ? (
              <DayRecap key={k} />
            ) : (
              <View key={k}>
                <MissedCard />
                <WorkoutCard />
              </View>
            )
          ) : k === 'cycle' ? (
            <CycleCard key={k} />
          ) : k === 'readings' ? (
            <ReadingsCard key={k} />
          ) : k === 'streak' ? (
            <StreaksCard key={k} />
          ) : food.setupDone ? (
            <TipCard key={k} />
          ) : null,
        )}
      {past && layout.hidden.includes('workout') ? <DayRecap /> : null}
      {past ? null : <Button title={t('Edit home')} icon="sliders" kind="glass" style={{ marginTop: 8 }} onPress={() => router.push('/customize')} />}
      <InviteCodeSheet
        open={askCode}
        onDone={() => {
          setAskCode(false);
          router.setParams({ welcome: undefined });
          setTimeout(() => health.setCheckinOpen(true), 400);
        }}
      />
      {askCode ? null : <FreeMonthAlert />}
      <RecapGate paused={askCode} />
    </Screen>
  );
}
