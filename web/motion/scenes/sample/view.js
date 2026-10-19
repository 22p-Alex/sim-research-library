/* Shared view template owned by this scene family. No separate animation clock. */
(function(root) {
  'use strict';
  const M=root.SIMMotion,A=root.SIMAtlas;
  (root.SIMMotionViewFactories ||= {}).intro = function(context) {
    const { lesson, create, attr, opacity, spatialURL, spectrumURL, imageURL, maximum, arrowPath, compact, $, r, mix, p, truth, gray, directionColors, viewRange, label, note, image, panel, frequencyOverlay, dot, intro, sumStage, detectionStage, coverage, fusion, comparison, sampleURL, wfURL, simURL, excitation, exposureImages, lightURL, emissionURL, sourceMax, spectrumTruthURL, spectrumWFURL } = context;
    let displayedExcitationPhase = -1;
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
    const operatorName = note(intro, 720, 300, '二维傅里叶变换', 'svg-small');
    const operatorEnglish = note(intro, 720, 328, 'Fourier Transform · 2D FFT', 'svg-muted');
    const multiply = label(intro, 540, 258, '×', 'operation-sign'), equals = label(intro, 900, 258, '=', 'operation-sign');
    const introFoot = note(intro, 720, 491, '同一份样品 · 左为空域，右为频域', 'svg-muted');
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
      specimen.title.textContent = t >= .5 && t < 1.5 ? '宽场图像' : t >= 1.5 ? '荧光样品 s(r)' : '样品 s(r)';
      specimen.caption.textContent = t < .5 ? '128 × 128' : t < 1.5 ? '128 × 128 · 固定 0—1 标尺' : `P(100, 80)：s = ${excitation.sample.toFixed(3)}（固定）`;
      opacity(spectrum.group, early); opacity(wfSpectrum, r(t, 0, 1) * early);
      const q = 14;
      attr(spectrumPoint, 'transform', `translate(${q * spectrumUnit} 0)`); attr(spectrumPointText, 'x', q * spectrumUnit);
      spectrumPointText.textContent = 'q = (14, 0)';
      opacity(spectrumPoint, 1 - .6 * r(t, 0, 1) * early);
      spectrum.title.textContent = t > .5 ? '宽场频谱 H(q)S(q)' : '样品频谱 S(q)';
      spectrum.caption.textContent = t > .5 ? '圈外：H = 0' : 'q = (qₓ, qᵧ)';
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
    return { draw: drawIntro };
  };
})(typeof globalThis!=='undefined'?globalThis:this);
