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
SHOTS = [
    ('f_s1', 0.40, 0.70, 1.0),   # 1 alarm lights up the room
    ('f_s2', 1.55, 0.80, 1.0),   # 2 first thing: opens Adro
    ('clips/s3.mp4', 2.40, 0.60, 2.0),  # 3 walk + door push
    ('clips/s4.mp4', 1.00, 0.70, 2.0),  # 4 golden sink (Cinema Studio)
    ('clips/s5.mp4', 1.40, 0.50, 2.0),  # 5 water toward the face
    ('clips/s6.mp4', 1.85, 0.60, 1.8),  # 6 towel off the brass ring
    ('f_s7', 1.40, 0.60, 1.0),   # 7 scale + weight
    ('f_s8', 2.55, 0.90, 1.0),   # 8 breakfast photo
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
vig = 1 - 0.42 * (((xx - W / 2) / (W * 0.72)) ** 2 + ((yy - H * 0.47) / (H * 0.62)) ** 2)
vig = np.clip(vig, 0.45, 1)[..., None].astype(np.float32)
rng = np.random.default_rng(1)
def grade(img):
    x = img.astype(np.float32) / 255
    # warm Gucci look: lift blacks a touch, warm mids, rich but not neon
    x = np.clip((x - 0.02) * 1.06, 0, 1)
    b, g, r = x[..., 0], x[..., 1], x[..., 2]
    r = np.clip(r * 1.05 + 0.012, 0, 1); b = np.clip(b * 0.92, 0, 1); g = np.clip(g * 0.99, 0, 1)
    x = np.dstack([b, g, r])
    gray = x.mean(2, keepdims=True); x = gray + (x - gray) * 1.08
    x = x * vig
    # halation: blurred highlights in warm red
    hi = np.clip(x - 0.72, 0, 1); hl = cv2.GaussianBlur(hi, (0, 0), 18)
    x = x + hl * np.array([0.25, 0.45, 0.9], np.float32)
    # grain
    gr = rng.standard_normal((H // 2, W // 2)).astype(np.float32)
    gr = cv2.resize(gr, (W, H), interpolation=cv2.INTER_LINEAR)[..., None] * 0.035
    x = x + gr * (0.6 + 0.4 * (1 - x.mean(2, keepdims=True)))
    return (np.clip(x, 0, 1) * 255).astype(np.uint8)
def whip(img, amt, direction=1):
    k = int(abs(amt)) * 2 + 1
    if k < 3: return img
    kern = np.zeros((1, k), np.float32); kern[0, :] = 1 / k
    sh = np.float32([[1, 0, direction * amt * 2], [0, 1, 0]])
    return cv2.filter2D(cv2.warpAffine(img, sh, (W, H), borderMode=cv2.BORDER_REFLECT), -1, kern)
p = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                      '-i', 'audio.wav', '-c:v', 'libx264', '-crf', '18', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k',
                      '-shortest', '-movflags', '+faststart', 'part1.mp4'], stdin=subprocess.PIPE)
for j, (i, k, n, img) in enumerate(seq):
    img = img.copy()
    # whip pan 7 -> 8
    if i == 6 and k >= n - 3: img = whip(img, (k - (n - 4)) * 22, 1)
    if i == 7 and k < 3: img = whip(img, (3 - k) * 22, 1)
    # door light flash 3 -> 4
    if i == 2 and k >= n - 2: img = cv2.addWeighted(img, 0.5 if k == n - 1 else 0.75, np.full_like(img, (150, 210, 255)), 0.5 if k == n - 1 else 0.25, 0)
    # alarm: start dark, light comes up
    if i == 0 and k < 4: img = (img * (0.25 + k * 0.18)).astype(np.uint8)
    out = grade(img)
    # gentle fade out at the end of the preview
    if j >= len(seq) - 8: out = (out * ((len(seq) - j) / 8)).astype(np.uint8)
    p.stdin.write(out.tobytes())
# hold a short black tail so the last sound rings out
for _ in range(15): p.stdin.write(np.zeros((H, W, 3), np.uint8).tobytes())
p.stdin.close(); p.wait()
print('frames', len(seq))
