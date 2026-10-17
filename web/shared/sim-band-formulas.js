/* Shared notation from Motion's three-source observation equation.
 * A_l includes the detector OTF; a tilde marks provisional phase separation,
 * a hat marks formal estimates using adopted illumination parameters.
 * Motion's ideal, noise-free algebra keeps A unchanged through inversion.
 * See fairSIM 2016 Supplementary Note 1 and the Motion source definitions. */
(function (root) {
  'use strict';
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
  const api = { formulas, bandOrders: Object.freeze([0, 1, -1]) };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SIMBandFormulas = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
