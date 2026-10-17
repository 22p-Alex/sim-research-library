/* Numerical, equations, and simulated DOM wiring only. No browser/visual QA. */
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const E = require('../web/shared/sim-parameter-estimation.js');
const M = require('../web/parameter-demo/sim-parameter-model.js');
const A = require('../web/atlas/sim-atlas-core.js');
const SharedNotation = require('../web/shared/sim-band-formulas.js'), BandFormulas = SharedNotation.formulas;
const Motion = require('../web/motion/sim-motion-model.js');
const katex = require('../vendor/katex/katex.min.js');
const lesson = M.createLesson(), capture = lesson.capture, e = lesson.estimate;
const near = (a, b, eps = 1e-10) => assert.ok(Number.isFinite(a) && Math.abs(a - b) < eps, a + ' != ' + b);
const nearRelative = (a, b, eps = 1e-10) => near(a, b, eps * Math.max(1, Math.abs(a), Math.abs(b)));
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('nine fixed exposures obey the same sample, OTF and nonzero common phase model', () => {
  assert.equal(capture.raw.groups.length, 3); const n = capture.raw.n;
  for (const group of capture.raw.groups) {
    const [kx, ky] = capture.truth.vectors[group.index];
    assert.equal(group.frames.length, 3);
    for (const [j, frame] of group.frames.entries()) {
      assert.deepEqual(Object.keys(frame), ['index', 'pixels'], 'actual phase must not leak into the estimator input');
      const light = capture.truth.illumination[group.index][j];
      for (const [x, y] of [[0, 0], [47, 81], [100, 80]]) near(light[y * n + x], 1 + capture.truth.m * Math.cos(2 * Math.PI * (kx * x + ky * y) / n + 2 * Math.PI * j / 3 + capture.truth.offsets[group.index]));
      const emission = A.spectrum(Float64Array.from(capture.truth.sample, (s, i) => s * light[i]), n), observed = A.spectrum(frame.pixels, n);
      for (const [fx, fy] of [[0, 0], [2, 3], [-4, 1], [12, 0]]) {
        const i = A.idx(fx, fy, n), h = A.otf(fx, fy); near(observed.re[i], emission.re[i] * h, 1e-9); near(observed.im[i], emission.im[i] * h, 1e-9);
      }
    }
  }
});

test('wave vector, phase and modulation come from frames, without calibrated illumination metadata', () => {
  for (const group of capture.raw.groups) {
    const input = { index: group.index, frames: group.frames.map(frame => {
      const copy = { index: frame.index, pixels: frame.pixels };
      Object.defineProperty(copy, 'phase', { get() { throw new Error('truth phase accessed'); } }); return copy;
    }) };
    for (const key of ['angle', 'period', 'm', 'kx', 'ky', 'truth']) Object.defineProperty(input, key, { get() { throw new Error('truth accessed'); } });
    const estimated = E.estimate(input, capture.config); assert.equal(estimated.ok, true);
    near(estimated.kx, capture.truth.vectors[group.index][0]); near(estimated.ky, capture.truth.vectors[group.index][1]);
    near(estimated.phase, capture.truth.offsets[group.index]); near(estimated.m, capture.truth.m);
  }
  // An independent on-grid case guards against returning the demonstration constants.
  const alternate = E.capture({ vectors: [[6, -5]], offsets: [1.1], m: .63 });
  const actual = E.estimate(alternate.raw.groups[0], alternate.config);
  assert.equal(actual.ok, true); near(actual.kx, 6); near(actual.ky, -5); near(actual.phase, 1.1); near(actual.m, .63);
});

test('an external lesson reuses raw observations, needs no truth, and exports the reconstruction handoff', () => {
  const frames = capture.raw.groups[1].frames.map(frame => {
    const input = { index: frame.index, pixels: frame.pixels };
    Object.defineProperty(input, 'phase', { get() { throw new Error('frame phase truth accessed'); } });
    return input;
  });
  const group = { index: 17, frames }, raw = { n: capture.config.n, groups: [group] };
  for (const target of [raw, group]) for (const key of ['phase', 'angle', 'period', 'm', 'kx', 'ky', 'truth']) {
    Object.defineProperty(target, key, { get() { throw new Error('raw illumination truth accessed'); } });
  }
  const originalCapture = E.capture;
  E.capture = () => { throw new Error('external lesson regenerated observations'); };
  let external;
  try { external = M.createLesson({ raw, config: capture.config }); } finally { E.capture = originalCapture; }
  assert.equal(external.audit == null, true, 'the estimation chapter does not compute a truth audit');
  assert.equal(Object.hasOwn(external, 'contributions'), false); assert.equal(Object.hasOwn(external, 'relocation'), false);
  assert.equal(external.capture.raw, raw); assert.equal(external.group, group); assert.equal(external.direction, 0);
  const result = M.getResult(external);
  assert.equal(result.direction, 17); assert.equal(result.rawGroup, group);
  assert.equal(result.provisionalBands, external.estimate.context.separated.bands);
  assert.equal(result.formalGroup, external.bridge.pipeline.groups[0]);
  frames.forEach((frame, j) => {
    assert.equal(result.rawGroup.frames[j].pixels, capture.raw.groups[1].frames[j].pixels);
    assert.equal(external.bridge.pipeline.raw.groups[0].frames[j].pixels, frame.pixels);
    near(result.phases[j], capture.config.nominalPhases[j] + result.phase);
  });
  const independent = E.estimate(group, capture.config);
  ['kx', 'ky', 'phase', 'm', 'angle', 'period'].forEach(key => near(result[key], independent[key]));
  assert.deepEqual(result.convention.bandOrders, [0, 1, -1]);
  assert.equal(result.convention.positiveBandPhaseSign, 1); assert.equal(result.convention.forwardExponent, -1);
  assert.equal(result.convention.yAxis, 'down'); assert.match(result.convention.positiveBand, /exp\(\+i phase\)/);
  assert.throws(() => M.createLesson({ raw }), /raw.*config/);
  assert.equal(M.createLesson({ capture }).capture, capture, 'the existing capture input remains supported');
});

test('temporary bands preserve the unknown complex factor with the documented sign and factor of two', () => {
  const { bands } = e.context.separated, n = capture.raw.n, d = lesson.direction, [kx, ky] = capture.truth.vectors[d];
  for (const [f0, f1] of [[0, 0], [2, 3], [-2, 4], [6, 0]]) {
    const i = A.idx(f0, f1), q = A.idx(f0 - kx, f1 - ky), h = A.otf(f0, f1);
    const z = capture.truth.spectrum, a = capture.truth.m * Math.cos(capture.truth.offsets[d]), b = capture.truth.m * Math.sin(capture.truth.offsets[d]);
    near(bands[0].re[i], h * z.re[i], 1e-9); near(bands[0].im[i], h * z.im[i], 1e-9);
    near(bands[1].re[i], h * (a * z.re[q] - b * z.im[q]), 1e-9); near(bands[1].im[i], h * (a * z.im[q] + b * z.re[q]), 1e-9);
  }
});

test('each displayed score and fitted complex ratio obey the actual overlap sums', () => {
  assert.ok(e.fit.count >= capture.config.minPoints);
  for (const fit of [...lesson.candidates, e.fit]) {
    let xx = 0, yy = 0, re = 0, im = 0;
    for (const p of fit.points) {
      assert.ok(p.h0 >= capture.config.minH && p.h1 >= capture.config.minH);
      xx += p.x.re ** 2 + p.x.im ** 2; yy += p.y.re ** 2 + p.y.im ** 2;
      re += p.x.re * p.y.re + p.x.im * p.y.im; im += p.x.re * p.y.im - p.x.im * p.y.re;
    }
    near(fit.score, Math.hypot(re, im) / Math.sqrt(xx * yy)); near(fit.alpha.re, re / xx); near(fit.alpha.im, im / xx);
  }
  assert.ok(lesson.candidates.slice(0, 2).every(candidate => candidate.score < lesson.candidates[2].score)); near(lesson.candidates[2].score, 1);
  e.rounds.forEach(round => {
    assert.equal(round.candidates.length, 25);
    assert.ok(round.candidates.some(c => c.kx === round.center.kx && c.ky === round.center.ky));
    const candidate = round.candidates[7], independent = E.compare(e.context, candidate.kx, candidate.ky);
    near(candidate.score, independent.score); assert.ok(round.best.score >= candidate.score - 1e-14);
  });
});

test('the zero-extended teaching sequence computes 2, 12, 21, 12, 2 and keeps peak height separate from displacement', () => {
  const toy = M.createTeachingExample();
  assert.deepEqual(toy.real.map(c => c.score), [2, 12, 21, 12, 2]);
  toy.real.forEach(c => {
    const products = toy.frequencies.map(f => (toy.u[f] || 0) * (toy.v[f + c.delta] || 0));
    assert.deepEqual(c.products, products); near(c.score, products.reduce((a, b) => a + b, 0));
  });
  const winner = toy.real.reduce((a, b) => b.score > a.score ? b : a);
  assert.equal(winner.delta, 2); assert.equal(winner.score, 21);
  for (let i = 0; i <= 1000; i++) {
    const s = M.realCorrelationState(i / 1000);
    assert.ok(s.candidate >= 0 && s.candidate <= 4 && s.products >= 0 && s.products <= 7);
    if (s.table > 0) near(s.shift, s.candidate);
    if (s.score > 0) assert.equal(s.products, 7);
    if (s.best > 0) assert.equal(s.completed, 5);
  }
  near(M.realCorrelationState(1).shift, winner.delta);
});

test('a common unknown phase and amplitude preserve normalized scores for every tested candidate', () => {
  const ctx = e.context, candidates = [[e.kx - 2, e.ky], [e.kx - 1, e.ky], [e.kx, e.ky], [e.kx + .25, e.ky]];
  const baseline = candidates.map(k => E.compare(ctx, ...k));
  for (const gain of [.4, .75, 1.1]) for (const phase of [-1.4, 0, 2.3]) {
    const ar = gain * Math.cos(phase), ai = gain * Math.sin(phase);
    const bands = ctx.separated.bands.map((z, j) => j !== 1 ? z : {
      re: Float64Array.from(z.re, (r, i) => ar * r - ai * z.im[i]),
      im: Float64Array.from(z.im, (v, i) => ai * z.re[i] + ar * v),
    });
    const changed = { ...ctx, separated: { ...ctx.separated, bands } };
    const scores = candidates.map((k, j) => {
      const before = baseline[j], after = E.compare(changed, ...k);
      assert.equal(after.valid, before.valid);
      near(after.cross.re, ar * before.cross.re - ai * before.cross.im, 1e-6);
      near(after.cross.im, ai * before.cross.re + ar * before.cross.im, 1e-6);
      near(Math.hypot(after.cross.re, after.cross.im) / Math.hypot(before.cross.re, before.cross.im), gain);
      near(after.score, before.score);
      return after.score;
    });
    assert.equal(scores.indexOf(Math.max(...scores)), 2);
  }
});

test('the one-dimensional complex lesson keeps amplitudes, shifts, conjugation and accumulation connected', () => {
  const example = M.createComplexTeachingExample();
  assert.deepEqual(example.u, lesson.teaching.u);
  assert.equal(example.shift, 2); near(example.commonPhase, Math.PI / 6);
  const scores = Array.from({length: 5}, (_, delta) => {
    let re = 0, im = 0;
    for (const q of example.frequencies) {
      const x = example.zero[q] || { re: 0, im: 0 }, y = example.side[q + delta] || { re: 0, im: 0 };
      re += x.re * y.re + x.im * y.im; im += x.re * y.im - x.im * y.re;
    }
    return Math.hypot(re, im);
  });
  assert.equal(scores.indexOf(Math.max(...scores)), 2); near(scores[2], 21);
  near(example.magnitude, 21); near(Math.atan2(example.sums[3].im, example.sums[3].re), Math.PI / 6);
  for (const column of example.columns) {
    near(Math.hypot(column.x.re, column.x.im), column.amplitude);
    near(Math.hypot(column.y.re, column.y.im), column.amplitude);
    if (column.amplitude) {
      near(Math.hypot(column.cross.re, column.cross.im), column.amplitude ** 2);
      near(Math.atan2(column.cross.im, column.cross.re), Math.PI / 6);
    }
  }
  const samples = [0, .04, .18, .22, .32, .38, .47, .53, .6, .7, .81, .85, .94, 1];
  const snapshots = samples.map(p => M.complexState(p));
  samples.toReversed().forEach((p, i) => assert.deepEqual(M.complexState(p), snapshots[snapshots.length - i - 1]));
  for (let i = 0; i <= 1000; i++) {
    const p = i / 1000, s = M.stateForScene('conjugate', p), c = s.complex;
    for (const key of ['phaseReveal', 'conjugate', 'multiply', 'accumulation', 'productReveal', 'commit', 'measure']) assert.ok(c[key] >= 0 && c[key] <= 1);
    if (c.conjugate > 0) near(c.phaseReveal, 1);
    if (c.multiply > 0) near(c.conjugate, 1);
    if (c.accumulation > 0) near(c.multiply, 1);
    if (c.measure > 0) assert.equal(c.completed, 3);
    const formula = M.complexSteps.find(step => step.id === c.phase);
    assert.equal(M.formulaAt(s).equation, formula.equation);
    assert.doesNotMatch(formula.equation, /\\arg|\\pmod/);
    assert.match(formula.equation, /\\sum/);
  }
});

test('the complex contrast uses the same actual frequency points and keeps multiplication, addition and magnitude distinct', () => {
  const contrast = lesson.complexComparison;
  assert.ok(contrast.count > 1 && contrast.count <= 4); assert.equal(contrast.count, contrast.points.length);
  assert.deepEqual(contrast.points, contrast.aligned.points);
  for (const name of ['aligned', 'misaligned']) {
    const side = contrast[name], actual = E.compare(e.context, side.kx, side.ky, true);
    assert.equal(side.points.length, contrast.count); assert.equal(side.path.length, contrast.count + 1);
    assert.deepEqual(side.points.map(point => point.q), contrast.points.map(point => point.q));
    near(side.path[0].re, 0); near(side.path[0].im, 0);
    let re = 0, im = 0, xx = 0, yy = 0, sumOfLengths = 0;
    side.points.forEach((point, j) => {
      const source = actual.points.find(p => p.q[0] === point.q[0] && p.q[1] === point.q[1]);
      assert.ok(source, 'the displayed point must be valid for this actual candidate');
      assert.deepEqual(point, source);
      // conj(x) y: the imaginary sign is the phase of y minus that of x.
      nearRelative(point.cross.re, point.x.re * point.y.re + point.x.im * point.y.im);
      nearRelative(point.cross.im, point.x.re * point.y.im - point.x.im * point.y.re);
      re += point.cross.re; im += point.cross.im;
      xx += point.x.re ** 2 + point.x.im ** 2; yy += point.y.re ** 2 + point.y.im ** 2;
      sumOfLengths += Math.hypot(point.cross.re, point.cross.im);
      nearRelative(side.path[j + 1].re, re); nearRelative(side.path[j + 1].im, im);
    });
    nearRelative(side.sum.re, re); nearRelative(side.sum.im, im);
    nearRelative(side.magnitude, Math.hypot(re, im));
    nearRelative(side.energyX, xx); nearRelative(side.energyY, yy);
    near(side.score, Math.hypot(re, im) / Math.sqrt(xx * yy));
    assert.ok(side.magnitude <= sumOfLengths + 1e-6);
    if (name === 'misaligned') assert.ok(side.magnitude < sumOfLengths * .999, 'wrongly paired products cancel partly; taking each modulus first would erase this distinction');
  }
  nearRelative(contrast.aligned.kx, e.kx); nearRelative(contrast.aligned.ky, e.ky);
  const aligned = contrast.aligned, factor = e.fit.alpha;
  aligned.points.forEach(point => {
    nearRelative(point.cross.re, factor.re * point.energy);
    nearRelative(point.cross.im, factor.im * point.energy);
  });
  near(Math.atan2(aligned.sum.im, aligned.sum.re), e.phase);
  assert.ok(Math.abs(aligned.sum.im) > 1e-6, 'unknown common illumination phase survives conjugation and addition');
  near(aligned.score, 1);
  assert.ok(contrast.count < e.fit.count, 'demonstration arrows do not replace the full estimation area');
  const regenerated = M.createComplexComparison(e.fit, lesson.candidates[0], 2);
  assert.equal(regenerated.count, 2);
  const other = M.createLesson({ raw: capture.raw, config: capture.config, direction: 2 });
  near(Math.atan2(other.complexComparison.aligned.sum.im, other.complexComparison.aligned.sum.re), other.estimate.phase);
});

test('the identified corresponding frequencies share the same sample content after their own OTF correction', () => {
  assert.equal(lesson.correspondence.length, 3);
  lesson.correspondence.forEach(p => {
    assert.ok(p.h0 >= capture.config.minH && p.h1 >= capture.config.minH);
    near(p.y.re, e.fit.alpha.re * p.x.re - e.fit.alpha.im * p.x.im, 1e-9);
    near(p.y.im, e.fit.alpha.re * p.x.im + e.fit.alpha.im * p.x.re, 1e-9);
  });
});

test('the formula bridge precedes the numerical copies and their relocation', () => {
  const encountered = [];
  for (let tick = 0; tick <= 1000; tick++) {
    const progress = tick / 1000, state = M.teachingState(progress);
    if (encountered.at(-1) !== state.formula) encountered.push(state.formula);
    if (state.abstract > 0) {
      assert.ok(encountered.includes('substitute'), 'explain f=q+k before changing to the numerical example');
      assert.ok(encountered.includes('corrected'), 'explain removal of OTF before using the numerical example');
      assert.ok(['copies', 'aligned'].includes(state.formula), 'toy conditions must be visible as the numerical example appears');
    }
    if (state.copies > 0) near(state.abstract, 1);
    if (state.align > 0) { near(state.copies, 1); assert.equal(state.formula, 'aligned'); }
  }
  assert.deepEqual(encountered, ['source', 'substitute', 'shared', 'corrected', 'copies', 'aligned']);
});

test('weak illumination, dark data and invalid phase systems never yield fabricated parameters', () => {
  const uniform = E.capture({ vectors: [[4, 7]], offsets: [.55], m: 0 });
  assert.equal(E.estimate(uniform.raw.groups[0], uniform.config).ok, false);
  const dark = { index: 0, frames: Array.from({ length: 3 }, (_, index) => ({ index, pixels: new Float64Array(A.N ** 2) })) };
  assert.equal(E.estimate(dark, capture.config).ok, false);
  assert.throws(() => E.estimate({ index: 0, frames: dark.frames.slice(0, 2) }, capture.config), /三帧/);
  assert.throws(() => E.estimate(dark, { ...capture.config, nominalPhases: [0, 0, 0] }), /名义相位/);
  assert.throws(() => E.capture({ vectors: [[4.2, 6.8]], offsets: [.55] }), /整数/);
});

test('estimated parameters are actually adopted by formal demixing and agree with independent band truth', () => {
  const b = lesson.bridge, g = b.pipeline.groups[0];
  assert.equal(b.modulationFallback, false); near(g.m, e.m); near(g.kx, e.kx); near(g.ky, e.ky);
  g.phases.forEach((phase, j) => near(phase, capture.config.nominalPhases[j] + e.phase));
  assert.ok(b.closure < 1e-12);
  const vector = capture.truth.vectors[lesson.direction];
  [0, 1, -1].forEach((order, band) => {
    for (const [x, y] of [[0, 0], [2, 3], [-4, 2]]) {
      const i = A.idx(x, y), q = A.idx(x - order * vector[0], y - order * vector[1]), h = A.otf(x, y);
      near(g.separated[band].re[i], h * capture.truth.spectrum.re[q], 1e-9); near(g.separated[band].im[i], h * capture.truth.spectrum.im[q], 1e-9);
    }
  });
  near(e.phase, Math.atan2(e.fit.cross.im, e.fit.cross.re)); near(e.m, Math.hypot(e.fit.cross.re, e.fit.cross.im) / e.fit.xx);
  // For the equal-step, common-offset case B+ / alpha matches the actual matrix result.
  const z = e.context.separated.bands[1], output = g.separated[1], ar = e.fit.alpha.re, ai = e.fit.alpha.im, den = ar * ar + ai * ai;
  for (const [x, y] of [[0, 0], [2, 3], [-4, 2]]) { const i = A.idx(x, y); near(output.re[i], (z.re[i] * ar + z.im[i] * ai) / den, 1e-9); near(output.im[i], (z.im[i] * ar - z.re[i] * ai) / den, 1e-9); }
  const weak = E.capture({ vectors: [[4, 7]], offsets: [.55], m: .3 });
  assert.throws(() => M.createLesson({ capture: weak, direction: 0 }), /回退值/);
});

test('all equations compile, local links resolve, and the Demo is offline with no theory popup', () => {
  const html = read('sim_parameter_demo.html');
  assert.equal(Motion.bandFormulas, BandFormulas); assert.equal(M.bandFormulas, BandFormulas);
  assert.equal(M.teachingEquations.source, BandFormulas.provisional);
  assert.equal(Motion.scenes.find(scene => scene.id === 'mixed-sources').equation, BandFormulas.observation);
  assert.equal(Motion.scenes.find(scene => scene.id === 'inverse-demix').weightEquation, BandFormulas.negativeExtraction);
  for (const equation of [...M.scenes.map(scene => scene.equation), ...Object.values(M.teachingEquations), ...M.complexSteps.map(step => step.equation), ...Object.values(BandFormulas)]) {
    assert.ok(equation.startsWith('$$') && equation.endsWith('$$'));
    assert.doesNotMatch(equation, /\\alpha|\b[BUV](?:_|\()|\bC\(|\\theta_j|_\{\\rm demo\}/, 'visible formulas retain Motion source notation and introduce no corrected-band aliases');
    const math = katex.renderToString(equation.slice(2, -2), { displayMode: true, output: 'mathml', throwOnError: true, strict: 'error' }); assert.match(math, /<math/);
  }
  assert.match(M.teachingEquations.source, /\\widetilde/); assert.match(M.teachingEquations.source, /A_\{\+1\}/);
  const overlap = M.scenes.find(scene => scene.id === 'overlap').equation;
  const score = overlap;
  assert.match(score, /\\rho/); assert.match(score, /\\frac/); assert.match(score, /\\sum/);
  assert.doesNotMatch(M.scenes.find(scene => scene.id === 'conjugate').equation, /\\rho|\\operatorname\*\{arg/);
  assert.match(overlap, /\\frac/);
  assert.ok(overlap.includes('H('), 'actual matching explicitly corrects the detection OTF');
  assert.doesNotMatch(read('tests/fixtures/parameter-legacy-view.js'), /exp\(/);
  for (const [, url] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (/^https?:|^#/.test(url)) continue;
    assert.ok(fs.existsSync(path.join(root, url.split(/[?#]/)[0])), url);
  }
  assert.doesNotMatch(html, /<dialog|equation-info|theory-context|<script[^>]+https?:/);
  const visibleHtml = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, '');
  const copy = M.scenes.flatMap(scene => [scene.label, scene.chapter, scene.title, scene.copy, scene.note, scene.equation]);
  for (const scene of M.scenes) for (let j = 0; j <= 20; j++) {
    const formula = M.formulaAt(M.stateForScene(scene.id, j / 20)); copy.push(formula.note, formula.equation);
  }
  assert.doesNotMatch([visibleHtml, ...copy].join('\n'), /Motion/i, 'learner-facing narration should not mention a separate host page');
});

test('a single reversible local playhead stops at scene boundaries and supports interruption', () => {
  let now = 0, sequence = 0; const pending = new Map();
  const p = M.createPlayer({ request: callback => { pending.set(++sequence, callback); return sequence; }, cancel: id => pending.delete(id) });
  const tick = () => { now += 16; const callbacks = [...pending.values()]; pending.clear(); callbacks.forEach(c => c(now)); assert.ok(pending.size <= 1, 'only one animation clock may run'); };
  const finish = () => { let calls = 0; while (pending.size && calls++ < 20000) tick(); assert.ok(calls < 20000); assert.equal(p.state().playing, false); };
  assert.equal(M.state(0).id, 'shared'); assert.equal(M.state(0).progress, 0);
  p.navigate(1); p.navigate(1);
  for (let i = 0; i < 40; i++) tick();
  assert.ok(p.state().position > 0 && p.state().position < 1, 'the first scene must animate before reaching its first stop');
  assert.equal(M.state(p.state().position).id, 'shared');
  finish(); near(p.state().position, 1); near(M.state(1).progress, 1);
  p.navigate(1); for (let i = 0; i < 40; i++) tick(); p.pause(); const paused = p.state().position; tick(); near(p.state().position, paused);
  p.toggle(); p.setSpeed(2); finish(); near(p.state().position, 2);
  p.navigate(1); near(p.state().target, 3); finish(); near(p.state().position, 3);
  p.navigate(-1); finish(); near(p.state().position, 2);
  p.go(4); tick(); p.seek(6.4); assert.equal(pending.size, 0); near(p.state().position, 6.4);
  p.setReducedMotion(true); p.navigate(-1); near(p.state().position, 6); assert.equal(pending.size, 0);
  p.go(M.scenes.length); near(p.state().position, M.scenes.length); assert.equal(pending.size, 0);
  assert.equal(p.playBeat, undefined);
  const times = Array.from({ length: M.scenes.length * 4 + 1 }, (_, i) => i / 4), states = times.map(M.state);
  times.toReversed().forEach((t, i) => assert.deepEqual(M.state(t), states[states.length - 1 - i]));
  assert.equal(M.durations.length, M.scenes.length); assert.ok(M.durations.every(duration => duration > 0));
  assert.deepEqual(M.scenes.map(s => s.id), ['shared', 'correlation', 'conjugate', 'overlap', 'coarse', 'refine', 'fit', 'read']);
  assert.equal(lesson.direction, 0, 'the preview follows the first direction');
  for (const name of ['splitState', 'createContributions', 'contributionAt', 'cameraFrame', 'splitFrame', 'relocatedPoint']) assert.equal(M[name], undefined);
});

test('scene-local state identifies both endpoints without timeline ceil ambiguity', () => {
  const samples = [0, .001, .16, .35, .65, .99, 1];
  for (const [step, scene] of M.scenes.entries()) {
    const forward = samples.map(progress => M.stateForScene(scene.id, progress));
    samples.toReversed().forEach((progress, j) => assert.deepEqual(M.stateForScene(scene.id, progress), forward[forward.length - 1 - j]));
    for (const [j, progress] of samples.entries()) {
      const s = forward[j]; assert.equal(s.step, step); assert.equal(s.id, scene.id); near(s.progress, progress);
      near(s.position, step + progress);
      if (progress > 0 || step === 0) {
        const timeline = M.state(step + progress);
        assert.equal(s.id, timeline.id); near(s.progress, timeline.progress); near(s.enter, timeline.enter);
      }
      const formula = M.formulaAt(s);
      assert.match(katex.renderToString(formula.equation.slice(2, -2), { throwOnError: true, strict: 'error' }), /<math/);
    }
    assert.equal(M.stateForScene(scene.id, -1).progress, 0); assert.equal(M.stateForScene(scene.id, 2).progress, 1);
  }
  assert.equal(M.state(1).id, 'shared'); assert.equal(M.state(1.001).id, 'correlation');
  assert.equal(M.state(8).id, 'read'); assert.equal(M.stateForScene('shared', 0).id, 'shared');
  assert.throws(() => M.stateForScene('missing', .5), /未知/);
  assert.throws(() => M.stateForScene('shared', NaN), /有限/);
});

test('an embedded renderer accepts no truth, stays scene-local, and removes only its own nodes', () => {
  let doc;
  const nodes = [];
  class Element {
    constructor(tag) { this.tagName = tag; this.attrs = {}; this.children = []; this.style = {}; this.ownerDocument = doc; this.textContent = ''; nodes.push(this); }
    setAttribute(key, value) { this.attrs[key] = String(value); }
    getAttribute(key) { return this.attrs[key] ?? null; }
    appendChild(child) { child.remove(); this.children.push(child); child.parent = this; return child; }
    remove() { if (this.parent) { const i = this.parent.children.indexOf(this); if (i >= 0) this.parent.children.splice(i, 1); this.parent = null; } }
    getContext() { return { createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }; }
    toDataURL() { return 'data:image/png;base64,embedded'; }
  }
  doc = { createElement: tag => new Element(tag), createElementNS: (_, tag) => new Element(tag) };
  const container = new Element('g'), sentinel = new Element('g'); container.appendChild(sentinel);
  const external = M.createLesson({ raw: capture.raw, config: capture.config, direction: 1 });
  Object.defineProperty(external.capture, 'truth', { get() { throw new Error('renderer accessed truth'); } });
  const context = { document: doc, SIMAtlas: A, SIMParameterStory: M, SIMBandFormulas: SharedNotation,
    katex: { render(tex, element, options) { element.innerHTML = katex.renderToString(tex, options); } } };
  context.globalThis = context; vm.createContext(context);
  vm.runInContext(read('tests/fixtures/parameter-legacy-view.js'), context);
  const view = context.SIMParameterView.create(container, external);
  assert.equal(view.groups.length, 8);
  assert.ok(!nodes.some(node => /未提供真值|核对与来源/.test(node.textContent)));
  const snapshot = node => ({ attrs: node.attrs, text: node.textContent, children: node.children.map(snapshot) });
  const positions = [0, .001, .16, .4, .75, 1];
  for (const scene of M.scenes) {
    const snapshots = positions.map(progress => {
      const s = view.drawScene(scene.id, progress);
      assert.deepEqual(s, M.stateForScene(scene.id, progress));
      assert.equal(container.attrs['data-scene-id'], scene.id);
      near(view.groups.reduce((sum, group) => sum + Number(group.attrs.opacity), 0), 1);
      return JSON.stringify(snapshot(container));
    });
    if (scene.id === 'shared') assert.notEqual(snapshots[0], snapshots.at(-1), 'the first scene must render its explanation and numerical transition');
    positions.toReversed().forEach((progress, j) => {
      view.drawScene(scene.id, progress);
      assert.equal(JSON.stringify(snapshot(container)), snapshots[snapshots.length - 1 - j]);
    });
  }
  for (const node of nodes) for (const value of Object.values(node.attrs)) assert.doesNotMatch(value, /NaN|Infinity/);
  assert.equal(typeof view.draw, 'function'); assert.equal(context.SIMParameterDemo, undefined);
  assert.ok(nodes.every(node => !/Motion/i.test(node.textContent)), 'rendered labels do not expose a separate host page');
  view.destroy(); assert.deepEqual(container.children, [sentinel]);
  view.destroy(); assert.deepEqual(container.children, [sentinel]);
});

test('standalone production renderer and controls run through all sixteen stops without a browser', () => {
  const boot = require('./helpers/motion-dom.cjs');
  const h = boot({ page: 'sim_parameter_demo.html', renderer: 'web/parameter-demo/sim-parameter-app.js' });
  const { nodes, byId, doc, pending, errors, context } = h;
  assert.deepEqual(errors, []);
  const { player, view, lesson: actual, preview: P } = context.SIMParameterDemo;
  assert.equal(P.scenes.length, 16); assert.equal(byId.get('pe-stops').children.length, 16);
  const positions = Array.from({ length: P.scenes.length }, (_, i) => [.001, .15, .4, .8, 1].map(p => i + p)).flat();
  const snapshots = new Map();
  for (const t of [...positions, ...positions.toReversed()]) {
    player.seek(t); const s = P.state(t);
    assert.equal(byId.get('pe-title').textContent, P.scenes[s.step].title);
    assert.equal(byId.get('pe-note').textContent, P.formulaAt(s).note);
    const layers = nodes.filter(node => node.attrs['data-connection-scene']);
    const alphas = layers.map(g => Number(g.attrs.opacity)); near(alphas.reduce((sum, v) => sum + v, 0), 1);
    if (snapshots.has(t)) assert.deepEqual(alphas, snapshots.get(t)); else snapshots.set(t, alphas);
    for (const node of nodes) for (const key of ['d', 'transform', 'opacity', 'x', 'y']) if (node.attrs[key]) assert.doesNotMatch(node.attrs[key], /NaN|Infinity/);
    if (s.id === 'relocation') for (const band of nodes.filter(n => n.attrs['data-relocation-order'] !== undefined)) {
      const order = Number(band.attrs['data-relocation-order']), b = [0, 1, -1].indexOf(order), g = actual.bridge.pipeline.groups[0], shift = M.ramp(s.progress, .17, .86);
      near(Number(band.attrs['data-qx']), 6 - order * g.kx * shift); near(Number(band.attrs['data-qy']), -order * g.ky * shift);
      near(Number(band.attrs['data-re']), view.data.probe.orders[b].value.re); near(Number(band.attrs['data-im']), view.data.probe.orders[b].value.im);
    }
  }
  for (const node of nodes.filter(n => n.attrs['data-matrix-coefficient'])) {
    const [j,b] = node.attrs['data-matrix-coefficient'].split(':').map(Number), z = view.data.matrix[j][b];
    near(Number(node.attrs['data-re']), z.re); near(Number(node.attrs['data-im']), z.im);
  }
  const ratio = nodes.find(n => n.attrs['data-study-ratio'] !== undefined);
  player.seek(P.index('fit') + 1); const endpoint = ratio.attrs.d;
  player.seek(P.index('read') + .001); assert.equal(ratio.attrs.d, endpoint);
  player.seek(P.index('fit') + .35); const formula = byId.get('pe-equation').children[0], renders = h.mathRenders;
  player.seek(P.index('fit') + .77); assert.equal(byId.get('pe-equation').children[0], formula); assert.equal(h.mathRenders, renders);
  player.seek(P.index('refill') + 1); byId.get('pe-replay').dispatch('click'); assert.equal(player.state().playing, true);
  player.pause(); player.seek(0);
  doc.dispatch('click', { target: byId.get('pe-stage'), clientX: 1100, button: 0 }); assert.equal(player.state().playing, true);
  h.advance(); h.advance(); byId.get('pe-play').dispatch('click'); assert.equal(pending.size, 0);
  const paused = player.state().position; h.advance(); near(player.state().position, paused);
  doc.dispatch('keydown', { key: 'End', target: doc }); near(player.state().position, P.scenes.length);
  byId.get('pe-restart').dispatch('click'); near(player.state().position, 0);
  byId.get('pe-stops').children[6].dispatch('click'); near(player.state().position, 7);
  byId.get('pe-speed').dispatch('click'); near(player.state().speed, 1.5);
  view.destroy(); assert.equal(byId.get('pe-art').children.length, 0);
});
