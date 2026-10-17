/* Shared comparison data; observation-derived values, independent of DOM. */
(function(root){
  'use strict';
  function create({M,E,A}) {
    const {clamp,ramp}=M;
  const cache = new WeakMap();
  function dataFor(lesson) {
    if (cache.has(lesson)) return cache.get(lesson);
    const e = lesson.estimate, candidates = new Map();
    function compare(kx, ky) {
      const key = kx + ',' + ky;
      if (!candidates.has(key)) candidates.set(key, E.compare(e.context, kx, ky, true));
      return candidates.get(key);
    }
    const best = compare(e.kx, e.ky), coarse = e.coarseBest;
    // Include the whole geometric overlap, including both kinds of rejected
    // sample: weak zero-order H and weak shifted sideband H.
    const support = { all: [], reliable: [], rejected: [] }, { cutoff, minH } = e.context.config;
    for (let y = -Math.ceil(cutoff); y <= cutoff; y++) for (let x = -Math.ceil(cutoff); x <= cutoff; x++) {
      const h0 = A.otf(x, y, cutoff), h1 = A.otf(x + e.kx, y + e.ky, cutoff);
      if (h0 <= 0 || h1 <= 0) continue;
      const point = { q: [x, y], h0, h1, reliable: h0 >= minH && h1 >= minH };
      support.all.push(point); support[point.reliable ? 'reliable' : 'rejected'].push(point);
    }
    support.rejected.sort((a, b) => Math.min(a.h0, a.h1) - Math.min(b.h0, b.h1));
    const alternatives = [[coarse.kx - 1, coarse.ky + 1], [coarse.kx, coarse.ky + 1], [coarse.kx - 1, coarse.ky], [coarse.kx + 1, coarse.ky]]
      .map(k => compare(...k)).filter(c => c.valid);
    const examples = [...alternatives.slice(0, 2), best];
    while (examples.length < 3) examples.unshift(best);
    let pool = best.points.filter(p => examples.every(c => c.points.some(t => t.q.join(',') === p.q.join(','))) && p.energy > 1e-12);
    if (pool.length < 3) pool = best.points.filter(p => p.energy > 1e-12);
    // Prefer strong, non-real coefficients and spread the selected frequencies.
    pool.sort((a, b) => Math.abs(b.x.im) - Math.abs(a.x.im) || b.energy - a.energy);
    const selected = [];
    for (const p of pool) if (selected.every(t => Math.hypot(p.q[0] - t.q[0], p.q[1] - t.q[1]) >= 2)) { selected.push(p); if (selected.length === 3) break; }
    for (const p of pool) if (selected.length < 3 && !selected.includes(p)) selected.push(p);
    const sums = [{ re: 0, im: 0, energy: 0 }];
    best.points.forEach(p => { const a = sums[sums.length - 1]; sums.push({ re: a.re + p.cross.re, im: a.im + p.cross.im, energy: a.energy + p.energy }); });
    const result = { compare, examples, selected, best, support, sums, valid: e.coarse.filter(c => c.valid), rounds: e.rounds };
    cache.set(lesson, result); return result;
  }
    return dataFor;
  }
  if(typeof module!=='undefined'&&module.exports)module.exports=create;else root.SIMComparisonData=create;
})(typeof globalThis!=='undefined'?globalThis:this);
