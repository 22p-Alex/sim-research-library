/* Shared parameter study: linked candidate scores, continuous fitted ratio,
 * and formula emphasis. All states use the host's single reversible playhead.
 * See fairSIM 2016 Supplementary Note 1; numerical search is a teaching model. */
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const M = node ? require('../../web/parameter-demo/sim-parameter-model.js') : root.SIMParameterStory;
  const E = node ? require('../../web/shared/sim-parameter-estimation.js') : root.SIMParameterEstimation;
  const A = node ? require('../../web/atlas/sim-atlas-core.js') : root.SIMAtlas;
  const colors = ['#7ad5cd', '#b7a5eb', '#efb879'];
  const revisions = {
    conjugate: { duration: 34000 },
    overlap: { title: '从一行对应点，扩展到二维公共区。', copy: '先用教学网格说明横向和纵向移动，再明确切入实际二维频谱；沿用共轭乘积和，校正 OTF、归一化，再给候选位移评分。', duration: 26000 },
    coarse: { title: '继续尝试，把所有候选填成一张相关图。', copy: '保留同一个匹配窗口，加速扫描允许范围内的整数候选。当前位移、公共区、评分和图上的格子始终对应。', duration: 18000 },
    refine: { note: '本页采用三轮 5×5 教学搜索；fairSIM 原版 fitPeak 为三轮 10×10。网格间隔不代表实验精度。' },
    fit: { title: '累加公共区，再用参考能量求出比例。', copy: '同一批频点的共轭乘积累成一支箭头，零级能量同时累计。相除后在单位圆中画出比例箭头，接着直接读它的幅相。', duration: 19000 },
    read: { title: '沿用这支比例箭头，读出相位和调制度。', copy: '右侧保留上一幕相除得到的同一支箭头。先读角度，对照照明条纹的位置；再读长度，对照条纹对比度。', duration: 12000 },
  };
  function dimensionalState(progress) {
    const p = M.clamp(progress);
    return { previous: 1 - M.ramp(p, .02, .07), teaching: M.ramp(p, .08, .13) * (1 - M.ramp(p, .32, .37)),
      expand: M.ramp(p, .14, .25), moveY: M.ramp(p, .25, .30),
      actual: M.ramp(p, .39, .46), normalize: M.ramp(p, .47, .53),
      search: M.clamp((p - .46) / .54) };
  }
  function fittingState(id, progress, count) {
    const p = M.clamp(progress), reading = id === 'read';
    return { count: reading ? count : Math.floor(M.ramp(p, .12, .51) * count),
      divide: reading ? 1 : M.ramp(p, .64, .90),
      numeratorFocus: reading ? 0 : M.ramp(p, .08, .14) * (1 - M.ramp(p, .53, .60)),
      energyFocus: reading ? 0 : M.ramp(p, .25, .35) * (1 - M.ramp(p, .62, .68)),
      resultFocus: reading ? 1 : M.ramp(p, .70, .90),
      phase: reading ? M.ramp(p, .12, .46) : 0,
      modulation: reading ? M.ramp(p, .56, .90) : 0,
      reading: reading ? M.ramp(p, 0, .12) : 0 };
  }
  function matchingState(lesson, id, progress) {
    const p = id === 'overlap' ? dimensionalState(progress).search : M.clamp(progress), valid = lesson.estimate.coarse.filter(c => c.valid);
    if (id === 'overlap') {
      const travel = M.ramp(p, .10, .92) * 3, j = Math.min(2, Math.floor(travel));
      const local = travel === 3 ? 1 : travel - j;
      return { candidate: lesson.candidates[j], committed: lesson.candidates.slice(0, j),
        scoreReveal: M.ramp(local, .25, .46), commit: M.ramp(local, .58, .78), done: 0, local };
    }
    const travel = M.ramp(p, .10, .83) * valid.length, i = Math.min(valid.length - 1, Math.floor(travel));
    const done = M.ramp(p, .86, .96), candidate = done > 0 ? lesson.estimate.coarseBest : valid[i];
    return { candidate, committed: valid.slice(0, Math.floor(travel)), scoreReveal: 1, commit: 1, done,
      local: travel === valid.length ? 1 : travel - i };
  }
  function scene(id) {
    const i = M.index(id);
    if (i < 0) throw new Error('未知估计场景：' + id);
    return { ...M.scenes[i], duration: M.durations[i], ...revisions[id] };
  }
  function formulaAt(s) {
    if (s.id === 'overlap' && s.progress < .46) return {
      equation: String.raw`$$\left|\sum_{\text{对应点}}\text{零级值}^{*}\times\text{旁带值}\right|$$`,
      note: s.progress < .14 ? '接住上一幕的一维复数匹配：同一列取值、共轭相乘、累计后取模。'
        : s.progress < .37 ? '二维教学网格：每个格子仍存一个复数；现在还可以沿纵向尝试移动。示意格子不是真实频谱。'
        : '切入实际二维数据：先选两边 OTF 都可靠的公共区，各除自己的 OTF，再按两边能量归一化。' };
    if (s.id === 'fit') return { equation: M.scenes[M.index('fit')].equation,
      note: '依次强调累计乘积和、累计零级能量、相除结果。累计区与比例区使用不同标尺；右侧单位圆半径为 1。' };
    if (s.id === 'read') return { equation: String.raw`$$\widehat m=\left|\widehat m e^{i\widehat\phi_\Delta}\right|,\qquad\widehat\phi_\Delta=\arg\!\left(\widehat m e^{i\widehat\phi_\Delta}\right),\qquad\widehat\phi_j=\phi'_j+\widehat\phi_\Delta$$`,
      note: '比例箭头的位置和标尺沿用上一幕。照明预览由估计值重画；先示意相位，再加入调制度，没有重新采集。' };
    if (s.id === 'refine') return { equation: M.formulaAt(s).equation, note: scene(s.id).note };
    return M.formulaAt(s);
  }
  function renderMath(container, wrapped) {
    const tex = wrapped.slice(2, -2), options = { displayMode: true, output: 'mathml', throwOnError: true, strict: 'error' };
    if (root.katex.render) root.katex.render(tex, container, options);
    else container.innerHTML = root.katex.renderToString(tex, options);
  }
  function studyFor(id) { return ['overlap', 'coarse'].includes(id) ? 'matching' : ['fit', 'read'].includes(id) ? 'fitting' : null; }
  function createStudyView(container, lesson) {
    const doc = container.ownerDocument || root.document, n = lesson.capture.config.n, shared = lesson.estimate.context.separated, owned = [];
    const set = (el, key, value) => { if (el.getAttribute(key) !== String(value)) el.setAttribute(key, value); };
    const text = (el, value) => { if (el.textContent !== String(value)) el.textContent = String(value); };
    const opacity = (el, alpha) => { set(el, 'opacity', alpha); set(el, 'aria-hidden', alpha === 0); };
    const el = (tag, attrs = {}, parent, value) => {
      const item = doc.createElementNS('http://www.w3.org/2000/svg', tag);
      Object.entries(attrs).forEach(([k, v]) => item.setAttribute(k, v));
      if (value !== undefined) item.textContent = value;
      (parent || container).appendChild(item); if (!parent) owned.push(item); return item;
    };
    const label = (parent, x, y, value, cls = 'pe-svg-text', fill) => el('text', { x, y, class: cls, 'text-anchor': 'middle', ...(fill ? { style: 'fill:' + fill } : {}) }, parent, value);
    const num = value => (Math.abs(value) < .00005 ? 0 : value).toFixed(4);
    const complex = z => num(z.re) + (z.im < -.00005 ? ' − ' : ' + ') + num(Math.abs(z.im)) + 'i';
    const maxOf = list => list.reduce((v, z) => z.re.reduce((v, re, i) => Math.max(v, Math.hypot(re, z.im[i])), v), 1);
    // Linked parameter study: matching and fitting keep their graphic objects across
    // consecutive stops. No extra player, synthetic scores or truth metadata.
    const studies = {}, studyDraws = {};
    const studyGroup = id => {
      const g = el('g', { 'data-study-scene': id, 'data-parameter-study': true, opacity: 0, 'aria-hidden': true });
      studies[id] = g; return g;
    };
    const line = (g, x1, y1, x2, y2, color = '#668692') => el('path', { d: `M ${x1} ${y1} L ${x2} ${y2}`, stroke: color, fill: 'none', 'stroke-width': 1 }, g);
    const arrow = (x1, y1, x2, y2) => {
      const a = Math.atan2(y2 - y1, x2 - x1), h = 7;
      return `M ${x1} ${y1} L ${x2} ${y2} M ${x2 - h * Math.cos(a - .45)} ${y2 - h * Math.sin(a - .45)} L ${x2} ${y2} L ${x2 - h * Math.cos(a + .45)} ${y2 - h * Math.sin(a + .45)}`;
    };
    const scientific = value => value !== 0 && Math.abs(value) < .0001 ? value.toExponential(3) : num(value);
    function plane(g, cx, cy, radius, title) {
      el('circle', { cx, cy, r: radius, fill: 'none', stroke: '#47616c', 'stroke-width': 1 }, g);
      line(g, cx - radius - 15, cy, cx + radius + 20, cy); line(g, cx, cy - radius - 15, cx, cy + radius + 18);
      label(g, cx + radius + 30, cy + 5, 'Re', 'pe-svg-tick'); label(g, cx + 8, cy - radius - 22, 'Im', 'pe-svg-tick');
      label(g, cx, cy - radius - 48, title, 'pe-study-title');
      return { cx, cy, radius };
    }
    function vector(node, origin, z, scale, reveal = 1) {
      const x = origin.cx + z.re * scale * reveal, y = origin.cy - z.im * scale * reveal;
      set(node, 'd', arrow(origin.cx, origin.cy, x, y));
      for (const [key, value] of Object.entries({ re: z.re, im: z.im, scale, reveal, x, y })) set(node, 'data-' + key, value);
    }
    function pointImage(points, key, color, maximum) {
      const size = 27, c = doc.createElement('canvas'); c.width = c.height = size;
      const ctx = c.getContext('2d'), pixels = ctx.createImageData(size, size), lookup = new Map(points.map(p => [p.q.join(','), p]));
      const rgb = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16));
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const p = lookup.get([x - 13, y - 13].join(',')), value = p ? Math.max(.10, M.clamp(Math.log1p(Math.hypot(p[key].re, p[key].im)) / Math.log1p(maximum))) : 0;
        pixels.data.set([9 + rgb[0] * value * .9, 18 + rgb[1] * value * .9, 24 + rgb[2] * value * .9, 255], 4 * (y * size + x));
      }
      ctx.putImageData(pixels, 0, 0); return c.toDataURL();
    }
    {
      const g = studyGroup('matching'), e = lesson.estimate, range = 27, panelSize = 250;
      const heading = label(g, 720, 49, '', 'pe-svg-title');
      const subtitle = label(g, 720, 84, '', 'pe-svg-muted');
      const panels = [85, 420].map((x, i) => {
        const y = 157, cx = x + panelSize / 2, cy = y + panelSize / 2;
        label(g, cx, 126, i ? '旁带 · 候选归位后' : '零级 · 位置固定', 'pe-study-title', colors[i]);
        el('rect', { x: x - 5, y: y - 5, width: panelSize + 10, height: panelSize + 10, rx: 4, class: 'pe-border' }, g);
        const picture = el('image', { x, y, width: panelSize, height: panelSize, style: 'image-rendering:pixelated' }, g);
        line(g, x, cy, x + panelSize, cy); line(g, cx, y, cx, y + panelSize);
        label(g, cx, 443, i ? '除以 H(q+k′)' : '除以 H(q)', 'pe-svg-muted');
        return { picture, cx, cy };
      });
      label(g, 805, 153, '当前候选 k′', 'pe-svg-muted');
      const kValue = label(g, 805, 189, '', 'pe-study-number');
      label(g, 805, 249, '可信公共区', 'pe-svg-muted');
      const count = label(g, 805, 282, '', 'pe-study-number');
      label(g, 805, 340, '匹配分数 ρ', 'pe-svg-muted');
      const score = label(g, 805, 378, '', 'pe-svg-value');
      const status = label(g, 720, 495, '', 'pe-svg-text');
      const grid = { x: 967, y: 151, size: 280, width: 2 * e.extent + 1 };
      grid.cell = grid.size / grid.width;
      label(g, grid.x + grid.size / 2, 121, '每个候选的分数', 'pe-study-title');
      const heat = value => `rgb(${[15, 34, 46].map((v, i) => Math.round(v + ([239, 184, 121][i] - v) * value)).join(',')})`;
      const cells = e.coarse.map((c, i) => el('rect', { x: grid.x + i % grid.width * grid.cell, y: grid.y + Math.floor(i / grid.width) * grid.cell,
        width: grid.cell - .5, height: grid.cell - .5, fill: '#122129', 'data-study-score-cell': [c.kx, c.ky].join(','), 'data-score': c.score }, g));
      for (const tick of [-10, 0, 10]) {
        label(g, grid.x + (tick + e.extent + .5) * grid.cell, grid.y + grid.size + 20, String(tick), 'pe-svg-tick');
        label(g, grid.x - 17, grid.y + (tick + e.extent + .5) * grid.cell + 3, String(tick), 'pe-svg-tick');
      }
      label(g, grid.x + grid.size + 24, grid.y + grid.size + 20, 'k′x', 'pe-svg-tick');
      label(g, grid.x - 17, grid.y - 8, 'k′y', 'pe-svg-tick');
      const cursor = el('rect', { width: grid.cell + 4, height: grid.cell + 4, fill: 'none', stroke: colors[0], 'stroke-width': 2, 'data-study-cursor': true }, g);
      const write = el('path', { d: '', fill: 'none', stroke: colors[2], 'stroke-width': 1.7, 'data-study-write': true }, g);
      const peak = label(g, grid.x + grid.size / 2, 479, '', 'pe-study-title', colors[2]);
      const cache = new Map(), maximum = maxOf(shared.bands) / lesson.capture.config.minH;
      let lastKey = null;
      studyDraws.matching = (id, p) => {
        const s = matchingState(lesson, id, p), target = s.candidate;
        const prior = id === 'overlap' ? lesson.candidates[Math.max(0, lesson.candidates.indexOf(target) - 1)] : target;
        const movement = id === 'overlap' ? M.ramp(s.local, 0, .19) : 1;
        const kx = prior.kx + (target.kx - prior.kx) * movement, ky = prior.ky + (target.ky - prior.ky) * movement;
        const key = kx.toFixed(9) + ':' + ky.toFixed(9), integer = Math.abs(kx - Math.round(kx)) + Math.abs(ky - Math.round(ky)) < 1e-9;
        let record = integer ? cache.get(key) : null;
        if (!record) {
          const candidate = E.compare(e.context, kx, ky, true);
          record = { candidate, images: ['x', 'y'].map((part, i) => pointImage(candidate.points, part, colors[i], maximum)) };
          if (integer) cache.set(key, record);
        }
        const c = record.candidate;
        if (lastKey !== key) { panels.forEach((panel, i) => set(panel.picture, 'href', record.images[i])); lastKey = key; }
        text(heading, id === 'overlap' ? '移动 → 公共区评分 → 写入对应格子' : '同一个匹配窗口，继续扫描整数候选');
        text(subtitle, id === 'overlap' ? '先慢看三个候选；两幅图都只显示当前可信公共区，亮度共用固定标尺。' : '加速展示搜索过程；当前格子的亮度由左侧这一次实际评分决定。');
        text(kValue, '(' + num(kx) + ', ' + num(ky) + ')'); text(count, c.count + ' 点'); text(score, c.valid ? num(c.score) : '公共区不足'); opacity(score, .2 + .8 * s.scoreReveal);
        const committed = new Set(s.committed.map(c => [c.kx, c.ky].join(',')));
        if (id === 'coarse') lesson.candidates.forEach(c => committed.add([c.kx, c.ky].join(',')));
        if (s.commit === 1) committed.add([target.kx, target.ky].join(','));
        e.coarse.forEach((c, i) => {
          const active = committed.has([c.kx, c.ky].join(','));
          set(cells[i], 'fill', c.valid && active ? heat(c.score) : c.valid ? '#122129' : '#091115');
          set(cells[i], 'data-written', active && c.valid);
        });
        const x = grid.x + (kx + e.extent) * grid.cell, y = grid.y + (ky + e.extent) * grid.cell;
        set(cursor, 'x', x - 2); set(cursor, 'y', y - 2);
        set(write, 'd', `M 870 378 H 930 V ${y + grid.cell / 2} H ${x + grid.cell / 2}`); opacity(write, s.commit * (1 - s.done));
        text(peak, s.done > 0 ? '最高分位于 (' + num(e.coarseBest.kx) + ', ' + num(e.coarseBest.ky) + ')' : '色标固定为 0—1'); opacity(peak, id === 'coarse' ? .4 + .6 * s.done : .6);
        text(status, s.done > 0 ? '峰的坐标给出波矢初值；峰高是分数。下一步细化。' : s.commit > 0 ? '把 ρ = ' + num(c.score) + ' 记到 k′ = (' + num(kx) + ', ' + num(ky) + ') 这一格。' : movement < 1 ? '先改变候选位移，再比较重新配对的数据。' : '当前位置的公共区 → 共轭乘积和 → 能量归一化评分。');
        for (const [key, value] of Object.entries({ kx, ky, score: c.score, count: c.count, written: s.commit, done: s.done })) set(g, 'data-' + key, value);
      };
    }
    {
      const g = studyGroup('fitting'), e = lesson.estimate, points = e.fit.points;
      const accumulation = el('g', {}, g), reading = el('g', {}, g);
      const max = Math.max(...points.map(p => Math.hypot(p.x.re, p.x.im)));
      const picture = el('image', { x: 100, y: 172, width: 230, height: 230, href: pointImage(points, 'x', colors[0], max), style: 'image-rendering:pixelated' }, accumulation);
      label(accumulation, 215, 132, '同一可信公共区', 'pe-study-title');
      const marker = el('circle', { r: 5, fill: '#091115', stroke: colors[2], 'stroke-width': 2 }, accumulation);
      const counter = label(accumulation, 215, 445, '', 'pe-svg-muted');
      const sumPlane = plane(accumulation, 620, 278, 90, '累计共轭乘积和');
      const rawScale = 90 / Math.max(...lesson.sums.map(z => Math.hypot(z.re, z.im)), 1e-30);
      const rawArrow = el('path', { stroke: colors[2], 'stroke-width': 3, fill: 'none', 'data-study-numerator': true }, accumulation);
      const rawValue = label(accumulation, 620, 408, '', 'pe-svg-muted');
      const energyValue = label(accumulation, 620, 477, '', 'pe-svg-muted');
      el('rect', { x: 480, y: 438, width: 280, height: 6, fill: '#1e333c' }, accumulation);
      const energyBar = el('rect', { x: 480, y: 438, width: 0, height: 6, fill: colors[0], 'data-study-energy': true }, accumulation);
      label(accumulation, 620, 509, '累计区：固定显示倍率；读数除以 N⁴', 'pe-svg-tick');
      const divide = el('g', {}, accumulation);
      el('path', { d: arrow(768, 278, 908, 278), fill: 'none', stroke: colors[2], 'stroke-width': 2 }, divide);
      label(divide, 837, 242, '÷ 零级能量', 'pe-study-title', colors[0]);
      const resultPlane = plane(g, 1100, 278, 122, '相除得到的比例');
      label(g, 1235, 297, '1', 'pe-svg-tick');
      const ratioArrow = el('path', { stroke: colors[2], 'stroke-width': 4, fill: 'none', 'data-study-ratio': true }, g);
      const ratioValue = label(g, 1100, 443, '', 'pe-study-number');
      const ruler = label(g, 1100, 483, '比例区：单位圆半径 = 1', 'pe-svg-muted');
      const heading = label(g, 720, 47, '', 'pe-svg-title');
      const subtitle = label(g, 720, 85, '', 'pe-svg-muted');
      const phaseArc = el('path', { fill: 'none', stroke: colors[1], 'stroke-width': 4 }, g);
      const radius = el('path', { fill: 'none', stroke: colors[0], 'stroke-width': 7 }, g);
      const phaseLabel = label(reading, 660, 197, '', 'pe-svg-text', colors[1]);
      const mLabel = label(reading, 660, 245, '', 'pe-svg-text', colors[0]);
      const light = doc.createElement('canvas'); light.width = light.height = n;
      light.style.width = light.style.height = '100%';
      const foreign = el('foreignObject', { x: 100, y: 149, width: 280, height: 280 }, reading); foreign.appendChild(light);
      label(reading, 240, 124, '用估计值重画照明', 'pe-study-title');
      const lightContext = light.getContext('2d'), lightPixels = lightContext.createImageData(n, n);
      line(reading, 440, 401, 840, 401);
      const profile = el('path', { stroke: colors[2], 'stroke-width': 2, fill: 'none' }, reading);
      label(reading, 640, 465, '同一条照明剖面：先平移，再改变峰谷差', 'pe-svg-muted');
      const lightFoot = label(reading, 240, 475, '', 'pe-svg-muted');
      let lastLight = '';
      studyDraws.fitting = (id, p) => {
        const s = fittingState(id, p, points.length), total = lesson.sums[s.count], point = points[Math.max(0, s.count - 1)];
        const ratioReveal = id === 'read' ? 1 : M.ramp(s.divide, .35, 1);
        opacity(accumulation, 1 - s.reading); opacity(reading, s.reading);
        set(marker, 'cx', 215 + point.q[0] * 230 / 27); set(marker, 'cy', 287 + point.q[1] * 230 / 27);
        text(counter, '已累计 ' + s.count + ' / ' + points.length + ' 点');
        vector(rawArrow, sumPlane, total, rawScale);
        text(rawValue, '(' + scientific(total.re / n ** 4) + ', ' + scientific(total.im / n ** 4) + ')');
        text(energyValue, '零级能量 / N⁴ = ' + scientific(total.energy / n ** 4));
        set(energyBar, 'width', 280 * total.energy / e.fit.xx); set(energyBar, 'data-energy', total.energy);
        opacity(divide, s.divide);
        vector(ratioArrow, resultPlane, e.fit.alpha, 122, ratioReveal); opacity(ratioArrow, ratioReveal);
        text(ratioValue, complex(e.fit.alpha)); opacity(ratioValue, ratioReveal);
        const phi = e.phase * s.phase, amplitude = 1 + (e.m - 1) * s.modulation;
        const r = 62, endX = 1100 + r * Math.cos(phi), endY = 278 - r * Math.sin(phi);
        set(phaseArc, 'd', Math.abs(phi) < 1e-10 ? '' : `M ${1100 + r} 278 A ${r} ${r} 0 ${Math.abs(phi) > Math.PI ? 1 : 0} ${phi >= 0 ? 0 : 1} ${endX} ${endY}`);
        set(radius, 'd', arrow(1100, 278, 1100 + 122 * e.fit.alpha.re, 278 - 122 * e.fit.alpha.im)); opacity(radius, s.modulation * .45);
        const zeroPhase = Math.abs(e.phase) < 1e-6;
        text(phaseLabel, s.phase === 1 ? zeroPhase ? 'φ̂Δ ≈ 0 rad · 条纹保持原位' : '相位 φ̂Δ = ' + num(e.phase) + ' rad' : '先读比例箭头的角度');
        text(mLabel, s.modulation === 1 ? '调制度 m̂ = ' + num(e.m) : '再读比例箭头的长度');
        text(lightFoot, s.modulation === 0 ? zeroPhase ? '估计相位接近 0 · 暂定 m = 1' : '相位示意 · 暂定 m = 1' : '峰谷：' + num(1 - amplitude) + ' / ' + num(1 + amplitude));
        const signature = phi.toFixed(9) + ':' + amplitude.toFixed(9);
        if (signature !== lastLight) {
          for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
            const intensity = 1 + amplitude * Math.cos(2 * Math.PI * (e.kx * x + e.ky * y) / n + phi), b = Math.round(8 + intensity * 120);
            lightPixels.data.set([b, b, b, 255], 4 * (y * n + x));
          }
          lightContext.putImageData(lightPixels, 0, 0);
          let path = '';
          for (let j = 0; j <= 128; j++) { const x = n / 2 * j / 128, v = 1 + amplitude * Math.cos(2 * Math.PI * e.kx * x / n + phi); path += `${j ? ' L' : 'M'} ${440 + j / 128 * 400} ${401 - (v - 1) * 52}`; }
          set(profile, 'd', path); lastLight = signature;
        }
        text(heading, id === 'fit' ? '共轭乘积和 ÷ 零级能量 → 比例箭头' : '同一支比例箭头：角度给相位，长度给调制度');
        text(subtitle, id === 'fit' ? '先累计同一个公共区；分子与分母使用相同频点。相除以后改用比例标尺。' : '右侧箭头沿用上一幕的数值、位置和标尺；左侧观察对应的照明变化。');
        for (const [key, value] of Object.entries({ count: s.count, numeratorRe: total.re, numeratorIm: total.im, energy: total.energy, divide: s.divide, phase: phi, modulation: amplitude })) set(g, 'data-' + key, value);
      };
    }
    // Explain the second coordinate before showing real images. Teaching
    // columns and actual spectral data are explicitly distinct stages.
    const dimension = studyGroup('dimension');
    const dimensionTitle = label(dimension, 720, 47, '', 'pe-svg-title');
    label(dimension, 720, 80, '二维教学示意 · 每格仍是一个复数 · 随后才切入实际频谱', 'pe-svg-muted');
    const toyPanels = [330, 1020].map((cx, b) => {
      label(dimension, cx, 124, b ? '旁带 · 继续尝试纵向移动' : '零级 · 位置固定', 'pe-study-title', colors[b]);
      const grid = el('g', { 'data-dimensional-band': b }, dimension), cells = [];
      for (let row = -2; row <= 2; row++) for (let col = 0; col < 7; col++) {
        const cell = el('g', {}, grid), x = cx + (col - 3) * 62;
        el('rect', { x: x - 28, y: -24, width: 56, height: 48, rx: 3, class: 'pe-border' }, cell);
        const amplitude = [0, 1, 4, 2, 0, 0, 0][col], theta = [0, 0, Math.PI / 3, -Math.PI / 3, 0, 0, 0][col] + (b ? Math.PI / 6 : 0);
        if (amplitude && row === 0) el('path', { d: arrow(x, 0, x + amplitude * 5 * Math.cos(theta), -amplitude * 5 * Math.sin(theta)),
          stroke: colors[b], fill: 'none', 'stroke-width': 2 }, cell);
        cells.push({ cell, row });
      }
      label(dimension, cx + 270, 305, '横向位置', 'pe-svg-muted');
      const vertical = label(dimension, cx - 250, 247, '纵向位置', 'pe-svg-muted');
      return { grid, cells, vertical };
    });
    const dimensionCue = label(dimension, 720, 535, '', 'pe-svg-text');
    function drawDimension(p) {
      const s = dimensionalState(p);
      text(dimensionTitle, s.expand < 1 ? '同一排格子，增加第二个位置坐标' : '共轭、相乘、累计不变；候选多了纵向移动');
      toyPanels.forEach(({ grid, cells, vertical }, b) => {
        set(grid, 'transform', 'translate(0 ' + (300 + (b ? 56 * s.moveY : 0)) + ')');
        cells.forEach(({ cell, row }) => { set(cell, 'transform', 'translate(0 ' + row * 56 * s.expand + ')'); opacity(cell, row === 0 ? 1 : s.expand * .6); });
        opacity(vertical, s.expand);
      });
      text(dimensionCue, s.expand < 1 ? '一维：左右移动后，比较一行对应点' : s.moveY < 1 ? '二维：比较对应格子，还要尝试上下移动' : '接下来换成实际频谱：只在可信公共区做同样的运算');
      set(dimension, 'data-expansion', s.expand); set(dimension, 'data-vertical-shift', s.moveY);
    }
    return { groups: studies, drawDimension, drawScene(id, p) {
      const name = studyFor(id);
      if (!name) throw new Error('该场景不属于连动估计画面。');
      Object.values(studies).forEach(g => opacity(g, 0)); studyDraws[name](id, p); opacity(studies[name], 1);
      return M.stateForScene(id, p);
    }, destroy() { owned.forEach(g => g.remove()); } };
  }
  function createView(container, lesson, options = {}) {
    const doc = container.ownerDocument || root.document;
    const base = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
    const linked = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
    container.appendChild(base); container.appendChild(linked);
    const original = root.SIMParameterView.create(base, lesson, options), study = createStudyView(linked, lesson);
    const opacity = (el, a) => { el.setAttribute('opacity', a); el.setAttribute('aria-hidden', a === 0); };
    function drawScene(id, progress) {
      const s = M.stateForScene(id, progress), previous = M.scenes[s.step - 1], target = studyFor(id), prior = studyFor(previous?.id);
      const enter = M.ramp(progress, 0, .12);
      opacity(base, 0); opacity(linked, 0);
      if (target) {
        study.drawScene(id, progress); opacity(linked, 1);
        if (id === 'overlap') {
          const d = dimensionalState(progress);
          original.drawScene('conjugate', 1); opacity(base, d.previous);
          study.drawDimension(progress); opacity(study.groups.dimension, d.teaching); opacity(study.groups.matching, d.actual);
        } else if (previous && !prior && enter < 1) { original.drawScene(previous.id, 1); opacity(base, 1 - enter); opacity(linked, enter); }
      } else {
        original.drawScene(id, progress); opacity(base, 1);
        if (prior) {
          original.groups.forEach((g, i) => opacity(g, i === s.step ? 1 : 0));
          if (enter < 1) { study.drawScene(previous.id, 1); opacity(linked, 1 - enter); opacity(base, enter); }
        }
      }
      container.setAttribute('data-scene-id', id); container.setAttribute('data-position', s.position); container.setAttribute('data-step', s.step);
      return s;
    }
    return { drawScene, studies: study.groups, groups: original.groups, sharedPair: original.sharedPair,
      destroy() { original.destroy(); study.destroy(); base.remove(); linked.remove(); } };
  }
  function createFormulaView(container, options = {}) {
    const doc = container.ownerDocument || root.document, cache = new Map();
    const resolveFormula = options.formulaAt || formulaAt;
    let mode = null, lastEquation = '';
    const compile = (parent, tex, cls = '') => {
      const span = doc.createElement('span'); span.setAttribute('class', cls); parent.appendChild(span);
      renderMath(span, tex); return span;
    };
    const make = mode => {
      const group = doc.createElement('div'); group.setAttribute('class', 'pe-study-formula');
      const parts = {};
      if (mode === 'matching') {
        group.setAttribute('class', 'pe-study-matching-formula');
        const equation = doc.createElement('div'); equation.setAttribute('class', 'pe-study-match-equation'); group.appendChild(equation);
        const slot = (parent, name, variants) => {
          const cell = doc.createElement('span'); cell.setAttribute('class', 'pe-study-coordinate-slot'); parent.appendChild(cell);
          return variants.map((tex, i) => { const p = compile(cell, '$$' + tex + '$$', 'pe-study-formula-part'); parts[name + ':' + i] = p; return p; });
        };
        const lhs = slot(equation, 'match-label', [String.raw`\text{匹配量}`, String.raw`\rho(\mathbf k')`]);
        compile(equation, '$$=$$');
        const fraction = doc.createElement('div'); fraction.setAttribute('class', 'pe-study-match-fraction'); equation.appendChild(fraction);
        const numerator = doc.createElement('div'); numerator.setAttribute('class', 'pe-study-match-numerator'); fraction.appendChild(numerator);
        parts.open = compile(numerator, String.raw`$$\big|$$`, 'pe-study-formula-part');
        const sum = slot(numerator, 'match-range', [String.raw`\sum_{\text{一行对应点}}`, String.raw`\sum_{\text{二维对应点}}`, String.raw`\sum_{\mathbf q\in\Omega(\mathbf k')}`]);
        const zero = slot(numerator, 'match-zero', [String.raw`\textcolor{#7ad5cd}{\text{零级值}}`, String.raw`\textcolor{#7ad5cd}{\left(\frac{\widetilde A_0(\mathbf q)}{H(\mathbf q)}\right)}`]);
        parts.star = compile(numerator, '$$ {}^*$$', 'pe-study-formula-part pe-study-conjugate-star');
        parts.multiply = compile(numerator, '$$\\times$$', 'pe-study-formula-part');
        const side = slot(numerator, 'match-side', [String.raw`\textcolor{#b7a5eb}{\text{旁带值}}`, String.raw`\textcolor{#b7a5eb}{\frac{\widetilde A_{+1}(\mathbf q+\mathbf k')}{H(\mathbf q+\mathbf k')}}`]);
        parts.close = compile(numerator, String.raw`$$\big|$$`, 'pe-study-formula-part');
        parts.denominator = compile(fraction, String.raw`$$\sqrt{\left(\sum_{\Omega}\left|\frac{\widetilde A_0(\mathbf q)}{H(\mathbf q)}\right|^2\right)\left(\sum_{\Omega}\left|\frac{\widetilde A_{+1}(\mathbf q+\mathbf k')}{H(\mathbf q+\mathbf k')}\right|^2\right)}$$`, 'pe-study-match-denominator');
        const cue = slot(group, 'match-cue', [String.raw`\text{沿用左移两格：}1\times1+4\times4+2\times2=21`,
          String.raw`\text{在原式加入星号：零级相位 }60^\circ\longrightarrow-60^\circ`,
          String.raw`\text{这一列：}4\times4=16,\quad90^\circ-60^\circ=30^\circ`,
          String.raw`\text{每列重复相同操作，再累计各列的复数乘积}`,
          String.raw`\text{最后取合成长度：}21`,
          String.raw`\text{运算不变，求和范围从一行扩展到二维}`,
          String.raw`\text{实际频谱：可信公共区、双边 OTF 校正、能量归一化}`]);
        const setPart = (part, alpha, emphasized = false) => {
          part.style.opacity = String(alpha); part.setAttribute('aria-hidden', alpha === 0); part.setAttribute('data-emphasized', emphasized);
        };
        const blend = (list, weights) => list.forEach((p, i) => setPart(p, weights[i]));
        Object.entries(parts).forEach(([name, p]) => p.setAttribute('data-formula-part', name));
        return { group, parts, draw(s) {
          const c = s.id === 'conjugate' ? M.complexState(s.progress) : M.complexState(1);
          const d = s.id === 'overlap' ? dimensionalState(s.progress) : { expand: 0, actual: 0, normalize: 0 };
          blend(lhs, [1 - d.normalize, d.normalize]);
          blend(sum, [(1 - d.expand) * (1 - d.actual), d.expand * (1 - d.actual), d.actual]);
          blend(zero, [1 - d.actual, d.actual]); blend(side, [1 - d.actual, d.actual]);
          sum.forEach((part, i) => part.setAttribute('data-emphasized', i === 0 && s.id === 'conjugate' && c.phase === 'sum' && c.commit > 0));
          setPart(parts.star, c.conjugate, c.phase === 'conjugate' && s.id === 'conjugate');
          setPart(parts.multiply, 1, c.phase === 'multiply' && s.id === 'conjugate');
          setPart(parts.open, c.measure, c.phase === 'magnitude' && s.id === 'conjugate');
          setPart(parts.close, c.measure, c.phase === 'magnitude' && s.id === 'conjugate');
          parts.denominator.style.opacity = String(d.normalize);
          parts.denominator.setAttribute('aria-hidden', d.normalize === 0);
          parts.denominator.style.maxHeight = String(d.normalize * 64) + 'px';
          parts.denominator.style.paddingTop = String(d.normalize * 5) + 'px';
          parts.denominator.style.borderTopWidth = d.normalize > 0 ? '1px' : '0';
          const phase = s.id === 'conjugate' ? ['pair', 'conjugate', 'multiply', 'sum', 'magnitude'].indexOf(c.phase) : d.actual > 0 ? 6 : 5;
          cue.forEach((p, i) => setPart(p, i === phase ? 1 : 0));
          group.setAttribute('data-matching-scene', s.id); group.setAttribute('data-normalization', d.normalize);
        } };
      } else if (mode === 'shared' || mode === 'provisional-split') {
        group.setAttribute('class', 'pe-study-coordinate-formula');
        const actual = doc.createElement('div'); actual.setAttribute('class', 'pe-study-coordinate-rows'); group.appendChild(actual);
        const row = () => { const r = doc.createElement('div'); r.setAttribute('class', 'pe-study-coordinate-row'); actual.appendChild(r); return r; };
        if (mode === 'provisional-split') {
          parts.zero = compile(row(), String.raw`$$\textcolor{#7ad5cd}{\widetilde A_0(\mathbf f)}=\frac13\sum_{j=0}^2D_j(\mathbf f)=\textcolor{#7ad5cd}{A_0(\mathbf f)}$$`, 'pe-study-formula-part');
          parts.side = compile(row(), String.raw`$$\textcolor{#b7a5eb}{\widetilde A_{+1}(\mathbf f)}=\frac23\sum_{j=0}^2e^{-i\phi'_j}D_j(\mathbf f)=\textcolor{#efb879}{m e^{i\phi_\Delta}}\textcolor{#b7a5eb}{A_{+1}(\mathbf f)}$$`, 'pe-study-formula-part');
          Object.entries(parts).forEach(([name, p]) => p.setAttribute('data-formula-part', name));
          return { group, parts, draw(s) {
            for (const [name, p] of Object.entries(parts)) {
              const reveal = M.ramp(s.progress, name === 'zero' ? .12 : .29, name === 'zero' ? .25 : .44);
              p.style.opacity = String(reveal); p.setAttribute('data-emphasized', reveal > 0 && reveal < 1);
            }
          } };
        }
        // Each term has fixed, overlapping alternatives. No per-frame KaTeX
        // replacement or layout reads: reversing only retraces these opacities.
        const slot = (parent, name, variants) => {
          const cell = doc.createElement('span'); cell.setAttribute('class', 'pe-study-coordinate-slot'); parent.appendChild(cell);
          return variants.map((tex, i) => {
            const p = compile(cell, '$$' + tex + '$$', 'pe-study-formula-part');
            p.setAttribute('data-formula-part', name + ':' + i); parts[name + ':' + i] = p; return p;
          });
        };
        const z = row(), v = row();
        const zeroLhs = slot(z, 'zero-position', [String.raw`\widetilde A_0(\mathbf f)`, String.raw`\widetilde A_0(\mathbf q)`, String.raw`\frac{\widetilde A_0(\mathbf q)}{H(\mathbf q)}`]);
        zeroLhs.forEach(p => p.style.color = '#7ad5cd');
        compile(z, '$$=$$');
        const zeroH = slot(z, 'zero-otf', [String.raw`H(\mathbf f)`, String.raw`H(\mathbf q)`]);
        const zeroS = slot(z, 'zero-sample', [String.raw`S(\mathbf f)`, String.raw`S(\mathbf q)`]);
        const sideLhs = slot(v, 'side-position', [String.raw`\widetilde A_{+1}(\mathbf f)`, String.raw`\widetilde A_{+1}(\mathbf q+\mathbf k)`, String.raw`\frac{\widetilde A_{+1}(\mathbf q+\mathbf k)}{H(\mathbf q+\mathbf k)}`]);
        sideLhs.forEach(p => p.style.color = '#b7a5eb');
        compile(v, '$$=$$'); compile(v, String.raw`$$\textcolor{#efb879}{m e^{i\phi_\Delta}}$$`);
        const sideH = slot(v, 'side-otf', [String.raw`H(\mathbf f)`, String.raw`H(\mathbf q+\mathbf k)`]);
        const sideS = slot(v, 'side-sample', [String.raw`S(\mathbf f-\mathbf k)`, String.raw`S((\mathbf q+\mathbf k)-\mathbf k)`, String.raw`S(\mathbf q)`]);
        const cue = compile(group, String.raw`$$\mathbf f=\mathbf q+\mathbf k\quad\Longrightarrow\quad(\mathbf q+\mathbf k)-\mathbf k=\mathbf q$$`, 'pe-study-coordinate-cue');
        const toy = slot(group, 'teaching', [M.teachingEquations.copies.slice(2, -2), M.teachingEquations.aligned.slice(2, -2)]);
        const blend = (list, values, focus = 0) => list.forEach((p, i) => {
          p.style.opacity = String(values[i]); p.setAttribute('aria-hidden', values[i] === 0);
          p.setAttribute('data-emphasized', values[i] > .5 && focus > .1);
        });
        return { group, parts, draw(s) {
          const t = s.teaching || M.teachingState(s.progress), q = t.zeroCoordinate, k = t.sideCoordinate, c = t.correction;
          blend(zeroLhs, [1 - q, q * (1 - c), c], q * (1 - k));
          blend(zeroH, [(1 - q) * (1 - c), q * (1 - c)], c);
          blend(zeroS, [1 - q, q], t.markers);
          blend(sideLhs, [1 - k, k * (1 - c), c], k * (1 - t.cancelArgument));
          blend(sideH, [(1 - k) * (1 - c), k * (1 - c)], c);
          blend(sideS, [1 - t.expandArgument, t.expandArgument * (1 - t.cancelArgument), t.cancelArgument], t.markers);
          actual.style.opacity = String(1 - t.abstract);
          cue.style.opacity = String(q * (1 - t.abstract) * (1 - c));
          blend(toy, [t.abstract * (1 - t.align), t.abstract * t.align], 0);
          group.setAttribute('data-coordinate-phase', t.formula);
        } };
      } else if (mode === 'fit') {
        const fraction = doc.createElement('div'); fraction.setAttribute('class', 'pe-study-fraction'); group.appendChild(fraction);
        const zero = String.raw`\frac{\widetilde A_0(\mathbf q)}{H(\mathbf q)}`;
        const side = String.raw`\frac{\widetilde A_{+1}(\mathbf q+\widehat{\mathbf k})}{H(\mathbf q+\widehat{\mathbf k})}`;
        parts.numerator = compile(fraction, `$$\\sum_{\\Omega}\\left(${zero}\\right)^*${side}$$`, 'pe-study-formula-part');
        parts.energy = compile(fraction, `$$\\sum_{\\Omega}\\left|${zero}\\right|^2$$`, 'pe-study-formula-part');
        compile(group, '$$=$$'); parts.result = compile(group, String.raw`$$\widehat m e^{i\widehat\phi_\Delta}$$`, 'pe-study-formula-part');
      } else {
        group.setAttribute('class', 'pe-study-formula pe-study-read-formula');
        const row = doc.createElement('div'); row.setAttribute('class', 'pe-study-read-factors'); group.appendChild(row);
        parts.phase = compile(row, String.raw`$$\arg\!\left(\widehat m e^{i\widehat\phi_\Delta}\right)=\widehat\phi_\Delta$$`, 'pe-study-formula-part pe-phase-part');
        parts.modulation = compile(row, String.raw`$$\left|\widehat m e^{i\widehat\phi_\Delta}\right|=\widehat m$$`, 'pe-study-formula-part');
        parts.nominal = compile(group, String.raw`$$\widehat\phi_j=\phi'_j+\widehat\phi_\Delta$$`, 'pe-study-formula-part');
      }
      for (const [name, part] of Object.entries(parts)) part.setAttribute('data-formula-part', name);
      return { group, parts };
    };
    const clear = () => { Array.from(container.children).forEach(child => child.remove()); container.innerHTML = ''; };
    function draw(s) {
      const next = ['conjugate', 'overlap'].includes(s.id) ? 'matching' : ['fit', 'read', 'shared', 'provisional-split'].includes(s.id) ? s.id : 'static', formula = resolveFormula(s);
      if (mode !== next || next !== 'static' && !Array.from(container.children).includes(cache.get(next)?.group)) {
        clear(); mode = next; lastEquation = '';
        container.setAttribute('data-formula-mode', mode);
        if (mode !== 'static') { if (!cache.has(mode)) cache.set(mode, make(mode)); container.appendChild(cache.get(mode).group); }
      }
      if (mode === 'static') {
        if (lastEquation !== formula.equation) {
          renderMath(container, formula.equation);
          lastEquation = formula.equation;
        }
      } else if (cache.get(mode).draw) {
        cache.get(mode).draw(s);
      } else {
        const f = fittingState(s.id, s.progress, 1), parts = cache.get(mode).parts;
        const emphasis = mode === 'fit' ? { numerator: f.numeratorFocus, energy: f.energyFocus, result: f.resultFocus }
          : { phase: M.ramp(s.progress, .08, .15) * (1 - M.ramp(s.progress, .50, .57)), nominal: M.ramp(s.progress, .44, .52), modulation: M.ramp(s.progress, .56, .64) };
        for (const [name, part] of Object.entries(parts)) {
          part.style.opacity = String(.25 + .75 * emphasis[name]);
          part.setAttribute('data-emphasized', emphasis[name] > .1);
        }
      }
      return formula;
    }
    return { draw, reset() { mode = null; lastEquation = ''; }, destroy() { clear(); cache.clear(); mode = null; } };
  }
  const api = { scene, formulaAt, dimensionalState, fittingState, matchingState, studyFor, createStudyView, createView, createFormulaView };
  if (node) module.exports = api; else root.SIMParameterStudy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
