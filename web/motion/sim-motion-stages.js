/* Full-story stages around the original demixing scene. Local SVG + Canvas;
 * no independent animation clocks. All draw methods sample one playhead. */
(function (root) {
  'use strict';
  const M = root.SIMMotion, A = root.SIMAtlas;
  function createStages(helpers) {
    const { lesson, create, attr, opacity, spatialURL, spectrumURL, imageURL, maximum, arrowPath, compact } = helpers;
    const $ = id => document.getElementById(id), r = M.ramp, mix = M.lerp;
    const p = lesson.pipeline, truth = lesson.capture.truth;
    const gray = [189, 219, 229], directionColors = ['#7ad5cd', '#b7a5eb', '#9ebddd'];
    const viewRange = 48;
    function label(parent, x, y, text, className = 'svg-small', anchor = 'middle') {
      return create('text', { x, y, class: className, 'text-anchor': anchor }, parent, text);
    }
    function image(parent, url, size = 260) { return create('image', { x: -size / 2, y: -size / 2, width: size, height: size, href: url }, parent); }
    function panel(parent, x, y, name, url, size = 260) {
      const group = create('g', { transform: `translate(${x} ${y})` }, parent);
      create('rect', { x: -size / 2 - 7, y: -size / 2 - 7, width: size + 14, height: size + 14, rx: 5, class: 'camera-border' }, group);
      const picture = url ? image(group, url, size) : null;
      const title = label(group, 0, -size / 2 - 29, name, 'svg-title');
      const caption = label(group, 0, size / 2 + 36, '', 'svg-small');
      return { group, picture, title, caption, size };
    }
    function frequencyOverlay(parent, size = 260, showCutoff = true) {
      const unit = size / viewRange;
      create('path', { d: `M ${-size / 2} 0 H ${size / 2} M 0 ${-size / 2} V ${size / 2}`, class: 'frequency-axis' }, parent);
      if (showCutoff) create('circle', { r: 10 * unit, class: 'ghost-cutoff' }, parent);
      for (const tick of [-20, -10, 0, 10, 20]) label(parent, tick * unit, 17, tick, 'axis-tick');
      return unit;
    }
    function dot(parent, color = '#efb879') {
      const group = create('g', { color }, parent);
      create('circle', { r: 11, fill: 'currentColor', opacity: .1 }, group);
      create('circle', { r: 5, fill: '#091115', stroke: 'currentColor', 'stroke-width': 1.5 }, group);
      create('path', { d: 'M -9 0 H 9 M 0 -9 V 9', stroke: 'currentColor', 'stroke-width': 1 }, group);
      return group;
    }
    const intro = $('intro-stage'), sumStage = $('encoding-sum-stage'), detectionStage = $('detection-stage'), coverage = $('coverage-stage'), fusion = $('fusion-stage'), comparison = $('comparison-stage');
    const sampleURL = spatialURL(truth.sample), wfURL = spatialURL(truth.widefield), simURL = spatialURL(p.outputPixels);
    const excitation = lesson.excitation;
    const exposureImages = excitation.frames.map(frame => ({ light: spatialURL(frame.illumination, 1.8), emission: spatialURL(frame.emission, 1.8) }));
    const lightURL = exposureImages[0].light, emissionURL = exposureImages[0].emission;
    const sourceMax = maximum([truth.spectrum, lesson.emissionSpectrum]);
    const spectrumTruthURL = spectrumURL(truth.spectrum, sourceMax), spectrumWFURL = spectrumURL(A.spectrum(truth.widefield), sourceMax);

    const sumIndexes = Uint32Array.from({ length: 128 * 128 }, (_, i) => A.idx(Math.floor((i % 128 - 64) * viewRange / 128), Math.floor((Math.floor(i / 128) - 64) * viewRange / 128)));
    const context = { sumIndexes, lesson, create, attr, opacity, spatialURL, spectrumURL, imageURL, maximum, arrowPath, compact, $, r, mix, p, truth, gray, directionColors, viewRange, label, image, panel, frequencyOverlay, dot, intro, sumStage, detectionStage, coverage, fusion, comparison, sampleURL, wfURL, simURL, excitation, exposureImages, lightURL, emissionURL, sourceMax, spectrumTruthURL, spectrumWFURL };
    const views = Object.fromEntries(Object.entries(root.SIMMotionViewFactories).map(([key,create])=>[key,create(context)]));
    function draw(time, excitationPhase = 0) {
      const state = M.story(time);
      opacity(intro, state.intro); opacity(sumStage, state.encodingSum); opacity(detectionStage, state.detection); opacity(coverage, state.coverage); opacity(fusion, state.fusion); opacity(comparison, state.comparison);
      if (state.intro > 0) views.intro.draw(state.stageTime, excitationPhase, time);
      if (state.encodingSum > 0) views.encodingSum.draw(time);
      if (state.detection > 0) views.detection.draw(time);
      if (state.coverage > 0) views.coverage.draw(state.stageTime, state);
      if (state.fusion > 0) views.fusion.draw(time);
      if (state.comparison > 0) views.comparison.draw(state.stageTime);
    }
    return { draw };
  }
  root.SIMMotionStages = { create: createStages };
})(typeof globalThis !== 'undefined' ? globalThis : this);
