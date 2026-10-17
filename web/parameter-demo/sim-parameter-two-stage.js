/* Production lesson: correspondence, one-dimensional arithmetic, search and fit.
 * Uses the existing observation-only estimator. fairSIM 2016, SI Note 1;
 * the normalized score and 5×5 search are this project's teaching implementation. */
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
    correct: pairFormula(String.raw`U(\mathbf q)=\frac{\widetilde A_0(\mathbf q)}{H(\mathbf q)}`, String.raw`V_{\mathbf k'}(\mathbf q)=\frac{\widetilde A_{+1}(\mathbf q+\mathbf k')}{H(\mathbf q+\mathbf k')}`, String.raw`,\quad\mathbf q\in\Omega_{\mathbf k',\tau}`),
    match: '$$' + color(1, String.raw`V_{\mathbf k'}(\mathbf q)`) + String.raw`\approx` + color(2, String.raw`\widehat\alpha(\mathbf k')`) + color(0, String.raw`U(\mathbf q)`) + String.raw`,\qquad\mathbf q\in\Omega_{\mathbf k',\tau}$$`,
    loss: String.raw`$$J(\alpha;\mathbf k')=\sum_{\Omega_{\mathbf k',\tau}}|V_{\mathbf k'}-\alpha U|^2,\qquad\widehat\alpha(\mathbf k')=\operatorname*{arg\,min}_{\alpha\in\mathbb C}J$$`,
    projection: String.raw`$$C=\sum_{\Omega}U^*V_{\mathbf k'},\quad E_U=\sum_{\Omega}|U|^2,\quad E_V=\sum_{\Omega}|V_{\mathbf k'}|^2,\qquad\widehat\alpha=\frac{C}{E_U}$$`,
    residual: String.raw`$$\frac{\min_\alpha J(\alpha;\mathbf k')}{E_V}=1-\frac{|C|^2}{E_UE_V}=1-\rho(\mathbf k')^2,\qquad 0\le\rho\le1$$`,
    coherence: String.raw`$$U_j^*V_j=|U_j||V_j|e^{i(\arg V_j-\arg U_j)},\qquad C=\sum_j U_j^*V_j$$`,
    score: String.raw`$$\rho(\mathbf k')=\frac{\left|\sum_{\Omega_{\mathbf k',\tau}}U^*V_{\mathbf k'}\right|}{\sqrt{\sum_{\Omega_{\mathbf k',\tau}}|U|^2\sum_{\Omega_{\mathbf k',\tau}}|V_{\mathbf k'}|^2}},\qquad\widehat{\mathbf k}_{\rm coarse}=\operatorname*{arg\,max}_{\mathbf k'}\rho(\mathbf k')$$`,
    search: String.raw`$$\mathcal K=\{\mathbf k'\in\mathbb Z^2:r_{\min}\le\|\mathbf k'\|\le r_{\max}\},\qquad\widehat{\mathbf k}_{\rm coarse}=\operatorname*{arg\,max}_{\mathbf k'\in\mathcal K}\rho(\mathbf k')$$`,
    subpixel: String.raw`$$a=\mathcal F_N^{-1}\{\widetilde A_{+1}\},\qquad\mathcal F_N\!\left\{a[x,y]e^{-\frac{2\pi i}{N}(k'_x x+k'_y y)}\right\}(\mathbf q)=\widetilde A_{+1}(\mathbf q+\mathbf k')$$`,
    local: String.raw`$$k'_a=c_{r,a}+j h_r,\quad a\in\{x,y\},\ j\in\{-2,-1,0,1,2\},\qquad h_r\in\{0.25,0.05,0.01\}$$`,
    coefficient: String.raw`$$U_j=S(\mathbf q_j),\quad V_j=m e^{i\phi_\Delta}S(\mathbf q_j)\quad\Longrightarrow\quad V_j=m e^{i\phi_\Delta}U_j$$`,
    geometry: String.raw`$$U_j=r_j e^{i\theta_j}\ \xrightarrow{\ \text{旋转 }\phi_\Delta\ }\ r_j e^{i(\theta_j+\phi_\Delta)}\ \xrightarrow{\ \text{缩放 }m\ }\ V_j=m r_j e^{i(\theta_j+\phi_\Delta)}$$`,
    conjugate: String.raw`$$U_j^*V_j=r_j e^{-i\theta_j}\,m r_j e^{i(\theta_j+\phi_\Delta)}=m r_j^2e^{i\phi_\Delta}$$`,
    fit: String.raw`$$\widehat\alpha=\frac{\sum_{\Omega}U^*V}{\sum_{\Omega}|U|^2},\qquad\widehat m=|\widehat\alpha|,\qquad\widehat\phi_\Delta=\arg\widehat\alpha$$`,
    read: String.raw`$$I_j(\mathbf r)=1+\widehat m\cos\!\left(\frac{2\pi}{N}\widehat{\mathbf k}\cdot\mathbf r+\phi'_j+\widehat\phi_\Delta\right),\qquad\widehat\phi_j=\phi'_j+\widehat\phi_\Delta$$`,
  };
  const definitions = [
    ['shared', '找公共区', '同一样品频率，在两个级次中记录在哪里？', '0 级在检测坐标 f=q 记录 S(q)，+1 级在 f=q+k 记录同一分量。真实 k 尚未知；试用 k′ 时，比较 Ã₀(q) 与 Ã₊₁(q+k′)，并只保留两处 OTF 都达到阈值的频点。', 'region', 'k 是真实未知波矢，k′ 是候选，k̂ 是估计值。画面用 k′=k 演示正确对应，不能由单个点的示意确定 k；后面会用公共区内多个频点的复数匹配搜索。OTF 阈值只筛选可比较的通带，还须检查有效点数与信号能量。', 28000],
    ['line-shift', '沿一行对齐', '沿一行移动，找出对齐的位置。', '一维示例中，同一组 1、4、2 在两份记录里相差两格。不同位移下，将对应格的数值相乘再求和；三项对齐时，乘积和达到峰值。', 'real', '教学值不替代原图三个点的读数。这里 H=1、m=1、共同相位为 0；范围外补零。原始乘积和用于讲运算，实际搜索还会做能量归一化。', 26000],
    ['shift', '回到二维', '回到二维，横纵一起对齐。', '每个频率有横纵两个坐标。用候选位移 −k′ 搬回旁带时，频谱与 OTF 一起换坐标，在 q+k′ 处取值。只有 k′=k 时，两边才对应同一样品频率。', 'shift', '逐点比较从一行扩展到整个二维公共区。教学位移 2 不带入原图。移回后旁带取值对应 H(q+k′) 与 S(q+k′−k)；画面仅示意 k′=k，真实 k 仍待后续搜索。', 16000],
    ['otf', '校正衰减', '先除去检测衰减，准备比较位移。', '为了找真实位移 k，先筛掉任一边 H 太弱的频点。右侧每份记录分成补偿前、补偿后两行：灰条固定，彩条从原长度增长，先演示 0 级，再演示旁带；各自除以 H 后得到 U、V。', 'correct', '两行横条使用同一标尺，读数均为幅值 / N²。H 固定，当前倍数从 1 增至 1/H；虚线保留补偿前的长度，新增彩色段表示补回的幅值。这里只演示幅值；当前 H 实数非负，相位和频率位置均不变。', 18000],
    ['match', '比较候选', '为什么要比较“同一个系数能否解释全部点”？', '候选 k′ 正确时，OTF 校正后的两份样品信息只差共同系数 α。先让 α 自由拟合，再累计紫色实测值与橙色预测值的平方误差；按旁带能量归一化后，误差恰为 1−ρ²。', 'match', '本步用全部可靠公共点选择 k′。橙色虚线是同一个 α̂(k′)U 的预测，紫色是实测 V；P、Q、R 只展示其中三点。', 26000],
    ['coarse', '找到峰值', '评分为什么这样写，又从哪里开始搜？', '复数乘积先求和，检查各点是否有共同相位差；取模消去共同相位，再除以两边能量，消去整体亮度影响。把各整数候选的分数排成图，峰的位置才是位移初值。', 'score', '本页演示有限范围的逐候选粗搜；fairSIM 先由 FFT 互相关图定位整数峰，随后才在附近做局部细化。', 26000],
    ['refine', '细化位移', '已有整数峰，只在它附近细化。', '现在以整数峰为初值，不再遍历整张图。用空间相位斜坡计算小数频移，每轮选出最高分，再以它为下一轮中心，逐渐缩小搜索范围。', 'subpixel', '本页三轮 5×5，半宽 0.5、0.1、0.02 格；fairSIM 三轮 10×10，半宽 2.5、0.5、0.1 格。两者设置不同，搜索间隔也不等于实验精度。', 22000],
    ['geometry', '转动与缩放', '为什么相位是旋转，调制度是伸缩？', '位移锁定后，U 与 V 含同一个 S(q)，只差 m·exp(iφΔ)。exp(iφΔ) 的模为 1，相乘只把复数角度加上 φΔ；再乘实数 m，只把长度变成 m 倍。因此每个频点都应有相同角度差与长度比。', 'geometry', '频率点 q 不动。旋转发生在 Re–Im 平面；不同频点自己的相位不同，共同的是角度差和长度比。', 24000],
    ['conjugate', '消去自身相位', '取共轭，消去各个点自己的相位。', '继续使用刚才的 P、Q、R。把 0 级箭头取共轭，再与对应旁带相乘；三个乘积留下相同的相位方向。', 'conjugate', '星号表示共轭：相位取反。相乘后自己的 θj 消掉，剩下 φΔ；乘积使用单独的能量标尺。', 16000],
    ['fit', '合起来拟合', '把公共点合起来，求出同一个系数。', '将三个点的解释扩展到完整可靠公共区。复数乘积先求和， 0 级能量同时累计，最后相除得到共同系数。', 'fit', '弱参考点的逐点相除可能不稳定；这里以全部公共点做复数最小二乘拟合。分子、分母使用同一批点。', 16000],
    ['read', '回看条纹', '把幅相放回条纹，看看照明怎样变。', '保留刚求出的比例箭头。先在照明预览中加入相位，再加入调制度，随后将估计参数填回混合矩阵。', 'read', '照明预览没有重新曝光。k̂ 决定周期与法线方向，φ̂Δ 决定条纹位置，m̂ 决定对比度。', 14000],
  ];
  const scenes = definitions.map(([id, label, title, copy, formula, note, duration], i) => ({ id, label, title, copy, equation: formulas[formula], note, duration,
    chapter: i < 7 ? '① 找位置 / 频率坐标' : '② 求幅相 / 复数值', phase: i < 7 ? 'position' : 'coefficient' }));
  const index = id => scenes.findIndex(s => s.id === id);
  const scene = id => { const s = scenes[index(id)]; if (!s) throw new Error('未知参数场景：' + id); return s; };
  function stateForScene(id, progress = 1) {
    if (!Number.isFinite(progress)) throw new Error('场景进度必须是有限数值。');
    const s = scene(id), p = clamp(progress), step = index(id);
    return { id, step, progress: p, position: step + p, phase: s.phase,
      correction: id === 'otf' ? otfState(p).correction : step > index('otf') ? 1 : 0,
      rotation: id === 'geometry' ? ramp(p, .18, .49) : step > index('geometry') ? 1 : 0,
      scaling: id === 'geometry' ? ramp(p, .59, .88) : step > index('geometry') ? 1 : 0,
      conjugation: id === 'conjugate' ? ramp(p, .16, .43) : step > index('conjugate') ? 1 : 0,
      product: id === 'conjugate' ? ramp(p, .55, .87) : step > index('conjugate') ? 1 : 0 };
  }
  function reasoningAt(s) {
    const p = s.progress;
    const stages = s.id === 'match' ? [
      [.12, 'prepare', 'correct', '先保留上一幕校正后的 U、V；改变 k′ 后要重新取值和筛选公共区。'],
      [.42, 'loss', 'loss', '为什么不能直接要求 U=V？未知 m 和 φΔ 会带来共同幅相差。先允许一个复系数 α，再最小化全部公共点的预测误差。'],
      [.72, 'projection', 'projection', '在当前候选的同一批 Ω 上定义 C、E_U、E_V。平方误差配方后，最佳共同系数为 C/E_U；相应预测就是橙色虚线。'],
      [1.01, 'residual', 'residual', '将最佳拟合的剩余误差除以旁带能量 E_V，得到 1−ρ²。因此最大化 ρ 等价于最小化相对误差；比较的不是公共区面积。'],
    ] : s.id === 'coarse' ? [
      [.24, 'coherence', 'coherence', '分子为什么先做复数求和？若各点的相位差相同，乘积方向一致、相加增强；相位差分散时会相互抵消。取模后，共同 φΔ 只改变方向，不改变分数。'],
      [.50, 'normalization', 'score', '分母为什么是两边能量的几何平均？它抵消整体幅度比例，使分数不因更亮而更高。柯西–施瓦茨不等式给出 0≤ρ≤1；完全满足 V=αU 时为 1。'],
      [.68, 'residual', 'residual', '这不是任意设计的分数：平方误差配方得到 min J=E_V−|C|²/E_U；除以 E_V 就是 1−ρ²。仍须有足够公共点与非零能量。'],
      [1.01, 'domain', 'search', '本页默认只搜 3≤‖k′‖≤10 的整数候选，排除无足够公共点的候选。逐行扫描只是填表顺序；fairSIM 用整张 FFT 互相关图找初值，也可使用已有参数。'],
    ] : s.id === 'refine' ? [
      [.30, 'fractional', 'subpixel', '粗峰已经提供初值。小数频移由空间相位斜坡计算；这个斜坡的角度随像素位置变化，用来移动频谱，区别于下一幕对所有复数值乘同一个相位。'],
      [1.01, 'local', 'local', 'c_r 是本轮中心，两轴各试 5 点；本轮最高分成为下一轮中心。本页半宽 0.5→0.1→0.02；fairSIM 为 2.5→0.5→0.1，每轮 10×10。单位均为 DFT 频率格。'],
    ] : null;
    if (!stages) return null;
    const [, key, formula, note] = stages.find(row => p < row[0]);
    return { key: s.id + '-' + key, equation: formulas[formula], note };
  }
  function formulaAt(s) {
    const data = scene(s.id), p = s.progress;
    if (s.id === 'shared') return { equation: p < .18 ? formulas.point : p < .50 ? formulas.derive : p < .78 ? formulas.candidatePoint : p < .94 ? formulas.common : formulas.region,
      note: p < .18 ? '固定一个样品频率 q。青色 0 级在 f=q 记录 S(q)；紫色旁带要满足 f−k=q 才记录同一份信息。'
        : p < .39 ? '下方 −k 移到等号右侧成为 +k；上方寻址光标同步沿 +k 找到旁带中的 f=q+k。k 的数值将在后面估计。'
        : p < .54 ? '先让两幅图共用检测坐标原点；这是画面叠放，尚未做频移。接下来用 k′ 表示尝试搬回的位移。'
        : p < .68 ? '真实记录在 q+k；移动 −k′ 后还剩位置误差 k−k′。这两个量不相等时不能抵消，频点携带的复数值保持不变。'
        : p < .78 ? '这里只示意 k′=k 时的对齐：残差为零，两个标记重合。k 仍未知，后面要比较候选，求得 k̂。'
        : p < .94 ? '此处示意 k′=k。虚线轮廓是两边 OTF 非零的几何交集；边缘虽有传递，仍可能太弱，不能都拿来相除比较。' : data.note };
    if (s.id === 'line-shift') return { equation: M.teachingEquations[lineState(p).real.best === 1 ? 'peak' : 'real'], note: data.note };
    if (s.id === 'shift' && p < .40) return { equation: p < .15 ? M.teachingEquations.peak : formulas.coordinates,
      note: p < .15 ? '保留一维例子的终点：位移 2、乘积和 21。它只说明如何比较；接下来回到原图。' : 'q 是参考频率，k′ 是候选位移，两者都有横纵分量。0 级取 q，旁带按候选取 q+k′；真实 k 仍未知，图中仅示意 k′=k。' };
    if (s.id === 'shift' && p < .68) return { equation: formulas.source, note: '两幅图采用同一个检测频率原点。相同 f 处分别包含 S(f) 与 S(f−k)，此时还没有归位。' };
    if (s.id === 'otf' && p < .5) return { equation: formulas.region, note: 'Ω 的“几何”上标表示两边 OTF 非零的交集。任意一边 |H| 低于 τ 就剔除，剩下 Ω_{k′,τ} 才用于相除和匹配。本幕示意 k′=k；下一步对不同候选重新筛选。' };
    const reasoning = reasoningAt(s);
    if (reasoning) return { equation: reasoning.equation, note: reasoning.note };
    if (s.id === 'geometry') return { equation: formulas.geometry, note: p < .14
      ? '为什么能共用一个系数？k̂ 对齐后，U_j=S(q_j)，V_j=m·exp(iφΔ)S(q_j)，所以 V_j=m·exp(iφΔ)U_j。这个关系来自临时分离的成像式。'
      : p < .59 ? '欧拉公式 exp(iφΔ)=cosφΔ+i·sinφΔ，模长为 1。乘到 r_j·exp(iθ_j) 上，角度变为 θ_j+φΔ，长度 r_j 不变；试探错误角度时不能同时对准旁带。'
      : 'm 是非负实数：乘 m 后长度变为 m·r_j，角度保持 θ_j+φΔ。因而 |V_j|/|U_j|=m、arg V_j−arg U_j=φΔ；这两个参数在所有可靠点上共同拟合。' };
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
    // Hold the original values first; compensate the two records in sequence
    // so each visible gain can be traced to its own fixed OTF divisor.
    const correctionByBand = [ramp(p, .53, .69), ramp(p, .73, .89)];
    return { warning: ramp(p, .02, .10), discard: ramp(p, .10, .37), detail: ramp(p, .40, .48),
      correctionByBand, correction: (correctionByBand[0] + correctionByBand[1]) / 2 };
  }
  function rejectionProgress(progress, rank) {
    // The weakest samples leave first. Shrinking a selection cell does not
    // move its frequency coordinate or alter the observed spectrum.
    return ramp(progress, .10 + .12 * clamp(rank), .25 + .12 * clamp(rank));
  }
  function formulaMode(s) {
    const p = s.progress;
    const reasoning = reasoningAt(s);
    if (reasoning) return reasoning.key;
    return s.id + (s.id === 'shared' ? p < .78 ? '-derive' : p < .94 ? '-common' : '-reliable'
      : s.id === 'otf' && p < .5 ? '-region'
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
    const p = clamp(progress), data = dataFor(lesson);
    if (id === 'match') {
      if (p < .12) return { candidate: data.best, committed: [], local: 0 };
      const t = ramp(p, .12, .88) * 3, i = Math.min(2, Math.floor(t));
      return { candidate: data.examples[i], committed: data.examples.slice(0, Math.floor(t)), local: t === 3 ? 1 : t - i };
    }
    const done = p >= .9, count = Math.floor(ramp(p, .12, .88) * data.valid.length);
    return { candidate: done ? lesson.estimate.coarseBest : p < .12 ? data.examples[2] : data.valid[Math.min(count, data.valid.length - 1)], committed: data.valid.slice(0, count), local: 1 };
  }
  function refinementState(lesson, progress) {
    const p = clamp(progress), data = dataFor(lesson), travel = ramp(p, .30, .90) * 3, round = Math.min(2, Math.floor(travel)), local = travel === 3 ? 1 : travel - round;
    const r = data.rounds[round], i = Math.min(r.candidates.length - 1, Math.floor(local * r.candidates.length));
    return { round, local, step: r.step, candidates: r.candidates, center: r.center, done: p >= .9,
      candidate: p < .30 ? lesson.estimate.coarseBest : p >= .9 ? data.best : r.candidates[i] };
  }
  function transformState(lesson, progress) {
    const p = clamp(progress), phase = lesson.estimate.phase, trial = phase + .65;
    return { phase: p < .32 ? trial * ramp(p, .14, .32) : trial + (phase - trial) * ramp(p, .32, .57),
      m: 1 + (lesson.estimate.m - 1) * ramp(p, .64, .92), trial: p < .57 };
  }
  function fittingState(id, progress, count) {
    const p = clamp(progress), read = id === 'read';
    return { count: read ? count : Math.floor(ramp(p, .12, .60) * count), divide: read ? 1 : ramp(p, .72, .94),
      phase: read ? ramp(p, .15, .45) : 0, modulation: read ? ramp(p, .58, .88) : 0 };
  }
  const api = { scenes, scene, index, formulas, bandColors, stateForScene, formulaAt, formulaMode, sharedState, sharedPointState, lineState, returnTo2DState, otfState, rejectionProgress, dataFor, matchingState, refinementState, transformState, fittingState };
  if (node) module.exports = api; else root.SIMParameterLesson = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
