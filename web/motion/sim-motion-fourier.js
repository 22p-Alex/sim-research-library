/* Eight continuous Fourier story stops. Geometry, pixels and formula values
 * share one reversible playhead. DFT: numpy.org/doc/stable/reference/routines.fft.html */
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const A = node ? require('../atlas/sim-atlas-core.js') : root.SIMAtlas;
  const TAU = 2 * Math.PI;
  const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
  const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
  const ramp = (t, start, end) => smooth((t - start) / (end - start));
  const steps = [
    { title: '一张交叉图案，只需要五个频率点。', copy: '灰色底、竖条纹、横条纹逐像素相加。先看完整图案，再跟住左右的一对频率，观察它们怎样影响右边的图像。' },
    { title: '先跟住左右这一对频率。', copy: '选中 q = (3, 0) 与 (−3, 0)。它们共同对应竖条纹；接下来把两个复指数展开，看看为什么实值条纹需要一对点。' },
    { title: '虚部相消，两个实部留下来。', copy: '两个系数都固定为 0.12。先扫到 θ = π/3，再把紫色虚线箭头接到橙色箭头末端：向上与向下的虚部抵消，两个实部相加。箭头表示此处的复数贡献 z±(x)。' },
    { title: '继续扫描位置，相加结果画出三周期。', copy: '接着扫描到视野右边界。两支贡献箭头的方向反向旋转，合成箭头始终在实轴上；同一个实数值在下方描出余弦曲线，并对应条纹明暗。系数与整张图像始终不变。' },
    { title: '系数缩短，竖条纹逐渐消失。', copy: '只减小橙色系数的模长，方向保持不变。条纹的幅度从 0.24 降到 0；合成图最终只剩灰色底与横条纹。' },
    { title: '把这一项加回来，交叉图案就回来了。', copy: '沿用上一段的零系数，逐渐加回竖条纹。下方橙色项与加号同步强调：所谓权重，就是这一项在每个像素上贡献多少。' },
    { title: '长度不变，转动相位让条纹平移。', copy: '系数箭头转过半圈，模长保持 0.12。公式中的相位从 0 增加到 π，竖条纹向左平移半个周期，右侧合成图同步改变。' },
    { title: '恢复原系数，三项共同合成原图。', copy: '将相位沿原路转回 0。灰色底和横条纹始终固定；橙色竖条纹恢复后，三项逐像素相加，恰好回到最初的交叉图案。' },
  ];
  function createTeachingSample() {
    const n = A.N, horizontal = new Float64Array(n ** 2), sample = new Float64Array(n ** 2);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const i = y * n + x;
      horizontal[i] = .24 * Math.cos(TAU * 3 * y / n);
      sample[i] = .5 + horizontal[i] + .24 * Math.cos(TAU * 3 * x / n);
    }
    return { n, horizontal, sample, spectrum: A.spectrum(sample, n) };
  }
  function component(truth, q) {
    const n = Math.sqrt(truth.sample.length), [qx, qy] = q;
    if (!Number.isInteger(n) || !q.every(Number.isInteger)) throw new Error('Fourier component requires integer DFT coordinates');
    const index = A.idx(qx, qy, n), opposite = A.idx(-qx, -qy, n);
    if (index === opposite) throw new Error('Choose a non-self-conjugate frequency pair');
    const c = { re: truth.spectrum.re[index] / n ** 2, im: truth.spectrum.im[index] / n ** 2 };
    const amplitude = 2 * Math.hypot(c.re, c.im), phase = Math.atan2(c.im, c.re);
    const cos = new Float64Array(n ** 2), sin = new Float64Array(n ** 2);
    const original = new Float64Array(n ** 2), residual = new Float64Array(n ** 2);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const i = y * n + x, angle = TAU * (qx * x + qy * y) / n;
      cos[i] = Math.cos(angle); sin[i] = Math.sin(angle);
      original[i] = 2 * (c.re * cos[i] - c.im * sin[i]);
      residual[i] = truth.sample[i] - original[i];
    }
    return { n, q: [...q], index, opposite, c, amplitude, phase, cos, sin, original, residual, period: n / Math.hypot(qx, qy) };
  }
  function frame(part, gain = 1, delta = 0) {
    if (!Number.isFinite(gain) || gain < 0 || !Number.isFinite(delta)) throw new Error('Invalid Fourier coefficient adjustment');
    const re = gain * (part.c.re * Math.cos(delta) - part.c.im * Math.sin(delta));
    const im = gain * (part.c.re * Math.sin(delta) + part.c.im * Math.cos(delta));
    const contribution = Float64Array.from(part.cos, (cos, i) => 2 * (re * cos - im * part.sin[i]));
    const pixels = Float64Array.from(part.residual, (value, i) => value + contribution[i]);
    return { c: { re, im }, gain, delta, amplitude: 2 * Math.hypot(re, im),
      phase: Math.hypot(re, im) > 1e-14 ? Math.atan2(im, re) : null, contribution, pixels };
  }
  function pairAt(x, n = A.N) {
    const theta = TAU * 3 * x / n, re = .12 * Math.cos(theta), im = .12 * Math.sin(theta);
    return { x, theta, cycles: theta / TAU, positive: { re, im }, negative: { re, im: -im }, sum: { re: 2 * re, im: 0 } };
  }
  function sample(position) {
    const t = clamp(position, 0, steps.length - 1), segment = Math.max(0, Math.ceil(t - 1e-10));
    // First pause at theta = pi/3 with nonzero imaginary parts. Scan the
    // remaining field on the next click; never reset the spatial position.
    const scan = ramp(t, 1.12, 1.52) / 18 + 17 / 18 * ramp(t, 2, 3);
    const pairOpacity = ramp(t, 1, 1.12) * (1 - ramp(t, 3, 3.2));
    const gain = 1 - ramp(t, 3.22, 4) + ramp(t, 4, 5);
    const phase = Math.PI * (ramp(t, 5, 6) - ramp(t, 6, 7)), amplitude = .24 * gain;
    return { position: t, gain, amplitude, magnitude: amplitude / 2, phase, phasePi: phase / Math.PI,
      selection: ramp(t, 0, .32), scan, scannerOpacity: pairOpacity, pairOpacity, pair: pairAt(A.N * scan),
      join: ramp(t, 1.55, 1.82), cancel: ramp(t, 1.7, 2),
      focus: ['overview', 'frequency', 'conjugate', 'trace', 'amplitude', 'sum', 'phase', 'restore'][segment],
      pulse: Math.sin(Math.PI * (t % 1)) ** 2, shift: -A.N * phase / (TAU * 3) };
  }
  function formulaValues(state) {
    return { magnitude: `$$${state.magnitude.toFixed(3)}$$`, amplitude: `$$${state.amplitude.toFixed(3)}$$`, phase: `$$${state.phasePi.toFixed(3)}\\pi$$` };
  }
  function pairFormulaValues(pair) {
    const number = value => (Math.abs(value) < .0005 ? 0 : value).toFixed(3);
    const complex = z => `$$${number(z.re)}${z.im < -1e-9 ? '-' : '+'}${number(Math.abs(z.im))}i$$`;
    return { position: String.raw`$$x=${number(pair.x)}\ \text{px},\qquad\theta=\frac{2\pi\cdot3x}{N}=${number(pair.theta / Math.PI)}\pi$$`,
      positive: complex(pair.positive), negative: complex(pair.negative), sum: `$$${number(pair.sum.re)}$$` };
  }
  // One frame request at a time. Navigation never resets amplitude or phase.
  function createPlayer(options = {}) {
    const request = options.request || requestAnimationFrame, cancel = options.cancel || cancelAnimationFrame;
    const render = options.render || (() => {}), durations = [1800, 3600, 6200, 2400, 2200, 2600, 2500], finalStop = steps.length - 1;
    let position = 0, target = 0, playing = false, handle = 0, last = null, reduced = !!options.reducedMotion;
    const state = () => ({ position, target, playing, reduced });
    const emit = () => render(state());
    function stop() { if (handle) cancel(handle); handle = 0; playing = false; last = null; }
    function tick(now) {
      handle = 0;
      if (!playing) return;
      if (last !== null) {
        const direction = Math.sign(target - position);
        const segment = direction > 0 ? Math.floor(position + 1e-9) : Math.ceil(position - 1e-9) - 1;
        const distance = Math.min(64, Math.max(0, now - last)) / durations[clamp(segment, 0, durations.length - 1)];
        position = direction > 0 ? Math.min(target, position + distance) : Math.max(target, position - distance);
        if (Math.abs(position - target) < 1e-9) { position = target; stop(); }
      }
      if (playing) { last = now; handle = request(tick); }
      emit();
    }
    function play() { playing = true; last = null; handle = request(tick); emit(); }
    function seek(value) { if (!Number.isFinite(value)) return; stop(); position = target = clamp(value, 0, finalStop); emit(); }
    function navigate(direction) {
      if (playing || !direction) return false;
      target = clamp(direction > 0 ? Math.floor(position + 1e-9) + 1 : Math.ceil(position - 1e-9) - 1, 0, finalStop);
      if (reduced || target === position) seek(target); else play();
      return true;
    }
    function pause() { stop(); emit(); }
    function toggle() {
      if (playing) pause();
      else if (Math.abs(position - target) > 1e-9) { if (reduced) seek(target); else play(); }
      else navigate(1);
    }
    function setReducedMotion(value) { reduced = !!value; if (reduced) seek(target); else emit(); }
    return { state, navigate, toggle, seek, pause, setReducedMotion, destroy: stop };
  }
  function create({ math, create: svg, attr, arrowPath, pauseMain, reduced }) {
    const $ = id => document.getElementById(id), dialog = $('fourier-lesson');
    const orange = '#efb879', violet = '#b7a5eb', cyan = '#7ad5cd', muted = '#81979e', planeScale = 360;
    const truth = createTeachingSample(), part = component(truth, [3, 0]);
    let player, focusBefore = null, copyKey = '', lastPixels = '', current;
    const mathCache = new Map();
    const label = (parent, x, y, text, color = muted, anchor = 'middle', size = 12) => svg('text', { x, y, fill: color, 'text-anchor': anchor, 'font-size': size }, parent, text);
    const frequency = $('fourier-frequency'), plane = $('fourier-complex'), overlay = $('fourier-stripe-overlay'), profile = $('fourier-profile');
    svg('path', { d: 'M 18 120 H 222 M 120 18 V 222', stroke: muted, 'stroke-width': .8 }, frequency);
    label(frequency, 228, 111, 'qₓ'); label(frequency, 137, 228, 'qᵧ ↓');
    const frequencyDots = [[0, 0], [3, 0], [-3, 0], [0, 3], [0, -3]].map(([x, y], i) => {
      const selected = i === 1 || i === 2, color = i === 1 ? orange : i === 2 ? violet : i === 0 ? '#d9e3e0' : cyan;
      const group = svg('g', { transform: `translate(${120 + x * 26} ${120 + y * 26})` }, frequency);
      const halo = svg('circle', { r: 13, fill: color, opacity: .07 }, group);
      const ring = svg('circle', { r: i === 0 ? 9 : 6, fill: 'none', stroke: color, 'stroke-width': 1.4 }, group);
      const dot = svg('circle', { r: i === 0 ? 8 : 5, fill: color }, group);
      label(group, 0, y === 3 ? 26 : -18, `(${x}, ${y})`, color, 'middle', 11);
      return { group, halo, ring, dot, selected };
    });
    svg('path', { d: 'M 16 120 H 224 M 120 224 V 16', stroke: muted, 'stroke-width': .8 }, plane);
    svg('circle', { cx: 120, cy: 120, r: .12 * planeScale, fill: 'none', stroke: muted, 'stroke-dasharray': '3 5', opacity: .45 }, plane);
    label(plane, 224, 110, 'Re'); label(plane, 136, 20, 'Im'); label(plane, 110, 136, '0');
    const circleCaption = label(plane, 120, 239, '虚线圆：模长 0.12', muted, 'middle', 11);
    const coefficientGeometry = svg('g', { 'data-fourier-geometry': 'coefficient' }, plane);
    const arrow = svg('path', { fill: 'none', stroke: orange, 'stroke-width': 3, 'stroke-linecap': 'round' }, coefficientGeometry);
    const tip = svg('circle', { r: 3, fill: orange }, coefficientGeometry);
    const arc = svg('path', { fill: 'none', stroke: orange, 'stroke-width': 1.5 }, coefficientGeometry);
    const phaseText = label(coefficientGeometry, 120, 36, '', orange);
    const pairGeometry = svg('g', { 'data-fourier-geometry': 'contributions' }, plane);
    const vector = (name, color, dash = '') => svg('path', { 'data-pair-vector': name, fill: 'none', stroke: color, 'stroke-width': 2.4, 'stroke-dasharray': dash, 'stroke-linecap': 'round' }, pairGeometry);
    const positiveVector = vector('positive', orange), negativeVector = vector('negative', violet, '5 3');
    const pairGuides = svg('path', { fill: 'none', stroke: muted, 'stroke-dasharray': '2 4', opacity: .5 }, pairGeometry);
    const realPositive = vector('real-positive', orange), realNegative = vector('real-negative', violet, '5 3');
    const imaginaryPositive = vector('imaginary-positive', orange), imaginaryNegative = vector('imaginary-negative', violet, '3 3');
    const sumVector = vector('sum', '#edf0e9');
    const positiveLabel = label(pairGeometry, 0, 0, 'z₊', orange), negativeLabel = label(pairGeometry, 0, 0, 'z₋', violet);
    const pairAngle = label(pairGeometry, 120, 36, '', '#d9e3e0');
    const pairSumLabel = label(pairGeometry, 120, 215, '', '#d9e3e0', 'middle', 11);
    const scanner = svg('path', { stroke: orange, 'stroke-width': 2, d: 'M 0 0 V 240' }, overlay);
    const cycleLabels = [0, 1, 2].map(i => label(overlay, (i + .5) * 80, 230, `${i + 1} 周期`, orange, 'middle', 12));
    svg('path', { d: 'M 52 12 V 88 H 982 M 52 50 H 982', stroke: muted, opacity: .4, fill: 'none' }, profile);
    label(profile, 45, 18, '+0.24', muted, 'end'); label(profile, 45, 54, '0', muted, 'end'); label(profile, 45, 90, '−0.24', muted, 'end');
    [0, 1, 2, 3].forEach(i => { const x = 52 + i * 310; svg('path', { d: `M ${x} 12 V 88`, stroke: muted, opacity: .12 }, profile); label(profile, x, 106, ['0', 'N/3', '2N/3', 'N'][i]); });
    const originalCurve = svg('path', { fill: 'none', stroke: muted, 'stroke-width': 1.3, 'stroke-dasharray': '4 4' }, profile);
    const curve = svg('path', { fill: 'none', stroke: orange, 'stroke-width': 2 }, profile);
    const pairCurve = svg('path', { 'data-pair-trace': 'sum', fill: 'none', stroke: orange, 'stroke-width': 2.4 }, profile);
    const scanDot = svg('circle', { r: 4, fill: orange }, profile);
    const trace = (amplitude, phase, end = 1) => {
      const positions = Array.from({ length: Math.floor(end * 192) + 1 }, (_, i) => i / 192);
      if (end > positions[positions.length - 1]) positions.push(end);
      return positions.map((u, i) => `${i ? 'L' : 'M'} ${52 + 930 * u} ${50 - 35 * amplitude / .24 * Math.cos(TAU * 3 * u + phase)}`).join(' ');
    };
    attr(originalCurve, 'd', trace(.24, 0));
    const surfaces = ['stripe', 'result'].map(name => {
      const canvas = $(`fourier-${name}`); canvas.width = canvas.height = truth.n;
      const ctx = canvas.getContext('2d'); return { name, ctx, pixels: ctx.createImageData(truth.n, truth.n) };
    });
    const number = value => (Math.abs(value) < .0005 ? 0 : value).toFixed(3);
    function paint(surface, values) {
      const pixels = surface.pixels.data;
      for (let i = 0; i < values.length; i++) {
        const v = clamp(surface.name === 'stripe' ? .5 + values[i] / .48 : values[i]) * 255;
        pixels[4 * i] = v * .9; pixels[4 * i + 1] = v * .97; pixels[4 * i + 2] = v; pixels[4 * i + 3] = 255;
      }
      surface.ctx.putImageData(surface.pixels, 0, 0);
    }
    function writeMath(id, tex, value) {
      const el = $(id);
      if (mathCache.get(id) !== tex) { math(el, tex); mathCache.set(id, tex); }
      attr(el, 'data-value', value);
    }
    function emphasis(id, active, state) {
      const el = $(id); el.classList.toggle('is-emphasized', active);
      el.style.setProperty('--formula-lift', `${active ? -2 * state.pulse : 0}px`);
      el.style.setProperty('--formula-glow', String(active ? .16 + .16 * state.pulse : 0));
    }
    function draw(playback) {
      const s = sample(playback.position), tex = formulaValues(s), pair = s.pair, pairTex = pairFormulaValues(pair);
      attr(dialog, 'data-position', playback.position);
      attr($('fourier-stage'), 'data-amplitude', s.amplitude); attr($('fourier-stage'), 'data-phase', s.phase);
      attr($('fourier-stage'), 'data-scan-x', pair.x); attr($('fourier-stage'), 'data-spatial-angle', pair.theta);
      const signature = `${s.gain}:${s.phase}`;
      if (signature !== lastPixels) {
        current = frame(part, s.gain, s.phase);
        surfaces.forEach(surface => paint(surface, surface.name === 'stripe' ? current.contribution : current.pixels));
        attr(curve, 'd', trace(s.amplitude, s.phase)); lastPixels = signature;
      }
      frequencyDots.forEach(dot => {
        attr(dot.dot, 'opacity', dot.selected ? s.gain : 1);
        attr(dot.halo, 'opacity', dot.selected ? .05 + .2 * s.selection : .05);
        attr(dot.ring, 'stroke-width', dot.selected ? 1.4 + 1.6 * s.selection : 1.2);
      });
      const x = 120 + current.c.re * planeScale, y = 120 - current.c.im * planeScale;
      attr(arrow, 'd', s.gain > 1e-12 ? arrowPath(120, 120, x, y, 7) : '');
      attr(arrow, 'data-magnitude', Math.hypot(current.c.re, current.c.im));
      attr(tip, 'cx', x); attr(tip, 'cy', y);
      attr(arc, 'd', s.phase > 1e-8 ? `M 150 120 A 30 30 0 0 0 ${120 + 30 * Math.cos(s.phase)} ${120 - 30 * Math.sin(s.phase)}` : '');
      phaseText.textContent = s.gain === 0 ? '系数为 0 · 相位未定义' : `φ = ${number(s.phasePi)}π`;
      attr(coefficientGeometry, 'opacity', 1 - s.pairOpacity); attr(pairGeometry, 'opacity', s.pairOpacity);
      const px = 120 + pair.positive.re * planeScale, py = 120 - pair.positive.im * planeScale;
      const nx = 120 + s.join * pair.positive.re * planeScale, ny = 120 - s.join * pair.positive.im * planeScale;
      const ex = nx + pair.negative.re * planeScale, ey = ny - pair.negative.im * planeScale;
      const sumX = 120 + pair.sum.re * planeScale;
      attr(positiveVector, 'd', arrowPath(120, 120, px, py, 6)); attr(negativeVector, 'd', arrowPath(nx, ny, ex, ey, 6));
      attr(sumVector, 'd', Math.abs(pair.sum.re) > 1e-10 ? arrowPath(120, 120, sumX, 120, 7) : ''); attr(sumVector, 'opacity', s.cancel);
      attr(pairGuides, 'd', `M ${px} ${py} V 120 M ${ex} ${ey} V 120`);
      attr(realPositive, 'd', Math.abs(pair.positive.re) > 1e-10 ? arrowPath(120, 187, px, 187, 5) : '');
      attr(realNegative, 'd', Math.abs(pair.negative.re) > 1e-10 ? arrowPath(px, 187, sumX, 187, 5) : '');
      for (const el of [realPositive, realNegative]) attr(el, 'opacity', s.join);
      attr(imaginaryPositive, 'd', Math.abs(pair.positive.im) > 1e-10 ? arrowPath(214, 120, 214, py, 5) : '');
      attr(imaginaryNegative, 'd', Math.abs(pair.negative.im) > 1e-10 ? arrowPath(222, py, 222, 120, 5) : '');
      for (const el of [imaginaryPositive, imaginaryNegative]) attr(el, 'opacity', s.join * (1 - s.cancel));
      for (const [el, z] of [[positiveVector, pair.positive], [negativeVector, pair.negative], [sumVector, pair.sum]]) {
        attr(el, 'data-re', z.re); attr(el, 'data-im', z.im);
      }
      attr(negativeVector, 'data-start-re', s.join * pair.positive.re); attr(negativeVector, 'data-start-im', s.join * pair.positive.im);
      attr(positiveLabel, 'x', (120 + px) / 2); attr(positiveLabel, 'y', (120 + py) / 2 - 11);
      attr(negativeLabel, 'x', (nx + ex) / 2); attr(negativeLabel, 'y', (ny + ey) / 2 + 16);
      pairAngle.textContent = `θ = ${number(pair.theta / Math.PI)}π`;
      pairSumLabel.textContent = `实部相加 → v(x) ≈ ${number(pair.sum.re)}`;
      attr(pairSumLabel, 'opacity', s.cancel);
      const showingPair = s.pairOpacity > .5;
      $('fourier-complex-title').textContent = showingPair ? '此处的两项复数贡献' : '这对频率的系数';
      $('fourier-complex-kind').textContent = showingPair ? 'z₊(x) 与 z₋(x) · 合成实数' : 'cₓ';
      attr(plane, 'aria-label', showingPair ? '空间位置 x 处的两项贡献，虚部相消，合成箭头留在实轴；频谱系数固定为 0.12' : '正三格频率的复系数，箭头长度与方向同步变化');
      circleCaption.textContent = showingPair ? '实线 z₊ / 虚线 z₋ · 长度各 0.12' : '虚线圆：模长 0.12';
      attr(scanner, 'transform', `translate(${240 * s.scan} 0)`); attr(scanner, 'opacity', s.scannerOpacity);
      cycleLabels.forEach((el, i) => attr(el, 'opacity', s.scannerOpacity * clamp(s.scan * 3 - i)));
      attr(scanDot, 'cx', 52 + 930 * s.scan); attr(scanDot, 'cy', 50 - 35 * s.gain * Math.cos(TAU * 3 * s.scan + s.phase)); attr(scanDot, 'opacity', s.scannerOpacity);
      attr(scanDot, 'data-value', pair.sum.re); attr(pairCurve, 'data-end-x', pair.x);
      attr(curve, 'opacity', 1 - s.pairOpacity); attr(pairCurve, 'opacity', s.pairOpacity); attr(pairCurve, 'd', trace(.24, 0, s.scan));
      $('fourier-profile-title').textContent = showingPair ? '合成箭头的实部 → 同一位置的余弦值 · 橙线随 x 描出' : '同一行的竖条纹贡献 · 橙线：当前 / 虚线：初始';
      $('fourier-frequency-readout').textContent = s.gain === 0 ? '左右系数为 0 · 保留空圈标记位置' : '直流 0.50 · 两对初始系数各 0.12';
      $('fourier-complex-readout').textContent = showingPair ? '仅扫描 x · 两个系数始终固定为 0.12' : `cₓ = ${number(current.c.re)} ${current.c.im < -1e-9 ? '−' : '+'} ${number(Math.abs(current.c.im))}i`;
      $('fourier-stripe-readout').textContent = showingPair ? `x = ${pair.x.toFixed(2)} px · 此处贡献 ${number(pair.sum.re)}` : `幅度 ${number(s.amplitude)} · 向左平移 ${(-s.shift).toFixed(2)} px`;
      $('fourier-result-readout').textContent = s.gain === 0 ? '竖纹消失，只剩灰色底与横纹' : Math.abs(s.phase) > 1e-8 ? '竖纹平移，横纹与灰色底固定' : '灰色底 + 竖条纹 + 横条纹';
      writeMath('fourier-eq-magnitude', tex.magnitude, s.magnitude);
      writeMath('fourier-eq-amplitude', tex.amplitude, s.amplitude);
      writeMath('fourier-eq-phase', tex.phase, s.phase);
      writeMath('fourier-eq-coefficient-phase', tex.phase, s.phase);
      $('fourier-base-equations').style.opacity = 1 - s.pairOpacity;
      attr($('fourier-base-equations'), 'aria-hidden', String(showingPair));
      $('fourier-pair-equations').style.opacity = s.pairOpacity;
      attr($('fourier-pair-equations'), 'aria-hidden', String(!showingPair));
      writeMath('fourier-pair-position', pairTex.position, pair.x);
      writeMath('fourier-pair-positive-value', pairTex.positive, pair.positive.re);
      writeMath('fourier-pair-negative-value', pairTex.negative, pair.negative.re);
      writeMath('fourier-pair-sum-value', pairTex.sum, pair.sum.re);
      for (const id of ['fourier-pair-imag-plus', 'fourier-pair-imag-minus']) $(id).style.setProperty('--pair-cancel', String(s.cancel));
      $('fourier-pair-sum-equation').style.opacity = s.cancel;
      const frequencyFocus = s.focus === 'frequency', amplitudeFocus = s.focus === 'amplitude' || s.focus === 'sum';
      const pairFocus = s.focus === 'conjugate' || s.focus === 'trace';
      const phaseFocus = s.focus === 'phase' || s.focus === 'restore';
      const sumFocus = s.focus === 'sum' || s.focus === 'restore' || s.focus === 'overview';
      for (const [id, active] of Object.entries({
        'fourier-eq-frequency': frequencyFocus || pairFocus, 'fourier-eq-amplitude': amplitudeFocus, 'fourier-eq-magnitude': amplitudeFocus,
        'fourier-eq-phase': phaseFocus, 'fourier-eq-coefficient-phase': phaseFocus,
        'fourier-eq-plus-x': sumFocus, 'fourier-eq-plus-y': s.focus === 'restore' || s.focus === 'overview',
        'fourier-eq-result': sumFocus, 'fourier-eq-dc': s.focus === 'restore', 'fourier-eq-horizontal': s.focus === 'restore',
        'fourier-eq-vertical': s.focus === 'sum' || s.focus === 'restore',
        'fourier-pair-real-plus': pairFocus, 'fourier-pair-real-minus': pairFocus, 'fourier-pair-real-sum': pairFocus && s.cancel > .5,
        'fourier-frequency-panel': frequencyFocus || pairFocus, 'fourier-complex-panel': amplitudeFocus || phaseFocus || pairFocus,
        'fourier-stripe-panel': s.focus !== 'overview', 'fourier-result-panel': sumFocus,
      })) emphasis(id, active, s);
      const cues = { overview: '三项相加 → 完整图案', frequency: '选中 ±3 → 同一组实值竖条纹', conjugate: '两个实部相加 · 正负虚部抵消', trace: '系数不变 · 扫描 x → 描出余弦', amplitude: '模长 × 2 → 条纹幅度', sum: '恢复橙色项 → 加回每个像素', phase: '同一个 φ → 箭头转动、条纹平移', restore: '恢复 φ = 0 → 三项合成原图' };
      $('fourier-formula-cue').textContent = cues[s.focus];
      $('fourier-insight').textContent = pairFocus ? `扫描位置 x = ${pair.x.toFixed(2)} px · 已走过 ${pair.cycles.toFixed(2)} 周期 · 两项相加为 ${number(pair.sum.re)}，虚部为 0。整张条纹固定不动。`
        : frequencyFocus ? '频率坐标 ±(3, 0) 对应同一组竖纹；下一步先展开两个复指数，再扫描位置画出三个周期。'
        : amplitudeFocus ? `幅度约 ${number(s.amplitude)}，系数模长约 ${number(s.magnitude)}；精确关系为 A = 2|cₓ|。频率与相位保持不变。`
        : phaseFocus ? `φ = ${number(s.phasePi)}π → 向左平移 ${(-s.shift).toFixed(2)} px。幅度始终为 0.24；转回 0 时恢复初始位置。`
        : '两对共轭频率分别贡献竖纹与横纹；直流项提供固定的灰色底。下方每一项都对应上方图像的一部分。';
      const moving = Math.abs(playback.position - playback.target) > 1e-9;
      const index = moving ? playback.target : Math.round(playback.position), backwards = moving && playback.target < playback.position;
      const key = `${index}:${backwards}`;
      if (copyKey !== key) {
        $('fourier-title').textContent = (backwards ? '回看 · ' : '') + steps[index].title;
        $('fourier-copy').textContent = backwards ? '沿同一进度回退：频率点、复系数、条纹、合成图与下方公式同步返回，数值不会重置。' : steps[index].copy;
        steps.forEach((_, i) => { if (i === index) attr($(`fourier-step-${i}`), 'aria-current', 'step'); else $(`fourier-step-${i}`).removeAttribute('aria-current'); });
        copyKey = key;
      }
      $('fourier-prev').disabled = playback.playing || playback.position <= 0;
      $('fourier-next').disabled = playback.playing || playback.position >= steps.length - 1;
      $('fourier-pause').disabled = !playback.playing && !moving;
      $('fourier-pause').textContent = playback.playing ? 'Ⅱ 暂停' : moving ? '继续 →' : 'Ⅱ 暂停';
      $('fourier-status').textContent = playback.playing ? `${backwards ? '返回' : '前往'}第 ${index + 1} 步 / ${steps.length}` : moving ? '已暂停 · 画面与公式停在同一帧' : `停在第 ${index + 1} 步 / ${steps.length}${playback.reduced ? ' · 减少动态效果' : ''}`;
    }
    player = createPlayer({ render: draw, reducedMotion: reduced.matches });
    $('fourier-prev').addEventListener('click', () => player.navigate(-1));
    $('fourier-next').addEventListener('click', () => player.navigate(1));
    $('fourier-pause').addEventListener('click', () => player.toggle());
    $('fourier-restart').addEventListener('click', () => player.seek(0));
    $('fourier-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => { player.pause(); focusBefore?.focus(); });
    dialog.addEventListener('click', event => {
      const b = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < b.left || event.clientX > b.right || event.clientY < b.top || event.clientY > b.bottom)) { dialog.close(); return; }
      if (event.button !== 0 || event.target.closest('button,a,input,summary,details') || root.getSelection()?.toString()) return;
      player.navigate(event.clientX < (b.left + b.right) / 2 ? -1 : 1);
    });
    dialog.addEventListener('keydown', event => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.repeat || event.target.closest('input,summary,details')) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); player.navigate(event.key === 'ArrowLeft' ? -1 : 1); }
      if (event.key === ' ' && !event.target.closest('button,a')) { event.preventDefault(); player.toggle(); }
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) player.pause(); });
    reduced.addEventListener('change', event => player.setReducedMotion(event.matches));
    root.addEventListener('pagehide', () => player.destroy());
    return { open() { focusBefore = document.activeElement; pauseMain(); player.seek(0); dialog.showModal(); $('fourier-stage').focus(); } };
  }
  const api = { steps, createTeachingSample, component, frame, pairAt, sample, formulaValues, pairFormulaValues, createPlayer, create };
  if (node) module.exports = api; else root.SIMMotionFourier = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
