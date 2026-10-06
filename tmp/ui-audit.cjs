/* UI audit for sim_interactive_demo.html: screenshots + text-density metrics. */
const path=require('node:path'),fs=require('node:fs'),os=require('node:os');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.SIM_PLAYWRIGHT_DIR||'/Users/22p/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..');
const cache=path.join(os.homedir(),'Library/Caches/ms-playwright');
const shell=fs.readdirSync(cache).filter(x=>/^chromium_headless_shell-\d+$/.test(x)).sort((a,b)=>Number(b.split('-')[1])-Number(a.split('-')[1]))
  .map(x=>path.join(cache,x,'chrome-headless-shell-mac-arm64/chrome-headless-shell')).find(x=>fs.existsSync(x));
const out=path.join(__dirname,'ui-audit');
fs.mkdirSync(out,{recursive:true});

(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.SIM_BROWSER_EXECUTABLE||shell});
  const page=await browser.newPage({viewport:{width:1280,height:900},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.join(root,'sim_interactive_demo.html')).href);
  await page.waitForFunction(()=>window.SIMDemo?.latest?.result.ok);
  await page.waitForTimeout(600);

  // Tab 1: full page + the two "lab" sections at 1x.
  await page.screenshot({path:path.join(out,'t1-full.png'),fullPage:true});
  await page.screenshot({path:path.join(out,'t1-fold.png')});           // first screenful
  await page.locator('#ch4-lab').screenshot({path:path.join(out,'t1-ch4.png')});
  await page.locator('#envelope-lab').screenshot({path:path.join(out,'t1-envelope.png')});
  await page.locator('#tab2Btn').click();
  await page.waitForTimeout(900);
  await page.screenshot({path:path.join(out,'t2-full.png'),fullPage:true});
  await page.screenshot({path:path.join(out,'t2-fold.png')});
  await page.locator('#compare').screenshot({path:path.join(out,'t2-compare.png')});
  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(500);
  await page.screenshot({path:path.join(out,'t2-mobile.png'),fullPage:true});
  await page.setViewportSize({width:1280,height:900});
  await page.waitForTimeout(400);
  await page.locator('#tab1Btn').click();
  await page.waitForTimeout(500);

  const collect=async tag=>{
  // ---- metrics per visible panel ----
  const metrics=await page.evaluate(()=>{
    const vis=el=>{const r=el.getBoundingClientRect();const s=getComputedStyle(el);
      return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';};
    const txt=el=>el.innerText.replace(/\s+/g,' ').trim();
    const res=[];
    const panels=[...document.querySelectorAll('#tab1Content section.panel, #tab2Content section.panel, details.theory')];
    for(const p of panels){
      if(!vis(p))continue;
      const h2=p.querySelector('h2,h3,summary');
      const name=h2?txt(h2).slice(0,26):'(无标题)';
      const r=p.getBoundingClientRect();
      // prose nodes = <p class="note|status|legend|wave-guide"> and figcaption text
      let prose=0,nProse=0;
      for(const n of p.querySelectorAll('p.note,p.status,p.legend,p.wave-guide,figcaption')){
        if(!vis(n))continue;const t=txt(n);prose+=t.length;nProse++;}
      // controls
      const nInput=p.querySelectorAll('input[type=range]').length;
      const nBtn=p.querySelectorAll('button').length;
      const nSel=p.querySelectorAll('select').length;
      const nCanvas=p.querySelectorAll('canvas').length;
      const nSvg=p.querySelectorAll('svg').length;
      const nTbl=p.querySelectorAll('table').length;
      res.push({name,h:Math.round(r.height),chars:txt(p).length,prose,proseNodes:nProse,
        prosePct:Math.round(100*prose/Math.max(1,txt(p).length)),
        charsPerPx:+(txt(p).length/Math.max(1,r.height)).toFixed(2),
        range:nInput,btn:nBtn,sel:nSel,canvas:nCanvas,svg:nSvg,table:nTbl});
    }
    // longest single note paragraphs anywhere
    const longs=[...document.querySelectorAll('p.note')]
      .filter(vis).map(n=>({len:txt(n).length,t:txt(n).slice(0,48)}))
      .sort((a,b)=>b.len-a.len).slice(0,12);
    return {panels:res,longs,
      docH:document.documentElement.scrollHeight,
      totalVisibleChars:txt(document.querySelector('.wrap')).length};
  });

  console.log('=== ['+tag+'] 页面总高(px) ===',metrics.docH,' 可见文字总数:',metrics.totalVisibleChars);
  console.log('\n=== ['+tag+'] 各面板 ===');
  console.log('面板'.padEnd(28),'高px','字数','说明文字','段落数','占比%','字/px','滑块','按钮','下拉','画布','SVG','表');
  for(const m of metrics.panels){
    console.log(String(m.name).padEnd(28),String(m.h).padStart(5),String(m.chars).padStart(5),
      String(m.prose).padStart(6),String(m.proseNodes).padStart(5),String(m.prosePct).padStart(5),
      String(m.charsPerPx).padStart(6),String(m.range).padStart(4),String(m.btn).padStart(4),
      String(m.sel).padStart(4),String(m.canvas).padStart(4),String(m.svg).padStart(4),String(m.table).padStart(3));
  }
  console.log('\n=== ['+tag+'] 最长的 12 条 .note 段落 ===');
  for(const l of metrics.longs)console.log(String(l.len).padStart(4),'字 |',l.t,'…');
  return metrics;
  };
  const m1=await collect('第一章');
  await page.locator('#tab2Btn').click();
  await page.waitForTimeout(900);
  const m2=await collect('第二章');
  console.log('\n截图目录:',out);
  console.log('pageerror:',errors.length?errors:'(无)');
  await browser.close();
})();
