import { type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { useSettings } from '@/theme/settings';

/** Grouped list card with thin lines between rows (design: .list). */
export function List({ children }: { children: ReactNode }) {
  const { colors: c } = useSettings();
  return <View style={{ backgroundColor: c.card, borderRadius: 22, overflow: 'hidden', marginBottom: 12 }}>{children}</View>;
}

export function ListRow({ children, onPress, first }: { children: ReactNode; onPress?: () => void; first?: boolean }) {
  const { colors: c } = useSettings();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 10, paddingHorizontal: 16, borderTopWidth: first ? 0 : 1, borderTopColor: c.line }}>
      {children}
    </Pressable>
  );
}
