/* Shared view template owned by this scene family. No separate animation clock. */
(function(root) {
  'use strict';
  const M=root.SIMMotion,A=root.SIMAtlas;
  (root.SIMMotionViewFactories ||= {}).coverage = function(context) {
    const { lesson, create, attr, opacity, spatialURL, spectrumURL, imageURL, maximum, arrowPath, compact, $, r, mix, p, truth, gray, directionColors, viewRange, label, image, panel, frequencyOverlay, dot, intro, sumStage, detectionStage, coverage, fusion, comparison, sampleURL, wfURL, simURL, excitation, exposureImages, lightURL, emissionURL, sourceMax, spectrumTruthURL, spectrumWFURL } = context;
    // Nine acquired frames and the actual shifted OTF support for all directions.
    const nineFrames = [], rowLabels = [], lobes = [];
    // Phase headings belong to the columns, outside the scaled camera tiles.
    // Direction headings keep their own row above each compact camera strip.
    const phaseHeaders = M.phaseLabels.map((phase, j) => {
      const header = label(coverage, 360 + j * 360, 40, `φ′ = ${phase}`, 'coverage-phase-header');
      attr(header, 'font-size', 22);
      return header;
    });
    for (let d = 0; d < 3; d++) {
      const rowTitle = label(coverage, 120, 95 + d * 157, `方向 ${d + 1} / 估计 ${lesson.pipeline.groups[d].angle.toFixed(1)}°`, 'svg-small', 'start');
      rowTitle.style.fill = directionColors[d]; rowLabels.push(rowTitle);
      for (let j = 0; j < 3; j++) {
        const frame = panel(coverage, 360 + j * 360, 124 + d * 157, '', spatialURL(lesson.capture.raw.groups[d].frames[j].pixels), 110);
        frame.caption.textContent = `D${d + 1},${j + 1}`;
        nineFrames.push({ ...frame, d, j });
      }
    }
    const support = create('g', { transform: 'translate(855 260)' }, coverage);
    const supportUnit = frequencyOverlay(support, 390);
    const supportTitle = label(support, 0, -220, '归位后的 OTF 支撑', 'svg-title');
    for (let d = 0; d < 3; d++) for (const order of M.orders) {
      const group = create('g', { color: directionColors[d] }, support);
      create('circle', { r: 10 * supportUnit, fill: 'currentColor', 'fill-opacity': .025, stroke: 'currentColor', 'stroke-width': 1.5 }, group);
      lobes.push({ group, d, order });
    }
    const supportMarker = dot(support); attr(supportMarker, 'transform', `translate(${14 * supportUnit} 0)`);
    label(support, 14 * supportUnit, -19, 'q = 14', 'probe-label');
    label(support, 0, 219, '检测截止 10 格 · 最大扩展约 18 格', 'svg-muted');
    const fusionQuestion = create('g', { transform: 'translate(1240 260)' }, coverage);
    const overlapIndex = A.idx(6, 0, p.spectrumSize);
    label(fusionQuestion, 0, -92, '公共样品频率 q', 'svg-small');
    label(fusionQuestion, 0, -52, '方向 1 · 0 级 → 检测 q', 'svg-muted');
    label(fusionQuestion, 0, -24, `C₁,₀ ≈ ${p.bands[0].h[overlapIndex].toFixed(4)} S`, 'svg-small');
    label(fusionQuestion, 0, 20, '方向 1 · −1 级 → 检测 q − k', 'svg-muted');
    label(fusionQuestion, 0, 48, `C₁,₋₁ ≈ ${p.bands[2].h[overlapIndex].toFixed(4)} S`, 'svg-small');
    label(fusionQuestion, 0, 94, '同一个 S · 两个不同的 H', 'svg-muted');
    const overlapMarker = create('g', { color: directionColors[0] }, support);
    const overlapDot = dot(overlapMarker, directionColors[0]); attr(overlapDot, 'transform', `translate(${6 * supportUnit} 0)`);
    const overlapLabel = label(overlapMarker, 6 * supportUnit, 30, 'q', 'svg-muted'); overlapLabel.style.fill = directionColors[0];
    const coverageFoot = label(coverage, 720, 524, '', 'svg-muted');

    function drawCoverage(t, state) {
      phaseHeaders.forEach((header, j) => {
        attr(header, 'x', mix(360 + j * 360, 139 + j * 92, state.support));
        attr(header, 'font-size', mix(22, 15, state.support));
      });
      nineFrames.forEach(frame => {
        const x = mix(360 + frame.j * 360, 139 + frame.j * 92, state.support);
        const y = mix(124 + frame.d * 157, 132 + frame.d * 148, state.support);
        attr(frame.group, 'transform', `translate(${x} ${y}) scale(${mix(1, .65, state.support)})`);
        opacity(frame.group, frame.d === 0 ? 1 : mix(1, .38 + .62 * state.extraDirections, state.support));
      });
      rowLabels.forEach((el, d) => { attr(el, 'x', mix(120, 66, state.support)); attr(el, 'y', mix(95 + d * 157, 77 + d * 148, state.support)); });
      opacity(support, state.support); opacity(fusionQuestion, state.extraDirections);
      opacity(overlapMarker, state.extraDirections);
      opacity(supportTitle, r(t, 13.6, 14));
      lobes.forEach(lobe => {
        const progress = lobe.d === 0 ? state.support : r(t, 14 + (lobe.d - 1) * .32, 14.68 + (lobe.d - 1) * .32);
        const vector = [p.groups[lobe.d].kx, p.groups[lobe.d].ky];
        attr(lobe.group, 'transform', `translate(${-lobe.order * vector[0] * supportUnit * progress} ${-lobe.order * vector[1] * supportUnit * progress})`);
        opacity(lobe.group, progress * (lobe.order === 0 ? .4 : 1));
      });
      opacity(coverageFoot, r(t, 13.9, 14));
      coverageFoot.textContent = t < 13.9 ? '' : t < 14.5 ? '方向 1 的三幅频带归位到同一张坐标纸上。' : '颜色表示方向 · 三方向扩大覆盖 · q = (14, 0) 由方向 1 的 −1 级传递';
    }
    return { draw: drawCoverage };
  };
})(typeof globalThis!=='undefined'?globalThis:this);
