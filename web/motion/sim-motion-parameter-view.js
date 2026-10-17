/* Two host-owned handoffs around the reusable parameter chapter.
 * Every number comes from the same provisional split / adopted pipeline. */
(function (root) {
  'use strict';
  function createNominalFailureView(options) {
    const { parent, lesson, create, attr, opacity, formulaBox, imageURL, spectrumURL, maximum, compact } = options;
    const Chapter = root.SIMMotionParameterChapter, M = root.SIMMotion;
    const data = Chapter.createNominalFailure(lesson), blue = '#7fbbe8', orange = '#efad62', red = '#e77c78';
    const q = data.probes[0], probeX = 510 + 8.8 * q.qx, probeY = 330 + 8.8 * q.qy;
    const label = (p, x, y, text, extra = {}) => create('text', { x, y, class: 'svg-small', 'text-anchor': 'middle', ...extra }, p, text);
    const math = (p, x, y, width, tex, extra = {}) => formulaBox(p, x - width / 2, y - 40, width, 80, '$$' + tex + '$$', extra);
    const question = label(parent, 720, 98, '直接分离可行吗？', { class: 'svg-title', 'data-nominal-question': '' });
    const card = create('g', { 'data-nominal-card': '', 'data-vector-error': data.delta, 'data-controlled-phase': data.phase }, parent);
    create('rect', { x: -280, y: -36, width: 560, height: 76, rx: 8, class: 'matrix-result-card', color: orange }, card);
    label(card, 0, -11, '硬件预设标称参数', { fill: orange, class: 'matrix-caption' });
    math(card, 0, 17, 530, String.raw`\mathbf p_{\text{标称}},\quad\phi_0=0,\quad m=1`);
    const diagram = create('g', { 'data-nominal-diagram': '' }, parent);
    create('path', { d: 'M 746 225 V 495', class: 'guide-line' }, diagram);
    label(diagram, 510, 220, '频域 · 蓝色 0 级 / 橙色 +1 级');
    label(diagram, 190, 220, '重叠区 · 局部放大');
    label(diagram, 1050, 220, '同一组对照观测 · 逆 FFT 重建');
    const defs = create('defs', {}, diagram);
    const diskClip = create('clipPath', { id: 'nominal-disk-clip', clipPathUnits: 'userSpaceOnUse' }, defs);
    create('circle', { r: 88 }, diskClip);
    const lensClip = create('clipPath', { id: 'nominal-lens-clip', clipPathUnits: 'userSpaceOnUse' }, defs);
    create('circle', { cx: 190, cy: 349, r: 97 }, lensClip);
    const scale = maximum(lesson.group.separated);
    const disks = [0, 1].map((b, i) => {
      const group = create('g', { 'data-nominal-disk': i ? 'side' : 'zero' }, diagram);
      create('circle', { r: 90, fill: i ? '#efad6210' : '#7fbbe810', stroke: i ? orange : blue, 'stroke-width': 1.7 }, group);
      create('image', { x: -88, y: -88, width: 176, height: 176, 'clip-path': 'url(#nominal-disk-clip)',
        opacity: .65, href: spectrumURL(lesson.group.separated[b], scale, i ? [220, 150, 70] : [100, 176, 230], 20) }, group);
      label(group, 0, 120, i ? '+1 级 → −p标称' : '0 级 · 固定', { fill: i ? orange : blue });
      return group;
    });
    const target = create('circle', { cx: 510 - data.k[0] * 8.8, cy: 330 - data.k[1] * 8.8, r: 90,
      fill: 'none', stroke: orange, opacity: .5, 'stroke-dasharray': '4 5' }, diagram);
    const moveArrow = create('path', { d: 'M 508 460 H 430 l 8 -5 m -8 5 l 8 5', stroke: orange, fill: 'none', 'stroke-width': 1.4 }, diagram);
    create('path', { d: `M ${probeX} ${probeY} L 288 305`, class: 'matrix-link', 'stroke-dasharray': '4 4' }, diagram);
    create('circle', { cx: probeX, cy: probeY, r: 20, fill: 'none', stroke: orange }, diagram);
    create('circle', { cx: 190, cy: 349, r: 99, fill: '#091115', stroke: '#8fa4aa', 'stroke-width': 2 }, diagram);
    const lens = create('g', { 'clip-path': 'url(#nominal-lens-clip)', 'data-nominal-lens': '' }, diagram);
    const len = data.n;
    const sample = (field, fx, fy) => {
      const x = Math.floor(fx), y = Math.floor(fy), dx = fx - x, dy = fy - y;
      let re = 0, im = 0;
      for (let b = 0; b < 2; b++) for (let a = 0; a < 2; a++) {
        const i = ((y + b + len) % len) * len + ((x + a + len) % len), w = (a ? dx : 1 - dx) * (b ? dy : 1 - dy);
        re += field.re[i] * w; im += field.im[i] * w;
      }
      return Math.hypot(re, im);
    };
    const fieldMax = Math.max(...data.probes.map(p => p.energy), 1);
    const lensURLs = data.fields.map((field, b) => imageURL((x, y, n) => {
      const v = Math.min(1, Math.log1p(sample(field, q.qx + 2.4 * (x / n - .5), q.qy + 2.4 * (y / n - .5))) / Math.log1p(fieldMax));
      return (b ? [225, 150, 65] : [95, 178, 237]).map((c, j) => [9, 17, 23][j] + c * v);
    }, 96));
    const lensImages = lensURLs.map((href, b) => create('image', { x: 92, y: 251, width: 196, height: 196, href,
      opacity: b ? .5 : .85, 'data-nominal-texture': b }, lens));
    const misregistration = label(diagram, 190, 475, 'Δp = 0.3 个频域像素', { fill: orange, 'data-nominal-misregistration': '' });
    const redGlow = create('circle', { cx: 190, cy: 349, r: 96, fill: '#e760652b', stroke: red, 'stroke-width': 3,
      'data-nominal-cancellation': '' }, diagram);
    const phasors = data.probes.map((point, b) => {
      const x = [151, 225, 174][b], y = [306, 354, 399][b];
      create('circle', { cx: x, cy: y, r: 25, fill: '#091115c9', stroke: '#a4b4b433' }, diagram);
      const arrows = [blue, orange].map((stroke, i) => create('path', { stroke, fill: 'none', 'stroke-width': 2.4,
        'data-nominal-phasor': i ? 'side' : 'zero', 'data-probe': b }, diagram));
      return { x, y, angle: point.angle, arrows };
    });
    const phaseCaption = label(diagram, 190, 500, '同一 q，除 OTF 后：相消干涉', { fill: red });
    const imageURLs = data.images.map(pixels => imageURL((x, y, n) => {
      const value = pixels[Math.floor(y * data.size / n) * data.size + Math.floor(x * data.size / n)];
      const v = Math.min(1, Math.abs(value) / data.maximum);
      return value < -1e-9 ? [60 + 190 * v, 15 + 50 * v, 20 + 60 * v] : [9 + 210 * v, 17 + 220 * v, 23 + 225 * v];
    }, 192));
    create('rect', { x: 882, y: 246, width: 276, height: 236, rx: 5, class: 'camera-border' }, diagram);
    const images = imageURLs.map((href, b) => create('image', { x: 902, y: 250, width: 232, height: 232, href,
      'data-nominal-reconstruction': b }, diagram));
    create('image', { x: 1212, y: 260, width: 110, height: 110, href: imageURLs[0] }, diagram);
    label(diagram, 1267, 395, '匹配参数对照', { class: 'svg-muted' });
    const status = label(diagram, 1020, 501, '', { 'data-nominal-image-status': '', fill: orange });
    const profile = create('g', { 'data-nominal-profile': '', transform: 'translate(1220 436)' }, diagram);
    const profileWidth = 104, profileHeight = 48, range = data.maximum - data.minimum;
    const py = value => profileHeight * (data.maximum - value) / range;
    create('path', { d: `M 0 ${py(0)} H ${profileWidth}`, stroke: '#8fa4aa', 'stroke-dasharray': '3 3' }, profile);
    const curves = data.images.map((pixels, b) => {
      const d = Array.from({ length: data.size }, (_, x) => `${x ? 'L' : 'M'} ${(x / (data.size - 1) * profileWidth).toFixed(3)} ${py(pixels[data.profileY * data.size + x]).toFixed(3)}`).join(' ');
      return create('path', { d, fill: 'none', stroke: b ? red : blue, 'stroke-width': 1.2 }, profile);
    });
    label(diagram, 1270, 503, '剖面保留负值', { class: 'svg-muted' });
    label(diagram, 720, 541, '受控教学对照：Δp = (0.3, 0)，共同相位设为 π，m = 1；p 与后文 k 同义。', { class: 'svg-muted' });
    attr(parent, 'data-nominal-source', 'controlled-remix-of-adopted-bands');
    return { data, draw(s) {
      opacity(question, s.question); opacity(diagram, s.diagram);
      attr(card, 'transform', `translate(720 ${M.lerp(-100, 151, s.card)})`); opacity(card, s.card);
      attr(disks[0], 'transform', 'translate(510 330)');
      const kx = (data.k[0] + data.delta * s.misregister) * s.relocate, ky = data.k[1] * s.relocate;
      attr(disks[1], 'transform', `translate(${510 - 8.8 * kx} ${330 - 8.8 * ky})`);
      attr(disks[1], 'data-shift-x', -kx); attr(disks[1], 'data-shift-y', -ky);
      opacity(target, s.relocate); opacity(moveArrow, s.relocate);
      opacity(lensImages[0], .85); opacity(lensImages[1], .6 * (1 - s.misregister)); opacity(lensImages[2], .6 * s.misregister);
      opacity(misregistration, s.misregister * (1 - s.phase));
      opacity(redGlow, s.cancellation * s.redPulse); opacity(phaseCaption, s.cancellation);
      phasors.forEach(p => p.arrows.forEach((arrow, b) => {
        const angle = p.angle + (b ? data.phase * s.phase : 0), dx = 23 * Math.cos(angle), dy = -23 * Math.sin(angle);
        attr(arrow, 'd', `M ${p.x} ${p.y} l ${dx} ${dy} m ${-6 * Math.cos(angle - .5)} ${6 * Math.sin(angle - .5)} l ${6 * Math.cos(angle - .5)} ${-6 * Math.sin(angle - .5)} l ${-6 * Math.cos(angle + .5)} ${6 * Math.sin(angle + .5)}`);
        attr(arrow, 'data-angle', angle); opacity(arrow, s.phase);
      }));
      const alphas = [(1 - s.misregister) * (1 - s.phase), s.misregister * (1 - s.phase), s.phase];
      images.forEach((image, b) => opacity(image, alphas[b]));
      curves.forEach((curve, b) => opacity(curve, b === 0 ? .55 : alphas[b]));
      const text = s.phase > 0 ? '未校正共同相位 · 红色为负值下冲' : s.misregister > 0 ? '波矢偏差 0.3 格 · 真实重建结果' : '匹配参数对照 · 三图共用强度标尺';
      if (status.textContent !== text) status.textContent = text;
      attr(parent, 'data-phase-loss', s.phase); attr(parent, 'data-frequency-error', data.delta * s.misregister);
    } };
  }
  function create(options) {
    const { reconstruction, lesson, create, attr, opacity, formulaBox, complex, compact } = options;
    const M = root.SIMMotion, Chapter = root.SIMMotionParameterChapter, document = options.document || root.document;
    const provisional = document.getElementById('provisional-stage'), adopted = document.getElementById('adopted-stage');
    const label = (parent, x, y, text, extra = {}) => create('text', { x, y, class: 'svg-small', 'text-anchor': 'middle', ...extra }, parent, text);
    const mathAt = (parent, x, y, width, tex, extra = {}) => formulaBox(parent, x - width / 2, y - 40, width, 80, '$$' + tex + '$$', extra);
    // Explicit token anchors let A(f) continue from exactly the same position.
    function operation(parent, temporary = false) {
      const source = mathAt(parent, -66, 0, 145, temporary ? String.raw`\widetilde{\mathbf A}(\mathbf f)` : String.raw`\mathbf A(\mathbf f)`);
      const rhs = mathAt(parent, 65, 0, 190, temporary ? String.raw`=\widetilde U\cdot\mathbf D(\mathbf f)` : String.raw`=U\cdot\mathbf D(\mathbf f)`);
      return { source, rhs };
    }
    // A short crossfade at the unchanged pose hands off the closed-form terms
    // from step 10. Only then do the same terms gather into A, U and D.
    const transfer = create('g', { 'data-provisional-transfer': '' }, provisional);
    const moving = options.inverseHandoff.map(item => {
      const { kind, row: b } = item, key = kind === 'weight' ? item.element.getAttribute('data-resolved-weight') : String(b ?? '');
      const g = create('g', { 'data-provisional-token': kind + ':' + key }, transfer);
      const formula = formulaBox(g, -item.width / 2, -item.height / 2, item.width, item.height, '$$' + item.tex + '$$');
      if (kind === 'weight' || kind === 'source') attr(formula, 'style', 'color:' + M.colors[b]);
      const target = { source: 565, equals: 655, weight: 715, multiply: 765, observation: 855 }[kind];
      return { ...item, group: g, target };
    });
    const equation = create('g', { 'data-provisional-operation': '' }, provisional);
    operation(equation);
    // All formulas are compiled once. The one host playhead moves the same
    // symbols into the model, groups the unknowns, then applies phase sums.
    const lessonGroups = Object.fromEntries(['substitution', 'model', 'expansion', 'absorption', 'demix', 'ready'].map(key =>
      [key, create('g', { 'data-provisional-lesson': key }, provisional)]));
    const failure = create('g', { 'data-provisional-lesson': 'failure' }, provisional);
    const failureView = createNominalFailureView({ ...options, parent: failure });
    const substitution = lessonGroups.substitution;
    label(substitution, 720, 105, '先看参数的去向 · 帽号表示待求估计量，尚未求值');
    const initialPrefix = mathAt(substitution, 390, 225, 250, String.raw`I_j(\mathbf r)=1+`);
    const estimatedPrefix = mathAt(substitution, 390, 225, 250, String.raw`\widehat I_j(\mathbf r)=1+`);
    mathAt(substitution, 630, 225, 150, String.raw`\cos\!\bigl(\tfrac{2\pi}{N}`);
    mathAt(substitution, 855, 225, 130, String.raw`\cdot\mathbf r+`);
    mathAt(substitution, 1165, 225, 40, String.raw`\bigr)`);
    const parameterFlights = [
      ['k', String.raw`\mathbf k`, String.raw`\widehat{\mathbf k}`, '波矢 · 方向与间距', 750, 90],
      ['m', 'm', String.raw`\widehat m`, '调制度 · 条纹反差', 530, 80],
      ['phase', String.raw`\phi_j`, String.raw`\phi'_j+\widehat\phi_\Delta`, '已知相移 + 待求共同偏移', 1040, 230],
    ].map(([key, plain, estimated, caption, destination, width], b) => {
      const color = Chapter.parameterColors[key], x = 360 + b * 360;
      const old = mathAt(substitution, destination, 225, width, plain, { style: 'color:' + color });
      const filled = mathAt(substitution, destination, 225, width, estimated, { style: 'color:' + color });
      const path = create('path', { d: `M ${x} 405 Q ${x} 310 ${destination} 245`, class: 'matrix-link',
        stroke: color, pathLength: 1, 'stroke-dasharray': 1 }, substitution);
      const card = create('g', { 'data-parameter-card': key }, substitution);
      create('rect', { x: x - 145, y: 390, width: 290, height: 105, rx: 5, class: 'matrix-result-card', color }, card);
      label(card, x, 475, caption, { class: 'matrix-caption', fill: color });
      const token = create('g', { 'data-parameter-substitution': key, style: 'color:' + color }, substitution);
      mathAt(token, 0, 0, Math.max(250, width), estimated);
      return { key, x, destination, old, filled, path, token, card };
    });
    label(substitution, 720, 545, '符号代入用于说明模型；下面推导粗分离时，参数仍然未知。', { class: 'svg-muted' });

    mathAt(lessonGroups.model, 720, 215, 1330, Chapter.actualIlluminationTex);
    mathAt(lessonGroups.model, 720, 335, 1250, String.raw`\phi'_0=0,\qquad\phi'_1=\tfrac{2\pi}{3},\qquad\phi'_2=\tfrac{4\pi}{3}`);
    label(lessonGroups.model, 720, 430, '实际参数 k、m、φΔ 在这组三帧间相同；只有已知的 φ′ⱼ 改变。');
    label(lessonGroups.model, 720, 475, '以下使用无帽号的实际模型，并假设样品、OTF 与平均照明强度不变。', { class: 'svg-muted' });

    const expansion = lessonGroups.expansion;
    mathAt(expansion, 720, 95, 1340, String.raw`\theta=\tfrac{2\pi}{N}\mathbf k\cdot\mathbf r,\qquad I_j=1+\tfrac m2e^{i\theta}e^{i(\phi'_j+\phi_\Delta)}+\tfrac m2e^{-i\theta}e^{-i(\phi'_j+\phi_\Delta)}`);
    const phaseWhole = mathAt(expansion, 720, 205, 1200, String.raw`e^{\pm i(\phi'_j+\phi_\Delta)}`);
    const phaseParts = mathAt(expansion, 720, 205, 1200, String.raw`\underbrace{e^{\pm i\phi'_j}}_{\text{已知、逐帧变化}}\ \underbrace{e^{\pm i\phi_\Delta}}_{\text{未知、三帧共用}}`);
    mathAt(expansion, 720, 325, 1320, String.raw`d_j=(sI_j)*h\quad\xrightarrow{\ \mathcal F\ }\quad D_j(\mathbf f)=H(\mathbf f)\!\left[S(\mathbf f)+\tfrac m2e^{i\phi'_j}e^{i\phi_\Delta}S(\mathbf f-\mathbf k)+\tfrac m2e^{-i\phi'_j}e^{-i\phi_\Delta}S(\mathbf f+\mathbf k)\right]`, { class: 'provisional-compact-math' });
    label(expansion, 720, 455, '乘照明 → 样品频谱产生三份移频副本；检测 OTF 再乘到每一项。');

    const absorptionRows = Chapter.temporaryBands.map((band, b) => {
      const parent = lessonGroups.absorption, y = 130 + 130 * b;
      const block = create('g', { 'data-unknown-band': band.order, style: 'color:' + band.color }, parent);
      create('rect', { x: -360, y: -44, width: 720, height: 88, rx: 6, class: 'matrix-result-card', color: band.color }, block);
      mathAt(block, 0, 0, 700, band.rhs);
      const symbol = mathAt(parent, 600, y, 350, band.symbol, { style: 'color:' + band.color, 'data-absorbed-band': band.order });
      mathAt(parent, 1110, y, 430, b === 0 ? String.raw`\times 1` : b === 1 ? String.raw`\times\tfrac12e^{i\phi'_j}` : String.raw`\times\tfrac12e^{-i\phi'_j}`);
      return { block, symbol, y };
    });
    label(lessonGroups.absorption, 600, 55, '与帧号 j 无关的未知块 → 临时频带');
    label(lessonGroups.absorption, 1110, 55, '已知的逐帧系数');
    label(lessonGroups.absorption, 720, 510, 'c± = m exp(±iφΔ) 是复系数；k 仍保留在频带的平移地址里。', { class: 'svg-muted' });

    mathAt(lessonGroups.demix, 720, 95, 1360, Chapter.nominalObservationTex);
    const rootSum = mathAt(lessonGroups.demix, 720, 205, 1260, String.raw`\sum_{j=0}^{2}e^{i\ell\phi'_j}=\begin{cases}3,&\ell=0\\0,&\ell=\pm1,\pm2\end{cases}`);
    const phaseSums = [
      String.raw`\tfrac13\sum_jD_j=\widetilde A_0+0+0`,
      String.raw`\tfrac23\sum_je^{-i\phi'_j}D_j=0+\widetilde A_{+1}+0`,
      String.raw`\tfrac23\sum_je^{i\phi'_j}D_j=0+0+\widetilde A_{-1}`,
    ].map((tex, b) => mathAt(lessonGroups.demix, 720, 320 + b * 80, 1280, tex, { 'data-provisional-phase-sum': b, style: 'color:' + Chapter.temporaryBands[b].color }));

    const readyOperation = create('g', { transform: 'translate(720 85) scale(.72)', 'data-provisional-ready-operation': '' }, lessonGroups.ready);
    operation(readyOperation, true);
    Chapter.temporaryBands.forEach((band, b) => mathAt(lessonGroups.ready, 720, 235 + b * 90, 1350,
      band.symbol + '=' + band.rhs, { style: 'color:' + band.color }));
    label(lessonGroups.ready, 720, 520, '级次已分开；旁带幅相仍待校正，位置仍待估计。');

    const entry = document.getElementById('split-handoff-stage'), pair = options.sharedPair;
    const entryOperation = create('g', { transform: 'translate(720 85) scale(.72)', 'data-split-operation': '' }, entry);
    const formal = create('g', {}, entryOperation), nominal = create('g', {}, entryOperation);
    operation(formal); operation(nominal, true);
    const entryNote = label(entry, 720, 165, '沿用刚才推出的 Ũ，只用已知相对相移完成粗分离。');
    const negativePanel = create('g', { 'data-split-negative-panel': '', 'data-frequency-range': pair.range,
      'data-brightness-maximum': pair.maximum }, entry);
    create('rect', { x: -116, y: -116, width: 232, height: 232, rx: 4, class: 'camera-border', stroke: Chapter.temporaryBands[2].color }, negativePanel);
    create('path', { d: 'M -109 0 H 109 M 0 -109 V 109', class: 'frequency-axis' }, negativePanel);
    create('image', { x: -109, y: -109, width: 218, height: 218, href: pair.bandURLs[2],
      'data-split-band': '-1', class: 'spectrum-image' }, negativePanel);
    label(negativePanel, 0, 136, '检测频率 f · DFT 格', { class: 'svg-muted' });
    const branches = Chapter.temporaryBands.map(b => {
      const path = create('path', { class: 'matrix-link', stroke: b.color, 'data-split-branch': b.order }, entry);
      const title = create('g', { 'data-split-title': b.order, style: 'color:' + b.color }, entry);
      mathAt(title, 0, 0, 270, b.symbol);
      return { path, title };
    });
    // The rail uses the same split/settle/fade values as the spectrum actors.
    // Compile once; replays and scrubbing only change pose and opacity.
    const rail = create('svg', { viewBox: '0 0 1440 120', class: 'split-handoff-formulas', role: 'group',
      'aria-label': '从频带向量展开三个临时级次，再保留零级与正一级' });
    const railFormal = mathAt(rail, 720, 28, 210, String.raw`\mathbf A(\mathbf f)`);
    const railNominal = mathAt(rail, 720, 28, 210, String.raw`\widetilde{\mathbf A}(\mathbf f)`);
    const railBands = Chapter.temporaryBands.map(b => {
      const group = create('g', { 'data-split-formula': b.order, style: 'color:' + b.color }, rail);
      mathAt(group, 0, 28, 330, b.symbol);
      const rhs = mathAt(group, 0, 78, 470, '=' + b.rhs);
      return { group, rhs };
    });

    function resetEntry() {
      opacity(entry, 0); attr(entry, 'aria-hidden', true);
      for (const panel of pair.panels) { opacity(panel.group, 1); opacity(panel.heading, 1); }
    }
    function drawEntry(progress) {
      const s = Chapter.sharedEntryState(progress);
      opacity(entry, s.handoff); attr(entry, 'aria-hidden', s.handoff === 0);
      opacity(formal, (1 - s.nominal) * s.source); opacity(nominal, s.nominal * s.source);
      opacity(entryNote, s.nominal * (1 - s.split));
      for (const [b, band] of s.bands.entries()) {
        const branch = branches[b];
        attr(branch.title, 'transform', `translate(${band.titleX} ${band.titleY})`);
        opacity(branch.title, band.alpha * s.labels);
        attr(branch.path, 'd', `M 672.48 104 Q ${band.titleX} 158 ${band.titleX} ${band.titleY - 28}`);
        opacity(branch.path, band.alpha * (1 - s.pictures));
        if (b < 2) {
          const panel = pair.panels[b];
          attr(panel.group, 'transform', `translate(${band.x - panel.cx} 0) scale(1)`);
          attr(panel.group, 'data-center-x', band.x); attr(panel.group, 'data-center-y', panel.cy);
          opacity(panel.group, s.pictures); opacity(panel.heading, 1 - s.labels);
          panel.points.forEach(point => attr(point, 'opacity', 0));
        } else {
          attr(negativePanel, 'transform', `translate(${band.x} 385)`);
          opacity(negativePanel, s.pictures * s.negative);
          attr(negativePanel, 'aria-hidden', s.negative === 0 || s.pictures === 0);
        }
      }
      return s;
    }
    function drawEntryFormula(progress) {
      const s = Chapter.sharedEntryState(progress), container = document.getElementById('equation');
      if (!Array.from(container.children).includes(rail)) {
        Array.from(container.children).forEach(child => child.remove()); container.innerHTML = ''; container.appendChild(rail);
      }
      attr(container, 'data-formula-mode', 'shared-entry');
      opacity(railFormal, (1 - s.nominal) * s.source); opacity(railNominal, s.nominal * s.source);
      railBands.forEach(({ group, rhs }, b) => {
        const band = s.bands[b], x = 720 + (Chapter.temporaryBands[b].x - 720) * s.split
          + (Chapter.temporaryBands[b].finalX - Chapter.temporaryBands[b].x) * s.settle;
        attr(group, 'transform', `translate(${x} 0)`); opacity(group, band.alpha);
        attr(group, 'aria-hidden', band.alpha === 0); opacity(rhs, s.pictures);
      });
      return Chapter.sharedEntryFormulaAt(progress);
    }

    label(adopted, 720, 35, '仍用这九帧，各方向填入自己的估计参数。');
    reconstruction.parameters.forEach((p, d) => {
      const x = 285 + d * 435;
      label(adopted, x, 76, `方向 ${d + 1}：k̂ = (${compact(p.kx)}, ${compact(p.ky)}) · θ̂ = ${p.angle.toFixed(1)}°`);
      label(adopted, x, 106, `m̂ = ${compact(p.m)} · φ̂Δ = ${compact(p.phase)} rad`, { class: 'svg-muted', 'data-adopted-direction': d });
    });
    label(adopted, 720, 149, '先看方向 1：把相位与调制度填回 M。', { fill: M.colors[2] });
    const group = lesson.group;
    const mixing = create('g', {}, adopted), inverse = create('g', {}, adopted);
    label(mixing, 390, 195, 'M · 把三个来源混成一帧'); label(inverse, 1090, 195, 'U · 从三帧中取出一个来源');
    const matrixRows = [], inverseRows = [];
    for (let j = 0; j < 3; j++) {
      const mRow = create('g', { 'data-adopted-matrix-row': j }, mixing);
      const uRow = create('g', { 'data-adopted-weight-row': j }, inverse), y = 263 + j * 75;
      M.orders.forEach((order, b) => {
        const amplitude = order === 0 ? 1 : group.m / 2, phase = order * group.phases[j];
        const z = { re: amplitude * Math.cos(phase), im: amplitude * Math.sin(phase) };
        label(mRow, 205 + b * 185, y, complex(z), { class: 'adopted-coefficient', fill: M.colors[b],
          'data-adopted-matrix': `${j}:${b}`, 'data-re': z.re, 'data-im': z.im });
        const w = group.weights[j][b];
        label(uRow, 905 + b * 185, y, complex(w), { class: 'adopted-coefficient', fill: M.colors[j],
          'data-adopted-inverse': `${j}:${b}`, 'data-re': w.re, 'data-im': w.im });
      });
      matrixRows.push(mRow); inverseRows.push(uRow);
    }
    create('path', { d: 'M 120 217 H 105 V 436 H 120 M 666 217 H 681 V 436 H 666 M 820 217 H 805 V 436 H 820 M 1366 217 H 1381 V 436 H 1366', class: 'guide-line' }, adopted);
    const process = create('g', {}, adopted);
    formulaBox(process, 676, 270, 125, 74, String.raw`$$\longrightarrow$$`);
    label(process, 740, 353, '求逆', { fill: M.colors[2] });
    const application = label(adopted, 720, 508, '同一组三帧观测，分别算出三份正式频带。', { fill: M.colors[0] });
    return { resetEntry, drawEntry, drawEntryFormula, draw(id, progress) {
      if (id === 'provisional-split') {
        const s = Chapter.provisionalState(progress);
        attr(provisional, 'data-provisional-mode', s.mode); attr(provisional, 'data-parameter-focus', s.focus || '');
        opacity(transfer, s.handoff * s.tokens);
        moving.forEach(item => {
          const x = M.lerp(item.x, item.target, s.gather), y = M.lerp(item.y, 260, s.gather);
          const scale = item.kind === 'equals' || item.kind === 'multiply' ? 1 : M.lerp(1, .32, s.gather);
          attr(item.group, 'transform', `translate(${x} ${y}) scale(${scale})`);
          // Let the individual entries disappear before their paths converge;
          // the compact expression then takes over at the same endpoint.
          opacity(item.group, 1 - M.ramp(s.gather, .45, .95));
        });
        opacity(equation, s.compact);
        attr(equation, 'transform', `translate(720 ${s.equationPose.y}) scale(${s.equationPose.scale})`);
        for (const [key, node] of Object.entries(lessonGroups)) {
          const alpha = s[key];
          opacity(node, alpha); attr(node, 'aria-hidden', alpha === 0);
        }
        opacity(failure, s.failure); attr(failure, 'aria-hidden', s.failure === 0); failureView.draw(s.prelude);
        const filled = M.ramp(s.insert, .80, 1);
        opacity(initialPrefix, 1 - filled); opacity(estimatedPrefix, filled);
        parameterFlights.forEach(item => {
          attr(item.token, 'transform', `translate(${M.lerp(item.x, item.destination, s.insert)} ${M.lerp(425, 225, s.insert)})`);
          opacity(item.token, 1 - filled); opacity(item.old, 1 - s.insert); opacity(item.filled, filled);
          opacity(item.card, 1 - s.insert); opacity(item.path, 1 - filled);
          attr(item.path, 'stroke-dashoffset', 1 - s.insert);
          attr(item.token, 'data-insertion-progress', s.insert);
        });
        opacity(phaseWhole, 1 - s.phaseFactor); opacity(phaseParts, s.phaseFactor);
        absorptionRows.forEach(item => {
          attr(item.block, 'transform', `translate(${600 - 90 * s.absorb} ${item.y}) scale(${1 - .25 * s.absorb})`);
          opacity(item.block, 1 - s.absorb); opacity(item.symbol, s.absorb);
        });
        opacity(rootSum, s.orthogonality);
        phaseSums.forEach((node, b) => opacity(node, M.ramp(s.contentProgress, .82 + b * .025, .85 + b * .025)));
      } else {
        matrixRows.forEach((g, j) => opacity(g, M.ramp(progress, .12 + j * .12, .24 + j * .12)));
        inverseRows.forEach((g, j) => opacity(g, M.ramp(progress, .56 + j * .10, .66 + j * .10)));
        opacity(process, M.ramp(progress, .48, .60)); opacity(application, M.ramp(progress, .88, 1));

      }
    } };
  }
  root.SIMMotionParameterView = { create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
