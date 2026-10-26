import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

export type Photo = { base64: string; mime: string; uri: string };

/** Phone apps: take a photo (or pick one), shrink it to 1280 px and turn it into JPEG text the AI can read. */
export async function takePhoto(camera: boolean): Promise<Photo | null> {
  const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (r.canceled || !r.assets?.[0]) return null;
  const a = r.assets[0];
  return photoFromUri(a.uri, a.width, a.height);
}

/** Max side 1280 px, as JPEG text the AI can read (also for pictures from our own camera screen). */
export async function photoFromUri(uri: string, width?: number, height?: number): Promise<Photo | null> {
  const ctx = ImageManipulator.manipulate(uri);
  if (width && height && Math.max(width, height) > 1280) ctx.resize(width >= height ? { width: 1280, height: null } : { width: null, height: 1280 });
  else if (!width) ctx.resize({ width: 1280, height: null });
  const img = await ctx.renderAsync();
  const out = await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.82, base64: true });
  if (!out.base64) return null;
  return { base64: out.base64, mime: 'image/jpeg', uri: out.uri };
}

type Scanner = { scanDocument: (o: { croppedImageQuality?: number; responseType?: 'imageFilePath' }) => Promise<{ status?: string; scannedImages?: string[] }> };
/** Apple's document scanner (the one in Notes), when this build of the app has it; null otherwise. */
function docScanner(): Scanner | null {
  if (Platform.OS !== 'ios') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require('react-native-document-scanner-plugin') as { default: Scanner }).default;
  } catch {
    return null;
  }
}

/**
 * A photo of a nutrition label. On iPhone, Apple's document scanner: it finds the label's edges, focuses up close and
 * straightens the picture, so the numbers come out sharp. `null` = cancelled. The gallery, and phones without the
 * scanner, use the normal camera.
 */
export async function takeLabelPhoto(camera: boolean): Promise<Photo | null> {
  const scan = camera ? docScanner() : null;
  if (!scan) return takePhoto(camera);
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;
  try {
    const r = await scan.scanDocument({ croppedImageQuality: 90, responseType: 'imageFilePath' });
    const path = r.status === 'success' ? r.scannedImages?.[0] : undefined;
    if (!path) return null;
    return photoFromUri(path.startsWith('file://') ? path : `file://${path}`);
  } catch {
    return takePhoto(true);
  }
}
