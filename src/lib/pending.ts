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

/** A meal photo taken for "Add an ingredient" (its foods are added to the meal you're making). */
let pendingIng: Photo | null = null;
export const setPendingIngredientPhoto = (p: Photo | null) => (pendingIng = p);
export const takePendingIngredientPhoto = () => {
  const p = pendingIng;
  pendingIng = null;
  return p;
};
