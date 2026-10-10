import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useT } from '@/i18n';
import { type DbExercise, dbExName, searchExercises } from '@/lib/exercisesDb';
import { muscleLabel, MUSCLES } from '@/lib/training';
import { useSettings } from '@/theme/settings';

import { Field } from '../Field';
import { Icon } from '../Icon';
import { Sheet } from '../Sheet';
import { Text } from '../Text';
import { Chip, Row, Springy } from '../ui';

/** Search the exercise list to add or replace one (design: SH.expick). */
export function ExercisePicker({ open, title, replacing, exclude, onClose, onPick }: { open: boolean; title: string; replacing?: boolean; exclude?: string[]; onClose: () => void; onPick: (e: DbExercise) => void }) {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const [q, setQ] = useState('');
  const [m, setM] = useState<string | null>(null);
  const [results, setResults] = useState<DbExercise[]>([]);
  const [doneKey, setDoneKey] = useState<string | null>(null);
  const loading = doneKey !== `${m}|${q}`;
  const latest = useRef(0);

  useEffect(() => {
    if (!open) return;
    const id = ++latest.current;
    const timer = setTimeout(async () => {
      const r = await searchExercises(q, m, null, q ? 60 : 80);
      if (id === latest.current) {
        setResults(r);
        setDoneKey(`${m}|${q}`);
      }
    }, q ? 250 : 0);
    return () => clearTimeout(timer);
  }, [q, m, open]);

  const list = results.filter((e) => !exclude?.includes(e.id));
  return (
    <Sheet open={open} onClose={onClose}>
      <Text variant="h2">{title}</Text>
      <Field value={q} onChangeText={setQ} placeholder={t('Search exercises')} autoCorrect={false} />
      <Row gap={8} style={{ flexWrap: 'wrap', marginTop: 10 }}>
        {[null, ...MUSCLES].map((x) => (
          <Chip key={x ?? 'all'} title={x ? muscleLabel(x, lang, t) : t('All')} on={m === x} onPress={() => setM(x)} />
        ))}
      </Row>
      <View style={{ marginTop: 10, minHeight: 240 }}>
        {loading && !list.length ? (
          <ActivityIndicator color={c.cobalt} style={{ marginTop: 30 }} />
        ) : list.length ? (
          <View style={{ backgroundColor: 'rgba(127,127,135,0.1)', borderRadius: 22, overflow: 'hidden' }}>
            {list.map((e, i) => (
              <Springy key={e.id} onPress={() => onPick(e)} scaleTo={0.99} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingVertical: 8, paddingHorizontal: 14, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text weight={700} numberOfLines={1}>
                    {dbExName(e, lang)}
                  </Text>
                  <Text variant="xs" color="sec" numberOfLines={1}>
                    {[muscleLabel(e.muscle, lang, t), t(e.equipment), e.machines?.[0] ? (lang === 'ar' ? e.machines[0][1] : e.machines[0][0]) : null].filter(Boolean).join(t(', '))}
                  </Text>
                </View>
                <Icon name={replacing ? 'swap' : 'plus'} size={18} color={c.cobalt} strokeWidth={2.2} />
              </Springy>
            ))}
          </View>
        ) : (
          <Text color="sec" center style={{ marginTop: 30 }}>
            {t('No exercises match.')}
          </Text>
        )}
      </View>
    </Sheet>
  );
}
