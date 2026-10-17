/* Authoritative scene 19 storyboard. All intervals below are BEAT-LOCAL [0,1].
 * Change duration to retime a beat; its cues, formula and narration move together.
 * Source: local fairSIM 711afd12, Correlation.getPeak/commonRegion; see README.md. */
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const Clock = node ? require('../../../shared/animation/beat-clock.js') : root.SIMBeatClock;
  const definitions = [
    {
      key: "finalPrepare",
      duration: 9600,
      action: "准备工作副本",
      title: "按最终位移，准备两份幅相计算工作频带。",
      copy: "先收起位置搜索的概览。从未校正的临时频带复制数据，按锁定波矢准备 B₀、B₁；两张图仍各用自己的检测频率坐标。",
      note: "M₀、M₁ 按最终位移筛选两路可靠 OTF，并执行源码的径向排除；保留处各除自身 H，其他位置置零。这是从原始临时频带开始的新工作副本，不是把前面的 U、V 再除一次 H。",
      footer: "最终工作副本 · 原生检测坐标 · 一次自身 OTF 校正",
      domain: "频域 · 最终工作副本",
      layout: "pair",
      formula: { parts: [
        {key:"prepare", tex:String.raw`\bigl(\widetilde A_0,\widetilde A_{+1}\bigr)\xrightarrow[\text{最终位移 }\widehat{\mathbf k}]{\text{复制、筛选与校正}}\bigl(B_0,B_1\bigr)`}
      ], join:"", emphasis:[{"at":0,"parts":["prepare"]}] },
      visibility: {"enter":[0.5833333333333334,0.8333333333333334],"exit":[0.9,0.975]},
      cues: {"overviewExit":[0.125,0.4583333333333333],"body":[0.5833333333333334,0.8333333333333334],"handoffEnd":[0.5833333333333334,0.5833333333333334]}
    },
    {
      key: "finalInverse",
      duration: 12800,
      action: "两路逆 FFT",
      title: "分别逆 FFT，得到两张空域复数计算场。",
      copy: "B₀、B₁ 在各自原位执行逆 FFT，变成 u、v。亮度显示模长，颜色显示复数相位；计算保留全部实部和虚部。",
      note: "F⁻¹ 把每一路完整 N×N 工作频谱变为空域数组。u、v 是用于幅相计算的复数场，不是新的曝光，也不是最终重建的样品强度图。",
      footer: "两路各自逆 FFT · 数组仍为复数",
      domain: "空域 · 幅相计算",
      layout: "pair",
      formula: { parts: [
        {key:"inverse0", tex:String.raw`u=\mathcal F_N^{-1}\{B_0\}`},
        {key:"inverse1", tex:String.raw`v=\mathcal F_N^{-1}\{B_1\}`}
      ], join:String.raw`,\qquad `, emphasis:[{"at":0,"parts":["inverse0","inverse1"]}] },
      visibility: {"enter":[0.018749999999999996,0.08124999999999998],"exit":[0.925,0.98125]},
      cues: {"inverse":[0.25,0.8125]}
    },
    {
      key: "finalShift",
      duration: 11200,
      action: "空间位移斜坡",
      title: "旁带乘空间相位斜坡，落实已锁定的位移。",
      copy: "u 保持不变。先用一个实际位置的箭头解释单位模指数；这个位置的旋转演示完成后，再按行处理整张 v，逐点形成 vₖ。",
      note: "斜坡落实已锁定的频移；OTF 校正和对应掩膜准确时，理想模型给出 vₖ=αu，其中 α=m exp(iφΔ) 处处相同。实际估计写为近似关系。这不是再次移动已归位的工作数组：本拍输入来自原始检测坐标的工作副本。",
      footer: "k̂ 已固定 · 单位模乘法改变相角，不改变该像素模长",
      domain: "空域 · 幅相计算",
      layout: "shift",
      formula: { parts: [
        {key:"target", tex:String.raw`v_{\widehat{\mathbf k}}(\mathbf r)=v(\mathbf r)`},
        {key:"ramp", tex:String.raw`e^{-2\pi i\widehat{\mathbf k}\cdot\mathbf r/N}`},
        {key:"model", tex:String.raw`\qquad v_{\widehat{\mathbf k}}\approx\alpha u,\quad\alpha=m e^{i\phi_\Delta}`}
      ], join:"", emphasis:[{"at":0,"parts":["ramp"]},{"at":0.82,"parts":["model"]}] },
      visibility: {"enter":[0.021428571428571436,0.09285714285714287],"exit":[0.9142857142857143,0.9785714285714285]},
      cues: {"shift":[0.17857142857142858,0.5],"shiftOutput":[0.5,0.5714285714285714],"shiftScan":[0.5714285714285714,0.8214285714285714]}
    },
    {
      key: "finalProduct",
      duration: 12800,
      action: "同点共轭相乘",
      title: "取同一个空域位置，同时算乘积与参考能量。",
      copy: "若 vₖ≈αu，两边乘 u* 就有 u*vₖ≈α|u|²。两个光标取同一个实际 r，分别形成复数乘积 z 和非负参考能量 e。",
      note: "共轭使 u*u=|u|²，因此每个位置都在用同一 α 乘参考能量。这解释了为何分子要取共轭乘积、分母要取能量。精确等式限于正确波矢、匹配 OTF 和掩膜、准确相对步进及无噪声模型。",
      footer: "相同 r · 橙色 z 进入分子 · 青色 e 进入分母",
      domain: "空域 · 幅相计算",
      layout: "product",
      formula: { parts: [
        {key:"productName", tex:String.raw`z(\mathbf r)=`},
        {key:"conjugate", tex:String.raw`u^*(\mathbf r)`},
        {key:"multiply", tex:String.raw`v_{\widehat{\mathbf k}}(\mathbf r)`},
        {key:"energy", tex:String.raw`\approx\alpha\underbrace{|u(\mathbf r)|^2}_{e(\mathbf r)}`}
      ], join:"", emphasis:[{"at":0,"parts":["conjugate"]},{"at":0.5,"parts":["multiply","energy","productName"]}] },
      visibility: {"enter":[0.018750000000000003,0.08125],"exit":[0.925,0.98125]},
      cues: {"conjugate":[0.1875,0.5],"multiply":[0.5,0.8125]}
    },
    {
      key: "finalSum",
      duration: 17600,
      action: "全场双路累计",
      title: "扫过全部 N² 个位置，分别累计 C 与 E₀。",
      copy: "先慢看第一个像素的贡献，再按行遍历整张空域网格。复数乘积进入 C，参考能量进入 E₀；两条累计通道分开显示。",
      note: "每个位置有 z≈αe，同一个 α 可提出求和，所以 C≈αE₀。Σ 遍历完整 N² 空域位置，包含零贡献项；两路读数使用同一前缀和，不把搜索公共点数或工作掩膜点数当成累计次数。",
      footer: "完整空域网格 · 每个位置参与一次 · 累计完成后才相除",
      domain: "空域 · 幅相计算",
      layout: "sum",
      formula: { parts: [
        {key:"cross", tex:String.raw`C=\sum_{\mathbf r}z(\mathbf r)`},
        {key:"energySum", tex:String.raw`E_0=\sum_{\mathbf r}e(\mathbf r)`},
        {key:"domain", tex:String.raw`\mathbf r\in\{0,\ldots,N-1\}^2`}
      ], join:String.raw`,\qquad `, emphasis:[{"at":0,"parts":["cross","energySum"]}] },
      visibility: {"enter":[0.013636363636363632,0.05909090909090907],"exit":[0.9454545454545454,0.9863636363636363]},
      cues: {"sumFirst":[0.09090909090909091,0.09090909090909091],"sumSweep":[0.22727272727272727,0.9545454545454546],"contribution":[0.09090909090909091,0.20454545454545456],"sumScan":[0.22727272727272727,0.22727272727272727]}
    },
    {
      key: "finalDivide",
      duration: 8000,
      action: "除以参考能量",
      title: "全部累加完成，C 除以 E₀ 得到一个复系数。",
      copy: "先看 C≈αE₀：共同复比例乘参考能量，得到分子。E₀>0 时，把两路完整累计量相除，读出 α̂；箭头在除法完成后揭示。",
      note: "相除的原因是消去参考能量，留下共同复比例。理想比例下 C=αE₀；有误差时 C/E₀ 仍是给定两场的单个复比例最小二乘解。完整推导留在原理区；本拍不再除 H，也不试探旋转。",
      footer: "N² 项已累计 · C ÷ E₀ · 一个共同复系数",
      domain: "复系数 · 参数读出",
      layout: "result",
      formula: { parts: [
        {key:"reason", tex:String.raw`C\approx\alpha E_0\quad\Longrightarrow\quad`},
        {key:"divide", tex:String.raw`\widehat\alpha=\frac{{\color{#efb879}C}}{{\color{#7ad5cd}E_0}}`}
      ], join:"", emphasis:[{"at":0,"parts":["reason"]},{"at":0.25,"parts":["divide"]}] },
      visibility: {"enter":[0.030000000000000006,0.13000000000000003],"exit":[0.88,0.97]},
      cues: {"resultEnter":[0.03,0.13],"divide":[0.25,0.6],"divideExit":[0.88,0.97]}
    },
    {
      key: "finalRead",
      duration: 8000,
      action: "读取幅相",
      title: "从同一个复系数，读取调制度与共同相位。",
      copy: "箭头长度给出 m̂，相角给出 φ̂Δ。把共同偏移加到已知相对相移 φ′ⱼ 上，得到各帧相位；锁定波矢独立进入结果卡，接着回填矩阵。",
      note: "m̂=|α̂|，φ̂Δ=arg α̂。临时旁带的 2/3 权重已补偿余弦展开的 1/2，模长直接给调制度，不再乘 2。相对步进必须已知且准确；这些参数来自同一组三帧观测。",
      footer: "模长 → 调制度 · 相角 → 共同相位 · 参数交给解混矩阵",
      domain: "复系数 · 参数读出",
      layout: "result",
      formula: { parts: [
        {key:"modulation", tex:String.raw`\widehat m=|\widehat\alpha|`},
        {key:"phase", tex:String.raw`\widehat\phi_\Delta=\arg\widehat\alpha`},
        {key:"frames", tex:String.raw`\widehat\phi_j=\phi'_j+\widehat\phi_\Delta`}
      ], join:String.raw`,\qquad `, emphasis:[{"at":0,"parts":["phase"]},{"at":0.4,"parts":["modulation"]},{"at":0.7,"parts":["frames"]}] },
      visibility: {"enter":[0.030000000000000006,0.13000000000000003]},
      cues: {"readReady":[0,0],"readEnter":[0.03,0.13],"phaseRead":[0.1,0.4],"lengthRead":[0.4,0.7],"cards":[0.65,0.95]}
    }
  ];
  const timeline = Clock.define(definitions);
  const entry = Clock.freeze({
  "id": "locked-spectrum",
  "from": "refine",
  "title": "位置已锁定，回到两张完整频谱。",
  "copy": "波矢已经锁定，两路记录的对应地址已经确定。接下来从原始临时频带准备最终工作副本，用已知位移计算共同幅相。",
  "note": "锁定的是位移参数和对应关系。下一幕收起搜索概览，从原始临时频带复制并按最终规则筛选；工作掩膜与搜索公共区可以不同，随后遍历全部 N² 个空域位置。",
  "footer": "k̂ 已锁定 · 对应地址已确定 · 原始临时频带 → 最终幅相工作副本。",
  "action": "位置锁定 · 收起搜索概览",
  "equation": "$$\\mathbf k'=\\widehat{\\mathbf k},\\qquad\\widetilde A_0(\\mathbf q)\\ \\longleftrightarrow\\ \\widetilde A_{+1}(\\mathbf q+\\widehat{\\mathbf k})$$"
});
  const formulas = Object.fromEntries(timeline.beats.map(b => [b.key, '$$' + b.formula.parts.map(p => p.tex).join(b.formula.join) + '$$']));
  const scene = Clock.freeze({
    id: 'get-peak', legacyId: 'least-squares-fit', label: '共同幅相估计', duration: timeline.duration,
    title: definitions[0].title, copy: definitions[0].copy, note: definitions[0].note, equation: formulas.finalPrepare,
    objective: '沿 fairSIM getPeak 的计算顺序，从最终工作频带得到一个共同复系数，并读取幅相。',
    inputs: ['estimate.finalPeak', 'locked-wavevector'], outputs: ['estimated-modulation', 'estimated-phase', 'locked-wavevector'],
    entry: entry.id, exit: 'estimated-parameter-cards', phase: 'coefficient', chapter: '② 求幅相 / 复数值',
    source: { commit: '711afd12cb8c4fd4207bbca7ee7610c5aed4f732', file: 'Correlation.java', methods: ['getPeak', 'commonRegion'] },
    review: { numerical: 'automated', formula: 'automated', transition: 'automated', visual: 'pending-user' }
  });
  const api = { timeline, scene, entry, formulas: Clock.freeze(formulas) };
  if (node) module.exports = api; else root.SIMGetPeak = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
