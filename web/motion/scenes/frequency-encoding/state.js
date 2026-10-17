/* Scene-owned deterministic state and formula choreography. */
(function(root) {
  'use strict';
  function create({ ramp, lerp, clamp, orders, colors }) {
  const encodingFormulaTokens = Object.freeze([
    ['ex', String.raw`e_j(x)`, 88, null, 'ex', 'er'],
    ['er', String.raw`e_j(\mathbf r)`, 88, null, 'ex', 'eft'],
    ['eft', String.raw`\mathcal F_N\{e_j(\mathbf r)\}`, 176, null, 'er', 'ef'],
    ['ef', String.raw`E_j(\mathbf f)`, 98, null, 'eft'],
    ['equals', '=', 28],
    ['s0x', 's(x)', 68, 0, 's0x', 's0r'],
    ['s0r', String.raw`s(\mathbf r)`, 72, 0, 's0x', 'S0'],
    ['S0', String.raw`S(\mathbf f)`, 82, 0, 's0r'],
    ['open', '[', 16, null, 'open', 's0x'],
    ['one', '1', 23, 0, 'one', 's0x'],
    ['plus0', '+', 28],
    ['mPlus', 'm', 30, 1],
    ['barPlus', String.raw`\rule{.85em}{.045em}`, 30, 1, 'mPlus', 'mPlus'],
    ['denPlus', '2', 30, 1, 'mPlus', 'mPlus'],
    ['cosine', String.raw`\cos\!\left(\frac{2\pi x}{p}+\phi_j\right)`, 244, null, 'cosine', 'cosTheta'],
    ['cosTheta', String.raw`\cos\theta`, 110, null, 'cosine', 'exponentPlusTheta'],
    ['exponentPlusTheta', String.raw`e^{i\theta}`, 64, 1, 'cosTheta', 'exponentPlusAngle'],
    ['exponentMinusTheta', String.raw`e^{-i\theta}`, 80, 2, 'cosTheta', 'exponentMinusAngle'],
    ['exponentPlusAngle', String.raw`e^{i(2\pi x/p+\phi_j)}`, 204, 1, 'exponentPlusTheta', 'carrierPlusX'],
    ['exponentMinusAngle', String.raw`e^{-i(2\pi x/p+\phi_j)}`, 220, 2, 'exponentMinusTheta', 'carrierMinusX'],
    ['innerOpen', '(', 16, null, 'cosine', 'sPlusX'],
    ['phasePlus', String.raw`e^{i\phi_j}`, 60, 1, 'exponentPlusAngle'],
    ['sPlusX', 's(x)', 68, 1, 's0x', 'sPlusR'],
    ['sPlusR', String.raw`s(\mathbf r)`, 72, 1, 'sPlusX', 'SPlus'],
    ['carrierPlusX', String.raw`e^{2\pi ix/p}`, 124, 1, 'exponentPlusAngle', 'carrierPlusR'],
    ['carrierPlusR', String.raw`e^{2\pi i\mathbf k\cdot\mathbf r/N}`, 166, 1, 'carrierPlusX', 'SPlus'],
    ['plus1', '+', 28, null, 'cosine'],
    ['mMinus', 'm', 30, 2, 'mPlus'],
    ['barMinus', String.raw`\rule{.85em}{.045em}`, 30, 2, 'barPlus'],
    ['denMinus', '2', 30, 2, 'denPlus'],
    ['phaseMinus', String.raw`e^{-i\phi_j}`, 72, 2, 'exponentMinusAngle'],
    ['sMinusX', 's(x)', 68, 2, 's0x', 'sMinusR'],
    ['sMinusR', String.raw`s(\mathbf r)`, 72, 2, 'sMinusX', 'SMinus'],
    ['carrierMinusX', String.raw`e^{-2\pi ix/p}`, 140, 2, 'exponentMinusAngle', 'carrierMinusR'],
    ['carrierMinusR', String.raw`e^{-2\pi i\mathbf k\cdot\mathbf r/N}`, 182, 2, 'carrierMinusX', 'SMinus'],
    ['innerClose', ')', 16, null, 'cosine', 'carrierMinusX'],
    ['close', ']', 16, null, 'close', 'carrierMinusX'],
    ['F0', String.raw`\mathcal F_N\{`, 78, 0, 's0r', 'S0'],
    ['end0', String.raw`\}`, 20, 0, 's0r', 'S0'],
    ['FPlus', String.raw`\mathcal F_N\{`, 78, 1, 'sPlusR', 'SPlus'],
    ['endPlus', String.raw`\}`, 20, 1, 'carrierPlusR', 'SPlus'],
    ['FMinus', String.raw`\mathcal F_N\{`, 78, 2, 'sMinusR', 'SMinus'],
    ['endMinus', String.raw`\}`, 20, 2, 'carrierMinusR', 'SMinus'],
    ['SPlus', String.raw`S(\mathbf f-\mathbf k)`, 144, 1, 'sPlusR'],
    ['SMinus', String.raw`S(\mathbf f+\mathbf k)`, 144, 2, 'sMinusR'],
  ].map(([id, tex, width, band = null, birth = id, exit = id]) => Object.freeze({
    id, equation: `$$${tex}$$`, width, band, birth, exit,
    kind: id === 'barPlus' || id === 'barMinus' ? 'fraction-bar' : 'math',
  })));
  const encodingTokenById = Object.fromEntries(encodingFormulaTokens.map(token => [token.id, token]));
  function encodingFormulaLayout(ids) {
    const width = id => id.startsWith('fraction') ? 34 : encodingTokenById[id].width;
    const total = ids.reduce((sum, id) => sum + width(id), 0) + (ids.length - 1) * 3;
    const scale = Math.min(1, 1140 / total), poses = {};
    let left = 600 - total * scale / 2;
    for (const id of ids) {
      const x = left + width(id) * scale / 2;
      if (id.startsWith('fraction')) {
        const side = id.slice(8);
        for (const [part, offset, size] of [['m', -13, .86], ['bar', 0, 1], ['den', 15, .86]])
          poses[part + side] = { x, y: 64 + offset * scale, scale: scale * size, opacity: 1 };
      } else poses[id] = { x, y: 64, scale, opacity: 1 };
      left += (width(id) + 3) * scale;
    }
    return poses;
  }
  const encodingAlgebraLayouts = (() => {
    const cosine = encodingFormulaLayout(['ex', 'equals', 's0x', 'open', 'one', 'plus0', 'mPlus', 'cosine', 'close']);
    const theta = encodingFormulaLayout(['ex', 'equals', 's0x', 'open', 'one', 'plus0', 'mPlus', 'cosTheta', 'close']);
    const exponentPair = suffix => encodingFormulaLayout(['ex', 'equals', 's0x', 'open', 'one', 'plus0', 'fractionPlus', 'innerOpen',
      'exponentPlus' + suffix, 'plus1', 'exponentMinus' + suffix, 'innerClose', 'close']);
    const euler = encodingFormulaLayout(['ex', 'equals', 's0x', 'open', 'one', 'plus0', 'fractionPlus', 'innerOpen',
      'phasePlus', 'carrierPlusX', 'plus1', 'phaseMinus', 'carrierMinusX', 'innerClose', 'close']);
    const spatial = dimension => encodingFormulaLayout([dimension === 'X' ? 'ex' : 'er', 'equals', dimension === 'X' ? 's0x' : 's0r', 'plus0',
      'fractionPlus', 'phasePlus', 'sPlus' + dimension, 'carrierPlus' + dimension, 'plus1',
      'fractionMinus', 'phaseMinus', 'sMinus' + dimension, 'carrierMinus' + dimension]);
    const fourier = solved => encodingFormulaLayout([solved === 3 ? 'ef' : 'eft', 'equals',
      ...(solved > 0 ? ['S0'] : ['F0', 's0r', 'end0']), 'plus0', 'fractionPlus', 'phasePlus',
      ...(solved > 1 ? ['SPlus'] : ['FPlus', 'sPlusR', 'carrierPlusR', 'endPlus']), 'plus1', 'fractionMinus', 'phaseMinus',
      ...(solved > 2 ? ['SMinus'] : ['FMinus', 'sMinusR', 'carrierMinusR', 'endMinus'])]);
    return { cosine, theta, eulerTheta: exponentPair('Theta'), eulerAngle: exponentPair('Angle'), euler, spatialX: spatial('X'), spatialR: spatial('R'),
      transform: fourier(0), zero: fourier(1), positive: fourier(2), spectrum: fourier(3) };
  })();
  const encodingFormulaKeyframes = Object.freeze([
    [2, 'cosine'], [2.02, 'cosine'], [2.025, 'theta'], [2.08, 'theta'],
    [2.085, 'eulerTheta'], [2.10, 'eulerTheta'], [2.105, 'eulerAngle'], [2.12, 'eulerAngle'],
    [2.125, 'euler'], [2.14, 'euler'],
    [2.21, 'spatialX'], [2.235, 'spatialX'], [2.265, 'spatialR'], [2.28, 'spatialR'],
    [2.30, 'transform'], [2.325, 'zero'], [2.345, 'zero'], [2.37, 'positive'],
    [2.385, 'positive'], [2.415, 'spectrum'], [2.46, 'spectrum'],
  ].map(([time, layout]) => Object.freeze({ time, layout, poses: encodingAlgebraLayouts[layout] })));
  function encodingFormulaMotion(time) {
    const frames = encodingFormulaKeyframes;
    const next = frames.findIndex(frame => frame.time > time);
    const a = frames[next < 0 ? frames.length - 1 : Math.max(0, next - 1)], b = frames[next < 0 ? frames.length - 1 : next];
    const progress = a === b ? 0 : ramp(time, a.time, b.time);
    const tokens = encodingFormulaTokens.map(token => {
      const from = a.poses[token.id] || { ...(a.poses[token.birth] || b.poses[token.birth] || b.poses[token.id] || { x: 600, y: 64, scale: 1 }), opacity: 0 };
      const to = b.poses[token.id] || { ...(b.poses[token.exit] || a.poses[token.exit] || a.poses[token.id] || from), opacity: 0 };
      const changes = from.x !== to.x || from.y !== to.y;
      const arc = changes ? Math.sin(Math.PI * progress) * (token.band === 2 ? 20 : -20) : 0;
      return { id: token.id, x: lerp(from.x, to.x, progress), y: lerp(from.y, to.y, progress) + arc,
        scale: lerp(from.scale, to.scale, progress), opacity: lerp(from.opacity, to.opacity, progress) };
    });
    const park = ramp(time, 2.46, 2.52);
    return { tokens, progress, from: a.layout, to: b.layout,
      opacity: 1 - ramp(time, 2.52, 2.58), x: 180 * park, y: -19 * park, scale: 1 - .3 * park,
      theta: ramp(time, 2.02, 2.025) * (1 - ramp(time, 2.039, 2.04)),
      identity: ramp(time, 2.04, 2.045) * (1 - ramp(time, 2.059, 2.06)),
      cancel: ramp(time, 2.06, 2.065) * (1 - ramp(time, 2.079, 2.08)),
      half: ramp(time, 2.08, 2.085) * (1 - ramp(time, 2.099, 2.10)),
      substitute: ramp(time, 2.10, 2.105) * (1 - ramp(time, 2.119, 2.12)),
      factor: ramp(time, 2.12, 2.125) * (1 - ramp(time, 2.139, 2.14)),
      notation: ramp(time, 2.235, 2.245) * (1 - ramp(time, 2.279, 2.28)),
      theorem: ramp(time, 2.28, 2.30) * (1 - ramp(time, 2.44, 2.45)) };
  }
  // The captions and images follow the same algebraic progression. Euler
  // expansion is spatial algebra; the spectra appear after all three FFTs.
  const encodingDerivationStages = Object.freeze([
    { id: 'theta', start: 2.02, end: 2.04, domain: '空域 · 记下条纹总相位',
      title: '先把余弦括号里的整段，记作 θ。',
      copy: 'θ = 2πx/p + φⱼ：前一部分随位置 x 变化，后一部分是第 j 次曝光的初相位。先用 θ 缩短式子，集中看余弦怎样展开。',
      note: '这里只换记号；样品、条纹照明和荧光发射都没有改变，仍在空域。' },
    { id: 'identity', start: 2.04, end: 2.06, domain: '空域 · 正负欧拉公式',
      title: '正、负两个指数，虚部刚好相反。',
      copy: '下方先写出正指数的欧拉公式。把 θ 换成 −θ，余弦不变、正弦变号，就得到第二个式子。两式只差虚部的符号。',
      note: 'θ 为实数，因此两个指数互为共轭；i² = −1。先比较两式的实部与虚部。' },
    { id: 'cancel', start: 2.06, end: 2.08, domain: '空域 · 两式相加',
      title: '两式相加，虚部抵消，留下两份余弦。',
      copy: '+i sin θ 与 −i sin θ 相加为零；两份 cos θ 相加得到 2 cos θ。这就是实值条纹能够写成一对复指数之和的原因。',
      note: '相加后是 2 cos θ，还需要除以 2，才能替换原来的 cos θ。' },
    { id: 'half', start: 2.08, end: 2.10, domain: '空域 · 除以 2 再代入',
      title: '两边除以 2，m 就变成每项的 m/2。',
      copy: '将下方的余弦恒等式代回原来的发射式。调制度 m 乘这整个指数和，因此两个指数各自带有 m/2。',
      note: '1/2 来自欧拉恒等式，与傅里叶变换的归一化无关。' },
    { id: 'substitute', start: 2.10, end: 2.12, domain: '空域 · 代回条纹总相位',
      title: '把 θ 换回原来的条纹相位。',
      copy: '分别在正、负指数里代入 θ = 2πx/p + φⱼ。负号作用于整个括号，所以空间项和初相位都要一起变号。',
      note: '先保留指数里的完整括号，下一步再分开随位置变化的部分与固定相位。' },
    { id: 'factor', start: 2.12, end: 2.14, domain: '空域 · 指数拆成两个因子',
      title: '指数里的和，拆成相位因子乘空间因子。',
      copy: '用下方的指数乘法公式拆开每个指数。相位因子对本次曝光的所有位置相同，空间因子随 x 变化，稍后负责移频。',
      note: '这一步仍是空域中的代数恒等式，图像保持不变；还没有进行傅里叶变换。' },
    { id: 'spatial', start: 2.14, end: 2.235, domain: '空域 · 三项发射',
      title: '乘上样品，发射分布就分成三项。',
      copy: '把展开式代回 eⱼ = sIⱼ。第一项保留样品，另外两项各乘一个空间复指数；相位因子与调制度不随空间位置改变。',
      note: 's(x) 分配到括号中的每一项，m/2 分配到两个复指数；得到三项之和。' },
    { id: 'notation', start: 2.235, end: 2.28, domain: '空域 · 恢复二维记号',
      title: '从一行 x，恢复到整幅图像的位置 r。',
      copy: '令 r = (x, y)，本方向 k = (N/p, 0)，因此 k·r/N = x/p。将 s(x) 恢复成 s(r)，并用波矢 k 写出同一个空间指数。',
      note: 'k 以 DFT 频率格为单位。这是同一照明模型的二维写法，仍未变换到频域。' },
    { id: 'transform', start: 2.28, end: 2.345, domain: '空域 → 频域 · 逐项变换',
      title: '对三项分别变换，先处理不带空间指数的一项。',
      copy: '傅里叶变换具有线性性：和的变换等于各项变换之和。m/2 与相位因子不随 r 变化，可以提出变换；第一项直接得到 S(f)。',
      note: '接下来分别处理带正、负空间指数的两项；它们决定频谱搬移的方向。' },
    { id: 'positive', start: 2.345, end: 2.385, domain: '频域 · 正指数对应 f−k',
      title: '乘正空间指数，得到 S(f−k)。',
      copy: '正向 DFT 的变换核带负号。将 +k 的指数与核中的 −f 合并，得到 −(f−k)，因此正指数这一项变成 S(f−k)。',
      note: '令 f−k = q，就得到 f = q+k：这是样品频谱整体向 +k 移动。' },
    { id: 'negative', start: 2.385, end: 2.44, domain: '频域 · 负指数对应 f+k',
      title: '乘负空间指数，得到 S(f+k)。',
      copy: '同理，将 −k 的指数与核中的 −f 合并，得到 −(f+k)，所以负指数这一项变成 S(f+k)。两侧项都保留原来的 m/2 和相位因子。',
      note: '令 f+k = q，就得到 f = q−k：这是样品频谱整体向 −k 移动。' },
    { id: 'spectrum', start: 2.44, end: 2.48, domain: '频域 · 三个编码项',
      title: '三个移频来源，共同组成发射频谱。',
      copy: '得到 0、+1、−1 级三项。先展开三份未加权样品频谱，接着演示两侧副本怎样搬移；05 再加入照明权重并逐点相加。',
      note: '下式是完整编码结果；图中接下来分步演示移频与加权。m、φⱼ 保留为符号，实际照明参数稍后由观测估计。' },
  ].map(Object.freeze));
  function encodingDerivationState(time) {
    const view = encodingDerivationStages.find(stage => time >= stage.start && time < stage.end) || null;
    return { formula: encodingFormulaMotion(time), view, spectra: ramp(time, 2.44, 2.50), coordinates: ramp(time, 2.48, 2.50) };
  }
  function encodingFrame(time) {
    // Fade the formulas in before moving, and out before the detection scene.
    // This is a reversible drawing displacement, not a changing illumination k.
    const progress = ramp(time, 2.60, 2.76), distance = 8 * progress;
    const formulaReveal = ramp(time, 2.50, 2.60), formulaExit = ramp(time, 3, 3.35);
    const displayDistance = Number(distance.toFixed(1)), displayFrequency = Number((14 - displayDistance).toFixed(1));
    return { progress, distance, displayDistance, displayFrequency,
      formulaOpacity: formulaReveal * (1 - formulaExit), formulaOffset: 8 * (1 - formulaReveal) - 5 * formulaExit,
      panels: orders.map(order => ({
      order, shift: order * distance,
      points: [14, -14].map(q => {
        const f = q + order * distance;
        return { q, f, inside: Math.abs(f) < 10, emphasis: ramp(10 - Math.abs(f), 0, 4) };
      }),
    })) };
  }
  function encodingFormulaValues(frame) {
    return {
      positive: String.raw`$$\mathbf q\xrightarrow{-\mathbf k}\mathbf f=\mathbf q-\mathbf k$$`,
      negative: String.raw`$$-\mathbf q\xrightarrow{+\mathbf k}-\mathbf f=-\mathbf q+\mathbf k$$`,
    };
  }
  function encodingNotationState(time) {
    const numeric = ramp(time, 2.76, 2.79), inverse = ramp(time, 2.83, 2.86), compact = ramp(time, 2.93, 2.97);
    const leave = ramp(time, 3, 3.18);
    return {
      forward: (1 - numeric) * ramp(time, 2.48, 2.50), numeric: numeric - inverse, inverse: inverse - compact, compact,
      sourceFocus: ramp(time, 2.50, 2.54) * (1 - ramp(time, 2.58, 2.62)),
      shiftFocus: ramp(time, 2.58, 2.62) * (1 - ramp(time, 2.74, 2.78)),
      destinationFocus: ramp(time, 2.74, 2.78) * (1 - ramp(time, 2.83, 2.87)),
      lookupFocus: ramp(time, 2.83, 2.90) * (1 - leave),
      lookupDetail: compact * (1 - leave),
      sourceLabels: ramp(time, 2.50, 2.55) * (1 - leave),
    };
  }
  return { encodingFormulaTokens, encodingFormulaKeyframes, encodingDerivationStages, encodingDerivationState, encodingFrame, encodingFormulaValues, encodingNotationState };
  }
  if(typeof module!=='undefined'&&module.exports)module.exports=create;
  else (root.SIMMotionStateFactories ||= {})['frequency-encoding']=create;
})(typeof globalThis!=='undefined'?globalThis:this);
