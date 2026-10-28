import type { ComponentType, ReactNode } from 'react';

import { CLOTH, EYE_COLORS, HAIR_COLORS, type Look, SKIN } from '@/lib/avatar';

/** The drawing parts (react-native-svg in the app; plain SVG tags for previews). */
export type SvgKit = Record<'Svg' | 'G' | 'Path' | 'Circle' | 'Ellipse' | 'Rect' | 'Defs' | 'Pattern', ComponentType<any> | string>;

/** A colour a bit darker (f < 0) or lighter (f > 0). */
export function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.round(Math.min(255, Math.max(0, f < 0 ? v * (1 + f) : v + (255 - v) * f)));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => ch(v).toString(16).padStart(2, '0')).join('')}`;
}

type Pt = [number, number, number];
const HEAD = 1.16;
/** The drawing's box (the big head reaches above 0). */
export const AVATAR_BOX = { x: 0, y: -16, w: 200, h: 392 };
const f1 = (n: number) => Math.round(n * 10) / 10;

/** A smooth limb through points [x, y, width], rounded at both ends. */
function tube(pts: Pt[], flatEnd = false) {
  const L: [number, number][] = [];
  const R: [number, number][] = [];
  pts.forEach(([x, y, w], i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    L.push([x + (nx * w) / 2, y + (ny * w) / 2]);
    R.push([x - (nx * w) / 2, y - (ny * w) / 2]);
  });
  const smooth = (p: [number, number][]) => {
    let d = '';
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[Math.max(0, i - 1)];
      const p1 = p[i];
      const p2 = p[i + 1];
      const p3 = p[Math.min(p.length - 1, i + 2)];
      d += ` C${f1(p1[0] + (p2[0] - p0[0]) / 6)},${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)},${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])},${f1(p2[1])}`;
    }
    return d;
  };
  const last = pts[pts.length - 1];
  const first = pts[0];
  const dir = (p: Pt, q: Pt) => {
    const l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
    return [(q[0] - p[0]) / l, (q[1] - p[1]) / l];
  };
  const de = dir(pts[pts.length - 2], last);
  const ds = dir(pts[1], first);
  const Rr = [...R].reverse();
  return (
    `M${f1(L[0][0])},${f1(L[0][1])}` +
    smooth(L) +
    (flatEnd ? ` L${f1(Rr[0][0])},${f1(Rr[0][1])}` : ` Q${f1(last[0] + de[0] * last[2] * 0.75)},${f1(last[1] + de[1] * last[2] * 0.75)} ${f1(Rr[0][0])},${f1(Rr[0][1])}`) +
    smooth(Rr) +
    ` Q${f1(first[0] + ds[0] * first[2] * 0.75)},${f1(first[1] + ds[1] * first[2] * 0.75)} ${f1(L[0][0])},${f1(L[0][1])}Z`
  );
}

/**
 * The character, front on, in a 200 × 370 box. `build` (0–1) is how strong it looks: shoulders, arms, legs and abs
 * grow with it; at 0 there's a little belly.
 */
export function AvatarArt({ look, build, kit, id = 'av' }: { look: Look; build: number; kit: SvgKit; id?: string }) {
  const { G, Path, Circle, Ellipse, Rect, Defs, Pattern } = kit as Record<string, ComponentType<Record<string, unknown> & { children?: ReactNode }>>;
  const b = Math.max(0, Math.min(1, build));
  const fem = look.body === 'f';
  const skin = SKIN[look.skin] ?? SKIN[2];
  const skinD = shade(skin, -0.14);
  const skinL = shade(skin, -0.28);
  const hair = HAIR_COLORS[look.hairColor] ?? HAIR_COLORS[0];
  const hairD = shade(hair, -0.3);
  const top = CLOTH[look.topColor] ?? CLOTH[0];
  const topD = shade(top, -0.18);
  const bot = CLOTH[look.bottomColor] ?? CLOTH[1];
  const botD = shade(bot, -0.2);
  const shoe = CLOTH[look.shoes] ?? CLOTH[2];
  const hatC = CLOTH[look.hatColor] ?? CLOTH[1];
  const ink = '#2A1E1A';

  // Body sizes (half widths from the middle, x = 100).
  const S = fem ? 26 + 9 * b : 30 + 21 * b; // shoulders
  const N = fem ? 8 + 1.5 * b : 9.5 + 4 * b; // neck
  const belly = !fem && b < 0.2 ? 7 * (1 - b / 0.2) : 0;
  const W = fem ? 20 + 1.5 * b : 27 - 2 * b; // waist
  const H = fem ? 29 + 2 * b : 27 + 2 * b; // hips
  const A = fem ? 7 + 4.5 * b : 8 + 10.5 * b; // arm thickness
  const yS = 130;
  const yW = 198;
  const yH = 226;
  const hijab = look.hat === 'hijab';
  const shemagh = look.hat === 'shemagh';

  // ---- Paths ----
  // The torso: the left side, then the same points mirrored in reverse.
  const half: [number, number][][] = [
    [[100 - N, 116]],
    [
      [100 - N - 10, 124],
      [100 - S + 8, yS - 6],
      [100 - S, yS + 3],
    ],
    [
      [100 - S - 2, yS + 14],
      [100 - S + 3, yS + 24],
      [100 - S + 6, yS + 30],
    ],
    [
      [100 - W - 2 - belly, yS + 48],
      [100 - W - belly, yW - 10],
      [100 - W, yW],
    ],
    [
      [100 - W, yW + 10],
      [100 - H, yH - 12],
      [100 - H, yH],
    ],
  ];
  // A shirt hangs straight from the chest (no waist).
  const Wt = fem ? W + 2 : Math.max(W + 3, S - 11);
  const shirt: [number, number][][] = [
    ...half.slice(0, 3),
    [
      [100 - Wt, yS + 50],
      [100 - Wt, yH - 20],
      [100 - Wt, yH],
    ],
  ];
  const closed = (grow: number, cut = yH + 6, shape = half) => {
    const g = (p: [number, number]): [number, number] => [p[0] < 100 ? p[0] - grow : p[0] + grow, Math.min(p[1], cut)];
    const L = shape.map((seg) => seg.map(g));
    let d = `M${f1(L[0][0][0])},${f1(L[0][0][1] - grow)}`;
    for (let i = 1; i < L.length; i++) d += ` C${L[i].map((p) => `${f1(p[0])},${f1(p[1])}`).join(' ')}`;
    const end = L[L.length - 1][2];
    d += ` L${f1(200 - end[0])},${f1(end[1])}`;
    for (let i = L.length - 1; i >= 1; i--) {
      const c = L[i];
      const prev = i === 1 ? [L[0][0][0], L[0][0][1] - grow] : L[i - 1][2];
      d += ` C${f1(200 - c[1][0])},${f1(c[1][1])} ${f1(200 - c[0][0])},${f1(c[0][1])} ${f1(200 - prev[0])},${f1(prev[1])}`;
    }
    return `${d}Z`;
  };

  const arm = (s: -1 | 1, w = 1, to = 1, flat = false) => {
    const x = (dx: number) => 100 + s * dx;
    const pts: Pt[] = [
      [x(S - 4), yS + 4, A * 1.35 * w],
      [x(S + 1), yS + 22, A * 1.18 * w],
      [x(S + 4), yS + 46, A * 0.92 * w],
      [x(S + 6), yS + 64, A * 0.98 * w],
      [x(S + 7.5), yS + 82, A * 0.74 * w],
    ];
    if (to < 1) pts.splice(2, 3, [x(S + 2.6), yS + 34, A * 1.06 * w]);
    return tube(to < 1 ? pts.slice(0, 3) : pts, flat);
  };
  const handC = (s: -1 | 1): [number, number] => [100 + s * (S + 8), yS + 92];

  const legPts = (s: -1 | 1, w = 0): Pt[] => {
    const x = (dx: number) => 100 + s * dx;
    const th = (fem ? H * 0.98 : H * 0.92) + 7 * b;
    return [
      [x(H / 2), yH - 6, th + w],
      [x(H / 2 - 1), yH + 34, th * 0.86 + w],
      [x(H / 2 - 2), yH + 66, th * 0.56 + w],
      [x(H / 2 - 2), yH + 86, th * 0.62 + 3 * b + w],
      [x(H / 2 - 1.5), yH + 112, th * 0.4 + w],
    ];
  };
  const ankle = (s: -1 | 1) => 100 + s * (H / 2 - 1.5);
  const yA = yH + 112;

  // ---- Pieces ----
  const out: ReactNode[] = [];
  const add = (n: ReactNode) => out.push(n);
  let k = 0;
  const P = (d: string, fill: string, extra: Record<string, unknown> = {}) => <Path key={k++} d={d} fill={fill} {...extra} />;
  const line = (d: string, color: string, wid: number, extra: Record<string, unknown> = {}) => <Path key={k++} d={d} fill="none" stroke={color} strokeWidth={wid} strokeLinecap="round" strokeLinejoin="round" {...extra} />;
  const edge = (c: string) => ({ stroke: shade(c, -0.3), strokeWidth: 1 });

  // Ground shadow
  add(<Ellipse key={k++} cx={100} cy={yA + 20} rx={46 + 6 * b} ry={6} fill="#000" opacity={0.12} />);

  // Hair behind the head, the hijab's back (scaled with the head, below).
  const backFrom = out.length;
  if (hijab)
    add(
      P(
        `M100,6 C134,6 150,28 150,58 C150,86 142,104 132,116 C152,122 ${100 + S + 10},${yS - 2} ${100 + S + 12},${yS + 16} L${100 - S - 12},${yS + 16} C${100 - S - 10},${yS - 2} 48,122 68,116 C58,104 50,86 50,58 C50,28 66,6 100,6Z`,
        hatC,
        edge(hatC),
      ),
    );
  else if (shemagh) add(P(`M100,8 C134,8 148,30 148,58 C148,92 150,110 ${100 + S + 6},${yS + 22} L${100 - S - 6},${yS + 22} C50,110 52,92 52,58 C52,30 66,8 100,8Z`, '#F5F3EF', edge('#F5F3EF')));
  else if (look.hair === 'long' || look.hair === 'bob' || look.hair === 'curly') {
    const len = look.hair === 'bob' ? 104 : look.hair === 'curly' ? 120 : fem ? 152 : 124;
    const wide = look.hair === 'curly' ? 50 : 42;
    add(
      P(
        `M100,8 C${100 + wide + 4},8 ${100 + wide + 2},40 ${100 + wide},70 C${100 + wide - 2},${len - 20} ${100 + wide - 6},${len} ${100 + wide - 16},${len} L${100 - wide + 16},${len} C${100 - wide + 6},${len} ${100 - wide + 2},${len - 20} ${100 - wide},70 C${100 - wide - 2},40 ${100 - wide - 4},8 100,8Z`,
        hair,
        edge(hair),
      ),
    );
  } else if (look.hair === 'ponytail') add(P('M126,28 C150,30 152,60 146,86 C142,104 148,118 140,126 C136,108 128,96 132,74 C134,56 130,40 120,32Z', hair, edge(hair)));
  const backTo = out.length;
  if (look.top === 'hoodie') add(P(`M${100 - N - 22},${yS - 4} C${100 - N - 18},104 ${100 + N + 18},104 ${100 + N + 22},${yS - 4}Z`, topD));

  // Legs and the body.
  ([-1, 1] as const).forEach((s) => add(P(tube(legPts(s)), skin, edge(skin))));
  add(P(`M${100 - N},92 L${100 - N},124 L${100 + N},124 L${100 + N},92Z`, skinD));
  add(P(closed(0), skin, edge(skin)));

  // Muscle lines on a bare chest (no shirt or a tank top's open sides).
  const bare = look.top === 'none';
  if (bare) {
    const o = 0.35 + 0.5 * b;
    add(line(`M${100 - S + 10},${yS + 14} C${100 - S + 14},${yS + 30} 92,${yS + 34} 100,${yS + 28}`, skinL, 1.6, { opacity: o }));
    add(line(`M${100 + S - 10},${yS + 14} C${100 + S - 14},${yS + 30} 108,${yS + 34} 100,${yS + 28}`, skinL, 1.6, { opacity: o }));
    add(<Circle key={k++} cx={100 - S / 2.4} cy={yS + 26} r={1.6} fill={skinL} opacity={0.6} />);
    add(<Circle key={k++} cx={100 + S / 2.4} cy={yS + 26} r={1.6} fill={skinL} opacity={0.6} />);
    if (b >= 0.5) {
      add(line(`M100,${yS + 36} L100,${yW + 4}`, skinL, 1.3, { opacity: o }));
      [0, 1, 2].forEach((r) => {
        const y = yS + 44 + r * 14;
        add(line(`M91,${y} Q95,${y + 2} 99,${y}`, skinL, 1.3, { opacity: o }));
        add(line(`M101,${y} Q105,${y + 2} 109,${y}`, skinL, 1.3, { opacity: o }));
      });
    } else if (belly) add(line(`M${100 - W + 4},${yW - 10} Q100,${yW + 4} ${100 + W - 4},${yW - 10}`, skinL, 1.3, { opacity: 0.5 }));
    add(<Ellipse key={k++} cx={100} cy={yW - 4} rx={1.4} ry={2} fill={skinL} />);
  }

  // Bottoms.
  const waistTop = yW + 8;
  const hipsBlock = `M${100 - W - 2},${waistTop} L${100 + W + 2},${waistTop} L${100 + H + 2},${yH} L${100 + H / 2 + 4},${yH + 14} L100,${yH + 12} L${100 - H / 2 - 4},${yH + 14} L${100 - H - 2},${yH}Z`;
  if (look.bottom === 'joggers' || look.bottom === 'leggings') {
    const tight = look.bottom === 'leggings' ? 1.5 : 5;
    ([-1, 1] as const).forEach((s) => add(P(tube(legPts(s, tight).map(([x, y, w], i) => [x, i === 4 ? y - 2 : y, w] as Pt)), bot, edge(bot))));
    add(P(hipsBlock, bot));
    if (look.bottom === 'joggers') ([-1, 1] as const).forEach((s) => add(<Rect key={k++} x={ankle(s) - 8} y={yA - 8} width={16} height={6} rx={3} fill={botD} />));
    else ([-1, 1] as const).forEach((s) => add(line(`M${100 + s * (H + 1)},${yH + 4} L${ankle(s) + s * 6},${yA - 6}`, botD, 1.2, { opacity: 0.6 })));
  } else {
    const len = look.bottom === 'long_shorts' ? 64 : fem ? 30 : 46;
    ([-1, 1] as const).forEach((s) => {
      const x = (dx: number) => 100 + s * dx;
      add(P(`M${x(0)},${yH + 8} L${x(H + 3)},${yH - 4} L${x(H + 5)},${yH + len} L${x(4)},${yH + len + 2} Z`, bot, edge(bot)));
      if (!fem) add(line(`M${x(H + 2)},${yH} L${x(H + 3.5)},${yH + len - 1}`, '#FFFFFF', 2, { opacity: 0.8 }));
    });
    add(P(hipsBlock, bot));
  }
  add(<Rect key={k++} x={100 - W - 2} y={waistTop - 1} width={2 * W + 4} height={8} rx={3} fill={botD} />);
  if (!fem && look.bottom !== 'leggings') add(line(`M98,${waistTop + 6} l-3,9 M102,${waistTop + 6} l3,9`, '#FFFFFF', 1.4));

  // Tops: body part.
  const sleeve = (s: -1 | 1, to: number, w: number) => P(arm(s, w, to, to < 1), top, edge(top));
  if (look.top === 'tee' || look.top === 'long' || look.top === 'compression' || look.top === 'hoodie' || look.top === 'tank') {
    const grow = look.top === 'hoodie' ? 4 : look.top === 'compression' ? 0.5 : 1.5;
    const cut = look.top === 'hoodie' ? yH + 2 : waistTop + 6;
    add(P(closed(grow, cut, look.top === 'compression' ? half : shirt), top, edge(top)));
    if (!hijab) {
      if (look.top === 'tank') add(P(`M${100 - N - 7},112 L${100 - N - 7},118 C${100 - N - 6},${yS + 26} ${100 + N + 6},${yS + 26} ${100 + N + 7},118 L${100 + N + 7},112Z`, skin));
      else add(P(`M${100 - N - 2},112 L${100 - N - 2},119 C${100 - N},${yS + 4} ${100 + N},${yS + 4} ${100 + N + 2},119 L${100 + N + 2},112Z`, skin));
      add(line(look.top === 'tank' ? `M${100 - N - 7},118 C${100 - N - 6},${yS + 26} ${100 + N + 6},${yS + 26} ${100 + N + 7},118` : `M${100 - N - 2},119 C${100 - N},${yS + 4} ${100 + N},${yS + 4} ${100 + N + 2},119`, topD, 2.2));
    }
    if (look.top === 'compression') {
      add(line(`M${100 - S + 10},${yS + 16} C${100 - S + 14},${yS + 30} 92,${yS + 34} 100,${yS + 28} C108,${yS + 34} ${100 + S - 14},${yS + 30} ${100 + S - 10},${yS + 16}`, topD, 1.4));
      if (b >= 0.5) add(line(`M100,${yS + 36} L100,${yW}`, topD, 1.2));
    }
    if (look.top === 'hoodie') {
      add(P(`M${100 - 18},${yW - 8} L${100 + 18},${yW - 8} L${100 + 22},${yW + 16} L${100 - 22},${yW + 16}Z`, topD));
      add(line(`M95,${yS} l-1,22 M105,${yS} l1,22`, '#FFFFFF', 1.6));
    }
    if (fem && look.top !== 'hoodie') add(line(`M${100 - S + 9},${yS + 22} Q${100 - 10},${yS + 34} 100,${yS + 26} Q${100 + 10},${yS + 34} ${100 + S - 9},${yS + 22}`, topD, 1.2, { opacity: 0.6 }));
  } else if (look.top === 'bra') {
    add(
      P(
        `M${100 - S + 4},${yS + 4} C${100 - S + 6},${yS + 20} ${100 - S + 6},${yS + 34} ${100 - W - 4},${yS + 40} L${100 + W + 4},${yS + 40} C${100 + S - 6},${yS + 34} ${100 + S - 6},${yS + 20} ${100 + S - 4},${yS + 4} C${100 + 10},${yS + 14} ${100 - 10},${yS + 14} ${100 - S + 4},${yS + 4}Z`,
        top,
        edge(top),
      ),
    );
    add(<Rect key={k++} x={100 - W - 4} y={yS + 34} width={2 * W + 8} height={6} rx={2} fill={topD} />);
  }

  // Arms (over a tank top's sides), sleeves, hands.
  ([-1, 1] as const).forEach((s) => add(P(arm(s), skin, edge(skin))));
  ([-1, 1] as const).forEach((s) => {
    if (look.top === 'tee') add(sleeve(s, 0.4, 1.12));
    else if (look.top === 'long' || look.top === 'compression') add(sleeve(s, 1, look.top === 'compression' ? 1.04 : 1.12));
    else if (look.top === 'hoodie') {
      add(sleeve(s, 1, 1.22));
      const [hx, hy] = handC(s);
      add(<Rect key={k++} x={hx - 7} y={hy - 15} width={14} height={7} rx={3} fill={topD} />);
    }
  });
  ([-1, 1] as const).forEach((s) => {
    const [hx, hy] = handC(s);
    add(<Ellipse key={k++} cx={hx} cy={hy} rx={6.5 + 1.5 * b} ry={8.5 + 1.5 * b} fill={skin} {...edge(skin)} />);
  });

  // Shoes: sneakers, toes pointing out a little.
  ([-1, 1] as const).forEach((s) => {
    const x = ankle(s) + s * 3;
    const sole = shoe === '#F4F4F4' ? '#C9CCD2' : '#F4F4F4';
    add(
      P(
        `M${x - 11},${yA + 2} C${x - 11},${yA - 6} ${x + 11},${yA - 6} ${x + 11},${yA + 2} C${x + 16},${yA + 6} ${x + 17},${yA + 11} ${x + 16},${yA + 13} L${x - 16},${yA + 13} C${x - 17},${yA + 11} ${x - 16},${yA + 6} ${x - 11},${yA + 2}Z`,
        shoe,
        edge(shoe),
      ),
    );
    add(<Rect key={k++} x={x - 17} y={yA + 12} width={34} height={6} rx={3} fill={sole} stroke={shade(sole, -0.25)} strokeWidth={0.8} />);
    add(line(`M${x - 6},${yA - 1} l12,0 M${x - 7},${yA + 3} l14,0`, shade(shoe, -0.4), 1.3));
    add(<Ellipse key={k++} cx={x + s * 9} cy={yA + 8} rx={4} ry={2} fill="#FFFFFF" opacity={0.25} />);
  });

  // ---- Head ----
  const headFrom = out.length;
  const head = fem
    ? 'M100,16 C121,16 134,30 134,54 C134,64 133,74 130,82 C125,96 114,104 100,104 C86,104 75,96 70,82 C67,74 66,64 66,54 C66,30 79,16 100,16Z'
    : 'M100,15 C122,15 136,29 136,53 C136,64 135,74 132,82 C128,96 116,106 100,106 C84,106 72,96 68,82 C65,74 64,64 64,53 C64,29 78,15 100,15Z';
  if (!hijab && !shemagh)
    ([-1, 1] as const).forEach((s) => {
      add(<Ellipse key={k++} cx={100 + s * (fem ? 34 : 36)} cy={64} rx={6} ry={9} fill={skin} {...edge(skin)} />);
      add(<Ellipse key={k++} cx={100 + s * (fem ? 34 : 36)} cy={64} rx={2.6} ry={5} fill={skinD} />);
    });
  add(P(head, skin, edge(skin)));
  add(<Ellipse key={k++} cx={100} cy={100} rx={18} ry={4} fill={skinD} opacity={0.35} />);

  // Beard (under the mouth and nose).
  const beard = fem ? 'none' : look.beard;
  if (beard === 'stubble' || beard === 'short' || beard === 'full') {
    const lo = beard === 'full' ? 114 : 108;
    add(P(`M66,62 C66,90 84,${lo} 100,${lo} C116,${lo} 134,90 134,62 C134,78 128,92 116,92 C110,88 90,88 84,92 C72,92 66,78 66,62Z`, hair, { opacity: beard === 'stubble' ? 0.28 : 0.95 }));
  }
  if (beard === 'goatee') add(P('M90,96 C92,106 108,106 110,96 C106,99 94,99 90,96Z', hair));
  if (beard === 'short' || beard === 'full' || beard === 'goatee' || beard === 'mustache') add(P('M86,85 C92,80 108,80 114,85 C110,88 104,86 100,87 C96,86 90,88 86,85Z', hair));

  // Face.
  const eyeC = EYE_COLORS[look.eyes] ?? EYE_COLORS[0];
  ([-1, 1] as const).forEach((s) => {
    const ex = 100 + s * 14;
    add(<Ellipse key={k++} cx={ex} cy={62} rx={8} ry={fem ? 7.4 : 6.8} fill="#FFFFFF" />);
    add(<Circle key={k++} cx={ex + s * -0.5} cy={62.5} r={5} fill={eyeC} />);
    add(<Circle key={k++} cx={ex + s * -0.5} cy={62.5} r={2.6} fill="#111" />);
    add(<Circle key={k++} cx={ex + 1.4} cy={60.8} r={1.3} fill="#FFFFFF" />);
    add(line(`M${ex - 8.5},${61} C${ex - 4.5},${54.5} ${ex + 4.5},${54.5} ${ex + 8.5},${61}`, ink, fem ? 2 : 1.5));
    if (fem) add(line(`M${ex + s * 8},${59} l${s * 3.5},-3 M${ex + s * 6},${56.5} l${s * 2},-3.5`, ink, 1.5));
    const bw = look.brows === 'thick' ? 3.6 : look.brows === 'thin' ? 1.6 : 2.5;
    add(line(`M${ex - s * 7},${50} C${ex - s * 3},${46.5} ${ex + s * 3},${46} ${ex + s * 8},${48.5}`, look.hat === 'hijab' ? '#3A271C' : hairD === '#000000' ? ink : shade(hair, -0.15), bw));
  });
  add(line('M101,64 C99,72 96,76 98.5,78.5 C100,79.5 102.5,79 104,77.5', skinL, 1.6));
  if (fem) add(P('M90,88 C95,92 105,92 110,88 C106,95 94,95 90,88Z', '#C4566B'));
  else add(P('M89,89 C95,95 105,95 111,89 C107,93.5 93,93.5 89,89Z', '#7A3328'));
  add(line(fem ? 'M89,88 C95,93 105,93 111,88' : 'M88,88.5 C95,95 105,95 112,88.5', ink, 1.6));
  if (fem) ([-1, 1] as const).forEach((s) => add(<Ellipse key={k++} cx={100 + s * 20} cy={78} rx={6} ry={3.5} fill="#F28B8B" opacity={0.25} />));

  // Hair on top.
  const H_ = (d: string) => add(P(d, hair, edge(hair)));
  if (!hijab && !shemagh) {
    const hs = look.hair;
    if (hs === 'short' || (hs === 'long' && !fem) || hs === 'bun') H_('M64,56 C60,28 78,8 100,8 C124,8 141,26 136,56 C134,46 130,38 124,34 C112,40 90,40 76,34 C70,40 66,48 64,56Z');
    if (hs === 'fade') add(P('M65,52 C63,30 80,11 100,11 C121,11 138,28 135,52 C132,42 128,34 122,30 C112,34 88,34 78,30 C72,34 68,42 65,52Z', hair, { opacity: 0.75 }));
    if (hs === 'quiff') H_('M64,56 C60,26 76,2 104,2 C130,2 144,22 136,56 C134,44 130,36 124,32 C118,22 106,18 94,22 C86,28 78,30 72,36 C68,42 65,48 64,56Z');
    if (hs === 'curly') {
      H_('M62,60 C58,30 78,10 100,10 C124,10 144,30 138,60 C134,46 128,40 120,38 C108,42 92,42 80,38 C72,42 66,50 62,60Z');
      [
        [70, 30],
        [82, 18],
        [96, 13],
        [110, 14],
        [124, 20],
        [133, 32],
        [66, 44],
        [136, 46],
      ].forEach(([x, y]) => add(<Circle key={k++} cx={x} cy={y} r={11} fill={hair} />));
    }
    if (hs === 'bun') add(<Circle key={k++} cx={100} cy={fem ? 4 : 6} r={fem ? 13 : 9} fill={hair} {...edge(hair)} />);
    if (fem && (hs === 'long' || hs === 'bob' || hs === 'ponytail' || hs === 'short' || hs === 'bun')) H_('M66,62 C60,28 78,8 102,8 C126,8 142,28 134,62 C132,48 128,40 122,34 C112,38 104,30 96,24 C88,36 74,40 70,48 C68,52 67,57 66,62Z');
    if (fem && hs === 'curly') {
      H_('M62,62 C58,30 78,10 100,10 C124,10 144,30 138,62 C134,46 128,40 120,36 C108,40 92,40 80,36 C72,40 66,50 62,62Z');
      [
        [70, 30],
        [84, 18],
        [100, 13],
        [116, 16],
        [130, 28],
        [64, 50],
        [137, 50],
      ].forEach(([x, y]) => add(<Circle key={k++} cx={x} cy={y} r={11} fill={hair} />));
    }
  }

  // Glasses.
  if (look.glasses !== 'none') {
    const shades = look.glasses === 'shades';
    ([-1, 1] as const).forEach((s) => {
      const ex = 100 + s * 14;
      if (look.glasses === 'round') add(<Circle key={k++} cx={ex} cy={62} r={9.5} fill="#FFFFFF" fillOpacity={0.12} stroke="#222" strokeWidth={2} />);
      else add(<Rect key={k++} x={ex - 10.5} y={shades ? 55 : 54} width={21} height={shades ? 14 : 16} rx={shades ? 6 : 3} fill={shades ? '#16181D' : '#FFFFFF'} fillOpacity={shades ? 0.94 : 0.12} stroke="#222" strokeWidth={2} />);
    });
    add(line('M96,61 Q100,58 104,61', '#222', 2));
  }

  // Hats.
  if (look.hat === 'cap') {
    add(P('M64,48 C62,20 80,6 100,6 C120,6 138,20 136,48 C120,42 80,42 64,48Z', hatC, edge(hatC)));
    add(P('M58,50 C80,40 120,40 142,50 C146,53 146,57 140,56 C118,48 82,48 60,56 C54,57 54,53 58,50Z', shade(hatC, -0.2)));
    add(<Circle key={k++} cx={100} cy={7} r={2.5} fill={shade(hatC, -0.2)} />);
  }
  if (look.hat === 'beanie') {
    add(P('M64,46 C62,16 80,2 100,2 C120,2 138,16 136,46Z', hatC, edge(hatC)));
    add(<Rect key={k++} x={62} y={36} width={76} height={14} rx={6} fill={shade(hatC, -0.15)} />);
  }
  if (look.hat === 'headband') add(<Rect key={k++} x={64} y={32} width={72} height={9} rx={4.5} fill={hatC} />);
  if (hijab) {
    // The face shows through the hijab.
    add(
      P(
        `M100,10 C130,10 144,30 144,58 C144,82 136,104 120,112 C112,116 88,116 80,112 C64,104 56,82 56,58 C56,30 70,10 100,10Z M100,22 C78,22 70,36 69,52 C68,70 72,84 78,94 C84,102 92,105 100,105 C108,105 116,102 122,94 C128,84 132,70 131,52 C130,36 122,22 100,22Z`,
        hatC,
        { fillRule: 'evenodd' },
      ),
    );
    add(line('M100,22 C78,22 70,36 69,52', shade(hatC, -0.25), 1.2));
  }
  if (shemagh) {
    add(
      <Defs key={k++}>
        <Pattern id={`${id}-sh`} width={7} height={7} patternUnits="userSpaceOnUse">
          <Rect width={7} height={7} fill="#F5F3EF" />
          <Rect width={3.5} height={3.5} fill="#C62828" />
        </Pattern>
      </Defs>,
    );
    add(
      P(
        `M100,8 C132,8 146,30 146,58 C146,88 148,108 ${100 + S + 2},${yS + 18} C${100 + S - 14},${yS + 4} 132,108 128,96 C134,80 134,64 133,48 C130,30 118,22 100,22 C82,22 70,30 67,48 C66,64 66,80 72,96 C68,108 ${100 - S + 14},${yS + 4} ${100 - S - 2},${yS + 18} C52,108 54,88 54,58 C54,30 68,8 100,8Z`,
        `url(#${id}-sh)`,
        edge('#E8E2DA'),
      ),
    );
    add(<Ellipse key={k++} cx={100} cy={24} rx={33} ry={6} fill="none" stroke="#151515" strokeWidth={4.5} />);
    add(<Ellipse key={k++} cx={100} cy={29} rx={34} ry={6} fill="none" stroke="#151515" strokeWidth={4.5} />);
  }

  // A big head, Bitmoji style: the head parts are drawn larger around the chin.
  const big = `translate(100 104) scale(${HEAD}) translate(-100 -104)`;
  return (
    <G>
      {out.slice(0, backFrom)}
      <G transform={big}>{out.slice(backFrom, backTo)}</G>
      {out.slice(backTo, headFrom)}
      <G transform={big}>{out.slice(headFrom)}</G>
    </G>
  );
}
