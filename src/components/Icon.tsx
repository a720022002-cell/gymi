import Svg, { Circle, Path } from 'react-native-svg';

import { useSettings } from '@/theme/settings';

// Line icons copied from docs/index.html (SF Symbols style, 24x24 grid).
const IC = {
  home: 'M3.5 10.5 12 3.5l8.5 7V20a1 1 0 0 1-1 1h-5v-6h-5v6h-5a1 1 0 0 1-1-1z',
  food: 'M7 3v8M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 11v10M17 21V3c-2.2 1.2-3.5 3.6-3.5 7v3H17',
  train: 'M6.5 6.5v11M3.5 9v6M17.5 6.5v11M20.5 9v6M6.5 12h11',
  progress: 'M4 19.5h16M5.5 15.5l4-5 3.5 3 5.5-7',
  friends:
    'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.2A6.5 6.5 0 0 1 21.5 20',
  plus: 'M12 5v14M5 12h14',
  back: 'M15 5l-7 7 7 7',
  chev: 'M9 5l7 7-7 7',
  chevd: 'M6 9l6 6 6-6',
  close: 'M6 6l12 12M18 6 6 18',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  drop: 'M12 3.5c3.5 4.2 6 7.6 6 10.5a6 6 0 0 1-12 0c0-2.9 2.5-6.3 6-10.5z',
  flame:
    'M12 21c3.9 0 6.5-2.6 6.5-6.3 0-3.3-2.2-5.4-3.8-7.5-.4 1.9-1.5 3-2.7 3.3.3-2.9-1-5.6-3.5-7-.2 3-1.8 4.8-3.2 6.6A7.5 7.5 0 0 0 5.5 14.7C5.5 18.4 8.1 21 12 21z',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5a7.5 7.5 0 0 1 15 0',
  coach: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 9.5-4.9M15 13h6v8h-6zM17 13v-1h2v1M16.5 16.5h3M16.5 18.5h2',
  mail: 'M3.5 6h17v12h-17zM3.5 6l8.5 7 8.5-7',
  phone: 'M7 3h10v18H7zM11 18h2',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  eyeoff:
    'M3 3l18 18M10.6 5.7A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-3 3.7M6.6 6.6C3.9 8.3 2.5 12 2.5 12S6 18.5 12 18.5c1.8 0 3.4-.6 4.7-1.4M9.9 9.9a3 3 0 0 0 4.2 4.2',
  globe:
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5.5M12 7.8v.01',
  warn: 'M12 4 2.8 19.5h18.4zM12 10v4.5M12 17.2v.01',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  sliders: 'M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  scale:
    'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM8.5 9.5a5 5 0 0 1 7 0L12 12',
  bolt: 'M13 3 5 13.5h6L10 21l8-10.5h-6z',
  key: 'M8 15a4 4 0 1 1 3.9-4.9L21 10v3h-2v2h-3v-2h-4.1A4 4 0 0 1 8 15z',
  sparkle:
    'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z',
  minus: 'M5 12h14',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  trash: 'M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  barcode: 'M3.5 7V4.5H6M18 4.5h2.5V7M20.5 17v2.5H18M6 19.5H3.5V17M7.5 8v8M10.5 8v8M13 8v8M16.5 8v8',
  camera: 'M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  doc: 'M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5',
  bookmark: 'M6 3h12v18l-6-4-6 4z',
  cart: 'M3 4h2.5l2.2 11h10.6L20.5 7H6.4M9 20h.01M17 20h.01',
  copy: 'M9 9h10v11H9zM5 15V4h10',
  share: 'M12 15V3M8 7l4-4 4 4M5 11v9h14v-9',
  swap: 'M7 4 3.5 7.5 7 11M3.5 7.5H17M17 13l3.5 3.5L17 20M20.5 16.5H7',
  more: 'M6 12h.01M12 12h.01M18 12h.01',
  book: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5',
  cal: 'M4 6h16v14H4zM4 10h16M8 3.5V7M16 3.5V7',
  mic: 'M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21',
} as const;

export type IconName = keyof typeof IC;

// Icons that point in a direction and must flip in Arabic.
const MIRROR: IconName[] = ['back', 'chev'];

type Props = { name: IconName; size?: number; color?: string; strokeWidth?: number };

export function Icon({ name, size = 22, color, strokeWidth = 1.8 }: Props) {
  const { colors, isRTL } = useSettings();
  const d = IC[name];
  const dotted = /h\.01|v\.01/.test(d) && name !== 'info' && name !== 'warn';
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={isRTL && MIRROR.includes(name) ? { transform: [{ scaleX: -1 }] } : undefined}>
      <Path
        d={d}
        stroke={color ?? colors.text}
        strokeWidth={dotted ? 2.8 : strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** The Gymi brand ring: about 80% closed, rounded ends. Also the AI coach avatar. */
export function Mark({ size = 28, color = '#3355FF', stroke }: { size?: number; color?: string; stroke?: number }) {
  const sw = stroke ?? size * 0.2;
  const r = (size - sw) / 2;
  const C = 2 * Math.PI * r;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeDasharray={`${C * 0.8} ${C}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}
