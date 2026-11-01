"""Adro "the sound of your day" teaser track, made entirely in code (no samples, no AI).
120 BPM, 15 s: 8 gym sounds one per beat, a beat that builds and speeds up, hard silence, one deep heartbeat.
Writes track.wav and hits.json (time + label of every hit, for the picture cuts)."""
import json
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

SR = 44100
LEN = 15.0
rng = np.random.default_rng(7)
mix = np.zeros(int(SR * LEN) + SR)
hits = []


def t_(d):
    return np.arange(int(SR * d)) / SR


def band(x, lo, hi):
    sos = butter(4, [lo, hi], btype='band', fs=SR, output='sos')
    return sosfilt(sos, x)


def lp(x, f):
    return sosfilt(butter(4, f, btype='low', fs=SR, output='sos'), x)


def hp(x, f):
    return sosfilt(butter(4, f, btype='high', fs=SR, output='sos'), x)


def env(n, a=0.002, d=0.2):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / d)
    return e


def noise(d):
    return rng.standard_normal(int(SR * d))


def norm(x, peak=1.0):
    m = np.max(np.abs(x)) or 1
    return x / m * peak


def room(x, size=0.25, wet=0.18):
    ir = noise(size) * np.exp(-t_(size) / (size / 4))
    ir = lp(ir, 5000)
    y = fftconvolve(x, ir)[: len(x)]
    return x + norm(y, np.max(np.abs(x)) * wet)


# ---- sounds ----
def beep():
    out = np.zeros(int(SR * 0.32))
    for k in (0, 0.16):
        tt = t_(0.09)
        s = np.sign(np.sin(2 * np.pi * 1180 * tt)) * 0.5 + np.sin(2 * np.pi * 2360 * tt) * 0.2
        s *= env(len(tt), 0.003, 0.05)
        i = int(SR * k)
        out[i:i + len(s)] += s
    return norm(lp(out, 6000), 0.55)


def zipper():
    d = 0.32
    tt = t_(d)
    n = band(noise(d), 1800, 7000)
    teeth = (np.sin(2 * np.pi * (70 + 120 * tt / d) * tt) > 0.3).astype(float)
    e = np.minimum(1, tt / 0.02) * np.minimum(1, (d - tt) / 0.04)
    return norm(n * (0.35 + 0.65 * teeth) * e, 0.6)


def shaker():
    out = np.zeros(int(SR * 0.3))
    for k, a in ((0, 1), (0.13, 0.8)):
        s = hp(noise(0.08), 3500) * env(int(SR * 0.08), 0.004, 0.025) * a
        i = int(SR * k)
        out[i:i + len(s)] += s
    return norm(out, 0.5)


def door():
    tt = t_(0.5)
    body = np.sin(2 * np.pi * (70 * np.exp(-tt * 3)) * tt) * env(len(tt), 0.002, 0.18)
    knock = lp(noise(0.5), 400) * env(len(tt), 0.001, 0.05)
    return norm(room(body + knock * 0.6, 0.35, 0.3), 0.9)


def chalk():
    out = np.zeros(int(SR * 0.25))
    for k, a in ((0, 1), (0.045, 0.45)):
        s = band(noise(0.06), 900, 5200) * env(int(SR * 0.06), 0.0008, 0.012) * a
        i = int(SR * k)
        out[i:i + len(s)] += s
    dust = hp(noise(0.25), 5000) * env(int(SR * 0.25), 0.01, 0.08) * 0.12
    return norm(room(out + dust, 0.2, 0.2), 0.8)


def clank(scale=1.0):
    d = 0.9
    tt = t_(d)
    parts = [(523, 1, 0.45), (1243, 0.7, 0.3), (2317, 0.5, 0.2), (3781, 0.35, 0.12), (5210, 0.2, 0.08)]
    s = sum(a * np.sin(2 * np.pi * f * scale * tt + rng.random()) * np.exp(-tt / dc) for f, a, dc in parts)
    hit = band(noise(d), 1500, 8000) * env(len(tt), 0.0005, 0.01) * 0.8
    return norm(room(s + hit, 0.3, 0.22), 0.75)


def breath():
    d = 0.42
    tt = t_(d)
    n = band(noise(d), 350, 2400)
    e = np.sin(np.pi * np.minimum(1, tt / d)) ** 1.5
    return norm(n * e, 0.45)


def kick(f0=150, f1=45, d=0.32, level=1.0):
    tt = t_(d)
    freq = f1 + (f0 - f1) * np.exp(-tt * 28)
    ph = 2 * np.pi * np.cumsum(freq) / SR
    s = np.sin(ph) * env(len(tt), 0.001, d / 2.6)
    click = hp(noise(0.01), 2000) * env(int(SR * 0.01), 0.0003, 0.002) * 0.3
    s[: len(click)] += click
    return norm(s, level)


def boom():
    s = kick(130, 38, 0.9, 1.0)
    impact = lp(noise(0.9), 900) * env(int(SR * 0.9), 0.001, 0.12) * 0.6
    metal = np.pad(clank(0.7), (0, 0))[: len(s)] * 0.35
    out = s + impact
    out[: len(metal)] += metal
    return norm(room(out, 0.5, 0.25), 1.0)


def snare_clap():
    s = band(noise(0.2), 800, 6000) * env(int(SR * 0.2), 0.001, 0.05)
    return norm(room(s, 0.25, 0.3), 0.55)


def hat():
    return norm(hp(noise(0.05), 7000) * env(int(SR * 0.05), 0.0005, 0.012), 0.25)


def riser(d):
    tt = t_(d)
    n = noise(d)
    out = np.zeros_like(n)
    # Sweep a band upward in chunks.
    chunks = 40
    L = len(n) // chunks
    for c in range(chunks):
        lo = 300 + 5000 * (c / chunks) ** 2
        seg = band(n[c * L:(c + 1) * L + 2048], lo, min(lo * 2.2, 16000))[:L]
        out[c * L:c * L + len(seg)] = seg
    tone = np.sin(2 * np.pi * np.cumsum(200 + 900 * (tt / d) ** 2) / SR) * 0.25
    e = (tt / d) ** 2.2
    return norm((out + tone) * e, 0.55)


def heart():
    out = np.zeros(int(SR * 1.6))
    a = kick(70, 32, 0.6, 1.0)
    b = kick(62, 30, 0.7, 0.75)
    out[: len(a)] += a
    i = int(SR * 0.22)
    out[i:i + len(b)] += b
    sub = np.sin(2 * np.pi * 36 * t_(1.6)) * env(int(SR * 1.6), 0.01, 0.6) * 0.5
    return norm(room(out + sub, 0.8, 0.3), 1.0)


def place(sound, at, gain=1.0, label=None):
    i = int(SR * at)
    mix[i:i + len(sound)] += sound[: max(0, len(mix) - i)] * gain
    if label:
        hits.append({'t': round(at, 3), 'label': label})


B = 0.5  # one beat at 120 BPM
SOUNDS = [('alarm', beep), ('zip', zipper), ('shake', shaker), ('door', door), ('chalk', chalk), ('plate', clank), ('breath', breath), ('drop', boom)]

# 1) Intro: one sound per beat, nothing else (0–4 s).
for k, (name, fn) in enumerate(SOUNDS):
    place(fn(), k * B, 1.0, name)

# 2) Groove (4–8 s): kick on every beat, the gym sounds become the drum kit.
for k in range(8):
    at = 4 + k * B
    place(kick(), at, 0.9)
    place(hat(), at + B / 2, 1.0)
    if k % 2 == 1:
        place(chalk(), at, 0.9, 'chalk')
    else:
        place(clank(), at + B / 2, 0.5, 'plate')
    if k in (3, 7):
        place(shaker(), at + B * 0.75, 0.8, 'shake')

# 3) Build (8–12 s): twice as busy, riser, breath on the off-beats, sounds faster and faster.
place(riser(4.0), 8.0, 0.9)
order = ['chalk', 'plate', 'shake', 'zip', 'breath', 'door', 'alarm']
fns = dict(SOUNDS)
k = 0
t = 8.0
while t < 12 - 1e-6:
    sub = B / 2 if t < 10 else B / 4
    place(kick(), t, 0.85 if (t - 8) % B < 1e-6 else 0.55)
    if t >= 10:
        place(hat(), t + sub / 2, 0.9)
    name = order[k % len(order)]
    place(fns[name](), t, 0.6, name)
    k += 1
    t = round(t + sub, 4)
place(snare_clap(), 11.5, 0.8)
place(snare_clap(), 11.75, 0.9)

# 4) Hard silence 12–13 s, then one deep heartbeat with the logo.
cut = int(SR * 12.0)
mix[cut:cut + int(SR * 1.0)] = 0
place(heart(), 13.0, 1.0, 'heart')
hits.append({'t': 13.0, 'label': 'logo'})

out = mix[: int(SR * LEN)]
# Fade the very end, soft limiter, normalize.
out[-int(SR * 0.3):] *= np.linspace(1, 0, int(SR * 0.3))
out = np.tanh(out * 1.4) / np.tanh(1.4)
out = norm(out, 0.92)
pcm = (out * 32767).astype(np.int16)
import wave
with wave.open('track.wav', 'wb') as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
json.dump(sorted(hits, key=lambda h: h['t']), open('hits.json', 'w'))
print('ok', len(hits), 'hits', round(len(out) / SR, 2), 's')
