/* 细化位移: scene narration and duration. */
(function(root){
  'use strict';
  const Clock = typeof module!=='undefined'&&module.exports ? require('../../../shared/animation/beat-clock.js') : root.SIMBeatClock;
  const lockTimeline=Clock.define([
    {key:'markWinner',duration:1020,cues:{mark:[0,1]}},
    {key:'holdWinner',duration:1500},
    {key:'transferWinner',duration:2280,cues:{transfer:[0,1]}},
    {key:'lockedOverview',duration:980}
  ]);
  const lockStart=1-lockTimeline.duration/68000;
  const lockState=p=>lockTimeline.at(Math.max(0,(p-lockStart)/(1-lockStart)));
  const formulas = {
    search: String.raw`$$\mathcal K=\{\mathbf k'\in\mathbb Z^2:r_{\min}\le\|\mathbf k'\|\le r_{\max}\},\qquad\widehat{\mathbf k}_{\rm coarse}=\operatorname*{arg\,max}_{\mathbf k'\in\mathcal K}\rho(\mathbf k')$$`,
    gridLimit: String.raw`$$\mathbf k'=\widehat{\mathbf k}_{\rm int}+\Delta\mathbf k',\qquad\Delta k'_x,\Delta k'_y\in[-0.5,+0.5]\ \text{DFT 格}$$`,
    subpixel: String.raw`$$\begin{aligned}a&=\mathcal F_N^{-1}\{\widetilde A_{+1}\},\\ B_{\mathbf k'}(\mathbf q)&=\mathcal F_N\!\left\{a[x,y]e^{-\frac{2\pi i}{N}(k'_x x+k'_y y)}\right\}(\mathbf q)=\widetilde A_{+1}(\mathbf q+\mathbf k'),\\ V_{\mathbf k'}(\mathbf q)&=\frac{B_{\mathbf k'}(\mathbf q)}{H(\mathbf q+\mathbf k')},\qquad\mathbf q\in\Omega_{\mathbf k',\tau}.\end{aligned}$$`,
    local: String.raw`$$k'_{r,a}=c_{r,a}+\frac{j-2}{2}s_r,\quad j=0,\ldots,4,\quad a\in\{x,y\},\qquad s_r\in\{0.50,0.10,0.02\}\ \text{格}$$`,
    lockedAddresses: String.raw`$$\mathbf f_0=\mathbf q,\qquad\mathbf f_1=\mathbf q+\widehat{\mathbf k}$$`
  };
  const scene={
    id: "refine",
    label: "细化位移",
    title: "整数峰只给出初值，波矢也可落在频率格之间。",
    copy: "接住上一幕的整数峰，放大其周围 ±0.5 个 DFT 格。用空域相位斜坡计算小数位移处的频谱，再做三轮 5×5 局部搜索，最终搜索步长为 0.01 格；锁定后回到同一对完整频谱。",
    equation: formulas.gridLimit,
    note: "本页采用三轮 5×5（步长 0.25 → 0.05 → 0.01 格）。搜索步长不是测量精度；位置锁定后，还需估计调制度与三帧共用的共同相位。",
    duration: 68000,
    chapter: "① 找位置 / 频率坐标",
    phase: "position"
  };
  // One tail clock owns the hold and transfer; changing its beats cannot
  // scatter independent duration fractions across the renderer.
  scene.lockTimeline=lockTimeline;scene.lockStart=lockStart;scene.lockState=lockState;
  scene.returnStart=lockStart+(1-lockStart)*lockTimeline.beats[2].start;
  const stages = [
      [.22, 'gridLimit', 'gridLimit', '放大整数峰附近的一格。背景来自本组观测的实际局部分数采样，标记来自局部拟合；本组峰可恰在整数点，不预设格间真值。这里的亚像素指小数 DFT 频率格，不是样品空间像素。'],
      [.56, 'phaseRamp', 'subpixel', '先逆 FFT，乘单位模的线性相位斜坡，再正 FFT；按离散傅里叶模型计算非整数频率值，不做频域像素插值。仅在两边 H 可靠的公共区各除自身 H，再算归一化相关分数。单位模乘法可逆且保持复场能量；它不会增加观测信息。'],
      [scene.returnStart, 'zoomCascade', 'local', scene.note],
      [1.01, 'returnSpectrum', 'lockedAddresses', '位置已经对齐，接下来求两路之间的幅度与相位差。'],
  ];
  scene.beats = stages.map(([end,key,formula,note],i)=>({key,action:key,start:i?stages[i-1][0]:0,end:Math.min(1,end),formula,note}));
  const zoom=scene.beats[2];zoom.end=lockStart;
  scene.beats.splice(3,0,...lockTimeline.beats.slice(0,2).map(b=>({key:b.key,action:b.key==='markWinner'?'突出实际胜出点':'锁定后静止停留',start:lockStart+(1-lockStart)*b.start,end:lockStart+(1-lockStart)*b.end,formula:'lockedAddresses',note:'已选中实际最高分候选，后续固定使用它；锁定不表示估计值等于真值。'})));
  // Holding the same result must not restart its caption/formula transition.
  scene.formulaCuts=scene.beats.filter(b=>b.key!=='holdWinner').map(b=>b.start);
  scene.present = (p, context) => {
    p=Math.round(p*1e12)/1e12;
    const b=scene.beats.find(b=>p<b.end)||scene.beats.at(-1);
    return {equation:context.formulas[b.formula],note:scene.id==='refine'&&b.key==='phaseRamp'?context.refinementPhaseState(p).note:b.note};
  };
  scene.formulaMode = p => {
    const key=(scene.beats.find(b=>Math.round(p*1e12)/1e12<b.end)||scene.beats.at(-1)).key;
    return scene.id+'-'+(['markWinner','holdWinner'].includes(key)?'lockWinner':key);
  };
  scene.formulas = formulas;
  if(typeof module!=='undefined'&&module.exports)module.exports=scene;
  else(root.SIMParameterUnits ||= {})[scene.id]=scene;
})(typeof globalThis!=='undefined'?globalThis:this);
