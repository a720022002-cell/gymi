import { Platform, Vibration } from 'react-native';

/** Short double beep and a buzz when rest is over. */
export function restDone() {
  try {
    Vibration.vibrate([0, 200, 100, 200]);
  } catch {}
  if (Platform.OS !== 'web') return;
  try {
    const AC = (globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    [0, 0.25].forEach((at) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.18);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + at);
      o.stop(ctx.currentTime + at + 0.2);
    });
    setTimeout(() => ctx.close().catch(() => {}), 800);
  } catch {}
}
