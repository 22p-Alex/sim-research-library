/* Numerical and runtime invariants for the unified fit. No browser or layout QA. */
const test = require('node:test'), assert = require('node:assert/strict');
const E = require('../web/shared/sim-parameter-estimation.js');
const M = require('../web/parameter-demo/sim-parameter-model.js');
const L = require('../web/parameter-demo/sim-parameter-two-stage.js');
const Chapter = require('../web/motion/sim-motion-parameter-chapter.js');
const boot = require('./helpers/motion-dom.cjs');
const near = (a, b, eps = 1e-10) => assert.ok(Math.abs(+a - b) <= eps * Math.max(1, Math.abs(b)), `${a} != ${b}`);
const multiply = (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
const magnitude = z => Math.hypot(z.re, z.im);
const zOf = node => ({ re: +node.attrs['data-re'], im: +node.attrs['data-im'] });

test('the complex fit minimizes the actual noisy residual and preserves the nonzero fitted phase', () => {
  const capture = E.capture({ m: .67, offsets: [-.72, .55, -.4] });
  capture.raw.groups[0].frames.forEach((frame, j) => frame.pixels.forEach((_, i) => { frame.pixels[i] += .002 * Math.sin(i * .37 + j * .81); }));
  const lesson = M.createLesson({ raw: capture.raw, config: capture.config }), fit = lesson.estimate.fit;
  Object.defineProperty(lesson.capture, 'truth', { get() { throw new Error('fit accessed generation truth'); } });
  const originals = capture.raw.groups[0].frames.map(frame => Array.from(frame.pixels));
  const sums = fit.points.reduce((s, p) => ({
    re: s.re + p.x.re * p.y.re + p.x.im * p.y.im,
    im: s.im + p.x.re * p.y.im - p.x.im * p.y.re,
    energy: s.energy + p.x.re ** 2 + p.x.im ** 2,
  }), { re: 0, im: 0, energy: 0 });
  near(fit.alpha.re, sums.re / sums.energy); near(fit.alpha.im, sums.im / sums.energy);
  const end = L.leastSquaresState(lesson, 1);
  assert.ok(end.minimum > 0, 'noise residual must not be forced to vanish');
  near(end.minimum / end.energy, 1 - fit.score ** 2, 1e-12);
  near(end.phase, Math.atan2(sums.im, sums.re)); near(end.m, Math.hypot(sums.re, sums.im) / sums.energy);
  assert.ok(end.phase < -.7, 'negative observed phase is retained');
  for (const delta of [{ re: .2, im: -.3 }, { re: -.1, im: .17 }]) {
    const alpha = { re: fit.alpha.re + delta.re, im: fit.alpha.im + delta.im };
    const loss = fit.points.reduce((sum, p) => { const z = multiply(alpha, p.x); return sum + (p.y.re - z.re) ** 2 + (p.y.im - z.im) ** 2; }, 0);
    near(loss, end.minimum + sums.energy * (delta.re ** 2 + delta.im ** 2));
  }
  for (let i = 0; i <= 200; i++) {
    const p = i / 200, state = L.leastSquaresState(lesson, p);
    assert.deepEqual(state.k, [lesson.estimate.kx, lesson.estimate.ky]);
    if (state.divide > 0) assert.equal(state.count, fit.count);
    for (const point of L.dataFor(lesson).selected) {
      const predicted = multiply(state.alpha, point.x);
      near(magnitude(predicted), magnitude(point.x) * state.m);
      if (p >= .25 && p <= .43) near(magnitude(predicted), magnitude(point.x));
    }
    if (p >= .43) near(state.phase, end.phase);
    if (p >= .60) near(state.m, end.m);
  }
  assert.deepEqual(capture.raw.groups[0].frames.map(frame => Array.from(frame.pixels)), originals);
});

test('all observed pairs, residuals and fitted cards use one reversible playhead', () => {
  let chapter;
  const h = boot({ beforeRenderer(ctx) { const create = ctx.SIMMotionParameterChapter.create; ctx.SIMMotionParameterChapter.create = options => (chapter = create(options)); } });
  const { nodes, context, byId } = h, flow = context.SIMMotionParameterChapter.plan(context.SIMMotion);
  const seek = p => { byId.get('progress').value = flow.index('parameters.least-squares-fit') - 1 + p; byId.get('progress').dispatch('input'); };
  const get = (key, value) => nodes.find(n => value === undefined ? n.attrs[key] !== undefined : n.attrs[key] === String(value));
  const selected = context.SIMParameterLesson.dataFor(chapter.lesson).selected;
  const tracked = nodes.filter(n => ['data-least-squares-fit', 'data-fit-residual', 'data-fit-q', 'data-vector-u', 'data-vector-v', 'data-vector-prediction', 'data-fitting', 'data-fit-parameter'].some(key => n.attrs[key] !== undefined));
  const snapshots = new Map();
  const samples = [.001, .12, .249, .25, .29, .32, .38, .43, .50, .60, .66, .72, .76, .82, .85, .91, .97, 1];
  seek(.001); // Materialize the host's lazily cached initial textures.
  const canvases = h.work.canvas;
  for (const p of [...samples, ...samples.toReversed()]) {
    seek(p);
    const state = L.leastSquaresState(chapter.lesson, p), stage = get('data-least-squares-fit');
    assert.equal(stage.attrs['data-mode'], state.mode);
    assert.equal(byId.get('scene-title').textContent, state.title);
    selected.forEach((point, i) => {
      const name = ['P', 'Q', 'R'][i], predicted = multiply(state.alpha, point.x);
      const u = zOf(get('data-vector-u', name)), v = zOf(get('data-vector-v', name));
      near(u.re, point.x.re); near(u.im, point.x.im); near(v.re, point.y.re); near(v.im, point.y.im);
      const z = zOf(get('data-vector-prediction', name)), residual = zOf(get('data-fit-residual', i));
      near(z.re, predicted.re); near(z.im, predicted.im);
      near(residual.re, point.y.re - predicted.re); near(residual.im, point.y.im - predicted.im);
    });
    const snapshot = tracked.map(n => ({ ...n.attrs }));
    if (snapshots.has(p)) assert.deepEqual(snapshot, snapshots.get(p)); else snapshots.set(p, snapshot);
  }
  assert.equal(h.work.canvas, canvases, 'fit reuses spectra; no new exposure or stripe raster');
  assert.equal(get('data-illumination-preview'), undefined);
  assert.ok(!flow.scenes.some(s => ['parameters.geometry', 'parameters.conjugate', 'parameters.fit', 'parameters.read'].includes(s.id)));
  assert.deepEqual(h.errors, []);
});

test('the adopted matrix receives measured phases before its inverse is revealed', () => {
  for (let i = 0; i <= 200; i++) {
    const s = Chapter.adoptedState(i / 200);
    if (s.process > 0 || s.inverse.some(v => v > 0)) assert.deepEqual(s.rows, [1, 1, 1]);
    if (s.application > 0) assert.deepEqual(s.inverse, [1, 1, 1]);
  }
  const h = boot(), flow = h.context.SIMMotionParameterChapter.plan(h.context.SIMMotion);
  const get = (key, j) => h.nodes.find(n => n.attrs[key] === String(j));
  for (const p of [.001, .12, .24, .36, .48, .52, .64, .76, .88, 1]) {
    h.byId.get('progress').value = flow.index('adopted-weights') - 1 + p; h.byId.get('progress').dispatch('input');
    const s = Chapter.adoptedState(p);
    for (let j = 0; j < 3; j++) {
      near(get('data-adopted-matrix-row', j).style.opacity, s.rows[j]);
      near(get('data-adopted-weight-row', j).style.opacity, s.inverse[j]);
    }
  }
  assert.deepEqual(h.errors, []);
});

for (const page of ['sim_motion_demo.html', 'sim_parameter_demo.html']) test(`${page} keeps candidate shifts distinct from the locked fit on replay`, () => {
  let view;
  const h = boot({ page, renderer: page === 'sim_motion_demo.html' ? 'web/motion/sim-motion.js' : 'web/parameter-demo/sim-parameter-app.js',
    beforeRenderer(ctx) {
      const create = ctx.SIMParameterLesson.createView;
      ctx.SIMParameterLesson.createView = (...args) => (view = create(...args));
    } });
  const status = h.nodes.find(n => n.attrs['data-wavevector-status'] !== undefined);
  const footer = h.nodes.find(n => n.attrs['data-two-stage-footer'] !== undefined);
  const samples = [
    ['shift', .9, false], ['otf', .6, false], ['match', .4, false], ['match', .8, false],
    ['coarse', .01, false], ['refine', .9, false], ['refine', 1, true],
    ['least-squares-fit', 0, true], ['least-squares-fit', 1, true],
  ];
  for (const [id, p, locked] of [...samples, ...samples.toReversed()]) {
    view.drawScene(id, p);
    assert.equal(status.attrs['data-locked'], String(locked));
    if (locked) assert.match(status.textContent, /−k̂.*位置锁定/);
    else {
      assert.doesNotMatch(status.textContent, /位置锁定|k̂/);
      assert.match(status.textContent, /k′/);
    }
  }
  // Continue the same caption's position into OTF preparation, including reverse.
  view.drawScene('shift', 1); const from = +footer.attrs.y;
  view.drawScene('otf', 0); near(footer.attrs.y, from);
  view.drawScene('otf', .06); assert.ok(+footer.attrs.y < from && +footer.attrs.y > 518);
  view.drawScene('otf', .12); near(footer.attrs.y, 518);
  view.drawScene('otf', 0); near(footer.attrs.y, from);
  assert.deepEqual(h.errors, []);
});
