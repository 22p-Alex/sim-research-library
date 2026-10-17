/* Desktop Chromium acceptance checks for the pipeline atlas.
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
      for (const width of [1024,1440,1920]) {
        await page.setViewportSize({width,height:1080});
        await page.waitForTimeout(180);
        await page.evaluate(() => document.querySelectorAll('details').forEach(d=>d.open=true));
        const layout=await page.evaluate(() => ({width:innerWidth,scroll:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width && r.right>innerWidth+2 && !e.closest('.katex') && getComputedStyle(e).position!=='absolute';}).slice(0,35).map(e=>({tag:e.tagName,id:e.id,cls:typeof e.className==='string'?e.className:'svg',right:e.getBoundingClientRect().right,text:e.textContent.slice(0,70)}))}));
        console.log(JSON.stringify(layout));
        ok(`expanded content fits viewport at ${width}px`, layout.scroll <= width + 1);
        if(width===1024) for(const id of ['b8','b9'])await page.locator('#'+id).screenshot({style:'.topbar,.sidebar,.skip{visibility:hidden!important}',path:path.join(shotDir,id+'-desktop-1024.png')});
      }
      console.log(JSON.stringify({errors,screenshots:shotDir}));
      return;
    }

    ok('offline assets load and pipeline renders', await page.locator('.katex').count() > 0);

    // ---- P0 teaching additions ----
    // 1. Compact opening retains the reconstruction premise and causal route
    ok('compact opening states the shared unknowns and reconstruction route', await page.evaluate(() => {
      const t = document.getElementById('core-question')?.textContent || '';
      return t.includes('三帧') && t.includes('三个未知分量') && t.includes('分离频带') && t.includes('样品坐标');
    }));
    ok('fixed atlas omits experiments and uses calibrated modulation', await page.evaluate(() =>
      !document.getElementById('experiment') && Object.isFrozen(window.SIMAtlasPage.state)
      && window.SIMAtlasPage.state.m === .8 && window.SIMAtlasPage.pipe.estimates.length === 0));
    // 3/4. step 02 spectrum copies: four panels, three tagged orders, centres at ±k_d
    ok('encoding spectrum has four panels with three tagged orders', await page.evaluate(() => {
      const el = document.getElementById('s2-spectrum');
      const panels = [...el.querySelectorAll('.encoding-panel')];
      const orders = panels.map(p => p.dataset.order).filter(o => o !== 'sum');
      return panels.length === 4 && orders.length === 3 && ['0', '1', '-1'].every(o => orders.includes(o));
    }));
    ok('encoding spectrum +1 copy centres at +k_d and -1 at -k_d', await page.evaluate(() => {
      const el = document.getElementById('s2-spectrum');
      const kx = Number(el.dataset.kx), ky = Number(el.dataset.ky);
      const get = o => el.querySelector(`.encoding-panel[data-order="${o}"]`);
      const p1 = get('1'), m1 = get('-1');
      return kx !== 0 || ky !== 0
        ? (Number(p1.dataset.centerX) === kx && Number(p1.dataset.centerY) === ky
          && Number(m1.dataset.centerX) === -kx && Number(m1.dataset.centerY) === -ky)
        : (Number(p1.dataset.centerX) === kx && Number(m1.dataset.centerX) === -kx);
    }));
    // Each observation shows its complete equation, with exact coefficients.
    ok('three acquisition equations attach fractional weights to all components', await page.evaluate(() => {
      const el = document.getElementById('acquisition-weights');
      const equations = JSON.parse(el.dataset.equations);
      const system = el.querySelector('.acquisition-system [data-tex]').dataset.tex;
      return equations.length === 3 && system.includes('begin{array}') && equations.every(({ coefficients, tex }, j) => {
        return tex.startsWith(`D_{${j}}=A_0+`) && tex.includes('A_{+1}') && tex.includes('A_{-1}')
          && tex.includes('\\frac') && !/\d+\.\d+/.test(tex)
          && coefficients.length === 3 && coefficients.every(([re, im], column) =>
            Math.abs(Math.hypot(re, im) - (column === 0 ? 1 : .4)) < 1e-10);
      }) && !el.querySelector('table') && !el.querySelector('.katex-error') && !el.textContent.includes('和 =');
    }));
    // 7/8. matrix derivation is available in a disclosure; M^{-1}M agrees with live weights.
    ok('demix overview is collapsed with D=MA and A=M^{-1}D, no KaTeX error', await page.evaluate(() => {
      const el = document.getElementById('demix-overview');
      const tex = document.querySelector('#demix-overview-matrix [data-tex]')?.dataset.tex || '';
      return !document.getElementById('demix-matrix-details').open && tex.includes('M^{-1}') && tex.includes('begin{bmatrix}')
        && el.querySelectorAll('.katex-error').length === 0;
    }));
    ok('displayed matrix M satisfies M^{-1}M ≈ I against the actual separation weights', await page.evaluate(() => {
      const M = JSON.parse(document.getElementById('demix-overview-matrix').dataset.matrix)
        .map(row => row.map(([re, im]) => ({ re, im })));
      const W = window.SIMAtlasPage.pipe.groups[0].weights; // W = M^{-1}
      const mul = (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
      const add = (a, b) => ({ re: a.re + b.re, im: a.im + b.im });
      let worst = 0;
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        // (W M)[r][c] = sum_j W[r][j] M[j][c]
        let acc = { re: 0, im: 0 };
        for (let j = 0; j < 3; j++) acc = add(acc, mul(W[r][j], M[j][c]));
        const target = r === c ? 1 : 0;
        worst = Math.max(worst, Math.hypot(acc.re - target, acc.im));
      }
      return worst < 1e-10;
    }));
    // 9. step 05 no longer frames orders as a fixed low/mid/high scale ranking
    ok('step 05 drops the misleading "three scales" framing', await page.evaluate(() => {
      const t = document.getElementById('b5').textContent;
      return !t.includes('三种尺度') && !t.includes('级次必然按频率高低排序');
    }));
    // 10. step 08 teaching formula uses P_apo while the pipeline still reads apodization
    ok('step 08 uses P_apo in teaching text and still computes apodization', await page.evaluate(() => {
      const tex = [...document.querySelectorAll('#b8 [data-tex]')].map(e => e.dataset.tex).join(' ');
      return tex.includes('P_{\\mathrm{apo}}') && window.SIMAtlasPage.pipe.apodization.length === 256 * 256;
    }));
    // 6/11 are exercised further below after interaction setup.

    const plates = await page.evaluate(() => [1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => document.querySelectorAll('#b' + i + ' canvas').length));
    ok('all nine bands draw plates', plates.every(n => n > 0) && plates.reduce((a, b) => a + b, 0) >= 40);
    ok('zone legend lists the three resolution zones', await page.locator('#zones .zone').count() === 3);
    ok('fairSIM reconstructs all nine fixed bands', await page.evaluate(() => window.SIMAtlasPage.pipe.reason === 'sim' && window.SIMAtlasPage.pipe.bands.length === 9));

    // probe interaction
    const before = await page.locator('#probe').textContent();
    await page.locator('#s4 canvas').first().click({ position: { x: 200, y: 128 } });
    const after = await page.locator('#probe').textContent();
    ok('clicking the spectrum moves the probe bin', before !== after && after.includes('检测频率 f'));
    ok('probe shows three orders and shift targets', await page.evaluate(() => {
      const t = document.getElementById('order-results').textContent;
      return t.includes('0 级') && t.includes('+1 级') && t.includes('−1 级') && t.includes('归位样品坐标');
    }));

    // View controls inspect the same fixed data rather than changing acquisition.
    const set = (id, value, event = 'change') => page.evaluate(([id, value, event]) => {
      const el = document.getElementById(id); el.value = value;
      el.dispatchEvent(new Event(event, { bubbles: true }));
    }, [id, value, event]);
    const resetInspection = async () => {
      await set('c-inspect', '0'); await set('c-view', '24');
      await page.locator('button[data-order="2"]').click();
      await page.locator('#probe-reset').click();
      await page.locator('#demix-replay').click();
      await set('c-profile-y', '80', 'input');
    };
    await page.evaluate(() => { window.fixedCaptureForTest = window.SIMAtlasPage.capture; window.fixedPipeForTest = window.SIMAtlasPage.pipe; });
    await page.selectOption('#c-inspect', '2');
    ok('inspection direction updates the probe and shifted bands', (await page.locator('#s4 figcaption').first().textContent()).includes('方向 3') && (await page.locator('#s6b').textContent()).includes('(4, -7)'));
    await resetInspection();
    await page.locator('#s4 canvas').first().focus(); await page.keyboard.press('ArrowRight');
    ok('keyboard moves the frequency probe by one bin', (await page.locator('#probe').textContent()).includes('f = (7, 0)'));
    await page.selectOption('#c-view', '64');
    ok('full spectrum view preserves the detector frequency', (await page.locator('#probe').textContent()).includes('f = (7, 0)'));
    ok('viewing does not regenerate capture or reconstruction', await page.evaluate(() => window.fixedCaptureForTest === window.SIMAtlasPage.capture && window.fixedPipeForTest === window.SIMAtlasPage.pipe));
    await resetInspection();
    ok('every equation renders without KaTeX errors', await page.locator('.katex-error').count() === 0 && await page.locator('.katex').count() >= 10);
    ok('all acquisition directions contain exactly three phases', await page.evaluate(() => {
      const groups = [...document.querySelectorAll('#s3a .frame-group, #s3-other .frame-group')]
        .filter(g => g.querySelector('.frame-kind')?.textContent.includes('采集帧'));
      return groups.length === 3 && groups.every(g => g.querySelectorAll('figure').length === 3);
    }));
    ok('fusion displays its actual output spectrum', await page.locator('#s8 canvas').count() === 4);
    ok('final image uses the doubled reconstruction grid', await page.evaluate(() => window.SIMAtlasPage.pipe.spectrumSize === 256 && window.SIMAtlasPage.pipe.outputPixels.length === 256 * 256));
    ok('apodization uses the fixed fairSIM cutoff', await page.evaluate(() => window.SIMAtlasPage.pipe.settings.apoCutoff === 1.9));
    await page.locator('#c-profile-y').evaluate(el => { el.value='98'; el.dispatchEvent(new Event('input', {bubbles:true})); });
    ok('profile slider follows the same image row', (await page.locator('#s9c svg').getAttribute('aria-label')).includes('98'));
    await resetInspection();

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
    await resetInspection();
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
      ok(`animation ${order} cancels contributions without declaring their A zero`, await animation.locator('.cancelled-term').count() === 2 && (await animation.locator('.cancelled-term').first().textContent()).includes('A 本身可以非零'));
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
    ok('a component card can select its own derivation', await page.locator('button[data-order="0"]').getAttribute('aria-pressed') === 'true' && (await page.locator('#shift-example').textContent()).includes('0 级：Â → C'));
    await resetInspection();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('#demix-next').click();
    ok('reduced-motion mode keeps steps usable without equation motion', await animation.getAttribute('data-step') === '1' && await page.evaluate(() => document.querySelector('#demix-equation').getAnimations().length === 0));
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    // 11. clicking each sidebar link makes it the unique aria-current step
    for (let n = 1; n <= 9; n++) {
      await page.locator(`.stage-nav a[href="#b${n}"]`).click();
      ok(`sidebar click highlights step 0${n} as the unique current step`, await page.evaluate(n => {
        const cur = [...document.querySelectorAll('.stage-nav a[aria-current="step"]')];
        return cur.length === 1 && cur[0].getAttribute('href') === `#b${n}`;
      }, n));
    }
    await page.locator(`.stage-nav a[href="#b1"]`).click();

    // ---- R-round acceptance A1-A8: step 02/03 must track ACQUISITION truth ----
    // A1: the combined panel is the true frame-0 emission FFT (pixel-level).
    const emissionPixelsMatch = () => page.evaluate(() => {
      const cap = window.SIMAtlasPage.capture, A = window.SIMAtlas;
      const dir = Number(document.getElementById('s2-spectrum-label').textContent.match(/方向 (\d+)/)[1]) - 1;
      const E = A.spectrum(cap.truth.emission[dir][0], 128);
      let mx = 0; for (let i = 0; i < E.re.length; i++) mx = Math.max(mx, Math.hypot(E.re[i], E.im[i]));
      const cv = document.querySelector('#s2-spectrum .encoding-panel[data-order="sum"] canvas');
      const ctx = cv.getContext('2d');
      const viewHalf = 24;
      return [[3, 3], [20, 40], [60, 10], [100, 90], [40, 70], [80, 30]].every(([x, y]) => {
        const fx = Math.floor((x / 128 * 2 - 1) * viewHalf), fy = Math.floor((y / 128 * 2 - 1) * viewHalf);
        const i = ((fy % 128 + 128) % 128) * 128 + ((fx % 128 + 128) % 128);
        const v = Math.log(1 + Math.hypot(E.re[i], E.im[i])) / Math.log(1 + mx);
        const g = Math.round(255 * Math.max(0, Math.min(1, v)));
        const d = ctx.getImageData(2 * x, 2 * y, 1, 1).data;
        return Math.abs(d[0] - g) <= 1 && Math.abs(d[1] - g) <= 1 && Math.abs(d[2] - g) <= 1;
      });
    });
    ok('A1 combined encoding panel equals the true emission FFT (dir 1)', await emissionPixelsMatch());
    await page.selectOption('#c-inspect', '1');
    ok('A1 combined encoding panel equals the true emission FFT (dir 2)', await emissionPixelsMatch());
    await page.selectOption('#c-inspect', '2');
    ok('A1 combined encoding panel equals the true emission FFT (dir 3)', await emissionPixelsMatch());
    await page.selectOption('#c-inspect', '0');
    // Fixed parameters skip the external estimator; geometry is inspected below.
    // A7: direction switching relabels step 02/03 and matches steps 04-07.
    await page.selectOption('#c-inspect', '1');
    ok('A7 direction switch relabels step 02/03 to the inspected direction', await page.evaluate(() => {
      const s2 = document.getElementById('s2-spectrum-label').textContent;
      const s3 = document.getElementById('s3-direction-label').textContent;
      return s2.includes('方向 2') && s2.includes('(4, 7)') && s3.includes('方向 2');
    }));
    await resetInspection();
    // A8: default reading shows one paired set, then the phase explanation, rest collapsed.
    ok('A8 phase explanation follows the first paired set, rest collapsed', await page.evaluate(() => {
      const order = ['s3a', 's3b', 's3-magnitude-warning', 'acquisition-weights', 's3-other-directions']
        .map(id => document.getElementById(id));
      const pos = order.map(el => { let p = 0, n = el; while ((n = n.previousElementSibling)) p++; return p; });
      // monotonic document order among siblings
      for (let i = 1; i < pos.length; i++) if (pos[i] <= pos[i - 1]) return false;
      return document.getElementById('s3-other-directions').open === false
        && document.querySelectorAll('#s3a figure').length === 3;
    }));

    // R2 follow-up: the step-02 frequency point follows the live probe in all
    // four spectra, and the short status only claims transfer when valid.
    const probeLink = () => page.evaluate(() => document.getElementById('s2-probe-link').textContent);
    ok('step-02 probe example follows the step-04 probe', await (async () => {
      const before = await probeLink();
      await page.evaluate(() => window.SIMAtlasPage.probe({ x: 7, y: 0 }));
      const after = await probeLink();
      const mapped = await page.locator('#s2-spectrum .encoding-panel').evaluateAll(nodes => nodes.map(n => n.dataset.mappedFrequency));
      return before.includes('(14, 0) → (6, 0)')
        && after.includes('(15, 0) → (7, 0)')
        && JSON.stringify(mapped) === JSON.stringify(['[15,0]', '[23,0]', '[7,0]', '[7,0]']);
    })());
    ok('in-band probe gives the short frequency-mapping status', await (async () => {
      await page.evaluate(() => window.SIMAtlasPage.probe({ x: 6, y: 0 }));
      const t = await probeLink();
      return t.includes('(14, 0) → (6, 0)') && t.includes('由圈外移入圈内');
    })());
    ok('out-of-band probe gives the no-transfer status and does not pin off-view points', await (async () => {
      await page.evaluate(() => window.SIMAtlasPage.probe({ x: 20, y: 0 }));
      const t = await probeLink();
      const visible = await page.locator('#s2-spectrum .encoding-panel').evaluateAll(nodes => nodes.map(n => n.dataset.markerVisible));
      return t.includes('落在圈边/圈外，无信号传递')
        && JSON.stringify(visible) === JSON.stringify(['false', 'false', 'true', 'true']);
    })());
    await resetInspection();
    ok('reset restores the default in-band probe example', (await probeLink()).includes('(14, 0) → (6, 0)'));

    // Review regressions: physical cutoff, modulation fallback, and evaluation
    // distinguish reconstruction error from directional frequency recovery.
    await page.evaluate(() => window.SIMAtlasPage.probe({ x: 10, y: 0 }));
    ok('cutoff bin has zero transmission and never claims high-frequency capture', await page.evaluate(() => {
      const p = window.SIMAtlas.probe(window.SIMAtlasPage.pipe, 0, 10, 0);
      const text = document.getElementById('s2-probe-link').textContent;
      return p.orders.every(o => o.h === 0)
        && p.observed.every(z => Math.hypot(z.re, z.im) < 1e-14)
        && text.includes('落在圈边/圈外，无信号传递');
    }));
    await resetInspection();
    await resetInspection();
    ok('evaluation retains image error and brightness bias', await page.evaluate(() => {
      const cards = [...document.querySelectorAll('#quality-readout .quality-card')];
      return cards.length === 2 && cards[0].textContent.includes('0.2643')
        && cards[1].textContent.includes('-0.2240') && cards[1].textContent.includes('71.85%')
        && !document.getElementById('s9').textContent.includes('该朝向没被恢复');
    }));
    ok('all new derivations render without formula errors', await page.locator('.katex-error').count() === 0);

    await page.locator('[data-demix-step="3"]').click();
    await animation.screenshot({ path: path.join(shotDir, 'demix-animation-sum.png'), animations: 'disabled' });
    await page.locator('[data-demix-step="4"]').click();
    await animation.screenshot({ path: path.join(shotDir, 'demix-animation-cancel.png'), animations: 'disabled' });
    await resetInspection();
    await page.locator('#b5').screenshot({ style:'.topbar,.sidebar,.skip{visibility:hidden!important}', path: path.join(shotDir, 'band5-worked-results.png') });
    await page.locator('#b6').screenshot({ style:'.topbar,.sidebar,.skip{visibility:hidden!important}', path: path.join(shotDir, 'band6-linked-shift.png') });
    await page.locator('#b3').screenshot({ style:'.topbar,.sidebar,.skip{visibility:hidden!important}', path: path.join(shotDir, 'band3-acquisition.png') });
    await page.locator('#b4').screenshot({ style:'.topbar,.sidebar,.skip{visibility:hidden!important}', path: path.join(shotDir, 'band4-probe.png') });
    await page.locator('#b8').screenshot({ style:'.topbar,.sidebar,.skip{visibility:hidden!important}', path: path.join(shotDir, 'band8-fusion.png') });
    await page.locator('#b7').screenshot({ style:'.topbar,.sidebar,.skip{visibility:hidden!important}', path: path.join(shotDir, 'band7-splice.png') });
    await page.locator('#b9').screenshot({ style:'.topbar,.sidebar,.skip{visibility:hidden!important}', path: path.join(shotDir, 'band9-result.png') });
    for (const width of [1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1080 });
      await page.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));
      ok(`expanded content fits viewport at ${width}px`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    }
    await page.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = false));
    await page.setViewportSize({ width: 1024, height: 1080 });
    await page.goto(pathToFileURL(path.join(root, 'sim_pipeline_atlas.html')).href);
    await page.waitForFunction(() => window.SIMAtlasPage?.pipe?.ok);
    ok('desktop 1024px has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: path.join(shotDir, 'desktop-1024.png'), fullPage: false });
    await page.locator('#b4').screenshot({ style:'.topbar,.sidebar,.skip{visibility:hidden!important}', path: path.join(shotDir, 'desktop-1024-demix.png') });
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
