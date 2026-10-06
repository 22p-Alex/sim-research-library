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
    ok('recon-only angle mismatch degrades the reconstruction', hurt > base * 2);
    await set('c-scope', 'both');
    await page.waitForFunction(() => window.SIMAtlasPage.state.scope === 'both');
    ok('polluted estimator falls back instead of fusing garbage', await page.evaluate(() => window.SIMAtlasPage.pipe.estimates.some(e => !e.ok)));
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
    ok('point sample has its own profile and no star-zone claim', await page.locator('#zones').isHidden() && (await page.locator('#s9c figcaption').textContent()).includes('点对'));
    await page.selectOption('#c-sample', 'gratings');
    ok('grating sample omits the unrelated radial profile', await page.locator('#s9c canvas').count() === 0);
    await page.locator('#reset').click();
    ok('reset restores all controls and the ideal preset', await page.evaluate(() => window.SIMAtlasPage.state.angle === 0 && window.SIMAtlasPage.state.noise === 'none' && document.getElementById('c-view').value === '24' && document.querySelector('[data-preset="ideal"]').getAttribute('aria-pressed') === 'true'));
    ok('every equation renders without KaTeX errors', await page.locator('.katex-error').count() === 0 && await page.locator('.katex').count() >= 10);
    ok('all acquisition directions contain exactly three phases', await page.locator('#s3a .frame-group').count() === 3 && await page.locator('#s3a .frame-group').evaluateAll(groups => groups.every(g => g.querySelectorAll('figure').length === 3)));
    ok('fusion displays its actual output spectrum', await page.locator('#s8 canvas').count() === 4);
    await page.locator('#demix-theory summary').click();
    await page.locator('#demix-theory a[href="#source-review"]').click();
    ok('formula reference opens the source notes', await page.locator('#sources').getAttribute('open') !== null);
    await page.locator('#sources summary').click();
    await page.locator('#demix-theory summary').click();

    // The worked example uses the exact live measurements and propagates the selected order.
    await page.evaluate(() => window.SIMAtlasPage.probe({ x: 6, y: 0 }));
    ok('whole-spectrum demix and shift images start collapsed', !await page.locator('#s5a').isVisible() && !await page.locator('#s6a').isVisible());
    for (const order of [0, 1, 2]) {
      await page.locator(`[data-order="${order}"]`).click();
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
    await page.locator('#b5').screenshot({ path: path.join(shotDir, 'band5-worked-results.png') });
    await page.locator('#b6').screenshot({ path: path.join(shotDir, 'band6-linked-shift.png') });
    await page.locator('#b3').screenshot({ path: path.join(shotDir, 'band3-acquisition.png') });
    await page.locator('#b4').screenshot({ path: path.join(shotDir, 'band4-probe.png') });
    await page.locator('#b8').screenshot({ path: path.join(shotDir, 'band8-fusion.png') });
    await page.locator('#b7').screenshot({ path: path.join(shotDir, 'band7-splice.png') });
    await page.locator('#b9').screenshot({ path: path.join(shotDir, 'band9-result.png') });
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
    await page.locator('#b4').screenshot({ path: path.join(shotDir, 'mobile-demix.png') });
    await page.setViewportSize({ width: 1780, height: 1100 });
    await page.goto(pathToFileURL(path.join(root, 'sim_pipeline_atlas.html')).href);
    await page.waitForFunction(() => window.SIMAtlasPage?.pipe?.ok);
    await page.screenshot({ path: path.join(shotDir, 'desktop.png') });
    await page.screenshot({ path: path.join(shotDir, 'atlas-full.png'), fullPage: true });
    ok('browser raised no errors or failed asset requests', errors.length === 0);
    console.log(JSON.stringify({ checks, errors, screenshots: shotDir }, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
