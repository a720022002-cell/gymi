import { useState } from 'react';

import { useT } from '@/i18n';

import { Field } from '../Field';
import { Sheet } from '../Sheet';
import { Text } from '../Text';
import { Button } from '../ui';

/** Type the numbers under the barcode instead of scanning. */
export function ManualCode({ open, onClose, onCode }: { open: boolean; onClose: () => void; onCode: (code: string) => void }) {
  const { t } = useT();
  const [code, setCode] = useState('');
  const ok = /^\d{8,14}$/.test(code);
  return (
    <Sheet open={open} onClose={onClose}>
      <Text variant="h2">{t('Enter the code')}</Text>
      <Text variant="small" color="sec" style={{ marginTop: 4 }}>
        {t('Type the numbers under the barcode.')}
      </Text>
      <Field value={code} onChangeText={(v) => setCode(v.replace(/[^\d]/g, '').slice(0, 14))} placeholder="6281007000000" inputMode="numeric" keyboardType="number-pad" ltr autoFocus />
      <Button title={t('Find product')} disabled={!ok} style={{ marginTop: 16 }} onPress={() => onCode(code)} />
    </Sheet>
  );
}
