/* One reversible fit scene, using only the locked comparison's observations.
 * Geometry explores copies of U; targets and estimator output never change. */
(function (root) {
  'use strict';
  const L = root.SIMParameterLesson, M = root.SIMParameterStory;
  function createFitView({ parent, lesson, planes, initialMaximum, el, label, line, path, vector, set, text, opacity, renderMath }) {
    const data = L.dataFor(lesson), e = lesson.estimate, best = data.best, colors = L.bandColors;
    const mag = z => Math.hypot(z.re, z.im);
    const mul = (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
    const num = (v, digits = 3) => (Math.abs(v) < .5 * 10 ** -digits ? 0 : v).toFixed(digits);
    const selectedMaximum = Math.max(1e-12, ...data.selected.flatMap(p => [mag(p.x), mag(p.y)]));
    const fullMaximum = Math.max(selectedMaximum, ...best.points.flatMap(p => [mag(p.x), mag(p.y)]));
    const n = lesson.capture.config.n;
    const stage = el('g', { 'data-least-squares-fit': '' }, parent);
    const math = (parent, x, y, width, height, tex, name) => {
      const box = el('foreignObject', { x, y, width, height, 'data-fit-formula': name }, parent);
      const div = (parent.ownerDocument || root.document).createElement('div');
      div.setAttribute('class', 'pe-fit-math'); box.appendChild(div); renderMath(div, tex); return box;
    };
    const context = el('g', {}, stage);
    const locked = label(context, 305, 112, '', 'pe-two-text', colors[2]);
    const relation = math(context, 52, 400, 495, 90,
      String.raw`$$U_j=r_j e^{i\theta_j},\qquad V_j\simeq m e^{i\phi_\Delta}U_j$$`, 'relation');
    const relationNote = label(context, 300, 494, '各点的 rⱼ、θⱼ 可不同；共同的是 m、φΔ', 'pe-two-small');
    const geometry = el('g', { 'data-fit-common-plane': '', transform: 'translate(1000 285)' }, stage);
    el('circle', { r: 130, fill: 'none', stroke: '#36525d' }, geometry);
    line(geometry, -154, 0, 154, 0); line(geometry, 0, -154, 0, 154);
    label(geometry, 171, 12, 'Re', 'pe-two-small'); label(geometry, 15, -151, 'Im', 'pe-two-small');
    const scaleLabel = label(geometry, 0, 155, '', 'pe-two-small');
    const action = label(stage, 1000, 119, '', 'pe-two-text', colors[2]);
    const readout = label(stage, 1000, 481, '', 'pe-two-text', colors[2]);
    const legend = label(stage, 1000, 458, '青 U · 紫 V · 橙 αU · 白虚线 V−αU', 'pe-two-small');
    const residuals = planes.map((plane, i) => {
      const residual = line(plane.group, 0, 0, 0, 0, '#edf3f1', { 'stroke-width': 1.2, 'stroke-dasharray': '3 3', 'data-fit-residual': i });
      const tag = label(plane.group, 0, 0, ['P', 'Q', 'R'][i], 'pe-two-small', colors[2]);
      return { residual, tag };
    });
    const cloud = el('g', { transform: 'translate(1000 285)', 'data-fit-cloud': '' }, stage);
    const dots = best.points.map(point => {
      const group = el('g', { 'data-fit-q': point.q.join(',') }, cloud);
      const u = el('circle', { r: 2.4, fill: colors[0] }, group), v = el('circle', { r: 3.1, fill: 'none', stroke: colors[1], 'stroke-width': 1.2 }, group);
      const prediction = el('circle', { r: 1.8, fill: colors[2] }, group);
      const residual = line(group, 0, 0, 0, 0, '#edf3f1', { 'stroke-width': .7, 'stroke-dasharray': '2 3' });
      return { point, group, u, v, prediction, residual };
    });
    const fitting = el('g', { 'data-fitting': '' }, stage);
    const fitSource = math(fitting, 40, 395, 540, 49, String.raw`$$U_j^*V_j\simeq m|U_j|^2e^{i\phi_\Delta}$$`, 'cancel-sample-phase');
    const sumText = label(fitting, 300, 454, '', 'pe-two-small');
    const energyText = label(fitting, 300, 478, '', 'pe-two-small');
    const lossText = label(fitting, 1000, 504, '', 'pe-two-small');
    const division = math(fitting, 50, 116, 500, 52, String.raw`$$\widehat\alpha=\frac C{E_U}=\widehat m e^{i\widehat\phi_\Delta}$$`, 'division');
    const ratio = el('g', { transform: 'translate(1000 265)', 'data-ratio-plane': '' }, stage);
    el('circle', { r: 100, fill: 'none', stroke: '#526a71' }, ratio);
    line(ratio, -125, 0, 128, 0); line(ratio, 0, -125, 0, 125);
    label(ratio, 142, 13, 'Re', 'pe-two-small'); label(ratio, 16, -117, 'Im', 'pe-two-small');
    label(ratio, 100, -10, '1', 'pe-two-small'); label(ratio, 0, -151, '共同复系数 α̂ · 单位圆', 'pe-two-text');
    const ratioArrow = path(ratio, colors[2], { 'data-study-ratio': '' });
    const phaseArc = path(ratio, colors[1], { 'stroke-width': 1.6 });
    const ratioText = label(ratio, 0, 149, '', 'pe-two-text', colors[2]);
    const cards = el('g', { 'data-fit-parameter-cards': '' }, stage);
    const values = [
      ['锁定波矢 k̂', `(${num(e.kx, 2)}, ${num(e.ky, 2)}) DFT 格`, colors[0], 'k'],
      ['调制度 m̂ = |α̂|', num(e.m), colors[2], 'm'],
      ['共同相位 φ̂Δ = arg α̂', num(e.phase) + ' rad', colors[1], 'phase'],
    ];
    const cardNodes = values.map(([title, value, color, key], i) => {
      const x = 250 + i * 470, g = el('g', { 'data-fit-parameter': key }, cards);
      el('rect', { x: x - 198, y: 415, width: 396, height: 83, rx: 5, fill: '#102128', stroke: color, 'stroke-opacity': .55 }, g);
      label(g, x, 444, title, 'pe-two-text', color); label(g, x, 478, value, 'pe-two-value', color);
      return g;
    });
    const legs = values.map((_, i) => path(stage, values[i][2], { 'stroke-width': 1, 'stroke-dasharray': '3 4' }));
    function draw(progress) {
      const active = progress !== null, s = L.leastSquaresState(lesson, active ? progress : 0);
      opacity(stage, active ? 1 : 0); legs.forEach(g => opacity(g, active ? s.cards : 0));
      residuals.forEach(({ residual, tag }) => { opacity(residual, active ? s.prediction * (1 - s.read) : 0); opacity(tag, active ? s.merge * (1 - s.read) : 0); });
      if (!active) planes.forEach(p => opacity(p.frame, 1));
      for (const key of ['mode', 'phase', 'm', 'trial', 'count', 'divide', 'read', 'residual', 'minimum']) set(stage, 'data-' + key, s[key]);
      set(stage, 'data-kx', e.kx); set(stage, 'data-ky', e.ky);
      opacity(context, s.gather); opacity(locked, 1 - s.cloud);
      text(locked, `k̂ = (${num(e.kx, 2)}, ${num(e.ky, 2)}) · ${best.count} 个可靠公共点`);
      opacity(relation, (1 - s.cloud) * (1 - s.read)); opacity(relationNote, (1 - s.cloud) * (1 - s.read));
      opacity(geometry, s.merge * (1 - s.read)); opacity(cloud, s.cloud * (1 - s.read));
      opacity(action, s.gather * (1 - s.read)); opacity(readout, s.prediction * (1 - s.cloud));
      opacity(legend, s.merge * (1 - s.read));
      text(action, s.mode === 'relationModel' ? '同一个复系数；三组实际 U、V'
        : s.trial ? '试探角度演示 · 仅移动橙色副本'
        : s.progress < .60 ? '方向已对齐 → 同步伸缩'
        : s.divide === 1 ? '闭式解 α̂ = C / Eᵤ · 全部公共点' : '全部可靠点 · 拟合同一个 α');
      text(readout, `共同角度 ${num(s.phase)} rad · 长度比例 ${num(s.m)}`);
      const maximum = selectedMaximum + (fullMaximum - selectedMaximum) * s.cloud;
      const scale = 130 / maximum;
      text(scaleLabel, '复数值 / N² · 圈半径 ' + num(maximum / n ** 2, 4));
      data.selected.forEach((point, i) => {
        const plane = planes[i], start = 922 + i * 185, separate = 705 + i * 280;
        const x = start + (separate - start) * s.gather, y = 279 + 6 * s.merge;
        const size = 1 + .18 * s.gather, frameScale = size + (1 - size) * s.merge;
        const individualMaximum = initialMaximum + (selectedMaximum - initialMaximum) * s.gather;
        const localScale = (58 / individualMaximum) * (1 - s.merge) + scale * s.merge;
        const prediction = mul(s.alpha, point.x);
        if (active) {
          set(plane.group, 'transform', `translate(${x + (1000 - x) * s.merge} ${y}) scale(${frameScale})`);
          opacity(plane.group, 1 - s.read); opacity(plane.frame, 1 - s.merge);
          opacity(plane.scaleLabel, (1 - s.merge) * (1 - s.gather));
          vector(plane.u, point.x, localScale); vector(plane.v, point.y, localScale); vector(plane.prediction, prediction, localScale);
          opacity(plane.u, 1 - .7 * s.cloud); opacity(plane.v, 1 - .4 * s.cloud); opacity(plane.prediction, s.prediction); opacity(plane.product, 0);
        }
        const { residual, tag } = residuals[i];
        set(residual, 'x1', prediction.re * localScale); set(residual, 'y1', -prediction.im * localScale);
        set(residual, 'x2', point.y.re * localScale); set(residual, 'y2', -point.y.im * localScale);
        set(residual, 'data-re', point.y.re - prediction.re); set(residual, 'data-im', point.y.im - prediction.im);
        set(tag, 'x', point.y.re * localScale + 12); set(tag, 'y', -point.y.im * localScale - 9 + i * 5);
      });
      dots.forEach(({ point, group, u, v, prediction, residual }, i) => {
        const z = mul(s.alpha, point.x);
        for (const [node, value] of [[u, point.x], [v, point.y], [prediction, z]]) {
          set(node, 'cx', value.re * scale); set(node, 'cy', -value.im * scale); set(node, 'data-re', value.re); set(node, 'data-im', value.im);
        }
        set(residual, 'x1', z.re * scale); set(residual, 'y1', -z.im * scale); set(residual, 'x2', point.y.re * scale); set(residual, 'y2', -point.y.im * scale);
        set(group, 'data-accumulated', i < s.count); opacity(group, i < s.count ? 1 : .35);
      });
      const sum = data.sums[s.count];
      for (const [key, value] of Object.entries({ count: s.count, 'sum-re': sum.re, 'sum-im': sum.im, energy: sum.energy, divide: s.divide })) set(fitting, 'data-' + key, value);
      opacity(fitting, s.cloud * (1 - s.read)); opacity(division, s.divide); opacity(fitSource, 1);
      text(sumText, `C / N⁴ = ${num(sum.re / n ** 4, 6)} ${sum.im < 0 ? '−' : '+'} ${num(Math.abs(sum.im) / n ** 4, 6)}i`);
      text(energyText, `Eᵤ / N⁴ = ${num(sum.energy / n ** 4, 6)} · 已累计 ${s.count} / ${best.count} 点`);
      text(lossText, `J(α̂) / Eᵥ = ${num(s.minimum / s.energy, 6)} = 1 − ρ² · ${best.count} 点共同拟合`);
      opacity(lossText, s.divide);
      opacity(ratio, s.read); vector(ratioArrow, best.alpha, 100); text(ratioText, `α̂ = ${num(best.alpha.re)} ${best.alpha.im < 0 ? '−' : '+'} ${num(Math.abs(best.alpha.im))}i`);
      const angle = Math.atan2(best.alpha.im, best.alpha.re);
      set(phaseArc, 'd', `M 40 0 A 40 40 0 0 ${angle >= 0 ? 0 : 1} ${40 * Math.cos(angle)} ${-40 * Math.sin(angle)}`);
      opacity(cards, s.cards);
      cardNodes.forEach((g, i) => { set(g, 'data-value', i === 0 ? [e.kx, e.ky].join(',') : i === 1 ? e.m : e.phase); });
      // k comes from the locked frequency map; only m and phase split from α.
      legs.forEach((g, i) => {
        const origin = i === 0 ? 300 : 1000;
        set(g, 'data-parameter-source', i === 0 ? 'locked-wavevector' : 'complex-coefficient');
        set(g, 'd', `M ${origin} 388 Q ${origin + (250 + i * 470 - origin) * .5} 399 ${250 + i * 470} 415`);
      });
    }
    draw(null);
    return { draw };
  }
  Object.assign(L, { createFitView });
})(typeof globalThis !== 'undefined' ? globalThis : this);
