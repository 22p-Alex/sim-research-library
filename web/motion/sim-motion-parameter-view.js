/* Two host-owned handoffs around the reusable parameter chapter.
 * Every number comes from the same provisional split / adopted pipeline. */
(function (root) {
  'use strict';
  function createNominalFailureView(options) {
    const { parent, lesson, create, attr, opacity, formulaBox, imageURL, spectrumURL, maximum, compact } = options;
    const Chapter = root.SIMMotionParameterChapter, M = root.SIMMotion, data = Chapter.createNominalFailure(lesson);
    const blue = '#7fbbe8', orange = '#efb879', red = '#e77c78', purple = '#b7a5eb';
    const label = (p, x, y, text, extra = {}) => create('text', { x, y, class: 'svg-small', 'text-anchor': 'middle', ...extra }, p, text);
    const math = (p, x, y, width, tex, extra = {}) => formulaBox(p, x - width / 2, y - 35, width, 70, '$$' + tex + '$$', extra);
    math(parent, 720, 85, 1100, String.raw`\mathbf A_{\mathrm{nom}}(\mathbf f)=U_{\mathrm{nom}}\cdot\mathbf D(\mathbf f)`);
    math(parent, 720, 150, 1240, Chapter.provisionalFormulas.nominalPlug.slice(2, -2));
    const geometry = create('g', { 'data-nominal-geometry': '' }, parent);
    label(geometry, 305, 217, '亚像素错位 · 放大公共区', { fill: orange });
    const defs = create('defs', {}, geometry);
    const clip = create('clipPath', { id: 'nominal-band-clip', clipPathUnits: 'userSpaceOnUse' }, defs);
    create('circle', { r: 80 }, clip);
    const lensClip = create('clipPath', { id: 'nominal-detail-clip', clipPathUnits: 'userSpaceOnUse' }, defs);
    create('circle', { cx: 465, cy: 345, r: 75 }, lensClip);
    const scale = maximum(lesson.group.separated);
    const disks = [0, 1].map((b, i) => {
      const group = create('g', { 'data-nominal-disk': i ? 'side' : 'zero' }, geometry);
      create('circle', { r: 82, fill: 'none', stroke: i ? orange : blue, 'stroke-width': 1.7 }, group);
      create('image', { x: -80, y: -80, width: 160, height: 160, 'clip-path': 'url(#nominal-band-clip)', opacity: .65,
        href: spectrumURL(lesson.group.separated[b], scale, i ? [220, 150, 70] : [100, 176, 230], 20) }, group);
      return group;
    });
    create('path', { d: 'M 300 312 L 394 288', class: 'matrix-link', stroke: orange, 'stroke-dasharray': '4 4' }, geometry);
    create('circle', { cx: 465, cy: 345, r: 76, fill: '#091115', stroke: '#8fa4aa' }, geometry);
    const q = data.probes[0], n = data.n, fieldMax = Math.max(...data.probes.map(p => p.energy), 1);
    const sample = (field, fx, fy) => {
      const x = Math.floor(fx), y = Math.floor(fy), dx = fx - x, dy = fy - y;
      let re = 0, im = 0;
      for (let b = 0; b < 2; b++) for (let a = 0; a < 2; a++) {
        const i = ((y + b + n) % n) * n + ((x + a + n) % n), w = (a ? dx : 1 - dx) * (b ? dy : 1 - dy);
        re += field.re[i] * w; im += field.im[i] * w;
      }
      return Math.hypot(re, im);
    };
    const lens = data.fields.map((field, b) => {
      const href = imageURL((x, y, size) => {
        const v = Math.min(1, Math.log1p(sample(field, q.qx + 1.8 * (x / size - .5), q.qy + 1.8 * (y / size - .5))) / Math.log1p(fieldMax));
        return (b ? [225, 150, 65] : [95, 178, 237]).map((c, j) => [9, 17, 23][j] + c * v);
      }, 96);
      return create('image', { x: 390, y: 270, width: 150, height: 150, href, 'clip-path': 'url(#nominal-detail-clip)', 'data-nominal-texture': b }, geometry);
    });
    label(geometry, 255, 465, '蓝色 0 级 · 橙色 +1 级', { class: 'svg-muted' });
    label(geometry, 465, 465, 'Δk = 0.3 格', { fill: orange });
    const phase = create('g', { 'data-nominal-phase-view': '' }, parent);
    label(phase, 310, 217, '先对齐同一 q，再看复数方向', { fill: purple });
    const cx = 310, cy = 345, radius = 75;
    create('circle', { cx, cy, r: radius, fill: 'none', stroke: '#8fa4aa55' }, phase);
    const phasors = [blue, orange].map((stroke, b) => create('path', { stroke, fill: 'none', 'stroke-width': 3,
      'data-nominal-phasor': b ? 'side' : 'zero' }, phase));
    const result = create('path', { stroke: red, fill: 'none', 'stroke-width': 3, 'data-nominal-sum': '' }, phase);
    const cancel = create('circle', { cx, cy, r: 7, fill: red, 'data-nominal-cancellation': '' }, phase);
    const turningFormula = math(phase, 310, 470, 500, String.raw`z+e^{i\delta\phi}z`);
    const cancelledFormula = math(phase, 310, 470, 500, String.raw`z+e^{i\pi}z=0`);
    label(phase, 310, 520, '单位化方向；π 为受控反相示例', { class: 'svg-muted' });
    const error = create('g', { 'data-nominal-residual-view': '' }, parent);
    label(error, 310, 217, '标称重建 − 匹配重建', { fill: orange });
    const errorURL = imageURL((x, y, size) => {
      const v = data.residual[Math.floor(y * data.size / size) * data.size + Math.floor(x * data.size / size)] / data.residualMaximum;
      return v < 0 ? [12 + 165 * -v, 19 + 110 * -v, 25 + 215 * -v] : [12 + 225 * v, 19 + 150 * v, 25 + 70 * v];
    }, 192);
    create('image', { x: 200, y: 235, width: 220, height: 220, href: errorURL, 'data-nominal-residual-image': '' }, error);
    label(error, 310, 495, '橙色正误差 · 紫色负误差', { class: 'svg-muted' });
    const pictures = create('g', { 'data-nominal-pictures': '' }, parent);
    const vectorMinimum = data.images[1].reduce((minimum, value) => Math.min(minimum, value), 0);
    const imageURLs = data.images.map(pixels => imageURL((x, y, size) => {
      const v = Math.max(0, Math.min(1, pixels[Math.floor(y * data.size / size) * data.size + Math.floor(x * data.size / size)] / data.maximum));
      return [9 + 210 * v, 17 + 220 * v, 23 + 225 * v];
    }, 192));
    label(pictures, 780, 217, '匹配参数对照', { fill: blue });
    label(pictures, 1090, 217, '直接代入标称值', { fill: orange });
    [670, 980].forEach(x => create('rect', { x, y: 235, width: 220, height: 220, class: 'camera-border' }, pictures));
    create('image', { x: 670, y: 235, width: 220, height: 220, href: imageURLs[0] }, pictures);
    const images = imageURLs.map((href, b) => create('image', { x: 980, y: 235, width: 220, height: 220, href, 'data-nominal-reconstruction': b }, pictures));
    const profile = create('g', { 'data-nominal-profile': '' }, pictures), residualProfile = create('g', { 'data-nominal-residual-profile': '' }, pictures);
    const width = 530, height = 48, px = 670, py = 475, range = data.maximum - data.minimum;
    const zero = py + height * data.maximum / range;
    create('path', { d: `M ${px} ${zero} H ${px + width}`, stroke: '#8fa4aa', 'stroke-dasharray': '3 3' }, profile);
    const curves = data.images.map((pixels, b) => {
      const d = Array.from({ length: data.size }, (_, x) => `${x ? 'L' : 'M'} ${px + x * width / (data.size - 1)} ${py + height * (data.maximum - pixels[data.profileY * data.size + x]) / range}`).join(' ');
      return create('path', { d, fill: 'none', stroke: b ? red : blue, 'stroke-width': 1.4, 'data-nominal-profile-curve': b }, profile);
    });
    create('path', { d: `M ${px} ${py + height / 2} H ${px + width}`, stroke: '#8fa4aa', 'stroke-dasharray': '3 3' }, residualProfile);
    const rd = Array.from({ length: data.size }, (_, x) => `${x ? 'L' : 'M'} ${px + x * width / (data.size - 1)} ${py + height / 2 - height / 2 * data.residual[data.residualProfileY * data.size + x] / data.residualMaximum}`).join(' ');
    create('path', { d: rd, fill: 'none', stroke: purple, 'stroke-width': 1.4 }, residualProfile);
    const profileNote = label(pictures, 935, 547, '', { class: 'svg-muted', 'data-nominal-profile-note': '' });
    attr(parent, 'data-nominal-source', 'controlled-remix-of-adopted-bands');
    attr(parent, 'data-negative-minimum', data.minimum); attr(parent, 'data-residual-peak-bin', data.residualPeakBin);
    return { draw(s) {
      opacity(geometry, s.vectorView); opacity(phase, s.phaseView); opacity(error, s.residualView); opacity(pictures, s.diagram);
      attr(disks[0], 'transform', 'translate(242 345)');
      const kx = (data.k[0] + data.delta * s.misregister) * s.relocate, ky = data.k[1] * s.relocate;
      attr(disks[1], 'transform', `translate(${242 - 8.5 * kx} ${345 - 8.5 * ky})`);
      attr(disks[1], 'data-shift-x', -kx); attr(disks[1], 'data-shift-y', -ky);
      opacity(lens[0], .85); opacity(lens[1], .55 * (1 - s.misregister)); opacity(lens[2], .55 * s.misregister);
      const angles = [q.angle, q.angle + data.phase * s.phase];
      phasors.forEach((arrow, b) => {
        const angle = angles[b], dx = radius * Math.cos(angle), dy = -radius * Math.sin(angle);
        attr(arrow, 'd', `M ${cx} ${cy} l ${dx} ${dy} m ${-9 * Math.cos(angle - .5)} ${9 * Math.sin(angle - .5)} l ${9 * Math.cos(angle - .5)} ${-9 * Math.sin(angle - .5)} l ${-9 * Math.cos(angle + .5)} ${9 * Math.sin(angle + .5)}`);
        attr(arrow, 'data-angle', angle);
      });
      attr(result, 'd', `M ${cx} ${cy} l ${radius / 2 * (Math.cos(angles[0]) + Math.cos(angles[1]))} ${-radius / 2 * (Math.sin(angles[0]) + Math.sin(angles[1]))}`);
      opacity(cancel, s.negative);
      opacity(turningFormula, 1 - s.cancellation); opacity(cancelledFormula, s.cancellation);
      const alphas = [(1 - s.misregister) * (1 - s.phase), s.misregister * (1 - s.phase), s.phase];
      images.forEach((image, b) => opacity(image, alphas[b])); curves.forEach((curve, b) => opacity(curve, b === 0 ? .65 : alphas[b]));
      opacity(profile, 1 - s.residualView); opacity(residualProfile, s.residualView);
      const note = s.residualView > 0 ? `误差最强行 y=${data.residualProfileY} · 主频 ${data.residualPeakBin} 格 · 带符号误差`
        : `同一强度标尺 · y=${data.profileY} 剖面保留负值 · 最小值 ${compact(s.phase > 0 ? data.minimum : vectorMinimum)}`;
      if (profileNote.textContent !== note) profileNote.textContent = note;
      attr(parent, 'data-frequency-error', data.delta * s.misregister); attr(parent, 'data-phase-loss', s.phase);
    } };
  }
  function create(options) {
    const { reconstruction, lesson, create, attr, opacity, formulaBox, complex, compact, arrowPath } = options;
    const M = root.SIMMotion, Chapter = root.SIMMotionParameterChapter, document = options.document || root.document;
    const provisional = document.getElementById('provisional-stage'), adopted = document.getElementById('adopted-stage');
    const label = (parent, x, y, text, extra = {}) => create('text', { x, y, class: 'svg-small', 'text-anchor': 'middle', ...extra }, parent, text);
    const note=(...args)=>{const node=label(...args);attr(node,'display','none');attr(node,'data-scene-note','');return node;};
    const mathAt = (parent, x, y, width, tex, extra = {}) => formulaBox(parent, x - width / 2, y - 40, width, 80, '$$' + tex + '$$', extra);
    // Explicit token anchors let A(f) continue from exactly the same position.
    function operation(parent, temporary = false, mutable = false) {
      const part = (key, x, width, tex) => mathAt(parent, x, 0, width, tex, { 'data-operation-part': key, transform: 'translate(0 0)' });
      const source = part('source', -66, 145, temporary ? String.raw`\widetilde{\mathbf A}(\mathbf f)` : String.raw`\mathbf A(\mathbf f)`);
      const equals = part('equals', -5.5, 35, '=');
      const weight = part('weight', 37.5, 60, temporary ? String.raw`\widetilde U` : 'U');
      const multiply = part('multiply', 69.5, 30, String.raw`\cdot`);
      const observations = part('observations', 129.2, 120, String.raw`\mathbf D(\mathbf f)`);
      const temporarySource = mutable ? part('temporary-source', -66, 145, String.raw`\widetilde{\mathbf A}(\mathbf f)`) : null;
      const temporaryWeight = mutable ? part('temporary-weight', 37.5, 60, String.raw`\widetilde U`) : null;
      return { source, weight, temporarySource, temporaryWeight, equals, multiply, observations };
    }
    // Narrate inside the row that is being inspected. The original matrix
    // stays intact, and each row's coefficients leave before its message enters.
    const rowInspection = create('g', { 'data-provisional-row-inspection': '' }, provisional);
    const inspectedRows = M.orders.map((order, row) => {
      const y = 307 + row * 76, color = M.colors[row];
      const highlight = create('rect', { x: 543, y: y - 34, width: 514, height: 68, rx: 5,
        fill: color + '15', stroke: color, 'stroke-width': 2, 'data-inspection-row-box': row }, rowInspection);
      const tex = row === 0 ? String.raw`\text{已知常数，直接可算}`
        : String.raw`\text{需要知道 }{\color{#b7a5eb}\phi_j}\text{ 和 }{\color{#efb879}m}`;
      const message = formulaBox(rowInspection, 560, y - 32, 480, 64, '$$' + tex + '$$',
        { 'data-inspection-row-message': row, class: 'provisional-row-message', style: 'color:' + color });
      const weights = options.inverseHandoff.filter(item => item.kind === 'weight' && item.row === row);
      return { highlight, message, weights };
    });
    // Only the gather beat transfers individual entries. Brackets and labels
    // remain visible throughout row inspection and fade when gathering starts.
    const transfer = create('g', { 'data-provisional-transfer': '' }, provisional);
    const moving = options.inverseHandoff.map(item => {
      const key = item.kind === 'weight' ? item.element.getAttribute('data-resolved-weight') : String(item.row ?? '');
      const group = create('g', { 'data-provisional-token': item.kind + ':' + key }, transfer);
      const formula = formulaBox(group, -item.width / 2, -item.height / 2, item.width, item.height, '$$' + item.tex + '$$', { class: 'provisional-transfer-math' });
      if (item.kind === 'weight' || item.kind === 'source') attr(formula, 'style', 'color:' + M.colors[item.row]);
      const target = { source: 672.48, equals: 716, weight: 747, multiply: 770, observation: 813 }[item.kind];
      return { ...item, group, target };
    });
    const equation = create('g', { transform: 'translate(720 85) scale(.72)', 'data-provisional-operation': '' }, provisional);
    const operationTokens = operation(equation, false, true);
    const lessonGroups = Object.fromEntries(['whyEstimate', 'actualWeights', 'coefficientFocus', 'ready'].map(key =>
      [key, create('g', { 'data-provisional-lesson': key }, provisional)]));
    const why = lessonGroups.whyEstimate;
    // The equation stays still; the corresponding observable changes below it.
    const illuminationTokens = [
      ['prefix', 525, 230, String.raw`I_j(\mathbf r)=1+`, ''], ['m', 650, 50, 'm', Chapter.parameterColors.m],
      ['cos', 710, 100, String.raw`\cos\!\Bigl(`, ''], ['frequency', 774, 75, String.raw`\frac{2\pi}{N}`, ''],
      ['k', 828, 50, String.raw`\mathbf k`, Chapter.parameterColors.k], ['position', 889, 85, String.raw`\cdot\mathbf r+`, ''],
      ['phase', 961, 60, String.raw`\phi_j`, Chapter.parameterColors.phase], ['close', 1008, 30, String.raw`\Bigr)`, ''],
    ].map(([key, x, width, tex, color]) => {
      const group = create('g', { 'data-illumination-token': key, style: color ? 'color:' + color : '', class: 'provisional-illumination-token' }, why);
      mathAt(group, 0, 0, width, tex); return { key, x, group };
    });
    const kReason = note(why, 720, 365, '光束夹角、光路对准和像素标定可能偏离设定，实际条纹的方向与间距也会改变。',
      { 'data-parameter-reason': 'k', class: 'provisional-parameter-reason' });
    const amplitudeReason = note(why, 720, 365, '光强与偏振失配会改变 m，光程漂移会改变 φⱼ；实际幅相不一定等于控制指令。',
      { 'data-parameter-reason': 'amplitude-phase', class: 'provisional-parameter-reason' });
    const illuminationView=root.SIMIlluminationParameters.create({...options,parent:why});
    const failure = create('g', { 'data-provisional-lesson': 'nominalFailure' }, provisional);
    const failureView = createNominalFailureView({ ...options, parent: failure });

    // The same selected matrix cell is lifted out, then generalized to u±1,j.
    // Coefficient pieces remain persistent actors throughout expansion/splitting.
    const actual = lessonGroups.actualWeights, factorColors = Chapter.weightFactorColors;
    const matrixScaffold = create('g', { 'data-actual-U-scaffold': '' }, actual);
    const matrixName = mathAt(matrixScaffold, 420, 340, 100, 'U');
    const matrixEquals = create('g', { 'data-weight-matrix-equals': '' }, actual);
    mathAt(matrixEquals, 0, 0, 60, '=');
    create('path', { d: 'M 545 220 H 535 V 460 H 545 M 1085 220 H 1095 V 460 H 1085', class: 'matrix-bracket' }, matrixScaffold);
    const productScaffold = create('g', { 'data-weight-matrix-product': '' }, actual);
    create('path', { d: 'M 185 220 H 175 V 460 H 185 M 405 220 H 415 V 460 H 405 M 1170 220 H 1160 V 460 H 1170 M 1355 220 H 1365 V 460 H 1355', class: 'matrix-bracket' }, productScaffold);
    mathAt(productScaffold, 1125, 340, 55, String.raw`\cdot`);
    const productSources = M.orders.map((order, row) => {
      const group = create('g', { 'data-weight-matrix-source': order, class: 'actual-weight-symbol' }, actual);
      const source = mathAt(group, 0, 0, 225, 'A_{' + (order > 0 ? '+' + order : order) + '}(\\mathbf f)', { style: 'color:' + M.colors[row], 'data-row-source-variant': 'actual' });
      const temporary = mathAt(group, 0, 0, 225, String.raw`\widetilde A_{` + (order > 0 ? '+' + order : order) + String.raw`}(\mathbf f)`, { style: 'color:' + M.colors[row], 'data-row-source-variant': 'temporary' });
      return { group, row, source, temporary };
    });
    const productObservations = [0, 1, 2].map(column => {
      const group = create('g', { 'data-weight-matrix-observation': column, class: 'actual-weight-symbol' }, actual);
      mathAt(group, 0, 0, 210, 'D_' + column + '(\\mathbf f)'); return { group, column };
    });
    const productFocus = create('g', { 'data-weight-row-focus': '' }, actual);
    for (const [x, y, width, height] of [[545, 306, 540, 68], [185, 306, 220, 68], [1170, 226, 185, 228]]) {
      create('rect', { x, y, width, height, rx: 5, fill: '#b7a5eb15', stroke: M.colors[1], 'stroke-width': 2 }, productFocus);
    }
    const rowOperators = create('g', { 'data-weight-row-operators': '' }, actual);
    [620, 950].forEach(x => mathAt(rowOperators, x, 300, 50, '+'));
    const rowNote = note(actual, 720, 515, '+1 行的三个权重 × 对应的三帧观测，再相加 → A₊₁(f)', { 'data-weight-row-note': '' });
    const matrixCells = Chapter.actualWeightCells.map(cell => {
      const group = create('g', { 'data-actual-U-cell': cell.row + ':' + cell.column, class: 'actual-weight-symbol' }, actual);
      const indexed = mathAt(group, 0, 0, 180, cell.tex, { style: 'color:' + M.colors[cell.row] });
      const generic = cell.selected ? mathAt(group, 0, 0, 180, String.raw`u_{\pm1,j}`, { 'data-actual-generic-weight': '' }) : null;
      const temporaryTex = String.raw`\widetilde ` + cell.tex;
      const factored = cell.row === 1 ? mathAt(group, 0, 0, 180,
        String.raw`\frac{{\color{#7ad5cd}` + temporaryTex + String.raw`}}{{\color{#efb879}m e^{i\phi_\Delta}}}`,
        { 'data-row-weight-variant': 'factored' }) : null;
      const temporary = mathAt(group, 0, 0, 180, temporaryTex,
        { style: 'color:' + factorColors.known, 'data-row-weight-variant': 'temporary' });
      const focus = cell.row === 1 ? create('rect', { x: -57.5, y: -47, width: 115, height: 94, rx: 5,
        fill: 'none', stroke: factorColors.known, 'stroke-width': 1.5, 'data-row-coefficient-focus': cell.column }, group) : null;
      return { ...cell, group, indexed, generic, factored, temporary, focus };
    });
    const selectionBox = create('rect', { x: 723, y: 306, width: 164, height: 68, rx: 5,
      fill: '#b7a5eb15', stroke: M.colors[1], 'stroke-width': 2, 'data-actual-U-selection': '' }, actual);
    const coefficient = create('g', { 'data-actual-weight-coefficient': '' }, actual);
    const coefficientTokens = {};
    const coefficientToken = (key, tex, width, color = '') => {
      const group = create('g', { 'data-weight-coefficient-token': key, class: 'weight-coefficient-token', style: color ? 'color:' + color : '' }, coefficient);
      mathAt(group, 0, 0, width, tex); coefficientTokens[key] = group; return group;
    };
    coefficientToken('equals', '=', 60);
    coefficientToken('rawAmplitude', String.raw`\frac{2}{3{\color{#efb879}m}}`, 160);
    coefficientToken('knownAmplitude', String.raw`\frac23`, 120, factorColors.known);
    coefficientToken('unknownAmplitude', String.raw`\frac1m`, 120, factorColors.unknown);
    coefficientToken('knownE', 'e', 70);
    coefficientToken('knownSign', String.raw`\mp i`, 100);
    coefficientToken('rawPhase', String.raw`\phi_j`, 110, Chapter.parameterColors.phase);
    coefficientToken('leftParenthesis', '(', 50);
    coefficientToken('knownPhase', String.raw`\phi'_j`, 120, factorColors.known);
    coefficientToken('phasePlus', '+', 50);
    coefficientToken('unknownPhase', String.raw`\phi_\Delta`, 120, factorColors.unknown);
    coefficientToken('rightParenthesis', ')', 50);
    coefficientToken('unknownE', 'e', 70, factorColors.unknown);
    coefficientToken('unknownSign', String.raw`\mp i`, 100, factorColors.unknown);
    coefficientToken('factorMultiply', String.raw`\cdot`, 60);
    const factorLabels = create('g', { 'data-weight-factor-labels': '' }, actual);
    create('path', { d: 'M 500 335 V 347 H 780 V 335', fill: 'none', stroke: factorColors.unknown, 'stroke-width': 1.5 }, factorLabels);
    create('path', { d: 'M 865 335 V 347 H 1170 V 335', fill: 'none', stroke: factorColors.known, 'stroke-width': 1.5 }, factorLabels);
    label(factorLabels, 640, 395, '未知部分', { fill: factorColors.unknown, class: 'weight-factor-label' });
    label(factorLabels, 1017.5, 395, '已知部分', { fill: factorColors.known, class: 'weight-factor-label' });
    note(factorLabels, 640, 432, 'm、φΔ：三帧共用', { class: 'svg-muted' });
    note(factorLabels, 1017.5, 432, '2/3、φ′ⱼ：相对相移已知', { class: 'svg-muted' });
    mathAt(factorLabels, 720, 505, 1050, String.raw`\phi'_j=\frac{2\pi j}{3},\qquad j=0,1,2`);
    const temporaryMatrixNote = note(actual, 720, 520, '0、+1、−1 三行：每一行都对同一组三帧观测做乘加。', { 'data-temporary-matrix-note': '' });
    function drawActualWeights(state, detailState) {
      const notation = detailState.notation, rowMove = state.rowMove * (1 - notation.returnRow);
      const scaffold = state.matrix + notation.scaffold;
      opacity(matrixScaffold, scaffold); opacity(selectionBox, state.highlight);
      attr(matrixScaffold, 'aria-hidden', scaffold === 0);
      opacity(matrixName, state.matrixName);
      const setVisible = (node, alpha) => { opacity(node, alpha); attr(node, 'aria-hidden', alpha === 0); };
      // Collect at the central operation, using its exact glyph anchors.
      const collect = (node, x, y, target, scale) => {
        const end = detailState.operationPose;
        const g = notation.gather, suffix = scale !== undefined || g > 0 ? ` scale(${M.lerp(scale ?? 1, .12, g)})` : '';
        attr(node, 'transform', `translate(${M.lerp(x, end.x + end.scale * target, g)} ${M.lerp(y, end.y, g)})${suffix}`);
      };
      const rowAlpha = (state.matrix + state.rowTerms);
      setVisible(matrixEquals, rowAlpha);
      collect(matrixEquals, M.lerp(490, 310, rowMove), M.lerp(340, 300, rowMove), -5.5);
      setVisible(productScaffold, state.vectors * scaffold);
      setVisible(productFocus, state.rowFocus);
      setVisible(rowOperators, state.rowOperators * (1 - notation.intro));
      setVisible(rowNote, state.rowNote);
      setVisible(temporaryMatrixNote, notation.otherRows * (1 - notation.gather));
      productSources.forEach(({ group, row, source, temporary }) => {
        const move = row === 1 ? rowMove : 0;
        collect(group, M.lerp(295, 150, move), M.lerp(260 + row * 80, 300, move), -66);
        setVisible(group, state.vectors * (row === 1 ? rowAlpha : state.matrix + notation.otherRows));
        setVisible(source, 1 - detailState.outputScale);
        setVisible(temporary, detailState.outputScale);
      });
      productObservations.forEach(({ group, column }) => {
        collect(group, M.lerp(1260, 520 + column * 327.5, rowMove), M.lerp(260 + column * 80, 300, rowMove), 129.2);
        setVisible(group, state.vectors * rowAlpha);
      });
      matrixCells.forEach(cell => {
        const origin = cell.selected ? state.selectedPose : { x: cell.x, y: cell.y, scale: 1 };
        const move = cell.row === 1 ? rowMove : 0;
        const pose = { x: M.lerp(origin.x, 410 + cell.column * 327.5, move), y: M.lerp(origin.y, 300, move), scale: origin.scale };
        collect(cell.group, pose.x, pose.y, 37.5, pose.scale);
        setVisible(cell.group, cell.selected ? 1 : cell.row === 1 ? rowAlpha : state.matrix + notation.otherRows);
        const replacement = cell.row === 1 ? (cell.selected ? detailState.selectedCoefficient : detailState.coefficientScale) : detailState.outputScale;
        setVisible(cell.indexed, (cell.selected ? state.indexed : 1) * (1 - replacement));
        setVisible(cell.temporary, detailState.outputScale);
        if (cell.factored) {
          setVisible(cell.factored, replacement * (1 - detailState.outputScale));
          setVisible(cell.focus, (cell.selected ? detailState.nameKnown : detailState.coefficientScale) * (1 - notation.intro));
        }
        if (cell.generic) opacity(cell.generic, state.generic);
      });
      opacity(coefficient, state.rhs);
      attr(coefficient, 'aria-hidden', state.rhs === 0);
      attr(coefficient, 'transform', `translate(300 285) scale(${M.lerp(1, .08, state.collapse)}) translate(-300 -285)`);
      const move = state.factorMove, spread = state.phaseSpread, arc = 50 * Math.sin(Math.PI * move);
      const pose = (key, x, y, alpha = 1, scale = 1) => {
        const node = coefficientTokens[key];
        attr(node, 'transform', `translate(${x} ${y}) scale(${scale})`); opacity(node, alpha);
        attr(node, 'aria-hidden', alpha === 0);
      };
      pose('equals', 430, 285);
      pose('rawAmplitude', 550, 285, state.rawAmplitude);
      pose('unknownAmplitude', M.lerp(530, 550, move), 285 + arc, state.splitAmplitudes);
      pose('knownAmplitude', M.lerp(595, 920, move), 285 - arc, state.splitAmplitudes);
      pose('knownE', M.lerp(660, 1025, move), 285 - arc);
      pose('knownSign', M.lerp(700, 1060, move), 260 - arc, 1, .68);
      pose('rawPhase', 750, 260, state.rawPhase, .68);
      const brackets = state.expandedPhase * state.parentheses;
      pose('leftParenthesis', M.lerp(720, 735, spread), 260, brackets, .68);
      pose('knownPhase', M.lerp(M.lerp(750, 770, spread), 1110, move), 260 - arc, state.expandedPhase, .68);
      pose('phasePlus', M.lerp(785, 820, spread), 260, brackets, .68);
      pose('unknownPhase', M.lerp(M.lerp(830, 865, spread), 735, move), 260 + arc, state.expandedPhase, .68);
      pose('rightParenthesis', M.lerp(860, 910, spread), 260, brackets, .68);
      pose('unknownE', M.lerp(780, 650, move), 285 + arc, state.unknownExponential);
      pose('unknownSign', M.lerp(815, 685, move), 260 + arc, state.unknownExponential, .68);
      pose('factorMultiply', 820, 285, state.multiply);
      for (const key of ['knownE', 'knownSign']) attr(coefficientTokens[key], 'style', state.expandedPhase > 0 ? 'color:' + factorColors.known : 'color:#dce6e1');
      opacity(factorLabels, state.labels); attr(factorLabels, 'aria-hidden', state.labels === 0);
    }

    // Explanations stay below the assembled row; the substitutions themselves
    // happen inside the original weight actors, without replacing the row.
    const detail = lessonGroups.coefficientFocus;
    const knownDefinition = mathAt(detail, 720, 420, 1100, String.raw`\widetilde u_{\pm1,j}:={\color{#7ad5cd}\frac23e^{\mp i\phi'_j}}`, { 'data-known-weight-definition': '' });
    const coefficientRelation = mathAt(detail, 720, 420, 1200, Chapter.provisionalFormulas.coefficientScale.slice(2, -2), { 'data-coefficient-relation': '' });
    const propagated = mathAt(detail, 720, 420, 1300, Chapter.provisionalFormulas.outputScale.slice(2, -2), { 'data-coefficient-output': '' });
    const notationKey = create('g', { 'data-provisional-notation': '' }, detail);
    note(notationKey, 720, 495, Chapter.notation.tilde);
    note(notationKey, 720, 533, 'ũ：已知权重　·　Ũ：由 ũ 组成　·　Ã：临时输出，零级 Ã₀=A₀', { class: 'svg-muted' });

    const indexDefinition = mathAt(provisional, 720, 155, 1250, Chapter.temporaryIndexTex, { 'data-temporary-index-definition': '' });
    // Open the existing D token into H M [S0,S+,S-]^T. These same S and
    // diagonal-factor actors subsequently become the three band equations.
    const observationStage = create('g', { 'data-observation-expansion': '' }, provisional);
    const actor = (key, tex, width = 220, color = '') => {
      const group = create('g', { 'data-observation-actor': key, style: color ? 'color:' + color : '' }, observationStage);
      mathAt(group, 0, 0, width, tex); return group;
    };
    const mixingActor = actor('mixing', 'M', 100);
    const samples = [String.raw`S(\mathbf f)`, String.raw`S(\mathbf f-\mathbf k)`, String.raw`S(\mathbf f+\mathbf k)`];
    const factors = ['1', String.raw`m e^{i\phi_\Delta}`, String.raw`m e^{-i\phi_\Delta}`];
    const bandActors = Chapter.temporaryBands.map((band, b) => ({
      sample: actor('sample:' + band.order, samples[b], 300, band.color),
      otf: actor('otf:' + band.order, String.raw`H(\mathbf f)`, 170),
      factor: actor('factor:' + band.order, factors[b], 230, band.color),
      output: actor('output:' + band.order, band.symbol, 250, band.color),
      equals: actor('equals:' + band.order, '=', 50),
    }));
    const spectrumBrackets = create('g', { 'data-observation-spectrum-brackets': '' }, observationStage);
    create('path', { d: 'M -140 -118 H -150 V 118 H -140 M 140 -118 H 150 V 118 H 140', class: 'matrix-bracket' }, spectrumBrackets);
    const responseScaffold = create('g', { 'data-observation-response-matrix': '' }, observationStage);
    create('path', { d: 'M 550 167 H 540 V 403 H 550 M 1000 167 H 1010 V 403 H 1000', class: 'matrix-bracket' }, responseScaffold);
    for (let b = 0; b < 3; b++) for (let j = 0; j < 3; j++) if (b !== j)
      mathAt(responseScaffold, 620 + 155 * j, 205 + 80 * b, 70, '0');
    const observationNote = note(observationStage, 720, 485, 'H：物镜传递　·　M：原照明混合矩阵　·　右列：三份样品频谱', { 'data-observation-note': '' });
    const responseNote = note(observationStage, 720, 485, 'ŨM 的非对角项为 0；旁带对角项仍保留未知的 m 与 φΔ。', { 'data-response-note': '' });
    function drawObservationExpansion(s) {
      const b = s.observation, pose = s.operationPose;
      const visible = (node, alpha) => { opacity(node, alpha); attr(node, 'aria-hidden', alpha === 0); };
      const place = (node, x, y, alpha, scale = 1) => {
        attr(node, 'transform', `translate(${x} ${y}) scale(${scale})`); visible(node, alpha);
      };
      attr(equation, 'transform', `translate(${pose.x} ${pose.y}) scale(${pose.scale})`);
      visible(equation, s.operation * (1 - b.distribute + b.dock) * (1-s.whyEstimate));
      const widened = b.widen * (1 - b.dock);
      for (const [key, anchor, target] of [
        ['source', -66, 220], ['temporarySource', -66, 220], ['equals', -5.5, 350],
        ['weight', 37.5, M.lerp(445, 665, b.commute)], ['temporaryWeight', 37.5, M.lerp(445, 665, b.commute)],
        ['multiply', 69.5, 505], ['observations', 129.2, 1190],
      ]) {
        const dx = widened === 0 ? 0 : ((target - pose.x) / pose.scale - anchor) * widened;
        const dy = key === 'temporaryWeight' || key === 'weight' ? -45 * Math.sin(Math.PI * b.commute) * (1 - b.dock) / pose.scale : 0;
        attr(operationTokens[key], 'transform', `translate(${dx} ${Math.abs(dy) < 1e-9 ? 0 : dy})`);
      }
      visible(operationTokens.source, 1 - s.temporaryOperation);
      visible(operationTokens.weight, 1 - s.temporaryOperation);
      visible(operationTokens.temporarySource, s.temporaryOperation);
      visible(operationTokens.temporaryWeight, s.temporaryOperation * (1 - b.response * (1 - b.dock)));
      visible(operationTokens.observations, 1 - b.substitute * (1 - b.dock));
      visible(operationTokens.multiply, 1 - b.commute * (1 - b.dock));
      visible(observationStage, b.substitute);
      place(mixingActor, M.lerp(1190, M.lerp(770, 815, b.commute), b.substitute), 285, 1 - b.response);
      attr(spectrumBrackets, 'transform', `translate(1190 285) scale(${b.substitute})`);
      visible(spectrumBrackets, 1 - b.distribute);
      visible(responseScaffold, b.response * (1 - b.distribute));
      visible(observationNote, b.substitute * (1 - b.response));
      visible(responseNote, b.response * (1 - b.distribute));
      bandActors.forEach((items, row) => {
        const y = 235 + 90 * row, vectorY = M.lerp(285, 205 + 80 * row, b.substitute);
        place(items.sample, M.lerp(1190, row ? 1060 : 940, b.distribute), M.lerp(vectorY, y, b.distribute), 1);
        const hx = M.lerp(1190, M.lerp(600, 470, b.commute), b.substitute);
        place(items.otf, M.lerp(hx, row ? 845 : 765, b.distribute), M.lerp(285 + 45 * Math.sin(Math.PI * b.commute), y, b.distribute), row ? b.distribute : 1);
        const fx = M.lerp(740, 620 + 155 * row, b.response), fy = M.lerp(285, 205 + 80 * row, b.response);
        place(items.factor, M.lerp(fx, 660, b.distribute), M.lerp(fy, y, b.distribute), b.response * (row ? 1 : 1 - b.distribute));
        place(items.output, M.lerp(220, row ? 330 : 510, b.distribute), M.lerp(285, y, b.distribute), b.distribute);
        place(items.equals, M.lerp(350, row ? 490 : 660, b.distribute), M.lerp(285, y, b.distribute), b.distribute);
      });
      visible(indexDefinition, s.notation.definition * (1 - b.intro + b.dock));
      attr(indexDefinition, 'transform', `translate(0 ${pose.y - 85})`);
    }
    note(lessonGroups.ready, 720, 520, '级次已分开；接下来展开频谱，寻找 0 级与 +1 级的公共信息。');

    // The formula rail keeps its previous equation while the temporary row
    // enters, then collects persistent terms on the same clock as the stage.
    const notationRail = document.createElement('div');
    attr(notationRail, 'class', 'provisional-notation-formulas');
    attr(notationRail, 'data-provisional-notation-rail', '');
    const priorFormula = document.createElement('div');
    attr(priorFormula, 'class', 'pe-study-formula pe-two-formula');
    notationRail.appendChild(priorFormula); options.math(priorFormula, Chapter.provisionalFormulas.outputScale);
    const notationSvg = create('svg', { viewBox: '0 0 1440 140', role: 'group',
      'aria-label': '临时乘加式按三个级次合写为临时矩阵与向量式' }, notationRail);
    const railTerms = create('g', { 'data-notation-rail-terms': '' }, notationSvg);
    const railActors = [];
    const railActor = (key, x, width, tex, generic, target, color = '') => {
      const group = create('g', { 'data-notation-rail-token': key }, railTerms);
      const specific = mathAt(group, 0, 0, width, tex, { style: 'color:' + (color || '#dce6e1') });
      const general = generic ? mathAt(group, 0, 0, width, generic, { style: 'color:' + (color || '#dce6e1') }) : null;
      railActors.push({ group, specific, general, x, target });
    };
    railActor('source', 135, 200, String.raw`\widetilde A_{+1}(\mathbf f)`, String.raw`\widetilde A_{\ell}(\mathbf f)`, -66, M.colors[1]);
    railActor('equals', 265, 40, '=', null, -5.5);
    [0, 1, 2].forEach(j => {
      railActor('weight:' + j, 365 + 350 * j, 180, String.raw`\widetilde u_{+1,` + j + '}', String.raw`\widetilde u_{\ell,` + j + '}', 37.5, factorColors.known);
      railActor('observation:' + j, 505 + 350 * j, 180, 'D_' + j + String.raw`(\mathbf f)`, null, 129.2);
    });
    const railPluses = create('g', { 'data-notation-rail-pluses': '' }, railTerms);
    [620, 970].forEach(x => mathAt(railPluses, x, 60, 50, '+'));
    const railOrders = mathAt(railTerms, 720, 116, 800, String.raw`\ell\in\{0,+1,-1\}`, { class: 'provisional-notation-orders' });
    const railVector = create('g', { transform: 'translate(320 60)', 'data-notation-rail-vector': '' }, notationSvg);
    operation(railVector, true);
    const railIndex = mathAt(notationSvg, 970, 60, 880, ',' + String.raw`\qquad` + Chapter.temporaryIndexTex, { 'data-notation-rail-index': '' });
    const railDerivations = [
      ['observation', String.raw`$$D_j(\mathbf f)=H(\mathbf f)\,\mathcal F\{s(\mathbf r)I_j(\mathbf r)\}(\mathbf f)$$`],
      ['substitution', Chapter.provisionalFormulas.substituteObservation],
      ['response', Chapter.provisionalFormulas.temporaryResponse],
      ['bands', Chapter.provisionalFormulas.expandBands],
    ].map(([key, tex]) => ({ key, node: formulaBox(notationSvg, 10, -5, 1420, 145, tex, { 'data-observation-rail': key, class: 'observation-rail-math' }) }));
    function updateNotationRail(s) {
      const n = s.notation, b = s.observation, context = 1 - b.intro + b.dock;
      const visible = (node, alpha) => { opacity(node, alpha); attr(node, 'aria-hidden', alpha === 0); };
      visible(priorFormula, 1 - n.intro);
      visible(railTerms, n.intro * (1 - n.arrive));
      railActors.forEach(({ group, specific, general, x, target }) => {
        attr(group, 'transform', `translate(${M.lerp(x, 320 + target, n.gather)} 60) scale(${M.lerp(1, .12, n.gather)})`);
        if (general) { visible(specific, 1 - n.otherRows); visible(general, n.otherRows); }
      });
      visible(railPluses, 1 - n.gather); visible(railOrders, n.otherRows * (1 - n.gather));
      visible(railVector, n.arrive * context);
      visible(railIndex, n.definition * context);
      attr(railIndex, 'transform', `translate(0 ${12 * (1 - n.definition)})`);
      const phases = { observation: b.intro * (1 - b.commute), substitution: b.commute * (1 - b.response),
        response: b.response * (1 - b.distribute), bands: b.distribute * (1 - b.dock) };
      railDerivations.forEach(({ key, node }) => {
        const alpha = phases[key]; visible(node, alpha);
        attr(node, 'transform', `translate(0 ${8 * (1 - alpha)})`);
      });
    }
    function drawProvisionalFormula(progress) {
      const s = Chapter.provisionalState(progress), container = document.getElementById('equation');
      if (!Array.from(container.children).includes(notationRail)) {
        Array.from(container.children).forEach(child => child.remove()); container.innerHTML = ''; container.appendChild(notationRail);
      }
      attr(container, 'data-formula-mode', 'provisional-' + s.formulaKey);
      return Chapter.provisionalFormulaAt(s);
    }

    const entry = document.getElementById('split-handoff-stage'), pair = options.sharedPair;
    const entryOperation = create('g', { transform: 'translate(720 85) scale(.72)', 'data-split-operation': '' }, entry);
    const temporary = create('g', {}, entryOperation);
    operation(temporary, true);
    const entryNote = note(entry, 720, 165, '沿用刚才推出的 Ũ，只用已知相对相移完成粗分离。');
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
    const railTemporary = mathAt(rail, 720, 28, 210, String.raw`\widetilde{\mathbf A}(\mathbf f)`);
    const railBands = Chapter.temporaryBands.map(b => {
      const group = create('g', { 'data-split-formula': b.order, style: 'color:' + b.color }, rail);
      mathAt(group, 0, 28, 330, b.symbol);
      const rhs = mathAt(group, 0, 78, 470, '=' + b.rhs);
      return { group, rhs };
    });

    function resetEntry() {
      opacity(entry, 0); attr(entry, 'aria-hidden', true);
      attr(options.inverseMatrix, 'transform', 'translate(0 0)');
      for (const panel of pair.panels) { opacity(panel.group, 1); opacity(panel.heading, 1); }
    }
    function drawEntry(progress) {
      const s = Chapter.sharedEntryState(progress);
      attr(pair.root, 'transform', s.focus.transform);
      opacity(entry, s.handoff); attr(entry, 'aria-hidden', s.handoff === 0);
      opacity(temporary, s.temporary * s.source);
      opacity(entryNote, s.temporary * (1 - s.split));
      for (const [b, band] of s.bands.entries()) {
        const branch = branches[b];
        attr(branch.title, 'transform', `translate(${s.focus.x + band.titleX * s.focus.scale} ${s.focus.y + band.titleY * s.focus.scale}) scale(${s.focus.scale})`);
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
      opacity(railTemporary, s.temporary * s.source);
      railBands.forEach(({ group, rhs }, b) => {
        const band = s.bands[b], x = 720 + (Chapter.temporaryBands[b].x - 720) * s.split
          + (Chapter.temporaryBands[b].finalX - Chapter.temporaryBands[b].x) * s.settle;
        attr(group, 'transform', `translate(${s.focus.x + x * s.focus.scale} 0)`); opacity(group, band.alpha);
        attr(group, 'aria-hidden', band.alpha === 0); opacity(rhs, s.pictures);
      });
      return Chapter.sharedEntryFormulaAt(progress);
    }

    const group = lesson.group;
    const parameterCards=create('g',{'data-adopted-cards':''},adopted);
    const cards=[['k',250,'#7ad5cd',[group.kx,group.ky]],['m',720,'#efb879',group.m],['phase',1190,'#b7a5eb',group.phases[0]]].map(([key,x,color,value])=>{
      const g=create('g',{'data-adopted-parameter':key},parameterCards);
      create('rect',{x:-198,y:0,width:396,height:73,rx:6,fill:'#0c1b22',stroke:color},g);
      label(g,0,26,key==='k'?'k̂ · 已锁定':key==='m'?'m̂ · 模长':'φ̂Δ · 相角',{fill:color});
      label(g,0,55,key==='k'?`(${value.map(v=>v.toFixed(2)).join(', ')}) DFT 格`:(Math.abs(value)<1e-10?'0.000000':value.toFixed(6))+(key==='phase'?' rad':''),{fill:color,class:'svg-small'});
      return {g,x,key};
    });
    const pending=mathAt(adopted,720,245,1160,String.raw`\widetilde A_{+1}=\alpha A_{+1}\quad\Longrightarrow\quad\frac{\widetilde A_{+1}}{\widehat\alpha}\approx A_{+1}`,
      {'data-adopted-pending':''});
    const compensation=create('g',{'data-adopted-compensation':''},adopted);
    const compensationInput=create('path',{fill:'none',stroke:M.colors[1],'stroke-width':3},compensation);
    const compensationOutput=create('path',{fill:'none',stroke:M.colors[2],'stroke-width':3,'data-compensated-band-vector':''},compensation);
    label(compensation,430,475,'临时旁带：αA',{fill:M.colors[1]});
    label(compensation,1010,475,'补偿后：A',{fill:M.colors[2]});
    label(compensation,720,365,'÷ α̂',{fill:M.colors[2],class:'svg-title'});
    const compensationReadout=label(compensation,720,505,'',{class:'svg-small'});
    const known=group.weights[1][1], delta=group.phases[0], m=group.m;
    const factor={re:Math.cos(delta)/m,im:-Math.sin(delta)/m};
    const temporaryWeightValue={re:2/3*Math.cos(-2*Math.PI/3),im:2/3*Math.sin(-2*Math.PI/3)};
    const numberTex=z=>String.raw`\left(`+compact(z.re)+(z.im<0?'-':'+')+compact(Math.abs(z.im))+'i'+String.raw`\right)`;
    const substitution=create('g',{'data-adopted-substitution':''},adopted);
    mathAt(substitution,720,285,1200,String.raw`\frac1{\widehat\alpha}=\frac1{`+compact(m)+String.raw`}e^{-i(`+compact(delta)+String.raw`)}=`+numberTex(factor));
    mathAt(substitution,720,385,1200,String.raw`u_{+1,1}=`+numberTex(factor)+String.raw`\,\times\,`+numberTex(temporaryWeightValue));
    const single=create('g',{'data-adopted-single':''},adopted);
    const singleName=mathAt(single,0,-52,240,String.raw`u_{+1,1}`);
    const singleNumber=label(single,0,0,complex(known),{class:'adopted-coefficient',fill:M.colors[1],
      'data-adopted-restored-weight':'1:1','data-re':known.re,'data-im':known.im});
    const matrix=create('g',{'data-adopted-U':''},adopted);
    // Same anchors as the actual U inspected before estimation.
    create('path',{d:'M 525 220 H 515 V 460 H 525 M 1085 220 H 1095 V 460 H 1085',class:'matrix-bracket'},matrix);
    label(matrix,805,175,'U',{class:'svg-small'});
    const rowNames=[],inverseRows=[];
    for(let row=0;row<3;row++){
      const y=260+80*row;
      rowNames.push(mathAt(matrix,400,y,180,['A_0','A_{+1}','A_{-1}'][row],{style:'color:'+M.colors[row]}));
      const g=create('g',{'data-adopted-weight-row':row},matrix);
      group.weights[row].forEach((w,j)=>{
        const value=label(g,625+180*j,y,complex(w),{class:'adopted-coefficient',fill:M.colors[row],
          'data-adopted-inverse':`${row}:${j}`,'data-re':w.re,'data-im':w.im});
        if(row===1&&j===1)attr(value,'data-adopted-docked-copy','');
      });
      inverseRows.push(g);
    }
    const rowHighlight=create('rect',{x:535,y:304,width:530,height:62,rx:5,fill:M.colors[1]+'10',stroke:M.colors[1],
      'data-adopted-selected-row':'+1'},matrix);
    const next=note(adopted,720,510,'沿 +1 这一行，回到同一组三帧完整观测。',{fill:M.colors[1]});
    // Row actors persist through the next scene's entrance, then yield to the
    // identical +1 symbolic products in the host calculation view.
    const applicationRow=create('g',{'data-adopted-application-row':'+1'},adopted);
    const applicationTerms=group.weights[1].map((w,j)=>{
      const g=create('g',{'data-adopted-row-term':j},applicationRow);
      const number=label(g,0,0,complex(w),{class:'adopted-coefficient',fill:M.colors[1]});
      const product=mathAt(g,0,0,330,'u_{+1,'+j+'}'+String.raw`\cdot D_`+j+String.raw`(\mathbf f)`);
      return {g,number,product};
    });
    const teachingView=root.SIMAdoptedTeaching.createView({...options,parent:adopted,
      single,singleName,singleNumber,parameterCards,cards});
    function drawApplication(progress){
      teachingView.draw(null,0);
      const p=M.clamp(progress),move=M.ramp(p,.04,.23),symbol=M.ramp(p,.25,.30);
      [parameterCards,pending,substitution,single,compensation].forEach(g=>opacity(g,0));
      const extract=M.ramp(p,0,.04);
      opacity(matrix,1-extract);opacity(next,1-extract);opacity(rowHighlight,1);
      inverseRows.forEach((g,j)=>opacity(g,j===1?1:.3));rowNames.forEach(g=>opacity(g,1));
      opacity(applicationRow,extract);
      applicationTerms.forEach(({g,number,product},j)=>{
        attr(g,'transform',`translate(${M.lerp(625+180*j,475+360*j,move)} ${M.lerp(340,265,move)})`);
        opacity(number,1-symbol);opacity(product,symbol);
      });
    }
    return { resetEntry, drawEntry, drawEntryFormula, drawProvisionalFormula, drawApplication, draw(id, progress) {
      if (id === 'provisional-split') {
        const s = Chapter.provisionalState(progress);
        attr(provisional, 'data-provisional-mode', s.mode); attr(provisional, 'data-parameter-focus', s.focus || '');
        inspectedRows.forEach((row, b) => {
          const state = s.rows[b];
          opacity(row.highlight, state.highlight); opacity(row.message, state.message);
          attr(row.message, 'aria-hidden', state.message === 0);
          row.weights.forEach(item => { opacity(item.element, state.coefficients); attr(item.element, 'aria-hidden', state.coefficients === 0); });
        });
        opacity(transfer, s.transfer); attr(transfer, 'aria-hidden', s.transfer === 0);
        moving.forEach(item => {
          const x = M.lerp(item.x, item.target, s.gather), y = M.lerp(item.y, 85, s.gather);
          attr(item.group, 'transform', `translate(${x} ${y}) scale(${M.lerp(1, .1, s.gather)})`);
          opacity(item.group, 1 - M.ramp(s.gather, .45, .65));
        });
        illuminationTokens.forEach(item => {
          attr(item.group, 'transform', `translate(${item.x-60} ${85+6*(1-s.illumination.formula)})`);
          opacity(item.group,s.illumination.formula);
          attr(item.group, 'data-hop', 0);
          attr(item.group,'data-active',item.key===(s.illumination.kind==='phase'?'phase':s.illumination.kind));
        });
        illuminationView.draw(s);
        opacity(kReason, s.kReason); opacity(amplitudeReason, s.amplitudeReason);
        attr(kReason, 'aria-hidden', s.kReason === 0); attr(amplitudeReason, 'aria-hidden', s.amplitudeReason === 0);
        opacity(failure, s.nominalFailure); attr(failure, 'aria-hidden', s.nominalFailure === 0); failureView.draw(s.failure);
        for (const [key, node] of Object.entries(lessonGroups)) {
          const alpha = s[key];
          opacity(node, alpha); attr(node, 'aria-hidden', alpha === 0);
        }
        drawActualWeights(s.actual, s);
        drawObservationExpansion(s);
        updateNotationRail(s);
        for (const [node, alpha] of [
          [knownDefinition, s.nameKnown * (1 - s.coefficientScale)],
          [coefficientRelation, s.coefficientScale * (1 - s.outputScale)],
          [propagated, s.outputScale], [notationKey, s.nameKnown],
        ]) {
          opacity(node, alpha); attr(node, 'aria-hidden', alpha === 0);
        }
      } else {
        const s = Chapter.adoptedState(progress,id);
        attr(adopted,'data-adopted-progress',s.progress);attr(adopted,'data-adopted-scene',id);
        if(s.teaching){
          [pending,substitution,single,compensation,matrix,applicationRow,next].forEach(g=>opacity(g,0));
          teachingView.draw(id,progress);return s;
        }
        teachingView.draw(null,0);
        opacity(applicationRow,0);
        opacity(parameterCards,s.cards);
        cards.forEach(({g,x})=>attr(g,'transform',`translate(${x} ${M.lerp(425,130,s.cardMove)})`));
        opacity(compensation,id==='adopted-weights'?M.ramp(progress,.46,.65):0);
        if(id==='adopted-weights'){
          const a=lesson.probe.orders[1].value,angle=group.phases[0],m=group.m;
          const input={re:m*(a.re*Math.cos(angle)-a.im*Math.sin(angle)),im:m*(a.re*Math.sin(angle)+a.im*Math.cos(angle))};
          const gain=Math.pow(1/m,M.ramp(progress,.65,.92)),rotation=-angle*M.ramp(progress,.65,.92),scale=80/Math.max(Math.hypot(a.re,a.im),1e-30);
          const out={re:gain*(input.re*Math.cos(rotation)-input.im*Math.sin(rotation)),im:gain*(input.re*Math.sin(rotation)+input.im*Math.cos(rotation))};
          attr(compensationInput,'d',arrowPath(430,370,430+input.re*scale,370-input.im*scale));
          attr(compensationOutput,'d',arrowPath(1010,370,1010+out.re*scale,370-out.im*scale));
          attr(compensationOutput,'data-re',out.re);attr(compensationOutput,'data-im',out.im);
          compensationReadout.textContent=`幅度乘 ${(1/m).toFixed(4)} · 相位减去 ${compact(angle)} rad · 波矢保留给下一步归位`;
        }
        opacity(pending,s.pending);opacity(substitution,s.substituted);opacity(single,s.solved);
        attr(single,'transform',`translate(${M.lerp(720,805,s.dock)} ${M.lerp(320,340,s.dock)})`);
        opacity(singleName,1-s.dock);
        // Hand off the selected number at the same coordinates without doubling it.
        opacity(singleNumber,1-s.rows[1]);
        opacity(matrix,s.matrix);opacity(rowHighlight,s.rowFocus);
        inverseRows.forEach((g,j)=>opacity(g,s.rows[j]*(j===1?1:1-.7*s.rowFocus)));
        rowNames.forEach((g,j)=>opacity(g,s.rows[j]));
        opacity(next,s.rowFocus);

      }
    } };
  }
  root.SIMMotionParameterView = { create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
