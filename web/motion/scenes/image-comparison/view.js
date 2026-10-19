/* Shared view template owned by this scene family. No separate animation clock. */
(function(root) {
  'use strict';
  const M=root.SIMMotion,A=root.SIMAtlas;
  (root.SIMMotionViewFactories ||= {}).comparison = function(context) {
    const { lesson, create, attr, opacity, spatialURL, spectrumURL, imageURL, maximum, arrowPath, compact, $, r, mix, p, truth, gray, directionColors, viewRange, label, note, image, panel, frequencyOverlay, dot, intro, sumStage, detectionStage, coverage, fusion, comparison, sampleURL, wfURL, simURL, excitation, exposureImages, lightURL, emissionURL, sourceMax, spectrumTruthURL, spectrumWFURL } = context;
    // Final image and frequency validation; truth never enters reconstruction.
    const results = [sampleURL, wfURL, simURL].map((url, i) => panel(comparison, 360 + i * 360, 207, ['样品真值', '宽场参考', 'SIM 重建'][i], url, 210));
    const detail=create('g',{'data-comparison-structure':''},comparison),roi={x:82,y:72,w:24,h:18};
    const roiBoxes=results.map(result=>create('rect',{x:(roi.x/128-.5)*210,y:(roi.y/128-.5)*210,width:roi.w/128*210,height:roi.h/128*210,fill:'none',stroke:'#efb879','stroke-width':2,'data-structure-roi':''},result.group));
    [truth.sample,truth.widefield,p.pixels].forEach((pixels,j)=>{
      const url=imageURL((x,y,size)=>{const value=pixels[(roi.y+Math.min(roi.h-1,Math.floor(y*roi.h/size)))*128+roi.x+Math.min(roi.w-1,Math.floor(x*roi.w/size))],v=Math.round(M.clamp(value)*255);return [v*.87,v*.97,v];},96);
      create('image',{x:270+j*360,y:355,width:180,height:135,href:url,'data-structure-detail':j},detail);
      create('rect',{x:270+j*360,y:355,width:180,height:135,fill:'none',stroke:'#efb87966'},detail);
    });
    label(detail,720,527,'同一框选区域 · 固定强度标尺 · 先观察结构，再看剖面','svg-small');
    const profiles = create('g', {}, comparison);
    const transferNote = note(profiles,720,345,`直流最终传递 ${(100*lesson.audit.dcTransfer).toFixed(2)}% · 幅度抑制会进入全图 RMSE；高频非零不保证误差更小。`,'svg-small');
    attr(transferNote,'data-postlock-dc',lesson.audit.dcTransfer);
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
    attr(validation,'data-comparison-high-frequency','');
    label(validation, 250, 351, 'q = (14, 0)', 'svg-title', 'start');
    label(validation, 250, 392, `幅度保留 ${(lesson.audit.ratio * 100).toFixed(2)}%`, 'validation-big', 'start');
    label(validation, 250, 428, `${(100*lesson.audit.preApoTransfer).toFixed(2)}% × ${lesson.audit.window.toFixed(4)} = ${(100*lesson.audit.finalTransfer).toFixed(2)}%`, 'svg-small', 'start');
    label(validation, 250, 465, `Δφ = ${lesson.audit.phaseError.toFixed(4)}°`, 'svg-muted', 'start');
    [0, lesson.audit.preApoTransfer, lesson.audit.window, lesson.audit.ratio].forEach((ratio, i) => {
      const y = 350 + i * 44;
      label(validation, 775, y + 6, ['宽场保留', 'Wiener 保留', '切趾窗值 ×', '最终保留'][i], 'svg-small', 'end');
      create('rect', { x: 805, y: y - 9, width: 340, height: 17, rx: 2, fill: '#1d303a' }, validation);
      const bar=create('rect', { x: 805, y: y - 9, width: 340 * ratio, height: 17, rx: 2, fill: ['#7ad5cd','#b7a5eb','#a79876','#efb879'][i] }, validation);
      attr(bar,'data-transfer-step',['widefield','wiener','window','final'][i]);attr(bar,'data-transfer-value',ratio);
      label(validation, 1170, y + 6, i===2?ratio.toFixed(4):`${(ratio * 100).toFixed(2)}%`, 'svg-small', 'start');
    });
    note(validation, 720, 526, '完整复数与公式计算可在“原理与数值”中核对。', 'svg-muted');
    const errors=create('g',{'data-comparison-global-error':''},comparison);
    [lesson.audit.widefieldRMSE,lesson.audit.simRMSE].forEach((value,j)=>{
      const x=480+j*480;
      label(errors,x,365,j?'SIM 全图 RMSE':'宽场全图 RMSE','svg-title');
      label(errors,x,425,value.toFixed(4),'validation-big');
    });
    label(errors,720,485,'高频从零到非零 ≠ 全图误差更小','svg-small');
    label(errors,720,525,'同一强度标尺 · 未截断数据 · 真值只用于评价','svg-muted');

    function drawComparison(t) {
      const imageUnit=M.scenes.find(s=>s.id==='image-comparison'),auditUnit=M.scenes.find(s=>s.id==='frequency-audit');
      const imageProgress=M.clamp(t-20),auditProgress=M.clamp(t-21);
      const imageState=imageUnit.timeline.at(imageProgress),auditState=auditUnit.timeline.at(auditProgress);
      const profileStart=imageUnit.beats[1].start,errorStart=auditUnit.beats[1].start;
      const validating = r(t,21,21.2),errorAlpha=t>21?r(auditProgress,errorStart,errorStart+.1):0;
      const profileAlpha=r(imageProgress,profileStart,profileStart+.1)*(1-validating);
      const detailAlpha=(1-r(imageProgress,profileStart,profileStart+.1))*(1-validating);
      results.forEach((result, i) => attr(result.group, 'transform', `translate(${360 + i * 360} ${mix(207, 173, validating)}) scale(${mix(1, .8, validating)})`));
      results.forEach((result,i)=>result.caption.textContent=i===0?'仅用于评价':errorAlpha>0?`全图 RMSE ${(i===1?lesson.audit.widefieldRMSE:lesson.audit.simRMSE).toFixed(4)}`:'同一视野 · 固定强度标尺');
      opacity(detail,detailAlpha);roiBoxes.forEach(box=>opacity(box,detailAlpha));
      opacity(profiles,profileAlpha);opacity(validation,validating*(1-errorAlpha));opacity(errors,errorAlpha);
      attr(comparison,'data-comparison-mode',t>21?auditState.mode:imageState.mode);
    }
    return { draw: drawComparison };
  };
})(typeof globalThis!=='undefined'?globalThis:this);
