// Cuts the AI clips into one 1080x1920 timeline and lays the transparent card/text layer (overlay.html) over it.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const dir = process.argv[2], out = process.argv[3], fps = 30;
// [clip, start in the clip, seconds on screen, card scene index or null]
const SEG = [
  ['v6', 1.9, 1.6, null], ['v10', 0.4, 1.4, null], ['v1', 0.0, 2.9, 0], ['v11', 0.0, 1.7, null], ['v2', 0.2, 3.0, 1],
  ['v7', 0.0, 1.5, null], ['v9', 0.8, 1.6, null], ['v12', 0.3, 1.4, null], ['v3', 0.6, 2.9, 2], ['v4', 0.5, 2.9, 3], ['v8', 0.5, 1.4, null], ['v5', 1.0, 2.9, 4],
];
const ENDLEN = 3.6;
let t = 0; const TL = []; for (const [, , d, c] of SEG) { if (c !== null) TL[c] = { s: t, e: t + d }; t += d; }
const END = t, TOTAL = t + ENDLEN, HOOK = [0, SEG[0][2] + SEG[1][2]];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.goto('file://' + dir + '/overlay.html'); await p.evaluate(() => window.ready);
  await p.evaluate(([TL, HOOK, END]) => { window.TL = TL; window.HOOK = HOOK; window.END = END; }, [TL, HOOK, END]);
  const args = ['-v', 'error', '-y'];
  SEG.forEach(([v]) => args.push('-i', dir + '/vid/' + v + '.mp4'));
  args.push('-f', 'image2pipe', '-c:v', 'png', '-framerate', String(fps), '-i', '-');
  const f = SEG.map(([, s, d], i) => `[${i}:v]trim=start=${s}:duration=${d},setpts=PTS-STARTPTS,fps=${fps},scale=1080:1920:flags=lanczos,setsar=1[s${i}]`);
  f.push(SEG.map((_, i) => `[s${i}]`).join('') + `concat=n=${SEG.length}:v=1:a=0,eq=contrast=1.04:saturation=1.06,tpad=stop_mode=clone:stop_duration=${ENDLEN}[bg]`);
  f.push(`[bg][${SEG.length}:v]overlay=format=auto,format=yuv420p[o]`);
  args.push('-filter_complex', f.join(';'), '-map', '[o]', '-t', String(TOTAL), '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-movflags', '+faststart', out);
  const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let i = 0; i < Math.round(TOTAL * fps); i++) {
    await p.evaluate((t) => window.render(t), i / fps);
    const buf = await p.screenshot({ type: 'png', omitBackground: true });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end(); await new Promise((r) => ff.on('close', r)); await b.close();
  console.log('total', TOTAL.toFixed(2), 's', JSON.stringify(TL));
})();
