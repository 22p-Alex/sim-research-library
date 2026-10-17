/* SVG/Canvas chapter renderer. create(container, lesson) owns only its stage;
 * draw(localPosition) is deterministic and can be driven by a host playhead. */
(function (root) {
  'use strict';
  const M = root.SIMParameterStory, A = root.SIMAtlas;
  const cyan = '#7ad5cd', violet = '#b7a5eb', orange = '#efb879', grey = '#8fa9b2';
  function create(container, lesson, options = {}) {
    const doc = container.ownerDocument || document, e = lesson.estimate, n = lesson.capture.config.n;
    const groups = [], draws = [], ownedRoots = [], range = 27, unit = size => size / range;
    let sharedPair;
    const set = (el, name, value) => { if (el.getAttribute(name) !== String(value)) el.setAttribute(name, value); };
    const text = (el, value) => { if (el.textContent !== String(value)) el.textContent = String(value); };
    const opacity = (el, value) => set(el, 'opacity', value);
    const el = (tag, attrs, parent = container, value) => {
      const node = doc.createElementNS('http://www.w3.org/2000/svg', tag);
      Object.entries(attrs || {}).forEach(([k, v]) => node.setAttribute(k, v));
      if (value !== undefined) node.textContent = value;
      parent.appendChild(node); if (parent === container) ownedRoots.push(node); return node;
    };
    const label = (parent, x, y, value, cls = 'pe-svg-text', anchor = 'middle', color) => {
      const node = el('text', { x, y, class: cls, 'text-anchor': anchor }, parent, value);
      if (color) node.style.fill = color;
      return node;
    };
    const line = (parent, x1, y1, x2, y2, color = grey, extra = {}) => el('line', { x1, y1, x2, y2, stroke: color, 'stroke-width': 1, ...extra }, parent);
    const arrowPath = (x1, y1, x2, y2) => {
      const a = Math.atan2(y2 - y1, x2 - x1), h = 8;
      return 'M ' + x1 + ' ' + y1 + ' L ' + x2 + ' ' + y2 + ' M ' + (x2 - h * Math.cos(a - .45)) + ' ' + (y2 - h * Math.sin(a - .45)) + ' L ' + x2 + ' ' + y2 + ' L ' + (x2 - h * Math.cos(a + .45)) + ' ' + (y2 - h * Math.sin(a + .45));
    };
    const num = (value, digits = 3) => (Math.abs(value) < .5 * 10 ** -digits ? 0 : value).toFixed(digits);
    const complex = (z, scale = 1, digits = 4) => num(z.re / scale, digits) + (z.im < -.5 * 10 ** -digits * scale ? ' − ' : ' + ') + num(Math.abs(z.im) / scale, digits) + 'i';
    const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    function canvas(width, height) { const c = doc.createElement('canvas'); c.width = width; c.height = height; return c; }
    const maxOf = spectra => spectra.reduce((max, z) => z.re.reduce((v, r, i) => Math.max(v, Math.hypot(r, z.im[i])), max), 1);
    const spectralMax = maxOf(e.context.separated.bands);
    function paintSpectrum(c, z, color, maximum = spectralMax, points = null) {
      const ctx = c.getContext('2d'), image = ctx.createImageData(range, range), tint = rgb(color);
      const map = points ? new Map(points.map(p => [p.q.join(','), p])) : null;
      for (let y = 0; y < range; y++) for (let x = 0; x < range; x++) {
        const q = [x - 13, y - 13], i = A.idx(...q, n), j = (y * range + x) * 4, p = map?.get(q.join(','));
        const re = z ? z.re[i] : p?.value.re || 0, im = z ? z.im[i] : p?.value.im || 0;
        const magnitude = Math.hypot(re, im);
        const v = M.clamp(Math.log1p(magnitude) / Math.log1p(maximum));
        const floor = p ? .10 : 0, brightness = Math.max(floor, v);
        image.data.set([Math.round(9 + tint[0] * brightness * .92), Math.round(18 + tint[1] * brightness * .92), Math.round(24 + tint[2] * brightness * .90), 255], j);
      }
      ctx.putImageData(image, 0, 0);
    }
    function spectrumURL(z, color, maximum, points) { const c = canvas(range, range); paintSpectrum(c, z, color, maximum, points); return c.toDataURL(); }
    function image(parent, x, y, width, height, href) { return el('image', { x, y, width, height, href, style: 'image-rendering:pixelated' }, parent); }
    function panel(parent, x, y, size, title, href, frequency = false) {
      const g = el('g', {}, parent); el('rect', { x: x - 7, y: y - 7, width: size + 14, height: size + 14, rx: 4, class: 'pe-border' }, g);
      const picture = image(g, x, y, size, size, href || '');
      const heading = label(g, x + size / 2, y - 28, title, 'pe-svg-title');
      const foot = label(g, x + size / 2, y + size + 30, '', 'pe-svg-muted');
      if (frequency) {
        line(g, x, y + size / 2, x + size, y + size / 2, grey, { opacity: .27 }); line(g, x + size / 2, y, x + size / 2, y + size, grey, { opacity: .27 });
        [-10, 0, 10].forEach(t => label(g, x + size / 2 + t * unit(size), y + size + 14, String(t), 'pe-svg-tick'));
      }
      return { group: g, picture, heading, foot, x, y, size, cx: x + size / 2, cy: y + size / 2 };
    }
    function plane(parent, cx, cy, radius, title, color) {
      const g = el('g', {}, parent);
      el('circle', { cx, cy, r: radius, fill: 'none', stroke: '#34535e', 'stroke-width': 1 }, g);
      line(g, cx - radius - 18, cy, cx + radius + 22, cy); line(g, cx, cy - radius - 18, cx, cy + radius + 20);
      label(g, cx + radius + 30, cy + 5, 'Re', 'pe-svg-tick'); label(g, cx + 3, cy - radius - 28, 'Im', 'pe-svg-tick');
      label(g, cx, cy - radius - 57, title, 'pe-svg-title');
      const arrow = el('path', { d: '', fill: 'none', stroke: color, 'stroke-width': 3 }, g);
      const value = label(g, cx, cy + radius + 44, '', 'pe-svg-text pe-svg-number', 'middle', color);
      return { group: g, arrow, value, cx, cy, radius };
    }
    const point = (parent, x, y, color = orange, r = 6) => el('circle', { cx: x, cy: y, r, fill: '#091115', stroke: color, 'stroke-width': 2 }, parent);
    function vector(plane, z, scale) { set(plane.arrow, 'd', arrowPath(plane.cx, plane.cy, plane.cx + z.re * scale, plane.cy - z.im * scale)); }
    function stage() { const g = el('g', { opacity: 0, 'aria-hidden': true, 'data-scene': groups.length, 'data-scene-id': M.scenes[groups.length].id }); groups.push(g); return g; }
    const bandURLs = e.context.separated.bands.map((z, b) => spectrumURL(z, b === 0 ? cyan : violet));

    // 0. Track corresponding sample frequencies, then unfold an explicitly
    // separate one-dimensional teaching example. No toy data enters estimation.
    {
      const g = stage(), actual = el('g', {}, g), abstract = el('g', {}, g), colors = [cyan, orange, violet];
      // A host may keep this exact pair outside the scene fade, so the preceding
      // provisional split can move the same nodes into this scene reversibly.
      const pairRoot = el('g', { 'data-frequency-pair': '', 'data-frequency-range': range,
        'data-brightness-maximum': spectralMax }, options.sharedPairContainer || actual);
      if (options.sharedPairContainer) ownedRoots.push(pairRoot);
      const pair = [251, 931].map((x, b) => panel(pairRoot, x, 266, 218, b ? '临时正一级 Ã₊₁(f)' : '临时零级 Ã₀(f)', bandURLs[b], true));
      pair.forEach((p, b) => { set(p.picture, 'data-shared-band', b); p.heading.style.fill = b ? violet : cyan; });
      text(pair[0].foot, '检测位置 f = q'); text(pair[1].foot, '检测位置 f = q + k');
      const bridgeTitle = label(actual, 720, 114, '', 'pe-svg-title');
      const bridgeDetail = label(actual, 720, 157, '', 'pe-svg-text');
      const markers = lesson.correspondence.map((p, j) => {
        return pair.map((panel, b) => {
          const group = el('g', { 'data-corresponding-point': j + ':' + b }, panel.group);
          const f = [p.q[0] + (b ? e.kx : 0), p.q[1] + (b ? e.ky : 0)], x = panel.cx + f[0] * unit(panel.size), y = panel.cy + f[1] * unit(panel.size);
          point(group, x, y, colors[j], 5); label(group, x + 14, y - 9,
            j === 0 ? (b ? 'A · q+k' : 'A · q') : ['A', 'B', 'C'][j], 'pe-svg-text', 'middle', colors[j]);
          return group;
        });
      });
      sharedPair = { root: pairRoot, panels: pair, markers: markers.flat(), range, maximum: spectralMax,
        bandURLs, bands: e.context.separated.bands };
      label(abstract, 720, 49, '一维教学例 · OTF 已校正 · m = 1、φΔ = 0 · 预设 k = +2 格', 'pe-svg-text', 'middle', orange);
      const base = 330, dx = 165, sampleY = 135, zeroY = 270, plusY = 405;
      const rowLabels = ['样品频谱 S(q)', '零级（OTF 已校正）', '旁带（OTF 已校正）'].map((title, i) => label(abstract, 145, [sampleY, zeroY, plusY][i] + 7, title, 'pe-svg-text'));
      for (let f = 0; f <= 5; f++) {
        [sampleY, zeroY, plusY].forEach(y => {
          el('rect', { x: base + f * dx - 43, y: y - 27, width: 86, height: 54, rx: 5, class: 'pe-border' }, abstract);
          label(abstract, base + f * dx, y + 8, '0', 'pe-svg-text');
          label(abstract, base + f * dx, y + 49, String(f), 'pe-svg-muted');
        });
      }
      const tokens = [1, 2, 3].map((f, j) => {
        const nodes = Array.from({ length: 3 }, () => {
          const group = el('g', {}, abstract);
          el('rect', { x: -43, y: -27, width: 86, height: 54, rx: 5, fill: '#142930', stroke: colors[j], 'stroke-width': 2 }, group);
          label(group, 0, 9, String(lesson.teaching.u[f]), 'pe-svg-value', 'middle', colors[j]); return group;
        });
        return { f, nodes };
      });
      const coordinate = label(abstract, 145, 468, '', 'pe-svg-muted'), action = label(abstract, 720, 514, '', 'pe-svg-text');
      draws.push(s => {
        const t = s.teaching; opacity(actual, 1 - t.abstract); opacity(abstract, t.abstract);
        const messages = {
          source: ['先接上一步：已经分出的两份频带', '零级包含 S(f)，旁带包含 S(f−k)'],
          substitute: ['要比较同一个样品频率 q', '零级取 q，旁带取 q+k，因为 (q+k)−k=q'],
          shared: ['代入以后：两边都有同一个 S(q)', '同色标记追踪同一信息；衰减和照明比例仍不同'],
          corrected: ['两次记录的衰减不同，比较前还需 OTF 校正', '图中保留检测频谱；下方分别除 H，再转入一维教学例'],
        };
        const message = messages[t.formula] || messages.corrected;
        text(bridgeTitle, message[0]); text(bridgeDetail, message[1]);
        text(pair[0].foot, '检测位置 f = q'); text(pair[1].foot, '检测位置 f = q + k');
        markers.forEach((both, j) => both.forEach((marker, b) => opacity(marker,
          j === 0 ? (b ? t.sideCoordinate : t.zeroCoordinate) : M.clamp(t.markers * 3 - j))));
        if (!options.sharedPairContainer) opacity(pairRoot, 1);
        tokens.forEach(({ f, nodes }) => {
          const x = base + f * dx;
          set(nodes[0], 'transform', 'translate(' + x + ' ' + sampleY + ')');
          set(nodes[1], 'transform', 'translate(' + x + ' ' + (sampleY + (zeroY - sampleY) * t.copies) + ')');
          set(nodes[2], 'transform', 'translate(' + (x + 2 * dx * t.copies - 2 * dx * t.align) + ' ' + (sampleY + (plusY - sampleY) * t.copies) + ')');
        });
        text(coordinate, t.align === 1 ? '已换回样品坐标 q' : '刻度：频率位置');
        text(rowLabels[2], t.align === 1 ? '已对齐旁带（OTF 已校正）' : '旁带（OTF 已校正）');
        text(action, t.copies < 1 ? '同一段 1、4、2 → 两份检测记录' : t.align < 1 ? '旁带向右错开两格 → 向左移两格归位' : '现在已知为什么能匹配；未知位移该怎样找？');
        set(g, 'data-toy-shift', 2 * t.copies - 2 * t.align); set(g, 'data-shared-formula', t.formula);
      });
    }
    // 1. Every displayed product is computed from zero-extended sequences.
    {
      const g = stage(), example = lesson.teaching, x0 = 305, dx = 91, colors = [cyan, orange, violet];
      label(g, 720, 51, '教学序列 · 横轴是频率位置 · 范围外补零', 'pe-svg-text', 'middle', orange);
      ['零级', '移动后的旁带', '逐点乘积'].forEach((v, i) => label(g, 128, [143, 259, 358][i], v, 'pe-svg-text'));
      const products = [], pairs = [];
      example.frequencies.forEach((f, i) => {
        const x = x0 + i * dx;
        label(g, x, 88, String(f), 'pe-svg-muted');
        pairs.push(el('rect', { x: x - 37, y: 108, width: 74, height: 178, rx: 6, fill: '#17333a', stroke: cyan, opacity: 0 }, g));
        label(g, x, 143, String(example.u[f] || 0), 'pe-svg-title');
        label(g, x, 201, '×', 'pe-svg-muted');
        label(g, x, 259, '0', 'pe-svg-muted');
        products.push(label(g, x, 358, '', 'pe-svg-value'));
      });
      const moving = [1, 2, 3].map((f, j) => {
        const group = el('g', {}, g);
        el('rect', { x: -33, y: -29, width: 66, height: 49, rx: 5, fill: '#142930', stroke: colors[j] }, group);
        label(group, 0, 6, String(example.u[f]), 'pe-svg-title', 'middle', colors[j]); return { f: f + 2, group };
      });
      line(g, 263, 311, 891, 311, grey);
      const readout = label(g, 573, 422, '', 'pe-svg-value'), moveLabel = label(g, 573, 475, '', 'pe-svg-text');
      label(g, 1150, 85, '每个位移的相关分数', 'pe-svg-title');
      line(g, 974, 333, 1340, 333, grey); line(g, 974, 124, 974, 333, grey);
      const bars = example.real.map(({ delta, score }) => {
        const x = 1006 + delta * 65;
        const rect = el('rect', { x, y: 333, width: 38, height: 0, fill: grey }, g);
        const value = label(g, x + 19, 323 - score * 8, String(score), 'pe-svg-text');
        label(g, x + 19, 357, String(delta), 'pe-svg-text'); return { rect, value };
      });
      label(g, 1160, 390, '横轴：左移格数 δ', 'pe-svg-muted');
      const peak = el('g', {}, g);
      label(peak, 1160, 443, '高度 21：分数', 'pe-svg-text', 'middle', cyan);
      label(peak, 1160, 479, '位置 2：要找的位移', 'pe-svg-title', 'middle', orange);
      draws.push(s => {
        const r = s.real, candidate = example.real[r.candidate], count = r.best === 1 ? 7 : r.products;
        moving.forEach(({ f, group }) => set(group, 'transform', 'translate(' + (x0 + (f - r.shift + 1) * dx) + ' 253)'));
        products.forEach((node, i) => { text(node, i < count ? String(candidate.products[i]) : '·'); opacity(node, r.table); opacity(pairs[i], r.table * (i < count && candidate.products[i] !== 0 ? .6 : 0)); });
        const partial = candidate.products.slice(0, count).reduce((sum, term) => sum + term, 0);
        text(readout, '移动 ' + r.candidate + ' 格：相加 = ' + partial + (count < 7 ? ' …' : '')); opacity(readout, r.table);
        text(moveLabel, r.best === 1 ? '旁带左移 2 格归位 → 教学波矢向右 2 格' : r.table === 0 ? '向左移动 ' + num(r.shift, 1) + ' 格' : '已累计 ' + count + ' / 7 列乘积');
        bars.forEach(({ rect, value }, j) => {
          const reveal = r.best > 0 || j < r.completed ? 1 : j === r.candidate ? r.score : 0, h = example.real[j].score * 8 * reveal;
          set(rect, 'y', 333 - h); set(rect, 'height', h); set(rect, 'fill', r.best > 0 && j === 2 ? orange : cyan); opacity(value, reveal);
        });
        opacity(peak, r.best); set(g, 'data-candidate', r.candidate); set(g, 'data-shift', r.shift); set(g, 'data-partial', partial); set(g, 'data-products', count);
      });
    }
    // 2. Continue the very same one-dimensional grid. These deliberately
    // synthetic phases never enter the estimator or the actual reconstruction.
    {
      const g = stage(), example = lesson.complexTeaching, x0 = 305, dx = 91;
      const inputScale = 7, productScale = 1.75;
      const heading = label(g, 720, 40, '', 'pe-svg-title');
      label(g, 720, 66, '一维教学例 · 幅度仍是 1、4、2 · 候选固定：旁带左移 2 格 · 共同相位 30°', 'pe-svg-muted');
      const caption = label(g, 570, 528, '', 'pe-svg-text');
      ['零级', '已左移的旁带', '这一列的乘积'].forEach((v, j) => label(g, 128, [143, 259, 358][j], v, 'pe-svg-text', 'middle', [cyan, violet, orange][j]));
      const selectedColumn = el('rect', { x: 0, y: 108, width: 78, height: 285, rx: 6,
        fill: '#efb8790c', stroke: orange, 'stroke-width': 1.5, 'data-teaching-selection': true }, g);
      const vectorData = (node, cx, cy, z, scale, reveal = 1, start = { re: 0, im: 0 }) => {
        set(node, 'd', arrowPath(cx + start.re * scale, cy - start.im * scale,
          cx + (start.re + z.re * reveal) * scale, cy - (start.im + z.im * reveal) * scale));
        for (const [key, value] of Object.entries({ re: z.re, im: z.im, scale, reveal, startRe: start.re, startIm: start.im })) set(node, 'data-' + key, value);
      };
      const polar = (length, theta) => ({ re: length * Math.cos(theta), im: length * Math.sin(theta) });
      const degrees = theta => Math.round(theta * 180 / Math.PI);
      const cells = example.columns.map((column, i) => {
        const x = x0 + i * dx;
        label(g, x, 88, String(column.f), 'pe-svg-muted');
        const rows = [143, 259, 358].map((y, row) => {
          el('rect', { x: x - 37, y: y - 34, width: 74, height: 68, rx: 4, class: 'pe-border' }, g);
          line(g, x - 28, y, x + 28, y, grey, { opacity: .22 });
          const arrow = el('path', { d: '', fill: 'none', stroke: [cyan, violet, orange][row], 'stroke-width': 2.2,
            'data-teaching-row': row, 'data-teaching-frequency': column.f }, g);
          const value = label(g, x, y + 28, '', 'pe-svg-tick');
          const original = label(g, x, y + 7, String(row === 2 ? column.amplitude ** 2 : column.amplitude), 'pe-svg-title');
          return { arrow, value, original, x, y };
        });
        return { column, rows };
      });
      line(g, 267, 409, 908, 409, grey, { opacity: .45 });
      const initialResult = label(g, 573, 459, '沿用上一幕：1×1 + 4×4 + 2×2 = 21', 'pe-svg-text');
      const sumGroup = el('g', {}, g);
      label(sumGroup, 350, 436, '按列累计', 'pe-svg-muted');
      const sumArrows = example.order.map((_, j) => el('path', { d: '', stroke: [orange, cyan, violet][j], fill: 'none',
        'stroke-width': 3, 'data-teaching-sum-term': j }, sumGroup));
      const totalArrow = el('path', { d: '', stroke: '#f2eee4', fill: 'none', 'stroke-width': 2, 'data-teaching-total': true }, sumGroup);
      const totalValue = label(sumGroup, 685, 460, '', 'pe-svg-text');
      const score = label(sumGroup, 685, 496, '', 'pe-svg-title', 'middle', orange);
      // Only the selected column is enlarged. Frequency location and complex
      // phase remain separate: these little planes live beside the row grid.
      const zoom = el('g', {}, g);
      const zoomTitle = label(zoom, 1160, 143, '', 'pe-svg-text');
      const zPlane = plane(zoom, 1055, 213, 40, '零级', cyan);
      const vPlane = plane(zoom, 1240, 213, 40, '旁带', violet);
      const pPlane = plane(zoom, 1145, 369, 44, '这一列的乘积', orange);
      [zPlane, vPlane, pPlane].forEach((p, j) => p.value.style.fill = [cyan, violet, orange][j]);
      const zGhost = el('path', { d: '', fill: 'none', stroke: cyan, 'stroke-width': 1.5, 'stroke-dasharray': '4 4' }, zPlane.group);
      const angleText = label(zoom, 1150, 482, '', 'pe-svg-text', 'middle', orange);
      label(zoom, 1150, 516, '格内箭头：方向读相位，长度读幅度', 'pe-svg-muted');
      label(zoom, 1150, 540, '输入同尺；乘积另尺，计算看标注值', 'pe-svg-tick');
      draws.push(s => {
        const c = s.complex, selectedIndex = example.order[c.selected], selected = example.columns[selectedIndex];
        const visited = new Set(example.order.slice(0, c.completed));
        const messages = {
          pair: ['保留一维位置，给数值加入相位', '只是数值多了相位；候选仍为左移 2 格'],
          conjugate: ['选中这一列，只把零级取共轭', '星号对应青色箭头镜像：角度取反，长度不变'],
          multiply: ['用这一列的两个值，算出一个乘积', '角度相减、长度相乘；结果写回同一列'],
          sum: ['换到下一列，重复后加入累计', '高亮列 → 同列乘积 → 下方累计；位置始终可追踪'],
          magnitude: ['先累计复数，最后取合成箭头长度', '教学匹配量仍为 21；共同相位留在合成方向里'],
        };
        text(heading, messages[c.phase][0]); text(caption, messages[c.phase][1]);
        if (c.phase === 'sum' && c.completed === 3) {
          text(heading, '三列乘积已累计，接下来测量合成长度');
          text(caption, '复数和已得到；下一个动作才取长度');
        }
        set(selectedColumn, 'x', x0 + selectedIndex * dx - 39); set(g, 'data-teaching-selected', selected.f);
        const introduction = 1 - M.ramp(c.phaseReveal, 0, .2);
        cells.forEach(({ column, rows }, i) => {
          const conjugate = visited.has(i) || i === selectedIndex ? c.conjugate : 0;
          const z = polar(column.amplitude, column.zeroPhase * c.phaseReveal * (1 - 2 * conjugate));
          const v = polar(column.amplitude, column.sidePhase * c.phaseReveal);
          const committed = visited.has(i), active = i === selectedIndex;
          const productReveal = committed ? 1 : active ? c.productReveal : 0;
          [z, v, column.cross].forEach((value, row) => {
            const cell = rows[row], reveal = row === 2 ? productReveal : 1;
            vectorData(cell.arrow, cell.x, cell.y, value, row === 2 ? productScale : inputScale, reveal);
            opacity(cell.arrow, (1 - introduction) * (column.amplitude ? reveal : 0));
            opacity(cell.original, introduction);
            text(cell.value, column.amplitude ? (row === 2 ? num(column.amplitude ** 2, 0) + ' ∠30°' : column.amplitude + ' ∠' + degrees(Math.atan2(value.im, value.re)) + '°') : '0');
            opacity(cell.value, (1 - introduction) * reveal);
          });
        });
        opacity(initialResult, introduction); opacity(zoom, 1 - introduction);
        text(zoomTitle, '放大当前列：频率位置 ' + selected.f);
        const currentZero = polar(selected.amplitude, selected.zeroPhase * c.phaseReveal * (1 - 2 * c.conjugate));
        const currentSide = polar(selected.amplitude, selected.sidePhase * c.phaseReveal);
        vectorData(zPlane.arrow, zPlane.cx, zPlane.cy, currentZero, 9);
        vectorData(vPlane.arrow, vPlane.cx, vPlane.cy, currentSide, 9);
        vectorData(pPlane.arrow, pPlane.cx, pPlane.cy, selected.cross, 2.2, c.productReveal);
        vectorData(zGhost, zPlane.cx, zPlane.cy, polar(selected.amplitude, selected.zeroPhase * c.phaseReveal), 9);
        opacity(zGhost, c.conjugate * .45);
        text(zPlane.value, selected.amplitude + ' ∠' + degrees(Math.atan2(currentZero.im, currentZero.re)) + '°');
        text(vPlane.value, selected.amplitude + ' ∠' + degrees(Math.atan2(currentSide.im, currentSide.re)) + '°');
        text(pPlane.value, selected.amplitude ** 2 + ' ∠30°'); opacity(pPlane.group, c.multiply);
        text(angleText, c.phase === 'conjugate' ? '零级相位 ' + degrees(selected.zeroPhase) + '° → ' + degrees(-selected.zeroPhase) + '°'
          : c.multiply > 0 ? degrees(selected.sidePhase) + '° − (' + degrees(selected.zeroPhase) + '°) = 30°' : '先看相位，随后在原式加入星号');
        opacity(sumGroup, c.phase === 'sum' || c.phase === 'magnitude' ? 1 : 0);
        const prefix = example.sums[Math.min(c.completed, 2)];
        const partial = { re: prefix.re + selected.cross.re * c.commit, im: prefix.im + selected.cross.im * c.commit };
        sumArrows.forEach((arrow, j) => {
          const column = example.columns[example.order[j]], reveal = j < c.completed ? 1 : j === c.selected ? c.commit : 0;
          vectorData(arrow, 320, 504, column.cross, 5.4, reveal, example.sums[j]); opacity(arrow, reveal);
        });
        vectorData(totalArrow, 320, 504, partial, 5.4); opacity(totalArrow, c.measure);
        text(totalValue, '已累计 ' + Math.min(3, c.completed) + ' / 3 列：' + complex(partial, 1, 2));
        text(score, '合成长度 = ' + num(Math.hypot(partial.re, partial.im), 2)); opacity(score, c.measure);
        for (const [key, value] of Object.entries({ phase: c.phase, conjugate: c.conjugate, multiply: c.multiply,
          accumulation: c.accumulation, measure: c.measure, phaseReveal: c.phaseReveal, sumRe: partial.re, sumIm: partial.im })) set(g, 'data-complex-' + key, value);
      });
    }
    // 3. Actual OTF-corrected common regions for three representative candidates.
    {
      const g = stage(), max = Math.max(1, ...lesson.candidates.flatMap(c => c.points.map(p => Math.max(Math.hypot(p.x.re, p.x.im), Math.hypot(p.y.re, p.y.im)))));
      const urls = lesson.candidates.map(c => ['x', 'y'].map((key, i) => spectrumURL(null, i ? violet : cyan, max, c.points.map(p => ({ q: p.q, value: p[key] })))));
      const left = panel(g, 125, 111, 300, '零级 · OTF 已校正', urls[0][0], true), right = panel(g, 620, 111, 300, '旁带 · 候选对齐并校正 OTF', urls[0][1], true);
      const circles = [left, right].map((p, j) => {
        const clip = el('clipPath', { id: 'pe-overlap-clip-' + j }, g);
        el('rect', { x: p.x, y: p.y, width: p.size, height: p.size }, clip);
        const clipped = el('g', { 'clip-path': 'url(#pe-overlap-clip-' + j + ')' }, g);
        el('circle', { cx: p.cx, cy: p.cy, r: 10 * unit(p.size), class: 'pe-cutoff' }, clipped);
        return el('circle', { cx: p.cx, cy: p.cy, r: 10 * unit(p.size), class: 'pe-cutoff', stroke: violet }, clipped);
      });
      text(left.foot, '除去 H(q) · 样品频率坐标'); text(right.foot, '归位后除去 H(q + k′)');
      label(g, 1170, 125, '正在尝试', 'pe-svg-title');
      const k = label(g, 1170, 182, '', 'pe-svg-value');
      label(g, 1170, 236, '有效公共区', 'pe-svg-muted'); const count = label(g, 1170, 272, '', 'pe-svg-text pe-svg-number');
      label(g, 1170, 327, '复数匹配分数 ρ', 'pe-svg-muted'); const score = label(g, 1170, 365, '', 'pe-svg-value');
      const cue = label(g, 1170, 439, '', 'pe-svg-muted');
      let lastTravel = null, current = null;
      draws.push(s => {
        if (lastTravel !== s.candidateTravel) {
          current = M.candidateAt(lesson, s.candidateTravel);
          const nearest = Math.round(s.candidateTravel), fixed = Math.abs(s.candidateTravel - nearest) < 1e-10;
          const images = fixed ? urls[nearest] : ['x', 'y'].map((key, j) => spectrumURL(null, j ? violet : cyan, max, current.points.map(p => ({ q: p.q, value: p[key] }))));
          set(left.picture, 'href', images[0]); set(right.picture, 'href', images[1]); lastTravel = s.candidateTravel;
        }
        const c = current;
        [left, right].forEach((p, j) => { set(circles[j], 'cx', p.cx - c.kx * unit(p.size)); set(circles[j], 'cy', p.cy - c.ky * unit(p.size)); });
        text(k, 'k′ = (' + num(c.kx, 2) + ', ' + num(c.ky, 2) + ')'); text(count, c.count + ' 个频率点'); text(score, num(c.score, 4));
        text(cue, s.candidateTravel === 2 ? '结构对齐；仍需估计 m 与 φΔ' : '候选归位中 · 比较实际数据');
        set(g, 'data-kx', c.kx); set(g, 'data-ky', c.ky); set(g, 'data-score', c.score);
      });
    }
    function heatColor(t) { const a = [15, 34, 46], b = [239, 184, 121]; return 'rgb(' + a.map((v, i) => Math.round(v + (b[i] - v) * M.clamp(t))).join(',') + ')'; }
    // 4. Computed coarse score grid; scan order never changes the data.
    {
      const g = stage(), x = 140, y = 68, size = 390, width = 2 * e.extent + 1, cell = size / width;
      const cells = e.coarse.map((c, i) => el('rect', { x: x + (i % width) * cell, y: y + Math.floor(i / width) * cell, width: cell - 1, height: cell - 1, fill: c.valid ? heatColor(c.score) : '#172229' }, g));
      [-10, -5, 0, 5, 10].forEach(v => { label(g, x + (v + e.extent + .5) * cell, y + size + 22, String(v), 'pe-svg-tick'); label(g, x - 20, y + (v + e.extent + .5) * cell + 4, String(v), 'pe-svg-tick'); });
      label(g, x + size / 2, 40, '整数候选的相关分数', 'pe-svg-title'); label(g, x + size + 32, y + size + 22, 'k′x', 'pe-svg-tick'); label(g, x - 20, y - 12, 'k′y', 'pe-svg-tick');
      const marker = el('rect', { x: x + (e.coarseBest.kx + e.extent) * cell - 2, y: y + (e.coarseBest.ky + e.extent) * cell - 2, width: cell + 3, height: cell + 3, stroke: cyan, fill: 'none', 'stroke-width': 2 }, g);
      label(g, 820, 82, '最大分数所在的位置', 'pe-svg-title');
      const result = label(g, 820, 135, '', 'pe-svg-value'), status = label(g, 820, 187, '', 'pe-svg-muted');
      const vectorGroup = el('g', {}, g), cx = 1080, cy = 290, r = 126;
      el('circle', { cx, cy, r, class: 'pe-cutoff' }, vectorGroup); line(vectorGroup, cx - 148, cy, cx + 155, cy); line(vectorGroup, cx, cy - 148, cx, cy + 148);
      const a = el('path', { d: arrowPath(cx, cy, cx + e.coarseBest.kx * 12.6, cy + e.coarseBest.ky * 12.6), class: 'pe-arrow' }, vectorGroup);
      label(vectorGroup, cx, cy + 178, '波矢方向 · 数组 y 轴向下', 'pe-svg-muted');
      label(g, 780, 395, '0', 'pe-svg-tick'); label(g, 936, 395, '1', 'pe-svg-tick');
      for (let i = 0; i < 32; i++) el('rect', { x: 785 + i * 4.5, y: 365, width: 5, height: 12, fill: heatColor(i / 31) }, g);
      label(g, 854, 435, '亮度表示 ρ，固定 0—1', 'pe-svg-muted');
      draws.push(s => {
        const count = Math.floor(M.ramp(s.progress, .15, .76) * cells.length), done = M.ramp(s.progress, .79, .94);
        cells.forEach((c, i) => opacity(c, i < count ? 1 : .12)); opacity(marker, done); opacity(a, done);
        text(result, done > 0 ? '(' + e.coarseBest.kx + ', ' + e.coarseBest.ky + ')' : '搜索中');
        text(status, done > 0 ? 'ρ = ' + num(e.coarseBest.score, 6) + ' · 下一步细化' : count + ' / ' + cells.length + ' 个网格位置');
      });
    }
    // 5. Three local search grids, with their real score ranges and centers.
    {
      const g = stage(), rounds = e.rounds.map((round, j) => {
        const x = 160 + j * 420, y = 123, size = 190, cell = size / 5;
        label(g, x + size / 2, 73, '第 ' + (j + 1) + ' 轮', 'pe-svg-title'); label(g, x + size / 2, 101, '间隔 ' + round.step + ' 格', 'pe-svg-muted');
        const valid = round.candidates.filter(c => c.valid), low = Math.min(...valid.map(c => c.score)), high = Math.max(...valid.map(c => c.score));
        const cells = round.candidates.map((c, i) => el('rect', { x: x + (i % 5) * cell, y: y + Math.floor(i / 5) * cell, width: cell - 2, height: cell - 2, fill: c.valid ? heatColor((c.score - low) / Math.max(high - low, 1e-15)) : '#172229' }, g));
        const bx = (round.best.kx - round.center.kx) / round.step + 2, by = (round.best.ky - round.center.ky) / round.step + 2;
        const marker = el('rect', { x: x + bx * cell - 2, y: y + by * cell - 2, width: cell + 2, height: cell + 2, fill: 'none', stroke: cyan, 'stroke-width': 2 }, g);
        label(g, x + size / 2, 343, '(' + num(round.best.kx) + ', ' + num(round.best.ky) + ')', 'pe-svg-text pe-svg-number');
        label(g, x + size / 2, 371, 'ρ: ' + num(low, 5) + ' — ' + num(high, 5), 'pe-svg-muted');
        return { cells, marker };
      });
      label(g, 720, 415, '每幅小图按本轮分数范围着色 · 数字保留真实 ρ', 'pe-svg-muted');
      const results = el('g', {}, g);
      label(results, 260, 471, 'k̂ = (' + num(e.kx) + ', ' + num(e.ky) + ')', 'pe-svg-text', 'middle', cyan);
      label(results, 720, 471, '波矢角 ' + num(e.angle) + '°', 'pe-svg-text', 'middle', orange);
      label(results, 1160, 471, '条纹周期 ' + num(e.period) + ' px', 'pe-svg-text', 'middle', violet);
      draws.push(s => {
        const progress = M.ramp(s.progress, .12, .90) * 3;
        rounds.forEach((r, j) => { const t = M.clamp(progress - j); r.cells.forEach((c, i) => opacity(c, i < Math.floor(t * 25) ? 1 : .12)); opacity(r.marker, t === 1 ? 1 : 0); });
        opacity(results, M.ramp(s.progress, .90, 1)); set(g, 'data-round', s.round);
      });
    }
    // 6. Complex dot product and reference energy from all valid frequencies.
    {
      const g = stage(), points = e.fit.points, max = Math.max(...points.map(p => Math.max(Math.hypot(p.x.re, p.x.im), Math.hypot(p.y.re, p.y.im))));
      const p = panel(g, 120, 122, 285, '有效公共区 Ω', spectrumURL(null, cyan, max, points.map(p => ({ q: p.q, value: p.x }))), true);
      const dot = point(g, p.cx, p.cy), selected = label(g, p.cx, 466, '', 'pe-svg-text pe-svg-number');
      const xPlane = plane(g, 730, 240, 86, '零级 · OTF 已校正', cyan), yPlane = plane(g, 1110, 240, 86, '对齐旁带 · OTF 已校正', violet);
      const sum = label(g, 950, 429, '', 'pe-svg-text pe-svg-number'), energy = label(g, 950, 461, '', 'pe-svg-muted');
      const count = label(g, p.cx, 501, '', 'pe-svg-muted');
      draws.push(s => {
        const completed = Math.floor(s.accumulation * points.length), i = M.clamp(completed - 1, 0, points.length - 1), pair = points[i], total = lesson.sums[completed];
        set(dot, 'cx', p.cx + pair.q[0] * unit(p.size)); set(dot, 'cy', p.cy + pair.q[1] * unit(p.size));
        vector(xPlane, pair.x, 86 / max); vector(yPlane, pair.y, 86 / max);
        text(xPlane.value, complex(pair.x, n ** 2)); text(yPlane.value, complex(pair.y, n ** 2));
        text(selected, 'q = (' + pair.q.join(', ') + ')'); text(count, '已累计 ' + completed + ' / ' + points.length + ' 个频率点');
        text(sum, 'Σ 旁带 × 零级共轭 / N⁴ = ' + complex(total, n ** 4, 6)); text(energy, 'Σ |零级|² / N⁴ = ' + num(total.energy / n ** 4, 6) + (completed === points.length ? '  →  相除结果：' + complex(e.fit.alpha) : ''));
        set(g, 'data-count', completed);
      });
    }
    // 7. Read phase and modulation, then use the parameters for formal demixing.
    {
      const g = stage(), p = plane(g, 380, 268, 141, '上一幕的相除结果', orange);
      vector(p, e.fit.alpha, 141); text(p.value, complex(e.fit.alpha));
      label(g, p.cx + 152, p.cy + 18, '1', 'pe-svg-tick');
      const arc = el('path', { d: '', fill: 'none', stroke: violet, 'stroke-width': 3 }, g);
      const radius = el('path', { d: arrowPath(p.cx, p.cy, p.cx + e.fit.alpha.re * 141, p.cy - e.fit.alpha.im * 141), fill: 'none', stroke: cyan, 'stroke-width': 6, opacity: 0 }, g);
      const phase = label(g, 600, 187, '', 'pe-svg-text', 'middle', violet), modulation = label(g, 600, 232, '', 'pe-svg-text', 'middle', cyan);
      const preview = panel(g, 914, 76, 270, '用估计参数重画照明', '', false); preview.picture.remove();
      const foreign = el('foreignObject', { x: 914, y: 76, width: 270, height: 270 }, g), c = canvas(n, n); c.style.width = '100%'; c.style.height = '100%'; c.style.imageRendering = 'pixelated'; foreign.appendChild(c);
      const ctx = c.getContext('2d'), lightImage = ctx.createImageData(n, n);
      line(g, 875, 433, 1240, 433, grey, { opacity: .4, 'stroke-dasharray': '5 5' });
      const profile = el('path', { d: '', fill: 'none', stroke: orange, 'stroke-width': 2 }, g);
      label(g, 859, 438, '1', 'pe-svg-tick'); label(g, 1050, 503, 'y = 0 的照明剖面 · 平均强度为 1', 'pe-svg-muted');
      label(g, 720, 529, '将 k̂、φ̂ⱼ、m̂ 用于正式解混 · 当前方向 ' + (lesson.direction + 1), 'pe-svg-text', 'middle', orange);
      let last = '';
      draws.push(s => {
        const phi = e.phase * s.phaseRead, m = 1 + (e.m - 1) * s.modulationRead, angle = e.phase * s.phaseRead, r = 58;
        set(arc, 'd', Math.abs(angle) < 1e-9 ? '' : 'M ' + (p.cx + r) + ' ' + p.cy + ' A ' + r + ' ' + r + ' 0 ' + (Math.abs(angle) > Math.PI ? 1 : 0) + ' ' + (angle >= 0 ? 0 : 1) + ' ' + (p.cx + r * Math.cos(angle)) + ' ' + (p.cy - r * Math.sin(angle)));
        opacity(radius, s.modulationRead * .5); text(phase, s.phaseRead === 1 ? 'φ̂Δ = ' + num(e.phase) + ' rad' : '先读角度 φΔ');
        text(modulation, s.modulationRead === 1 ? 'm̂ = ' + num(e.m) : '再读长度 m');
        text(preview.foot, s.modulationRead === 0 ? '相位示意 · 暂定 m = 1' : '加入调制度 · 峰谷 ' + num(1 - m) + ' / ' + num(1 + m));
        const signature = phi.toFixed(6) + ':' + m.toFixed(6);
        if (last !== signature) {
          for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
            const i = y * n + x, intensity = 1 + m * Math.cos(2 * Math.PI * (e.kx * x + e.ky * y) / n + phi), b = Math.round(intensity / 2 * 240 + 8);
            lightImage.data.set([b, b, b, 255], i * 4);
          }
          ctx.putImageData(lightImage, 0, 0);
          let d = '';
          for (let i = 0; i <= 128; i++) { const x = 64 * i / 128, v = 1 + m * Math.cos(2 * Math.PI * e.kx * x / n + phi); d += (i ? ' L ' : 'M ') + (875 + i / 128 * 365) + ' ' + (433 - (v - 1) * 37); }
          set(profile, 'd', d); last = signature;
        }
        set(g, 'data-phase-preview', phi); set(g, 'data-modulation-preview', m);
      });
    }
    function render(s) {
      groups.forEach((g, i) => {
        // The one-dimensional grids have identical coordinates. Keep this
        // handoff direct so the previous labels do not ghost through the cells.
        const continuousRow = s.id === 'conjugate';
        const amount = i === s.step ? (continuousRow ? 1 : s.enter) : i === s.step - 1 && !continuousRow ? 1 - s.enter : 0;
        opacity(g, amount); set(g, 'aria-hidden', amount === 0);
        if (i === s.step || amount > 0) draws[i](i === s.step ? s : M.stateForScene(M.scenes[i].id, 1));
      });
      set(container, 'data-position', s.position); set(container, 'data-step', s.step); set(container, 'data-scene-id', s.id);
      return s;
    }
    let destroyed = false;
    return { draw(position) { return render(M.state(position)); },
      drawScene(id, progress) { return render(M.stateForScene(id, progress)); },
      destroy() { if (!destroyed) { ownedRoots.forEach(node => node.remove()); destroyed = true; } }, groups, sharedPair };
  }
  root.SIMParameterView = { create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
