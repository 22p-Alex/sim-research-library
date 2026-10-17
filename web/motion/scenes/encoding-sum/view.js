/* Shared view template owned by this scene family. No separate animation clock. */
(function(root) {
  'use strict';
  const M=root.SIMMotion,A=root.SIMAtlas;
  (root.SIMMotionViewFactories ||= {}).encodingSum = function(context) {
    const { sumIndexes, lesson, create, attr, opacity, spatialURL, spectrumURL, imageURL, maximum, arrowPath, compact, $, r, mix, p, truth, gray, directionColors, viewRange, label, image, panel, frequencyOverlay, dot, intro, sumStage, detectionStage, coverage, fusion, comparison, sampleURL, wfURL, simURL, excitation, exposureImages, lightURL, emissionURL, sourceMax, spectrumTruthURL, spectrumWFURL } = context;
    const sumPanels = [];
    for (const b of [1, 2, 0]) {
      const pane = panel(sumStage, 360 + b * 360, 250, ['0 级', '+1 级', '−1 级'][b], null);
      attr(pane.group, 'data-encoding-sum-order', M.orders[b]);
      const foreign = create('foreignObject', { x: -130, y: -130, width: 260, height: 260 }, pane.group);
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
      canvas.style.width = canvas.style.height = '100%'; canvas.style.display = 'block'; foreign.appendChild(canvas);
      const ctx = canvas.getContext('2d'), data = ctx.createImageData(128, 128);
      frequencyOverlay(pane.group);
      pane.caption.style.fill = M.colors[b];
      const probe = dot(pane.group, M.colors[b]);
      attr(probe, 'transform', `translate(${lesson.probe.bin.x * 260 / viewRange} ${lesson.probe.bin.y * 260 / viewRange})`);
      attr(probe, 'data-encoding-sum-probe', b);
      label(probe, 14, -14, 'f', 'probe-label', 'start').style.fill = M.colors[b];
      sumPanels[b] = { ...pane, canvas, ctx, data, probe };
    }
    const sumOperators = [label(sumStage, 540, 258, '+', 'operation-sign'), label(sumStage, 900, 258, '+', 'operation-sign')];
    const sumCaption = label(sumStage, 720, 485, '同一个 f：三个来源合成一个值，接下来需要把它们解开', 'svg-small');
    let lastSumSignature = '';
    function drawEncodingSum(time) {
      const state = M.encodingSumState(time), signature = `${state.factor}:${state.merge}`;
      if (signature !== lastSumSignature) {
        for (let b = 0; b < 3; b++) {
          const pane = sumPanels[b], source = lesson.encodingCopies[b];
          for (let i = 0; i < sumIndexes.length; i++) {
            const index = sumIndexes[i], z = b === 0 ? M.encodingSumPixel(lesson, state, index) : { re: source.re[index] * state.factor, im: source.im[index] * state.factor };
            const v = Math.log1p(Math.hypot(z.re, z.im)) / Math.log1p(sourceMax), k = i * 4;
            pane.data.data[k] = 9 + gray[0] * v; pane.data.data[k + 1] = 17 + gray[1] * v; pane.data.data[k + 2] = 23 + gray[2] * v; pane.data.data[k + 3] = 255;
          }
          pane.ctx.putImageData(pane.data, 0, 0);
        }
        lastSumSignature = signature;
      }
      sumPanels.forEach((pane, b) => {
        const pose = state.panels[b];
        attr(pane.group, 'transform', `translate(${pose.x} ${pose.y}) scale(${pose.scale})`); opacity(pane.group, pose.opacity);
        attr(pane.group, 'data-coefficient', b === 0 ? 1 : state.factor);
        pane.title.textContent = b === 0 ? state.merge > .98 ? '完整发射频谱 E₀(f)' : '0 级 → 中央求和区' : ['0 级', '+1 级', '−1 级'][b];
        pane.caption.textContent = b === 0 ? state.merge > .98 ? '来源已混合 · 检测前' : state.merge > 0 ? '逐点加入 +1、−1 级' : '× 1 · 0 级保持不变' : '× m/2 · 固定相位演示';
        opacity(pane.probe, state.probe);
        opacity(pane.caption, b === 0 ? 1 : M.ramp(time, 3.32, 3.44));
      });
      sumOperators.forEach(el => opacity(el, M.ramp(time, 3.54, 3.60) * (1 - state.merge)));
      opacity(sumCaption, M.ramp(time, 3.88, 4));
    }

    return { draw: drawEncodingSum };
  };
})(typeof globalThis!=='undefined'?globalThis:this);
