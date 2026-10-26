import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { InteractionManager, Linking, Platform, View } from 'react-native';

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

  // iPhone: Apple's own scanner (the one Live Text uses). It switches lenses to focus up close and lets you pinch to
  // zoom, so it reads a barcode near or far. Our camera view stays for phones that can't run it.
  const [apple, setApple] = useState(Platform.OS === 'ios' && CameraView.isModernBarcodeScannerAvailable);
  const useApple = apple && !!perm?.granted;
  // A scanner left half-open (it can sit unseen behind the screen and take the taps) is closed before a new one opens.
  const openApple = () =>
    CameraView.dismissScanner()
      .catch(() => {})
      .then(() => CameraView.launchScanner({ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'], isGuidanceEnabled: true, isHighlightingEnabled: true }))
      .catch(() => setApple(false));
  useEffect(() => {
    if (!useApple) return;
    const sub = CameraView.onModernBarcodeScanned((r) => {
      const code = String(r.data ?? '');
      if (done.current || !/^\d{8,14}$/.test(code)) return;
      done.current = true;
      // Close Apple's scanner first, then open the product.
      CameraView.dismissScanner()
        .catch(() => {})
        .finally(() => setTimeout(() => go(code), 450));
    });
    // Not straight away: coming from Log food, its sheet is still closing, and a scanner opened on top of it ends up
    // hidden behind this screen. Wait for the screen to finish opening.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const task = InteractionManager.runAfterInteractions(() => {
      timer = setTimeout(openApple, 500);
    });
    return () => {
      task.cancel();
      if (timer) clearTimeout(timer);
      sub.remove();
      CameraView.dismissScanner().catch(() => {});
    };
    // Opens once when the screen opens (and again only if the camera permission changes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useApple]);

  return (
    <Screen title={t('Scan barcode')} back>
      {useApple ? (
        <Springy onPress={openApple} scaleTo={0.98} accessibilityRole="button" accessibilityLabel={t('Open the scanner')}>
          <Card style={{ alignItems: 'center', paddingVertical: 34 }}>
            <Icon name="camera" size={38} color={c.cobalt} />
            <Text variant="h3" center style={{ marginTop: 10 }}>
              {t('Open the scanner')}
            </Text>
          </Card>
        </Springy>
      ) : perm?.granted ? (
        <View style={{ height: 380, borderRadius: 28, overflow: 'hidden', backgroundColor: '#000' }}>
          <CameraView style={{ flex: 1 }} facing="back" enableTorch={torch} barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }} onBarcodeScanned={(r) => found(r.data)} />
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
        {t(useApple ? 'Point at the barcode, near or far. Pinch to zoom if it’s small.' : 'Point at the barcode on the package. It scans by itself.')}
      </Text>
      <Button kind="glass" title={t('Enter the code by hand')} style={{ marginTop: 12 }} onPress={() => setManual(true)} />
      <ManualCode open={manual} onClose={() => setManual(false)} onCode={(code) => go(code)} />
    </Screen>
  );
}
