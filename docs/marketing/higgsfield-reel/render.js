const { chromium } = require('playwright');
const { spawn } = require('child_process');
(async()=>{
  const dir=process.argv[2], out=process.argv[3], T=+process.argv[4], fps=30;
  const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1080,height:1920}});
  await p.goto('file://'+dir+'/reel.html'); await p.evaluate(()=>window.ready);
  const ff=spawn('ffmpeg',['-v','error','-y','-f','image2pipe','-framerate',String(fps),'-i','-','-c:v','libx264','-pix_fmt','yuv420p','-crf','18','-preset','medium','-movflags','+faststart',out]);
  for(let f=0;f<Math.round(T*fps);f++){ await p.evaluate(t=>window.render(t),f/fps); const buf=await p.screenshot({type:'jpeg',quality:92}); if(!ff.stdin.write(buf)) await new Promise(r=>ff.stdin.once('drain',r)); }
  ff.stdin.end(); await new Promise(r=>ff.on('close',r)); await b.close();
})();
