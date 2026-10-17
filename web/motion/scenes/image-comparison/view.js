/* Shared view template owned by this scene family. No separate animation clock. */
(function(root) {
  'use strict';
  const M=root.SIMMotion,A=root.SIMAtlas;
  (root.SIMMotionViewFactories ||= {}).comparison = function(context) {
    const { lesson, create, attr, opacity, spatialURL, spectrumURL, imageURL, maximum, arrowPath, compact, $, r, mix, p, truth, gray, directionColors, viewRange, label, image, panel, frequencyOverlay, dot, intro, sumStage, detectionStage, coverage, fusion, comparison, sampleURL, wfURL, simURL, excitation, exposureImages, lightURL, emissionURL, sourceMax, spectrumTruthURL, spectrumWFURL } = context;
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

    function drawComparison(t) {
      const validating = r(t, 21, 22);
      results.forEach((result, i) => attr(result.group, 'transform', `translate(${360 + i * 360} ${mix(207, 173, validating)}) scale(${mix(1, .8, validating)})`));
      opacity(profiles, 1 - validating); opacity(validation, validating);
    }
    return { draw: drawComparison };
  };
})(typeof globalThis!=='undefined'?globalThis:this);
