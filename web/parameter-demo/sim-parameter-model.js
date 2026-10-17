/* Eight estimation scenes between Motion's provisional and formal demixing.
 * One interval per scene: the local playhead runs from 0 to scenes.length.
 * The first interval is animated too; a host addresses scene/progress directly. */
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const E = node ? require('../shared/sim-parameter-estimation.js') : root.SIMParameterEstimation;
  const F = (node ? require('../shared/sim-band-formulas.js') : root.SIMBandFormulas).formulas;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
  const ramp = (t, a, b) => smooth((t - a) / (b - a));
  // These are LaTeX builders, not extra physical variables. Keep the original
  // band names and detection coordinates in every OTF-corrected expression.
  const zero = String.raw`\frac{\widetilde A_0(\mathbf q)}{H(\mathbf q)}`;
  const side = shift => String.raw`\frac{\widetilde A_{+1}(\mathbf q+${shift})}{H(\mathbf q+${shift})}`;
  const cross = shift => String.raw`\sum_{\Omega}\left(${zero}\right)^*${side(shift)}`;
  const energy = String.raw`\sum_{\Omega}\left|${zero}\right|^2`;
  const score = String.raw`$$\rho(\mathbf k')=\frac{\left|${cross(String.raw`\mathbf k'`)}\right|}{\sqrt{\left(${energy}\right)\left(\sum_{\Omega}\left|${side(String.raw`\mathbf k'`)}\right|^2\right)}}$$`;
  const ratio = String.raw`$$\widehat m e^{i\widehat\phi_\Delta}=\frac{${cross(String.raw`\widehat{\mathbf k}`)}}{${energy}}$$`;
  const scenes = [
    { id: 'shared', label: '同源信息', chapter: '01 / 承接临时分离', title: '沿用刚才的频带，寻找同一份样品信息。',
      copy: '这里接收临时 0 级与 +1 级。A 的下标表示级次，波浪号表示照明幅相尚未补偿。',
      equation: String.raw`$$\begin{aligned}\widetilde A_0(\mathbf q)&=H(\mathbf q)\,\underbrace{S(\mathbf q)}_{\text{同一样品信息}}\\\widetilde A_{+1}(\mathbf q+\mathbf k)&=m e^{i\phi_\Delta}H(\mathbf q+\mathbf k)\,\underbrace{S(\mathbf q)}_{\text{同一样品信息}}\end{aligned}$$`,
      note: '仍是同一组三帧。选 0 级与 +1 级作估计，同色标记追踪同一样品频率。实际相位为 φⱼ = φ′ⱼ + φΔ，名义相位 φ′ⱼ = 2πj/3；相对步进假设准确。' },
    { id: 'correlation', label: '实数相关', chapter: '02 / 相关怎样匹配', title: '尝试移动，逐点相乘，再相加。',
      copy: '沿用“1、4、2”的教学序列，依次尝试左移 0—4 格。每一列先显示乘积，再累计成这个位移的分数。',
      equation: String.raw`$$\text{移动 }\delta\text{ 格的分数}=\sum_q\bigl[\text{0 级在 }q\text{ 的值}\bigr]\bigl[\text{旁带在 }q+\delta\text{ 的值}\bigr]$$`,
      note: '实数教学例：OTF 已校正，m = 1、φΔ = 0；范围外补零、不循环回绕。这里是原始乘积和，回到相机数据后再做能量归一化。' },
    { id: 'conjugate', label: '一维复数匹配', chapter: '02 / 相关怎样匹配', title: '仍用这一排格子，只给数值加入相位。',
      copy: '沿用左移两格后的 1、4、2。先给教学值加入相位，再在同一列取共轭、相乘，最后累计各列；每一步都接着上一幕。',
      equation: String.raw`$$\left|\sum_{\text{一行对应点}}\text{0 级值}^{*}\times\text{旁带值}\right|$$`,
      note: '明确的一维教学例：幅度仍为 1、4、2，旁带右移两格，另加共同相位 30°。教学值不进入实际估计或重建。' },
    { id: 'overlap', label: '公共区匹配', chapter: '03 / 估计波矢', title: '回到实际频带，只比较可信的公共区。',
      copy: '0 级固定，+1 级随候选 k′ 移动。只在两边 OTF 都足够强的区域，比较各自除以 OTF 后的复数值。',
      equation: score,
      note: 'ρ 将完整公共区的复数和按两边能量归一化，不能用上一幕抽样箭头的长度替代。亮区 Ω 要求两边 H ≥ 0.15，随候选 k′ 改变。' },
    { id: 'coarse', label: '相关峰定位', chapter: '03 / 估计波矢', title: '得分最高的位置，给出波矢初值。',
      copy: '把允许范围内的整数候选排成分数图。每个位置均用公共区实际复数数据计算；峰的位置给出波矢。',
      equation: String.raw`$$\widehat{\mathbf k}_{\rm coarse}=\operatorname*{arg\,max}_{\mathbf k'}\rho(\mathbf k')$$`,
      note: '沿用上一幕的 ρ。搜索范围 3 ≤ |k′| ≤ 10 格；灰格表示未搜索或公共区不足。峰高是匹配分数，不是波矢。' },
    { id: 'refine', label: '局部细化', chapter: '03 / 估计波矢', title: '在峰附近，逐轮缩小搜索间隔。',
      copy: '围绕上轮最优点计算 5 × 5 个候选，三轮间隔为 0.25、0.05、0.01 格，再由波矢换算方向角与条纹周期。',
      equation: String.raw`$$\widehat\theta=\operatorname{atan2}(\widehat k_y,\widehat k_x),\qquad\widehat p=\frac{N}{\sqrt{\widehat k_x^2+\widehat k_y^2}}$$`,
      note: 'θ 表示波矢方向角，φ 表示照明相位。0.01 是搜索网格间隔，不是精度保证；本例整数波矢可以保持不动。' },
    { id: 'fit', label: '估计幅相', chapter: '04 / 相位与调制度', title: '位置对齐后，求出两份记录的共同幅相。',
      copy: '仍用公共区的同一对复数值，累计“ 0 级共轭 × 旁带”和0 级能量，再相除。复数比同时给出 m 与 φΔ。',
      equation: ratio,
      note: '分子、分母使用同一个可信公共区，两份频带各除自己的 OTF。分母去掉样品能量的影响；全程只使用相机观测。' },
    { id: 'read', label: '估计结果', chapter: '04 / 参数估计结果', title: '角度给相位，长度给调制度。',
      copy: '上一幕复数比的角度是 φΔ，长度是 m。补上名义相位，得到各帧实际相位的估计；与波矢、调制度一起用于正式解混。',
      equation: F.handoff,
      note: '将估计参数代入解混权重 uℓⱼ，正式分离全部级次，再按估计波矢归位。' },
  ];
  const durations = [30000, 20000, 32000, 12000, 6500, 9000, 8000, 9000];
  const index = id => scenes.findIndex(scene => scene.id === id);
  const teachingEquations = {
    source: F.provisional,
    substitute: String.raw`$$\begin{gathered}A_{+1}(\mathbf f)=H(\mathbf f)S(\mathbf f-\mathbf k)\\\mathbf f-\mathbf k=\mathbf q\ \Longrightarrow\ \mathbf f=\mathbf q+\mathbf k,\qquad S((\mathbf q+\mathbf k)-\mathbf k)=S(\mathbf q)\end{gathered}$$`,
    shared: scenes[index('shared')].equation,
    corrected: String.raw`$$\begin{aligned}${zero}&=S(\mathbf q)\\${side(String.raw`\mathbf k`)}&=m e^{i\phi_\Delta}S(\mathbf q)\end{aligned}$$`,
    copies: String.raw`$$\text{一维教学例：}\quad H=1,\ m=1,\ \phi_\Delta=0,\ k=2;\qquad\widetilde A_0(f)=S(f),\quad\widetilde A_{+1}(f)=S(f-2)$$`,
    aligned: String.raw`$$\widetilde A_{+1}(q+2)=S\!\left(\underbrace{(q+2)-2}_{q}\right)=S(q)=\widetilde A_0(q)$$`,
    real: scenes[index('correlation')].equation,
    peak: String.raw`$$\text{移动 2 格的分数}=1\times1+4\times4+2\times2=21,\qquad\text{最佳位移}=2\ \text{格}$$`,
  };
  const teachingNotes = {
    source: 'Aℓ 包含检测 OTF，不含照明系数。波浪号标记临时输出，不代表再次做傅里叶变换；+1 级仍乘着未知 m 和共同相位。',
    substitute: '要比较同一样品频率 q：0 级取 q，+1 级取 q+k，因为 (q+k)−k=q。此处解释位置关系，尚未求出 k。',
    shared: '两边都包含同一个 S(q)。同色标记追踪它的两个记录位置；OTF 衰减和照明比例不同，数值未必相同。',
    corrected: '在两边 OTF 都可靠的公共区，分别除对应 H。继续使用原来的频带记号，比较的仍是同一样品信息。',
    copies: '下面另设一维教学例：同一段 1、4、2 在 +1 级中向右错两格。这些是移动与相乘的教学值，不是前面频谱标记的实际读数。',
    aligned: '将 +1 级向左移两格，(q+2)−2=q，同一段内容对齐。真实数据中的 k 仍要通过相关搜索得到。',
  };
  // Keep the preceding one-dimensional sum; introduce only the conjugate and
  // magnitude when their graphic operations occur. No isolated arg identity.
  const complexSteps = [
    { id: 'pair', equation: String.raw`$$\sum_{\text{一行对应点}}\text{0 级值}\times\text{旁带值}$$`,
      note: '仍是左移两格的教学例；箭头长度保留 1、4、2，方向逐渐加入教学相位。先看同一列的两个输入。' },
    { id: 'conjugate', equation: String.raw`$$\sum_{\text{一行对应点}}\text{0 级值}^{*}\times\text{旁带值}$$`,
      note: '在原来的乘积和中加入星号：只将 0 级箭头镜像，相位取反，长度不变；旁带保持不动。' },
    { id: 'multiply', equation: String.raw`$$\sum_{\text{一行对应点}}\text{0 级值}^{*}\times\text{旁带值}$$`,
      note: '放大这一列：0 级原相位 60°，旁带相位 90°。共轭后相乘，乘积相位为 90°−60°=30°，长度为 4×4=16。' },
    { id: 'sum', equation: String.raw`$$\sum_{\text{一行对应点}}\text{0 级值}^{*}\times\text{旁带值}$$`,
      note: '对其余非零列重复相同操作，逐列累计乘积。每列消去自身样品相位后，都保留共同的教学相位 30°。' },
    { id: 'magnitude', equation: String.raw`$$\left|\sum_{\text{一行对应点}}\text{0 级值}^{*}\times\text{旁带值}\right|$$`,
      note: '三项复数先相加，最后取合成箭头的长度，仍为 21。30° 留在合成方向里；接下来再将同样运算扩展到二维实际频谱。' },
  ];
  function complexState(progress) {
    const p = clamp(progress), phase = p < .22 ? 'pair' : p < .38 ? 'conjugate' : p < .53 ? 'multiply' : p < .85 ? 'sum' : 'magnitude';
    const travel = ramp(p, .55, .81) * 3, completed = Math.floor(travel), local = travel === 3 ? 1 : travel - completed;
    return { phase, phaseReveal: ramp(p, .04, .18), conjugate: ramp(p, .22, .32), multiply: ramp(p, .38, .47),
      accumulation: travel / 3, completed, selected: Math.min(2, completed),
      productReveal: phase === 'sum' ? (completed === 0 ? 1 : ramp(local, .10, .40)) : phase === 'magnitude' ? 1 : ramp(p, .38, .47),
      commit: phase === 'sum' ? ramp(local, .52, .85) : phase === 'magnitude' ? 1 : 0,
      measure: ramp(p, .85, .94) };
  }
  function createComplexTeachingExample() {
    const example = createTeachingExample(), phases = [0, 0, Math.PI / 3, -Math.PI / 3, 0, 0];
    const commonPhase = Math.PI / 6, shift = 2;
    const polar = (length, phase) => ({ re: length * Math.cos(phase), im: length * Math.sin(phase) });
    const zero = example.u.map((length, f) => polar(length, phases[f]));
    const side = Array.from({ length: 8 }, (_, f) => polar(example.u[f - shift] || 0, (phases[f - shift] || 0) + commonPhase));
    const columns = example.frequencies.map(f => {
      const x = zero[f] || { re: 0, im: 0 }, y = side[f + shift] || { re: 0, im: 0 };
      return { f, x, y, amplitude: example.u[f] || 0, zeroPhase: phases[f] || 0,
        sidePhase: (phases[f] || 0) + commonPhase,
        cross: { re: x.re * y.re + x.im * y.im, im: x.re * y.im - x.im * y.re } };
    });
    const order = [2, 1, 3].map(f => columns.findIndex(c => c.f === f));
    const sums = [{ re: 0, im: 0 }];
    order.forEach(i => { const prior = sums[sums.length - 1], z = columns[i].cross; sums.push({ re: prior.re + z.re, im: prior.im + z.im }); });
    return { ...example, zero, side, columns, order, sums, commonPhase, shift, magnitude: Math.hypot(sums[3].re, sums[3].im) };
  }
  function createComplexComparison(aligned, misaligned, maxPoints = 4) {
    // Pick visible imaginary components so the conjugation is legible. This
    // illustration never changes the points or scores used by the estimator.
    const other = new Map(misaligned.points.map(point => [point.q.join(','), point]));
    const common = aligned.points.filter(point => other.has(point.q.join(',')));
    const points = [...common].sort((a, b) => Math.abs(b.x.im) - Math.abs(a.x.im) || b.energy - a.energy).slice(0, maxPoints);
    const summarize = (candidate, chosen) => {
      const path = [{ re: 0, im: 0 }]; let energyX = 0, energyY = 0;
      chosen.forEach(point => {
        const prior = path[path.length - 1];
        path.push({ re: prior.re + point.cross.re, im: prior.im + point.cross.im });
        energyX += point.x.re ** 2 + point.x.im ** 2; energyY += point.y.re ** 2 + point.y.im ** 2;
      });
      const sum = path[path.length - 1], magnitude = Math.hypot(sum.re, sum.im);
      return { kx: candidate.kx, ky: candidate.ky, points: chosen, sum, path, magnitude, energyX, energyY,
        score: energyX > 0 && energyY > 0 ? Math.min(1, magnitude / Math.sqrt(energyX * energyY)) : 0 };
    };
    return { points, aligned: summarize(aligned, points),
      misaligned: summarize(misaligned, points.map(point => other.get(point.q.join(',')))), count: points.length };
  }
  function createTeachingExample() {
    const u = [0, 1, 4, 2, 0, 0], v = [0, 0, 0, 1, 4, 2], frequencies = [-1, 0, 1, 2, 3, 4, 5];
    const read = (sequence, f) => sequence[f] ?? 0;
    const real = Array.from({ length: 5 }, (_, delta) => {
      const products = frequencies.map(f => read(u, f) * read(v, f + delta));
      return { delta, products, score: products.reduce((sum, term) => sum + term, 0) };
    });
    return { u, v, frequencies, real };
  }
  function teachingState(progress) {
    const formula = progress < .18 ? 'source' : progress < .36 ? 'substitute' : progress < .50 ? 'shared' : progress < .66 ? 'corrected' : progress < .91 ? 'copies' : 'aligned';
    return { formula, handoff: ramp(progress, 0, .18), zeroCoordinate: ramp(progress, .18, .24),
      sideCoordinate: ramp(progress, .24, .29), expandArgument: ramp(progress, .29, .32),
      cancelArgument: ramp(progress, .32, .36), correction: ramp(progress, .50, .58),
      markers: ramp(progress, .36, .47), abstract: ramp(progress, .66, .73), copies: ramp(progress, .76, .88), align: ramp(progress, .91, .99) };
  }
  function realCorrelationState(progress) {
    const p = clamp(progress), travel = clamp((p - .08) / .78) * 5, candidate = Math.min(4, Math.floor(travel)), local = travel === 5 ? 1 : travel - candidate;
    const best = ramp(p, .90, .97), from = Math.max(0, candidate - 1), shift = from + (candidate - from) * ramp(local, 0, .20);
    return { candidate: best === 1 ? 2 : candidate, shift: shift + (2 - shift) * best, products: Math.floor(ramp(local, .24, .67) * 7), completed: candidate + (local >= .86 ? 1 : 0),
      score: ramp(local, .70, .86), table: ramp(local, .21, .24) * (best > 0 && best < 1 ? 0 : 1), best };
  }
  function formulaAt(s) {
    if (s.id === 'shared') {
      const mode = s.teaching.formula;
      return { equation: teachingEquations[mode], note: teachingNotes[mode] };
    }
    if (s.id === 'correlation') return { equation: teachingEquations[s.real.best === 1 ? 'peak' : 'real'], note: scenes[s.step].note };
    if (s.id === 'conjugate') { const row = complexSteps.find(step => step.id === s.complex.phase); return { equation: row.equation, note: row.note }; }
    return { equation: scenes[s.step].equation, note: scenes[s.step].note };
  }

  function createLesson(options = {}) {
    // A host supplies the observations and known acquisition conditions once.
    // Do not regenerate exposures or consult illumination metadata on raw frames.
    const external = Object.prototype.hasOwnProperty.call(options, 'raw');
    if (external && (!options.raw || !options.config)) throw new Error('外部观测需要同时提供 raw 与 config。');
    const capture = external ? {
      raw: options.raw,
      config: { ...E.defaults, ...options.config, n: options.config.n ?? options.raw.n ?? E.defaults.n },
      truth: options.truth ?? null,
    } : options.capture || E.capture(options);
    const direction = options.direction ?? 0;
    const group = capture.raw.groups[direction];
    if (!group) throw new Error('所选方向不存在。');
    const estimate = E.estimate(group, capture.config);
    if (!estimate.ok) throw new Error(estimate.reason);
    const bridge = E.reconstruct(group, estimate), points = estimate.fit.points;
    if (bridge.modulationFallback) throw new Error('估计调制度触发了重建核心的回退值，不能将该结果交回主线。');
    const candidates = [[estimate.coarseBest.kx - 2, estimate.coarseBest.ky], [estimate.coarseBest.kx - 1, estimate.coarseBest.ky], [estimate.coarseBest.kx, estimate.coarseBest.ky]].map(k => E.compare(estimate.context, ...k, true));
    const sums = [{ re: 0, im: 0, energy: 0 }];
    points.forEach(point => { const prior = sums[sums.length - 1]; sums.push({ re: prior.re + point.cross.re, im: prior.im + point.cross.im, energy: prior.energy + point.energy }); });
    const correspondence = [[-2, -3], [-1, -2], [0, -2]].map((q, j) => points.find(p => p.q[0] === q[0] && p.q[1] === q[1]) || points[j]);
    let complexComparison = createComplexComparison(estimate.fit, candidates[0]);
    // A host may use a direction near the search boundary. Choose a nearby
    // candidate if the first illustrative candidate shares no valid points.
    if (!complexComparison.count) complexComparison = createComplexComparison(estimate.fit, candidates[1]);
    if (!complexComparison.count) complexComparison = createComplexComparison(estimate.fit, E.compare(estimate.context, estimate.kx + .01, estimate.ky, true));
    return { capture, direction, group, estimate, bridge, candidates, sums, teaching: createTeachingExample(), complexTeaching: createComplexTeachingExample(), correspondence, complexComparison };
  }
  function getResult(lesson) {
    const e = lesson.estimate;
    return { direction: lesson.group.index, kx: e.kx, ky: e.ky, phase: e.phase, m: e.m, phases: [...e.phases], angle: e.angle, period: e.period,
      provisionalBands: e.context.separated.bands, formalGroup: lesson.bridge.pipeline.groups[0], rawGroup: lesson.group,
      convention: { bandOrders: [0, 1, -1], frequencyUnit: 'DFT bins', xAxis: 'right', yAxis: 'down',
        forwardExponent: -1, positiveBandPhaseSign: 1, positiveBand: 'Ã₊₁(f) = m exp(+i phase) H(f) S(f-k)' } };
  }
  function sceneState(step, progress) {
    return { position: step + progress, step, id: scenes[step].id, progress, enter: step === 0 ? 1 : ramp(progress, 0, .16),
      teaching: teachingState(progress), real: realCorrelationState(progress), complex: complexState(progress),
      candidateTravel: ramp(progress, .23, .42) + ramp(progress, .58, .78),
      round: Math.min(2, Math.floor(ramp(progress, .12, .90) * 3)),
      accumulation: ramp(progress, .15, .80), phaseRead: ramp(progress, .15, .52), modulationRead: ramp(progress, .60, .92) };
  }
  function stateForScene(id, progress = 1) {
    const step = index(id);
    if (step < 0) throw new Error('未知参数估计场景：' + id);
    if (!Number.isFinite(progress)) throw new Error('场景进度必须是有限数值。');
    const p = clamp(progress);
    return sceneState(step, p);
  }
  function state(position) {
    const t = clamp(position, 0, scenes.length), step = clamp(Math.ceil(t - 1e-9) - 1, 0, scenes.length - 1);
    return sceneState(step, clamp(t - step));
  }
  function candidateAt(lesson, travel) {
    const first = lesson.candidates[0], nearest = Math.round(travel);
    if (Math.abs(travel - nearest) < 1e-10) return lesson.candidates[clamp(nearest, 0, 2)];
    return E.compare(lesson.estimate.context, first.kx + travel, first.ky, true);
  }
  // Same stop/pause/scrub semantics as the main motion story, with local steps.
  function createPlayer(options = {}) {
    const request = options.request || requestAnimationFrame, cancel = options.cancel || cancelAnimationFrame, render = options.render || (() => {});
    const timing = options.durations || durations, lastStop = timing.length;
    if (!Array.isArray(timing) || !lastStop || timing.some(value => !Number.isFinite(value) || value <= 0)) throw new Error('场景时长必须为正数。');
    let position = 0, target = 0, playing = false, frame = 0, last = null, speed = 1, reduced = !!options.reducedMotion;
    const snapshot = () => ({ position, target, playing, speed, reduced });
    const emit = () => render(snapshot());
    function pause() { if (frame) cancel(frame); frame = 0; playing = false; last = null; emit(); }
    function tick(now) {
      frame = 0;
      if (!playing) return;
      if (last !== null) {
        const direction = Math.sign(target - position), index = direction > 0 ? Math.floor(position + 1e-9) : Math.ceil(position - 1e-9) - 1;
        const delta = Math.min(64, Math.max(0, now - last)) * speed / timing[clamp(index, 0, timing.length - 1)];
        position = direction > 0 ? Math.min(target, position + delta) : Math.max(target, position - delta);
      }
      last = now;
      if (Math.abs(target - position) < 1e-9) { position = target; playing = false; last = null; }
      if (playing) frame = request(tick);
      emit();
    }
    function go(value) {
      if (!Number.isFinite(value)) return;
      pause(); target = clamp(value, 0, lastStop);
      if (reduced || Math.abs(target - position) < 1e-9) { position = target; emit(); return; }
      playing = true; frame = request(tick); emit();
    }
    function seek(value) { if (!Number.isFinite(value)) return; pause(); position = target = clamp(value, 0, lastStop); emit(); }
    function navigate(direction) { if (playing || !direction) return; go(direction > 0 ? Math.floor(position + 1e-8) + 1 : Math.ceil(position - 1e-8) - 1); }
    return { state: snapshot, go, seek, navigate, pause,
      toggle() { if (playing) pause(); else if (Math.abs(target - position) > 1e-8) go(target); else navigate(1); },
      setSpeed(value) { if (Number.isFinite(value) && value > 0) { speed = clamp(value, .25, 3); emit(); } },
      setReducedMotion(value) { reduced = !!value; if (reduced) seek(target); else emit(); }, destroy: pause };
  }
  const api = { scenes, durations, index, bandFormulas: F, teachingEquations, complexSteps, complexState, createComplexTeachingExample, createComplexComparison, createTeachingExample, teachingState, realCorrelationState, createLesson, getResult, state, stateForScene, formulaAt, candidateAt, createPlayer, clamp, ramp };
  if (node) module.exports = api; else root.SIMParameterStory = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
