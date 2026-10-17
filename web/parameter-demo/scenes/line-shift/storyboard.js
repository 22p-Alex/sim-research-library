/* 沿一行对齐: scene narration and duration. */
(function(root){
  'use strict';
  const formulas = {
    real: String.raw`$$\text{移动 }\delta\text{ 格的分数}=\sum_q\bigl[\text{0 级在 }q\text{ 的值}\bigr]\bigl[\text{旁带在 }q+\delta\text{ 的值}\bigr]$$`
  };
  const scene={
    id: "line-shift",
    label: "沿一行对齐",
    title: "沿一行移动，找出对齐的位置。",
    copy: "一维示例中，同一组 1、4、2 在两份记录里相差两格。不同位移下，将对应格的数值相乘再求和；三项对齐时，乘积和达到峰值。",
    equation: formulas.real,
    note: "教学值不替代原图三个点的读数。这里 H=1、m=1、共同相位为 0；范围外补零。原始乘积和用于讲运算，实际搜索还会做能量归一化。",
    duration: 26000,
    chapter: "① 找位置 / 频率坐标",
    phase: "position"
  };
  scene.present = (p, context) => {
    const {M, formulas, lineState, otfState}=context, data=scene;
    return { equation: M.teachingEquations[lineState(p).real.best === 1 ? 'peak' : 'real'], note: data.note };
  };
  scene.formulaMode = (p,context) => 'line-shift-' + (context.lineState(p).real.best===1?'peak':'sum');
  scene.formulas = formulas;
  if(typeof module!=='undefined'&&module.exports)module.exports=scene;
  else(root.SIMParameterUnits ||= {})[scene.id]=scene;
})(typeof globalThis!=='undefined'?globalThis:this);
