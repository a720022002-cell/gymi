import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { Field } from '@/components/Field';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Card, Chip, Row, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { type DbExercise, dbExName, searchExercises } from '@/lib/exercisesDb';
import { EQUIPMENT, muscleLabel, MUSCLES } from '@/lib/training';
import { useSettings } from '@/theme/settings';

/** All exercises, filtered by equipment and muscle (design: library). */
export default function Library() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const [q, setQ] = useState('');
  const [eq, setEq] = useState<string | null>(null);
  const [m, setM] = useState<string | null>(null);
  const [list, setList] = useState<DbExercise[]>([]);
  const [doneKey, setDoneKey] = useState<string | null>(null);
  const key = `${eq}|${m}|${q}`;
  const loading = doneKey !== key;
  const latest = useRef(0);

  useEffect(() => {
    const id = ++latest.current;
    const timer = setTimeout(async () => {
      const r = await searchExercises(q, m, eq, 200);
      if (id === latest.current) {
        setList(r);
        setDoneKey(`${eq}|${m}|${q}`);
      }
    }, q ? 250 : 0);
    return () => clearTimeout(timer);
  }, [q, m, eq]);

  const chips = (opts: (string | null)[], val: string | null, set: (v: string | null) => void) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
      {opts.map((x) => (
        <Chip key={x ?? 'all'} title={x ? muscleLabel(x, lang, t) : t('All')} on={val === x} onPress={() => set(x)} />
      ))}
    </ScrollView>
  );

  return (
    <Screen title={t('Exercise library')} back>
      <Field value={q} onChangeText={setQ} placeholder={t('Search exercises')} autoCorrect={false} />
      <View style={{ marginTop: 10, gap: 8 }}>
        {chips([null, ...EQUIPMENT], eq, setEq)}
        {chips([null, ...MUSCLES], m, setM)}
      </View>
      <Text variant="small" weight={700} color="sec" style={{ marginTop: 16, marginBottom: 8, marginHorizontal: 4 }}>
        {loading ? ' ' : t(list.length >= 200 ? '200+ exercises' : '{n} exercises', { n: list.length })}
      </Text>
      {loading && !list.length ? (
        <ActivityIndicator color={c.cobalt} style={{ marginTop: 30 }} />
      ) : list.length ? (
        <View style={{ backgroundColor: c.card, borderRadius: 22, overflow: 'hidden' }}>
          {list.map((e, i) => (
            <Springy key={e.id} onPress={() => router.push({ pathname: '/exercise', params: { id: e.id } })} scaleTo={0.99} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 8, paddingHorizontal: 12, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
              <View style={{ width: 48, height: 48, borderRadius: 12, overflow: 'hidden', backgroundColor: c.inset }}>
                {e.images[0] ? <Image source={{ uri: e.images[0] }} style={{ width: 48, height: 48 }} contentFit="cover" recyclingKey={e.id} /> : null}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text weight={700} numberOfLines={1}>
                  {dbExName(e, lang)}
                </Text>
                <Text variant="small" color="sec" numberOfLines={1}>
                  {`${muscleLabel(e.muscle, lang, t)}${t(', ')}${t(e.equipment).toLowerCase()}`}
                </Text>
              </View>
              <Icon name="chev" size={18} color={c.sec} />
            </Springy>
          ))}
        </View>
      ) : (
        <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
          <Text variant="h3">{t('No exercises match')}</Text>
          <Springy
            onPress={() => {
              setEq(null);
              setM(null);
              setQ('');
            }}
            style={{ marginTop: 8 }}>
            <Row gap={4}>
              <Text weight={700} color="link">
                {t('Clear filters')}
              </Text>
            </Row>
          </Springy>
        </Card>
      )}
    </Screen>
  );
}
