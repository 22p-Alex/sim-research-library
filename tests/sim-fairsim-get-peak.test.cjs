/* Local fairSIM source oracle plus independent Fourier/parameter checks.
 * No browser, remote dependency or visual acceptance is involved. */
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { execFileSync } = require('node:child_process');
const E = require('../web/shared/sim-parameter-estimation.js');
const A = require('../web/atlas/sim-atlas-core.js');
const near = (a, b, eps = 1e-10) => assert.ok(Number.isFinite(a) && Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b)), `${a} != ${b}`);

function fixture(n = 32, cutoff = 10) {
  const bands = [0, 1].map(b => ({
    re: Float64Array.from({ length: n * n }, (_, i) => Math.fround(.4 + Math.sin(i * .73 + b * .8))),
    im: Float64Array.from({ length: n * n }, (_, i) => Math.fround(.2 + Math.cos(i * .43 + b * 1.1))),
  }));
  return { config: { n, cutoff }, separated: { bands } };
}

test('final commonRegion masks and getPeak agree with the unmodified local Java source', t => {
  try { execFileSync('javac', ['-version'], { stdio: 'pipe', timeout: 10000 }); }
  catch { t.skip('JDK is needed for the local fairSIM source oracle'); return; }
  const root = path.resolve(__dirname, '..'), source = path.join(root, 'Wiener-SIM/fairSIM-src/fairSIM/src/main/java');
  const adapter = path.join(__dirname, 'fairsim-reference'), build = fs.mkdtempSync(path.join(os.tmpdir(), 'fairsim-peak-reference-'));
  try {
    execFileSync('javac', ['-d', build, '-sourcepath', source + path.delimiter + adapter,
      path.join(adapter, 'PeakReference.java'), path.join(adapter, 'JTransformsConnector.java'),
      path.join(source, 'org/fairsim/linalg/BasicVectors.java')], { stdio: 'pipe', timeout: 60000 });
    const ctx = fixture(), n = ctx.config.n;
    for (const [kx, ky] of [[8, 0], [4, 7], [-6, -5], [6.23, -4.17], [-4.71, 6.19]]) {
      const input = Buffer.alloc(28 + 16 * n * n); let offset = 0;
      input.writeInt32BE(n, offset); offset += 4;
      for (const value of [ctx.config.cutoff, kx, ky]) { input.writeDoubleBE(value, offset); offset += 8; }
      for (const band of ctx.separated.bands) for (let i = 0; i < n * n; i++) {
        input.writeFloatBE(band.re[i], offset); input.writeFloatBE(band.im[i], offset + 4); offset += 8;
      }
      const inFile = path.join(build, 'input.bin'), outFile = path.join(build, 'output.bin');
      fs.writeFileSync(inFile, input);
      execFileSync('java', ['-Djava.awt.headless=true', '-cp', build, 'PeakReference', inFile, outFile], { stdio: 'pipe', timeout: 30000 });
      const output = fs.readFileSync(outFile), peak = E.fairSimGetPeak(ctx, kx, ky);
      assert.equal(peak.valid, true); near(peak.alpha.re, output.readDoubleBE(0), 3e-6); near(peak.alpha.im, output.readDoubleBE(8), 3e-6);
      offset = 16;
      for (let b = 0; b < 2; b++) for (let i = 0; i < n * n; i++) {
        const re = output.readFloatBE(offset), im = output.readFloatBE(offset + 4); offset += 8;
        assert.equal(peak.masks[b][i], re !== 0 || im !== 0 ? 1 : 0, `source mask differs at b=${b}, i=${i}, k=${kx},${ky}`);
        near(peak.prepared[b].re[i], re, 3e-6); near(peak.prepared[b].im[i], im, 3e-6);
      }
    }
  } finally { fs.rmSync(build, { recursive: true, force: true }); }
});

test('the spatial product preserves phase sign and Fourier normalization independently of FFT code', () => {
  const ctx = fixture(16, 6), n = ctx.config.n, peak = E.fairSimGetPeak(ctx, 4.2, -2.3);
  const saved = ctx.separated.bands.map(z => ({ re: z.re.slice(), im: z.im.slice() }));
  // Direct DFT reference: no production FFT/shift routine is called.
  const direct = peak.prepared.map(z => {
    const out = { re: new Float64Array(n * n), im: new Float64Array(n * n) };
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const r = y * n + x;
      for (let fy = 0; fy < n; fy++) for (let fx = 0; fx < n; fx++) {
        const f = fy * n + fx, angle = 2 * Math.PI * (fx * x + fy * y) / n;
        out.re[r] += (z.re[f] * Math.cos(angle) - z.im[f] * Math.sin(angle)) / (n * n);
        out.im[r] += (z.re[f] * Math.sin(angle) + z.im[f] * Math.cos(angle)) / (n * n);
      }
    }
    return out;
  });
  let re = 0, im = 0, energy = 0, target = 0;
  for (let i = 0; i < n * n; i++) {
    const u = direct[0], v = direct[1], theta = -2 * Math.PI * (4.2 * (i % n) - 2.3 * Math.floor(i / n)) / n;
    const br = v.re[i] * Math.cos(theta) - v.im[i] * Math.sin(theta), bi = v.re[i] * Math.sin(theta) + v.im[i] * Math.cos(theta);
    re += u.re[i] * br + u.im[i] * bi; im += u.re[i] * bi - u.im[i] * br;
    energy += u.re[i] ** 2 + u.im[i] ** 2; target += br ** 2 + bi ** 2;
    near(peak.sums[i + 1].re, re); near(peak.sums[i + 1].im, im); near(peak.sums[i + 1].energy, energy);
    near(peak.shifted.re[i], br); near(peak.shifted.im[i], bi);
  }
  near(peak.alpha.re, re / energy); near(peak.alpha.im, im / energy); near(peak.targetEnergy, target);
  for (let b = 0; b < 2; b++) {
    const frequencyEnergy = peak.prepared[b].re.reduce((s, value, i) => s + value ** 2 + peak.prepared[b].im[i] ** 2, 0);
    near(frequencyEnergy / (n * n), b === 0 ? energy : target);
  }
  assert.deepEqual(ctx.separated.bands, saved);
});

test('integer shifts match a direct frequency inner product over the actual final masks', () => {
  for (const [kx, ky] of [[8, 0], [-4, 7], [6, -5]]) {
    const ctx = fixture(), p = E.fairSimGetPeak(ctx, kx, ky), n = p.n;
    let re = 0, im = 0, energy = 0;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const i = y * n + x, j = A.idx(x + kx, y + ky, n), a = p.prepared[0], b = p.prepared[1];
      re += a.re[i] * b.re[j] + a.im[i] * b.im[j]; im += a.re[i] * b.im[j] - a.im[i] * b.re[j];
      energy += a.re[i] ** 2 + a.im[i] ** 2;
    }
    near(p.cross.re * n * n, re); near(p.cross.im * n * n, im); near(p.referenceEnergy * n * n, energy);
    near(p.alpha.re, re / energy); near(p.alpha.im, im / energy);
  }
});

test('integer and fractional finite Fourier evaluations give the same final ratio in both domains', () => {
  const ctx = fixture(16, 6), n = ctx.config.n;
  for (const [kx, ky] of [[4, 0], [4.2, -2.3], [-3.37, 3.19]]) {
    const p = E.fairSimGetPeak(ctx, kx, ky), a = p.prepared[0], v = p.spatial[1];
    assert.equal(p.valid, true);
    let re = 0, im = 0, energy = 0;
    // Evaluate the finite forward Fourier sum at q+k directly. In particular,
    // fractional q+k is never rounded into an array index or sent to A.shift.
    for (let qy = 0; qy < n; qy++) for (let qx = 0; qx < n; qx++) {
      const q = qy * n + qx; let br = 0, bi = 0;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const r = y * n + x, angle = -2 * Math.PI * ((qx + kx) * x + (qy + ky) * y) / n;
        br += v.re[r] * Math.cos(angle) - v.im[r] * Math.sin(angle);
        bi += v.re[r] * Math.sin(angle) + v.im[r] * Math.cos(angle);
      }
      re += a.re[q] * br + a.im[q] * bi; im += a.re[q] * bi - a.im[q] * br;
      energy += a.re[q] ** 2 + a.im[q] ** 2;
    }
    near(re, n * n * p.cross.re); near(im, n * n * p.cross.im);
    near(energy, n * n * p.referenceEnergy);
    near(re / energy, p.alpha.re); near(im / energy, p.alpha.im);
  }
});

test('the final source coefficient supplies all adopted phases and modulations without changing raw data', () => {
  const c = E.capture({ vectors: [[6, -5], [-4, 7]], offsets: [-.72, .55], m: .67 });
  c.raw.groups.forEach((g, d) => g.frames.forEach((f, j) => f.pixels.forEach((_, i) => { f.pixels[i] += .002 * Math.sin(i * .37 + j * .81 + d); })));
  const originals = c.raw.groups.map(g => g.frames.map(f => f.pixels.slice()));
  Object.defineProperty(c.raw, 'truth', { get() { throw new Error('accessed generation truth'); } });
  const result = E.estimateDataset(c.raw, c.config);
  assert.equal(result.ok, true);
  const output = E.reconstructDataset(c.raw, result);
  result.estimates.forEach((e, d) => {
    const p = e.finalPeak;
    near(e.m, Math.hypot(p.cross.re, p.cross.im) / p.referenceEnergy);
    near(e.phase, Math.atan2(p.cross.im, p.cross.re));
    near(output.parameters[d].m, p.m); near(output.parameters[d].phase, p.phase);
    e.phases.forEach((phase, j) => near(phase, c.config.nominalPhases[j] + p.phase));
    assert.ok(Math.hypot(p.alpha.re - e.fit.alpha.re, p.alpha.im - e.fit.alpha.im) > 1e-8, 'noise distinguishes the final source masks from the old search masks');
    c.raw.groups[d].frames.forEach((f, j) => assert.deepEqual(f.pixels, originals[d][j]));
  });
});

test('final preparation is once from untouched bands and excludes zero or weak OTF before division', () => {
  const ctx = fixture(), saved = ctx.separated.bands.map(z => ({ re: z.re.slice(), im: z.im.slice() }));
  const p = E.fairSimGetPeak(ctx, 8, 0), second = E.fairSimGetPeak(ctx, 8, 0);
  assert.deepEqual(ctx.separated.bands, saved); assert.deepEqual(p.alpha, second.alpha);
  assert.equal(p.threshold, .05); assert.equal(p.distanceFraction, .15);
  p.masks.forEach((mask, b) => mask.forEach((retained, i) => {
    const h = A.otf(A.bin(i % p.n, p.n), A.bin(Math.floor(i / p.n), p.n), ctx.config.cutoff);
    for (const component of ['re', 'im']) near(p.prepared[b][component][i], retained ? saved[b][component][i] / h : 0);
  }));
  ctx.separated.bands.forEach(z => { z.re.fill(0); z.im.fill(0); });
  const dark = E.fairSimGetPeak(ctx, 8, 0);
  assert.equal(dark.valid, false); assert.deepEqual(dark.alpha, { re: 0, im: 0 });
  assert.throws(() => E.fairSimGetPeak(ctx, 0, 0), /波矢/);
});
