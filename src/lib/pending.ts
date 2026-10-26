import type { Photo } from './photo';

/** A photo waiting for the next screen (too big to pass in the address). */
let pending: Photo | null = null;
export const setPendingPhoto = (p: Photo | null) => (pending = p);
export const takePendingPhoto = () => {
  const p = pending;
  pending = null;
  return p;
};

/** A barcode scanned for a screen that asked for one (like adding a product to a saved meal). */
let pendingCode: string | null = null;
export const setPendingBarcode = (c: string | null) => (pendingCode = c);
export const takePendingBarcode = () => {
  const c = pendingCode;
  pendingCode = null;
  return c;
};

/** A photo from our camera screen for a screen that asked for one (adding to a meal, or reading a label into a form). */
export type Capture = { kind: 'meal' | 'label'; photo: Photo };
let pendingCap: Capture | null = null;
export const setPendingCapture = (c: Capture | null) => (pendingCap = c);
export const takePendingCapture = () => {
  const c = pendingCap;
  pendingCap = null;
  return c;
};
