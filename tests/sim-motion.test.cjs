/* Numerical / state-machine checks only. No browser or visual inspection. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const M = require('../web/motion/sim-motion-model.js');
const F = require('../web/motion/sim-motion-fourier.js');
const A = require('../web/atlas/sim-atlas-core.js');
const Coefficients = require('../web/atlas/sim-atlas-demix-coefficients.js');
const katex = require('../vendor/katex/katex.min.js');
const lesson = M.createLesson();
const near = (a, b, epsilon = 1e-11) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);
const sum = values => values.reduce((a, b) => ({ re: a.re + b.re, im: a.im + b.im }), { re: 0, im: 0 });
const multiply = (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
const demixTimes = [7, 7.12, 7.24, 7.34, 7.4, 7.48, 7.52, 7.66, 7.70, 7.84, 8, 8.12, 8.2, 8.35, 8.5, 8.52, 8.7, 8.9,
  9, 9.12, 9.2, 9.3, 9.4, 9.42, 9.52, 9.62, 9.68, 9.77, 9.86, 9.9, 9.95, 10,
  10.12, 10.16, 10.22, 10.28, 10.3, 10.35, 10.41, 10.43, 10.49, 10.54, 10.56, 10.61, 10.67,
  10.68, 10.70, 10.71, 10.72, 10.77, 10.78, 10.83, 10.86, 10.93, 11, 11.2, 11.5, 12, 12.5, 13];
const inverseTimes = [8, 8.12, 8.22, 8.26, 8.30, 8.34, 8.37, 8.40, 8.42, 8.45, 8.47, 8.50, 8.53,
  8.55, 8.57, 8.58, 8.60, 8.63, 8.64, 8.65, 8.67, 8.70, 8.74, 8.77, 8.80, 8.84, 8.87, 8.90, 8.92, 8.95, 9];

test('the three observed complex values use the same three-source mixing matrix', () => {
  for (let j = 0; j < 3; j++) {
    const phase = lesson.group.phases[j];
    const terms = M.orders.map((order, b) => {
      const gain = order === 0 ? 1 : lesson.group.m / 2;
      const coefficient = { re: gain * Math.cos(order * phase), im: gain * Math.sin(order * phase) };
      return multiply(coefficient, lesson.probe.orders[b].value);
    });
    const observed = sum(terms);
    near(observed.re, lesson.probe.observed[j].re); near(observed.im, lesson.probe.observed[j].im);
  }
});

test('inverse matrices recover complex sources and remix to the original frames for several modulation values', () => {
  const { phases, system } = lesson.group;
  const sources = lesson.probe.orders.map(order => order.value);
  for (const m of [.45, .65, .8, 1]) {
    const U = A.mixWeights(system, m);
    const encoding = phases.map(phase => M.orders.map(order => {
      const a = order === 0 ? 1 : m / 2;
      return { re: a * Math.cos(order * phase), im: a * Math.sin(order * phase) };
    }));
    const observed = encoding.map(row => sum(row.map((coefficient, b) => multiply(coefficient, sources[b]))));
    const separated = A.demix(observed.map(z => ({ re: new Float64Array([z.re]), im: new Float64Array([z.im]) })), U, 1);
    for (const [b, order] of M.orders.entries()) {
      const a = order === 0 ? 1 : m / 2;
      for (let j = 0; j < 3; j++) {
        near(U[b][j].re, Math.cos(-order * phases[j]) / (3 * a));
        near(U[b][j].im, Math.sin(-order * phases[j]) / (3 * a));
        if (m === lesson.group.m) {
          near(U[b][j].re, lesson.group.weights[b][j].re); near(U[b][j].im, lesson.group.weights[b][j].im);
          near(observed[j].re, lesson.probe.observed[j].re); near(observed[j].im, lesson.probe.observed[j].im);
        }
      }
      for (let column = 0; column < 3; column++) {
        const response = sum(U[b].map((weight, j) => multiply(weight, encoding[j][column])));
        near(response.re, b === column ? 1 : 0); near(response.im, 0);
      }
      near(separated[b].re[0], sources[b].re); near(separated[b].im[0], sources[b].im);
    }
    for (let j = 0; j < 3; j++) {
      const remixed = sum(encoding[j].map((coefficient, b) => multiply(coefficient, { re: separated[b].re[0], im: separated[b].im[0] })));
      near(remixed.re, observed[j].re); near(remixed.im, observed[j].im);
      // This also checks the left inverse, rather than only a correct output
      // for the one source vector selected for illustration.
      for (let column = 0; column < 3; column++) {
        const response = sum(encoding[j].map((coefficient, b) => multiply(coefficient, U[b][column])));
        near(response.re, j === column ? 1 : 0); near(response.im, 0);
      }
    }
  }
});

test('the symbolic inverse-row argument also holds for nonuniform nondegenerate phases', () => {
  const Core = require('../web/shared/sim-core.js');
  for (const phases of [[.21, 1.7, 4.8], [.8, 2.9, 4.4]]) for (const m of [.35, .9]) {
    const weights = A.mixWeights(Core.phaseSystem(phases), m);
    const columns = M.orders.map(order => phases.map(phase => ({
      re: (order === 0 ? 1 : m / 2) * Math.cos(order * phase),
      im: (order === 0 ? 1 : m / 2) * Math.sin(order * phase),
    })));
    for (let b = 0; b < 3; b++) {
      const response = sum(weights[2].map((weight, j) => multiply(weight, columns[b][j])));
      near(response.re, b === 2 ? 1 : 0); near(response.im, 0);
    }
  }
});

test('the displayed closed-form weights invert equal phase steps with any common offset', () => {
  const Core = require('../web/shared/sim-core.js');
  for (const offset of [-1.2, 0, .31, 2.7]) for (const m of [.35, .8, 1]) {
    const phases = [0, 1, 2].map(j => offset + 2 * Math.PI * j / 3);
    const actual = A.mixWeights(Core.phaseSystem(phases), m);
    for (const [b, order] of M.orders.entries()) for (let j = 0; j < 3; j++) {
      const gain = b === 0 ? 1 / 3 : 2 / (3 * m);
      const weight = { re: gain * Math.cos(-order * phases[j]), im: gain * Math.sin(-order * phases[j]) };
      near(actual[b][j].re, weight.re); near(actual[b][j].im, weight.im);
    }
  }
  M.inverseEquations.forEach(tex => assert.doesNotMatch(tex, /phi_\\Delta|u_\{0,j\}=\\frac13|\\frac\{2\}\{3m\}/));
  assert.match(M.inverseEquations.at(-1), /m\\ne0/);
  for (let j = 0; j < 3; j++) {
    assert.equal(M.inverseWeightTex(0, j), String.raw`\frac13`);
    assert.equal(M.inverseWeightTex(1, j), '\\frac{2}{3m}e^{-i\\phi_' + j + '}');
    assert.equal(M.inverseWeightTex(2, j), '\\frac{2}{3m}e^{+i\\phi_' + j + '}');
  }
});

test('source aliases are introduced before coefficients move into their matching matrix rows', () => {
  const sampled = Array.from({ length: 901 }, (_, i) => M.demixState(7.1 + i / 1000));
  for (const s of sampled) {
    if (s.collapse > 0) near(s.definitions, 1);
    if (s.arrange > 0) near(s.collapse, 1);
    const transfers = s.transfers.flat();
    for (let i = 0; i < transfers.length; i++) if (transfers[i] > 0) {
      near(s.arrange, 1);
      if (i) near(transfers[i - 1], 1);
    }
    near(sum(s.activeRows.map(re => ({ re, im: 0 }))).re, 1);
  }
  assert.ok(M.scenes.slice(8, 12).every(scene => scene.theoryTopic === null));
  assert.match(M.scenes[9].note, /检查哪些量已知.*待确定/);
  assert.equal(M.parameterSlot.active, true, 'the symbolic solve leads into the active parameter chapter');
});

test('inverse transformation preserves multiplication order and introduces no estimated source symbol', () => {
  const states = inverseTimes.map(M.inverseState);
  inverseTimes.toReversed().forEach((t, i) => assert.deepEqual(M.inverseState(t), states[states.length - 1 - i]));
  for (const t of inverseTimes) {
    const s = M.inverseState(t);
    if (s.identity > 0) near(s.multiply, 1);
    if (s.removeIdentity > 0) near(s.identity, 1);
    if (s.swap > 0) near(s.removeIdentity, 1);
    if (s.weights > 0) near(s.swap, 1);
    if (M.demixState(t).selectedRow > 0) near(s.weights, 1);
  }
  assert.deepEqual([8, 8.30, 8.40, 8.45, 8.53, 8.60, 9].map(t => M.inverseState(t).formula), [0, 1, 2, 3, 4, 5, 6]);
  for (let i = 0; i <= 1000; i++) {
    const s = M.inverseState(8 + i / 1000), cells = s.resolved.flat();
    for (let k = 0; k < cells.length; k++) if (cells[k] > 0) {
      near(s.weights, 1);
      if (k) near(cells[k - 1], 1);
    }
  }
  assert.deepEqual(M.inverseState(8.6).resolved.flat(), Array(9).fill(0));
  assert.deepEqual(M.inverseState(9).resolved.flat(), Array(9).fill(1));
  assert.equal(M.inverseEquations[1], String.raw`$$M^{-1}\mathbf D(\mathbf f)=M^{-1}M\mathbf A(\mathbf f)$$`);
  assert.equal(M.inverseEquations[4], String.raw`$$\mathbf A(\mathbf f)=M^{-1}\mathbf D(\mathbf f)$$`);
  for (const equation of [...M.inverseEquations, ...M.scenes.slice(8, 14).map(s => s.equation)]) assert.doesNotMatch(equation, /\\widehat/);
  // Formula reveal starts only after the three camera frames have settled.
  assert.deepEqual(M.sample(1.12).frames, M.sample(2).frames);
});

test('the negative-order coefficient proof and observed products use the same inverse row', () => {
  const { phases, m, weights } = lesson.group;
  const proof = Coefficients.build({ phases, m, weights, target: 2 });
  for (let j = 0; j < 3; j++) {
    // For order -1, the inverse uses the conjugate of its negative-phase
    // encoding factor, including the inverse sideband amplitude 2/m.
    const expectedWeight = { re: 2 * Math.cos(phases[j]) / (3 * m), im: 2 * Math.sin(phases[j]) / (3 * m) };
    near(weights[2][j].re, expectedWeight.re); near(weights[2][j].im, expectedWeight.im);
    const expectedProduct = multiply(expectedWeight, lesson.probe.observed[j]);
    near(lesson.probe.orders[2].products[j].re, expectedProduct.re);
    near(lesson.probe.orders[2].products[j].im, expectedProduct.im);
  }
  for (const [b, order] of M.orders.entries()) {
    const column = proof.columns[b];
    const independentlyWeighted = phases.map((phase, j) => {
      const amplitude = b === 0 ? 1 : m / 2;
      const coefficient = { re: amplitude * Math.cos(order * phase), im: amplitude * Math.sin(order * phase) };
      const product = multiply(weights[2][j], coefficient);
      near(column.original[j].re, coefficient.re); near(column.original[j].im, coefficient.im);
      near(column.weighted[j].re, product.re); near(column.weighted[j].im, product.im);
      return product;
    });
    const response = sum(independentlyWeighted);
    near(column.sum.re, response.re); near(column.sum.im, response.im);
    near(response.re, b === 2 ? 1 : 0); near(response.im, 0);
    near(lesson.probe.orders[2].responses[b].re, response.re);
    near(lesson.probe.orders[2].responses[b].im, response.im);
  }
  const recovered = sum(lesson.probe.orders[2].products), source = lesson.probe.orders[2].value;
  near(recovered.re, source.re); near(recovered.im, source.im);
  const i = A.idx(6, 0), nSquared = A.N ** 2;
  for (let j = 0; j < 3; j++) {
    near(lesson.probe.observed[j].re, lesson.group.rawSpectra[j].re[i] / nSquared);
    near(lesson.probe.observed[j].im, lesson.group.rawSpectra[j].im[i] / nSquared);
  }
  near(source.re, lesson.group.separated[2].re[i] / nSquared);
  near(source.im, lesson.group.separated[2].im[i] / nSquared);
});

test('source definitions, coefficient transfers and symbolic demixing share a reversible playhead', () => {
  assert.deepEqual(M.sceneIds.slice(8, 14), ['mixed-sources', 'inverse-demix', 'verify-demix', 'separate-bands', 'relocate-bands', 'recover-high-frequency']);
  for (const obsolete of ['phase-cancel', 'phase-sum', 'demix-normalize']) assert.ok(!M.sceneIds.includes(obsolete));
  const times = demixTimes;
  const states = times.map(M.demixState);
  times.toReversed().forEach((t, i) => assert.deepEqual(M.demixState(t), states[states.length - 1 - i]));
  near(M.demixState(7).reveal, 0); near(M.demixState(8).reveal, 1);
  assert.deepEqual(M.demixState(8).matrixRows, [1, 1, 1]);
  near(M.demixState(8).inverse, 0); near(M.demixState(9).inverse, 1);
  near(M.demixState(8).selectedRow, 0); near(M.demixState(9).selectedRow, 0);
  near(M.demixState(10).selectedRow, 1); // Only the separate proof selects -1.
  assert.deepEqual(M.demixState(8).applyRows, [0, 0, 0]);
  assert.deepEqual(M.demixState(9).applyRows, [0, 0, 0]);
  assert.deepEqual(M.demixState(10).applyRows, [0, 0, 0]);
  assert.deepEqual(M.demixState(11).applyRows, [1, 1, 1]);
  near(M.demixState(9).proof, 0); near(M.demixState(10).proofComplete, 1);
  near(M.demixState(10).application, 0); near(M.demixState(11).application, 1);
  near(M.demixState(10).bands, 0); near(M.demixState(11).bands, 1);
  for (const t of times) {
    const state = M.demixState(t);
    near(Object.values(state.panels).reduce((a, b) => a + b, 0), 1);
    for (const value of [...Object.values(state.panels), ...state.matrixRows, ...state.applyRows, ...state.products]) assert.ok(value >= 0 && value <= 1);
    const left = M.demixState(t - 1e-7), right = M.demixState(t + 1e-7);
    for (const key of ['inverse', 'selectedRow', 'proof', 'expand', 'coefficientSum', 'proofComplete', 'application', 'bands', 'reveal']) near(left[key], right[key], .001);
    if (state.application > 0) near(state.proofComplete, 1);
    if (state.coefficientSum > 0) near(state.expand, 1);
    if (state.products[1] > 0) near(state.products[0], 1);
    if (state.products[2] > 0) near(state.products[1], 1);
    if (state.applyRows.some(value => value > 0)) state.products.forEach(value => near(value, 1));
    if (state.bands > 0) state.applyRows.forEach(value => near(value, 1));
  }
  const c = clock(); c.player.seek(8); c.player.navigate(1);
  while (c.player.state().position < 8.7) c.advance();
  c.player.pause(); const position = c.player.state().position, paused = M.demixState(position);
  c.advance(5000); near(c.player.state().position, position); assert.deepEqual(M.demixState(position), paused);
  c.player.toggle(); c.finish(); near(c.player.state().position, 9);
  c.player.navigate(-1); c.finish(); near(c.player.state().position, 8);
  c.player.seek(9); c.player.navigate(1);
  while (c.player.state().position < 9.7) c.advance();
  c.player.pause(); const proofPosition = c.player.state().position, proofPaused = M.demixState(proofPosition);
  c.advance(5000); near(c.player.state().position, proofPosition); assert.deepEqual(M.demixState(proofPosition), proofPaused);
  c.player.toggle(); c.finish(); near(c.player.state().position, 10);
  c.player.navigate(1); c.finish(); near(c.player.state().position, 11);
  c.player.navigate(-1); c.finish(); near(c.player.state().position, 10);
  c.player.navigate(-1); c.finish(); near(c.player.state().position, 9);
  assert.equal(M.transitionDurations.length, M.scenes.length - 1);
  for (let i = 0; i < M.scenes.length; i++) assert.equal(M.sceneIndex(i), i);
});

test('the proof stop holds the detector geometry and shifts later stages by exactly one stop', () => {
  const oldStageTime = time => time <= 3 ? time : time <= 4 ? 3 : time <= 9 ? time - 1 : time < 10 ? 2 * time - 10 : time;
  for (const time of [0, 2.5, 3, 4, 6, 7.5, 8, 9, 9.25, 9.5, 10, 10.3, 10.8, 11, 12, 13, 16.5, 21, 23]) {
    const legacy = time <= 9 ? time : time <= 10 ? 9 : time - 1;
    near(M.legacyTime(time), legacy); near(M.stageTime(time), oldStageTime(legacy));
    near(M.story(time).demixTime, M.clamp(legacy - M.DEMIX_START, 0, 6));
    const sample = M.sample(M.story(time).demixTime);
    if (time <= 11) for (const source of sample.sources) { near(source.offset, 0); near(source.specimen, 6); }
  }
  for (const time of [9, 9.3, 9.7, 10]) {
    const s = M.sample(M.story(time).demixTime);
    assert.deepEqual(s.frames, M.sample(3).frames);
    assert.deepEqual(s.sources, M.sample(3).sources);
    near(M.story(time).demix, 1);
  }
  for (const [time, local] of [[11, 4], [12, 5], [13, 6]]) {
    const sample = M.sample(M.story(time).demixTime);
    assert.deepEqual(sample.sources, M.sample(local).sources);
  }
});

test('source positions, actual complex band values and OTF move together', () => {
  for (const [b, order] of M.orders.entries()) {
    const start = M.sample(4).sources[b], end = M.sample(5).sources[b];
    near(start.specimen, 6); near(start.offset, 0);
    near(end.specimen, 6 - order * 8); near(end.offset, -order * 8);
    const band = lesson.group.bands[b], i = A.idx(end.specimen, 0, lesson.pipeline.spectrumSize);
    near(band.shifted.re[i] / 128 ** 2, lesson.probe.orders[b].value.re);
    near(band.shifted.im[i] / 128 ** 2, lesson.probe.orders[b].value.im);
    near(band.h[i], A.otf(6, 0, 10));
    for (const progress of [4.01, 4.2, 4.5, 4.8, 4.99]) {
      const source = M.sample(progress).sources[b];
      near(source.specimen - source.offset, 6);
    }
  }
  near(A.otf(14, 0, 10), 0);
  assert.ok(Math.hypot(lesson.probe.orders[2].value.re, lesson.probe.orders[2].value.im) > 1e-4);
});

test('scene boundaries are continuous and scrubbing does not mutate numerical data', () => {
  const before = lesson.probe.orders.map(order => ({ ...order.value }));
  for (let boundary = 1; boundary < 6; boundary++) {
    const left = M.sample(boundary - 1e-6), right = M.sample(boundary + 1e-6);
    for (let i = 0; i < 3; i++) for (const key of ['x', 'y', 'scale', 'opacity', 'offset', 'specimen']) near(left.sources[i][key], right.sources[i][key], 1e-6);
  }
  for (const t of [5, 1.5, 4.75, 0, 3.2, 4, 2.15, 6]) assert.deepEqual(M.sample(t), M.sample(t));
  assert.deepEqual(lesson.probe.orders.map(order => order.value), before);
});

function clock(reducedMotion = false, options = {}) {
  let now = 0, sequence = 0; const callbacks = new Map(), renders = [];
  const player = M.createPlayer({ ...options, reducedMotion, request: fn => { callbacks.set(++sequence, fn); return sequence; }, cancel: id => callbacks.delete(id), render: s => renders.push(s) });
  const advance = (ms = 16) => { now += ms; const pending = [...callbacks.values()]; callbacks.clear(); pending.forEach(fn => fn(now)); };
  function finish() {
    const limit = Math.ceil(M.transitionDurations.reduce((a, b) => a + b, 0) / player.state().speed / 16) + 100;
    let i = 0; while (callbacks.size && i++ < limit) advance(); assert.ok(i < limit, 'animation must settle within the full story duration');
  }
  return { player, callbacks, renders, advance, finish, get now() { return now; } };
}

test('one click advances one stop, repeated clicks cannot overlap, and reverse reaches the same frame', () => {
  const c = clock();
  assert.equal(c.player.navigate(1), true);
  assert.equal(c.player.navigate(1), false);
  assert.equal(c.callbacks.size, 1);
  c.finish(); assert.equal(c.player.state().position, 1); assert.equal(c.player.state().playing, false);
  assert.equal(c.callbacks.size, 0, 'no continuous animation after stop');
  c.player.navigate(-1); c.finish(); assert.equal(c.player.state().position, 0);
  assert.deepEqual(M.sample(c.player.state().position), M.sample(0));
  c.player.navigate(-1); assert.equal(c.player.state().position, 0); assert.equal(c.callbacks.size, 0);
});

test('pause, resume, scrub and changing a destination invalidate stale animation frames', () => {
  const c = clock(); c.player.go(3); for (let i = 0; i < 30; i++) c.advance();
  const pausedAt = c.player.state().position; assert.ok(pausedAt > 0 && pausedAt < 3);
  c.player.pause(); c.advance(2000); near(c.player.state().position, pausedAt); assert.equal(c.callbacks.size, 0);
  c.player.toggle(); c.finish(); assert.equal(c.player.state().position, 3);
  c.player.go(7); c.advance(); c.advance(); c.player.seek(2.5); assert.equal(c.callbacks.size, 0);
  c.player.navigate(-1); c.finish(); assert.equal(c.player.state().position, 2);
  c.player.go(7); c.player.go(1); assert.equal(c.callbacks.size, 1); c.finish(); assert.equal(c.player.state().position, 1);
  c.player.seek(99); assert.equal(c.player.state().position, M.scenes.length - 1);
  c.player.navigate(1); assert.equal(c.callbacks.size, 0);
});

test('reduced motion settles instantly, and speed changes never change the endpoint', () => {
  const c = clock(true); c.player.navigate(1); assert.equal(c.player.state().position, 1); assert.equal(c.callbacks.size, 0);
  c.player.go(7); assert.equal(c.player.state().position, 7);
  c.player.setReducedMotion(false); c.player.go(0); c.advance(); c.advance(); c.player.setReducedMotion(true);
  assert.equal(c.player.state().position, 0); assert.equal(c.callbacks.size, 0);
  for (const speed of [.65, 1, 1.5]) {
    const run = clock(); run.player.setSpeed(speed); run.player.go(M.scenes.length - 1); run.finish(); assert.equal(run.player.state().position, M.scenes.length - 1);
  }
});

test('step jumps cross the playhead in bounded time both ways without changing teaching speed', () => {
  const c = clock(); c.player.setSpeed(.65);
  for (const destination of [1, 13, 23, 0]) {
    const from = c.player.state().position, start = c.now, firstRender = c.renders.length;
    c.player.jump(destination);
    assert.equal(c.player.state().jumping, true);
    c.finish();
    assert.ok(c.now - start >= 400 && c.now - start <= 1150, 'even a full-story jump settles in about one second');
    assert.equal(c.player.state().position, destination); assert.equal(c.player.state().jumping, false);
    near(c.player.state().speed, .65);
    const positions = c.renders.slice(firstRender).map(state => state.position), direction = Math.sign(destination - from);
    assert.ok(positions.some(value => value > Math.min(from, destination) && value < Math.max(from, destination)), 'jump animates through intermediate frames');
    positions.forEach((value, i) => {
      assert.ok(value >= Math.min(from, destination) && value <= Math.max(from, destination), 'never overshoots');
      if (i) assert.ok((value - positions[i - 1]) * direction >= 0, 'keeps the requested direction');
    });
  }
  c.player.navigate(1); const normalStart = c.now; c.finish();
  assert.ok(c.now - normalStart > 2200, 'normal next-step playback retains its original 0.65× duration');
  assert.equal(c.player.state().position, 1); near(c.player.state().speed, .65);
});

test('quick jumps can pause, resume, retarget and scrub without stale destinations', () => {
  const c = clock(); c.player.jump(23); for (let i = 0; i < 18; i++) c.advance();
  const pausedAt = c.player.state().position; assert.ok(pausedAt > 0 && pausedAt < 23);
  c.player.pause(); c.advance(2000); near(c.player.state().position, pausedAt);
  assert.equal(c.callbacks.size, 0); assert.equal(c.player.state().jumping, true);
  c.player.setSpeed(1.5); c.player.toggle(); const resumedAt = c.now; c.finish();
  assert.ok(c.now - resumedAt < 900, 'resume uses the remaining jump time');
  assert.equal(c.player.state().position, 23); near(c.player.state().speed, 1.5);
  c.player.jump(0); c.advance(); c.advance(100);
  const retargetFrom = c.player.state().position;
  c.player.jump(19); assert.equal(c.callbacks.size, 1); near(c.player.state().position, retargetFrom);
  c.finish(); assert.equal(c.player.state().position, 19);
  c.player.jump(0); c.advance(); c.advance(); c.player.seek(4.5);
  assert.equal(c.callbacks.size, 0); assert.equal(c.player.state().jumping, false);
  c.player.toggle(); c.finish(); assert.equal(c.player.state().position, 5);
  c.player.jump(5); assert.equal(c.callbacks.size, 0); assert.equal(c.player.state().jumping, false);
  c.player.jump(23); c.advance(); c.advance(2000);
  assert.equal(c.player.state().position, 23, 'a delayed animation frame does not turn a quick jump into a long wait');
  c.player.jump(0); c.player.setReducedMotion(true);
  assert.equal(c.player.state().position, 0); assert.equal(c.callbacks.size, 0);
  c.player.jump(23); assert.equal(c.player.state().position, 23); assert.equal(c.callbacks.size, 0);
});

test('left/right navigation excludes controls and text selections', () => {
  assert.equal(M.clickDirection(100, 1440), -1); assert.equal(M.clickDirection(1100, 1440), 1);
  assert.equal(M.clickDirection(1100, 1440, true), 0); assert.equal(M.clickDirection(100, 1440, false, true), 0);
});

test('the native timeline thumb and step centers use one coordinate system at every viewport width', () => {
  const count = M.scenes.length;
  for (const viewport of [560, 980, 1800, 4200]) {
    const rail = M.timelineGeometry(viewport, count), cell = rail.width / count;
    assert.ok(cell >= 132);
    for (const position of [0, .5, 5, 5.5, 10, 15.75, count - 1]) {
      const nativeThumb = rail.sliderLeft + rail.thumbSize / 2 + position / (count - 1) * (rail.sliderWidth - rail.thumbSize);
      const labelPosition = (position + .5) * cell;
      for (const scroll of [0, Math.max(0, rail.width - viewport) / 2, Math.max(0, rail.width - viewport)]) {
        near(nativeThumb - scroll, labelPosition - scroll, 1e-9);
      }
      near(rail.start + position / (count - 1) * rail.length, nativeThumb, 1e-9);
    }
  }
});

test('every equation compiles to MathML and every local page dependency exists', () => {
  const html = fs.readFileSync(path.join(__dirname, '../sim_motion_demo.html'), 'utf8');
  const equations = M.scenes.flatMap(scene => [scene.equation, ...(scene.domainPair ? ['left', 'bridge', 'right'].flatMap(side => [scene.domainPair[side], scene.domainPair[`${side}Detail`]].filter(Boolean)) : [])])
    .concat(M.encodingFormulaTokens.map(token => token.equation))
    .concat([2.5, 2.6, 2.7, 2.8, 2.92, 3].flatMap(t => Object.values(M.encodingFormulaValues(M.encodingFrame(t)))))
    .concat(M.inverseEquations, [0, .5, 1, 1.3, 1.7, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7].flatMap(t => [...Object.values(F.formulaValues(F.sample(t))), ...Object.values(F.pairFormulaValues(F.sample(t).pair))]), [...html.matchAll(/data-equation="([^"]+)"/g)].map(m => m[1]));
  for (const wrapped of equations) {
    assert.ok(wrapped.startsWith('$$') && wrapped.endsWith('$$'));
    const rendered = katex.renderToString(wrapped.slice(2, -2), { displayMode: true, output: 'mathml', throwOnError: true, strict: 'error' });
    assert.match(rendered, /<math /);
    assert.doesNotMatch(rendered, /katex-error/);
  }
  for (const [, url] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (/^https?:|^#/.test(url)) continue;
    assert.ok(fs.existsSync(path.join(__dirname, '..', url.split(/[?#]/)[0])), `missing local asset: ${url}`);
  }
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(ids.length, new Set(ids).size, 'unique element IDs');
  const narrative = M.scenes.slice(0, 10).map(scene => [scene.title, scene.copy, scene.note, scene.equation].join(' ')).join('\n');
  assert.doesNotMatch(narrative, /a_0|a_\\|0\.4|\(6,\s*0\)/);
  assert.doesNotMatch(html.split('<dialog id="theory"')[0], /a_0|a_\\|\([±−-]?6,\s*0\)/);
  assert.match(html, /id="encoding-positive-result"[^>]*>f</);
  assert.match(M.scenes[4].equation, /\\frac m2/);
});

test('renderer boots and connects click, scrub, pause, keyboard and dialog events without a browser', check => {
  const harness = require('./helpers/motion-dom.cjs')({ baseTimeline: true });
  const { html, doc, nodes, byId, pending, errors, windowEvents, context, media, work, advance, finish } = harness;
  assert.deepEqual(errors, []); assert.equal(byId.get('fatal-error').hidden, true);
  const bandImages = nodes.filter(el => el.attrs['data-band-spectrum'] !== undefined);
  assert.equal(bandImages.length, 3);
  for (const image of bandImages) {
    const texture = nodes[Number(image.attrs.href.match(/fixture(\d+)$/)[1])];
    for (let y = 0; y < texture.height; y++) for (let x = 0; x < texture.width; x++) {
      const fx = Math.floor((x - texture.width / 2) * 48 / texture.width);
      const fy = Math.floor((y - texture.height / 2) * 48 / texture.height);
      const outside = Math.hypot(fx, fy) >= lesson.pipeline.cutoff;
      assert.equal(texture.lastPixels[4 * (y * texture.width + x) + 3], outside ? 0 : 255, 'only the separated-band support is opaque');
    }
  }
  assert.equal(doc.querySelectorAll('[data-stop]').length, M.scenes.length);
  assert.equal(byId.has('chapter-jump'), false, 'remove the redundant chapter selector');
  assert.equal(byId.has('domain-expansion'), false, 'keep the full DFT sum in the theory dialog');
  const click = x => doc.dispatch('click', { button: 0, clientX: x, target: byId.get('stage') });
  click(1100); assert.equal(pending.size, 1); finish(); assert.equal(byId.get('progress').value, '1');
  click(100); finish(); assert.equal(byId.get('progress').value, '0');
  byId.get('progress').value = '6'; byId.get('progress').dispatch('input');
  assert.equal(byId.get('scene-number').textContent, '07'); assert.match(byId.get('equation').innerHTML, /<math /);
  click(1100); advance(); advance();
  doc.dispatch('keydown', { key: ' ', target: byId.get('stage') }); assert.equal(pending.size, 0);
  byId.get('pause').dispatch('click'); finish(); assert.equal(byId.get('progress').value, '7');
  // The 07 → 08 transition crossfades already-computed camera/FFT images.
  // Count actual renderer work, without starting a browser or measuring layout.
  for (const start of [6.06, 6.56]) {
    const seek = t => { byId.get('progress').value = String(t); byId.get('progress').dispatch('input'); };
    seek(start);
    const before = { ...work }, renders = harness.mathRenders;
    for (let frame = 1; frame <= 30; frame++) seek(start + frame / 100);
    const delta = Object.fromEntries(Object.keys(work).map(key => [key, work[key] - before[key]]));
    check.diagnostic(`FFT crossfade at ${start}, 30 frames: ${JSON.stringify(delta)}`);
    assert.equal(delta.text, 0, `static text must retain its nodes during FFT crossfade: ${JSON.stringify(delta)}`);
    assert.equal(delta.html, 0, 'transport hints must not rebuild DOM every frame');
    assert.equal(delta.measurements, 0, 'no forced geometry reads during FFT crossfade');
    assert.equal(delta.canvas, 0, 'reuse captured pixels and precomputed FFT images');
    assert.equal(harness.mathRenders, renders, 'no repeated formula compilation between scene boundaries');
    assert.ok(delta.attributes < 30 * 10, `only changing SVG attributes may be written: ${delta.attributes}`);
    assert.ok(delta.styles < 30 * 20, `only changing styles may be written: ${delta.styles}`);
  }
  byId.get('progress').value = '7'; byId.get('progress').dispatch('input');
  byId.get('theory-open').dispatch('click'); assert.equal(byId.get('theory').open, true);
  click(100); assert.equal(pending.size, 0, 'dialog must block background navigation');
  byId.get('theory-close').dispatch('click');
  // Context entries open the relevant derivation, pause playback, and restore
  // keyboard focus without changing the selected story stop.
  for (const [position, topic] of [[16, 'weights'], [17, 'weights'], [22, 'rmse']]) {
    byId.get('progress').value = String(position); byId.get('progress').dispatch('input');
    const entry = byId.get('theory-context'); assert.equal(entry.hidden, false);
    entry.focus(); entry.dispatch('click');
    assert.equal(byId.get('theory').open, true); assert.equal(pending.size, 0);
    const heading = byId.get('theory-' + topic);
    assert.equal(doc.activeElement, heading); assert.equal(heading.lastScrollIntoView.block, 'start');
    click(1100); assert.equal(byId.get('progress').value, String(position));
    byId.get('theory-close').dispatch('click'); assert.equal(doc.activeElement, entry);
    byId.get('equation-info').dispatch('click'); assert.equal(doc.activeElement, heading);
    byId.get('theory-close').dispatch('click');
  }
  const rows = byId.get('overlap-values').children;
  assert.equal(rows.length, 9);
  for (const [b, row] of rows.entries()) {
    const i = A.idx(6, 0, lesson.pipeline.spectrumSize), band = lesson.pipeline.bands[b];
    near(Number(row.children[2].textContent), band.h[i], 5e-7);
    near(Number(row.children[3].textContent), band.h[i] / lesson.pipeline.regularizedDenominator[i], 5e-7);
  }
  assert.equal(byId.get('parameter-values').children.length, 3);
  assert.match(byId.get('rmse-audit').textContent, /0\.2059.*0\.2643/);
  // Visit every full-story stop and intermediate frames in both directions.
  // This checks runtime wiring / finite numbers, never visual layout.
  for (const t of [0, 1, 2, 2.5, 3, 3.2, 3.45, 3.58, 3.8, 4, 4.5, 5, 6, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 14.5, 15, 15.4, 16, 16.5, 17, 17.5, 18, 18.5, 19, 19.5, 20, 20.5, 21, 22, 23, 17.3, 13.7, 10.8, 10.5, 10, 9.7, 9.5, 9, 4, 3.8, 3.5, 3.2, 3]) {
    byId.get('progress').value = String(t); byId.get('progress').dispatch('input');
    const index = M.sceneIndex(t), scene = M.scenes[index], paired = !!scene.domainPair;
    assert.equal(byId.get('scene-number').textContent, String(index + 1).padStart(2, '0'));
    assert.equal(byId.get('equation-domain').textContent, scene.formulaDomain);
    assert.equal(byId.get('equation').hidden, paired || scene.encodingFormula || scene.detectionFormula || scene.acquisitionFormula || scene.demixFormula);
    assert.equal(byId.get('demix-equations').hidden, !scene.demixFormula);
    assert.equal(byId.get('encoding-sum-equations').hidden, !scene.encodingFormula);
    assert.equal(byId.get('detection-equations').hidden, !scene.detectionFormula);
    assert.equal(byId.get('acquisition-equations').hidden, !scene.acquisitionFormula);
    const sumState = M.encodingSumState(t);
    near(byId.get('encoding-sum-stage').style.opacity, sumState.opacity);
    near(byId.get('encoding-sum-expanded').style.opacity, sumState.expanded);
    near(byId.get('encoding-sum-compact').style.opacity, M.encodingNotationState(t).compact * (1 - sumState.expanded));
    for (const side of ['positive', 'negative']) near(byId.get(`encoding-sum-weight-${side}`).style['--term-emphasis'], sumState.weightFocus);
    if (sumState.opacity > 0) {
      for (const el of nodes.filter(el => el.attrs['data-encoding-sum-order'] !== undefined)) {
        const order = Number(el.attrs['data-encoding-sum-order']), b = M.orders.indexOf(order), pose = sumState.panels[b];
        assert.equal(el.attrs.transform, `translate(${pose.x} ${pose.y}) scale(${pose.scale})`);
        near(Number(el.attrs['data-coefficient']), b === 0 ? 1 : sumState.factor);
        near(el.style.opacity, pose.opacity);
      }
    }
    assert.equal(byId.get('domain-equations').hidden, !paired);
    assert.equal(byId.get('domain-guide').hidden, !scene.domainPair?.guide);
    assert.equal(byId.get('encoding-pair-equations').hidden, false, 'formula visibility follows the playhead instead of a discrete display toggle');
    near(byId.get('encoding-pair-equations').style.opacity, M.encodingFrame(t).formulaOpacity);
    assert.equal(byId.get('encoding-pair-equations').attrs['aria-hidden'], String(M.encodingFrame(t).formulaOpacity === 0));
    assert.equal(byId.get('app').classList.contains('has-domain-pair'), paired);
    assert.equal(byId.get('equation-note').hidden, !scene.note, 'only show notes supplied by the current scene');
    assert.equal(byId.get('fourier-open').hidden, index !== 0, 'the extracted Fourier explanation belongs to the first stop');
    assert.equal(byId.get('theory-context').hidden, !['weights', 'rmse'].includes(scene.theoryTopic));
    assert.equal(byId.get('excitation-phases').hidden, t !== 2, 'exposure selection is available only at its stopped scene');
    if (paired) {
      assert.equal(byId.get('domain-guide').textContent, scene.domainPair.guide);
      for (const side of ['left', 'bridge', 'right']) {
        assert.equal(byId.get(`domain-${side}-label`).textContent, scene.domainPair[`${side}Label`]);
        assert.equal(byId.get(`domain-${side}`).innerHTML, katex.renderToString(scene.domainPair[side].slice(2, -2), { displayMode: true, output: 'mathml', throwOnError: true }));
        const detail = scene.domainPair[`${side}Detail`];
        assert.equal(byId.get(`domain-${side}-detail`).hidden, !detail);
        assert.equal(byId.get(`domain-${side}-detail`).innerHTML, detail ? katex.renderToString(detail.slice(2, -2), { displayMode: true, output: 'mathml', throwOnError: true }) : '', 'auxiliary equations update or clear when switching scenes');
      }
    }
    for (const element of nodes) for (const key of ['transform', 'd', 'width', 'height', 'x', 'y']) {
      if (element.attrs[key] !== undefined) assert.doesNotMatch(element.attrs[key], /NaN|Infinity/, `invalid ${key}`);
    }
    const visibleStops = doc.querySelectorAll('[data-stop]').filter(button => !button.hidden);
    assert.equal(visibleStops.length, M.scenes.length, 'all steps remain in one continuous strip');
    const strip = byId.get('timeline-scroll'), content = byId.get('timeline-content'), slider = byId.get('progress');
    const cell = parseFloat(content.style.width) / visibleStops.length, cellLeft = M.sceneIndex(t) * cell;
    assert.ok(cellLeft >= strip.scrollLeft && cellLeft + cell <= strip.scrollLeft + strip.clientWidth, 'follow the active step when scrubbing forwards or backwards');
    const thumb = parseFloat(slider.style.left) + 3.5 + t / (M.scenes.length - 1) * (parseFloat(slider.style.width) - 7);
    near(thumb - strip.scrollLeft, (t + .5) * cell - strip.scrollLeft, 1e-9);
    near(parseFloat(content.style['--progress']), t / (M.scenes.length - 1) * 100);
  }
  // Symbolic derivation, including coefficient flight, uses one reversible clock.
  // Simulated DOM only: no browser, screenshots or layout acceptance.
  const mixingRows = nodes.filter(el => el.attrs['data-mixing-row'] !== undefined);
  const inverseRows = nodes.filter(el => el.attrs['data-inverse-row'] !== undefined);
  const transfers = nodes.filter(el => el.attrs['data-matrix-transfer'] !== undefined);
  const definitions = nodes.filter(el => el.attrs['data-source-definition'] !== undefined);
  const coefficientSums = nodes.filter(el => el.attrs['data-coefficient-sum'] !== undefined);
  const products = nodes.filter(el => el.attrs['data-symbolic-product'] !== undefined);
  const weights = nodes.filter(el => el.attrs['data-symbolic-weight'] !== undefined);
  const resolvedWeights = nodes.filter(el => el.attrs['data-resolved-weight'] !== undefined);
  const inverseFormulas = nodes.filter(el => el.attrs['data-inverse-formula'] !== undefined);
  const inverseTokens = Object.fromEntries(nodes.filter(el => el.attrs['data-inverse-token']).map(el => [el.attrs['data-inverse-token'], el]));
  const coefficientFactors = nodes.filter(el => el.attrs['data-symbolic-factors'] !== undefined);
  const coefficientGrouped = nodes.filter(el => el.attrs['data-symbolic-sum'] !== undefined);
  assert.equal(mixingRows.length, 3); assert.equal(inverseRows.length, 3);
  assert.equal(transfers.length, 12); assert.equal(definitions.length, 3);
  assert.equal(coefficientSums.length, 3); assert.equal(products.length, 3); assert.equal(weights.length, 9);
  assert.equal(inverseFormulas.length, 7); assert.equal(Object.keys(inverseTokens).length, 7);
  assert.equal(resolvedWeights.length, 9);
  const texOf = el => el.children[0].innerHTML.match(/<annotation encoding="application\/x-tex">([\s\S]*?)<\/annotation>/)?.[1];
  for (const weight of weights) {
    const [b, j] = weight.attrs['data-symbolic-weight'].split(':').map(Number);
    assert.equal(texOf(weight), 'u_{' + ['0', '+1', '-1'][b] + ',' + j + '}');
    assert.equal(weight.attrs['data-re'], undefined);
  }
  for (const weight of resolvedWeights) {
    const [b, j] = weight.attrs['data-resolved-weight'].split(':').map(Number);
    assert.equal(texOf(weight), M.inverseWeightTex(b, j));
  }
  definitions.forEach((el, b) => {
    const tex = texOf(el);
    assert.ok(tex.includes('A_{' + ['0', '+1', '-1'][b] + '}(\\mathbf f)'));
    assert.ok(tex.includes('H(\\mathbf f)S(\\mathbf f' + ['', '-\\mathbf k', '+\\mathbf k'][b] + ')'));
    assert.ok(!tex.includes('\\frac m2'));
  });
  for (const oldAttribute of ['data-coefficient-product', 'data-observed-product', 'data-weight-j', 'data-solved-order']) {
    assert.equal(nodes.filter(el => el.attrs[oldAttribute] !== undefined).length, 0, 'no premature numeric substitution');
  }
  for (const t of [...demixTimes, ...inverseTimes, 7.51, 7.54, 7.68, 7.71, 7.84, 7.9, ...inverseTimes.toReversed(), ...demixTimes.toReversed()]) {
    const previousScene = Number(byId.get('scene-number').textContent) - 1, beforeMath = harness.mathRenders;
    byId.get('progress').value = String(t); byId.get('progress').dispatch('input');
    const state = M.demixState(t), scene = M.sceneIndex(t), group = byId.get('demix-equations');
    assert.equal(Number(byId.get('scene-number').textContent), scene + 1);
    assert.equal(group.hidden, !M.scenes[scene].demixFormula);
    assert.equal(Number(doc.querySelectorAll('[data-stop]').find(button => button.attrs['aria-current'] === 'step').dataset.stop), scene);
    if (M.scenes[scene].demixFormula) {
      assert.equal(byId.get('theory-context').hidden, true);
      assert.equal(byId.get('equation-info').hidden, true);
    }
    for (const [name, alpha] of Object.entries(state.panels)) {
      near(byId.get('demix-formula-' + name).style.opacity, alpha);
      assert.equal(byId.get('demix-formula-' + name).attrs['aria-hidden'], String(alpha === 0));
    }
    near(byId.get('demix-matrix-view').style.opacity, state.reveal * (1 - state.proof));
    near(byId.get('demix-source-definitions').style.opacity, state.reveal * state.definitions * (1 - state.bands));
    assert.equal(inverseFormulas.filter(el => el.attrs['aria-hidden'] === 'false').length, 1);
    inverseFormulas.forEach((el, i) => near(el.style.opacity, i === state.inversion.formula ? 1 : 0));
    near(inverseTokens.leftInverse.style.opacity, state.inversion.multiply);
    near(inverseRows[0].parent.style.opacity, M.ramp(state.inversion.weights, .6, 1));
    for (let k = 0; k < weights.length; k++) {
      const [b, j] = weights[k].attrs['data-symbolic-weight'].split(':').map(Number), p = state.inversion.resolved[b][j];
      near(resolvedWeights[k].attrs['data-resolution-progress'], p);
      near(weights[k].style.opacity, 1 - M.ramp(p, 0, .4));
      near(resolvedWeights[k].style.opacity, M.ramp(p, .6, 1));
      assert.ok(Number(weights[k].style.opacity) === 0 || Number(resolvedWeights[k].style.opacity) === 0,
        'a coefficient is replaced only after its old symbol disappears');
    }
    // Product replacement and coefficient regrouping never superimpose text.
    assert.ok(Number(inverseTokens.mixing.style.opacity) === 0 || Number(inverseTokens.identity.style.opacity) === 0);
    coefficientFactors.forEach((el, b) => assert.ok(Number(el.style.opacity) === 0 || Number(coefficientGrouped[b].style.opacity) === 0));
    const tokenX = name => Number(inverseTokens[name].attrs.transform.match(/translate\(([^ ]+)/)[1]);
    if (state.inversion.multiply === 1 && state.inversion.identity === 0) {
      assert.ok(tokenX('leftInverse') < tokenX('observation'));
      assert.ok(tokenX('rightInverse') < tokenX('mixing'));
    }
    if (state.inversion.swap === 1) assert.ok(tokenX('source') < tokenX('equals') && tokenX('equals') < tokenX('leftInverse'));
    for (const token of transfers) {
      const [r, c] = token.attrs['data-matrix-transfer'].split(':').map(Number), p = state.transfers[r][c];
      near(Number(token.attrs['data-transfer-progress']), p);
      near(token.style.opacity, Math.max(state.activeRows[r], M.ramp(p, 0, .08)));
      if (p === 1) assert.equal(token.attrs.transform, 'translate(' + (c === 0 ? 362.5 : 620 + (c - 1) * 180) + ' ' + (314 + r * 72) + ')');
    }
    mixingRows.forEach(row => {
      const j = Number(row.attrs['data-mixing-row']);
      near(row.style.opacity, .15 + .85 * state.matrixRows[j]);
      near(Number(group.style['--mix-row-' + j]), .18 + .82 * state.matrixRows[j]);
    });
    inverseRows.forEach(row => {
      const b = Number(row.attrs['data-inverse-row']);
      near(row.style.opacity, b === 2 ? 1 : 1 - .7 * state.selectedRow);
    });
    coefficientSums.forEach(el => {
      near(el.style.opacity, state.coefficientSum);
      assert.equal(Number(el.attrs['data-retain']), el.attrs['data-coefficient-sum'] === '2' ? 1 : 0);
    });
    products.forEach(el => near(el.style.opacity, state.products[Number(el.attrs['data-symbolic-product'])]));
    for (const [b, image] of bandImages.entries()) {
      const moving = image.parent, band = moving.parent.parent;
      assert.equal(band.children.find(el => el.attrs.class === 'band-background').getAttribute('transform'), null);
      assert.equal(band.getAttribute('transform'), null, 'panel background stays in detector coordinates during shifting');
      assert.equal(moving.attrs.transform, 'translate(' + (-M.orders[b] * 8 * M.sample(M.story(t).demixTime).shifted * 262 / 48) + ' 0)');
    }
    if (previousScene === scene) assert.equal(harness.mathRenders, beforeMath, 'symbolic formulas compile once; animation updates existing nodes');
  }
  for (const [position, replay, from, panel] of [
    [8, 'demix-mix-replay', 7.12, 'mix'], [9, 'demix-matrix-replay', 8.12, 'inverse'],
  ]) {
    byId.get('progress').value = String(position); byId.get('progress').dispatch('input');
    const button = byId.get(replay);
    assert.equal(button.hidden, false); assert.equal(button.disabled, false);
    button.dispatch('click'); near(Number(byId.get('progress').value), from);
    assert.equal(button.disabled, true);
    advance(); advance(); assert.ok(Number(byId.get('progress').value) > from);
    byId.get('pause').dispatch('click'); assert.equal(pending.size, 0);
    const paused = byId.get('progress').value;
    advance(); assert.equal(byId.get('progress').value, paused);
    byId.get('pause').dispatch('click'); finish();
    near(Number(byId.get('progress').value), position);
    near(byId.get('demix-formula-' + panel).style.opacity, 1);
    assert.equal(button.disabled, false);
  }
  // Verify actual canvas data, fixed references and synchronized formula state.
  // This is a simulated DOM check, with no browser or visual inspection.
  const detectionViews = Object.fromEntries(nodes.filter(el => el.attrs['data-detection-view']).map(el => [el.attrs['data-detection-view'], el]));
  assert.equal(Object.keys(detectionViews).length, 4);
  const detectionCanvases = ['spatial', 'frequency'].map(domain => detectionViews[`after-${domain}`].children.find(el => el.tagName === 'foreignObject').children[0]);
  const referenceHrefs = ['spatial', 'frequency'].map(domain => detectionViews[`before-${domain}`].children.find(el => el.tagName === 'image').attrs.href);
  const detectionMarkers = nodes.filter(el => el.attrs['data-detection-frequency']);
  const markerTransforms = detectionMarkers.map(el => el.attrs.transform);
  assert.equal(detectionMarkers.length, 4, 'the same ±6 pair exists in the before and after spectra');
  let intermediatePixels;
  for (const t of [4, 4.1, 4.28, 4.46, 4.56, 4.7, 4.85, 5, 4.85, 4.7, 4.56, 4.46, 4.28, 4.1, 4]) {
    const previousScene = Number(byId.get('scene-number').textContent) - 1, beforeMathRenders = harness.mathRenders;
    byId.get('progress').value = String(t); byId.get('progress').dispatch('input');
    const state = M.detectionState(t);
    near(byId.get('detection-stage').style.opacity, state.opacity);
    near(Number(byId.get('detection-equations').attrs['data-filter-progress']), state.filter);
    if (previousScene === Math.round(t)) assert.equal(harness.mathRenders, beforeMathRenders, 'detection emphasis must not recompile formulas per frame');
    for (const [i, domain] of ['spatial', 'frequency'].entries()) {
      assert.equal(detectionViews[`before-${domain}`].attrs['data-display-max'], detectionViews[`after-${domain}`].attrs['data-display-max']);
      assert.equal(detectionViews[`before-${domain}`].children.find(el => el.tagName === 'image').attrs.href, referenceHrefs[i]);
      for (const term of ['input', 'filter', 'result']) near(byId.get(`detection-${domain}-${term}`).style['--detection-emphasis'], state[`${term}Focus`]);
      if (state.opacity > 0) near(Number(detectionViews[`after-${domain}`].attrs['data-filter-progress']), state.filter);
    }
    detectionMarkers.forEach((marker, i) => assert.equal(marker.attrs.transform, markerTransforms[i], 'OTF filtering never moves frequencies'));
    if (state.opacity > 0) near(nodes.find(el => el.attrs['data-detection-passband']).style.opacity, state.passband);
    if (t === 4.7) {
      if (intermediatePixels) detectionCanvases.forEach((canvas, i) => assert.deepEqual(canvas.lastPixels, intermediatePixels[i], 'reverse retraces exactly the same image'));
      else intermediatePixels = detectionCanvases.map(canvas => canvas.lastPixels.slice());
    }
    if (t === 5) {
      const pixels = lesson.capture.raw.groups[0].frames[0].pixels, z = lesson.group.rawSpectra[0];
      const max = Number(detectionViews['after-frequency'].attrs['data-display-max']);
      for (let i = 0; i < 128 ** 2; i++) {
        const v = Math.round(M.clamp(pixels[i] / 1.8) * 255), index = A.idx(Math.floor((i % 128 - 64) * 48 / 128), Math.floor((Math.floor(i / 128) - 64) * 48 / 128));
        const magnitude = Math.log1p(Math.hypot(z.re[index], z.im[index])) / Math.log1p(max);
        const spatial = new Uint8ClampedArray([v * .87, v * .97, v, 255]);
        const frequency = new Uint8ClampedArray([9 + 189 * magnitude, 17 + 219 * magnitude, 23 + 229 * magnitude, 255]);
        for (let c = 0; c < 4; c++) {
          assert.equal(detectionCanvases[0].lastPixels[4 * i + c], spatial[c]);
          assert.equal(detectionCanvases[1].lastPixels[4 * i + c], frequency[c]);
        }
      }
    }
  }
  const exposureCanvases = nodes.filter(el => el.attrs['data-acquisition-camera'] !== undefined);
  const lightCanvases = nodes.filter(el => el.attrs['data-acquisition-illumination'] !== undefined);
  const frameNodes = nodes.filter(el => el.attrs['data-frame'] !== undefined);
  const phaseArrows = nodes.filter(el => el.attrs['data-acquisition-arrow'] !== undefined);
  assert.equal(exposureCanvases.length, 3); assert.equal(lightCanvases.length, 3); assert.equal(phaseArrows.length, 2);
  let carriedPixels, middlePixels, reversePixels;
  for (const t of [5, 5.12, 5.24, 5.28, 5.32, 5.48, 5.52, 5.61, 5.7, 5.78, 5.88, 5.96, 6, 6.3, 6, 5.88, 5.78, 5.7, 5.61, 5.28, 5]) {
    const previousScene = Number(byId.get('scene-number').textContent) - 1, renders = harness.mathRenders;
    byId.get('progress').value = String(t); byId.get('progress').dispatch('input');
    const state = M.acquisitionState(t);
    if (previousScene === Math.round(t)) assert.equal(harness.mathRenders, renders, 'phase values update without recompiling formulas');
    near(Number(byId.get('acquisition-equations').attrs['data-phase']), state.phase);
    assert.equal(byId.get('acquisition-phase-number').textContent, (state.phase / Math.PI).toFixed(3));
    near(byId.get('detection-context').style.opacity, M.detectionState(t).opacity * M.detectionState(t).copy * state.clear);
    if (t <= 5.28) {
      const transform = frameNodes[0].attrs.transform;
      assert.equal(transform, `translate(${state.firstPose.x} ${state.firstPose.y}) scale(${state.firstPose.size / 224})`);
      assert.equal(detectionViews['after-spatial'].attrs.transform, `translate(${state.firstPose.x} ${state.firstPose.y}) scale(${state.firstPose.size / 184})`);
    }
    for (let j = 0; j < 3; j++) {
      const phase = state.frames[j].phase;
      near(Number(exposureCanvases[j].attrs['data-phase']), phase); near(Number(lightCanvases[j].attrs['data-phase']), phase);
      near(frameNodes[j].style.opacity, state.frames[j].opacity);
      assert.equal(Number(frameNodes[j].attrs['data-display-max']), Number(detectionViews['after-spatial'].attrs['data-display-max']));
      if (j) assert.equal(frameNodes[j].attrs.transform, `translate(${360 + 360 * j} 250) scale(1)`, 'phase changes do not translate the specimen image');
      for (let x = 0; x < 128; x++) {
        const expected = Math.round((1 + .8 * Math.cos(2 * Math.PI * x / 16 + phase)) / 1.8 * 255);
        assert.equal(lightCanvases[j].lastPixels[4 * x + 2], expected);
      }
    }
    phaseArrows.forEach((arrow, j) => near(arrow.style.opacity, state.arrows[j]));
    if (t === 5) {
      if (!carriedPixels) carriedPixels = detectionCanvases[0].lastPixels.slice();
      assert.deepEqual(exposureCanvases[0].lastPixels, carriedPixels, 'the carried image retains its exact brightness and pixels');
    }
    if (t === 5.7) {
      if (!middlePixels) middlePixels = exposureCanvases[1].lastPixels.slice();
      assert.deepEqual(exposureCanvases[1].lastPixels, middlePixels);
    }
    if (t === 5.88 && middlePixels) assert.deepEqual(exposureCanvases[1].lastPixels, middlePixels, 'recorded middle exposure stays fixed while the right preview changes');
    if (t === 5.61) {
      if (reversePixels) assert.deepEqual(exposureCanvases[1].lastPixels, reversePixels, 'reverse retraces the same phase-dependent image');
      else reversePixels = exposureCanvases[1].lastPixels.slice();
    }
  }
  // Check the encoding scene graph and frequency shifts, without rendering:
  // clipping belongs to the fixed parent, and both source markers follow the
  // same signed k displacement as its spectrum in both playback directions.
  assert.ok(byId.has('encoding-window-clip'));
  const encodingPanels = nodes.filter(el => el.attrs['data-encoding-order'] !== undefined);
  assert.equal(encodingPanels.length, 3);
  const translation = el => Number(el.attrs.transform.match(/^translate\(([-\d.e]+) 0\)$/)[1]);
  const fixedTransforms = encodingPanels.map(el => el.attrs.transform);
  for (const t of [2.2, 2.3, 2.45, 2.5, 2.55, 2.6, 2.68, 2.76, 2.8, 2.85, 2.9, 2.95, 3, 3.15, 3.35, 3.5, 3.35, 3.15, 3, 2.95, 2.9, 2.85, 2.8, 2.68, 2.6, 2.55, 2.5, 2.3, 2.2]) {
    const previousScene = Number(byId.get('scene-number').textContent) - 1, beforeMathRenders = harness.mathRenders;
    byId.get('progress').value = String(t); byId.get('progress').dispatch('input');
    if (previousScene === M.sceneIndex(t)) assert.equal(harness.mathRenders, beforeMathRenders, 'moving the numeric slots must not recompile MathML');
    for (const [b, panel] of encodingPanels.entries()) {
      const viewport = panel.children.find(el => el.attrs['data-encoding-part'] === 'viewport');
      const reference = panel.children.find(el => el.attrs['data-encoding-part'] === 'reference');
      const moving = viewport.children[0], markers = reference.children.filter(el => el.attrs['data-encoding-part'] === 'marker');
      assert.equal(markers.length, 2);
      assert.equal(viewport.attrs['clip-path'], 'url(#encoding-window-clip)');
      assert.equal(viewport.attrs.transform, undefined); assert.equal(reference.attrs.transform, undefined);
      assert.equal(panel.attrs.transform, fixedTransforms[b]);
      const shift = translation(moving) / (260 / 48);
      near(shift, M.orders[b] * 8 * M.ramp(t, 2.60, 2.76));
      near(Number(moving.children[0].attrs.width) / (260 / 48), 64, 1e-10);
      for (const [i, marker] of markers.entries()) {
        const q = [14, -14][i], frequency = translation(marker) / (260 / 48);
        assert.equal(marker.attrs['data-source-frequency'], String(q));
        near(frequency - shift, q, 1e-10);
        assert.equal(marker.attrs['data-in-passband'], String(Math.abs(frequency) < 10));
        const trajectory = reference.children.find(el => el.attrs['data-encoding-part'] === 'trajectory' && el.attrs['data-source-frequency'] === String(q));
        assert.equal(trajectory.attrs['stroke-dasharray'], i ? '4 3' : 'none');
        const sourceLabel = reference.children.find(el => el.attrs['data-encoding-part'] === 'source-label' && el.attrs['data-source-frequency'] === String(q));
        near(Number(sourceLabel.attrs.x), q * 260 / 48, 1e-10);
        if (M.story(t).intro > 0) {
          near(sourceLabel.style.opacity, M.encodingNotationState(t).sourceLabels);
          near(Number(trajectory.attrs['stroke-width']), 1.4 + 1.2 * M.encodingNotationState(t).shiftFocus);
        }
        if (t === 3) near(frequency, [[14, -14], [22, -6], [6, -22]][b][i]);
      }
      near((translation(markers[0]) - translation(markers[1])) / (260 / 48), 28, 1e-10, 'a shifted copy must not reflect its negative marker about the origin');
      for (const text of reference.children.filter(el => el.attrs.class === 'probe-label')) assert.ok(text.textContent.startsWith(t < 2.5 ? 'qₓ' : 'fₓ'), 'f is introduced with its definition, after the initial specimen copies');
    }
    const frame = M.encodingFrame(t), formulaGroup = byId.get('encoding-pair-equations');
    near(formulaGroup.style.opacity, frame.formulaOpacity);
    assert.equal(formulaGroup.attrs.transform, `translate(0 ${frame.formulaOffset})`);
    if (Math.round(t) === 3) assert.match(byId.get('stage-caption').textContent, /±14/);
    const notation = M.encodingNotationState(t);
    for (const phase of ['forward', 'numeric', 'inverse']) {
      near(byId.get(`encoding-coordinate-${phase}`).style.opacity, notation[phase]);
      assert.equal(byId.get(`encoding-coordinate-${phase}`).attrs['aria-hidden'], String(notation[phase] === 0));
    }
    for (const part of ['source', 'shift', 'destination']) near(byId.get(`encoding-symbol-${part}`).style['--symbol-focus'], notation[`${part}Focus`]);
    near(byId.get('encoding-lookup-term').style['--symbol-focus'], notation.lookupFocus);
    near(byId.get('encoding-lookup-note').style.opacity, notation.lookupDetail);
    if (t === 3) {
      assert.match(byId.get('scene-description').textContent, /q.*原始频率.*k.*照明.*f/);
      assert.match(byId.get('equation-note').textContent, /发射频谱坐标.*检测频谱沿用/);
      near(byId.get('encoding-sum-compact').style.opacity, 1);
    }
    for (const [side, point] of [['positive', frame.panels[2].points[0]], ['negative', frame.panels[1].points[1]]]) {
      near(byId.get(`encoding-${side}`).style['--encoding-emphasis'], point.emphasis);
      assert.equal(byId.get(`encoding-${side}`).attrs['data-in-passband'], String(point.inside));
    }
  }
  byId.get('progress').value = '2'; byId.get('progress').dispatch('input');
  const phaseImages = nodes.filter(el => el.attrs['data-excitation-image']);
  const phaseMarkers = nodes.filter(el => el.attrs['data-excitation-probe'] !== undefined);
  const markerPositions = phaseMarkers.map(el => el.attrs.transform);
  const phaseReadouts = nodes.filter(el => el.attrs['data-excitation-readout']);
  assert.equal(phaseImages.length, 2); assert.equal(phaseMarkers.length, 3);
  const exposureURLs = new Map();
  for (const j of [0, 1, 2, 0, 2]) {
    const button = byId.get(`excitation-phase-${j}`);
    assert.equal(button.disabled, false); button.dispatch('click');
    doc.dispatch('click', { button: 0, clientX: 1100, target: button });
    assert.equal(byId.get('progress').value, '2', 'phase buttons must not advance the story');
    assert.equal(pending.size, 0, 'selecting an exposure creates no animation clock');
    const urls = phaseImages.map(el => el.attrs.href);
    if (exposureURLs.has(j)) assert.deepEqual(urls, exposureURLs.get(j), 'reselecting a phase restores its saved exposure');
    else exposureURLs.set(j, urls);
    phaseImages.forEach(el => assert.equal(el.attrs['data-excitation-phase'], String(j)));
    phaseMarkers.forEach((el, i) => assert.equal(el.attrs.transform, markerPositions[i]));
    for (let k = 0; k < 3; k++) assert.equal(byId.get(`excitation-phase-${k}`).attrs['aria-pressed'], String(j === k));
    for (const el of phaseReadouts) {
      const expected = el.attrs['data-excitation-readout'] === 'sample' ? lesson.excitation.sample
        : el.attrs['data-excitation-readout'] === 'illumination' ? lesson.excitation.frames[j].localIllumination : lesson.excitation.frames[j].localEmission;
      assert.ok(el.textContent.includes(expected.toFixed(3)), 'readouts come from the selected exposure at the fixed probe');
    }
    advance(); assert.deepEqual(phaseImages.map(el => el.attrs.href), urls, 'the selected exposure stays static');
  }
  for (let imageIndex = 0; imageIndex < 2; imageIndex++) assert.equal(new Set([...exposureURLs.values()].map(urls => urls[imageIndex])).size, 3, 'three distinct saved exposure images are selectable');
  const strip = byId.get('timeline-scroll'), beforeWheel = byId.get('progress').value;
  strip.dispatch('wheel', { deltaX: 0, deltaY: 160, deltaMode: 0 });
  assert.equal(byId.get('progress').value, beforeWheel, 'browsing the strip never changes playback');
  assert.ok(strip.scrollLeft > 0);
  const dragScroll = strip.scrollLeft;
  byId.get('progress').dispatch('pointerdown');
  byId.get('progress').value = '10.25'; byId.get('progress').dispatch('input');
  assert.equal(strip.scrollLeft, dragScroll, 'native range input must not scroll itself out from under the pointer');
  doc.dispatch('pointerup');
  assert.ok(strip.scrollLeft > dragScroll, 'recenter the current step after releasing the pointer');
  assert.equal(byId.get('progress').value, '10.25');
  for (const width of [980, 4200, 560]) {
    strip.clientWidth = width; windowEvents.resize.forEach(callback => callback());
    const railWidth = parseFloat(byId.get('timeline-content').style.width), slider = byId.get('progress');
    const thumb = parseFloat(slider.style.left) + 3.5 + 10.25 / (M.scenes.length - 1) * (parseFloat(slider.style.width) - 7);
    near(thumb - strip.scrollLeft, 10.75 * railWidth / M.scenes.length - strip.scrollLeft, 1e-9);
    assert.equal(slider.value, '10.25', 'resizing changes timeline geometry, not the scene');
  }
  doc.dispatch('keydown', { key: 'Home', target: byId.get('stage') }); assert.equal(byId.get('progress').value, '0');
  assert.equal(strip.scrollLeft, 0, 'restarting brings the beginning of the strip back');
  const stops = doc.querySelectorAll('[data-stop]'), jumpStart = harness.now;
  stops[23].dispatch('click');
  assert.equal(byId.get('playback-status').textContent, '快速跳转到第 24 步');
  finish(); assert.ok(harness.now - jumpStart <= 1150); assert.equal(byId.get('progress').value, '23');
  const backStart = harness.now;
  stops[1].dispatch('click'); advance(); advance(); stops[4].dispatch('click');
  assert.equal(pending.size, 1); finish();
  assert.ok(harness.now - backStart < 1300); assert.equal(byId.get('progress').value, '4');
  assert.equal(byId.get('playback-status').textContent, '停在第 5 步 / 共 24 步');
  // The dialog's fixed sequence and formulas follow one playhead. No browser.
  byId.get('progress').value = '0'; byId.get('progress').dispatch('input');
  click(1100); advance(); advance();
  byId.get('fourier-open').focus(); byId.get('fourier-open').dispatch('click');
  const mainPosition = byId.get('progress').value, fourier = byId.get('fourier-lesson');
  const storyClick = x => fourier.dispatch('click', { button: 0, clientX: x, clientY: 400, target: byId.get('fourier-stage') });
  const next = () => byId.get('fourier-next').dispatch('click');
  const assertFormula = () => {
    const position = Number(fourier.attrs['data-position']), state = F.sample(position), tex = F.formulaValues(state);
    near(Number(byId.get('fourier-stage').attrs['data-amplitude']), state.amplitude);
    near(Number(byId.get('fourier-stage').attrs['data-phase']), state.phase);
    for (const [id, latex, value] of [
      ['fourier-eq-amplitude', tex.amplitude, state.amplitude], ['fourier-eq-magnitude', tex.magnitude, state.magnitude],
      ['fourier-eq-phase', tex.phase, state.phase], ['fourier-eq-coefficient-phase', tex.phase, state.phase],
    ]) {
      near(Number(byId.get(id).attrs['data-value']), value);
      assert.equal(byId.get(id).innerHTML, katex.renderToString(latex.slice(2, -2), { output: 'mathml', displayMode: true, throwOnError: true }));
    }
    assert.equal(byId.get('progress').value, mainPosition, 'the background story stays paused');
  };
  assert.equal(fourier.open, true); assert.equal(pending.size, 0); assert.equal(doc.activeElement, byId.get('fourier-stage'));
  const modalHtml = html.slice(html.indexOf('<dialog id="fourier-lesson"'), html.indexOf('<dialog id="theory"'));
  assert.doesNotMatch(modalHtml, /<input|fourier-q-|fourier-play|fourier-restore/);
  assert.equal(byId.get('fourier-step-0').tagName, 'li', 'steps are progress labels, not independent scene controls');
  click(1100); doc.dispatch('keydown', { key: 'End', target: byId.get('stage') });
  assert.equal(pending.size, 0); assertFormula();
  storyClick(750); assert.equal(pending.size, 1); storyClick(750); assert.equal(pending.size, 1);
  finish(); near(Number(fourier.attrs['data-position']), 1); assertFormula();
  assert.equal(byId.get('fourier-eq-frequency').classList.contains('is-emphasized'), true);
  assert.match(byId.get('fourier-insight').textContent, /展开两个复指数/);
  const vectors = Object.fromEntries(nodes.filter(el => el.attrs['data-pair-vector']).map(el => [el.attrs['data-pair-vector'], el]));
  const pairCurve = nodes.find(el => el.attrs['data-pair-trace'] === 'sum');
  const assertPair = () => {
    const state = F.sample(Number(fourier.attrs['data-position'])), pair = state.pair, tex = F.pairFormulaValues(pair);
    near(Number(byId.get('fourier-stage').attrs['data-scan-x']), pair.x);
    near(Number(byId.get('fourier-stage').attrs['data-spatial-angle']), pair.theta);
    near(Number(byId.get('fourier-eq-coefficient-phase').attrs['data-value']), 0);
    near(Number(byId.get('fourier-eq-magnitude').attrs['data-value']), .12);
    for (const [id, latex] of [['fourier-pair-position', tex.position], ['fourier-pair-positive-value', tex.positive], ['fourier-pair-negative-value', tex.negative], ['fourier-pair-sum-value', tex.sum]]) {
      assert.equal(byId.get(id).innerHTML, katex.renderToString(latex.slice(2, -2), { output: 'mathml', displayMode: true, throwOnError: true }));
    }
    for (const name of ['positive', 'negative', 'sum']) {
      near(Number(vectors[name].attrs['data-re']), pair[name].re); near(Number(vectors[name].attrs['data-im']), pair[name].im);
    }
    const coordinates = name => vectors[name].attrs.d.match(/^M ([-\d.e]+) ([-\d.e]+) L ([-\d.e]+) ([-\d.e]+)/).slice(1).map(Number);
    const [px, py, ex, ey] = coordinates('positive'), [nx, ny, mx, my] = coordinates('negative');
    near(px, 120); near(py, 120); near(ex - px, pair.positive.re * 360); near(ey - py, -pair.positive.im * 360);
    near(nx, 120 + state.join * pair.positive.re * 360); near(ny, 120 - state.join * pair.positive.im * 360);
    near(mx - nx, pair.negative.re * 360); near(my - ny, -pair.negative.im * 360);
    near(Number(pairCurve.attrs['data-end-x']), pair.x);
    near(Number(byId.get('fourier-pair-sum-value').attrs['data-value']), pair.sum.re);
    assert.equal(byId.get('fourier-pair-imag-plus').style['--pair-cancel'], String(state.cancel));
    assert.equal(byId.get('fourier-pair-imag-minus').style['--pair-cancel'], String(state.cancel));
    assertFormula();
  };
  next(); for (let i = 0; i < 110; i++) advance(); assertPair();
  fourier.dispatch('keydown', { key: ' ', target: byId.get('fourier-stage') });
  const pairPaused = fourier.attrs['data-position']; assert.equal(pending.size, 0); advance(); assert.equal(fourier.attrs['data-position'], pairPaused);
  byId.get('fourier-pause').dispatch('click'); finish(); assertPair(); near(Number(fourier.attrs['data-position']), 2);
  near(Number(byId.get('fourier-stage').attrs['data-scan-x']), A.N / 18);
  near(Number(vectors.sum.attrs['data-re']), .12); near(Number(vectors.sum.attrs['data-im']), 0);
  assert.equal(byId.get('fourier-base-equations').attrs['aria-hidden'], 'true');
  assert.equal(byId.get('fourier-pair-equations').attrs['aria-hidden'], 'false');
  assert.match(byId.get('fourier-complex-readout').textContent, /系数始终固定/);
  assert.equal(byId.get('fourier-pair-imag-plus').style['--pair-cancel'], '1');
  next(); advance(); near(Number(byId.get('fourier-stage').attrs['data-scan-x']), A.N / 18, 1e-12);
  for (let i = 0; i < 130; i++) advance(); assertPair();
  finish(); assertPair(); near(Number(fourier.attrs['data-position']), 3);
  near(Number(byId.get('fourier-stage').attrs['data-scan-x']), A.N);
  assert.match(byId.get('fourier-insight').textContent, /3.00 周期/);
  // Reverse just the new section; both formulas and the traced spatial point
  // retrace the same trajectory before continuing to the original story.
  byId.get('fourier-prev').dispatch('click'); for (let i = 0; i < 50; i++) advance(); assertPair(); finish(); assertPair();
  next(); finish(); assertPair();
  const amplitudeElement = byId.get('fourier-eq-amplitude');
  next(); for (let i = 0; i < 40; i++) advance(); assertFormula();
  const midAmplitude = Number(amplitudeElement.attrs['data-value']); assert.ok(midAmplitude > 0 && midAmplitude < .24);
  assert.equal(amplitudeElement.classList.contains('is-emphasized'), true);
  assert.notEqual(amplitudeElement.style['--formula-lift'], '0px', 'the changing formula element moves with the same progress');
  assert.equal(byId.get('fourier-eq-magnitude').classList.contains('is-emphasized'), true);
  fourier.dispatch('keydown', { key: ' ', target: byId.get('fourier-stage') }); assert.equal(pending.size, 0);
  const paused = fourier.attrs['data-position']; advance(); assert.equal(fourier.attrs['data-position'], paused);
  byId.get('fourier-pause').dispatch('click'); advance(); assert.equal(fourier.attrs['data-position'], paused);
  finish(); assertFormula(); near(Number(amplitudeElement.attrs['data-value']), 0);
  assert.match(byId.get('fourier-result-readout').textContent, /只剩灰色底与横纹/);
  next(); advance(); assert.equal(byId.get('fourier-eq-amplitude'), amplitudeElement, 'formula slots retain their identity');
  assert.equal(byId.get('fourier-eq-plus-x').classList.contains('is-emphasized'), false, 'boundary still represents the preceding exact endpoint');
  advance(); assert.equal(byId.get('fourier-eq-plus-x').classList.contains('is-emphasized'), true);
  finish(); assertFormula(); near(Number(amplitudeElement.attrs['data-value']), .24);
  next(); for (let i = 0; i < 45; i++) advance(); assertFormula();
  assert.equal(byId.get('fourier-eq-phase').classList.contains('is-emphasized'), true);
  assert.equal(byId.get('fourier-eq-coefficient-phase').classList.contains('is-emphasized'), true);
  assert.ok(Number(byId.get('fourier-eq-phase').attrs['data-value']) > 0);
  finish(); assertFormula(); near(Number(byId.get('fourier-eq-phase').attrs['data-value']), Math.PI);
  next(); finish(); assertFormula(); near(Number(fourier.attrs['data-position']), 7);
  assert.equal(byId.get('fourier-next').disabled, true);
  for (const id of ['fourier-eq-result', 'fourier-eq-plus-x', 'fourier-eq-plus-y', 'fourier-eq-dc', 'fourier-eq-horizontal']) assert.equal(byId.get(id).classList.contains('is-emphasized'), true);
  // Reverse every transition; the formula and image use the same state again.
  for (let i = 6; i >= 0; i--) { storyClick(250); advance(); advance(); assertFormula(); finish(); near(Number(fourier.attrs['data-position']), i); assertFormula(); }
  const countBeforeReopen = nodes.length;
  next(); advance(); byId.get('fourier-close').dispatch('click'); assert.equal(pending.size, 0);
  assert.equal(doc.activeElement, byId.get('fourier-open')); assert.equal(byId.get('progress').value, mainPosition);
  byId.get('fourier-open').dispatch('click'); assert.equal(nodes.length, countBeforeReopen, 'reopening reuses graph and listeners');
  next(); advance(); doc.hidden = true; doc.dispatch('visibilitychange'); assert.equal(pending.size, 0); doc.hidden = false;
  byId.get('fourier-pause').dispatch('click'); advance();
  media.matches = true; media.listeners.forEach(callback => callback({ matches: true }));
  assert.equal(pending.size, 0); near(Number(fourier.attrs['data-position']), 1);
  // The main player's reduced-motion preference settles its own paused target.
  const reducedMainPosition = byId.get('progress').value;
  next(); near(Number(fourier.attrs['data-position']), 2); near(Number(amplitudeElement.attrs['data-value']), .24);
  next(); near(Number(fourier.attrs['data-position']), 3);
  next(); near(Number(fourier.attrs['data-position']), 4); near(Number(amplitudeElement.attrs['data-value']), 0);
  assert.equal(pending.size, 0); next(); near(Number(amplitudeElement.attrs['data-value']), .24);
  assert.equal(byId.get('progress').value, reducedMainPosition);
  byId.get('fourier-restart').dispatch('click'); near(Number(fourier.attrs['data-position']), 0);
  byId.get('fourier-close').dispatch('click');
  for (const el of nodes) for (const key of ['transform', 'd', 'cx', 'cy']) {
    if (el.attrs[key] !== undefined) assert.doesNotMatch(el.attrs[key], /NaN|Infinity/);
  }
  assert.deepEqual(errors, []);
});

test('a conjugate Fourier pair equals the real cosine contribution and exact spectral editing', () => {
  const truth = F.createTeachingSample(), n = A.N;
  for (const q of [[3, 0], [0, 3]]) {
    const part = F.component(truth, q);
    near(part.period, n / Math.hypot(...q));
    const isolated = { re: new Float64Array(n ** 2), im: new Float64Array(n ** 2) };
    for (const index of [part.index, part.opposite]) {
      isolated.re[index] = truth.spectrum.re[index]; isolated.im[index] = truth.spectrum.im[index];
    }
    const inversePair = A.spatial(isolated);
    for (let i = 0; i < n ** 2; i++) { near(part.original[i], inversePair.re[i], 1e-12); near(inversePair.im[i], 0, 1e-12); }
    let energy = 0, overlap = 0;
    for (let i = 0; i < n ** 2; i++) { energy += part.original[i] ** 2; overlap += part.original[i] * part.residual[i]; }
    near(energy / n ** 2, part.amplitude ** 2 / 2, 1e-12); near(overlap, 0, 1e-10);
    for (const [gain, delta] of [[0, 0], [1, 0], [2, 0], [1, Math.PI], [.7, -.63]]) {
      const actual = F.frame(part, gain, delta), edited = { re: Float64Array.from(truth.spectrum.re), im: Float64Array.from(truth.spectrum.im) };
      // Compute the edited FFT bins independently from the UI's cosine sum.
      const index = part.index, re = truth.spectrum.re[index], im = truth.spectrum.im[index];
      edited.re[index] = gain * (re * Math.cos(delta) - im * Math.sin(delta));
      edited.im[index] = gain * (re * Math.sin(delta) + im * Math.cos(delta));
      edited.re[part.opposite] = edited.re[index]; edited.im[part.opposite] = -edited.im[index];
      const expected = A.spatial(edited);
      near(actual.amplitude, gain * part.amplitude);
      if (!gain) assert.equal(actual.phase, null);
      for (let i = 0; i < n ** 2; i++) {
        near(actual.pixels[i], expected.re[i], 2e-12); near(expected.im[i], 0, 2e-12);
        if (gain === 1 && delta === 0) near(actual.pixels[i], truth.sample[i]);
        if (delta === Math.PI) near(actual.contribution[i], -part.original[i]);
      }
    }
  }
  for (const q of [[0, 0], [64, 0], [64, 64]]) assert.throws(() => F.component(truth, q), /self-conjugate/);
});

test('the teaching image has only five nonzero DFT bins and removal visibly eliminates its vertical variation', () => {
  const truth = F.createTeachingSample(), n = truth.n, part = F.component(truth, [3, 0]);
  const expected = new Map([[A.idx(0, 0), .5], [A.idx(3, 0), .12], [A.idx(-3, 0), .12], [A.idx(0, 3), .12], [A.idx(0, -3), .12]]);
  for (let i = 0; i < n ** 2; i++) {
    near(truth.spectrum.re[i] / n ** 2, expected.get(i) || 0, 1e-12); near(truth.spectrum.im[i] / n ** 2, 0, 1e-12);
  }
  const removed = F.frame(part, 0), restored = F.frame(part, 1);
  let squaredDifference = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = y * n + x;
    near(removed.pixels[i], .5 + .24 * Math.cos(2 * Math.PI * 3 * y / n));
    near(restored.pixels[i], truth.sample[i]); squaredDifference += (removed.pixels[i] - truth.sample[i]) ** 2;
  }
  near(Math.sqrt(squaredDifference / n ** 2), .24 / Math.sqrt(2), 1e-12);
});

test('the eight stops and their formula parameters follow the same continuous Fourier trajectory', () => {
  const truth = F.createTeachingSample(), part = F.component(truth, [3, 0]);
  const endpoints = [[1, 0], [1, 0], [1, 0], [1, 0], [0, 0], [1, 0], [1, Math.PI], [1, 0]];
  for (const [t, [gain, phase]] of endpoints.entries()) { near(F.sample(t).gain, gain); near(F.sample(t).phase, phase); }
  for (const t of [0, .4, 1, 1.4, 2, 2.6, 3, 3.5, 4, 4.4, 5, 5.5, 6, 6.4, 7, 6.4, 4.4, 2.6, 1.4, 0]) {
    const s = F.sample(t), f = F.frame(part, s.gain, s.phase), tex = F.formulaValues(s);
    assert.deepEqual(s, F.sample(t)); near(f.amplitude, s.amplitude); near(s.magnitude * 2, s.amplitude);
    near(Number(tex.amplitude.slice(2, -2)), s.amplitude, .000501);
    near(Number(tex.magnitude.slice(2, -2)), s.magnitude, .000501);
    near(Number(tex.phase.slice(2, -2).replace('\\pi', '')), s.phase / Math.PI, .000501);
    const edited = { re: truth.spectrum.re.slice(), im: truth.spectrum.im.slice() };
    for (const sign of [-1, 1]) {
      const i = A.idx(sign * 3, 0); edited.re[i] = nSquared(s.magnitude * Math.cos(s.phase)); edited.im[i] = nSquared(sign * s.magnitude * Math.sin(s.phase));
    }
    const inverse = A.spatial(edited);
    for (let i = 0; i < truth.n ** 2; i++) {
      const x = i % truth.n;
      const formulaPixel = .5 + truth.horizontal[i] + s.amplitude * Math.cos(2 * Math.PI * 3 * x / truth.n + s.phase);
      near(f.pixels[i], formulaPixel, 1e-12); near(f.pixels[i], inverse.re[i], 1e-12); near(inverse.im[i], 0, 1e-12);
      assert.ok(f.pixels[i] >= .02 - 1e-12 && f.pixels[i] <= .98 + 1e-12, 'no auto-normalization or clipping is needed');
    }
  }
  function nSquared(v) { return v * truth.n ** 2; }
  for (const t of [1, 2, 3, 4, 5, 6]) for (const key of ['gain', 'phase', 'amplitude', 'shift', 'selection', 'scan', 'pairOpacity', 'join', 'cancel']) near(F.sample(t - 1e-6)[key], F.sample(t + 1e-6)[key], 1e-8);
  near(F.sample(6).shift, -truth.n / 6);
});

test('conjugate contributions sum to the sampled cosine while their coefficients stay fixed during scanning', () => {
  const truth = F.createTeachingSample(), n = truth.n, plus = A.idx(3, 0), minus = A.idx(-3, 0);
  const start = F.sample(1), paused = F.sample(2), end = F.sample(3);
  near(start.pair.x, 0); near(paused.pair.x, n / 18); near(paused.pair.theta, Math.PI / 3);
  near(paused.pair.positive.re, .06); near(paused.pair.positive.im, .06 * Math.sqrt(3));
  near(paused.pair.negative.im, -.06 * Math.sqrt(3)); near(paused.pair.sum.re, .12);
  near(end.pair.x, n); near(end.pair.theta, 6 * Math.PI); near(end.pair.cycles, 3);
  for (const t of [1, 1.15, 1.3, 1.52, 1.7, 1.82, 2, 2.2, 2.5, 2.8, 3, 2.8, 2, 1.52, 1]) {
    const s = F.sample(t), pair = s.pair;
    near(s.gain, 1); near(s.phase, 0); near(s.magnitude, .12); near(s.amplitude, .24);
    near(Math.hypot(pair.positive.re, pair.positive.im), .12); near(Math.hypot(pair.negative.re, pair.negative.im), .12);
    near(pair.positive.im + pair.negative.im, 0); near(pair.positive.re + pair.negative.re, pair.sum.re);
    // Independently evaluate the two actual inverse-DFT terms, including the
    // fractional spatial position in the trigonometric interpolant.
    let re = 0, im = 0;
    for (const [index, sign] of [[plus, 1], [minus, -1]]) {
      const angle = sign * 2 * Math.PI * 3 * pair.x / n;
      re += (truth.spectrum.re[index] * Math.cos(angle) - truth.spectrum.im[index] * Math.sin(angle)) / n ** 2;
      im += (truth.spectrum.re[index] * Math.sin(angle) + truth.spectrum.im[index] * Math.cos(angle)) / n ** 2;
    }
    near(pair.sum.re, re); near(pair.sum.im, im); near(pair.sum.im, 0);
  }
  // Sampling the sum over the complete image puts its energy at exactly the
  // selected pair, not at a spurious doubled frequency or non-real signal.
  const values = Float64Array.from({ length: n ** 2 }, (_, i) => F.pairAt(i % n).sum.re);
  const spectrum = A.spectrum(values);
  for (let i = 0; i < n ** 2; i++) { near(spectrum.re[i] / n ** 2, i === plus || i === minus ? .12 : 0, 1e-12); near(spectrum.im[i], 0, 1e-9); }
  for (const [x, expected] of [[0, .24], [n / 12, 0], [n / 6, -.24], [n / 4, 0], [n / 3, .24]]) near(F.pairAt(x).sum.re, expected);
  for (const t of [1, 1.12, 1.52, 1.55, 1.7, 1.82, 2, 3, 3.2, 3.22]) {
    const left = F.sample(t - 1e-7), right = F.sample(t + 1e-7);
    // The shortest smooth ramp spans .12 progress units, so its maximum
    // derivative is 1.5/.12; allow the finite change over the 2e-7 interval.
    for (const key of ['scan', 'gain', 'phase', 'pairOpacity', 'join', 'cancel']) near(left[key], right[key], 3e-6);
  }
});

test('the Fourier player advances one stop, resumes without resets, reverses and cancels stale frames', () => {
  const pending = new Map(); let sequence = 0, now = 0;
  const p = F.createPlayer({ request: fn => { pending.set(++sequence, fn); return sequence; }, cancel: id => pending.delete(id) });
  const advance = () => { now += 32; const callbacks = [...pending.values()]; pending.clear(); callbacks.forEach(callback => callback(now)); };
  const finish = () => { let count = 0; while (pending.size && count++ < 1000) advance(); assert.ok(count < 1000); };
  for (let stop = 1; stop <= 7; stop++) {
    assert.equal(p.navigate(1), true); assert.equal(p.navigate(1), false); assert.equal(pending.size, 1);
    advance(); advance(); const before = p.state().position; p.pause(); assert.equal(pending.size, 0);
    p.toggle(); advance(); near(p.state().position, before); finish(); near(p.state().position, stop);
  }
  for (let stop = 6; stop >= 0; stop--) { p.navigate(-1); finish(); near(p.state().position, stop); }
  p.navigate(1); advance(); advance(); p.seek(0); assert.equal(pending.size, 0);
  p.navigate(1); p.setReducedMotion(true); near(p.state().position, 1); assert.equal(pending.size, 0);
  p.navigate(1); near(p.state().position, 2); p.navigate(-1); near(p.state().position, 1);
  p.setReducedMotion(false); p.navigate(1); advance(); advance(); p.pause();
  const mid = p.state().position; p.navigate(-1); near(p.state().position, mid); finish(); near(p.state().position, 1);
  p.navigate(1); p.destroy(); assert.equal(pending.size, 0);
});

test('physical encoding and detection use the same nine-frame dataset', () => {
  assert.equal(lesson.capture.raw.groups.length, 3);
  assert.equal(lesson.pipeline.bands.length, 9);
  for (let i = 0; i < A.N ** 2; i++) {
    const emitted = sum(lesson.encoding.map(z => ({ re: z.re[i], im: z.im[i] })));
    near(emitted.re, lesson.emissionSpectrum.re[i], 1e-8); near(emitted.im, lesson.emissionSpectrum.im[i], 1e-8);
    const h = A.otf(A.bin(i % A.N), A.bin(Math.floor(i / A.N)));
    near(emitted.re * h, lesson.group.rawSpectra[0].re[i], 1e-8);
    near(emitted.im * h, lesson.group.rawSpectra[0].im[i], 1e-8);
  }
});

test('recalled encoding sources become the recovered A bands without absorbing illumination weights', () => {
  const n = lesson.capture.raw.n, original = lesson.encodingCopies.map(z => [z.re.slice(), z.im.slice()]);
  for (const progress of [0, .25, .7, 1, .7, .25, 0]) for (let b = 0; b < 3; b++) {
    // Compare the spatial interpolation against bands independently recovered
    // from the three raw observations, including both complex quadratures.
    const spatial = A.spatial(lesson.encodingCopies[b], n);
    const blurred = A.spatial(lesson.group.separated[b], n);
    const mixed = { re: Float64Array.from(spatial.re, (v, i) => (1 - progress) * v + progress * blurred.re[i]),
      im: Float64Array.from(spatial.im, (v, i) => (1 - progress) * v + progress * blurred.im[i]) };
    // Band arrays are complex; recover both quadratures with the core FFT.
    const expected = A.spectrum(mixed.re, n), imag = A.spectrum(mixed.im, n);
    for (let i = 0; i < n * n; i++) {
      const actual = M.sourceOriginPixel(lesson, b, progress, i);
      near(actual.re / (n * n), (expected.re[i] - imag.im[i]) / (n * n), 1e-12);
      near(actual.im / (n * n), (expected.im[i] + imag.re[i]) / (n * n), 1e-12);
    }
  }
  lesson.encodingCopies.forEach((z, b) => { assert.deepEqual(z.re, original[b][0]); assert.deepEqual(z.im, original[b][1]); });
  for (let i = 0; i <= 1000; i++) {
    const t = 7 + i / 1000, s = M.demixState(t), origin = s.origin;
    if (origin.alias > 0) near(origin.filter, 1);
    if (origin.probe > 0) near(origin.alias, 1);
    if (s.definitions > 0) { near(origin.overview, 0); near(origin.dock, 1); }
    if (origin.overview === 1) near(s.reveal, 0);
    if (origin.dock > 0) { near(origin.filter, 1); near(origin.probe, 1); }
    if (origin.matrix > 0) near(origin.dock, 1);
    near(origin.matrix, s.arrange);
    assert.deepEqual(s, M.demixState(t));
  }
});

test('the same A thumbnails shrink to source terms and dock in the matching matrix rows', () => {
  const times = [7, 7.16, 7.40, 7.42, 7.45, 7.48, 7.51, 7.54, 7.6, 7.69, 7.71, 7.73, 7.9, 8, 8.12, 8.17, 8.22];
  const states = times.map(M.sourceOriginState);
  times.toReversed().forEach((t, i) => assert.deepEqual(M.sourceOriginState(t), states[states.length - 1 - i]));
  for (const [b, anchor] of M.sourceAnchors.entries()) {
    const start = M.sourceOriginState(7.4).panels[b], dock = M.sourceOriginState(7.54).panels[b], end = M.sourceOriginState(8).panels[b];
    assert.equal(start.order, M.orders[b]); near(start.x, anchor.overview.x); near(start.y, anchor.overview.y); near(start.scale, 1);
    near(dock.y, anchor.expanded.y); near(dock.x, anchor.expanded.thumbnailX); near(dock.scale, .28);
    near(end.y, anchor.vector.y); near(end.x, anchor.vector.thumbnailX); near(end.scale, .28);
  }
  for (const t of times) {
    const left = M.sourceOriginState(t - 1e-7), right = M.sourceOriginState(t + 1e-7);
    for (const key of ['opacity', 'overview', 'dock', 'matrix']) near(left[key], right[key], 1e-5);
    for (let b = 0; b < 3; b++) for (const key of ['x', 'y', 'scale']) near(left.panels[b][key], right.panels[b][key], .01);
  }
  near(M.sourceOriginState(8).opacity, 1);
  near(M.sourceOriginState(8.22).opacity, 0);
});

test('encoding sum applies each side coefficient once and equals the fixed-phase exposure FFT', () => {
  const full = M.encodingSumState(4), weighted = M.encodingSumState(3.58);
  near(weighted.factor, .4); near(weighted.merge, 0);
  assert.equal(full.panels[0].x, 720); assert.deepEqual(full.panels.map(pane => pane.opacity), [1, 0, 0]);
  for (const time of [3, 3.2, 3.45, 3.58, 3.72, 3.84, 4]) {
    const state = M.encodingSumState(time);
    const emission = Float64Array.from(lesson.capture.truth.sample, (sample, i) => sample * (1 + 2 * state.factor * state.merge * Math.cos(2 * Math.PI * 8 * (i % A.N) / A.N)));
    const expected = A.spectrum(emission);
    for (let i = 0; i < A.N ** 2; i++) {
      const actual = M.encodingSumPixel(lesson, state, i);
      near(actual.re, expected.re[i], 1e-8); near(actual.im, expected.im[i], 1e-8);
      if (time === 4) {
        near(actual.re, lesson.emissionSpectrum.re[i], 1e-8); near(actual.im, lesson.emissionSpectrum.im[i], 1e-8);
        const h = A.otf(A.bin(i % A.N), A.bin(Math.floor(i / A.N)));
        near(actual.re * h, lesson.group.rawSpectra[0].re[i], 1e-8); near(actual.im * h, lesson.group.rawSpectra[0].im[i], 1e-8);
      }
    }
  }
  for (const boundary of [3, 3.08, 3.16, 3.32, 3.58, 3.6, 3.94, 4, 5]) {
    const left = M.encodingSumState(boundary - 1e-6), right = M.encodingSumState(boundary + 1e-6);
    for (const key of ['opacity', 'arrange', 'weight', 'merge', 'factor', 'expanded', 'zeroFocus', 'weightFocus', 'sumFocus']) near(left[key], right[key], 1e-4);
  }
  assert.match(M.scenes[4].note, /固定相位.*公式保留待估参数/);
  assert.equal(M.scenes[5].label, '物镜检测'); assert.equal(M.scenes[6].label, '三帧观测');
});

test('every intermediate detection frame preserves the Fourier pair, actual OTF and fixed exposure', () => {
  const { emission, detected, transfer } = lesson.detection, n = A.N, length = n ** 2;
  const before = emission.slice(), final = detected.slice();
  for (const t of [4, 4.46, 4.56, 4.6, 4.7, 4.85, 4.96, 5, 4.7, 4]) {
    const state = M.detectionState(t), pixels = new Float64Array(length), z = { re: new Float64Array(length), im: new Float64Array(length) };
    for (let i = 0; i < length; i++) {
      const value = M.detectionPixel(lesson, state, i);
      pixels[i] = value.spatial; z.re[i] = value.re; z.im[i] = value.im;
      assert.ok(value.gain >= 0 && value.gain <= 1);
      if (state.filter === 0) { near(value.spatial, emission[i]); near(value.re, lesson.emissionSpectrum.re[i]); near(value.im, lesson.emissionSpectrum.im[i]); }
      if (state.filter === 1) {
        near(value.spatial, detected[i]); near(value.re, lesson.group.rawSpectra[0].re[i], 1e-8); near(value.im, lesson.group.rawSpectra[0].im[i], 1e-8);
      }
    }
    const fft = A.spectrum(pixels), inverse = A.spatial(z);
    for (let i = 0; i < length; i++) {
      near(fft.re[i], z.re[i], 1e-8); near(fft.im[i], z.im[i], 1e-8);
      near(inverse.re[i], pixels[i], 1e-10); near(inverse.im[i], 0, 1e-10);
    }
    near(z.re[0], lesson.emissionSpectrum.re[0], 1e-8);
  }
  near(transfer[A.idx(0, 0)], 1); near(transfer[A.idx(14, 0)], 0);
  near(transfer[A.idx(-6, 0)], transfer[A.idx(6, 0)]);
  assert.ok(transfer[A.idx(6, 0)] > 0 && transfer[A.idx(6, 0)] < .5, 'OTF attenuates inside the passband, beyond a hard cutoff mask');
  assert.deepEqual(emission, before); assert.deepEqual(detected, final);
  assert.equal(lesson.detection.spatialMaximum, 1.8);
});

test('detection first duplicates the reference then applies filtering on one reversible playhead', () => {
  near(M.detectionState(4).opacity, 0); near(M.detectionState(5).opacity, 1); near(M.detectionState(6).opacity, 0);
  for (const t of [4.1, 4.28, 4.4, 4.5, 4.6, 4.8, 5, 5.5]) {
    const state = M.detectionState(t);
    if (state.filter > 0) { near(state.copy, 1); near(state.reference, 1); near(state.passband, 1); }
    if (t <= 4.28) {
      const pose = M.encodingSumState(t).panels[0];
      for (const key of ['x', 'y', 'scale']) near(pose[key], state.spectrumPose[key]);
    }
    const story = M.story(t);
    near(story.intro + story.encodingSum + story.detection + story.demix + story.coverage + story.fusion + story.comparison, 1);
  }
  for (const t of [4, 4.16, 4.24, 4.28, 4.34, 4.46, 4.52, 4.56, 4.64, 4.66, 4.90, 4.96, 5, 6]) {
    const before = M.detectionState(t - 1e-7), after = M.detectionState(t + 1e-7);
    for (const key of ['dock', 'copy', 'filter', 'opacity', 'reference', 'duplicate', 'passband', 'inputFocus', 'filterFocus', 'resultFocus', 'outputY']) near(before[key], after[key], .001);
  }
  const c = clock(); c.player.seek(4); c.player.navigate(1);
  while (c.player.state().position < 4.7) c.advance();
  const paused = c.player.state().position, state = M.detectionState(paused);
  c.player.pause(); c.advance(1000); assert.deepEqual(M.detectionState(c.player.state().position), state);
  c.player.toggle(); c.finish(); near(c.player.state().position, 5);
  c.player.navigate(-1); c.finish(); near(c.player.state().position, 4);
});

test('phase acquisition matches independent illumination, OTF filtering and all three recorded exposures', () => {
  const n = A.N, count = n ** 2, phases = [0, .28, .92, 2 * Math.PI / 3, 2.8, 3.7, 4 * Math.PI / 3];
  const original = lesson.capture.truth.sample.slice();
  for (const phase of phases) {
    const emission = Float64Array.from(original, (s, i) => s * (1 + .8 * Math.cos(2 * Math.PI * (i % n) / 16 + phase)));
    const spectrum = A.spectrum(emission);
    for (let i = 0; i < count; i++) {
      const h = A.otf(A.bin(i % n), A.bin(Math.floor(i / n)));
      spectrum.re[i] *= h; spectrum.im[i] *= h;
    }
    const expected = A.spatial(spectrum);
    for (let i = 0; i < count; i++) near(M.acquisitionPixel(lesson, phase, i), expected.re[i], 1e-10);
  }
  for (const frame of lesson.capture.raw.groups[0].frames) for (let i = 0; i < count; i++) near(M.acquisitionPixel(lesson, frame.phase, i), frame.pixels[i], 1e-11);
  assert.deepEqual(lesson.capture.truth.sample, original);
  assert.equal(lesson.acquisition.maximum, lesson.detection.spatialMaximum);
});

test('the first exposure carries over before the two sequential, reversible phase changes', () => {
  const first = M.acquisitionState(5), last = M.acquisitionState(6);
  assert.deepEqual(first.firstPose, { x: 500, y: 397, size: 184 });
  assert.deepEqual(last.firstPose, { x: 360, y: 250, size: 224 });
  assert.deepEqual(first.frames.map(f => f.opacity), [1, 0, 0]);
  assert.deepEqual(last.frames.map(f => f.opacity), [1, 1, 1]);
  for (let i = 0; i < 3; i++) near(last.frames[i].phase, i * 2 * Math.PI / 3);
  for (const t of [5, 5.12, 5.24, 5.28, 5.32, 5.44, 5.50, 5.61, 5.7, 5.78, 5.88, 5.96, 6]) {
    const state = M.acquisitionState(t), story = M.story(t);
    if (state.firstShift > 0) { near(state.carry, 1); near(state.handoff, 1); }
    if (state.secondShift > 0) { near(state.firstShift, 1); near(state.frames[1].phase, 2 * Math.PI / 3); }
    near(state.frames[0].phase, 0);
    near(story.detection + story.demix, 1);
    const left = M.acquisitionState(t - 1e-7), right = M.acquisitionState(t + 1e-7);
    for (const key of ['x', 'y', 'size']) near(left.firstPose[key], right.firstPose[key], .001);
    for (const key of ['carry', 'handoff', 'clear', 'phase', 'firstShift', 'secondShift', 'stripOpacity']) near(left[key], right[key], .0001);
  }
  const c = clock(); c.player.seek(5); c.player.navigate(1);
  while (c.player.state().position < 5.61) c.advance();
  c.player.pause(); const paused = M.acquisitionState(c.player.state().position); c.advance(1500);
  assert.deepEqual(M.acquisitionState(c.player.state().position), paused);
  c.player.toggle(); c.finish(); near(c.player.state().position, 6);
  c.player.navigate(-1); c.finish(); near(c.player.state().position, 5);
});

test('coordinate explanation reaches each physical endpoint before substitution and retraces when reversed', () => {
  for (const t of [2.5, 2.54, 2.6, 2.68, 2.76, 2.78, 2.81, 2.845, 2.90, 2.95, 3, 3.1, 3.2]) {
    const notation = M.encodingNotationState(t), frame = M.encodingFrame(t);
    near(notation.forward + notation.numeric + notation.inverse + notation.compact, 1);
    for (const value of Object.values(notation)) assert.ok(value >= 0 && value <= 1);
    if (notation.numeric > 0 || notation.inverse > 0 || notation.compact > 0) {
      near(frame.progress, 1); near(frame.panels[2].points[0].f, 6);
    }
  }
  near(M.encodingNotationState(2.55).sourceFocus, 1);
  near(M.encodingNotationState(2.68).shiftFocus, 1);
  near(M.encodingNotationState(2.81).destinationFocus, 1);
  near(M.encodingNotationState(3).lookupFocus, 1); near(M.encodingNotationState(3).lookupDetail, 1);
  near(M.encodingNotationState(3.2).lookupDetail, 0);
  for (const boundary of [2.5, 2.54, 2.58, 2.6, 2.62, 2.74, 2.76, 2.78, 2.79, 2.83, 2.86, 2.87, 2.9, 2.93, 2.97, 3, 3.18]) {
    const before = M.encodingNotationState(boundary - 1e-7), after = M.encodingNotationState(boundary + 1e-7);
    for (const key of Object.keys(before)) near(before[key], after[key], 1e-4);
  }
  const c = clock(); c.player.seek(2); c.player.navigate(1);
  while (c.player.state().position < 2.68) c.advance();
  c.player.pause(); const paused = M.encodingNotationState(c.player.state().position); c.advance(1000);
  assert.deepEqual(M.encodingNotationState(c.player.state().position), paused);
  c.player.toggle(); c.finish(); near(c.player.state().position, 3);
  c.player.navigate(-1); c.finish(); near(c.player.state().position, 2);
});

test('Euler derivation precedes the spectral copies and is continuous under pause and reverse', () => {
  const times = [...new Set([2, 2.02, 2.03, 2.04, 2.05, 2.07, 2.09, 2.11, 2.12, 2.13, 2.14, 2.16, 2.26, 2.28, 2.30, 2.38, 2.40, 2.42, 2.46, 2.48, 2.50, 2.60, 3,
    ...M.encodingFormulaKeyframes.map(frame => frame.time)])].sort((a, b) => a - b);
  const states = times.map(M.encodingDerivationState);
  times.toReversed().forEach((t, i) => assert.deepEqual(M.encodingDerivationState(t), states[states.length - 1 - i]));
  for (const t of times) {
    const state = M.encodingDerivationState(t);
    assert.ok(state.formula.tokens.every(token => token.opacity >= 0 && token.opacity <= 1));
    if (t <= 2.44) near(state.spectra, 0, 1e-10);
    if (t >= 2.50) near(state.spectra, 1);
    if (t <= 2.52) near(state.formula.opacity, 1, 1e-10, 'no full-formula fade between derivation steps');
    if (t < 2.60) near(M.encodingFrame(t).progress, 0);
    for (const offset of [-1e-8, 1e-8]) {
      const adjacent = M.encodingDerivationState(t + offset);
      state.formula.tokens.forEach((token, i) => {
        const other = adjacent.formula.tokens[i];
        near(token.opacity, other.opacity, 1e-4);
        // Invisible symbols may park elsewhere; a visible symbol cannot jump.
        if (token.opacity > 1e-4) for (const key of ['x', 'y', 'scale']) near(token[key], other[key], 1e-3);
      });
      near(state.spectra, adjacent.spectra, 1e-4);
    }
  }
  const c = clock(); c.player.seek(2); c.player.navigate(1);
  while (c.player.state().position < 2.2) c.advance();
  c.player.pause(); const paused = M.encodingDerivationState(c.player.state().position);
  c.advance(1000); assert.deepEqual(M.encodingDerivationState(c.player.state().position), paused);
  c.player.navigate(-1); c.finish(); near(c.player.state().position, 2);
  assert.equal(M.encodingDerivationState(2).view, null);
});

test('Euler teaching holds each result while its explanation changes and introduces one algebraic operation at a time', () => {
  const steps = [
    [2.03, 'theta', ['cosTheta'], ['exponentPlusTheta', 'phasePlus']],
    [2.05, 'identity', ['cosTheta'], ['exponentPlusTheta', 'phasePlus']],
    [2.07, 'cancel', ['cosTheta'], ['exponentPlusTheta', 'phasePlus']],
    [2.09, 'half', ['exponentPlusTheta', 'exponentMinusTheta', 'denPlus'], ['exponentPlusAngle', 'phasePlus']],
    [2.11, 'substitute', ['exponentPlusAngle', 'exponentMinusAngle'], ['exponentPlusTheta', 'phasePlus']],
    [2.13, 'factor', ['phasePlus', 'carrierPlusX', 'phaseMinus', 'carrierMinusX'], ['exponentPlusAngle']],
  ];
  for (const [time, name, visible, absent] of steps) {
    const { view, formula, spectra } = M.encodingDerivationState(time);
    assert.equal(view.id, name); near(formula[name], 1); near(spectra, 0);
    const tokens = Object.fromEntries(formula.tokens.map(token => [token.id, token]));
    visible.forEach(id => near(tokens[id].opacity, 1)); absent.forEach(id => near(tokens[id].opacity, 0));
    near(tokens.ex.opacity, 1); near(tokens.s0x.opacity, 1);
    for (const offset of [-.003, .003]) assert.deepEqual(
      M.encodingDerivationState(time + offset).formula.tokens.filter(token => token.opacity > 0),
      formula.tokens.filter(token => token.opacity > 0));
  }
  for (const [time, name] of [[2.22, 'spatial'], [2.27, 'notation'], [2.335, 'transform'], [2.38, 'positive'], [2.43, 'negative'], [2.455, 'spectrum']]) {
    const state = M.encodingDerivationState(time);
    assert.equal(state.view.id, name);
    const visible = state.formula.tokens.filter(token => token.opacity > 0);
    for (const offset of [-.003, .003]) assert.deepEqual(
      M.encodingDerivationState(time + offset).formula.tokens.filter(token => token.opacity > 0), visible);
  }
});

test('the player delivers Euler reading time at every pacing boundary, with speed scaling and identical reverse timing', () => {
  const points = M.transitionPacing[2], total = M.transitionDurations[2];
  for (const speed of [.5, 1, 2]) {
    const c = clock(); c.player.setSpeed(speed); c.player.seek(2);
    for (const direction of [1, -1]) {
      c.player.go(direction > 0 ? 3 : 2); c.advance();
      const start = c.now;
      for (const [progress, milliseconds] of direction > 0 ? points.slice(1) : points.slice(0, -1).toReversed()) {
        const elapsed = (direction > 0 ? milliseconds : total - milliseconds) / speed;
        while (c.now - start < elapsed - 1e-7) c.advance(Math.min(16, elapsed - (c.now - start)));
        near(c.player.state().position, 2 + progress, 1e-8);
      }
      assert.equal(c.player.state().playing, false);
      near(c.now - start, total / speed, 1e-6);
    }
  }
  const c = clock(); c.player.seek(2.09); c.player.go(3); c.advance(); c.advance(16);
  c.player.pause(); const paused = c.player.state().position; c.advance(1000); near(c.player.state().position, paused);
  c.player.setSpeed(2); c.player.toggle(); c.finish(); near(c.player.state().position, 3);
});

test('passing matching story durations alone retains the Euler reading holds', () => {
  const c = clock(false, { durations: M.transitionDurations.slice() });
  c.player.seek(2); c.player.go(3); c.advance();
  const start = c.now;
  const advanceTo = elapsed => { while (c.now - start < elapsed) c.advance(Math.min(16, elapsed - (c.now - start))); };
  // Real elapsed times exercise the host call that used to silently fall back
  // to a uniform clock: at 12 seconds it had already reached substitution.
  advanceTo(3000); near(c.player.state().position, 2.025, 1e-8);
  advanceTo(11000); near(c.player.state().position, 2.04, 1e-8);
  advanceTo(12000); assert.equal(M.encodingDerivationState(c.player.state().position).view.id, 'identity');
  advanceTo(19000); assert.equal(M.encodingDerivationState(c.player.state().position).view.id, 'identity');
  advanceTo(19600); near(c.player.state().position, 2.06, 1e-8);
  c.player.pause(); const paused = c.player.state().position; c.advance(1000); near(c.player.state().position, paused);
  c.player.navigate(-1); c.finish(); near(c.player.state().position, 2);

  for (const options of [{ durations: M.transitionDurations.slice(), pacing: {} }, { durations: M.transitionDurations.map(v => v / 2) }]) {
    const custom = clock(false, options); custom.player.seek(2); custom.player.go(3); custom.advance();
    for (let elapsed = 0; elapsed < 1000; elapsed += 16) custom.advance(Math.min(16, 1000 - elapsed));
    near(custom.player.state().position, 2 + 1000 / options.durations[2], 1e-8);
  }
});

test('Euler factors branch from their sources and Fourier transforms replace one term at a time', () => {
  const tokensAt = time => Object.fromEntries(M.encodingDerivationState(time).formula.tokens.map(token => [token.id, token]));
  const start = tokensAt(2.14), middle = tokensAt(2.175), end = tokensAt(2.21);
  for (const [child, source] of [['sPlusX', 's0x'], ['sMinusX', 's0x'], ['mMinus', 'mPlus'], ['denMinus', 'denPlus']]) {
    near(start[child].opacity, 0); near(start[child].x, start[source].x); near(start[child].y, start[source].y);
    assert.ok(middle[child].opacity > 0 && middle[child].opacity < 1);
    assert.ok(Math.abs(middle[child].x - start[source].x) > 10);
    assert.ok(Math.abs(middle[child].x - end[child].x) > 10);
    near(end[child].opacity, 1);
  }
  for (const t of [2.125, 2.14, 2.175, 2.21, 2.28, 2.31, 2.36, 2.40, 2.415]) {
    const tokens = tokensAt(t);
    for (const id of ['equals', 'mPlus', 'barPlus', 'denPlus', 'phasePlus', 'phaseMinus']) near(tokens[id].opacity, 1);
  }
  for (const [time, levels] of [[2.30, [0, 0, 0]], [2.325, [1, 0, 0]], [2.37, [1, 1, 0]], [2.415, [1, 1, 1]]]) {
    const tokens = tokensAt(time);
    ['S0', 'SPlus', 'SMinus'].forEach((id, i) => near(tokens[id].opacity, levels[i], 1e-10));
    for (const id of ['mPlus', 'phasePlus', 'mMinus', 'phaseMinus']) near(tokens[id].opacity, 1);
  }
  const final = tokensAt(2.415);
  assert.deepEqual(Object.values(final).filter(token => token.opacity === 1).map(token => token.id).sort(),
    ['ef', 'equals', 'S0', 'plus0', 'mPlus', 'barPlus', 'denPlus', 'phasePlus', 'SPlus', 'plus1', 'mMinus', 'barMinus', 'denMinus', 'phaseMinus', 'SMinus'].sort());
});

test('Euler terms and Fourier shift signs reproduce the emitted complex spectrum for arbitrary phase and modulation', () => {
  const n = A.N, s = lesson.capture.truth.sample, S = lesson.capture.truth.spectrum;
  for (const [kx, ky] of A.VECTORS) {
    // Transform each spatial complex exponential independently of A.shift.
    const shifted = [1, -1].map(order => {
      const re = new Float64Array(n * n), im = new Float64Array(n * n);
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const i = y * n + x, angle = order * 2 * Math.PI * (kx * x + ky * y) / n;
        re[i] = s[i] * Math.cos(angle); im[i] = s[i] * Math.sin(angle);
      }
      const result = A.spectrum(re, n, im);
      for (let fy = 0; fy < n; fy++) for (let fx = 0; fx < n; fx++) {
        const i = fy * n + fx, source = A.idx(fx - order * kx, fy - order * ky);
        near(result.re[i], S.re[source], 1e-8); near(result.im[i], S.im[source], 1e-8);
      }
      return result;
    });
    for (const m of [0, .37, .8]) for (const phase of [.41, 2 * Math.PI / 3]) {
      const emission = new Float64Array(n * n), c = Math.cos(phase), d = Math.sin(phase);
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const i = y * n + x;
        emission[i] = s[i] * (1 + m * Math.cos(2 * Math.PI * (kx * x + ky * y) / n + phase));
      }
      const E = A.spectrum(emission), [plus, minus] = shifted;
      for (let i = 0; i < n * n; i++) {
        near(E.re[i], S.re[i] + m / 2 * (c * plus.re[i] - d * plus.im[i] + c * minus.re[i] + d * minus.im[i]), 1e-8);
        near(E.im[i], S.im[i] + m / 2 * (d * plus.re[i] + c * plus.im[i] - d * minus.re[i] + c * minus.im[i]), 1e-8);
      }
    }
  }
});

test('S(f - order k) retrieves the original complex source of each shifted spectrum', () => {
  const [kx, ky] = A.VECTORS[0], original = lesson.capture.truth.spectrum;
  assert.deepEqual([kx, ky], [8, 0]);
  for (const [b, order] of M.orders.entries()) for (let fy = -A.N / 2; fy < A.N / 2; fy++) for (let fx = -A.N / 2; fx < A.N / 2; fx++) {
    const qx = fx - order * kx, qy = fy - order * ky;
    const source = A.idx(qx, qy), destination = A.idx(fx, fy);
    near(lesson.encodingCopies[b].re[destination], original.re[source]);
    near(lesson.encodingCopies[b].im[destination], original.im[source]);
  }
  for (const [order, f, q] of [[-1, 6, 14], [1, -6, -14], [0, 14, 14]]) {
    near(f - order * kx, q); near(q + order * kx, f);
  }
});

test('the conjugate specimen pair enters opposite sides through opposite encoding orders', () => {
  const frame = M.encodingFrame(3), expected = [[14, -14], [22, -6], [6, -22]];
  assert.deepEqual(frame.panels.map(panel => panel.points.map(point => point.f)), expected);
  const admitted = [];
  for (const [b, panel] of frame.panels.entries()) for (const point of panel.points) {
    const source = A.idx(point.q, 0), destination = A.idx(point.f, 0), factor = panel.order === 0 ? 1 : .4;
    near(lesson.encoding[b].re[destination], factor * lesson.capture.truth.spectrum.re[source], 1e-8);
    near(lesson.encoding[b].im[destination], factor * lesson.capture.truth.spectrum.im[source], 1e-8);
    assert.equal(point.inside, A.otf(point.f, 0) > 0);
    if (point.inside) admitted.push([panel.order, point.q, point.f]);
  }
  assert.deepEqual(admitted, [[1, -14, -6], [-1, 14, 6]]);
  const positive = A.idx(6, 0), negative = A.idx(-6, 0);
  for (const observed of lesson.group.rawSpectra) {
    near(observed.re[negative], observed.re[positive], 1e-8);
    near(observed.im[negative], -observed.im[positive], 1e-8);
  }
  const formulas = M.encodingFormulaValues(frame);
  assert.equal(formulas.positive, String.raw`$$\mathbf q\xrightarrow{-\mathbf k}\mathbf f=\mathbf q-\mathbf k$$`);
  assert.equal(formulas.negative, String.raw`$$-\mathbf q\xrightarrow{+\mathbf k}-\mathbf f=-\mathbf q+\mathbf k$$`);
  assert.equal(M.encodingFrame(2.5).formulaOpacity, 0);
  assert.ok(M.encodingFrame(2.55).formulaOpacity > 0 && M.encodingFrame(2.55).formulaOpacity < 1);
  assert.equal(M.encodingFrame(2.6).formulaOpacity, 1);
  assert.equal(M.encodingFrame(3).formulaOpacity, 1);
  assert.ok(M.encodingFrame(3.175).formulaOpacity > 0 && M.encodingFrame(3.175).formulaOpacity < 1);
  assert.equal(M.encodingFrame(3.35).formulaOpacity, 0);
  for (const boundary of [2.5, 2.6, 3, 3.35]) {
    const before = M.encodingFrame(boundary - 1e-6), after = M.encodingFrame(boundary + 1e-6);
    near(before.formulaOpacity, after.formulaOpacity, 1e-8);
    near(before.formulaOffset, after.formulaOffset, 1e-8);
  }
});

test('the three static excitation states match the displayed cosine formula on the chosen sample row', () => {
  const e = lesson.excitation;
  assert.deepEqual(e.frames.map(frame => frame.label), ['0', '2π/3', '4π/3']);
  assert.equal(e.period, 16); assert.deepEqual(e.point, { x: 100, y: 80 });
  for (const frame of e.frames) {
    near(frame.phase, frame.index * 2 * Math.PI / 3);
    assert.equal(frame.illumination, lesson.capture.truth.illumination[0][frame.index]);
    assert.equal(frame.emission, lesson.capture.truth.emission[0][frame.index]);
    for (let x = 0; x < A.N; x++) {
      const i = A.idx(x, e.point.y), illumination = 1 + e.m * Math.cos(2 * Math.PI * x / e.period + frame.phase);
      near(frame.illumination[i], illumination); near(frame.emission[i], lesson.capture.truth.sample[i] * illumination);
    }
    const i = A.idx(e.point.x, e.point.y);
    near(e.sample, lesson.capture.truth.sample[i]); near(frame.localIllumination, frame.illumination[i]);
    near(frame.localEmission, frame.emission[i]); near(frame.localEmission, e.sample * frame.localIllumination);
  }
  assert.equal(new Set(e.frames.map(frame => frame.localIllumination.toFixed(3))).size, 3);
});

test('the DFT definition in the theory dialog matches FFT signs, normalization and sample-frequency coordinates', () => {
  const n = A.N, sample = lesson.capture.truth.sample, spectrum = lesson.capture.truth.spectrum;
  for (const [qx, qy] of [[0, 0], [14, 0], [0, 14], [4, 7], [-4, -7]]) {
    let re = 0, im = 0;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const phase = -2 * Math.PI * (qx * x + qy * y) / n, value = sample[y * n + x];
      re += value * Math.cos(phase); im += value * Math.sin(phase);
    }
    near(re, spectrum.re[A.idx(qx, qy)], 1e-8); near(im, spectrum.im[A.idx(qx, qy)], 1e-8);
  }
  // Fourteen periods across x, constant along y: energy lands at (±14, 0).
  const phase = .37, pixels = Float64Array.from({ length: n ** 2 }, (_, i) => Math.cos(2 * Math.PI * 14 * (i % n) / n + phase));
  const harmonic = A.spectrum(pixels);
  for (const sign of [-1, 1]) {
    const i = A.idx(sign * 14, 0);
    near(harmonic.re[i], n ** 2 / 2 * Math.cos(phase), 1e-8);
    near(harmonic.im[i], sign * n ** 2 / 2 * Math.sin(phase), 1e-8);
  }
  near(Math.hypot(harmonic.re[A.idx(0, 14)], harmonic.im[A.idx(0, 14)]), 0, 1e-8);
});

test('the PSF / OTF pair gives the same camera pixels by spatial convolution and frequency multiplication', () => {
  const transfer = Float64Array.from({ length: A.N ** 2 }, (_, i) => A.otf(A.bin(i % A.N), A.bin(Math.floor(i / A.N))));
  const psf = A.spatial({ re: transfer, im: new Float64Array(transfer.length) });
  const roundTrip = A.spectrum(psf.re);
  near(psf.re.reduce((total, value) => total + value, 0), 1);
  for (let i = 0; i < transfer.length; i++) {
    near(psf.im[i], 0); near(roundTrip.re[i], transfer[i]); near(roundTrip.im[i], 0);
  }
  // Compute convolution directly at central and edge pixels, independently of
  // the FFT filtering code. Include all phases and directions of illumination.
  const cases = [[lesson.capture.truth.sample, lesson.capture.truth.widefield]];
  lesson.capture.raw.groups.forEach((group, d) => group.frames.forEach((frame, j) => cases.push([lesson.capture.truth.emission[d][j], frame.pixels])));
  for (const [source, detected] of cases) for (const [x, y] of [[0, 0], [64, 64], [37, 80], [127, 127]]) {
    let convolution = 0;
    for (let v = 0; v < A.N; v++) for (let u = 0; u < A.N; u++) convolution += source[v * A.N + u] * psf.re[A.idx(x - u, y - v)];
    near(convolution, detected[A.idx(x, y)], 1e-10);
  }
});

test('every fusion stop matches all complex frequency bins from the existing pipeline', () => {
  const p = lesson.pipeline;
  for (const [time, expected] of [[17, p.bands[2].matched], [18, p.numerator], [19, p.preApoSpectrum], [20, p.spectrum], [21, p.spectrum]]) {
    const view = M.fusionFrame(lesson, time).views[2];
    for (let i = 0; i < expected.re.length; i++) {
      const actual = M.pixel(view, i); near(actual.re, expected.re[i], 1e-9); near(actual.im, expected.im[i], 1e-9);
    }
  }
  for (let item = 0; item < 9; item++) {
    const scene=M.scenes.find(scene=>scene.id==='sum-contributions');
    const inverseSmooth=value=>{let lo=0,hi=1;for(let j=0;j<55;j++){const p=(lo+hi)/2;if(p*p*(3-2*p)<value)lo=p;else hi=p;}return(lo+hi)/2;};
    const progress=item===0?scene.timeline.progressFor('firstAdd',.47)
      :scene.timeline.progressFor('remainingBands',.04+.88*inverseSmooth((item-1+.75)/8));
    const frame = M.fusionFrame(lesson, 17 + progress);
    assert.equal(frame.index,item);
    const index = A.idx(14, 0, p.spectrumSize), actual = M.pixel(frame.views[2], index), record = lesson.records[item];
    // Clock.progressFor rounds the chosen UI position to 1e-12. Allow that
    // presentation precision here; full stop arrays above retain strict checks.
    near(actual.re, (record.before.re[index] + record.after.re[index]) / 2, 1e-8);
    near(actual.im, (record.before.im[index] + record.after.im[index]) / 2, 1e-8);
  }
});

test('Wiener denominator, apodization, inverse FFT and final frequency audit keep their exact conventions', () => {
  const p = lesson.pipeline, z = A.idx(14, 0, p.spectrumSize);
  for (let i = 0; i < p.spectrum.re.length; i++) {
    const denominator = p.bands.reduce((total, band) => total + band.h[i] ** 2 * (band.order === 0 ? 2 : 1), 0);
    near(denominator, p.denominator[i]);
    near(p.preApoSpectrum.re[i] * p.apodization[i], p.spectrum.re[i]);
    near(p.preApoSpectrum.im[i] * p.apodization[i], p.spectrum.im[i]);
  }
  const inverse = A.spatial(p.spectrum, p.spectrumSize);
  for (let i = 0; i < inverse.re.length; i++) near(4 * inverse.re[i], p.outputPixels[i]);
  near(lesson.audit.ratio, p.effectiveTransfer[z]); near(lesson.audit.phaseError, 0, 1e-8);
  assert.equal(lesson.audit.widefieldAmplitude, 0);
  assert.ok(lesson.audit.outputAmplitude > 0 && lesson.audit.ratio < 1);
});

test('chapter coverage, story transitions and full forward/reverse playback stay complete', () => {
  assert.equal(M.scenes.length, 24);
  assert.deepEqual(M.chapters.flatMap(chapter => Array.from({ length: chapter.end - chapter.start + 1 }, (_, i) => chapter.start + i)), M.scenes.map((_, i) => i));
  for (let step = 0; step < M.scenes.length; step++) {
    const left = M.story(Math.max(0, step - 1e-6)), right = M.story(Math.min(M.scenes.length - 1, step + 1e-6));
    for (const key of ['intro', 'encodingSum', 'detection', 'demix', 'coverage', 'fusion', 'comparison']) near(left[key], right[key], 1e-6);
    const state = M.story(step);
    near(state.intro + state.encodingSum + state.detection + state.demix + state.coverage + state.fusion + state.comparison, 1);
  }
  const c = clock();
  for (let step = 1; step < M.scenes.length; step++) { c.player.navigate(1); c.finish(); assert.equal(c.player.state().position, step); }
  for (let step = M.scenes.length - 2; step >= 0; step--) { c.player.navigate(-1); c.finish(); assert.equal(c.player.state().position, step); }
});
