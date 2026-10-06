/* One-off QA: verify the double-dot preset merges at dc=4 and resolves at dc=3. */
const path=require('node:path');
const os=require('node:os');
const fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const {chromium}=require('/Users/22p/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..');
const cache=path.join(os.homedir(),'Library/Caches/ms-playwright');
const shell=fs.readdirSync(cache).filter(x=>/^chromium_headless_shell-\d+$/.test(x)).sort((a,b)=>Number(b.split('-')[1])-Number(a.split('-')[1]))
  .map(x=>path.join(cache,x,'chrome-headless-shell-mac-arm64/chrome-headless-shell')).find(x=>fs.existsSync(x));
const outDir=path.join(__dirname,'dots-qa');fs.mkdirSync(outDir,{recursive:true});

(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:shell});
  const page=await browser.newPage({viewport:{width:1200,height:1000}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.join(root,'sim_interactive_demo.html')).href);
  await page.waitForFunction(()=>window.SIMConvOtf);
  // 进阶 details block must be gone
  const hasAdvanced=await page.evaluate(()=>[...document.querySelectorAll('#conv-otf-lab summary')].some(s=>s.textContent.includes('进阶')));
  console.log('进阶 block present:',hasAdvanced);
  await page.evaluate(()=>document.querySelector('[data-conv-kind="dots"]').click());
  for(const dc of [4,3]) {
    await page.evaluate(dc=>{const el=document.getElementById('t1_conv_dc');el.value=dc;el.dispatchEvent(new Event('input',{bubbles:true}));},dc);
    await page.waitForTimeout(300);
    const profile=await page.evaluate(()=>{
      const cv=document.getElementById('t1_conv_cam');
      const ctx=cv.getContext('2d');
      const W=cv.width,mid=cv.height/2;
      const row=[];
      for(let x=0;x<W;x++)row.push(ctx.getImageData(x,mid,1,1).data[0]);
      // scan around centre for peak-dip-peak structure
      const c=W/2,win=40;
      let lmax=0,rmax=0,cmin=255,lx=0,rx=0;
      for(let x=c-win;x<=c-2;x++)if(row[x]>lmax){lmax=row[x];lx=x;}
      for(let x=c+2;x<=c+win;x++)if(row[x]>rmax){rmax=row[x];rx=x;}
      for(let x=lx;x<=rx;x++)if(row[x]<cmin){cmin=row[x];}
      const peak=Math.max(lmax,rmax);
      return {leftPeakX:lx,rightPeakX:rx,leftPeak:lmax,rightPeak:rmax,centreMin:cmin,dipRatio:+(cmin/peak).toFixed(3),peakSepPx:+((rx-lx)/2).toFixed(2)};
    });
    console.log(`dc=${dc}:`,JSON.stringify(profile));
    await page.locator('#conv-otf-lab .conv-board').screenshot({path:path.join(outDir,`dots-dc${dc}.png`)});
  }
  console.log('errors:',errors);
  await browser.close();
})();
