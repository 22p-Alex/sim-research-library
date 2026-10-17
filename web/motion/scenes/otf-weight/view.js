/* Shared view template owned by this scene family. No separate animation clock. */
(function(root) {
  'use strict';
  const M=root.SIMMotion,A=root.SIMAtlas;
  (root.SIMMotionViewFactories ||= {}).fusion = function(context) {
    const { lesson, create, attr, opacity, spatialURL, spectrumURL, imageURL, maximum, arrowPath, compact, $, r, mix, p, truth, gray, directionColors, viewRange, label, image, panel, frequencyOverlay, dot, intro, sumStage, detectionStage, coverage, fusion, comparison, sampleURL, wfURL, simURL, excitation, exposureImages, lightURL, emissionURL, sourceMax, spectrumTruthURL, spectrumWFURL } = context;
    // Live computation panels use complex interpolation before taking magnitude.
    const allSpectra = [p.numerator, p.preApoSpectrum, p.spectrum, ...lesson.records.flatMap(rec => [rec.band.shifted, rec.band.matched, rec.after])];
    const fusionMaximum = maximum(allSpectra), logMaximum = Math.log1p(fusionMaximum);
    const panels = [];
    for (let i = 0; i < 3; i++) {
      const pane = panel(fusion, 360 + i * 360, 250, '', null);
      const foreign = create('foreignObject', { x: -130, y: -130, width: 260, height: 260 }, pane.group);
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
      canvas.style.width = canvas.style.height = '100%'; canvas.style.display = 'block'; foreign.appendChild(canvas);
      const ctx = canvas.getContext('2d'), data = ctx.createImageData(128, 128);
      const overlay = create('g', {}, pane.group), unit = frequencyOverlay(overlay);
      const marker = dot(overlay); attr(marker, 'transform', `translate(${14 * unit} 0)`);
      const text = label(overlay, 14 * unit, -17, 'q = 14', 'probe-label');
      const outputImage = i === 2 ? image(pane.group, simURL) : null;
      if (outputImage) opacity(outputImage, 0);
      panels.push({ ...pane, canvas, ctx, data, foreign, overlay, text, outputImage });
    }
    const fusionOperator1 = label(fusion, 540, 263, '×', 'operation-sign');
    const fusionOperator2 = label(fusion, 900, 263, '=', 'operation-sign');
    const fusionDetail = label(fusion, 720, 470, '', 'svg-small');
    const fusionFoot = label(fusion, 720, 510, '', 'svg-muted');
    const inverse = create('g', {}, fusion);
    label(inverse, 720, 245, 'ℱ⁻¹', 'large-operator'); label(inverse, 720, 290, '完整复数 → 实值图像', 'svg-small');
    const sumRail = [], rail = create('g', {}, fusion);
    for (let i = 0; i < 9; i++) {
      const group = create('g', { transform: `translate(${440 + i * 70} 421)` }, rail);
      create('circle', { r: 10, fill: 'none', stroke: directionColors[Math.floor(i / 3)], 'stroke-width': 1 }, group);
      label(group, 0, 4, ['0', '+', '−'][i % 3], 'axis-tick'); sumRail.push(group);
    }
    const spectrumIndexes = Uint32Array.from({ length: 128 * 128 }, (_, i) => A.idx(Math.floor((i % 128 - 64) * 48 / 128), Math.floor((Math.floor(i / 128) - 64) * 48 / 128), p.spectrumSize));
    let lastFusionSignature = '';
    const scalarRanges = new WeakMap();
    function paint(pane, view) {
      let scalarMaximum = 1;
      if (view.kind === 'scalar' && view.log) {
        if (!scalarRanges.has(view.values)) scalarRanges.set(view.values, view.values.reduce((max, value) => Math.max(max, value), 1));
        scalarMaximum = scalarRanges.get(view.values);
      }
      const scalarLogMax = Math.log1p(scalarMaximum);
      const color = view.kind === 'scalar' ? [175, 151, 107] : gray;
      for (let i = 0; i < spectrumIndexes.length; i++) {
        const z = M.pixel(view, spectrumIndexes[i]);
        const v = view.kind === 'complex' ? Math.log1p(Math.hypot(z.re, z.im)) / logMaximum : view.log ? Math.log1p(z.re) / scalarLogMax : z.re;
        const k = i * 4;
        pane.data.data[k] = 9 + color[0] * v; pane.data.data[k + 1] = 17 + color[1] * v; pane.data.data[k + 2] = 23 + color[2] * v; pane.data.data[k + 3] = 255;
      }
      pane.ctx.putImageData(pane.data, 0, 0);
    }

    function drawFusion(time) {
      const t = M.stageTime(time), frame = M.fusionFrame(lesson, time), inverseProgress = frame.inverseProgress;
      const signature = `${frame.phase}:${frame.index}:${Math.min(t, 20).toFixed(4)}`;
      if (signature !== lastFusionSignature) { panels.forEach((pane, i) => paint(pane, frame.views[i])); lastFusionSignature = signature; }
      const titles = frame.titles;
      panels.forEach((pane, i) => {
        pane.title.textContent = titles[i];
        opacity(pane.group, i === 1 ? 1 - inverseProgress : 1);
        opacity(pane.overlay, i === 2 ? 1 - inverseProgress : 1);
        if (pane.outputImage) opacity(pane.outputImage, inverseProgress);
        const z = M.pixel(frame.views[i], A.idx(14, 0, p.spectrumSize));
        pane.caption.textContent = i === 2 && inverseProgress > .5 ? '256 × 256 · 固定 0—1 标尺' : frame.views[i].kind === 'scalar' ? `q = 14：${compact(z.re)}` : `q = 14：|·| = ${compact(Math.hypot(z.re, z.im) / 128 ** 2)}`;
      });
      opacity(inverse, inverseProgress); opacity(fusionOperator1, 1 - inverseProgress); opacity(fusionOperator2, 1 - inverseProgress);
      fusionOperator1.textContent = frame.phase === 'sum' ? '→' : '×';
      fusionOperator2.textContent = frame.phase === 'sum' ? '→' : '=';
      opacity(rail, frame.phase === 'sum' ? 1 : 0);
      sumRail.forEach((el, i) => opacity(el, i <= frame.index ? 1 : .2));
      fusionDetail.textContent = frame.detail;
      fusionFoot.textContent = inverseProgress > .5 ? '从 128² 采集到 256² 输出：视野保持不变，固定乘 4 恢复强度标度。' : '频谱统一 log(1 + 幅度) 标尺 · 中间过渡用于讲解 · 终点对应真实计算';
    }
    return { draw: drawFusion };
  };
})(typeof globalThis!=='undefined'?globalThis:this);
