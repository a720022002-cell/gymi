// Workout sounds on the web: tones made with Web Audio, voices with the browser's speech (design: SOUNDS).
type AC = AudioContext;
let ctx: AC | null = null;

function ac(): AC | null {
  try {
    const g = globalThis as { AudioContext?: new () => AC; webkitAudioContext?: new () => AC };
    const C = g.AudioContext ?? g.webkitAudioContext;
    if (!C) return null;
    ctx = ctx ?? new C();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

function tone(f1: number, f2: number, dur: number, type: OscillatorType = 'sine', vol = 0.3, delay = 0) {
  const a = ac();
  if (!a) return;
  try {
    const o = a.createOscillator();
    const g = a.createGain();
    const t = a.currentTime + delay;
    o.type = type;
    o.frequency.setValueAtTime(f1, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  } catch {}
}

function say(text: string) {
  try {
    const s = (globalThis as { speechSynthesis?: SpeechSynthesis }).speechSynthesis;
    const U = (globalThis as { SpeechSynthesisUtterance?: typeof SpeechSynthesisUtterance }).SpeechSynthesisUtterance;
    if (!s || !U) return tone(440, 0, 0.3);
    s.cancel();
    const u = new U(text);
    u.pitch = 0.5;
    u.rate = 0.85;
    u.lang = 'en-US';
    s.speak(u);
  } catch {
    tone(440, 0, 0.3);
  }
}

/** Play one of the workout sounds by id. */
export function playTone(id: string) {
  switch (id) {
    case 'none':
      return;
    case 'gymbell':
      tone(1250, 0, 1, 'triangle', 0.3);
      return tone(1257, 0, 1, 'triangle', 0.2, 0.015);
    case 'horn':
      tone(233, 0, 0.7, 'sawtooth', 0.16);
      tone(294, 0, 0.7, 'sawtooth', 0.12);
      return tone(349, 0, 0.7, 'sawtooth', 0.08);
    case 'lightweight':
      return say('Light weight, baby!');
    case 'yeahbuddy':
      return say('Yeah buddy!');
    default:
      tone(880, 0, 0.25);
      tone(1320, 0, 0.4, 'sine', 0.22, 0.12);
  }
}
