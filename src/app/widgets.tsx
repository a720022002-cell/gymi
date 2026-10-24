import { useState } from 'react';
import { Platform, View } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Button, Card, Label, Toggle } from '@/components/ui';
import { LockScreen, MEDIUM, TodayMedium, TodaySmall, TrainMedium, TrainSmall, WorkoutCard } from '@/components/widgets/WidgetPreviews';
import { useT } from '@/i18n';
import { useIsAdmin } from '@/lib/admin';
import { useTrain } from '@/lib/train';
import { useWeight } from '@/lib/units';
import { useWidgetData } from '@/lib/widgetData';
import { liveTapCheck } from '@/lib/widgetSync';
import { useSettings } from '@/theme/settings';
import type { TodayProps } from '@/widgets/TodayWidget';
import type { TrainProps } from '@/widgets/TrainWidget';

/** You → Widgets: the iPhone widgets with your own numbers, how to add them, and the workout on the Lock Screen. */
export default function Widgets() {
  const { t, lang } = useT();
  const { colors: c, isDark, liveActivity, setLiveActivity } = useSettings();
  const W = useWeight();
  const data = useWidgetData();
  const { todayName } = useTrain();
  const ios = Platform.OS === 'ios';
  const admin = useIsAdmin();

  // Your numbers when they're loaded, an example otherwise.
  const L = { left: t('kcal left'), over: t('kcal over'), eaten: t('Eaten'), protein: t('Protein'), steps: t('Steps'), today: t('Today') };
  const today: TodayProps = data.today ?? { left: '1,240', over: false, part: 0.46, eaten: '1,060', goal: '2,300', protein: `92/150 ${t('g')}`, proteinPart: 0.61, steps: '6,420', stepsPart: 0.8, L };
  const train: TrainProps = data.train ?? {
    workout: t('Push'),
    status: t('Ready when you are'),
    done: false,
    rest: false,
    next: t('Next: {w} · {d}', { w: t('Legs'), d: t('Wed') }),
    streak: '5',
    readiness: 78,
    L: { today: t('Today'), streak: t('in a row'), ready: t('Recovery') },
  };
  const now = new Date();
  const locale = lang === 'ar' ? 'ar-u-nu-latn' : 'en';
  let date = '';
  try {
    date = now.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  } catch {}
  const time = `${now.getHours() % 12 || 12}:${String(now.getMinutes()).padStart(2, '0')}`;

  const caption = (s: string) => (
    <Text variant="xs" color="sec" style={{ textAlign: 'center', marginTop: 6 }}>
      {s}
    </Text>
  );
  const steps = (items: { icon: IconName; text: string }[]) => (
    <Card>
      {items.map((s, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 7 }}>
          <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
            <Text num weight={700} size={14}>
              {i + 1}
            </Text>
          </View>
          <Text style={{ flex: 1 }}>{s.text}</Text>
          <Icon name={s.icon} size={18} color={c.sec} />
        </View>
      ))}
    </Card>
  );

  return (
    <Screen title={t('Widgets')} back>
      <Text color="sec" style={{ marginBottom: 8 }}>
        {t('Put Adro on your Home Screen and Lock Screen. The numbers update by themselves, and a tap opens the right page.')}
      </Text>
      {!ios ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Icon name="info" size={18} color={c.sec} />
          <Text variant="small" color="sec" style={{ flex: 1 }}>
            {t('Widgets are on iPhone for now. This is how they look.')}
          </Text>
        </Card>
      ) : null}

      <Label>{t('Today')}</Label>
      <Text variant="small" color="sec" style={{ marginBottom: 10, marginHorizontal: 4 }}>
        {t('Calories left, protein and steps. Opens Food.')}
      </Text>
      <View style={{ alignItems: 'center', gap: 14, paddingVertical: 6 }}>
        <View>
          <TodaySmall p={today} dark={isDark} />
          {caption(t('Small'))}
        </View>
        <View style={{ width: MEDIUM }}>
          <TodayMedium p={today} dark={isDark} />
          {caption(t('Medium'))}
        </View>
      </View>

      <Label>{t('Training')}</Label>
      <Text variant="small" color="sec" style={{ marginBottom: 10, marginHorizontal: 4 }}>
        {t('Today’s workout, the next one, your streak and recovery. Opens Train.')}
      </Text>
      <View style={{ alignItems: 'center', gap: 14, paddingVertical: 6 }}>
        <View>
          <TrainSmall p={train} dark={isDark} />
          {caption(t('Small'))}
        </View>
        <View style={{ width: MEDIUM }}>
          <TrainMedium p={train} dark={isDark} />
          {caption(t('Medium'))}
        </View>
      </View>

      <Label>{t('Add to your Home Screen')}</Label>
      {steps([
        { icon: 'grid', text: t('Touch and hold an empty spot on your Home Screen until the apps jiggle.') },
        { icon: 'plus', text: t('Tap Edit at the top, then Add Widget (or + on older iPhones).') },
        { icon: 'search', text: t('Search for Adro and tap it.') },
        { icon: 'swap', text: t('Swipe to pick Today or Training and a size, then tap Add Widget.') },
      ])}

      <Label>{t('Lock Screen')}</Label>
      <LockScreen p={today} date={date} time={time} />
      {caption(t('Calories left as a ring or a line, under the clock.'))}
      <View style={{ height: 8 }} />
      {steps([
        { icon: 'lock', text: t('Touch and hold your Lock Screen, then tap Customize.') },
        { icon: 'grid', text: t('Tap Lock Screen, then the box under the clock.') },
        { icon: 'plus', text: t('Pick Adro and tap the widget you want, then Done.') },
      ])}

      <Label>{t('During a workout')}</Label>
      <WorkoutCard
        s={{
          // Today's workout by its name ("Push workout", not "Push day workout"), or an example.
          workout: t('{w} workout', { w: t(!train.rest && !train.done && todayName ? todayName : 'Push') }),
          set: t('Set {a} of {b}', { a: 2, b: 4 }),
          exercise: t('Bench press'),
          clock: '24:37',
          tip: W.words(t('Top of the range. Try {w2} kg next set.', { w2: W.show(82.5) })),
          w: `${W.show(80)} ${W.label}`,
          r: '× 10',
          water: `1.25 ${t('L')}`,
          count: '5/16',
        }}
      />
      {caption(t('On the Lock Screen and in the Dynamic Island. Change the weight and reps, log the set, skip the rest or add water, without opening Adro.'))}
      <Card style={{ marginTop: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text weight={700}>{t('Show my workout on the Lock Screen')}</Text>
            <Text variant="xs" color="sec">
              {t('And in the Dynamic Island. Buttons need iOS 17 or later.')}
            </Text>
          </View>
          <Toggle value={liveActivity} onChange={setLiveActivity} label={t('Show my workout on the Lock Screen')} />
        </View>
      </Card>
      {ios && admin ? <TapCheck /> : null}
      {ios ? (
        <Text variant="xs" color="sec" style={{ marginTop: 8, marginHorizontal: 4, marginBottom: 24 }}>
          {t('Not showing? Check Settings → Adro → Live Activities on your iPhone.')}
        </Text>
      ) : (
        <View style={{ height: 24 }} />
      )}
    </Screen>
  );
}

/**
 * For admins: did the last Lock Screen button tap run, in which process (the app or the widget), was the app
 * listening, and did the app get it. Tap a button on the Live Activity, then come back here.
 */
function TapCheck() {
  const { t } = useT();
  const [x, setX] = useState(liveTapCheck);
  const time = (ms?: number) => (ms ? new Date(ms).toLocaleTimeString() : '–');
  return (
    <Card style={{ marginTop: 12 }}>
      <Text weight={700}>{t('Button check (admins)')}</Text>
      {!x.supported ? (
        <Text variant="small" color="sec">
          {t('Needs a newer app build.')}
        </Text>
      ) : (
        <Text variant="small" color="sec" style={{ marginTop: 4 }}>
          {`Ran: ${time(x.ran?.at)} · ${x.ran?.target ?? '–'} · ${x.ran?.process ?? '–'} · listening ${x.ran?.listening == null ? '–' : x.ran.listening ? 'yes' : 'no'}\nApp got: ${time(x.received?.at)} · ${x.received?.target ?? '–'}`}
        </Text>
      )}
      <Button small kind="soft" title={t('Refresh')} style={{ marginTop: 8, alignSelf: 'flex-start' }} onPress={() => setX(liveTapCheck())} />
    </Card>
  );
}
