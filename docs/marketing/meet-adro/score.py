"""Meet adro: clean tech beat (120 BPM), UI clicks on every card, whooshes on the phone and the blue swipe,
a pause before 'And when to rest.', a hit + chime on the ring, soft outro."""
import wave, numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
SR = 44100; LEN = 16.6
rng = np.random.default_rng(12); N = int(SR * (LEN + 3)); mus = np.zeros(N); fx = np.zeros(N)
def t_(d): return np.arange(int(SR * d)) / SR
def env(n, a, d): t = np.arange(n) / SR; return np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / d)
def f(x, fr, k): return sosfilt(butter(4, fr, btype=k, fs=SR, output='sos'), x)
def nz(d): return rng.standard_normal(int(SR * d))
def norm(x, p=1.0): return x / (np.max(np.abs(x)) or 1) * p
def put(b, x, at, g=1.0):
    i = int(SR * at)
    if i < len(b): b[i:i + len(x)] += x[:len(b) - i] * g
def verb(x, s=.6, w=.3): ir = f(nz(s), 5000, 'low') * np.exp(-t_(s) / (s / 5)); return x + norm(fftconvolve(x, ir)[:len(x)], np.max(np.abs(x)) * w)
def kick(): t = t_(.3); return np.sin(2*np.pi*np.cumsum(46 + 110*np.exp(-t*34))/SR) * env(len(t), .001, .1)
def snap(): return verb(f(nz(.15), [1500, 7000], 'band') * env(int(SR*.15), .001, .03), .35, .35)
def hat(): return f(nz(.03), 8000, 'high') * env(int(SR*.03), .0005, .007)
def pluck(fr, d=.4): t = t_(d); return (np.sin(2*np.pi*fr*t) + .3*np.sin(4*np.pi*fr*t)) * env(len(t), .002, .12)
def pad(fr, d): t = t_(d); s = sum(np.sin(2*np.pi*x*t*(1+.0015*k)) for k, x in enumerate(fr)); return f(s * np.minimum(1, t/.6) * np.minimum(1, (d-t)/.5), 2500, 'low')
def sub(fr, d): t = t_(d); return np.sin(2*np.pi*fr*t) * env(len(t), .005, d*.6)
B = .5
# intro (0-3.6): pad + soft pulse
put(mus, norm(pad([146.8, 220, 293.7, 349.2], 3.8), .2), 0)
for i in range(7): put(mus, kick() * .35, .25 + i * B)
# groove 3.6 - 9.0
ARP = [587.3, 698.5, 880, 698.5, 587.3, 880, 1046.5, 880]
i = 0; t0 = 3.5
while t0 + i * B < 9.0:
    at = t0 + i * B
    put(mus, kick(), at, 1.0); put(mus, hat(), at + B/2, .35); put(mus, hat(), at + B*.25, .12); put(mus, hat(), at + B*.75, .12)
    if i % 2: put(mus, snap(), at, .45)
    for k in range(2): put(mus, pluck(ARP[(i*2+k) % 8]), at + k * B/2, .11)
    if i % 4 == 0: put(mus, sub(73.4 if (i//4) % 2 == 0 else 65.4, B*4), at, .45)
    i += 1
# swipe 9.0: riser + drop into the blue
d = t_(1.0); put(mus, norm(f(nz(1.0), [500, 10000], 'band') * (d/1.0)**3, .35), 8.0)
# blue section 9.5-11.9: bigger kick, lines on the beat
for k, at in enumerate([9.5, 10.0, 10.5, 11.0, 11.5]):
    put(mus, kick(), at, 1.1); put(mus, snap(), at + .25, .3); put(mus, hat(), at + .125, .2); put(mus, hat(), at + .375, .2)
put(mus, norm(pad([146.8, 185, 220, 293.7], 2.5), .16), 9.5)
mus[int(SR*11.85):int(SR*12.5)] *= 0.12   # near-silence on 'And when to rest.'
put(mus, norm(pad([110, 164.8, 220], .7), .14), 11.9)
# logo: hit at 12.55 (Meet), chime when the ring draws (12.85), zoom whoosh 13.95, final chime 14.6
def chime(fr, d=2.6, lvl=.5):
    tt = t_(d); s = sum(a*np.sin(2*np.pi*fr*m*tt)*np.exp(-tt/(d/(1+i))) for i, (m, a) in enumerate([(1, 1), (2.01, .35), (3.03, .16), (4.2, .07)]))
    return norm(verb(s*np.minimum(1, tt/.004), 1.2, .3), lvl)
put(mus, verb(np.concatenate([kick()*1.2, np.zeros(SR)]), 1.0, .35), 12.55)
put(mus, chime(880), 12.9, .45)
put(mus, norm(f(nz(.6), [800, 9000], 'band') * np.sin(np.pi*np.minimum(1, t_(.6)/.6))**2, .4), 13.9)
put(mus, chime(1318.5, 2.4), 14.6, .35); put(mus, verb(np.concatenate([kick(), np.zeros(SR)]), 1.2, .4), 14.55)
put(mus, norm(pad([146.8, 220, 277.2, 370], 2.1), .17), 14.55)
# UI foley
def click(l=.4): return norm(f(nz(.018), [2500, 9000], 'band') * env(int(SR*.018), .0003, .004), l)
def pop(l=.35): t = t_(.09); return norm(np.sin(2*np.pi*np.cumsum(900 - 500*t/.09)/SR) * env(len(t), .001, .03), l)
def whoosh(d=.5, l=.4): return norm(f(nz(d), [600, 8000], 'band') * np.sin(np.pi*np.minimum(1, t_(d)/d))**2, l)
for a in [.25 + i*.11 for i in range(4)] + [2.3 + i*.11 for i in range(5)]: put(fx, click(.18), a)   # words
put(fx, whoosh(.35, .25), 2.05)
for a in [3.6, 3.8, 4.0, 4.2, 4.4]: put(fx, pop(), a); put(fx, click(.3), a + .01)
put(fx, whoosh(.6, .45), 5.0)
for a in [6.2, 6.9, 7.6, 8.3]: put(fx, pop(.3), a)
put(fx, click(.35), 6.45); put(fx, click(.35), 7.12); [put(fx, click(.22), 7.75 + k*.071) for k in range(7)]; put(fx, click(.3), 8.55)
put(fx, whoosh(.7, .5), 8.95)
out = (mus + fx)[:int(SR*LEN)]; out[-int(SR*.7):] *= np.linspace(1, 0, int(SR*.7))
out = norm(np.tanh(out*1.4), .92)
with wave.open('score.wav', 'wb') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((out*32767).astype(np.int16).tobytes())
print('ok')
