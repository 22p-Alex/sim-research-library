/* Integration contract only: no browser, screenshots or layout checks. */
const test = require('node:test'), assert = require('node:assert/strict');
const Motion = require('../web/motion/sim-motion-model.js');
const Chapter = require('../web/motion/sim-motion-parameter-chapter.js');
const Story = require('../web/parameter-demo/sim-parameter-two-stage.js');
const Study = require('../web/parameter-demo/sim-parameter-two-stage.js');
const Estimator = require('../web/shared/sim-parameter-estimation.js');
const A = require('../web/atlas/sim-atlas-core.js');
const katex = require('../vendor/katex/katex.min.js');
const capture = A.capture({ sample: 'star-points', directions: 3, m: .8, noise: 'none' });
const config = { n: capture.raw.n, cutoff: A.KC };
const chapter = Chapter.create({ raw: capture.raw, config });
const near = (a, b, eps = 1e-10) => assert.ok(Number.isFinite(a) && Math.abs(a - b) < eps, a + ' != ' + b);

test('illumination substitution, coefficient absorption and phase sums retrace the same clock', () => {
  const at = p => Chapter.provisionalState(Chapter.provisionalProgress(p));
  const formulaAt = p => Chapter.provisionalFormulaAt({ progress: Chapter.provisionalProgress(p) });
  for (const equation of Object.values(Chapter.provisionalFormulas)) {
    assert.ok(equation.startsWith('$$') && equation.endsWith('$$'));
    assert.doesNotThrow(() => katex.renderToString(equation.slice(2, -2), { output: 'mathml', throwOnError: true, strict: 'error' }));
  }
  assert.deepEqual([.01, .1, .32, .45, .6, .8, 1].map(p => at(p).mode),
    ['compact', 'substitute', 'model', 'expand', 'absorb', 'demix', 'ready']);
  assert.equal(Chapter.bridges[0].duration, 64000);
  assert.equal(at(.1).insert, 0);
  assert.equal(at(.23).insert, 1);
  assert.equal(at(.71).absorb, 1);
  assert.match(Chapter.provisionalFormulas.compact, /U\\cdot\\mathbf D/);
  const model = Chapter.illuminationTex(true);
  assert.equal((model.match(/\\boxed/g) || []).length, 3);
  assert.match(model, /\\mathbf k/); assert.match(model, /\\phi_j/);
  assert.equal(model.replace(/\{\\color\{#[0-9a-f]{6}\}\\boxed/g, '{\\color{transparent}\\boxed'), Chapter.illuminationTex(false));
  for (const color of Object.values(Chapter.parameterColors)) {
    assert.ok(model.includes('\\color{' + color + '}'));
    assert.ok(Chapter.illuminationTex(false).includes('\\color{' + color + '}'), 'the symbol stays colored before its frame fades in');
  }
  assert.match(Chapter.provisionalFormulas.substitute, /\\widehat\{\\mathbf k\}/);
  assert.match(Chapter.provisionalFormulas.substitute, /\\widehat m/);
  assert.match(Chapter.provisionalFormulas.substitute, /\\phi'_j\+\\widehat\\phi_\\Delta/);
  assert.match(formulaAt(.1).note, /已知且准确.*尚未求值/);
  assert.match(formulaAt(.6).note, /没有把波矢/);
  assert.match(formulaAt(.8).note, /相移偏离.*串扰/);
  const states = Array.from({ length: 1001 }, (_, i) => Chapter.provisionalState(i / 1000));
  states.toReversed().forEach(s => assert.deepEqual(Chapter.provisionalState(s.progress), s));
  for (const s of states) {
    assert.equal(Chapter.provisionalFormulaAt(s).equation, Chapter.provisionalFormulas[s.formulaKey]);
    for (const alpha of [s.handoff, s.gather, s.tokens, s.compact, s.substitution, s.insert, s.model,
      s.expansion, s.phaseFactor, s.absorption, s.absorb, s.demix, s.orthogonality, s.ready, s.failure,
      s.prelude.lift, s.prelude.card, s.prelude.relocate, s.prelude.misregister, s.prelude.phase, s.prelude.redPulse]) assert.ok(alpha >= 0 && alpha <= 1);
    assert.ok(Number.isFinite(s.equationPose.y) && Number.isFinite(s.equationPose.scale));
    if (s.expansion > 0) assert.equal(s.insert, 1);
    if (s.demix > 0) assert.equal(s.absorb, 1);
    if (s.ready > 0) assert.equal(s.orthogonality, 1);
  }
});

test('nominal failures reuse one controlled observation set and propagate 0.3-bin displacement and pi phase through the real pipeline', () => {
  const lesson = Motion.createLesson({ capture }), original = capture.raw.groups[0].frames[0].pixels.slice();
  const d = Chapter.createNominalFailure(lesson);
  near(d.nominal[0] - d.k[0], .3); near(d.nominal[1] - d.k[1], 0); near(d.phase, Math.PI);
  assert.equal(d.m, 1); assert.equal(d.probes.length, 3);
  for (const pipeline of [d.reference, d.vector, d.uncorrected]) {
    assert.equal(pipeline.ok, true); assert.equal(pipeline.modulationFallback, undefined);
    pipeline.raw.groups[0].frames.forEach((frame, j) => assert.equal(frame.pixels, d.frames[j].pixels));
    assert.ok(pipeline.outputPixels.every(Number.isFinite));
  }
  d.reference.groups[0].phases.forEach((phase, j) => near(phase, 2 * Math.PI * j / 3 + Math.PI));
  d.uncorrected.groups[0].phases.forEach((phase, j) => near(phase, 2 * Math.PI * j / 3));
  d.probes.forEach(({ index }) => {
    const z = d.fields[0], side = d.fields[1];
    near(z.re[index], side.re[index], 1e-8); near(z.im[index], side.im[index], 1e-8);
    // Leaving the injected pi uncorrected changes the sideband's sign:
    near(z.re[index] + Math.cos(d.phase) * side.re[index] - Math.sin(d.phase) * side.im[index], 0, 1e-8);
    near(z.im[index] + Math.sin(d.phase) * side.re[index] + Math.cos(d.phase) * side.im[index], 0, 1e-8);
  });
  assert.ok(d.errors.vector > .001); assert.ok(d.errors.phase > d.errors.vector);
  assert.ok(d.minimum < -.001, 'the red undershoot comes from signed inverse-FFT output');
  assert.deepEqual(capture.raw.groups[0].frames[0].pixels, original, 'the counterfactual cannot alter production observations');
  const t = p => (.06 * Chapter.provisionalContentDuration + p * Chapter.nominalPreludeDuration) / Chapter.provisionalDuration;
  assert.deepEqual([.08, .24, .5, .9].map(p => Chapter.provisionalState(t(p)).mode),
    ['question', 'nominal-card', 'vector-failure', 'phase-failure']);
  for (const p of Array.from({ length: 501 }, (_, i) => i / 500)) {
    const s = Chapter.nominalFailureState(p);
    assert.deepEqual(Chapter.nominalFailureState(p), s);
    if (s.misregister > 0) assert.equal(s.relocate, 1);
    if (s.phase > 0) assert.equal(s.misregister, 1);
    if (s.cancellation > 0) assert.equal(s.phase, 1);
  }
});

test('internal nominal row sums reproduce the temporary bands used by estimation, including opposite residual phases', () => {
  for (const [kx, ky, phase, m] of [[5, -3, .73, .63], [-4, 3, -1.4, .2], [3, 4, 2.1, 1]]) {
  const c = Estimator.capture({ n: 32, cutoff: 8, vectors: [[kx, ky]], offsets: [phase], m });
  const separated = Estimator.separate(c.raw.groups[0], c.config), n = c.raw.n;
  for (const [b, order] of [0, 1, -1].entries()) {
    const factor = order === 0 ? 1 : 2, residualAmplitude = order === 0 ? 1 : c.truth.m;
    const residualPhase = order * c.truth.offsets[0];
    for (let j = 0; j < 3; j++) {
      const phi = -order * c.config.nominalPhases[j], weight = separated.weights[b][j];
      near(weight.re, factor / 3 * Math.cos(phi)); near(weight.im, factor / 3 * Math.sin(phi));
    }
    for (let i = 0; i < n * n; i++) {
      let re = 0, im = 0;
      for (let j = 0; j < 3; j++) {
        const phi = -order * c.config.nominalPhases[j], z = separated.spectra[j];
        re += factor / 3 * (Math.cos(phi) * z.re[i] - Math.sin(phi) * z.im[i]);
        im += factor / 3 * (Math.cos(phi) * z.im[i] + Math.sin(phi) * z.re[i]);
      }
      near(separated.bands[b].re[i], re, 1e-9); near(separated.bands[b].im[i], im, 1e-9);
      const fx = A.bin(i % n, n), fy = A.bin(Math.floor(i / n), n);
      const q = A.idx(fx - order * kx, fy - order * ky, n), h = A.otf(fx, fy, c.config.cutoff);
      const z = c.truth.spectrum, a = residualAmplitude * Math.cos(residualPhase), d = residualAmplitude * Math.sin(residualPhase);
      near(re, h * (a * z.re[q] - d * z.im[q]), 1e-9);
      near(im, h * (a * z.im[q] + d * z.re[q]), 1e-9);
    }
  }
  }
});

test('Euler factorization and three-phase orthogonality justify the displayed normalization and its boundary', () => {
  const phases = [0, 2 * Math.PI / 3, 4 * Math.PI / 3];
  for (const ell of [-2, -1, 0, 1, 2]) {
    near(phases.reduce((sum, p) => sum + Math.cos(ell * p), 0), ell === 0 ? 3 : 0);
    near(phases.reduce((sum, p) => sum + Math.sin(ell * p), 0), 0);
  }
  for (const m of [.2, .63, 1]) for (const delta of [-1.4, 0, .73]) for (const theta of [-2.7, .4, 1.9]) for (const p of phases) {
    // Multiplication of exp(i theta), exp(i phi'_j), exp(i delta)
    // gives the cosine term with the very same 1/2 on both sidebands.
    const a = theta + p;
    const re = Math.cos(a) * Math.cos(delta) - Math.sin(a) * Math.sin(delta);
    const im = Math.sin(a) * Math.cos(delta) + Math.cos(a) * Math.sin(delta);
    near(1 + m / 2 * (re + re), 1 + m * Math.cos(theta + p + delta));
    near(m / 2 * (im - im), 0);
  }
  const components = [{ re: .7, im: -.2 }, { re: -.3, im: .8 }, { re: .4, im: .1 }];
  const recover = errors => {
    const observations = phases.map((phase, j) => components.reduce((z, a, b) => {
      const t = [0, 1, -1][b] * (phase + errors[j]), scale = b ? .5 : 1;
      return { re: z.re + scale * (a.re * Math.cos(t) - a.im * Math.sin(t)),
        im: z.im + scale * (a.re * Math.sin(t) + a.im * Math.cos(t)) };
    }, { re: 0, im: 0 }));
    return [0, 1, -1].map(order => observations.reduce((z, a, j) => {
      const t = -order * phases[j], scale = (order ? 2 : 1) / 3;
      return { re: z.re + scale * (a.re * Math.cos(t) - a.im * Math.sin(t)),
        im: z.im + scale * (a.re * Math.sin(t) + a.im * Math.cos(t)) };
    }, { re: 0, im: 0 }));
  };
  recover([0, 0, 0]).forEach((z, b) => { near(z.re, components[b].re); near(z.im, components[b].im); });
  const leakage = recover([0, .12, -.09]);
  assert.ok(leakage.some((z, b) => Math.hypot(z.re - components[b].re, z.im - components[b].im) > .01), 'wrong relative phases cannot be absorbed into one common coefficient');
});

test('the active chapter inserts two handoffs and all eleven estimation scenes before direct formal separation', () => {
  const plan = Chapter.plan(Motion), ids = plan.stops.map(stop => stop.id);
  assert.equal(plan.active, true); assert.equal(Motion.parameterSlot.active, true);
  assert.equal(Motion.parameterSlot.after, 'inverse-demix');
  assert.equal(Motion.parameterSlot.before, 'verify-demix');
  assert.equal(Motion.parameterSlot.requiresProvisionalSplit, true);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(Chapter.sceneIds, Story.scenes.map(scene => scene.id), 'standalone and embedded views expose the same eleven scenes');
  const after = ids.indexOf(Motion.parameterSlot.after), before = ids.indexOf('separate-bands');
  assert.equal(ids.includes('verify-demix'), false, 'production omits the repeated coefficient proof');
  assert.deepEqual(Motion.sceneIds.slice(8, 12), ['mixed-sources', 'inverse-demix', 'verify-demix', 'separate-bands']);
  assert.equal(Motion.scenes.findIndex(scene => scene.id === Motion.parameterSlot.before), Motion.scenes.findIndex(scene => scene.id === Motion.parameterSlot.after) + 1);
  assert.deepEqual(ids.slice(after + 1, before), ['provisional-split', ...Chapter.sceneIds.map(id => 'parameters.' + id), 'adopted-weights']);
  assert.deepEqual(plan.stops.filter(stop => stop.owner === 'motion').map(stop => stop.legacyPosition), Motion.scenes.map((s, i) => s.id === 'verify-demix' ? null : i).filter(i => i !== null));
  for (const stop of plan.stops.filter(stop => stop.owner === 'parameters')) {
    assert.ok(stop.duration > 0);
    assert.equal(stop.duration, Study.scene(stop.sceneId).duration + (stop.sceneId === 'shared' ? Chapter.sharedEntryDuration : 0));
  }
  for (const id of ['observations', 'split', 'demix', 'relocate', 'audit']) assert.ok(!Chapter.sceneIds.includes(id));
});

test('the three-order entry preserves the old lesson duration and fades the negative order before settling the pair', () => {
  const boundary = Chapter.sharedEntryDuration / Chapter.sharedDuration;
  const at = p => Chapter.sharedEntryState(p * boundary);
  near(Chapter.sharedDuration - Chapter.sharedEntryDuration, Study.scene('shared').duration);
  near(at(0).bands[0].titleX, 672.48); near(at(0).bands[0].titleY, 85);
  const three = at(.64);
  assert.equal(three.nominal, 1); assert.equal(three.source, 0);
  assert.equal(three.pictures, 1); assert.equal(three.negative, 1);
  assert.deepEqual(three.bands.map(b => b.alpha), [1, 1, 1]);
  assert.deepEqual(three.bands.map(b => b.x), [720, 360, 1080]);
  near(at(.74).negative, .25); near(at(.82).negative, 0);
  near(at(.82).settle, 0); near(at(1).settle, 1);
  assert.deepEqual(at(1).bands.slice(0, 2).map(b => b.x), [900, 480]);
  for (const p of [0, .1, .5, .99, 1]) {
    const elapsed = Chapter.sharedEntryDuration + p * Study.scene('shared').duration;
    near(Chapter.sharedEntryState(elapsed / Chapter.sharedDuration).lessonProgress, p);
  }
  for (const progress of Array.from({ length: 1001 }, (_, i) => i / 1000)) {
    const s = Chapter.sharedEntryState(progress);
    for (const alpha of [s.handoff, s.nominal, s.source, s.reveal, s.pictures, s.negative, s.context, ...s.bands.map(b => b.alpha)]) {
      assert.ok(alpha >= 0 && alpha <= 1);
    }
    if (s.reveal > 0) assert.equal(s.nominal, 1);
    if (s.negative < 1) assert.equal(s.pictures, 1);
    if (s.settle > 0) assert.equal(s.negative, 0);
  }
  for (const b of Chapter.temporaryBands) {
    assert.doesNotThrow(() => katex.renderToString(b.symbol + '=' + b.rhs, { output: 'mathml', throwOnError: true, strict: 'error' }));
  }
  assert.match(Chapter.temporaryBands[1].rhs, /e\^\{i\\phi_\\Delta\}.*f-\\mathbf k/);
  assert.match(Chapter.temporaryBands[2].rhs, /e\^\{-i\\phi_\\Delta\}.*f\+\\mathbf k/);
});

test('the same nine Motion frames enter estimation and return as a full three-direction reconstruction', () => {
  const selected = chapter.result(), output = chapter.reconstructAll();
  assert.equal(chapter.lesson.capture.raw, capture.raw); assert.equal(chapter.lesson.audit == null, true);
  assert.equal(selected.rawGroup, capture.raw.groups[0]); assert.equal(selected.direction, 0);
  assert.equal(selected.formalGroup.separated.length, 3);
  const independent = Estimator.estimate(capture.raw.groups[0], config);
  for (const key of ['kx', 'ky', 'phase', 'm', 'angle', 'period']) near(selected[key], independent[key]);
  assert.deepEqual(selected.phases, independent.phases);
  assert.equal(output.pipeline.groups.length, 3); assert.equal(output.pipeline.bands.length, 9);
  assert.equal(chapter.reconstructAll(), output, 'replay reuses the same reconstruction');
  for (const [d, group] of output.raw.groups.entries()) {
    near(output.parameters[d].kx, A.VECTORS[d][0]); near(output.parameters[d].ky, A.VECTORS[d][1]);
    near(output.parameters[d].m, .8);
    group.frames.forEach((frame, j) => assert.equal(frame.pixels, capture.raw.groups[d].frames[j].pixels));
  }
  const lesson = Motion.createLesson({ capture, pipeline: output.pipeline });
  assert.equal(lesson.capture, capture); assert.equal(lesson.pipeline, output.pipeline);
  const original = A.pipeline(capture.raw, capture.calibration, {}, .8);
  for (let i = 0; i < original.pixels.length; i++) near(lesson.pipeline.pixels[i], original.pixels[i]);
});

test('a host can address each estimation scene at zero and one without starting a second player', () => {
  for (const id of Chapter.sceneIds) {
    const start = chapter.state(id, 0), end = chapter.state(id, 1);
    assert.equal(start.id, id); assert.equal(start.progress, 0);
    assert.equal(end.id, id); assert.equal(end.progress, 1);
    assert.deepEqual(start, Story.stateForScene(id, 0));
    near(start.position, Story.index(id)); near(end.position, Story.index(id) + 1);
    assert.deepEqual(chapter.state(id, .37), chapter.state(id, .37));
  }
  assert.equal(chapter.state('shared', 0).progress, 0, 'embedding must preserve the first scene animation');
  assert.throws(() => chapter.state('relocate', 0), /Motion/);
  assert.throws(() => Chapter.create(), /raw.*config/);
});

test('a failed direction or a different acquisition cannot silently enter the Motion continuation', () => {
  const dark = { n: capture.raw.n, groups: capture.raw.groups.map((group, i) => i !== 2 ? group : {
    index: group.index, frames: group.frames.map(frame => ({ index: frame.index, pixels: new Float64Array(frame.pixels.length) }))
  }) };
  const incomplete = Chapter.create({ raw: dark, config, direction: 0 });
  assert.throws(() => incomplete.reconstructAll(), /方向 2/);
  const output = chapter.reconstructAll(), other = A.capture({ sample: 'star-points', directions: 3, m: .8, noise: 'none' });
  assert.throws(() => Motion.createLesson({ pipeline: output.pipeline }), /采集数据/);
  assert.throws(() => Motion.createLesson({ capture: other, pipeline: output.pipeline }), /同一份采集帧/);
});
