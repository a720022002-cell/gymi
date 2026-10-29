/** The Gym Bros pictures (assets/images/bro), levels 1–7 for men (m) and women (w), all the same height (neck to
 * feet) and standing on the same line: width per height, then where the face logo goes (centre x by width, centre y
 * by height) and its radius (by height). The same for every picture, so the logo never moves between levels. */
export type BroKey = 'm1' | 'm2' | 'm3' | 'm4' | 'm5' | 'm6' | 'm7' | 'w1' | 'w2' | 'w3' | 'w4' | 'w5' | 'w6' | 'w7';
export const BRO_GEO: Record<BroKey, [number, number, number, number]> = {
  m1: [0.9486, 0.489, 0.2763, 0.094],
  m2: [0.9486, 0.489, 0.2763, 0.094],
  m3: [0.9486, 0.489, 0.2763, 0.094],
  m4: [0.9486, 0.489, 0.2763, 0.094],
  m5: [0.9486, 0.489, 0.2763, 0.094],
  m6: [0.9486, 0.489, 0.2763, 0.094],
  m7: [0.9486, 0.489, 0.2763, 0.094],
  w1: [0.9486, 0.489, 0.2763, 0.094],
  w2: [0.9486, 0.489, 0.2763, 0.094],
  w3: [0.9486, 0.489, 0.2763, 0.094],
  w4: [0.9486, 0.489, 0.2763, 0.094],
  w5: [0.9486, 0.489, 0.2763, 0.094],
  w6: [0.9486, 0.489, 0.2763, 0.094],
  w7: [0.9486, 0.489, 0.2763, 0.094],
};
