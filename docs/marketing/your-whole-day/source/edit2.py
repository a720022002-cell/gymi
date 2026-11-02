"""Assemble 'Your whole day' part 1 (0–5.3 s): cuts, speed, whip pan, door flash, Gucci-style warm grade + grain."""
import cv2, numpy as np, subprocess, os
FPS = 30
def clip_frames(path):
    if os.path.isdir(path):
        fs = sorted(os.listdir(path)); return [cv2.imread(os.path.join(path, x)) for x in fs], 30.0
    c = cv2.VideoCapture(path); fps = c.get(cv2.CAP_PROP_FPS); out = []
    while True:
        ok, f = c.read()
        if not ok: break
        out.append(cv2.resize(f, (1080, 1920), interpolation=cv2.INTER_LANCZOS4))
    return out, fps
# (source, start_s, out_duration_s, speed)
SHOTS = [  # 120 BPM: a cut on every beat (0.5 s), micro-cuts on the desk
    ('g2/f1', 2.10, 0.50, 1.5),          # alarm: phone lights, hand comes down
    ('g2/s2.mp4', 2.60, 0.50, 2.0),      # bare feet land on the rug (low angle)
    ('g2/s3.mp4', 2.80, 0.50, 2.2),      # curtains pulled, sunlight floods in
    ('g2/f4', 1.20, 0.50, 1.0),          # over the shoulder: real Adro home
    ('clips/s4.mp4', 1.00, 0.50, 2.0),   # golden sink, top-down (kept)
    ('clips/s4.mp4', 2.70, 0.50, 1.0),   # hands under the brass tap (same take)
    ('g2/f7', 1.00, 0.50, 1.6),          # scale + real Progress screen
    ('g2/s8.mp4', 3.05, 0.50, 1.0),      # coffee pour close-up (Cinema Studio)
    ('g2/f9', 1.30, 0.50, 1.0),          # breakfast + real Food screen
    ('g2/s10.mp4', 2.40, 0.50, 2.0),     # green door bursts into sunlight
    ('g2/s11.mp4', 1.80, 0.50, 2.0),     # engine button
    ('g2/s12.mp4', 1.00, 1.00, 1.4),     # car from outside, city reflections (Cinema Studio)
    ('g2/s13.mp4', 0.60, 0.50, 2.0),     # drive-thru iced coffee
    ('g2/s15.mp4', 2.40, 0.50, 2.0),     # marble lobby, low
    ('g2/s16.mp4', 1.20, 0.50, 2.0),     # card on the turnstile
    ('g2/s17.mp4', 0.50, 0.25, 1.5),     # desk rush x3
    ('g2/s17.mp4', 1.60, 0.25, 1.5),
    ('g2/s17.mp4', 2.60, 0.25, 1.5),
    ('g2/s17.mp4', 3.20, 0.75, 1.0),     # phone buzzing -> tape stop
]
cache = {}
seq = []
for i, (src, st, dur, sp) in enumerate(SHOTS):
    if src not in cache: cache[src] = clip_frames(src)
    fr, fps = cache[src]
    n = int(round(dur * FPS))
    for k in range(n):
        t = st + k / FPS * sp
        seq.append((i, k, n, fr[min(len(fr) - 1, int(t * fps))]))
H, W = 1920, 1080
yy, xx = np.mgrid[0:H, 0:W]
vig = 1 - 0.22 * (((xx - W / 2) / (W * 0.72)) ** 2 + ((yy - H * 0.47) / (H * 0.62)) ** 2)
vig = np.clip(vig, 0.7, 1)[..., None].astype(np.float32)
rng = np.random.default_rng(1)
def grade(img):
    x = img.astype(np.float32) / 255
    # warm Gucci look: lift blacks a touch, warm mids, rich but not neon
    x = np.clip((x - 0.015) * 1.10, 0, 1)
    b, g, r = x[..., 0], x[..., 1], x[..., 2]
    r = np.clip(r * 1.04 + 0.01, 0, 1); b = np.clip(b * 0.95, 0, 1); g = np.clip(g * 0.99, 0, 1)
    x = np.dstack([b, g, r])
    gray = x.mean(2, keepdims=True); x = gray + (x - gray) * 1.22
    x = x * vig
    # halation: blurred highlights in warm red
    hi = np.clip(x - 0.72, 0, 1); hl = cv2.GaussianBlur(hi, (0, 0), 18)
    x = x + hl * np.array([0.25, 0.45, 0.9], np.float32)
    # grain
    gr = rng.standard_normal((H // 2, W // 2)).astype(np.float32)
    gr = cv2.resize(gr, (W, H), interpolation=cv2.INTER_LINEAR)[..., None] * 0.03
    x = x + gr * (0.6 + 0.4 * (1 - x.mean(2, keepdims=True)))
    return (np.clip(x, 0, 1) * 255).astype(np.uint8)
def whip(img, amt, direction=1):
    k = int(abs(amt)) * 2 + 1
    if k < 3: return img
    kern = np.zeros((1, k), np.float32); kern[0, :] = 1 / k
    sh = np.float32([[1, 0, direction * amt * 2], [0, 1, 0]])
    return cv2.filter2D(cv2.warpAffine(img, sh, (W, H), borderMode=cv2.BORDER_REFLECT), -1, kern)
p = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                      '-i', 'audio2.wav', '-c:v', 'libx264', '-crf', '18', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k',
                      '-shortest', '-movflags', '+faststart', 'part1b.mp4'], stdin=subprocess.PIPE)
for j, (i, k, n, img) in enumerate(seq):
    img = img.copy()
    if i == 9 and k >= n - 3: img = cv2.addWeighted(img, 0.45, np.full_like(img, (170, 225, 255)), 0.55, 0)  # sunlight burst
    if i == 10 and k < 2: img = whip(img, (2 - k) * 26, -1)
    if i == 2 and k >= n - 2: img = cv2.addWeighted(img, 0.6, np.full_like(img, (190, 235, 255)), 0.4, 0)   # curtain light
    if i == 14 and k >= n - 2: img = whip(img, (k - (n - 3)) * 26, 1)
    if i == 15 and k < 2: img = whip(img, (2 - k) * 26, 1)
    if i == 11 and k == 0: img = cv2.addWeighted(img, 0.3, np.full_like(img, 255), 0.7, 0)  # flash frame
    if i == 18 and k >= 15: img = (img * max(0, 1 - (k - 15) / 8)).astype(np.uint8)   # into the tape stop
    out = grade(img)
    # gentle fade out at the end of the preview
    p.stdin.write(out.tobytes())
# hold a short black tail so the last sound rings out
for _ in range(12): p.stdin.write(np.zeros((H, W, 3), np.uint8).tobytes())
p.stdin.close(); p.wait()
print('frames', len(seq))
