/* 找公共区: scene narration and duration. */
(function(root){
  'use strict';
  const formulas = {
    source: "$${\\color{#7ad5cd}\\widetilde A_0(\\mathbf f)=H(\\mathbf f)S(\\mathbf f)},\\qquad{\\color{#b7a5eb}\\widetilde A_{+1}(\\mathbf f)=m e^{i\\phi_\\Delta}H(\\mathbf f)S(\\mathbf f-\\mathbf k)}$$",
    point: "$${\\color{#7ad5cd}\\widetilde A_0(\\mathbf q)=H(\\mathbf q)S(\\mathbf q)},\\qquad{\\color{#b7a5eb}\\widetilde A_{+1}(\\mathbf f)=m e^{i\\phi_\\Delta}H(\\mathbf f)S(\\mathbf f-\\mathbf k),\\qquad\\mathbf f-\\mathbf k=\\mathbf q}$$",
    addresses: String.raw`$$\begin{aligned}\widetilde A_0(\mathbf q)&=H(\mathbf q)\,\underbrace{S(\mathbf q)}_{\text{同一样品信息}}\\\widetilde A_{+1}(\mathbf q+\mathbf k)&=m e^{i\phi_\Delta}H(\mathbf q+\mathbf k)\,\underbrace{S(\mathbf q)}_{\text{同一样品信息}}\end{aligned}$$`,
    derive: String.raw`$$\mathbf f-\mathbf k=\mathbf q\ \Longrightarrow\ \mathbf f=\mathbf q+\mathbf k,\qquad S((\mathbf q+\mathbf k)-\mathbf k)=S(\mathbf q)$$`,
    candidatePoint: String.raw`$$(\mathbf q+\mathbf k)-\mathbf k'=\mathbf q+(\mathbf k-\mathbf k'),\qquad\mathbf k'=\mathbf k\ \Longrightarrow\ (\mathbf q+\mathbf k)-\mathbf k'=\mathbf q$$`,
    common: String.raw`$$\Omega^{\text{几何}}_{\mathbf k'}=\{\mathbf q:|H(\mathbf q)|>0,\ |H(\mathbf q+\mathbf k')|>0\}$$`,
    region: String.raw`$$\Omega_{\mathbf k',\tau}=\{\mathbf q:\ |H(\mathbf q)|\ge\tau,\ |H(\mathbf q+\mathbf k')|\ge\tau\}\subseteq\Omega^{\text{几何}}_{\mathbf k'},\qquad\tau>0$$`
  };
  const scene={
    id: "shared",
    label: "找公共区",
    title: "同一样品频率，在两个级次中记录在哪里？",
    copy: "0 级在检测坐标 f=q 记录 S(q)，+1 级在 f=q+k 记录同一分量。真实 k 尚未知；试用 k′ 时，比较 Ã₀(q) 与 Ã₊₁(q+k′)，并只保留两处 OTF 都达到阈值的频点。",
    equation: formulas.region,
    note: "k 是真实未知波矢，k′ 是候选，k̂ 是估计值。画面用 k′=k 演示正确对应，不能由单个点的示意确定 k；后面会用公共区内多个频点的复数匹配搜索。OTF 阈值只筛选可比较的通带，还须检查有效点数与信号能量。",
    duration: 28000,
    chapter: "① 找位置 / 频率坐标",
    phase: "position"
  };
  scene.present = (p, context) => {
    const {M, formulas, lineState, otfState}=context, data=scene;
    return { equation: p < .18 ? formulas.point : p < .50 ? formulas.derive : p < .78 ? formulas.candidatePoint : p < .94 ? formulas.common : formulas.region,
      note: p < .18 ? '固定一个样品频率 q：0 级取 f=q，旁带取 f=q+k。' + M.notation.tilde + M.notation.band
        : p < .39 ? '下方 −k 移到等号右侧成为 +k；上方寻址光标同步沿 +k 找到旁带中的 f=q+k。k 的数值将在后面估计。'
        : p < .54 ? '先让两幅图共用检测坐标原点；这是画面叠放，尚未做频移。接下来用 k′ 表示尝试搬回的位移。'
        : p < .68 ? '真实记录在 q+k；移动 −k′ 后还剩位置误差 k−k′。这两个量不相等时不能抵消，频点携带的复数值保持不变。'
        : p < .78 ? '这里只示意 k′=k 时的对齐：残差为零，两个标记重合。k 仍未知，后面要比较候选，求得 k̂。'
        : p < .94 ? '此处示意 k′=k。虚线轮廓是两边 OTF 非零的几何交集；边缘虽有传递，仍可能太弱，比较时仍需筛掉弱传递点。' : data.note };
  };
  scene.formulaMode = (p,context) => p < .78 ? 'shared-derive' : p < .94 ? 'shared-common' : 'shared-reliable';
  scene.formulas = formulas;
  if(typeof module!=='undefined'&&module.exports)module.exports=scene;
  else(root.SIMParameterUnits ||= {})[scene.id]=scene;
})(typeof globalThis!=='undefined'?globalThis:this);
