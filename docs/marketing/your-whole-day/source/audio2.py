"""Gucci-style 10 s: groovy 120 BPM from the first frame (funky bass, claps, open hats, warm keys), a cut on every beat, foley per shot, tape-stop at the end."""
import wave, numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
SR = 44100; LEN = 10.6
rng = np.random.default_rng(9)
mix = np.zeros(int(SR * (LEN + 2))); mus = np.zeros_like(mix)
def t_(d): return np.arange(int(SR * d)) / SR
def env(n, a, d): t = np.arange(n) / SR; return np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / d)
def f(x, fr, k): return sosfilt(butter(4, fr, btype=k, fs=SR, output='sos'), x)
def nz(d): return rng.standard_normal(int(SR * d))
def norm(x, p=1.0): return x / (np.max(np.abs(x)) or 1) * p
def put(buf, x, at, g=1.0): i = int(SR * at); buf[i:i + len(x)] += x[:max(0, len(buf) - i)] * g
def verb(x, size=.5, wet=.25):
    ir = f(nz(size), 5000, 'low') * np.exp(-t_(size) / (size / 5)); return x + norm(fftconvolve(x, ir)[:len(x)], np.max(np.abs(x)) * wet)
B = 0.5
def kick(): t = t_(.3); return np.sin(2*np.pi*np.cumsum(48 + 110*np.exp(-t*35))/SR) * env(len(t), .001, .1)
def clap():
    s = np.zeros(int(SR*.25))
    for o in (0, .011, .023): a = f(nz(.2), [900, 6500], 'band') * env(int(SR*.2), .001, .04); i = int(SR*o); s[i:i+len(a)] += a[:len(s)-i]
    return verb(s, .35, .3)
def hat(op=False): d = .18 if op else .035; return f(nz(d), 7500, 'high') * env(int(SR*d), .0005, .06 if op else .008)
def keys(fr, d):
    t = t_(d); s = sum(np.sin(2*np.pi*x*t + .9*np.sin(2*np.pi*x*t)*np.exp(-t*4)) for x in fr) * np.exp(-t*2.2)
    return f(s * np.minimum(1, t/.008) * (1 + .2*np.sin(2*np.pi*6*t)), 4000, 'low')
def bassn(fr, d): t = t_(d); return np.tanh(2.2*np.sin(2*np.pi*fr*t) + .6*np.sin(4*np.pi*fr*t)) * env(len(t), .003, d*.55)
CH = [[220.0, 261.6, 329.6, 392.0], [174.6, 220.0, 261.6, 329.6], [196.0, 246.9, 293.7, 349.2], [164.8, 207.7, 246.9, 293.7]]  # Am7 Fmaj7 G7 E7
BL = [[55, 0, 55, 82.4, 0, 98, 82.4, 0], [43.7, 0, 43.7, 65.4, 0, 87.3, 65.4, 0], [49, 0, 49, 73.4, 0, 98, 73.4, 0], [41.2, 0, 41.2, 61.7, 0, 82.4, 61.7, 0]]
END = 9.5
for i in range(int(END / B)):
    at = i * B; bar = (i // 4) % 4
    put(mus, kick(), at, 1.0 if i % 2 == 0 else .8)
    if i % 2 == 1: put(mus, clap(), at, .5)
    put(mus, hat(), at + B/2, .3); put(mus, hat(True), at + B*.75, .12) if i % 2 else None
    for k, n in enumerate(BL[bar]):
        if n and at + k*B/8 < END: put(mus, bassn(n, B/8*1.6), at + k*B/8, .32 if i % 4 == 0 else .26)
    if i % 4 == 0: put(mus, keys(CH[bar], B*4), at, .13)
    if i % 4 == 2: put(mus, keys(CH[bar], B*1.2), at + B*.5, .07)
# tape stop at 9.5: pitch the last half-second down and fade
seg = mus[int(SR*9.0):int(SR*9.5)].copy(); idx = np.cumsum(np.linspace(1, .05, int(SR*.6))); idx = idx[idx < len(seg)-1]
ts = np.interp(idx, np.arange(len(seg)), seg) * np.linspace(1, 0, len(idx))
mus[int(SR*9.5):] = 0; put(mus, ts, 9.5, 1.0)
# ---------- foley (one per cut) ----------
def tap(): return norm(f(nz(.04), [1500, 6000], 'band') * env(int(SR*.04), .0005, .01), .5)
def thud(): t = t_(.18); return norm(np.sin(2*np.pi*np.cumsum(60+40*np.exp(-t*30))/SR) * env(len(t), .002, .05) + f(nz(.18), 800, 'low') * env(len(t), .001, .03) * .5, .6)
def swoosh(d=.35, lo=300, hi=5000): return norm(f(nz(d), [lo, hi], 'band') * np.sin(np.pi*np.minimum(1, t_(d)/d))**2, .4)
def water(d=.5): return norm(f(nz(d), [600, 7000], 'band') * np.minimum(1, t_(d)/.04) * np.minimum(1, (d-t_(d))/.08), .3)
def beep(): t = t_(.1); return np.sin(2*np.pi*2700*t) * env(len(t), .002, .04) * .22
def pour(): d = .5; return norm(f(nz(d), [400, 3000], 'band') * (0.6 + 0.4*np.sin(2*np.pi*13*t_(d))) * np.minimum(1, t_(d)/.05), .25)
def shutter(): s = np.zeros(int(SR*.12)); a = f(nz(.02), 2000, 'high')*env(int(SR*.02), .0005, .004); s[:len(a)] += a; s[int(SR*.06):int(SR*.06)+len(a)] += a*.7; return norm(s, .45)
def engine(): t = t_(.6); return norm(np.tanh(3*np.sin(2*np.pi*np.cumsum(30+25*np.minimum(1, t/.3))/SR)) * f(nz(.6), 300, 'low') * env(len(t), .05, .3), .45)
def ice(): s = np.zeros(int(SR*.4)); [put_(s, f(nz(.02), 3000, 'high')*env(int(SR*.02), .0005, .006), rng.random()*.35) for _ in range(9)]; return norm(s, .35)
def put_(buf, x, at): i = int(SR*at); buf[i:i+len(x)] += x[:max(0, len(buf)-i)]
def card(): t = t_(.12); return np.sin(2*np.pi*1900*t) * env(len(t), .002, .05) * .2
def click(): return norm(f(nz(.015), 4000, 'high') * env(int(SR*.015), .0003, .003), .4)
def buzz(d=.3): t = t_(d); return norm(np.sign(np.sin(2*np.pi*170*t)) * f(nz(d), [120, 400], 'band') * np.minimum(1, (d-t)/.03), .3)
put(mix, buzz(.25), .02); put(mix, tap(), .2)                 # 1 alarm slap
put(mix, thud(), .62)                                        # 2 feet on the rug
put(mix, swoosh(.4, 200, 3000), 1.0)                         # 3 curtains
put(mix, tap(), 1.7)                                         # 4 thumb on the phone
put(mix, water(.55), 2.05); put(mix, water(.45), 2.5)        # 5 sink
put(mix, beep(), 3.15); put(mix, beep(), 3.27)               # 7 scale
put(mix, pour(), 3.5)                                        # 8 coffee pour
put(mix, shutter(), 4.25)                                    # 9 photo
put(mix, swoosh(.5, 800, 9000), 4.45)                        # 10 door + light burst
put(mix, click(), 5.05); put(mix, engine(), 5.1)             # 11 engine
put(mix, swoosh(.9, 150, 2500), 5.5)                         # 12 car passing
put(mix, ice(), 6.55)                                        # 13 iced coffee
for k in range(3): put(mix, thud() * .5, 7.0 + k*.17)        # 15 footsteps on marble
put(mix, card(), 7.6)                                        # 16 card reader
for k in range(3): put(mix, click(), 8.0 + k*.25)            # 17 desk rush
put(mix, buzz(.5), 8.8)
out = (mix + mus)[:int(SR*LEN)]
out = norm(np.tanh(out*1.6), .92)
with wave.open('audio2.wav', 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((out*32767).astype(np.int16).tobytes())
print('ok')
