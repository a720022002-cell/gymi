import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

export type Photo = { base64: string; mime: string; uri: string };

/** Phone apps: take a photo (or pick one), shrink it to 1280 px and turn it into JPEG text the AI can read. */
export async function takePhoto(camera: boolean): Promise<Photo | null> {
  const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (r.canceled || !r.assets?.[0]) return null;
  const a = r.assets[0];
  const big = Math.max(a.width, a.height) > 1280;
  const ctx = ImageManipulator.manipulate(a.uri);
  if (big) ctx.resize(a.width >= a.height ? { width: 1280, height: null } : { width: null, height: 1280 });
  const img = await ctx.renderAsync();
  const out = await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.82, base64: true });
  if (!out.base64) return null;
  return { base64: out.base64, mime: 'image/jpeg', uri: out.uri };
}
