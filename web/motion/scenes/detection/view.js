/* Shared view template owned by this scene family. No separate animation clock. */
(function(root) {
  'use strict';
  const M=root.SIMMotion,A=root.SIMAtlas;
  (root.SIMMotionViewFactories ||= {}).detection = function(context) {
    const { sumIndexes, lesson, create, attr, opacity, spatialURL, spectrumURL, imageURL, maximum, arrowPath, compact, $, r, mix, p, truth, gray, directionColors, viewRange, label, note, image, panel, frequencyOverlay, dot, intro, sumStage, detectionStage, coverage, fusion, comparison, sampleURL, wfURL, simURL, excitation, exposureImages, lightURL, emissionURL, sourceMax, spectrumTruthURL, spectrumWFURL } = context;
    // A fixed before row and a duplicated after row. Both evolving images use
    // the same H_t and retain the reference row's brightness scale.
    const detectionSize = 184, spatialMaximum = lesson.detection.spatialMaximum;
    const detectionSpectrumURL = imageURL((x, y, n) => {
      const index = A.idx(Math.floor((x - n / 2) * viewRange / n), Math.floor((y - n / 2) * viewRange / n));
      const v = Math.log1p(Math.hypot(lesson.emissionSpectrum.re[index], lesson.emissionSpectrum.im[index])) / Math.log1p(sourceMax);
      return gray.map((channel, c) => [9, 17, 23][c] + channel * v);
    }, 128);
    const beforeSpatial = panel(detectionStage, 500, 147, '检测前 · 荧光发射 e₀ = sI₀', spatialURL(lesson.detection.emission, spatialMaximum), detectionSize);
    const beforeFrequency = panel(detectionStage, 720, 250, '检测前 · 完整发射频谱 E₀', detectionSpectrumURL);
    beforeSpatial.title.style.fontSize = '20px'; beforeFrequency.title.style.fontSize = '28px';
    for (const [pane, name, max] of [[beforeSpatial, 'before-spatial', spatialMaximum], [beforeFrequency, 'before-frequency', sourceMax]]) {
      attr(pane.group, 'data-detection-view', name); attr(pane.group, 'data-display-max', max);
    }
    const beforeAxes = create('g', {}, beforeFrequency.group);
    frequencyOverlay(beforeAxes, 260, false);
    const after = ['spatial', 'frequency'].map((domain, i) => {
      const pane = panel(detectionStage, i ? 940 : 500, 397, i ? '检测后 · 观测频谱 D₀' : '检测后 · 相机图像 d₀', null, detectionSize);
      attr(pane.group, 'data-detection-view', `after-${domain}`);
      attr(pane.group, 'data-display-max', i ? sourceMax : spatialMaximum);
      const foreign = create('foreignObject', { x: -92, y: -92, width: detectionSize, height: detectionSize }, pane.group);
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
      canvas.style.width = canvas.style.height = '100%'; canvas.style.display = 'block'; foreign.appendChild(canvas);
      const ctx = canvas.getContext('2d'), data = ctx.createImageData(128, 128);
      attr(pane.title, 'y', 116); pane.title.style.fontSize = '20px'; attr(pane.caption, 'y', 138); pane.caption.style.fontSize = '13px';
      attr(pane.caption,'display','none');attr(pane.caption,'data-scene-note','');
      pane.caption.textContent = i ? '上下共用 log(1 + 幅度) 标尺' : `上下共用 0—${spatialMaximum.toFixed(1)} 强度标尺`;
      return { ...pane, ctx, data };
    });
    const afterAxes = create('g', {}, after[1].group), unit = frequencyOverlay(afterAxes, detectionSize, false);
    const passband = create('circle', { r: 10 * unit, class: 'detection-passband', 'data-detection-passband': true }, afterAxes);
    const markers = [];
    for (const [parent, markerUnit] of [[beforeAxes, 260 / viewRange], [afterAxes, unit]]) {
      for (const f of [6, -6]) {
        const marker = dot(parent);
        attr(marker, 'transform', `translate(${f * markerUnit} 0)`); attr(marker, 'data-detection-frequency', f);
        if (f < 0) attr(marker.children[1], 'stroke-dasharray', '2 2');
        const text = label(parent, f * markerUnit, f > 0 ? -17 : 29, f > 0 ? 'f' : '−f', 'detection-marker-label');
        markers.push(marker, text);
      }
    }
    const process = create('g', {}, detectionStage);
    for (const [x, title] of [[500, '与 PSF 卷积'], [940, '乘检测 OTF']]) {
      create('path', { d: arrowPath(x, 251, x, 290, 6), class: 'detection-process' }, process);
      const text = label(process, x + 16, 276, title, 'svg-small', 'start'); text.style.fill = '#7ad5cd'; text.style.fontSize = '14px';
    }
    const pairs = [147, 397].map(y => {
      const group = create('g', {}, detectionStage);
      label(group, 720, y + 9, 'ℱ', 'operation-sign'); note(group, 720, y + 34, '傅里叶对应', 'svg-muted');
      return group;
    });
    const otfNote = create('g', {}, detectionStage);
    label(otfNote, 1090, 367, 'H(f) · 截止 10', 'svg-small', 'start').style.fill = '#7ad5cd';
    note(otfNote, 1090, 395, '乘 H(f) · 频率位置不变', 'svg-small', 'start');
    note(otfNote, 1090, 420, '圈内有衰减 · 圈外为零', 'svg-muted', 'start');
    let lastDetectionFilter = -1;
    function drawDetection(time) {
      const state = M.detectionState(time), pose = state.spectrumPose, acquisition = M.acquisitionState(time);
      attr(beforeFrequency.group, 'transform', `translate(${pose.x} ${pose.y}) scale(${pose.scale})`);
      opacity(beforeSpatial.group, state.reference * acquisition.clear); opacity(beforeAxes, state.reference);
      opacity(beforeFrequency.group, acquisition.clear);
      opacity(beforeFrequency.title, state.reference);
      after.forEach((pane, i) => {
        const carried = i === 0 && time >= 5, pose = acquisition.firstPose;
        attr(pane.group, 'transform', carried ? `translate(${pose.x} ${pose.y}) scale(${pose.size / detectionSize})` : `translate(${i ? 940 : 500} ${state.outputY})`);
        opacity(pane.group, state.duplicate * (i ? acquisition.clear : 1));
        opacity(pane.title, state.copy * acquisition.clear); opacity(pane.caption, state.copy * acquisition.clear);
        attr(pane.group, 'data-filter-progress', state.filter);
      });
      opacity(passband, state.passband); opacity(process, state.copy * acquisition.clear);
      opacity(pairs[0], state.reference * acquisition.clear); opacity(pairs[1], state.copy * acquisition.clear); opacity(otfNote, state.passband * acquisition.clear);
      markers.forEach(marker => opacity(marker, state.reference));
      if (state.filter !== lastDetectionFilter) {
        for (let i = 0; i < 128 ** 2; i++) {
          const spatial = M.detectionPixel(lesson, state, i), spectral = M.detectionPixel(lesson, state, sumIndexes[i]);
          const intensity = Math.round(M.clamp(spatial.spatial / spatialMaximum) * 255);
          const magnitude = Math.log1p(Math.hypot(spectral.re, spectral.im)) / Math.log1p(sourceMax), k = 4 * i;
          for (let c = 0; c < 3; c++) {
            after[0].data.data[k + c] = intensity * [.87, .97, 1][c];
            after[1].data.data[k + c] = [9, 17, 23][c] + gray[c] * magnitude;
          }
          after[0].data.data[k + 3] = after[1].data.data[k + 3] = 255;
        }
        after.forEach(pane => pane.ctx.putImageData(pane.data, 0, 0));
        lastDetectionFilter = state.filter;
      }
    }

    return { draw: drawDetection };
  };
})(typeof globalThis!=='undefined'?globalThis:this);
