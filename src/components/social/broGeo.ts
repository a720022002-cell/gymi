/** The Gym Bros pictures (assets/images/bro): width per height, then where the face ring goes (centre x by width,
 * centre y by height) and its radius (by height). Measured from the pictures (the top of the neck). */
export type BroKey = 'm1' | 'm2' | 'm3' | 'm4' | 'm5' | 'w1' | 'w2' | 'w3' | 'w4' | 'w5';
export const BRO_GEO: Record<BroKey, [number, number, number, number]> = {
  m1: [0.8768, 0.4988, 0.2382, 0.094],
  m2: [0.8768, 0.4988, 0.2217, 0.094],
  m3: [0.8768, 0.4988, 0.2258, 0.094],
  m4: [0.8768, 0.5065, 0.2589, 0.094],
  m5: [0.8768, 0.4988, 0.2765, 0.094],
  w1: [0.8768, 0.4959, 0.2331, 0.094],
  w2: [0.8768, 0.4947, 0.173, 0.094],
  w3: [0.8768, 0.4982, 0.2507, 0.094],
  w4: [0.8768, 0.5183, 0.1854, 0.094],
  w5: [0.8768, 0.4988, 0.2269, 0.094],
};
