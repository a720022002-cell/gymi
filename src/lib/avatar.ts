/** Your Gym Bros character (design: Bitmoji-like): face, hair and clothes are yours; the build comes from your commitment. */
export type Look = {
  body: 'm' | 'f';
  skin: number;
  hair: string;
  hairColor: number;
  beard: string;
  brows: string;
  eyes: number;
  hat: string;
  hatColor: number;
  glasses: string;
  top: string;
  topColor: number;
  bottom: string;
  bottomColor: number;
  shoes: number;
};

export const SKIN = ['#FBDCC8', '#F3C9A6', '#E8B48A', '#D49A6A', '#B97B4E', '#96603A', '#744628', '#53311C'];
export const HAIR_COLORS = ['#1B1716', '#3A271C', '#5E3B26', '#8A5A35', '#C9A063', '#E3C98E', '#9B3E22', '#8D8D8D', '#E6E3DF'];
export const EYE_COLORS = ['#3B2416', '#6B4426', '#2F6B4F', '#3C6FA8', '#5A5A5A'];
export const CLOTH = ['#3D5AFE', '#1E1F24', '#F4F4F4', '#8A8F98', '#E53935', '#2E7D32', '#1A2A5A', '#6B7A3A', '#EC6FA0', '#7E57C2', '#FB8C00', '#D8C3A5', '#00897B', '#FFD54F'];

/** The choices for each part ([id, English name]); some only for one body. */
export const HAIR_M: [string, string][] = [
  ['short', 'Short'],
  ['fade', 'Fade'],
  ['quiff', 'Quiff'],
  ['curly', 'Curly'],
  ['long', 'Long'],
  ['bun', 'Man bun'],
  ['bald', 'Bald'],
];
export const HAIR_F: [string, string][] = [
  ['long', 'Long'],
  ['ponytail', 'Ponytail'],
  ['bun', 'Bun'],
  ['bob', 'Bob'],
  ['curly', 'Curly'],
  ['short', 'Short'],
];
export const BEARDS: [string, string][] = [
  ['none', 'None'],
  ['stubble', 'Stubble'],
  ['short', 'Short beard'],
  ['full', 'Full beard'],
  ['goatee', 'Goatee'],
  ['mustache', 'Mustache'],
];
export const BROWS: [string, string][] = [
  ['soft', 'Soft'],
  ['thick', 'Thick'],
  ['thin', 'Thin'],
];
export const HATS_M: [string, string][] = [
  ['none', 'None'],
  ['cap', 'Cap'],
  ['beanie', 'Beanie'],
  ['headband', 'Headband'],
  ['shemagh', 'Shemagh'],
];
export const HATS_F: [string, string][] = [
  ['none', 'None'],
  ['hijab', 'Hijab'],
  ['cap', 'Cap'],
  ['beanie', 'Beanie'],
  ['headband', 'Headband'],
];
export const GLASSES: [string, string][] = [
  ['none', 'None'],
  ['round', 'Round'],
  ['square', 'Square'],
  ['shades', 'Sunglasses'],
];
export const TOPS_M: [string, string][] = [
  ['tee', 'T-shirt'],
  ['tank', 'Tank top'],
  ['hoodie', 'Hoodie'],
  ['long', 'Long sleeve'],
  ['compression', 'Compression'],
  ['none', 'No shirt'],
];
export const TOPS_F: [string, string][] = [
  ['tee', 'T-shirt'],
  ['tank', 'Tank top'],
  ['hoodie', 'Hoodie'],
  ['long', 'Long sleeve'],
  ['bra', 'Sports bra'],
];
export const BOTTOMS_M: [string, string][] = [
  ['shorts', 'Shorts'],
  ['long_shorts', 'Long shorts'],
  ['joggers', 'Joggers'],
];
export const BOTTOMS_F: [string, string][] = [
  ['leggings', 'Leggings'],
  ['shorts', 'Shorts'],
  ['joggers', 'Joggers'],
];

export function defaultLook(female: boolean): Look {
  return female
    ? {
        body: 'f',
        skin: 2,
        hair: 'ponytail',
        hairColor: 1,
        beard: 'none',
        brows: 'thin',
        eyes: 0,
        hat: 'none',
        hatColor: 1,
        glasses: 'none',
        top: 'tank',
        topColor: 8,
        bottom: 'leggings',
        bottomColor: 1,
        shoes: 2,
      }
    : {
        body: 'm',
        skin: 3,
        hair: 'short',
        hairColor: 0,
        beard: 'short',
        brows: 'thick',
        eyes: 0,
        hat: 'none',
        hatColor: 1,
        glasses: 'none',
        top: 'tee',
        topColor: 0,
        bottom: 'shorts',
        bottomColor: 1,
        shoes: 2,
      };
}

const pick = (list: [string, string][], v: unknown, d: string) => (list.some(([id]) => id === v) ? (v as string) : d);
const idx = (n: number, v: unknown, d: number) => (typeof v === 'number' && v >= 0 && v < n ? Math.floor(v) : d);

/** A saved look made safe (unknown parts back to the default), or the default for that body. */
export function cleanLook(raw: unknown, female: boolean): Look {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Look>;
  const body = r.body === 'f' || r.body === 'm' ? r.body : female ? 'f' : 'm';
  const d = defaultLook(body === 'f');
  const f = body === 'f';
  return {
    body,
    skin: idx(SKIN.length, r.skin, d.skin),
    hair: pick([...(f ? HAIR_F : HAIR_M)], r.hair, d.hair),
    hairColor: idx(HAIR_COLORS.length, r.hairColor, d.hairColor),
    beard: f ? 'none' : pick(BEARDS, r.beard, d.beard),
    brows: pick(BROWS, r.brows, d.brows),
    eyes: idx(EYE_COLORS.length, r.eyes, d.eyes),
    hat: pick(f ? HATS_F : HATS_M, r.hat, d.hat),
    hatColor: idx(CLOTH.length, r.hatColor, d.hatColor),
    glasses: pick(GLASSES, r.glasses, d.glasses),
    top: pick(f ? TOPS_F : TOPS_M, r.top, d.top),
    topColor: idx(CLOTH.length, r.topColor, d.topColor),
    bottom: pick(f ? BOTTOMS_F : BOTTOMS_M, r.bottom, d.bottom),
    bottomColor: idx(CLOTH.length, r.bottomColor, d.bottomColor),
    shoes: idx(CLOTH.length, r.shoes, d.shoes),
  };
}

/** How built the character is (0 to 1) from the commitment level (1–5; 0 = not shared). */
export const buildOf = (level: number) => [0.25, 0, 0.25, 0.5, 0.75, 1][level] ?? 0.25;
