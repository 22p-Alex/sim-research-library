/* Integrated Motion chapter: shared observations in, estimated parameters and
 * a complete reconstruction out. No DOM, event listeners or playback clock.
 * The standalone preview and the Motion host use the same lesson. */
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const Story = node ? require('../parameter-demo/sim-parameter-model.js') : root.SIMParameterStory;
  const Estimator = node ? require('../shared/sim-parameter-estimation.js') : root.SIMParameterEstimation;
  const Study = node ? require('../parameter-demo/sim-parameter-two-stage.js') : root.SIMParameterLesson;
  const A = node ? require('../atlas/sim-atlas-core.js') : root.SIMAtlas;
  // Acquisition, provisional separation, formal demixing, relocation and the
  // final audit belong to Motion. Only the estimation explanations are added.
  const sceneIds = Object.freeze(Study.scenes.map(scene => scene.id));
  const convention = Object.freeze({ orders: Object.freeze([0, 1, -1]), estimationOrder: 1,
    frequencyUnit: 'DFT bins', yAxis: 'down', forwardFFTExponent: -1,
    positiveBandFactor: 'm exp(+i phase)', negativeBandFactor: 'm exp(-i phase)' });
  // Equal, known relative phase steps leave one common offset to estimate.
  // Source: fairSIM (2016), Supplementary Note 1, Parameter estimation.
  // https://doi.org/10.1038/ncomms10980 — SI pp. 9–10. The explicit
  // 1/2 and 2/3 below use this demo's cosine / temporary-band convention.
  const parameterColors = Object.freeze({ k: '#7ad5cd', m: '#efb879', phase: '#b7a5eb' });
  const parameterBox = (tex, framed, color = '#dce6e1') => '{\\color{' + (framed ? color : 'transparent')
    + '}\\boxed{{\\color{' + color + '}' + tex + '}}}';
  const illuminationTex = framed => String.raw`I_j(\mathbf r)=1+` + parameterBox('m', framed, parameterColors.m)
    + String.raw`\cos\!\left(\frac{2\pi}{N}` + parameterBox('\\mathbf k', framed, parameterColors.k)
    + String.raw`\cdot\mathbf r+` + parameterBox('\\phi_j', framed, parameterColors.phase) + String.raw`\right)`;
  const colored = (key, tex) => '{\\color{' + parameterColors[key] + '}' + tex + '}';
  const substitutedIlluminationTex = String.raw`\widehat I_j(\mathbf r)=1+` + colored('m', String.raw`\widehat m`)
    + String.raw`\cos\!\left(\frac{2\pi}{N}` + colored('k', String.raw`\widehat{\mathbf k}`)
    + String.raw`\cdot\mathbf r+` + colored('phase', String.raw`\phi'_j+\widehat\phi_\Delta`) + String.raw`\right)`;
  const actualIlluminationTex = String.raw`I_j(\mathbf r)=1+m\cos\!\left(\frac{2\pi}{N}\mathbf k\cdot\mathbf r+\phi'_j+\phi_\Delta\right)`;
  const nominalObservationTex = String.raw`D_j=\widetilde A_0+\tfrac12e^{i\phi'_j}\widetilde A_{+1}+\tfrac12e^{-i\phi'_j}\widetilde A_{-1}`;
  const provisionalContentDuration = 42000, nominalPreludeDuration = 22000;
  const provisionalDuration = provisionalContentDuration + nominalPreludeDuration;
  const nominalPreludeStart = .06 * provisionalContentDuration;
  // Keep all previously established lesson timings after this insertion.
  const provisionalProgress = p => (Story.clamp(p) * provisionalContentDuration
    + (p >= .06 ? nominalPreludeDuration : 0)) / provisionalDuration;
  function nominalFailureState(progress) {
    const p = Story.clamp(progress), r = Story.ramp;
    return { progress: p, mode: p < .12 ? 'question' : p < .32 ? 'nominal-card' : p < .62 ? 'vector-failure' : 'phase-failure',
      lift: r(p, 0, .12), question: r(p, .02, .10), card: r(p, .12, .26),
      diagram: r(p, .23, .31), relocate: r(p, .32, .43), misregister: r(p, .43, .55),
      phase: r(p, .64, .79), cancellation: r(p, .79, .86),
      // Two slow pulses in 4.4 seconds, sampled from the same reversible clock.
      redPulse: p >= .78 ? .2 + .6 * Math.sin(Math.PI * Story.clamp((p - .78) / .20) * 2) ** 2 : 0 };
  }
  // Controlled counterfactual, generated from the adopted bands of these frames.
  // No new acquisition, hidden sample or fitted display effect. All three
  // images reconstruct the SAME synthetic observations through A.pipeline.
  // The pi phase is chosen for exact opposition, not claimed as a measured value.
  // Artifact context: Fan et al. 2019, doi:10.1007/s41048-019-0081-7, Fig. 2.
  function createNominalFailure(lesson) {
    const n = lesson.capture.raw.n, g = lesson.group, cutoff = lesson.pipeline.cutoff;
    const phase = Math.PI, delta = .3, k = [g.kx, g.ky], nominal = [g.kx + delta, g.ky];
    const base = g.separated, phases = [0, 2 * Math.PI / 3, 4 * Math.PI / 3];
    const frames = phases.map((p, j) => {
      const z = { re: new Float64Array(n * n), im: new Float64Array(n * n) };
      for (let b = 0; b < 3; b++) {
        const angle = [0, 1, -1][b] * (p + phase), scale = b === 0 ? 1 : .5;
        const re = scale * Math.cos(angle), im = scale * Math.sin(angle);
        for (let i = 0; i < z.re.length; i++) {
          z.re[i] += re * base[b].re[i] - im * base[b].im[i];
          z.im[i] += re * base[b].im[i] + im * base[b].re[i];
        }
      }
      return { index: j, pixels: A.spatial(z, n).re };
    });
    function reconstruct(vector, adoptedPhase) {
      const raw = { n, groups: [{ index: g.index, frames: frames.map((frame, j) => ({ ...frame, phase: phases[j] + adoptedPhase })) }] };
      const cal = { n, kc: cutoff / n, electrons: 1, background: 0, readNoise: 0, shotNoise: false,
        groups: [{ index: g.index, angle: Math.atan2(vector[1], vector[0]) * 180 / Math.PI, period: n / Math.hypot(...vector), mean: 1 }] };
      const result = A.pipeline(raw, cal, {}, 1);
      if (!result.ok) throw new Error('标称参数对照重建失败：' + result.reason);
      return result;
    }
    const reference = reconstruct(k, phase), vector = reconstruct(nominal, phase), uncorrected = reconstruct(nominal, 0);
    const shifted = [A.shift(base[1], ...k, n), A.shift(base[1], ...nominal, n)];
    const fields = [base[0], ...shifted].map(z => ({ re: new Float64Array(z.re.length), im: new Float64Array(z.im.length) }));
    const probes = [];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const i = y * n + x, qx = A.bin(x, n), qy = A.bin(y, n);
      const hs = [A.otf(qx, qy, cutoff), A.otf(qx + k[0], qy + k[1], cutoff), A.otf(qx + nominal[0], qy + nominal[1], cutoff)];
      [base[0], ...shifted].forEach((z, b) => {
        if (hs[b] >= .12) { fields[b].re[i] = z.re[i] / hs[b]; fields[b].im[i] = z.im[i] / hs[b]; }
      });
      if (hs.every(h => h >= .12) && qx * qx + qy * qy > 1) {
        probes.push({ qx, qy, index: i, energy: Math.hypot(fields[0].re[i], fields[0].im[i]), angle: Math.atan2(fields[0].im[i], fields[0].re[i]) });
      }
    }
    probes.sort((a, b) => b.energy - a.energy);
    const selected = [];
    for (const point of probes) {
      if (selected.every(p => Math.hypot(p.qx - point.qx, p.qy - point.qy) >= 1.5)) selected.push(point);
      if (selected.length === 3) break;
    }
    const images = [reference.outputPixels, vector.outputPixels, uncorrected.outputPixels];
    let maximum = 0, minimum = 0, minIndex = 0;
    images.forEach(image => image.forEach(v => { maximum = Math.max(maximum, v); minimum = Math.min(minimum, v); }));
    uncorrected.outputPixels.forEach((v, i) => { if (v < uncorrected.outputPixels[minIndex]) minIndex = i; });
    const rms = image => Math.sqrt(image.reduce((sum, v, i) => sum + (v - reference.outputPixels[i]) ** 2, 0) / image.length);
    return { n, size: 2 * n, k, nominal, delta, phase, m: 1, frames, reference, vector, uncorrected, fields,
      probes: selected, images, maximum, minimum, profileY: Math.floor(minIndex / (2 * n)),
      errors: { vector: rms(vector.outputPixels), phase: rms(uncorrected.outputPixels) } };
  }
  const provisionalFormulas = {
    compact: String.raw`$$\mathbf A(\mathbf f)=U\cdot\mathbf D(\mathbf f)$$`,
    question: String.raw`$$\mathbf A(\mathbf f)=U\cdot\mathbf D(\mathbf f)$$`,
    'nominal-card': String.raw`$$\mathbf p_{\text{标称}},\qquad\phi_0=0,\qquad m=1$$`,
    'vector-failure': String.raw`$$\Delta\mathbf p=\mathbf p_{\text{标称}}-\mathbf p_d=(0.3,0),\qquad S(\mathbf q+\Delta\mathbf p)\ne S(\mathbf q)$$`,
    'phase-failure': String.raw`$$\phi_{d,0}=\pi:\quad S(\mathbf q)+e^{i\phi_{d,0}}S(\mathbf q)=0,\qquad e^{-i\phi_{d,0}}e^{i\phi_{d,0}}=1$$`,
    substitute: '$$' + substitutedIlluminationTex + '$$',
    model: '$$' + actualIlluminationTex + String.raw`,\qquad\phi'_j=\frac{2\pi j}{3},\ j=0,1,2$$`,
    expand: String.raw`$$e^{\pm i(\phi'_j+\phi_\Delta)}=e^{\pm i\phi'_j}e^{\pm i\phi_\Delta},\qquad c_\pm=m e^{\pm i\phi_\Delta}$$`,
    absorb: String.raw`$$\widetilde A_0=HS,\qquad\widetilde A_{\pm1}(\mathbf f)=\underbrace{m e^{\pm i\phi_\Delta}}_{c_\pm}\,H(\mathbf f)S(\mathbf f\mp\mathbf k)$$`,
    demix: String.raw`$$\widetilde A_0=\frac13\sum_{j=0}^{2}D_j,\qquad\widetilde A_{\pm1}=\frac23\sum_{j=0}^{2}e^{\mp i\phi'_j}D_j$$`,
    ready: String.raw`$$\widetilde{\mathbf A}(\mathbf f)=\widetilde U\cdot\mathbf D(\mathbf f),\qquad\widetilde U_{0j}=\tfrac13,\quad\widetilde U_{\pm1,j}=\tfrac23e^{\mp i\phi'_j}$$`,
  };
  const provisionalSteps = Object.freeze([
    [0, 'compact'], [.06, 'substitute'], [.28, 'model'], [.40, 'expand'], [.56, 'absorb'], [.74, 'demix'], [.94, 'ready'],
  ].map(([start, mode]) => Object.freeze({ start, mode })));
  function provisionalState(progress) {
    const elapsed = Story.clamp(progress) * provisionalDuration, r = Story.ramp;
    const prelude = nominalFailureState((elapsed - nominalPreludeStart) / nominalPreludeDuration);
    const active = elapsed >= nominalPreludeStart && elapsed < nominalPreludeStart + nominalPreludeDuration;
    const p = (elapsed - (elapsed < nominalPreludeStart ? 0 : active ? elapsed - nominalPreludeStart : nominalPreludeDuration)) / provisionalContentDuration;
    const mode = active ? prelude.mode : provisionalSteps.filter(item => p >= item.start).at(-1).mode;
    const window = (start, end) => r(p, start, start + .025) * (1 - r(p, end, end + .025));
    return { progress: Story.clamp(progress), contentProgress: p, mode, formulaKey: mode, focus: mode === 'substitute' ? 'all' : '', prelude,
      handoff: r(p, 0, .015), gather: r(p, .01, .04), tokens: 1 - r(p, .035, .05),
      compact: r(p, .035, .05) * (1 - r(p, .06, .085)) * (1 - .84 * prelude.lift),
      equationPose: { y: 260 - 215 * prelude.lift, scale: 1 - .28 * prelude.lift },
      failure: r(elapsed, nominalPreludeStart, nominalPreludeStart + 300) * (1 - r(elapsed, nominalPreludeStart + nominalPreludeDuration, nominalPreludeStart + nominalPreludeDuration + 600)),
      substitution: window(.06, .28), insert: r(p, .13, .22), model: window(.28, .40),
      expansion: window(.40, .56), phaseFactor: r(p, .46, .50),
      absorption: window(.56, .74), absorb: r(p, .62, .70),
      demix: window(.74, .94), orthogonality: r(p, .80, .85), ready: r(p, .94, .965) };
  }
  function provisionalFormulaAt(state) {
    const s = provisionalState(state.progress);
    const content = {
      compact: ['解法已经写出，实际权重还待确定。', '刚才求出了含 m、φⱼ 的逆矩阵。要从三帧求回 05 那三份来源，还需确定实际照明参数；先看仅凭已知相对相移能解到哪一步。', '此时得到符号解法；参数还没求出。下面先分开级次，再估计旁带保留的幅相与位置。'],
      question: ['直接分离可行吗？', '逆矩阵写出来了，但其中的参数该填什么？先试着用硬件预设标称参数完成解混、归位与融合。', '下面讨论的是未经校正就直接重建；按准确相对相移进行粗分离仍然可行。'],
      'nominal-card': ['先把硬件标称值，直接填进去。', '卡片给出 p标称、φ₀=0、m=1。接下来逐项暴露问题：频带位置是否对准，共同相位是否校正。这里 p 与后文 k 表示同一照明波矢。', '受控对照：重用本批已分离频带，构造 m=1、共同相位 π 的三帧；并非本批实测参数。'],
      'vector-failure': ['第一重崩塌：只差 0.3 格，也没有对准。', '橙色 +1 级按 −p标称归位。放大重叠区后，两层频谱纹理不再逐点对应；右侧显示这组错误波矢实际重建出的边缘偏差与重影。', '本阶段先校正共同相位，隔离波矢误差。0.3 是输入的频域像素误差；热漂移或光路变化可造成偏差，空间畸变则可能超出单一波矢模型。'],
      'phase-failure': ['第二重崩塌：相位相反，相加反而相消。', '保持刚才的波矢误差，再省略初相位校正。相位特写取已对齐的同一 q：当共同相位为 π，两根指针反向；右侧由逆 FFT 得到错误重建与负值下冲。', '红色表示数值下冲，曲线保留负值。π 是特意选择的相消示例；一般相位误差不一定完全反向，0.3 格误差也不保证产生相同程度的伪影。'],
      substitute: ['把待求参数，代回照明公式。', '将 k̂、m̂ 和 φ′ⱼ+φ̂Δ 放入对应位置，得到估计照明 Îⱼ。帽号表示待求估计量，这里先展示它们的作用。', 'φ′ⱼ=2πj/3 是已知且准确的帧间相对相移；φ̂Δ 是待估计的共同偏移，尚未求值。'],
      model: ['三帧只改变已知的相对相位。', '下面改用无帽号的实际参数写观测方程。同一方向的三帧共用 k、m、φΔ，只有 φ′ⱼ 随帧号改变。', '本例假设样品、OTF、照明平均强度和调制度在三帧间不变；无噪声推导下成立。'],
      expand: ['展开余弦，把共同相位提出去。', '用欧拉公式拆成 0、+1、−1 三项，再将 e^{±i(φ′ⱼ+φΔ)} 拆成两个因子：随帧变化的相位，与三帧共用的相位。', 'dⱼ=(sIⱼ)∗h，经傅里叶变换得到 Dⱼ；这里没有把未知参数设成已知值。'],
      absorb: ['共同幅相，吸收到未知频带里。', 'm 与 φΔ 合成不随帧号变化的复系数 c±，与 H·S 一起归入 Ã±₁。k 仍在 S(f∓k) 的平移地址里，整个频带作为未知量求解。', '这里把未知量重新分组：只吸收共同幅相；并没有把波矢 k 变成一个标量系数。'],
      demix: ['已知相移，就能先解出三个临时频带。', '对三帧求和提取 0 级；乘 e^{∓iφ′ⱼ} 后求和提取 ±1 级。三相正交使另外两项相消，无需预先知道 k、m 或 φΔ。', '1/2 来自余弦展开，所以旁带权重为 2/3。若实际帧间相移偏离已知值，会出现级次串扰。'],
      ready: ['先粗分离，再从公共区估计参数。', '现在得到 Ã=ŨD：0 级为 H·S，旁带还带着共同幅相。接下来比较 0 级与 +1 级的公共信息，求 k̂、m̂ 和 φ̂Δ。', '粗分离只完成级次分开；幅相校正与频带归位仍需参数估计。依据 fairSIM 2016，Supplementary Note 1。'],
    }[s.mode];
    return { equation: provisionalFormulas[s.formulaKey], title: content[0], copy: content[1], note: content[2] };
  }
  // Prepend the host-owned split without speeding up the existing public-area
  // lesson. Both views sample this same clock, including reverse playback.
  const sharedEntryDuration = 12000;
  const sharedDuration = sharedEntryDuration + Study.scene('shared').duration;
  const temporaryBands = Object.freeze([
    { order: 0, color: '#7ad5cd', symbol: String.raw`\widetilde A_0(\mathbf f)`, rhs: String.raw`H(\mathbf f)S(\mathbf f)`, x: 720, finalX: 900 },
    { order: 1, color: '#b7a5eb', symbol: String.raw`\widetilde A_{+1}(\mathbf f)`, rhs: String.raw`m e^{i\phi_\Delta}H(\mathbf f)S(\mathbf f-\mathbf k)`, x: 360, finalX: 480 },
    { order: -1, color: '#efb879', symbol: String.raw`\widetilde A_{-1}(\mathbf f)`, rhs: String.raw`m e^{-i\phi_\Delta}H(\mathbf f)S(\mathbf f+\mathbf k)`, x: 1080, finalX: 1080 },
  ].map(Object.freeze));
  function sharedEntryState(progress) {
    const elapsed = Story.clamp(progress) * sharedDuration, p = Story.clamp(elapsed / sharedEntryDuration), r = Story.ramp;
    const split = r(p, .30, .52), settle = r(p, .82, .96), reveal = r(p, .32, .40);
    const negative = 1 - .75 * r(p, .66, .74) - .25 * r(p, .74, .82);
    return { progress: p, lessonProgress: Story.clamp((elapsed - sharedEntryDuration) / Study.scene('shared').duration),
      handoff: r(p, 0, .06), nominal: 1, split, reveal,
      source: 1 - r(p, .30, .40), pictures: r(p, .50, .62), negative, settle,
      labels: 1 - r(p, .94, 1), context: r(p, .94, 1),
      bands: temporaryBands.map(b => ({ order: b.order, x: b.x + (b.finalX - b.x) * settle,
        titleX: 672.48 + (b.x - 672.48) * split + (b.finalX - b.x) * settle,
        titleY: 85 + 164 * split, alpha: reveal * (b.order === -1 ? negative : 1) })) };
  }
  function sharedEntryFormulaAt(progress) {
    const s = sharedEntryState(progress), p = s.progress;
    const title = p < .30 ? '把刚才的粗分离，应用到这组三帧。' : p < .66 ? '从一个向量，展开三个临时级次。'
      : '先保留 0 级与 +1 级，寻找共同信息。';
    const note = p < .30 ? 'Ũ 只依赖已知相对相移；未知的 m 与 φΔ 留在临时旁带中，并未被设成实际值 1 与 0。'
      : p < .66 ? '三份临时频带都来自同一组三帧；旁带仍保留未知的 m 与共同相位偏移。'
      : '−1 级只退出当前比较画面；其数据保留，后面的正式重建仍使用三个级次。';
    return { title, copy: p < .66 ? '沿用同一批观测：青色 0 级、紫色 +1 级、橙色 −1 级，图像与下方公式一一对应。'
      : '−1 级图像与公式一起淡出；留下的两份频谱继续用于说明公共区与参数估计。', note,
      equation: '$$' + temporaryBands.map(b => '{\\color{' + b.color + '}' + b.symbol + '=' + b.rhs + '}').join('\\qquad') + '$$' };
  }
  const bridges = [
    { ...provisionalFormulaAt({ progress: 1 }), id: 'provisional-split', label: '为何能粗分离', duration: provisionalDuration },
    { id: 'adopted-weights', label: '填回参数', title: '参数填回去，权重就能算出来。',
      copy: '三个方向各自求出参数。将方向 1 的相位和调制度填入 M，得到正式解混用的 U；波矢留给后面的归位。',
      equation: String.raw`$$\begin{gathered}\widehat\phi_j=\phi'_j+\widehat\phi_\Delta,\qquad U=M^{-1}\\M_{j,:}=\begin{bmatrix}1&\frac{\widehat m}{2}e^{i\widehat\phi_j}&\frac{\widehat m}{2}e^{-i\widehat\phi_j}\end{bmatrix}\end{gathered}$$`,
      note: '矩阵与权重都由实际估计值计算；波矢另供频带归位。下文 m、φⱼ、k 指采用的估计值，频带继续记为 A。', duration: 12000 },
  ];

  function plan(motionModel) {
    const { scenes, parameterSlot: slot } = motionModel;
    const after = scenes.findIndex(scene => scene.id === slot.after);
    if (after < 0 || scenes[after + 1]?.id !== slot.before) throw new Error('Motion 参数章节的前后锚点不匹配。');
    const inserted = sceneIds.map(id => ({ ...Study.scene(id), ...(id === 'shared' ? { duration: sharedDuration } : {}), id: 'parameters.' + id,
      owner: 'parameters', sceneId: id, chapter: '05 / 参数估计 · ' + (Study.scene(id).phase === 'position' ? '① 找位置' : '② 求幅相'), formulaDomain: '频域 · 参数估计',
    }));
    const existing = scenes.map((scene, legacyPosition) => ({ ...scene, owner: 'motion',
      sceneId: scene.id, legacyPosition,
      chapter: legacyPosition < 10 ? scene.chapter : legacyPosition < 12 ? '06 / 正式解混'
        : legacyPosition < 14 ? '07 / 频带归位' : legacyPosition < 17 ? '08 / 多方向覆盖'
        : legacyPosition < 21 ? '09 / Wiener 融合' : '10 / 图像与验证' }));
    const bridgeStops = bridges.map(scene => ({ ...scene, owner: 'bridge', sceneId: scene.id,
      chapter: scene.id === 'provisional-split' ? '05 / 粗分离原理' : '06 / 正式解混',
      formulaDomain: scene.id === 'provisional-split' ? '照明模型 → 参数估计' : '频域 · ' + scene.label }));
    // The production path proceeds directly from adopted weights to applying
    // them. The base model keeps its proof choreography for isolated algebra
    // checks, while this timeline omits the repeated verification stop.
    const continuation = existing.slice(after + 1).filter(scene => scene.id !== 'verify-demix');
    const stops = [...existing.slice(0, after + 1), bridgeStops[0], ...inserted, bridgeStops[1], ...continuation];
    const extra = inserted.length + bridgeStops.length, end = after + extra;
    const index = id => stops.findIndex(stop => stop.id === id);
    const legacyToFlow = new Map(stops.filter(s => s.owner === 'motion').map((s, i) => [s.legacyPosition, index(s.id)]));
    const baseTime = time => time <= after ? time : time <= end ? after : time <= end + 1
      ? 10.28 + .72 * motionModel.clamp((time - end - .12) / .88) : time - extra + 1;
    const sceneIndex = time => time <= after ? motionModel.sceneIndex(time) : time <= end ? Math.ceil(time - 1e-9)
      : time < end + 1 ? (time - end < .12 - 1e-9 ? end : end + 1)
      : legacyToFlow.get(motionModel.sceneIndex(baseTime(time)));
    function frame(time) {
      time = motionModel.clamp(time, 0, stops.length - 1);
      const target = Math.ceil(time - 1e-9), stop = stops[target], progress = time - target + 1;
      return { ...stop, index: sceneIndex(time), target, progress,
        baseTime: baseTime(time) };
    }
    // One interval ends at each stop, including the first estimation scene.
    const durations = stops.slice(1).map(stop => stop.duration ?? motionModel.transitionDurations[stop.legacyPosition - 1]);
    const pacing = Object.fromEntries(stops.slice(1).flatMap((stop, interval) => {
      const points = motionModel.transitionPacing?.[stop.legacyPosition - 1];
      return points ? [[interval, points]] : [];
    }));
    return { active: true, slot, stops, scenes: stops, durations, pacing, sceneIndex, frame, index };
  }

  function create(options = {}) {
    if (!options.raw || !options.config) throw new Error('嵌入章节需要宿主提供 raw 与 config，不能自行重新采集。');
    const direction = options.direction ?? 0;
    const lesson = Story.createLesson({ raw: options.raw, config: options.config, direction, truth: options.truth });
    let reconstruction = null;
    return {
      lesson, sceneIds, convention,
      state(sceneId, progress) {
        if (!sceneIds.includes(sceneId)) throw new Error('该场景由 Motion 主线负责，不属于新增估计章节。');
        return Study.stateForScene(sceneId, sceneId === 'shared' ? sharedEntryState(progress).lessonProgress : progress);
      },
      result() { return Story.getResult(lesson); },
      reconstructAll() {
        if (!reconstruction) {
          const estimated = Estimator.estimateDataset(options.raw, options.config);
          if (!estimated.ok) throw new Error(estimated.reason);
          reconstruction = Estimator.reconstructDataset(options.raw, estimated);
        }
        return reconstruction;
      },
    };
  }
  const api = { sceneIds, convention, bridges, provisionalState, provisionalSteps, provisionalFormulaAt, provisionalFormulas,
    provisionalDuration, provisionalContentDuration, nominalPreludeDuration, provisionalProgress, nominalFailureState, createNominalFailure,
    sharedEntryDuration, sharedDuration, sharedEntryState, sharedEntryFormulaAt, temporaryBands,
    parameterColors, parameterBox, illuminationTex, substitutedIlluminationTex, actualIlluminationTex, nominalObservationTex, plan, create };
  if (node) module.exports = api; else root.SIMMotionParameterChapter = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
