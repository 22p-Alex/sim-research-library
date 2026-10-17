/* Buildless, offline renderer. SVG objects retain their identity throughout
 * the story. All animation state comes from the one SIMMotion playhead.
 * KaTeX emits native MathML, so no network fonts or CDN runtime are needed. */
(function () {
  'use strict';
  const M = window.SIMMotion, A = window.SIMAtlas;
  const Chapter = window.SIMMotionParameterChapter;
  let Flow;
  const $ = id => document.getElementById(id);
  const ns = 'http://www.w3.org/2000/svg';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let lesson, player, fullStages, currentScene = -1, currentStopIndex = -1, focusBeforeDialog = null;
  let excitationPhase = 0, fourierLesson = null;
  let timeline = null, scrubbing = false;
  let parameterChapter, parameterView, parameterFormulaView, bridgeView, reconstruction;
  const stopButtons = [];
  const create = (tag, attrs = {}, parent, text) => {
    const el = document.createElementNS(ns, tag);
    for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
    if (text !== undefined) el.textContent = text;
    if (parent) parent.appendChild(el);
    return el;
  };
  // Setting textContent recreates its text node even when the text is equal.
  // Keep stable SVG labels, paths, MathML styles and transport DOM untouched.
  // These reads access stored DOM values; none requests computed layout.
  const attr = (el, name, value) => {
    const next = String(value);
    if (el.getAttribute(name) !== next) el.setAttribute(name, next);
  };
  const style = (el, name, value) => {
    const next = String(value);
    if (el.style.getPropertyValue(name) !== next) el.style.setProperty(name, next);
  };
  const setText = (el, value) => {
    const next = String(value);
    if (el.textContent !== next) el.textContent = next;
  };
  const opacity = (el, value) => style(el, 'opacity', value);
  const compact = value => Math.abs(value) < 5e-9 ? '0' : Number(value.toPrecision(4)).toString();
  const complex = z => `${compact(z.re)} ${z.im < 0 ? '−' : '+'} ${compact(Math.abs(z.im))}i`;
  function math(el, wrapped) {
    const tex = wrapped.replace(/^\$\$|\$\$$/g, '');
    el.innerHTML = window.katex.renderToString(tex, { output: 'mathml', displayMode: true, throwOnError: true, strict: 'error' });
  }
  function imageURL(read, size = 256) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d'), pixels = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const rgb = read(x, y, size), index = 4 * (y * size + x);
      pixels.data[index] = rgb[0]; pixels.data[index + 1] = rgb[1]; pixels.data[index + 2] = rgb[2]; pixels.data[index + 3] = rgb[3] ?? 255;
    }
    ctx.putImageData(pixels, 0, 0); return canvas.toDataURL('image/png');
  }
  function spatialURL(pixels, maximumValue = 1) {
    const n = Math.sqrt(pixels.length);
    return imageURL((x, y, size) => {
      const p = pixels[Math.floor(y * n / size) * n + Math.floor(x * n / size)];
      const v = Math.round(M.clamp(p / maximumValue) * 255); return [v * .87, v * .97, v];
    });
  }
  const maximum = spectra => spectra.reduce((max, z) => {
    for (let i = 0; i < z.re.length; i++) max = Math.max(max, Math.hypot(z.re[i], z.im[i]));
    return max;
  }, 0);
  function spectrumURL(z, max, color = [189, 219, 229], range = 48, supportRadius = null) {
    const n = Math.sqrt(z.re.length), scale = Math.log1p(max);
    return imageURL((x, y, size) => {
      const fx = Math.floor((x - size / 2) * range / size), fy = Math.floor((y - size / 2) * range / size);
      // Separated bands have no signal outside the OTF support. Let the fixed
      // panel show through there instead of translating an opaque rectangle.
      if (supportRadius !== null && Math.hypot(fx, fy) >= supportRadius) return [0, 0, 0, 0];
      const index = A.idx(fx, fy, n), v = Math.log1p(Math.hypot(z.re[index], z.im[index])) / scale;
      return [9 + color[0] * v, 17 + color[1] * v, 23 + color[2] * v];
    });
  }
  const cameras = [], sources = [], acquisitionArrows = [];
  const matrixView = { mixingRows: [], inverseRows: [], weights: [], tokens: [], sourceTerms: [], operators: [], inverseHandoff: [] };
  const inverseView = { tokens: {}, formulas: [] };
  const encodingAlgebraView = [];
  const proofView = { factors: [], grouped: [], sums: [] }, calculationView = { products: [] };
  function buildEncodingAlgebra() {
    const parent = $('encoding-algebra-tokens');
    for (const token of M.encodingFormulaTokens) {
      const group = create('g', { 'data-encoding-token': token.id, 'data-encoding-band': token.band ?? '',
        color: token.band === null ? '#edf0e9' : M.colors[token.band] }, parent);
      if (token.kind === 'fraction-bar') {
        // KaTeX's MathML-only \rule is a black mspace, which disappears on
        // this dark background. Draw a stroke that inherits the band's color.
        create('line', { x1: -13, x2: 13, y1: 0, y2: 0, stroke: 'currentColor',
          'stroke-width': 1.6, 'stroke-linecap': 'round', 'vector-effect': 'non-scaling-stroke',
          'data-fraction-bar': token.id, 'aria-hidden': true }, group);
      } else {
        const box = create('foreignObject', { x: -token.width / 2, y: -42, width: token.width, height: 84 }, group);
        const content = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
        attr(content, 'class', 'encoding-algebra-math'); box.appendChild(content); math(content, token.equation);
      }
      encodingAlgebraView.push(group);
    }
  }
  function formulaBox(parent, x, y, width, height, tex, attrs = {}) {
    const box = create('foreignObject', { x, y, width, height, ...attrs }, parent);
    const content = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
    attr(content, 'class', 'demix-proof-math'); box.appendChild(content); math(content, tex); return box;
  }
  function canvasLayer(parent, x, y, width, height, pixelHeight = 128) {
    const foreign = create('foreignObject', { x, y, width, height }, parent);
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = pixelHeight;
    canvas.style.width = canvas.style.height = '100%'; canvas.style.display = 'block'; foreign.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    return { canvas, ctx, data: ctx.createImageData(128, pixelHeight) };
  }
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

  const orderTex = ['0', '+1', '-1'];
  const sourceTex = ['H(\\mathbf f)S(\\mathbf f)', 'H(\\mathbf f)S(\\mathbf f-\\mathbf k)', 'H(\\mathbf f)S(\\mathbf f+\\mathbf k)'];
  const coefficientTex = (r, c) => c === 0 ? '1' : '\\frac m2e^{' + (c === 2 ? '-' : '') + 'i\\phi_' + r + '}';
  function centeredMath(parent, x, y, width, height, tex, attrs = {}) {
    return formulaBox(parent, x - width / 2, y - height / 2, width, height, '$$' + tex + '$$', attrs);
  }
  const originView = { panels: [], lastFilter: null };
  function buildSourceOrigins() {
    const root = $('demix-source-origin');
    originView.caption = create('text', { x: 790, y: 86, 'text-anchor': 'middle', class: 'svg-small' }, root);
    originView.maximum = maximum([lesson.capture.truth.spectrum, lesson.emissionSpectrum]);
    const unweighted = ['S(\\mathbf f)', 'S(\\mathbf f-\\mathbf k)', 'S(\\mathbf f+\\mathbf k)'];
    for (let b = 0; b < 3; b++) {
      const anchor = M.sourceAnchors[b];
      const group = create('g', { transform: `translate(${anchor.overview.x} ${anchor.overview.y})`, color: M.colors[b],
        'data-source-origin': b, 'data-source-order': anchor.order }, root);
      create('rect', { x: -107, y: -107, width: 214, height: 214, rx: 5, class: 'camera-border',
        style: 'stroke:currentColor', 'vector-effect': 'non-scaling-stroke' }, group);
      const pixels = canvasLayer(group, -100, -100, 200, 200);
      const cutoff = create('circle', { r: 200 * 10 / 48, class: 'moving-cutoff' }, group);
      create('path', { d: 'M -100 0 H 100 M 0 -100 V 100', class: 'frequency-axis' }, group);
      const label = create('text', { x: 0, y: -133, 'text-anchor': 'middle', class: 'source-order' }, group, ['0 级来源', '+1 级来源', '−1 级来源'][b]);
      const original = centeredMath(group, 0, 144, 330, 65, unweighted[b]);
      const detected = centeredMath(group, 0, 144, 330, 65, sourceTex[b]);
      const alias = centeredMath(group, 0, -140, 210, 60, 'A_{' + orderTex[b] + '}(\\mathbf f)');
      const point = create('g', { transform: `translate(${lesson.probe.bin.x * 200 / 48} ${lesson.probe.bin.y * 200 / 48})`, 'data-source-origin-probe': b }, group);
      create('circle', { r: 7, fill: '#091115', stroke: 'currentColor', 'stroke-width': 1.5 }, point);
      create('path', { d: 'M -11 0 H 11 M 0 -11 V 11', stroke: 'currentColor' }, point);
      create('text', { x: 12, y: -12, class: 'probe-label', style: 'fill:currentColor' }, point, 'f');
      originView.panels.push({ group, pixels, cutoff, label, original, detected, alias, point });
    }
    originView.note = create('text', { x: 790, y: 494, 'text-anchor': 'middle', class: 'svg-muted' }, root,
      '回看成像时的组成；相机实际记录三者的加权总和。现在要从三帧中求回这些来源。');
  }
  function drawSourceOrigins(state) {
    const root = $('demix-source-origin');
    opacity(root, state.opacity); attr(root, 'aria-hidden', state.opacity === 0);
    if (state.opacity === 0) return;
    const detail = 1 - state.dock;
    opacity(originView.caption, detail); opacity(originView.note, detail);
    setText(originView.caption, state.dock > 0 ? '三份 A 缩成缩略图，移到各自的方程分量旁'
      : state.probe > 0 ? '在三个来源中读取同一个 f，再与三帧观测联立'
      : state.alias > 0 ? '经过检测后的三份来源，分别记为 A₀、A₊₁、A₋₁'
      : state.filter > 0 ? '06 · 同一个 H(f) 作用于每份来源，照明权重留在外面'
      : '05 · 回看叠加前的三份未加权移频频谱');
    const max = originView.maximum;
    originView.panels.forEach((panel, b) => {
      const pose = state.panels[b];
      attr(panel.group, 'transform', `translate(${pose.x} ${pose.y}) scale(${pose.scale})`);
      attr(panel.group, 'data-source-dock', state.dock); attr(panel.group, 'data-source-matrix', state.matrix);
      opacity(panel.cutoff, state.filter); opacity(panel.label, (1 - state.alias) * detail); opacity(panel.alias, state.alias * detail);
      opacity(panel.original, (1 - state.filter) * detail); opacity(panel.detected, state.filter * detail); opacity(panel.point, state.probe);
      attr(panel.group, 'data-filter-progress', state.filter);
      if (originView.lastFilter !== state.filter) {
        for (let i = 0; i < 128 ** 2; i++) {
          const index = A.idx(Math.floor((i % 128 - 64) * 48 / 128), Math.floor((Math.floor(i / 128) - 64) * 48 / 128));
          const z = M.sourceOriginPixel(lesson, b, state.filter, index);
          const v = Math.log1p(Math.hypot(z.re, z.im)) / Math.log1p(max), k = i * 4;
          panel.pixels.data.data[k] = 9 + 189 * v; panel.pixels.data.data[k + 1] = 17 + 219 * v;
          panel.pixels.data.data[k + 2] = 23 + 229 * v; panel.pixels.data.data[k + 3] = 255;
        }
        panel.pixels.ctx.putImageData(panel.pixels.data, 0, 0);
      }
    });
    originView.lastFilter = state.filter;
  }
  function bracket(parent, left, right, top, bottom) {
    create('path', { d: 'M ' + (left + 10) + ' ' + top + ' H ' + left + ' V ' + bottom + ' H ' + (left + 10)
      + ' M ' + (right - 10) + ' ' + top + ' H ' + right + ' V ' + bottom + ' H ' + (right - 10), class: 'matrix-bracket' }, parent);
  }
  function buildDemixMatrix() {
    buildSourceOrigins();
    const root = $('demix-matrix-view'), definitions = $('demix-source-definitions');
    math($('demix-source-equation'), M.bandFormulas.source);
    for (let b = 0; b < 3; b++) {
      const x = 300 + b * 360;
      create('rect', { x, y: 66, width: 345, height: 90, rx: 5, color: M.colors[b], class: 'matrix-result-card' }, definitions);
      const label = centeredMath(definitions, x + 172.5, 111, 335, 84,
        '\\begin{gathered}A_{' + orderTex[b] + '}(\\mathbf f)=' + '\\\\' + sourceTex[b] + '\\end{gathered}',
        { 'data-source-definition': b });
      style(label, 'color', M.colors[b]);
    }
    matrixView.caption = create('text', { x: 845, y: 545, 'text-anchor': 'middle', class: 'matrix-caption' }, root);
    matrixView.forward = create('g', {}, root);
    matrixView.backward = create('g', {}, root);
    matrixView.scaffold = create('g', {}, matrixView.forward);
    const scaffold = matrixView.scaffold;
    // Rows are observations; columns always keep the order 0, +1, -1.
    bracket(scaffold, 290, 435, 278, 494);
    bracket(scaffold, 530, 1070, 278, 494);
    bracket(scaffold, 1140, 1350, 278, 494);
    centeredMath(scaffold, 478, 386, 70, 60, '=');
    centeredMath(scaffold, 800, 263, 100, 40, 'M');
    centeredMath(scaffold, 1110, 386, 50, 60, '\\cdot');
    for (let r = 0; r < 3; r++) {
      const anchor = M.sourceAnchors[r], y = anchor.vector.y;
      const row = create('g', { 'data-mixing-row': r }, scaffold);
      create('rect', { x: 539, y: y - 31, width: 522, height: 62, rx: 4, class: 'matrix-row-background' }, row);
      centeredMath(scaffold, anchor.vector.x, y, 130, 62, 'A_{' + orderTex[r] + '}(\\mathbf f)',
        { style: 'color:' + M.colors[r], 'data-matrix-source': r, 'data-source-order': anchor.order });
      matrixView.mixingRows.push(row);
    }

    // Full detection equation -> replace each H*S by its A -> one scalar row.
    // These are fixed DOM nodes. Their path and opacity use the main playhead.
    for (let b = 0; b < 3; b++) {
      const anchor = M.sourceAnchors[b];
      const group = create('g', { 'data-source-term': b, 'data-source-order': anchor.order }, matrixView.forward);
      const full = centeredMath(group, 0, 0, 355, 74, sourceTex[b], { 'data-detected-source': b });
      const alias = centeredMath(group, 0, 0, 160, 74, 'A_{' + orderTex[b] + '}(\\mathbf f)', { 'data-source-alias': b });
      style(group, 'color', M.colors[b]);
      matrixView.sourceTerms.push({ group, full, alias, from: anchor.expanded, to: anchor.scalar });
    }
    for (let k = 0; k < 3; k++) {
      const group = create('g', {}, matrixView.forward);
      centeredMath(group, 0, 0, 40, 60, k === 0 ? '=' : '+');
      matrixView.operators.push({ group, from: { x: 520, y: 218 + k * 100 }, to: { x: [430, 715, 1030][k], y: 207 } });
    }
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) {
        const ghost = create('g', { 'data-transfer-source': r + ':' + c }, matrixView.forward);
        const group = create('g', { 'data-matrix-transfer': r + ':' + c }, matrixView.forward);
        const tex = c === 0 ? 'D_' + r + '(\\mathbf f)' : coefficientTex(r, c - 1);
        centeredMath(ghost, 0, 0, 155, 72, tex);
        centeredMath(group, 0, 0, 155, 72, tex);
        if (c > 0) { style(group, 'color', M.colors[c - 1]); style(ghost, 'color', M.colors[c - 1]); }
        matrixView.tokens.push({ group, ghost, r, c,
          full: { x: c === 0 ? 410 : 660, y: c === 0 ? 218 : 218 + (c - 1) * 100 },
          from: { x: c === 0 ? 340 : 485 + (c - 1) * 315, y: 207 },
          to: { x: c === 0 ? 362.5 : 620 + (c - 1) * 180, y: 314 + r * 72 } });
      }
    }
    // Keep the inverse definition beside the heading, above the frame labels.
    create('text', { x: 740, y: 197, 'text-anchor': 'middle', class: 'matrix-heading', 'data-inverse-heading': '' }, matrixView.backward, '来源 = 解混权重 × 三帧观测');
    centeredMath(matrixView.backward, 1050, 190, 190, 44, 'U=M^{-1}', { 'data-inverse-definition': '' });
    ['第 0 帧权重', '第 1 帧权重', '第 2 帧权重'].forEach((label, c) => create('text', { x: 625 + c * 180, y: 247,
      'text-anchor': 'middle', class: 'matrix-caption' }, matrixView.backward, label));
    bracket(matrixView.backward, 260, 430, 268, 499);
    bracket(matrixView.backward, 535, 1065, 268, 499);
    bracket(matrixView.backward, 1180, 1370, 268, 499);
    // Save the exact poses and formula sources for the following handoff.
    // Both renderers use these descriptors, so no second set of coordinates
    // can drift away from the visible endpoint of the inverse derivation.
    const handoffMath = (parent, x, y, width, height, tex, kind, row, attrs = {}) => {
      const element = centeredMath(parent, x, y, width, height, tex, attrs);
      matrixView.inverseHandoff.push({ element, x, y, width, height, tex, kind, row });
      return element;
    };
    handoffMath(matrixView.backward, 478, 383, 65, 64, '=', 'equals', null, { 'data-demix-equals': '' });
    handoffMath(matrixView.backward, 1120, 383, 65, 64, '\\cdot', 'multiply', null);
    for (let r = 0; r < 3; r++) {
      const y = 307 + r * 76, row = create('g', { 'data-inverse-row': r }, matrixView.backward);
      create('rect', { x: 543, y: y - 34, width: 514, height: 68, rx: 5, class: 'matrix-row-background' }, row);
      handoffMath(row, 345, y, 160, 64, 'A_{' + orderTex[r] + '}(\\mathbf f)', 'source', r, { style: 'color:' + M.colors[r] });
      handoffMath(matrixView.backward, 1240, y, 110, 64, 'D_' + r + '(\\mathbf f)', 'observation', r, { 'data-demix-observation': r });
      for (let c = 0; c < 3; c++) {
        const x = 625 + c * 180;
        const highlight = create('rect', { x: x - 81, y: y - 32, width: 162, height: 64, rx: 4,
          fill: M.colors[r] + '12', stroke: M.colors[r], 'stroke-width': 1 }, row);
        const symbolic = centeredMath(row, x, y, 170, 64, 'u_{' + orderTex[r] + ',' + c + '}',
          { 'data-symbolic-weight': r + ':' + c, style: 'color:' + M.colors[r] });
        const resolved = handoffMath(row, x, y, 170, 64, M.inverseWeightTex(r, c), 'weight', r,
          { 'data-resolved-weight': r + ':' + c, style: 'color:' + M.colors[r] });
        matrixView.weights.push({ symbolic, resolved, highlight, r, c });
      }
      matrixView.inverseRows.push(row);
    }
  }
  const inverseCaptions = [
    '三帧观测方程已经组成 D = M A。',
    '等号两边同时左乘 M⁻¹，乘法次序保持不变。',
    'M⁻¹M = I；单位矩阵乘 A，仍然得到 A。',
    '去掉单位矩阵，A 的内容和数值保持不变。',
    '将 A 写到左边，得到三个来源的分离式。',
    'u 是 U 中的复数权重：每一行与右侧同一组三帧相乘求和，得到一个来源。',
    '等间隔三相位且 m ≠ 0：按行逐项写出求逆结果。',
  ];
  function buildInverseTransform() {
    inverseView.root = create('g', { 'data-inverse-transform': '' }, $('demix-matrix-view'));
    inverseView.heading = create('text', { x: 840, y: 207, 'text-anchor': 'middle', class: 'matrix-heading' }, inverseView.root);
    inverseView.highlight = create('rect', { x: 830, y: 282, width: 290, height: 94, rx: 6,
      fill: '#7ad5cd0a', stroke: '#7ad5cd', 'stroke-width': 1.5 }, inverseView.root);
    const terms = {
      leftInverse: 'M^{-1}', observation: '\\mathbf D(\\mathbf f)', equals: '=',
      rightInverse: 'M^{-1}', mixing: 'M', identity: 'I', source: '\\mathbf A(\\mathbf f)',
    };
    for (const [name, tex] of Object.entries(terms)) {
      const group = create('g', { 'data-inverse-token': name }, inverseView.root);
      centeredMath(group, 0, 0, name === 'equals' ? 55 : 180, 82, tex);
      if (name.includes('Inverse') || name === 'identity') style(group, 'color', '#7ad5cd');
      inverseView.tokens[name] = group;
    }
    for (const [i, tex] of M.inverseEquations.entries()) {
      const div = document.createElement('div');
      attr(div, 'class', 'demix-matrix-equation'); attr(div, 'data-inverse-formula', i);
      $('demix-inverse-equations').appendChild(div); math(div, tex); inverseView.formulas.push(div);
    }
  }
  function drawInverseTransform(demix) {
    const s = demix.inversion, y = 330;
    const show = (el, alpha) => { opacity(el, alpha); attr(el, 'aria-hidden', alpha === 0); };
    show(inverseView.root, demix.inverse * (1 - M.ramp(s.weights, 0, .4)));
    setText(inverseView.heading, ['从已建立的方程出发', '两边同时左乘逆矩阵', 'M⁻¹M 化为单位矩阵 I', 'I 乘 A 仍是 A',
      '得到分离式：求出的仍是同一个 A', '展开逆矩阵的三行权重', '等间隔三相位：逐项写出求逆结果'][s.formula]);
    setText($('demix-inverse-caption'), inverseCaptions[s.formula]);
    const place = (name, x, dy = 0, alpha = 1) => {
      const el = inverseView.tokens[name];
      attr(el, 'transform', 'translate(' + x + ' ' + (y + dy) + ')'); show(el, alpha);
    };
    const swapArc = 44 * Math.sin(Math.PI * s.swap);
    place('leftInverse', M.lerp(400, 900, s.swap), -74 * (1 - s.multiply) + swapArc, s.multiply);
    place('observation', M.lerp(550, 1050, s.swap), swapArc);
    place('equals', 750);
    // Product disappears before I appears; no overlapping replacement glyphs.
    const product = 1 - M.ramp(s.identity, 0, .4);
    place('rightInverse', M.lerp(905, 975, s.identity), -74 * (1 - s.multiply), s.multiply * product);
    place('mixing', M.lerp(1050, 975, s.identity), 0, product);
    place('identity', 975, 0, M.ramp(s.identity, .6, 1) * (1 - s.removeIdentity));
    place('source', M.lerp(M.lerp(1260, 1070, s.removeIdentity), 545, s.swap), -swapArc);
    opacity(inverseView.highlight, M.ramp(s.multiply, .7, 1) * (1 - s.identity));
    inverseView.formulas.forEach((el, i) => show(el, i === s.formula ? 1 : 0));
  }
  function buildDemixProof() {
    buildInverseTransform();
    const root = $('demix-proof-view'), application = $('demix-calculation-view');
    create('text', { x: 840, y: 195, 'text-anchor': 'middle', class: 'matrix-heading' }, root, '提出同一个来源，括号就是这一行权重乘 M');
    for (let b = 0; b < 3; b++) {
      const x = 300 + b * 360, center = x + 172.5;
      create('rect', { x, y: 218, width: 345, height: 275, rx: 6, class: 'matrix-result-card', color: M.colors[b] }, root);
      const factors = create('g', { 'data-symbolic-factors': b }, root);
      for (let j = 0; j < 3; j++) centeredMath(factors, center, 252 + j * 67, 325, 64,
        (j ? '+\\;' : '') + 'u_{-1,' + j + '}\\cdot ' + coefficientTex(j, b));
      proofView.factors.push(factors);
      const sumTex = b === 0 ? '\\sum_{j=0}^{2}u_{-1,j}' :
        '\\frac m2\\sum_{j=0}^{2}u_{-1,j}e^{' + (b === 2 ? '-' : '') + 'i\\phi_j}';
      proofView.grouped.push(centeredMath(root, center, 320, 330, 105, sumTex, { 'data-symbolic-sum': b }));
      proofView.sums.push(centeredMath(root, center, 423, 325, 60, '=' + (b === 2 ? '1' : '0'),
        { 'data-coefficient-sum': b, 'data-retain': b === 2 ? 1 : 0 }));
      create('text', { x: center, y: 477, 'text-anchor': 'middle', class: 'matrix-caption' }, root,
        ['0 级系数相消', '+1 级系数相消', '−1 级系数保留'][b]);
    }
    proofView.conclusion = centeredMath(root, 840, 529, 1040, 54,
      'A_{-1}(\\mathbf f)=0A_0(\\mathbf f)+0A_{+1}(\\mathbf f)+1A_{-1}(\\mathbf f)');
    create('text', { x: 840, y: 195, 'text-anchor': 'middle', class: 'matrix-heading' }, application, '参数确定后，对每个检测频率做同样的乘加');
    for (let j = 0; j < 3; j++) {
      const x = 475 + j * 360;
      centeredMath(application, x, 265, 330, 85, 'u_{-1,' + j + '}\\cdot D_' + j + '(\\mathbf f)',
        { 'data-symbolic-input': j });
      calculationView.products.push(centeredMath(application, x, 355, 330, 85,
        (j ? '+\\;' : '') + 'u_{-1,' + j + '}D_' + j + '(\\mathbf f)', { 'data-symbolic-product': j }));
    }
    calculationView.total = centeredMath(application, 840, 450, 1060, 80,
      '\\sum_{j=0}^{2}u_{-1,j}D_j(\\mathbf f)=A_{-1}(\\mathbf f)');
    calculationView.otherRows = create('text', { x: 840, y: 527, 'text-anchor': 'middle', class: 'matrix-caption' }, application,
      '其余两行同理；同一方向的权重用于全部频率。');
    calculationView.bandSummary = centeredMath($('demix-band-summary'), 825, 516, 1100, 62,
      'A_\\ell(\\mathbf f)=H(\\mathbf f)S(\\mathbf f-\\ell\\mathbf k),\\qquad\\ell\\in\\{0,+1,-1\\}');
  }
  function drawDemix(demix, s) {
    drawSourceOrigins(demix.origin);
    const show = (el, value) => { opacity(el, value); attr(el, 'aria-hidden', value === 0); };
    show($('demix-source-definitions'), demix.reveal * demix.definitions * (1 - demix.bands));
    show($('demix-matrix-view'), demix.reveal * (1 - demix.proof));
    show(matrixView.forward, 1 - demix.inverse); show(matrixView.backward, M.ramp(demix.inversion.weights, .6, 1));
    drawInverseTransform(demix);
    opacity(matrixView.scaffold, demix.arrange);
    opacity(matrixView.caption, 1);
    setText(matrixView.caption, demix.inverse > .5
      ? demix.inversion.formula < 6 ? '先展开 U 的三行，再将每个 u 写成求逆结果。'
        : '按行展开 U：每一行给出一个来源的三帧加权系数。'
      : demix.arrange < .5 ? 'H 乘在三个样品频谱项上；将这些乘积分别记为 A。'
      : '缩略图依次对应 A₀、A₊₁、A₋₁；Dⱼ 与三个系数进入第 j 行。');
    for (const item of [...matrixView.sourceTerms, ...matrixView.operators]) {
      attr(item.group, 'transform', 'translate(' + M.lerp(item.from.x, item.to.x, demix.arrange) + ' '
        + M.lerp(item.from.y, item.to.y, demix.arrange) + ')');
      if (item.full) { opacity(item.full, 1 - demix.collapse); opacity(item.alias, demix.collapse); }
    }
    for (const item of matrixView.tokens) {
      const p = demix.transfers[item.r][item.c];
      const x = M.lerp(item.full.x, item.from.x, demix.arrange), y = M.lerp(item.full.y, item.from.y, demix.arrange);
      // A faint copy keeps the scalar equation readable after each transfer.
      attr(item.ghost, 'transform', 'translate(' + x + ' ' + y + ')');
      opacity(item.ghost, .5 * demix.activeRows[item.r] * p);
      attr(item.group, 'transform', 'translate(' + M.lerp(x, item.to.x, p) + ' '
        + (M.lerp(y, item.to.y, p) - 24 * Math.sin(Math.PI * p)) + ')');
      show(item.group, Math.max(demix.activeRows[item.r], M.ramp(p, 0, .08)));
      attr(item.group, 'data-transfer-progress', p);
    }
    for (let r = 0; r < 3; r++) {
      opacity(matrixView.mixingRows[r], .15 + .85 * demix.matrixRows[r]);
      opacity(matrixView.inverseRows[r], r === 2 ? 1 : 1 - .7 * demix.selectedRow);
      style(matrixView.inverseRows[r], '--row-emphasis', r === 2 ? demix.selectedRow : 0);
      style($('demix-equations'), '--mix-row-' + r, .18 + .82 * demix.matrixRows[r]);
    }
    for (const item of matrixView.weights) {
      const p = demix.inversion.resolved[item.r][item.c];
      const oldAlpha = 1 - M.ramp(p, 0, .4), newAlpha = M.ramp(p, .6, 1);
      show(item.symbolic, oldAlpha); show(item.resolved, newAlpha);
      attr(item.symbolic, 'transform', 'translate(0 ' + (-8 * (1 - oldAlpha)) + ')');
      attr(item.resolved, 'transform', 'translate(0 ' + (8 * (1 - newAlpha)) + ')');
      attr(item.resolved, 'data-resolution-progress', p);
      opacity(item.highlight, Math.sin(Math.PI * p));
    }
    show($('demix-proof-view'), demix.proof * (1 - demix.application));
    show($('demix-calculation-view'), demix.application * (1 - demix.bands));
    proofView.factors.forEach(el => {
      const alpha = 1 - M.ramp(demix.expand, 0, .4);
      opacity(el, alpha); attr(el, 'aria-hidden', alpha === 0);
    });
    proofView.grouped.forEach(el => {
      const alpha = M.ramp(demix.expand, .6, 1);
      opacity(el, alpha); attr(el, 'aria-hidden', alpha === 0);
    });
    proofView.sums.forEach(el => opacity(el, demix.coefficientSum));
    opacity(proofView.conclusion, demix.proofComplete);
    calculationView.products.forEach((el, j) => opacity(el, demix.products[j]));
    opacity(calculationView.total, demix.applyRows[2]); opacity(calculationView.otherRows, demix.applyRows[1]);
    show($('demix-band-summary'), demix.bands * (1 - s.shifted));
  }
  function arrowPath(x1, y1, x2, y2, head = 7) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    return `M ${x1} ${y1} L ${x2} ${y2} M ${x2 - head * Math.cos(angle - .43)} ${y2 - head * Math.sin(angle - .43)} L ${x2} ${y2} L ${x2 - head * Math.cos(angle + .43)} ${y2 - head * Math.sin(angle + .43)}`;
  }
  function drawMotion(time) {
    const story = M.story(time), s = M.sample(story.demixTime), acquisition = M.acquisitionState(time), demix = M.demixState(time);
    opacity($('demix-stage'), story.demix);
    cameras.forEach((camera, i) => {
      const f = s.frames[i], phase = acquisition.frames[i].phase, pose = acquisition.firstPose;
      const dock = demix.inversion.weights * (1 - demix.proof);
      attr(camera.root, 'transform', i === 0 && time < 6 ? `translate(${pose.x} ${pose.y}) scale(${pose.size / 224})`
        : `translate(${M.lerp(f.x, 1330, dock)} ${M.lerp(f.y, 307 + i * 76, dock)}) scale(${M.lerp(f.scale, .18, dock)})`);
      opacity(camera.root, f.opacity * acquisition.frames[i].opacity);
      paintAcquisition(camera, phase); opacity(camera.phaseGuide, acquisition.stripOpacity);
      opacity(camera.spectrum, s.spectrum); opacity(camera.probe, s.spectrum);
      const preview = phase < lesson.capture.raw.groups[0].frames[i].phase - 1e-12;
      setText(camera.label, preview ? '相移预览' : s.reveal > .5 ? `D${'₀₁₂'[i]}` : s.spectrum > .5 ? `FFT / D${'₀₁₂'[i]}` : `FRAME 0${i + 1}`);
      const nearest = Math.round(phase / (2 * Math.PI / 3));
      setText(camera.phase, Math.abs(phase - nearest * 2 * Math.PI / 3) < 1e-12 ? `φ = ${M.phaseLabels[nearest]}` : `φ ≈ ${(phase / Math.PI).toFixed(3)}π`);
      style(camera.label, 'font-size', `${M.lerp(18, 32, s.reveal)}px`); style(camera.phase, 'font-size', `${M.lerp(14, 29, s.reveal)}px`);
      opacity(camera.probeText, 1 - s.reveal);
      opacity(camera.label, 1 - dock);
      opacity(camera.phase, 1 - s.reveal);
      attr(camera.label, 'x', M.lerp(-112, 0, s.reveal));
      attr(camera.label, 'text-anchor', s.reveal > .5 ? 'middle' : 'start');
    });
    sources.forEach((source, b) => {
      const f = s.sources[b];
      attr(source.root, 'transform', `translate(${f.x} ${f.y}) scale(${f.scale})`);
      opacity(source.root, f.opacity * s.bands); opacity(source.band, 1);
      setText(source.titleBase, s.shifted > .5 ? 'C' : 'A');
      const shift = -M.orders[b] * lesson.group.kx * s.shifted * 262 / 48;
      const shiftY = -M.orders[b] * lesson.group.ky * s.shifted * 262 / 48;
      attr(source.moving, 'transform', `translate(${shift} ${shiftY})`);
      opacity(source.ghost, s.shifted * .55);
      const qx = 6 - M.orders[b] * lesson.group.kx * s.shifted;
      attr(source.marker, 'transform', `translate(${qx * 262 / 48} ${shiftY})`);
      setText(source.pointLabel, s.shifted < .01 ? 'f' : ['q = f', 'q = f − k', 'q = f + k'][b]);
      setText(source.shiftLabel, s.shifted < .01 ? '检测坐标 f' : b === 0 ? '0 级 · 保持原位' : `${b === 1 ? '← −k' : '+k →'} · 频带与 OTF 同步`);
      opacity(source.shiftArrow, s.shifted * (b === 0 ? 0 : .7));
      attr(source.shiftArrow, 'd', arrowPath(0, 89, shift, 89, 5));
      setText(source.sourceFrequency, s.shifted < .99 ? '仍带 OTF 衰减' : '回到样品来源 q · 仍保留 H(f)');
      attr(source.sourceFrequency, 'y', 199);
      opacity(source.result, s.shifted);
    });
    opacity($('opening-labels'), (1 - s.reveal) * acquisition.completed);
    acquisitionArrows.forEach((arrow, i) => {
      opacity(arrow.group, acquisition.arrows[i]); attr(arrow.path, 'stroke-dashoffset', 1 - acquisition.arrows[i]);
    });
    const demixGroup = $('demix-equations');
    drawDemix(demix, s);
    opacity($('final-callout'), s.focus);
    fullStages.draw(time, excitationPhase);
    opacity(demixGroup, Math.max(demix.reveal, demix.origin.opacity));
    for (const [name, value] of Object.entries(demix.panels)) {
      const panel = $(`demix-formula-${name}`);
      opacity(panel, value); attr(panel, 'aria-hidden', value === 0);
    }
    const frame = M.encodingFrame(time), formulaGroup = $('encoding-pair-equations');
    opacity(formulaGroup, frame.formulaOpacity);
    attr(formulaGroup, 'transform', `translate(0 ${frame.formulaOffset})`);
    attr(formulaGroup, 'aria-hidden', frame.formulaOpacity === 0);
    for (const [side, point] of [['positive', frame.panels[2].points[0]], ['negative', frame.panels[1].points[1]]]) {
      style($(`encoding-${side}`), '--encoding-emphasis', point.emphasis);
      attr($(`encoding-${side}`), 'data-in-passband', point.inside);
    }
    const sum = M.encodingSumState(time), notation = M.encodingNotationState(time), compactOpacity = notation.compact * (1 - sum.expanded);
    const derivation = M.encodingDerivationState(time);
    const algebra = derivation.formula;
    opacity($('encoding-derivation'), algebra.opacity); attr($('encoding-derivation'), 'aria-hidden', algebra.opacity === 0);
    attr($('encoding-algebra-tokens'), 'transform', `translate(${algebra.x} ${algebra.y}) scale(${algebra.scale})`);
    algebra.tokens.forEach((pose, i) => {
      const group = encodingAlgebraView[i];
      attr(group, 'transform', `translate(${pose.x} ${pose.y}) scale(${pose.scale})`);
      opacity(group, pose.opacity); attr(group, 'aria-hidden', pose.opacity === 0);
    });
    for (const name of ['theta', 'identity', 'cancel', 'half', 'substitute', 'factor', 'notation', 'theorem']) {
      const box = $(`encoding-algebra-${name}`), alpha = algebra[name];
      opacity(box, alpha); attr(box, 'aria-hidden', alpha === 0);
      attr(box, 'transform', `translate(0 ${10 * (1 - alpha)})`);
    }
    for (const phase of ['forward', 'numeric', 'inverse']) {
      const el = $(`encoding-coordinate-${phase}`);
      opacity(el, notation[phase]); attr(el, 'aria-hidden', notation[phase] === 0);
    }
    style($('encoding-coordinate-forward'), 'transform', `translateY(${30 * (1 - M.ramp(time, 2.48, 2.58))}px)`);
    for (const part of ['source', 'shift', 'destination']) style($(`encoding-symbol-${part}`), '--symbol-focus', notation[`${part}Focus`]);
    style($('encoding-numeric-destination'), '--symbol-focus', notation.destinationFocus);
    for (const id of ['encoding-inverse-source', 'encoding-lookup-term']) style($(id), '--symbol-focus', notation.lookupFocus);
    opacity($('encoding-lookup-note'), notation.lookupDetail); attr($('encoding-lookup-note'), 'aria-hidden', notation.lookupDetail === 0);
    $('encoding-lookup-note').hidden = notation.lookupDetail === 0;
    opacity($('encoding-sum-expanded'), sum.expanded); opacity($('encoding-sum-compact'), compactOpacity);
    attr($('encoding-sum-expanded'), 'aria-hidden', sum.expanded === 0); attr($('encoding-sum-compact'), 'aria-hidden', compactOpacity === 0);
    style($('encoding-sum-term-zero'), '--term-emphasis', Math.max(sum.zeroFocus, sum.sumFocus));
    for (const side of ['positive', 'negative']) {
      style($(`encoding-sum-weight-${side}`), '--term-emphasis', sum.weightFocus);
      style($(`encoding-sum-term-${side}`), '--term-emphasis', sum.sumFocus);
    }
    for (const id of ['encoding-sum-plus-one', 'encoding-sum-plus-two']) style($(id), '--term-emphasis', sum.sumFocus);
    const detection = M.detectionState(time);
    const contextOpacity = detection.opacity * detection.copy * acquisition.clear;
    opacity($('detection-context'), contextOpacity); attr($('detection-context'), 'aria-hidden', contextOpacity === 0);
    for (const domain of ['spatial', 'frequency']) {
      style($(`detection-${domain}-input`), '--detection-emphasis', detection.inputFocus);
      style($(`detection-${domain}-filter`), '--detection-emphasis', detection.filterFocus);
      style($(`detection-${domain}-result`), '--detection-emphasis', detection.resultFocus);
    }
    style($('detection-pair'), '--detection-emphasis', detection.filterFocus);
    attr($('detection-equations'), 'data-filter-progress', detection.filter);
    setText($('detection-formula-cue'), detection.filter === 0 ? 'e₀ = sI₀：检测前已受条纹调制的荧光发射'
      : detection.filter < 1 ? '卷积与滤波同步呈现：圈内逐渐衰减，圈外逐渐消失'
      : 'f 的位置不变，三个来源仍混在同一个观测值里；一帧还不足以解开');
    setText($('acquisition-phase-number'), (acquisition.phase / Math.PI).toFixed(3));
    attr($('acquisition-equations'), 'data-phase', acquisition.phase);
    style($('acquisition-phase-term'), '--detection-emphasis', acquisition.shifting ? 1 : .25);
    for (let i = 0; i < 3; i++) style($(`acquisition-phase-${i}`), '--phase-focus', acquisition.active === i ? 1 : 0);
  }
  function draw(time, animateCopy = true) {
    const frame = Flow.frame(time), index = Flow.sceneIndex(time);
    drawMotion(frame.baseTime);
    bridgeView.resetEntry();
    if (index !== currentScene) showScene(index, animateCopy);
    if (Flow.scenes[index].id === 'frequency-encoding') {
      const view = M.encodingDerivationState(frame.baseTime).view, copy = view || Flow.scenes[index];
      setText($('scene-title'), copy.title); setText($('scene-description'), copy.copy);
      setText($('scene-svg-description'), copy.copy + ' ' + copy.note);
      setText($('encoding-algebra-description'), copy.copy + ' ' + copy.note);
      setText($('equation-note'), copy.note); $('equation-note').hidden = !copy.note;
      setText($('equation-domain'), view ? view.domain : copy.formulaDomain);
      setText($('view-label'), view ? 'EULER → FOURIER / 从余弦到移频' : 'SPECIMEN → DETECTION / 编码与检测');
      setText($('stage-caption'), view ? `${M.encodingDerivationStages.indexOf(view) + 1} / ${M.encodingDerivationStages.length} · ${view.domain}` : 'TRACK A PAIR / q = (±14, 0)');
    }
    let motionAlpha = 1, provisionalAlpha = 0, parameterAlpha = 0, adoptedAlpha = 0, pairAlpha = 0;
    const enter = M.ramp(frame.progress, 0, .12);
    if (frame.owner === 'bridge') {
      bridgeView.draw(frame.id, frame.progress);
      if (frame.id === 'provisional-split') {
        const state = Chapter.provisionalState(frame.progress);
        motionAlpha = state.matrix; provisionalAlpha = 1;
        setText($('view-label'), state.nominalFailure > 0 ? 'NOMINAL PARAMETERS / 标称值重建对照'
          : state.observation.intro > 0 ? 'OBSERVATION → OTF × SPECTRA / 从观测展开频带'
          : state.notation.active ? 'ROW → MATRIX → VECTOR / 逐行乘加 → 矩阵合写'
          : state.seconds >= 94 ? 'WEIGHT FACTOR → BAND FACTOR / 系数比例 → 输出比例'
          : state.seconds >= 86 ? 'ACTUAL / TEMPORARY WEIGHT / 在原公式上比较权重'
          : state.seconds >= 82 ? 'MATRIX → ROW PRODUCT / 矩阵项飞入组成公式'
          : state.seconds >= 74 ? 'WEIGHT → MATRIX / 权重回到矩阵'
          : state.seconds >= 54.5 ? 'ACTUAL WEIGHTS / 实际权重的结构' : 'WEIGHTS → ACTUAL PARAMETERS / 权重 → 实际参数');
        setText($('equation-domain'), state.nominalFailure > 0 ? '直接代入标称值 · 结果对照'
          : state.observation.intro > 0 ? '观测 D → H 与照明频谱 → 临时频带'
          : state.seconds >= 94 ? '临时权重 → 临时矩阵 → 临时输出'
          : state.seconds >= 86 ? 'u 与 ũ · 原公式内替换'
          : state.seconds >= 74 ? 'u → U → A = UD'
          : state.seconds >= 54.5 ? '实际权重 → 已知与未知' : '逆矩阵权重 → 照明参数');
        opacity($('demix-source-definitions'), state.context);
        opacity(matrixView.caption, state.context);
        cameras.forEach(camera => opacity(camera.root, Number(camera.root.style.opacity) * state.context));
        const formula = state.notation.active ? bridgeView.drawProvisionalFormula(frame.progress)
          : parameterFormulaView.draw({ id: frame.id, progress: frame.progress });
        setText($('scene-title'), formula.title); setText($('scene-description'), formula.copy);
        setText($('equation-note'), formula.note); $('equation-note').hidden = !formula.note;
        attr($('equation'), 'data-parameter-focus', state.focus || '');
        setText($('scene-svg-description'), formula.copy + ' ' + formula.note);
        setText($('stage-caption'), { knownHighlight: '第一行 · 高亮系数', knownMessage: '第一行 · 已知常数，直接可算',
          knownRestore: '第一行 · 文字退去，系数恢复', sideHighlight: '第二、三行 · 高亮系数', sideMessage: '旁带 · 需要知道 φⱼ 和 m',
          sideRestore: '旁带 · 文字退去，系数恢复', gather: '来源列 → A(f) · 权重 → U · 观测列 → D(f)',
          whyEstimate: '回到照明公式', wavevectorReason: 'k 跳动 → 波矢为什么可能偏离预设',
          amplitudePhaseReason: 'm、φⱼ 跳动 → 实际幅相为什么可能偏离预设', nominalPlug: '直接代回硬件标称值',
          vectorFailure: '结果一 · 亚像素错位', phaseFailure: '结果二 · 反相抵消与黑边下冲',
          nominalResidual: '实际误差 · 周期性残余条纹', actualWeights: '重新显示逆矩阵 U',
          extractWeight: '从矩阵取出旁带权重 → 左侧放大', showWeight: '等号 → 原有系数',
          expandWeight: '实际相位 → 已知相移 + 共同偏移', splitWeight: '权重因式分解 · 未知部分与 j 无关',
          returnWeight: '同一个 u → U 的原单元格', matrixApply: '权重行 × 观测列 → 对应的 A',
          rowProduct: '矩阵项飞入 → 三次相乘、逐项相加', nameKnown: '原公式中的 u₊₁,₁ → 原位展开',
          coefficientScale: 'ũ 与 u 只差共同幅相因子', outputScale: '系数的共同比例 → 输出的共同比例',
          matrixNotation: '临时 +1 行归位 → 补齐 0、+1、−1 三行',
          vectorNotation: '中央收拢 → Ã = ŨD', observationModel: 'D = H × M × 三份样品频谱',
          substituteObservation: '提出标量 H → ŨM 相邻', temporaryResponse: 'ŨM → 各级次的对角系数',
          expandBands: '同一批 H、S 与系数 → 三份临时频带',
          ready: 'Ã = ŨD → 公共区参数估计' }[state.mode]);
      }
      else {
        motionAlpha = 0; parameterAlpha = 1 - enter; adoptedAlpha = enter;
        parameterView.drawScene('least-squares-fit', 1); pairAlpha = 1 - enter;
      }
    } else if (frame.owner === 'parameters') {
      motionAlpha = 0;
      const split = frame.sceneId === 'shared' ? Chapter.sharedEntryState(frame.progress) : null;
      const state = parameterView.drawScene(frame.sceneId, split ? split.lessonProgress : frame.progress);
      parameterAlpha = 1; pairAlpha = 1;
      if (frame.sceneId === 'shared') {
        provisionalAlpha = 1 - split.handoff;
        if (provisionalAlpha) bridgeView.draw('provisional-split', 1);
        if (split.progress < 1) {
          parameterAlpha = split.context; pairAlpha = split.handoff;
          bridgeView.drawEntry(frame.progress);
        }
        const copy = split.progress < 1 ? Chapter.sharedEntryFormulaAt(frame.progress) : Flow.scenes[index];
        setText($('scene-title'), copy.title); setText($('scene-description'), copy.copy);
        setText($('scene-svg-description'), copy.copy + ' ' + copy.note);
        setText($('stage-caption'), split.progress < 1 ? 'Ã → 0、+1、−1 → 0、+1' : '0 级 + +1 级 / 相机数据估计');
      } else if(frame.sceneId==='refine'||frame.sceneId==='least-squares-fit') {
        const copy=window.SIMParameterLesson[frame.sceneId==='refine'?'refinementNarrative':'leastSquaresNarrative'](frame.progress);
        setText($('scene-title'),copy.title);setText($('scene-description'),copy.copy);
        setText($('scene-svg-description'),copy.copy+' '+window.SIMParameterLesson.scene(frame.sceneId).note);
        setText($('stage-caption'),frame.sceneId==='least-squares-fit'?'共同复系数 → 全部公共点拟合 → 参数回填':copy.mode==='returnSpectrum'?'位置锁定 → 完整频谱 → 共同幅相':'空域相位斜坡 → 小数频移 → 三轮 5×5');
      }
      const useEntryFormula = split && split.progress < 1;
      const formula = useEntryFormula ? bridgeView.drawEntryFormula(frame.progress) : parameterFormulaView.draw(state);
      setText($('equation-note'), formula.note); $('equation-note').hidden = !formula.note;
    } else if (frame.id === 'separate-bands' && frame.progress < .12) {
      adoptedAlpha = 1 - enter; motionAlpha = enter; bridgeView.draw('adopted-weights', 1);
    }
    for (const [id, alpha] of [['motion-content', motionAlpha], ['provisional-stage', provisionalAlpha], ['parameter-stage', parameterAlpha], ['adopted-stage', adoptedAlpha], ['frequency-handoff-stage', pairAlpha]]) {
      opacity($(id), alpha); attr($(id), 'aria-hidden', alpha === 0);
    }
    attr($('scene'), 'data-flow-scene', Flow.scenes[index].id);
    attr($('scene'), 'data-parameter-source', 'estimated-from-observations');
  }
  function showScene(index, animateCopy = true) {
    const data = Flow.scenes[index]; currentScene = index;
    $('chapter').textContent = data.chapter; $('scene-title').textContent = data.title;
    $('scene-description').textContent = data.copy; $('scene-number').textContent = String(index + 1).padStart(2, '0');
    parameterFormulaView?.reset();
    math($('equation'), data.equation); $('equation-note').textContent = data.note;
    $('equation-note').hidden = !data.note;
    $('equation-domain').textContent = data.formulaDomain;
    const pair = data.domainPair;
    $('equation').hidden = !!pair || data.encodingFormula || data.detectionFormula || data.acquisitionFormula || data.demixFormula;
    $('demix-equations').hidden = !data.demixFormula;
    $('encoding-sum-equations').hidden = !data.encodingFormula;
    $('detection-equations').hidden = !data.detectionFormula;
    $('acquisition-equations').hidden = !data.acquisitionFormula;
    $('domain-equations').hidden = !pair; $('domain-guide').hidden = !pair?.guide;
    $('fourier-open').hidden = index !== 0;
    const topicLabels = { weights: '同一频率怎样加权？看推导与实际权重 ↗', rmse: 'RMSE 是什么？为什么本例 SIM 的误差更大？ ↗' };
    $('theory-context').hidden = !topicLabels[data.theoryTopic];
    $('equation-info').hidden = !!data.demixFormula || data.owner !== 'motion';
    $('theory-context').textContent = topicLabels[data.theoryTopic] || '';
    $('app').classList.toggle('has-domain-pair', !!pair);
    $('app').classList.toggle('has-demix-formula', data.demixFormula);
    if (pair) {
      for (const side of ['left', 'bridge', 'right']) {
        $(`domain-${side}-label`).textContent = pair[`${side}Label`];
        math($(`domain-${side}`), pair[side]);
        const detail = $(`domain-${side}-detail`), equation = pair[`${side}Detail`];
        detail.hidden = !equation;
        if (equation) math(detail, equation);
        else detail.innerHTML = '';
      }
      $('domain-guide').textContent = pair.guide;
    }
    $('scene-svg-description').textContent = data.copy + ' ' + data.note;
    const stageIndex = data.stageIndex;
    $('view-label').textContent = data.demixFormula ? 'LINEAR SYSTEM / 三帧 · 三个来源' : data.detectionFormula ? 'BEFORE → AFTER / 同一检测 · 空域与频域' : data.encodingSum ? 'WEIGHT → SUM / 编码系数 → 频谱叠加' : stageIndex === 0 ? 'REAL SPACE → FOURIER SPACE / 样品 → 频谱' : stageIndex < 5 ? 'SPECIMEN → DETECTION / 编码与检测' : stageIndex === 5 ? 'REAL SPACE / 相机观测' : stageIndex === 6 ? 'FOURIER SPACE / 检测频谱' : stageIndex < 10 ? 'LINEAR SYSTEM / 三帧 · 三个来源' : stageIndex < 13 ? 'FOURIER SPACE / 频带归位' : stageIndex < 16 ? 'MULTIPLE DIRECTIONS / 频率覆盖' : stageIndex < 20 ? 'COMPLEX SPECTRUM / 复数融合' : 'IMAGE & VALIDATION / 重建与验证';
    $('stage-caption').textContent = data.demixFormula ? (data.id === 'verify-demix' ? '0 · 0 · 1 / 验证来源系数' : data.id === 'separate-bands' ? 'WEIGHT → SUM / 符号乘加' : data.id === 'mixed-sources' ? '05 → 06 → A / 来源进入方程' : 'M → M⁻¹ / 符号权重') : data.detectionFormula ? 'SAME f / 衰减后仍是混合' : data.encodingSum ? '1 DIRECTION · FIXED PHASE / φ₀ = 0' : stageIndex === 0 ? 'q：样品频率坐标 · 单位：DFT 格' : stageIndex === 3 ? 'TRACK A PAIR / q = (±14, 0)' : stageIndex < 5 ? 'TRACK ONE FREQUENCY / q = (14, 0)' : stageIndex < 7 ? '3 PHASES · 1 DIRECTION' : stageIndex < 10 ? 'M → M⁻¹ / 矩阵解混' : stageIndex < 13 ? 'f → q / KEEP THE SAME VALUE' : stageIndex < 16 ? '3 DIRECTIONS · 9 BANDS' : stageIndex < 20 ? 'WEIGHT → SUM → FILTER' : 'THE SAME DATA, BACK IN REAL SPACE';
    if (data.owner !== 'motion') {
      $('view-label').textContent = data.owner === 'parameters' ? 'PARAMETER ESTIMATION / 同一组三帧'
        : data.id === 'provisional-split' ? 'WEIGHTS → ACTUAL PARAMETERS / 权重 → 实际参数' : 'PHASE SEPARATION / 估计值 → 正式权重';
      $('stage-caption').textContent = data.owner === 'parameters' ? '0 级 + +1 级 / 相机数据估计' : data.id === 'provisional-split' ? '波矢 · 调制度 · 相位' : 'k̂ · φ̂ⱼ · m̂ → 正式重建';
    }
    for (const el of [$('scene-copy'), $('equation'), $('domain-equations')]) {
      if (typeof el.getAnimations === 'function') el.getAnimations().forEach(animation => animation.cancel());
    }
    if (animateCopy && !reduced.matches) {
      for (const el of [$('scene-copy'), pair ? $('domain-equations') : $('equation')]) {
        if (typeof el.animate !== 'function') continue;
        el.animate([{ opacity: .2, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 320, easing: 'ease-out' });
      }
    }
  }
  function sizeTimeline() {
    const strip = $('timeline-scroll'), content = $('timeline-content'), slider = $('progress');
    timeline = M.timelineGeometry(strip.clientWidth, Flow.scenes.length);
    content.style.width = `${timeline.width}px`;
    content.style.setProperty('--stop-count', Flow.scenes.length);
    content.style.setProperty('--track-start', `${timeline.start}px`);
    content.style.setProperty('--track-length', `${timeline.length}px`);
    slider.style.left = `${timeline.sliderLeft}px`; slider.style.width = `${timeline.sliderWidth}px`;
    slider.style.setProperty('--thumb-size', `${timeline.thumbSize}px`);
  }
  function followStop(index, animate = false) {
    const strip = $('timeline-scroll');
    if (!timeline || !stopButtons[index] || !strip.clientWidth || scrubbing) return;
    const center = timeline.start + index * timeline.stepWidth;
    const left = M.clamp(center - strip.clientWidth / 2, 0, Math.max(0, timeline.width - strip.clientWidth));
    strip.scrollTo({ left, behavior: animate && !reduced.matches ? 'smooth' : 'instant' });
  }
  function update(state) {
    draw(state.position, !state.jumping);
    const index = Flow.sceneIndex(state.position), scene = Flow.scenes[index], stopped = !state.playing;
    const compareExposures = stopped && Math.abs(state.position - 2) < 1e-8;
    $('chapter-replay').hidden = scene.owner === 'motion' || state.reduced;
    $('chapter-replay').disabled = state.playing;
    $('encoding-replay').hidden = scene.id !== 'frequency-encoding' || state.reduced;
    $('encoding-replay').disabled = state.playing;
    $('demix-mix-replay').hidden = scene.id !== 'mixed-sources' || state.reduced;
    $('demix-mix-replay').disabled = state.playing;
    $('demix-matrix-replay').hidden = !['inverse-demix', 'verify-demix', 'separate-bands'].includes(scene.id) || state.reduced;
    setText($('demix-matrix-replay'), scene.id === 'verify-demix' ? '↺ 重看抵消' : scene.id === 'separate-bands' ? '↺ 重看逐点解混' : '↺ 重看求逆');
    $('demix-matrix-replay').disabled = state.playing;
    $('excitation-phases').hidden = !compareExposures;
    for (let j = 0; j < 3; j++) {
      $(`excitation-phase-${j}`).disabled = !compareExposures;
      attr($(`excitation-phase-${j}`), 'aria-pressed', j === excitationPhase);
    }
    $('progress').value = String(state.position);
    style($('timeline-content'), '--progress', `${state.position / state.last * 100}%`);
    attr($('progress'), 'aria-valuetext', `第 ${index + 1} 步：${scene.label}`);
    $('edge-prev').disabled = state.playing || state.position <= 0;
    $('edge-next').disabled = state.playing || state.position >= state.last;
    const paused = stopped && Math.abs(state.position - state.target) > 1e-8;
    setText($('pause'), state.playing ? 'Ⅱ 暂停' : paused ? '继续 →' : state.position >= state.last ? '↺ 再看一遍' : '下一步 →');
    attr($('pause'), 'aria-label', $('pause').textContent);
    const status = state.playing ? `${state.jumping ? '快速跳转到' : '前往'}第 ${state.target + 1} 步` : paused ? '已暂停 · 可继续或回退' : `停在第 ${index + 1} 步 / 共 ${Flow.scenes.length} 步`;
    if ($('playback-status').textContent !== status) $('playback-status').textContent = status;
    setText($('speed'), `${state.speed}×`); attr($('speed'), 'aria-label', `播放速度，当前 ${state.speed} 倍速`);
    $('speed').disabled = state.reduced;
    if (currentStopIndex !== index) {
      stopButtons.forEach(button => {
        const i = Number(button.dataset.stop); button.classList.toggle('done', i < index);
        if (i === index) attr(button, 'aria-current', 'step');
        else if (button.getAttribute('aria-current') !== null) button.removeAttribute('aria-current');
      });
      currentStopIndex = index;
      followStop(index, state.playing && !state.jumping);
    }
    const hint = $('gesture-hint');
    if (state.reduced) setText(hint, '已遵循系统“减少动态效果”设置 · 点击左右切换');
    else {
      const html = state.position > .05
        ? '<kbd>←</kbd> 左侧返回 <span class="hint-divider">/</span> 右侧继续 <kbd>→</kbd><span class="hint-divider">·</span> 空格暂停'
        : '<kbd>←</kbd> 左侧返回 <span class="hint-divider">/</span> 点击右半屏，开始 <kbd>→</kbd>';
      if (hint.innerHTML !== html) hint.innerHTML = html;
    }
  }
  function populateTheory() {
    document.querySelectorAll('[data-equation]').forEach(el => math(el, el.dataset.equation));
    const row = (parent, cells) => { const tr = document.createElement('tr'); cells.forEach(value => { const td = document.createElement('td'); td.textContent = value; tr.appendChild(td); }); parent.appendChild(tr); };
    lesson.probe.observed.forEach((value, j) => row($('observed-values'), [`D${'₀₁₂'[j]}`, complex(value), complex(lesson.probe.weights[2][j])]));
    lesson.probe.orders.forEach(order => row($('component-values'), [String(order.order), `(${order.specimenFrequency.join(', ')})`, complex(order.value)]));
    $('closure-note').textContent = `代回三帧观测的最大复数误差：${lesson.probe.closureError.toExponential(2)}。H(f) = ${lesson.probe.orders[2].h.toFixed(6)}。`;
    const p = lesson.pipeline, q = A.idx(14, 0, p.spectrumSize), scaled = z => complex({ re: z.re[q] / 128 ** 2, im: z.im[q] / 128 ** 2 });
    p.groups.forEach((group, d) => row($('parameter-values'), [`方向 ${d + 1}`, `(${[group.kx, group.ky].map(compact).join(', ')})`, `${group.angle.toFixed(3)}°`, group.period.toFixed(3)]));
    const overlap = A.idx(6, 0, p.spectrumSize), denominator = p.regularizedDenominator[overlap];
    p.bands.forEach(band => {
      const detector = [6 + band.kx, band.ky];
      row($('overlap-values'), [`${band.direction + 1} / ${band.order > 0 ? '+' : ''}${band.order}`, `(${detector.join(', ')})`, band.h[overlap].toFixed(6), (band.h[overlap] / denominator).toFixed(6)]);
    });
    $('overlap-audit').textContent = `各带计一次的 R₀ = ${p.signalResponse[overlap].toFixed(6)}；实际 R = ${p.denominator[overlap].toFixed(6)}，w² = ${(p.settings.w ** 2).toFixed(4)}。因此此处 ŜW = ${(p.signalResponse[overlap] / denominator).toFixed(6)} S；乘切趾窗后为 ${p.effectiveTransfer[overlap].toFixed(6)} S。`;
    [['融合分子 U', scaled(p.numerator)], ['分母 R', compact(p.denominator[q])], ['正则项 w²', compact(p.settings.w ** 2)], ['Wiener 后 ŜW', scaled(p.preApoSpectrum)], ['切趾窗 Papo', compact(p.apodization[q])], ['最终频谱 Ŝ', scaled(p.spectrum)], ['样品真值 |S|', compact(lesson.audit.truthAmplitude)]].forEach(cells => row($('fusion-audit'), cells));
    $('final-audit').textContent = `幅度保留 ${(lesson.audit.ratio * 100).toFixed(2)}%，相位误差 ${lesson.audit.phaseError.toFixed(4)}°。宽场 RMSE ${lesson.audit.widefieldRMSE.toFixed(4)}；SIM RMSE ${lesson.audit.simRMSE.toFixed(4)}。`;
    $('rmse-audit').textContent = `同一 0—1 强度标尺、未截断数据：宽场 RMSE = ${lesson.audit.widefieldRMSE.toFixed(4)}，SIM RMSE = ${lesson.audit.simRMSE.toFixed(4)}。这些数由图像与真值计算得到，没有用于调参或重建。`;
    $('rmse-transfer-note').textContent = `例如本例直流（q = 0，决定平均亮度）的传递比例约为 ${p.effectiveTransfer[A.idx(0, 0, p.spectrumSize)].toFixed(4)}。所以这里的亮度误差有明确的计算来源；页面没有对输出另做真值拟合或亮度归一化。`;
  }
  const interactiveSelector = 'a,button,input,select,textarea,summary,dialog,[role="button"],[contenteditable="true"]';
  const dialogOpen = () => $('theory').open || $('fourier-lesson').open;
  function navigate(direction) {
    if (dialogOpen()) return;
    player.navigate(direction);
  }
  function openTheory(topic = null) {
    focusBeforeDialog = document.activeElement; player.pause(); $('theory').showModal();
    if (topic) {
      const heading = $(`theory-${topic}`);
      heading.focus({ preventScroll: true }); heading.scrollIntoView({ block: 'start', behavior: 'instant' });
    } else {
      $('theory-close').focus(); $('theory').scrollTop = 0;
    }
  }
  function bind() {
    $('encoding-replay').addEventListener('click', () => {
      if (player.state().playing) return;
      player.seek(2); player.go(3);
    });
    $('chapter-replay').addEventListener('click', () => {
      if (player.state().playing) return;
      const index = Flow.sceneIndex(player.state().position);
      player.seek(index - 1); player.go(index);
    });
    $('demix-mix-replay').addEventListener('click', () => {
      if (player.state().playing) return;
      const index = Flow.index('mixed-sources'); player.seek(index - 1 + .12); player.go(index);
    });
    $('demix-matrix-replay').addEventListener('click', () => {
      if (player.state().playing) return;
      const index = Flow.sceneIndex(player.state().position);
      player.seek(index - 1 + .12); player.go(index);
    });
    $('fourier-open').addEventListener('click', () => {
      if (!fourierLesson) fourierLesson = window.SIMMotionFourier.create({ math, create, attr, arrowPath, pauseMain: () => player.pause(), reduced });
      fourierLesson.open();
    });
    $('progress').max = String(Flow.scenes.length - 1); $('scene-total').textContent = `/ ${Flow.scenes.length}`;
    for (let j = 0; j < 3; j++) $(`excitation-phase-${j}`).addEventListener('click', () => {
      const state = player.state();
      if (state.playing || Math.abs(state.position - 2) > 1e-8 || dialogOpen()) return;
      excitationPhase = j;
      update(state);
    });
    Flow.scenes.forEach((scene, i) => {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.stop = i;
      button.innerHTML = `<span class="stop-number">${String(i + 1).padStart(2, '0')}</span>${scene.label}`;
      button.setAttribute('aria-label', `快速跳转到第 ${i + 1} 步：${scene.label}`);
      button.title = '快速跳转并停在这一步';
      button.addEventListener('click', () => player.jump(i));
      button.addEventListener('focus', () => followStop(i));
      $('scene-stops').appendChild(button); stopButtons.push(button);
    });
    sizeTimeline();
    window.addEventListener('resize', () => { sizeTimeline(); followStop(currentStopIndex); update(player.state()); });
    document.fonts?.ready.then(() => { update(player.state()); });
    // Wheel / trackpad scrolling browses the strip without changing the scene.
    $('timeline-scroll').addEventListener('wheel', event => {
      const strip = $('timeline-scroll');
      if (event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY) || timeline.width <= strip.clientWidth) return;
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? strip.clientWidth : 1;
      strip.scrollTo({ left: M.clamp(strip.scrollLeft + event.deltaY * unit, 0, timeline.width - strip.clientWidth), behavior: 'instant' });
      event.preventDefault();
    }, { passive: false });
    $('edge-prev').addEventListener('click', () => navigate(-1)); $('edge-next').addEventListener('click', () => navigate(1));
    $('progress').addEventListener('input', e => player.seek(Number(e.target.value)));
    // Keep the range stationary under the pointer while dragging. Recenter
    // only on release; otherwise scrolling feeds back into native range input.
    $('progress').addEventListener('pointerdown', () => { scrubbing = true; player.pause(); });
    const finishScrub = () => { if (scrubbing) { scrubbing = false; followStop(currentStopIndex); } };
    document.addEventListener('pointerup', finishScrub);
    document.addEventListener('pointercancel', finishScrub);
    window.addEventListener('blur', finishScrub);
    $('restart').addEventListener('click', () => player.seek(0));
    $('pause').addEventListener('click', () => {
      const state = player.state();
      if (!state.playing && state.position === state.last) player.seek(0); else player.toggle();
    });
    $('speed').addEventListener('click', () => { const speeds = [1, .65, 1.5]; player.setSpeed(speeds[(speeds.indexOf(player.state().speed) + 1) % speeds.length]); });
    document.addEventListener('click', event => {
      if (event.button !== 0 || dialogOpen()) return;
      const direction = M.clickDirection(event.clientX, window.innerWidth, !!event.target.closest(interactiveSelector), !!window.getSelection()?.toString());
      if (direction) navigate(direction);
    });
    document.addEventListener('pointermove', event => {
      const active = !event.target.closest(interactiveSelector) && !dialogOpen();
      $('app').classList.toggle('hover-prev', active && event.clientX < window.innerWidth / 2);
      $('app').classList.toggle('hover-next', active && event.clientX >= window.innerWidth / 2);
    });
    document.documentElement.addEventListener('pointerleave', () => $('app').classList.remove('hover-prev', 'hover-next'));
    document.addEventListener('keydown', event => {
      if (dialogOpen() || event.target.closest(interactiveSelector) || event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
      if (event.key === 'ArrowLeft') { event.preventDefault(); navigate(-1); }
      if (event.key === 'ArrowRight') { event.preventDefault(); navigate(1); }
      if (event.key === ' ') { event.preventDefault(); player.toggle(); }
      if (event.key === 'Home') { event.preventDefault(); player.seek(0); }
      if (event.key === 'End') { event.preventDefault(); player.seek(Flow.scenes.length - 1); }
    });
    $('theory-open').addEventListener('click', () => openTheory());
    $('equation-info').addEventListener('click', () => openTheory(Flow.scenes[currentScene].theoryTopic));
    $('theory-context').addEventListener('click', () => openTheory(Flow.scenes[currentScene].theoryTopic));
    $('theory-close').addEventListener('click', () => $('theory').close());
    $('theory').addEventListener('close', () => focusBeforeDialog?.focus());
    $('theory').addEventListener('click', event => {
      if (event.target !== $('theory')) return;
      const bounds = $('theory').getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) $('theory').close();
    });
    if (!document.fullscreenEnabled) $('fullscreen').hidden = true;
    $('fullscreen').addEventListener('click', async () => {
      try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
      catch { $('playback-status').textContent = '浏览器未允许全屏，可继续在当前窗口操作。'; }
    });
    document.addEventListener('fullscreenchange', () => { $('fullscreen').innerHTML = document.fullscreenElement ? '⛶ <span>退出全屏</span>' : '⛶ <span>全屏</span>'; $('fullscreen').setAttribute('aria-label', document.fullscreenElement ? '退出全屏' : '进入全屏'); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) player.pause(); });
    reduced.addEventListener('change', event => player.setReducedMotion(event.matches));
    window.addEventListener('pagehide', () => { player.destroy(); parameterView.destroy(); parameterFormulaView.destroy(); });
  }
  try {
    Flow = Chapter.plan(M);
    const capture = A.capture({ sample: 'star-points', directions: 3, m: .8, noise: 'none' });
    parameterChapter = Chapter.create({ raw: capture.raw, config: { n: capture.raw.n, cutoff: A.KC }, direction: 0 });
    reconstruction = parameterChapter.reconstructAll();
    lesson = M.createLesson({ capture, pipeline: reconstruction.pipeline });
    buildFrames(); buildSources(); buildDemixMatrix(); buildDemixProof(); buildEncodingAlgebra(); populateTheory();
    parameterView = window.SIMParameterLesson.createView($('parameter-stage'), parameterChapter.lesson,
      { sharedPairContainer: $('frequency-handoff-stage') });
    parameterFormulaView = window.SIMParameterLesson.createFormulaView($('equation'), { lesson:parameterChapter.lesson,formulaAt: s =>
      s.id === 'provisional-split' ? Chapter.provisionalFormulaAt(s) : window.SIMParameterLesson.formulaAt(s),
      formulaMode: s => s.id === 'provisional-split' ? 'provisional-' + Chapter.provisionalState(s.progress).formulaKey : window.SIMParameterLesson.formulaMode(s) });
    bridgeView = window.SIMMotionParameterView.create({ reconstruction, lesson,
      create, attr, opacity, math, formulaBox, spectrumURL, imageURL, maximum, complex, compact, sharedPair: parameterView.sharedPair,
      inverseHandoff: matrixView.inverseHandoff, inverseMatrix: matrixView.backward });
    fullStages = window.SIMMotionStages.create({ lesson, create, attr, opacity, spatialURL, spectrumURL, imageURL, maximum, arrowPath, compact });
    player = M.createPlayer({ render: update, reducedMotion: reduced.matches, durations: Flow.durations, pacing: Flow.pacing }); bind(); player.seek(0);
  } catch (error) {
    $('fatal-error').hidden = false; $('fatal-error').textContent = `动画未能初始化：${error.message}。请保留 HTML 与 web、vendor 文件夹的相对位置，并使用支持 MathML 的现代桌面浏览器。`;
    console.error(error);
  }
})();
