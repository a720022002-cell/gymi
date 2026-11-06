import numpy as np, cv2, math
INK='#ECECE6'; BLUE='#3355FF'; GREY='#a9a9a2'
def txt(x,y,s,size,w=600,ls=0,fill=INK,a='middle'):
    return f'<text x="{x}" y="{y}" text-anchor="{a}" font-family="Sora" font-weight="{w}" font-size="{size}" letter-spacing="{ls}" fill="{fill}">{s}</text>'
# ---------- Option D: topographic field (the land around Riyadh, imagined) ----------
W,H=300,340; R=4  # px per mm for the field
rng=np.random.default_rng(7)
def noise(scale,seed):
    r=np.random.default_rng(seed); g=r.normal(size=(H*R//scale+3,W*R//scale+3)).astype(np.float32)
    return cv2.resize(g,(W*R,H*R),interpolation=cv2.INTER_CUBIC)
f=noise(160,1)*1.0+noise(80,2)*.45+noise(40,3)*.06
yy,xx=np.mgrid[0:H*R,0:W*R]/R
px,py=150,150  # the peak: where the ring sits
f+=2.2*np.exp(-((xx-px)**2+(yy-py)**2)/(2*55**2))
f=cv2.GaussianBlur(f,(0,0),14)
# soft edge: lines thin out towards the border (oval mask)
m=((xx-150)/150)**2+((yy-165)/165)**2
paths=[]
lv=np.linspace(f.min(),f.max(),34)[2:-1]
for i,l in enumerate(lv):
    b=(f>l).astype(np.uint8)
    cs,_=cv2.findContours(b,cv2.RETR_LIST,cv2.CHAIN_APPROX_SIMPLE)
    for c in cs:
        if cv2.arcLength(c,True)<60*R: continue
        c=c[:,0,:].astype(float)/R
        # skip parts of the line outside the oval
        keep=(((c[:,0]-150)/146)**2+((c[:,1]-165)/160)**2)<1
        seg=[];segs=[]
        for p,k in zip(c,keep):
            if k: seg.append(p)
            elif len(seg)>3: segs.append(seg); seg=[]
            else: seg=[]
        if len(seg)>3: segs.append(seg)
        segs=[q for q in segs if len(q)>25]
        for s in segs:
            d='M'+' L'.join(f'{x:.1f} {y:.1f}' for x,y in s[::2])
            major=i%5==0
            paths.append(f'<path d="{d}" fill="none" stroke="{INK}" stroke-width="{0.9 if major else 0.45}" stroke-opacity="{0.95 if major else 0.6}" stroke-linejoin="round"/>')
ring=f'<circle cx="{px}" cy="{py}" r="13" fill="none" stroke="{BLUE}" stroke-width="5" stroke-linecap="round" stroke-dasharray="{2*math.pi*13*.8:.2f} 999" transform="rotate(-90 {px} {py})"/>'
# a thin leader line from the ring to the label
lab=f'<line x1="{px+16}" y1="{py+10}" x2="{px+58}" y2="{py+52}" stroke="{BLUE}" stroke-width=".8"/><circle cx="{px+58}" cy="{py+52}" r="1.4" fill="{BLUE}"/>'
lab+=txt(px+62,py+51,'YOU ARE HERE',6.4,700,2.4,INK,'start')+txt(px+62,py+60,'24.71° N  46.67° E',5.4,500,1.6,INK,'start')
foot=txt(150,334,'BEYOND WHAT YOU SEE',7,600,6,INK)
svgD=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W*8}" height="{H*8}">{"".join(paths)}{ring}{lab}{foot}</svg>'
open('art_backD.svg','w').write(svgD)
# ---------- Option E: 365 days, one line each ----------
W2,H2=300,330; cx,cy=150,150; r0=46
rng=np.random.default_rng(11); n=365
base=np.convolve(rng.normal(size=n+80),np.ones(21)/21,'same')[40:40+n]*2.2
lines=[]
for i in range(n):
    a=-math.pi/2+i/n*2*math.pi*0.8   # open like the adro ring
    L=58+base[i]*40+rng.normal()*2.5
    L=max(18,min(L,100))
    today=i==n-1
    x0,y0=cx+math.cos(a)*r0,cy+math.sin(a)*r0; x1,y1=cx+math.cos(a)*(r0+L),cy+math.sin(a)*(r0+L)
    lines.append(f'<line x1="{x0:.2f}" y1="{y0:.2f}" x2="{x1:.2f}" y2="{y1:.2f}" stroke="{BLUE if today else INK}" stroke-width="{1.6 if today else .5}" stroke-opacity="{1 if today else .85}" stroke-linecap="round"/>')
e=-math.pi/2+(n-1)/n*2*math.pi*0.8
dot=f'<circle cx="{cx+math.cos(e)*(r0-7):.2f}" cy="{cy+math.sin(e)*(r0-7):.2f}" r="3" fill="{BLUE}"/>'
mid=txt(cx,cy-2,'365',22,800,1,INK)+txt(cx,cy+10,'DAYS',5.5,600,4,GREY)
foot2=txt(150,302,'ONE LINE A DAY.',9,700,5,INK)+txt(150,316,'ALWAYS WITH YOU.',6,600,4,BLUE)
svgE=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W2} {H2}" width="{W2*8}" height="{H2*8}">{"".join(lines)}{dot}{mid}{foot2}</svg>'
open('art_backE.svg','w').write(svgE)
