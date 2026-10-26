import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';

import { useT } from '@/i18n';
import { SPORT_GROUPS, type SportGroup, type SportId, sportInfo } from '@/lib/sports';
import { useSettings } from '@/theme/settings';

import { Icon } from '../Icon';
import { fontFor, Text } from '../Text';
import { Row, Springy } from '../ui';

/** Each group's color on sport tiles, and its short name on filter chips. */
export const GROUP_COLORS: Record<SportGroup, string> = { Cardio: '#3355FF', 'Racket sports': '#F59E0B', 'Team sports': '#22C55E', Combat: '#EF4444', 'Mind and body': '#A855F7', Other: '#94A3B8' };
export const GROUP_SHORT: Record<SportGroup, string> = { Cardio: 'Cardio', 'Racket sports': 'Racket', 'Team sports': 'Team', Combat: 'Combat', 'Mind and body': 'Mind & body', Other: 'Other' };

/** A sport's icon in a rounded square of its group's color. */
export function SportBadge({ id, size = 58 }: { id: SportId; size?: number }) {
  const s = sportInfo(id);
  const col = GROUP_COLORS[s.group];
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.34, alignItems: 'center', justifyContent: 'center', backgroundColor: `${col}24` }}>
      <Icon name={s.icon ?? 'flame'} size={Math.round(size * 0.42)} color={col} />
    </View>
  );
}

/** A small uppercase section label. */
export function SecLabel({ children, dot }: { children: string; dot?: string }) {
  return (
    <Row gap={8}>
      {dot ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dot }} /> : null}
      <Text variant="xs" weight={700} color="sec" style={{ letterSpacing: 0.6, textTransform: 'uppercase' }}>
        {children}
      </Text>
    </Row>
  );
}

/** A row of rounded pills to pick one value (time, sessions a week, days). */
export function Pills<V extends string | number | null>({ options, value, onPick, mark, off }: { options: { v: V; label: string; on?: boolean; soft?: boolean }[]; value?: V; onPick: (v: V) => void; mark?: V; off?: string }) {
  const { colors: c } = useSettings();
  return (
    <Row gap={8} style={{ flexWrap: 'wrap' }}>
      {options.map((o) => {
        const on = o.on ?? o.v === value;
        return (
          <Springy
            key={String(o.v)}
            onPress={() => onPick(o.v)}
            accessibilityState={{ selected: on }}
            style={{ minWidth: 48, height: 40, paddingHorizontal: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: on ? c.text : o.soft ? c.gAi : (off ?? c.inset), borderWidth: o.soft && !on ? 1 : 0, borderColor: c.gAiBorder }}>
            <Text num weight={700} size={14} color={on ? c.bg : c.text}>
              {o.label}
            </Text>
            {mark !== undefined && o.v === mark && !on ? <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: c.link }} /> : null}
          </Springy>
        );
      })}
    </Row>
  );
}

/**
 * Sports as a simple list (design: select activity): search, a tab per kind, Recent on top, then everything A–Z.
 * Picked ones (`picked`) get a check. `recent`: your last sports, shown first when you aren't searching.
 */
export function SportList({ ids, picked, onPick, recent = [] }: { ids: SportId[]; picked?: (id: SportId) => boolean; onPick: (id: SportId) => void; recent?: SportId[] }) {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<SportGroup | null>(null);
  const groups = SPORT_GROUPS.filter((g) => ids.some((id) => sportInfo(id).group === g));
  const name = (id: SportId) => t(sportInfo(id).name);
  const words = q.trim().toLowerCase();
  const list = ids
    .filter((id) => (!tab || sportInfo(id).group === tab) && (!words || name(id).toLowerCase().includes(words) || sportInfo(id).name.toLowerCase().includes(words)))
    .sort((a, b) => name(a).localeCompare(name(b), lang));
  const recentIds = !words && !tab ? recent.filter((id) => ids.includes(id)).slice(0, 3) : [];
  const head = (text: string) => (
    <Row gap={10} style={{ marginTop: 16, marginBottom: 8, marginHorizontal: 4 }}>
      <Text variant="xs" weight={800} color="sec" style={{ letterSpacing: 0.8, textTransform: 'uppercase' }}>
        {text}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: c.line }} />
    </Row>
  );
  const row = (id: SportId, key: string) => {
    const on = !!picked?.(id);
    return (
      <Springy
        key={key}
        onPress={() => onPick(id)}
        scaleTo={0.98}
        accessibilityRole="button"
        accessibilityState={picked ? { selected: on } : undefined}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60, paddingHorizontal: 14, marginBottom: 8, borderRadius: 18, backgroundColor: c.card, borderWidth: on ? 2 : 0, borderColor: c.cobalt }}>
        <SportBadge id={id} size={38} />
        <Text weight={700} style={{ flex: 1 }} numberOfLines={1}>
          {name(id)}
        </Text>
        {on ? (
          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c.cobalt, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" size={13} color="#FFFFFF" strokeWidth={3} />
          </View>
        ) : picked ? (
          <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: c.line }} />
        ) : (
          <Icon name="chev" size={16} color={c.sec} />
        )}
      </Springy>
    );
  };
  // A short list (a few sports): just the rows.
  if (ids.length <= 8) return <View>{[...ids].sort((a, b) => name(a).localeCompare(name(b), lang)).map((id) => row(id, id))}</View>;
  return (
    <View>
      <Row gap={10} style={{ height: 50, borderRadius: 16, paddingHorizontal: 14, backgroundColor: c.card }}>
        <Icon name="search" size={18} color={c.sec} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder={t('Search sports')}
          placeholderTextColor={c.sec}
          autoCorrect={false}
          style={{ flex: 1, fontSize: 16, color: c.text, fontFamily: fontFor(lang === 'ar' ? 'arabic' : 'manrope', 500), outlineStyle: 'none', textAlign: lang === 'ar' ? 'right' : 'left' } as object}
        />
        {q ? (
          <Springy onPress={() => setQ('')} accessibilityLabel={t('Clear')}>
            <Icon name="close" size={16} color={c.sec} />
          </Springy>
        ) : null}
      </Row>
      {/* Tabs: All and each kind, underlined when on. Fixed height so the row doesn't stretch. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginTop: 12, marginHorizontal: -20 }} contentContainerStyle={{ gap: 20, paddingHorizontal: 24 }}>
        {[null, ...groups].map((g) => {
          const on = tab === g;
          return (
            <Springy key={g ?? 'all'} onPress={() => setTab(g)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={{ paddingVertical: 6 }}>
              <Text variant="small" weight={800} color={on ? undefined : 'sec'} style={{ letterSpacing: 0.4 }}>
                {t(g ? GROUP_SHORT[g] : 'All')}
              </Text>
              <View style={{ height: 3, borderRadius: 2, marginTop: 5, backgroundColor: on ? c.cobalt : 'transparent' }} />
            </Springy>
          );
        })}
      </ScrollView>
      {recentIds.length ? (
        <>
          {head(t('Recent'))}
          {recentIds.map((id) => row(id, `r-${id}`))}
        </>
      ) : null}
      {head(words ? t('Results') : tab ? t(tab) : t('All A–Z'))}
      {list.length ? (
        list.map((id) => row(id, id))
      ) : (
        <Text color="sec" center style={{ marginTop: 12 }}>
          {t('No sport matches “{q}”', { q: q.trim() })}
        </Text>
      )}
    </View>
  );
}
