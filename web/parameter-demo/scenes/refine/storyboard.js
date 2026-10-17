/* 细化位移: scene narration and duration. */
(function(root){
  'use strict';
  const formulas = {
    search: String.raw`$$\mathcal K=\{\mathbf k'\in\mathbb Z^2:r_{\min}\le\|\mathbf k'\|\le r_{\max}\},\qquad\widehat{\mathbf k}_{\rm coarse}=\operatorname*{arg\,max}_{\mathbf k'\in\mathcal K}\rho(\mathbf k')$$`,
    gridLimit: String.raw`$$\mathbf k'=\widehat{\mathbf k}_{\rm int}+\Delta\mathbf k',\qquad\Delta k'_x,\Delta k'_y\in[-0.5,+0.5]\ \text{DFT 格}$$`,
    subpixel: String.raw`$$\begin{aligned}a&=\mathcal F_N^{-1}\{\widetilde A_{+1}\},\\ B_{\mathbf k'}(\mathbf q)&=\mathcal F_N\!\left\{a[x,y]e^{-\frac{2\pi i}{N}(k'_x x+k'_y y)}\right\}(\mathbf q)=\widetilde A_{+1}(\mathbf q+\mathbf k'),\\ V_{\mathbf k'}(\mathbf q)&=\frac{B_{\mathbf k'}(\mathbf q)}{H(\mathbf q+\mathbf k')},\qquad\mathbf q\in\Omega_{\mathbf k',\tau}.\end{aligned}$$`,
    local: String.raw`$$k'_{r,a}=c_{r,a}+\frac{j-2}{2}s_r,\quad j=0,\ldots,4,\quad a\in\{x,y\},\qquad s_r\in\{0.50,0.10,0.02\}\ \text{格}$$`,
    lockedAddresses: String.raw`$$\mathbf k'=\widehat{\mathbf k},\qquad\widetilde A_0(\mathbf q)\ \longleftrightarrow\ \widetilde A_{+1}(\mathbf q+\widehat{\mathbf k})$$`
  };
  const scene={
    id: "refine",
    label: "细化位移",
    title: "整数峰只给出初值，波矢也可落在频率格之间。",
    copy: "接住上一幕的整数峰，放大其周围 ±0.5 个 DFT 格。用空域相位斜坡计算小数位移处的频谱，再做三轮 5×5 局部搜索，最终搜索步长为 0.01 格；锁定后回到同一对完整频谱。",
    equation: formulas.gridLimit,
    note: "教学实现采用三轮 5×5（步长 0.25 → 0.05 → 0.01 格）；原版 fairSIM fitPeak 采用三轮 10×10（半宽 2.5 → 0.5 → 0.1 格）。搜索步长不是测量精度。位置锁定后进入共同幅相估计。",
    duration: 68000,
    chapter: "① 找位置 / 频率坐标",
    phase: "position"
  };
  const stages = [
      [.22, 'gridLimit', 'gridLimit', '放大整数峰附近的一格。背景来自本组观测的实际局部分数采样，标记来自局部拟合；本组峰可恰在整数点，不预设格间真值。这里的亚像素指小数 DFT 频率格，不是样品空间像素。'],
      [.56, 'phaseRamp', 'subpixel', '先逆 FFT，乘单位模的线性相位斜坡，再正 FFT；按离散傅里叶模型计算非整数频率值，不做频域像素插值。仅在两边 H 可靠的公共区各除自身 H，再算归一化相关分数。单位模乘法可逆且保持复场能量；它不会增加观测信息。'],
      [.935, 'zoomCascade', 'local', scene.note],
      [1.01, 'returnSpectrum', 'lockedAddresses', '锁定的是位移参数和对应关系。下一幕收起搜索概览，从原始临时频带复制并按最终规则筛选；工作掩膜与搜索公共区可以不同，随后遍历全部 N² 个空域位置。'],
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
