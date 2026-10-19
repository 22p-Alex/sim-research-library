/* The teaching path: correspondence -> one ratio -> all pairs -> parameters.
 * fairSIM implementation details live in the expandable theory, not this clock. */
(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const Clock=node?require('../../../shared/animation/beat-clock.js'):root.SIMBeatClock;
  const OTF=node?require('../otf/storyboard.js'):root.SIMParameterUnits.otf;
  const correspondenceFormulas={
    recall:OTF.formulas.correct,
    locked:OTF.formulas.correct.replaceAll(String.raw`\mathbf k'`,String.raw`\widehat{\mathbf k}`),
    aligned:OTF.formulas.correct.replaceAll(String.raw`\mathbf k'`,String.raw`\widehat{\mathbf k}`).replace(String.raw`S(\mathbf q-\mathbf k+\widehat{\mathbf k})`,String.raw`S(\mathbf q)`),
    quotients:String.raw`$$\begin{aligned}U(\mathbf q)&=\frac{\widetilde A_0(\mathbf q)}{H(\mathbf q)}=S(\mathbf q)\\V(\mathbf q)&=\frac{\widetilde A_{+1}(\mathbf q+\widehat{\mathbf k})}{H(\mathbf q+\widehat{\mathbf k})}=\alpha S(\mathbf q)\end{aligned}$$`,
    definitions:String.raw`$$\begin{aligned}U(\mathbf{q})&=\frac{\widetilde{A}_0(\mathbf{q})}{H(\mathbf{q})}=S(\mathbf{q})\\V(\mathbf{q})&=\frac{\widetilde{A}_{+1}(\mathbf{q}+\widehat{\mathbf{k}})}{H(\mathbf{q}+\widehat{\mathbf{k}})}=m e^{i\phi_\Delta}S(\mathbf{q})\end{aligned}$$`,
    alpha:String.raw`$$U(\mathbf{q})=S(\mathbf{q}),\quad V(\mathbf{q})=\alpha S(\mathbf{q}),\quad\alpha\coloneqq m e^{i\phi_\Delta}$$`,
    substitute:String.raw`$$V(\mathbf{q})=\alpha U(\mathbf{q}),\qquad\alpha\coloneqq m e^{i\phi_\Delta}$$`,
    result:String.raw`$$V(\mathbf{q})=\left(m e^{i\phi_\Delta}\right)U(\mathbf{q})$$`
  };
  const definitions=[
    {key:'correspondence',id:'least-squares-fit',label:'对应内容',duration:16000,
      title:'同一份样品信息，只差一个共同系数。',
      copy:'两份频谱的位置已经对齐。回看先乘自身 H*、再除以 |H|² 得到的 U 与 V，继续比较共同幅相。',
      note:'回看前面的无噪声校正式；k′ 仍表示候选，只有正确对齐时两路才对应同一份 S(q)。',
      equation:correspondenceFormulas.recall,
      steps:[{at:0,key:'recall',title:'接回前面已经得到的两行校正式。'},
        {at:.27,key:'locked',title:'把已锁定的 k̂，代回两行校正式。',equation:correspondenceFormulas.locked,
          copy:'将候选 k′ 固定为估计值 k̂；旁带样品项仍保留 q−k+k̂，估计值不自动等于真实波矢。',
          note:'接下来在正确对齐的无噪声模型下，令 k̂=k，才把样品项化为 S(q)。'},
        {at:.35,key:'aligned',title:'正确对齐时，先消去样品坐标中的残差。',equation:correspondenceFormulas.aligned,
          copy:'在无噪声且 k̂=k 的理想模型下，q−k+k̂=q；原来两行校正式中的样品项因此变成同一个 S(q)。',
          note:'这是正确对齐的条件，不是把估计值当成真实值；动画只化简样品项中的 −k+k̂。'},
        {at:.40,key:'divideH',title:'将原来的两行校正，化成各除以自己的 H。',equation:correspondenceFormulas.quotients,
          copy:'H*/|H|²=H*/(H*H)=1/H。沿原来的分式消去共轭因子；锁定位移后，将 Vₖ̂(q) 简记为 V(q)。',
          note:'只在两边 H 都非零的可靠公共区化简；分式变短，但 U 与 V 的定义和数值不变。'},
        {at:.46,key:'correct',title:'同一个 S(q)，旁带只多一个幅相因子。',equation:correspondenceFormulas.definitions,
          copy:'两组公式是同一个关系。这里只将 α 展开为 m e^{iφΔ}，其余项保留；右侧对应关系同步更新。'},
        {at:.59,key:'alpha',title:'用 α 表示共同的幅度与相位因子。',equation:correspondenceFormulas.alpha},
        {at:.69,key:'substitute',title:'将 U 代入同一份样品内容，得到 V = αU。',equation:correspondenceFormulas.substitute},
        {at:.82,key:'common',title:'展开 α，留下幅度与相位的共同作用。',equation:correspondenceFormulas.result}]},
    {key:'singleRatio',id:'coefficient-point',label:'单点比例',duration:20000,
      title:'代数上看：直接相除就能算出来。',
      copy:'承接 V=(m exp(iφΔ))U，将同一条公式移到中央；选取 U(q₁)≠0 的频点，再逐步移项。',
      note:'先用正确对齐的无噪声模型解释等式；实际估计随后使用全部工作频点。',
      equation:'',steps:[{at:0,key:'center',title:'把上一幕的对应关系移到中央。'},
        {at:.08/.48,key:'coordinate',title:'补入同一个频点 q₁。'},
        {at:.115/.48,key:'divide',title:'将 U(q₁) 移到分母，得到共同复比例。'},
        {at:.18/.48,key:'conjugate',title:'分子、分母同时乘 U*(q₁)。'},
        {at:.25/.48,key:'cancelPhase',title:'共轭乘积消去样品自身的相位。'},
        {at:.405/.48,key:'restore',title:'恢复为可从观测直接计算的 U*V。'}]},
    {key:'pooledRatio',id:'coefficient-sum',label:'多点估计',duration:22000,
      title:'公共区 Ω 内所有点，共同估计一个幅相因子。',
      copy:'单个频点易受噪声干扰。将所有可靠点的 U*V 和 |U|² 分别求和，再用总能量归一化。',
      note:'这是固定参考 U 的复数最小二乘解；总参考能量 E_U>0。含噪时不会让每个频点都精确满足同一比例。',
      equation:'',steps:[{at:0,key:'reliable',title:'从单个频点，扩展到可靠公共区 Ω。'},
        {at:(.50-.48)/.27,key:'sum',title:'在同一分式中加入两路求和与估计帽号。'},
        {at:(.59-.48)/.27,key:'accumulate',title:'共轭乘积同向累加，参考总能量归一化。'},
        {at:(.70-.48)/.27,key:'divide',title:'完成复数最小二乘，得到共同幅相估计。'}]},
    {key:'readParameters',id:'coefficient-read',label:'读取幅相',duration:12000,
      title:'复数比值的模长与相角，分别给出调制度和共同相位。',
      copy:'保留上方总式，向下分出两张结果卡片：取模得到 m̂，取相角得到 φ̂Δ，再加上已知的三步相移。',
      note:'本例采用三步等间隔相移 φ′ⱼ=2πj/3；临时旁带权重已补偿余弦的 1/2，模长直接给调制度。',
      equation:'',steps:[{at:0,key:'split',title:'保留总式，分叉读出模长与相角。'},
        {at:.20,key:'magnitude',title:'取模长，得到调制度 m̂。'},
        {at:.44,key:'phase',title:'取相角，得到共同相位偏移 φ̂Δ。'},
        {at:.76,key:'cards',title:'由共同偏移恢复各帧相位，交给正式解混。'}]}
  ];
  const coefficient=String.raw`\left({\color{#efb879}m}e^{i{\color{#b7a5eb}\phi_\Delta}}\right)`;
  const estimate=String.raw`{\color{#efb879}\widehat m}e^{i{\color{#b7a5eb}\widehat\phi_\Delta}}`;
  const derivationFormulas={
    relation:correspondenceFormulas.result,
    coordinate:`$$V(\\mathbf q_1)=${coefficient}U(\\mathbf q_1)$$`,
    divide:`$$\\frac{V(\\mathbf q_1)}{U(\\mathbf q_1)}=${coefficient}$$`,
    multiply:`$$\\frac{U^*(\\mathbf q_1)V(\\mathbf q_1)}{U^*(\\mathbf q_1)U(\\mathbf q_1)}=${coefficient}$$`,
    conjugate:`$$\\frac{U^*(\\mathbf q_1)V(\\mathbf q_1)}{|U(\\mathbf q_1)|^2}=${coefficient}$$`,
    expand:`$$\\frac{U^*(\\mathbf q_1)${coefficient}U(\\mathbf q_1)}{|U(\\mathbf q_1)|^2}=${coefficient}$$`,
    cancel:`$$\\frac{${coefficient}|U(\\mathbf q_1)|^2}{|U(\\mathbf q_1)|^2}=${coefficient}$$`,
    pooled:`$$\\frac{\\sum_{\\mathbf q\\in\\Omega}U^*(\\mathbf q)V(\\mathbf q)}{\\sum_{\\mathbf q\\in\\Omega}|U(\\mathbf q)|^2}=${estimate}$$`,
    magnitude:String.raw`$$\widehat m=\frac{\left|\sum_{\mathbf q\in\Omega}U^*(\mathbf q)V(\mathbf q)\right|}{\sum_{\mathbf q\in\Omega}|U(\mathbf q)|^2}$$`,
    phase:String.raw`$$\widehat\phi_\Delta=\arg\!\left(\sum_{\mathbf q\in\Omega}U^*(\mathbf q)V(\mathbf q)\right),\qquad\widehat\phi_j=\frac{2\pi j}{3}+\widehat\phi_\Delta$$`
  };
  function subProgress(mode,local){return mode==='singleRatio'?.48*local:mode==='pooledRatio'?.48+.27*local:mode==='readParameters'?.75+.25*local:0;}
  function derivationKey(t){return t<.08?'relation':t<.115?'coordinate':t<.18?'divide':t<.22?'multiply':t<.27?'conjugate':t<.33?'expand':t<.405?'cancel':t<.50?'conjugate':'pooled';}
  const timeline=Clock.define(definitions);
  const stops=Clock.freeze(timeline.beats.map((b,i)=>({...b,
    sceneId:'coefficient',coefficientBeat:b.key,phase:'coefficient',
    unit:'web/parameter-demo/scenes/get-peak/mainline-story.js',
    inputs:i?[definitions[i-1].id]:['locked-spectrum','otf-corrected-pair'],outputs:[definitions[i+1]?.id||'estimated-parameter-cards'],
    beats:[{key:b.key,action:b.title,start:0,end:1}]})));
  function stopProgress(stop,p){return timeline.progressFor(stop.coefficientBeat,Math.min(Math.max(0,p),stop.coefficientBeat==='readParameters'?1:1-1e-9));}
  function presentation(progress,clock=timeline){
    const t=clock.at(progress),d=t.definition,s=d.steps.filter(s=>s.at<=t.local+1e-10).at(-1);
    const aligned=d.key==='correspondence'&&t.local>=.35;
    return {...t,mode:d.key,title:s.title,copy:s.copy||(aligned?'用相同的 S(q) 联系 U 与 V，再将共同系数 α 展开为幅度与相位因子。':d.copy),
      note:s.note||(aligned?'以下等式表示正确对齐后的无噪声成像模型；实际幅相估计仍使用原来的工作频谱。':d.note),equation:s.equation||d.equation||derivationFormulas[derivationKey(subProgress(d.key,t.local))],
      subProgress:subProgress(d.key,t.local),substep:s.key,boundary:d.start+(d.end-d.start)*s.at};
  }
  const legacy={finalPrepare:'correspondence',finalInverse:'singleRatio',finalShift:'singleRatio',finalShiftScan:'singleRatio',finalCompare:'singleRatio',finalProduct:'pooledRatio',finalSum:'pooledRatio',finalDivide:'pooledRatio',finalRead:'readParameters'};
  const legacyScenes={'get-peak-inverse':'singleRatio','get-peak-point':'singleRatio','get-peak-scan':'singleRatio','get-peak-compare':'singleRatio','get-peak-product':'pooledRatio','get-peak-sum':'pooledRatio','get-peak-divide':'pooledRatio','get-peak-read':'readParameters'};
  const api={definitions,timeline,stops,stopProgress,presentation,legacy,legacyScenes,correspondenceFormulas,derivationFormulas,subProgress,derivationKey};
  if(node)module.exports=api;else root.SIMCoefficientMainline=api;
})(typeof globalThis!=='undefined'?globalThis:this);
