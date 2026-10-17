/* Production HTML scripts and one simulated DOM. No visual acceptance. */
const test = require('node:test'), assert = require('node:assert/strict');
const Motion = require('../web/motion/sim-motion-model.js');
const Chapter = require('../web/motion/sim-motion-parameter-chapter.js');
const Story = require('../web/parameter-demo/sim-parameter-model.js');
const Study = require('../web/parameter-demo/sim-parameter-two-stage.js');
const boot = require('./helpers/motion-dom.cjs');
const near = (a, b, eps = 1e-9) => assert.ok(Number.isFinite(+a) && Math.abs(+a - b) < eps, `${a} != ${b}`);

test('36 stops preserve every complete scene interval and the existing reconstruction transitions', () => {
  const flow = Chapter.plan(Motion);
  assert.equal(flow.scenes.length, 36); assert.equal(flow.durations.length, 35);
  assert.equal(flow.index('inverse-demix'), 9);
  assert.equal(flow.index('provisional-split'), 10);
  assert.equal(flow.index('parameters.shared'), 11);
  assert.equal(flow.index('parameters.line-shift'), 12);
  assert.equal(flow.index('parameters.shift'), 13);
  assert.equal(flow.index('adopted-weights'), 22);
  assert.equal(flow.index('verify-demix'), -1);
  assert.equal(flow.index('separate-bands'), 23);
  assert.equal(flow.index('relocate-bands'), 24);
  for (const id of Chapter.sceneIds) {
    const end = flow.index('parameters.' + id);
    for (const p of [.000001, .02, .16, .5, .99, 1]) {
      const frame = flow.frame(end - 1 + p);
      assert.equal(frame.owner, 'parameters'); assert.equal(frame.sceneId, id);
      near(frame.progress, p); assert.equal(frame.index, end);
      assert.equal(frame.baseTime, 9);
    }
    assert.equal(flow.durations[end - 1], Study.scene(id).duration + (id === 'shared' ? Chapter.sharedEntryDuration : 0));
  }
  for (const p of [.01, .12, .43, .99, 1]) {
    const frame = flow.frame(22 + p);
    assert.ok(frame.baseTime >= 10.28 && frame.baseTime <= 11);
    assert.equal(Motion.demixState(frame.baseTime).panels.proof, 0, 'the skipped proof cannot flash during the handoff');
  }
  assert.equal(flow.sceneIndex(22.05), 22, 'keep adopted weights during the entry fade');
  assert.equal(flow.sceneIndex(22.2), 23);
  for (let old = 11; old <= 23; old++) near(flow.frame(old + 12).baseTime, old);

});

test('production host estimates the same nine frames and drives the chapter and reconstruction with one player', () => {
  let captures = 0, players = 0, chapter, adopted, lesson, supplied, playerOptions;
  const h = boot({ beforeRenderer(context) {
    const capture = context.SIMAtlas.capture;
    context.SIMAtlas.capture = (...args) => { captures++; return capture(...args); };
    const create = context.SIMMotionParameterChapter.create;
    context.SIMMotionParameterChapter.create = options => {
      supplied = options; chapter = create(options);
      const reconstruct = chapter.reconstructAll;
      chapter.reconstructAll = () => (adopted = reconstruct());
      return chapter;
    };
    const createLesson = context.SIMMotion.createLesson, createPlayer = context.SIMMotion.createPlayer;
    context.SIMMotion.createLesson = options => (lesson = createLesson(options));
    context.SIMMotion.createPlayer = options => { players++; playerOptions = options; return createPlayer(options); };
  } });
  const { context, byId, doc, nodes, pending, errors, windowEvents } = h;
  assert.deepEqual(errors, []); assert.equal(byId.get('fatal-error').hidden, true);
  const flow = context.SIMMotionParameterChapter.plan(context.SIMMotion);
  assert.equal(captures, 1); assert.equal(players, 1);
  assert.equal(playerOptions.pacing[2].at(-1)[1], 111900);
  assert.equal(playerOptions.durations[2], playerOptions.pacing[2].at(-1)[1]);
  assert.equal(supplied.raw, lesson.capture.raw); assert.equal(supplied.truth, undefined);
  assert.equal(lesson.pipeline, adopted.pipeline);
  assert.equal(chapter.lesson.capture.raw, supplied.raw);
  assert.equal(chapter.lesson.audit == null, true);
  adopted.parameters.forEach((p, d) => {
    const g = lesson.pipeline.groups[d];
    near(g.kx, p.kx); near(g.ky, p.ky); near(g.m, p.m);
    g.phases.forEach((phi, j) => near(phi, p.phases[j]));
    lesson.pipeline.raw.groups[d].frames.forEach((frame, j) => assert.equal(frame.pixels, supplied.raw.groups[d].frames[j].pixels));
  });
  assert.equal(byId.get('scene-stops').children.length, 36);
  assert.equal(byId.get('progress').max, '35');
  const seek = t => { byId.get('progress').value = String(t); byId.get('progress').dispatch('input'); };
  // The production 03→04 interval teaches Euler and Fourier before showing
  // spectral copies, transporting persistent MathML tokens on one playhead.
  const spectralCopies = nodes.find(node => node.attrs['data-encoding-domain'] === 'frequency');
  const algebraNodes = nodes.filter(node => node.attrs['data-encoding-token']);
  const algebraContents = algebraNodes.map(node => node.children[0]);
  assert.equal(algebraNodes.length, Motion.encodingFormulaTokens.length);
  const fractionLines = nodes.filter(node => node.attrs['data-fraction-bar']);
  assert.equal(fractionLines.length, 2);
  for (const line of fractionLines) {
    assert.equal(line.tagName, 'line');
    assert.equal(line.attrs.stroke, 'currentColor');
    assert.equal(line.attrs['vector-effect'], 'non-scaling-stroke');
    assert.ok(+line.attrs['stroke-width'] >= 1.5);
    assert.ok(+line.attrs.x2 > +line.attrs.x1);
    assert.equal(line.attrs.y1, line.attrs.y2);
    assert.ok(['#b7a5eb', '#efb879'].includes(line.parent.attrs.color));
  }
  const derivationTimes = [2, 2.03, 2.05, 2.07, 2.09, 2.11, 2.13, 2.175, 2.20, 2.25, 2.27, 2.31, 2.33, 2.36, 2.39, 2.44, 2.49, 2.50, 2.55, 2.65, 3];
  const derivationSnapshots = new Map();
  for (const t of [...derivationTimes, ...derivationTimes.toReversed()]) {
    const previous = Number(byId.get('scene-number').textContent) - 1, renders = h.mathRenders;
    seek(t);
    if (previous === Motion.sceneIndex(t)) assert.equal(h.mathRenders, renders, 'derivation does not recompile equations per frame');
    const state = Motion.encodingDerivationState(t), view = state.view;
    if (t <= 2.44) near(spectralCopies.style.opacity, 0);
    if (t >= 2.5) near(spectralCopies.style.opacity, 1);
    if (view) {
      assert.equal(byId.get('scene-number').textContent, '04');
      assert.equal(byId.get('scene-title').textContent, view.title);
      assert.equal(byId.get('equation-domain').textContent, view.domain);
      assert.equal(byId.get('stage-caption').textContent, `${Motion.encodingDerivationStages.indexOf(view) + 1} / ${Motion.encodingDerivationStages.length} · ${view.domain}`);
      assert.equal(byId.get('encoding-sum-equations').hidden, false);
      assert.equal(byId.get('equation').hidden, true);
    }
    state.formula.tokens.forEach((pose, i) => {
      const node = algebraNodes[i];
      assert.equal(node.attrs['data-encoding-token'], pose.id);
      assert.equal(node.children[0], algebraContents[i], 'same symbol or fraction stroke retained through every step');
      assert.equal(node.attrs.transform, `translate(${pose.x} ${pose.y}) scale(${pose.scale})`);
      near(node.style.opacity, pose.opacity);
      assert.equal(node.attrs['aria-hidden'], String(pose.opacity === 0));
    });
    near(byId.get('encoding-derivation').style.opacity, state.formula.opacity);
    for (const name of ['theta', 'identity', 'cancel', 'half', 'substitute', 'factor', 'notation', 'theorem']) {
      const node = byId.get(`encoding-algebra-${name}`);
      near(node.style.opacity, state.formula[name]);
      assert.equal(node.attrs['aria-hidden'], String(state.formula[name] === 0));
    }
    const snapshot = JSON.stringify([byId.get('scene-title').textContent, byId.get('equation-note').textContent,
      byId.get('equation-domain').textContent, spectralCopies.style.opacity, state.formula]);
    if (derivationSnapshots.has(t)) assert.equal(snapshot, derivationSnapshots.get(t));
    else derivationSnapshots.set(t, snapshot);
  }
  seek(3); assert.equal(byId.get('encoding-replay').hidden, false);
  byId.get('equation-info').dispatch('click'); assert.equal(doc.activeElement, byId.get('theory-encoding'));
  byId.get('theory-close').dispatch('click');
  byId.get('encoding-replay').dispatch('click'); near(+byId.get('progress').value, 2);
  assert.equal(byId.get('encoding-replay').disabled, true); h.advance();
  const replayStart = h.now;
  while (h.now - replayStart < 12000) h.advance();
  assert.equal(byId.get('scene-title').textContent, Motion.encodingDerivationStages.find(stage => stage.id === 'identity').title);
  assert.match(byId.get('stage-caption').textContent, /^2 \/ 12/);
  near(byId.get('encoding-algebra-identity').style.opacity, 1);
  byId.get('pause').dispatch('click');
  const pausedDerivation = +byId.get('progress').value; h.advance(); near(+byId.get('progress').value, pausedDerivation);
  seek(3);
  // The recalled textures use the same unweighted copies as 05, and reach
  // the bands reconstructed from the camera frames before the A / f labels.
  const originPanels = nodes.filter(node => node.attrs['data-source-origin'] !== undefined);
  assert.equal(originPanels.length, 3);
  const originCanvases = originPanels.map(panel => panel.children.find(node => node.tagName === 'foreignObject').children[0]);
  const matrixSources = nodes.filter(node => node.attrs['data-matrix-source'] !== undefined);
  const sourceTerms = nodes.filter(node => node.attrs['data-source-term'] !== undefined);
  assert.equal(matrixSources.length, 3); assert.equal(sourceTerms.length, 3);
  const originTimes = [7.12, 7.16, 7.21, 7.25, 7.30, 7.35, 7.40, 7.46, 7.50, 7.54, 7.65, 7.70, 7.72, 7.74, 7.9, 8, 8.12, 8.17, 8.22], originSnapshots = new Map();
  const sourceMax = Math.max(...lesson.capture.truth.spectrum.re.map((v, i) => Math.hypot(v, lesson.capture.truth.spectrum.im[i])),
    ...lesson.emissionSpectrum.re.map((v, i) => Math.hypot(v, lesson.emissionSpectrum.im[i])));
  for (const t of [...originTimes, ...originTimes.toReversed()]) {
    seek(t);
    const state = Motion.demixState(t), origin = state.origin;
    near(byId.get('demix-source-origin').style.opacity, origin.opacity);
    assert.equal(byId.get('demix-source-origin').attrs['aria-hidden'], String(origin.opacity === 0));
    near(byId.get('demix-equations').style.opacity, Math.max(state.reveal, origin.opacity));
    near(byId.get('demix-formula-origin').style.opacity, origin.overview);
    if (origin.opacity > 0) for (const [b, panel] of originPanels.entries()) {
      const canvas = panel.children.find(node => node.tagName === 'foreignObject').children[0];
      assert.equal(canvas, originCanvases[b], 'moving A reuses the original canvas');
      assert.equal(panel.attrs['data-source-order'], String(Motion.orders[b]));
      assert.equal(sourceTerms[b].attrs['data-source-order'], panel.attrs['data-source-order']);
      assert.equal(matrixSources[b].attrs['data-source-order'], panel.attrs['data-source-order']);
      const pose = origin.panels[b];
      assert.equal(panel.attrs.transform, `translate(${pose.x} ${pose.y}) scale(${pose.scale})`);
      if (origin.matrix === 1) near(pose.y, Number(matrixSources[b].attrs.y) + Number(matrixSources[b].attrs.height) / 2);
      if (origin.dock === 1 && origin.matrix === 0 && state.reveal > 0) {
        near(pose.y, Number(sourceTerms[b].attrs.transform.match(/translate\([^ ]+ ([^)]+)\)/)[1]));
      }
      const key = `${t}:${b}`, snapshot = Array.from(canvas.lastPixels);
      if (originSnapshots.has(key)) assert.deepEqual(snapshot, originSnapshots.get(key)); else originSnapshots.set(key, snapshot);
      if (origin.filter === 0 || origin.filter === 1) {
        const field = origin.filter === 0 ? lesson.encodingCopies[b] : lesson.group.separated[b];
        for (const pixel of [0, 38 * 128 + 52, 64 * 128 + 64, 64 * 128 + 80]) {
          const x = Math.floor((pixel % 128 - 64) * 48 / 128), y = Math.floor((Math.floor(pixel / 128) - 64) * 48 / 128);
          const i = ((y + 128) % 128) * 128 + ((x + 128) % 128), v = Math.log1p(Math.hypot(field.re[i], field.im[i])) / Math.log1p(sourceMax);
          const expected = new Uint8ClampedArray([9 + 189 * v, 17 + 219 * v, 23 + 229 * v, 255]);
          expected.forEach((value, c) => assert.ok(Math.abs(snapshot[pixel * 4 + c] - value) <= 1));
        }
      }
    }
  }
  seek(7.4);
  const filteredPixels = originCanvases.map(canvas => Array.from(canvas.lastPixels));
  const canvasWrites = h.work.canvas;
  for (const t of [7.46, 7.54, 7.7, 7.74, 8, 7.74, 7.54, 7.46, 7.4]) {
    seek(t);
    originCanvases.forEach((canvas, b) => assert.deepEqual(Array.from(canvas.lastPixels), filteredPixels[b]));
  }
  assert.equal(h.work.canvas, canvasWrites, 'shrinking and docking never recompute or reweight the spectra');
  const fLabels = nodes.filter(node => node.attrs['data-detector-label'] !== undefined);
  assert.equal(fLabels.length, 3); fLabels.forEach(label => assert.equal(label.textContent, 'f'));
  const snapshot = () => Object.fromEntries(['motion-content', 'provisional-stage', 'split-handoff-stage', 'parameter-stage', 'adopted-stage'].map(id => [id, byId.get(id).style.opacity]));
  const saved = new Map();
  const positions = Array.from({ length: 36 }, (_, i) => i).flatMap(i => i ? [i - .99, i - .8, i - .5, i - .01, i] : [0]);
  for (const t of [...positions, ...positions.toReversed()]) {
    seek(t);
    const frame = flow.frame(t), index = flow.sceneIndex(t);
    assert.equal(byId.get('scene').attrs['data-flow-scene'], flow.scenes[index].id);
    assert.equal(byId.get('scene-number').textContent, String(index + 1).padStart(2, '0'));
    assert.equal(byId.get('scene-stops').children.filter(el => el.attrs['aria-current'] === 'step').length, 1);
    if (frame.owner === 'parameters') {
      assert.equal(byId.get('parameter-stage').attrs['data-scene-id'], frame.sceneId);
      const state = chapter.state(frame.sceneId, frame.progress), split = frame.sceneId === 'shared' ? Chapter.sharedEntryState(frame.progress) : null;
      const formula = split && split.progress < 1 ? Chapter.sharedEntryFormulaAt(frame.progress) : context.SIMParameterLesson.formulaAt(state);
      assert.equal(byId.get('equation-note').textContent, formula.note);
      assert.equal(byId.get('equation').attrs['data-formula-mode'], split && split.progress < 1 ? 'shared-entry' : context.SIMParameterLesson.formulaMode(state));
      assert.ok(!byId.get('equation').hidden);
      assert.ok(byId.get('demix-equations').hidden);
      assert.equal(byId.get('equation-info').hidden, true);
    }
    for (const node of nodes) for (const key of ['transform', 'd', 'opacity', 'x', 'y']) {
      if (node.attrs[key] !== undefined) assert.doesNotMatch(node.attrs[key], /NaN|Infinity/);
    }
    if (saved.has(t)) assert.deepEqual(snapshot(), saved.get(t), 'reverse retraces the same chapter handoffs');
    else saved.set(t, snapshot());
  }
  assert.equal(nodes.filter(el => el.attrs['data-adopted-product'] !== undefined).length, 0);
  assert.equal(nodes.filter(el => el.attrs['data-adopted-response'] !== undefined).length, 0);
  const inverses = nodes.filter(el => el.attrs['data-adopted-inverse']);
  assert.equal(inverses.length, 9);
  for (const el of inverses) {
    const [b, j] = el.attrs['data-adopted-inverse'].split(':').map(Number), w = lesson.group.weights[b][j];
    near(el.attrs['data-re'], w.re); near(el.attrs['data-im'], w.im);
  }
  // The same temporary spectra enter with the estimation scene. They stay
  // hidden throughout the short illumination bridge and keep their scale.
  const pair = nodes.find(el => el.attrs['data-frequency-pair'] !== undefined);
  const pictures = nodes.filter(el => el.attrs['data-shared-band'] !== undefined);
  const observationColumn = nodes.filter(el => el.attrs['data-demix-observation'] !== undefined);
  assert.equal(observationColumn.length, 3); assert.equal(pictures.length, 2);
  const textures = pictures.map(el => el.attrs.href), pairScale = { ...pair.attrs };
  const samePositions = new Map();
  const shared = flow.index('parameters.shared'), provisional = flow.index('provisional-split');
  const positionsAroundHandoff = [provisional, shared - .999999, shared - .91, shared - .82, shared - .77, shared - .71, shared - .65, shared - .54, shared - .43];
  for (const t of [...positionsAroundHandoff, ...positionsAroundHandoff.toReversed()]) {
    seek(t);
    assert.deepEqual(pictures.map(el => el.attrs.href), textures);
    assert.equal(pair.attrs['data-frequency-range'], pairScale['data-frequency-range']);
    assert.equal(pair.attrs['data-brightness-maximum'], pairScale['data-brightness-maximum']);
    near(byId.get('frequency-handoff-stage').style.opacity, t === provisional ? 0 : Chapter.sharedEntryState(t - provisional).handoff);
    if (t === provisional) continue;
    const transforms = pictures.map(el => el.parent.attrs.transform);
    if (samePositions.has(t)) assert.deepEqual(transforms, samePositions.get(t));
    else samePositions.set(t, transforms);
  }
  const ratio = nodes.find(el => el.attrs['data-study-ratio'] !== undefined);
  seek(flow.index('parameters.fit')); const endpoint = ratio.attrs.d;
  seek(flow.index('parameters.read') - .99); assert.equal(ratio.attrs.d, endpoint);
  seek(flow.index('parameters.coarse') - .5);
  const candidateGroup = nodes.find(el => el.attrs['data-candidate-panel'] !== undefined);
  const kx = Number(candidateGroup.attrs['data-kx']), ky = Number(candidateGroup.attrs['data-ky']);
  const independent = context.SIMParameterEstimation.compare(chapter.lesson.estimate.context, kx, ky, true);
  near(candidateGroup.attrs['data-score'], independent.score); near(candidateGroup.attrs['data-count'], independent.count);
  seek(flow.index('parameters.shared'));
  byId.get('chapter-replay').dispatch('click');
  assert.equal(pending.size, 1); h.advance(); h.advance();
  assert.equal(byId.get('parameter-stage').attrs['data-scene-id'], 'shared');
  doc.dispatch('keydown', { key: ' ', target: byId.get('stage') }); assert.equal(pending.size, 0);
  byId.get('pause').dispatch('click'); h.finish();
  near(byId.get('progress').value, flow.index('parameters.shared'));
  assert.equal(byId.get('parameter-stage').attrs['data-position'], '1');
  // Full normal playback includes the transitions on both sides of the chapter.
  seek(9);
  for (let target = 10; target <= 25; target++) {
    byId.get('edge-next').dispatch('click'); h.finish(); near(byId.get('progress').value, target);
  }
  h.media.listeners.forEach(listener => listener({ matches: true }));
  for (let i = 10; i <= 24; i++) {
    byId.get('scene-stops').children[i].dispatch('click');
    near(byId.get('progress').value, i); assert.equal(pending.size, 0);
    assert.equal(byId.get('chapter-replay').hidden, true);
  }
  doc.dispatch('keydown', { key: 'End', target: byId.get('stage') }); near(byId.get('progress').value, 35);
  assert.equal(players, 1); assert.equal(captures, 1, 'replay never acquires new observations');
  windowEvents.pagehide.forEach(callback => callback());
  assert.equal(pending.size, 0); assert.equal(byId.get('parameter-stage').children.length, 0);
  assert.equal(byId.get('frequency-handoff-stage').children.length, 0);
});

test('scene 11 inserts pending parameters, absorbs common coefficients and cancels other orders reversibly', () => {
  const h = boot(), { byId, nodes, context } = h;
  assert.deepEqual(h.errors, []);
  const flow = context.SIMMotionParameterChapter.plan(context.SIMMotion), end = flow.index('provisional-split');
  const seek = p => { byId.get('progress').value = String(end - 1 + Chapter.provisionalProgress(p)); byId.get('progress').dispatch('input'); };
  const originals = nodes.filter(el => el.attrs['data-resolved-weight'] !== undefined);
  const moving = nodes.filter(el => el.attrs['data-provisional-token']?.startsWith('weight:'));
  const operation = nodes.find(el => el.attrs['data-provisional-operation'] !== undefined);
  const groups = Object.fromEntries(nodes.filter(el => el.attrs['data-provisional-lesson']).map(el => [el.attrs['data-provisional-lesson'], el]));
  const flights = nodes.filter(el => el.attrs['data-parameter-substitution']);
  const blocks = nodes.filter(el => el.attrs['data-unknown-band'] !== undefined);
  const bands = nodes.filter(el => el.attrs['data-absorbed-band'] !== undefined);
  const sums = nodes.filter(el => el.attrs['data-provisional-phase-sum'] !== undefined);
  assert.equal(moving.length, 9);
  assert.deepEqual(flights.map(el => el.attrs['data-parameter-substitution']), ['k', 'm', 'phase']);
  for (const token of flights) {
    const card = nodes.find(el => el.attrs['data-parameter-card'] === token.attrs['data-parameter-substitution']);
    assert.ok(groups.substitution.children.indexOf(card) < groups.substitution.children.indexOf(token), 'card backgrounds precede their moving symbols');
  }
  assert.equal(sums.length, 3); assert.equal(blocks.length, 3); assert.equal(bands.length, 3);
  seek(.000001);
  for (const item of moving) {
    const key = item.attrs['data-provisional-token'].slice('weight:'.length), original = originals.find(el => el.attrs['data-resolved-weight'] === key);
    const [x, y, scale] = item.attrs.transform.match(/-?[\d.]+/g).map(Number);
    near(x, +original.attrs.x + +original.attrs.width / 2); near(y, +original.attrs.y + +original.attrs.height / 2); near(scale, 1);
    assert.equal(item.children[0].children[0].innerHTML, original.children[0].innerHTML);
  }
  seek(.055); moving.forEach(el => near(el.style.opacity, 0)); near(operation.style.opacity, 1);
  seek(.1); near(groups.substitution.style.opacity, 1);
  flights.forEach((el, b) => { near(el.attrs['data-insertion-progress'], 0); assert.equal(el.attrs.transform, `translate(${360 + b * 360} 425)`); });
  seek(.18); flights.forEach(el => assert.ok(+el.attrs['data-insertion-progress'] > 0 && +el.attrs['data-insertion-progress'] < 1));
  seek(.23); flights.forEach((el, b) => { near(el.attrs['data-insertion-progress'], 1); near(el.style.opacity, 0); assert.equal(el.attrs.transform, `translate(${[750, 530, 1040][b]} 225)`); });
  assert.match(byId.get('equation-note').textContent, /尚未求值/);
  seek(.33); near(groups.substitution.style.opacity, 0); near(groups.model.style.opacity, 1);
  seek(.52); near(groups.expansion.style.opacity, 1);
  seek(.60); near(groups.absorption.style.opacity, 1); blocks.forEach(el => near(el.style.opacity, 1)); bands.forEach(el => near(el.style.opacity, 0));
  seek(.71); blocks.forEach(el => near(el.style.opacity, 0)); bands.forEach(el => near(el.style.opacity, 1));
  assert.match(byId.get('scene-description').textContent, /k 仍在/);
  seek(.92); near(groups.demix.style.opacity, 1); sums.forEach(el => near(el.style.opacity, 1));
  seek(1); near(groups.ready.style.opacity, 1); near(byId.get('frequency-handoff-stage').style.opacity, 0);
  assert.equal(byId.get('equation').attrs['data-formula-mode'], 'provisional-ready');
  const actors = [...moving, operation, ...Object.values(groups), ...flights, ...blocks, ...bands, ...sums];
  const snapshot = () => ({ actors: actors.map(el => [el.attrs.transform, el.style.opacity]),
    mode: byId.get('equation').attrs['data-formula-mode'], title: byId.get('scene-title').textContent, note: byId.get('equation-note').textContent });
  const poses = new Map(), points = [.000001, .05, .1, .18, .23, .33, .46, .52, .6, .66, .71, .8, .86, .92, 1];
  points.forEach(p => { seek(p); poses.set(p, snapshot()); });
  const renders = h.mathRenders;
  points.toReversed().forEach(p => { seek(p); assert.deepEqual(snapshot(), poses.get(p)); });
  assert.equal(h.mathRenders, renders, 'reverse playback reuses the compiled formulas');
  for (const position of [2, 6, 7]) {
    byId.get('progress').value = String(position); byId.get('progress').dispatch('input');
    assert.equal(byId.get('theory-context').hidden, true, 'the removed parameter entry stays absent');
    assert.equal(byId.get('theory-context').textContent, '');
  }
});

test('the pre-illumination failure scene drops the card, displaces the band and rotates opposing phasors on one reversible clock', () => {
  const h = boot(), { byId, nodes } = h;
  assert.deepEqual(h.errors, []);
  const flow = Chapter.plan(Motion), end = flow.index('provisional-split');
  const seek = p => {
    const progress = (.06 * Chapter.provisionalContentDuration + p * Chapter.nominalPreludeDuration) / Chapter.provisionalDuration;
    byId.get('progress').value = String(end - 1 + progress); byId.get('progress').dispatch('input');
  };
  const failure = nodes.find(el => el.attrs['data-provisional-lesson'] === 'failure');
  const substitution = nodes.find(el => el.attrs['data-provisional-lesson'] === 'substitution');
  const operation = nodes.find(el => el.attrs['data-provisional-operation'] !== undefined);
  const card = nodes.find(el => el.attrs['data-nominal-card'] !== undefined);
  const side = nodes.find(el => el.attrs['data-nominal-disk'] === 'side');
  const question = nodes.find(el => el.attrs['data-nominal-question'] !== undefined);
  const images = nodes.filter(el => el.attrs['data-nominal-reconstruction'] !== undefined);
  const phasors = nodes.filter(el => el.attrs['data-nominal-phasor'] !== undefined);
  const glow = nodes.find(el => el.attrs['data-nominal-cancellation'] !== undefined);
  const actors = [failure, substitution, operation, card, side, question, glow, ...images, ...phasors];
  const snapshot = () => actors.map(el => [el.attrs.transform, el.attrs.d, el.style.opacity, el.attrs['data-angle']]);
  const saved = new Map();
  for (const p of [.01, .08, .12, .2, .26, .35, .45, .55, .65, .75, .86, .96]) {
    seek(p); saved.set(p, snapshot()); near(substitution.style.opacity, 0);
    if (p >= .08) near(failure.style.opacity, 1);
    if (p >= .12) { assert.match(operation.attrs.transform, /translate\(720 45\)/); near(operation.style.opacity, .16); }
    if (p >= .26) assert.equal(card.attrs.transform, 'translate(720 151)');
    if (p >= .55) near(failure.attrs['data-frequency-error'], .3);
    if (p < .64) near(images[2].style.opacity, 0);
    if (p >= .86) {
      near(failure.attrs['data-phase-loss'], 1); near(images[2].style.opacity, 1);
      for (let b = 0; b < 3; b++) {
        const pair = phasors.filter(el => el.attrs['data-probe'] === String(b));
        near(+pair[1].attrs['data-angle'] - +pair[0].attrs['data-angle'], Math.PI);
      }
      assert.ok(+glow.style.opacity > 0);
    }
  }
  assert.equal(failure.attrs['data-nominal-source'], 'controlled-remix-of-adopted-bands');
  const renders = h.mathRenders;
  [...saved.keys()].toReversed().forEach(p => { seek(p); assert.deepEqual(snapshot(), saved.get(p)); });
  assert.equal(h.mathRenders, renders, 'the added scene needs no second clock or repeated formula compilation');
});

test('the 11-to-12 split carries the same spectra, colored formulas and synchronized negative fade in both directions', () => {
  let pair;
  const h = boot({ beforeRenderer(context) {
    const create = context.SIMParameterLesson.createView;
    context.SIMParameterLesson.createView = (...args) => {
      const view = create(...args); pair = view.sharedPair; return view;
    };
  } });
  assert.deepEqual(h.errors, []);
  const { byId, nodes } = h, entryFraction = Chapter.sharedEntryDuration / Chapter.sharedDuration;
  const seek = p => { byId.get('progress').value = String(10 + p * entryFraction); byId.get('progress').dispatch('input'); };
  const negative = nodes.find(el => el.attrs['data-split-negative-panel'] !== undefined);
  const negativeImage = nodes.find(el => el.attrs['data-split-band'] === '-1');
  const formulas = Chapter.temporaryBands.map(b => nodes.find(el => el.attrs['data-split-formula'] === String(b.order)));
  const titles = Chapter.temporaryBands.map(b => nodes.find(el => el.attrs['data-split-title'] === String(b.order)));
  const snapshots = new Map(), storedData = pair.bands.map(z => ({ re: [...z.re], im: [...z.im] }));
  assert.equal(negativeImage.attrs.href, pair.bandURLs[2]);
  near(negative.attrs['data-frequency-range'], pair.range); near(negative.attrs['data-brightness-maximum'], pair.maximum);
  for (const [b, formula] of formulas.entries()) {
    assert.equal(formula.attrs.style, 'color:' + Chapter.temporaryBands[b].color);
    const tex = formula.children.map(box => box.children[0].innerHTML.match(/<annotation encoding="application\/x-tex">([\s\S]*?)<\/annotation>/)[1]).join('');
    assert.equal(tex, Chapter.temporaryBands[b].symbol + '=' + Chapter.temporaryBands[b].rhs);
  }
  const points = [.001, .10, .23, .30, .40, .52, .64, .70, .74, .78, .82, .90, .96, .999999, 1, 1.1];
  for (const p of points) {
    seek(p);
    const entry = Chapter.sharedEntryState(p * entryFraction);
    if (p < 1) {
      formulas.forEach((el, b) => near(el.style.opacity, entry.bands[b].alpha));
      near(negative.style.opacity, entry.pictures * entry.negative);
      pair.panels.forEach((panel, b) => { near(panel.group.attrs['data-center-x'], entry.bands[b].x); near(panel.group.style.opacity, entry.pictures); });
    }
    if (p >= .64 && p < 1) near(negative.style.opacity, formulas[2].style.opacity);
    if (p >= .82) near(formulas[2].style.opacity, 0);
    if (p >= 1) near(byId.get('split-handoff-stage').style.opacity, 0);
    pair.panels.forEach((panel, b) => assert.equal(panel.picture.attrs.href, pair.bandURLs[b]));
    const actors = [...formulas, ...titles, negative, ...pair.panels.map(panel => panel.group)];
    snapshots.set(p, actors.map(el => [el.attrs.transform, el.style.opacity]));
  }
  const renders = h.mathRenders;
  for (const p of points.toReversed()) {
    seek(p);
    const actors = [...formulas, ...titles, negative, ...pair.panels.map(panel => panel.group)];
    // Hidden entry-only actors are reset deterministically as well.
    assert.deepEqual(actors.map(el => [el.attrs.transform, el.style.opacity]), snapshots.get(p));
  }
  assert.equal(h.mathRenders, renders, 'all formula actors are cached across replay');
  assert.deepEqual(pair.bands.map(z => ({ re: [...z.re], im: [...z.im] })), storedData);
  seek(.999999); const before = pair.panels.map(panel => Number(panel.group.attrs['data-center-x']));
  seek(1.000001); pair.panels.forEach((panel, b) => near(panel.group.attrs['data-center-x'], before[b]));
});
