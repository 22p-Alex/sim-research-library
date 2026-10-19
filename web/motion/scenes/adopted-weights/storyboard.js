/* Three independently navigable handoffs: parameter cards -> one weight -> U.
 * Equal known phase steps: u_(+1,j) = alpha^-1 * (2/3) exp(-i phi'_j).
 * This is the inverse of the residual alpha in the temporary +1 band. */
(function(root){
  'use strict';
  const Teaching=typeof module!=='undefined'&&module.exports?require('./teaching.js'):root.SIMAdoptedTeaching;
  function create(Story) {
    const scenes=[{
      id:'adopted-weights',label:'先补偿临时旁带',duration:10000,
      title:'先除以共同复比例，补回旁带幅相。',
      copy:'临时旁带仍带有 α。现在用估计值的倒数补偿它：长度乘 1/m̂，相角减去 φ̂Δ；先看这一步改变了什么，再把同一补偿写进正式权重。',
      equation:String.raw`$$\widetilde A_{+1}=\alpha A_{+1},\qquad\widetilde A_{+1}/\widehat\alpha\approx A_{+1}$$`,
      note:'这里继续使用已知、准确的等间隔相对步进。波矢留待频带归位时使用；工作副本交出的幅相用于补全权重。',
      inputs:['estimated-parameter-cards'],outputs:['compensated-positive-band']
    },{
      id:'restore-weight',label:'补全一个权重',duration:14000,
      title:'同一补偿因子，进入三帧的正式权重。',
      copy:'三项临时权重都乘同一个 1/α̂，因此三帧求和后的旁带也得到相同补偿。先代入估计幅相计算因子，再得到一个实际权重。',
      equation:String.raw`$$\widehat\alpha=\widehat m e^{i\widehat\phi_\Delta},\qquad u_{+1,1}=\frac1{\widehat\alpha}\widetilde u_{+1,1}$$`,
      note:'临时 +1 频带带有 α=m exp(iφΔ)，因此正式权重乘 1/α̂。临时权重已补偿余弦的 1/2，调制度估计不再额外乘 2。',
      inputs:['compensated-positive-band'],outputs:['restored-positive-weight']
    },{
      id:'assemble-weights',label:'组成解混矩阵',duration:14000,
      title:'权重回到原单元格，再补齐解混矩阵。',
      copy:'先把 u₊₁,₁ 放回 U 的原位置，再算出其余权重。保留 +1 这一行，下一幕展开它与同一组三帧观测的乘加。',
      equation:String.raw`$$u_{0,j}=\frac13,\qquad u_{\pm1,j}=\frac{2}{3\widehat m}e^{\mp i(\phi'_j+\widehat\phi_\Delta)},\qquad U=M^{-1}$$`,
      note:'U 的行对应 0、+1、−1 级，列对应三帧。正式解混重新使用完整观测，输出仍含检测 OTF；估计用的筛选工作副本不进入正式融合。',
      inputs:['restored-positive-weight'],outputs:['positive-demixing-row']
    }].map(s=>({...s,duration:Teaching.durations[s.id]?Teaching.durations[s.id]*1000:s.duration,
      teachingBeats:Teaching.shots[s.id]?.map((b,i,all)=>({key:b[0],action:b[2],start:b[1]/Teaching.durations[s.id],end:(all[i+1]?.[1]??Teaching.durations[s.id])/Teaching.durations[s.id]})),
      unit:'web/motion/scenes/adopted-weights/storyboard.js'}));
    function adoptedState(progress,id='adopted-weights') {
      const p=Story.clamp(progress),r=Story.ramp,step=scenes.findIndex(s=>s.id===id);
      if(step<0)throw new Error('未知权重回填场景：'+id);
      return {progress:p,id,step,teaching:Teaching.state(id,p),
        cardMove:step ? 1 : r(p,.16,.44),
        cards:step<2 ? 1 : 1-r(p,.05,.25),
        pending:step===0 ? r(p,.46,.65) : step===1 ? 1-r(p,.08,.24) : 0,
        substituted:step===1 ? r(p,.30,.46)*(1-r(p,.68,.82)) : 0,
        solved:step===1 ? r(p,.84,.96) : Number(step===2),
        dock:step===2 ? r(p,.12,.36) : 0,
        matrix:step===2 ? r(p,.38,.50) : 0,
        rows:[0,1,2].map(j=>step===2 ? r(p,.51+j*.08,.59+j*.08) : 0),
        rowFocus:step===2 ? r(p,.84,.96) : 0};
    }
    return {scene:scenes[0],scenes,adoptedState};
  }
  if(typeof module!=='undefined'&&module.exports)module.exports=create;else root.SIMAdoptedStory=create;
})(typeof globalThis!=='undefined'?globalThis:this);
