import { router } from 'expo-router';
import { View } from 'react-native';

import { DateField } from '@/components/health/DateField';
import { Icon } from '@/components/Icon';
import { Ring } from '@/components/Ring';
import { List, ListRow } from '@/components/social/List';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Row, Toggle } from '@/components/ui';
import { useT } from '@/i18n';
import { type CycleSettings, dueDate } from '@/lib/cycle';
import { cycleRemindersSupported } from '@/lib/cycleReminders';
import { useFood } from '@/lib/food';
import { useTrain } from '@/lib/train';
import { addDays } from '@/lib/nutrition';
import { useSettings } from '@/theme/settings';

const SIZES = ['poppy seed', 'sesame seed', 'lentil', 'blueberry', 'raspberry', 'grape', 'kumquat', 'fig', 'lime', 'lemon', 'peach', 'apple', 'avocado', 'onion', 'sweet potato', 'mango', 'banana', 'carrot', 'papaya', 'grapefruit', 'cantaloupe', 'cauliflower', 'lettuce', 'cabbage', 'coconut', 'pineapple', 'squash', 'honeydew', 'watermelon'];

export function Pregnancy({ s, save }: { s: CycleSettings; save: (next: CycleSettings) => void }) {
  const train = useTrain();
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { today } = useFood();
  const w = s.preg_week ?? 12;
  const set = (pw: number) => save({ ...s, preg_week: pw });
  const ck = s.checklist ?? {};
  // Daily items (folic acid, water, protein) start fresh each day; the visit date stays.
  const daily = ck.day === today ? ck : { visit: ck.visit, visitRemind: ck.visitRemind };
  const setCk = (patch: Partial<NonNullable<CycleSettings['checklist']>>) => save({ ...s, checklist: { ...daily, ...patch, day: today } });
  const tri = w < 14 ? 1 : w < 28 ? 2 : 3;
  const size = SIZES[Math.max(0, Math.min(28, Math.floor((w - 4) / 1.2)))];
  const due = dueDate(w, today);
  const tips = ['Keep effort moderate: you should be able to talk while training.', 'No maximum lifts, no holding your breath, no contact sports.', ...(w >= 20 ? ['Avoid long time lying flat on your back. Use an incline bench instead.'] : []), 'Stop and call your doctor if you feel pain, dizziness or bleeding.'];
  const items: ['folic' | 'water' | 'protein', string, string][] = [
    ['folic', 'Take folic acid daily', 'Add it in Vitamins'],
    ['water', 'Drink 10 cups of water', ''],
    ['protein', 'Get 70 to 100 g protein', ''],
  ];
  return (
    <View>
      <Card style={{ alignItems: 'center', paddingVertical: 22 }}>
        <Ring value={w} max={40} size={170} stroke={15}>
          <Text variant="small" weight={700} color="sec">
            {t('Week')}
          </Text>
          <Text num size={40}>
            {w}
          </Text>
          <Text variant="small" weight={700} color="sec">
            {t('Trimester {n}', { n: tri })}
          </Text>
        </Ring>
        <Text variant="h3" center style={{ marginTop: 16 }}>
          {t('Your baby is about the size of a {x}', { x: t(size) })}
        </Text>
        <Text variant="small" color="sec">
          {t('Due around {d}', { d: new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${due}T12:00:00`)) })}
        </Text>
        <Row gap={8} style={{ marginTop: 12 }}>
          <Button small kind="soft" icon="minus" title="" onPress={() => set(Math.max(4, w - 1))} />
          <Text variant="small" weight={700} color="sec">
            {t('Change week')}
          </Text>
          <Button small kind="soft" icon="plus" title="" onPress={() => set(Math.min(42, w + 1))} />
        </Row>
      </Card>
      <Text variant="small" weight={700} color="sec" style={{ marginBottom: 8, marginHorizontal: 4 }}>
        {t('Your body this week')}
      </Text>
      <Card>
        <Text variant="small">{t(tri === 1 ? 'Tiredness and nausea are common. Small meals every few hours help.' : tri === 2 ? 'Energy often comes back. Your belly starts to show and your balance shifts.' : 'You may feel short of breath and need the bathroom more. Sleep on your side.')}</Text>
      </Card>
      <Text variant="small" weight={700} color="sec" style={{ marginBottom: 8, marginHorizontal: 4 }}>
        {t('Training while pregnant')}
      </Text>
      <Card>
        {tips.map((x) => (
          <Row key={x} gap={10} style={{ alignItems: 'flex-start', marginTop: 6 }}>
            <Icon name="check" size={16} color={c.up} strokeWidth={2.4} />
            <Text variant="small" style={{ flex: 1 }}>
              {t(x)}
            </Text>
          </Row>
        ))}
        <Row gap={12} style={{ marginTop: 12, backgroundColor: c.inset, borderRadius: 14, padding: 12 }}>
          <View style={{ flex: 1 }}>
            <Text variant="small" weight={700}>
              {t('Adjust my workouts for pregnancy')}
            </Text>
            <Text variant="xs" color="sec">
              {t('Lighter weights, safer exercises')}
            </Text>
          </View>
          <Toggle
            value={!!s.preg_adjust}
            label={t('Adjust my workouts for pregnancy')}
            onChange={(v) => {
              save({ ...s, preg_adjust: v });
              // Training picks it up right away.
              train.setPreg(v);
              toast(t(v ? 'Workouts will be adjusted for pregnancy' : 'Workouts back to normal'), { icon: 'check' });
            }}
          />
        </Row>
      </Card>
      <Text variant="small" weight={700} color="sec" style={{ marginBottom: 8, marginHorizontal: 4 }}>
        {t('Checklist')}
      </Text>
      <List>
        {items.map(([k, a, b], i) => (
          <ListRow key={k} first={!i} onPress={() => setCk({ [k]: !daily[k] })}>
            <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: daily[k] ? c.cobalt : 'transparent', borderWidth: daily[k] ? 0 : 2, borderColor: c.line }}>
              {daily[k] ? <Icon name="check" size={14} color="#FFFFFF" strokeWidth={3} /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text weight={700}>{t(a)}</Text>
              {b ? (
                <Text variant="xs" color="link" onPress={() => router.push('/vitamins')}>
                  {t(b)}
                </Text>
              ) : null}
            </View>
          </ListRow>
        ))}
        <ListRow>
          <Icon name="cal" size={20} color={c.cobalt} />
          <View style={{ flex: 1 }}>
            <Text weight={700}>{t('Next doctor visit')}</Text>
            <Text variant="xs" color="sec">
              {daily.visit ? (daily.visitRemind ? t('Reminder the day before') : t('No reminder')) : t('Set a reminder')}
            </Text>
          </View>
          <DateField value={daily.visit && daily.visit >= today ? daily.visit : addDays(today, 14)} onChange={(v) => setCk({ visit: v, visitRemind: true })} label={t('Next doctor visit')} max={addDays(today, 300)} />
        </ListRow>
        {daily.visit ? (
          <ListRow>
            <Text weight={700} style={{ flex: 1 }}>
              {t('Remind me the day before')}
            </Text>
            <Toggle value={!!daily.visitRemind} label={t('Remind me the day before')} onChange={(v) => setCk({ visitRemind: v })} />
          </ListRow>
        ) : null}
      </List>
      {daily.visit && daily.visitRemind && !cycleRemindersSupported ? (
        <Text variant="xs" color="sec" style={{ marginHorizontal: 4, marginBottom: 8 }}>
          {t('Reminders work in the Adro phone app.')}
        </Text>
      ) : null}
      <Text variant="xs" color="sec" center>
        {t('Always check with your doctor before starting or changing exercise in pregnancy.')}
      </Text>
    </View>
  );
}

export function AfterBirth({ week: w, set }: { week: number; set: (w: number) => void }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const stage = w < 6 ? 0 : w < 12 ? 1 : 2;
  const steps: [string, string][] = [
    ['Weeks 0 to 6', 'Breathing, pelvic floor and short walks'],
    ['After your doctor clears you', 'Light strength, low impact, core rebuild'],
    ['From about week 12', 'Build back to normal training, slowly add running and jumping'],
  ];
  return (
    <View>
      <Card style={{ alignItems: 'center', paddingVertical: 22 }}>
        <Text variant="small" weight={700} color="sec">
          {t('Since birth')}
        </Text>
        <Text num size={34}>
          {t('{n} weeks', { n: w })}
        </Text>
        <Row gap={8} style={{ marginTop: 12 }}>
          <Button small kind="soft" icon="minus" title="" onPress={() => set(Math.max(0, w - 1))} />
          <Text variant="small" weight={700} color="sec">
            {t('Change')}
          </Text>
          <Button small kind="soft" icon="plus" title="" onPress={() => set(Math.min(104, w + 1))} />
        </Row>
      </Card>
      <Text variant="small" weight={700} color="sec" style={{ marginBottom: 8, marginHorizontal: 4 }}>
        {t('Getting back to training')}
      </Text>
      <List>
        {steps.map(([a, b], i) => (
          <ListRow key={a} first={!i}>
            <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: i < stage ? c.cobalt : 'transparent', borderWidth: i < stage ? 0 : 2, borderColor: i === stage ? c.cobalt : c.line }}>
              {i < stage ? <Icon name="check" size={13} color="#FFFFFF" strokeWidth={3} /> : <Text variant="xs" weight={700} color={i === stage ? c.cobalt : 'sec'}>{`${i + 1}`}</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text weight={700}>{t(a)}</Text>
              <Text variant="small" color="sec">
                {t(b)}
              </Text>
            </View>
          </ListRow>
        ))}
      </List>
      <Card style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
        <Icon name="food" size={20} color={c.cobalt} />
        <Text variant="small" style={{ flex: 1 }}>
          {t('If you’re breastfeeding you need about 400 to 500 kcal more a day. Don’t start a big cut.')}
        </Text>
      </Card>
      <Text variant="xs" color="sec" center>
        {t('Your first period can take weeks or months to come back. Start tracking again when it does.')}
      </Text>
    </View>
  );
}
