/* Scene unit: 频率编码. Narration, formula and duration are edited here. */
(function(root) {
  'use strict';
  const scene = {
    label: "频率编码",
    title: "一对高频，分别从两侧进入通带。",
    copy: "q 标记样品中的原始频率，k 是照明条纹的频率向量。第 ℓ 级整体移动 ℓk，移频后的位置记作 f。",
    equation: String.raw`$$E_j(\mathbf f)=S(\mathbf f)+\frac m2e^{i\phi_j}S(\mathbf f-\mathbf k)+\frac m2e^{-i\phi_j}S(\mathbf f+\mathbf k)$$`,
    note: "f 是发射频谱坐标，检测频谱沿用同一坐标；三个移频副本尚未加权，下一步再叠加。",
    stageIndex: 3,
    id: "frequency-encoding",
    theoryTopic: "encoding",
    encodingFormula: true,
    demixFormula: false,
    detectionFormula: false,
    acquisitionFormula: false,
    domainPair: null,
    formulaDomain: "频域 · 编码与叠加",
    chapterIndex: 1,
    chapter: "02 / 编码与检测",
    duration: 106400,
    // Theta is a notation change: 1.5 s to replace it, then 2.5 s to read.
    // Subsequent algebra retains its existing movement and reading durations.
    pacing: [[0,0],[0.02,1500],[0.025,3000],[0.04,5500],[0.045,6100],[0.06,14100],[0.065,14700],[0.08,22700],[0.085,24200],[0.1,32200],[0.105,33700],[0.12,41700],[0.125,43200],[0.14,51200],[0.21,53000],[0.235,58000],[0.265,59200],[0.28,64200],[0.3,65200],[0.325,66200],[0.345,70200],[0.37,71400],[0.385,76400],[0.415,77600],[0.44,82600],[0.46,86600],[0.5,88400],[1,106400]]
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = scene;
  else (root.SIMMotionUnits ||= {})[scene.id] = scene;
})(typeof globalThis !== 'undefined' ? globalThis : this);
