const { chromium } = require('playwright'); const { spawn } = require('child_process'); const path = require('path'); const http = require('http'); const fs = require('fs');
const FPS = 30, SECS = +(process.argv[2] || 16.6), OUT = process.argv[3] || 'meet.mp4', AUDIO = process.argv[4];
(async () => {
  const srv = http.createServer((req, res) => { const f = path.join(__dirname, decodeURIComponent(req.url.split('?')[0])); if (!f.startsWith(__dirname) || !fs.existsSync(f)) { res.statusCode = 404; return res.end(); } res.setHeader('Content-Type', f.endsWith('.html') ? 'text/html' : f.endsWith('.js') ? 'application/javascript' : 'image/png'); fs.createReadStream(f).pipe(res); }).listen(8111);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.goto('http://127.0.0.1:8111/meet.html'); await p.waitForTimeout(3500);
  const args = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-'];
  if (AUDIO) args.push('-i', AUDIO);
  args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'slow');
  if (AUDIO) args.push('-c:a', 'aac', '-b:a', '192k', '-shortest');
  args.push('-movflags', '+faststart', path.join(__dirname, OUT));
  const ff = spawn('ffmpeg', args);
  for (let i = 0; i < SECS * FPS; i++) {
    await p.evaluate(async (t) => { window.render(t); await Promise.all([...document.images].map((im) => im.complete ? 0 : new Promise((r) => (im.onload = im.onerror = r)))); }, i / FPS);
    const buf = await p.screenshot({ type: 'jpeg', quality: 92 }); if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end(); await new Promise((r) => ff.on('close', r)); await b.close(); srv.close(); console.log('done');
})();
