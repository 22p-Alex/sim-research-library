/* 共轭与归一: scene narration and duration. */
(function(root){
  'use strict';
  const formulas = {
    otfSymbols: String.raw`$$H_0=H(\mathbf q),\quad H_1=H(\mathbf q+\mathbf k'),\quad\alpha=m e^{i\phi_\Delta};\qquad\text{本幕示意 }\mathbf k'=\mathbf k$$`,
    otfMultiply: String.raw`$$H^*(HS)=\underbrace{H^*H}_{|H|^2}S=|H|^2S$$`,
    otfNormalize: String.raw`$$\frac{H^*(HS)}{|H|^2}=\frac{|H|^2}{|H|^2}S=\frac{HS}{H}=S,\qquad H\ne0$$`,
    correct: String.raw`$$\begin{gathered}{\color{#7ad5cd}U(\mathbf q)=\frac{H^*(\mathbf q)\widetilde A_0(\mathbf q)}{|H(\mathbf q)|^2}=S(\mathbf q)}\\{\color{#b7a5eb}V_{\mathbf k'}(\mathbf q)=\frac{H^*(\mathbf q+\mathbf k')\widetilde A_{+1}(\mathbf q+\mathbf k')}{|H(\mathbf q+\mathbf k')|^2}=\alpha S(\mathbf q-\mathbf k+\mathbf k')}\end{gathered}$$`
  };
  const scene={
    id: "otf",
    label: "共轭与归一",
    title: "先乘自己的 H*，再除以 |H|²。",
    copy: "将可靠公共区内的 OTF 校正拆开看：先乘自身 H*，再除以 |H|²。这两步合成一次除以自身 H，校正后的值记为 U、V。",
    equation: formulas.correct,
    note: "在可靠公共区除以各自 H；动画将同一次除法展开为乘 H*、除 |H|²。只乘 H* 仍有 |H|²，两步完成后才得到校正值。",
    duration: 32000,
    chapter: "① 找位置 / 频率坐标",
    phase: "position"
  };
  scene.present = (p, context) => {
    const {M, formulas, lineState, otfState}=context, data=scene;
      const mode = otfState(p).formula;
      const notes = {
        region: '只在两边 |H| 都达到阈值的公共点上校正。H=0 不能相除；H 太小会放大噪声。本幕用 k′=k 示意，搜索时重新筛选。',
        otfSymbols: '省略频率自变量：上行用 H₀*=H*(q)，下行用 H₁*=H*(q+k′)。星号表示复共轭，两行都保留自己的 H。',
        otfMultiply: '一般恒等式 H*H=|H|²。只乘共轭后，原来的 OTF 相位被抵消，但幅度上还留有 |H|²；旁带的未知照明系数 α 保持不动。',
        otfNormalize: 'H*/|H|²=1/H（H≠0）。两步合成同一次 OTF 校正；H=0 或太弱的点先排除，不能用除法产生缺失信息。',
        correct: 'OTF 校正后的值命名为 U、Vₖ′。无噪声时 U=S；只有 k′=k 时，两边才对应同一样品频率。后续用这些校正值比较候选并拟合幅相。',
      };
      return { equation: formulas[mode], note: notes[mode] };
  };
  scene.formulaMode = (p,context) => 'otf-' + context.otfState(p).formula;
  scene.formulaCuts = [.40,.48,.70,.87];
  scene.formulas = formulas;
  if(typeof module!=='undefined'&&module.exports)module.exports=scene;
  else(root.SIMParameterUnits ||= {})[scene.id]=scene;
})(typeof globalThis!=='undefined'?globalThis:this);
