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
    // Final getPeak is a separate source-faithful pass over fresh band copies.
    // It deliberately does not reuse the location search's corrected pairs.
    finalPrepare: String.raw`$$\bigl(\widetilde A_0,\widetilde A_{+1}\bigr)\xrightarrow[\text{最终位移 }\widehat{\mathbf k}]{\text{复制、筛选与校正}}\bigl(B_0,B_1\bigr)$$`,
    finalInverse: pairFormula(String.raw`u=\mathcal F_N^{-1}\{B_0\}`, String.raw`v=\mathcal F_N^{-1}\{B_1\}`),
    finalShift: String.raw`$$v_{\widehat{\mathbf k}}(\mathbf r)=v(\mathbf r)\,{\color{#efb879}e^{-2\pi i\widehat{\mathbf k}\cdot\mathbf r/N}}$$`,
    finalProduct: String.raw`$$ {\color{#efb879}z(\mathbf r)}={\color{#7ad5cd}u^*(\mathbf r)}\,{\color{#b7a5eb}v_{\widehat{\mathbf k}}(\mathbf r)},\qquad {\color{#7ad5cd}e(\mathbf r)}=|u(\mathbf r)|^2$$`,
    finalSum: String.raw`$$ {\color{#efb879}C}=\sum_{\mathbf r}z(\mathbf r),\qquad {\color{#7ad5cd}E_0}=\sum_{\mathbf r}e(\mathbf r),\qquad \mathbf r\in\{0,\ldots,N-1\}^2$$`,
    finalDivide: String.raw`$$\widehat\alpha=\frac{{\color{#efb879}C}}{{\color{#7ad5cd}E_0}}$$`,
    finalRead: String.raw`$$ {\color{#efb879}\widehat m}=|\widehat\alpha|,\qquad {\color{#b7a5eb}\widehat\phi_\Delta}=\arg\widehat\alpha,\qquad \widehat\phi_j=\phi'_j+\widehat\phi_\Delta$$`,
    // Optional theory only; never a trial-solving trajectory in scene 19.
    fit: String.raw`$$J(\alpha)=E_0\left|\alpha-\frac C{E_0}\right|^2+E_1-\frac{|C|^2}{E_0}$$`,

  };
  const definitions = [
    ['shared', '找公共区', '同一样品频率，在两个级次中记录在哪里？', '0 级在检测坐标 f=q 记录 S(q)，+1 级在 f=q+k 记录同一分量。真实 k 尚未知；试用 k′ 时，比较 Ã₀(q) 与 Ã₊₁(q+k′)，并只保留两处 OTF 都达到阈值的频点。', 'region', 'k 是真实未知波矢，k′ 是候选，k̂ 是估计值。画面用 k′=k 演示正确对应，不能由单个点的示意确定 k；后面会用公共区内多个频点的复数匹配搜索。OTF 阈值只筛选可比较的通带，还须检查有效点数与信号能量。', 28000],
    ['line-shift', '沿一行对齐', '沿一行移动，找出对齐的位置。', '一维示例中，同一组 1、4、2 在两份记录里相差两格。不同位移下，将对应格的数值相乘再求和；三项对齐时，乘积和达到峰值。', 'real', '教学值不替代原图三个点的读数。这里 H=1、m=1、共同相位为 0；范围外补零。原始乘积和用于讲运算，实际搜索还会做能量归一化。', 26000],
    ['shift', '回到二维', '回到二维，横纵一起对齐。', '每个频率有横纵两个坐标。用候选位移 −k′ 搬回旁带时，频谱与 OTF 一起换坐标，在 q+k′ 处取值。只有 k′=k 时，两边才对应同一样品频率。', 'shift', '逐点比较从一行扩展到整个二维公共区。教学位移 2 不带入原图。移回后旁带取值对应 H(q+k′) 与 S(q+k′−k)；画面仅示意 k′=k，真实 k 仍待后续搜索。', 16000],
    ['otf', '共轭与归一', '先乘自己的 H*，再除以 |H|²。', '将可靠公共区内的 OTF 校正拆开看：先乘自身 H*，再除以 |H|²。这两步合成一次除以自身 H，校正后的值记为 U、V。', 'correct', 'fairSIM 的 commonRegion 在可靠区域直接除以各自 H；动画将同一次除法展开为乘 H*、除 |H|²。只乘 H* 仍有 |H|²；两步完成后才得到校正值。', 32000],
    ['match', '逐格填分数', '试一个位移，算一个分数，填一个格。', '保持 0 级固定。每换一个 k′，就在公共区逐点共轭相乘、累计，再把分数送入右侧对应格。先看清几次计算，再加速填满候选图。', 'match', '主线只保留乘加与填图。匹配分数取乘积和的模并做能量归一化；越亮表示匹配越强，深色格未纳入搜索。', 36000],
    ['coarse', 'FFT 一次成图', '换到空域，只乘一次，算出整张图。', '原有元素先变暗。两个未平移频带各自校正、圈外置零，分别逆 FFT；在同一空域位置逐点共轭相乘，扫出乘积图，再正 FFT、归一化，让结果归位到同一评分图。', 'fftCorrelation', '图中 u、v 是固定预处理频谱的逆变换，仍为复数场。分数的能量与有效点数也用 FFT 批量计算，保持和逐格扫描相同的色标与结果。', 44000],
    ['refine', '细化位移', '整数峰只给出初值，波矢也可落在频率格之间。', '接住上一幕的整数峰，放大其周围 ±0.5 个 DFT 格。用空域相位斜坡计算小数位移处的频谱，再做三轮 5×5 局部搜索，最终搜索步长为 0.01 格；锁定后回到同一对完整频谱。', 'gridLimit', '教学实现采用三轮 5×5（步长 0.25 → 0.05 → 0.01 格）；原版 fairSIM fitPeak 采用三轮 10×10（半宽 2.5 → 0.5 → 0.1 格）。搜索步长不是测量精度。位置锁定后进入共同幅相估计。', 68000],
    ['least-squares-fit', '共同幅相估计', '按最终位移，准备两份幅相计算工作频带。', '从原始临时频带复制数据，在最终位移下筛选并做一次自身 OTF 校正；随后按 fairSIM 的 getPeak 顺序计算共同复系数。', 'finalPrepare', '本幕遵循本地 fairSIM 的最终 commonRegion/getPeak 路径；前面的评分和 5×5 搜索仍是教学实现。三相相对步进已知且准确。', 80000],
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
      rotation: 0, scaling: 0 };
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
        otfNormalize: 'H*/|H|²=1/H（H≠0）。两步合成同一次 OTF 校正；fairSIM 对保留频点直接执行这次除法。H=0 或太弱的点先排除。',
        correct: 'OTF 校正后的值命名为 U、Vₖ′。无噪声时 U=S；只有 k′=k 时，两边才对应同一样品频率。后续用这些校正值比较候选并拟合幅相。',
      };
      return { equation: formulas[mode], note: notes[mode] };
    }
    const reasoning = reasoningAt(s);
    if (reasoning) return { equation: reasoning.equation, note: reasoning.note };
    if (s.id === 'least-squares-fit') {
      const narrative = leastSquaresNarrative(p);
      return { equation: p < .07 ? formulas.lockedAddresses : formulas[narrative.mode], note: narrative.note };
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
    if (s.id === 'least-squares-fit') return s.id + '-' + (p < .07 ? 'handoff' : leastSquaresNarrative(p).mode);
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
  // Names retain the old scene API for the 33/13-stop host timelines.
  // Every value below comes from finalPeak, independently of the search pairs.
  const getPeakBeats = Object.freeze([
    ['finalPrepare', 0, .12, '准备工作副本', '按最终位移，准备两份幅相计算工作频带。',
      '先收起位置搜索的概览。从未校正的临时频带复制数据，按锁定波矢准备 B₀、B₁；两张图仍各用自己的检测频率坐标。',
      'M₀、M₁ 按最终位移筛选两路可靠 OTF，并执行源码的径向排除；保留处各除自身 H，其他位置置零。这是从原始临时频带开始的新工作副本，不是把前面的 U、V 再除一次 H。',
      '最终工作副本 · 原生检测坐标 · 一次自身 OTF 校正'],
    ['finalInverse', .12, .28, '两路逆 FFT', '分别逆 FFT，得到两张空域复数计算场。',
      'B₀、B₁ 在各自原位执行逆 FFT，变成 u、v。亮度显示模长，颜色显示复数相位；计算保留全部实部和虚部。',
      'F⁻¹ 把每一路完整 N×N 工作频谱变为空域数组。u、v 是用于幅相计算的复数场，不是新的曝光，也不是最终重建的样品强度图。',
      '两路各自逆 FFT · 数组仍为复数'],
    ['finalShift', .28, .42, '空间位移斜坡', '旁带乘空间相位斜坡，落实已锁定的位移。',
      'u 保持不变。先用一个实际位置的箭头解释单位模指数；这个位置的旋转演示完成后，再按行处理整张 v，逐点形成 vₖ。',
      '指数的相角随 r 线性变化，模长恒为 1。本页 y 向下、正变换用负指数，因此使用 −2π k̂·r/N；它实现已知频移，还没有读取共同照明相位。',
      'k̂ 已固定 · 单位模乘法改变相角，不改变该像素模长'],
    ['finalProduct', .42, .58, '同点共轭相乘', '取同一个空域位置，同时算乘积与参考能量。',
      '两个光标指向同一个实际 r。u 取共轭后乘 vₖ 得到 z；同一位置的 |u|² 得到 e。它们分别送往分子与分母。',
      'u* 只把虚部变号。z=u*vₖ 保留两路的相对复数关系；e=|u|² 是非负参考能量。动画箭头与读数直接来自当前空域数组，没有试探角度。',
      '相同 r · 橙色 z 进入分子 · 青色 e 进入分母'],
    ['finalSum', .58, .80, '全场双路累计', '扫过全部 N² 个位置，分别累计 C 与 E₀。',
      '先慢看第一个像素的贡献，再按行遍历整张空域网格。复数乘积进入 C，参考能量进入 E₀；两条累计通道分开显示。',
      'Σ 的范围是完整空域网格，共 N² 个位置，包含零贡献项。C 累加 z 的实部和虚部，E₀ 累加非负的 e；屏幕计数与数值读取同一个完整前缀和，不把频域掩膜点数当成累计次数。',
      '完整空域网格 · 每个位置参与一次 · 累计完成后才相除'],
    ['finalDivide', .80, .90, '除以参考能量', '全部累加完成，C 除以 E₀ 得到一个复系数。',
      '分子保留复数乘积和，分母是实数参考能量。两路进入同一次除法，输出 α̂；这一步才揭示共同复系数箭头。',
      'E₀>0 时，α̂=C/E₀。分母归一化参考场的能量；没有再除 H，也没有对角度做迭代试探。源码 getPeak 返回这个复数，下一拍才读取相角和模长。',
      'N² 项已累计 · C ÷ E₀ · 一个共同复系数'],
    ['finalRead', .90, 1, '读取幅相', '从同一个复系数，读取调制度与共同相位。',
      '箭头长度给出 m̂，相角给出 φ̂Δ。把共同偏移加到已知相对相移 φ′ⱼ 上，得到各帧相位；锁定波矢独立进入结果卡，接着回填矩阵。',
      'm̂=|α̂|，φ̂Δ=arg α̂。临时旁带的 2/3 权重已补偿余弦展开的 1/2，模长直接给调制度，不再乘 2。相对步进必须已知且准确；这些参数来自同一组三帧观测。',
      '模长 → 调制度 · 相角 → 共同相位 · 参数交给解混矩阵'],
  ].map(row => Object.freeze(row)));
  function leastSquaresNarrative(progress) {
    const p = Math.round(clamp(progress) * 1e12) / 1e12;
    const beat = getPeakBeats.find((row, i) => p < row[2] || i === getPeakBeats.length - 1);
    const [mode, start, end, action, title, copy, note, footer] = beat;
    return { mode, start, end, action, title, copy, note, footer, beat: getPeakBeats.indexOf(beat),
      ...(p < .07 ? { title: refinementNarrative(1).title, copy: refinementNarrative(1).copy,
        action: '位置锁定 · 收起搜索概览', note: reasoningAt({id:'refine',progress:1}).note,
        footer: 'k̂ 已锁定 · 回到同一对完整频谱 · 下一步比较公共点的共同幅相。' } : {}) };
  }
  const peakCache = new WeakMap();
  function getPeakDataFor(lesson) {
    if (peakCache.has(lesson)) return peakCache.get(lesson);
    const peak = lesson.estimate.finalPeak;
    if (!peak || !peak.valid) throw new Error('共同幅相动画需要有效的 fairSIM finalPeak。');
    const { n } = peak;
    // Choose one REAL location with signal and a visible known ramp angle.
    // This is a teaching cursor, never the subset used for accumulation.
    let sampleIndex = 0, maximum = -1;
    for (let i = 0; i < peak.count; i++) {
      const angle = -2 * Math.PI * (peak.kx * (i % n) + peak.ky * Math.floor(i / n)) / n;
      const weight = peak.energy[i] * (.05 + Math.abs(Math.sin(angle / 2)));
      if (weight > maximum) { maximum = weight; sampleIndex = i; }
    }
    const value = { peak, sampleIndex };
    peakCache.set(lesson, value); return value;
  }
  function leastSquaresState(lesson, progress) {
    const p = Math.round(clamp(progress) * 1e12) / 1e12;
    const narrative = leastSquaresNarrative(p), { peak, sampleIndex } = getPeakDataFor(lesson);
    const beatAlpha = (start, end) => ramp(p, start === 0 ? .07 : start + .003, start === 0 ? .10 : start + .013)
      * (end === 1 ? 1 : 1 - ramp(p, end - .012, end - .003));
    const panels = getPeakBeats.map(row => beatAlpha(row[1], row[2]));
    // The first location is shown slowly, then EVERY remaining row-major item.
    const count = p < .60 ? 0 : p < .63 ? 1
      : Math.min(peak.count, 1 + Math.floor((ramp(p, .63, .79) + 1e-12) * (peak.count - 1)));
    const solved = p >= .86, read = p >= .90;
    const sample = p >= .58 && p < .80 ? Math.max(0, count - 1) : sampleIndex;
    return { ...narrative, progress: p, panels, textAlpha: panels[narrative.beat],
      overview: 1 - ramp(p, .015, .055), body: ramp(p, .07, .10),
      inverse: ramp(p, .16, .25), shift: ramp(p, .305, .35),
      shiftOutput: ramp(p, .35, .36), shiftScan: ramp(p, .36, .395),
      conjugate: ramp(p, .45, .50), multiply: ramp(p, .50, .55),
      count, total: peak.count, sum: peak.sums[count], sample, r: [sample % peak.n, Math.floor(sample / peak.n)],
      divide: ramp(p, .825, .86), solved, read: read ? 1 : 0,
      alpha: solved ? { ...peak.alpha } : null,
      m: read ? peak.m : null, phase: read ? peak.phase : null,
      phaseRead: ramp(p, .91, .94), lengthRead: ramp(p, .94, .97),
      cards: ramp(p, .965, .995), k: [peak.kx, peak.ky] };
  }

  const api = { scenes, scene, index, formulas, bandColors, stateForScene, formulaAt, formulaMode, sharedState, sharedPointState, lineState, returnTo2DState, otfState, rejectionProgress, dataFor, matchingState, scanState, fftState, refinementNarrative, refinementPhaseState, refinementState, refinementDataFor, getPeakBeats, getPeakDataFor, leastSquaresNarrative, leastSquaresState };
  if (node) module.exports = api; else root.SIMParameterLesson = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
