const test = require('node:test'), assert = require('node:assert/strict');
const C = require('../sim-core'), A = require('../sim-atlas-core');
const N = A.N;
const take = p => A.capture({ sample: 'star-points', directions: 3, noise: 'none', m: .8, ...p });
test('siemens star still spans three frequency zones after fairSIM apodization', () => {
  const cap = take(), p = A.pipeline(cap.raw, cap.calibration, { eps: 0 }, .8);
  const wf = A.radialProfile(cap.truth.widefield), sm = A.radialProfile(p.pixels);
  const by = z => wf.map((r, i) => [r, sm[i]]).filter(([r]) => A.zoneOf(r.localPeriod) === z);
  const beyond = by('beyond'), simOnly = by('sim-only'), wide = by('widefield');
  assert.ok(beyond.length && simOnly.length && wide.length, 'all three zones sampled');
  for (const [r, q] of simOnly) {
    assert.ok(r.contrast < .05, `widefield must lose the SIM-only ring at r=${r.r}`);
    assert.ok(q.contrast > r.contrast, `SIM carries more angular signal in the extended ring at r=${r.r}`);
  }
  for (const [r] of beyond) assert.ok(r.contrast < .05, 'widefield loses the beyond ring too');
  assert.equal(p.outputPixels.length, 256 * 256);
  assert.ok(p.pixels.every(Number.isFinite));
});
test('star local period crosses both limits at the designed radii', () => {
  assert.equal(A.zoneOf(6), 'beyond');
  assert.equal(A.zoneOf(12), 'sim-only');
  assert.equal(A.zoneOf(20), 'widefield');
  assert.ok(A.SIM_LIMIT < A.CUTOFF_PERIOD);
});
test('separated zero order equals the m=0 forward spectrum exactly', () => {
  const cap = take(), p = A.pipeline(cap.raw, cap.calibration, { eps: 0 }, .8);
  const zero = cap.truth.widefield;
  const z0 = A.spectrum(zero, N), s0 = p.groups[0].separated[0];
  let d = 0;
  for (let i = 0; i < N * N; i++) d = Math.max(d, Math.abs(s0.re[i] - z0.re[i]), Math.abs(s0.im[i] - z0.im[i]));
  assert.ok(d < 1e-9, `zero order deviates by ${d}`);
});
test('band shift is an exact round trip on integer vectors', () => {
  const cap = take(), p = A.pipeline(cap.raw, cap.calibration, { eps: 0 }, .8);
  const z = p.groups[0].separated[1];
  const back = A.shift(A.shift(z, 8, 0), -8, 0);
  let d = 0;
  for (let i = 0; i < N * N; i++) d = Math.max(d, Math.abs(back.re[i] - z.re[i]), Math.abs(back.im[i] - z.im[i]));
  assert.ok(d < 1e-12);
});
test('shifted sideband energy moves to the support lobe, not the origin', () => {
  const cap = take(), p = A.pipeline(cap.raw, cap.calibration, { eps: 0 }, .8);
  const cent = q => {
    let sx = 0, sy = 0, w = 0; const n = Math.sqrt(q.re.length);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const m = Math.hypot(q.re[y * n + x], q.im[y * n + x]);
      sx += m * A.bin(x, n); sy += m * A.bin(y, n); w += m;
    }
    return [sx / w, sy / w];
  };
  const before = cent(p.groups[0].separated[1]), after = cent(p.groups[0].bands[1].shifted);
  assert.ok(Math.hypot(...before) < 3, 'demixed +1 band sits near the detector origin');
  assert.ok(Math.abs(after[0] + 8) < 1.5 && Math.abs(after[1]) < 1.5, `shifted lobe at ${after}`);
});
test('probe reports the three mixed components and their shift targets', () => {
  const cap = take(), p = A.pipeline(cap.raw, cap.calibration, { eps: 0 }, .8);
  const pr = A.probe(p, 0, 70, 64);
  assert.equal(pr.observed.length, 3);
  assert.deepEqual(pr.orders.map(o => o.order), [0, 1, -1]);
  for (let j = 0; j < 3; j++) {
    const i = A.idx(70, 64);
    assert.ok(Math.abs(pr.observed[j].re - p.groups[0].rawSpectra[j].re[i] / (N * N)) < 1e-12);
  }
  // +1 order of direction 0 lands 8 bins left of the detector bin
  assert.equal(pr.orders[1].specimenBin.raw[0], 70 - 8);
  assert.ok(pr.orders[1].h === 0 || pr.orders[1].h > 0);
});
test('single direction still reconstructs and covers less', () => {
  const cap1 = take({ directions: 1 }), p1 = A.pipeline(cap1.raw, cap1.calibration, { eps: 0 }, .8);
  const cap3 = take(), p3 = A.pipeline(cap3.raw, cap3.calibration, { eps: 0 }, .8);
  assert.equal(p1.reason, 'sim');
  assert.equal(p1.bands.length, 3);
  assert.equal(p3.bands.length, 9);
  assert.ok(C.rmse(p1.pixels, cap1.truth.sample) > C.rmse(p3.pixels, cap3.truth.sample),
    'one direction must recover less than three');
});
test('mismatch flows into fusion and the scope switch changes the outcome', () => {
  const cap = take();
  const base = A.pipeline(cap.raw, cap.calibration, { eps: 0 }, .8);
  const hurt = A.pipeline(cap.raw, cap.calibration, { eps: 0, angleError: 3, errorsAffectEstimator: false }, .8);
  assert.ok(C.rmse(hurt.pixels, base.pixels) > .001, 'mismatch must change the computed output');
  const screened = A.pipeline(cap.raw, cap.calibration, { eps: 0, angleError: 3 }, undefined);
  assert.ok(screened.estimates.some(e => !e.ok), 'external estimator reports its failure');
  assert.ok(screened.groups.some(g => g.fallback && g.m === .65), 'fairSIM applies its modulation fallback instead of dropping a band');
});
test('duplicate phases are reported as uninvertible, never silently fused', () => {
  const cap = take({ phases: 'duplicate' });
  const p = A.pipeline(cap.raw, cap.calibration, { eps: 0 }, .8);
  assert.equal(p.ok, false);
  assert.equal(p.reason, 'phase-rank');
});
test('legacy gratings sample still builds for the contrast panel', () => {
  const cap = A.capture({ sample: 'gratings', directions: 3, noise: 'none' });
  const p = A.pipeline(cap.raw, cap.calibration, { eps: 0 }, .8);
  assert.equal(p.reason, 'sim');
  // isolated-line spectrum: the star-only zone logic must not claim recovery here
  const wf = A.radialProfile(cap.truth.widefield);
  assert.ok(wf.every(r => Number.isFinite(r.contrast)));
});

test('probe uses signed frequencies and the detector OTF for every separated order', () => {
  const cap = take();
  const p = A.pipeline(cap.raw, cap.calibration, { angleError: 3, otfError: .1, errorsAffectEstimator: false }, .8);
  for (const [x, y] of [[6, 0], [N - 3, 4], [20, 0]]) {
    const pr = A.probe(p, 1, x, y), g = p.groups[1];
    const fx = A.bin(x), fy = A.bin(y), H = A.otf(fx, fy, p.cutoff);
    for (const o of pr.orders) {
      assert.deepEqual(o.specimenFrequency, [fx - o.order * g.kx, fy - o.order * g.ky]);
      assert.equal(o.h, H, 'every component at the same detector point shares H(f)');
      assert.ok(Math.abs(o.transfer - H) < 1e-12);
    }
  }
});

test('displayed effective transfer predicts the matched reconstruction spectrum', () => {
  const cap = take();
  const p = A.pipeline(cap.raw, cap.calibration, { eps: .08 }, .8);
  const truth = A.padSpectrum(cap.truth.spectrum);
  let maxError = 0;
  for (let i = 0; i < p.spectrum.re.length; i++) {
    const G = p.effectiveTransfer[i];
    assert.ok(G >= 0 && G <= 1);
    maxError = Math.max(maxError, Math.abs(p.spectrum.re[i] - G * truth.re[i]), Math.abs(p.spectrum.im[i] - G * truth.im[i]));
    assert.ok(Math.abs(p.regularizedDenominator[i] - p.denominator[i] - .08 ** 2) < 1e-12);
  }
  assert.ok(maxError < 1e-8, `matched transfer prediction error ${maxError}`);
  const ideal = A.pipeline(cap.raw, cap.calibration, { eps: 0 }, .8);
  assert.ok(ideal.effectiveTransfer[A.idx(15, 0)] > 0 && ideal.effectiveTransfer[A.idx(15, 0)] < 1, 'apodization still reduces the edge when w=0');
  assert.ok(ideal.effectiveTransfer[0] < .6, 'retain the original zero-order denominator counting');
  assert.equal(ideal.effectiveTransfer[A.idx(24, 0)], 0);
  const unmodulated = take({ m: 0 });
  const zero = A.pipeline(unmodulated.raw, unmodulated.calibration, { eps: 0 }, 0);
  assert.ok(Math.hypot(zero.spectrum.re[15], zero.spectrum.im[15]) < 1e-9, 'without illumination modulation no high-frequency measurement can be invented');
  assert.ok(zero.groups.every(g => g.fallback && g.m === .65));
});

test('worked probe products, cancellation and remixing agree with demixing on noisy data', () => {
  const cap = take({ noise: 'low' });
  const p = A.pipeline(cap.raw, cap.calibration, { phaseError: Math.PI / 12 }, .8);
  const probe = A.probe(p, 0, 6, 0);
  for (const [i, o] of probe.orders.entries()) {
    const re = o.products.reduce((s, z) => s + z.re, 0), im = o.products.reduce((s, z) => s + z.im, 0);
    assert.ok(Math.abs(re - o.value.re) < 1e-14 && Math.abs(im - o.value.im) < 1e-14);
    for (const [j, z] of o.responses.entries()) {
      assert.ok(Math.abs(z.re - (i === j ? 1 : 0)) < 1e-14 && Math.abs(z.im) < 1e-14);
    }
  }
  assert.ok(probe.closureError < 1e-14, 'even noisy three-equation observations close algebraically');
});


test('noise is injected in acquisition and does not add a new fusion weight', () => {
  const a = take(), b = take({noise:'low'});
  const p = A.pipeline(a.raw, a.calibration, {}, .8), q = A.pipeline(b.raw, b.calibration, {}, .8);
  assert.deepEqual(p.denominator, q.denominator);
  assert.ok(C.rmse(p.pixels, q.pixels) > 1e-4);
});
test('modulation is compensated once during band separation', () => {
  const a = take({m:.4}), b = take({m:.8});
  const p = A.pipeline(a.raw,a.calibration,{},.4), q = A.pipeline(b.raw,b.calibration,{},.8);
  for (let d=0;d<3;d++) for(let band=0;band<3;band++) {
    const u=p.groups[d].separated[band], v=q.groups[d].separated[band];
    assert.ok(C.rmse(u.re,v.re)<1e-10);
    assert.ok(C.rmse(u.im,v.im)<1e-10);
  }
  assert.ok(C.rmse(p.pixels,q.pixels)<1e-12);
});
test('display intensity scale and metric grid are explicit, not fitted to truth', () => {
  const c=take(),p=A.pipeline(c.raw,c.calibration,{},.8);
  for(let y=0;y<N;y++)for(let x=0;x<N;x++) {
    const i=(2*y)*2*N+2*x;
    assert.equal(p.pixels[y*N+x],4*p.outputNative[i]);
  }
  const stronger=A.pipeline(c.raw,c.calibration,{apoBend:1.2},.8);
  assert.deepEqual(p.numerator,stronger.numerator);
  assert.deepEqual(p.preApoSpectrum,stronger.preApoSpectrum);
  assert.ok(C.rmse(p.pixels,stronger.pixels)>1e-4);
});
