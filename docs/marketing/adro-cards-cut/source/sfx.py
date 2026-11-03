import wave, numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
SR = 44100; LEN = 7.384
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
def chime(fr, d=2.6, lvl=.5):
    tt = t_(d); s = sum(a*np.sin(2*np.pi*fr*m*tt)*np.exp(-tt/(d/(1+i))) for i, (m, a) in enumerate([(1, 1), (2.01, .35), (3.03, .16), (4.2, .07)]))
    return norm(verb(s*np.minimum(1, tt/.004), 1.2, .3), lvl)
def click(l=.4): return norm(f(nz(.018), [2500, 9000], 'band') * env(int(SR*.018), .0003, .004), l)
def pop(l=.35): t = t_(.09); return norm(np.sin(2*np.pi*np.cumsum(900 - 500*t/.09)/SR) * env(len(t), .001, .03), l)
def whoosh(d=.5, l=.4): return norm(f(nz(d), [600, 8000], 'band') * np.sin(np.pi*np.minimum(1, t_(d)/d))**2, l)

o=fx
def tick(l=.25): return norm(f(nz(.012),[3000,10000],'band')*env(int(SR*.012),.0002,.003),l)
# blue swipe at the start
put(o, whoosh(.6,.5), 0.0)
# Every rep counts: words land, middle word swaps on the beat
for k,a in enumerate([0.80,0.87,0.94]): put(o, click(.22), a)
put(o, pop(.28), 1.30); put(o, tick(.25), 1.31)
put(o, pop(.28), 1.80); put(o, tick(.25), 1.81)
put(o, whoosh(.3,.22), 2.15)                      # line leaves
for k in range(5): put(o, click(.2), 2.32+k*.07)  # What if it all connected?
put(o, whoosh(.35,.2), 3.05)
# logo: soft hit as the dark scene opens, chime when the ring draws
put(o, verb(np.concatenate([kick()*.9, np.zeros(SR)]),1.0,.35), 3.35)
put(o, chime(880,2.2,.45), 3.62)
# Always with you. drops out of the logo: a quick run of soft ticks + a small shimmer
for k in range(16): put(o, tick(.09+.01*k), 4.13+ k*.012 + .05)
put(o, chime(1760,1.2,.12), 4.15)
# zoom-blur push, then the ring alone
put(o, whoosh(.6,.4), 4.70)
put(o, verb(np.concatenate([kick(), np.zeros(SR)]),1.2,.4), 5.35); put(o, chime(1318.5,2.0,.32), 5.40)
for a in [5.75,6.10,6.50]: put(o, click(.16), a)
out=o[:int(SR*LEN)]; out[-int(SR*.6):]*=np.linspace(1,0,int(SR*.6))
out=norm(np.tanh(out*1.2),.85)
with wave.open('sfx.wav','wb') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((out*32767).astype(np.int16).tobytes())
print('ok')
