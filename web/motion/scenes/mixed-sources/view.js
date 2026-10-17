/* Shared persistent actors for this scene family. */
(function(root){
  'use strict';
  (root.SIMMotionHostViews ||= {}).matrix = function({ arrowPath, M, A, $, lesson, create, attr, style, setText, opacity, compact, complex, math, imageURL, spectrumURL, spatialURL, maximum, formulaBox, canvasLayer, matrixView, inverseView, proofView, calculationView }) {
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
    return { buildDemixMatrix, buildDemixProof, drawDemix };
  };
})(typeof globalThis!=='undefined'?globalThis:this);
