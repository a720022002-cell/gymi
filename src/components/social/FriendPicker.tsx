import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { displayName, type FriendRow, myFriends } from '@/lib/social';
import { useSettings } from '@/theme/settings';

import { Icon } from '../Icon';
import { Text } from '../Text';
import { Avatar } from './Avatar';
import { List, ListRow } from './List';

/** Pick friends from your list (tick circles on the right). */
export function FriendPicker({ value, onChange, exclude = [] }: { value: string[]; onChange: (v: string[]) => void; exclude?: string[] }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const [list, setList] = useState<FriendRow[] | null>(null);
  useEffect(() => {
    let alive = true;
    myFriends().then((f) => alive && setList(f.filter((x) => x.status === 'accepted')));
    return () => {
      alive = false;
    };
  }, []);
  if (!list) return null;
  const rows = list.filter((f) => !exclude.includes(f.id));
  if (!rows.length)
    return (
      <Text variant="small" color="sec" style={{ marginHorizontal: 4 }}>
        {t('No friends to add.')}
      </Text>
    );
  return (
    <List>
      {rows.map((f, i) => {
        const on = value.includes(f.id);
        return (
          <ListRow key={f.id} first={!i} onPress={() => onChange(on ? value.filter((x) => x !== f.id) : [...value, f.id])}>
            <Avatar id={f.id} name={displayName(f)} size={34} />
            <View style={{ flex: 1 }}>
              <Text weight={700}>{displayName(f)}</Text>
              <Text variant="xs" color="sec">{`@${f.username}`}</Text>
            </View>
            <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.cobalt : 'transparent', borderWidth: on ? 0 : 2, borderColor: c.line }}>
              {on ? <Icon name="check" size={14} color="#FFFFFF" strokeWidth={3} /> : null}
            </View>
          </ListRow>
        );
      })}
    </List>
  );
}
