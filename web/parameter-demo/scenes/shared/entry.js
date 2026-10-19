/* Entry contract: the host's three temporary bands become the shared pair. */
(function(root){
  'use strict';
  function create({ Story, Study, notation }) {
  // Prepend the host-owned split without speeding up the existing public-area
  // lesson. Both views sample this same clock, including reverse playback.
  const sharedEntryDuration = 12000;
  const sharedDuration = sharedEntryDuration + Study.scene('shared').duration;
  const temporaryBands = Object.freeze([
    { order: 0, color: '#7ad5cd', symbol: String.raw`\widetilde A_0(\mathbf f)`, rhs: String.raw`H(\mathbf f)S(\mathbf f)`, x: 720, finalX: 900 },
    { order: 1, color: '#b7a5eb', symbol: String.raw`\widetilde A_{+1}(\mathbf f)`, rhs: String.raw`m e^{i\phi_\Delta}H(\mathbf f)S(\mathbf f-\mathbf k)`, x: 360, finalX: 480 },
    { order: -1, color: '#efb879', symbol: String.raw`\widetilde A_{-1}(\mathbf f)`, rhs: String.raw`m e^{-i\phi_\Delta}H(\mathbf f)S(\mathbf f+\mathbf k)`, x: 1080, finalX: 1080 },
  ].map(Object.freeze));
  function sharedEntryState(progress) {
    const elapsed = Story.clamp(progress) * sharedDuration, p = Story.clamp(elapsed / sharedEntryDuration), r = Story.ramp;
    const split = r(p, .30, .52), settle = r(p, .82, .96), reveal = r(p, .32, .40);
    const negative = 1 - .75 * r(p, .66, .74) - .25 * r(p, .74, .82);
    return { progress: p, lessonProgress: Story.clamp((elapsed - sharedEntryDuration) / Study.scene('shared').duration),
      handoff: r(p, 0, .06), temporary: 1, split, reveal,
      source: 1 - r(p, .30, .40), pictures: r(p, .50, .62), negative, settle, focus: Study.sharedFocusPose(settle),
      labels: 1 - r(p, .94, 1), context: r(p, .94, 1),
      bands: temporaryBands.map(b => ({ order: b.order, x: b.x + (b.finalX - b.x) * settle,
        titleX: 672.48 + (b.x - 672.48) * split + (b.finalX - b.x) * settle,
        titleY: 85 + 154 * split, alpha: reveal * (b.order === -1 ? negative : 1) })) };
  }
  function sharedEntryFormulaAt(progress) {
    const s = sharedEntryState(progress), p = s.progress;
    const title = p < .30 ? '把刚才的粗分离，应用到这组三帧。' : p < .66 ? '从一个向量，展开三个临时级次。'
      : '先保留 0 级与 +1 级，寻找共同信息。';
    const note = p < .30 ? notation.tilde + notation.matrix
      : p < .66 ? '三份临时频带都来自同一组三帧；旁带仍保留未知的 m 与共同相位偏移。'
      : '−1 级只退出当前比较画面；其数据保留，后面的正式重建仍使用三个级次。';
    return { title, copy: p < .66 ? '沿用同一批观测：青色 0 级、紫色 +1 级、橙色 −1 级，图像与下方公式一一对应。'
      : '−1 级淡出后，0 级与 +1 级一起移到中央并放大，接着寻找公共区。', note,
      equation: '$$' + temporaryBands.map(b => '{\\color{' + b.color + '}' + b.symbol + '=' + b.rhs + '}').join('\\qquad') + '$$' };
  }
    return { sharedEntryDuration, sharedDuration, sharedEntryState, sharedEntryFormulaAt, temporaryBands };
  }
  if(typeof module!=='undefined'&&module.exports)module.exports=create;else root.SIMSharedEntry=create;
})(typeof globalThis!=='undefined'?globalThis:this);
