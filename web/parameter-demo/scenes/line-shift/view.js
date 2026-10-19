/* Restored arithmetic bridge. The synthetic example is isolated from estimation.
 * Reuses the verified zero-extended real products in the model. */
(function (root) {
  'use strict';
  const L = root.SIMParameterLesson;
  const cyan = '#7ad5cd', violet = '#b7a5eb', orange = '#efb879', grey = '#8fa9b2';
  function createLineView(container, lesson) {
    const doc = container.ownerDocument || root.document, groups = [], draws = [], ownedRoots = [];
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
    const note=(...args)=>{const node=label(...args);set(node,'display','none');set(node,'data-scene-note','');return node;};
    const line = (parent, x1, y1, x2, y2, color = grey, extra = {}) => el('line', { x1, y1, x2, y2, stroke: color, 'stroke-width': 1, ...extra }, parent);
    const num = (value, digits = 3) => (Math.abs(value) < .5 * 10 ** -digits ? 0 : value).toFixed(digits);
    function stage() {
      const g = el('g', { opacity: 0, 'data-line-scene': 'line-shift' });
      groups.push(g); return g;
    }
    // 1. Every displayed product is computed from zero-extended sequences.
    {
      const g = stage(), example = lesson.teaching, x0 = 305, dx = 91, colors = [cyan, orange, violet];
      const heading = note(g, 720, 36, '从刚才的逐点比较，转入便于手算的一维例子', 'pe-svg-title');
      label(g, 720, 63, '教学例 1、4、2 · H=m=1', 'pe-svg-muted', 'middle', orange);
      ['0 级', '移动后的旁带', '逐点乘积'].forEach((v, i) => label(g, 128, [143, 259, 358][i], v, 'pe-svg-text'));
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
      label(g, 1150, 85, 'ρ(δ)', 'pe-svg-title');
      line(g, 974, 333, 1340, 333, grey); line(g, 974, 124, 974, 333, grey);
      const bars = example.real.map(({ delta, score }) => {
        const x = 1006 + delta * 65;
        const rect = el('rect', { x, y: 333, width: 38, height: 0, fill: grey }, g);
        const value = label(g, x + 19, 323 - score * 8, String(score), 'pe-svg-text');
        label(g, x + 19, 357, String(delta), 'pe-svg-text'); return { rect, value };
      });
      label(g, 1160, 390, 'δ', 'pe-svg-muted');
      const peak = el('g', {}, g);
      label(peak, 1160, 443, '分数 21', 'pe-svg-text', 'middle', cyan);
      label(peak, 1160, 479, 'δ = 2', 'pe-svg-title', 'middle', orange);
      draws.push(s => {
        const r = s.real, candidate = example.real[r.candidate], count = r.best === 1 ? 7 : r.products;
        text(heading, r.best === 1 ? '一维例子算完：带着逐点比较的方法回到原图' : '从刚才的逐点比较，转入便于手算的一维例子');
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
    return { draw(progress, alpha = 1) {
      draws[0](L.lineState(progress));
      groups.forEach(g => { opacity(g, alpha); set(g, 'aria-hidden', alpha === 0); });
    }, hide() { groups.forEach(g => { opacity(g, 0); set(g, 'aria-hidden', true); }); }, destroy() { ownedRoots.forEach(g => g.remove()); } };
  }
  L.createLineView = createLineView;
})(typeof globalThis !== 'undefined' ? globalThis : this);
