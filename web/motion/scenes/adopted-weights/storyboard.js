/* Scene 20: parameter adoption and matrix assembly. */
(function(root){
  'use strict';
  function create(Story) {
    const scene={ id: 'adopted-weights', label: '填回参数', title: '参数填回去，正式解混权重就能算出来。',
      copy: '三个方向各自求出参数。将方向 1 的相位和调制度填入 M，得到正式解混用的 U；波矢留给后面的归位。',
      equation: String.raw`$$\begin{gathered}\widehat\phi_j=\phi'_j+\widehat\phi_\Delta,\qquad U=M^{-1}\\M_{j,:}=\begin{bmatrix}1&\frac{\widehat m}{2}e^{i\widehat\phi_j}&\frac{\widehat m}{2}e^{-i\widehat\phi_j}\end{bmatrix}\end{gathered}$$`,
      note: '矩阵与权重都由实际估计值计算；波矢另供频带归位。下文 m、φⱼ、k 指采用的估计值，频带继续记为 A。', duration: 28000 };
  function adoptedState(progress) {
    const p = Story.clamp(progress), r = Story.ramp;
    return { progress: p, directions: r(p, 0, .10), focus: r(p, .10, .12),
      rows: [0, 1, 2].map(j => r(p, .12 + .12 * j, .24 + .12 * j)),
      inverse: [0, 1, 2].map(j => r(p, .52 + .12 * j, .64 + .12 * j)),
      process: r(p, .48, .52), factor: r(p, .66, .78), application: r(p, .88, .96) };
  }

    return { scene, adoptedState };
  }
  if(typeof module!=='undefined'&&module.exports)module.exports=create;else root.SIMAdoptedStory=create;
})(typeof globalThis!=='undefined'?globalThis:this);
