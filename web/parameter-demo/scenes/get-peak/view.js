/* Final commonRegion/getPeak, in the local fairSIM source's actual order.
 * All field pixels, cursors and prefix sums read estimate.finalPeak. The old
 * internal scene id survives only for host timeline compatibility. */
(function (root) {
  'use strict';
  const Story = root.SIMGetPeak, M = root.SIMParameterStory, A = root.SIMAtlas;
  const layout = Story.layout;
  function createView({ parent, lesson, el, label, line, path, vector, set, text, opacity, raster, defs, uid }) {
    const { peak } = Story.dataFor(lesson), { n } = peak, colors = ['#7ad5cd', '#b7a5eb', '#efb879'];
    const stage = el('g', { 'data-get-peak': '', 'data-least-squares-fit': '', 'data-source': 'fairSIM-getPeak', 'data-total': peak.count }, parent);
    const number = (x, digits = 4) => Math.abs(x) < 1e-12 ? '0' : Math.abs(x) < 1e-4 ? x.toExponential(2) : x.toFixed(digits);
    const complex = z => `${number(z.re)} ${z.im < -1e-12 ? '−' : '+'} ${number(Math.abs(z.im))}i`;
    const value = (z, i) => ({ re: z.re[i], im: z.im[i] });
    const mag = z => Math.hypot(z.re, z.im);
    const principal = a => Math.atan2(Math.sin(a), Math.cos(a));
    const position = i => [i % n, Math.floor(i / n)];
    const domainSide = 2 * Math.ceil(lesson.estimate.context.config.cutoff) + 7;
    const urls = new Map();
    // Display only: hue encodes the actual complex phase, log brightness the
    // modulus. The full nonzero OTF support fits in the frequency window.
    function fieldURL(z, frequency = false, scale) {
      if (urls.has(z)) return urls.get(z);
      const max = scale || z.re.reduce((m, re, i) => Math.max(m, Math.hypot(re, z.im[i])), 1e-30);
      const side = frequency ? domainSide : n;
      const url = raster(side, side, (x, y) => {
        const i = frequency ? A.idx(x - Math.floor(side / 2), y - Math.floor(side / 2), n) : y * n + x;
        const amplitude = Math.hypot(z.re[i], z.im[i]);
        if (!amplitude) return [0, 0, 0, 255];
        const h = (Math.atan2(z.im[i], z.re[i]) / (2 * Math.PI) + 1) % 1;
        const v = Math.log1p(1e3 * amplitude / max) / Math.log1p(1e3), sector = h * 6;
        const c = .78 * v, q = c * (1 - Math.abs(sector % 2 - 1)), base = .22 * v;
        const rgb = sector < 1 ? [c, q, 0] : sector < 2 ? [q, c, 0] : sector < 3 ? [0, c, q]
          : sector < 4 ? [0, q, c] : sector < 5 ? [q, 0, c] : [c, 0, q];
        return [...rgb.map(v => Math.round(255 * (v + base))), 255];
      });
      urls.set(z, url); return url;
    }
    const vMaximum = peak.spatial[1].re.reduce((m, re, i) => Math.max(m, Math.hypot(re, peak.spatial[1].im[i])), 1e-30);
    const energyMaximum = peak.energy.reduce((maximum, v) => Math.max(maximum, v), 1e-30);
    const images = {
      prepared: peak.prepared.map(z => fieldURL(z, true)),
      spatial: peak.spatial.map(z => fieldURL(z, false)),
      shifted: fieldURL(peak.shifted, false, vMaximum), product: fieldURL(peak.product, false),
      energy: raster(n, n, (x, y) => { const v=Math.log1p(1e3*peak.energy[y*n+x]/energyMaximum)/Math.log1p(1e3); return [122,213,205].map(c=>Math.round(c*v)).concat(255); }),
    };
    function panel(parent, x, y, width, height, color = '#36525d') {
      return el('rect', { x, y, width, height, rx: 6, class: 'pe-two-panel', stroke: color }, parent);
    }
    function field(parent, x, y, size, title, subtitle, href, color, name) {
      const g = el('g', { transform: `translate(${x} ${y})`, 'data-get-peak-field': name }, parent);
      label(g, 0, -size / 2 - 28, title, 'pe-peak-field-title', color);
      panel(g, -size / 2 - 9, -size / 2 - 9, size + 18, size + 18, color);
      const image = el('image', { x: -size / 2, y: -size / 2, width: size, height: size, href,
        style: 'image-rendering:pixelated', 'data-get-peak-image': name, 'data-n': n }, g);
      const caption = label(g, 0, size / 2 + 33, subtitle, 'pe-two-small');
      const cursor = el('rect', { width: size / n, height: size / n, fill: '#fff', 'fill-opacity': .16,
        stroke: '#fff', 'stroke-width': 1.4, 'data-get-peak-cursor': name }, g);
      const row = el('line', { x1: -size / 2, x2: size / 2, stroke: '#fff', 'stroke-opacity': .3,
        'stroke-width': 1, 'data-get-peak-row': name }, g);
      const moveCursor = (index, visible) => {
        const [x, y] = position(index), step = size / n;
        set(cursor, 'x', -size / 2 + x * step); set(cursor, 'y', -size / 2 + y * step);
        set(cursor, 'data-index', index); set(cursor, 'data-r', [x, y].join(','));
        set(row, 'y1', -size / 2 + (y + .5) * step); set(row, 'y2', -size / 2 + (y + .5) * step);
        opacity(cursor, visible); opacity(row, visible);
      };
      moveCursor(0, 0);
      return { g, image, caption, moveCursor, size, liftCursor() { for (const node of [row,cursor]) { node.remove(); g.appendChild(node); } } };
    }
    function plane(parent, x, y, radius, name) {
      const g = el('g', { transform: `translate(${x} ${y})`, 'data-get-peak-plane': name }, parent);
      el('circle', { r: radius, fill: 'none', stroke: '#36525d' }, g);
      line(g, -radius - 15, 0, radius + 15, 0); line(g, 0, -radius - 15, 0, radius + 15);
      label(g, radius + 28, 5, 'Re', 'pe-two-small'); label(g, 12, -radius - 16, 'Im', 'pe-two-small');
      return g;
    }
    function prefix(node, count, size) {
      const step = size / n, rows = Math.floor(count / n), remainder = count % n;
      set(node, 'd', `M ${-size / 2} ${-size / 2} h ${size} v ${rows * step} h ${-size} Z`
        + (remainder ? ` M ${-size / 2} ${-size / 2 + rows * step} h ${remainder * step} v ${step} h ${-remainder * step} Z` : ''));
      set(node, 'data-count', count); set(node, 'data-total', peak.count);
    }
    const groups = Story.timeline.beats.filter(b => b.layout !== 'result').map(beat => el('g', { 'data-get-peak-beat': beat.key }, stage));
    const [prepare, inverse, shift, product, sum] = groups;
    const action = label(stage, 720, layout.actionY, '', 'pe-two-text', colors[2]);
    set(action, 'data-get-peak-action', '');
    const legend = label(stage, 720, layout.legendY, '亮度＝对数模长 · 色相＝复数相角 · 各图独立标尺，v 与 vₖ 共用标尺', 'pe-two-small');
    set(legend, 'data-get-peak-display-key', '');
    const prepared = [0, 1].map(b => field(prepare, layout.pair.x[b], layout.pair.y, layout.pair.size,
      `B${b ? '₁' : '₀'} · 最终位移下的工作频带`, `自身 OTF 可靠且成对筛选 · 保留 ${peak.supportCounts[b]} 个频点`, images.prepared[b], colors[b], 'prepared-' + b));
    label(prepare, 720, 278, '复制', 'pe-two-value');
    label(prepare, 720, 310, '筛选与校正', 'pe-two-small');
    label(prepare, 720, layout.pair.detailY, `k̂ = (${number(peak.kx, 2)}, ${number(peak.ky, 2)}) · OTF 阈值 ${peak.threshold} · 径向比例 ${peak.distanceFraction}`, 'pe-two-small');
    const inverseCards = [0, 1].map(b => {
      const f = field(inverse, layout.pair.x[b], layout.pair.y, layout.pair.size, b ? 'B₁  →  v' : 'B₀  →  u', '频域工作副本 → 空域复数场', images.prepared[b], colors[b], 'inverse-' + b);
      const spatial = el('image', { x: -112, y: -112, width: 224, height: 224, href: images.spatial[b],
        style: 'image-rendering:pixelated', 'data-get-peak-spatial': b }, f.g);
      const transform = label(f.g, 0, 0, '逆 FFT', 'pe-peak-transform', colors[b]);
      return { ...f, spatial, transform };
    });
    label(inverse, 720, layout.pair.detailY, '两路独立执行 · 不新增拍摄 · 不是最终样品强度图', 'pe-two-text');
    const shiftFields = [
      field(shift, layout.shift.x[0], layout.shift.y, layout.shift.size, 'u · 保持不动', '参考复数场', images.spatial[0], colors[0], 'shift-reference'),
      field(shift, layout.shift.x[1], layout.shift.y, layout.shift.size, 'v · 尚未位移校正', '旁带复数场', images.spatial[1], colors[1], 'shift-input'),
      field(shift, layout.shift.x[2], layout.shift.y, layout.shift.size, 'vₖ · 逐点形成', '按行应用单位模指数', images.spatial[1], colors[1], 'shift-output'),
    ];
    const shiftClip = el('clipPath', { id: uid + '-peak-shift' }, defs);
    const shiftPrefix = el('path', { 'data-get-peak-shift-prefix': '' }, shiftClip);
    el('image', { x: -93, y: -93, width: 186, height: 186, href: images.shifted,
      'clip-path': `url(#${uid}-peak-shift)`, style: 'image-rendering:pixelated', 'data-get-peak-shifted-image': '' }, shiftFields[2].g);
    shiftFields[2].liftCursor();
    const rampPlane = plane(shift, ...layout.shift.plane, 'known-ramp');
    const rampStart = path(rampPlane, colors[1], { 'stroke-width': 1.5, 'stroke-dasharray': '3 3' });
    const rampArrow = path(rampPlane, colors[2], { 'data-get-peak-ramp-vector': '' });
    const rampAngle = label(shift, 862, 393, '', 'pe-two-small');
    const rampPosition = label(shift, 862, 179, '', 'pe-two-small');
    label(shift, 862, 420, '同一实际位置 · 相角按 2π 取模', 'pe-two-small');
    const productFields = [
      field(product, layout.product.x[0], layout.product.y, layout.product.size, 'u(r)', '参考场 · 光标选取同一 r', images.spatial[0], colors[0], 'product-reference'),
      field(product, layout.product.x[1], layout.product.y, layout.product.size, 'vₖ(r)', '', images.shifted, colors[1], 'product-target'),
    ];
    const conjugatePlane = plane(product, ...layout.product.plane, 'conjugation');
    const sourceU = path(conjugatePlane, colors[0], { 'stroke-width': 1.3, 'stroke-dasharray': '4 3' });
    const conjugateU = path(conjugatePlane, colors[0], { 'data-get-peak-conjugate-vector': '' });
    label(product, 1125, 170, 'u → u*', 'pe-two-text', colors[0]);
    label(product, 1125, 389, '实部不变 · 虚部变号', 'pe-two-small');
    const productPosition = label(product, 280, 443, '', 'pe-two-small');
    const productOperation = label(product, 690, 412, 'u*(r) × vₖ(r) → z(r)', 'pe-two-text', colors[2]);
    const zReadout = label(product, 690, 443, '', 'pe-two-small', colors[2]);
    const eReadout = label(product, 1125, 443, '', 'pe-two-small', colors[0]);
    // The full product field is used; the clip below highlights an exact
    // row-major prefix, including the current partial row.
    const productField = field(sum, layout.sum.x[0], layout.sum.y, layout.sum.size, 'z(r) · 逐点乘积', '分子的输入：u* × vₖ', images.product, colors[2], 'sum-source');
    const energyField = field(sum, layout.sum.x[1], layout.sum.y, layout.sum.size, 'e(r) = |u(r)|²', '分母的输入：参考场能量', images.energy, colors[0], 'sum-energy-source');
    const sumClip = el('clipPath', { id: uid + '-peak-sum' }, defs);
    const sumPrefix = el('path', { 'data-get-peak-sum-prefix': '' }, sumClip);
    el('rect', { x: -88, y: -88, width: 176, height: 176, fill: '#fff', 'fill-opacity': .15,
      'clip-path': `url(#${uid}-peak-sum)` }, productField.g);
    const cPlane = plane(sum, ...layout.sum.plane, 'cross-sum');
    const cArrow = path(cPlane, colors[2], { 'data-get-peak-cross-vector': '' });
    label(sum, 930, 152, 'C · 复数累计', 'pe-peak-field-title', colors[2]);
    const cNumber = label(sum, 930, 407, '', 'pe-two-text', colors[2]);
    label(sum, 1240, 152, 'E₀ · 参考能量累计', 'pe-peak-field-title', colors[0]);
    panel(sum, 1195, 189, 90, 161, colors[0]);
    const energyFill = el('rect', { x: 1205, width: 70, y: 340, height: 0, fill: colors[0], 'fill-opacity': .6, 'data-get-peak-energy-fill': '' }, sum);
    const energyNumber = label(sum, 1240, 407, '', 'pe-two-text', colors[0]);
    const sumCount = label(sum, 720, 443, '', 'pe-two-text', colors[2]);
    const sampleNumber = label(sum, 720, 465, '', 'pe-two-small');
    const toC = path(sum, colors[2], { d: 'M 327 220 Q 365 175 405 175 H 806 Q 842 175 864 220', 'stroke-width': 1.5 });
    const toE = path(sum, colors[0], { d: 'M 667 315 Q 710 376 770 376 H 1100 Q 1170 376 1182 315', 'stroke-width': 1.5 });
    label(sum, 770, 201, 'z → 分子', 'pe-two-small', colors[2]);
    label(sum, 1070, 356, '|u|² → 分母', 'pe-two-small', colors[0]);
    const contribution = el('circle', { r: 4, fill: colors[2], 'data-get-peak-contribution': '' }, sum);
    const cMaximum = peak.sums.reduce((max, z) => Math.max(max, mag(z)), 1e-30);
    const result = el('g', { 'data-get-peak-result': '' }, stage);
    const divide = el('g', { 'data-get-peak-division': '' }, result);
    const cBox = el('g', {}, divide), eBox = el('g', {}, divide);
    panel(cBox, 115, 190, 420, 90, colors[2]); panel(eBox, 115, 313, 420, 90, colors[0]);
    label(cBox, 325, 219, 'C · N² 项复数和', 'pe-two-small', colors[2]);
    const finalC = label(cBox, 325, 253, '', 'pe-two-value', colors[2]);
    label(eBox, 325, 341, 'E₀ · N² 项参考能量和', 'pe-two-small', colors[0]);
    const finalE = label(eBox, 325, 377, '', 'pe-two-value', colors[0]);
    line(divide, 555, 236, 643, 280, colors[2]); line(divide, 555, 358, 643, 300, colors[0]);
    el('circle', { cx: 678, cy: 290, r: 29, fill: '#102128', stroke: colors[2] }, divide);
    label(divide, 678, 298, '÷', 'pe-two-value', colors[2]);
    const divideOut = path(divide, colors[2], { d: 'M 711 290 H 843', 'data-get-peak-divide-output': '' });
    const ratio = plane(result, ...layout.result.plane, 'coefficient');
    label(ratio, 97, -9, '1', 'pe-two-small');
    const ratioArrow = path(ratio, colors[2], { 'data-study-ratio': '', 'data-get-peak-alpha-vector': '' });
    const phaseArc = path(ratio, colors[1], { 'stroke-width': 2, 'data-get-peak-phase-arc': '' });
    const length = path(ratio, colors[2], { 'stroke-width': 7, 'stroke-opacity': .2, 'data-get-peak-length': '' });
    const ratioText = label(result, 1070, 406, '', 'pe-two-text', colors[2]);
    const read = el('g', { 'data-get-peak-readout': '' }, result);
    label(read, 335, 204, '一个复系数，读取两个参数', 'pe-two-text');
    const phaseText = label(read, 335, 269, '', 'pe-two-value', colors[1]);
    const lengthText = label(read, 335, 324, '', 'pe-two-value', colors[2]);
    label(read, 335, 371, 'φ̂ⱼ = φ′ⱼ + φ̂Δ · 采用已知三相相对步进', 'pe-two-small');
    const cards = el('g', { 'data-fit-parameter-cards': '' }, result);
    const cardNodes = ['k', 'm', 'phase'].map((key, i) => {
      const x = layout.result.cardX[i], color = [colors[0], colors[2], colors[1]][i];
      const g = el('g', { 'data-fit-parameter': key }, cards);
      panel(g, x - layout.result.cardWidth / 2, layout.result.cardY, layout.result.cardWidth, layout.result.cardHeight, color);
      label(g, x, 451, ['锁定波矢 k̂', '调制度 m̂ = |α̂|', '共同相位 φ̂Δ = arg α̂'][i], 'pe-two-text', color);
      const v = label(g, x, 480, '', 'pe-two-value', color);
      return { g, v };
    });
    const legs = ['k', 'm', 'phase'].map((key, i) => path(result, [colors[0], colors[2], colors[1]][i], {
      'data-parameter-source': key === 'k' ? 'locked-wavevector' : 'complex-coefficient', 'stroke-width': 1, 'stroke-dasharray': '3 4',
      d: i === 0 ? 'M 250 383 V 425' : `M 1070 383 Q ${250 + i * 470} 402 ${250 + i * 470} 425`,
    }));
    function draw(progress) {
      const active = progress !== null, s = Story.state(lesson, active ? progress : 0);
      opacity(stage, active ? 1 : 0);
      for (const [key, v] of Object.entries({ mode: s.mode, count: s.count, total: s.total,
        'sum-re': s.sum.re, 'sum-im': s.sum.im, energy: s.sum.energy, divide: s.divide,
        solved: s.solved, read: s.read, kx: peak.kx, ky: peak.ky, sample: s.sample })) set(stage, 'data-' + key, v);
      groups.forEach((g, i) => opacity(g, s.panels[i]));
      text(action, `${s.beat + 1} / ${s.beatCount} · ${s.action}`); opacity(action, s.textAlpha);
      opacity(legend, s.layout !== 'result' ? s.textAlpha : 0);
      inverseCards.forEach(card => {
        opacity(card.image, 1 - M.ramp(s.inverse, 0, .35));
        opacity(card.spatial, M.ramp(s.inverse, .55, 1));
        opacity(card.transform, s.inverse > 0 && s.inverse < 1 ? 1 : 0);
      });
      // Explain one actual value first; then construct the output field.
      // Pending positions stay blank instead of displaying unshifted v as v_k.
      const shiftCount = Math.min(peak.count, Math.floor((s.shiftScan + 1e-12) * peak.count));
      prefix(shiftPrefix, shiftCount, layout.shift.size);
      opacity(shiftFields[2].g, s.shiftOutput); opacity(shiftFields[2].image, 0);
      text(shiftFields[2].caption, `已处理 ${shiftCount} / ${peak.count} 个位置`);
      const cursor = Story.dataFor(lesson).sampleIndex, [rx, ry] = position(cursor);
      const angle = principal(-2 * Math.PI * (peak.kx * rx + peak.ky * ry) / n);
      const v = value(peak.spatial[1], cursor), rotate = angle * s.shift, c = Math.cos(rotate), sn = Math.sin(rotate);
      const current = { re: v.re * c - v.im * sn, im: v.re * sn + v.im * c };
      const vScale = 49 / Math.max(1e-30, mag(v));
      vector(rampStart, v, vScale); vector(rampArrow, current, vScale);
      set(rampArrow, 'data-known-angle', angle); set(rampArrow, 'data-applied-angle', rotate);
      text(rampAngle, `斜坡相角 ${number(rotate, 3)} rad`); text(rampPosition, `r = (${rx}, ${ry})`);
      shiftFields.slice(0, 2).forEach(f => f.moveCursor(cursor, 1));
      shiftFields[2].moveCursor(Math.max(0, shiftCount - 1), shiftCount > 0 && shiftCount < peak.count ? 1 : 0);
      productFields.forEach(f => f.moveCursor(s.sample, 1));
      const u = value(peak.spatial[0], s.sample), conjugated = { re: u.re, im: -u.im * (2 * s.conjugate - 1) };
      const uScale = 69 / Math.max(1e-30, mag(u));
      vector(sourceU, u, uScale); vector(conjugateU, conjugated, uScale);
      set(product, 'data-index', s.sample); set(product, 'data-r', s.r.join(','));
      const z = value(peak.product, s.sample), energy = peak.energy[s.sample];
      set(product, 'data-z-re', z.re); set(product, 'data-z-im', z.im); set(product, 'data-e', energy);
      text(zReadout, `z(r) = ${complex(z)}`); opacity(zReadout, s.multiply);
      text(eReadout, `e(r) = ${number(energy, 6)}`); opacity(eReadout, s.multiply);
      text(productPosition, `同一 r = (${s.r.join(', ')})`);
      opacity(productOperation, s.multiply);
      prefix(sumPrefix, s.count, layout.sum.size);
      for (const f of [productField, energyField]) f.moveCursor(s.sample, s.count > 0 && s.count < s.total ? 1 : 0);
      vector(cArrow, s.sum, 64 / cMaximum);
      text(cNumber, `C = ${complex(s.sum)}`); text(energyNumber, `E₀ = ${number(s.sum.energy, 6)}`);
      const fraction = s.sum.energy / peak.referenceEnergy;
      set(energyFill, 'height', 141 * fraction); set(energyFill, 'y', 340 - 141 * fraction);
      set(energyFill, 'data-energy', s.sum.energy);
      text(sumCount, `已累计 ${s.count} / ${s.total} 个空域位置`);
      text(sampleNumber, s.count ? `当前 r = (${s.r.join(', ')}) · 两路取同一个位置，分别累加` : '从 r = (0, 0) 开始 · 两路分别累加');
      const travel = s.contributionTravel;
      set(contribution, 'cx', 405 + 401 * travel); set(contribution, 'cy', 175);
      opacity(contribution, s.count > 0 && s.count < s.total ? 1 : 0);
      opacity(toC, 1); opacity(toE, 1);
      opacity(result, s.resultAlpha);
      opacity(divide, s.divisionAlpha);
      text(finalC, s.count === s.total ? complex(s.sum) : ''); text(finalE, s.count === s.total ? number(s.sum.energy, 6) : '');
      opacity(divideOut, s.divide);
      opacity(ratio, s.solved ? 1 : 0); opacity(ratioText, s.solved ? 1 : 0);
      // Never place final numeric coefficient/phase/modulation in a visible
      // actor before the corresponding source operation has completed.
      const alpha = s.alpha || { re: 0, im: 0 };
      vector(ratioArrow, alpha, 97); vector(length, alpha, 97);
      text(ratioText, s.solved ? `α̂ = ${complex(alpha)}` : '');
      const phase = s.phase === null ? 0 : s.phase, arc = s.phaseRead * phase;
      set(phaseArc, 'd', Math.abs(arc) < 1e-10 ? 'M 0 0' : `M 36 0 A 36 36 0 ${Math.abs(arc) > Math.PI ? 1 : 0} ${arc >= 0 ? 0 : 1} ${36 * Math.cos(arc)} ${-36 * Math.sin(arc)}`);
      set(phaseArc, 'data-phase', s.phase === null ? '' : s.phase); opacity(phaseArc, s.phaseRead);
      opacity(length, s.lengthRead); opacity(read, s.readAlpha);
      text(phaseText, s.phase === null ? '' : `φ̂Δ = ${number(s.phase, 4)} rad`); opacity(phaseText, s.phaseRead);
      text(lengthText, s.m === null ? '' : `m̂ = ${number(s.m, 4)}`); opacity(lengthText, s.lengthRead);
      opacity(cards, s.cards); legs.forEach(node => opacity(node, s.cards));
      cardNodes.forEach(({ g, v }, i) => {
        const shown = s.cards > 0, raw = i === 0 ? s.k.join(',') : i === 1 ? s.m : s.phase;
        set(g, 'data-value', shown ? raw : '');
        text(v, shown ? i === 0 ? `(${s.k.map(x => number(x, 2)).join(', ')}) DFT 格` : number(raw, 4) + (i === 2 ? ' rad' : '') : '');
      });
      return s;
    }
    draw(null); return { root: stage, draw };
  }
  Object.assign(Story, { createView });
})(typeof globalThis !== 'undefined' ? globalThis : this);
