"""Sound effects for the Adro reel, made from scratch (noise and tones) and placed on the video's timeline."""
import sys, wave
import numpy as np

SR = 48000
TOTAL = 28.8
rng = np.random.default_rng(7)
mix = np.zeros((int(TOTAL * SR) + SR, 2))

def env(n, a=0.005, r=None, shape=4.0):
    """Fast attack, exponential decay over n samples."""
    t = np.arange(n) / SR
    att = np.clip(t / max(a, 1e-4), 0, 1)
    dec = np.exp(-shape * t / (r if r else n / SR))
    return att * dec

def band(x, lo, hi):
    """Band-pass by FFT (fine for short sounds)."""
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    X[(f < lo) | (f > hi)] = 0
    return np.fft.irfft(X, len(x))

def sweep_noise(dur, f0, f1, q=0.5):
    """Noise whose pass band slides from f0 to f1 (a whoosh), built from short overlapping bands."""
    n = int(dur * SR); out = np.zeros(n); k = 24; L = n // k * 2
    for i in range(k):
        c = f0 * (f1 / f0) ** (i / (k - 1)); s = i * n // k
        seg = band(rng.standard_normal(L), c * (1 - q), c * (1 + q)) * np.hanning(L)
        e = min(n, s + L); out[s:e] += seg[: e - s]
    return out / (np.abs(out).max() + 1e-9)

def tone(f, dur, decay=6.0, harm=(1.0, 0.3, 0.12)):
    n = int(dur * SR); t = np.arange(n) / SR
    y = sum(a * np.sin(2 * np.pi * f * (i + 1) * t) for i, a in enumerate(harm))
    return y * env(n, 0.003, dur, decay)

def put(x, at, gain=1.0, pan=0.0):
    s = int(at * SR); e = min(len(mix), s + len(x))
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    mix[s:e, 0] += x[: e - s] * gain * l * 1.41
    mix[s:e, 1] += x[: e - s] * gain * r * 1.41

# --- building blocks
def whoosh(dur=0.32, up=True):
    w = sweep_noise(dur, 300 if up else 3500, 3500 if up else 300)
    return w * np.sin(np.linspace(0, np.pi, len(w))) ** 1.5
def clap():
    n = int(0.25 * SR); x = band(rng.standard_normal(n), 800, 6000) * env(n, 0.001, 0.25, 9)
    return x / np.abs(x).max()
def thud(f=55, dur=0.35):
    n = int(dur * SR); t = np.arange(n) / SR
    y = np.sin(2 * np.pi * (f + 60 * np.exp(-t * 30)) * t) * env(n, 0.002, dur, 7)
    y += 0.3 * band(rng.standard_normal(n), 60, 800) * env(n, 0.001, 0.06, 6)
    return y / np.abs(y).max()
def step():
    n = int(0.12 * SR); y = band(rng.standard_normal(n), 120, 2200) * env(n, 0.001, 0.12, 9)
    return 0.7 * y / np.abs(y).max() + 0.5 * thud(70, 0.12)
def clank():
    y = sum(tone(f, 0.6, 7, (1,)) * a for f, a in [(523, 1), (1247, .6), (2311, .35), (3480, .2)])
    n = len(y); y += 0.4 * band(rng.standard_normal(n), 2000, 9000) * env(n, 0.001, 0.05, 6)
    return y / np.abs(y).max()
def pop():
    n = int(0.09 * SR); t = np.arange(n) / SR
    y = np.sin(2 * np.pi * (500 + 900 * t / 0.09) * t) * env(n, 0.002, 0.09, 5)
    return y
def tick(f=2400):
    return tone(f, 0.03, 9, (1,))
def ding(f=1318.5):
    a = 0.6 * tone(f, 0.9, 4, (1, .25, .08)); b = 0.4 * tone(f * 1.5, 0.7, 5, (1,))
    a[: len(b)] += b
    return a
def shutter():
    n = int(0.16 * SR); y = band(rng.standard_normal(n), 1500, 9000)
    e = np.zeros(n); e[: int(.03 * SR)] = 1; e[int(.07 * SR): int(.11 * SR)] = .8
    return y * e * env(n, 0.001, 0.16, 2)
def key():
    n = int(0.03 * SR); return band(rng.standard_normal(n), 2500, 8000) * env(n, 0.0005, 0.03, 8)
def boom():
    y = thud(42, 2.2) * 1.0
    n = len(y); y += 0.25 * band(rng.standard_normal(n), 30, 300) * env(n, 0.01, 2.2, 3)
    return y / np.abs(y).max()
def shimmer(dur):
    n = int(dur * SR); t = np.arange(n) / SR; y = np.zeros(n)
    for f in [1760, 2217, 2637, 3520]:
        y += np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) * (0.5 + 0.5 * np.sin(2 * np.pi * rng.uniform(3, 7) * t))
    return y / 4 * np.sin(np.linspace(0, np.pi, n)) ** 2
def riser(dur):
    w = sweep_noise(dur, 200, 6000, 0.35)
    return w * np.linspace(0, 1, len(w)) ** 2

# --- the timeline (seconds), matching compose.js
starts = np.cumsum([0, 1.6, 1.4, 2.9, 1.7, 3.0, 1.5, 1.6, 1.4, 2.9, 2.9, 1.4])
END = 25.2
TL = [3.0, 7.6, 15.1, 18.0, 22.3]          # card scenes
# cuts
for i, s in enumerate(starts[1:]):
    put(whoosh(0.3, i % 2 == 0), s - 0.17, 0.32, -0.4 if i % 2 else 0.4)
# opening: chalk clap and dust, the words pop in
put(clap(), 0.42, 0.9); put(whoosh(1.0, False) * 0.6, 0.45, 0.35)
for k in range(4): put(pop(), 0.15 + k * 0.22, 0.28, -0.3 + k * 0.2)
for k, at in enumerate([1.66, 2.02, 2.38, 2.74]): put(step(), at, 0.55, -0.2 if k % 2 else 0.2)
# cards slide in
for s in TL: put(whoosh(0.28, True), s + 0.12, 0.22); put(pop(), s + 0.32, 0.35)
# recovery counts to 85% and lands
for k in range(16): put(tick(1800 + k * 70), 3.5 + k * 0.08, 0.13)
put(ding(1568), 4.85, 0.32)
# squat: the bar lands, deadlift: plates and set 2 filled
put(thud(48, 0.5), 6.85, 0.5); put(clank(), 6.9, 0.2)
put(clank(), 8.1, 0.22, 0.3)
put(ding(1318.5), 9.1, 0.35); put(pop(), 9.4, 0.25)
# shoulder press clank
put(clank(), 12.6, 0.18, -0.3)
# meal photo: shutter, calories count up
put(shutter(), 15.45, 0.55)
for k in range(14): put(tick(1600 + k * 80), 15.7 + k * 0.08, 0.12)
put(ding(1760), 16.85, 0.25)
# coach: message sent, typing, reply
put(whoosh(0.25, True), 18.25, 0.25)
for k in range(30): put(key(), 18.8 + k * 0.053 + rng.uniform(-.01, .01), 0.22, rng.uniform(-.3, .3))
put(pop(), 20.45, 0.3)
# streak goes to 12
put(whoosh(0.5, True), 23.2, 0.3); put(ding(1975.5), 23.5, 0.38); put(ding(2637), 23.62, 0.18)
# end: riser, boom, the ring draws, the words arrive
put(riser(1.2), END - 1.1, 0.28)
put(boom(), END + 0.05, 0.42)
put(shimmer(1.3), END + 0.2, 0.18)
put(ding(1046.5), END + 1.05, 0.3); put(ding(1568), END + 1.1, 0.2)
put(pop(), END + 1.45, 0.3); put(pop(), END + 1.95, 0.3)

# master: gentle limiter and fade out
m = mix[: int(TOTAL * SR)]
peak = np.abs(m).max(); m = m / max(peak, 1e-9) * 0.89
m = np.tanh(m * 1.2) / np.tanh(1.2)
fo = int(0.6 * SR); m[-fo:] *= np.linspace(1, 0, fo)[:, None]
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((m * 32767).astype('<i2').tobytes())
print('ok', len(m) / SR)
