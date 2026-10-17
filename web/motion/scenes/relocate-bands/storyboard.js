/* Scene unit: 搬回原处. Narration, formula and duration are edited here. */
(function(root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const Clock = node ? require('../../../shared/animation/beat-clock.js') : root.SIMBeatClock;
  const timeline = Clock.define([
    { key:'embedGrid', duration:4500, action:'先扩展计算网格',
      title:'先把 128² 频谱嵌入 256² 零数组。',
      copy:'按原来的有符号频率地址放入更大的数组，新增位置为零。DFT 格间隔和视野不变；网格准备好以后才移动频带。',
      equation:String.raw`$$A_\ell^{128}\xrightarrow{\text{按频率地址嵌入}}A_\ell^{256},\qquad\Delta q\ \text{不变}$$`,
      note:'扩展网格给归位后的高频腾出地址，不会凭零填充产生新信息。示意框的大小表示数组范围，不改变谱图显示窗口。', cues:{embed:[.1,.75]} },
    { key:'relocate', duration:6500, action:'再按估计波矢归位',
      title:'带着 OTF，一起回到样品频率坐标。',
      copy:'+1 级沿 −k̂、−1 级沿 +k̂ 移动；每个频带、OTF 轮廓和选中分量同步归位。实际计算使用已经扩展的 256² 数组。',
      equation:String.raw`$$\mathbf q=\mathbf f-\ell\widehat{\mathbf k},\qquad C_\ell(\mathbf q)=A_\ell^{256}(\mathbf q+\ell\widehat{\mathbf k})$$`,
      note:'位置变了，同一分量的复数值不变，OTF 衰减仍在。新高频来自照明搬入检测通带的观测。最终逆 FFT 的因子 4 来自输出与采集网格点数之比。', cues:{relocate:[.08,.88]} }
  ]);
  const scene = {
    chapter: "05 / 频带归位",
    label: "搬回原处",
    title: "带着 OTF，一起回到原处。",
    copy: "+1 级向左 8 格，−1 级向右 8 格。每个频带、OTF 轮廓和选中分量同步移动。",
    equation: String.raw`$$\mathbf q=\mathbf f-\ell\mathbf k,\qquad C_\ell(\mathbf q)=A_\ell(\mathbf q+\ell\mathbf k)$$`,
    note: "虚线是原检测支撑，彩色轮廓是归位后的 OTF 支撑。坐标改变，同一分量的复数值不变。",
    stageIndex: 11,
    id: "relocate-bands",
    theoryTopic: null,
    encodingFormula: false,
    demixFormula: false,
    detectionFormula: false,
    acquisitionFormula: false,
    domainPair: null,
    formulaDomain: "频域 · 归位",
    chapterIndex: 4,
    duration: timeline.duration, timeline, beats: timeline.beats,
    movement(progress) { return timeline.at(progress).cues.relocate; },
    present(progress, clock = timeline) {
      const state = clock.at(progress);
      return {...state.definition,mode:state.mode,beat:state.beat,beatCount:clock.beats.length,cues:state.cues};
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = scene;
  else (root.SIMMotionUnits ||= {})[scene.id] = scene;
})(typeof globalThis !== 'undefined' ? globalThis : this);
