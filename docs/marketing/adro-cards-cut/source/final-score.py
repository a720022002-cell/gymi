import wave, numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
SR = 44100; LEN = 24.45
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

CUTS=[1.3,2.3,2.9,3.91,4.51,5.11,5.71,6.31,7.31,8.03,8.63,9.23,9.83,10.43,11.43,12.03,12.63,13.23,13.84,14.44,15.04,15.64,16.24]
BLUE=[2.9,6.31,10.43]
def tick(l=.25): return norm(f(nz(.012),[3000,10000],'band')*env(int(SR*.012),.0002,.003),l)
def clank(l=.5):
    tt=t_(.8); s=sum(np.sin(2*np.pi*fr*tt)*np.exp(-tt*k) for fr,k in [(523,6),(1311,9),(2470,14),(3780,20)])
    return norm(verb(s/3+f(nz(.8),[800,6000],'band')*np.exp(-tt*60),.8,.3),l)
def boom(l=.8): return norm(verb(np.concatenate([kick()*1.3,np.zeros(SR//2)]),1.2,.5),l)
# 0 - 1.3 sunrise: airy pad swell
put(mus, norm(pad([146.8,220,293.7,440],1.6),.18), 0.0)
put(mus, norm(f(nz(1.3),[2000,9000],'band')*np.linspace(0,1,int(SR*1.3))**2,.06), 0.0)
# a low pad bed that grows through the training part
put(mus, norm(pad([73.4,110,146.8,220],16.3),.16), 1.3)
# kicks on every cut, hats in between; denser as it builds
for i,c in enumerate(CUTS):
    nxt=CUTS[i+1] if i+1<len(CUTS) else 17.16
    g=.7+.5*min(1,c/16)
    put(mus, kick(), c, g)
    if c in BLUE:
        put(mus, boom(.55), c); put(mus, snap(), c, .5); continue
    d=nxt-c; n=2 if c<8 else 4
    for k in range(1,n): put(mus, hat(), c+d*k/n, .25+.1*(c>11))
    if c>=11.4: put(mus, snap(), c+d/2, .35)
    if i%2==0: put(mus, sub(73.4 if c<11 else 65.4, d), c, .35)
# riser into the door
d=t_(2.0); put(mus, norm(f(nz(2.0),[400,9000],'band')*(d/2.0)**3,.3), 14.24)
# door: everything drops, just air
mus[int(SR*16.24):int(SR*17.16)]*=0.15
# ending bed under the blue words and the logo (soft, leaves room for the motion sounds)
put(mus, norm(pad([146.8,185,220,293.7],3.4),.12), 17.2)
for at in [17.95,18.45,18.95,19.45,19.95]: put(mus, kick(), at, .5); put(mus, hat(), at+.25, .15)
put(mus, norm(pad([146.8,220,277.2,370],3.6),.13), 20.6)
# ---- motion and shot sounds ----
for at in [1.32]: put(fx, whoosh(.45,.3), at-.15)
put(fx, pop(.25), 2.45); put(fx, tick(.2), 2.62)             # phone in bed: screen tap
for b in BLUE:
    put(fx, whoosh(.35,.35), b-.12)
    for k in range(3): put(fx, click(.22), b+.05+k*.07)
put(fx, norm(f(nz(.6),[300,3000],'band')*np.exp(-t_(.6)*5),.35), 3.91)  # swim splash
put(fx, norm(f(nz(.15),[100,900],'band')*np.exp(-t_(.15)*25),.4), 4.51)   # blocks push
for k in range(3): put(fx, norm(f(nz(.08),[150,1200],'band')*np.exp(-t_(.08)*40),.3), 5.11+k*.19)  # footsteps
put(fx, norm(f(nz(.6),[2000,9000],'band')*np.exp(-t_(.6)*3),.18), 5.71) # sizzle
z=np.zeros(int(SR*.6))
for c in np.cumsum(np.linspace(.02,.006,70)):
    j=int(c*SR)
    if j+300<len(z): z[j:j+300]+=f(nz(300/SR),2500,'high')*np.exp(-np.arange(300)/50)
put(fx, norm(z,.3), 7.36)                                      # zipper
put(fx, norm(f(nz(.7),[200,1500],'band')*np.sin(np.pi*t_(.7)/.7),.22), 8.03)  # crowd
put(fx, norm(f(nz(.4),[300,6000],'band')*np.exp(-t_(.4)*9),.4), 8.66)   # chalk clap
put(fx, clank(.35), 9.28); put(fx, clank(.3), 9.9)
for c in [11.43,12.03,12.63,13.23,13.84,14.44,15.04,15.64]:     # heavy lifts
    put(fx, clank(.42), c+.08); put(fx, kick(), c+.08, .5)
put(fx, norm(f(nz(1.0),[80,600],'band')*np.sin(np.pi*t_(1.0)),.3), 16.24)   # door air
put(fx, boom(.5), 16.95)
out=(mus+fx)[:int(SR*LEN)]
out[-int(SR*.5):]*=np.linspace(1,0,int(SR*.5))
out=norm(np.tanh(out*1.3),.8)
with wave.open('music.wav','wb') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((out*32767).astype(np.int16).tobytes())
print('ok')
