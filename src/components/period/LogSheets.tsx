import { useState } from 'react';
import { View } from 'react-native';

import { Stepper } from '@/components/food/Stepper';
import { DateField } from '@/components/health/DateField';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Chip, Label, Row } from '@/components/ui';
import { useT } from '@/i18n';
import { addPastPeriod, CY_LOG, type CycleLog, saveLog, SINGLE } from '@/lib/cycle';
import { useFood } from '@/lib/food';
import { addDays } from '@/lib/nutrition';
import { shortDate } from '@/lib/progress';

export function LogSheet({ day, init, onDone }: { day: string; init: CycleLog; onDone: () => void }) {
  const { t, lang } = useT();
  const toast = useToast();
  const [lg, setLg] = useState<CycleLog>(init);
  const tog = (cat: string, o: string) => {
    const a = lg[cat] ?? [];
    const next = a.includes(o) ? a.filter((x) => x !== o) : SINGLE.includes(cat) ? [o] : [...a, o];
    setLg({ ...lg, [cat]: next });
  };
  return (
    <View>
      <Text variant="h2">{t('Today, {d}', { d: shortDate(day, lang) })}</Text>
      <Text variant="small" color="sec" style={{ marginTop: 4 }}>
        {t('Tap what applies. It helps find your patterns.')}
      </Text>
      {Object.entries(CY_LOG).map(([cat, opts]) => (
        <View key={cat}>
          <Label>{t(cat)}</Label>
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            {opts.map((o) => (
              <Chip key={o} title={t(o)} on={(lg[cat] ?? []).includes(o)} onPress={() => tog(cat, o)} />
            ))}
          </Row>
        </View>
      ))}
      <Button
        title={t('Save')}
        style={{ marginTop: 16 }}
        onPress={async () => {
          const clean = Object.fromEntries(Object.entries(lg).filter(([, v]) => v.length));
          const ok = await saveLog(day, clean);
          toast(ok ? t('Saved for today') : t('Couldn’t save. Please try again.'), { icon: ok ? 'check' : 'warn' });
          onDone();
        }}
      />
    </View>
  );
}

export function PastSheet({ onDone }: { onDone: () => void }) {
  const { t } = useT();
  const toast = useToast();
  const { today } = useFood();
  const [d, setD] = useState(addDays(today, -28));
  const [b, setB] = useState(5);
  return (
    <View>
      <Text variant="h2">{t('Add a past period')}</Text>
      <Row style={{ justifyContent: 'space-between', marginTop: 16 }}>
        <Text weight={700}>{t('Period started on')}</Text>
        <DateField value={d} onChange={setD} label={t('Period started on')} max={today} />
      </Row>
      <Text weight={700} style={{ marginTop: 16 }}>
        {t('Period days')}
      </Text>
      <Card style={{ marginTop: 8 }}>
        <Stepper onMinus={() => setB(Math.max(1, b - 1))} onPlus={() => setB(Math.min(10, b + 1))} labels={[t('Less'), t('More')]}>
          <Text num size={26}>
            {b}
          </Text>
        </Stepper>
      </Card>
      <Button
        title={t('Add')}
        onPress={async () => {
          const ok = await addPastPeriod(d, b);
          toast(ok ? t('Past period added') : t('Couldn’t save. Please try again.'), { icon: ok ? 'check' : 'warn' });
          onDone();
        }}
      />
    </View>
  );
}
