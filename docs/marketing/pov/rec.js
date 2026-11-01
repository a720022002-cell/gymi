const { chromium } = require('playwright'); const { spawn } = require('child_process'); const path = require('path'); const http = require('http'); const fs = require('fs');
const FPS = 30, SECS = 20;
// [from, to, clip, clip start s]
const SEG = [[0, 3, 's1', 0.6], [3, 6, 's2', 0.4], [6, 9, 's3', 0.5], [9, 12, 's4', 0.6], [12, 15, 's5', 0.4]];
(async () => {
  const srv = http.createServer((req, res) => { const f = path.join(__dirname, decodeURIComponent(req.url.split('?')[0])); if (!f.startsWith(__dirname) || !fs.existsSync(f)) { res.statusCode = 404; return res.end(); } res.setHeader('Content-Type', f.endsWith('.html') ? 'text/html' : f.endsWith('.js') ? 'application/javascript' : 'image/jpeg'); fs.createReadStream(f).pipe(res); }).listen(8096);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.goto('http://127.0.0.1:8096/pov.html'); await p.waitForTimeout(3000);
  const ff = spawn('ffmpeg', ['-y','-loglevel','error','-f','image2pipe','-framerate',String(FPS),'-i','-','-i',path.join(__dirname,'audio.wav'),'-c:v','libx264','-pix_fmt','yuv420p','-crf','20','-preset','slow','-c:a','aac','-b:a','192k','-shortest','-movflags','+faststart',path.join(__dirname,'pov.mp4')]);
  for (let i = 0; i < SECS * FPS; i++) {
    const t = i / FPS; const s = SEG.find((x) => t >= x[0] && t < x[1]);
    const src = s ? `http://127.0.0.1:8096/f_${s[2]}/${String(Math.min(121, Math.floor((s[3] + t - s[0]) * FPS) + 1)).padStart(4, '0')}.jpg` : null;
    await p.evaluate(async ([tt, u]) => { window.render(tt, u); const im = document.getElementById('shot'); if (u && !im.complete) await new Promise((r) => (im.onload = r)); }, [t, src]);
    const buf = await p.screenshot({ type: 'jpeg', quality: 90 }); if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end(); await new Promise((r) => ff.on('close', r)); await b.close(); srv.close(); console.log('done');
})();
