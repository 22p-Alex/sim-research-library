/* Shared notation from Motion's three-source observation equation.
 * A_l includes the detector OTF; a tilde marks provisional phase separation,
 * a hat marks formal estimates using adopted illumination parameters.
 * Motion's ideal, noise-free algebra keeps A unchanged through inversion.
 * See fairSIM 2016 Supplementary Note 1 and the Motion source definitions. */
(function (root) {
  'use strict';
  // A stage marker, not a transform or an assertion that every marked quantity is unknown.
  const notation = Object.freeze({
    tilde: '波浪号统一标记“只用已知相对相移的临时分离”。',
    weight: 'ũ 是已知临时权重；实际逆矩阵权重 u 还包含未知的幅相校正。',
    matrix: 'Ũ 的元素是 ũ；同一组观测 D 经 Ũ 加权得到 Ã。',
    band: 'Ã 是临时输出：旁带保留未知幅相，零级满足 Ã₀=A₀。',
    estimate: '帽号表示由观测估计的参数；波浪号不表示估计值。',
    fourier: '本页以 Dⱼ(f)、S(f) 表示频谱，傅里叶变换写作 ℱ；波浪号不表示傅里叶变换。',
  });
  const formulas = Object.freeze({
    source: String.raw`$$A_\ell(\mathbf f)=H(\mathbf f)S(\mathbf f-\ell\mathbf k)$$`,
    sources: String.raw`$$\begin{aligned}A_0(\mathbf f)&=H(\mathbf f)S(\mathbf f)\\A_{+1}(\mathbf f)&=H(\mathbf f)S(\mathbf f-\mathbf k)\\A_{-1}(\mathbf f)&=H(\mathbf f)S(\mathbf f+\mathbf k)\end{aligned}$$`,
    observation: String.raw`$$D_j(\mathbf f)=A_0(\mathbf f)+\frac m2e^{i\phi_j}A_{+1}(\mathbf f)+\frac m2e^{-i\phi_j}A_{-1}(\mathbf f)$$`,
    negativeExtraction: String.raw`$$A_{-1}(\mathbf f)=\sum_{j=0}^{2}u_{-1,j}D_j(\mathbf f)$$`,
    negativeWeight: String.raw`$$u_{-1,j}\coloneqq\frac{e^{i\phi_j}}{3(m/2)},\qquad\widehat A_{-1}(\mathbf f)=\sum_{j=0}^{2}u_{-1,j}D_j(\mathbf f)$$`,
    phaseModel: String.raw`$$\phi_j=\phi'_j+\phi_\Delta,\qquad\phi'_j=\frac{2\pi j}{3},\quad j=0,1,2$$`,
    provisional: String.raw`$$\begin{aligned}\widetilde A_0(\mathbf f)&=A_0(\mathbf f)=H(\mathbf f)S(\mathbf f)\\\widetilde A_{+1}(\mathbf f)&=m e^{i\phi_\Delta}A_{+1}(\mathbf f)\end{aligned}$$`,
    handoff: String.raw`$$\widehat\phi_j=\phi'_j+\widehat\phi_\Delta,\qquad\widehat{\mathbf k},\ \widehat m\ \longrightarrow\ \text{解混权重 }u_{\ell,j}$$`,
  });
  const api = { formulas, notation, bandOrders: Object.freeze([0, 1, -1]) };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SIMBandFormulas = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
