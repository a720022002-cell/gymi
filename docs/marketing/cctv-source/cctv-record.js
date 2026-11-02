// CCTV teaser: Kling clips (cctv/f_sN frames) through the CCTV look in cctv.html, then NO SIGNAL and the logo. 15 s, 30 fps.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');
const FPS = 30, SECS = 15;
const S4B_START = +(process.env.S4B_START || 0.4);
const dir = path.join(__dirname, 'cctv');
// [from, to, clip, clip start (s), look]
const SEG = [
  [0, 4, 's1', 0, { gray: 1, noise: 26 }],
  [4, 7, 's2b', 0, { gray: 0.25, noise: 26 }],  // still rack, a blue light pulses from off-screen
  [7, 9, 's3', 1.8, { gray: 0.35, noise: 30, shake: 14, glitchEvery: 5 }],
  [9, 11, 's4b', S4B_START, { gray: 0.1, noise: 26 }],  // the treadmill screen wakes up: the Adro ring
];
(async () => {
  const srv = http.createServer((req, res) => {
    const f = path.join(__dirname, decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(__dirname) || !fs.existsSync(f)) { res.statusCode = 404; return res.end(); }
    res.setHeader('Content-Type', f.endsWith('.html') ? 'text/html' : 'image/jpeg');
    fs.createReadStream(f).pipe(res);
  }).listen(8097);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.goto('http://127.0.0.1:8097/cctv.html');
  await p.waitForTimeout(2500);
  const out = path.join(__dirname, process.env.OUT || 'cctv.mp4');
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '19', '-movflags', '+faststart', out]);
  for (let i = 0; i < SECS * FPS; i++) {
    const t = i / FPS;
    const seg = SEG.find((s) => t >= s[0] && t < s[1]);
    let file = null, opts = {};
    if (seg) {
      const n = Math.min(151, Math.floor((seg[3] + (t - seg[0])) * FPS) + 1);
      file = `http://127.0.0.1:8097/cctv/f_${seg[2]}/${String(n).padStart(4, '0')}.jpg`;
      const L = seg[4];
      opts = { ...L, glitch: L.glitchEvery ? i % L.glitchEvery === 0 : i % 23 === 0 };
      // Short cut flicker at each cut.
      if (t - seg[0] < 0.07) opts.bright = 1.8;
      if (seg[2] === 's4-old') opts.blue = 0.06 + 0.06 * Math.sin(t * 9);
    } else if (t < 12) {
      opts = { nosig: 1, noise: 120, hud: Math.floor(t * 10) % 2 };
    } else {
      opts = { end: Math.min(1, (t - 12) / 0.2), endK: (t - 12.15) / 1.4, hud: 0, noise: 6 };
    }
    await p.evaluate(async ([src, o, tt]) => {
      let img = null;
      if (src) { img = new Image(); img.src = src; await img.decode(); }
      window.draw(tt, img, o);
    }, [file, opts, t]);
    const buf = await p.screenshot({ type: 'jpeg', quality: 90 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await b.close();
  srv.close();
  console.log('done', out);
})();
