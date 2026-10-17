/* Standalone connection study. The eight estimation scenes remain reusable.
 * These entry/exit scenes are deliberately NOT loaded by the Motion page.
 * Method: fairSIM SimAlgorithm.java, provisional separation at 181–190,
 * adopted-parameter separation at 601–603, then frequency relocation. */
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const M = node ? require('./sim-parameter-model.js') : root.SIMParameterStory;
  const A = node ? require('../atlas/sim-atlas-core.js') : root.SIMAtlas;
  const orders = [0, 1, -1], names = ['0', '+1', '-1'];
  const colors = ['#7ad5cd', '#b7a5eb', '#efb879'];
  const Study = node ? require('./sim-parameter-two-stage.js') : root.SIMParameterLesson;
  const phaseModel = String.raw`$$\phi_j=\phi'_j+\phi_\Delta,\qquad\phi'_j=\frac{2\pi j}{3},\qquad j=0,1,2$$`;
  const provisional = String.raw`$$\begin{aligned}\widetilde A_0(\mathbf f)&=\frac13\sum_{j=0}^2D_j(\mathbf f)=H(\mathbf f)S(\mathbf f)\\\widetilde A_{\pm1}(\mathbf f)&=\frac23\sum_{j=0}^2e^{\mp i\phi'_j}D_j(\mathbf f)=m e^{\pm i\phi_\Delta}A_{\pm1}(\mathbf f)\end{aligned}$$`;
  const scene = (id, label, title, copy, equation, note, duration, section) => ({ id, label, title, copy, equation, note, duration, section, chapter: section === 'entry' ? '入口 / 从解法到数据' : '出口 / 回到正式重建', owner: 'connection' });
  const entry = [
    scene('pending', '参数还未知', '求逆给出了解法，矩阵里的参数还没有确定。',
      '先接住完整流程中的 D = M A。我们手里只有三帧观测和名义相对相移；还不能把未知的相位、调制度直接代入矩阵。',
      String.raw`$$\mathbf D(\mathbf f)=M\mathbf A(\mathbf f)\ \Longrightarrow\ \mathbf A(\mathbf f)=M^{-1}\mathbf D(\mathbf f),\qquad M\text{ 中的 }m,\phi_j\text{ 尚待确定}$$`,
      'Aℓ(f) = H(f)S(f−ℓk)。采集时的设定值不交给估计器；这一段按只拿到相机观测来讲重建。', 9000, 'entry'),
    scene('temporary', '先临时分离', '利用已知的相对相移，先取出临时频带。',
      '同一组三帧先形成三份临时结果，旁带保留未知调制度和共同相位。接着选 0 级与 +1 级，把注意力转向两带都有的样品信息。',
      provisional,
      M.notation.tilde + M.notation.band + '这里假设三帧相对相移准确且等间隔。', 15000, 'entry'),
  ];
  const exit = [
    scene('refill', '参数回填', '回到同一个矩阵，把估计值逐行填进去。',
      '相位与调制度回到原来的系数位置：先补上共同相位，再算出每行+1、−1 级系数。波矢另行保留，等频带分开后用于归位。',
      String.raw`$$\widehat\phi_j=\phi'_j+\widehat\phi_\Delta,\qquad M_{j,:}=\begin{bmatrix}1&\frac{\widehat m}{2}e^{i\widehat\phi_j}&\frac{\widehat m}{2}e^{-i\widehat\phi_j}\end{bmatrix}$$`,
      '矩阵中的数由刚才的估计结果计算。下文 M 表示代入这些估计值后的矩阵；k 不进入相位解混系数。', 15000, 'exit'),
    scene('solve', '正式解混', '用刚填好的矩阵，把同一组三帧分开。',
      '求逆得到三行实际权重。每行对同一组三帧加权求和，依次输出 0 级、+1 级、−1 级；对全部频率重复这次计算。',
      String.raw`$$U=M^{-1},\qquad\begin{bmatrix}A_0(\mathbf f)\\A_{+1}(\mathbf f)\\A_{-1}(\mathbf f)\end{bmatrix}=U\begin{bmatrix}D_0(\mathbf f)\\D_1(\mathbf f)\\D_2(\mathbf f)\end{bmatrix}$$`,
      '三行权重与三份正式频带都由估计参数实际计算。照明幅相已补偿，检测 OTF 仍保留；接下来用波矢归位。', 11000, 'exit'),
    scene('relocation', '接回频带归位', '现在才用波矢，把频带和 OTF 一起归位。',
      '保留刚才得到的正式频带，+1 级按 −k 移动，−1 级按 +k 移动。追踪同一个检测频点：位置改变，复数值与检测时的 OTF 衰减保留。',
      String.raw`$$\mathbf q=\mathbf f-\ell\widehat{\mathbf k},\qquad C_\ell(\mathbf q)=A_\ell(\mathbf q+\ell\widehat{\mathbf k}),\quad\ell\in\{0,+1,-1\}$$`,
      '这里沿用 A 表示用估计参数分离出的频带。归位不等于去除 OTF；下一段才接多方向覆盖与融合。本页先检查这段交接是否连贯。', 13000, 'exit'),
  ];
  // Entry/exit remain page-owned; estimation graphics, formulas and timing are
  // shared with the complete reconstruction story.
  const scenes = [...entry, ...Study.scenes.map((s, i) => ({ ...Study.scene(s.id), section: 'estimation', owner: 'estimation' })), ...exit];
  const durations = scenes.map(s => s.duration), index = id => scenes.findIndex(s => s.id === id);
  function state(position) {
    if (!Number.isFinite(position)) throw new Error('预览进度必须为有限数值。');
    const t = M.clamp(position, 0, scenes.length), step = M.clamp(Math.ceil(t - 1e-9) - 1, 0, scenes.length - 1), progress = M.clamp(t - step);
    const data = scenes[step];
    return { position: t, step, id: data.id, owner: data.owner, progress,
      parameter: data.owner === 'estimation' ? Study.stateForScene(data.id, progress) : null };
  }
  function formulaAt(s) {
    if (s.parameter) return Study.formulaAt(s.parameter);
    if (s.id === 'temporary' && s.progress < .23) return { equation: phaseModel, note: '已知 φ′ⱼ，未知 φΔ。只用 φ′ⱼ 做加权；临时旁带仍保留未知的 m 与共同相位。' };
    return { equation: scenes[s.step].equation, note: scenes[s.step].note };
  }
  const { leastSquaresState, matchingState } = Study;
  const createFormulaView = (container,lesson) => Study.createFormulaView(container, { formulaAt,lesson });
  const multiply = (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
  function dataFor(lesson) {
    const g = lesson.bridge.pipeline.groups[0];
    const matrix = g.phases.map(phi => orders.map(order => {
      const amplitude = order === 0 ? 1 : g.m / 2;
      return { re: amplitude * Math.cos(order * phi), im: amplitude * Math.sin(order * phi) };
    }));
    const products = g.weights[2].map((w, j) => matrix[j].map(z => multiply(w, z)));
    const responses = orders.map((_, b) => products.reduce((z, row) => ({ re: z.re + row[b].re, im: z.im + row[b].im }), { re: 0, im: 0 }));
    const probe = A.probe(lesson.bridge.pipeline, 0, 6, 0);
    return { matrix, products, responses, group: g, probe,
      residual: Math.max(...responses.map((z, b) => Math.hypot(z.re - (b === 2 ? 1 : 0), z.im))) };
  }
  function createView(container, lesson) {
    const doc = container.ownerDocument || root.document, ns = 'http://www.w3.org/2000/svg', n = lesson.capture.config.n;
    const data = dataFor(lesson), owned = [], groups = {}, draws = {}, shared = lesson.estimate.context.separated;
    const set = (el, name, value) => { if (el.getAttribute(name) !== String(value)) el.setAttribute(name, value); };
    const text = (el, value) => { if (el.textContent !== String(value)) el.textContent = String(value); };
    const opacity = (el, alpha) => { set(el, 'opacity', alpha); set(el, 'aria-hidden', alpha === 0); };
    const el = (tag, attrs, parent, value) => {
      const item = doc.createElementNS(ns, tag);
      Object.entries(attrs || {}).forEach(([k, v]) => item.setAttribute(k, v));
      if (value !== undefined) item.textContent = value;
      (parent || container).appendChild(item); if (!parent) owned.push(item); return item;
    };
    const label = (parent, x, y, value, cls = 'pe-svg-text', fill) => el('text', { x, y, class: cls, 'text-anchor': 'middle', ...(fill ? { style: 'fill:' + fill } : {}) }, parent, value);
    const group = id => { const g = el('g', { 'data-connection-scene': id, opacity: 0, 'aria-hidden': true }); groups[id] = g; return g; };
    const math = (parent, x, y, width, height, tex) => {
      const box = el('foreignObject', { x, y, width, height }, parent), div = doc.createElementNS('http://www.w3.org/1999/xhtml', 'div');
      div.setAttribute('class', 'pe-connection-math'); box.appendChild(div);
      root.katex.render(tex.slice(2, -2), div, { displayMode: true, output: 'mathml', throwOnError: true, strict: 'error' }); return box;
    };
    const num = value => (Math.abs(value) < .00005 ? 0 : value).toFixed(4);
    const complex = z => num(z.re) + (z.im < -.00005 ? ' − ' : ' + ') + num(Math.abs(z.im)) + 'i';
    const maxOf = list => list.reduce((v, z) => z.re.reduce((v, re, i) => Math.max(v, Math.hypot(re, z.im[i])), v), 1);
    const image = (z, color, max, range = 27, transparent = false) => {
      const c = doc.createElement('canvas'); c.width = c.height = range;
      const ctx = c.getContext('2d'), pixels = ctx.createImageData(range, range), rgb = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16));
      for (let y = 0; y < range; y++) for (let x = 0; x < range; x++) {
        const fx = x - Math.floor(range / 2), fy = y - Math.floor(range / 2), i = A.idx(fx, fy, n);
        const v = M.clamp(Math.log1p(Math.hypot(z.re[i], z.im[i])) / Math.log1p(max));
        pixels.data.set([Math.round(9 + rgb[0] * v * .92), Math.round(18 + rgb[1] * v * .92), Math.round(24 + rgb[2] * v * .90), transparent && Math.hypot(fx, fy) >= lesson.capture.config.cutoff ? 0 : 255], 4 * (y * range + x));
      }
      ctx.putImageData(pixels, 0, 0); return c.toDataURL();
    };
    const panel = (parent, z, color, max, title) => {
      const g = el('g', {}, parent);
      el('rect', { x: -116, y: -116, width: 232, height: 232, rx: 4, class: 'pe-border' }, g);
      el('image', { x: -109, y: -109, width: 218, height: 218, href: image(z, color, max), style: 'image-rendering:pixelated' }, g);
      label(g, 0, -137, title, 'pe-svg-title', color);
      return g;
    };
    const provisionalMax = maxOf(shared.bands), formalMax = maxOf(data.group.separated);
    const matrixFrame = g => {
      ['0 级来源 A₀', '+1 级来源 A₊₁', '−1 级来源 A₋₁'].forEach((v, b) => label(g, 455 + b * 315, 175, v, 'pe-svg-text', colors[b]));
      el('path', { d: 'M 307 206 H 289 V 432 H 307 M 1250 206 H 1268 V 432 H 1250', class: 'pe-axis' }, g);
      for (let j = 0; j < 3; j++) label(g, 135, 248 + j * 78, '第 ' + j + ' 行 · D' + ['₀', '₁', '₂'][j], 'pe-svg-text');
    };
    {
      const g = group('pending');
      // Same matrix positions reappear after estimation, so "fill it back in"
      // refers to a concrete object the reader has already seen in this Demo.
      matrixFrame(g);
      const cards = ['m：待估计', 'φΔ：待估计', 'k：待估计'].map((value, i) => label(g, [340, 750, 1190][i], 69, value, 'pe-svg-title', colors[i]));
      label(g, 1190, 106, '用于之后的归位', 'pe-svg-muted');
      for (let j = 0; j < 3; j++) orders.forEach((order, b) => {
        const x = 455 + b * 315, y = 244 + j * 78;
        if (!order) label(g, x, y, '1', 'pe-svg-title');
        else math(g, x - 130, y - 33, 260, 56, '$$\\frac m2e^{' + (order > 0 ? 'i' : '-i') + '\\phi_' + j + '}$$');
      });
      const next = label(g, 720, 489, '矩阵结构已知；先用已知 φ′ⱼ 临时分离，再回来确定这些系数。', 'pe-svg-text', colors[2]);
      draws.pending = p => { cards.forEach((g, i) => opacity(g, .35 + .65 * M.ramp(p, .12 + i * .14, .30 + i * .14))); opacity(next, M.ramp(p, .70, .95)); };
    }
    {
      const g = group('temporary'), inputs = el('g', {}, g), outputs = el('g', {}, g);
      const inputMax = maxOf(shared.spectra);
      shared.spectra.forEach((z, j) => {
        const x = 570 + j * 150;
        el('image', { x: x - 40, y: 64, width: 80, height: 80, href: image(z, '#bdcdd1', inputMax) }, inputs);
        label(inputs, x, 49, 'D' + ['₀', '₁', '₂'][j] + '(f)', 'pe-svg-text');
      });
      const bandNodes = shared.bands.map((z, b) => panel(outputs, z, colors[b], provisionalMax, ['临时 0 级 Ã₀(f)', '临时 +1 级 Ã₊₁(f)', '临时 −1 级 Ã₋₁(f)'][b]));
      const message = label(g, 720, 199, '', 'pe-svg-title'), detail = label(g, 720, 235, '', 'pe-svg-text');
      draws.temporary = p => {
        const choose = M.ramp(p, .69, .96); opacity(inputs, 1 - choose);
        bandNodes.forEach((band, b) => {
          const from = 360 + b * 360, to = b === 1 ? 1040 : from;
          set(band, 'transform', `translate(${from + (to - from) * choose} ${346 + 29 * choose})`);
          opacity(band, M.ramp(p, .23 + b * .10, .36 + b * .10) * (b === 2 ? 1 - choose : 1));
        });
        text(message, choose > .5 ? '先比较 0 级与 +1 级都记录到的内容' : '按名义相位加权 → 三份临时频带');
        text(detail, choose > .5 ? 'q=(14,0) 不在 0 级通带；估计先看公共区，再回到高频。' : '旁带的未知 m 与共同相位 φΔ 仍保留下来。');
        set(g, 'data-pair-selection', choose);
      };
    }
    const estimationContainer = el('g', { 'data-connection-scene': 'estimation', opacity: 0 });
    const estimationView = Study.createView(estimationContainer, lesson);
    {
      const g = group('refill'), e = lesson.estimate;
      label(g, 340, 69, 'm̂ = ' + num(e.m), 'pe-svg-title', colors[0]);
      label(g, 750, 69, 'φ̂Δ = ' + num(e.phase) + ' rad', 'pe-svg-title', colors[1]);
      label(g, 1190, 69, 'k̂ = (' + num(e.kx) + ', ' + num(e.ky) + ')', 'pe-svg-text', colors[2]);
      label(g, 1190, 106, '保留给归位', 'pe-svg-muted');
      matrixFrame(g);
      const tokens = [];
      for (let j = 0; j < 3; j++) {
        orders.forEach((order, b) => {
          const x = 455 + b * 315, y = 244 + j * 78;
          if (!order) { label(g, x, y, '1', 'pe-svg-title'); return; }
          const symbolic = math(g, x - 130, y - 33, 260, 56, '$$\\frac m2e^{' + (order > 0 ? 'i' : '-i') + '\\phi_' + j + '}$$');
          const token = el('g', { 'data-refill-cell': j + ':' + b }, g);
          math(token, -130, -33, 260, 56, '$$\\frac{\\widehat m}{2}e^{' + (order > 0 ? 'i' : '-i') + '\\widehat\\phi_' + j + '}$$');
          const number = label(g, x, y, complex(data.matrix[j][b]), 'pe-svg-text pe-svg-number', colors[b]);
          set(number, 'data-matrix-coefficient', j + ':' + b); set(number, 'data-re', data.matrix[j][b].re); set(number, 'data-im', data.matrix[j][b].im);
          tokens.push({ j, b, x, y, symbolic, token, number });
        });
      }
      const done = label(g, 720, 489, '现在 M 的各个系数都有了数值，下一步才计算实际权重。', 'pe-svg-title');
      draws.refill = p => {
        tokens.forEach(t => {
          const fill = M.ramp(p, .15 + t.j * .18 + (t.b - 1) * .045, .28 + t.j * .18 + (t.b - 1) * .045);
          const numeric = M.ramp(p, .76, .91);
          opacity(t.symbolic, 1 - fill); opacity(t.token, fill > 0 ? 1 - numeric : 0); opacity(t.number, numeric);
          set(t.token, 'transform', `translate(${550 + (t.x - 550) * fill} ${103 + (t.y - 103) * fill - 30 * Math.sin(Math.PI * fill)})`);
          set(t.token, 'data-fill', fill);
        });
        opacity(done, M.ramp(p, .91, 1));
      };
    }
    {
      const g = group('solve'), inputs = el('g', {}, g), operator = el('g', {}, g);
      label(g, 720, 55, '同一组三帧 × 刚求出的逆矩阵 → 三份正式频带', 'pe-svg-title');
      const inputMax = maxOf(shared.spectra);
      shared.spectra.forEach((z, j) => {
        const y = 168 + j * 112;
        el('image', { x: 125, y: y - 38, width: 76, height: 76, href: image(z, '#bdcdd1', inputMax) }, inputs);
        label(inputs, 90, y + 6, 'D' + ['₀', '₁', '₂'][j] + '(f)', 'pe-svg-text');
      });
      label(operator, 690, 112, 'U = M⁻¹', 'pe-svg-title', colors[2]);
      ['D₀', 'D₁', 'D₂'].forEach((v, j) => label(operator, 515 + j * 184, 152, v, 'pe-svg-muted'));
      el('path', { d: 'M 423 169 H 407 V 423 H 423 M 1010 169 H 1026 V 423 H 1010', class: 'pe-axis' }, operator);
      const rows = data.group.weights.map((weights, b) => {
        const row = el('g', { 'data-apply-row': b }, operator), y = 211 + b * 90;
        label(row, 350, y, ['A₀', 'A₊₁', 'A₋₁'][b], 'pe-study-title', colors[b]);
        weights.forEach((z, j) => {
          const value = label(row, 515 + j * 184, y, complex(z), 'pe-study-weight', colors[b]);
          set(value, 'data-formal-weight', b + ':' + j); set(value, 'data-re', z.re); set(value, 'data-im', z.im);
        }); return row;
      });
      const bands = data.group.separated.map((z, b) => {
        const band = panel(g, z, colors[b], formalMax, ['正式 0 级 A₀(f)', '正式 +1 级 A₊₁(f)', '正式 −1 级 A₋₁(f)'][b]);
        set(band, 'data-formal-band', b); return band;
      });
      label(g, 720, 510, '各行输出由实际观测与估计参数计算；照明幅相已补偿，检测 OTF 还在。', 'pe-svg-muted');
      draws.solve = p => {
        const expand = M.ramp(p, .76, .95), inverse = M.ramp(p, .12, .32);
        opacity(inputs, 1 - expand); opacity(operator, inverse * (1 - expand));
        rows.forEach((row, b) => opacity(row, .25 + .75 * M.ramp(p, .34 + b * .12, .44 + b * .12)));
        bands.forEach((band, b) => {
          const show = M.ramp(p, .34 + b * .12, .44 + b * .12);
          const x = 1220 + (360 + b * 360 - 1220) * expand, y = 204 + b * 102 + (349 - 204 - b * 102) * expand;
          set(band, 'transform', `translate(${x} ${y}) scale(${.32 + .38 * expand})`); opacity(band, show);
        });
        set(g, 'data-formal-bands', M.ramp(p, .34, .68)); set(g, 'data-inverse', inverse);
      };
    }
    {
      const g = group('relocation'), size = 250, range = 48, unit = size / range;
      label(g, 720, 68, '使用 k̂ = (' + num(data.group.kx) + ', ' + num(data.group.ky) + ')，移动整个频带与 OTF', 'pe-svg-title');
      const bandNodes = data.group.separated.map((z, b) => {
        const band = el('g', { transform: `translate(${360 + b * 360} 282)` }, g);
        label(band, 0, -154, ['0 级：保持原位', '+1 级：−k̂', '−1 级：+k̂'][b], 'pe-svg-title', colors[b]);
        el('rect', { x: -132, y: -132, width: 264, height: 264, rx: 4, class: 'pe-border' }, band);
        el('path', { d: 'M -125 0 H 125 M 0 -125 V 125', class: 'pe-axis' }, band);
        el('circle', { r: lesson.capture.config.cutoff * unit, class: 'pe-cutoff' }, band);
        const moving = el('g', { 'data-relocation-order': orders[b] }, band);
        el('image', { x: -125, y: -125, width: size, height: size, href: image(z, colors[b], formalMax, range, true), style: 'image-rendering:pixelated' }, moving);
        el('circle', { r: lesson.capture.config.cutoff * unit, fill: 'none', stroke: colors[b], 'stroke-width': 2 }, moving);
        el('circle', { cx: 6 * unit, cy: 0, r: 6, fill: '#091115', stroke: colors[b], 'stroke-width': 2 }, moving);
        const coordinate = label(band, 0, 170, '', 'pe-svg-text'), value = data.probe.orders[b].value;
        // Atlas.probe already reports frequency coefficients divided by N².
        label(band, 0, 205, '值 / N² = ' + complex(value), 'pe-svg-muted');
        return { moving, coordinate, b, value };
      });
      draws.relocation = p => {
        const shift = M.ramp(p, .17, .86);
        bandNodes.forEach(({ moving, coordinate, b, value }) => {
          const x = -orders[b] * data.group.kx * shift, y = -orders[b] * data.group.ky * shift;
          set(moving, 'transform', `translate(${x * unit} ${y * unit})`);
          set(moving, 'data-qx', 6 + x); set(moving, 'data-qy', y); set(moving, 'data-re', value.re); set(moving, 'data-im', value.im);
          text(coordinate, shift === 0 ? '检测 f = (6, 0)' : '样品 q = (' + num(6 + x) + ', ' + num(y) + ')');
        });
      };
    }
    function drawContent(scene, progress) {
      if (scene.owner === 'estimation') { estimationView.drawScene(scene.id, progress); return estimationContainer; }
      draws[scene.id](progress); return groups[scene.id];
    }
    function draw(position) {
      const s = state(position), scene = scenes[s.step], previous = scenes[s.step - 1];
      const enter = s.step === 0 ? 1 : M.ramp(s.progress, 0, .12);
      [...Object.values(groups), estimationContainer].forEach(g => opacity(g, 0));
      const sameView = previous?.owner === 'estimation' && scene.owner === 'estimation';
      if (previous && enter < 1 && !sameView) opacity(drawContent(previous, 1), 1 - enter);
      opacity(drawContent(scene, s.progress), previous && enter < 1 && !sameView ? enter : 1);
      set(container, 'data-preview-scene', s.id); set(container, 'data-preview-progress', s.progress);
      return s;
    }
    return { draw, data, connectionGroups: groups, estimationGroups: estimationView.groups, estimationView,
      destroy() { estimationView.destroy(); owned.forEach(g => g.remove()); } };
  }
  const api = { scenes, durations, index, state, formulaAt, dataFor, createView, leastSquaresState, matchingState, createFormulaView };
  if (node) module.exports = api; else root.SIMParameterPreview = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
