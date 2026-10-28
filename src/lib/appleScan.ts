import { Camera, CameraView } from 'expo-camera';
import { Platform } from 'react-native';

import { normBarcode } from './products';

let sub: { remove(): void } | null = null;

/**
 * iPhone: Apple's own full-screen barcode scanner (VisionKit, the one Live Text uses), opened straight away with no
 * screen of ours around it. It zooms and focuses by itself; swipe it down to cancel. Calls `onCode` once with the code.
 * Returns false when it can't run here (Android, older iPhones, no camera permission): use the barcode screen then.
 */
export async function appleScan(onCode: (code: string) => void): Promise<boolean> {
  if (Platform.OS !== 'ios' || !CameraView.isModernBarcodeScannerAvailable) return false;
  const p = await Camera.requestCameraPermissionsAsync().catch(() => null);
  if (!p?.granted) return false;
  sub?.remove();
  let done = false;
  sub = CameraView.onModernBarcodeScanned((r) => {
    const code = normBarcode(r.data ?? '');
    if (done || !/^\d{8,14}$/.test(code)) return;
    done = true;
    sub?.remove();
    sub = null;
    // Open the product once Apple's scanner has slid away.
    CameraView.dismissScanner()
      .catch(() => {})
      .finally(() => setTimeout(() => onCode(code), 350));
  });
  try {
    await CameraView.launchScanner({ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'], isPinchToZoomEnabled: true, isGuidanceEnabled: true, isHighlightingEnabled: true });
    return true;
  } catch {
    sub?.remove();
    sub = null;
    return false;
  }
}
