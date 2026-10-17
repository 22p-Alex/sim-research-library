/* Dataset integration contract. Numerical checks only; no browser or visual QA. */
const test = require('node:test'), assert = require('node:assert/strict');
const E = require('../web/shared/sim-parameter-estimation.js');
const A = require('../web/atlas/sim-atlas-core.js');
const near = (actual, expected, tolerance = 1e-9) => assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
const capture = E.capture(), dataset = E.estimateDataset(capture.raw, capture.config);

function assertParameters(actual, index, vector, phase, m, n = A.N) {
  assert.equal(actual.index, index); assert.equal(actual.ok ?? true, true);
  near(actual.kx, vector[0]); near(actual.ky, vector[1]); near(actual.phase, phase); near(actual.m, m);
  near(actual.angle, Math.atan2(vector[1], vector[0]) * 180 / Math.PI);
  near(actual.period, n / Math.hypot(...vector));
  actual.phases.forEach((value, j) => near(value, 2 * Math.PI * j / 3 + phase));
}

test('all observed directions are estimated and enter one complete nine-band reconstruction', () => {
  assert.equal(dataset.ok, true); assert.equal(dataset.raw, capture.raw); assert.equal(dataset.reason, null);
  assert.equal(dataset.estimates.length, 3);
  dataset.estimates.forEach((item, d) => assertParameters(item, d, capture.truth.vectors[d], capture.truth.offsets[d], .8));
  const result = E.reconstructDataset(capture.raw, dataset);
  assert.equal(result.pipeline.ok, true); assert.equal(result.pipeline.groups.length, 3); assert.equal(result.pipeline.bands.length, 9);
  assert.equal(result.estimates, dataset.estimates); assert.equal(result.config, dataset.config); assert.equal(result.pipeline.raw, result.raw);
  assert.equal(result.modulationFallback, false); assert.equal(result.parameters.length, 3);
  result.parameters.forEach((item, d) => assertParameters(item, d, capture.truth.vectors[d], capture.truth.offsets[d], .8));
  for (const group of capture.raw.groups) for (const [j, frame] of group.frames.entries()) {
    assert.equal(result.raw.groups[group.index].frames[j].pixels, frame.pixels, 'the host must receive the original pixel arrays');
    assert.equal(Object.hasOwn(frame, 'phase'), false, 'estimated phase belongs to a reconstruction shell, not the observation');
  }
  result.pipeline.groups.forEach((group, d) => {
    near(group.m, .8); near(group.kx, capture.truth.vectors[d][0]); near(group.ky, capture.truth.vectors[d][1]);
    assert.equal(group.fallback, false); assert.equal(group.bands.length, 3);
    group.phases.forEach((phase, j) => near(phase, capture.truth.phases[d][j]));
  });
  assert.ok(result.pipeline.outputPixels.every(Number.isFinite));
});

test('direction IDs select their own estimated modulation and phase without assuming consecutive indices', () => {
  const cases = [
    { index: 7, vector: [8, 0], phase: .2, m: .45 },
    { index: 2, vector: [4, 7], phase: -.7, m: .63 },
    { index: 11, vector: [-4, 7], phase: 1.1, m: .94 },
  ];
  const acquisitions = cases.map(item => E.capture({ vectors: [item.vector], offsets: [item.phase], m: item.m }));
  const raw = { n: A.N, groups: acquisitions.map((item, d) => ({ index: cases[d].index, frames: item.raw.groups[0].frames })) };
  const estimated = E.estimateDataset(raw, acquisitions[0].config);
  assert.equal(estimated.ok, true);
  const result = E.reconstructDataset(raw, estimated);
  for (const [d, expected] of cases.entries()) {
    assertParameters(estimated.estimates[d], expected.index, expected.vector, expected.phase, expected.m);
    assertParameters(result.parameters[d], expected.index, expected.vector, expected.phase, expected.m);
    const group = result.pipeline.groups[d], spectrum = acquisitions[d].truth.spectrum;
    near(group.m, expected.m); assert.equal(group.index, expected.index); assert.equal(group.fallback, false);
    // Independent imaging identity: each formal band has no illumination scale
    // or common phase left, and still contains its detection OTF attenuation.
    [0, 1, -1].forEach((order, b) => {
      for (const [x, y] of [[0, 0], [2, -3], [-4, 1], [6, 0]]) {
        const i = A.idx(x, y), q = A.idx(x - order * expected.vector[0], y - order * expected.vector[1]), h = A.otf(x, y);
        near(group.separated[b].re[i], h * spectrum.re[q]); near(group.separated[b].im[i], h * spectrum.im[q]);
      }
    });
  }
  assert.deepEqual(result.pipeline.bands.map(band => band.direction), cases.flatMap(item => [item.index, item.index, item.index]));
});

test('dataset estimation and reconstruction never inspect hidden illumination truth or observed phase metadata', () => {
  function hidden(target, keys) {
    for (const key of keys) Object.defineProperty(target, key, { enumerable: true, get() { throw new Error('hidden truth accessed: ' + key); } });
    return target;
  }
  const raw = hidden({ n: capture.raw.n, groups: capture.raw.groups.map(group => hidden({ index: group.index,
    frames: group.frames.map(frame => hidden({ index: frame.index, pixels: frame.pixels }, ['phase', 'truth'])) }, ['truth', 'kx', 'ky', 'm', 'angle', 'period'])) }, ['truth', 'calibration']);
  const config = hidden({ ...capture.config }, ['truth', 'vectors', 'offsets', 'm']);
  const estimated = E.estimateDataset(raw, config);
  assert.equal(estimated.ok, true); assert.equal(estimated.raw, raw);
  const result = E.reconstructDataset(raw, estimated);
  assert.equal(result.pipeline.ok, true);
  raw.groups.forEach((group, d) => group.frames.forEach((frame, j) => assert.equal(result.raw.groups[d].frames[j].pixels, frame.pixels)));
});

test('failed, missing, duplicate, mismatched, or fallback estimates cannot enter a successful dataset reconstruction', () => {
  const raw = { n: capture.raw.n, groups: capture.raw.groups.map((group, d) => d === 1
    ? { index: group.index, frames: group.frames.map(frame => ({ index: frame.index, pixels: new Float64Array(frame.pixels.length) })) } : group) };
  const failed = E.estimateDataset(raw, capture.config);
  assert.equal(failed.ok, false); assert.equal(failed.estimates.length, 3); assert.equal(failed.estimates[1].ok, false);
  assert.match(failed.reason, /方向 1/); assert.throws(() => E.reconstructDataset(raw, failed), /有效全方向/);
  assert.equal(E.estimateDataset({ n: A.N, groups: [] }, capture.config).ok, false);
  assert.equal(E.estimateDataset({ n: A.N, groups: [capture.raw.groups[0], capture.raw.groups[0]] }, capture.config).ok, false);
  assert.equal(E.estimateDataset(capture.raw, { ...capture.config, n: 64 }).ok, false);
  assert.throws(() => E.reconstructDataset({ ...capture.raw }, dataset), /同一份观测/);
  assert.throws(() => E.reconstructDataset(capture.raw, { ...dataset, estimates: dataset.estimates.slice(1) }), /不匹配/);
  const replace = patch => ({ ...dataset, estimates: dataset.estimates.map((item, d) => d === 1 ? { ...item, ...patch } : item) });
  assert.throws(() => E.reconstructDataset(capture.raw, replace({ index: 9 })), /缺少有效/);
  assert.throws(() => E.reconstructDataset(capture.raw, replace({ ok: false })), /缺少有效/);
  assert.throws(() => E.reconstructDataset(capture.raw, replace({ m: .3 })), /回退/);
  assert.throws(() => E.reconstructDataset(capture.raw, replace({ m: NaN })), /缺少有效/);
});

test('the atlas core preserves scalar modulation calls and rejects incomplete or invalid direction maps', () => {
  const shell = E.reconstructDataset(capture.raw, dataset).raw;
  const calibration = { n: A.N, kc: A.KC / A.N, electrons: 1, background: 0, readNoise: 0, shotNoise: false,
    groups: dataset.estimates.map(item => ({ index: item.index, angle: item.angle, period: item.period, mean: 1 })) };
  const scalar = A.pipeline(shell, calibration, {}, .8), mapped = A.pipeline(shell, calibration, {}, { 0: .8, 1: .8, 2: .8 });
  assert.equal(scalar.ok, true); assert.equal(mapped.ok, true); assert.deepEqual(scalar.pixels, mapped.pixels);
  for (const [mapping, reason] of [[{ 0: .8, 2: .8 }, 'modulation-missing'], [{ 0: .8, 1: NaN, 2: .8 }, 'modulation-invalid'], [NaN, 'modulation-invalid']]) {
    const result = A.pipeline(shell, calibration, {}, mapping);
    assert.equal(result.ok, false); assert.equal(result.reason, reason); assert.equal(result.pixels, null); assert.equal(result.bands.length, 0);
  }
  const estimated = A.pipeline(shell, calibration);
  assert.equal(estimated.ok, true); assert.equal(estimated.estimates.length, 3, 'undefined retains the old modulation estimator');
});
