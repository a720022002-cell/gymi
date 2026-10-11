import { View } from 'react-native';

import { useT } from '@/i18n';

import { Sheet } from '../Sheet';
import { Text } from '../Text';
import { Button } from '../ui';

/** "Delete this?" with Delete and Cancel (design: alertBox). */
export function ConfirmSheet({ open, title, body, action, onConfirm, onClose }: { open: boolean; title: string; body: string; action: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose}>
      <ConfirmBody title={title} body={body} action={action} onConfirm={onConfirm} onClose={onClose} />
    </Sheet>
  );
}

/** The same question inside a sheet that is already open. */
export function ConfirmBody({ title, body, action, onConfirm, onClose }: { title: string; body: string; action: string; onConfirm: () => void; onClose: () => void }) {
  const { t } = useT();
  return (
    <View>
      <Text variant="h2">{title}</Text>
      <Text color="sec" style={{ marginTop: 6 }}>
        {body}
      </Text>
      <Button kind="soft" icon="trash" color="#DC2626" title={action} style={{ marginTop: 16 }} onPress={onConfirm} />
      <Button kind="glass" title={t('Cancel')} style={{ marginTop: 8 }} onPress={onClose} />
    </View>
  );
}
