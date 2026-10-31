import { NativeModules, Platform, TurboModuleRegistry, type View } from 'react-native';

type Shot = { captureRef: (ref: View | null, opts: object) => Promise<string> };

/** The capture module, only when this build has it (it came with build 18; older builds don't). */
function shot(): Shot | null {
  if (Platform.OS === 'web') return null;
  try {
    const has = NativeModules.RNViewShot != null || TurboModuleRegistry.get('RNViewShot') != null;
    // Loaded only when the build has it, so older builds without it don't crash.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return has ? (require('react-native-view-shot') as Shot) : null;
  } catch {
    return null;
  }
}

/** Can this phone turn a workout story into a picture? */
export const canShareStory = () => shot() != null;

/** The story view as a full-size picture file (1080 × 1920): JPEG, or a see-through PNG for the sticker. */
export async function captureStory(ref: View | null, sticker: boolean) {
  const s = shot();
  if (!s || !ref) return null;
  try {
    return await s.captureRef(ref, { format: sticker ? 'png' : 'jpg', quality: 0.92, width: 1080, height: 1920, result: 'tmpfile' });
  } catch {
    return null;
  }
}
