/* Shared persistent actors for this scene family. */
(function(root){
  'use strict';
  (root.SIMMotionHostViews ||= {}).relocation = function({ arrowPath, M, A, $, lesson, create, attr, style, setText, opacity, compact, complex, math, imageURL, spectrumURL, spatialURL, maximum, formulaBox, canvasLayer, sources }) {
  function buildSources() {
    const max = maximum(lesson.group.separated), tints = [[110, 211, 200], [174, 157, 226], [235, 170, 103]];
    for (let b = 0; b < 3; b++) {
      const root = create('g', { color: M.colors[b], opacity: 0, 'data-order': M.orders[b] }, $('sources'));
      const order = create('text', { x: 0, y: -179, 'text-anchor': 'middle', class: 'source-order' }, root, ['0 级来源', '+1 级来源', '−1 级来源'][b]);
      const title = create('text', { x: 0, y: -145, 'text-anchor': 'middle', class: 'source-title' }, root);
      const titleBase = create('tspan', {}, title, 'A');
      const titleSub = create('tspan', { 'baseline-shift': 'sub', 'font-size': '65%' }, title, ['0', '+1', '−1'][b]);
      const band = create('g', { opacity: 0 }, root);
      create('rect', { x: -131, y: -131, width: 262, height: 262, rx: 5, class: 'band-background' }, band);
      const clip = create('g', { 'clip-path': 'url(#band-clip)' }, band);
      const moving = create('g', {}, clip);
      create('image', { x: -131, y: -131, width: 262, height: 262, class: 'spectrum-image', 'data-band-spectrum': b, href: spectrumURL(lesson.group.separated[b], max, tints[b], 48, lesson.pipeline.cutoff) }, moving);
      create('circle', { r: 262 * 10 / 48, class: 'moving-cutoff' }, moving);
      const fixedAxes = create('g', {}, band);
      create('path', { d: 'M -127 0 H 127 M 0 -127 V 127', class: 'frequency-axis' }, fixedAxes);
      for (const x of [-20, -10, 0, 10, 20]) {
        create('path', { d: `M ${x * 262 / 48} -3 V 3`, class: 'frequency-axis' }, fixedAxes);
        create('text', { x: x * 262 / 48, y: 16, 'text-anchor': 'middle', class: 'axis-tick' }, fixedAxes, String(x));
      }
      const ghost = create('circle', { r: 262 * 10 / 48, class: 'ghost-cutoff', opacity: 0 }, band);
      const marker = create('g', {}, band);
      create('circle', { r: 9, fill: 'currentColor', opacity: .2, filter: 'url(#point-glow)' }, marker);
      create('circle', { r: 6, fill: '#091115', stroke: 'currentColor', 'stroke-width': 1.6 }, marker);
      create('circle', { r: 2.5, fill: 'currentColor' }, marker);
      const pointLabel = create('text', { x: 7, y: -16, class: 'probe-label', style: 'fill:currentColor' }, marker, 'f');
      const shiftLabel = create('text', { x: 0, y: -111, 'text-anchor': 'middle', class: 'otf-caption' }, band, '检测坐标 f');
      const shiftArrow = create('path', { fill: 'none', stroke: 'currentColor', 'stroke-width': 1.2, opacity: 0 }, band);
      const result = create('text', { x: 0, y: 163, 'text-anchor': 'middle', fill: 'currentColor', class: 'result-value' }, band, complex(lesson.probe.orders[b].value));
      const sourceFrequency = create('text', { x: 0, y: 211, 'text-anchor': 'middle', class: 'source-frequency' }, root, '样品来源 q');
      sources.push({ root, order, titleBase, titleSub, band, moving, ghost, marker, pointLabel, shiftLabel, shiftArrow, sourceFrequency, result });
    }
  }

    return { buildSources };
  };
})(typeof globalThis!=='undefined'?globalThis:this);
