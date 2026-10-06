/* Desktop Chromium acceptance checks. Run: node tests/sim-browser.test.cjs */
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
const screenshotDir=fs.mkdtempSync(path.join(os.tmpdir(),'sim-demo-qa-'));

(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.SIM_BROWSER_EXECUTABLE||shell});
  let checks=0;
  const ok=(name,condition)=>{assert.ok(condition,name);checks++;console.log('PASS',name);};
  try {
    const page=await browser.newPage({viewport:{width:1200,height:1000}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('requestfailed',req=>errors.push(req.url()+': '+req.failure()?.errorText));
    // All required assets must be local. The source-reference hyperlinks are not followed.
    await page.route(/^https?:/,route=>route.abort());
    await page.goto(pathToFileURL(path.join(root,'sim_interactive_demo.html')).href);
    await page.waitForFunction(()=>window.SIMDemo?.latest?.result.ok);
    async function controls(values,tab) {
      await page.evaluate(({values,tab})=>{
        for(const [id,value] of Object.entries(values)){const el=document.getElementById(id);if(el.type==='checkbox')el.checked=value;else el.value=value;}
        if(tab===1)document.getElementById(Object.keys(values)[0]).dispatchEvent(new Event('input',{bubbles:true}));
        else window.SIMDemo.updateReconstruction();
      },{values,tab});
    }
    async function reset(tab){await page.locator(tab===1?'#t1_reset':'#t2_reset').click();}
    ok('offline inline, block and dynamic math load',await page.locator('.katex').count()>50);
    ok('all marked math nodes render',await page.evaluate(()=>Array.from(document.querySelectorAll('[data-tex]')).every(el=>el.querySelector('.katex'))));
    async function workspaceAligned() {return page.evaluate(()=>{
      const sidebar=document.querySelector('.conv-settings').getBoundingClientRect();
      const stage=document.querySelector('.conv-stage').getBoundingClientRect();
      const board=document.querySelector('.conv-board-scroll');
      const plots=Array.from(document.querySelectorAll('.conv-cell canvas'),el=>el.getBoundingClientRect());
      return Math.abs(sidebar.top-stage.top)<1&&Math.abs(sidebar.bottom-stage.bottom)<1
        &&board.scrollWidth<=board.clientWidth+1&&plots.length===6
        &&plots.every(r=>Math.abs(r.width-r.height)<1&&r.left>=stage.left&&r.right<=stage.right)
        &&document.documentElement.scrollWidth<=innerWidth+1;
    });}
    for(const width of [1024,1440,1920]) {
      await page.setViewportSize({width,height:1080});
      ok('desktop '+width+' px keeps panels aligned and all six plots inside the workspace',await workspaceAligned());
      await page.locator('.conv-workspace').screenshot({path:path.join(screenshotDir,'optics-'+width+'.png')});
    }
    await page.setViewportSize({width:1200,height:1000});
    await page.locator('.conv-exercise summary').click();
    ok('expanded experiment guidance preserves equal panel heights',await workspaceAligned());
    await page.locator('.conv-workspace').screenshot({path:path.join(screenshotDir,'optics-expanded.png')});
    await page.locator('.conv-exercise summary').click();
    await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
    await page.screenshot({path:path.join(screenshotDir,'tab1.png'),fullPage:true});
    ok('four-channel overview gives CH4 one uncluttered signal',await page.locator('#t1_waves polyline').count()===4);
    await reset(1);
    async function pupilSnapshot(){return page.evaluate(()=>{
      const ctx=document.querySelector('#t1_cv_illum_lens').getContext('2d');
      const span=(y,match)=>{const pixels=ctx.getImageData(0,y,600,1).data,xs=[];for(let x=0;x<600;x++)if(match(...pixels.slice(x*4,x*4+3)))xs.push(x);return xs.at(-1)-xs[0];};
      return {rays:span(8,(r,g,b)=>(b>180&&g>120&&r<100)||(r>200&&g<150&&b<150)),aperture:span(38,(r,g,b)=>r>220&&g>150&&b<80)};
    });}
    const pupil0=await pupilSnapshot();
    await controls({t1_cutoff_range:24},1);
    const pupil1=await pupilSnapshot();
    ok('larger cutoff period shrinks the drawn aperture without moving the beams',pupil0.rays===pupil1.rays&&Math.abs(pupil1.aperture/pupil0.aperture-.5)<.02);
    await page.locator('#t1_cv_illum_lens').screenshot({path:path.join(screenshotDir,'pupil-small.png')});
    await controls({t1_si:6},1);
    const pupil2=await pupilSnapshot();
    ok('shorter illumination period moves the beams without resizing the aperture',pupil2.aperture===pupil1.aperture&&pupil2.rays>pupil1.rays);
    await reset(1);
    await controls({t1_ss:10.5,t1_si:10.5,t1_phi:0},1);
    const a=await page.evaluate(()=>window.SIMDemo.scene.model.at(17,120).camera);
    await controls({t1_phi:1},1);
    const b=await page.evaluate(()=>window.SIMDemo.scene.model.at(17,120).camera);
    ok('zero beat retains phase-dependent brightness',Math.abs(a-.725)<1e-10&&Math.abs(b-.275)<1e-10);
    ok('zero beat OTF display is unity',await page.locator('#t1_cH').textContent()==='1.000');
    await controls({t1_si:6},1);
    ok('blocked illumination has no frequency gain claim',await page.locator('#t1_cG').textContent()==='—');
    ok('blocked camera pixels really vanish',await page.evaluate(()=>window.SIMDemo.scene.arrays.camera.every(x=>x===0)));
    await page.locator('#t1_btn_laser_toggle').click();
    ok('uniform illumination is a separate available light source',await page.evaluate(()=>window.SIMDemo.scene.model.ex.mean===1));
    await reset(1);
    await page.locator('#t1_btn_sim_anim').click();
    await page.waitForFunction(()=>window.SIMDemo.scene.params.phase>0);
    const anim=await page.evaluate(()=>window.SIMDemo.scene.params.phase);
    await page.getByRole('tab',{name:'② 采集与频域重建'}).click();
    ok('tab switch stops hidden animation',await page.locator('#t1_btn_sim_anim').textContent()==='▶ 相移动画');
    ok('selected tab state updates',await page.locator('#tab2Btn').getAttribute('aria-selected')==='true');
    ok('default reconstruction uses data estimates',await page.evaluate(()=>window.SIMDemo.latest.estimated.estimates.every(e=>e.ok)&&document.querySelector('#wAreconMode').value==='estimated'));
    ok('estimates and truth are displayed separately per direction',await page.locator('#wAestimates tr').count()===3);
    await page.screenshot({path:path.join(screenshotDir,'tab2.png'),fullPage:true});
    await page.locator('.sim-main-grid').screenshot({path:path.join(screenshotDir,'controls-centered.png')});
    const initialRadius=Number(await page.locator('#wAmap circle[stroke="#2563eb"]').getAttribute('r'));
    const mapChecks=[];
    for(const period of [30,13,12,11.5,10,9,8.5]) {
      await controls({wAp:period},2);
      mapChecks.push({period,radius:Number(await page.locator('#wAmap circle[stroke="#2563eb"]').getAttribute('r')),truth:await page.evaluate(()=>window.SIMDemo.latest.truth[0].m),mean:await page.evaluate(()=>window.SIMDemo.latest.truth[0].mean)});
    }
    ok('fixed objective OTF radius across illumination periods and cutoff',mapChecks.every(x=>Math.abs(x.radius-initialRadius)<1e-10));
    ok('finite pupil near cutoff reduces both mean light and effective modulation',mapChecks.find(x=>x.period===9).truth<mapChecks.find(x=>x.period===13).truth&&mapChecks.find(x=>x.period===9).mean<mapChecks.find(x=>x.period===13).mean);
    await page.screenshot({path:path.join(screenshotDir,'near-limit.png'),fullPage:true});
    await controls({wAp:13,wAm:.6},2);
    ok('changing coherence/polarization changes the measured estimate',await page.evaluate(()=>window.SIMDemo.latest.estimated.estimates.every(e=>e.ok&&e.m<.65)));
    await reset(2);
    await page.locator('#wAideal').click();
    const baseline=await page.evaluate(()=>Array.from(window.SIMDemo.latest.result.pixels));
    await controls({wAphi1:2,wAphi2:10,wAphi3:18},2);
    const diff=await page.evaluate(base=>window.SIMCore.rmse(base,window.SIMDemo.latest.result.pixels),baseline);
    ok('known common phase shift is invariant in UI',diff<1e-10);
    await controls({wAphi1:0,wAphi2:0,wAphi3:24},2);
    ok('duplicate phase UI reports noninvertibility',await page.locator('#wAst').textContent().then(s=>s.includes('秩为 1/3')));
    ok('rank failure does not draw an old reconstruction',await page.evaluate(()=>window.SIMDemo.latest.result.pixels===null));
    await reset(2);
    await page.locator('#wAphiL2').click();await page.locator('#wAphiL3').click();
    await page.waitForFunction(()=>window.SIMDemo.latest.result.total===3);
    ok('one phase reports failure',await page.evaluate(()=>window.SIMDemo.latest.result.reason==='phase-rank'));
    await reset(2);await controls({wAp:6,wAillumBg:0},2);
    ok('excitation cutoff cannot claim 3x recovery',await page.locator('#wAk3').textContent()==='—'&&await page.locator('#wAc3b').textContent()==='无法重建');
    await controls({wAp:13},2);
    ok('status recovers without stale cutoff text',!(await page.locator('#wAst').textContent()).includes('阻断'));
    await controls({wAang1:0,wAang2:0,wAang3:0},2);
    ok('three repeated directions recognized as one',await page.locator('#wAst').textContent().then(s=>s.includes('1 个不同方向')));
    await reset(2);
    for(const id of ['wAdir1','wAdir2','wAdir3'])await page.locator('#'+id).click();
    await page.waitForFunction(()=>window.SIMDemo.latest.result.reason==='no-data');
    ok('all directions off yields no fabricated widefield',await page.locator('#wAk3').textContent()==='—');
    await reset(2);await controls({wAm:0,wAnoise:2},2);
    ok('m=0 retains only widefield support',await page.locator('#wAk3').textContent()==='1.00×');
    await reset(2);await controls({wAnoise:2},2);
    const oldFrames=await page.evaluate(()=>window.SIMDemo.latest.data.groups.map(g=>g.frames.map(f=>Array.from(f.pixels))));
    await controls({wAreconMode:'known'},2);
    ok('known modulation comparison uses identical raw',await page.evaluate(old=>JSON.stringify(old)===JSON.stringify(window.SIMDemo.latest.data.groups.map(g=>g.frames.map(f=>Array.from(f.pixels)))),oldFrames));
    await controls({wAphase:2,wAotf:10,wAreconMode:'estimated'},2);
    ok('estimate errors do not reacquire or change raw frames',await page.evaluate(old=>JSON.stringify(old)===JSON.stringify(window.SIMDemo.latest.data.groups.map(g=>g.frames.map(f=>Array.from(f.pixels)))),oldFrames));
    // Same raw and same injected angle error; only the mismatch scope differs.
    const scopeState=async()=>page.evaluate(()=>({reason:window.SIMDemo.latest.result.reason,
      reliable:window.SIMDemo.latest.estimated.estimates.filter(e=>e.ok).length,
      status:document.getElementById('wAst').textContent}));
    await controls({wAphase:0,wAotf:0,wAangle:3,wAerrScope:'both'},2);const scopeBoth=await scopeState();
    await controls({wAerrScope:'recon'},2);const scopeRecon=await scopeState();
    ok('mismatch scope switches between screened widefield and retained sidebands',
      scopeBoth.reason==='widefield'&&scopeBoth.reliable===0&&scopeBoth.status.includes('未通过可靠性筛查')
      &&scopeRecon.reason==='sim'&&scopeRecon.reliable===3&&scopeRecon.status.includes('仅作用于重建'));
    await controls({wAangle:0,wAerrScope:'both'},2);
    await page.locator('#wAc2h').click();
    ok('modal shows real acquired arrays and count',await page.locator('#wAmodalInfo').textContent().then(s=>s.includes('9 帧')));
    const modalPixels=await page.evaluate(()=>{
      const bytes=document.querySelector('#raw_0_0').getContext('2d').getImageData(0,0,128,128).data;
      const raw=window.SIMDemo.latest.data.groups[0].frames[0].pixels;
      return raw.every((v,i)=>bytes[i*4]===Math.round(255*Math.max(0,Math.min(1,v))));
    });
    ok('modal is the same noise realization used in reconstruction',modalPixels);
    await page.screenshot({path:path.join(screenshotDir,'modal.png'),fullPage:true});
    await page.keyboard.press('Escape');ok('modal closes with Escape',await page.locator('#wAmodal').isHidden());
    await page.locator('#wAresample').click();
    ok('resampling changes the noisy measurements',await page.evaluate(old=>JSON.stringify(old)!==JSON.stringify(window.SIMDemo.latest.data.groups.map(g=>g.frames.map(f=>Array.from(f.pixels)))),oldFrames));
    await reset(2);
    await controls({wAp:8.5,wAcounts:1,wAnoise:5},2);
    ok('unreliable estimates visibly omitted from sideband reconstruction',await page.evaluate(()=>window.SIMDemo.latest.result.omitted.length>0&&document.querySelector('#wAestimates').textContent.includes('仅零级')));
    await page.screenshot({path:path.join(screenshotDir,'low-counts.png'),fullPage:true});
    await reset(2);
    ok('reset restores model, shot noise and estimate mode',await page.evaluate(()=>document.querySelector('#wAoptics').value==='finite'&&document.querySelector('#wAshot').checked&&document.querySelector('#wAreconMode').value==='estimated'));
    const pairCases=await page.evaluate(()=>window.SIMComparisons.experiments.map(e=>e.id));
    const sameRawCases=['estimate','phase','angle','modulation','otf','regularization'];
    for(const id of pairCases){
      await page.locator('#wAexperiment').selectOption(id);await page.locator('#wAloadPair').click();
      const state=await page.evaluate(()=>({sameRaw:window.SIMComparisons.reference.raw===window.SIMDemo.latest.data,
        change:document.querySelector('#wApairChanges').textContent,valid:window.SIMDemo.latest.result.ok,
        a:window.SIMComparisons.reference.settings,b:document.querySelector('#wAreconMode').value}));
      ok('A/B '+id+' changes one setting, renders, and preserves raw when applicable',
        state.change.includes('改变了 1 项')&&state.valid&&state.sameRaw===sameRawCases.includes(id));
    }
    // Load explicitly: this assertion must not depend on which case the loop last left active.
    await page.locator('#wAexperiment').selectOption('background_mean');await page.locator('#wAloadPair').click();
    ok('noiseless calibrated background pair has identical reconstructions',await page.evaluate(()=>window.SIMCore.rmse(window.SIMComparisons.reference.pixels,window.SIMDemo.latest.result.pixels)<1e-12));
    await page.locator('#wAexperiment').selectOption('counts');await page.locator('#wAloadPair').click();
    const savedA=await page.evaluate(()=>Array.from(window.SIMComparisons.reference.pixels));
    await page.locator('#wAresample').click();
    ok('resampling B leaves A snapshot unchanged and labels new acquisition',await page.evaluate(a=>a.every((x,i)=>x===window.SIMComparisons.reference.pixels[i])&&document.querySelector('#wApairRelation').textContent.includes('不同采集'),savedA));
    await page.locator('#compare').screenshot({path:path.join(screenshotDir,'comparison-counts.png')});
    await page.locator('#wAsaveA').click();
    ok('save-current makes A match visible B',await page.evaluate(()=>window.SIMCore.rmse(window.SIMComparisons.reference.pixels,window.SIMDemo.latest.result.pixels)===0));
    await controls({wAphase:2},2);
    ok('manual reconstruction edit keeps raw and frozen A',await page.evaluate(()=>window.SIMComparisons.reference.raw===window.SIMDemo.latest.data&&document.querySelector('#wApairChanges').textContent.includes('公共相位偏差')));
    await reset(2);
    ok('reset clears frozen A to avoid stale comparisons',await page.locator('#wApairResults').isHidden());
    await page.locator('#theory summary').click();
    ok('formula panel opens',await page.locator('#theory').getAttribute('open')!==null);
    await page.screenshot({path:path.join(screenshotDir,'theory.png'),fullPage:true});
    ok('desktop formula panel has no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    ok('browser raised no errors or failed asset requests',errors.length===0);
    console.log(JSON.stringify({checks,errors,screenshots:screenshotDir,animationStartedAt:anim},null,2));
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
