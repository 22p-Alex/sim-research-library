const path=require('node:path'),fs=require('node:fs'),os=require('node:os');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.SIM_PLAYWRIGHT_DIR||'/Users/22p/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const cache=path.join(os.homedir(),'Library/Caches/ms-playwright');
const shell=fs.readdirSync(cache).filter(x=>/^chromium_headless_shell-\d+$/.test(x)).sort((a,b)=>Number(b.split('-')[1])-Number(a.split('-')[1]))
  .map(x=>path.join(cache,x,'chrome-headless-shell-mac-arm64/chrome-headless-shell')).find(x=>fs.existsSync(x));
const dir=path.resolve(__dirname,'pdfs');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.SIM_BROWSER_EXECUTABLE||shell});
  const page=await browser.newPage({viewport:{width:1780,height:1200},deviceScaleFactor:2});
  const errs=[];page.on('pageerror',e=>errs.push(e.message));page.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
  await page.goto(pathToFileURL(path.resolve(__dirname,'artifacts.html')).href);
  await page.waitForFunction(()=>document.querySelectorAll('#p1 canvas,#p2 canvas,#p3 canvas').length>=40);
  for(const [id,name] of [['p1','mismatch-angle'],['p2','mismatch-phase'],['p3','mismatch-single-dir']]){
    await page.locator('#'+id).screenshot({path:path.join(dir,name+'.png')});
    console.log('saved',name+'.png');
  }
  await page.screenshot({path:path.join(dir,'mismatch-all.png'),fullPage:true});
  console.log('saved mismatch-all.png');
  console.log('canvas count =',await page.evaluate(()=>document.querySelectorAll('canvas').length));
  console.log('errors =',JSON.stringify(errs));
  await browser.close();
})();
