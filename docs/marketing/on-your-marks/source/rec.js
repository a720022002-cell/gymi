const { chromium } = require('playwright'); const { spawn } = require('child_process'); const path = require('path'); const http = require('http'); const fs = require('fs');
const FPS = 30, SECS = 17, OUT = process.argv[2] || 'oym.mp4';
// [from, to, clip, clip start s, speed]
const SEG = [
  [0, 2, 'ref', 0, 1], [2, 4, 's1', 0.5, 1],
  [4, 5, 's2', 0.5, 1], [5, 6, 's3', 1.3, 0.8], [6, 7, 's4', 1.0, 1], [7, 8, 's5', 1.4, 1],
  [8, 9, 's6', 1.2, 1.3], [9, 9.5, 's7', 1.5, 1], [9.5, 10, 's8', 1.5, 1],
  [10, 10.25, 's9', 0.6, 1], [10.25, 10.5, 's10', 1.2, 1], [10.5, 10.75, 's3', 3.0, 1],
  [10.75, 11, 's4', 2.6, 1], [11, 11.25, 's9', 1.3, 1], [11.25, 11.5, 's10', 2.4, 1],
  [12.5, 14.5, 's11', 0.3, 1],
];
(async () => {
  const srv = http.createServer((req, res) => { const f = path.join(__dirname, decodeURIComponent(req.url.split('?')[0])); if (!f.startsWith(__dirname) || !fs.existsSync(f)) { res.statusCode = 404; return res.end(); } res.setHeader('Content-Type', f.endsWith('.html') ? 'text/html' : f.endsWith('.js') ? 'application/javascript' : 'image/jpeg'); fs.createReadStream(f).pipe(res); }).listen(8097);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.goto('http://127.0.0.1:8097/oym.html'); await p.waitForTimeout(3000);
  const ff = spawn('ffmpeg', ['-y','-loglevel','error','-f','image2pipe','-framerate',String(FPS),'-i','-','-i',path.join(__dirname,'audio.wav'),'-c:v','libx264','-pix_fmt','yuv420p','-crf','21','-preset','slow','-c:a','aac','-b:a','192k','-shortest','-movflags','+faststart',path.join(__dirname,OUT)]);
  for (let i = 0; i < SECS * FPS; i++) {
    const t = i / FPS; const s = SEG.find((x) => t >= x[0] - 1e-6 && t < x[1] - 1e-6);
    const max = s && s[2] === 'ref' ? 60 : 121;
    const src = s ? `http://127.0.0.1:8097/f_${s[2]}/${String(Math.min(max, Math.floor((s[3] + (t - s[0]) * s[4]) * FPS) + 1)).padStart(4, '0')}.jpg` : null;
    await p.evaluate(async ([tt, u]) => { window.render(tt, u); const im = document.getElementById('shot'); if (u && !im.complete) await new Promise((r) => (im.onload = r)); }, [t, src]);
    const buf = await p.screenshot({ type: 'jpeg', quality: 90 }); if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end(); await new Promise((r) => ff.on('close', r)); await b.close(); srv.close(); console.log('done');
})();
