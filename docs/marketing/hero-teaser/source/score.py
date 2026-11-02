import numpy as np,scipy.signal as sg,scipy.io.wavfile as wf
SR=48000;T=29.55;N=int(T*SR);rng=np.random.default_rng(7)
L=np.zeros(N);R=np.zeros(N)
def add(x,t,g=1.0,pan=0.0):
  i=int(t*SR);x=x[:max(0,N-i)];L[i:i+len(x)]+=x*g*(1-pan)**.5;R[i:i+len(x)]+=x*g*(1+pan)**.5
def env(n,a,r):
  e=np.ones(n);ai=int(a*SR);ri=int(r*SR)
  if ai:e[:ai]=np.linspace(0,1,ai)
  if ri:e[-ri:]*=np.linspace(1,0,ri)
  return e
def bp(x,lo,hi,o=2): return sg.sosfilt(sg.butter(o,[lo,hi],'band',fs=SR,output='sos'),x)
def lp(x,f,o=2): return sg.sosfilt(sg.butter(o,f,'low',fs=SR,output='sos'),x)
def hp(x,f,o=2): return sg.sosfilt(sg.butter(o,f,'high',fs=SR,output='sos'),x)
def noise(d): return rng.standard_normal(int(d*SR))
def verb(x,d=1.8,mix=.3):
  ir=noise(d)*np.exp(-np.linspace(0,7,int(d*SR)));ir=lp(ir,4000);ir/=np.abs(ir).sum()**.5*3
  return x+mix*sg.fftconvolve(x,ir)[:len(x)]
def kick(f0=55,d=.5,g=1):
  t=np.arange(int(d*SR))/SR;ph=2*np.pi*np.cumsum(f0+90*np.exp(-t*35))/SR
  return g*np.sin(ph)*np.exp(-t*7)
def clank(g=1):
  t=np.arange(int(.9*SR))/SR;x=sum(np.sin(2*np.pi*f*t)*np.exp(-t*k) for f,k in [(523,6),(1311,9),(2470,14),(3780,20)])
  return g*(x/3+bp(noise(.9),800,6000)*np.exp(-t*60))
# ---------- music: accelerating pulse 0–12.1, silence, 12.6–19.85 ----------
def bpm(t): return 62+ (t/19.85)**1.6*118
mus=np.zeros(N);t=0.15
while t<19.85:
  if not(12.1<=t<12.6):
    g=.55+.45*t/19.85;i=int(t*SR);k=kick(48,.6,g);mus[i:i+len(k)]+=k[:N-i]
    if t>12.6: # ticks on the off-beat
      j=int((t+30/bpm(t))*SR);h=hp(noise(.05),7000)*np.exp(-np.arange(int(.05*SR))/SR*90)*.12;mus[j:j+len(h)]+=h[:N-j]
  t+=60/bpm(t)
# dark drone pad (A minor), rising in level, follows the same gates
tt=np.arange(N)/SR;pad=sum(np.sin(2*np.pi*f*tt+np.sin(2*np.pi*.13*tt)*2) for f in [55,110.3,130.8,164.6,220.4])
pad=lp(pad,900)*.05*(.3+.7*np.clip(tt/19.85,0,1))
# riser before the silence
rs=(tt>16.5)&(tt<19.85);sw=np.zeros(N);x=noise(19.85-16.5);e=np.linspace(0,1,len(x))**2
sw[int(16.5*SR):int(16.5*SR)+len(x)]=bp(x,300,5000)*e*.25
music=mus+pad+sw
gate=np.ones(N);gate[int(12.1*SR):int(12.6*SR)]=0;gate[int(19.85*SR):]=0
gate=np.convolve(gate,np.ones(96)/96,'same')
gate[int(19.85*SR):]=0;gate[int(12.1*SR):int(12.6*SR)]=0
music*=gate;music=np.tanh(music*1.3)*.6
L+=music;R+=music
# ---------- sfx ----------
# (no phone sound: the hand is already in the pocket)
add(bp(noise(1.1),200,1800)*np.hanning(int(1.1*SR))*.12,1.2)          # breath
for k,s in enumerate(np.arange(2.05,4.4,.26)):                        # footsteps on the track
  add(lp(noise(.12),900)*np.exp(-np.arange(int(.12*SR))/SR*40)*.35,s,pan=(-.2 if k%2 else .2))
cr=bp(noise(2.3),250,2500)*.12+bp(noise(2.3),120,500)*.1               # gym crowd
cr*=env(len(cr),.05,.9);add(verb(cr),4.4)
for s in rng.uniform(4.45,6.2,7): add(verb(clank(.06+rng.uniform(0,.06))),s,pan=rng.uniform(-.6,.6))
z=np.zeros(int(1.1*SR))                                                # zipper
for c in np.cumsum(np.linspace(.03,.008,90)):
  j=int(c*SR)
  if j+400<len(z): z[j:j+400]+=hp(noise(400/SR),2500)*np.exp(-np.arange(400)/60)
add(z*env(len(z),.05,.2)*.5,6.3)
tk=np.arange(int(.25*SR))/SR;tick=(np.sin(2*np.pi*2400*tk)*np.exp(-tk*80)+hp(noise(.25),4000)*np.exp(-tk*200))*.45
add(verb(tick,1.2,.5),8.9)                                            # clock tick
for s in np.arange(10.0,12.1,.27):                                    # people walking out
  add(verb(lp(noise(.1),1200)*np.exp(-np.arange(int(.1*SR))/SR*45)*.18),s+rng.uniform(-.05,.05),pan=rng.uniform(-.5,.5))
mm=bp(noise(2.2),200,1200)*.05*env(int(2.2*SR),.1,1.5);add(mm,9.9)
sl=lp(noise(1.6),250)*np.exp(-np.arange(int(1.6*SR))/SR*6)*.9+np.r_[kick(40,1.2,.7),np.zeros(int(.4*SR))];add(verb(sl,2.2,.6),12.1)   # slam
lc=hp(noise(.08),1500)*np.exp(-np.arange(int(.08*SR))/SR*60)*.5;add(lc,12.62);add(lc*.7,12.7)   # latch
add(bp(noise(1.6),100,800)*np.hanning(int(1.6*SR))*.2,12.8)          # door opening air
lt_=lp(noise(.5),180)*np.exp(-np.arange(int(.5*SR))/SR*9)*.5+hp(noise(.03),3000)[:int(.5*SR)].sum()*0;add(verb(lt_,2.5,.7),14.6)   # lights switching on (low thunk)
for k,s in enumerate(np.arange(14.9,18.2,.66)):                       # his footsteps (slow motion), empty gym echo
  add(verb(lp(noise(.12),700)*np.exp(-np.arange(int(.12*SR))/SR*38)*.4,2.5,.6),s,pan=(-.15 if k%2 else .15))
for s in [18.2,18.6,21,19.4]:                                      # heavy reps
  add(verb(clank(.22),1.6,.4),s+.03);add(kick(38,.7,.6),s+.03)
add(bp(noise(1.6),150,1600)*np.hanning(int(1.6*SR))**1.5*.22,20.7)  # deep inhale
add(bp(noise(1.9),100,1000)*np.hanning(int(1.9*SR))**1.2*.17,22.4)  # exhale
rt=lp(noise(4.7),300)*.012;add(rt*env(len(rt),.5,.8),19.9)          # room tone
# logo
ri=np.arange(int(1.4*SR))/SR;up=np.sin(2*np.pi*np.cumsum(220+ri*180)/SR)*.06*(ri/1.4)**2+bp(noise(1.4),800,6000)*.03*(ri/1.4)**2
add(verb(up,2,.5),24.5);add(verb(kick(45,1.6,.8)+np.r_[np.sin(2*np.pi*110*np.arange(int(1.6*SR))/SR)*np.exp(-np.arange(int(1.6*SR))/SR*2)*.15],3,.6),25.85)
sh=sum(np.sin(2*np.pi*f*np.arange(int(2.5*SR))/SR) for f in [880,1318,1760])*np.exp(-np.arange(int(2.5*SR))/SR*1.6)*.03;add(verb(sh,2.5,.7),26.5)
out=np.stack([L,R],1);fo=int(1.0*SR);out[-fo:]*=np.linspace(1,0,fo)[:,None]
out=out/np.abs(out).max()*.89
wf.write('score.wav',SR,(out*32767).astype(np.int16));print('ok')
