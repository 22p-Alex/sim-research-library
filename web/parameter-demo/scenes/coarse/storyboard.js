/* FFT 一次成图: scene narration and duration. */
(function(root){
  'use strict';
  const formulas = {
    cost: String.raw`$$\underbrace{N^2}_{\text{候选位移}}\times\underbrace{N^2}_{\text{每次逐点乘加}}=N^4$$`,
    fixed: String.raw`$$U_{\rm p}(\mathbf f)=M_0(\mathbf f)\frac{\widetilde A_0(\mathbf f)}{H(\mathbf f)},\qquad V_{\rm p}(\mathbf f)=M_1(\mathbf f)\frac{\widetilde A_{+1}(\mathbf f)}{H(\mathbf f)}$$`,
    inverse: String.raw`$$u(\mathbf r)=\mathcal F_N^{-1}\{U_{\rm p}\},\qquad v(\mathbf r)=\mathcal F_N^{-1}\{V_{\rm p}\}$$`,
    spatialProduct: String.raw`$$w(\mathbf r)=u^*(\mathbf r)v(\mathbf r)$$`,
    fftCorrelation: String.raw`$$C(\mathbf k')=N^2\mathcal F_N\{u^*v\}(\mathbf k')$$`,
    fftCost: String.raw`$$O(N^4)\ \longrightarrow\ O(N^2\log N)$$`
  };
  const scene={
    id: "coarse",
    label: "FFT 一次成图",
    title: "每换一个位移，都要把频点重新扫一遍。",
    copy: "逐格搜索能得到评分图，但 N² 个候选位移，每个最多要做 N² 次逐点乘加。完整二维搜索的计算量达到 O(N⁴)，图像越大，重复扫描就越慢。",
    equation: formulas.cost,
    note: "N 是图像每轴的采样数。每轴翻倍，完整直接扫描的乘加量约增至 16 倍；这里比较算法工作量，不是实测耗时。",
    duration: 44000,
    chapter: "① 找位置 / 频率坐标",
    phase: "position"
  };
  const stages = [
      [.10, 'hold', 'cost', scene.note, scene.title, scene.copy],
      [.18, 'handoff', 'cost', '要减少的是重复乘加；候选位移、评分定义和最终寻找的整数峰都保持相同。',
        '能否一次算出所有位移，不再逐格重扫？',
        '这些候选比较的是同一对频谱。利用相关与傅里叶变换的关系，可以把重复的位移计算合在一起，用 FFT 批量求出整张评分图。'],
      [.26, 'fixed', 'fixed', '下标 p 表示固定预处理；M 是可靠区掩膜。各自除自身 H，H=0 或不可靠处直接置零，不执行除法。',
        '先把同一对频谱，各自预处理一次。',
        '保留未平移的 0 级与 +1 级频谱，各自在可靠区内校正 OTF，圈外置零。得到固定的 Uₚ、Vₚ，供全部候选位移共用。'],
      [.46, 'inverse', 'inverse', 'u、v 仍保留完整复数相位。它们是用于计算相关的空域工作数组，不是最终的样品重建图。',
        '分别逆 FFT，把两张固定频谱变到空域。',
        'Uₚ、Vₚ 分别变成空域复数场 u、v。接下来在同一位置相乘，就能为所有候选位移共享计算。'],
      [.71, 'multiply', 'spatialProduct', '一次遍历 N² 个空域位置，得到整张乘积图。这里的“一次”指一次全场逐点相乘，不是只算一个像素。',
        '同一个位置，取共轭，再逐点相乘。',
        '每个位置 r 都计算 u*(r)v(r)，得到乘积图 w。只需遍历空域一次，不再为每个候选位移重新遍历频点。'],
      [.96, 'forward', 'fftCorrelation', 'C 是未归一化的复数乘积和，N² 来自逆变换的归一化约定。两边能量与有效点数也由 FFT 批量计算，最后得到同一定义的评分 ρ。',
        '对乘积图做正 FFT，同时得到所有位移的相关。',
        '输出的每个 k′ 对应一个候选位移的乘积和。再取模并做能量归一化，就得到与逐格扫描相同的评分图，沿用同一坐标与色标。'],
      [1.01, 'peak', 'fftCost', '常数次二维 FFT 将完整搜索降为 O(N² log N)。整数峰不变；接下来只需在它附近细化小数位移。',
        '同一张评分图，用更少的重复计算得到。',
        '从 O(N⁴) 的逐格重扫，改为 O(N² log N) 的 FFT 批量计算。得到相同的整数峰后，再在峰附近做局部细化。'],
  ];
  scene.beats = stages.map(([end,key,formula,note,title,copy],i)=>({key,action:key,start:i?stages[i-1][0]:0,end:Math.min(1,end),formula,note,title,copy}));
  scene.present = (p, context) => {
    p=Math.round(p*1e12)/1e12;
    const b=scene.beats.find(b=>p<b.end)||scene.beats.at(-1);
    return {title:b.title,copy:b.copy,equation:context.formulas[b.formula],note:b.note};
  };
  scene.formulaMode = p => scene.id+'-'+(scene.beats.find(b=>Math.round(p*1e12)/1e12<b.end)||scene.beats.at(-1)).key;
  scene.formulas = formulas;
  if(typeof module!=='undefined'&&module.exports)module.exports=scene;
  else(root.SIMParameterUnits ||= {})[scene.id]=scene;
})(typeof globalThis!=='undefined'?globalThis:this);
