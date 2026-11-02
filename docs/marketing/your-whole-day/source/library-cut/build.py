"""Adro — 'Your whole day' (library cut, no new credits). Gucci-style day montage on a 120 BPM grid,
then the gym at night, a beat of silence, a chain of circles from the whole day that lands on a blue dot, and the open ring -> adro."""
import cv2, numpy as np, subprocess, os, json
FPS, W, H = 30, 1080, 1920
G2 = '../yd/g2'
def grab(src, times):
    """Only the frames we need, at full size."""
    if os.path.isdir(src):
        fs = sorted(x for x in os.listdir(src) if x.endswith('.jpg') or x.endswith('.png'))
        return [cv2.imread(os.path.join(src, fs[min(len(fs) - 1, int(t * 30))]), cv2.IMREAD_UNCHANGED) for t in times]
    c = cv2.VideoCapture(src); fps = c.get(cv2.CAP_PROP_FPS); nfr = int(c.get(cv2.CAP_PROP_FRAME_COUNT))
    want = [min(nfr - 1, int(t * fps)) for t in times]; got = {}; i = 0
    while i <= max(want):
        ok, f = c.read()
        if not ok: break
        if i in want: got[i] = cv2.resize(f, (W, H), interpolation=cv2.INTER_LANCZOS4)
        i += 1
    last = got[max(got)]
    return [got.get(w, last) for w in want]
# (src, src_start, dur, speed, tag)   — circles: (cx, cy, r) in 360x640 coords for the graphic-match chain
CIRC = {'v/14.mp4': (185, 400, 170), 'v/18.mp4': (185, 245, 115), 'v/01.mp4': (175, 345, 115), 'v/43.mp4': (180, 320, 150),
        'v/46.mp4': (185, 325, 185), 'v/44.mp4': (180, 320, 165), 'v/42.mp4': (192, 212, 137), 'v/38.mp4': (185, 325, 170)}
SEQ = [
    ('v/45.mp4', 0.40, 1.50, 1.0, 'sun'),
    (f'{G2}/f1', 2.10, 0.50, 1.5, 'alarm'),
    ('v/13.mp4', 2.60, 0.50, 2.0, 'feet'),
    ('v/07.mp4', 2.80, 0.50, 2.2, 'curtain'),
    (f'{G2}/f4', 1.20, 0.50, 1.0, 'home'),
    ('v/14.mp4', 1.00, 0.50, 2.0, 'sink'),
    ('v/14.mp4', 2.70, 0.50, 1.0, 'tap'),
    ('v/18.mp4', 1.75, 0.50, 1.6, 'towel'),
    (f'{G2}/f7', 1.00, 0.50, 1.6, 'scale'),
    ('v/01.mp4', 3.05, 0.50, 1.0, 'pour'),
    (f'{G2}/f9', 1.30, 0.50, 1.0, 'food'),
    ('v/11.mp4', 2.40, 0.50, 2.0, 'door'),
    ('v/05.mp4', 1.80, 0.50, 2.0, 'engine'),
    ('v/00.mp4', 1.00, 1.00, 1.4, 'car'),
    ('v/04.mp4', 0.60, 0.50, 2.0, 'ice'),
    ('v/02.mp4', 2.40, 0.50, 2.0, 'lobby'),
    ('v/10.mp4', 1.20, 0.50, 2.0, 'card'),
    ('v/03.mp4', 0.50, 0.25, 1.5, 'desk'), ('v/03.mp4', 1.60, 0.25, 1.5, 'desk'),
    ('v/03.mp4', 2.60, 0.25, 1.5, 'desk'), ('v/03.mp4', 3.20, 0.25, 1.5, 'desk'),
    ('v/61.mp4', 0.80, 1.00, 1.5, 'city'),
    ('v/53.mp4', 0.90, 0.50, 1.5, 'chalk'),
    ('v/27.mp4', 1.40, 0.50, 2.0, 'grip'),
    ('v/24.mp4', 1.50, 0.50, 1.0, 'back'),
    ('v/34.mp4', 1.00, 0.50, 1.5, 'grip2'),
    ('v/58.mp4', 1.00, 1.00, 1.6, 'squat'),
    ('v/43.mp4', 1.00, 0.50, 1.0, 'plate'),
    ('v/23.mp4', 1.50, 0.50, 2.0, 'set'),
    ('v/28.mp4', 1.50, 0.50, 1.0, 'line'),
    ('v/49.mp4', 0.80, 0.50, 1.5, 'dead'),
    ('v/26.mp4', 2.00, 0.25, 1.0, 'clap'), ('v/30.mp4', 1.50, 0.25, 1.0, 'sweat'),
    ('v/46.mp4', 1.00, 0.50, 1.0, 'watch'),
    ('v/42.mp4', 0.50, 1.00, 1.0, 'rope'),
    ('v/52.mp4', 1.00, 0.50, 1.5, 'jump'),
    ('f17', 1.50, 1.00, 1.0, 'coach'),
    ('v/36.mp4', 0.40, 1.00, 1.2, 'night'),
    (None, 0, 0.50, 1, 'silence'),
]
CHAIN = [('v/14.mp4', 1.1), ('v/18.mp4', 0.9), ('v/01.mp4', 3.3), ('v/43.mp4', 1.4), ('v/46.mp4', 1.4), ('v/44.mp4', 1.5), ('v/42.mp4', 1.6)]
CHAIN_D = [0.26, 0.22, 0.19, 0.16, 0.14, 0.12, 0.11]
for (src, st), d in zip(CHAIN, CHAIN_D): SEQ.append((src, st, d, 1.0, 'circle'))
SEQ.append(('v/38.mp4', 1.2, 1.00, 0.6, 'dot'))
SEQ.append(('fin', 0.0, 4.60, 1.0, 'logo'))
def align(img, src, push=1.0):
    cx, cy, r = CIRC[src]; z = 560 / (r * 3) * push
    M = np.float32([[z, 0, 540 - z * cx * 3], [0, z, 900 - z * cy * 3]])
    return cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
yy, xx = np.mgrid[0:H, 0:W]
vig = np.clip(1 - 0.22 * (((xx - W / 2) / (W * 0.72)) ** 2 + ((yy - H * 0.47) / (H * 0.62)) ** 2), 0.7, 1)[..., None].astype(np.float32)
rng = np.random.default_rng(3)
def grade(img, night=False):
    x = img.astype(np.float32) / 255
    x = np.clip((x - 0.015) * 1.10, 0, 1)
    b, g, r = x[..., 0], x[..., 1], x[..., 2]
    if night: b = np.clip(b * 1.04, 0, 1)
    else: r = np.clip(r * 1.04 + 0.01, 0, 1); b = np.clip(b * 0.95, 0, 1)
    x = np.dstack([b, g, r]); gray = x.mean(2, keepdims=True); x = gray + (x - gray) * (1.12 if night else 1.2)
    x = x * vig
    hl = cv2.GaussianBlur(np.clip(x - 0.72, 0, 1), (0, 0), 18); x = x + hl * np.array([0.3, 0.45, 0.85], np.float32)
    gr = cv2.resize(rng.standard_normal((H // 2, W // 2)).astype(np.float32), (W, H))[..., None] * 0.03
    return (np.clip(x + gr * (0.6 + 0.4 * (1 - x.mean(2, keepdims=True))), 0, 1) * 255).astype(np.uint8)
def whip(img, amt, d=1):
    k = int(abs(amt)) * 2 + 1
    if k < 3: return img
    sh = cv2.warpAffine(img, np.float32([[1, 0, d * amt * 2], [0, 1, 0]]), (W, H), borderMode=cv2.BORDER_REFLECT)
    return cv2.filter2D(sh, -1, np.ones((1, k), np.float32) / k)
NIGHT = {'city', 'chalk', 'grip', 'back', 'grip2', 'squat', 'plate', 'set', 'line', 'dead', 'clap', 'sweat', 'watch', 'rope', 'jump', 'coach', 'night', 'circle', 'dot'}
cuts = []; t = 0.0
for s in SEQ: cuts.append({'t': round(t, 3), 'tag': s[4], 'dur': s[2]}); t += s[2]
json.dump(cuts, open('cuts.json', 'w'))
total = t
p = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                      '-i', 'score.wav', '-c:v', 'libx264', '-crf', '19', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k',
                      '-shortest', '-movflags', '+faststart', 'adro-your-whole-day.mp4'], stdin=subprocess.PIPE)
for i, (src, st, dur, sp, tag) in enumerate(SEQ):
    n = int(round(dur * FPS))
    if src is None:
        for _ in range(n): p.stdin.write(np.zeros((H, W, 3), np.uint8).tobytes())
        continue
    fr = grab(src, [st + k / FPS * sp for k in range(n)])
    for k in range(n):
        f = fr[k]
        if tag == 'logo':
            bg = np.full((H, W, 3), 10, np.uint8)
            a = f[..., 3:4].astype(np.float32) / 255; out = (bg * (1 - a) + f[..., :3] * a).astype(np.uint8)
            if k < 6: out = cv2.addWeighted(out, k / 6, np.full_like(out, (255, 120, 60)), 1 - k / 6, 0)  # blue flash into the ring
            p.stdin.write(out.tobytes()); continue
        img = f[..., :3].copy() if f.ndim == 3 and f.shape[2] == 4 else f.copy()
        if tag in ('circle',): img = align(img, src)
        if tag == 'dot': img = align(img, src, 1.0 + (k / n) ** 2.2 * 2.2)  # push into the blue dot
        if tag == 'sun' and k < 12: img = (img * (k / 12)).astype(np.uint8)
        if tag == 'curtain' and k >= n - 2: img = cv2.addWeighted(img, 0.6, np.full_like(img, (190, 235, 255)), 0.4, 0)
        if tag == 'door' and k >= n - 3: img = cv2.addWeighted(img, 0.45, np.full_like(img, (170, 225, 255)), 0.55, 0)
        if tag == 'engine' and k < 2: img = whip(img, (2 - k) * 26, -1)
        if tag == 'card' and k >= n - 2: img = whip(img, (k - (n - 3)) * 26, 1)
        if tag == 'car' and k == 0: img = cv2.addWeighted(img, 0.3, np.full_like(img, 255), 0.7, 0)
        if tag == 'city' and k < 4: img = whip(img, (4 - k) * 20, 1)
        if tag == 'squat' and k == 0: img = cv2.addWeighted(img, 0.4, np.full_like(img, 255), 0.6, 0)
        if tag == 'rope' and k == 0: img = cv2.addWeighted(img, 0.4, np.full_like(img, (255, 160, 90)), 0.6, 0)
        if tag == 'night' and k >= n - 12: img = (img * max(0, (n - k) / 12)).astype(np.uint8)
        out = grade(img, tag in NIGHT)
        if tag == 'dot' and k >= n - 5:  # the blue dot blooms
            out = cv2.addWeighted(out, 1 - (k - (n - 5)) / 6, np.full_like(out, (255, 110, 50)), (k - (n - 5)) / 6, 0)
        p.stdin.write(out.tobytes())
p.stdin.close(); p.wait()
print('total', round(total, 2))
