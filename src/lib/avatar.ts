/** Your Gym Bros character (design: owner's flexing cartoon in a black T-shirt): the adro ring is its face, in the
 * colour you pick, and its build grows with your commitment. */
export type Look = { color: number };

/** Ring colours (design: the crew picture, each friend in their own colour). */
export const RING_COLORS = ['#2F55F4', '#E53935', '#F5B70A', '#2EAD4B', '#8E44D9', '#F27B1A', '#18B3C9', '#E8459A', '#F2F2F2'];

export const defaultLook = (): Look => ({ color: 0 });

/** A saved look made safe (older looks kept their shirt colour as `shirt` or `topColor`). */
export function cleanLook(raw: unknown): Look {
  const r = (raw && typeof raw === 'object' ? raw : {}) as { color?: unknown; shirt?: unknown };
  const v = r.color ?? r.shirt;
  return { color: typeof v === 'number' && v >= 0 && v < RING_COLORS.length ? Math.floor(v) : defaultLook().color };
}
