/* Production HTML scripts and one simulated DOM. No visual acceptance. */
const test = require('node:test'), assert = require('node:assert/strict');
const Motion = require('../web/motion/sim-motion-model.js');
const Chapter = require('../web/motion/sim-motion-parameter-chapter.js');
const Story = require('../web/parameter-demo/sim-parameter-model.js');
const Study = require('../web/parameter-demo/sim-parameter-two-stage.js');
const boot = require('./helpers/motion-dom.cjs');
const near = (a, b, eps = 1e-9) => assert.ok(Number.isFinite(+a) && Math.abs(+a - b) < eps, `${a} != ${b}`);

test('43 stops preserve every complete scene interval and the existing reconstruction transitions', () => {
  const flow = Chapter.plan(Motion);
  assert.equal(flow.scenes.length, 43); assert.equal(flow.durations.length, 42);
  assert.equal(flow.index('inverse-demix'), 9);
  assert.equal(flow.index('provisional-split'), 10);
  assert.equal(flow.index('parameters.shared'), 11);
  assert.equal(flow.index('parameters.line-shift'), 12);
  assert.equal(flow.index('parameters.shift'), 13);
  assert.equal(flow.index('adopted-weights'), 27);
  assert.equal(flow.index('verify-demix'), -1);
  assert.equal(flow.index('separate-bands'), 30);
  assert.equal(flow.index('relocate-bands'), 31);
  for (const id of Chapter.sceneIds) {
    const end = flow.index('parameters.' + id);
    for (const p of [.000001, .02, .16, .5, .99, 1]) {
      const frame = flow.frame(end - 1 + p);
      assert.equal(frame.owner, 'parameters'); assert.equal(frame.sceneId, id);
      near(frame.progress, p); assert.equal(frame.index, end);
      assert.equal(frame.baseTime, 9);
    }
    assert.equal(flow.durations[end - 1], Study.navigationScene(id).duration + (id === 'shared' ? Chapter.sharedEntryDuration : 0));
  }
  for (const p of [.01, .12, .43, .99, 1]) {
    const frame = flow.frame(29 + p);
    assert.ok(frame.baseTime >= 10.28 && frame.baseTime <= 11);
    assert.equal(Motion.demixState(frame.baseTime).panels.proof, 0, 'the skipped proof cannot flash during the handoff');
  }
  assert.equal(flow.sceneIndex(29.05), 30, 'the extracted +1 row enters formal demixing');
  assert.equal(flow.sceneIndex(29.2), 30);
  for (let old = 11; old <= 23; old++) near(flow.frame(old + 19).baseTime, old);

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
  assert.equal(playerOptions.pacing[2].at(-1)[1], 106400);
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
  assert.equal(byId.get('scene-stops').children.length, 43);
  assert.equal(byId.get('progress').max, '42');
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
  const positions = Array.from({ length: 43 }, (_, i) => i).flatMap(i => i ? [i - .99, i - .8, i - .5, i - .01, i] : [0]);
  for (const t of [...positions, ...positions.toReversed()]) {
    seek(t);
    const frame = flow.frame(t), index = flow.sceneIndex(t);
    assert.equal(byId.get('scene').attrs['data-flow-scene'], flow.scenes[index].id);
    assert.equal(byId.get('scene-number').textContent, String(index + 1).padStart(2, '0'));
    assert.equal(byId.get('scene-stops').children.filter(el => el.attrs['aria-current'] === 'step').length, 1);
    if (frame.owner === 'parameters') {
      assert.equal(byId.get('parameter-stage').attrs['data-scene-id'], chapter.state(frame.sceneId,frame.progress).id);
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
  seek(flow.index('parameters.get-peak-read') - .12); const endpoint = ratio.attrs.d;
  seek(flow.index('parameters.get-peak-read'));  assert.equal(ratio.attrs.d, endpoint);
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
  doc.dispatch('keydown', { key: 'End', target: byId.get('stage') }); near(byId.get('progress').value, 42);
  assert.equal(players, 1); assert.equal(captures, 1, 'replay never acquires new observations');
  windowEvents.pagehide.forEach(callback => callback());
  assert.equal(pending.size, 0); assert.equal(byId.get('parameter-stage').children.length, 0);
  assert.equal(byId.get('frequency-handoff-stage').children.length, 0);
});

test('scene 11 keeps matrix-to-formula flight and changes coefficients inside the same assembled row', () => {
  const h = boot(), { byId, nodes, context } = h;
  assert.deepEqual(h.errors, []);
  assert.equal(nodes.some(el => el.innerHTML.includes('katex-error')), false);
  const flow = context.SIMMotionParameterChapter.plan(context.SIMMotion), end = flow.index('provisional-split');
  const seek = seconds => { byId.get('progress').value = String(end - 1 + seconds * 1000 / Chapter.provisionalDuration); byId.get('progress').dispatch('input'); };
  const originals = nodes.filter(el => el.attrs['data-resolved-weight'] !== undefined);
  const rows = nodes.filter(el => el.attrs['data-inverse-row'] !== undefined), matrix = rows[0].parent;
  const brackets = matrix.children.filter(el => el.attrs.class === 'matrix-bracket');
  const boxes = nodes.filter(el => el.attrs['data-inspection-row-box'] !== undefined);
  const messages = nodes.filter(el => el.attrs['data-inspection-row-message'] !== undefined);
  const moving = nodes.filter(el => el.attrs['data-provisional-token']);
  const transfer = nodes.find(el => el.attrs['data-provisional-transfer'] !== undefined);
  const operation = nodes.find(el => el.attrs['data-provisional-operation'] !== undefined);
  const groups = Object.fromEntries(nodes.filter(el => el.attrs['data-provisional-lesson']).map(el => [el.attrs['data-provisional-lesson'], el]));
  const actualCells = nodes.filter(el => el.attrs['data-actual-U-cell']);
  const selectedCell = actualCells.find(el => el.attrs['data-actual-U-cell'] === '1:1');
  const actualScaffold = nodes.find(el => el.attrs['data-actual-U-scaffold'] !== undefined);
  const weightRhs = nodes.find(el => el.attrs['data-actual-weight-coefficient'] !== undefined);
  const coefficientTokens = Object.fromEntries(nodes.filter(el => el.attrs['data-weight-coefficient-token']).map(el => [el.attrs['data-weight-coefficient-token'], el]));
  const factorLabels = nodes.find(el => el.attrs['data-weight-factor-labels'] !== undefined);
  const matrixProduct = nodes.find(el => el.attrs['data-weight-matrix-product'] !== undefined);
  const productSources = nodes.filter(el => el.attrs['data-weight-matrix-source'] !== undefined);
  const productObservations = nodes.filter(el => el.attrs['data-weight-matrix-observation'] !== undefined);
  const rowFocus = nodes.find(el => el.attrs['data-weight-row-focus'] !== undefined);
  const rowEquals = nodes.find(el => el.attrs['data-weight-matrix-equals'] !== undefined);
  const knownDefinition = nodes.find(el => el.attrs['data-known-weight-definition'] !== undefined);
  const rowOperators = nodes.find(el => el.attrs['data-weight-row-operators'] !== undefined);
  const coefficientRelation = nodes.find(el => el.attrs['data-coefficient-relation'] !== undefined);
  const rowWeights = actualCells.filter(el => el.attrs['data-actual-U-cell'].startsWith('1:'));
  const matrixWeightContents = rowWeights.map(el => el.children[0]);
  const factoredWeights = rowWeights.map(el => el.children.find(child => child.attrs['data-row-weight-variant'] === 'factored'));
  const temporaryWeights = rowWeights.map(el => el.children.find(child => child.attrs['data-row-weight-variant'] === 'temporary'));
  const sourceVariants = productSources[1].children;
  const propagated = nodes.find(el => el.attrs['data-coefficient-output'] !== undefined);
  const notation = nodes.find(el => el.attrs['data-provisional-notation'] !== undefined);
  const operationParts = Object.fromEntries(operation.children.filter(el => el.attrs['data-operation-part']).map(el => [el.attrs['data-operation-part'], el]));
  const fixedParts = [...factoredWeights, ...temporaryWeights, ...sourceVariants, ...Object.values(operationParts), knownDefinition, coefficientRelation, propagated];
  const fixedPositions = fixedParts.map(el => [el.attrs.x, el.attrs.y, el.attrs.width, el.attrs.height, el.attrs.transform]);
  const fixedContents = fixedParts.map(el => el.children[0]);
  for (const removed of ['data-coefficient-detail', 'data-weight-row-sum', 'data-weighted-sum', 'data-common-weight-factor'])
    assert.equal(nodes.some(el => el.attrs[removed] !== undefined), false, 'substitutions happen within the assembled row, without a separate coefficient scene');
  const cards = nodes.filter(el => el.attrs['data-parameter-card']);
  assert.equal(cards.length, 0, 'do not preview parameter estimation with three cards');
  const tokens = nodes.filter(el => el.attrs['data-illumination-token']);
  const kToken = tokens.find(el => el.attrs['data-illumination-token'] === 'k');
  const mToken = tokens.find(el => el.attrs['data-illumination-token'] === 'm');
  const phiToken = tokens.find(el => el.attrs['data-illumination-token'] === 'phase');
  const reasons = nodes.filter(el => el.attrs['data-parameter-reason']);
  const failure = nodes.find(el => el.attrs['data-provisional-lesson'] === 'nominalFailure');
  const badImages = nodes.filter(el => el.attrs['data-nominal-reconstruction'] !== undefined);
  const phasors = nodes.filter(el => el.attrs['data-nominal-phasor']);
  const errorPicture = nodes.find(el => el.attrs['data-nominal-residual-view'] !== undefined);
  assert.equal(tokens.length, 8); assert.equal(reasons.length, 2); assert.equal(badImages.length, 3);
  assert.equal(originals.length, 9); assert.equal(boxes.length, 3); assert.equal(messages.length, 3); assert.ok(brackets.length >= 3);
  assert.equal(moving.length, 17);
  assert.deepEqual(Object.keys(groups).sort(), ['whyEstimate', 'nominalFailure', 'actualWeights', 'coefficientFocus', 'ready'].sort());
  assert.equal(nodes.some(el => el.attrs['data-relocation-parameter'] !== undefined), false, 'remove the extra formula above the unchanged source definitions');
  assert.equal(nodes.some(el => el.attrs['data-provisional-phase-sum'] !== undefined), false);
  boxes.forEach((box, b) => {
    const background = rows[b].children.find(el => el.attrs.class === 'matrix-row-background');
    for (const key of ['x', 'y', 'width', 'height']) assert.equal(box.attrs[key], background.attrs[key], 'highlight the coefficient row itself');
  });
  const checkWeights = expected => originals.forEach(el => near(el.style.opacity, expected[+el.attrs['data-resolved-weight'].split(':')[0]]));
  seek(1.8); checkWeights([1, 1, 1]); near(boxes[0].style.opacity, 1); near(boxes[1].style.opacity, 0);
  seek(4.4); checkWeights([0, 1, 1]); near(messages[0].style.opacity, 1); near(messages[1].style.opacity, 0);
  near(byId.get('motion-content').style.opacity, 1); near(operation.style.opacity, 0);
  assert.equal(matrix.attrs.transform, 'translate(0 0)');
  seek(7.4); checkWeights([1, 1, 1]); messages.forEach(el => near(el.style.opacity, 0));
  seek(9.4); checkWeights([1, 1, 1]); near(boxes[0].style.opacity, 0); near(boxes[1].style.opacity, 1); near(boxes[2].style.opacity, 1);
  seek(12.6); checkWeights([1, 0, 0]); near(messages[0].style.opacity, 0); near(messages[1].style.opacity, 1); near(messages[2].style.opacity, 1);
  seek(15.7); checkWeights([1, 1, 1]); messages.forEach(el => near(el.style.opacity, 0));
  seek(16.25); near(byId.get('demix-source-definitions').style.opacity, 0); near(transfer.style.opacity, 1);
  moving.forEach(el => {
    const [kind, key] = el.attrs['data-provisional-token'].split(':');
    const original = kind === 'weight' ? originals.find(o => o.attrs['data-resolved-weight'] === el.attrs['data-provisional-token'].slice(7))
      : kind === 'observation' ? nodes.find(o => o.attrs['data-demix-observation'] === key) : null;
    if (original) {
      const [x, y, scale] = el.attrs.transform.match(/-?[0-9.]+/g).map(Number);
      near(x, +original.attrs.x + +original.attrs.width / 2); near(y, +original.attrs.y + +original.attrs.height / 2); near(scale, 1);
    }
  });
  const startPose = moving[0].attrs.transform;
  seek(17.3); assert.notEqual(moving[0].attrs.transform, startPose);
  seek(19); near(byId.get('motion-content').style.opacity, 0); near(operation.style.opacity, 1); near(transfer.style.opacity, 0);
  seek(20.7); near(groups.whyEstimate.style.opacity, 1); near(kToken.attrs['data-hop'], 0);
  const illuminationBody=nodes.find(el=>el.attrs['data-illumination-body']!==undefined);
  const stripes=nodes.find(el=>el.attrs['data-parameter-stripes']!==undefined);
  const phaseRelation=nodes.find(el=>el.attrs['data-parameter-phase-relation']!==undefined);
  near(kToken.style.opacity,1);near(illuminationBody.style.opacity,0);
  assert.equal(illuminationBody.attrs['aria-hidden'],'true');
  assert.equal(stripes.attrs.preserveAspectRatio,'none');
  assert.ok(+phaseRelation.attrs.y + +phaseRelation.attrs.height <= 550);
  assert.match(phaseRelation.children[0].innerHTML,/已知/);assert.match(phaseRelation.children[0].innerHTML,/未知，三帧共用/);
  near(mToken.attrs['data-hop'], 0); near(phiToken.attrs['data-hop'], 0); reasons.forEach(el => near(el.style.opacity, 0));
  seek(23); near(kToken.attrs['data-hop'], 0); near(reasons[0].style.opacity, 1); near(reasons[1].style.opacity, 0);
  near(illuminationBody.style.opacity,1);
  assert.equal(illuminationBody.attrs['aria-hidden'],'false');
  seek(25.7); reasons.forEach(el => near(el.style.opacity, 0)); near(mToken.attrs['data-hop'], 0); near(phiToken.attrs['data-hop'], 0);
  assert.equal(groups.whyEstimate.attrs['data-parameter-focus'],'m');
  assert.equal(mToken.attrs['data-active'],'true');
  seek(29); near(reasons[0].style.opacity, 0); near(reasons[1].style.opacity, 1);
  seek(34); near(failure.style.opacity, 1); near(groups.whyEstimate.style.opacity, 0); near(groups.actualWeights.style.opacity, 0);
  seek(40); near(failure.attrs['data-frequency-error'], .3); near(badImages[1].style.opacity, 1); near(badImages[2].style.opacity, 0);
  seek(47); near(failure.attrs['data-phase-loss'], 1); near(badImages[2].style.opacity, 1);
  near(+phasors[1].attrs['data-angle'] - +phasors[0].attrs['data-angle'], Math.PI);
  assert.ok(+failure.attrs['data-negative-minimum'] < 0);
  seek(52); near(errorPicture.style.opacity, 1); near(groups.actualWeights.style.opacity, 0);
  near(failure.attrs['data-residual-peak-bin'], 8);
  assert.equal(failure.attrs['data-nominal-source'], 'controlled-remix-of-adopted-bands');
  seek(55.5); near(groups.actualWeights.style.opacity, 1); near(failure.style.opacity, 0);
  assert.equal(byId.get('scene-title').textContent, '那么实际的权重应该是什么呢？');
  assert.equal(actualCells.length, 9); near(actualScaffold.style.opacity, 1); near(weightRhs.style.opacity, 0);
  assert.equal(selectedCell.attrs.transform, 'translate(805 340) scale(1)');
  const selectedIndexed = selectedCell.children[0], selectedGeneric = selectedCell.children[1];
  seek(58); assert.notEqual(selectedCell.attrs.transform, 'translate(805 340) scale(1)'); near(actualScaffold.style.opacity, 1);
  assert.equal(selectedCell.children[0], selectedIndexed, 'lift the existing cell itself');
  seek(60.3); near(actualScaffold.style.opacity, 0); near(selectedIndexed.style.opacity, 0); near(selectedGeneric.style.opacity, 1); near(weightRhs.style.opacity, 0);
  actualCells.filter(el => el !== selectedCell).forEach(el => near(el.style.opacity, 0));
  assert.equal(selectedCell.attrs.transform, 'translate(300 285) scale(1.35)');
  seek(62); near(weightRhs.style.opacity, 1); near(coefficientTokens.rawPhase.style.opacity, 1); near(coefficientTokens.knownPhase.style.opacity, 0);
  seek(65); near(coefficientTokens.rawPhase.style.opacity, 0); near(coefficientTokens.knownPhase.style.opacity, 1); near(coefficientTokens.unknownPhase.style.opacity, 1);
  near(coefficientTokens.rawAmplitude.style.opacity, 1); near(coefficientTokens.unknownAmplitude.style.opacity, 0);
  assert.equal(byId.get('equation').attrs['data-formula-mode'], 'provisional-expandWeight');
  seek(68.75);
  const knownPose = coefficientTokens.knownAmplitude.attrs.transform.match(/-?[0-9.]+/g).map(Number);
  const unknownPose = coefficientTokens.unknownAmplitude.attrs.transform.match(/-?[0-9.]+/g).map(Number);
  assert.ok(knownPose[1] < 285 && unknownPose[1] > 285, 'the two factors follow separate arcs');
  seek(72); near(coefficientTokens.rawAmplitude.style.opacity, 0); near(coefficientTokens.unknownAmplitude.style.opacity, 1); near(factorLabels.style.opacity, 1);
  assert.equal(coefficientTokens.knownAmplitude.attrs.style, 'color:' + Chapter.weightFactorColors.known);
  assert.equal(coefficientTokens.unknownAmplitude.attrs.style, 'color:' + Chapter.weightFactorColors.unknown);
  assert.equal(byId.get('equation').attrs['data-formula-mode'], 'provisional-splitWeight');
  seek(75.4); near(weightRhs.style.opacity, 0); near(selectedGeneric.style.opacity, 0); near(selectedIndexed.style.opacity, 1);
  seek(76.5); assert.notEqual(selectedCell.attrs.transform, 'translate(805 340) scale(1)'); near(groups.coefficientFocus.style.opacity, 0);
  seek(77.5); assert.equal(selectedCell.attrs.transform, 'translate(805 340) scale(1)');
  assert.equal(byId.get('equation-domain').textContent, 'u → U → A = UD');
  assert.equal(selectedCell.children[0], selectedIndexed, 'the extracted weight returns as the same matrix node');
  actualCells.forEach(el => near(el.style.opacity, 1)); near(matrixProduct.style.opacity, 0);
  seek(81); near(matrixProduct.style.opacity, 1); near(rowFocus.style.opacity, 1);
  assert.deepEqual(productSources.map(el => el.attrs['data-weight-matrix-source']), ['0', '1', '-1']);
  assert.deepEqual(productObservations.map(el => el.attrs['data-weight-matrix-observation']), ['0', '1', '2']);
  [...productSources, ...productObservations].forEach(el => near(el.style.opacity, 1));
  const dockedPoses = [...rowWeights, ...productObservations, productSources[1], rowEquals].map(el => el.attrs.transform);
  seek(83.5);
  assert.notDeepEqual([...rowWeights, ...productObservations, productSources[1], rowEquals].map(el => el.attrs.transform), dockedPoses,
    'matrix entries must fly into the formula before substitutions begin');
  near(groups.coefficientFocus.style.opacity, 0);
  seek(85.5); near(rowOperators.style.opacity, 1); near(actualScaffold.style.opacity, 0); near(matrixProduct.style.opacity, 0);
  near(groups.actualWeights.style.opacity, 1); near(groups.coefficientFocus.style.opacity, 0);
  assert.equal(rowEquals.attrs.transform, 'translate(310 300)');
  assert.equal(productSources[1].attrs.transform, 'translate(150 300)');
  rowWeights.forEach((el, j) => {
    const [wx, wy] = el.attrs.transform.match(/-?[0-9.]+/g).map(Number);
    const [dx, dy] = productObservations[j].attrs.transform.match(/-?[0-9.]+/g).map(Number);
    near(dx - wx, 110); near(wy, 300); near(dy, wy);
    near(el.style.opacity, 1); near(productObservations[j].style.opacity, 1);
    assert.equal(el.children[0], matrixWeightContents[j], 'the same weight node flies from its matrix into the formula');
  });
  const assembledActors = [...rowWeights, ...productObservations, productSources[1], rowEquals, rowOperators];
  const assembledPoses = assembledActors.map(el => el.attrs.transform);
  const assembledChildren = assembledActors.map(el => [...el.children]);
  for (const t of [86, 87, 88.4, 89, 90.8, 92, 94.4, 95, 97, 99]) {
    seek(t);
    assert.deepEqual(assembledActors.map(el => el.attrs.transform), assembledPoses, 'the assembled formula stays in place');
    assembledActors.forEach((el, i) => {
      near(el.style.opacity, 1);
      el.children.forEach((child, j) => assert.equal(child, assembledChildren[i][j], 'same node survives flight and coefficient changes'));
    });
    assert.deepEqual(fixedParts.map(el => [el.attrs.x, el.attrs.y, el.attrs.width, el.attrs.height, el.attrs.transform]), fixedPositions);
    fixedParts.forEach((el, i) => assert.equal(el.children[0], fixedContents[i], 'each coefficient variant compiles once'));
    const state = Chapter.provisionalState(t * 1000 / Chapter.provisionalDuration);
    near(operationParts.source.style.opacity, 1 - state.outputScale);
    near(operationParts['temporary-source'].style.opacity, state.outputScale);
    near(operationParts.weight.style.opacity, 1 - state.outputScale);
    near(operationParts['temporary-weight'].style.opacity, state.outputScale);
    near(sourceVariants[0].style.opacity, 1 - state.outputScale);
    near(sourceVariants[1].style.opacity, state.outputScale);
    rowWeights.forEach((el, j) => {
      const replacement = j === 1 ? state.selectedCoefficient : state.coefficientScale;
      near(el.children[0].style.opacity, 1 - replacement);
      near(factoredWeights[j].style.opacity, replacement * (1 - state.outputScale));
      near(temporaryWeights[j].style.opacity, state.outputScale);
    });
  }
  seek(87); near(knownDefinition.style.opacity, 1); near(notation.style.opacity, 1);
  factoredWeights.forEach(el => near(el.style.opacity, 0));
  seek(89); near(factoredWeights[1].style.opacity, 1); near(selectedIndexed.style.opacity, 0);
  [0, 2].forEach(j => { near(factoredWeights[j].style.opacity, 0); near(rowWeights[j].children[0].style.opacity, 1); });
  seek(92); factoredWeights.forEach(el => near(el.style.opacity, 1)); near(coefficientRelation.style.opacity, 1);
  near(propagated.style.opacity, 0); near(sourceVariants[0].style.opacity, 1);
  seek(95); factoredWeights.forEach(el => near(el.style.opacity, 0)); temporaryWeights.forEach(el => near(el.style.opacity, 1));
  near(sourceVariants[1].style.opacity, 1); near(propagated.style.opacity, 1); near(knownDefinition.style.opacity, 0);
  assert.equal(byId.get('equation').attrs['data-formula-mode'], 'provisional-outputScale');
  const matrixTemporaryWeights = actualCells.map(el => el.children.find(child => child.attrs['data-row-weight-variant'] === 'temporary'));
  const matrixTemporarySources = productSources.map(el => el.children.find(child => child.attrs['data-row-source-variant'] === 'temporary'));
  const indexDefinition = nodes.find(el => el.attrs['data-temporary-index-definition'] !== undefined);
  const notationRail = nodes.find(el => el.attrs['data-provisional-notation-rail'] !== undefined);
  const railTerms = nodes.find(el => el.attrs['data-notation-rail-terms'] !== undefined);
  const railTokens = nodes.filter(el => el.attrs['data-notation-rail-token']);
  const railVector = nodes.find(el => el.attrs['data-notation-rail-vector'] !== undefined);
  const railIndex = nodes.find(el => el.attrs['data-notation-rail-index'] !== undefined);
  const collectedActors = [...actualCells, ...productSources, ...productObservations, rowEquals];
  const collectedContents = collectedActors.map(el => [...el.children]);
  seek(99.50001);
  assert.equal(byId.get('equation').children[0], notationRail);
  near(notationRail.children[0].style.opacity, 1); near(railTerms.style.opacity, 0);
  seek(101.5);
  assert.notDeepEqual(assembledActors.map(el => el.attrs.transform), assembledPoses, 'only the completed temporary row moves back into the matrix');
  near(groups.coefficientFocus.style.opacity, 0); near(operation.style.opacity, 0); near(railTerms.style.opacity, 1);
  near(railVector.style.opacity, 0); near(railIndex.style.opacity, 0);
  seek(103.5);
  near(actualScaffold.style.opacity, 1); near(matrixProduct.style.opacity, 1);
  actualCells.forEach((el, i) => {
    const cell = Chapter.actualWeightCells[i];
    assert.equal(el.attrs.transform, `translate(${cell.x} ${cell.y}) scale(1)`);
    near(el.style.opacity, 1); near(el.children[0].style.opacity, 0); near(matrixTemporaryWeights[i].style.opacity, 1);
  });
  productSources.forEach((el, i) => {
    assert.equal(el.attrs.transform, `translate(295 ${260 + i * 80})`);
    near(el.style.opacity, 1); near(el.children[0].style.opacity, 0); near(matrixTemporarySources[i].style.opacity, 1);
  });
  productObservations.forEach((el, i) => assert.equal(el.attrs.transform, `translate(1260 ${260 + i * 80})`));
  railTokens.filter(el => el.children.length === 2).forEach(el => {
    near(el.children[0].style.opacity, 0); near(el.children[1].style.opacity, 1);
    assert.match(el.children[1].children[0].innerHTML, /ℓ|ell/);
  });
  const unpackedPoses = collectedActors.map(el => el.attrs.transform);
  seek(106.9);
  assert.notDeepEqual(collectedActors.map(el => el.attrs.transform), unpackedPoses);
  assert.ok(+groups.actualWeights.style.opacity > 0 && +groups.actualWeights.style.opacity < 1);
  near(+groups.actualWeights.style.opacity + +operation.style.opacity, 1, 1e-8);
  near(railVector.style.opacity, operation.style.opacity, 1e-8);
  near(railIndex.style.opacity, 0);
  seek(107.5);
  near(groups.actualWeights.style.opacity, 0); near(operation.style.opacity, 1);
  near(railTerms.style.opacity, 0); near(railVector.style.opacity, 1);
  const central = Chapter.provisionalState(107.5 * 1000 / Chapter.provisionalDuration).operationPose;
  assert.equal(operation.attrs.transform, 'translate(680 285) scale(1.12)');
  // Every moving group arrives at the exact corresponding compact glyph.
  for (const [elements, key] of [[actualCells, 'temporary-weight'], [productSources, 'temporary-source'], [productObservations, 'observations'], [[rowEquals], 'equals']]) {
    const glyph = operation.children.find(el => el.attrs['data-operation-part'] === key);
    const targetX = central.x + central.scale * (+glyph.attrs.x + +glyph.attrs.width / 2);
    elements.forEach(el => {
      const [x, y] = el.attrs.transform.match(/-?[0-9.]+/g).map(Number);
      near(x, targetX); near(y, central.y);
    });
  }
  seek(108.4);
  assert.ok(+railIndex.style.opacity > 0 && +railIndex.style.opacity < 1);
  near(railIndex.style.opacity, indexDefinition.style.opacity);
  const observationStage = nodes.find(el => el.attrs['data-observation-expansion'] !== undefined);
  const responseMatrix = nodes.find(el => el.attrs['data-observation-response-matrix'] !== undefined);
  const observationActors = nodes.filter(el => el.attrs['data-observation-actor'] !== undefined);
  const byActor = Object.fromEntries(observationActors.map(el => [el.attrs['data-observation-actor'], el]));
  const spectrumBracket = nodes.find(el => el.attrs['data-observation-spectrum-brackets'] !== undefined);
  const observationRails = nodes.filter(el => el.attrs['data-observation-rail']);
  const sampleContents = [0, 1, -1].map(order => byActor['sample:' + order].children[0]);
  const poseOf = el => el.attrs.transform.match(/-?[0-9.]+/g).map(Number);
  seek(110.3); near(observationStage.style.opacity, 0);
  assert.ok(+indexDefinition.style.opacity < 1);
  seek(113.8);
  near(operationParts.observations.style.opacity, 0); near(observationStage.style.opacity, 1);
  near(operationParts['temporary-weight'].style.opacity, 1); near(byActor.mixing.style.opacity, 1);
  near(responseMatrix.style.opacity, 0);
  near(poseOf(byActor['otf:0'])[0], 600);
  [0, 1, -1].forEach((order, row) => {
    near(poseOf(byActor['sample:' + order])[1], 205 + 80 * row);
    near(byActor['output:' + order].style.opacity, 0);
  });
  seek(117);
  assert.ok(poseOf(byActor['otf:0'])[1] > 285, 'H passes below the temporary weight');
  assert.ok(poseOf(operationParts['temporary-weight'])[1] < 0, 'the temporary weight passes above H');
  seek(120.5);
  near(operationParts['temporary-weight'].style.opacity, 0); near(byActor.mixing.style.opacity, 0);
  near(responseMatrix.style.opacity, 1); near(poseOf(byActor['otf:0'])[0], 470);
  [0, 1, -1].forEach((order, row) => {
    const factor = byActor['factor:' + order];
    near(factor.style.opacity, 1); near(poseOf(factor)[0], 620 + 155 * row); near(poseOf(factor)[1], 205 + 80 * row);
  });
  seek(123.2);
  assert.ok(+byActor['output:1'].style.opacity > 0 && +byActor['output:1'].style.opacity < 1);
  const pausedPose = byActor['sample:1'].attrs.transform, pausedRenders = h.mathRenders;
  h.advance(); assert.equal(byActor['sample:1'].attrs.transform, pausedPose); assert.equal(h.mathRenders, pausedRenders);
  seek(124.5);
  near(responseMatrix.style.opacity, 0); near(spectrumBracket.style.opacity, 0);
  [0, 1, -1].forEach((order, row) => {
    for (const key of ['output', 'equals', 'otf', 'sample']) {
      const node = byActor[key + ':' + order]; near(node.style.opacity, 1); near(poseOf(node)[1], 235 + 90 * row);
    }
    assert.equal(byActor['sample:' + order].children[0], sampleContents[row], 'the S terms from D become the band equations');
  });
  near(byActor['factor:0'].style.opacity, 0);
  seek(126);
  assert.ok(poseOf(operation)[1] > 85 && poseOf(operation)[1] < 285, 'the compact formula docks only after its bands have unfolded');
  seek(132); near(groups.ready.style.opacity, 1); near(operation.style.opacity, 1);
  assert.equal(byId.get('equation').attrs['data-formula-mode'], 'provisional-ready');
  near(indexDefinition.style.opacity, 1); near(railIndex.style.opacity, 1);
  const entry = nodes.find(el => el.attrs['data-split-operation'] !== undefined);
  assert.deepEqual(poseOf(operation), poseOf(entry));
  collectedActors.forEach((el, i) => el.children.forEach((child, j) => assert.equal(child, collectedContents[i][j], 'collection preserves the matrix and row actors')));
  const actors = [matrix, ...originals, ...boxes, ...messages, transfer, ...moving, operation, ...tokens, ...reasons, ...badImages, ...phasors, errorPicture, ...Object.values(groups), actualScaffold, ...actualCells, selectedIndexed, selectedGeneric, weightRhs, ...Object.values(coefficientTokens), factorLabels, matrixProduct, ...productSources, ...productObservations, rowFocus, rowEquals, rowOperators, knownDefinition, coefficientRelation, ...factoredWeights, ...matrixTemporaryWeights, ...matrixTemporarySources, ...sourceVariants, ...Object.values(operationParts), propagated, notation, indexDefinition, notationRail.children[0], railTerms, ...railTokens, railVector, railIndex, observationStage, ...observationActors, responseMatrix, spectrumBracket, ...observationRails];
  const snapshot = () => ({ actors: actors.map(el => [el.attrs.transform, el.style.opacity, el.attrs.d, el.attrs['data-angle'], el.attrs['data-hop']]),
    definitions: byId.get('demix-source-definitions').style.opacity, motion: byId.get('motion-content').style.opacity,
    mode: byId.get('equation').attrs['data-formula-mode'], title: byId.get('scene-title').textContent, note: byId.get('equation-note').textContent });
  const poses = new Map(), times = [.00001, .9, 1.8, 2.5, 3, 3.4, 4.4, 5.6, 6, 6.4, 7.4, 8.6, 9.4, 10.5, 11, 11.4, 12.6, 14.1, 14.5, 15, 15.7, 16.1, 16.25, 17.3, 18.4, 19, 20.3, 20.7, 21.2, 21.5, 23, 24.4, 25, 25.7, 26.6, 29, 30.6, 32.3, 34, 36, 38, 40, 43, 45, 47, 50, 52, 54, 54.8, 55.5, 56.3, 57, 58, 59.3, 59.8, 60.1, 60.3, 60.9, 62, 63.2, 64.2, 65, 66, 67.2, 67.7, 68.75, 70.3, 72, 75, 76, 77.5, 80, 82, 87];
  times.push(74.2, 74.8, 75.4, 76.5, 77.8, 78.2, 79, 81, 82.3, 83.4, 84.8, 85.5, 86, 86.5, 87.5, 88, 88.5, 89.5, 90.5, 91.3, 92, 94.2, 95.5, 97, 98, 99.5, 100, 101.5, 102.6, 103.5, 105, 106.9, 107.5, 108.4, 109, 110.3, 111, 112.4, 113.8, 116, 117, 119, 120.5, 122, 123.2, 124.5, 126, 128, 132);
  times.forEach(t => { seek(t); poses.set(t, snapshot()); });
  for (const t of [76, 81, 85, 89]) {
    seek(t);
    assert.ok(byId.get('stage-caption').textContent);
    assert.doesNotMatch(byId.get('stage-caption').textContent, /undefined/);
  }
  const renders = h.mathRenders;
  times.toReversed().forEach(t => { seek(t); assert.deepEqual(snapshot(), poses.get(t)); });
  assert.equal(h.mathRenders, renders, 'all beats and reverse playback reuse the compiled formulas');
  seek(0); near(byId.get('motion-content').style.opacity, 1); near(byId.get('demix-source-definitions').style.opacity, 1);
  checkWeights([1, 1, 1]); assert.equal(matrix.attrs.transform, 'translate(0 0)');
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
  const annotations = nodes.find(el => el.attrs['data-shared-annotations'] !== undefined);
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
    const renderedPose = pair.root.attrs.transform.match(/-?\d*\.?\d+(?:e[+-]?\d+)?/gi).map(Number);
    [entry.focus.x, entry.focus.y, entry.focus.scale].forEach((v, i) => near(renderedPose[i], v));
    if (p < 1) {
      formulas.forEach((el, b) => near(el.style.opacity, entry.bands[b].alpha));
      near(negative.style.opacity, entry.pictures * entry.negative);
      pair.panels.forEach((panel, b) => { near(panel.group.attrs['data-center-x'], entry.bands[b].x); near(panel.group.style.opacity, entry.pictures); });
    }
    if (p >= .64 && p < 1) near(negative.style.opacity, formulas[2].style.opacity);
    if (p >= .82) near(formulas[2].style.opacity, 0);
    if (p >= 1) near(byId.get('split-handoff-stage').style.opacity, 0);
    pair.panels.forEach((panel, b) => assert.equal(panel.picture.attrs.href, pair.bandURLs[b]));
    const actors = [...formulas, ...titles, negative, pair.root, annotations, ...pair.panels.map(panel => panel.group)];
    snapshots.set(p, actors.map(el => [el.attrs.transform, el.style.opacity]));
  }
  const renders = h.mathRenders;
  for (const p of points.toReversed()) {
    seek(p);
    const actors = [...formulas, ...titles, negative, pair.root, annotations, ...pair.panels.map(panel => panel.group)];
    // Hidden entry-only actors are reset deterministically as well.
    assert.deepEqual(actors.map(el => [el.attrs.transform, el.style.opacity]), snapshots.get(p));
  }
  assert.equal(h.mathRenders, renders, 'all formula actors are cached across replay');
  assert.deepEqual(pair.bands.map(z => ({ re: [...z.re], im: [...z.im] })), storedData);
  seek(.999999);
  const before = pair.panels.map(panel => Number(panel.group.attrs['data-center-x'])), focus = pair.root.attrs.transform;
  const values = focus.match(/-?[\d.]+/g).map(Number), [dx, dy, scale] = values;
  const centers = before.map(x => dx + x * scale);
  near((centers[0] + centers[1]) / 2, 720); near(dy + 375 * scale, 280); near(scale, 1.2);
  near(+formulas[0].attrs.transform.match(/-?[\d.]+/g)[0], centers[0]);
  near(+formulas[1].attrs.transform.match(/-?[\d.]+/g)[0], centers[1]);
  seek(1.000001);
  pair.panels.forEach((panel, b) => near(panel.group.attrs['data-center-x'], before[b]));
  assert.equal(pair.root.attrs.transform, focus);
  assert.equal(annotations.attrs.transform, focus, 'address arrows share the spectrum presentation pose');
});
