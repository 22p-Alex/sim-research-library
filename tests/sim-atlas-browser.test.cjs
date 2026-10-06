/* Local Chromium acceptance checks for the pipeline atlas.
 * Run: node tests/sim-atlas-browser.test.cjs */
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.SIM_PLAYWRIGHT_DIR || '/Users/22p/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const cache = path.join(os.homedir(), 'Library/Caches/ms-playwright');
const shell = fs.readdirSync(cache).filter(x => /^chromium_headless_shell-\d+$/.test(x)).sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]))
  .map(x => path.join(cache, x, 'chrome-headless-shell-mac-arm64/chrome-headless-shell')).find(x => fs.existsSync(x));
const shotDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sim-atlas-qa-'));
console.log('Screenshots:', shotDir);

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.SIM_BROWSER_EXECUTABLE || shell });
  let checks = 0;
  const ok = (name, cond) => { assert.ok(cond, name); checks++; console.log('PASS', name); };
  try {
    const page = await browser.newPage({ viewport: { width: 1780, height: 1100 } }), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('requestfailed', r => errors.push(r.url() + ': ' + r.failure()?.errorText));
    await page.route(/^https?:/, route => route.abort());
    await page.goto(pathToFileURL(path.join(root, 'sim_pipeline_atlas.html')).href);
    await page.waitForFunction(() => window.SIMAtlasPage?.pipe?.ok);
    if (process.argv.includes('--layout-only')) {
      for (const id of ['b8', 'b9']) await page.locator('#' + id).screenshot({style:'.topbar,.sidebar,.skip{visibility:hidden!important}',path:path.join(shotDir, id + '-desktop.png')});
      await page.locator('#fusion-transfer summary').click();
      await page.locator('#fusion-transfer').screenshot({style:'.topbar,.sidebar,.skip{visibility:hidden!important}',path:path.join(shotDir, 'transfer-desktop.png')});
      for (const width of [320,390,768,1024]) {
        await page.setViewportSize({width,height:844});
        await page.waitForTimeout(180);
        await page.evaluate(() => document.querySelectorAll('details').forEach(d=>d.open=true));
        const layout=await page.evaluate(() => ({width:innerWidth,scroll:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width && r.right>innerWidth+2 && !e.closest('.katex') && getComputedStyle(e).position!=='absolute';}).slice(0,35).map(e=>({tag:e.tagName,id:e.id,cls:typeof e.className==='string'?e.className:'svg',right:e.getBoundingClientRect().right,text:e.textContent.slice(0,70)}))}));
        console.log(JSON.stringify(layout));
        ok(`expanded content fits viewport at ${width}px`, layout.scroll <= width + 1);
        if(width===390) for(const id of ['b8','b9'])await page.locator('#'+id).screenshot({style:'.topbar,.sidebar,.skip{visibility:hidden!important}',path:path.join(shotDir,id+'-mobile.png')});
      }
      console.log(JSON.stringify({errors,screenshots:shotDir}));
      return;
    }

    ok('offline assets load and pipeline renders', await page.locator('.katex').count() > 0);
    const plates = await page.evaluate(() => [1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => document.querySelectorAll('#b' + i + ' canvas').length));
    ok('all nine bands draw plates', plates.every(n => n > 0) && plates.reduce((a, b) => a + b, 0) >= 40);
    ok('zone legend lists the three resolution zones', await page.locator('#zones .zone').count() === 3);
    ok('status reports sim with nine fused bands', await page.evaluate(() => document.getElementById('status').textContent.includes('sim') && document.getElementById('status').textContent.includes('9/9')));

    // probe interaction
    const before = await page.locator('#probe').textContent();
    await page.locator('#s4 canvas').first().click({ position: { x: 200, y: 128 } });
    const after = await page.locator('#probe').textContent();
    ok('clicking the spectrum moves the probe bin', before !== after && after.includes('检测 bin'));
    ok('probe shows three orders and shift targets', await page.evaluate(() => {
      const t = document.getElementById('order-results').textContent;
      return t.includes('0 级') && t.includes('+1 级') && t.includes('−1 级') && t.includes('原样品频率');
    }));

    // direction switch changes frame count
    await page.selectOption('#c-dir', '1');
    ok('single direction renders three frames', await page.locator('#s3a figure').count() === 3);
    await page.selectOption('#c-dir', '3');
    ok('three directions render nine frames', await page.locator('#s3a figure').count() === 9);

    // sample switch keeps the atlas alive and changes the zone story
    await page.selectOption('#c-sample', 'gratings');
    await page.waitForFunction(() => window.SIMAtlasPage.pipe.ok);
    ok('legacy gratings sample still renders', await page.locator('#s1 canvas').count() >= 2);
    await page.selectOption('#c-sample', 'star-points');
    await page.waitForFunction(() => window.SIMAtlasPage.pipe.ok);

    // mismatch scope still behaves as designed on the new page
    const rmseOf = () => page.evaluate(() => {
      return Number(document.getElementById('status').dataset.rmse);
    });
    const base = await rmseOf();
    // The mismatch controls live inside a collapsed <details>; set them programmatically.
    const set = (id, v) => page.evaluate(([id, v]) => {
      const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true }));
    }, [id, v]);
    await set('c-angle', '3'); await set('c-scope', 'recon');
    await page.waitForFunction(() => window.SIMAtlasPage.state.angle === 3 && window.SIMAtlasPage.state.scope === 'recon');
    const hurt = await rmseOf();
    ok('recon-only angle mismatch changes reconstruction', Math.abs(hurt - base) > 1e-5);
    await set('c-scope', 'both');
    await page.waitForFunction(() => window.SIMAtlasPage.state.scope === 'both');
    ok('external estimator reports a mismatch', await page.evaluate(() => window.SIMAtlasPage.pipe.estimates.some(e => !e.ok)));
    await set('c-angle', '0'); await set('c-scope', 'recon');
    await page.waitForFunction(() => window.SIMAtlasPage.state.angle === 0);

    // New controls must change only their intended stage of the computation.
    await page.locator('#reset').click();
    await page.evaluate(() => { window.captureForTest = window.SIMAtlasPage.capture; });
    await set('c-eps', '.08');
    ok('regularization reuses exactly the same capture', await page.evaluate(() => window.captureForTest === window.SIMAtlasPage.capture));
    ok('regularization updates transfer and the actual denominator', await page.evaluate(() => {
      const p = window.SIMAtlasPage.pipe, i = 15;
      return p.effectiveTransfer[i] > 0 && p.effectiveTransfer[i] < 1 && Math.abs(p.regularizedDenominator[i] - p.denominator[i] - .08 ** 2) < 1e-12;
    }));
    await page.locator('[data-preset="noise"]').click();
    ok('noise preset applies acquisition and regularization together', await page.evaluate(() => window.SIMAtlasPage.state.noise === 'low' && window.SIMAtlasPage.state.eps === .08));
    await page.locator('[data-preset="mismatch"]').click();
    ok('mismatch preset exposes its changed parameters', await page.evaluate(() => window.SIMAtlasPage.state.angle === 3 && window.SIMAtlasPage.state.scope === 'recon' && document.querySelector('.advanced').open));
    await page.locator('#reset').click();
    await page.selectOption('#c-inspect', '2');
    ok('inspection direction updates the probe and shifted bands', (await page.locator('#s4 figcaption').textContent()).includes('方向 3') && (await page.locator('#s6b').textContent()).includes('(4, -7)') && await page.locator('#s6b canvas').count() === 3);
    await page.selectOption('#c-dir', '1');
    ok('single direction resets and disables unavailable inspection directions', await page.evaluate(() => document.getElementById('c-inspect').value === '0' && document.getElementById('c-inspect').options[2].disabled));
    await page.locator('#probe-reset').click();
    await page.locator('#s4 canvas').focus();
    await page.keyboard.press('ArrowRight');
    ok('keyboard moves the frequency probe by one bin', (await page.locator('#probe').textContent()).includes('f = (7, 0)'));
    await page.selectOption('#c-view', '64');
    ok('full spectrum view preserves the chosen detector frequency', (await page.locator('#probe').textContent()).includes('f = (7, 0)'));
    await page.selectOption('#c-sample', 'points');
    ok('point sample has a shared-row profile and no star-zone claim', await page.locator('#zones').isHidden() && await page.locator('#s9c svg').count() === 1);
    await page.selectOption('#c-sample', 'gratings');
    ok('grating sample shows its actual row rather than a radial statistic', await page.locator('#s9c svg').count() === 1);
    await page.locator('#reset').click();
    ok('reset restores all controls and the ideal preset', await page.evaluate(() => window.SIMAtlasPage.state.angle === 0 && window.SIMAtlasPage.state.noise === 'none' && document.getElementById('c-view').value === '24' && document.querySelector('[data-preset="ideal"]').getAttribute('aria-pressed') === 'true'));
    ok('every equation renders without KaTeX errors', await page.locator('.katex-error').count() === 0 && await page.locator('.katex').count() >= 10);
    ok('all acquisition directions contain exactly three phases', await page.locator('#s3a .frame-group').count() === 3 && await page.locator('#s3a .frame-group').evaluateAll(groups => groups.every(g => g.querySelectorAll('figure').length === 3)));
    ok('fusion displays its actual output spectrum', await page.locator('#s8 canvas').count() === 4);
    ok('final image uses the doubled reconstruction grid', await page.evaluate(() => window.SIMAtlasPage.pipe.spectrumSize === 256 && window.SIMAtlasPage.pipe.outputPixels.length === 256 * 256));
    await set('c-apo', '1.5');
    ok('apodization changes the actual reconstruction', await page.evaluate(() => window.SIMAtlasPage.pipe.settings.apoCutoff === 1.5));
    await page.locator('#c-fusion-q').evaluate(el => { el.value = '16'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    ok('frequency inspector reports computed pre/post apodization values', await page.evaluate(() => {
      const p=window.SIMAtlasPage.pipe, el=document.getElementById('fusion-readout');
      return Math.abs(Number(el.dataset.final) - Math.hypot(p.spectrum.re[16], p.spectrum.im[16])/128**2) < 1e-12 && document.getElementById('o-fusion-q').textContent === '16';
    }));
    await page.locator('#c-profile-y').evaluate(el => { el.value='98'; el.dispatchEvent(new Event('input', {bubbles:true})); });
    ok('profile slider follows the same image row', (await page.locator('#s9c svg').getAttribute('aria-label')).includes('98'));
    await page.locator('#reset').click();

    await page.locator('#demix-theory summary').click();
    await page.locator('#demix-theory a[href="#source-review"]').click();
    ok('formula reference opens the source notes', await page.locator('#sources').getAttribute('open') !== null);
    await page.locator('#sources summary').click();
    await page.locator('#demix-theory summary').click();

    // The worked example uses the exact live measurements and propagates the selected order.
    await page.evaluate(() => window.SIMAtlasPage.probe({ x: 6, y: 0 }));
    ok('whole-spectrum demix and shift images start collapsed', !await page.locator('#s5a').isVisible() && !await page.locator('#s6a').isVisible());
    for (const order of [0, 1, 2]) {
      await page.locator(`button[data-order="${order}"]`).click();
      ok(`worked order ${order} agrees with the actual separated spectrum`, await page.evaluate(order => {
        const page = window.SIMAtlasPage, z = page.pipe.groups[0].separated[order];
        const el = document.getElementById('demix-calculation');
        return Math.abs(Number(el.dataset.resultRe) - z.re[6] / (128 * 128)) < 1e-12 && Math.abs(Number(el.dataset.resultIm) - z.im[6] / (128 * 128)) < 1e-12;
      }, order));
      ok(`order ${order} stays linked to results and relocation`, await page.evaluate(order => document.querySelectorAll('#order-results .order-result')[order].classList.contains('selected') && document.getElementById('shift-example').textContent.includes(['0', '+1', '−1'][order] + ' 级'), order));
    }
    ok('the worked example has three products and cancellation factors', await page.locator('.term-card').count() === 3 && await page.locator('.response-item').count() === 3 && await page.locator('.response-item.retained').count() === 1);
    await set('c-phase', '15');
    ok('changing assumed phases keeps arithmetic linked and reports the assumption', await page.evaluate(() => {
      const page = window.SIMAtlasPage, p = window.SIMAtlas.probe(page.pipe, 0, 6, 0);
      return Math.abs(Number(document.getElementById('demix-calculation').dataset.resultRe) - p.orders[2].value.re) < 1e-12 && document.getElementById('probe').textContent.includes('计算采用相位 15°') && Number(document.getElementById('demix-cancellation').dataset.closureError) < 1e-12;
    }));
    await page.locator('#reset').click();
    await page.locator('#demix-images summary').click();
    ok('spectrum images can be opened with instructions for their marked point', await page.locator('#s5a').isVisible() && (await page.locator('#demix-images').textContent()).includes('红圈'));
    await page.locator('#demix-images summary').click();
    ok('worked formulas render correctly', await page.locator('.katex-error').count() === 0);

    // The teaching animation follows the live probe and never autoplays on load.
    const animation = page.locator('#demix-animation');
    ok('formula animation starts paused at the mixing step', await animation.getAttribute('data-step') === '0' && await animation.getAttribute('data-playing') === 'false');
    ok('numerical audit stays available in a collapsed disclosure', !await page.locator('#demix-calculation').isVisible());
    for (const order of [0, 1, 2]) {
      await page.locator(`button[data-order="${order}"]`).click();
      for (let step = 0; step < 6; step++) {
        await page.locator(`[data-demix-step="${step}"]`).click();
        ok(`order ${order} step ${step} renders its equation`, await animation.getAttribute('data-step') === String(step) && await animation.locator('.katex-error').count() === 0);
      }
      ok(`animated answer ${order} is the actual computed complex value`, await page.evaluate(order => {
        const pr = window.SIMAtlas.probe(window.SIMAtlasPage.pipe, 0, 6, 0), el = document.getElementById('demix-animation');
        return Math.abs(Number(el.dataset.resultRe) - pr.orders[order].value.re) < 1e-12 && Math.abs(Number(el.dataset.resultIm) - pr.orders[order].value.im) < 1e-12;
      }, order));
      ok(`animation ${order} cancels contributions without declaring their A zero`, await animation.locator('.cancelled-term').count() === 2 && (await animation.locator('.cancelled-term').first().textContent()).includes('并非 A 本身为零'));
    }
    // Read the rendered stripe field back into an FFT: it must contain the
    // advertised source frequency, not a decorative or detector-frequency wave.
    ok('component illustrations resolve to specimen frequencies 6, 2 and 14', await page.evaluate(() => {
      return [...document.querySelectorAll('.component-pattern canvas')].every((cv, order) => {
        const pixels = cv.getContext('2d').getImageData(0, 0, 256, 256).data;
        const re = new Float64Array(128 * 128), im = new Float64Array(re.length);
        for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) re[y * 128 + x] = pixels[((2 * y) * 256 + 2 * x) * 4] - 127.5;
        window.SIMCore.fft2(re, im, 128);
        let best = 1;
        for (let x = 2; x < 64; x++) if (Math.hypot(re[x], im[x]) > Math.hypot(re[best], im[best])) best = x;
        return best === [6, 2, 14][order];
      });
    }));
    await page.locator('#demix-replay').click();
    await page.selectOption('#demix-speed', '4000');
    await page.locator('#demix-play').click();
    await page.waitForFunction(() => document.getElementById('demix-animation').dataset.step === '1');
    await page.locator('#demix-play').click();
    await page.waitForTimeout(4200);
    ok('pause keeps the current equation in place', await animation.getAttribute('data-step') === '1' && await animation.getAttribute('data-playing') === 'false');
    await page.locator('[data-demix-step="4"]').click();
    await page.locator('#demix-play').click();
    await page.waitForFunction(() => document.getElementById('demix-animation').dataset.step === '5');
    ok('playback stops at the answer instead of looping', await animation.getAttribute('data-playing') === 'false' && await page.locator('#demix-next').isDisabled());
    await page.locator('#demix-play').click();
    await page.evaluate(() => window.SIMAtlasPage.probe({ x: 7, y: 0 }));
    ok('a new probe resets playback and updates all source frequencies', await animation.getAttribute('data-step') === '0' && await animation.getAttribute('data-playing') === 'false' && await page.locator('.order-result').nth(2).getAttribute('data-frequency-x') === '15');
    await page.locator('[data-follow-order="0"]').click();
    ok('a component card can select its own derivation', await page.locator('button[data-order="0"]').getAttribute('aria-pressed') === 'true' && (await page.locator('#shift-example').textContent()).includes('0 级：A → C'));
    await set('c-m', '0');
    ok('vanishing sidebands do not acquire an invented phase pattern', await page.locator('.order-result').nth(1).getAttribute('data-pattern-visible') === 'false' && await page.locator('.order-result').nth(2).getAttribute('data-pattern-visible') === 'false');
    await page.locator('#reset').click();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('#demix-next').click();
    ok('reduced-motion mode keeps steps usable without equation motion', await animation.getAttribute('data-step') === '1' && await page.evaluate(() => document.querySelector('#demix-equation').getAnimations().length === 0));
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.locator('[data-demix-step="3"]').click();
    await animation.screenshot({ path: path.join(shotDir, 'demix-animation-sum.png'), animations: 'disabled' });
    await page.locator('[data-demix-step="4"]').click();
    await animation.screenshot({ path: path.join(shotDir, 'demix-animation-cancel.png'), animations: 'disabled' });
    await page.locator('#reset').click();
    await page.locator('#b5').screenshot({ style:'.topbar,.sidebar,.skip{visibility:hidden!important}', path: path.join(shotDir, 'band5-worked-results.png') });
    await page.locator('#b6').screenshot({ style:'.topbar,.sidebar,.skip{visibility:hidden!important}', path: path.join(shotDir, 'band6-linked-shift.png') });
    await page.locator('#b3').screenshot({ style:'.topbar,.sidebar,.skip{visibility:hidden!important}', path: path.join(shotDir, 'band3-acquisition.png') });
    await page.locator('#b4').screenshot({ style:'.topbar,.sidebar,.skip{visibility:hidden!important}', path: path.join(shotDir, 'band4-probe.png') });
    await page.locator('#b8').screenshot({ style:'.topbar,.sidebar,.skip{visibility:hidden!important}', path: path.join(shotDir, 'band8-fusion.png') });
    await page.locator('#b7').screenshot({ style:'.topbar,.sidebar,.skip{visibility:hidden!important}', path: path.join(shotDir, 'band7-splice.png') });
    await page.locator('#b9').screenshot({ style:'.topbar,.sidebar,.skip{visibility:hidden!important}', path: path.join(shotDir, 'band9-result.png') });
    for (const width of [320, 390, 768, 1024]) {
      await page.setViewportSize({ width, height: 844 });
      await page.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));
      ok(`expanded content fits viewport at ${width}px`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    }
    await page.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = false));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(pathToFileURL(path.join(root, 'sim_pipeline_atlas.html')).href);
    await page.waitForFunction(() => window.SIMAtlasPage?.pipe?.ok);
    ok('mobile has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: path.join(shotDir, 'mobile.png'), fullPage: false });
    await page.locator('#b4').screenshot({ style:'.topbar,.sidebar,.skip{visibility:hidden!important}', path: path.join(shotDir, 'mobile-demix.png') });
    await page.setViewportSize({ width: 1780, height: 1100 });
    await page.goto(pathToFileURL(path.join(root, 'sim_pipeline_atlas.html')).href);
    await page.waitForFunction(() => window.SIMAtlasPage?.pipe?.ok);
    await page.screenshot({ path: path.join(shotDir, 'desktop.png') });
    await page.screenshot({ path: path.join(shotDir, 'atlas-full.png'), fullPage: true });
    await page.locator('#fusion-transfer summary').click();
    await page.locator('#fusion-transfer').screenshot({style:'.topbar,.sidebar,.skip{visibility:hidden!important}',path:path.join(shotDir,'transfer-desktop.png')});
    ok('browser raised no errors or failed asset requests', errors.length === 0);
    console.log(JSON.stringify({ checks, errors, screenshots: shotDir }, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
