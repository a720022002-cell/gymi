// Workout overlays drawn on a photo for stories (web canvas). 1080 × 1920, like Instagram and Snapchat stories.

export type OverlayStyle = 'stats' | 'rings' | 'record' | 'line';

/** Everything an overlay shows, already worded and in your unit. */
export type OverlayData = {
  rtl: boolean;
  title: string;
  date: string;
  handle: string;
  stats: { label: string; value: string }[];
  /** Up to three rings: value 0–1, the number in the middle, a label under it. */
  rings: { v: number; big: string; label: string; color: string }[];
  record: { kicker: string; name: string; big: string; unit: string; sub: string };
  line: string;
};

const W = 1080;
const H = 1920;
const M = 84;
const font = (rtl: boolean, kind: 'display' | 'body', weight: 600 | 700 | 800, size: number) => {
  const latin = kind === 'display' ? (weight >= 700 ? 'Sora_700Bold' : 'Sora_600SemiBold') : weight >= 800 ? 'Manrope_800ExtraBold' : weight >= 700 ? 'Manrope_700Bold' : 'Manrope_600SemiBold';
  const ar = weight >= 700 ? 'IBMPlexSansArabic_700Bold' : 'IBMPlexSansArabic_600SemiBold';
  return `${size}px ${rtl ? `${ar}, ${latin}` : `${latin}, ${ar}`}, sans-serif`;
};

/** Draw the overlay. With `photo` it fills the frame (cover) under a soft shade; without it the background stays see-through (sticker). */
export function drawOverlay(ctx: CanvasRenderingContext2D, style: OverlayStyle, d: OverlayData, photo: HTMLImageElement | null, sticker = false) {
  const rtl = d.rtl;
  ctx.clearRect(0, 0, W, H);
  const text = (s: string, x: number, y: number, f: string, color = '#fff', align: CanvasTextAlign = 'left', shadow = true) => {
    ctx.save();
    ctx.font = f;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.direction = rtl ? 'rtl' : 'ltr';
    if (shadow) {
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 2;
    }
    ctx.fillText(s, x, y);
    const w = ctx.measureText(s).width;
    ctx.restore();
    return w;
  };
  const start = rtl ? W - M : M;
  const a: CanvasTextAlign = rtl ? 'right' : 'left';
  const logo = (x: number, y: number, size: number, align: 'left' | 'center' | 'right') => {
    ctx.save();
    ctx.font = font(false, 'display', 700, size);
    const tw = ctx.measureText('Adro').width;
    const r = size * 0.42;
    const full = r * 2 + size * 0.3 + tw;
    const left = align === 'center' ? x - full / 2 : align === 'right' ? x - full : x;
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.lineWidth = r * 0.55;
    ctx.strokeStyle = '#3355ff';
    ctx.lineCap = 'round';
    ctx.arc(left + r, y - size * 0.36, r * 0.78, -Math.PI / 2, -Math.PI / 2 + Math.PI * 1.6);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.direction = 'ltr';
    ctx.fillText('Adro', left + r * 2 + size * 0.3, y);
    ctx.restore();
  };
  const shade = (from: string, to: string, y0: number, y1: number) => {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, from);
    g.addColorStop(1, to);
    ctx.fillStyle = g;
    ctx.fillRect(0, Math.min(y0, y1), W, Math.abs(y1 - y0));
  };

  if (!sticker) {
    if (photo) {
      const s = Math.max(W / photo.naturalWidth, H / photo.naturalHeight);
      const w = photo.naturalWidth * s;
      const h = photo.naturalHeight * s;
      ctx.drawImage(photo, (W - w) / 2, (H - h) / 2, w, h);
    } else {
      // No photo yet: a dark gym-light background.
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#1a2150');
      g.addColorStop(0.6, '#0b0d17');
      g.addColorStop(1, '#07080c');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    if (style === 'stats') shade('rgba(0,0,0,0)', 'rgba(0,0,0,0.7)', H * 0.5, H);
    else if (style === 'rings') {
      shade('rgba(0,0,0,0.7)', 'rgba(0,0,0,0)', 0, 900);
      shade('rgba(0,0,0,0)', 'rgba(0,0,0,0.65)', H - 520, H);
    } else if (style === 'record') {
      shade('rgba(0,0,0,0.5)', 'rgba(0,0,0,0)', 0, 300);
      shade('rgba(0,0,0,0)', 'rgba(0,0,0,0.5)', H * 0.55, H);
    } else shade('rgba(0,0,0,0)', 'rgba(0,0,0,0.55)', H - 500, H);
  }

  if (style === 'stats') {
    let y = H - 760;
    text(d.title, start, y - 40, font(rtl, 'display', 700, 44), '#fff', a);
    for (const st of d.stats.slice(0, 3)) {
      y += 175;
      text(st.label, start, y - 100, font(rtl, 'body', 700, 32), 'rgba(255,255,255,0.8)', a);
      text(st.value, start, y, font(rtl, 'display', 700, 92), '#fff', a);
    }
    logo(start, H - 120, 46, rtl ? 'right' : 'left');
  } else if (style === 'rings') {
    text(d.title, W / 2, 250, font(rtl, 'display', 700, 66), '#fff', 'center');
    text(d.date, W / 2, 310, font(rtl, 'body', 600, 30), 'rgba(255,255,255,0.8)', 'center');
    const xs = rtl ? [W - 200, W / 2, 200] : [200, W / 2, W - 200];
    d.rings.slice(0, 3).forEach((g, i) => {
      const cx = xs[i];
      const cy = 560;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineWidth = 24;
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.arc(cx, cy, 120, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowColor = g.color;
      ctx.shadowBlur = 24;
      ctx.beginPath();
      ctx.strokeStyle = g.color;
      ctx.arc(cx, cy, 120, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.02, Math.min(1, g.v)));
      ctx.stroke();
      ctx.restore();
      text(g.big, cx, cy + 22, font(rtl, 'display', 700, 62), '#fff', 'center');
      text(g.label, cx, cy + 190, font(rtl, 'body', 700, 32), 'rgba(255,255,255,0.85)', 'center');
    });
    d.stats.slice(0, 3).forEach((st, i) => {
      text(st.value, xs[i], H - 260, font(rtl, 'display', 700, 56), '#fff', 'center');
      text(st.label, xs[i], H - 210, font(rtl, 'body', 700, 28), 'rgba(255,255,255,0.8)', 'center');
    });
    logo(W / 2, H - 100, 42, 'center');
  } else if (style === 'record') {
    logo(start, 150, 44, rtl ? 'right' : 'left');
    text(`‎${d.handle}`, rtl ? M : W - M, 150, font(rtl, 'body', 700, 30), 'rgba(255,255,255,0.85)', rtl ? 'left' : 'right');
    const cw = 900;
    const ch = 520;
    const x0 = (W - cw) / 2;
    const y0 = H - ch - 220;
    ctx.save();
    ctx.fillStyle = 'rgba(8,10,14,0.62)';
    ctx.strokeStyle = 'rgba(34,197,94,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x0, y0, cw, ch, 48);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    const x = rtl ? x0 + cw - 64 : x0 + 64;
    text(d.record.kicker, x, y0 + 100, font(rtl, 'body', 800, 34), '#22c55e', a, false);
    text(d.record.name, x, y0 + 180, font(rtl, 'display', 700, 56), '#fff', a, false);
    ctx.save();
    ctx.font = font(false, 'display', 700, 190);
    const nw = ctx.measureText(d.record.big).width;
    ctx.restore();
    text(d.record.big, x, y0 + 380, font(false, 'display', 700, 190), '#fff', a, false);
    text(d.record.unit, rtl ? x - nw - 24 : x + nw + 24, y0 + 380, font(rtl, 'display', 700, 54), 'rgba(255,255,255,0.75)', a, false);
    text(d.record.sub, x, y0 + 460, font(rtl, 'body', 700, 32), 'rgba(255,255,255,0.7)', a, false);
  } else {
    ctx.save();
    ctx.font = font(rtl, 'display', 700, 38);
    ctx.direction = rtl ? 'rtl' : 'ltr';
    const tw = ctx.measureText(d.line).width;
    ctx.restore();
    const pw = Math.min(W - 80, tw + 100);
    const y = H - 250;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.roundRect((W - pw) / 2, y - 66, pw, 104, 52);
    ctx.fill();
    ctx.restore();
    text(d.line, W / 2, y, font(rtl, 'display', 700, 38), '#fff', 'center', false);
    logo(W / 2, H - 110, 40, 'center');
  }
}

export const OVERLAY_SIZE = { w: W, h: H };
