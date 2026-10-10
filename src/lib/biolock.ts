/** Web: no Face ID. */
export const lockSupported = false;
export async function unlock(_msg: string) {
  return true;
}
