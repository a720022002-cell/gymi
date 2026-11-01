"""POV teaser audio: heartbeat that slowly builds across shots 1-5 (0-15 s), one beat of silence, soft chime on the ring."""
import wave
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
SR = 44100; LEN = 20.0
rng = np.random.default_rng(3)
mix = np.zeros(int(SR * LEN) + SR)
def t_(d): return np.arange(int(SR * d)) / SR
def env(n, a, d):
    t = np.arange(n) / SR
    return np.minimum(1, t / a) * np.exp(-np.maximum(0, t - a) / d)
def lp(x, f): return sosfilt(butter(4, f, btype='low', fs=SR, output='sos'), x)
def norm(x, p=1.0): return x / (np.max(np.abs(x)) or 1) * p
def thump(f0, f1, d, lvl):
    t = t_(d); fr = f1 + (f0 - f1) * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(fr) / SR) * env(len(t), 0.003, d / 3.2) * lvl
def beat(lvl):
    out = np.zeros(int(SR * 0.8))
    a = thump(85, 42, 0.42, 1.0); b = thump(78, 40, 0.5, 0.7)
    out[:len(a)] += a; i = int(SR * 0.2); out[i:i + len(b)] += b
    return lp(out, 900) * lvl
def place(x, at, g=1.0):
    i = int(SR * at); mix[i:i + len(x)] += x[:max(0, len(mix) - i)] * g
# Heartbeat: 56 bpm -> 92 bpm across 0.3-14.6 s, getting louder.
t = 0.4
while t < 14.55:
    k = t / 14.6
    place(beat(0.35 + 0.55 * k), t)
    t += 60 / (56 + 36 * k ** 1.4)
# Low room drone, swelling a little, gone before the silence.
d = t_(14.6)
drone = lp(rng.standard_normal(len(d)), 140) * 0.9 + np.sin(2 * np.pi * 48 * d) * 0.25
drone *= np.minimum(1, d / 2.0) * (0.25 + 0.35 * d / 14.6) * np.minimum(1, (14.6 - d) / 0.25)
place(norm(drone, 0.22), 0)
# 14.6-15.6 s: silence. Chime when the ring draws (15.7) and a softer one when it settles into the o (17.4).
def chime(f, d=3.2, lvl=0.5):
    t = t_(d)
    s = sum(a * np.sin(2 * np.pi * f * m * t) * np.exp(-t / (d / (1 + i))) for i, (m, a) in enumerate([(1, 1), (2.01, .35), (3.03, .16), (4.2, .07)]))
    s *= np.minimum(1, t / 0.004)
    ir = rng.standard_normal(int(SR * 1.2)) * np.exp(-t_(1.2) / 0.35)
    return norm(s + norm(fftconvolve(s, ir)[:len(s)], 0.3), lvl)
place(chime(880), 15.7, 1.0)
place(chime(1318.5, 3.0, 0.32), 17.35, 1.0)
place(thump(60, 34, 1.2, 0.5), 15.7, 1.0)
out = mix[:int(SR * LEN)]
out[-int(SR * 1.0):] *= np.linspace(1, 0, int(SR * 1.0))
out = norm(np.tanh(out * 1.3), 0.9)
with wave.open('audio.wav', 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((out * 32767).astype(np.int16).tobytes())
print('ok')
