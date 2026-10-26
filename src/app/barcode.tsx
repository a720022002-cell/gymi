import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Linking, View } from 'react-native';

import { ManualCode } from '@/components/food/ManualCode';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Glass } from '@/components/Glass';
import { Button, Card, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { setPendingBarcode } from '@/lib/pending';
import { normBarcode } from '@/lib/products';
import { useSettings } from '@/theme/settings';
import { goBack } from '@/lib/nav';

import { AppleScannerView } from '../../modules/adro-scanner';

/** Phone apps: scan a food barcode with the camera, or type the numbers. */
export default function Barcode() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const [perm, ask] = useCameraPermissions();
  const [manual, setManual] = useState(false);
  const [torch, setTorch] = useState(false);
  const done = useRef(false);
  // Opened to pick a product (a saved meal): hand the code back instead of opening the product.
  const { pick } = useLocalSearchParams<{ pick?: string }>();
  const go = (raw: string) => {
    const code = normBarcode(raw);
    if (pick) {
      setPendingBarcode(code);
      goBack();
    } else router.replace({ pathname: '/product', params: { code } });
  };

  const found = (code: string) => {
    if (done.current || !/^\d{8,14}$/.test(code)) return;
    done.current = true;
    go(code);
  };

  // iPhone: Apple's own scanner (the one Live Text uses), inside the box on this screen. It switches lenses to focus
  // up close and lets you pinch to zoom, so it reads a barcode near or far. Our camera view is for phones (or app
  // builds) that can't run it.
  const [apple, setApple] = useState(!!AppleScannerView);
  const Apple = apple ? AppleScannerView : null;

  return (
    <Screen title={t('Scan barcode')} back>
      {perm?.granted ? (
        <View style={{ height: 380, borderRadius: 28, overflow: 'hidden', backgroundColor: '#000' }}>
          {Apple ? (
            <Apple style={{ flex: 1 }} torch={torch} onCode={(e) => found(e.nativeEvent.data)} onUnavailable={() => setApple(false)} />
          ) : (
            <CameraView style={{ flex: 1 }} facing="back" enableTorch={torch} barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }} onBarcodeScanned={(r) => found(r.data)} />
          )}
          <View pointerEvents="none" style={{ position: 'absolute', left: 40, right: 40, top: 150, height: 80, borderRadius: 16, borderWidth: 3, borderColor: '#FFFFFF' }} />
          <Springy
            onPress={() => setTorch(!torch)}
            scaleTo={1.08}
            accessibilityRole="switch"
            accessibilityState={{ checked: torch }}
            accessibilityLabel={t('Flash')}
            style={{ position: 'absolute', top: 14, end: 14 }}>
            <Glass style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="bolt" size={20} color={torch ? '#FACC15' : '#FFFFFF'} />
            </Glass>
          </Springy>
        </View>
      ) : (
        <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
          <Icon name="camera" size={34} color={c.cobalt} />
          <Text variant="h3" center style={{ marginTop: 8 }}>
            {t('Allow the camera to scan barcodes')}
          </Text>
          {/* Said no before and the phone won't ask again: the button opens the app's settings instead. */}
          <Button title={t(perm && !perm.canAskAgain ? 'Open Settings' : 'Allow camera')} style={{ marginTop: 12, alignSelf: 'stretch' }} onPress={() => (perm && !perm.canAskAgain ? Linking.openSettings().catch(() => {}) : ask())} />
          {perm && !perm.canAskAgain ? (
            <Text variant="small" color="sec" center style={{ marginTop: 8 }}>
              {t('Turn on the camera for Adro in Settings, then come back.')}
            </Text>
          ) : null}
        </Card>
      )}
      <Text color="sec" center style={{ marginTop: 12 }}>
        {t(Apple ? 'Point at the barcode, near or far. Pinch to zoom if it’s small.' : 'Point at the barcode on the package. It scans by itself.')}
      </Text>
      <Button kind="glass" title={t('Enter the code by hand')} style={{ marginTop: 12 }} onPress={() => setManual(true)} />
      <ManualCode open={manual} onClose={() => setManual(false)} onCode={(code) => go(code)} />
    </Screen>
  );
}
