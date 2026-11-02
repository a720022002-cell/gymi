"""Put a real app screen on a chroma-green phone in a clip. Usage:
python3 comp.py in.mp4 screen.png out_dir [start_s] [dur_s] [mode=portrait|landscape]
Writes 1080x1920 JPEG frames at 30 fps. Fingers over the screen stay in front (only green pixels are replaced)."""
import sys, os, cv2, numpy as np
src, scr, out = sys.argv[1:4]
start = float(sys.argv[4]) if len(sys.argv) > 4 else 0
dur = float(sys.argv[5]) if len(sys.argv) > 5 else 99
mode = sys.argv[6] if len(sys.argv) > 6 else 'portrait'
os.makedirs(out, exist_ok=True)
S = cv2.imread(scr)
pass
cap = cv2.VideoCapture(src); fps = cap.get(cv2.CAP_PROP_FPS)
frames = []
while True:
    ok, f = cap.read()
    if not ok: break
    frames.append(f)
n_out = int(min(dur, len(frames) / fps - start) * 30)
prev = None
def order(pts):
    pts = pts.reshape(4, 2).astype(np.float32)
    c = pts.mean(0); ang = np.arctan2(pts[:, 1] - c[1], pts[:, 0] - c[0]); pts = pts[np.argsort(ang)]  # tl,tr,br,bl roughly
    i = np.argmin(pts.sum(1)); pts = np.roll(pts, -i, 0)  # start at top-left
    # make the long side vertical for a portrait screen
    d01 = np.linalg.norm(pts[1] - pts[0]); d12 = np.linalg.norm(pts[2] - pts[1])
    if mode == 'portrait' and d01 > d12: pts = np.roll(pts, -1, 0)[[1, 2, 3, 0]] if False else np.array([pts[3], pts[0], pts[1], pts[2]])
    return pts
for k in range(n_out):
    t = start + k / 30
    f = frames[min(len(frames) - 1, int(round(t * fps)))].copy()
    f = cv2.resize(f, (1080, 1920), interpolation=cv2.INTER_LANCZOS4)
    hsv = cv2.cvtColor(f, cv2.COLOR_BGR2HSV)
    # chroma screen green is bright and very saturated; scenery greens (velvet, tiles, marble) are darker or duller
    g = cv2.inRange(hsv, (40, 110, 110), (85, 255, 255))
    g = cv2.morphologyEx(g, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    cs, _ = cv2.findContours(g, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    best = None
    for x in cs:
        ar = cv2.contourArea(x)
        if ar < 3000: continue
        (cx, cy), (w_, h_), _ = cv2.minAreaRect(x)
        rect = max(w_ * h_, 1); asp = max(w_, h_) / max(1, min(w_, h_))
        hull_a = cv2.contourArea(cv2.convexHull(x))
        score = ar * (hull_a / rect) * (1 if 1.3 < asp < 2.6 else 0.25)
        if hull_a / rect > 0.6 and (best is None or score > best[0]): best = (score, x)
    cs = []
    if best is not None:
        main = best[1]; box = cv2.boxPoints(cv2.minAreaRect(main)).astype(np.int32)
        zone = np.zeros(g.shape, np.uint8); cv2.fillConvexPoly(zone, box, 255); zone = cv2.dilate(zone, np.ones((61, 61), np.uint8))
        parts = [x for x in cv2.findContours(g & zone, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)[0] if cv2.contourArea(x) > 150]
        cs = parts or [main]
    if cs:
        big = max(cs, key=cv2.contourArea)
        c = np.vstack(cs)  # a thumb can split the screen in two
        if cv2.contourArea(big) > 2500:
            hull = cv2.convexHull(c)
            ap = cv2.approxPolyDP(hull, 0.03 * cv2.arcLength(hull, True), True)
            if len(ap) != 4: ap = cv2.boxPoints(cv2.minAreaRect(hull)).reshape(4, 1, 2)
            q = order(ap)
            prev = q if prev is None or np.abs(prev - q).max() > 60 else prev * 0.45 + q * 0.55
            q = prev.copy(); cen = q.mean(0); q = cen + (q - cen) * 1.025  # cover the green edge
            h, w = S.shape[:2]
            M = cv2.getPerspectiveTransform(np.float32([[0, 0], [w, 0], [w, h], [0, h]]), q.astype(np.float32))
            warped = cv2.warpPerspective(S, M, (1080, 1920), flags=cv2.INTER_AREA)
            warped = cv2.GaussianBlur(warped, (3, 3), 0)
            quad = np.zeros((1920, 1080), np.uint8); cv2.fillConvexPoly(quad, q.astype(np.int32), 255)
            # replace green inside the quad (fingers stay), with a soft edge
            key = cv2.inRange(hsv, (32, 45, 35), (92, 255, 255))
            key = cv2.dilate(key, np.ones((3, 3), np.uint8)) & quad
            a = cv2.GaussianBlur(key, (5, 5), 0).astype(np.float32)[..., None] / 255
            # screen light: slightly lifted, a touch of the scene's warmth
            scr_l = np.clip(warped.astype(np.float32) * 0.96 + 4, 0, 255)
            f = (f * (1 - a) + scr_l * a).astype(np.uint8)
            # any green left around the screen edge becomes the phone's black bezel
            near = cv2.dilate(quad, np.ones((41, 41) if mode != 'free' else (9, 9), np.uint8)) & ~cv2.erode(quad, np.ones((25, 25), np.uint8))
            hsv2 = cv2.cvtColor(f, cv2.COLOR_BGR2HSV)
            left = cv2.inRange(hsv2, (30, 28, 30), (95, 255, 255)) & near
            left &= ~(cv2.erode(quad, np.ones((25, 25), np.uint8)))
            left = cv2.dilate(left, np.ones((3, 3), np.uint8))
            f[left > 0] = (14, 14, 16)
            # final sweep: greenish pixels in a band around the screen edge -> bezel black
            band = cv2.dilate(quad, np.ones((61, 61), np.uint8)) & ~cv2.erode(quad, np.ones((45, 45), np.uint8))
            bb, gg2, rr = [c.astype(np.int16) for c in cv2.split(f)]
            gm = ((gg2 > rr + 10) & (gg2 > bb + 10) & (band > 0)).astype(np.uint8) * 255
            gm = cv2.dilate(gm, np.ones((3, 3), np.uint8))
            if mode == 'free':  # green scenery (marble): only bright chroma green counts
                gm = (((gg2 > 70) & (gg2 > rr + 35) & (gg2 > bb + 35) & (band > 0)).astype(np.uint8) * 255)
                gm = cv2.dilate(gm, np.ones((5, 5), np.uint8))
            f[gm > 0] = (14, 14, 16)
            # despill green fringe on fingers near the screen
            edge = cv2.dilate(quad, np.ones((15, 15), np.uint8))
            b, gg, r = cv2.split(f); lim = np.maximum(b, r); m = (edge > 0) & (gg > lim)
            gg[m] = (lim[m] * 0.6 + gg[m] * 0.4).astype(np.uint8); f = cv2.merge([b, gg, r])
    cv2.imwrite(f'{out}/{k + 1:04d}.jpg', f, [cv2.IMWRITE_JPEG_QUALITY, 92])
print('frames', n_out)
