/* Connection draft: scientific invariants and playback, no visual checks. */
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const P = require('../web/parameter-demo/sim-parameter-preview.js');
const M = require('../web/parameter-demo/sim-parameter-model.js');
const L = require('../web/parameter-demo/sim-parameter-two-stage.js');
const E = require('../web/shared/sim-parameter-estimation.js');
const A = require('../web/atlas/sim-atlas-core.js');
const katex = require('../vendor/katex/katex.min.js');
const near = (x, y, tolerance = 1e-9) => assert.ok(Number.isFinite(x) && Math.abs(x - y) < tolerance, `${x} != ${y}`);
const capture = E.capture(), lesson = M.createLesson({ raw: capture.raw, config: capture.config });

test('the standalone draft brackets the eleven production scenes without changing the Motion scene list', () => {
  assert.equal(P.scenes.length, 16);
  assert.deepEqual(P.scenes.map(s => s.id), ['pending', 'temporary', ...L.scenes.map(s => s.id), 'refill', 'solve', 'relocation']);
  assert.equal(P.durations.length, 16);
  assert.equal(P.durations[P.index('fit')], 16000);
  assert.equal(P.durations[P.index('solve')], 11000);
  assert.equal(M.durations[M.index('fit')], 8000, 'presentation timing does not mutate the base chapter model');
  assert.match(P.scenes[P.index('refine')].note, /5×5.*10×10/);
  assert.doesNotMatch(P.scenes[P.index('solve')].equation, /0&0&1/);
  const html = fs.readFileSync(path.join(__dirname, '../sim_motion_demo.html'), 'utf8');
  assert.doesNotMatch(html, /sim-parameter-preview\.js/);
  for (let step = 0; step < P.scenes.length; step++) {
    for (const progress of [.000001, .08, .22, .5, .75, 1]) {
      const s = P.state(step + progress);
      assert.equal(s.step, step); near(s.progress, progress); assert.equal(s.id, P.scenes[step].id);
      if (s.parameter) assert.deepEqual(s.parameter, L.stateForScene(s.id, s.progress));
    }
  }
  assert.equal(P.state(0).id, 'pending'); assert.equal(P.state(16).id, 'relocation');
  assert.throws(() => P.state(NaN), /有限/);
});

test('the scan writes actual valid candidate scores and ends at the coarse peak, while fitting finishes accumulation before division', () => {
  const scan = P.matchingState(lesson, 'coarse', 1);
  assert.equal(scan.candidate, lesson.estimate.coarseBest);
  assert.equal(scan.committed.length, lesson.estimate.coarse.filter(c => c.valid).length);
  for (const candidate of scan.committed) {
    const independent = E.compare(lesson.estimate.context, candidate.kx, candidate.ky);
    near(candidate.score, independent.score); assert.equal(candidate.count, independent.count);
  }
  for (let i = 0; i <= 100; i++) {
    const f = P.fittingState('fit', i / 100, lesson.estimate.fit.count);
    if (f.divide > 0) assert.equal(f.count, lesson.estimate.fit.count, 'the ratio never uses unfinished sums');
  }
  const count = lesson.estimate.fit.count, from = P.fittingState('fit', 1, count), to = P.fittingState('read', 0, count);
  assert.equal(from.count, to.count); assert.equal(from.divide, to.divide);
  const p = .73;
  assert.deepEqual(P.fittingState('fit', p, count), P.fittingState('fit', p, count), 'state has no independent timer');
});

test('every entry and exit formula compiles, with explicit provisional factors and estimated parameters', () => {
  for (let i = 0; i <= 1500; i++) {
    const s = P.state(i / 100), formula = P.formulaAt(s);
    assert.match(formula.equation, /^\$\$[\s\S]*\$\$$/);
    assert.doesNotThrow(() => katex.renderToString(formula.equation.slice(2, -2), { displayMode: true, output: 'mathml', throwOnError: true, strict: 'error' }));
    assert.ok(formula.note.length > 0);
  }
  assert.match(P.scenes[1].equation, /m e\^\{\\pm i\\phi_\\Delta\}/);
  assert.match(P.scenes[P.index('refill')].equation, /\\widehat\\phi_j=\\phi'_j\+\\widehat\\phi_\\Delta/);
});

test('the refill matrix, solved row and formal band values all use the same estimated data', () => {
  Object.defineProperty(lesson.capture, 'truth', { get() { throw new Error('connection draft accessed truth'); } });
  const data = P.dataFor(lesson), e = lesson.estimate, g = data.group;
  assert.equal(g, lesson.bridge.pipeline.groups[0]);
  g.weights[2].forEach((w, j) => {
    near(w.re, 2 / (3 * e.m) * Math.cos(e.phases[j]));
    near(w.im, 2 / (3 * e.m) * Math.sin(e.phases[j]));
  });
  data.responses.forEach((z, b) => { near(z.re, b === 2 ? 1 : 0); near(z.im, 0); });
  assert.ok(data.residual < 1e-12);
  for (const [b, order] of [0, 1, -1].entries()) {
    const scale = order === 0 ? 1 : e.m, phase = order * e.phase;
    const temporary = e.context.separated.bands[b], formal = g.separated[b];
    // Independently verify the physical factor retained by provisional demixing.
    for (let i = 0; i < formal.re.length; i++) {
      near(temporary.re[i], scale * (Math.cos(phase) * formal.re[i] - Math.sin(phase) * formal.im[i]), 1e-8);
      near(temporary.im[i], scale * (Math.sin(phase) * formal.re[i] + Math.cos(phase) * formal.im[i]), 1e-8);
    }
    const f = A.idx(6, 0), z = data.probe.orders[b].value;
    near(z.re, formal.re[f] / capture.config.n ** 2); near(z.im, formal.im[f] / capture.config.n ** 2);
    const qx = 6 - order * g.kx, qy = -order * g.ky;
    near(data.probe.orders[b].specimenFrequency[0], qx);
    near(data.probe.orders[b].specimenFrequency[1], qy);
  }
  lesson.bridge.pipeline.raw.groups[0].frames.forEach((frame, j) => assert.equal(frame.pixels, capture.raw.groups[0].frames[j].pixels));
});

test('one configurable player reaches every draft stop, supports reverse and respects reduced motion', () => {
  let now = 0, sequence = 0; const pending = new Map();
  const player = M.createPlayer({ durations: P.durations, request: callback => { pending.set(++sequence, callback); return sequence; }, cancel: id => pending.delete(id) });
  const tick = () => { now += 32; const callbacks = [...pending.values()]; pending.clear(); callbacks.forEach(callback => callback(now)); };
  const finish = () => { let frames = 0; while (pending.size && frames++ < 2000) tick(); assert.ok(frames < 2000); };
  for (let stop = 1; stop <= P.scenes.length; stop++) { player.navigate(1); finish(); near(player.state().position, stop); }
  for (let stop = P.scenes.length - 1; stop >= 0; stop--) { player.navigate(-1); finish(); near(player.state().position, stop); }
  player.go(1); tick(); tick(); player.pause(); assert.equal(pending.size, 0);
  const paused = player.state().position; tick(); near(player.state().position, paused);
  player.toggle(); finish(); near(player.state().position, 1);
  player.setReducedMotion(true); player.go(P.scenes.length); near(player.state().position, P.scenes.length); assert.equal(pending.size, 0);
  assert.throws(() => M.createPlayer({ durations: [0], request: () => 0, cancel: () => {} }), /正数/);
});
