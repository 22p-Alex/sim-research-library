/* SIM motion study. Pure lesson data and a reversible, frame-rate-independent
 * playhead. Physics is read from the existing fairSIM-derived atlas core.
 * Demixing is one linear solve at each detector frequency.
 * Equations: Chen et al. (2023), doi:10.1038/s41377-023-01204-4, Eqs. 1–9.
 */
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const A = node ? require('../atlas/sim-atlas-core.js') : root.SIMAtlas;
  const F = (node ? require('../shared/sim-band-formulas.js') : root.SIMBandFormulas).formulas;
  const orders = [0, 1, -1];
  const colors = ['#7ad5cd', '#b7a5eb', '#efb879'];
  const phaseLabels = ['0', '2π/3', '4π/3'];
  const chapters = [
    { label: '样品与边界', start: 0, end: 1 }, { label: '编码与检测', start: 2, end: 5 },
    { label: '三相位观测', start: 6, end: 7 }, { label: '矩阵解混', start: 8, end: 11 },
    { label: '频带归位', start: 12, end: 13 }, { label: '多方向覆盖', start: 14, end: 16 },
    { label: 'Wiener 融合', start: 17, end: 20 }, { label: '图像与验证', start: 21, end: 23 },
  ];
  // Stable names are integration anchors; visible step numbers may change.
  const sceneIds = Object.freeze(['sample', 'widefield', 'illumination', 'frequency-encoding',
    'encoding-sum', 'detection', 'phase-acquisition', 'frequency-probe', 'mixed-sources',
    'inverse-demix', 'verify-demix', 'separate-bands', 'relocate-bands',
    'recover-high-frequency', 'directions', 'single-direction-support', 'combined-support',
    'otf-weight', 'sum-contributions', 'wiener', 'apodization', 'inverse-fft', 'image-comparison', 'frequency-audit']);
  const parameterSlot = Object.freeze({ id: 'illumination-estimation', after: 'inverse-demix',
    before: 'verify-demix', direction: 0, estimationOrder: 1,
    requiresProvisionalSplit: true, active: true,
    purpose: '符号求逆之后临时分离并估计参数；用实际权重验证抵消，再正式解混。' });
  const scenes = node ? require('./scenes/index.js') : root.SIMMotionSceneList;
  const DEMIX_START = 6;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
  const ramp = (t, a, b) => smooth((t - a) / (b - a));
  // Hold the old geometry while proving the inverse row, then resume it.
  const legacyTime = time => time <= 9 ? time : time <= 10 ? 9 : time - 1;
  const stageTime = time => { const t = legacyTime(time); return t <= 3 ? t : t <= 4 ? 3 : t <= 9 ? t - 1 : t < 10 ? 2 * t - 10 : t; };
  // Introduce the next explanation before its operation, including on replay.
  // One index is shared by the heading, formula group and transport.
  const sceneIndex = time => time >= 2 && time < 3 ? (time < 2.02 ? 2 : 3)
    : time >= 7 && time < 11 ? Math.floor(time) + (time % 1 >= .12 - 1e-9 ? 1 : 0)
    : time > 11 ? Math.ceil(time - 1e-9) : Math.round(time);
  // Local playhead progress → elapsed milliseconds. Keep symbol movements short
  // and give the completed equations reading time, on the same reversible clock.
  const transitionPacing = Object.freeze(Object.fromEntries(scenes.slice(1).flatMap((s,i)=>s.pacing?[[i,s.pacing]]:[])));
  const transitionDurations = scenes.slice(1).map(s=>s.duration);
  const { inverseEquations, inverseWeightTex, inverseState } = (node ? require('./scenes/inverse-demix/state.js') : root.SIMMotionStateFactories['inverse-demix'])({ orders, ramp });
  const { sourceAnchors, sourceMatrixTime, sourceOriginState, sourceOriginPixel } = (node ? require('./scenes/mixed-sources/state.js') : root.SIMMotionStateFactories['mixed-sources'])({ orders, ramp, lerp, clamp });
  const { demixState } = (node ? require('./scenes/separate-bands/state.js') : root.SIMMotionStateFactories['separate-bands'])({ orders, ramp, sourceOriginState, sourceMatrixTime, inverseState });
  const { acquisitionState, acquisitionPixel } = (node ? require('./scenes/phase-acquisition/state.js') : root.SIMMotionStateFactories['phase-acquisition'])({ ramp, lerp, clamp });
  const { detectionState, detectionPixel } = (node ? require('./scenes/detection/state.js') : root.SIMMotionStateFactories['detection'])({ ramp, lerp, clamp, acquisitionState });
  const { encodingSumState, encodingSumPixel } = (node ? require('./scenes/encoding-sum/state.js') : root.SIMMotionStateFactories['encoding-sum'])({ ramp, lerp, clamp, orders, detectionState });
  function timelineGeometry(viewportWidth, count = scenes.length) {
    const stepWidth = Math.max(132, viewportWidth / count), width = stepWidth * count;
    const start = stepWidth / 2, length = stepWidth * (count - 1), thumbSize = 7;
    // Native range thumbs travel between their centers, inset by half a thumb.
    // The range, progress line and equal-width step cells share this geometry.
    return { stepWidth, width, start, length, thumbSize, sliderLeft: start - thumbSize / 2, sliderWidth: length + thumbSize };
  }
  // Each symbol keeps one DOM identity. Layouts are algebraic endpoints;
  // interpolation transports shared factors and branches their copies.
  // Coordinates use a fixed SVG viewBox, never measurements during playback.
  const { encodingFormulaTokens, encodingFormulaKeyframes, encodingDerivationStages, encodingDerivationState, encodingFrame, encodingFormulaValues, encodingNotationState } = (node ? require('./scenes/frequency-encoding/state.js') : root.SIMMotionStateFactories['frequency-encoding'])({ ramp, lerp, clamp, orders, colors });
  function createLesson(options = {}) {
    if (options.pipeline && !options.capture) throw new Error('注入重建结果时必须同时提供对应的采集数据。');
    const capture = options.capture || A.capture({ sample: 'star-points', directions: 3, m: .8, noise: 'none' });
    const pipeline = options.pipeline || A.pipeline(capture.raw, capture.calibration, {}, .8);
    if (!pipeline.ok) throw new Error('SIM lesson reconstruction failed: ' + pipeline.reason);
    if (pipeline.n !== capture.raw.n || pipeline.groups.length !== capture.raw.groups.length || pipeline.raw.groups.some((g, i) =>
      g.index !== capture.raw.groups[i].index || g.frames.some((frame, j) => frame.pixels !== capture.raw.groups[i].frames[j]?.pixels))) {
      throw new Error('重建结果必须来自同一份采集帧，不能混用另一组数据。');
    }
    const emissionSpectrum = A.spectrum(capture.truth.emission[0][0]);
    const detection = { emission: capture.truth.emission[0][0], detected: capture.raw.groups[0].frames[0].pixels,
      transfer: Float64Array.from({ length: A.N ** 2 }, (_, i) => A.otf(A.bin(i % A.N), A.bin(Math.floor(i / A.N)))),
      spatialMaximum: 1 + capture.truth.m };
    const exposures = capture.raw.groups[0].frames;
    const acquisition = {
      mean: Float64Array.from(detection.detected, (_, i) => exposures.reduce((total, frame) => total + frame.pixels[i] / 3, 0)),
      cosine: Float64Array.from(detection.detected, (_, i) => exposures.reduce((total, frame) => total + 2 / 3 * frame.pixels[i] * Math.cos(frame.phase), 0)),
      sine: Float64Array.from(detection.detected, (_, i) => exposures.reduce((total, frame) => total + 2 / 3 * frame.pixels[i] * Math.sin(frame.phase), 0)),
      maximum: detection.spatialMaximum,
    };
    const encodingCopies = orders.map(order => A.shift(capture.truth.spectrum, -order * 8, 0));
    const encoding = orders.map((order, b) => {
      const shifted = encodingCopies[b], a = order === 0 ? 1 : .4;
      return { re: Float64Array.from(shifted.re, v => v * a), im: Float64Array.from(shifted.im, v => v * a) };
    });
    const length = pipeline.numerator.re.length;
    let sum = { re: new Float64Array(length), im: new Float64Array(length) };
    const records = pipeline.bands.map(band => {
      const before = sum;
      sum = { re: Float64Array.from(before.re, (v, i) => v + band.matched.re[i]), im: Float64Array.from(before.im, (v, i) => v + band.matched.im[i]) };
      return { band, before, after: sum };
    });
    const reciprocal = Float64Array.from(pipeline.regularizedDenominator, d => d > 1e-14 ? 1 / d : 0);
    const qIndex = A.idx(14, 0, pipeline.spectrumSize), qTruth = A.idx(14, 0, A.N);
    const amplitude = (z, i) => Math.hypot(z.re[i], z.im[i]) / A.N ** 2;
    const truthAmplitude = amplitude(capture.truth.spectrum, qTruth), outputAmplitude = amplitude(pipeline.spectrum, qIndex);
    const phaseError = Math.atan2(pipeline.spectrum.im[qIndex] * capture.truth.spectrum.re[qTruth] - pipeline.spectrum.re[qIndex] * capture.truth.spectrum.im[qTruth], pipeline.spectrum.re[qIndex] * capture.truth.spectrum.re[qTruth] + pipeline.spectrum.im[qIndex] * capture.truth.spectrum.im[qTruth]) * 180 / Math.PI;
    const rmse = pixels => Math.sqrt(pixels.reduce((s, value, i) => s + (value - capture.truth.sample[i]) ** 2, 0) / pixels.length);
    const audit = { truthAmplitude, outputAmplitude, ratio: outputAmplitude / truthAmplitude, phaseError, widefieldAmplitude: A.otf(14, 0) * truthAmplitude, widefieldRMSE: rmse(capture.truth.widefield), simRMSE: rmse(pipeline.pixels),
      dcTransfer: pipeline.effectiveTransfer[0], preApoTransfer: pipeline.preApoTransfer[qIndex], window: pipeline.apodization[qIndex], finalTransfer: pipeline.effectiveTransfer[qIndex] };
    // Compare three actual exposure states at one fixed specimen pixel.
    // The UI selects these records directly, never interpolating the phase.
    const point = { x: 100, y: 80 }, pointIndex = A.idx(point.x, point.y);
    const excitation = { point, period: A.N / A.VECTORS[0][0], m: capture.truth.m, sample: capture.truth.sample[pointIndex],
      frames: capture.raw.groups[0].frames.map((frame, j) => ({
        index: j, phase: frame.phase, label: phaseLabels[j],
        illumination: capture.truth.illumination[0][j], emission: capture.truth.emission[0][j],
        localIllumination: capture.truth.illumination[0][j][pointIndex], localEmission: capture.truth.emission[0][j][pointIndex],
      })),
    };
    return { capture, pipeline, probe: A.probe(pipeline, 0, 6, 0), group: pipeline.groups[0], encodingCopies, encoding, emissionSpectrum, detection, acquisition, records, reciprocal, audit, excitation };
  }
  function sample(time) {
    const t = clamp(time, 0, 6), derivation = demixState(t + DEMIX_START + (t > 3 ? 1 : 0));
    const reveal = ramp(t, 1, 1.12);
    const relocation = scenes.find(scene => scene.id === 'relocate-bands');
    const bands = derivation.bands, shifted = relocation.movement ? relocation.movement(clamp(t - 4)) : ramp(t, 4, 5), focus = ramp(t, 5, 6);
    return {
      ...derivation, t, reveal, bands, shifted, focus, spectrum: ramp(t, 0, 1),
      frames: orders.map((_, i) => ({
        x: lerp(360 + i * 360, 125, reveal), y: lerp(250, 155 + i * 155, reveal),
        scale: lerp(1, .36, reveal), opacity: (1 - focus) * (1 - bands * .25),
      })),
      sources: orders.map((order, i) => ({
        x: lerp(430 + i * 350, i === 2 ? 960 : 355, focus),
        y: lerp(250, i === 2 ? 257 : 125 + i * 268, focus),
        scale: lerp(1, i === 2 ? 1.4 : .65, focus),
        opacity: reveal * lerp(1, i === 2 ? 1 : .40, focus),
        offset: -order * 8 * shifted, detector: 6, specimen: 6 - order * 8 * shifted,
      })),
    };
  }
  function story(time) {
    const t = stageTime(clamp(time, 0, scenes.length - 1)), encodingSum = encodingSumState(time).opacity, detection = detectionState(time).opacity, acquisition = acquisitionState(time);
    return { t: time, stageTime: t, demixTime: clamp(legacyTime(time) - DEMIX_START, 0, 6), encodingSum, detection,
      intro: Math.max(0, 1 - acquisition.handoff - encodingSum - detection), demix: acquisition.handoff * (1 - ramp(t, 12, 13)),
      coverage: ramp(t, 12, 13) * (1 - ramp(t, 15, 16)),
      fusion: ramp(t, 15, 16) * (1 - ramp(t, 20, 20.12)), comparison: ramp(t, 20, 20.12),
      support: ramp(t, 13, 14), extraDirections: ramp(t, 14, 15),
    };
  }
  const fusionScenes = [
    {id:'otf-weight', frame:(node?require('./scenes/otf-weight/state.js'):root.SIMMotionStateFactories['otf-weight'])({clamp,smooth})},
    {id:'sum-contributions', frame:(node?require('./scenes/sum-contributions/state.js'):root.SIMMotionStateFactories['sum-contributions'])({clamp,smooth})},
    {id:'wiener', frame:(node?require('./scenes/wiener/state.js'):root.SIMMotionStateFactories['wiener'])({clamp,smooth})},
    {id:'apodization', frame:(node?require('./scenes/apodization/state.js'):root.SIMMotionStateFactories['apodization'])({clamp,smooth})},
    {id:'inverse-fft', frame:(node?require('./scenes/inverse-fft/state.js'):root.SIMMotionStateFactories['inverse-fft'])({clamp,smooth})},
  ];
  function fusionFrame(lesson,time) {
    const local=clamp(stageTime(time)-15,0,5),index=Math.max(0,Math.min(4,Math.ceil(local)-1));
    return fusionScenes[index].frame(lesson,local-index);
  }
  function pixel(view, index) {
    if (view.kind === 'scalar') return { re: view.to ? lerp(view.values[index], view.to[index], view.mix) : view.values[index], im: 0 };
    return { re: lerp(view.from.re[index], view.to.re[index], view.mix), im: lerp(view.from.im[index], view.to.im[index], view.mix) };
  }
  function scenePresentation(id, progress) {
    const scene = scenes.find(scene => scene.id === id);
    return scene?.present ? scene.present(progress) : null;
  }
  /* No independent element clocks: every visual is a pure function of time.
   * Scrubbing, reversing and jumping all sample exactly the same state. */
  function createPlayer(options = {}) {
    const request = options.request || requestAnimationFrame;
    const cancel = options.cancel || cancelAnimationFrame;
    const notify = options.render || (() => {});
    const durations = options.durations || transitionDurations;
    if (!Array.isArray(durations) || !durations.length || durations.some(v => !Number.isFinite(v) || v <= 0)) throw new Error('播放时长必须是正数。');
    const lastStop = durations.length;
    // A host may pass the composed story's durations without passing pacing.
    // Retain the reading holds for matching intervals in that case. Explicit
    // pacing (including {}) and unrelated custom durations keep their meaning.
    const pacing = options.pacing ?? Object.fromEntries(Object.entries(transitionPacing)
      .filter(([index, points]) => durations[index] === points.at(-1)[1]));
    for (const [key, points] of Object.entries(pacing)) {
      const index = Number(key);
      if (!Number.isInteger(index) || index < 0 || index >= lastStop || !Array.isArray(points) || points.length < 2 ||
        points.some((point, i) => !Array.isArray(point) || point.length !== 2 || point.some(v => !Number.isFinite(v)) ||
          (i > 0 && (point[0] <= points[i - 1][0] || point[1] <= points[i - 1][1]))) ||
        points[0][0] !== 0 || points[0][1] !== 0 || points.at(-1)[0] !== 1 || points.at(-1)[1] !== durations[index])
        throw new Error('分段播放时序必须递增，并覆盖完整步骤时长。');
    }
    let position = 0, target = 0, playing = false, frame = 0, last = null, speed = 1;
    let jumpMotion = null;
    let reduced = !!options.reducedMotion;
    const state = () => ({ position, target, playing, jumping: jumpMotion !== null, speed, reduced, last: lastStop });
    const emit = () => notify(state());
    function stop() { if (frame) cancel(frame); frame = 0; last = null; playing = false; }
    function play() { playing = true; last = null; frame = request(tick); emit(); }
    function tick(now) {
      frame = 0;
      if (!playing) return;
      if (last !== null) {
        const elapsed = Math.max(0, now - last);
        if (jumpMotion) {
          // Direct navigation has a bounded wall-clock duration. It crosses
          // the same reversible playhead with easing, independent of the
          // per-scene teaching durations and the user's playback speed.
          jumpMotion.elapsed = Math.min(jumpMotion.duration, jumpMotion.elapsed + elapsed);
          position = lerp(jumpMotion.from, target, smooth(jumpMotion.elapsed / jumpMotion.duration));
        } else {
          let milliseconds = Math.min(64, elapsed) * speed;
          const direction = Math.sign(target - position);
          while (milliseconds > 0 && Math.abs(target - position) > 1e-9) {
            const index = direction > 0 ? Math.floor(position + 1e-9) : Math.ceil(position - 1e-9) - 1;
            let boundary = direction > 0 ? Math.min(target, index + 1) : Math.max(target, index);
            let duration = durations[clamp(index, 0, durations.length - 1)];
            const points = pacing[index];
            if (points) {
              const local = position - index;
              let section = direction > 0 ? 0 : points.length - 2;
              if (direction > 0) while (section < points.length - 2 && local >= points[section + 1][0] - 1e-9) section++;
              else while (section > 0 && local <= points[section][0] + 1e-9) section--;
              const a = points[section], b = points[section + 1];
              duration = (b[1] - a[1]) / (b[0] - a[0]);
              boundary = direction > 0 ? Math.min(boundary, index + b[0]) : Math.max(boundary, index + a[0]);
            }
            const remaining = Math.abs(boundary - position) * duration;
            if (milliseconds >= remaining) { position = boundary; milliseconds -= remaining; }
            else { position += direction * milliseconds / duration; milliseconds = 0; }
          }
        }
        if (Math.abs(target - position) < 1e-9) { position = target; jumpMotion = null; stop(); }
      }
      if (playing) { last = now; frame = request(tick); }
      emit();
    }
    function go(value, { quick = false } = {}) {
      if (!Number.isFinite(value)) return false;
      stop(); jumpMotion = null; target = clamp(value, 0, lastStop);
      if (reduced || Math.abs(target - position) < 1e-9) { position = target; emit(); return true; }
      if (quick) jumpMotion = { from: position, elapsed: 0, duration: clamp(360 + 45 * Math.abs(target - position), 400, 1100) };
      play(); return true;
    }
    function jump(value) { return go(value, { quick: true }); }
    function navigate(direction) {
      if (playing || !direction) return false;
      const destination = direction > 0 ? Math.floor(position + 1e-8) + 1 : Math.ceil(position - 1e-8) - 1;
      return go(destination);
    }
    function seek(value) {
      if (!Number.isFinite(value)) return;
      stop(); jumpMotion = null; position = target = clamp(value, 0, lastStop); emit();
    }
    function pause() { stop(); emit(); }
    function toggle() {
      if (playing) pause();
      else if (Math.abs(position - target) > 1e-8) play();
      else navigate(1);
    }
    function setSpeed(value) { if (Number.isFinite(value) && value > 0) { speed = clamp(value, .25, 3); emit(); } }
    function setReducedMotion(value) { reduced = !!value; if (reduced) seek(target); else emit(); }
    return { state, go, jump, navigate, seek, pause, toggle, setSpeed, setReducedMotion, destroy() { stop(); jumpMotion = null; } };
  }
  function clickDirection(x, width, interactive = false, selectedText = false) {
    return interactive || selectedText || width <= 0 ? 0 : x < width / 2 ? -1 : 1;
  }
  const api = { scenes, chapters, sceneIds, parameterSlot, bandFormulas: F, DEMIX_START, orders, colors, phaseLabels, timelineGeometry, legacyTime, stageTime, sceneIndex, transitionDurations, transitionPacing, inverseEquations, inverseWeightTex, inverseState, sourceAnchors, sourceOriginState, sourceOriginPixel, demixState, encodingSumState, encodingSumPixel, detectionState, detectionPixel, acquisitionState, acquisitionPixel, createLesson, sample, story, encodingFormulaTokens, encodingFormulaKeyframes, encodingDerivationStages, encodingDerivationState, encodingFrame, encodingFormulaValues, encodingNotationState, fusionFrame, pixel, scenePresentation, createPlayer, clickDirection, clamp, lerp, ramp };
  if (node) module.exports = api; else root.SIMMotion = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
