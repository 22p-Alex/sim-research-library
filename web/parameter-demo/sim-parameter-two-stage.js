/* Production lesson: correspondence, one-dimensional arithmetic, search and fit.
 * Uses an observation-only estimator and the fairSIM 2016 SI band model;
 * own-OTF correction is expanded as conjugate multiplication and normalization.
 * The normalized score and 5×5 search remain project choices. */
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const M = node ? require('./sim-parameter-model.js') : root.SIMParameterStory;
  const E = node ? require('../shared/sim-parameter-estimation.js') : root.SIMParameterEstimation;
  const A = node ? require('../atlas/sim-atlas-core.js') : root.SIMAtlas;
  const { clamp, ramp } = M;
  const bandColors = Object.freeze(['#7ad5cd', '#b7a5eb', '#efb879']);
  const color = (band, tex) => '{\\color{' + bandColors[band] + '}' + tex + '}';
  const pairFormula = (zero, side, detail = '') => '$$' + color(0, zero) + String.raw`,\qquad` + color(1, side) + detail + '$$';
  const formulas = {
    source: pairFormula(String.raw`\widetilde A_0(\mathbf f)=H(\mathbf f)S(\mathbf f)`, String.raw`\widetilde A_{+1}(\mathbf f)=m e^{i\phi_\Delta}H(\mathbf f)S(\mathbf f-\mathbf k)`),
    point: pairFormula(String.raw`\widetilde A_0(\mathbf q)=H(\mathbf q)S(\mathbf q)`, String.raw`\widetilde A_{+1}(\mathbf f)=m e^{i\phi_\Delta}H(\mathbf f)S(\mathbf f-\mathbf k),\qquad\mathbf f-\mathbf k=\mathbf q`),
    addresses: M.teachingEquations.shared,
    derive: String.raw`$$\mathbf f-\mathbf k=\mathbf q\ \Longrightarrow\ \mathbf f=\mathbf q+\mathbf k,\qquad S((\mathbf q+\mathbf k)-\mathbf k)=S(\mathbf q)$$`,
    candidatePoint: String.raw`$$(\mathbf q+\mathbf k)-\mathbf k'=\mathbf q+(\mathbf k-\mathbf k'),\qquad\mathbf k'=\mathbf k\ \Longrightarrow\ (\mathbf q+\mathbf k)-\mathbf k'=\mathbf q$$`,
    common: String.raw`$$\Omega^{\text{几何}}_{\mathbf k'}=\{\mathbf q:|H(\mathbf q)|>0,\ |H(\mathbf q+\mathbf k')|>0\}$$`,
    real: M.teachingEquations.real,
    coordinates: String.raw`$$\mathbf q=(q_x,q_y),\qquad\mathbf k'=(k'_x,k'_y),\qquad\text{0 级取 }\mathbf q,\quad\text{旁带取 }\mathbf q+\mathbf k'$$`,
    shift: '$$' + color(1, String.raw`\widetilde A_{+1}(\mathbf f)\ \longrightarrow\ \widetilde A_{+1}(\mathbf q+\mathbf k'),\qquad H(\mathbf f)\ \longrightarrow\ H(\mathbf q+\mathbf k')`) + '$$',
    region: String.raw`$$\Omega_{\mathbf k',\tau}=\{\mathbf q:\ |H(\mathbf q)|\ge\tau,\ |H(\mathbf q+\mathbf k')|\ge\tau\}\subseteq\Omega^{\text{几何}}_{\mathbf k'},\qquad\tau>0$$`,
    otfSymbols: String.raw`$$H_0=H(\mathbf q),\quad H_1=H(\mathbf q+\mathbf k'),\quad\alpha=m e^{i\phi_\Delta};\qquad\text{本幕示意 }\mathbf k'=\mathbf k$$`,
    otfMultiply: String.raw`$$H^*(HS)=\underbrace{H^*H}_{|H|^2}S=|H|^2S$$`,
    otfNormalize: String.raw`$$\frac{H^*(HS)}{|H|^2}=\frac{|H|^2}{|H|^2}S=\frac{HS}{H}=S,\qquad H\ne0$$`,
    correct: String.raw`$$\begin{gathered}` + color(0, String.raw`U(\mathbf q)=\frac{H^*(\mathbf q)\widetilde A_0(\mathbf q)}{|H(\mathbf q)|^2}=S(\mathbf q)`)
      + String.raw`\\` + color(1, String.raw`V_{\mathbf k'}(\mathbf q)=\frac{H^*(\mathbf q+\mathbf k')\widetilde A_{+1}(\mathbf q+\mathbf k')}{|H(\mathbf q+\mathbf k')|^2}=\alpha S(\mathbf q-\mathbf k+\mathbf k')`) + String.raw`\end{gathered}$$`,
    match: String.raw`$$C(\mathbf k')=\sum_{\mathbf q\in\Omega(\mathbf k')}U^*(\mathbf q)V_{\mathbf k'}(\mathbf q)$$`,
    score: String.raw`$$\rho(\mathbf k')=\frac{|C(\mathbf k')|}{\sqrt{\sum_{\Omega}|U|^2\sum_{\Omega}|V_{\mathbf k'}|^2}}$$`,
    cost: String.raw`$$\underbrace{N^2}_{\text{候选位移}}\times\underbrace{N^2}_{\text{每次逐点乘加}}=N^4$$`,
    fixed: String.raw`$$U_{\rm p}(\mathbf f)=M_0(\mathbf f)\frac{\widetilde A_0(\mathbf f)}{H(\mathbf f)},\qquad V_{\rm p}(\mathbf f)=M_1(\mathbf f)\frac{\widetilde A_{+1}(\mathbf f)}{H(\mathbf f)}$$`,
    inverse: String.raw`$$u(\mathbf r)=\mathcal F_N^{-1}\{U_{\rm p}\},\qquad v(\mathbf r)=\mathcal F_N^{-1}\{V_{\rm p}\}$$`,
    spatialProduct: String.raw`$$w(\mathbf r)=u^*(\mathbf r)v(\mathbf r)$$`,
    fftCorrelation: String.raw`$$C(\mathbf k')=N^2\mathcal F_N\{u^*v\}(\mathbf k')$$`,
    fftCost: String.raw`$$O(N^4)\ \longrightarrow\ O(N^2\log N)$$`,
    search: String.raw`$$\mathcal K=\{\mathbf k'\in\mathbb Z^2:r_{\min}\le\|\mathbf k'\|\le r_{\max}\},\qquad\widehat{\mathbf k}_{\rm coarse}=\operatorname*{arg\,max}_{\mathbf k'\in\mathcal K}\rho(\mathbf k')$$`,
    gridLimit: String.raw`$$\mathbf k'=\widehat{\mathbf k}_{\rm int}+\Delta\mathbf k',\qquad\Delta k'_x,\Delta k'_y\in[-0.5,+0.5]\ \text{DFT 格}$$`,
    subpixel: String.raw`$$\begin{aligned}a&=\mathcal F_N^{-1}\{\widetilde A_{+1}\},\\ B_{\mathbf k'}(\mathbf q)&=\mathcal F_N\!\left\{a[x,y]e^{-\frac{2\pi i}{N}(k'_x x+k'_y y)}\right\}(\mathbf q)=\widetilde A_{+1}(\mathbf q+\mathbf k'),\\ V_{\mathbf k'}(\mathbf q)&=\frac{B_{\mathbf k'}(\mathbf q)}{H(\mathbf q+\mathbf k')},\qquad\mathbf q\in\Omega_{\mathbf k',\tau}.\end{aligned}$$`,
    local: String.raw`$$k'_{r,a}=c_{r,a}+\frac{j-2}{2}s_r,\quad j=0,\ldots,4,\quad a\in\{x,y\},\qquad s_r\in\{0.50,0.10,0.02\}\ \text{格}$$`,
    lockedAddresses: String.raw`$$\mathbf k'=\widehat{\mathbf k},\qquad\widetilde A_0(\mathbf q)\ \longleftrightarrow\ \widetilde A_{+1}(\mathbf q+\widehat{\mathbf k})$$`,
    coefficient: String.raw`$$U_j=S(\mathbf q_j),\qquad V_j=m e^{i\phi_\Delta}U_j$$`,
    relationModel: String.raw`$$\begin{gathered}U_j=\frac{\widetilde A_0(\mathbf q_j)}{H(\mathbf q_j)}=S(\mathbf q_j),\qquad V_j=\frac{\widetilde A_{+1}(\mathbf q_j+\widehat{\mathbf k})}{H(\mathbf q_j+\widehat{\mathbf k})},\\V_j\simeq\alpha U_j,\qquad\alpha={\color{#efb879}m}e^{i{\color{#b7a5eb}\phi_\Delta}},\quad\mathbf q_j\in\Omega\end{gathered}$$`,
    complexPlaneTransform: String.raw`$$e^{i\phi_\Delta}=\cos\phi_\Delta+i\sin\phi_\Delta,\qquad\begin{bmatrix}\operatorname{Re}V_j\\\operatorname{Im}V_j\end{bmatrix}\simeq {\color{#efb879}m}\underbrace{\begin{bmatrix}\cos\phi_\Delta&-\sin\phi_\Delta\\\sin\phi_\Delta&\cos\phi_\Delta\end{bmatrix}}_{\text{同步旋转 }\phi_\Delta}\begin{bmatrix}\operatorname{Re}U_j\\\operatorname{Im}U_j\end{bmatrix}$$`,
    leastSquaresFit: String.raw`$$\widehat\alpha=\operatorname*{arg\,min}_{\alpha\in\mathbb C}\underbrace{\sum_{\mathbf q\in\Omega}|V(\mathbf q)-\alpha U(\mathbf q)|^2}_{J(\alpha)}=\frac{\overbrace{\sum_\Omega U^*V}^{C}}{\underbrace{\sum_\Omega|U|^2}_{E_U}}$$`,
    fit: String.raw`$$J(\alpha)=E_U\left|\alpha-\frac C{E_U}\right|^2+E_V-\frac{|C|^2}{E_U},\qquad\frac{J(\widehat\alpha)}{E_V}=1-\rho^2$$`,
    readParameters: String.raw`$$\widehat\alpha={\color{#efb879}\widehat m}e^{i{\color{#b7a5eb}\widehat\phi_\Delta}},\quad {\color{#efb879}\widehat m}=|\widehat\alpha|,\quad {\color{#b7a5eb}\widehat\phi_\Delta}=\arg C,\qquad\widehat\phi_j=\frac{2\pi j}{3}+\widehat\phi_\Delta$$`,
  };
  const definitions = [
    ['shared', '找公共区', '同一样品频率，在两个级次中记录在哪里？', '0 级在检测坐标 f=q 记录 S(q)，+1 级在 f=q+k 记录同一分量。真实 k 尚未知；试用 k′ 时，比较 Ã₀(q) 与 Ã₊₁(q+k′)，并只保留两处 OTF 都达到阈值的频点。', 'region', 'k 是真实未知波矢，k′ 是候选，k̂ 是估计值。画面用 k′=k 演示正确对应，不能由单个点的示意确定 k；后面会用公共区内多个频点的复数匹配搜索。OTF 阈值只筛选可比较的通带，还须检查有效点数与信号能量。', 28000],
    ['line-shift', '沿一行对齐', '沿一行移动，找出对齐的位置。', '一维示例中，同一组 1、4、2 在两份记录里相差两格。不同位移下，将对应格的数值相乘再求和；三项对齐时，乘积和达到峰值。', 'real', '教学值不替代原图三个点的读数。这里 H=1、m=1、共同相位为 0；范围外补零。原始乘积和用于讲运算，实际搜索还会做能量归一化。', 26000],
    ['shift', '回到二维', '回到二维，横纵一起对齐。', '每个频率有横纵两个坐标。用候选位移 −k′ 搬回旁带时，频谱与 OTF 一起换坐标，在 q+k′ 处取值。只有 k′=k 时，两边才对应同一样品频率。', 'shift', '逐点比较从一行扩展到整个二维公共区。教学位移 2 不带入原图。移回后旁带取值对应 H(q+k′) 与 S(q+k′−k)；画面仅示意 k′=k，真实 k 仍待后续搜索。', 16000],
    ['otf', '共轭与归一', '先乘自己的 H*，再除以 |H|²。', '保留可靠公共点。每一行先乘自身 OTF 的共轭，让 H*H 合成 |H|²；此时仍带衰减，再除以相同的 |H|²，才得到可比较的 U、V。', 'correct', '两步合起来等价于除以自身 H。只乘 H* 时仍有 |H|²；完成归一化且位移正确时，两边才只差共同幅相 α。筛掉弱 H，可避免不稳定的除法。', 32000],
    ['match', '逐格填分数', '试一个位移，算一个分数，填一个格。', '保持 0 级固定。每换一个 k′，就在公共区逐点共轭相乘、累计，再把分数送入右侧对应格。先看清几次计算，再加速填满候选图。', 'match', '主线只保留乘加与填图。匹配分数取乘积和的模并做能量归一化；越亮表示匹配越强，深色格未纳入搜索。', 36000],
    ['coarse', 'FFT 一次成图', '换到空域，只乘一次，算出整张图。', '原有元素先变暗。两个未平移频带各自校正、圈外置零，分别逆 FFT；在同一空域位置逐点共轭相乘，扫出乘积图，再正 FFT、归一化，让结果归位到同一评分图。', 'fftCorrelation', '图中 u、v 是固定预处理频谱的逆变换，仍为复数场。分数的能量与有效点数也用 FFT 批量计算，保持和逐格扫描相同的色标与结果。', 44000],
    ['refine', '细化位移', '整数峰只给出初值，波矢也可落在频率格之间。', '接住上一幕的整数峰，放大其周围 ±0.5 个 DFT 格。用空域相位斜坡计算小数位移处的频谱，再做三轮 5×5 局部搜索，最终搜索步长为 0.01 格；锁定后回到同一对完整频谱。', 'gridLimit', '教学实现采用三轮 5×5（步长 0.25 → 0.05 → 0.01 格）；原版 fairSIM fitPeak 采用三轮 10×10（半宽 2.5 → 0.5 → 0.1 格）。搜索步长不是测量精度。位置锁定后进入共同幅相估计。', 68000],
    ['least-squares-fit', '共同幅相拟合', '位置对齐并除 H 后，所有公共点共享同一个复系数。', '固定波矢与可靠公共区，沿用 P、Q、R 的实际复数值。先解释同一次旋转和伸缩，再用全部可靠点拟合共同系数，并读出相位与调制度。', 'readParameters', '三相相对步进已知且准确；理想对齐、无噪声时 V=αU，实际拟合保留残差。相位斜坡用于小数频移，共同相位用于复数值旋转。', 64000],
  ];
  const scenes = definitions.map(([id, label, title, copy, formula, note, duration], i) => ({ id, label, title, copy, equation: formulas[formula], note, duration,
    chapter: i < 7 ? '① 找位置 / 频率坐标' : '② 求幅相 / 复数值', phase: i < 7 ? 'position' : 'coefficient' }));
  const index = id => scenes.findIndex(s => s.id === id);
  const scene = id => { const s = scenes[index(id)]; if (!s) throw new Error('未知参数场景：' + id); return s; };
  function stateForScene(id, progress = 1) {
    if (!Number.isFinite(progress)) throw new Error('场景进度必须是有限数值。');
    const s = scene(id), p = clamp(progress), step = index(id);
    return { id, step, progress: p, position: step + p, phase: s.phase,
      otfMultiply: id === 'otf' ? otfState(p).multiply : step > index('otf') ? 1 : 0,
      correction: id === 'otf' ? otfState(p).cancel : step > index('otf') ? 1 : 0,
      rotation: id === 'least-squares-fit' ? ramp(p, .25, .43) : 0,
      scaling: id === 'least-squares-fit' ? ramp(p, .43, .60) : 0 };
  }
  function reasoningAt(s) {
    const p = Math.round(s.progress*1e12)/1e12;
    const stages = s.id === 'match' ? [
      [.12, 'prepare', 'correct', '接住已校正的 U、V；接下来每试一个候选，就累计一次公共区。'],
      [.82, 'scan', 'match', '游标选 k′ → 扫过该候选的可靠公共点 → 共轭乘加 → 取模、能量归一 → 分数落入对应格。'],
      [1.01, 'cost', 'cost', 'N 是每轴格数。若 N×N 个位移各遍历 N×N 个频点，直接全扫为 O(N⁴)；本例只画限定范围，计数是工作量示意，不是实测耗时。'],
    ] : s.id === 'coarse' ? [
      [.12, 'hold', 'cost', '上一幕的图先整体变暗，保留计算背景；接下来展开两张固定预处理频谱。'],
      [.26, 'fixed', 'fixed', '先在各自检测坐标内固定预处理：可靠区除自身 H，圈外置零。下标 p 表示预处理；M 是掩膜，H=0 处直接置零，不执行除法。'],
      [.46, 'inverse', 'inverse', '同一对频谱变为空域复数场 u、v；不是重新拍摄，也不是最终样品图像。'],
      [.71, 'multiply', 'spatialProduct', '三个光标同步扫过同一空域坐标：把 u 取共轭后乘 v，逐点写出乘积图。一次遍历，不再对每个 k′ 重复平移。'],
      [.96, 'forward', 'fftCorrelation', '乘积图原位做正 FFT，得到所有 k′ 的乘积和；完成能量归一化后，整张结果图移回原评分坐标。N² 来自逆变换的归一化。'],
      [1.01, 'peak', 'fftCost', '常数次二维 FFT 把完整扫描降为 O(N² log N)。同一张分数图重新亮起，再框住整数峰，交给下一幕局部细化。'],
    ] : s.id === 'refine' ? [
      [.22, 'gridLimit', 'gridLimit', '放大整数峰附近的一格。背景来自本组观测的实际局部分数采样，标记来自局部拟合；本组峰可恰在整数点，不预设格间真值。这里的亚像素指小数 DFT 频率格，不是样品空间像素。'],
      [.56, 'phaseRamp', 'subpixel', '先逆 FFT，乘单位模的线性相位斜坡，再正 FFT；按离散傅里叶模型计算非整数频率值，不做频域像素插值。仅在两边 H 可靠的公共区各除自身 H，再算归一化相关分数。单位模乘法可逆且保持复场能量；它不会增加观测信息。'],
      [.935, 'zoomCascade', 'local', scene('refine').note],
      [1.01, 'returnSpectrum', 'lockedAddresses', '0.01 格的搜索已完成，k̂ 保持锁定。恢复同一对完整频谱、对应 OTF 与可靠公共点；两圆中心保持频带归位后的间距，公共点已按同一 q 对齐。下一步保持这些频率位置，比较公共点的复数值。'],
    ] : null;
    if (!stages) return null;
    const [, key, formula, note] = stages.find(row => p < row[0]);
    return { key: s.id + '-' + key, equation: formulas[formula], note:s.id==='refine'&&key==='phaseRamp'?refinementPhaseState(p).note:note };
  }
  function formulaAt(s) {
    const data = scene(s.id), p = s.progress;
    if (s.id === 'shared') return { equation: p < .18 ? formulas.point : p < .50 ? formulas.derive : p < .78 ? formulas.candidatePoint : p < .94 ? formulas.common : formulas.region,
      note: p < .18 ? '固定一个样品频率 q：0 级取 f=q，旁带取 f=q+k。' + M.notation.tilde + M.notation.band
        : p < .39 ? '下方 −k 移到等号右侧成为 +k；上方寻址光标同步沿 +k 找到旁带中的 f=q+k。k 的数值将在后面估计。'
        : p < .54 ? '先让两幅图共用检测坐标原点；这是画面叠放，尚未做频移。接下来用 k′ 表示尝试搬回的位移。'
        : p < .68 ? '真实记录在 q+k；移动 −k′ 后还剩位置误差 k−k′。这两个量不相等时不能抵消，频点携带的复数值保持不变。'
        : p < .78 ? '这里只示意 k′=k 时的对齐：残差为零，两个标记重合。k 仍未知，后面要比较候选，求得 k̂。'
        : p < .94 ? '此处示意 k′=k。虚线轮廓是两边 OTF 非零的几何交集；边缘虽有传递，仍可能太弱，比较时仍需筛掉弱传递点。' : data.note };
    if (s.id === 'line-shift') return { equation: M.teachingEquations[lineState(p).real.best === 1 ? 'peak' : 'real'], note: data.note };
    if (s.id === 'shift' && p < .40) return { equation: p < .15 ? M.teachingEquations.peak : formulas.coordinates,
      note: p < .15 ? '保留一维例子的终点：位移 2、乘积和 21。它只说明如何比较；接下来回到原图。' : 'q 是参考频率，k′ 是候选位移，两者都有横纵分量。0 级取 q，旁带按候选取 q+k′；真实 k 仍未知，图中仅示意 k′=k。' };
    if (s.id === 'shift' && p < .68) return { equation: formulas.source, note: '两幅图采用同一个检测频率原点。相同 f 处分别包含 S(f) 与 S(f−k)，此时还没有归位。' };
    if (s.id === 'otf') {
      const mode = otfState(p).formula;
      const notes = {
        region: '只在两边 |H| 都达到阈值的公共点上校正。H=0 不能相除；H 太小会放大噪声。本幕用 k′=k 示意，搜索时重新筛选。',
        otfSymbols: '省略频率自变量：上行用 H₀*=H*(q)，下行用 H₁*=H*(q+k′)。星号表示复共轭，两行都保留自己的 H。',
        otfMultiply: '一般恒等式 H*H=|H|²。只乘共轭后，原来的 OTF 相位被抵消，但幅度上还留有 |H|²；旁带的未知照明系数 α 保持不动。',
        otfNormalize: '等式两边同除以各自的 |H|²；右侧分子分母相同，约去后为 1。两步合起来就是除以 H，对一般非零复数 H 也成立。',
        correct: 'U=S；候选旁带 Vₖ′=m·exp(iφΔ)S(q−k+k′)，只有 k′=k 时样品频率相同。下一幕逐候选累计匹配分数。',
      };
      return { equation: formulas[mode], note: notes[mode] };
    }
    const reasoning = reasoningAt(s);
    if (reasoning) return { equation: reasoning.equation, note: reasoning.note };
    if (s.id === 'least-squares-fit') {
      const narrative = leastSquaresNarrative(p);
      return { equation: formulas[narrative.mode], note: narrative.note };
    }
    return { equation: data.equation, note: data.note };
  }
  function sharedState(progress) {
    const p = clamp(progress);
    const separate = ramp(p, .80, .90), arrange = ramp(p, .39, .49), relocate = ramp(p, .54, .68);
    return { pin: ramp(p, .04, .10), derive: ramp(p, .18, .30), found: ramp(p, .30, .36),
      arrange, relocate, cancel: ramp(p, .68, .70), separate,
      overlap: arrange * (1 - separate), region: ramp(p, .70, .77), outline: ramp(p, .90, .94), reliable: ramp(p, .94, .98),
      points: [ramp(p, .04, .10), ramp(p, .93, .97), ramp(p, .96, 1)], names: ramp(p, .90, .94) };
  }
  // Separating presentation placement from physical frequency relocation
  // makes every coordinate auditable without measuring rendered geometry.
  function sharedPointState(lesson, progress) {
    const s = sharedState(progress), q = dataFor(lesson).selected[0].q, e = lesson.estimate;
    const unit = 218 / 27, zero = [900, 375], home = [480, 375];
    const relocation = s.relocate * (1 - s.separate);
    const side = [home[0] + (zero[0] - home[0]) * s.overlap - e.kx * unit * relocation,
      home[1] - e.ky * unit * relocation];
    const detector = [q[0] + e.kx, q[1] + e.ky];
    // This prescribed path illustrates the alignment condition; the actual
    // data-driven candidate search remains in the later match/coarse scenes.
    const candidateK = [e.kx * s.relocate, e.ky * s.relocate];
    const residual = [e.kx - candidateK[0], e.ky - candidateK[1]];
    return { ...s, q, k: [e.kx, e.ky], unit, centers: [zero, side],
      candidateK, residual, relocatedPoint: detector.map((v, axis) => v - candidateK[axis]),
      detector: [q, detector],
      markerPositions: [zero.map((v, axis) => v + q[axis] * unit), side.map((v, axis) => v + detector[axis] * unit)],
      cursor: [q[0] + e.kx * s.derive, q[1] + e.ky * s.derive],
      displacement: [-e.kx * relocation, -e.ky * relocation] };
  }
  function lineState(progress) {
    return { real: M.realCorrelationState(clamp((progress - .20) / .80)) };
  }
  function returnTo2DState(progress) {
    const p = clamp(progress);
    return { teaching: 1 - ramp(p, 0, .15), actual: ramp(p, .12, .27), arrange: ramp(p, .40, .62), relocate: ramp(p, .68, .94) };
  }
  function otfState(progress) {
    const p = clamp(progress);
    // Each row uses its own conjugate. Normalization follows the completed
    // product H*H=|H|², and U/V are named only after cancellation.
    return { warning: ramp(p, .02, .10), discard: ramp(p, .10, .37), detail: ramp(p, .40, .46),
      multiply: ramp(p, .48, .58), power: ramp(p, .60, .67), divide: ramp(p, .70, .77),
      cancel: ramp(p, .79, .85), name: ramp(p, .87, .93), relation: ramp(p, .94, .98),
      formula: p < .4 ? 'region' : p < .48 ? 'otfSymbols' : p < .70 ? 'otfMultiply' : p < .87 ? 'otfNormalize' : 'correct' };
  }
  function rejectionProgress(progress, rank) {
    // The weakest samples leave first. Shrinking a selection cell does not
    // move its frequency coordinate or alter the observed spectrum.
    return ramp(progress, .10 + .12 * clamp(rank), .25 + .12 * clamp(rank));
  }
  function formulaMode(s) {
    const p = s.progress;
    if (s.id === 'least-squares-fit') return s.id + '-' + leastSquaresNarrative(p).mode;
    const reasoning = reasoningAt(s);
    if (reasoning) return reasoning.key;
    return s.id + (s.id === 'shared' ? p < .78 ? '-derive' : p < .94 ? '-common' : '-reliable'
      : s.id === 'otf' ? '-' + otfState(p).formula
      : s.id === 'line-shift' ? lineState(p).real.best === 1 ? '-peak' : '-sum'
      : s.id === 'shift' ? p < .15 ? '-line-end' : p < .40 ? '-coordinates' : p < .68 ? '-detector' : '' : '');
  }
  const cache = new WeakMap();
  function dataFor(lesson) {
    if (cache.has(lesson)) return cache.get(lesson);
    const e = lesson.estimate, candidates = new Map();
    function compare(kx, ky) {
      const key = kx + ',' + ky;
      if (!candidates.has(key)) candidates.set(key, E.compare(e.context, kx, ky, true));
      return candidates.get(key);
    }
    const best = compare(e.kx, e.ky), coarse = e.coarseBest;
    // Include the whole geometric overlap, including both kinds of rejected
    // sample: weak zero-order H and weak shifted sideband H.
    const support = { all: [], reliable: [], rejected: [] }, { cutoff, minH } = e.context.config;
    for (let y = -Math.ceil(cutoff); y <= cutoff; y++) for (let x = -Math.ceil(cutoff); x <= cutoff; x++) {
      const h0 = A.otf(x, y, cutoff), h1 = A.otf(x + e.kx, y + e.ky, cutoff);
      if (h0 <= 0 || h1 <= 0) continue;
      const point = { q: [x, y], h0, h1, reliable: h0 >= minH && h1 >= minH };
      support.all.push(point); support[point.reliable ? 'reliable' : 'rejected'].push(point);
    }
    support.rejected.sort((a, b) => Math.min(a.h0, a.h1) - Math.min(b.h0, b.h1));
    const alternatives = [[coarse.kx - 1, coarse.ky + 1], [coarse.kx, coarse.ky + 1], [coarse.kx - 1, coarse.ky], [coarse.kx + 1, coarse.ky]]
      .map(k => compare(...k)).filter(c => c.valid);
    const examples = [...alternatives.slice(0, 2), best];
    while (examples.length < 3) examples.unshift(best);
    let pool = best.points.filter(p => examples.every(c => c.points.some(t => t.q.join(',') === p.q.join(','))) && p.energy > 1e-12);
    if (pool.length < 3) pool = best.points.filter(p => p.energy > 1e-12);
    // Prefer strong, non-real coefficients and spread the selected frequencies.
    pool.sort((a, b) => Math.abs(b.x.im) - Math.abs(a.x.im) || b.energy - a.energy);
    const selected = [];
    for (const p of pool) if (selected.every(t => Math.hypot(p.q[0] - t.q[0], p.q[1] - t.q[1]) >= 2)) { selected.push(p); if (selected.length === 3) break; }
    for (const p of pool) if (selected.length < 3 && !selected.includes(p)) selected.push(p);
    const sums = [{ re: 0, im: 0, energy: 0 }];
    best.points.forEach(p => { const a = sums[sums.length - 1]; sums.push({ re: a.re + p.cross.re, im: a.im + p.cross.im, energy: a.energy + p.energy }); });
    const result = { compare, examples, selected, best, support, sums, valid: e.coarse.filter(c => c.valid), rounds: e.rounds };
    cache.set(lesson, result); return result;
  }
  function matchingState(lesson, id, progress) {
    const p=Math.round(clamp(progress)*1e12)/1e12,data=dataFor(lesson);
    const initial=data.examples.filter((c,i,a)=>a.findIndex(t=>t.kx===c.kx&&t.ky===c.ky)===i);
    const remaining=data.valid.filter(c=>!initial.some(t=>t.kx===c.kx&&t.ky===c.ky));
    if(id==='coarse' || p>=.82)return {candidate:lesson.estimate.coarseBest,committed:data.valid,local:1,done:true};
    if(p<.12)return {candidate:data.best,committed:[],local:0,done:false};
    const slow=p<.48, pool=slow?initial:remaining;
    const travel=Math.round((slow?(p-.12)/.36:(p-.48)/.34)*pool.length*1e10)/1e10;
    const i=Math.min(pool.length-1,Math.floor(travel)),local=travel-i;
    const committed=(slow?[]:initial).concat(pool.slice(0,i+(local>=.94?1:0)));
    return {candidate:pool[i],committed,local,done:false};
  }
  function scanState(lesson,progress) {
    const state=matchingState(lesson,'match',progress),data=dataFor(lesson);
    const candidate=data.compare(state.candidate.kx,state.candidate.ky);
    const count=state.done?candidate.count:Math.floor(ramp(state.local,.10,.70)*candidate.count);
    const sum=candidate.points.slice(0,count).reduce((a,p)=>({re:a.re+p.cross.re,im:a.im+p.cross.im}),{re:0,im:0});
    return {...state,candidate,count,sum,transfer:state.done?1:ramp(state.local,.74,.93),
      cost:ramp(progress,.84,.92),total:data.valid.length,
      operations:state.committed.reduce((n,c)=>n+c.count,0)+(state.committed.some(c=>c.kx===candidate.kx&&c.ky===candidate.ky)?0:count)};
  }
  function fftState(progress) {
    const p=clamp(progress);
    return {dim:ramp(p,.04,.10),gather:ramp(p,.12,.24),inverse:ramp(p,.28,.42),
      multiply:ramp(p,.48,.68),forward:ramp(p,.72,.80),normalize:ramp(p,.81,.85),
      dock:ramp(p,.86,.94),reveal:ramp(p,.94,.96),peak:ramp(p,.97,.995),
      mode:p<.12?'hold':p<.26?'fixed':p<.46?'inverse':p<.71?'multiply':p<.96?'forward':'peak'};
  }
  function refinementNarrative(progress) {
    const p=Math.round(clamp(progress)*1e12)/1e12, mode=p<.22?'gridLimit':p<.56?'phaseRamp':p<.935?'zoomCascade':'returnSpectrum';
    const copy={
      gridLimit:{title:'整数峰只给出初值，波矢也可落在频率格之间。',copy:'粗定位只比较整数 DFT 频率格。放大整数峰周围 ±0.5 格，检查格间候选；局部拟合峰的位置来自当前观测，不预设它一定偏离整数中心。'},
      phaseRamp:{title:'空域乘线性相位斜坡，在频域计算小数格平移。',copy:'旁带先逆 FFT 回空域，乘候选 k′ 对应的线性相位斜坡，再正 FFT。读取小数位移处的复数频谱，与同移的 OTF 一起筛选可靠公共区，计算归一化分数 ρ(k′)。'},
      zoomCascade:{title:'三轮 5×5 局部细化，最终搜索步长为 0.01 格。',copy:'每轮选最高分点作为下一轮中心，把搜索范围缩小 5 倍。半宽 ±0.50 → ±0.10 → ±0.02 格，步长 0.25 → 0.05 → 0.01 格；锁定的波矢继续用于重建。'},
      returnSpectrum:{title:'位置已锁定，回到两张完整频谱。',copy:'收起最终 0.01 格的局部搜索图，展开原来的 0 级与 +1 级频谱、OTF 和可靠公共区。旁带已按 −k̂ 归位；接着保持这些位置，比较公共点的相位与长度。'},
    };
    return {mode,...copy[mode]};
  }
  function refinementPhaseState(progress) {
    const p=Math.round(clamp(progress)*1e12)/1e12;
    const step=p<.28?'inverse':p<.30?'factor':p<.36?'multiply':p<.40?'forward':'score';
    const notes={
      inverse:'① 对照上方左图：先将未平移临时 +1 级逆 FFT，得到空域复场 a。橙点 r₀ 是接下来演示的一个实际像素。',
      factor:'② 固定同一个像素 r₀，读出单位模因子 exp(iθ₀)。θ₀ 随空间位置变化；相位斜坡不是给所有像素加同一个角度。',
      multiply:'③ 下方青色箭头是 a(r₀)，紫色箭头是乘积 b(r₀)。乘 exp(iθ₀) 只把角度加 θ₀，长度保持不变；箭头长度采用统一归一显示。',
      forward:'④ 每个像素都完成相同的逐点乘法后，对整张 b 做正 FFT，得到右侧小数位移处的频谱 B；不是只变换橙色单点。',
      score:'⑤ 仅在两边 H 可靠的公共区各除自身 H，再按两边能量归一化得到 ρ。通带外的傅里叶尾迹仅在显示中隐藏，评分数据不变。',
    };
    return {step,note:notes[step],inverse:ramp(p,.22,.28),factor:ramp(p,.28,.30),multiply:ramp(p,.30,.36),forward:ramp(p,.36,.40)};
  }
  function refinementState(lesson, progress) {
    const p=Math.round(clamp(progress)*1e12)/1e12,data=dataFor(lesson),round=p<.70?0:p<.85?1:2;
    const r=data.rounds[round],start=[.43,.735,.875][round],end=[.54,.825,.915][round];
    const local=ramp(p,start,end),count=Math.min(25,Math.floor((local+1e-12)*25));
    let candidate=count===25?r.best:count===0?(round?data.rounds[round-1].best:lesson.estimate.coarseBest):r.candidates[count-1];
    // A short actual fractional sweep makes the phase-to-frequency link
    // visible before scoring the 25 fixed candidates. Quantize the display
    // path at .01 bins to bound cached fields; no visual image interpolation.
    if(round===0&&p>=.40&&count===0) {
      const start=lesson.estimate.coarseBest,target=r.candidates[0],travel=ramp(p,.40,.43);
      candidate=data.compare(start.kx+Math.round((target.kx-start.kx)*travel*100)/100,
        start.ky+Math.round((target.ky-start.ky)*travel*100)/100);
    }
    const returnView={collapse:ramp(p,.935,.975),overview:ramp(p,.947,.985),values:ramp(p,.978,1)};
    return {...refinementNarrative(p),phaseDemo:refinementPhaseState(p),returnView,round,local,count,step:r.step,halfWidth:2*r.step,candidates:r.candidates,center:r.center,best:r.best,
      done:p>=.915,candidate,zoom:ramp(p,.025,.16),work:ramp(p,.20,.25),cascade:ramp(p,.56,.64),
      roundZoom:round?ramp(p,round===1?.70:.85,round===1?.735:.875):1,
      winner:ramp(p,end,end+.015),nextWindow:round<2?ramp(p,round===0?.64:.83,round===0?.69:.85):0,lock:ramp(p,.915,.93)};
  }
  const refinementCache=new WeakMap();
  function refinementDataFor(lesson) {
    if(refinementCache.has(lesson))return refinementCache.get(lesson);
    const e=lesson.estimate,n=e.context.config.n,raw=e.context.separated.bands[1],spatial=A.spatial(raw,n),fields=new Map();
    let surface;
    const result={n,raw,spatial,fields,
      probe(kx,ky) {
        const x=Math.min(n-1,Math.floor(n/2)+Math.max(1,Math.floor(n/32))),y=Math.floor(n/2),i=y*n+x;
        const a={re:spatial.re[i],im:spatial.im[i]},theta=-2*Math.PI*(kx*x+ky*y)/n,unit={re:Math.cos(theta),im:Math.sin(theta)};
        return {x,y,a,theta,angle:Math.atan2(unit.im,unit.re),unit,b:{re:a.re*unit.re-a.im*unit.im,im:a.re*unit.im+a.im*unit.re}};
      },
      at(kx,ky) {
        const key=kx+','+ky;
        if(!fields.has(key)) {
          const modulated={re:new Float64Array(n*n),im:new Float64Array(n*n)};
          for(let y=0;y<n;y++)for(let x=0;x<n;x++) {
            const i=y*n+x,phase=-2*Math.PI*(kx*x+ky*y)/n,c=Math.cos(phase),s=Math.sin(phase);
            modulated.re[i]=spatial.re[i]*c-spatial.im[i]*s;
            modulated.im[i]=spatial.re[i]*s+spatial.im[i]*c;
          }
          fields.set(key,{kx,ky,modulated,shifted:A.spectrum(modulated.re,n,modulated.im),comparison:dataFor(lesson).compare(kx,ky)});
        }
        return fields.get(key);
      },
      surface() {
        if(!surface) {
          const side=21,halfWidth=.5,points=[];
          for(let y=0;y<side;y++)for(let x=0;x<side;x++) {
            const kx=e.coarseBest.kx+(2*x/(side-1)-1)*halfWidth,ky=e.coarseBest.ky+(2*y/(side-1)-1)*halfWidth;
            points.push(E.compare(e.context,kx,ky));
          }
          const scores=points.filter(p=>p.valid).map(p=>p.score);
          surface={side,halfWidth,points,minimum:Math.min(...scores),maximum:Math.max(...scores)};
        }
        return surface;
      }};
    refinementCache.set(lesson,result);return result;
  }
  // Geometric exploration does not run the estimator: it moves only copies
  // of U. The measured targets, q addresses, fit and raw frames stay fixed.
  function leastSquaresNarrative(progress) {
    const p = Math.round(clamp(progress) * 1e12) / 1e12;
    const mode = p < .25 ? 'relationModel' : p < .60 ? 'complexPlaneTransform' : p < .85 ? 'leastSquaresFit' : 'readParameters';
    const copy = {
      relationModel: ['位置对齐并除 H 后，所有公共点共享同一个复系数。', '每个点有自己的样品相位和长度；对应的 Uⱼ、Vⱼ 却应有相同的角度差与长度比。P、Q、R 仍是刚才公共区里的实际频点。', '理想对齐、无噪声时 Vⱼ=αUⱼ；使用估计波矢与带噪观测时近似成立。两边各除自己的 H，且仅使用可靠公共区。'],
      complexPlaneTransform: ['在复平面上，共同相位是旋转，调制度是伸缩。', p < .43 ? '橙色副本先试探共同角度，再回到拟合方向。三个副本同步转动，长度保持不变；青色参考与紫色观测始终固定。' : '方向对齐后，三个副本同步乘同一个长度比例。白色虚线连接预测与观测，表示残差；有噪声时它不一定消失。', '试探仅演示复数乘法，数值解由后面的闭式拟合给出。主线相位接近 0，不把演示角度当成实测相位。频率坐标 q 与锁定波矢均不变。'],
      leastSquaresFit: ['用全部可靠公共点做复数最小二乘，一次算出 m̂ 与 φ̂Δ。', '将 P、Q、R 扩展到完整公共区。所有点共用一个 α；累计 C=ΣU*V 与参考能量 Eᵤ，再相除。最小化的是全部残差的平方和。', 'U*V 消去各点自身的样品相位。配平方得 J(α)=Eᵤ|α−C/Eᵤ|²+Eᵥ−|C|²/Eᵤ，因此 α̂=C/Eᵤ；用相同公共区和权重时，J(α̂)/Eᵥ=1−ρ²。'],
      readParameters: ['取模长得到调制度 m̂，取相角得到共同相位偏移 φ̂Δ。', '临时分离的 2/3 已补偿余弦展开的 1/2，所以 |α̂| 直接给出 m̂。加上已知相对相移，得到各帧相位，再将估计值填回解混矩阵。', '第 18 步的相位斜坡随像素位置变化，用于小数频移；这里的共同相位对所有公共频点相同。采用等间隔三相模型，下面填回正式解混权重。'],
    }[mode];
    return { mode, title: copy[0], copy: copy[1], note: copy[2] };
  }
  function leastSquaresState(lesson, progress) {
    const p = Math.round(clamp(progress) * 1e12) / 1e12, e = lesson.estimate;
    const trialAngle = e.phase + .65;
    const phase = p < .32 ? trialAngle * ramp(p, .25, .32)
      : trialAngle + (e.phase - trialAngle) * ramp(p, .32, .43);
    const m = 1 + (e.m - 1) * ramp(p, .43, .60);
    const alpha = { re: m * Math.cos(phase), im: m * Math.sin(phase) };
    const best = dataFor(lesson).best;
    // Sum the actual residuals (stable near a perfect fit), not E_V-|C|²/E_U.
    const loss = z => best.points.reduce((sum, point) => {
      const re = point.y.re - (z.re * point.x.re - z.im * point.x.im);
      const im = point.y.im - (z.re * point.x.im + z.im * point.x.re);
      return sum + re * re + im * im;
    }, 0);
    return { ...leastSquaresNarrative(p), progress: p, phase, m, alpha,
      trial: p >= .25 && p < .43, gather: ramp(p, .02, .14), merge: ramp(p, .25, .29),
      prediction: ramp(p, .25, .27), cloud: ramp(p, .60, .66),
      count: Math.min(best.count, Math.floor((ramp(p, .64, .75) + 1e-12) * best.count)),
      divide: ramp(p, .76, .82), read: ramp(p, .85, .91), cards: ramp(p, .91, .97),
      residual: loss(alpha), minimum: loss(best.alpha), energy: best.yy,
      k: [e.kx, e.ky] };
  }
  const api = { scenes, scene, index, formulas, bandColors, stateForScene, formulaAt, formulaMode, sharedState, sharedPointState, lineState, returnTo2DState, otfState, rejectionProgress, dataFor, matchingState, scanState, fftState, refinementNarrative, refinementPhaseState, refinementState, refinementDataFor, leastSquaresNarrative, leastSquaresState };
  if (node) module.exports = api; else root.SIMParameterLesson = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
