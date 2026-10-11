// Pick a lab report file (PDF or photo): the system file picker on phones, a file input on the web.
import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';

export type PickedFile = { base64: string; mime: string; name: string; size: number };

/** Read a local file as base64 (phones). */
async function readBase64(uri: string): Promise<string | null> {
  const blob = await (await fetch(uri)).blob();
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? '').split(',')[1] ?? null);
    r.onerror = () => resolve(null);
    r.readAsDataURL(blob);
  });
}

/** Returns the file, null when cancelled, or 'too_big' over 10 MB. */
export async function pickReportFile(): Promise<PickedFile | null | 'too_big'> {
  const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'], copyToCacheDirectory: true, multiple: false, base64: true });
  if (r.canceled || !r.assets?.[0]) return null;
  const a = r.assets[0];
  if ((a.size ?? 0) > 10 * 1024 * 1024) return 'too_big';
  const mime = a.mimeType || (a.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
  const b64 = Platform.OS === 'web' ? (a.base64 ?? a.uri).split(',').pop() : await readBase64(a.uri);
  if (!b64) return null;
  return { base64: b64, mime, name: a.name || 'report', size: a.size ?? 0 };
}
