import { View } from 'react-native';

import { useT } from '@/i18n';
import { type SportGroup, type SportId, sportInfo } from '@/lib/sports';
import { useSettings } from '@/theme/settings';

import { Icon } from '../Icon';
import { Text } from '../Text';
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

/** Sports as a grid of tiles, four a row. Picked ones get a ring and a check. */
export function SportTiles({ ids, picked, onPick }: { ids: SportId[]; picked?: (id: SportId) => boolean; onPick: (id: SportId) => void }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 }}>
      {ids.map((id) => {
        const on = !!picked?.(id);
        const col = GROUP_COLORS[sportInfo(id).group];
        return (
          <Springy key={id} onPress={() => onPick(id)} scaleTo={0.94} accessibilityLabel={t(sportInfo(id).name)} accessibilityState={picked ? { selected: on } : undefined} style={{ width: '25%', alignItems: 'center', gap: 7 }}>
            <View style={{ borderRadius: 22, borderWidth: 2, borderColor: on ? col : 'transparent', padding: 2 }}>
              <SportBadge id={id} size={54} />
              {on ? (
                <View style={{ position: 'absolute', top: -4, end: -4, width: 20, height: 20, borderRadius: 10, backgroundColor: col, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.bg }}>
                  <Icon name="check" size={11} color="#FFFFFF" strokeWidth={3} />
                </View>
              ) : null}
            </View>
            <Text weight={700} size={12} center numberOfLines={1} color={on ? c.text : undefined} style={{ maxWidth: '96%' }}>
              {t(sportInfo(id).name)}
            </Text>
          </Springy>
        );
      })}
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
