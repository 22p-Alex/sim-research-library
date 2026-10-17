/* Scene unit: 逆 FFT. Narration, formula and duration are edited here. */
(function(root) {
  'use strict';
  const scene = {
    label: "逆 FFT",
    title: "把复数频谱，变回图像。",
    copy: "对切趾后的完整复数频谱做逆 FFT，得到重建图像。此时才从频率坐标回到空间位置。",
    equation: String.raw`$$\widehat s=4\operatorname{Re}\!\left[\mathcal F_{256}^{-1}\{\widehat S\}\right]$$`,
    note: "输出 256 × 256，视野不变。固定因子 4 补偿零填充后的 FFT 归一化；更密采样本身不增加分辨率。",
    stageIndex: 20,
    id: "inverse-fft",
    theoryTopic: "rmse",
    encodingFormula: false,
    demixFormula: false,
    detectionFormula: false,
    acquisitionFormula: false,
    domainPair: {"leftLabel":"频域 · 最终复数频谱","left":"$$\\widehat S=P_{\\mathrm{apo}}\\widehat S_{\\mathrm W}$$","bridgeLabel":"逆 FFT · 叠加全部频率","bridge":"$$\\mathcal F^{-1}_{256}$$","rightLabel":"空域 · 重建图像","right":"$$\\widehat s=4\\operatorname{Re}\\!\\left[\\mathcal F^{-1}_{256}\\{\\widehat S\\}\\right]$$","guide":"解混、频带归位与融合都在频域完成；此处通过逆 FFT 回到空域。逆变换使用完整复数，固定因子 4 补偿零填充后的归一化。"},
    formulaDomain: "频域 → 空域",
    chapterIndex: 7,
    chapter: "08 / 图像与验证",
    duration: 1700
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = scene;
  else (root.SIMMotionUnits ||= {})[scene.id] = scene;
})(typeof globalThis !== 'undefined' ? globalThis : this);
