import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ManualCode } from '@/components/food/ManualCode';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Button } from '@/components/ui';
import { useT } from '@/i18n';

/** Native apps: camera scanning comes with the iPhone/Android build. Until then, type the code. */
export default function Barcode() {
  const { t } = useT();
  const [manual, setManual] = useState(true);
  return (
    <Screen title={t('Scan barcode')} back>
      <View style={{ gap: 12 }}>
        <Text color="sec">{t('Camera scanning comes with the phone app. For now, type the numbers under the barcode.')}</Text>
        <Button title={t('Enter the code by hand')} onPress={() => setManual(true)} />
      </View>
      <ManualCode open={manual} onClose={() => setManual(false)} onCode={(code) => router.replace({ pathname: '/product', params: { code } })} />
    </Screen>
  );
}
