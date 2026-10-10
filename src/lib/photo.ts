import { Platform } from 'react-native';

export type Photo = { base64: string; mime: string; uri: string };

/** Make a picture smaller (max side 1280 px) and turn it into JPEG text the AI can read. */
function shrink(file: File): Promise<Photo | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * s);
      c.height = Math.round(img.naturalHeight * s);
      c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
      const data = c.toDataURL('image/jpeg', 0.82);
      URL.revokeObjectURL(url);
      resolve({ base64: data.split(',')[1], mime: 'image/jpeg', uri: data });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

/** Take a photo with the camera (or pick one). Web only for now; the phone apps come in Phase 7. */
export function takePhoto(camera: boolean): Promise<Photo | null> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (camera) input.setAttribute('capture', 'environment');
    input.onchange = async () => {
      const f = input.files?.[0];
      resolve(f ? await shrink(f) : null);
    };
    input.click();
  });
}
