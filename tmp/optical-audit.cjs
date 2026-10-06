/* 光路页验收：离线渲染、布局、交互与截图。Run: node tmp/optical-audit.cjs */
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const os=require('node:os');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.SIM_PLAYWRIGHT_DIR||'/Users/22p/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..');
const cache=path.join(os.homedir(),'Library/Caches/ms-playwright');
const shell=fs.readdirSync(cache).filter(x=>/^chromium_headless_shell-\d+$/.test(x)).sort((a,b)=>Number(b.split('-')[1])-Number(a.split('-')[1]))
  .map(x=>path.join(cache,x,'chrome-headless-shell-mac-arm64/chrome-headless-shell')).find(x=>fs.existsSync(x));
const dir=fs.mkdtempSync(path.join(root,'tmp','optical-qa-'));
const page_='sim_real_optical_path.html';

(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.SIM_BROWSER_EXECUTABLE||shell});
  let checks=0;
  const ok=(n,c)=>{assert.ok(c,n);checks++;console.log('PASS',n);};
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    const errors=[];
    page.on('pageerror',e=>errors.push('pageerror: '+e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text());});
    page.on('requestfailed',r=>errors.push('requestfailed: '+r.url()+' '+(r.failure()||{}).errorText));
    // 离线：阻断一切远程请求
    await page.route(/^https?:/,route=>route.abort());
    await page.goto(pathToFileURL(path.join(root,page_)).href);
    await page.waitForSelector('#s17');

    /* ── 结构 ── */
    ok('17 个站点卡全部存在', await page.locator('.station[data-st]').count()===17);
    ok('侧栏 17 个站点链接', await page.locator('#stationNav a[data-st]').count()===17);
    ok('无远程资源请求', !errors.some(e=>/requestfailed/.test(e)));
    const deadLinks=await page.evaluate(()=>[...document.querySelectorAll('a[href^="#"]')]
      .map(a=>a.getAttribute('href').slice(1)).filter(id=>id&&!document.getElementById(id)));
    ok('页内锚点无死链: '+deadLinks.join(','), deadLinks.length===0);
    const extMissing=await page.evaluate(()=>[...document.querySelectorAll('a[href]:not([href^="#"])')]
      .map(a=>a.getAttribute('href')).filter(h=>!/^https?:/.test(h)));
    console.log('  外部本地链接数:',extMissing.length);

    /* ── 布局 ── */
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    ok('1440px 无横向溢出 ('+overflow+')', overflow<=0);
    const svgSizes=await page.evaluate(()=>[...document.querySelectorAll('svg[viewBox]')].map(s=>{
      const b=s.getBoundingClientRect();return {vb:s.getAttribute('viewBox'),w:Math.round(b.width),h:Math.round(b.height)};}));
    ok('所有 SVG 均有非零渲染尺寸', svgSizes.every(s=>s.w>0&&s.h>0));
    console.log('  SVG 渲染尺寸:',JSON.stringify(svgSizes));

    /* ── 着色模式 ── */
    const overlayOpacity=async()=>page.evaluate(()=>
      Number(getComputedStyle(document.querySelector('.conj-overlay')).opacity));
    ok('默认波长模式下共轭层隐藏', (await overlayOpacity())===0);
    await page.click('.tintbar button[data-tint="conj"]');
    await page.waitForTimeout(400);
    ok('共轭模式下共轭层可见', (await overlayOpacity())===1);
    ok('body[data-tint] 已切换', await page.evaluate(()=>document.body.dataset.tint)==='conj');
    await page.locator('#master .figure').screenshot({path:path.join(dir,'02-master-conj.png')});
    await page.click('.tintbar button[data-tint="pol"]');
    await page.waitForTimeout(400);
    const polOpacity=await page.evaluate(()=>Number(getComputedStyle(document.querySelector('.pol')).opacity));
    ok('偏振模式下偏振箭头可见', polOpacity===1);
    await page.locator('#master .figure').screenshot({path:path.join(dir,'03-master-pol.png')});
    await page.click('.tintbar button[data-tint="wl"]');
    ok('可切回波长模式', await page.evaluate(()=>document.body.dataset.tint)==='wl');

    /* ── 待核实高亮 ── */
    await page.click('#flagBtn');
    ok('flag 开启后 body[data-flag]=on', await page.evaluate(()=>document.body.dataset.flag)==='on');
    const chipShadow=await page.evaluate(()=>getComputedStyle(document.querySelector('.ev-todo')).boxShadow);
    ok('待核实标签被高亮: '+chipShadow.slice(0,32), /rgb/.test(chipShadow));
    await page.click('#flagBtn');
    ok('flag 可关闭', await page.evaluate(()=>document.body.dataset.flag)==='off');

    /* ── 滚动联动（关掉平滑滚动，逐站硬断言） ── */
    await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';});
    for(const st of ['01','07','11','15','17']){
      await page.evaluate(s=>document.getElementById('s'+s).scrollIntoView(),st);
      await page.waitForTimeout(260);
      const got=await page.evaluate(()=>{
        const a=document.querySelector('#stationNav a[aria-current="step"]');
        return a?a.getAttribute('data-st'):null;});
      ok('滚到 '+st+' 站 → 侧栏高亮 '+st+'（实际 '+got+'）', got===st);
      const cls=await page.evaluate(s=>document.getElementById('s'+s).className,st);
      ok('  '+st+' 站卡片获得 is-active', /is-active/.test(cls));
    }
    ok('同一时刻只有一个高亮', await page.evaluate(()=>document.querySelectorAll('#stationNav a[aria-current]').length)===1);

    /* ── details 折叠 ── */
    const dCount=await page.locator('details').count();
    const openCount=await page.evaluate(()=>document.querySelectorAll('details[open]').length);
    ok('假设块默认收起 ('+dCount+' 个 details, '+openCount+' 个展开)', dCount>=8&&openCount===0);

    /* ── 截图 ── */
    await page.evaluate(()=>{document.documentElement.style.scrollBehavior='';window.scrollTo(0,0);});
    await page.waitForTimeout(250);
    await page.screenshot({path:path.join(dir,'01-hero.png')});
    await page.locator('#master .figure').screenshot({path:path.join(dir,'04-master.png')});
    await page.locator('#conjugate .figure').first().screenshot({path:path.join(dir,'05-conjugate.png')});
    for(const [id,name] of [['#state','06-state'],['#s03','07-st03'],['#s05','08-st05'],['#s07','09-st07'],
      ['#s09','10-st09'],['#s10','11-st10'],['#s11','12-st11'],['#s15','13-st15'],['#numbers','14-numbers'],['#limits','15-limits']]){
      await page.locator(id).screenshot({path:path.join(dir,name+'.png')});
    }
    ok('浏览器无报错 ('+errors.length+')', errors.length===0);
    if(errors.length) console.log(errors.join('\n'));

    /* ── 移动端 ── */
    const m=await browser.newPage({viewport:{width:390,height:844}});
    const merr=[];m.on('pageerror',e=>merr.push(e.message));
    await m.goto(pathToFileURL(path.join(root,page_)).href);
    await m.waitForSelector('#s17');
    const mo=await m.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    ok('390px 无横向溢出 ('+mo+')', mo<=0);
    ok('移动端无报错', merr.length===0);
    await m.evaluate(()=>document.getElementById('master').scrollIntoView());
    await m.waitForTimeout(200);
    await m.screenshot({path:path.join(dir,'16-mobile.png')});
    await m.close();

    console.log(JSON.stringify({checks,errors,screenshots:dir},null,2));
  } catch(e){ console.error('FAIL',e.message); process.exitCode=1; }
  finally { await browser.close(); }
})();
