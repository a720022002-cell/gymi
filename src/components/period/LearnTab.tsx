import { useState } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Sheet } from '@/components/Sheet';
import { List, ListRow } from '@/components/social/List';
import { Text } from '@/components/Text';
import { Button, Card, Row } from '@/components/ui';
import { useT } from '@/i18n';
import { useSettings } from '@/theme/settings';

const ARTICLES: [string, string, string][] = [
  ['Cycle basics', 'The 4 phases of your cycle, simply explained', 'Your cycle has 4 phases: your period, the follicular phase (energy rises), ovulation (an egg is released), and the luteal phase (progesterone rises, hunger and water weight can go up). A normal cycle is 21 to 35 days.'],
  ['Hormones', 'What estrogen and progesterone do to energy and hunger', 'Estrogen rises after your period and peaks before ovulation. Many women feel more energy and strength then. After ovulation progesterone rises: body temperature goes up a little, hunger can grow and you may hold more water. Both drop before your period, which can bring low mood or cramps.'],
  ['Training', 'How to train in each phase', 'Follicular phase: push heavier and try PRs. Ovulation: still strong, warm up well. Luteal: keep weights, drop a set if tired. Period: train as you feel; light movement can ease cramps.'],
  ['Nutrition', 'Iron, magnesium and cravings', 'You lose iron during your period, so eat red meat, lentils or spinach with vitamin C. Magnesium (nuts, dark chocolate) can help cramps. Cravings in the luteal phase are normal; plan a protein snack.'],
  ['Fertility', 'How the fertile window works', 'An egg lives about a day after ovulation, and sperm can live up to 5 days. So the fertile window is the 5 days before ovulation and the day of it. Ovulation is usually about 14 days before your next period.'],
  ['Pregnancy', 'Safe exercise when you’re pregnant', 'Most women can keep training at a moderate effort: you should be able to talk. Avoid maximum lifts, holding your breath and contact sports. Always check with your doctor first.'],
  ['After birth', 'Pelvic floor and returning to the gym', 'Start with breathing, pelvic floor work and walks. After your doctor clears you, add light strength and rebuild your core. Running and jumping usually come back from about week 12.'],
  ['Perimenopause', 'Hot flashes, sleep and staying strong', 'Perimenopause is the years before your periods stop, often from your 40s. Hormones go up and down, so cycles change and hot flashes, night sweats and poor sleep are common. Lifting weights 2 to 3 times a week and enough protein help keep bones and muscle strong. A cool bedroom helps sleep.'],
  ['When to see a doctor', 'Very painful, heavy or missing periods', 'See a doctor if your periods are very painful, very heavy, last more than 7 days, come less than 21 or more than 35 days apart, or stop for 3 months when you’re not pregnant.'],
];

export function LearnTab() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const [open, setOpen] = useState<number | null>(null);
  return (
    <View>
      <List>
        {ARTICLES.map(([cat, title], i) => (
          <ListRow key={title} first={!i} onPress={() => setOpen(i)}>
            <Icon name="book" size={18} color={c.cobalt} />
            <View style={{ flex: 1 }}>
              <Text variant="xs" weight={700} color="sec">
                {t(cat)}
              </Text>
              <Text weight={700}>{t(title)}</Text>
            </View>
            <Icon name="chev" size={16} color={c.sec} />
          </ListRow>
        ))}
      </List>
      <Text variant="xs" color="sec" style={{ marginHorizontal: 4, marginBottom: 12 }}>
        {t('Health articles are reviewed by doctors before release.')}
      </Text>
      <Text variant="small" weight={700} color="sec" style={{ marginTop: 8, marginBottom: 8, marginHorizontal: 4 }}>
        {t('Private community')}
      </Text>
      <Card style={{ opacity: 0.7 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text weight={700}>{t('Women-only, anonymous')}</Text>
          <View style={{ backgroundColor: c.inset, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text variant="xs" weight={700} color="sec">
              {t('Coming soon')}
            </Text>
          </View>
        </Row>
        <Text variant="small" color="sec" style={{ marginTop: 4 }}>
          {t('Anonymous. Only women can join. Your name and photo are never shown.')}
        </Text>
      </Card>
      <Sheet open={open != null} onClose={() => setOpen(null)}>
        {open != null ? (
          <View>
            <Text variant="xs" weight={700} color="sec">
              {t(ARTICLES[open][0])}
            </Text>
            <Text variant="h2" style={{ marginTop: 4 }}>
              {t(ARTICLES[open][1])}
            </Text>
            <Text style={{ marginTop: 12, lineHeight: 24 }}>{t(ARTICLES[open][2])}</Text>
            <Button kind="soft" title={t('Done')} style={{ marginTop: 16 }} onPress={() => setOpen(null)} />
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}
