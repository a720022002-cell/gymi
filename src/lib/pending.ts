import type { Photo } from './photo';

/** A photo waiting for the next screen (too big to pass in the address). */
let pending: Photo | null = null;
export const setPendingPhoto = (p: Photo | null) => (pending = p);
export const takePendingPhoto = () => {
  const p = pending;
  pending = null;
  return p;
};
