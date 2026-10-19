/* Persistent geometry for the two-stage lesson. All animation reads the host
 * playhead; actual scores/complex values come from the observation-only fit. */
(function (root) {
  'use strict';
  const GetPeak = root.SIMGetPeak;
  const L = root.SIMParameterLesson, M = root.SIMParameterStory, A = root.SIMAtlas;
  const colors = L.bandColors, names = ['P', 'Q', 'R'];
  let instance = 0;
  const num = (x, digits = 3) => (Math.abs(x) < .5 * 10 ** -digits ? 0 : x).toFixed(digits);
  const magnitude = z => Math.hypot(z.re, z.im);
  function renderMath(container, wrapped) {
    const options = { displayMode: true, output: 'mathml', throwOnError: true, strict: 'error' };
    if (root.katex.render) root.katex.render(wrapped.slice(2, -2), container, options);
    else container.innerHTML = root.katex.renderToString(wrapped.slice(2, -2), options);
  }
  function createView(container, lesson, options = {}) {
    const doc = container.ownerDocument || root.document, data = L.dataFor(lesson), e = lesson.estimate, n = lesson.capture.config.n;
    const uid = 'pe-two-' + (++instance), owned = [], range = 27, localUnit = 218 / range, unit = 13, cx = 480, cy = 283;
    const desktop = Object.freeze({
      scan: { x:390, y:280, scale:.86, frame:{x:58,y:44,width:650,height:470},
        clip:{x:70,y:48,width:626,height:464}, readoutX:850,
        kY:130, supportY:164, countY:240, sumY:298, scoreY:356, totalY:414 },
      grid: { x:1050, y:150, size:280 }
    });
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
    // Explanatory prose belongs to the page heading / formula note. Retain
    // these descriptions for the scene unit without drawing another text rail.
    const quiet = node => { set(node,'display','none');set(node,'data-scene-note','');return node; };
    const note = (...args) => quiet(label(...args));
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
        // Encode density with transparency: low-energy samples reveal the
        // stage instead of laying a black pixel grid over the other band.
        // All three bands retain the same logarithmic amplitude scale.
        return [...rgb, h > 0 ? Math.round(220 * v) : 0];
      });
    });
    const defs = el('defs');
    // A moving spectrum belongs to the fixed q viewport. Clip the pair at
    // their shared parent, before each band's physical −k′ transform.
    const spectrumClip = el('clipPath', { id: uid + '-spectrum-clip', clipPathUnits: 'userSpaceOnUse' }, defs);
    const spectrumViewport=el('rect', { x:82,y:136,width:681,height:278,'data-spectrum-viewport':'' },spectrumClip);
    // Profile samples come from the same OTF, rather than a hard-edged disk.
    const otfGradients = colors.slice(0,2).map((color,b) => {
      const gradient=el('radialGradient',{id:uid+'-otf-'+b},defs);
      for(let i=0;i<=20;i++)el('stop',{offset:i/20,'stop-color':color,
        'stop-opacity':.10*A.otf(i/20*lesson.capture.config.cutoff,0,lesson.capture.config.cutoff)},gradient);
      return uid+'-otf-'+b;
    });
    const stage = el('g', { 'data-two-stage': '' }), header = quiet(el('g', { 'data-parameter-navigation': '' }, stage));
    const pills = [label(header, 510, 26, '① 找位置 · 频率坐标', 'pe-two-step'), label(header, 980, 26, '② 求幅相 · 复数值', 'pe-two-step')];
    line(header, 720, 22, 765, 22, '#66828a');
    const cue = note(stage, 720, 66, '', 'pe-two-cue');
    const footer = note(stage, 720, 518, '', 'pe-two-text');
    set(footer, 'data-two-stage-footer', '');
    const sharedRoot = el('g', { 'data-frequency-pair': '', 'data-frequency-range': range, 'data-brightness-maximum': maximum }, options.sharedPairContainer || stage);
    if (options.sharedPairContainer) owned.push(sharedRoot);
    const markers = [];
    // Presentation order is +1, 0. Array order stays 0, +1 throughout the math.
    const pair = [900, 480].map((x, b) => {
      const group = el('g', { 'data-band-panel': b }, sharedRoot), decoration = el('g', {}, group), centerY = 375;
      el('rect', { x: x - 116, y: centerY - 116, width: 232, height: 232, rx: 4, class: 'pe-frequency-card' }, decoration);
      line(decoration, x - 109, centerY, x + 109, centerY); line(decoration, x, centerY - 109, x, centerY + 109);
      const heading = label(decoration, x, 239, b ? '临时 +1 级 Ã₊₁(f)' : '临时 0 级 Ã₀(f)', 'pe-two-text', colors[b]);
      const foot = label(decoration, x, 511, '检测频率 f · DFT 格', 'pe-two-small');
      const picture = el('image', { x: x - 109, y: centerY - 109, width: 218, height: 218, href: bandURLs[b], 'data-shared-band': b, style: 'image-rendering:pixelated' }, group);
      const otf = el('g', { 'data-otf-band': b }, group);
      el('circle', { cx: x, cy: centerY, r: lesson.capture.config.cutoff * localUnit,
        fill: 'url(#' + otfGradients[b] + ')', stroke: colors[b], 'stroke-width': 1.2 }, otf);
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
        set(sharedRoot, 'transform', '');set(sharedPlot,'transform','');set(sharedAnnotations,'transform','');
        set(sharedRoot, 'clip-path', 'none');
        opacity(sharedRoot, 1);
        pair.forEach(panel => { opacity(panel.decoration, 1); opacity(panel.picture, 1); opacity(panel.otf, 0); opacity(panel.common, 0); opacity(panel.reliable, 0); });
      } };
    // Shared annotations and spectra use the same presentation pose, even
    // when the host keeps the spectra in its own persistent handoff layer.
    const sharedAnnotations = el('g', { 'data-shared-annotations': '' }, stage);
    const address = note(sharedAnnotations, 720, 151, '', 'pe-two-text');
    const commonCaption = note(sharedAnnotations, 720, 205, '', 'pe-two-small', colors[2]);
    const addressLine = path(sharedAnnotations, colors[1], { 'data-q-address-arrow': '' });
    const addressCursor = el('g', { 'data-q-address-cursor': '' }, sharedAnnotations);
    el('circle', { r: 7, fill: 'none', stroke: colors[1], 'stroke-width': 1.5, 'stroke-dasharray': '3 2' }, addressCursor);
    const cursorLabel = label(addressCursor, 0, -15, '沿 +k 找地址', 'pe-two-small', colors[1]);
    const relocationTrack = path(sharedAnnotations, colors[2], { 'data-q-relocation-track': '', 'stroke-dasharray': '4 3' });
    const relocationLabel = label(sharedAnnotations, 720, 246, '−k′ · 候选位移', 'pe-two-small', colors[2]);
    const residualTrack = path(sharedAnnotations, colors[2], { 'data-q-residual': '', 'stroke-width': 1.5 });
    const residualLabel = label(sharedAnnotations, 1180, 347, '还差 k−k′', 'pe-two-text', colors[2]);
    const residualNote = note(sharedAnnotations, 1180, 377, 'k：真实未知 · k′：候选', 'pe-two-small');
    const qReadout = note(sharedAnnotations, 900, 535, '', 'pe-two-small', colors[0]);
    const frequency = el('g', { 'data-frequency-map': '' }, stage);
    const frequencyFrame=el('rect',{x:80,y:116,width:685,height:344,rx:10,class:'pe-frequency-surface','data-frequency-frame':''},frequency);
    const axis = el('g', {}, frequency);
    line(axis, 100, cy, 742, cy); line(axis, cx, 135, cx, 436);
    const axisX = label(axis, 729, cy - 10, 'qₓ', 'pe-two-small'), axisY = label(axis, cx + 16, 143, 'qᵧ', 'pe-two-small');
    for (const q of [-20, -10, 0, 10]) { line(axis, cx + q * unit, cy - 4, cx + q * unit, cy + 4); label(axis, cx + q * unit, cy + 19, String(q), 'pe-two-small'); }
    const mapTitle = note(frequency, 420, 105, '样品频率坐标 q · 每格是一个复数', 'pe-two-small');
    const moveArrow = path(frequency, colors[2], { 'data-frequency-displacement': '', 'clip-path': 'url(#' + uid + '-spectrum-clip)' });
    const moveLabel = label(frequency, 390, 429, '', 'pe-two-small', colors[2]);
    set(moveLabel, 'data-wavevector-status', '');
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
    const lockedVector=el('g',{'data-locked-wavevector':''},stage);
    el('circle',{r:4,fill:colors[2]},lockedVector);
    label(lockedVector,0,-16,`已锁定波矢 k̂ = (${num(e.kx,2)}, ${num(e.ky,2)})`,'pe-two-text',colors[2]);
    label(lockedVector,0,21,'DFT 格 · 后续固定使用','pe-two-small');
    function drawLocked(alpha,travel,origin) {
      const end=GetPeak.layout.locked;
      set(lockedVector,'transform',`translate(${origin.x+(end.x-origin.x)*travel} ${origin.y+(end.y-origin.y)*travel})`);
      for(const [key,value] of Object.entries({kx:e.kx,ky:e.ky,transfer:travel}))set(lockedVector,'data-'+key,value);
      opacity(lockedVector,alpha);
    }
    const right = el('g', { 'data-candidate-panel': '' }, stage);
    const kValue = label(right, 1110, 111, '', 'pe-two-value', colors[2]);
    const countValue = label(right, 1110, 146, '', 'pe-two-small');
    const priorReadout=el('g',{'data-readout-outgoing':'shift-to-otf'},right);
    label(priorReadout,1110,111,'归位示意 · 条件 k′=k','pe-two-value',colors[2]);
    label(priorReadout,1110,146,`n = ${data.support.all.length}`,'pe-two-small');
    const purpose = note(right, 1110, 171, '', 'pe-two-small');
    const scoreValue = label(right, 1110, 460, '', 'pe-two-value', colors[2]);
    const stats = data.selected.map((p, i) => ({
      ratio: label(right, 922 + i * 185, 369, '', 'pe-two-small'),
      phase: label(right, 922 + i * 185, 394, '', 'pe-two-small'),
    }));
    // Keep the original rows intact while each receives its own H*.
    // H*H merges to |H|²; only the subsequent normalization cancels that factor.
    const otfCorrection = el('g', { 'data-otf-normalization': '', transform:'translate(70 0)' }, stage);
    note(otfCorrection, 1110, 210, '同一频点 q · 以下省略自变量 · 示意 k′=k', 'pe-two-small');
    function otfTerm(parent, tag, tex, width = 80, color = '#dce8e6') {
      const group = el('g', { 'data-otf-term': tag, 'data-tex': tex }, parent);
      const box = el('foreignObject', { x: -width / 2, y: -28, width, height: 56 }, group);
      const div = doc.createElementNS('http://www.w3.org/1999/xhtml', 'div');
      div.setAttribute('class', 'pe-two-otf-math'); div.style.color = color;
      box.appendChild(div); renderMath(div, '$$' + tex + '$$');
      return group;
    }
    const otfRows = [0, 1].map(b => {
      const y = 270 + b * 118, group = el('g', { 'data-otf-equality': b }, otfCorrection);
      const productHighlight = el('rect', { x: 1069, y: y - 29, width: 155, height: 58, rx: 7,
        fill: colors[b], 'fill-opacity': .06, stroke: colors[b], 'stroke-width': 1,
        'data-otf-product-highlight': b }, group);
      const band = otfTerm(group, 'band:' + b, b ? String.raw`\widetilde A_{+1}` : String.raw`\widetilde A_0`, 125, colors[b]);
      const equals = otfTerm(group, 'equals:' + b, '=', 40);
      const own = otfTerm(group, 'own:' + b, 'H_' + b, 70, colors[b]);
      const sample = otfTerm(group, 'sample:' + b, 'S', 60);
      const alpha = b ? otfTerm(group, 'alpha', String.raw`\alpha`, 70, colors[2]) : null;
      const commonFactor=b?otfTerm(group,'coefficient-factor',String.raw`\left({\color{#efb879}m}e^{i{\color{#b7a5eb}\phi_\Delta}}\right)`,210,colors[2]):null;
      if(commonFactor){set(commonFactor,'data-coefficient-stage-factor','');opacity(commonFactor,0);}
      const conjugate = otfTerm(group, 'conjugate:' + b, 'H_' + b + '^*', 80, colors[b]);
      const lhsConjugate = otfTerm(group, 'lhs-conjugate:' + b, 'H_' + b + '^*', 80, colors[b]);
      const power = otfTerm(group, 'power:' + b, '|H_' + b + '|^2', 110, colors[b]);
      const lhsDenominator = otfTerm(group, 'lhs-denominator:' + b, '|H_' + b + '|^2', 110, colors[b]);
      const rhsDenominator = otfTerm(group, 'rhs-denominator:' + b, '|H_' + b + '|^2', 110, colors[b]);
      const lhsLine = line(group, 785, y + 4, 965, y + 4, colors[b], { 'stroke-width': 1.5, 'data-otf-fraction-line': 'lhs:' + b });
      const rhsLine = line(group, 1093, y + 4, 1213, y + 4, colors[b], { 'stroke-width': 1.5, 'data-otf-fraction-line': 'rhs:' + b });
      const cancel = el('g', { 'data-otf-cancel': b }, group);
      for (const cy of [y - 22, y + 27]) line(cancel, 1113, cy + 7, 1193, cy - 7, colors[2], { 'stroke-width': 2 });
      const one = otfTerm(group, 'one:' + b, '1', 45);
      const name = otfTerm(group, 'name:' + b, b ? 'V' : 'U', 80, colors[b]);
      const reference = b ? otfTerm(group, 'reference', 'U', 80, colors[0]) : null;
      set(own, 'data-otf-original-factor', b);
      for(const node of [conjugate, lhsConjugate])set(node, 'data-otf-conjugate-of', b);
      return { y, group, productHighlight, band, equals, own, sample, alpha, commonFactor, conjugate, lhsConjugate,
        power, lhsDenominator, rhsDenominator, lhsLine, rhsLine, cancel, one, name, reference };
    });
    const operationNote = note(otfCorrection, 1110, 464, '', 'pe-two-text', colors[2]);
    const normalizationNote = note(otfCorrection, 1110, 491, '', 'pe-two-small');
    const recallHeading=label(otfCorrection,1040,111,'回看：共轭与模平方归一','pe-two-value',colors[2]);
    const recallCaption=label(otfCorrection,1040,146,'先乘自身 H*，再除以 |H|²','pe-two-small');
    set(recallHeading,'data-coefficient-recall-heading','');
    set(recallCaption,'data-coefficient-recall-caption','');
    opacity(recallHeading,0);opacity(recallCaption,0);
    const filterGuide = el('g', { 'data-otf-filter-guide': '' }, stage);
    label(filterGuide, 1110, 245, 'H < τ · 剔除', 'pe-two-text', '#e29a90');
    label(filterGuide, 1110, 292, 'H ≥ τ · 保留', 'pe-two-text', colors[2]);
    label(filterGuide, 1110, 356, '× H* / |H|²', 'pe-two-text');
    note(filterGuide, 1110, 409, '下一步：改变 k′，比较整片公共区', 'pe-two-small');
    function plane(parent, title, tag) {
      const g = el('g', { 'data-complex-plane': tag }, parent);
      const frame = el('g', {}, g);
      el('circle', { r: 58, fill: 'none', stroke: '#36525d', 'stroke-width': 1 }, frame);
      line(frame, -76, 0, 80, 0); line(frame, 0, -76, 0, 76);
      label(frame, 83, 15, 'Re', 'pe-two-small'); label(frame, 15, -77, 'Im', 'pe-two-small');
      label(frame, 0, -97, title, 'pe-two-text', colors[2]);
      const u = path(g, colors[0], { 'data-vector-u': tag }), v = path(g, colors[1], { 'data-vector-v': tag });
      const prediction = path(g, colors[2], { 'data-vector-prediction': tag, 'stroke-dasharray': '5 3' });
      const product = path(g, colors[2], { 'data-vector-product': tag });
      const scaleLabel = label(g, 0, 112, '', 'pe-two-small');
      return { group: g, frame, u, v, prediction, product, scaleLabel };
    }
    const planes = data.selected.map((_, i) => plane(stage, names[i], names[i]));
    const legend = note(stage, 1100, 422, '青： 0 级 U   紫：旁带 V   虚线：同一系数预测', 'pe-two-small');
    const grid = el('g', { 'data-candidate-grid': '' }, stage);
    const gridTitle=note(grid, 1110, 200, '整数候选评分 · 0—1 固定色标', 'pe-two-small');
    const width=2*e.extent+1,gridSize=desktop.grid.size,cell=gridSize/width,gx=desktop.grid.x,gy=desktop.grid.y;
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
    // One score grid persists through direct accumulation, cost and FFT.
    const scanPanel=el('g',{'data-direct-scan':'','data-scan-column':'readout'},stage);
    const scanCount=label(scanPanel,desktop.scan.readoutX,desktop.scan.countY,'','pe-two-text pe-scan-count',colors[0]);
    note(scanPanel,862,275,'共轭相乘 → 累计','pe-two-small');
    const scanSum=label(scanPanel,desktop.scan.readoutX,desktop.scan.sumY,'','pe-two-small pe-scan-sum');
    const scanScore=label(scanPanel,desktop.scan.readoutX,desktop.scan.scoreY,'','pe-two-value pe-scan-score');
    const scanTotal=label(scanPanel,desktop.scan.readoutX,desktop.scan.totalY,'','pe-two-small');
    const scanPoint=el('circle',{r:7,fill:'none',stroke:colors[0],'stroke-width':2,'data-scan-point':''},frequency);
    const stamp=label(stage,desktop.scan.readoutX,desktop.scan.scoreY,'','pe-two-value',colors[2]);set(stamp,'data-score-stamp','');
    const costPanel=el('g',{'data-scan-cost':''},stage);
    note(costPanel,450,174,'每换一个候选，都要再扫一次公共区。','pe-two-value');
    for(let b=0;b<2;b++) {
      const g=el('g',{},costPanel),x=205+b*330;
      for(let j=0;j<8;j++)for(let i=0;i<8;i++)el('rect',{x:x+i*14,y:222+j*14,width:11,height:11,fill:colors[b],'fill-opacity':.25},g);
      label(g,x+50,366,b?'每次最多 N² 个频点':'N² 个候选位移','pe-two-text',colors[b]);
    }
    label(costPanel,450,287,'×','pe-two-value');
    label(costPanel,450,415,'二维完整直接扫描：O(N⁴)','pe-two-value');
    note(costPanel,450,447,'每轴格数翻倍，直接乘加量约变为 16 倍','pe-two-small');
    // Fade the old actors themselves; an opaque rectangle leaves a visible
    // dark slab on the stage's dotted / gradient background.
    const fftRoot=el('g',{'data-fft-pipeline':''},stage),fftData=e.fft,fftSize=200,fftCenters=[280,630,980];
    const fieldURL=(z,color,frequencyDomain,side=frequencyDomain?range:n)=>{
      const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
      const max=z.re.reduce((v,re,i)=>Math.max(v,Math.hypot(re,z.im[i])),1e-30);
      return raster(side,side,(x,y)=>{
        const i=frequencyDomain?A.idx(x-Math.floor(side/2),y-Math.floor(side/2),n):y*n+x;
        // The zero-order DC is ~250 times the median supported amplitude.
        // Four log decades expose its real texture without changing any data;
        // exact zeros stay black. Each field has an independent display scale.
        const value=Math.log1p(1e4*Math.hypot(z.re[i],z.im[i])/max)/Math.log1p(1e4);
        return [...rgb.map(c=>Math.round(c*value)),255];
      });
    };
    const fftImageAttrs={x:-fftSize/2,y:-fftSize/2,width:fftSize,height:fftSize,style:'image-rendering:pixelated'};
    const fftPanel=g=>el('rect',{x:-116,y:-116,width:232,height:232,rx:5,class:'pe-two-panel'},g);
    const fftCards=[0,1].map(b=>{
      const g=el('g',{'data-fft-input':b},fftRoot);
      fftPanel(g);
      const spectral=el('image',{...fftImageAttrs,href:fieldURL(fftData.inputs[b],colors[b],true),'data-fft-spectrum':b},g);
      const spatial=el('image',{...fftImageAttrs,href:fieldURL(fftData.spatial[b],colors[b],false),'data-fft-spatial':b},g);
      const title=label(g,0,-144,'','pe-two-text',colors[b]);set(title,'data-fft-input-title',b);
      const step=note(g,0,148,'','pe-two-small');set(step,'data-fft-input-caption',b);
      return {g,spectral,spatial,title,step};
    });
    const fftProduct=el('g',{'data-fft-product':''},fftRoot);
    const productPanel=fftPanel(fftProduct);
    const productClip=el('clipPath',{id:uid+'-product-scan',clipPathUnits:'userSpaceOnUse'},defs);
    const productPrefix=el('path',{'data-fft-product-prefix':''},productClip);
    const productImage=el('image',{...fftImageAttrs,href:fieldURL(fftData.product,colors[2],false),
      'clip-path':'url(#'+uid+'-product-scan)','data-fft-product-image':''},fftProduct);
    const correlationImage=el('image',{...fftImageAttrs,href:fieldURL(fftData.correlation,colors[2],true,width),'data-fft-correlation-image':''},fftProduct);
    const resultScores=el('g',{'data-fft-result-scores':''},fftProduct);
    e.coarse.forEach(c=>el('rect',{x:-100+(c.kx+e.extent)*fftSize/width,y:-100+(c.ky+e.extent)*fftSize/width,
      width:(cell-.5)*fftSize/gridSize,height:(cell-.5)*fftSize/gridSize,
      fill:c.valid?heat(c.score):'#091115','data-fft-score-k':[c.kx,c.ky].join(',')},resultScores));
    const productTitle=label(fftProduct,0,-144,'','pe-two-text',colors[2]);
    const productCaption=note(fftProduct,0,148,'','pe-two-small');
    const fftOperators=[label(fftRoot,(fftCenters[0]+fftCenters[1])/2,307,'×','pe-two-value'),label(fftRoot,(fftCenters[1]+fftCenters[2])/2,307,'=','pe-two-value')];
    const fftCursors=[...fftCards.map(card=>card.g),fftProduct].map((parent,b)=>{
      const row=el('rect',{x:-100,width:fftSize,height:fftSize/n,fill:colors[b],'fill-opacity':.18,'data-fft-scan-row':b},parent);
      const point=el('circle',{r:5,fill:colors[b],'fill-opacity':.3,stroke:colors[b],'stroke-width':2,'data-fft-pixel-cursor':b},parent);
      return {row,point};
    });
    const fftInfo=note(fftRoot,720,122,'','pe-two-text');
    note(fftRoot,720,485,'各图独立对数色阶 · 仅显示模长，计算保留完整复数值','pe-two-small');
    const fftPeak=el('rect',{x:0,y:0,width:cell+6,height:cell+6,fill:'none',stroke:colors[2],'stroke-width':2,'data-fft-peak':''},grid);
    const refineView=L.createRefinementView({parent:stage,defs,lesson,el,label,line,path,arrow,raster,fieldURL,set,text,opacity,heat,uid});
    let lastMask = '';
    const maxInput = Math.max(1e-12, ...data.examples.flatMap(c => c.points.filter(p => data.selected.some(t => t.q.join(',') === p.q.join(','))).flatMap(p => [magnitude(p.x), magnitude(p.y)])));
    const frequencyPlot=el('g',{'data-frequency-plot':''},frequency);
    for(const child of Array.from(frequency.children))if(child!==frequencyFrame&&child!==frequencyPlot){child.remove();frequencyPlot.appendChild(child);}
    const sharedPlot=el('g',{'data-spectrum-plot':''},sharedRoot);
    pair.forEach(panel=>{panel.group.remove();sharedPlot.appendChild(panel.group);});
    const chrome = new Set([header, cue, footer, lockedVector, sharedRoot]);
    const legacyBody = el('g', { 'data-scene-body': 'position-search' }, stage);
    for (const child of Array.from(stage.children)) if (child !== legacyBody && !chrome.has(child)) {
      child.remove(); legacyBody.appendChild(child);
    }
    const viewOptions={parent:stage,lesson,el,label,line,path,vector,set,text,opacity,raster,defs,uid};
    let fitView;
    const coefficientView=root.SIMCoefficientMainline.createView(viewOptions);
    const lineRoot = el('g', { 'data-line-bridge': '' }), lineView = L.createLineView(lineRoot, lesson);
    function drawScene(id, progress) {
      coefficientView.draw(null);
      if(id==='coefficient'){
        // returnSpectrum at local .694 has already restored this exact spectrum
        // pose. Keep its original nodes, axes and opacity throughout the recap.
        drawLegacyScene('refine',1);fitView?.draw(null);
        const peak=root.SIMCoefficientMainline.state(lesson,progress),s=L.stateForScene(id,progress);
        opacity(legacyBody,peak.overview);opacity(sharedRoot,peak.overview);opacity(lockedVector,peak.overview);
        // refine already prepares the completed OTF row poses. Only their
        // right-side group fades in; the spectrum does not switch to otf(1).
        opacity(otfCorrection,peak.recall);opacity(recallHeading,1);opacity(recallCaption,1);
        const local=peak.mode==='correspondence'?peak.local:1,motion=root.SIMCoefficientMainline.correspondenceMotion(local);
        const side=otfRows[1],offset=140*motion.growth;
        set(otfCorrection,'data-correspondence-substep',peak.substep);
        set(otfCorrection,'data-coefficient-expansion',motion.growth);
        set(otfCorrection,'aria-label',motion.final?'V = (m e^{iφΔ}) U':motion.substitute===1?'V = α U':motion.growth===1?'V = (m e^{iφΔ}) S':'V = α S');
        opacity(side.alpha,motion.alpha);set(side.alpha,'transform',`translate(1040 ${side.y-12*(1-motion.alpha)}) scale(1)`);
        opacity(side.commonFactor,motion.factor);
        set(side.commonFactor,'transform',`translate(${1040+offset/2} ${side.y+12*(1-motion.factor)}) scale(1)`);
        opacity(side.group,peak.mode==='correspondence'?1:0);
        const rhsX=1153+offset;
        opacity(side.sample,1-motion.substitute);set(side.sample,'transform',`translate(${rhsX} ${side.y}) scale(1)`);
        opacity(side.reference,motion.substitute);set(side.reference,'transform',`translate(${rhsX} ${side.y}) scale(1)`);
        coefficientView.draw(progress,{entry:{V:side.name,eq:side.equals,factor:side.commonFactor,U:side.reference}});
        set(container,'data-scene-id',id);set(container,'data-position',s.position);set(container,'data-step',s.step);return s;
      }
      if (id !== GetPeak.scene.legacyId) {
        opacity(legacyBody, 1); fitView?.draw(null);
        return drawLegacyScene(id, progress);
      }
      fitView ||= GetPeak.createView(viewOptions);
      // Reconstruct the declared entry from any seek direction. A single
      // owned group exits; this scene never enumerates another scene's actors.
      drawLegacyScene(GetPeak.entry.from, 1);
      const peak = fitView.draw(progress), state = L.stateForScene(id, progress);
      opacity(legacyBody, peak.overview);
      // Keep the original spectra alive while their detector axes unfold.
      // Only the final prepared rasters replace them, at the same coordinates.
      const c=peak.cues,pose=GetPeak.layout.pair;
      opacity(sharedRoot,1-c.workSpectra);
      if(c.nativeLayout>0) {
        set(sharedRoot,'clip-path','none');
        pair.forEach((panel,b)=>{
          const startX=cx-(b?e.kx*unit:0),startY=cy-(b?e.ky*unit:0);
          const x=startX+(pose.x[b]-startX)*c.nativeLayout,y=startY+(pose.y-startY)*c.nativeLayout;
          const scale=unit/localUnit+(pose.size/panel.size-unit/localUnit)*c.nativeLayout;
          set(panel.group,'transform',`translate(${x-panel.cx*scale} ${y-panel.cy*scale}) scale(${scale})`);
          set(panel.group,'data-center-x',x);set(panel.group,'data-center-y',y);
          opacity(panel.decoration,c.nativeLayout);opacity(panel.picture,.42+.58*c.nativeLayout);
          // The dedicated address/OTF/value rails below own these labels now.
          opacity(panel.foot,0);
          text(panel.foot,b?'检测地址 f₁ = q + k̂':'检测地址 f₀ = q');
        });
      }
      opacity(lockedVector,peak.lockedAlpha);
      pills.forEach((pill, i) => set(pill, 'data-active', i === 1));
      text(cue, peak.cue); text(footer, peak.footer);
      opacity(cue, peak.chromeAlpha); opacity(footer, peak.chromeAlpha);
      set(container, 'data-scene-id', id); set(container, 'data-position', state.position); set(container, 'data-step', state.step);
      return state;
    }
    function drawLegacyScene(id, progress) {
      const s = L.stateForScene(id, progress), p = s.progress, early = s.phase === 'position';
      opacity(recallHeading,0);opacity(recallCaption,0);
      for(const attribute of ['aria-label','data-correspondence-substep','data-coefficient-expansion'])otfCorrection.removeAttribute(attribute);
      refineView.draw(null);
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
      opacity(stage, 1); opacity(lockedVector,0); lineView.hide();
      const shared = L.sharedState(id === 'shared' ? p : 1);
      const pointMotion = L.sharedPointState(lesson, id === 'shared' ? p : 1);
      const handoff = L.returnTo2DState(p);
      const spatial = id === 'shared' ? 0 : id === 'shift' ? handoff.arrange : 1;
      const relocate = id === 'shared' ? 0 : id === 'shift' ? handoff.relocate : 1;
      const filtering = L.otfState(id === 'otf' ? p : s.step > L.index('otf') ? 1 : 0);
      const reduce = 0;
      const inputMaximum = maxInput;
      const comparisonReveal = M.ramp(relocate, .82, 1);
      // Center the solitary map (x=80, width=685) in the 1440-unit stage.
      // Both spectra share this presentation offset, independently of −k′.
      const centerOffset = id === 'shift' ? (720 - (80 + 685 / 2)) * spatial * (1 - comparisonReveal) : 0;
      const mini = `translate(${15 * reduce + centerOffset} ${60 * reduce}) scale(${1 - .32 * reduce})`;
      const focus = L.sharedFocusPose(id === 'shared' ? 1 : id === 'shift' ? 1 - spatial : 0);
      set(frequency, 'transform', mini);
      set(sharedRoot, 'transform', `translate(${focus.x + centerOffset} ${focus.y}) scale(${focus.scale})`);
      set(sharedAnnotations, 'transform', focus.transform);
      opacity(sharedAnnotations, id === 'shared' ? 1 : 0);
      set(sharedRoot, 'clip-path', spatial === 1 ? 'url(#' + uid + '-spectrum-clip)' : 'none');
      set(frequency, 'data-presentation-offset-x', centerOffset);
      const spread=id==='match'?M.ramp(p,0,.12):0;
      const scanScale=1+(desktop.scan.scale-1)*spread;
      const scanX=(desktop.scan.x-cx*desktop.scan.scale)*spread;
      const scanY=(desktop.scan.y-cy*desktop.scan.scale)*spread;
      const scanPose=`translate(${scanX} ${scanY}) scale(${scanScale})`;
      set(frequencyPlot,'transform',scanPose);set(sharedPlot,'transform',scanPose);
      set(frequency,'data-scan-spread',spread);
      for(const [key,value] of Object.entries({x:80,y:116,width:685,height:344}))set(frequencyFrame,key,value+(desktop.scan.frame[key]-value)*spread);
      for(const [key,value] of Object.entries({x:82,y:136,width:681,height:278}))set(spectrumViewport,key,value+(desktop.scan.clip[key]-value)*spread);
      set(moveArrow,'clip-path',spread>0?'none':'url(#'+uid+'-spectrum-clip)');
      set(moveLabel,'x',390+(cx-390)*spread);set(moveLabel,'y',429+(520-429)*spread);
      set(kValue,'x',1110+(desktop.scan.readoutX-1110)*spread);
      set(kValue,'y',111+(desktop.scan.kY-111)*spread);
      set(countValue,'x',1110+(desktop.scan.readoutX-1110)*spread);
      set(countValue,'y',146+(desktop.scan.supportY-146)*spread);

      pills.forEach((pill, i) => { set(pill, 'fill', i === (early ? 0 : 1) ? colors[2] : '#69828a'); set(pill, 'data-active', i === (early ? 0 : 1)); });
      text(cue, L.scene(id).title); text(footer, '');
      set(footer, 'y', id === 'shift' ? 542 : id === 'otf' ? 542 - 24 * M.ramp(p, 0, .12) : 518);
      let candidate = data.best, committed = [];
      if (id === 'match' || id === 'coarse') { const m = L.matchingState(lesson, id, p); candidate = data.compare(m.candidate.kx, m.candidate.ky); committed = m.committed; }
      let refinement;
      if (id === 'refine') { refinement = L.refinementState(lesson, p); candidate = data.compare(refinement.candidate.kx, refinement.candidate.ky); }
      if (!early) candidate = data.best;
      const key = candidate.kx + ',' + candidate.ky;
      set(container, 'data-scene-id', id); set(container, 'data-position', s.position); set(container, 'data-step', s.step);
      set(container,'data-refine-return',refinement?refinement.returnView.overview:0);
      for (const [key, value] of Object.entries({ kx: candidate.kx, ky: candidate.ky, score: candidate.score, count: candidate.count })) set(right, 'data-' + key, value);
      const searching = ['match', 'coarse', 'refine'].includes(id);
      text(kValue, id === 'shift' ? '归位示意 · 条件 k′=k' : id === 'otf' || id === 'match' && p < .12 ? '先做准备：共轭与模平方归一'
        : (early ? '候选 k′ = ' : '已锁定 k̂ = ') + '(' + num(candidate.kx, 2) + ', ' + num(candidate.ky, 2) + ')');
      text(countValue, `n = ${candidate.count} · τ = ${e.context.config.minH}`);
      const intro=root.SIMTextTransition.state(p,L.scene('otf').duration,0,options.reducedMotion?.()||false);
      opacity(priorReadout,id==='otf'?intro.outgoing:0);
      set(priorReadout,'transform',`translate(0 ${id==='otf'?intro.outgoingY:0})`);
      for(const node of [kValue,countValue]) {
        opacity(node,id==='otf'?intro.incoming:1);
        set(node,'transform',`translate(0 ${id==='otf'?intro.incomingY:0})`);
      }
      text(purpose, id === 'otf' ? p < .4 ? '先筛掉任一边 H 太弱的频点'
        : p < .48 ? '上行用 H₀，下行用 H₁；各自校正'
        : p < .60 ? '① 等式两边乘上自身 H 的共轭'
        : p < .70 ? 'H*H = |H|²；还未完成幅度校正'
        : p < .79 ? '② 等式两边再除以相同的 |H|²'
        : p < .87 ? '分子分母约去，右侧留下样品信息'
        : '两步完成后记作 U、V，接着比较候选'
        : id === 'match' ? p < .12 ? '接住校正后的 U、V，随后尝试候选' : p < .42 ? '逐点乘加，累计一个候选' : p < .82 ? '继续填入每个候选的分数' : '每换候选，都要重复一轮'
        : id === 'coarse' ? `粗搜：${num(e.context.config.minRadius, 1)} ≤ |k′| ≤ ${num(e.context.config.maxRadius, 1)} · 整数格`
        : id === 'refine' ? '从整数峰出发 · 每轮只搜上一轮峰附近' : '');
      opacity(purpose, ['otf', 'refine'].includes(id) ? 1 : 0);
      text(scoreValue, `ρ = ${num(candidate.score, 4)}`);
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
        opacity(panel.foot,1);
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
      const positionLocked=s.phase==='coefficient'||refinement?.returnView.overview>0;
      set(moveLabel, 'data-locked', !!positionLocked);
      text(moveLabel, id === 'shift' && p < .68 ? '检测坐标 f'
        :positionLocked?'−k̂ · 位置锁定'
        : searching ? '−k′ = (' + num(-candidate.kx, 2) + ', ' + num(-candidate.ky, 2) + ')' : '−k′ · k′=k');
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
      if (id === 'shift') text(countValue, `n = ${data.support.all.length}`);
      if (id === 'otf') text(countValue, `n = ${data.support.reliable.length + exiting} · τ = ${lesson.capture.config.minH ?? .15}`);
      mapMarkers.forEach(g => opacity(g, id === 'shift' ? M.ramp(relocate,.82,1) : id==='otf' ? 1 : 0));
      const detector = id === 'shift' && p < .68;
      text(mapTitle, detector ? '同一检测坐标 f · 来源仍相差 k' : early ? '样品频率坐标 q · 频点位置与复数值分开读' : '同一批公共频点 · 位置锁定');
      text(axisX, detector ? 'fₓ' : 'qₓ'); text(axisY, detector ? 'fᵧ' : 'qᵧ');
      opacity(right, id === 'shift' ? comparisonReveal : ['otf', 'match', 'coarse', 'refine'].includes(id) ? 1 : 0);
      const correctionAlpha = id === 'otf' ? filtering.detail : id === 'match' ? 1 - M.ramp(p, 0, .12) : 0;
      opacity(otfCorrection, correctionAlpha);
      opacity(filterGuide, id === 'otf' ? M.ramp(p,.018,.04)*(1 - M.ramp(p, .37, .40)) : 0);
      for (const key of ['multiply', 'power', 'divide', 'cancel', 'name', 'relation'])
        set(otfCorrection, 'data-' + key + '-progress', filtering[key]);
      const place = (node, x, y, scale = 1) => set(node, 'transform', `translate(${x} ${y}) scale(${scale})`);
      otfRows.forEach((row, b) => {
        opacity(row.group,1);
        const { multiply: travel, power, divide, cancel, name, relation } = filtering;
        const lift = 22 * divide, cancelled = M.ramp(cancel, .35, 1);
        if(row.commonFactor){opacity(row.commonFactor,0);place(row.commonFactor,0,0);}
        place(row.band, 895 + 15 * name, row.y - lift * (1 - name), 1 - .15 * name);
        opacity(row.band, 1 - name); place(row.equals, 995, row.y);
        // The RHS conjugate comes from this row's H and stays in this row.
        place(row.own, 1185 - 32 * power, row.y - lift); opacity(row.own, 1 - power);
        place(row.conjugate, 1185 - 75 * travel + 43 * power,
          row.y - 32 * Math.sin(Math.PI * travel) - lift);
        opacity(row.conjugate, M.ramp(travel, 0, .15) * (1 - power));
        place(row.lhsConjugate, 1185 - 375 * travel + 100 * name,
          row.y - 44 * Math.sin(Math.PI * travel) - lift * (1 - name), 1 - .15 * name);
        opacity(row.lhsConjugate, M.ramp(travel, 0, .15) * (1 - name));
        place(row.power, 1153, row.y - lift); opacity(row.power, power * (1 - cancelled));
        place(row.lhsDenominator, 875 + 35 * name, row.y + 27 * (1 - name));
        opacity(row.lhsDenominator, divide * (1 - name)); opacity(row.lhsLine, divide * (1 - name));
        place(row.rhsDenominator, 1153, row.y + 27);
        opacity(row.rhsDenominator, divide * (1 - cancelled)); opacity(row.rhsLine, divide * (1 - cancelled));
        opacity(row.cancel, Math.sin(Math.PI * cancel));
        set(row.cancel, 'data-cancel-progress', cancel);
        place(row.one, 1153, row.y); opacity(row.one, cancelled * (1 - name));
        place(row.sample, 1270 - 117 * name, row.y); opacity(row.sample, b ? 1 - relation : 1);
        place(row.name, 910, row.y); opacity(row.name, name);
        place(row.productHighlight, 0, -lift); opacity(row.productHighlight, power * (1 - divide));
        if (row.alpha) {
          place(row.alpha, 1040, row.y); opacity(row.alpha, 1);
          place(row.reference, 1153, row.y); opacity(row.reference, relation);
        }
      });
      text(operationNote, filtering.name > 0 ? '正确对齐后：U=S，V=αS=αU'
        : filtering.divide > 0 ? '再除以 |H|²，才完成自身 OTF 的校正'
        : '只乘 H*，仍留有 |H|²');
      opacity(operationNote, M.ramp(filtering.multiply, .85, 1));
      text(normalizationNote, filtering.name > 0 ? '相同 q 的 U 固定；V 与可靠公共区随候选 k′ 改变'
        : '两步合起来等价于除以 H；只处理已筛选的可靠点');
      const earlyPlanes = id === 'match', planeAlpha = id === 'match' ? M.ramp(p, .12, .23) : 1;
      opacity(legend, 0); set(legend, 'x', 1100); set(legend, 'y', 422);
      data.selected.forEach((point, i) => {
        const row = candidate.points.find(t => t.q.join(',') === point.q.join(',')), plane = planes[i];
        set(plane.group, 'transform', `translate(${922 + i * 185} 279) scale(1)`);
        opacity(plane.group, 0); opacity(plane.frame, 1);
        if (!row) {
          [plane.u, plane.v, plane.prediction, plane.product].forEach(node => { vector(node, { re: 0, im: 0 }, 1); opacity(node, 0); });
          text(plane.scaleLabel, '当前候选不可比较'); return;
        }
        const u = s.correction === 1 ? row.x : s.otfMultiply === 1 ? row.weightedX : row.rawX;
        const v = s.correction === 1 ? row.y : s.otfMultiply === 1 ? row.weightedY : row.rawY;
        vector(plane.u, u, 58 / inputMaximum); vector(plane.v, v, 58 / inputMaximum);
        vector(plane.prediction, { re: 0, im: 0 }, 1); vector(plane.product, { re: 0, im: 0 }, 1);
        opacity(plane.u, 1); opacity(plane.v, 1); opacity(plane.prediction, 0); opacity(plane.product, 0);
        text(plane.scaleLabel, '值 / N² · 圈半径 ' + num(inputMaximum / n ** 2, 4));
      });
      stats.forEach(t => {
        set(t.ratio, 'y', 392); set(t.phase, 'y', 416);
        for (const label of Object.values(t)) opacity(label, 0);
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
      const footers = {
        shared: '',
        shift: p < .40 ? '二维频率有横纵两个分量；候选写作 k′，真实 k 仍待估计。' : p < .68 ? '面板共用坐标原点后，0 级保持固定；随后用候选 −k′ 搬回旁带。' : '旁带与 OTF 一起移动 −k′；仅在 k′=k 时，同名频点重合。',
        otf: p < .4 ? '先筛选可比较的频点：暖红格退出，橙色格保留；此步还不搜索位移。' : filtering.cancel < 1 ? '乘自身 H* → 保留 |H|² → 再除以 |H|²；两步齐全才等价于除以 H。' : '已得到 U、V：下一步换不同 k′，寻找能解释整片公共区的位移。',
        match: p < .12 ? '接住上一幕的 U、V，再开始尝试候选位移。' : p < .72 ? '公共区逐点共轭相乘、累计；算完后把分数送到对应的 k′ 格。' : '完整二维扫描要重复 N² 遍乘加；能否一次算出所有位移？',
        coarse: L.formulaAt(L.stateForScene('coarse',p)).note,
        refine: p < .30 ? '空间相位斜坡随像素位置变化 → 小数频移；下一幕的共同相位则处处相同。' : p < .9 ? '本页半宽 0.5→0.1→0.02；fairSIM 半宽 2.5→0.5→0.1，均为频率格。' : '波矢已锁定。接下来从 V=m·exp(iφΔ)U 解释复数值的旋转与伸缩。',
        'least-squares-fit': L.leastSquaresNarrative(p).note,

      };
      text(footer, footers[id] || ''); opacity(footer, footers[id] ? 1 : 0);
      const scanning=id==='match',fftScene=id==='coarse',fft=L.fftState(fftScene?p:0);
      const scan=L.scanState(lesson,scanning?p:1),scanVisible=scanning?M.ramp(p,.12,.18)*(1-scan.cost):0;
      const costVisible=scanning?scan.cost:fftScene?1-fft.dim:0;
      opacity(scanPanel,scanVisible);opacity(costPanel,costVisible);opacity(fftRoot,fftScene?fft.gather:0);
      // Retain the completed direct-scan cost first, then move it out before
      // the fixed spectra enter. Both motions use this scene's reversible clock.
      set(costPanel,'transform',`translate(${-64*fft.dim} ${-12*fft.dim})`);
      opacity(scanPoint,scanVisible*(scan.count>0&&scan.count<scan.candidate.count?1:0));
      opacity(stamp,scanVisible*(scan.transfer>0&&!scan.done?Math.sin(Math.PI*scan.transfer):0));
      set(scanPanel,'data-count',scan.count);set(scanPanel,'data-total',scan.candidate.count);
      set(scanPanel,'data-sum-re',scan.sum.re);set(scanPanel,'data-sum-im',scan.sum.im);
      set(scanPanel,'data-operations',scan.operations);set(scanPanel,'data-committed',scan.committed.length);
      text(scanCount,`累计 ${scan.count} / ${scan.candidate.count} 点`);
      text(scanSum,`C = ${num(scan.sum.re,0)} ${scan.sum.im<0?'−':'+'} ${num(Math.abs(scan.sum.im),0)}i`);
      text(scanScore,scan.count===scan.candidate.count?'ρ = '+num(scan.candidate.score,3):'…');
      text(scanTotal,`已填 ${scan.committed.length} / ${scan.total} 格`);
      const activePoint=scan.candidate.points[Math.max(0,scan.count-1)];
      if(activePoint){set(scanPoint,'cx',cx+activePoint.q[0]*unit);set(scanPoint,'cy',cy+activePoint.q[1]*unit);set(scanPoint,'data-q',activePoint.q.join(','));}
      const visited=scanning?new Set(scan.candidate.points.slice(0,scan.count).map(t=>t.q.join(','))):new Set();
      maskCells.forEach(node=>{
        const accumulated=visited.has(node.getAttribute('data-q'));
        set(node,'fill',accumulated?colors[0]:colors[2]);set(node,'data-scan-accumulated',accumulated);
      });
      const stampX=gx+(scan.candidate.kx+e.extent+.5)*cell,stampY=gy+(scan.candidate.ky+e.extent+.5)*cell;
      set(stamp,'x',desktop.scan.readoutX+(stampX-desktop.scan.readoutX)*scan.transfer);set(stamp,'y',desktop.scan.scoreY+(stampY-desktop.scan.scoreY)*scan.transfer-30*Math.sin(Math.PI*scan.transfer));
      set(stamp,'data-transfer',scan.transfer);text(stamp,num(scan.candidate.score,3));
      if(scanning||fftScene) {
        const spatialVisible=scanning?1-scan.cost:0;
        opacity(frequency,spatialVisible);opacity(sharedRoot,spatialVisible);opacity(right,scanning?p<.82?1:0:0);
        opacity(grid,scanning?M.ramp(p,.12,.18):1-fft.dim+fft.reveal);
        const written=new Set(scan.committed.map(c=>c.kx+','+c.ky));
        gridCells.forEach((g,i)=>{
          const c=e.coarse[i],done=fftScene?true:written.has(c.kx+','+c.ky);
          set(g,'fill',!c.valid?'#091115':done?heat(c.score):'#13262e');
          set(g,'data-written',c.valid&&done&&(fftScene?fft.reveal===1||fft.gather===0:true));
          set(g,'data-score-method',fftScene?'fft':'direct');
        });
        text(gridTitle,fftScene?fft.dock>0?'同一评分图 · FFT 批量结果':'同一评分图 · 暂时收起':'每个格 = 一个候选的分数 · 0—1');
        opacity(gridCursor,scanning&&!scan.done?1:0);
        set(gridCursor,'x',gx+(scan.candidate.kx+e.extent)*cell);set(gridCursor,'y',gy+(scan.candidate.ky+e.extent)*cell);
        opacity(scoreValue,0);opacity(legend,0);
        text(kValue,`k′ = (${num(candidate.kx,0)}, ${num(candidate.ky,0)})`);
      } else opacity(grid,0);
      opacity(fftPeak,fftScene?fft.peak:0);
      set(fftPeak,'x',gx+(e.coarseBest.kx+e.extent)*cell-3);set(fftPeak,'y',gy+(e.coarseBest.ky+e.extent)*cell-3);
      for(const [key,value] of Object.entries(fft))set(fftRoot,'data-'+key,value);
      fftCards.forEach((card,b)=>{
        set(card.g,'transform',`translate(${fftCenters[b]} ${300+28*(1-fft.gather)})`);
        opacity(card.g,1-fft.forward);opacity(card.spectral,1-fft.inverse);opacity(card.spatial,fft.inverse);
        text(card.title,fft.inverse===1?b?'v(r) · 空域复数场':p>=.46?'u*(r) · 同点取共轭':'u(r) · 空域复数场'
          :b?'Vₚ(f) · +1 级固定频谱':'Uₚ(f) · 0 级固定频谱');
        text(card.step,fft.inverse===0?'可靠区除 H，圈外置零':fft.inverse<1?'逆 FFT · 频谱变为空域复数场':p<.46?'逆 FFT 完成 · 保留复数相位':'同一位置 r · 保留完整复数运算');
      });
      const productReady=M.ramp(p,.46,.48),pixelCount=Math.min(n*n,Math.floor((fft.multiply+1e-12)*n*n));
      const rows=Math.floor(pixelCount/n),remaining=pixelCount%n,px=fftSize/n;
      // Exact row-major prefix, including a partial row. No future pixel is
      // shown before its corresponding complex multiplication has been visited.
      const prefix=`M -100 -100 h ${fftSize} v ${rows*px} h ${-fftSize} Z`
        +(remaining?` M -100 ${-100+rows*px} h ${remaining*px} v ${px} h ${-remaining*px} Z`:'');
      set(productPrefix,'d',prefix);set(productPrefix,'data-count',pixelCount);set(productPrefix,'data-total',n*n);
      const cursorIndex=Math.max(0,pixelCount-1),pixelX=cursorIndex%n,pixelY=Math.floor(cursorIndex/n);
      const cursorVisible=productReady*(pixelCount>0&&pixelCount<n*n&&fft.forward===0?1:0);
      fftCursors.forEach(({row,point})=>{
        set(row,'y',-100+pixelY*px);opacity(row,cursorVisible);
        set(point,'cx',-100+(pixelX+.5)*px);set(point,'cy',-100+(pixelY+.5)*px);opacity(point,cursorVisible);
        set(point,'data-r',[pixelX,pixelY].join(','));set(point,'data-index',cursorIndex);
      });
      const u=fftData.spatial[0],v=fftData.spatial[1];
      set(fftProduct,'data-pixel-count',pixelCount);set(fftProduct,'data-pixel-index',cursorIndex);
      set(fftProduct,'data-pixel-re',u.re[cursorIndex]*v.re[cursorIndex]+u.im[cursorIndex]*v.im[cursorIndex]);
      set(fftProduct,'data-pixel-im',u.re[cursorIndex]*v.im[cursorIndex]-u.im[cursorIndex]*v.re[cursorIndex]);
      const targetX=gx+gridSize/2,targetY=gy+gridSize/2;
      set(fftProduct,'transform',`translate(${fftCenters[2]+(targetX-fftCenters[2])*fft.dock} ${300+(targetY-300)*fft.dock}) scale(${1+(gridSize/fftSize-1)*fft.dock})`);
      // Keep the moving image opaque until the persistent grid below is fully
      // restored, then release it at the exact same cell coordinates.
      opacity(fftProduct,productReady*(fft.reveal===1?0:1));
      opacity(productPanel,1-fft.dock);opacity(productTitle,1-fft.dock);opacity(productCaption,1-fft.dock);
      opacity(productImage,1-fft.forward);opacity(correlationImage,fft.forward*(1-fft.normalize));opacity(resultScores,fft.normalize);
      text(productTitle,fft.normalize>0?'ρ(k′) · 归一化评分':fft.forward>0?'C(k′) · 全部位移的乘积和':'w(r) = u*(r) v(r)');
      text(productCaption,fft.normalize>0?'取模 · 两边能量归一化':fft.forward>0?'正 FFT · 一次得到全部位移':`已相乘 ${pixelCount} / ${n*n} 像素`);
      fftOperators.forEach(node=>opacity(node,productReady*(1-fft.forward)));
      text(fftInfo,fft.dock>0?'结果归位：回到同一评分图':fft.normalize>0?'按两边能量归一化，沿用原来的评分色标':fft.forward>0?'乘积图原位做正 FFT：一次得到全部位移':productReady>0?'同一空域坐标逐点相乘，直接扫出右侧乘积图':fft.inverse>0?'分别逆 FFT：两张固定频谱在原位变为空域复数场':'两张固定频谱 · 可靠区除自身 H，圈外置零');
      if(id==='refine') {
        // Preserve the coarse grid for the opening zoom. The dedicated view
        // then owns all three linked columns and the three-round cascade.
        const retained=new Set([header,cue,footer,grid,refineView.root]);
        for(const node of legacyBody.children)if(!retained.has(node))opacity(node,0);
        opacity(sharedRoot,0);
        const enter=M.ramp(p,.015,.12);
        opacity(grid,1-enter);opacity(fftPeak,1-enter);
        gridCells.forEach((g,i)=>set(g,'fill',e.coarse[i].valid?heat(e.coarse[i].score):'#091115'));
        opacity(gridCursor,0);text(gridTitle,'整数峰 → 放大附近一个频率格');
        text(cue,refinement.title);
        text(footer,refinement.mode==='gridLimit'?'整数格限制初值；背景与准星来自同一组观测。'
          :refinement.mode==='phaseRamp'?'17：空域共轭乘积求整张相关图；18：旁带乘相位斜坡，计算一个小数位移候选。'
          :refinement.mode==='returnSpectrum'?'k̂ 已锁定 · 对应地址已确定 · 原始临时频带 → 最终幅相工作副本。'
          :'每轮最高分作为下一轮中心 · 范围缩小 5 倍 · 0.01 格是最终搜索步长。');
        opacity(footer,1);
        const lockOrigin=refineView.draw(p,refinement,{x:gx+(e.coarseBest.kx+e.extent+.5)*cell,y:gy+(e.coarseBest.ky+e.extent+.5)*cell,cell});
        drawLocked(refinement.lock,refinement.lockTransfer,lockOrigin);
        const returning=refinement.returnView;
        if(returning.overview>0) {
          // Restore the original actors, not raster copies of the overview.
          // Their final pose is the fit entry; the same actors continue.
          const scale=.72+.28*returning.overview;
          const overviewPose=`translate(${cx*(1-scale)} ${cy*(1-scale)}) scale(${scale})`;
          set(frequency,'transform',overviewPose);set(sharedRoot,'transform',overviewPose);
          opacity(frequency,returning.overview);opacity(sharedRoot,returning.overview);
          text(mapTitle,'同一批公共频点 · 位置锁定');
          // The locked result feeds a new full-field calculation. The earlier
          // selected-point examples have no role in this handoff.
          planes.forEach(plane=>opacity(plane.group,0));
          mapMarkers.forEach(node=>opacity(node,0));
          pair.forEach(panel=>panel.points.forEach(node=>opacity(node,0)));
          opacity(mask,0);opacity(right,0);opacity(legend,0);
        }
      }
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
    function drawSingle(s,mount=true) {
      const formula = resolve(s), mode = resolveMode(s);
      if(!cache.has(mode)&&s.id==='coefficient'&&mode!=='coefficient-correspondence'){
        const shared=[...cache.values()].find(item=>item.parts.derivation);if(shared)cache.set(mode,shared);
      }
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
        } else if(mode==='coefficient-correspondence') {
          parts.correspondence=root.SIMCoefficientMainline.createCorrespondenceFormulaView({parent:group,document:doc});
        } else if(s.id==='coefficient') {
          parts.derivation=root.SIMCoefficientMainline.createDerivationFormulaView({parent:group,document:doc});
        } else if (s.id === GetPeak.scene.legacyId) {
          Object.assign(parts, GetPeak.formulaView.build({ group, compile, progress: s.progress }));
        } else if(mode==='refine-phaseRamp'&&options.lesson) {
          group.setAttribute('class','pe-study-formula pe-refine-formula');
          parts.refinement=L.createRefinementFormulaView({parent:group,document:doc,lesson:options.lesson,compile});
        } else renderMath(group, formula.equation);
        cache.set(mode, { group, parts });
      }
      const { group, parts } = cache.get(mode);
      if (mount) {
        if (active !== mode || !Array.from(container.children).includes(group)) { clear(); container.appendChild(group); active = mode; }
        container.setAttribute('data-formula-mode', mode);
      }
      const p = s.progress;
      group.style.opacity = '1';
      if(s.id==='coefficient'){group.style.visibility='visible';group.setAttribute('data-coefficient-footer',mode);}
      if(parts.derivation){parts.derivation.draw(p);return formula;}
      if(parts.correspondence){parts.correspondence.draw(L.coefficient.presentation(p).local);return formula;}
      if (s.id === GetPeak.scene.legacyId) GetPeak.formulaView.draw(group, parts, p,options.reducedMotion?.()||false);
      if(parts.refinement){parts.refinement.draw(p);return formula;}
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
      return formula;
    }
    function draw(s) {
      const formula=drawSingle(s),mode=resolveMode(s),current=cache.get(mode).group;
      const transition=L.formulaTransition(s,options.reducedMotion?.()||false),previous=transition.previous;
      const fading=s.id!=='coefficient'&&previous&&transition.amount<1&&resolveMode(previous)!==mode&&resolve(previous).equation!==formula.equation;
      container.classList.toggle('pe-formula-transition',!!fading);
      for(const child of Array.from(container.children))if(child!==current)child.remove();
      current.style.transform='translateY(0px)';current.setAttribute('aria-hidden','false');
      if(fading) {
        drawSingle(previous,false);
        const old=cache.get(resolveMode(previous)).group;
        container.appendChild(old);old.setAttribute('aria-hidden','true');
        old.style.opacity=String(transition.outgoing);old.style.transform=`translateY(${transition.outgoingY}px)`;
        current.style.opacity=String(transition.incoming);current.style.transform=`translateY(${transition.incomingY}px)`;
      }
      return formula;
    }
    return { draw, reset() { active = '';container.classList.toggle('pe-formula-transition',false); }, destroy() { clear(); cache.clear(); } };
  }
  Object.assign(L, { createView, createFormulaView });
})(typeof globalThis !== 'undefined' ? globalThis : this);
