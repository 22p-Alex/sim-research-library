/* 生成《SIM 单方向学习指南》的配图与实测数据。
 * Run: node scripts/capture_sim_single_direction.cjs
 * 页面参数改动后重跑本脚本即可同步全部截图与 measurements.json。
 */
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.SIM_PLAYWRIGHT_DIR
  || '/Users/22p/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'output/sim-single-direction-guide');
fs.mkdirSync(outDir, { recursive: true });
const cache = path.join(os.homedir(), 'Library/Caches/ms-playwright');
const shell = fs.readdirSync(cache).filter(x => /^chromium_headless_shell-\d+$/.test(x))
  .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]))
  .map(x => path.join(cache, x, 'chrome-headless-shell-mac-arm64/chrome-headless-shell'))
  .find(x => fs.existsSync(x));

const SHOTS = [
  { file: '01-b1-spectrum.png', band: 'b1', sel: '#s1', sample: 'star', dir: '3' },
  { file: '01b-b2-illumination-arrows.png', band: 'b2', sel: '#s2a', sample: 'star', dir: '3' },
  { file: '02-b3-frames-1dir.png', band: 'b3', sel: '#s3a', sample: 'star', dir: '1' },
  { file: '02b-b3-frames-3dir.png', band: 'b3', sel: '#s3a', sample: 'star', dir: '3' },
  { file: '04-b7-support-1dir.png', band: 'b7', sel: '#s7', sample: 'star', dir: '1' },
  { file: '05-b7-support-3dir.png', band: 'b7', sel: '#s7', sample: 'star', dir: '3' },
  { file: '06-b9-image-1dir.png', band: 'b9', sel: '#s9', sample: 'star', dir: '1' },
  { file: '07-b9-image-3dir.png', band: 'b9', sel: '#s9', sample: 'star', dir: '3' },
];

/* 在 SIM-only 环带内按扇区量亮度标准差：真值各扇区相等，所以扇区间落差就是各向异性。
 * 必须读 SIMAtlasPage 的数据数组而不是 canvas 像素——imagePlate 会把橙色剖面线画进画布，
 * 在宽场这种本来平坦的区域里会凭空造出巨大方差。 */
const WEDGE = () => {
  const P = window.SIMAtlasPage;
  const planes = { truth: P.capture.truth.sample, wf: P.capture.truth.widefield, recon: P.pipe.pixels };
  const degs = [0, 45, 90, 135, 180, 225, 270, 315];
  const stat = (arr, deg) => {
    let s = 0, s2 = 0, c = 0;
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      const dx = x - 64, dy = y - 64, r = Math.hypot(dx, dy);
      if (r < 19 || r > 31) continue;
      let a = Math.atan2(dy, dx) * 180 / Math.PI; if (a < 0) a += 360;
      let d = Math.abs(a - deg); if (d > 180) d = 360 - d; if (d > 13) continue;
      const v = arr[y * 128 + x] * 255; s += v; s2 += v * v; c++;
    }
    return c ? +Math.sqrt(s2 / c - (s / c) ** 2).toFixed(1) : 0;
  };
  return degs.map(deg => ({ deg, truth: stat(planes.truth, deg), wf: stat(planes.wf, deg), recon: stat(planes.recon, deg) }));
};

/* 三方向细条纹样品：与每族条纹相位互相关，量调制幅度（0–255 标度，真值满对比应约 127）。
 * 周期 7.5 采集像素 = 128/7.5 = 17.07 格，而单方向支撑边缘在 8+10=18 格，
 * 所以这个样品用来讲"方向选择性"是失败的——三族全都落在恢复不出来的地方。 */
const GRATING_DISKS = [
  { name: '上盘 a=0°（竖条纹）', x: 64, y: 34, a: 0 },
  { name: '左下 a=60°', x: 34, y: 90, a: 60 },
  { name: '右下 a=120°', x: 94, y: 90, a: 120 },
];
const GRATING = (disks) => {
  const P = window.SIMAtlasPage;
  const planes = { truth: P.capture.truth.sample, wf: P.capture.truth.widefield, recon: P.pipe.pixels };
  const amp = (arr, d) => {
    const rad = d.a * Math.PI / 180;
    let sc = 0, ss = 0, c = 0;
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      if (Math.hypot(x - d.x, y - d.y) > 19) continue;
      const ph = 2 * Math.PI * (Math.cos(rad) * x + Math.sin(rad) * y) / 7.5;
      const v = arr[y * 128 + x] * 255; sc += v * Math.cos(ph); ss += v * Math.sin(ph); c++;
    }
    return +(2 * Math.hypot(sc, ss) / c).toFixed(1);
  };
  return disks.map(d => ({ name: d.name, truth: amp(planes.truth, d), wf: amp(planes.wf, d), recon: amp(planes.recon, d) }));
};

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.SIM_BROWSER_EXECUTABLE || shell });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route(/^https?:/, r => r.abort());
  await page.goto(pathToFileURL(path.join(root, 'sim_pipeline_atlas.html')).href);
  await page.waitForFunction(() => !!window.SIMAtlasPage?.pipe);

  const measurements = {};
  for (const dir of ['1', '3']) {
    await page.selectOption('#c-sample', 'star');
    await page.selectOption('#c-dir', dir);
    await page.waitForFunction(d => window.SIMAtlasPage.state.directions === Number(d), dir);
    await page.waitForTimeout(700);
    measurements[`dir${dir}`] = {
      wedges: await page.evaluate(WEDGE),
      frameCount: await page.evaluate(() => document.getElementById('frame-count').innerText.trim()),
      inspectOptions: await page.evaluate(() => [...document.querySelectorAll('#c-inspect option')]
        .map(o => ({ label: o.textContent.trim(), disabled: o.disabled }))),
      rmse: await page.evaluate(() => {
        const t = document.getElementById('status').innerText;
        return (t.match(/0\.\d+/g) || []).slice(0, 2);
      }),
    };
  }

  for (const dir of ['1', '3']) {
    await page.selectOption('#c-sample', 'gratings');
    await page.selectOption('#c-dir', dir);
    await page.waitForFunction(d => window.SIMAtlasPage.state.directions === Number(d), dir);
    await page.waitForTimeout(700);
    measurements[`gratings_dir${dir}`] = {
      disks: await page.evaluate(GRATING, GRATING_DISKS),
      rmse: await page.evaluate(() => (document.getElementById('status').innerText.match(/0\.\d+/g) || []).slice(0, 2)),
    };
  }

  for (const shot of SHOTS) {
    await page.selectOption('#c-sample', shot.sample);
    await page.selectOption('#c-dir', shot.dir);
    await page.waitForFunction(d => window.SIMAtlasPage.state.directions === Number(d), shot.dir);
    await page.waitForTimeout(500);
    // 先把整节滚进视野，再把目标图排定位到吸顶导航下方 96px 处。
    // 直接 locator.screenshot() 会把元素顶边对齐到视口顶部，正好被吸顶导航压住一块。
    await page.locator('#' + shot.band).scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    await page.evaluate(sel => {
      const el = document.querySelector(sel);
      window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 96);
    }, shot.sel);
    await page.waitForTimeout(250);
    await page.locator(shot.sel).screenshot({ path: path.join(outDir, shot.file) });
    console.log('shot', shot.file);
  }

  fs.writeFileSync(path.join(outDir, 'measurements.json'), JSON.stringify(measurements, null, 2));
  console.log('measurements', JSON.stringify(measurements, null, 2));
  if (errors.length) { console.error('PAGE ERRORS', errors); process.exitCode = 1; }
  await browser.close();
})();
