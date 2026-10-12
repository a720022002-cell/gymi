import { router } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { ReminderBell, useReminder } from '@/components/food/ReminderBell';
import { WaterGoalSheet } from '@/components/food/WaterGoalSheet';
import { Choices } from '@/components/health/bits';
import { Icon, type IconName } from '@/components/Icon';
import { Ring } from '@/components/Ring';
import { DayNav } from '@/components/DayNav';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Chip, Label, NavButton, Row, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { caffeineCheck, caffeineOfDrink, caffeineToday, showCaffeineAlert } from '@/lib/caffeine';
import { useFood } from '@/lib/food';
import { calcPlan, fmt, fmtTime } from '@/lib/nutrition';
import { fastTimes } from '@/lib/prayer';
import { fx } from '@/lib/progress';
import { useSettings } from '@/theme/settings';

const KINDS = ['Water', 'Coffee', 'Tea'];
const KIND_ICON: Record<string, IconName> = { Water: 'glass', Coffee: 'coffee', Tea: 'coffee' };

/** Water today: big ring, quick adds, other drinks, goal and today's list (design: water). */
export default function WaterScreen() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const food = useFood();
  const goal = food.plan.water || 2800;
  const [drink, setDrink] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const reminder = useReminder('water');
  const fast = food.plan.ramadan ? fastTimes(food.plan.city, food.today) : null;

  const add = async (ml: number, kind = 'Water') => {
    // Coffee or tea: warn about a big caffeine dose, counting what you already had today.
    const caf = food.isToday ? caffeineCheck(caffeineOfDrink(kind, ml), caffeineToday(food.logs.map((l) => l.name), food.waterLogs), new Date().getHours() >= 15) : null;
    await food.addWater(ml, kind);
    toast(t('Added {n} ml {k}', { n: ml, k: t(kind).toLowerCase() }), { icon: 'drop' });
    if (caf) setTimeout(() => showCaffeineAlert(caf), 900);
  };

  const time = (iso: string) => new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

  return (
    <Screen
      title={t('Water')}
      back
      right={
        <Row gap={6}>
          <ReminderBell kind="water" />
          <NavButton icon="plus" label={t('Add a drink')} onPress={() => setDrink(true)} />
        </Row>
      }>
      <DayNav />
      <Card style={{ alignItems: 'center', paddingVertical: 26 }}>
        <Ring value={food.water} max={goal} size={210} stroke={20}>
          <Icon name="drop" size={26} color={c.cobalt} strokeWidth={2} />
          <Text num size={40} style={{ marginTop: 4 }}>
            {fmt(food.water)}
          </Text>
          <Springy onPress={() => setGoalOpen(true)} accessibilityLabel={t('Edit water goal')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4 }}>
            <Text variant="small" weight={700} color="sec">
              {t('of {n} ml', { n: fmt(goal) })}
            </Text>
            <Icon name="edit" size={13} color={c.sec} />
          </Springy>
        </Ring>
        <Row gap={10} style={{ marginTop: 16 }}>
          <Button small kind="glass" icon="plus" title={t('{n} ml', { n: 250 })} onPress={() => add(250)} />
          <Button small kind="glass" icon="plus" title={t('{n} ml', { n: 500 })} onPress={() => add(500)} />
          <Button small title={t('Other')} onPress={() => setDrink(true)} />
        </Row>
        {food.water >= goal ? (
          <Text variant="small" weight={700} color="up" style={{ marginTop: 12 }}>
            {t('Goal done for today. Nice.')}
          </Text>
        ) : (
          <Text variant="small" color="sec" style={{ marginTop: 12 }}>
            {t('{n} ml to go', { n: fmt(goal - food.water) })}
          </Text>
        )}
      </Card>

      {fast ? (
        <Card>
          <Row gap={8}>
            <Icon name="moon" size={20} color={c.cobalt} />
            <Text weight={700} style={{ flex: 1 }}>
              {t('Ramadan: drink between iftar and suhoor')}
            </Text>
          </Row>
          <Row style={{ justifyContent: 'space-between', marginTop: 12 }}>
            <Text variant="small" weight={700}>
              {t('Iftar {time}', { time: fmtTime(fast.maghrib, lang) })}
            </Text>
            <Text variant="small" weight={700}>
              {t('Suhoor {time}', { time: fmtTime(fast.fajr, lang) })}
            </Text>
          </Row>
          <Row gap={4} style={{ marginTop: 10 }}>
            {Array.from({ length: 10 }, (_, i) => (
              <View key={i} style={{ flex: 1, height: 22, borderRadius: 6, backgroundColor: i < Math.round((food.water / goal) * 10) ? c.cobalt : c.track }} />
            ))}
          </Row>
          <Text variant="small" color="sec" style={{ marginTop: 8 }}>
            {t('About 1 glass (300 ml) every hour from iftar until suhoor.')}
          </Text>
        </Card>
      ) : null}
      <Text variant="small" weight={700} color="sec" style={{ marginTop: 16, marginBottom: 8, marginHorizontal: 4 }}>
        {t('Today')}
      </Text>
      {food.waterLogs.length ? (
        <View style={{ backgroundColor: c.card, borderRadius: 22, overflow: 'hidden' }}>
          {food.waterLogs
            .slice()
            .reverse()
            .map((e, i) => (
              <Row key={e.id} style={{ minHeight: 56, paddingHorizontal: 16, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
                <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={KIND_ICON[e.kind] ?? 'drop'} size={17} color={c.cobalt} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text weight={700}>{t(e.kind)}</Text>
                  <Text variant="xs" color="sec">
                    {time(e.created_at)}
                  </Text>
                </View>
                <Text num weight={700}>{`${e.ml} ${t('ml')}`}</Text>
                <Springy
                  accessibilityLabel={t('Delete')}
                  onPress={async () => {
                    const r = await food.deleteWater(e.id);
                    if (r) toast(t('Removed {n} ml', { n: r.ml }), { icon: 'trash', undo: () => food.addWater(r.ml, r.kind) });
                  }}
                  style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="trash" size={17} color={c.sec} />
                </Springy>
              </Row>
            ))}
        </View>
      ) : (
        <Card style={{ alignItems: 'center' }}>
          <Text color="sec">{t('Nothing yet today. Tap + to add a glass.')}</Text>
        </Card>
      )}
      <Text variant="small" weight={700} color="sec" style={{ marginTop: 16, marginBottom: 8, marginHorizontal: 4 }}>
        {t('Reminders')}
      </Text>
      <Springy onPress={() => router.push('/notifications')} scaleTo={0.99} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 16, backgroundColor: c.card, borderRadius: 22 }}>
        <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="bell" size={18} color={reminder.on ? c.cobalt : c.text} />
        </View>
        <View style={{ flex: 1 }}>
          <Text weight={700}>{t('Water reminders')}</Text>
          <Text variant="small" color="sec">
            {reminder.on ? reminder.summary : t('Off')}
          </Text>
        </View>
        <Icon name="chev" size={16} color={c.sec} />
      </Springy>
      <Button
        kind="glass"
        icon="bell"
        title={t('Preview a reminder')}
        style={{ marginTop: 12 }}
        onPress={() =>
          toast(goal - food.water > 0 ? t('Time for a glass of water. You’re {n} ml behind.', { n: fmt(goal - food.water) }) : t('Water goal done for today. Nice.'), {
            icon: 'drop',
            action: { label: t('Settings'), fn: () => router.push('/notifications') },
          })
        }
      />

      <DrinkSheet open={drink} onClose={() => setDrink(false)} onAdd={(ml, k) => (setDrink(false), add(ml, k))} />
      <WaterGoalSheet
        open={goalOpen}
        onClose={() => setGoalOpen(false)}
        value={goal}
        suggested={calcPlan(food.plan, food.person).water}
        onSave={(v) => {
          food.updatePlan({ water: v });
          setGoalOpen(false);
          toast(t('Water goal set to {n} L a day', { n: fx(v / 1000) }), { icon: 'drop' });
        }}
      />
    </Screen>
  );
}

function DrinkSheet({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (ml: number, kind: string) => void }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const [ml, setMl] = useState(300);
  const [kind, setKind] = useState(0);
  return (
    <Sheet open={open} onClose={onClose}>
      <Text variant="h2">{t('Add a drink')}</Text>
      <Label>{t('Amount (ml)')}</Label>
      <TextInput
        value={ml ? String(ml) : ''}
        onChangeText={(v) => setMl(Math.min(5000, Number(v.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/\D/g, '')) || 0))}
        inputMode="numeric"
        accessibilityLabel={t('Amount (ml)')}
        style={{ height: 56, borderRadius: 16, backgroundColor: c.card, paddingHorizontal: 16, fontSize: 24, fontFamily: 'Sora_600SemiBold', color: c.text }}
      />
      <Row gap={8} style={{ marginTop: 8, flexWrap: 'wrap' }}>
        {[150, 250, 300, 500].map((v) => (
          <Chip key={v} title={t('{n} ml', { n: v })} on={ml === v} onPress={() => setMl(v)} />
        ))}
      </Row>
      <Label>{t('Drink')}</Label>
      <Choices options={KINDS} value={kind} onChange={setKind} icons={KINDS.map((k) => KIND_ICON[k] ?? 'glass')} />
      <Button title={t('Add {n} ml', { n: ml })} disabled={!(ml > 0)} style={{ marginTop: 16 }} onPress={() => onAdd(ml, KINDS[kind])} />
    </Sheet>
  );
}
