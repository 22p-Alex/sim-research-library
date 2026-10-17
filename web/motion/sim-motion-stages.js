/* Full-story stages around the original demixing scene. Local SVG + Canvas;
 * no independent animation clocks. All draw methods sample one playhead. */
(function (root) {
  'use strict';
  const M = root.SIMMotion, A = root.SIMAtlas;
  function createStages(helpers) {
    const { lesson, create, attr, opacity, spatialURL, spectrumURL, imageURL, maximum, arrowPath, compact } = helpers;
    const $ = id => document.getElementById(id), r = M.ramp, mix = M.lerp;
    const p = lesson.pipeline, truth = lesson.capture.truth;
    const gray = [189, 219, 229], directionColors = ['#7ad5cd', '#b7a5eb', '#9ebddd'];
    const viewRange = 48;
    function label(parent, x, y, text, className = 'svg-small', anchor = 'middle') {
      return create('text', { x, y, class: className, 'text-anchor': anchor }, parent, text);
    }
    function image(parent, url, size = 260) { return create('image', { x: -size / 2, y: -size / 2, width: size, height: size, href: url }, parent); }
    function panel(parent, x, y, name, url, size = 260) {
      const group = create('g', { transform: `translate(${x} ${y})` }, parent);
      create('rect', { x: -size / 2 - 7, y: -size / 2 - 7, width: size + 14, height: size + 14, rx: 5, class: 'camera-border' }, group);
      const picture = url ? image(group, url, size) : null;
      const title = label(group, 0, -size / 2 - 29, name, 'svg-title');
      const caption = label(group, 0, size / 2 + 36, '', 'svg-small');
      return { group, picture, title, caption, size };
    }
    function frequencyOverlay(parent, size = 260, showCutoff = true) {
      const unit = size / viewRange;
      create('path', { d: `M ${-size / 2} 0 H ${size / 2} M 0 ${-size / 2} V ${size / 2}`, class: 'frequency-axis' }, parent);
      if (showCutoff) create('circle', { r: 10 * unit, class: 'ghost-cutoff' }, parent);
      for (const tick of [-20, -10, 0, 10, 20]) label(parent, tick * unit, 17, tick, 'axis-tick');
      return unit;
    }
    function dot(parent, color = '#efb879') {
      const group = create('g', { color }, parent);
      create('circle', { r: 11, fill: 'currentColor', opacity: .1 }, group);
      create('circle', { r: 5, fill: '#091115', stroke: 'currentColor', 'stroke-width': 1.5 }, group);
      create('path', { d: 'M -9 0 H 9 M 0 -9 V 9', stroke: 'currentColor', 'stroke-width': 1 }, group);
      return group;
    }
    const intro = $('intro-stage'), sumStage = $('encoding-sum-stage'), detectionStage = $('detection-stage'), coverage = $('coverage-stage'), fusion = $('fusion-stage'), comparison = $('comparison-stage');
    const sampleURL = spatialURL(truth.sample), wfURL = spatialURL(truth.widefield), simURL = spatialURL(p.outputPixels);
    const excitation = lesson.excitation;
    const exposureImages = excitation.frames.map(frame => ({ light: spatialURL(frame.illumination, 1.8), emission: spatialURL(frame.emission, 1.8) }));
    const lightURL = exposureImages[0].light, emissionURL = exposureImages[0].emission;
    let displayedExcitationPhase = -1;
    const sourceMax = maximum([truth.spectrum, lesson.emissionSpectrum]);
    const spectrumTruthURL = spectrumURL(truth.spectrum, sourceMax), spectrumWFURL = spectrumURL(A.spectrum(truth.widefield), sourceMax);

    // Samples / widefield / multiplication: the specimen stays on the left.
    const specimen = panel(intro, 360, 250, '样品 s(r)', sampleURL);
    const specimenWF = image(specimen.group, wfURL); opacity(specimenWF, 0);
    const spectrum = panel(intro, 1080, 250, '样品频谱 S(q)', spectrumTruthURL);
    const wfSpectrum = image(spectrum.group, spectrumWFURL); opacity(wfSpectrum, 0);
    const spectrumAxes = create('g', {}, spectrum.group), spectrumUnit = frequencyOverlay(spectrumAxes);
    const spectrumPoint = dot(spectrumAxes), spectrumPointText = label(spectrumAxes, 14 * spectrumUnit, -18, '(14, 0)', 'probe-label');
    const light = panel(intro, 720, 250, '条纹激发光 Iⱼ(r)', lightURL);
    light.caption.textContent = '亮纹激发强，暗纹激发弱';
    const emitted = panel(intro, 1080, 250, '荧光发射 eⱼ(r)', emissionURL);
    emitted.caption.textContent = '激发后，各位置发出的荧光';
    attr(light.picture, 'data-excitation-image', 'illumination'); attr(emitted.picture, 'data-excitation-image', 'emission');
    const excitationMarkers = [specimen, light, emitted].map((pane, i) => {
      const group = create('g', { 'data-excitation-probe': i, transform: `translate(${((excitation.point.x + .5) / A.N - .5) * pane.size} ${((excitation.point.y + .5) / A.N - .5) * pane.size})` }, pane.group);
      dot(group, '#7ad5cd');
      const text = label(group, 13, -12, 'P', 'probe-label', 'start'); text.style.fill = '#7ad5cd';
      attr(pane.caption, 'data-excitation-readout', ['sample', 'illumination', 'emission'][i]);
      return group;
    });
    const operator = label(intro, 720, 250, 'ℱ', 'large-operator');
    const operatorName = label(intro, 720, 300, '二维傅里叶变换', 'svg-small');
    const operatorEnglish = label(intro, 720, 328, 'Fourier Transform · 2D FFT', 'svg-muted');
    const multiply = label(intro, 540, 258, '×', 'operation-sign'), equals = label(intro, 900, 258, '=', 'operation-sign');
    const introFoot = label(intro, 720, 491, '同一份样品 · 左为空域，右为频域', 'svg-muted');
    const encoded = create('g', { 'data-encoding-domain': 'frequency' }, intro), copies = [];
    const encodedMax = sourceMax;
    for (let b = 0; b < 3; b++) {
      const order = M.orders[b], group = panel(encoded, 360 + b * 360, 250, ['0 级移频副本', '+1 级移频副本', '−1 级移频副本'][b], null);
      attr(group.group, 'data-encoding-order', order);
      group.group.style.color = M.colors[b];
      // The camera-sized viewport and detector coordinates stay fixed. Sample
      // 8 extra frequency bins on each side so panning never exposes an empty
      // edge; clip the full moving spectrum, not the already-cropped picture.
      const viewport = create('g', { 'clip-path': 'url(#encoding-window-clip)', 'data-encoding-part': 'viewport' }, group.group);
      const moving = create('g', { 'data-encoding-part': 'spectrum' }, viewport);
      const textureRange = viewRange + 2 * 8;
      const texture = image(moving, spectrumURL(truth.spectrum, encodedMax, gray, textureRange), group.size * textureRange / viewRange);
      attr(texture, 'class', 'spectrum-image');
      const fixed = create('g', { class: 'encoding-reference', 'data-encoding-part': 'reference' }, group.group), unit = frequencyOverlay(fixed);
      label(fixed, 0, -10 * unit - 12, '检测通带', 'encoding-passband-label');
      const tracks = [14, -14].map((q, i) => {
        const origin = create('circle', { cx: q * unit, cy: 0, r: 6, class: 'encoding-origin' }, fixed);
        const sourceLabel = label(fixed, q * unit, 64, `qₓ = ${q > 0 ? '+14' : '−14'}`, 'encoding-source-label');
        attr(sourceLabel, 'data-encoding-part', 'source-label'); attr(sourceLabel, 'data-source-frequency', q);
        const motion = create('path', { fill: 'none', stroke: M.colors[b], 'stroke-width': 1.4, 'stroke-dasharray': i ? '4 3' : 'none', 'data-encoding-part': 'trajectory', 'data-source-frequency': q }, fixed);
        const marker = dot(fixed, M.colors[b]);
        attr(marker, 'data-encoding-part', 'marker'); attr(marker, 'data-source-frequency', q);
        if (i) attr(marker.children[1], 'stroke-dasharray', '2 2');
        const arrival = create('circle', { r: 15, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.3, 'stroke-dasharray': i ? '4 3' : 'none' }, marker);
        const pointLabel = label(fixed, 0, -18, '', 'probe-label'); pointLabel.style.fill = M.colors[b];
        const caption = i ? label(group.group, 0, group.size / 2 + 62, '', 'svg-small') : group.caption;
        attr(caption, 'data-source-frequency', q);
        return { q, marker, pointLabel, sourceLabel, origin, motion, arrival, caption };
      });
      copies.push({ ...group, moving, tracks, unit, order, color: M.colors[b] });
    }
    const sumPanels = [], sumIndexes = Uint32Array.from({ length: 128 * 128 }, (_, i) => A.idx(Math.floor((i % 128 - 64) * viewRange / 128), Math.floor((Math.floor(i / 128) - 64) * viewRange / 128)));
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
      label(group, 720, y + 9, 'ℱ', 'operation-sign'); label(group, 720, y + 34, '傅里叶对应', 'svg-muted');
      return group;
    });
    const otfNote = create('g', {}, detectionStage);
    label(otfNote, 1090, 367, '检测通带 · 截止 10 格', 'svg-small', 'start').style.fill = '#7ad5cd';
    label(otfNote, 1090, 395, '乘 H(f) · 频率位置不变', 'svg-small', 'start');
    label(otfNote, 1090, 420, '圈内有衰减 · 圈外为零', 'svg-muted', 'start');
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

    // Final image and frequency validation; truth never enters reconstruction.
    const results = [sampleURL, wfURL, simURL].map((url, i) => panel(comparison, 360 + i * 360, 207, ['样品真值', '宽场参考', 'SIM 重建'][i], url, 210));
    results[0].caption.textContent = '仅用于评价'; results[1].caption.textContent = `全图 RMSE ${lesson.audit.widefieldRMSE.toFixed(4)}`; results[2].caption.textContent = `全图 RMSE ${lesson.audit.simRMSE.toFixed(4)}`;
    const profiles = create('g', {}, comparison);
    const profileData = [truth.sample, truth.widefield, p.pixels];
    const profileColors = ['#b6c5cc', '#7ad5cd', '#efb879'];
    const lineY = (80 / 128 - .5) * 210;
    results.forEach((result, i) => {
      create('path', { d: `M -105 ${lineY} H 105`, stroke: profileColors[i], 'stroke-width': 1.4, 'stroke-dasharray': '4 3' }, result.group);
    });
    let profileMin = 0, profileMax = 1;
    profileData.forEach(values => { for (let x = 0; x < 128; x++) { profileMin = Math.min(profileMin, values[80 * 128 + x]); profileMax = Math.max(profileMax, values[80 * 128 + x]); } });
    create('path', { d: 'M 215 370 V 490 H 1225', class: 'guide-line' }, profiles);
    for (const tick of [0, .5, 1]) {
      const y = 490 - (tick - profileMin) / (profileMax - profileMin) * 112;
      create('path', { d: `M 215 ${y} H 1225`, class: 'diagram-axis' }, profiles); label(profiles, 199, y + 4, tick, 'axis-tick', 'end');
    }
    profileData.forEach((values, i) => {
      const path = Array.from({ length: 128 }, (_, x) => `${x ? 'L' : 'M'} ${215 + x / 127 * 1010} ${490 - (values[80 * 128 + x] - profileMin) / (profileMax - profileMin) * 112}`).join(' ');
      create('path', { d: path, stroke: profileColors[i], 'stroke-width': i === 2 ? 2 : 1.4, fill: 'none' }, profiles);
      label(profiles, 510 + i * 210, 527, ['真值', '宽场', 'SIM'][i], 'svg-small').style.fill = profileColors[i];
    });
    label(profiles, 218, 525, '同一行 y = 80', 'svg-muted', 'start');
    const validation = create('g', {}, comparison);
    label(validation, 250, 351, 'q = (14, 0)', 'svg-title', 'start');
    label(validation, 250, 392, `幅度保留 ${(lesson.audit.ratio * 100).toFixed(2)}%`, 'validation-big', 'start');
    label(validation, 250, 428, `相位误差 ${lesson.audit.phaseError.toFixed(4)}°`, 'svg-small', 'start');
    label(validation, 250, 465, '非零输出，与真实高频相位一致。', 'svg-muted', 'start');
    [1, 0, lesson.audit.ratio].forEach((ratio, i) => {
      const y = 350 + i * 56;
      label(validation, 775, y + 6, ['真值', '宽场', 'SIM'][i], 'svg-small', 'end');
      create('rect', { x: 805, y: y - 9, width: 340, height: 17, rx: 2, fill: '#1d303a' }, validation);
      create('rect', { x: 805, y: y - 9, width: 340 * ratio, height: 17, rx: 2, fill: profileColors[i] }, validation);
      label(validation, 1170, y + 6, `${(ratio * 100).toFixed(1)}%`, 'svg-small', 'start');
    });
    label(validation, 720, 526, '完整复数与公式计算可在“原理与数值”中核对。', 'svg-muted');

    function drawIntro(t, phaseIndex, time) {
      const early = 1 - r(t, 1, 2), reveal = M.encodingDerivationState(t).spectra;
      const product = r(t, 1, 2) * (1 - reveal), encoding = reveal;
      const exposure = excitation.frames[phaseIndex];
      if (displayedExcitationPhase !== phaseIndex) {
        // Replace both saved exposure images immediately. No moving fringe,
        // crossfade or intermediate phase is introduced between exposures.
        attr(light.picture, 'href', exposureImages[phaseIndex].light); attr(emitted.picture, 'href', exposureImages[phaseIndex].emission);
        attr(light.picture, 'data-excitation-phase', phaseIndex); attr(emitted.picture, 'data-excitation-phase', phaseIndex);
        light.title.textContent = `条纹激发光 I${'₀₁₂'[phaseIndex]}(r)`;
        emitted.title.textContent = `荧光发射 e${'₀₁₂'[phaseIndex]}(r)`;
        light.caption.textContent = `P：激发光强 I = ${exposure.localIllumination.toFixed(3)}`;
        emitted.caption.textContent = `P：荧光强度 e = ${exposure.localEmission.toFixed(3)}`;
        displayedExcitationPhase = phaseIndex;
      }
      excitationMarkers.forEach(marker => opacity(marker, product));
      opacity(specimen.group, early + product);
      opacity(specimenWF, r(t, 0, 1) * (1 - r(t, 1, 2)));
      specimen.title.textContent = t >= .5 && t < 1.5 ? '宽场图像' : t >= 1.5 ? '荧光样品 s(r)' : '样品 Sample · s(r)';
      specimen.caption.textContent = t < .5 ? 'r = (x, y)：像素位置 · 128 × 128' : t < 1.5 ? '128 × 128 · 固定 0—1 标尺' : `P(100, 80)：s = ${excitation.sample.toFixed(3)}（固定）`;
      opacity(spectrum.group, early); opacity(wfSpectrum, r(t, 0, 1) * early);
      const q = 14;
      attr(spectrumPoint, 'transform', `translate(${q * spectrumUnit} 0)`); attr(spectrumPointText, 'x', q * spectrumUnit);
      spectrumPointText.textContent = 'q = (14, 0)';
      opacity(spectrumPoint, 1 - .6 * r(t, 0, 1) * early);
      spectrum.title.textContent = t > .5 ? '宽场频谱 H(q)S(q)' : '样品频谱 Spectrum · S(q)';
      spectrum.caption.textContent = t > .5 ? '圈外：H = 0' : 'q = (qₓ, qᵧ)：样品频率坐标';
      opacity(light.group, product); opacity(emitted.group, product); opacity(multiply, product); opacity(equals, product);
      opacity(operator, early);
      opacity(operatorName, early); opacity(operatorEnglish, early);
      opacity(encoded, time >= 4 ? 0 : encoding);
      const encodingFrame = M.encodingFrame(t), notation = M.encodingNotationState(time);
      copies.forEach((copy, b) => {
        const { progress, distance } = encodingFrame, { shift, points } = encodingFrame.panels[b];
        attr(copy.moving, 'transform', `translate(${shift * copy.unit} 0)`);
        copy.tracks.forEach((track, i) => {
          const { q, f, inside, emphasis } = points[i];
          const source = q > 0 ? 'q' : '−q';
          attr(track.marker, 'transform', `translate(${f * copy.unit} 0)`); attr(track.marker, 'data-in-passband', inside);
          attr(track.pointLabel, 'x', f * copy.unit); attr(track.pointLabel, 'text-anchor', f > 17 ? 'end' : f < -17 ? 'start' : 'middle');
          track.pointLabel.textContent = time < 2.5 ? (q > 0 ? 'qₓ' : 'qₓ · 共轭来源')
            : `fₓ：${source}${copy.order === 0 ? '' : copy.order === 1 ? ' + k' : ' − k'}`;
          opacity(track.sourceLabel, notation.sourceLabels);
          opacity(track.marker, mix(1, .55 + .45 * emphasis, progress)); opacity(track.pointLabel, mix(1, .65 + .35 * emphasis, progress));
          opacity(track.arrival, emphasis); opacity(track.origin, copy.order === 0 ? 0 : Math.max(progress * .5, notation.sourceFocus));
          attr(track.origin, 'stroke-width', 1 + 1.5 * notation.sourceFocus); attr(track.arrival, 'stroke-width', 1.3 + notation.destinationFocus);
          attr(track.motion, 'd', arrowPath(q * copy.unit, 36, f * copy.unit, 36, 5));
          opacity(track.motion, copy.order === 0 ? 0 : progress);
          attr(track.motion, 'stroke-width', 1.4 + 1.2 * notation.shiftFocus);
          track.caption.style.fill = inside ? copy.color : '#9fb1b5';
          track.caption.textContent = copy.order === 0 ? `${source} · 0 级保持原位 · 通带外`
            : `${source} 沿 ${copy.order === -1 ? '−k' : '+k'} 搬移 · ${inside ? '通带内' : '通带外'}`;
        });
      });
      introFoot.textContent = t < 1.5 ? '同一份样品 · 左为空域，右为频域' : '';
    }
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
    function drawFusion(time) {
      const t = M.stageTime(time), frame = M.fusionFrame(lesson, time), inverseProgress = r(t, 19, 20);
      const signature = `${frame.phase}:${frame.index}:${Math.min(t, 20).toFixed(4)}`;
      if (signature !== lastFusionSignature) { panels.forEach((pane, i) => paint(pane, frame.views[i])); lastFusionSignature = signature; }
      const titles = frame.phase === 'match' ? ['归位频带 C₁,₋₁', '共轭 OTF H*₁,₋₁', '加权贡献 H*C']
        : frame.phase === 'sum' ? ['当前归位频带 C', '乘 OTF 后 H*C', '累计频谱 U']
        : frame.phase === 'wiener' ? ['累计频谱 U', '归一化系数 1/(R + w²)', '滤波频谱 ŜW']
        : frame.phase === 'apodization' ? ['滤波频谱 ŜW', '切趾窗 Papo', '最终频谱 Ŝ']
        : ['最终复数频谱 Ŝ', '', 'SIM 重建图像'];
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
      fusionDetail.textContent = frame.phase === 'sum' ? `第 ${frame.index + 1} / 9 项 · 方向 ${Math.floor(frame.index / 3) + 1} · ${['0', '+1', '−1'][frame.index % 3]} 级 · ${frame.local < .5 ? '乘共轭 OTF' : '加入累计结果'}`
        : frame.phase === 'match' ? '原频带已有 H；本次再乘 H*，留下 |H|²S。' : frame.phase === 'inverse' ? '逆变换使用完整复数数组，显示图的对数亮度不参与运算。' : frame.phase === 'wiener' ? '用累计模平方构造分母；w² 限制弱传递处的反演增益。' : '每个频率乘以切趾窗的对应值。';
      fusionFoot.textContent = inverseProgress > .5 ? '从 128² 采集到 256² 输出：视野保持不变，固定乘 4 恢复强度标度。' : '频谱统一 log(1 + 幅度) 标尺 · 中间过渡用于讲解 · 终点对应真实计算';
    }
    function drawComparison(t) {
      const validating = r(t, 21, 22);
      results.forEach((result, i) => attr(result.group, 'transform', `translate(${360 + i * 360} ${mix(207, 173, validating)}) scale(${mix(1, .8, validating)})`));
      opacity(profiles, 1 - validating); opacity(validation, validating);
    }
    function draw(time, excitationPhase = 0) {
      const state = M.story(time);
      opacity(intro, state.intro); opacity(sumStage, state.encodingSum); opacity(detectionStage, state.detection); opacity(coverage, state.coverage); opacity(fusion, state.fusion); opacity(comparison, state.comparison);
      if (state.intro > 0) drawIntro(state.stageTime, excitationPhase, time);
      if (state.encodingSum > 0) drawEncodingSum(time);
      if (state.detection > 0) drawDetection(time);
      if (state.coverage > 0) drawCoverage(state.stageTime, state);
      if (state.fusion > 0) drawFusion(time);
      if (state.comparison > 0) drawComparison(state.stageTime);
    }
    return { draw };
  }
  root.SIMMotionStages = { create: createStages };
})(typeof globalThis !== 'undefined' ? globalThis : this);
