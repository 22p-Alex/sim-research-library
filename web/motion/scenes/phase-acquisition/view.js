/* Shared persistent actors for this scene family. */
(function(root){
  'use strict';
  (root.SIMMotionHostViews ||= {}).frames = function({ arrowPath, M, A, $, lesson, create, attr, style, setText, opacity, compact, complex, math, imageURL, spectrumURL, spatialURL, maximum, formulaBox, canvasLayer, cameras, acquisitionArrows }) {
  function buildFrames() {
    const max = maximum(lesson.group.rawSpectra);
    for (let i = 0; i < 3; i++) {
      const root = create('g', { 'data-frame': i }, $('frames'));
      attr(root, 'data-display-max', lesson.acquisition.maximum);
      create('rect', { x: -120, y: -120, width: 240, height: 240, rx: 7, class: 'camera-border' }, root);
      const images = create('g', { 'clip-path': 'url(#camera-clip)' }, root);
      const spatial = canvasLayer(images, -112, -112, 224, 224);
      attr(spatial.canvas, 'data-acquisition-camera', i);
      const spectrum = create('image', { x: -112, y: -112, width: 224, height: 224, class: 'spectrum-image', opacity: 0, href: spectrumURL(lesson.group.rawSpectra[i], max) }, images);
      const probe = create('g', { opacity: 0 }, root);
      create('circle', { r: 224 * 10 / 48, class: 'ghost-cutoff' }, probe);
      create('path', { d: 'M -107 0 H 107 M 0 -107 V 107', class: 'frequency-axis' }, probe);
      create('circle', { cx: 28, cy: 0, r: 13, class: 'camera-probe', opacity: .45 }, probe);
      create('path', { d: 'M 19 0 H 37 M 28 -9 V 9', class: 'camera-probe' }, probe);
      create('circle', { cx: 28, cy: 0, r: 3, fill: '#efb879' }, probe);
      const probeText = create('text', { x: 43, y: -14, class: 'probe-label', 'data-detector-label': i }, probe, 'f');
      create('path', { d: 'M -125 -103 V -125 H -103 M 103 -125 H 125 V -103 M 125 103 V 125 H 103 M -103 125 H -125 V 103', class: 'camera-corner' }, root);
      const label = create('text', { x: -112, y: 155, class: 'frame-label' }, root, `FRAME 0${i + 1}`);
      const phase = create('text', { x: 112, y: 155, 'text-anchor': 'end', class: 'phase-label' }, root, `φ = ${M.phaseLabels[i]}`);
      const phaseGuide = create('g', {}, root);
      create('text', { x: -112, y: -184, class: 'illumination-strip-label' }, phaseGuide, '照明条纹');
      const strip = canvasLayer(phaseGuide, -112, -170, 224, 24, 12);
      attr(strip.canvas, 'data-acquisition-illumination', i);
      cameras.push({ root, spectrum, probe, probeText, label, phase, spatial, phaseGuide, strip, lastPhase: null });
    }
    for (let i = 0; i < 2; i++) {
      const x = 540 + i * 360, group = create('g', { 'data-acquisition-arrow': i }, $('acquisition-arrows'));
      const path = create('path', { d: arrowPath(x - 44, 250, x + 44, 250, 7), class: 'detection-process', pathLength: 1, 'stroke-dasharray': 1 }, group);
      create('text', { x, y: 229, 'text-anchor': 'middle', class: 'acquisition-arrow-label' }, group, '+ 2π/3');
      acquisitionArrows.push({ group, path });
    }
  }
  function paintAcquisition(camera, phase) {
    if (camera.lastPhase === phase) return;
    const recorded = lesson.capture.raw.groups[0].frames.find(frame => Math.abs(frame.phase - phase) < 1e-12);
    for (let i = 0; i < 128 ** 2; i++) {
      const value = recorded ? recorded.pixels[i] : M.acquisitionPixel(lesson, phase, i);
      const v = Math.round(M.clamp(value / lesson.acquisition.maximum) * 255), k = 4 * i;
      camera.spatial.data.data[k] = v * .87; camera.spatial.data.data[k + 1] = v * .97;
      camera.spatial.data.data[k + 2] = v; camera.spatial.data.data[k + 3] = 255;
    }
    for (let x = 0; x < 128; x++) {
      const light = 1 + lesson.excitation.m * Math.cos(2 * Math.PI * x / lesson.excitation.period + phase);
      const v = Math.round(light / lesson.acquisition.maximum * 255);
      for (let y = 0; y < 12; y++) {
        const k = 4 * (y * 128 + x);
        camera.strip.data.data[k] = v * .87; camera.strip.data.data[k + 1] = v * .97;
        camera.strip.data.data[k + 2] = v; camera.strip.data.data[k + 3] = 255;
      }
    }
    camera.spatial.ctx.putImageData(camera.spatial.data, 0, 0); camera.strip.ctx.putImageData(camera.strip.data, 0, 0);
    attr(camera.spatial.canvas, 'data-phase', phase); attr(camera.strip.canvas, 'data-phase', phase);
    camera.lastPhase = phase;
  }
    return { buildFrames, paintAcquisition };
  };
})(typeof globalThis!=='undefined'?globalThis:this);
