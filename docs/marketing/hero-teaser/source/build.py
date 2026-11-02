import cv2,numpy as np,subprocess,os
FPS=30;W,H=1080,1920
# (source, in_sec, dur)  — source 'clock' uses clockf frames at 30fps
SEG=[('s1',0.3,2.0),('s2',0.7,2.4),('s3',0.5,2.0),('s4',0.6,1.5),('clock',0.6,2.0),
     ('s6',1.0,2.2),('s7',1.0,2.0),('hold7',0,0.5),('s8',1.2,2.6),('s9',0.2,3.0),
     ('s10',1.7,0.4),('s11',0.9,0.4),('s12',1.4,0.4),('s13',1.6,0.45),
     ('s14',0.0,4.0),('fade',0,0.7),('logo',0,4.0),('hold',0,1.0)]
t=0;MK={}
for s,i,d in SEG: MK.setdefault(s,t); t+=d
T=t;N=int(round(T*FPS))
caps={};cache={}
def clipframe(s,sec):
  c=caps.get(s) or cv2.VideoCapture('clips/%s.mp4'%s);caps[s]=c
  fi=min(int(sec*24),96)
  st=cache.setdefault(s,{})
  if fi not in st:
    c.set(1,fi);ok,f=c.read();st.clear();st[fi]=f
  f=st[fi]
  if f.shape[:2]!=(H,W): f=cv2.resize(f,(W,H))
  return f
yy,xx=np.mgrid[0:H,0:W];vig=(1-0.55*(((xx-W/2)/(W*.75))**2+((yy-H/2)/(H*.7))**2)).clip(.35,1)[...,None].astype(np.float32)
def grade(f):
  f=f.astype(np.float32)/255
  g=f.mean(2,keepdims=True);f=g+(f-g)*0.8          # a little less colour
  f=f*np.array([1.04,0.99,0.95])                    # cool shadows look: B,G,R
  f=np.clip((f-0.03)*1.08,0,1)**1.06
  f=f*vig
  f+=np.random.normal(0,0.018,(H//2,W//2,1)).repeat(2,0).repeat(2,1)
  return (np.clip(f,0,1)*255).astype(np.uint8)
logo=[cv2.imread('logof/%04d.png'%k,cv2.IMREAD_UNCHANGED) for k in range(1,121)]
last7=None
p=subprocess.Popen(['ffmpeg','-y','-loglevel','error','-f','rawvideo','-pix_fmt','bgr24','-s','%dx%d'%(W,H),'-r',str(FPS),'-i','-','-c:v','libx264','-crf','17','-preset','medium','-pix_fmt','yuv420p','video.mp4'],stdin=subprocess.PIPE)
for n in range(N):
  tt=n/FPS;acc=0
  for s,i,d in SEG:
    if tt<acc+d or (s,i,d)==SEG[-1]: break
    acc+=d
  lt=tt-acc
  if s=='clock':
    k=min(int((i+lt)*30)+1,90);f=grade(cv2.resize(cv2.imread('clockf/%04d.jpg'%k),(W,H)))
  elif s=='hold7': f=(last7*np.float32(0.92)).astype(np.uint8)
  elif s=='fade':
    f=(last14*np.float32(max(0,1-lt/d))**1.5).astype(np.uint8)
  elif s in('logo','hold'):
    L=logo[min(int(lt*30),119)] if s=='logo' else logo[-1]
    a=L[...,3:4].astype(np.float32)/255;f=(L[...,:3]*a).astype(np.uint8)
  else:
    f=grade(clipframe(s,i+lt))
    if s in('s10','s11','s12','s13'):
      z=1.06-0.06*lt/d;M=cv2.getRotationMatrix2D((W/2,H/2),0,z);f=cv2.warpAffine(f,M,(W,H))
      if lt<2/FPS: f=cv2.addWeighted(f,0.55,np.full_like(f,255),0.45,0)
    if s=='s7': last7=f
    if s=='s14': last14=f
  p.stdin.write(f.tobytes())
p.stdin.close();p.wait()
import json;json.dump({'T':T,'MK':MK},open('marks.json','w'))
print(T,MK)
