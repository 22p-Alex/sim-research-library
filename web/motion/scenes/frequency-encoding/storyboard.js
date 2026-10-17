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
    duration: 111900,
    pacing: [[0,0],[0.02,1500],[0.025,3000],[0.04,11000],[0.045,11600],[0.06,19600],[0.065,20200],[0.08,28200],[0.085,29700],[0.1,37700],[0.105,39200],[0.12,47200],[0.125,48700],[0.14,56700],[0.21,58500],[0.235,63500],[0.265,64700],[0.28,69700],[0.3,70700],[0.325,71700],[0.345,75700],[0.37,76900],[0.385,81900],[0.415,83100],[0.44,88100],[0.46,92100],[0.5,93900],[1,111900]]
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = scene;
  else (root.SIMMotionUnits ||= {})[scene.id] = scene;
})(typeof globalThis !== 'undefined' ? globalThis : this);
