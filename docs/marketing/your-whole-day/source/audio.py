"""Sound for 'Your whole day' (first 5.3 s): room tone + phone buzz, then a warm 100 BPM beat
kicks in when the bathroom door opens; foley on every shot."""
import wave, numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
SR = 44100; LEN = 6.2
rng = np.random.default_rng(5)
mix = np.zeros(int(SR * LEN) + SR * 2); mus = np.zeros_like(mix)
def t_(d): return np.arange(int(SR * d)) / SR
def env(n, a, d): t = np.arange(n) / SR; return np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / d)
def f(x, fr, k): return sosfilt(butter(4, fr, btype=k, fs=SR, output='sos'), x)
def nz(d): return rng.standard_normal(int(SR * d))
def norm(x, p=1.0): return x / (np.max(np.abs(x)) or 1) * p
def put(buf, x, at, g=1.0): i = int(SR * at); buf[i:i + len(x)] += x[:max(0, len(buf) - i)] * g
def verb(x, size=0.6, wet=0.25):
    ir = f(nz(size), 5000, 'low') * np.exp(-t_(size) / (size / 5))
    return x + norm(fftconvolve(x, ir)[:len(x)], np.max(np.abs(x)) * wet)
# ---------- music: 100 BPM, starts at 1.4 s ----------
BPM = 100; B = 60 / BPM; T0 = 1.4
def kick():
    t = t_(0.35); fr = 45 + 90 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(fr) / SR) * env(len(t), 0.001, 0.12)
def snap():
    s = f(nz(0.18), [1200, 7000], 'band') * env(int(SR * .18), .001, .035)
    return verb(s, .4, .35)
def hat(o=False): return f(nz(.12 if o else .04), 7000, 'high') * env(int(SR * (.12 if o else .04)), .0005, .04 if o else .01)
def rhodes(freqs, d):
    t = t_(d); s = np.zeros_like(t)
    for fr in freqs:
        s += (np.sin(2*np.pi*fr*t + 1.2*np.sin(2*np.pi*fr*t)*np.exp(-t*3)) * 0.6 + np.sin(2*np.pi*2*fr*t) * .12) * np.exp(-t * 1.6)
    s *= 1 + .25 * np.sin(2 * np.pi * 5 * t)  # tremolo
    return f(s * np.minimum(1, t / .01), 3500, 'low')
def bass(fr, d):
    t = t_(d); return np.tanh(np.sin(2*np.pi*fr*t) * 2) * env(len(t), .005, d * .7)
# Dm9 -> G13 -> Cmaj9 -> A7(b9) (warm, a bit cinematic)
CH = [[146.8, 174.6, 220.0, 261.6, 329.6], [196.0, 246.9, 293.7, 349.2, 329.6], [130.8, 164.8, 196.0, 246.9, 293.7], [110.0, 138.6, 196.0, 233.1, 277.2]]
BS = [73.4, 98.0, 65.4, 55.0]
nb = int((LEN - T0) / B) + 2
for i in range(nb):
    at = T0 + i * B
    put(mus, kick(), at, .95 if i % 2 == 0 else .75)
    if i % 2 == 1: put(mus, snap(), at, .45)
    put(mus, hat(), at + B / 2, .22); put(mus, hat(), at + B * .75, .12)
    if i % 2 == 0:
        c = (i // 2) % 4
        put(mus, rhodes(CH[c], B * 2), at, .16)
        put(mus, bass(BS[c], B * 1.6), at, .30)
# riser into the beat (door)
d = t_(0.9); r = f(nz(.9), [800, 9000], 'band') * (d / .9) ** 3
put(mus, norm(r, .25), T0 - .9)
# ---------- foley ----------
def buzz(d=.35):
    t = t_(d); return np.sign(np.sin(2*np.pi*170*t)) * .3 * f(nz(d), [120, 400], 'band') * np.minimum(1, t/.02) * np.minimum(1, (d-t)/.03)
put(mix, norm(buzz(), .35), .25); put(mix, norm(buzz(), .3), .7)
put(mix, norm(f(nz(1.5), 400, 'low') * .5, .05), 0)  # room tone
put(mix, norm(f(nz(.05), 3000, 'high') * env(int(SR*.05), .001, .01), .2), 1.05)  # screen tap
for k, at in enumerate([1.45, 1.7]):  # bare footsteps
    put(mix, norm(f(nz(.08), [100, 900], 'band') * env(int(SR*.08), .002, .025), .28), at)
t = t_(.35); creak = np.sin(2*np.pi*(260 + 60*np.sin(2*np.pi*3*t))*t) * f(nz(.35), [200, 2000], 'band') * env(len(t), .05, .15)
put(mix, norm(creak, .12), 1.75)
put(mix, norm(f(nz(1.0), [600, 6000], 'band') * np.minimum(1, t_(1.0)/.08) * np.minimum(1, (1.0 - t_(1.0))/.15), .22), 2.05)  # water pour
put(mix, norm(verb(f(nz(.4), [400, 7000], 'band') * env(int(SR*.4), .003, .08), .3, .3), .38), 3.05)  # splash on the lens
put(mix, norm(f(nz(.3), [300, 4000], 'band') * np.sin(np.pi*np.minimum(1, t_(.3)/.3)), .25), 3.3)  # towel swoosh
t = t_(.12); put(mix, np.sin(2*np.pi*2600*t) * env(len(t), .002, .05) * .18, 4.0)  # scale beep
put(mix, np.sin(2*np.pi*2600*t) * env(len(t), .002, .05) * .18, 4.14)
put(mix, norm(f(nz(.25), [1500, 9000], 'band') * np.sin(np.pi*np.minimum(1, t_(.25)/.25)) ** 2, .2), 4.3)  # whip whoosh
put(mix, norm(f(nz(1.0), 3000, 'high') * (0.5 + 0.5 * (rng.random(int(SR*1.0)) > .97)), .05), 4.4)  # sizzle
sh = np.zeros(int(SR*.12)); a = f(nz(.02), 2000, 'high') * env(int(SR*.02), .0005, .004); sh[:len(a)] += a; sh[int(SR*.06):int(SR*.06)+len(a)] += a * .7
put(mix, norm(sh, .35), 5.0)  # camera shutter
out = (mix + mus)[:int(SR * LEN)]
out[-int(SR * .6):] *= np.linspace(1, 0, int(SR * .6))
out = norm(np.tanh(out * 1.5), .9)
with wave.open('audio.wav', 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((out * 32767).astype(np.int16).tobytes())
print('ok')
