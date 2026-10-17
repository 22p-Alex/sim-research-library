/* Scene 20: parameter adoption and matrix assembly. */
(function(root){
  'use strict';
  function create(Story) {
    const scene={ id: 'adopted-weights', label: '填回参数', title: '参数填回去，正式解混权重就能算出来。',
      copy: '工作副本只提供参数；现在回到同一批完整观测正式解混。三个方向分别估计，将方向 1 的相位和调制度填入 M 得到 U，波矢供后面归位。',
      equation: String.raw`$$\begin{gathered}\widehat\phi_j=\phi'_j+\widehat\phi_\Delta,\qquad U=M^{-1}\\M_{j,:}=\begin{bmatrix}1&\frac{\widehat m}{2}e^{i\widehat\phi_j}&\frac{\widehat m}{2}e^{-i\widehat\phi_j}\end{bmatrix}\end{gathered}$$`,
      note: '估计时筛选、除 H 的工作副本不进入正式融合；完整三帧重新分离，输出仍带 H。矩阵与权重来自实际估计值；波矢另供归位。下文 m、φⱼ、k 指采用的估计值，频带继续记为 A。', duration: 28000 };
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
