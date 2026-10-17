/* Pure presentation state. Calculations are read from finalPeak, never rerun here. */
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const Story = node ? require('./storyboard.js') : root.SIMGetPeak;
  const cache = new WeakMap();
  function dataFor(lesson) {
    if (cache.has(lesson)) return cache.get(lesson);
    const peak = lesson.estimate.finalPeak;
    if (!peak || !peak.valid) throw new Error('共同幅相动画需要有效的 fairSIM finalPeak。');
    let sampleIndex = 0, maximum = -1;
    for (let i = 0; i < peak.count; i++) {
      const angle = -2 * Math.PI * (peak.kx * (i % peak.n) + peak.ky * Math.floor(i / peak.n)) / peak.n;
      const weight = peak.energy[i] * (.05 + Math.abs(Math.sin(angle / 2)));
      if (weight > maximum) { maximum = weight; sampleIndex = i; }
    }
    const data = { peak, sampleIndex }; cache.set(lesson, data); return data;
  }
  function presentation(progress, timeline = Story.timeline) {
    const t = timeline.at(progress), b = t.definition, c = t.cues;
    const handoff = !c.handoffEnd;
    const formula = handoff ? { equation: Story.entry.equation, parts: [], emphasis: [] }
      : { equation: '$$' + b.formula.parts.map(p => p.tex).join(b.formula.join) + '$$', parts: b.formula.parts,
        emphasis: b.formula.emphasis.filter(e => e.at <= t.local + 1e-10).at(-1).parts };
    return { mode: b.key, start: b.start, end: b.end, action: b.action, title: b.title, copy: b.copy, note: b.note, footer: b.footer,
      ...(handoff ? Story.entry : {}),
      beat: t.beat, beatCount: timeline.beats.length, local: t.local, progress: t.progress, panels: t.panels, cues: c,
      textAlpha: t.panels[t.beat], overview: 1 - c.overviewExit, body: c.body,
      handoff, formula: { ...formula, mode: handoff ? 'handoff' : b.key, opacity: handoff ? 1 - c.overviewExit : t.panels[t.beat] },
      domain: b.domain, layout: b.layout,
      cue: c.overviewExit < 1 ? Story.entry.title : 'fairSIM getPeak · 最终共同幅相估计',
      chromeAlpha: c.overviewExit < 1 ? 1 - c.overviewExit : t.panels[t.beat] };
  }
  function narrative(progress) { return presentation(progress); }
  function state(lesson, progress, timeline = Story.timeline) {
    const p = presentation(progress, timeline), { peak, sampleIndex } = dataFor(lesson), c = p.cues;
    const count = !c.sumFirst ? 0 : Math.min(peak.count, 1 + Math.floor((c.sumSweep + 1e-12) * (peak.count - 1)));
    const solved = c.divide === 1, read = c.readReady === 1;
    const sample = p.mode === 'finalSum' ? Math.max(0, count - 1) : sampleIndex;
    return { ...p, inverse: c.inverse, shift: c.shift, shiftOutput: c.shiftOutput, shiftScan: c.shiftScan,
      conjugate: c.conjugate, multiply: c.multiply, divide: c.divide, solved, read: Number(read),
      count, total: peak.count, sum: peak.sums[count], sample, r: [sample % peak.n, Math.floor(sample / peak.n)],
      alpha: solved ? { ...peak.alpha } : null, m: read ? peak.m : null, phase: read ? peak.phase : null,
      phaseRead: c.phaseRead, lengthRead: c.lengthRead, cards: c.cards, k: [peak.kx, peak.ky],
      resultAlpha: c.resultEnter, divisionAlpha: 1 - c.divideExit, readAlpha: c.readEnter,
      contributionTravel: c.sumScan ? (count % peak.n) / peak.n : c.contribution };
  }
  Object.assign(Story, { dataFor, presentation, narrative, state });
  if (node) module.exports = Story;
})(typeof globalThis !== 'undefined' ? globalThis : this);
