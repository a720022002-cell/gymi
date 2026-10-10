import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { View } from 'react-native';

import { ManualCode } from '@/components/food/ManualCode';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Button, Card } from '@/components/ui';
import { useT } from '@/i18n';
import { useSettings } from '@/theme/settings';

/** Phone apps: scan a food barcode with the camera, or type the numbers. */
export default function Barcode() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const [perm, ask] = useCameraPermissions();
  const [manual, setManual] = useState(false);
  const done = useRef(false);

  const found = (code: string) => {
    if (done.current || !/^\d{8,14}$/.test(code)) return;
    done.current = true;
    router.replace({ pathname: '/product', params: { code } });
  };

  return (
    <Screen title={t('Scan barcode')} back>
      {perm?.granted ? (
        <View style={{ height: 380, borderRadius: 28, overflow: 'hidden', backgroundColor: '#000' }}>
          <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }} onBarcodeScanned={(r) => found(r.data)} />
          <View pointerEvents="none" style={{ position: 'absolute', left: 40, right: 40, top: 150, height: 80, borderRadius: 16, borderWidth: 3, borderColor: '#FFFFFF' }} />
        </View>
      ) : (
        <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
          <Icon name="camera" size={34} color={c.cobalt} />
          <Text variant="h3" center style={{ marginTop: 8 }}>
            {t('Allow the camera to scan barcodes')}
          </Text>
          <Button title={t('Allow camera')} style={{ marginTop: 12, alignSelf: 'stretch' }} onPress={ask} />
        </Card>
      )}
      <Text color="sec" center style={{ marginTop: 12 }}>
        {t('Point at the barcode on the package. It scans by itself.')}
      </Text>
      <Button kind="glass" title={t('Enter the code by hand')} style={{ marginTop: 12 }} onPress={() => setManual(true)} />
      <ManualCode open={manual} onClose={() => setManual(false)} onCode={(code) => router.replace({ pathname: '/product', params: { code } })} />
    </Screen>
  );
}
