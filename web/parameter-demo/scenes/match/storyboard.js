/* 逐格填分数: scene narration and duration. */
(function(root){
  'use strict';
  const formulas = {
    match: String.raw`$$C(\mathbf k')=\sum_{\mathbf q\in\Omega(\mathbf k')}U^*(\mathbf q)V_{\mathbf k'}(\mathbf q)$$`,
    score: String.raw`$$\rho(\mathbf k')=\frac{|C(\mathbf k')|}{\sqrt{\sum_{\Omega}|U|^2\sum_{\Omega}|V_{\mathbf k'}|^2}}$$`,
    cost: String.raw`$$\underbrace{N^2}_{\text{候选位移}}\times\underbrace{N^2}_{\text{每次逐点乘加}}=N^4$$`
  };
  const scene={
    id: "match",
    label: "逐格填分数",
    title: "试一个位移，算一个分数，填一个格。",
    copy: "保持 0 级固定。每换一个 k′，就在公共区逐点共轭相乘、累计，再把分数送入右侧对应格。先看清几次计算，再加速填满候选图。",
    equation: formulas.match,
    note: "主线只保留乘加与填图。匹配分数取乘积和的模并做能量归一化；越亮表示匹配越强，深色格未纳入搜索。",
    duration: 36000,
    chapter: "① 找位置 / 频率坐标",
    phase: "position"
  };
  const stages = [
      [.12, 'prepare', 'correct', '接住已校正的 U、V；接下来每试一个候选，就累计一次公共区。'],
      [.82, 'scan', 'match', '游标选 k′ → 扫过该候选的可靠公共点 → 共轭乘加 → 取模、能量归一 → 分数落入对应格。'],
      [1.01, 'cost', 'cost', 'N 是每轴格数。若 N×N 个位移各遍历 N×N 个频点，直接全扫为 O(N⁴)；本例只画限定范围，计数是工作量示意，不是实测耗时。'],
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
