// Design tokens copied from docs/index.html (:root and html.dark).
// The design file is the source of truth: change values there first, then here.

export type ColorTokens = {
  bg: string;
  card: string;
  line: string;
  text: string;
  sec: string;
  cobalt: string;
  link: string;
  up: string;
  down: string;
  btn: string;
  btnText: string;
  track: string;
  pill: string;
  segOn: string;
  inset: string;
  scrim: string;
  macroC: string;
  macroF: string;
  // Liquid Glass
  gBg: string;
  gSheet: string;
  gBorder: string;
  gHi: string;
  gGlow: string;
  gShadow: string;
  gAi: string;
  gAiBorder: string;
};

export const light: ColorTokens = {
  bg: '#FFFFFF',
  card: '#F4F4F5',
  line: '#E4E4E7',
  text: '#0A0A0B',
  sec: '#52525B',
  cobalt: '#3355FF',
  link: '#3355FF',
  up: '#15803D',
  down: '#DC2626',
  btn: '#0A0A0B',
  btnText: '#FFFFFF',
  track: '#E4E4E7',
  pill: 'rgba(10,10,11,0.07)',
  segOn: '#FFFFFF',
  inset: '#FFFFFF',
  scrim: 'rgba(10,10,11,0.22)',
  macroC: '#0A0A0B',
  macroF: '#71717A',
  gBg: 'rgba(255,255,255,0.56)',
  gSheet: 'rgba(250,250,251,0.8)',
  gBorder: 'rgba(255,255,255,0.78)',
  gHi: 'rgba(255,255,255,0.95)',
  gGlow: 'rgba(255,255,255,0.35)',
  gShadow: '0px 10px 30px rgba(10,10,11,0.10), 0px 1px 3px rgba(10,10,11,0.06)',
  gAi: 'rgba(232,236,255,0.62)',
  gAiBorder: 'rgba(160,176,255,0.55)',
};

export const dark: ColorTokens = {
  bg: '#0A0A0B',
  card: '#18181B',
  line: '#27272A',
  text: '#FAFAFA',
  sec: '#A1A1AA',
  cobalt: '#3355FF',
  link: '#7088FF',
  up: '#22C55E',
  down: '#F87171',
  btn: '#FAFAFA',
  btnText: '#0A0A0B',
  track: '#27272A',
  pill: 'rgba(255,255,255,0.1)',
  segOn: 'rgba(255,255,255,0.16)',
  inset: '#232327',
  scrim: 'rgba(0,0,0,0.45)',
  macroC: '#FAFAFA',
  macroF: '#A1A1AA',
  gBg: 'rgba(34,34,38,0.52)',
  gSheet: 'rgba(26,26,30,0.8)',
  gBorder: 'rgba(255,255,255,0.13)',
  gHi: 'rgba(255,255,255,0.2)',
  gGlow: 'rgba(255,255,255,0.04)',
  gShadow: '0px 10px 30px rgba(0,0,0,0.45), 0px 1px 3px rgba(0,0,0,0.3)',
  gAi: 'rgba(40,52,122,0.5)',
  gAiBorder: 'rgba(112,136,255,0.35)',
};

export const radius = {
  field: 16,
  opt: 18,
  card: 22,
  sheet: 40,
  pill: 999,
} as const;

export const space = {
  gutter: 20,
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 24,
} as const;

export const size = {
  button: 52,
  buttonSm: 40,
  touch: 44,
  field: 52,
  tabBar: 64,
  aiButton: 60,
} as const;

// Font family names registered by @expo-google-fonts.
export const fonts = {
  sora: { 500: 'Sora_500Medium', 600: 'Sora_600SemiBold', 700: 'Sora_700Bold' },
  manrope: {
    400: 'Manrope_400Regular',
    500: 'Manrope_500Medium',
    600: 'Manrope_600SemiBold',
    700: 'Manrope_700Bold',
    800: 'Manrope_800ExtraBold',
  },
  arabic: {
    400: 'IBMPlexSansArabic_400Regular',
    500: 'IBMPlexSansArabic_500Medium',
    600: 'IBMPlexSansArabic_600SemiBold',
    700: 'IBMPlexSansArabic_700Bold',
  },
} as const;

export type Weight = 400 | 500 | 600 | 700 | 800;

/** Text styles from the design (.lt, .h1, .h2, .h3, body, .small, .xs). */
export const type = {
  lt: { fontSize: 34, lineHeight: 37, letterSpacing: -1.02 },
  h1: { fontSize: 28, lineHeight: 32, letterSpacing: -0.84 },
  h2: { fontSize: 21, lineHeight: 25, letterSpacing: -0.63 },
  h3: { fontSize: 17, lineHeight: 21, letterSpacing: -0.51 },
  body: { fontSize: 15, lineHeight: 22 },
  small: { fontSize: 13, lineHeight: 19 },
  xs: { fontSize: 12, lineHeight: 17 },
} as const;

export const motion = {
  // cubic-bezier(.34,1.45,.64,1) in the design, as a spring.
  spring: { damping: 14, stiffness: 180, mass: 0.9 },
} as const;
