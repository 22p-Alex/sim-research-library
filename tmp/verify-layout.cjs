/* 一次性版式核验：确认本轮改动的三处没有溢出或被裁切。
 * Run: node tmp/verify-layout.cjs */
const path = require('node:path'), os = require('node:os'), fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.SIM_PLAYWRIGHT_DIR
  || '/Users/22p/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const cache = path.join(os.homedir(), 'Library/Caches/ms-playwright');
const shell = fs.readdirSync(cache).filter(x => /^chromium_headless_shell-\d+$/.test(x))
  .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]))
  .map(x => path.join(cache, x, 'chrome-headless-shell-mac-arm64/chrome-headless-shell'))
  .find(x => fs.existsSync(x));

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: shell });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route(/^https?:/, r => r.abort());
  await page.goto(pathToFileURL(path.join(root, 'sim_pipeline_atlas.html')).href);
  await page.waitForFunction(() => !!window.SIMAtlasPage?.pipe);

  const setSample = async v => { await page.selectOption('#c-sample', v); await page.waitForTimeout(600); };
  const set = async v => { await page.selectOption('#c-dir', v); await page.waitForFunction(x => window.SIMAtlasPage.state.directions === Number(x), v); await page.waitForTimeout(600); };
  const report = async (label, sel) => {
    const info = await page.evaluate(s => {
      const el = document.querySelector(s);
      if (!el) return { missing: true };
      const b = el.getBoundingClientRect();
      const kids = [...el.children].map(c => {
        const r = c.getBoundingClientRect();
        return { tag: c.tagName, left: Math.round(r.left - b.left), right: Math.round(b.right - r.right), w: Math.round(r.width) };
      });
      return { w: Math.round(b.width), h: Math.round(b.height), overflowX: el.scrollWidth > el.clientWidth + 1, kids };
    }, sel);
    console.log(label, JSON.stringify(info));
  };

  await setSample('star');
  for (const dir of ['1', '3']) {
    await set(dir);
    console.log('--- directions =', dir, '---');
    await report('s2a', '#s2a');
    await report('s3a', '#s3a');
    await report('s9d', '#s9d');
    await report('c9', '#c9');
  }
  await set('3');
  await report('frequency-journey', '.frequency-journey');
  await page.locator('.frequency-journey').scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await page.locator('#shift-example').screenshot({ path: path.join(root, 'tmp/verify-frequency-journey.png') });
  await page.locator('#s2a').scrollIntoViewIfNeeded();
  await page.locator('#s2a').screenshot({ path: path.join(root, 'tmp/verify-s2a.png') });
  console.log('errors', errors);
  await browser.close();
})();
