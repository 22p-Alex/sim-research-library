/* Persistent geometry for the two-stage lesson. All animation reads the host
 * playhead; actual scores/complex values come from the observation-only fit. */
(function (root) {
  'use strict';
  const L = root.SIMParameterLesson, M = root.SIMParameterStory, A = root.SIMAtlas;
  const colors = L.bandColors, names = ['P', 'Q', 'R'];
  let instance = 0;
  const num = (x, digits = 3) => (Math.abs(x) < .5 * 10 ** -digits ? 0 : x).toFixed(digits);
  const polar = (r, p) => ({ re: r * Math.cos(p), im: r * Math.sin(p) });
  const multiply = (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
  const magnitude = z => Math.hypot(z.re, z.im);
  const angle = z => Math.atan2(z.im, z.re);
  function renderMath(container, wrapped) {
    const options = { displayMode: true, output: 'mathml', throwOnError: true, strict: 'error' };
    if (root.katex.render) root.katex.render(wrapped.slice(2, -2), container, options);
    else container.innerHTML = root.katex.renderToString(wrapped.slice(2, -2), options);
  }
  function createView(container, lesson, options = {}) {
    const doc = container.ownerDocument || root.document, data = L.dataFor(lesson), e = lesson.estimate, n = lesson.capture.config.n;
    const uid = 'pe-two-' + (++instance), owned = [], range = 27, localUnit = 218 / range, unit = 13, cx = 480, cy = 283;
    const set = (el, key, value) => { if (el.getAttribute(key) !== String(value)) el.setAttribute(key, value); };
    const text = (el, value) => { if (el.textContent !== String(value)) el.textContent = value; };
    const opacity = (el, value) => { set(el, 'opacity', value); set(el, 'aria-hidden', value === 0); };
    const el = (tag, attrs = {}, parent = container, value) => {
      const item = doc.createElementNS('http://www.w3.org/2000/svg', tag);
      for (const [key, val] of Object.entries(attrs)) item.setAttribute(key, val);
      if (value !== undefined) item.textContent = value;
      parent.appendChild(item); if (parent === container) owned.push(item); return item;
    };
    const label = (parent, x, y, value, cls = 'pe-two-text', color) => el('text', { x, y, class: cls, 'text-anchor': 'middle', ...(color ? { style: 'fill:' + color } : {}) }, parent, value);
    const line = (parent, x1, y1, x2, y2, color = '#55737c', extra = {}) => el('line', { x1, y1, x2, y2, stroke: color, 'stroke-width': 1, ...extra }, parent);
    const arrow = (x1, y1, x2, y2) => {
      if (Math.hypot(x2 - x1, y2 - y1) < 1e-9) return `M ${x1} ${y1} L ${x2} ${y2}`;
      const a = Math.atan2(y2 - y1, x2 - x1), h = 7;
      return `M ${x1} ${y1} L ${x2} ${y2} M ${x2 - h * Math.cos(a - .45)} ${y2 - h * Math.sin(a - .45)} L ${x2} ${y2} L ${x2 - h * Math.cos(a + .45)} ${y2 - h * Math.sin(a + .45)}`;
    };
    function vector(path, z, scale, origin = [0, 0]) {
      set(path, 'd', arrow(origin[0], origin[1], origin[0] + z.re * scale, origin[1] - z.im * scale));
      for (const [key, value] of Object.entries({ re: z.re, im: z.im, scale })) set(path, 'data-' + key, value);
    }
    function path(parent, color, attrs = {}) { return el('path', { fill: 'none', stroke: color, 'stroke-width': 2.5, ...attrs }, parent); }
    function raster(width, height, pixel, canvas) {
      const c = canvas || doc.createElement('canvas'); c.width = width; c.height = height;
      const ctx = c.getContext('2d'), image = ctx.createImageData(width, height);
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) image.data.set(pixel(x, y), 4 * (y * width + x));
      ctx.putImageData(image, 0, 0); return c.toDataURL();
    }
    const maximum = e.context.separated.bands.reduce((max, z) => z.re.reduce((m, re, i) => Math.max(m, Math.hypot(re, z.im[i])), max), 1);
    const bandURLs = e.context.separated.bands.map((z, b) => {
      const rgb = [1, 3, 5].map(i => parseInt(colors[b].slice(i, i + 2), 16));
      return raster(range, range, (x, y) => {
        const fx = x - 13, fy = y - 13, i = A.idx(fx, fy, n), h = A.otf(fx, fy, lesson.capture.config.cutoff);
        const v = Math.log1p(Math.hypot(z.re[i], z.im[i])) / Math.log1p(maximum);
        return [...rgb.map(c => Math.round(c * v)), h > 0 ? 220 : 0];
      });
    });
    const defs = el('defs'), otfGradient = el('radialGradient', { id: uid + '-otf' }, defs);
    // A moving spectrum belongs to the fixed q viewport. Clip the pair at
    // their shared parent, before each band's physical −k′ transform.
    const spectrumClip = el('clipPath', { id: uid + '-spectrum-clip', clipPathUnits: 'userSpaceOnUse' }, defs);
    el('rect', { x: 82, y: 136, width: 681, height: 278, 'data-spectrum-viewport': '' }, spectrumClip);
    // Profile samples come from the same OTF, rather than a hard-edged disk.
    for (let i = 0; i <= 20; i++) el('stop', { offset: i / 20, 'stop-color': '#b7a5eb', 'stop-opacity': .28 * A.otf(i / 20 * lesson.capture.config.cutoff, 0, lesson.capture.config.cutoff) }, otfGradient);
    const stage = el('g', { 'data-two-stage': '' }), header = el('g', {}, stage);
    const pills = [label(header, 510, 26, '① 找位置 · 频率坐标', 'pe-two-step'), label(header, 980, 26, '② 求幅相 · 复数值', 'pe-two-step')];
    line(header, 720, 22, 765, 22, '#66828a');
    const cue = label(stage, 720, 66, '', 'pe-two-cue');
    const footer = label(stage, 720, 518, '', 'pe-two-text');
    set(footer, 'data-two-stage-footer', '');
    const sharedRoot = el('g', { 'data-frequency-pair': '', 'data-frequency-range': range, 'data-brightness-maximum': maximum }, options.sharedPairContainer || stage);
    if (options.sharedPairContainer) owned.push(sharedRoot);
    const markers = [];
    // Presentation order is +1, 0. Array order stays 0, +1 throughout the math.
    const pair = [900, 480].map((x, b) => {
      const group = el('g', { 'data-band-panel': b }, sharedRoot), decoration = el('g', {}, group), centerY = 375;
      el('rect', { x: x - 116, y: centerY - 116, width: 232, height: 232, rx: 4, class: 'pe-border' }, decoration);
      line(decoration, x - 109, centerY, x + 109, centerY); line(decoration, x, centerY - 109, x, centerY + 109);
      const heading = label(decoration, x, 239, b ? '临时 +1 级 Ã₊₁(f)' : '临时 0 级 Ã₀(f)', 'pe-two-text', colors[b]);
      const foot = label(decoration, x, 511, '检测频率 f · DFT 格', 'pe-two-small');
      const picture = el('image', { x: x - 109, y: centerY - 109, width: 218, height: 218, href: bandURLs[b], 'data-shared-band': b, style: 'image-rendering:pixelated' }, group);
      const otf = el('g', { 'data-otf-band': b }, group);
      el('circle', { cx: x, cy: centerY, r: lesson.capture.config.cutoff * localUnit, fill: 'url(#' + uid + '-otf)', stroke: colors[b], 'stroke-width': 1.2 }, otf);
      // The intersection is drawn in each detector's own coordinates. When
      // At k'=k these outlines coincide. The dashed contour is only the
      // geometric intersection; the cells below use the estimator's threshold.
      const common = el('path', { 'data-common-region': b, 'data-region-kind': 'geometric',
        fill: 'none', stroke: colors[2], 'stroke-width': 1.5, 'stroke-dasharray': '5 3' }, group);
      const radius = lesson.capture.config.cutoff * localUnit, dx = (b ? 1 : -1) * e.kx * localUnit, dy = (b ? 1 : -1) * e.ky * localUnit;
      const boundary = [];
      for (let ring = 0; ring < 2; ring++) for (let i = 0; i < 360; i++) {
        const theta = i * Math.PI / 180, px = ring * dx + radius * Math.cos(theta), py = ring * dy + radius * Math.sin(theta);
        if (Math.hypot(px - (1 - ring) * dx, py - (1 - ring) * dy) <= radius + 1e-9) boundary.push([px, py]);
      }
      boundary.sort((a, b) => Math.atan2(a[1] - dy / 2, a[0] - dx / 2) - Math.atan2(b[1] - dy / 2, b[0] - dx / 2));
      set(common, 'd', boundary.map(([px, py], i) => (i ? 'L' : 'M') + (x + px) + ' ' + (centerY + py)).join(' ') + ' Z');
      const reliable = el('g', { 'data-shared-reliable-region': b, 'data-threshold': e.context.config.minH,
        'data-count': data.support.reliable.length, fill: colors[2], 'fill-opacity': .24 }, group);
      data.support.reliable.forEach(point => el('rect', {
        x: x + (point.q[0] + (b ? e.kx : 0)) * localUnit - localUnit / 2,
        y: centerY + (point.q[1] + (b ? e.ky : 0)) * localUnit - localUnit / 2,
        width: localUnit - 1, height: localUnit - 1, 'data-shared-reliable-q': point.q.join(','),
      }, reliable));
      const pointLabels = [];
      const points = data.selected.map((p, j) => {
        const g = el('g', { 'data-corresponding-point': j + ':' + b }, group);
        el('circle', { r: 4 + b * 2, fill: 'none', stroke: j ? colors[2] : colors[b], 'stroke-width': 1.5 }, g);
        pointLabels.push(label(g, 12, b && j === 0 ? 20 : -9, names[j], 'pe-two-small', j ? colors[2] : colors[b]));
        markers.push(g); return g;
      });
      return { group, picture, decoration, heading, foot, otf, common, reliable, points, pointLabels, cx: x, cy: centerY, size: 218 };
    });
    const sharedPair = { root: sharedRoot, panels: pair, markers, bandURLs, bands: e.context.separated.bands, range, maximum, provisionalCenters: [720, 360],
      reset() {
        set(sharedRoot, 'transform', '');
        set(sharedRoot, 'clip-path', 'none');
        opacity(sharedRoot, 1);
        pair.forEach(panel => { opacity(panel.decoration, 1); opacity(panel.picture, 1); opacity(panel.otf, 0); opacity(panel.common, 0); opacity(panel.reliable, 0); });
      } };
    const address = label(stage, 720, 151, '', 'pe-two-text');
    const commonCaption = label(stage, 720, 205, '', 'pe-two-small', colors[2]);
    const addressLine = path(stage, colors[1], { 'data-q-address-arrow': '' });
    const addressCursor = el('g', { 'data-q-address-cursor': '' }, stage);
    el('circle', { r: 7, fill: 'none', stroke: colors[1], 'stroke-width': 1.5, 'stroke-dasharray': '3 2' }, addressCursor);
    const cursorLabel = label(addressCursor, 0, -15, '沿 +k 找地址', 'pe-two-small', colors[1]);
    const relocationTrack = path(stage, colors[2], { 'data-q-relocation-track': '', 'stroke-dasharray': '4 3' });
    const relocationLabel = label(stage, 720, 246, '−k′ · 候选位移', 'pe-two-small', colors[2]);
    const residualTrack = path(stage, colors[2], { 'data-q-residual': '', 'stroke-width': 1.5 });
    const residualLabel = label(stage, 1180, 347, '还差 k−k′', 'pe-two-text', colors[2]);
    const residualNote = label(stage, 1180, 377, 'k：真实未知 · k′：候选', 'pe-two-small');
    const qReadout = label(stage, 900, 535, '', 'pe-two-small', colors[0]);
    const frequency = el('g', { 'data-frequency-map': '' }, stage);
    el('rect', { x: 80, y: 116, width: 685, height: 344, rx: 8, class: 'pe-two-panel' }, frequency);
    const axis = el('g', {}, frequency);
    line(axis, 100, cy, 742, cy); line(axis, cx, 135, cx, 436);
    const axisX = label(axis, 729, cy - 10, 'qₓ', 'pe-two-small'), axisY = label(axis, cx + 16, 143, 'qᵧ', 'pe-two-small');
    for (const q of [-20, -10, 0, 10]) { line(axis, cx + q * unit, cy - 4, cx + q * unit, cy + 4); label(axis, cx + q * unit, cy + 19, String(q), 'pe-two-small'); }
    const mapTitle = label(frequency, 420, 105, '样品频率坐标 q · 每格是一个复数', 'pe-two-small');
    const moveArrow = path(frequency, colors[2], { 'data-frequency-displacement': '', 'clip-path': 'url(#' + uid + '-spectrum-clip)' });
    const moveLabel = label(frequency, 390, 429, '', 'pe-two-small', colors[2]);
    const mask = el('g', { 'data-overlap-mask': '' }, frequency);
    const maskCells = e.context.points.map(p => el('rect', { x: cx + p.x * unit - unit / 2, y: cy + p.y * unit - unit / 2, width: unit - 1, height: unit - 1, fill: colors[2], opacity: 0, 'data-q': [p.x, p.y].join(',') }, mask));
    const rejected = el('g', { 'data-rejected-region': '' }, frequency);
    const rejectedCells = data.support.rejected.map((point, i) => {
      const group = el('g', { 'data-rejected-q': point.q.join(','), 'data-h0': point.h0, 'data-h1': point.h1 }, rejected);
      const square = el('rect', { x: -unit / 2, y: -unit / 2, width: unit - 1, height: unit - 1,
        fill: colors[2], 'fill-opacity': .23, stroke: '#e29a90', 'stroke-width': 1 }, group);
      return { group, square, point, rank: i / Math.max(1, data.support.rejected.length - 1) };
    });
    const mapMarkers = data.selected.map((p, i) => {
      const g = el('g', { 'data-reference-point': names[i] }, frequency);
      el('circle', { cx: cx + p.q[0] * unit, cy: cy + p.q[1] * unit, r: 6, fill: '#091115', stroke: colors[2], 'stroke-width': 2 }, g);
      label(g, cx + p.q[0] * unit + 13, cy + p.q[1] * unit - 10, names[i], 'pe-two-text', colors[2]); return g;
    });
    const right = el('g', { 'data-candidate-panel': '' }, stage);
    const kValue = label(right, 1110, 111, '', 'pe-two-value', colors[2]);
    const countValue = label(right, 1110, 146, '', 'pe-two-small');
    const purpose = label(right, 1110, 171, '', 'pe-two-small');
    const scoreValue = label(right, 1110, 460, '', 'pe-two-value', colors[2]);
    const stats = data.selected.map((p, i) => ({
      ratio: label(right, 922 + i * 185, 369, '', 'pe-two-small'),
      phase: label(right, 922 + i * 185, 394, '', 'pe-two-small'),
    }));
    // Point names provide correspondence without crossing the frequency map
    // with connector curves. OTF correction uses magnitudes, not Re–Im arrows.
    const correction = el('g', { 'data-otf-correction': '' }, stage);
    label(correction, 962, 205, '0 级：幅值 ÷ H(q) → |U|', 'pe-two-text', colors[0]);
    label(correction, 1246, 205, '+1 级：幅值 ÷ H(q+k′) → |V|', 'pe-two-text', colors[1]);
    const magnitudeWidth = 128;
    const corrections = data.selected.map((point, i) => {
      const y = 247 + i * 86, g = el('g', { 'data-otf-point': names[i] }, correction);
      label(g, 805, y + 26, names[i], 'pe-two-text', colors[2]);
      const bands = [0, 1].map(b => {
        const x = 832 + b * 284, start = x + 57, tag = names[i] + ':' + b;
        const h = label(g, x + 130, y - 12, '', 'pe-two-bar-operation', colors[b]);
        set(h, 'data-otf-operation', tag);
        const beforeLabel = label(g, x, y + 11, '补偿前', 'pe-two-bar-label');
        const afterLabel = label(g, x, y + 39, '', 'pe-two-bar-label', colors[b]);
        for (const node of [beforeLabel, afterLabel]) set(node, 'text-anchor', 'start');
        for (const dy of [0, 28]) el('rect', { x: start, y: y + dy, width: magnitudeWidth, height: 12, rx: 2, fill: '#20343d' }, g);
        const original = el('rect', { x: start, y, height: 12, rx: 2, fill: '#c0ccd2', 'data-otf-original': tag }, g);
        const bar = el('rect', { x: start, y: y + 28, height: 12, rx: 2, fill: colors[b], 'fill-opacity': .5, 'data-otf-magnitude': tag }, g);
        const restored = el('rect', { y: y + 28, height: 12, fill: colors[b], 'data-otf-restored': tag }, g);
        const reference = line(g, start, y - 2, start, y + 42, '#c0ccd2', { 'stroke-dasharray': '3 3', 'data-otf-original-end': tag });
        const beforeValue = label(g, x + 198, y + 11, '', 'pe-two-bar-value');
        const afterValue = label(g, x + 198, y + 39, '', 'pe-two-bar-value', colors[b]);
        for (const node of [beforeValue, afterValue]) set(node, 'text-anchor', 'start');
        set(beforeValue, 'data-otf-before-value', tag); set(afterValue, 'data-otf-after-value', tag);
        return { h, original, bar, restored, reference, beforeValue, afterValue, afterLabel, start };
      });
      return { point, group: g, bands };
    });
    label(correction, 1100, 482, '灰条固定 · 彩条增长 · 虚线保留原长度 · 亮色段为补回的幅值', 'pe-two-small');
    label(correction, 1100, 501, '两行使用同一标尺（幅值 / N²）；相位和频率位置不变', 'pe-two-small');
    const filterGuide = el('g', { 'data-otf-filter-guide': '' }, stage);
    label(filterGuide, 1110, 245, '① 暖红格：任一边 H 太弱，剔除', 'pe-two-text', '#e29a90');
    label(filterGuide, 1110, 292, '② 橙色格：两边 H ≥ τ，保留', 'pe-two-text', colors[2]);
    label(filterGuide, 1110, 356, '③ 留下的点分别除以 H，得到 U、V', 'pe-two-text');
    label(filterGuide, 1110, 409, '下一步：改变 k′，比较整片公共区', 'pe-two-small');
    function plane(parent, title, tag) {
      const g = el('g', { 'data-complex-plane': tag }, parent);
      el('circle', { r: 58, fill: 'none', stroke: '#36525d', 'stroke-width': 1 }, g);
      line(g, -76, 0, 80, 0); line(g, 0, -76, 0, 76);
      label(g, 83, 15, 'Re', 'pe-two-small'); label(g, 15, -77, 'Im', 'pe-two-small');
      label(g, 0, -97, title, 'pe-two-text', colors[2]);
      const u = path(g, colors[0], { 'data-vector-u': tag }), v = path(g, colors[1], { 'data-vector-v': tag });
      const prediction = path(g, colors[2], { 'data-vector-prediction': tag, 'stroke-dasharray': '5 3' });
      const product = path(g, colors[2], { 'data-vector-product': tag });
      const scaleLabel = label(g, 0, 112, '', 'pe-two-small');
      return { group: g, u, v, prediction, product, scaleLabel };
    }
    const planes = data.selected.map((_, i) => plane(stage, names[i], names[i]));
    const legend = label(stage, 1100, 422, '青： 0 级 U   紫：旁带 V   虚线：同一系数预测', 'pe-two-small');
    const grid = el('g', { 'data-candidate-grid': '' }, stage);
    label(grid, 1110, 200, '整数候选评分 · 0—1 固定色标', 'pe-two-small');
    const width = 2 * e.extent + 1, gridSize = 210, cell = gridSize / width, gx = 1005, gy = 224;
    const heat = score => `rgb(${[19, 38, 46].map((v, i) => Math.round(v + ([239, 184, 121][i] - v) * score)).join(',')})`;
    const gridCells = e.coarse.map(c => el('rect', { x: gx + (c.kx + e.extent) * cell, y: gy + (c.ky + e.extent) * cell, width: cell - .5, height: cell - .5, fill: c.valid ? '#13262e' : '#091115', 'data-score-k': [c.kx, c.ky].join(','), 'data-score': c.score, 'data-valid': c.valid }, grid));
    for (const k of [-e.extent, 0, e.extent]) {
      const x = gx + (k + e.extent + .5) * cell, y = gy + (k + e.extent + .5) * cell;
      label(grid, x, gy + gridSize + 19, String(k), 'pe-two-small');
      const tick = label(grid, gx - 12, y + 4, String(k), 'pe-two-small'); set(tick, 'text-anchor', 'end');
    }
    label(grid, gx + gridSize + 29, gy + gridSize + 19, 'k′ₓ', 'pe-two-small');
    label(grid, gx - 23, gy - 8, 'k′ᵧ', 'pe-two-small');
    const gridCursor = el('rect', { width: cell, height: cell, fill: 'none', stroke: colors[0], 'stroke-width': 2 }, grid);
    const fine = el('g', { 'data-refinement-grid': '' }, stage);
    const fineCells = Array.from({ length: 25 }, (_, i) => el('rect', { x: 1010 + i % 5 * 38, y: 228 + Math.floor(i / 5) * 38, width: 35, height: 35 }, fine));
    const fineTitle = label(fine, 1110, 194, '', 'pe-two-small');
    const fineDetail = label(fine, 1110, 443, '', 'pe-two-small');
    const fineCursor = el('rect', { width: 35, height: 35, fill: 'none', stroke: colors[0], 'stroke-width': 2 }, fine);
    const rampExplanation = el('g', {}, stage);
    ['① 旁带做逆变换', '② 乘空间相位斜坡', '③ 得到小数频移的复数值'].forEach((s, i) => label(rampExplanation, 1110, 235 + i * 54, s, 'pe-two-text', i === 1 ? colors[2] : undefined));
    const miniTitle = label(stage, 205, 163, '样品频率 q · 固定位置', 'pe-two-text');
    const miniCoordinates = data.selected.map((point, i) => label(stage, 205, 347 + i * 25, `${names[i]}：q = (${point.q.join(', ')})`, 'pe-two-small'));
    const locked = label(stage, 205, 448, '', 'pe-two-small', colors[2]);
    const geometryReadout = label(stage, 882, 454, '', 'pe-two-value', colors[2]);
    const geometryReason = label(stage, 882, 130, '', 'pe-two-text', colors[2]);
    const fit = el('g', { 'data-fitting': '' }, stage);
    const accumulator = plane(fit, '全部公共点的复数乘积和', 'sum'); set(accumulator.group, 'transform', 'translate(640 280)');
    const energy = label(fit, 640, 442, '', 'pe-two-text');
    const accumulated = label(fit, 640, 476, '', 'pe-two-small');
    const accumulatingPoint = el('circle', { r: 5, fill: colors[2], 'data-accumulating-point': '' }, stage);
    const accumulatingLink = path(stage, colors[2], { 'stroke-width': 1, 'stroke-dasharray': '3 5' });
    const ratioRoot = el('g', { 'data-ratio-plane': '' }, stage);
    set(ratioRoot, 'transform', 'translate(1130 280)');
    el('circle', { r: 100, fill: 'none', stroke: '#526a71' }, ratioRoot);
    line(ratioRoot, -120, 0, 125, 0); line(ratioRoot, 0, -120, 0, 120);
    label(ratioRoot, 133, 14, 'Re', 'pe-two-small'); label(ratioRoot, 17, -121, 'Im', 'pe-two-small'); label(ratioRoot, 105, -9, '1', 'pe-two-small');
    label(ratioRoot, 0, -147, '共同系数 α̂ · 单位圆', 'pe-two-text');
    const ratioArrow = path(ratioRoot, colors[2], { 'data-study-ratio': '' });
    const phaseArc = path(ratioRoot, colors[1], { 'stroke-width': 1.5 });
    const ratioNumber = label(ratioRoot, 0, 157, '', 'pe-two-text', colors[2]);
    const ratioPhase = label(ratioRoot, 0, 185, '', 'pe-two-small');
    const divideCue = label(stage, 875, 281, '÷ E₀ →', 'pe-two-text', colors[2]);
    const lightCanvas = doc.createElement('canvas');
    const light = el('g', { 'data-illumination-preview': '' }, stage);
    const lightImage = el('image', { x: 486, y: 175, width: 310, height: 220, style: 'image-rendering:pixelated' }, light);
    label(light, 641, 141, '用估计值重画照明 · 同一方向', 'pe-two-text');
    const lightPhase = label(light, 641, 434, '', 'pe-two-text');
    const lightModulation = label(light, 641, 469, '', 'pe-two-text');
    let lastLight = '', lastMask = '';
    const maxInput = Math.max(1e-12, ...data.examples.flatMap(c => c.points.filter(p => data.selected.some(t => t.q.join(',') === p.q.join(','))).flatMap(p => [magnitude(p.x), magnitude(p.y)])));
    const maxAlignedInput = Math.max(1e-12, ...data.selected.flatMap(p => [magnitude(p.x), magnitude(p.y)]));
    const maxProduct = Math.max(1e-12, ...data.selected.map(p => magnitude(p.cross)));
    const lineRoot = el('g', { 'data-line-bridge': '' }), lineView = L.createLineView(lineRoot, lesson);
    function drawScene(id, progress) {
      const s = L.stateForScene(id, progress), p = s.progress, early = s.phase === 'position';
      if (id === 'line-shift') {
        // The actual selected regions remain visible while the teaching row
        // enters. Its numbers are explicitly a separate example.
        drawScene('shared', 1);
        const enter = M.ramp(p, .02, .18);
        opacity(stage, 1 - enter); opacity(sharedRoot, 1 - enter);
        lineView.draw(p, enter);
        set(container, 'data-scene-id', id); set(container, 'data-position', s.position); set(container, 'data-step', s.step);
        return s;
      }
      opacity(stage, 1); lineView.hide();
      const shared = L.sharedState(id === 'shared' ? p : 1);
      const pointMotion = L.sharedPointState(lesson, id === 'shared' ? p : 1);
      const handoff = L.returnTo2DState(p);
      const spatial = id === 'shared' ? 0 : id === 'shift' ? handoff.arrange : 1;
      const relocate = id === 'shared' ? 0 : id === 'shift' ? handoff.relocate : 1;
      const filtering = L.otfState(id === 'otf' ? p : s.step > L.index('otf') ? 1 : 0);
      const reduce = id === 'geometry' ? M.ramp(p, 0, .15) : s.step > L.index('geometry') ? 1 : 0;
      const inputMaximum = maxInput + (maxAlignedInput - maxInput) * reduce;
      const comparisonReveal = M.ramp(relocate, .82, 1);
      // Center the solitary map (x=80, width=685) in the 1440-unit stage.
      // Both spectra share this presentation offset, independently of −k′.
      const centerOffset = id === 'shift' ? (720 - (80 + 685 / 2)) * spatial * (1 - comparisonReveal) : 0;
      const mini = `translate(${25 * reduce + centerOffset} ${140 * reduce}) scale(${1 - .62 * reduce})`;
      set(frequency, 'transform', mini); set(sharedRoot, 'transform', mini);
      set(sharedRoot, 'clip-path', spatial === 1 ? 'url(#' + uid + '-spectrum-clip)' : 'none');
      set(frequency, 'data-presentation-offset-x', centerOffset);
      pills.forEach((pill, i) => { set(pill, 'fill', i === (early ? 0 : 1) ? colors[2] : '#69828a'); set(pill, 'data-active', i === (early ? 0 : 1)); });
      text(cue, L.scene(id).title); text(footer, '');
      set(footer, 'y', id === 'shift' ? 542 : 518);
      let candidate = data.best, committed = [];
      if (id === 'match' || id === 'coarse') { const m = L.matchingState(lesson, id, p); candidate = data.compare(m.candidate.kx, m.candidate.ky); committed = m.committed; }
      let refinement;
      if (id === 'refine') { refinement = L.refinementState(lesson, p); candidate = data.compare(refinement.candidate.kx, refinement.candidate.ky); }
      if (!early) candidate = data.best;
      const key = candidate.kx + ',' + candidate.ky;
      set(container, 'data-scene-id', id); set(container, 'data-position', s.position); set(container, 'data-step', s.step);
      for (const [key, value] of Object.entries({ kx: candidate.kx, ky: candidate.ky, score: candidate.score, count: candidate.count })) set(right, 'data-' + key, value);
      const searching = ['match', 'coarse', 'refine'].includes(id);
      text(kValue, id === 'shift' ? '归位示意 · 条件 k′=k' : id === 'otf' || id === 'match' && p < .12 ? '先做准备：筛选并除以 H'
        : (early ? '候选 k′ = ' : '已锁定 k̂ = ') + '(' + num(candidate.kx, 2) + ', ' + num(candidate.ky, 2) + ')');
      text(countValue, `可靠公共区 ${candidate.count} 点 · 两边 |H| ≥ ${e.context.config.minH}`);
      text(purpose, id === 'otf' ? p < .53 ? '先对照两行原值；随后分别除以 H'
        : p < .69 ? '① 青色 0 级正在补偿；紫色旁带暂不变'
        : p < .73 ? '0 级已补偿完成；接下来处理旁带'
        : p < .89 ? '② 紫色旁带正在补偿；灰条保留原值'
        : '③ U、V 已就绪；上下两行保留前后对照'
        : id === 'match' ? p < .12 ? '保留补偿后的数据，接下来更换候选' : p < .42 ? '先允许共同幅相差，再算预测误差' : p < .72 ? '全部可靠点共同拟合 α̂ = C / Eᵤ' : '相对剩余误差 = 1 − ρ²'
        : id === 'coarse' ? `粗搜：${num(e.context.config.minRadius, 1)} ≤ |k′| ≤ ${num(e.context.config.maxRadius, 1)} · 整数格`
        : id === 'refine' ? '从整数峰出发 · 每轮只搜上一轮峰附近' : '');
      opacity(purpose, ['otf', 'match', 'coarse', 'refine'].includes(id) ? 1 : 0);
      text(scoreValue, `匹配分数 ρ = ${num(candidate.score, 4)}`);
      opacity(address, id === 'shared' ? 1 : 0);
      text(address, p < .18 ? '先固定青色 q：0 级在这里记录 S(q)。旁带要到哪里找？'
        : p < .39 ? '跟着下方的 k：f−k=q → f=q+k，紫色光标沿 +k 找到对应地址。'
        : p < .54 ? '先让两幅图共用检测坐标原点；只是叠放，尚未做频移。'
        : p < .68 ? '青色 q 不动；紫色 +1 级连同 OTF 移动 −k′，两点仍相差 k−k′。'
        : p < .80 ? '当 k′=k：两点重合，(q+k)−k′=q。相同样品信息仍可能有不同幅相。'
        : p < .94 ? '保留这对 q，分开展示两个记录窗口，再框出完整公共区。'
        : '虚线是几何交集；橙色格是两边 OTF 达到阈值的频点，再用 P、Q、R 解释共同匹配。');
      opacity(commonCaption, id === 'shared' ? 1 : 0);
      text(commonCaption, p < .39 ? '这里只解释 k 的几何含义；数值仍待估计。虚线光标只在找地址，频谱没有移动。'
        : p < .54 ? '0 级及 q 的屏幕位置保持固定；把 +1 级的检测原点对到 0 级原点。'
        : p < .80 ? 'k：真实但未知；k′：尝试的位移；k̂：后面搜索得到的估计值。本段只示意对齐条件。'
        : p < .94 ? '此处示意 k′=k。几何交集只要求两边 |H|>0；弱传递点还要筛掉，不能直接用于估计。'
        : `橙色格：两边 |H|≥τ，τ=${e.context.config.minH}。这是 OTF 筛选；还须检查点数、总能量和候选匹配。`);
      const [qX, qY] = pointMotion.q, [sideCenterX, sideCenterY] = pointMotion.centers[1];
      const cursorX = sideCenterX + pointMotion.cursor[0] * localUnit, cursorY = sideCenterY + pointMotion.cursor[1] * localUnit;
      const addressAlpha = id === 'shared' ? M.ramp(p, .16, .18) * (1 - shared.found) : 0;
      opacity(addressLine, addressAlpha); opacity(addressCursor, addressAlpha);
      set(addressLine, 'd', arrow(sideCenterX + qX * localUnit, sideCenterY + qY * localUnit, cursorX, cursorY));
      set(addressLine, 'data-motion-progress', shared.derive);
      set(addressCursor, 'transform', `translate(${cursorX} ${cursorY})`);
      set(addressCursor, 'data-fx', pointMotion.cursor[0]); set(addressCursor, 'data-fy', pointMotion.cursor[1]);
      text(cursorLabel, shared.derive === 1 ? '找到 q+k' : '沿 +k 找地址');
      const start = [900 + pointMotion.detector[1][0] * localUnit, 375 + pointMotion.detector[1][1] * localUnit];
      const relocationAlpha = id === 'shared' ? M.ramp(p, .52, .54) * (1 - M.ramp(p, .77, .80)) : 0;
      set(relocationTrack, 'd', arrow(start[0], start[1], start[0] - e.kx * localUnit * shared.relocate, start[1] - e.ky * localUnit * shared.relocate));
      set(relocationTrack, 'data-motion-progress', shared.relocate); opacity(relocationTrack, relocationAlpha);
      set(relocationTrack, 'data-kprime-x', pointMotion.candidateK[0]); set(relocationTrack, 'data-kprime-y', pointMotion.candidateK[1]);
      set(relocationLabel, 'x', 900 - e.kx * localUnit / 2); opacity(relocationLabel, relocationAlpha);
      const [referencePoint, shiftedPoint] = pointMotion.markerPositions;
      set(residualTrack, 'd', arrow(referencePoint[0], referencePoint[1], shiftedPoint[0], shiftedPoint[1]));
      set(residualTrack, 'data-dx', pointMotion.residual[0]); set(residualTrack, 'data-dy', pointMotion.residual[1]);
      opacity(residualTrack, relocationAlpha * (1 - shared.cancel));
      text(residualLabel, shared.relocate === 1 ? 'k′=k → 残差为零' : '还差 k−k′');
      opacity(residualLabel, relocationAlpha); opacity(residualNote, relocationAlpha);
      text(qReadout, `选定样品频率 q = (${qX}, ${qY}) · 后续记作 P`); opacity(qReadout, id === 'shared' ? shared.pin : 0);
      if (id === 'shift') {
        const intro = 1 - M.ramp(p, .40, .46);
        opacity(address, intro); opacity(commonCaption, intro);
        text(address, '接回原来的两份频谱：一行频率位置 → 二维频率坐标 (qₓ, qᵧ)');
        text(commonCaption, '原来的公共区与 P、Q、R · 每点保留实际复数值 · 逐点比较扩展到整个公共区');
      }
      opacity(frequency, spatial); opacity(sharedRoot, 1);
      const sideDx = -candidate.kx * unit * relocate, sideDy = -candidate.ky * unit * relocate;
      pair.forEach((panel, b) => {
        const scale = 1 + (unit / localUnit - 1) * spatial;
        const targetX = cx + (b ? sideDx : 0), targetY = cy + (b ? sideDy : 0);
        const x = id === 'shared' ? pointMotion.centers[b][0] : panel.cx + (targetX - panel.cx) * spatial;
        const y = id === 'shared' ? pointMotion.centers[b][1] : panel.cy + (targetY - panel.cy) * spatial;
        set(panel.group, 'transform', `translate(${x - panel.cx * scale} ${y - panel.cy * scale}) scale(${scale})`);
        set(panel.group, 'data-center-x', x); set(panel.group, 'data-center-y', y);
        opacity(panel.decoration, id === 'shared' ? 1 - shared.overlap : 1 - spatial);
        opacity(panel.otf, id === 'shared' ? M.ramp(p, .36, .39) : 1);
        opacity(panel.common, id === 'shared' ? Math.max(shared.region * shared.overlap, shared.outline)
          : id === 'shift' ? 1 : id === 'otf' ? 1 - filtering.discard : 0);
        opacity(panel.reliable, id === 'shared' ? shared.reliable : 0);
        opacity(panel.picture, id === 'shared' ? 1 - .42 * shared.overlap : 1 - .58 * spatial);
        text(panel.foot, b ? searching ? '候选地址 f = q + k′' : '对应地址 f = q + k' : '参考地址 f = q');
        panel.points.forEach((g, j) => {
          const q = data.selected[j].q, fx = q[0] + (b ? candidate.kx : 0), fy = q[1] + (b ? candidate.ky : 0);
          set(g, 'transform', `translate(${panel.cx + fx * localUnit} ${panel.cy + fy * localUnit})`);
          set(g, 'data-fx', fx); set(g, 'data-fy', fy);
          opacity(g, (1 - relocate) * (id === 'shared' ? j === 0 ? b ? shared.found : shared.pin : shared.points[j] : 1));
          text(panel.pointLabels[j], id === 'shared' && j === 0 && p < .94 ? b ? p >= .54 && p < .80 ? shared.relocate === 1 ? 'k′=k → q' : 'q+k−k′' : 'q+k' : 'q · 固定' : names[j]);
        });
      });
      set(moveArrow, 'd', arrow(cx, cy - 115, cx + sideDx, cy - 115 + sideDy));
      opacity(moveArrow, id === 'shift' ? M.ramp(relocate, 0, .15) : 1);
      set(moveArrow, 'data-dx', -candidate.kx); set(moveArrow, 'data-dy', -candidate.ky);
      text(moveLabel, id === 'shift' && p < .68 ? '相同 f 仍对应不同来源；两幅图尚未归位' : searching ? '0 级固定 · 旁带与 OTF 同移 −k′ = (' + num(-candidate.kx, 2) + ', ' + num(-candidate.ky, 2) + ')' : '0 级固定 · 旁带与 OTF 同移 −k′ · 示意 k′=k');
      const maskAlpha = id === 'shift' ? M.ramp(relocate, .8, 1) : s.step >= L.index('otf') ? 1 : 0;
      opacity(mask, maskAlpha);
      if (lastMask !== key) {
        const lookup = new Set(candidate.points.map(t => t.q.join(',')));
        maskCells.forEach(c => set(c, 'opacity', lookup.has(c.getAttribute('data-q')) ? .23 : 0)); lastMask = key;
      }
      opacity(rejected, ['shift', 'otf'].includes(id) ? maskAlpha : 0);
      let exiting = 0;
      rejectedCells.forEach(({ group, square, point, rank }) => {
        const leave = id === 'otf' ? L.rejectionProgress(p, rank) : s.step > L.index('otf') ? 1 : 0;
        if (leave < 1) exiting++;
        set(group, 'transform', `translate(${cx + point.q[0] * unit} ${cy + point.q[1] * unit}) scale(${1 - .88 * leave})`);
        opacity(group, 1 - leave); set(group, 'data-exit-progress', leave);
        set(square, 'fill', filtering.warning > 0 ? '#e29a90' : colors[2]);
        set(square, 'fill-opacity', .23 + .3 * filtering.warning); set(square, 'stroke-opacity', filtering.warning);
      });
      set(rejected, 'data-total', data.support.rejected.length); set(rejected, 'data-remaining', exiting);
      if (id === 'shift') text(countValue, `公共区 ${data.support.all.length} 点 · 尚未按 OTF 阈值筛选`);
      if (id === 'otf') text(countValue, `比较集合 ${data.support.reliable.length + exiting} 点 · 阈值 τ = ${lesson.capture.config.minH ?? .15}`);
      mapMarkers.forEach(g => opacity(g, id === 'shift' ? M.ramp(relocate, .82, 1) : s.step >= L.index('otf') ? 1 : 0));
      const detector = id === 'shift' && p < .68;
      text(mapTitle, detector ? '同一检测坐标 f · 来源仍相差 k' : early ? '样品频率坐标 q · 频点位置与复数值分开读' : '同一批公共频点 · 位置锁定');
      text(axisX, detector ? 'fₓ' : 'qₓ'); text(axisY, detector ? 'fᵧ' : 'qᵧ');
      opacity(right, id === 'shift' ? comparisonReveal : ['otf', 'match', 'coarse', 'refine'].includes(id) ? 1 : 0);
      const correctionAlpha = id === 'otf' ? filtering.detail : id === 'match' ? 1 - M.ramp(p, 0, .12) : 0;
      opacity(correction, correctionAlpha);
      opacity(filterGuide, id === 'otf' ? 1 - M.ramp(p, .37, .40) : 0);
      set(correction, 'data-correction-progress', id === 'match' ? 1 : s.correction);
      set(correction, 'data-amplitude-scale', maxAlignedInput / n ** 2);
      corrections.forEach(({ point, bands }) => bands.forEach((item, b) => {
        const h = b ? point.h1 : point.h0, value = b ? point.y : point.x;
        const corrected = filtering.correctionByBand[b];
        const gain = h + (1 - h) * corrected, re = value.re * gain, im = value.im * gain;
        const width = magnitudeWidth * Math.hypot(re, im) / maxAlignedInput;
        set(item.bar, 'width', width);
        set(item.bar, 'data-re', re); set(item.bar, 'data-im', im); set(item.bar, 'data-h', h);
        set(item.bar, 'data-correction-progress', corrected); set(item.bar, 'data-gain', gain / h);
        const originalMagnitude = magnitude(value) * h;
        const originalWidth = magnitudeWidth * originalMagnitude / maxAlignedInput;
        set(item.original, 'width', originalWidth);
        set(item.original, 'data-magnitude', originalMagnitude);
        set(item.bar, 'data-original-magnitude', originalMagnitude);
        set(item.bar, 'data-corrected-magnitude', magnitude(value));
        set(item.restored, 'x', item.start + originalWidth);
        set(item.restored, 'width', Math.max(0, width - originalWidth));
        set(item.reference, 'x1', item.start + originalWidth); set(item.reference, 'x2', item.start + originalWidth);
        text(item.h, '÷ ' + num(h, 3) + ' · 当前 ×' + num(gain / h, 2));
        text(item.afterLabel, corrected === 0 ? '待补偿' : corrected < 1 ? '补偿中' : '补偿后');
        text(item.beforeValue, num(originalMagnitude / n ** 2, 5));
        text(item.afterValue, num(Math.hypot(re, im) / n ** 2, 5));
      }));
      const conjugateView = id === 'conjugate' || id === 'fit' && p < .12;
      const cp = id === 'fit' ? 1 : p, previousAlpha = id === 'fit' ? 1 - M.ramp(p, 0, .12) : 1;
      const showPlanes = ['match', 'geometry', 'conjugate'].includes(id) || id === 'fit' && p < .12;
      const earlyPlanes = id === 'match', planeAlpha = id === 'match' ? M.ramp(p, .12, .23) : previousAlpha;
      opacity(legend, showPlanes ? planeAlpha : 0);
      set(legend, 'x', earlyPlanes ? 1100 : 882); set(legend, 'y', earlyPlanes ? 445 : 419);
      text(legend, conjugateView && cp >= .52 ? '橙：共轭乘积 U*V · 各点留下共同方向' : '青：U · 紫：V · 橙虚线：同一系数的预测值');
      data.selected.forEach((point, i) => {
        const row = candidate.points.find(t => t.q.join(',') === point.q.join(',')), plane = planes[i];
        const x = (922 + i * 185) * (1 - reduce) + (552 + i * 315) * reduce, y = earlyPlanes ? 292 : 279, scale = 1 + .30 * reduce;
        set(plane.group, 'transform', `translate(${x} ${y}) scale(${scale})`);
        opacity(plane.group, showPlanes && row ? planeAlpha : 0);
        if (!row) {
          text(stats[i].ratio, '当前不在可靠公共区'); text(stats[i].phase, '');
          [plane.u, plane.v, plane.prediction, plane.product].forEach(node => { vector(node, { re: 0, im: 0 }, 1); opacity(node, 0); });
          text(plane.scaleLabel, '当前候选不可比较'); return;
        }
        const h0 = row.h0 + (1 - row.h0) * s.correction, h1 = row.h1 + (1 - row.h1) * s.correction;
        let u = { re: row.x.re * h0, im: row.x.im * h0 }, v = { re: row.y.re * h1, im: row.y.im * h1 };
        if (conjugateView) u = polar(magnitude(row.x), angle(row.x) * (1 - 2 * s.conjugation));
        vector(plane.u, u, 58 / inputMaximum); vector(plane.v, v, 58 / inputMaximum);
        const transform = L.transformState(lesson, p);
        const alpha = id === 'geometry' ? polar(transform.m, transform.phase) : candidate.alpha;
        vector(plane.prediction, multiply(row.x, alpha), 58 / inputMaximum);
        const inputAlpha = conjugateView ? 1 - M.ramp(cp, .46, .53) : 1;
        opacity(plane.u, inputAlpha); opacity(plane.v, inputAlpha);
        opacity(plane.prediction, id === 'geometry' ? M.ramp(p, .05, .15) : id === 'match' ? 1 : 0);
        const z = conjugateView ? polar(magnitude(row.cross) * s.product, angle(row.y) - angle(row.x) * s.product) : row.cross;
        vector(plane.product, z, 58 / maxProduct); opacity(plane.product, conjugateView ? M.ramp(cp, .53, .59) : 0);
        text(plane.scaleLabel, conjugateView && cp >= .52 ? '乘积 / N⁴ · 能量标尺' : '值 / N² · 圈半径 ' + num(inputMaximum / n ** 2, 4));
        const ratio = magnitude(row.y) / Math.max(1e-30, magnitude(row.x));
        const delta = Math.atan2(row.cross.im, row.cross.re);
        text(stats[i].ratio, '长度比 ' + num(ratio));
        text(stats[i].phase, '角度差 ' + num(delta) + ' rad');
      });
      stats.forEach(t => {
        set(t.ratio, 'y', 392); set(t.phase, 'y', 416);
        for (const label of Object.values(t)) opacity(label, earlyPlanes ? planeAlpha : 0);
      });
      planes.forEach(plane => opacity(plane.scaleLabel, earlyPlanes ? 0 : 1));
      set(scoreValue, 'y', id === 'match' ? 479 : 489);
      opacity(scoreValue, ['match', 'coarse', 'refine'].includes(id) ? planeAlpha : 0);
      opacity(grid, id === 'coarse' ? 1 : 0);
      if (id === 'coarse') {
        const done = new Set(committed.map(c => c.kx + ',' + c.ky));
        gridCells.forEach((g, i) => { const c = e.coarse[i]; set(g, 'fill', !c.valid ? '#091115' : done.has(c.kx + ',' + c.ky) ? heat(c.score) : '#13262e'); });
        set(gridCursor, 'x', gx + (candidate.kx + e.extent) * cell); set(gridCursor, 'y', gy + (candidate.ky + e.extent) * cell);
      }
      opacity(fine, id === 'refine' && p >= .30 ? 1 : 0); opacity(rampExplanation, id === 'refine' && p < .30 ? 1 : 0);
      if (refinement) {
        const valid = refinement.candidates.filter(c => c.valid), lo = Math.min(...valid.map(c => c.score)), hi = Math.max(...valid.map(c => c.score));
        text(fineTitle, `第 ${refinement.round + 1} 轮 · 半宽 ±${num(2 * refinement.step, 2)} · 间隔 ${refinement.step}`);
        text(fineDetail, `中心 (${num(refinement.center.kx, 2)}, ${num(refinement.center.ky, 2)}) · 色标 ${num(lo, 3)}—${num(hi, 3)}`);
        refinement.candidates.forEach((c, i) => {
          set(fineCells[i], 'fill', c.valid ? heat((c.score - lo) / Math.max(1e-12, hi - lo)) : '#091115');
          set(fineCells[i], 'data-kx', c.kx); set(fineCells[i], 'data-ky', c.ky); set(fineCells[i], 'data-score', c.score);
        });
        const cursor = refinement.candidates.findIndex(c => Math.abs(c.kx - candidate.kx) < 1e-8 && Math.abs(c.ky - candidate.ky) < 1e-8);
        opacity(fineCursor, cursor >= 0 ? 1 : 0);
        if (cursor >= 0) { set(fineCursor, 'x', 1010 + cursor % 5 * 38); set(fineCursor, 'y', 228 + Math.floor(cursor / 5) * 38); }
      }
      opacity(miniTitle, reduce); miniCoordinates.forEach(node => opacity(node, reduce));
      opacity(locked, early ? 0 : 1); text(locked, `k̂ = (${num(e.kx, 2)}, ${num(e.ky, 2)}) · ${data.best.count} 个公共点`);
      opacity(geometryReadout, id === 'geometry' || id === 'conjugate' ? 1 : 0);
      const transform = L.transformState(lesson, p);
      opacity(geometryReason, id === 'geometry' ? reduce : 0);
      text(geometryReason, p < .14 ? '同一 S(q) → V = m·exp(iφΔ) U'
        : p < .59 ? '乘单位模复数：角度加 φΔ，长度不变' : '再乘正实数 m：长度乘 m，角度不变');
      text(geometryReadout, id === 'geometry' ? `${transform.trial ? '试探共同角度' : '拟合共同角度'} ${num(transform.phase)} rad   ·   长度比例 ${num(transform.m)} 倍` : p < .5 ? '取共轭：各点自己的 θj 变为 −θj' : '同一方向 φΔ 留下；长度为 m × 参考能量');
      const fitting = id === 'fit' || id === 'read', f = L.fittingState(id, p, data.best.count), total = data.sums[f.count];
      opacity(fit, id === 'fit' ? M.ramp(p, 0, .12) : 0); opacity(ratioRoot, fitting ? (id === 'fit' ? M.ramp(p, 0, .12) : 1) : 0); opacity(divideCue, id === 'fit' ? f.divide : 0);
      opacity(accumulator.u, 0); opacity(accumulator.v, 0); opacity(accumulator.prediction, 0); opacity(accumulator.product, 1);
      vector(accumulator.product, total, 75 / Math.max(1e-30, magnitude(data.best.cross)));
      text(accumulator.scaleLabel, '复数和 / N⁴ · 累计标尺');
      text(energy, '参考能量 E₀ / N⁴ = ' + num(total.energy / n ** 4, 6));
      text(accumulated, `已累计 ${f.count} / ${data.best.count} 个公共频点`);
      const current = data.best.points[Math.min(f.count, data.best.count - 1)], qx = (cx + current.q[0] * unit) * .38 + 25, qy = (cy + current.q[1] * unit) * .38 + 140;
      set(accumulatingPoint, 'cx', qx); set(accumulatingPoint, 'cy', qy); set(accumulatingPoint, 'data-q', current.q.join(','));
      set(accumulatingLink, 'd', `M ${qx} ${qy} Q 395 162 563 245`);
      const accumulating = id === 'fit' && p >= .12 && f.count < data.best.count ? 1 : 0;
      opacity(accumulatingPoint, accumulating); opacity(accumulatingLink, accumulating);
      set(fit, 'data-count', f.count); set(fit, 'data-sum-re', total.re); set(fit, 'data-sum-im', total.im); set(fit, 'data-energy', total.energy); set(fit, 'data-divide', f.divide);
      vector(ratioArrow, data.best.alpha, 100); opacity(ratioArrow, fitting ? f.divide : 0);
      const arc = polar(42, e.phase), large = Math.abs(e.phase) > Math.PI ? 1 : 0;
      set(phaseArc, 'd', `M 42 0 A 42 42 0 ${large} ${e.phase >= 0 ? 0 : 1} ${arc.re} ${-arc.im}`); opacity(phaseArc, fitting ? f.divide : 0);
      text(ratioNumber, f.divide ? '长度 m̂ = ' + num(e.m) : '累计完成后，再相除');
      text(ratioPhase, f.divide ? '角度 φ̂Δ = ' + num(e.phase) + ' rad' : '分母： 0 级参考能量 E₀');
      opacity(light, id === 'read' ? 1 : 0);
      if (id === 'read') {
        const phase = e.phase * f.phase, modulation = 1 + (e.m - 1) * f.modulation, key = phase + ',' + modulation;
        if (lastLight !== key) {
          set(lightImage, 'href', raster(64, 64, (x, y) => { const v = Math.round(127.5 * (1 + modulation * Math.cos(2 * Math.PI * (e.kx * x + e.ky * y) / 64 + phase))); return [v, v, v, 255]; }, lightCanvas)); lastLight = key;
        }
        set(light, 'data-phase', phase); set(light, 'data-modulation', modulation);
        text(lightPhase, '相位 ' + num(phase) + ' rad · 条纹沿法线平移');
        text(lightModulation, '调制度 ' + num(modulation) + ' · 条纹对比度');
      }
      const footers = {
        shared: '',
        shift: p < .40 ? '二维频率有横纵两个分量；候选写作 k′，真实 k 仍待估计。' : p < .68 ? '面板共用坐标原点后，0 级保持固定；随后用候选 −k′ 搬回旁带。' : '旁带与 OTF 一起移动 −k′；仅在 k′=k 时，同名频点重合。',
        otf: p < .4 ? '先筛选可比较的频点：暖红格退出，橙色格保留；此步还不搜索位移。' : s.correction < 1 ? '上行灰条固定，下行彩条从同一长度开始；逐级演示除以 H，倍数从 1 增至 1/H。' : '已得到 U、V：下一步换不同 k′，寻找能解释整片公共区的位移。',
        match: p < .12 ? '接住上一幕的 U、V，再开始尝试候选位移。' : p < .72 ? '一个候选配一个共同 α；橙色预测越贴近紫色实测，平方误差越小。' : 'ρ 越接近 1，允许共同幅相差后剩下的相对误差越小。',
        coarse: p < .68 ? '先理解分子与归一化；右图填入每个整数候选的实际分数。' : p < .90 ? '全局粗搜可以跨较大范围；行间跳动只是填表顺序，深色格不参与搜索。' : '整数峰给下一步初值；fairSIM 随后只在峰附近 ±2.5 格起步细化。',
        refine: p < .30 ? '空间相位斜坡随像素位置变化 → 小数频移；下一幕的共同相位则处处相同。' : p < .9 ? '本页半宽 0.5→0.1→0.02；fairSIM 半宽 2.5→0.5→0.1，均为频率格。' : '波矢已锁定。接下来从 V=m·exp(iφΔ)U 解释复数值的旋转与伸缩。',
        geometry: p < .59 ? 'exp(iφΔ) 只改变复数值的角度；各点 q 与条纹方向保持固定。' : '共同相位控制条纹位置，调制度控制对比度；在复平面对应角度差与长度比。',
        conjugate: '各点的样品相位被消去，才能把共同的照明相位保留下来。',
        fit: f.divide ? '分子除以 0 级能量 → 一个共同复系数；这也是复数最小二乘解。' : '先对复数乘积求和；全部公共点累计完，才除以参考能量。',
        read: '把 m̂、φ̂j 填回混合矩阵，正式求逆；k̂ 继续用于频带归位。',
      };
      text(footer, footers[id] || ''); opacity(footer, footers[id] ? 1 : 0);
      if (id === 'shift') {
        opacity(stage, handoff.actual); opacity(sharedRoot, handoff.actual);
        lineView.draw(1, handoff.teaching);
        set(container, 'data-return-teaching', handoff.teaching);
        set(container, 'data-return-actual', handoff.actual);
        set(container, 'data-return-relocate', handoff.relocate);
      }
      return s;
    }
    return { drawScene, sharedPair, groups: [stage], data,
      destroy() { lineView.destroy(); owned.forEach(g => g.remove()); if (!options.sharedPairContainer) sharedRoot.remove(); } };
  }
  function createFormulaView(container, options = {}) {
    const doc = container.ownerDocument || root.document, resolve = options.formulaAt || L.formulaAt,
      resolveMode = options.formulaMode || L.formulaMode, cache = new Map();
    let active = '';
    const clear = () => { Array.from(container.children).forEach(c => c.remove()); container.innerHTML = ''; };
    function compile(parent, name, tex) {
      const span = doc.createElement('span'); span.setAttribute('class', 'pe-study-formula-part'); span.setAttribute('data-formula-part', name);
      parent.appendChild(span); renderMath(span, '$$' + tex + '$$'); return span;
    }
    function draw(s) {
      const formula = resolve(s), mode = resolveMode(s);
      if (!cache.has(mode)) {
        const group = doc.createElement('div'); group.setAttribute('class', 'pe-study-formula pe-two-formula');
        const parts = {};
        if (mode === 'shared-derive') {
          group.setAttribute('class', 'pe-two-derivation');
          const row = () => { const r = doc.createElement('div'); r.setAttribute('class', 'pe-two-derivation-row'); group.appendChild(r); return r; };
          const records = row(); records.setAttribute('class', 'pe-two-derivation-row pe-q-records');
          parts.reference = compile(records, 'q-reference', String.raw`\widetilde A_0(\mathbf q)=H(\mathbf q)S(\mathbf q)`); parts.reference.style.color = colors[0];
          const sideSlot = doc.createElement('div'); sideSlot.setAttribute('class', 'pe-q-side-slot'); records.appendChild(sideSlot);
          parts.sideOriginal = compile(sideSlot, 'q-side-original', String.raw`\widetilde A_{+1}(\mathbf f)=m e^{i\phi_\Delta}H(\mathbf f)S(\mathbf f-\mathbf k)`);
          parts.sideAddressed = compile(sideSlot, 'q-side-addressed', String.raw`\widetilde A_{+1}(\mathbf q+\mathbf k)=m e^{i\phi_\Delta}H(\mathbf q+\mathbf k)S(\mathbf q)`);
          parts.sideOriginal.style.color = colors[1]; parts.sideAddressed.style.color = colors[1];
          parts.address = row();
          compile(parts.address, 'detector-f', String.raw`\mathbf f`);
          parts.moveFrom = compile(parts.address, 'k-move-from', String.raw`-\mathbf k`);
          compile(parts.address, 'sample-q', String.raw`=\mathbf q`);
          parts.moveTo = compile(parts.address, 'k-move-to', String.raw`+\mathbf k`);
          parts.substitution = row();
          compile(parts.substitution, 'sample-argument-start', String.raw`(\mathbf q`);
          parts.plusK = compile(parts.substitution, 'k-cancel-plus', String.raw`+\mathbf k`);
          compile(parts.substitution, 'sample-argument-bracket', ')');
          parts.minusK = compile(parts.substitution, 'k-cancel-minus', String.raw`-\mathbf k'`);
          parts.residual = compile(parts.substitution, 'q-residual', String.raw`=\mathbf q+(\mathbf k-\mathbf k')`);
          parts.same = compile(parts.substitution, 'same-sample', String.raw`\xrightarrow{\ \mathbf k'=\mathbf k\ }\mathbf q`);
        } else if (s.id === 'geometry') {
          group.setAttribute('class', 'pe-two-derivation pe-two-geometry');
          const source = doc.createElement('div'); source.setAttribute('class', 'pe-two-geometry-source'); group.appendChild(source);
          renderMath(source, L.formulas.coefficient);
          const operations = doc.createElement('div'); operations.setAttribute('class', 'pe-two-derivation-row'); group.appendChild(operations);
          parts.input = compile(operations, 'input', String.raw`U_j=r_j e^{i\theta_j}`);
          parts.rotation = compile(operations, 'rotation', String.raw`\xrightarrow{\ |e^{i\phi_\Delta}|=1\ }r_j e^{i(\theta_j+\phi_\Delta)}`);
          parts.scaling = compile(operations, 'scaling', String.raw`\xrightarrow{\ m\ge0\ }V_j=m r_j e^{i(\theta_j+\phi_\Delta)}`);
        } else if (s.id === 'conjugate') {
          parts.input = compile(group, 'conjugate-input', String.raw`U_j^*V_j=`);
          parts.conjugate = compile(group, 'conjugate', String.raw`r_j e^{-i\theta_j}`);
          parts.side = compile(group, 'side', String.raw`\,m r_j e^{i(\theta_j+\phi_\Delta)}`);
          parts.product = compile(group, 'product', String.raw`=m r_j^2 e^{i\phi_\Delta}`);
        } else if (s.id === 'fit') {
          const fraction = doc.createElement('div'); fraction.setAttribute('class', 'pe-study-fraction'); group.appendChild(fraction);
          parts.numerator = compile(fraction, 'numerator', String.raw`\sum_{\Omega}U^*V`);
          parts.energy = compile(fraction, 'energy', String.raw`\sum_{\Omega}|U|^2`);
          parts.result = compile(group, 'result', String.raw`=\widehat\alpha=\widehat m e^{i\widehat\phi_\Delta}`);
        } else renderMath(group, formula.equation);
        cache.set(mode, { group, parts });
      }
      const { group, parts } = cache.get(mode);
      if (active !== mode || !Array.from(container.children).includes(group)) { clear(); container.appendChild(group); active = mode; }
      container.setAttribute('data-formula-mode', mode);
      const p = s.progress, f = L.fittingState(s.id, p, 1);
      if (mode === 'shared-derive') {
        const state = L.sharedState(p);
        parts.reference.setAttribute('data-emphasized', p < .18 && state.pin > 0);
        for (const [part, alpha] of [[parts.sideOriginal, 1 - state.found], [parts.sideAddressed, state.found]]) {
          part.style.opacity = String(alpha); part.setAttribute('aria-hidden', alpha === 0);
        }
        parts.address.style.opacity = String(M.ramp(p, .14, .18));
        parts.address.setAttribute('aria-hidden', p <= .14);
        for (const [part, alpha, offset] of [[parts.moveFrom, 1 - state.derive, 3 * state.derive], [parts.moveTo, state.derive, -3 * (1 - state.derive)]]) {
          part.style.opacity = String(alpha); part.style.transform = `translateX(${offset}em)`;
          part.setAttribute('data-motion-progress', state.derive); part.setAttribute('aria-hidden', alpha === 0);
        }
        parts.substitution.style.opacity = String(M.ramp(p, .50, .54));
        parts.substitution.setAttribute('aria-hidden', p <= .50);
        for (const part of [parts.plusK, parts.minusK]) {
          part.style.setProperty('--k-cancel', state.cancel);
          part.style.opacity = String(1 - .75 * state.cancel); part.setAttribute('data-cancel-progress', state.cancel);
        }
        const arrived = M.ramp(p, .68, .70);
        parts.residual.style.opacity = String(1 - arrived); parts.residual.setAttribute('aria-hidden', arrived === 1);
        parts.same.style.opacity = String(arrived); parts.same.setAttribute('aria-hidden', arrived === 0);
        return formula;
      }
      const emphasis = s.id === 'geometry' ? { input: p < .18, rotation: p >= .18 && p < .59, scaling: p >= .59 }
        : s.id === 'conjugate' ? { conjugate: p < .5, side: p >= .5 && p < .7, product: p >= .7 }
        : { numerator: p < .60, energy: p >= .2 && p < .72, result: f.divide > 0, nominal: s.id === 'read' };
      for (const [name, part] of Object.entries(parts)) {
        part.setAttribute('data-emphasized', !!emphasis[name]);
        const reveal = s.id === 'geometry' ? name === 'rotation' ? M.ramp(p, .16, .24) : name === 'scaling' ? M.ramp(p, .57, .65) : 1
          : s.id === 'conjugate' && name === 'product' ? M.ramp(p, .53, .67) : s.id === 'fit' && name === 'result' ? f.divide : 1;
        part.style.opacity = String(reveal); part.setAttribute('aria-hidden', reveal === 0);
      }
      return formula;
    }
    return { draw, reset() { active = ''; }, destroy() { clear(); cache.clear(); } };
  }
  Object.assign(L, { createView, createFormulaView });
})(typeof globalThis !== 'undefined' ? globalThis : this);
