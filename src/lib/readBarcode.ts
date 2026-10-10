// Web only (uses the browser camera and canvas). Used by src/app/barcode.web.tsx.
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';

const FORMATS = [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128];
const hints = new Map<DecodeHintType, unknown>([
  [DecodeHintType.POSSIBLE_FORMATS, FORMATS],
  [DecodeHintType.TRY_HARDER, true],
]);
export const reader = new BrowserMultiFormatReader(hints);

type Detector = { detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]> };

/** The phone's built-in barcode reader (Chrome on Android), when there is one. */
function nativeDetector(): Detector | null {
  const BD = (globalThis as { BarcodeDetector?: new (o: object) => Detector }).BarcodeDetector;
  if (!BD) return null;
  try {
    return new BD({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });
  } catch {
    return null;
  }
}

/** Draw the picture at a given size and angle, then try to read a barcode from it. */
function tryCanvas(src: CanvasImageSource, w: number, h: number, max: number, rotate: boolean): string | null {
  const s = Math.min(1, max / Math.max(w, h));
  const cw = Math.round(w * s);
  const ch = Math.round(h * s);
  const canvas = document.createElement('canvas');
  canvas.width = rotate ? ch : cw;
  canvas.height = rotate ? cw : ch;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  if (rotate) {
    ctx.translate(ch, 0);
    ctx.rotate(Math.PI / 2);
  }
  ctx.drawImage(src, 0, 0, cw, ch);
  try {
    return reader.decodeFromCanvas(canvas).getText();
  } catch {
    return null;
  }
}

/** Read a barcode from a photo or a video frame. Tries a few sizes and turns it sideways. */
export async function readBarcode(src: CanvasImageSource, w: number, h: number): Promise<string | null> {
  const det = nativeDetector();
  if (det) {
    try {
      const r = await det.detect(src);
      if (r[0]?.rawValue) return r[0].rawValue;
    } catch {}
  }
  for (const rotate of [false, true]) {
    for (const max of [1280, 800, 1920]) {
      const code = tryCanvas(src, w, h, max, rotate);
      if (code) return code;
    }
  }
  return null;
}

/** Read a barcode from a picture file the user took or picked. */
export async function readBarcodeFile(file: File): Promise<string | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return await readBarcode(img, img.naturalWidth, img.naturalHeight);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
