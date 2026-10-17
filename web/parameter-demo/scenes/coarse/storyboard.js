/* FFT 一次成图: scene narration and duration. */
(function(root){
  'use strict';
  const formulas = {
    fixed: String.raw`$$U_{\rm p}(\mathbf f)=M_0(\mathbf f)\frac{\widetilde A_0(\mathbf f)}{H(\mathbf f)},\qquad V_{\rm p}(\mathbf f)=M_1(\mathbf f)\frac{\widetilde A_{+1}(\mathbf f)}{H(\mathbf f)}$$`,
    inverse: String.raw`$$u(\mathbf r)=\mathcal F_N^{-1}\{U_{\rm p}\},\qquad v(\mathbf r)=\mathcal F_N^{-1}\{V_{\rm p}\}$$`,
    spatialProduct: String.raw`$$w(\mathbf r)=u^*(\mathbf r)v(\mathbf r)$$`,
    fftCorrelation: String.raw`$$C(\mathbf k')=N^2\mathcal F_N\{u^*v\}(\mathbf k')$$`,
    fftCost: String.raw`$$O(N^4)\ \longrightarrow\ O(N^2\log N)$$`
  };
  const scene={
    id: "coarse",
    label: "FFT 一次成图",
    title: "换到空域，只乘一次，算出整张图。",
    copy: "原有元素先变暗。两个未平移频带各自校正、圈外置零，分别逆 FFT；在同一空域位置逐点共轭相乘，扫出乘积图，再正 FFT、归一化，让结果归位到同一评分图。",
    equation: formulas.fftCorrelation,
    note: "图中 u、v 是固定预处理频谱的逆变换，仍为复数场。分数的能量与有效点数也用 FFT 批量计算，保持和逐格扫描相同的色标与结果。",
    duration: 44000,
    chapter: "① 找位置 / 频率坐标",
    phase: "position"
  };
  const stages = [
      [.12, 'hold', 'cost', '上一幕的图先整体变暗，保留计算背景；接下来展开两张固定预处理频谱。'],
      [.26, 'fixed', 'fixed', '先在各自检测坐标内固定预处理：可靠区除自身 H，圈外置零。下标 p 表示预处理；M 是掩膜，H=0 处直接置零，不执行除法。'],
      [.46, 'inverse', 'inverse', '同一对频谱变为空域复数场 u、v；不是重新拍摄，也不是最终样品图像。'],
      [.71, 'multiply', 'spatialProduct', '三个光标同步扫过同一空域坐标：把 u 取共轭后乘 v，逐点写出乘积图。一次遍历，不再对每个 k′ 重复平移。'],
      [.96, 'forward', 'fftCorrelation', '乘积图原位做正 FFT，得到所有 k′ 的乘积和；完成能量归一化后，整张结果图移回原评分坐标。N² 来自逆变换的归一化。'],
      [1.01, 'peak', 'fftCost', '常数次二维 FFT 把完整扫描降为 O(N² log N)。同一张分数图重新亮起，再框住整数峰，交给下一幕局部细化。'],
  ];
  scene.beats = stages.map(([end,key,formula,note],i)=>({key,action:key,start:i?stages[i-1][0]:0,end:Math.min(1,end),formula,note}));
  scene.present = (p, context) => {
    p=Math.round(p*1e12)/1e12;
    const b=scene.beats.find(b=>p<b.end)||scene.beats.at(-1);
    return {equation:context.formulas[b.formula],note:scene.id==='refine'&&b.key==='phaseRamp'?context.refinementPhaseState(p).note:b.note};
  };
  scene.formulaMode = p => scene.id+'-'+(scene.beats.find(b=>Math.round(p*1e12)/1e12<b.end)||scene.beats.at(-1)).key;
  scene.formulas = formulas;
  if(typeof module!=='undefined'&&module.exports)module.exports=scene;
  else(root.SIMParameterUnits ||= {})[scene.id]=scene;
})(typeof globalThis!=='undefined'?globalThis:this);
