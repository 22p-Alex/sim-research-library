/* 回到二维: scene narration and duration. */
(function(root){
  'use strict';
  const formulas = {
    coordinates: String.raw`$$\mathbf q=(q_x,q_y),\qquad\mathbf k'=(k'_x,k'_y),\qquad\text{0 级取 }\mathbf q,\quad\text{旁带取 }\mathbf q+\mathbf k'$$`,
    shift: "$${\\color{#b7a5eb}\\widetilde A_{+1}(\\mathbf f)\\ \\longrightarrow\\ \\widetilde A_{+1}(\\mathbf q+\\mathbf k'),\\qquad H(\\mathbf f)\\ \\longrightarrow\\ H(\\mathbf q+\\mathbf k')}$$"
  };
  const scene={
    id: "shift",
    label: "回到二维",
    title: "回到二维，横纵一起对齐。",
    copy: "每个频率有横纵两个坐标。用候选位移 −k′ 搬回旁带时，频谱与 OTF 一起换坐标，在 q+k′ 处取值。只有 k′=k 时，两边才对应同一样品频率。",
    equation: formulas.shift,
    note: "逐点比较从一行扩展到整个二维公共区。教学位移 2 不带入原图。移回后旁带取值对应 H(q+k′) 与 S(q+k′−k)；画面仅示意 k′=k，真实 k 仍待后续搜索。",
    duration: 16000,
    chapter: "① 找位置 / 频率坐标",
    phase: "position"
  };
  scene.present = (p, context) => {
    const {M, formulas, lineState, otfState}=context, data=scene;
    if (p < .40) return { equation: p < .15 ? M.teachingEquations.peak : formulas.coordinates,
      note: p < .15 ? '保留一维例子的终点：位移 2、乘积和 21。它只说明如何比较；接下来回到原图。' : 'q 是参考频率，k′ 是候选位移，两者都有横纵分量。0 级取 q，旁带按候选取 q+k′；真实 k 仍未知，图中仅示意 k′=k。' };
    if (p < .68) return { equation: formulas.source, note: '两幅图采用同一个检测频率原点。相同 f 处分别包含 S(f) 与 S(f−k)，此时还没有归位。' };
    return {equation:data.equation,note:data.note};
  };
  scene.formulaMode = (p,context) => 'shift' + (p < .15 ? '-line-end' : p < .40 ? '-coordinates' : p < .68 ? '-detector' : '');
  scene.formulaCuts = [.15,.40,.68];
  scene.formulas = formulas;
  if(typeof module!=='undefined'&&module.exports)module.exports=scene;
  else(root.SIMParameterUnits ||= {})[scene.id]=scene;
})(typeof globalThis!=='undefined'?globalThis:this);
