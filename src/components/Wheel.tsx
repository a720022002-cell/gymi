import { useEffect, useRef, useState } from 'react';
import { type NativeScrollEvent, type NativeSyntheticEvent, Platform, Pressable, ScrollView, View } from 'react-native';

import { useSettings } from '@/theme/settings';

import { Text } from './Text';

const ITEM = 44;
const PAD = 88; // two rows above and below the selection band

type Column = { items: { value: number; label: string }[]; selected: number; width: number };

/** iOS-style wheel picker with several columns (design: .wheel / gwheel). */
export function Wheel({ columns, onChange }: { columns: Column[]; onChange: (values: number[]) => void }) {
  const { colors: c } = useSettings();
  const values = useRef(columns.map((col) => col.selected));

  return (
    <View
      style={{
        height: 220,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 2,
        direction: 'ltr',
        // Fade top and bottom (web supports CSS masks).
        ...(Platform.OS === 'web'
          ? { maskImage: 'linear-gradient(transparent, #000 28%, #000 72%, transparent)' }
          : null),
      } as object}>
      <View
        pointerEvents="none"
        style={{ position: 'absolute', left: 14, right: 14, top: PAD, height: ITEM, borderRadius: 12, backgroundColor: c.pill }}
      />
      {columns.map((col, ci) => (
        <WheelColumn
          key={ci}
          column={col}
          onSelect={(v) => {
            values.current[ci] = v;
            onChange([...values.current]);
          }}
        />
      ))}
    </View>
  );
}

function WheelColumn({ column, onSelect }: { column: Column; onSelect: (v: number) => void }) {
  const ref = useRef<ScrollView>(null);
  const startIndex = Math.max(0, column.items.findIndex((i) => i.value === column.selected));
  const [index, setIndex] = useState(startIndex);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    // Wait for layout, then jump to the selected row.
    const t = setTimeout(() => ref.current?.scrollTo({ y: startIndex * ITEM, animated: false }), 30);
    return () => clearTimeout(t);
    // Only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const settle = (y: number) => {
    const i = Math.max(0, Math.min(column.items.length - 1, Math.round(y / ITEM)));
    if (Math.abs(y - i * ITEM) > 1) ref.current?.scrollTo({ y: i * ITEM, animated: true });
    onSelect(column.items[i].value);
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    setIndex(Math.round(y / ITEM));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => settle(y), 120);
  };

  return (
    <ScrollView
      ref={ref}
      style={{ height: 220, width: column.width, flexGrow: 0 }}
      contentContainerStyle={{ paddingVertical: PAD }}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM}
      decelerationRate="fast"
      onScroll={onScroll}
      scrollEventThrottle={16}
      nestedScrollEnabled>
      {column.items.map((it, i) => {
        const d = Math.abs(i - index);
        return (
          <Pressable
            key={it.value}
            onPress={() => ref.current?.scrollTo({ y: i * ITEM, animated: true })}
            style={{ height: ITEM, alignItems: 'center', justifyContent: 'center' }}>
            <Text num size={d === 0 ? 26 : 24} color={d === 0 ? 'text' : 'sec'} style={{ opacity: d > 2 ? 0.4 : 1 }}>
              {it.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
