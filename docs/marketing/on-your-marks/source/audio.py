"""On your marks teaser audio: alarm, heartbeat that speeds up, starter voice, foley on each cut,
total silence instead of the gun, one deep pulse, riser, chime on the o."""
import wave
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve, resample_poly
SR = 44100; LEN = 17.0
rng = np.random.default_rng(11)
mix = np.zeros(int(SR * LEN) + SR)
def t_(d): return np.arange(int(SR * d)) / SR
def env(n, a, d):
    t = np.arange(n) / SR
    return np.minimum(1, t / a) * np.exp(-np.maximum(0, t - a) / d)
def filt(x, f, kind): return sosfilt(butter(4, f, btype=kind, fs=SR, output='sos'), x)
def norm(x, p=1.0): return x / (np.max(np.abs(x)) or 1) * p
def noise(d): return rng.standard_normal(int(SR * d))
def place(x, at, g=1.0):
    i = int(SR * at); mix[i:i + len(x)] += x[:max(0, len(mix) - i)] * g
def reverb(x, size, wet):
    ir = filt(noise(size), 6000, 'low') * np.exp(-t_(size) / (size / 4))
    return x + norm(fftconvolve(x, ir)[:len(x) + int(SR * size * 0.8)][:len(x)], np.max(np.abs(x)) * wet)
def thump(f0, f1, d, lvl):
    t = t_(d); fr = f1 + (f0 - f1) * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(fr) / SR) * env(len(t), 0.003, d / 3.2) * lvl
def beat(lvl):
    out = np.zeros(int(SR * 0.7)); a = thump(85, 42, 0.4, 1.0); b = thump(78, 40, 0.45, 0.7)
    out[:len(a)] += a; i = int(SR * 0.18); out[i:i + len(b)] += b
    return filt(out, 900, 'low') * lvl

# 0–1.35 s: phone alarm (two-tone pips), cut when the hand taps it.
for k in range(4):
    for j, f in enumerate((1568, 2093)):
        tt = t_(0.11); s = np.sin(2 * np.pi * f * tt) * env(len(tt), 0.004, 0.05)
        place(reverb(s, 0.2, 0.15), 0.12 + k * 0.32 + j * 0.13, 0.32)
place(filt(noise(0.04), 2500, 'band' if False else 'high') * env(int(SR * 0.04), 0.001, 0.01), 1.38, 0.25)  # tap

# Room drone 1.5–11.5, swelling.
d = t_(10.0)
drone = filt(noise(10.0), 150, 'low') * 0.9 + np.sin(2 * np.pi * 46 * d) * 0.3
drone *= np.minimum(1, d / 1.5) * (0.3 + 0.7 * (d / 10.0) ** 1.5)
drone[-200:] = 0
place(norm(drone, 0.2), 1.5)
# Stadium air under the wide shot.
place(norm(filt(noise(2.0), [300, 2500], 'band') * np.sin(np.pi * np.minimum(1, t_(2.0) / 2.0)), 0.05), 2.0)

# Heartbeat 2.0 -> 11.5 s: 60 bpm to ~190 bpm, louder.
t = 2.05
while t < 11.42:
    k = (t - 2.0) / 9.5
    place(beat(0.35 + 0.6 * k), t)
    t += 60 / (60 + 130 * k ** 1.8)

# Starter voice with a big outdoor slap.
def voice(path):
    w = wave.open(path); x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(float)
    x = x[::w.getnchannels()] / 32768; x = resample_poly(x, SR, w.getframerate())
    i = np.where(np.abs(x) > 0.045)[0]; x = x[max(0, i[0] - 400): i[-1] + 2000]
    x = filt(x, 120, 'high')
    return norm(reverb(np.concatenate([x, np.zeros(SR)]), 1.2, 0.35), 0.75)
place(voice('v_marks.wav'), 2.45)
place(voice('v_set.wav'), 8.15)

# Foley on the cuts.
def swish(d, lo, hi, lvl):
    s = filt(noise(d), [lo, hi], 'band'); s *= np.sin(np.pi * np.minimum(1, t_(d) / d)) ** 2
    return norm(s, lvl)
def chalk():
    s = filt(noise(0.06), [900, 5200], 'band') * env(int(SR * 0.06), 0.0008, 0.012)
    dust = filt(noise(0.6), 4000, 'high') * env(int(SR * 0.6), 0.02, 0.2) * 0.15
    out = np.zeros(int(SR * 0.6)); out[:len(s)] += s; out += dust
    return norm(reverb(out, 0.3, 0.3), 0.7)
def clink(scale=1.0, lvl=0.45):
    d = 0.8; tt = t_(d)
    s = sum(a * np.sin(2 * np.pi * f * scale * tt) * np.exp(-tt / dc) for f, a, dc in [(523, 1, .35), (1243, .7, .25), (2317, .5, .15), (3781, .3, .1)])
    return norm(reverb(s, 0.3, 0.2), lvl)
def breath(lvl):
    d = 0.45; s = filt(noise(d), [350, 2400], 'band') * np.sin(np.pi * np.minimum(1, t_(d) / d)) ** 1.5
    return norm(s, lvl)
def tick(lvl): return norm(filt(noise(0.03), 3000, 'high') * env(int(SR * 0.03), 0.0005, 0.006), lvl)
place(swish(0.35, 1500, 6000, 0.35), 4.05)   # laces pulled
place(swish(0.25, 1500, 6000, 0.3), 4.5)
place(chalk(), 5.15)                          # chalk clap
place(clink(1.0, 0.4), 6.25)                  # hand on the bar
place(tick(0.25), 7.3)                        # fingertips on the line
place(swish(0.5, 200, 1200, 0.3), 8.05)       # standing up
place(breath(0.35), 9.0)
place(breath(0.4), 9.5)
for k in range(6):                            # quarter-second cuts
    place(tick(0.35), 10.0 + k * 0.25)
    place(swish(0.2, 2000, 8000, 0.18), 10.0 + k * 0.25)
# Riser into the cut.
d = t_(1.5); r = filt(noise(1.5), [500, 9000], 'band') * (d / 1.5) ** 3
place(norm(r, 0.3), 10.0)

# 11.5–12.5: dead silence.
mix[int(SR * 11.5):int(SR * 12.5)] = 0
# 12.6: one deep pulse. 13.6–14.3 soft rise. 14.35 chime as the ring settles into the o.
place(norm(reverb(np.concatenate([thump(60, 30, 1.4, 1.0), np.zeros(SR)]), 1.0, 0.3), 0.9), 12.6)
d = t_(0.8); rise = np.sin(2 * np.pi * np.cumsum(220 + 440 * (d / 0.8) ** 2) / SR) * (d / 0.8) ** 2 * 0.12
place(rise + filt(noise(0.8), [2000, 8000], 'band') * (d / 0.8) ** 2 * 0.05, 13.55)
def chime(f, d=2.6, lvl=0.5):
    t = t_(d)
    s = sum(a * np.sin(2 * np.pi * f * m * t) * np.exp(-t / (d / (1 + i))) for i, (m, a) in enumerate([(1, 1), (2.01, .35), (3.03, .16), (4.2, .07)]))
    s *= np.minimum(1, t / 0.004)
    return norm(reverb(s, 1.2, 0.3), lvl)
place(chime(880), 14.35, 0.55)
place(chime(1318.5, 2.4), 14.95, 0.25)

out = mix[:int(SR * LEN)]
out[-int(SR * 1.2):] *= np.linspace(1, 0, int(SR * 1.2))
out = norm(np.tanh(out * 1.3), 0.9)
with wave.open('audio.wav', 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((out * 32767).astype(np.int16).tobytes())
print('ok')
