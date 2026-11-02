"""Score for the library cut: sunrise pad -> groove drops on the alarm (120 BPM) -> darker, heavier gym groove at 11 s ->
filtered night -> silence -> accelerating ticks on the circle chain -> riser into the dot -> hit + chime on the ring. Foley on cuts."""
import json, wave, numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
SR = 44100; cuts = json.load(open('cuts.json')); LEN = cuts[-1]['t'] + cuts[-1]['dur'] + 0.2
rng = np.random.default_rng(21)
N = int(SR * (LEN + 3)); mus = np.zeros(N); fol = np.zeros(N)
def t_(d): return np.arange(int(SR * d)) / SR
def env(n, a, d): t = np.arange(n) / SR; return np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / d)
def f(x, fr, k): return sosfilt(butter(4, fr, btype=k, fs=SR, output='sos'), x)
def nz(d): return rng.standard_normal(int(SR * d))
def norm(x, p=1.0): return x / (np.max(np.abs(x)) or 1) * p
def put(buf, x, at, g=1.0):
    i = int(SR * at)
    if i < len(buf): buf[i:i + len(x)] += x[:len(buf) - i] * g
def verb(x, size=.6, wet=.3):
    ir = f(nz(size), 5000, 'low') * np.exp(-t_(size) / (size / 5)); return x + norm(fftconvolve(x, ir)[:len(x)], np.max(np.abs(x)) * wet)
T = {c['tag']: c['t'] for c in cuts}
B = 0.5; DROP = T['alarm']; GYM = T['city']; NIGHT = T['coach']; SIL = T['silence']; CH0 = SIL + 0.5; DOT = T['dot']; LOGO = T['logo']
def kick(h=False): t = t_(.35); return np.sin(2*np.pi*np.cumsum((42 if h else 48) + 120*np.exp(-t*32))/SR) * env(len(t), .001, .14 if h else .1)
def clap():
    s = np.zeros(int(SR*.3))
    for o in (0, .011, .024): a = f(nz(.2), [900, 6500], 'band') * env(int(SR*.2), .001, .045); i = int(SR*o); s[i:i+len(a)] += a[:len(s)-i]
    return verb(s, .4, .3)
def hat(op=False): d = .18 if op else .035; return f(nz(d), 7500, 'high') * env(int(SR*d), .0005, .06 if op else .008)
def keys(fr, d):
    t = t_(d); s = sum(np.sin(2*np.pi*x*t + .9*np.sin(2*np.pi*x*t)*np.exp(-t*4)) for x in fr) * np.exp(-t*2.0)
    return f(s * np.minimum(1, t/.008) * (1 + .2*np.sin(2*np.pi*6*t)), 4200, 'low')
def pad(fr, d):
    t = t_(d); s = sum(np.sin(2*np.pi*x*t*(1 + .002*k)) for k, x in enumerate(fr))
    return f(s * np.minimum(1, t/1.0) * np.minimum(1, (d - t)/.4), 2200, 'low')
def bassn(fr, d, dist=2.2): t = t_(d); return np.tanh(dist*np.sin(2*np.pi*fr*t) + .6*np.sin(4*np.pi*fr*t)) * env(len(t), .003, d*.55)
# 0 - DROP: sunrise pad + riser
put(mus, norm(pad([110, 164.8, 220, 329.6], DROP + .2), .22), 0)
d = t_(DROP); put(mus, norm(f(nz(DROP), [500, 8000], 'band') * (d / DROP) ** 3, .2), 0)
# day groove (Am7 Fmaj7 G7 E7), funky bass
CH = [[220.0, 261.6, 329.6, 392.0], [174.6, 220.0, 261.6, 329.6], [196.0, 246.9, 293.7, 349.2], [164.8, 207.7, 246.9, 293.7]]
BL = [[55, 0, 55, 82.4, 0, 98, 82.4, 0], [43.7, 0, 43.7, 65.4, 0, 87.3, 65.4, 0], [49, 0, 49, 73.4, 0, 98, 73.4, 0], [41.2, 0, 41.2, 61.7, 0, 82.4, 61.7, 0]]
def groove(a, z, heavy=False):
    i = 0
    while a + i * B < z - 1e-6:
        at = a + i * B; bar = (i // 4) % 4
        put(mus, kick(heavy), at, 1.0 if i % 2 == 0 else .85)
        if i % 2 == 1: put(mus, clap(), at, .55 if heavy else .48)
        put(mus, hat(), at + B/2, .3); put(mus, hat(), at + B*.75, .12)
        if i % 2: put(mus, hat(True), at + B*.5, .1)
        for k, n in enumerate(BL[bar]):
            if n and at + k*B/8 < z: put(mus, bassn(n * (0.94 if heavy else 1), B/8*1.6, 3.5 if heavy else 2.2), at + k*B/8, .34 if heavy else .28)
        if i % 4 == 0: put(mus, keys([x * (0.94 if heavy else 1) for x in CH[bar]], B*4), at, .1 if heavy else .13)
        if heavy and i % 8 == 7:  # snare roll fill
            for r in range(4): put(mus, clap(), at + r * B / 4, .25 + .08 * r)
        i += 1
groove(DROP, GYM)
put(mus, norm(f(nz(1.0), [300, 9000], 'band') * (t_(1.0)) ** 2, .3), GYM - 1.0)  # riser into the gym
groove(GYM, NIGHT, heavy=True)
# night: filtered, half-time, fading
night = np.zeros(int(SR * (SIL - NIGHT + .5)))
for i in range(int((SIL - NIGHT) / B)):
    put(night, kick() * .7, i * B * 2) if i * B * 2 < SIL - NIGHT else None
put(night, norm(pad([110, 130.8, 164.8, 196], SIL - NIGHT), .3), 0)
night = f(night, 900, 'low') * np.linspace(1, 0, len(night)) ** 1.5
put(mus, night, NIGHT)
mus[int(SR * SIL):int(SR * CH0)] = 0   # total silence
# circle chain: a tick on every flash, rising
ct = [c for c in cuts if c['tag'] == 'circle']
for k, c in enumerate(ct):
    tt = t_(.07); put(mus, np.sin(2*np.pi*(900 + 180*k)*tt) * env(len(tt), .001, .03) * .35, c['t'])
    put(mus, kick() * (.4 + .07 * k), c['t'])
d = LOGO - DOT; tt = t_(d); put(mus, norm(f(nz(d), [600, 12000], 'band') * (tt / d) ** 2.5 + np.sin(2*np.pi*np.cumsum(200 + 1400*(tt/d)**2)/SR) * (tt/d)**2 * .3, .35), DOT)
# the ring: big hit + chime, then a warm tail
hit = kick(True) * 1.2; put(mus, verb(np.concatenate([hit, np.zeros(SR)]), 1.2, .4), LOGO)
def chime(fr, d=3.0, lvl=.5):
    tt = t_(d); s = sum(a * np.sin(2*np.pi*fr*m*tt) * np.exp(-tt/(d/(1+i))) for i, (m, a) in enumerate([(1, 1), (2.01, .35), (3.03, .16), (4.2, .07)]))
    return norm(verb(s * np.minimum(1, tt/.004), 1.2, .3), lvl)
put(mus, chime(880), LOGO + .05, .55); put(mus, chime(1318.5, 2.6), LOGO + 1.25, .28)
put(mus, norm(pad([110, 164.8, 220, 277.2], LEN - LOGO), .16), LOGO)
# ---------- foley on cuts ----------
def tap(): return norm(f(nz(.04), [1500, 6000], 'band') * env(int(SR*.04), .0005, .01), .5)
def thud(): tt = t_(.18); return norm(np.sin(2*np.pi*np.cumsum(60+40*np.exp(-tt*30))/SR) * env(len(tt), .002, .05) + f(nz(.18), 800, 'low') * env(len(tt), .001, .03) * .5, .55)
def swoosh(d=.35, lo=300, hi=5000, l=.4): return norm(f(nz(d), [lo, hi], 'band') * np.sin(np.pi*np.minimum(1, t_(d)/d))**2, l)
def water(d=.5): return norm(f(nz(d), [600, 7000], 'band') * np.minimum(1, t_(d)/.04) * np.minimum(1, (d-t_(d))/.08), .28)
def beep(): tt = t_(.1); return np.sin(2*np.pi*2700*tt) * env(len(tt), .002, .04) * .2
def clank(): tt = t_(.7); s = sum(a*np.sin(2*np.pi*fr*tt)*np.exp(-tt/dc) for fr, a, dc in [(523, 1, .3), (1243, .7, .2), (2317, .5, .12)]); return norm(verb(s, .3, .2), .35)
def chalk(): return norm(verb(f(nz(.3), [900, 6000], 'band') * env(int(SR*.3), .001, .06), .4, .4), .45)
def shutter(): s = np.zeros(int(SR*.12)); a = f(nz(.02), 2000, 'high')*env(int(SR*.02), .0005, .004); s[:len(a)] += a; s[int(SR*.06):int(SR*.06)+len(a)] += a*.7; return norm(s, .45)
def buzz(d=.3): tt = t_(d); return norm(np.sign(np.sin(2*np.pi*170*tt)) * f(nz(d), [120, 400], 'band') * np.minimum(1, (d-tt)/.03), .3)
def breath(): d = .45; return norm(f(nz(d), [350, 2400], 'band') * np.sin(np.pi*np.minimum(1, t_(d)/d))**1.5, .3)
FX = {'alarm': [(buzz, 0), (tap, .3)], 'feet': [(thud, .1)], 'curtain': [(lambda: swoosh(.45, 200, 3000), 0)], 'home': [(tap, .2)],
      'sink': [(water, 0)], 'tap': [(water, 0)], 'towel': [(lambda: swoosh(.3), .1)], 'scale': [(beep, .12), (beep, .24)],
      'food': [(shutter, .25)], 'door': [(lambda: swoosh(.5, 800, 9000, .45), 0)], 'engine': [(tap, .02), (lambda: swoosh(.6, 60, 400, .5), .05)],
      'car': [(lambda: swoosh(.9, 150, 2500), 0)], 'ice': [(lambda: swoosh(.2, 3000, 9000, .25), .05)], 'lobby': [(thud, .05), (thud, .25)],
      'card': [(beep, .15)], 'desk': [(tap, .02)], 'city': [(lambda: swoosh(.8, 200, 6000, .4), 0)], 'chalk': [(chalk, 0)], 'grip': [(clank, .1)],
      'back': [(breath, 0)], 'squat': [(clank, .55)], 'plate': [(clank, 0)], 'line': [(tap, .2)], 'dead': [(clank, .2)], 'clap': [(chalk, 0)],
      'sweat': [(breath, 0)], 'watch': [(beep, .1)], 'rope': [(lambda: swoosh(.25, 1500, 8000, .3), .1), (lambda: swoosh(.25, 1500, 8000, .3), .45)],
      'jump': [(thud, .15)], 'coach': [(tap, .3)], 'night': [(tap, .4)]}
for c in cuts:
    for fn, off in FX.get(c['tag'], []): put(fol, fn(), c['t'] + off)
out = (mus + fol)[:int(SR * LEN)]
out[-int(SR * .8):] *= np.linspace(1, 0, int(SR * .8))
out = norm(np.tanh(out * 1.5), .92)
with wave.open('score.wav', 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((out * 32767).astype(np.int16).tobytes())
print('ok', round(LEN, 2))
