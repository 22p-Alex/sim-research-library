/* Scene-owned deterministic state and formula choreography. */
(function(root) {
  'use strict';
  function create({ orders, ramp }) {
  const inverseEquations = Object.freeze([
    String.raw`$$\mathbf D(\mathbf f)=M\mathbf A(\mathbf f)$$`,
    String.raw`$$M^{-1}\mathbf D(\mathbf f)=M^{-1}M\mathbf A(\mathbf f)$$`,
    String.raw`$$M^{-1}\mathbf D(\mathbf f)=I\mathbf A(\mathbf f)$$`,
    String.raw`$$M^{-1}\mathbf D(\mathbf f)=\mathbf A(\mathbf f)$$`,
    String.raw`$$\mathbf A(\mathbf f)=M^{-1}\mathbf D(\mathbf f)$$`,
    String.raw`$$\mathbf A(\mathbf f)=U\mathbf D(\mathbf f),\qquad U=M^{-1},\quad U_{\ell j}=u_{\ell,j}$$`,
    String.raw`$$\mathbf A(\mathbf f)=U\mathbf D(\mathbf f),\qquad U_{\ell j}=u_{\ell,j},\quad m\ne0$$`,
  ]);
  // For equally spaced phases, M = V diag(1,m/2,m/2) and V* V = 3I.
  // Hence U = diag(1,2/m,2/m) V*/3. This includes a common phase offset.
  const inverseWeightTex = (row, j) => row === 0 ? String.raw`\frac13`
    : '\\frac{2}{3m}e^{' + (orders[row] === 1 ? '-' : '+') + 'i\\phi_' + j + '}';
  function inverseState(time) {
    return { multiply: ramp(time, 8.22, 8.30), identity: ramp(time, 8.34, 8.40),
      removeIdentity: ramp(time, 8.42, 8.45), swap: ramp(time, 8.47, 8.53), weights: ramp(time, 8.55, 8.60),
      resolved: orders.map((_, row) => [0, 1, 2].map(j => {
        const start = 8.63 + (row * 3 + j) * .032;
        return ramp(time, start, start + .025);
      })),
      formula: time < 8.22 ? 0 : time < 8.34 ? 1 : time < 8.42 ? 2 : time < 8.47 ? 3 : time < 8.60 ? 4 : time < 8.63 ? 5 : 6 };
  }
  return { inverseEquations, inverseWeightTex, inverseState };
  }
  if(typeof module!=='undefined'&&module.exports)module.exports=create;
  else (root.SIMMotionStateFactories ||= {})['inverse-demix']=create;
})(typeof globalThis!=='undefined'?globalThis:this);
