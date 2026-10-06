/* Renderer for the pipeline atlas. Pure DOM/canvas: all physics lives in
 * sim-atlas-core.js. Nine bands, one per pipeline stage, plus a probe panel
 * that answers "what is mixed at this detector bin?". */
(function () {
  'use strict';
  const A = window.SIMAtlas, C = window.SIMCore;
  const N = A.N, KC = A.KC, KI = 8, SCALE = 2, PX = N * SCALE;
  const $ = id => document.getElementById(id);
  const fmt = x => Number(x.toFixed(3)).toString();
  const cplx = z => {
    const number = v => Math.abs(v) < 1e-10 ? '0' : Math.abs(v) < .001 ? Math.abs(v).toExponential(1) : fmt(Math.abs(v));
    return `${z.re < -1e-10 ? '−' : ''}${number(z.re)}${z.im < -1e-10 ? '−' : '+'}${number(z.im)}i`;
  };
  const mod = (v, n) => ((v % n) + n) % n;

  /* ---------- canvas helpers ---------- */
  function plate(w = PX, h = PX) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function chart(w, h) { const cv = plate(w * 2, h * 2); cv.getContext('2d').scale(2, 2); return cv; }
  function blit(cv, fn) {
    const ctx = cv.getContext('2d'), img = ctx.createImageData(cv.width, cv.height);
    const nx = cv.width / SCALE, ny = cv.height / SCALE;
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      const [r, g, b] = fn(x, y);
      for (let dy = 0; dy < SCALE; dy++) for (let dx = 0; dx < SCALE; dx++) {
        const i = 4 * ((y * SCALE + dy) * cv.width + x * SCALE + dx);
        img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0); return cv;
  }
  const gray = v => { const g = Math.round(255 * Math.max(0, Math.min(1, v))); return [g, g, g]; };
  function hsl2rgb(h, s, l) {
    const a = s * Math.min(l, 1 - l), f = n => {
      const k = (n + h / 30) % 12;
      return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
    return [f(0), f(8), f(4)].map(v => Math.round(255 * v));
  }
  const mag = (z, i) => Math.hypot(z.re[i], z.im[i]);
  function specMax(z) { let m = 0; for (let i = 0; i < z.re.length; i++) m = Math.max(m, mag(z, i)); return m; }
  // Display array bin (bx,by) at screen grid ((bx+N/2)%N, (by+N/2)%N), log scale.
  function logspec(z, opt = {}) {
    const mx = Math.log(1 + (opt.max || specMax(z))) || 1;
    const cv = plate();
    blit(cv, (x, y) => {
      const i = spectrumIndex(x, y, Math.sqrt(z.re.length));
      return gray(Math.log(1 + mag(z, i)) / mx);
    });
    overlay(cv, opt);
    return cv;
  }
  function phaseImg(z, opt = {}) {
    const mx = specMax(z) || 1;
    const cv = plate();
    blit(cv, (x, y) => {
      const i = spectrumIndex(x, y, Math.sqrt(z.re.length));
      const a = mag(z, i) / mx;
      if (a < 0.02) return [10, 12, 20];
      const h = mod(Math.atan2(z.im[i], z.re[i]) * 180 / Math.PI + 360, 360);
      return hsl2rgb(h, .85, .28 + .42 * Math.min(1, a * 2.2));
    });
    overlay(cv, opt);
    return cv;
  }
  function overlay(cv, opt) {
    const ctx = cv.getContext('2d'), c = PX / 2, u = PX / (2 * viewHalf);
    ctx.strokeStyle = '#1c293c'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, c); ctx.lineTo(PX, c); ctx.moveTo(c, 0); ctx.lineTo(c, PX); ctx.stroke();
    ctx.fillStyle = '#8fa2bb'; ctx.font = '9px sans-serif';
    ctx.fillText('−' + viewHalf, 5, c - 5); ctx.fillText('+' + viewHalf + ' x', PX - 34, c - 5);
    ctx.fillText('y', c + 5, PX - 8);
    ctx.lineWidth = 1.4;
    for (const ring of opt.rings || []) {
      ctx.strokeStyle = ring.color; ctx.setLineDash(ring.dash || []);
      ctx.beginPath(); ctx.arc(c, c, ring.r * u, 0, 2 * Math.PI); ctx.stroke();
    }
    ctx.setLineDash([]);
    for (const v of opt.vectors || []) {
      const x = c + v[0] * u, y = c + v[1] * u;
      ctx.strokeStyle = opt.vectorColor || '#fbbf24'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.lineTo(x + 5, y); ctx.moveTo(x, y - 5); ctx.lineTo(x, y + 5); ctx.stroke();
    }
    if (opt.marker) {
      const x = c + A.bin(opt.marker.x) * u + u / 2, y = c + A.bin(opt.marker.y) * u + u / 2;
      ctx.strokeStyle = '#f87171'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 7, 0, 2 * Math.PI); ctx.stroke();
    }
    if (opt.boundary) {
      ctx.strokeStyle = '#f87171'; ctx.lineWidth = 1.6; ctx.beginPath();
      for (let d = 0; d <= 360; d += 2) {
        const r = opt.boundary(d * Math.PI / 180) * u, a = d * Math.PI / 180;
        const x = c + r * Math.cos(a), y = c + r * Math.sin(a);
        d === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.stroke();
    }
    return cv;
  }
  function errImg(px, ref, s = .2) {
    return blit(plate(), (x, y) => {
      const t = Math.max(-1, Math.min(1, (px[y * N + x] - ref[y * N + x]) / s));
      return t >= 0 ? [255, Math.round(255 * (1 - t)), Math.round(255 * (1 - t * .85))]
        : [Math.round(255 * (1 + t)), Math.round(255 * (1 + t * .85)), 255];
    });
  }
  function figure(caption, cv) {
    const f = document.createElement('figure'); f.className = 'plate'; f.append(cv);
    cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', caption.replace(/<[^>]*>/g, ''));
    if (cv.width !== cv.height) cv.classList.add('curve');
    const c = document.createElement('figcaption'); c.innerHTML = caption; f.append(c); return f;
  }
  function strip(id, lane, items) {
    const el = $(id); el.replaceChildren();
    if (lane) { const l = document.createElement('span'); l.className = 'lane'; l.textContent = lane; el.append(l); }
    for (const it of items) el.append(it);
  }
  // Draw only the requested frequency window; all reconstruction arrays stay intact.
  function spectrumIndex(x, y, n = N) {
    return A.idx(Math.floor((x / N * 2 - 1) * viewHalf), Math.floor((y / N * 2 - 1) * viewHalf), n);
  }
  function supportRadius(theta) {
    let radius = pipe.cutoff;
    for (const b of pipe.bands.filter(b => b.active)) {
      const cx = -b.kx, cy = -b.ky, proj = cx * Math.cos(theta) + cy * Math.sin(theta);
      const disc = pipe.cutoff ** 2 - cx * cx - cy * cy + proj * proj;
      if (disc >= 0) radius = Math.max(radius, proj + Math.sqrt(disc));
    }
    return radius;
  }

  /* ---------- state ---------- */
  const defaults = { sample: 'star-points', directions: 3, m: .8, noise: 'none', msrc: 'known', eps: .05, apo: 1.9, bend: .8, phase: 0, angle: 0, merr: 0, otf: 0, scope: 'both' };
  const state = { ...defaults };
  let viewHalf = 24, captureKey = '', inspectOrder = 2, fusionQ = 12, profileY = 80;
  let cap = null, pipe = null, probeBin = { x: 6, y: 0 }, inspectDir = 0;
  const orderColors = ['#76638f', '#bb4b4b', '#087b60'];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let demixStep = 0, demixTimer = 0, demixPlaying = false;
  const options = () => ({
    eps: state.eps, apoCutoff: state.apo, apoBend: state.bend, phaseError: state.phase * Math.PI / 180, angleError: state.angle,
    modulationError: state.merr / 100, otfError: state.otf / 100,
    errorsAffectEstimator: state.scope !== 'recon',
  });
  const RINGS = [
    { r: KC, color: '#38bdf8', dash: [5, 4] },
    { r: KC + KI, color: '#4ade80', dash: [2, 3] },
  ];
  const vectorsOf = () => (state.directions === 3 ? A.VECTORS : A.VECTORS.slice(0, 1));

  function recompute() {
    const key = JSON.stringify([state.sample, state.directions, state.m, state.noise]);
    if (!cap || key !== captureKey) {
      cap = A.capture({ sample: state.sample, directions: state.directions, m: state.m, noise: state.noise });
      captureKey = key;
    }
    const mKnown = state.msrc === 'known' ? state.m : undefined;
    pipe = A.pipeline(cap.raw, cap.calibration, options(), mKnown);
    inspectDir = Math.min(inspectDir, pipe.groups.length - 1);
    syncViewControls();
    renderAll();
  }

  /* ---------- band renderers ---------- */
  function r1() {
    const s = cap.truth.sample, sp = cap.truth.spectrum;
    const names = { 'star-points': '西门子星 + 点对', star: '西门子星', points: '三组点对', gratings: '三方向细条纹' };
    strip('s1', '', [
      figure('<b>样品真值</b> · ' + names[state.sample], blit(plate(), (x, y) => gray(s[y * N + x]))),
      figure('样品频谱 · log(1 + |S|)', logspec(sp, { rings: RINGS, vectors: vectorsOf() })),
      figure('<b>无噪声宽场参考</b> · 经检测 OTF 衰减', blit(plate(), (x, y) => gray(cap.truth.widefield[y * N + x]))),
    ]);
    const isStar = state.sample.startsWith('star');
    $('zones').hidden = !isStar;
    $('c1').innerHTML = isStar
      ? '<b>从外向内读：</b>r ≳ 32.6 px 对应宽场通带内的局部周期；18.1 ≲ r ≲ 32.6 px 需要扩展频率覆盖；更小半径的局部周期超出名义 SIM 支撑。单方向、低调制度或噪声会进一步限制恢复。点对间距 5 / 7 / 9 px 是独立对照，不能直接等同于条纹周期的分辨判据。'
      : state.sample === 'points' ? '<b>三组点对：</b>间距分别为 5 / 7 / 9 px。观察峰是否分离、谷是否明显，并在步骤 09 对照强度剖面。点对的可分辨性取决于 PSF 与所用判据，不能直接套用周期截止。'
      : '<b>细条纹对照：</b>观察不同方向的纹理如何被编码与恢复。这个样品不适用西门子星的半径分区，因此不展示星形环向对比度。';
    $('zones').innerHTML = [
      ['#38bdf8', '外圈 · 宽场通带内'], ['#4ade80', '中圈 · 需要 SIM 扩展'], ['#f87171', '内圈 · 超出名义支撑'],
    ].map(([c, t]) => `<span class="zone"><i style="background:${c}"></i>${t}</span>`).join('');
  }

  function r2() {
    const lights = [], moires = [];
    for (let d = 0; d < cap.truth.illumination.length; d++) {
      lights.push(figure(`方向 ${d + 1} · φ=0 照明`, blit(plate(), (x, y) => gray(cap.truth.illumination[d][0][y * N + x] / 2))));
      moires.push(figure(`方向 ${d + 1} · 样品×照明`, blit(plate(), (x, y) => gray(cap.truth.emission[d][0][y * N + x] / 2))));
    }
    strip('s2a', '照明', lights); strip('s2b', '摩尔纹', moires);
  }
  function r3() {
    const raws = [], specs = [];
    for (const g of pipe.groups) {
      const group = items => {
        const el = document.createElement('div'); el.className = 'frame-group';
        el.innerHTML = `<h3><span>方向 ${g.index + 1}</span><span>${g.angle.toFixed(1)}°</span></h3>`;
        const grid = document.createElement('div'); grid.className = 'frame-grid'; grid.append(...items); el.append(grid); return el;
      };
      raws.push(group(g.frames.map(f => figure(`φ = ${Math.round(f.phase * 180 / Math.PI)}°`, blit(plate(), (x, y) => gray(f.pixels[y * N + x]))))));
      specs.push(group(g.rawSpectra.map((z, j) => figure(`φ = ${Math.round(g.frames[j].phase * 180 / Math.PI)}°`, logspec(z, { rings: [RINGS[0]] })))));
    }
    strip('s3a', '归一化观测 · 空域', raws); strip('s3b', '对应频谱 · 对数幅度', specs);
    $('frame-count').textContent = `${state.directions} 方向 × 3 相位 = ${state.directions * 3} 帧`;
  }

  function r4(focus = false) {
    const g = pipe.groups[inspectDir];
    const cv = g ? logspec(g.rawSpectra[0], { rings: RINGS, vectors: vectorsOf(), marker: probeBin }) : plate();
    cv.style.cursor = 'crosshair'; cv.tabIndex = 0;
    const move = () => r4(true);
    cv.onclick = e => {
      const rect = cv.getBoundingClientRect();
      probeBin = { x: mod(Math.floor(((e.clientX - rect.left) / rect.width * 2 - 1) * viewHalf), N), y: mod(Math.floor(((e.clientY - rect.top) / rect.height * 2 - 1) * viewHalf), N) };
      move();
    };
    cv.onkeydown = e => {
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (!d) return;
      e.preventDefault();
      const clamp = v => Math.max(-viewHalf, Math.min(viewHalf - 1, v));
      probeBin = { x: mod(clamp(A.bin(probeBin.x) + d[0]), N), y: mod(clamp(A.bin(probeBin.y) + d[1]), N) }; move();
    };
    strip('s4', '', [figure(`方向 ${inspectDir + 1} · φ = 0° 频谱<br><span class="k">点击选点 · 方向键移动一个 DFT 格</span>`, cv)]);
    renderProbe(); renderDemixCalculation(); r5(); r6();
    if (focus) cv.focus({ preventScroll: true });
  }

  function mathMarkup(tex) {
    const safe = tex.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    return `<div class="formula" data-tex="${safe}"></div>`;
  }
  function renderMath(root) {
    if (window.katex) for (const el of root.querySelectorAll('[data-tex]')) {
      katex.render(el.dataset.tex, el, { displayMode: el.classList.contains('formula'), throwOnError: false });
    }
  }
  function probeContext() {
    const g = pipe.groups[inspectDir];
    if (!g?.separated) return null;
    const pr = A.probe(pipe, inspectDir, probeBin.x, probeBin.y);
    const max = Math.max(...pr.observed.map(z => Math.hypot(z.re, z.im)));
    const exponent = max > 1e-12 ? Math.floor(Math.log10(max)) : 0;
    return { g, pr, exponent, scale: Math.pow(10, exponent) };
  }
  const orderName = i => ['0', '+1', '−1'][i];
  const orderTex = i => ['0', '+1', '-1'][i];
  function arithmeticValue(z, scale = 1) {
    const digits = v => Math.abs(v / scale) < .00005 ? '0' : Number(Math.abs(v / scale).toFixed(4)).toString();
    return `${z.re / scale < -.00005 ? '−' : ''}${digits(z.re)}${z.im / scale < -.00005 ? ' − ' : ' + '}${digits(z.im)}i`;
  }
  const multiplyComplex = (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
  const complexTex = (z, scale = 1) => arithmeticValue(z, scale).replace(/−/g, '-');
  const colorOrder = (i, tex) => String.raw`{\color{${orderColors[i]}}{${tex}}}`;

  function stopDemixPlayback() {
    clearTimeout(demixTimer); demixTimer = 0; demixPlaying = false;
  }
  function syncDemixPlayback() {
    const disabled = !probeContext();
    $('demix-play').textContent = demixPlaying ? 'Ⅱ 暂停' : demixStep === 5 ? '▶ 再播放一次' : demixStep ? '▶ 继续播放' : '▶ 播放推导';
    $('demix-play').setAttribute('aria-pressed', String(demixPlaying));
    $('demix-play').disabled = disabled;
    $('demix-prev').disabled = disabled || demixStep === 0;
    $('demix-next').disabled = disabled || demixStep === 5;
    $('demix-replay').disabled = disabled;
    document.querySelectorAll('[data-demix-step]').forEach(button => {
      button.disabled = disabled;
      button.setAttribute('aria-pressed', String(Number(button.dataset.demixStep) === demixStep));
    });
    $('demix-animation').dataset.playing = String(demixPlaying);
  }
  function queueDemixStep() {
    clearTimeout(demixTimer);
    if (!demixPlaying) return;
    demixTimer = setTimeout(() => {
      demixStep = Math.min(5, demixStep + 1);
      if (demixStep === 5) stopDemixPlayback();
      renderDemixAnimation(true);
      queueDemixStep();
    }, Number($('demix-speed').value));
  }
  function resetDemixAnimation() {
    stopDemixPlayback(); demixStep = 0; renderDemixAnimation();
  }
  function renderDemixAnimation(animate = false) {
    const context = probeContext(), root = $('demix-animation');
    syncDemixPlayback(); root.dataset.step = String(demixStep);
    if (!context) {
      $('demix-step-status').textContent = '当前配置无法解混。';
      for (const id of ['demix-equation', 'demix-step-explanation', 'demix-source-terms', 'demix-animation-result', 'demix-model-note']) $(id).replaceChildren();
      return;
    }
    const { g, pr, scale, exponent } = context, target = pr.orders[inspectOrder];
    const ell = orderTex(inspectOrder), ah = i => String.raw`A_{${orderTex(i)}}`;
    const result = String.raw`\widehat A_{${ell}}`, am = i => i === 0 ? '' : String.raw`\frac m2`;
    const sourceTerms = [0, 1, 2].map(i => colorOrder(i, i === 0 ? ah(i) : String.raw`${am(i)}e^{${i === 1 ? '' : '-'}i\phi_j}${ah(i)}`));
    const weightedTerms = [0, 1, 2].map(i => colorOrder(i, String.raw`u_{${ell},j}${am(i)}${i === 0 ? '' : String.raw`e^{${i === 1 ? '' : '-'}i\phi_j}`}${ah(i)}`));
    const combined = [0, 1, 2].map(i => colorOrder(i, String.raw`${Math.abs(target.responses[i].re) < 1e-10 ? '0' : '1'}\cdot ${ah(i)}`)).join('+');
    const stages = [
      ['三次观测，每次都混着三项', String.raw`D_j=${sourceTerms.join('+')}`,
        '沿三列看同一个分量怎样进入三帧。相位 φⱼ 改变的是各项的复权重；颜色始终对应同一级次。'],
      ['给每次观测乘一个系数 u', String.raw`${result}=\sum_{j=0}^{2}\underbrace{\frac{1}{3a_{${ell}}}e^{-i(${ell})\phi_j}}_{u_{${ell},j}}D_j`,
        `现在提取 ${orderName(inspectOrder)} 级。乘以反向相位，把目标在三帧中的相位变化转回来；再除以该级次的 aℓ，补偿调制度。`],
      ['代入 D，再把乘法分配给三项', String.raw`${result}=\sum_{j=0}^{2}\left[${weightedTerms.join('+')}\right]`,
        '把 u 乘进括号。下方是每一项合并后的实际复系数：目标列的三个系数都成为 1/3，其他列仍有不同方向。'],
      ['把同一级次的三项放在一起相加', String.raw`${result}=\sum_{h=-1}^{1}\underbrace{\left(\sum_{j=0}^{2}u_{${ell},j}a_he^{ih\phi_j}\right)}_{\text{该级次的总系数}}A_h`,
        'Aₕ 不随采集帧 j 改变，可以提出括号。现在只需把每列的三个复系数相加：实部相加，虚部相加。'],
      ['另两项抵消，目标项保留', String.raw`${result}=${combined}`,
        '目标列总系数为 1，另外两列为 0。0 表示这一项不进入本次答案，并不表示样品没有该分量。'],
      ['用当前观测，得到这一个答案', String.raw`${result}=\left(${complexTex(target.value, scale)}\right)\times10^{${exponent}}`,
        `这就是当前检测点的 ${orderName(inspectOrder)} 级解混结果 A，仍带着传递衰减。按采用参数，它来自样品频率 q = (${target.specimenFrequency.map(fmt).join(', ')}) 格。`],
    ];
    const [title, equation, explanation] = stages[demixStep];
    $('demix-step-status').textContent = `${demixStep + 1} / 6 · ${title}`;
    $('demix-equation').innerHTML = mathMarkup(equation);
    $('demix-step-explanation').textContent = explanation;
    const terms = $('demix-source-terms');
    if (!terms.children.length) terms.innerHTML = [0, 1, 2].map(i => `<div class="source-term" data-source="${i}" style="--order-color:${orderColors[i]}"><div class="source-term-head"></div><div class="source-term-math"></div><p class="source-term-foot"></p></div>`).join('');
    for (let i = 0; i < 3; i++) {
      const card = terms.children[i], o = pr.orders[i], isTarget = i === inspectOrder;
      const coefficients = g.phases.map((ph, j) => multiplyComplex(pr.weights[inspectOrder][j], { re: o.coefficient * Math.cos(o.order * ph), im: o.coefficient * Math.sin(o.order * ph) }));
      card.classList.toggle('target-term', isTarget);
      card.classList.toggle('cancelled-term', demixStep >= 4 && !isTarget);
      card.querySelector('.source-term-head').innerHTML = `<b>${orderName(i)} 级 · A<sub>${orderName(i)}</sub></b><span>${isTarget ? '本次目标' : '另一路来源'}</span>`;
      let tex;
      if (demixStep < 3) {
        tex = [0, 1, 2].map(j => {
          const original = i === 0 ? '1' : String.raw`\frac m2e^{${i === 1 ? '' : '-'}i\phi_${j}}`;
          const coefficient = demixStep === 0 ? original : demixStep === 1 ? String.raw`u_{${ell},${j}}\,${original}` : String.raw`\left(${complexTex(coefficients[j])}\right)`;
          return String.raw`j=${j}:\quad ${coefficient}\,${ah(i)}`;
        }).join(String.raw`\\`);
        tex = String.raw`\begin{aligned}${tex}\end{aligned}`;
      } else if (demixStep === 3) {
        tex = String.raw`\left[\begin{aligned}${coefficients.map((c, j) => `${j ? '+{}' : ''}(${complexTex(c)})`).join(String.raw`\\`)}\end{aligned}\right]${ah(i)}`;
      } else {
        tex = String.raw`${isTarget ? '1' : '0'}\cdot ${ah(i)}${isTarget ? '' : '=0'}`;
      }
      card.querySelector('.source-term-math').innerHTML = mathMarkup(tex);
      card.querySelector('.source-term-foot').textContent = demixStep >= 4 ? isTarget ? '保留它对本次答案的贡献' : '它的系数抵消；并非 A 本身为零' : `来源频率 q = (${o.specimenFrequency.map(fmt).join(', ')}) 格`;
      card.dataset.coefficientRe = target.responses[i].re;
      card.dataset.coefficientIm = target.responses[i].im;
    }
    $('demix-animation-result').innerHTML = demixStep === 5 ? `<span>三个乘积相加，来自同一份观测数据</span><b>${orderName(inspectOrder)} 级 A = (${arithmeticValue(target.value, scale)}) × 10<sup>${exponent}</sup></b><a href="#b5">↓ 看这份信息对应什么样的条纹</a>` : '<span>系数 u 是“怎么算”；分量 A 是“算出了什么”。可点“下一步”慢慢看。</span>';
    root.dataset.resultRe = target.value.re; root.dataset.resultIm = target.value.im;
    const nonideal = state.noise !== 'none' || state.phase || state.angle || state.otf || state.merr;
    $('demix-model-note').textContent = nonideal ? '当前含噪声或参数失配：抵消关系针对采用的相位模型；噪声会进入答案，来源频率也可能被分配错误。' : '推导使用当前采用的等间隔三相位。系数小数为近似显示，求和使用完整精度；公式依据见下方。';
    renderMath(root);
    if (animate && !reducedMotion.matches) {
      for (const el of [ $('demix-equation'), ...terms.querySelectorAll('.source-term-math') ]) {
        el.getAnimations().forEach(a => a.cancel());
        el.animate([{ opacity: .15, transform: 'translateY(12px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 550, easing: 'cubic-bezier(.2,.7,.2,1)' });
      }
    }
  }
  function renderProbe() {
    const el = $('probe'), context = probeContext();
    if (!context) { el.innerHTML = '<h3>当前配置无法解混</h3>'; return; }
    const { g, pr, exponent, scale } = context;
    el.innerHTML = `<div class="reason-title"><span class="reason-step">1</span><h3>同一个检测点，读出三次观测</h3></div>
      <p class="probe-meta">检测频率 f = (${A.bin(probeBin.x)}, ${A.bin(probeBin.y)}) 格 · 检测 bin (${probeBin.x}, ${probeBin.y})</p>
      <div class="observations">${pr.observed.map((z, j) => `<div class="observation"><span>D<sub>${j}</sub> · 采集相位 ${Math.round(g.frames[j].phase * 180 / Math.PI)}°</span><b>${arithmeticValue(z, scale)}</b>${state.phase ? `<small>计算采用相位 ${Math.round(g.phases[j] * 180 / Math.PI)}°</small>` : ''}</div>`).join('')}</div>
      <p class="number-scale">数值单位：10<sup>${exponent}</sup>（FFT 已除 N²）。下方观测、乘积和结果沿用此单位，解混系数无量纲。</p>
      ${mathMarkup(String.raw`D_j=A_0+\frac m2e^{i\phi_j}A_{+1}+\frac m2e^{-i\phi_j}A_{-1}`)}
      <p class="hint">每一帧都含 0 级、+1 级和 −1 级；三帧改变的是它们的相位权重。这里的 D 是图像 FFT 后的<b>复数</b>，不是相机上某个像素的亮度。</p>
      ${pr.orders[0].h === 0 ? '<p class="probe-warning">此点在采用的 OTF 通带外，通常没有可恢复的信号；非零值可能来自噪声或参数失配。可点击“回到示例点”继续看演算。</p>' : ''}`;
    renderMath(el);
  }
  function renderDemixCalculation() {
    const context = probeContext(), el = $('demix-calculation'), why = $('demix-cancellation');
    if (!context) { el.textContent = '当前配置无法解混。'; why.replaceChildren(); resetDemixAnimation(); return; }
    const { g, pr, exponent, scale } = context, o = pr.orders[inspectOrder];
    const label = orderName(inspectOrder), ell = orderTex(inspectOrder);
    document.querySelectorAll('.order-selector [data-order]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.order) === inspectOrder)));
    el.innerHTML = `<p class="calculation-intro">现在求 <b>${label} 级</b>。先给三次观测各乘一个系数，再把三个复数乘积相加。系数来自本次采用的相位矩阵。</p>
      ${mathMarkup(String.raw`\widehat A_{${ell}}=\sum_{j=0}^{2}u_{${ell},j}D_j,\qquad u_{\ell,j}=\frac{1}{3a_\ell}e^{-i\ell\phi_j}`)}
      <div class="term-grid">${o.products.map((product, j) => `<div class="term-card" data-term="${j}"><div class="term-label">第 ${j + 1} 项 <span>观测 D<sub>${j}</sub></span></div><div class="term-operand"><span>观测值</span><b>${arithmeticValue(pr.observed[j], scale)}</b></div><div class="term-operand"><span>× 系数</span><b>${arithmeticValue(pr.weights[inspectOrder][j])}</b></div><div class="term-product"><span>= 乘积</span><b>${arithmeticValue(product, scale)}</b></div></div>`).join('')}</div>
      <div class="sum-result"><div><span class="sum-symbol">Σ</span><span>把上面三个乘积相加</span></div><strong>${label} 级 = ${arithmeticValue(o.value, scale)}</strong><small>对应归一化复值 (${arithmeticValue(o.value, scale)}) × 10<sup>${exponent}</sup>。显示保留 4 位小数，计算使用完整精度。</small></div>`;
    why.innerHTML = `<div class="reason-title"><span class="reason-step">3</span><h3>为什么留下的是 ${label} 级？</h3></div>
      <p>相位加权把目标分量在三帧中的转动“转回来”，让它同向相加；另外两个分量的系数相加为零。这是对<b>本次采用的相位模型</b>的计算：</p>
      <div class="response-grid">${o.responses.map((z, i) => `<div class="response-item${i === inspectOrder ? ' retained' : ''}"><span>${orderName(i)} 级的总系数</span><b>${Math.abs(z.re) < 1e-10 ? 0 : Number(z.re.toFixed(4))}</b><small>${i === inspectOrder ? '保留目标分量' : '另外一级相互抵消'}</small></div>`).join('')}</div>
      <p class="figure-note">有噪声时，噪声也参与加权；如果采用相位有偏差，算出的分量会带偏差。“能够解出三个数”不等于参数正确。</p>
      <details class="closure-check"><summary>代回三次观测，检查这次计算是否闭合</summary><div class="table-scroll"><table><thead><tr><th>观测</th><th>输入值</th><th>把三个答案重新混合</th></tr></thead><tbody>${pr.observed.map((z, j) => `<tr><td>D${j}</td><td>${arithmeticValue(z, scale)}</td><td>${arithmeticValue(pr.remixed[j], scale)}</td></tr>`).join('')}</tbody></table></div><p>最大复值差 ${pr.closureError.toExponential(1)}（除 N² 后）。三方程三未知数可对含噪数据同样闭合，因此这个检查只验证线性代数计算，不能证明样品恢复准确。</p></details>`;
    el.dataset.order = label;
    el.dataset.resultRe = o.value.re; el.dataset.resultIm = o.value.im;
    why.dataset.closureError = pr.closureError;
    renderMath(el);
    resetDemixAnimation();
  }
  function r5() {
    const context = probeContext();
    if (!context) { strip('s5a', '', []); strip('s5b', '', []); $('order-results').replaceChildren(); $('c5').textContent = '当前配置无法解混。'; return; }
    const { g, pr, scale, exponent } = context;
    $('order-results').innerHTML = pr.orders.map((o, i) => {
      const q = o.specimenFrequency, frequency = Math.hypot(...q), outside = frequency > KC;
      const magnitude = Math.hypot(o.value.re, o.value.im), phase = Math.atan2(o.value.im, o.value.re);
      const visible = magnitude > 1e-12 && q.every(v => Math.abs(v) < N / 2);
      return `<article class="order-result${i === inspectOrder ? ' selected' : ''}" style="--order-color:${orderColors[i]}" data-frequency-x="${q[0]}" data-frequency-y="${q[1]}" data-pattern-visible="${visible}"><div class="order-result-title"><b>${orderName(i)} 级 · A<sub>${orderName(i)}</sub></b><span>${i === inspectOrder ? '刚才演算的答案' : '换一组系数可求出'}</span></div><p class="component-source">原样品频率 <b>q = (${q.map(fmt).join(', ')}) 格</b></p><div class="component-preview"><div class="component-pattern" role="img" aria-label="${orderName(i)} 级的频率与相位示意，统一对比度"></div><div class="component-stats"><span>${frequency < 1e-9 ? '直流 · 不随位置变化' : `周期 <b>${fmt(N / frequency)} px</b>`}</span><span>幅度 |A|<br><b>${Number((magnitude / scale).toPrecision(4))} × 10<sup>${exponent}</sup></b></span><span>${visible ? `相位 <b>${fmt(phase * 180 / Math.PI)}°</b>` : '数值近零或超出绘图范围<br>暂不展示条纹'}</span></div></div><span class="frequency-tag${outside ? ' extended' : ''}">${outside ? '在标称宽场截止之外' : '在标称宽场范围内'}</span><p class="component-value-label">解混答案 A<sub>${orderName(i)}</sub> · 检测点 (${A.bin(probeBin.x)}, ${A.bin(probeBin.y)})</p><strong>${arithmeticValue(o.value, scale)}</strong><small>× 10<sup>${exponent}</sup> · 归一化复值</small><p class="order-meaning">${i === 0 ? '这份信息未被照明频移；仍有 OTF 衰减。' : '这份信息由照明编码进来；m/2 已补偿，仍有 OTF 衰减。'}</p><button type="button" class="component-follow" data-follow-order="${i}">↑ 演示如何分出这一项</button></article>`;
    }).join('');
    // A frequency-basis illustration, not an inverse FFT of a complete band.
    // Normalize contrast deliberately; numerical |A| and phase stay alongside.
    [...$('order-results').children].forEach((card, i) => {
      const o = pr.orders[i], q = o.specimenFrequency, phase = Math.atan2(o.value.im, o.value.re);
      const visible = card.dataset.patternVisible === 'true';
      const cv = blit(plate(), (x, y) => gray(visible ? .5 + .42 * Math.cos(A.TAU * (q[0] * x + q[1] * y) / N + phase) : .5));
      card.querySelector('.component-pattern').append(cv);
    });
    const names = ['0 级', '+1 级', '−1 级'];
    strip('s5a', '幅度 · 红圈是同一个检测频率 f', g.separated.map((z, b) => figure(`${names[b]} · 红圈数值见上方答案`, logspec(z, { rings: [RINGS[0]], marker: probeBin }))));
    strip('s5b', '相位 · 红圈仍对应同一个 f', g.separated.map((z, b) => figure(`${names[b]} · 色相表示复相位`, phaseImg(z, { marker: probeBin }))));
    $('c5').innerHTML = '<b>A 和 C 是同份数据的两个阶段：</b>A 记在检测位置 f，C 搬回样品位置 q。u 才是解混系数；A、C 都是计算结果，仍含传递衰减。上面的来源关系以参数匹配为前提；有噪声或失配时，条纹示意不代表已恢复真实结构。';
  }
  function r6() {
    const context = probeContext();
    if (!context) { strip('s6a', '', []); strip('s6b', '', []); $('shift-example').replaceChildren(); return; }
    const { g, pr, scale, exponent } = context, o = pr.orders[inspectOrder], b = g.bands[inspectOrder];
    const f = [A.bin(probeBin.x), A.bin(probeBin.y)], q = o.specimenFrequency;
    $('shift-example').innerHTML = `<div class="reason-title"><span class="reason-step">→</span><h3>继续追踪刚才的 ${orderName(inspectOrder)} 级：A → C</h3></div><div class="frequency-journey"><div><small>A<sub>${orderName(inspectOrder)}</sub> · 解混数据，记在检测位置</small><b>f = (${f.join(', ')})</b><span class="journey-value">(${arithmeticValue(o.value, scale)}) × 10<sup>${exponent}</sup></span></div><span>减去 ℓk<sub>d</sub><br>数值不变 →</span><div><small>C<sub>${orderName(inspectOrder)}</sub> · 同份数据，归到样品位置</small><b>q = (${q.map(fmt).join(', ')})</b><span class="journey-value">(${arithmeticValue(o.value, scale)}) × 10<sup>${exponent}</sup></span></div></div><p>本方向采用 k<sub>d</sub> = (${fmt(g.kx)}, ${fmt(g.ky)}) 格；因此本次平移 Δq = (${fmt(-b.kx)}, ${fmt(-b.ky)}) 格。${Math.hypot(...q) > KC ? '<b>这个 q 已在标称宽场截止之外</b>，但它的观测来自原来的检测位置 f。' : '这个分量的样品频率仍在标称宽场范围内。'}数据与 OTF 同时归位；C 仍带原检测位置的衰减。</p>`;
    const names = ['0 级', '+1 级', '−1 级'];
    strip('s6a', '搬移前 · 红圈 f', g.separated.map((z, b) => figure(names[b], logspec(z, { rings: [RINGS[0]], marker: probeBin }))));
    strip('s6b', '搬移后 · 红圈 q', g.bands.map((bd, b) => figure(`${names[b]} · Δq = (${fmt(-bd.kx)}, ${fmt(-bd.ky)}) 格`, logspec(bd.shifted, { rings: RINGS, vectors: vectorsOf(), marker: { x: mod(f[0] - bd.kx, N), y: mod(f[1] - bd.ky, N) } }))));
  }
  function r7() {
    const g = pipe.groups[inspectDir];
    // Plate 1: one direction only, so the two sideband lobes stay readable.
    const cv1 = plate();
    if (g?.bands.length) {
      const z0 = g.bands[0].shifted, zp = g.bands[1].shifted, zm = g.bands[2].shifted;
      const m0 = specMax(z0) || 1, mp = specMax(zp) || 1, mm = specMax(zm) || 1;
      blit(cv1, (x, y) => {
        const i = spectrumIndex(x, y, pipe.spectrumSize);
        const v0 = .55 * Math.log(1 + mag(z0, i)) / Math.log(1 + m0);
        const vp = Math.log(1 + mag(zp, i)) / Math.log(1 + mp);
        const vm = Math.log(1 + mag(zm, i)) / Math.log(1 + mm);
        return [Math.round(255 * Math.min(1, v0 + vp)), Math.round(255 * Math.min(1, v0 + vm)), Math.round(255 * v0)];
      });
      overlay(cv1, { rings: RINGS, vectors: vectorsOf() });
    }
    // Plate 2: theoretical support of every direction, one RGB channel each;
    // mixed colours mark the overlap regions shared by several bands.
    const cv2 = plate();
    blit(cv2, (x, y) => {
      const i = spectrumIndex(x, y, pipe.spectrumSize);
      const rgb = [0, 0, 0];
      if (pipe.groups[0] && pipe.groups[0].bands[0]?.h[i] > 0) { rgb[0] = 62; rgb[1] = 62; rgb[2] = 62; }
      pipe.groups.forEach((gg, d) => {
        if (gg.bands[1]?.h[i] > 0 || gg.bands[2]?.h[i] > 0) rgb[d] = 205;
      });
      return rgb;
    });
    overlay(cv2, { rings: RINGS, vectors: vectorsOf() });
    // Plate 3: fusion weight sum with the true fused-support boundary.
    const den = pipe.denominator;
    let dmax = 0; for (let i = 0; i < den.length; i++) dmax = Math.max(dmax, den[i]);
    const cv3 = blit(plate(), (x, y) => {
      const i = spectrumIndex(x, y, pipe.spectrumSize);
      return gray(Math.log(1 + den[i] / (dmax || 1) * 100) / Math.log(101));
    });
    overlay(cv3, { rings: RINGS, vectors: vectorsOf(), boundary: supportRadius });
    strip('s7', '', [
      figure(`方向 ${inspectDir + 1}：零级(紫灰) +1 级(<span style="color:#f87171">红</span>) −1 级(<span style="color:#4ade80">绿</span>)`, cv1),
      figure(`${state.directions} 方向几何支撑 · 重叠处混色`, cv2),
      figure('fairSIM 分母 D · OTF 平方和 · <span class="bad">红</span>=融合支撑边界', cv3),
    ]);
  }
  function scalarSpectrum(values, maximum) {
    let max = maximum || 0; for (const v of values) max = Math.max(max, v); max = max || 1;
    return overlay(blit(plate(), (x, y) => {
      const v = values[spectrumIndex(x, y, pipe.spectrumSize)];
      return gray(Math.log(1 + 100 * v / max) / Math.log(101));
    }), { rings: RINGS });
  }
  // SVG charts keep typography crisp at every viewport size. Samples are joined
  // linearly; no fitted/smoothed curve is substituted for computed values.
  function linePlot({ label, series, xmin = 0, xmax, ymin = 0, ymax = 1, xticks, xlabel, ylabel, marker, reference }) {
    const box = document.createElement('div'); box.className = 'readable-chart';
    const width = innerWidth < 600 ? 380 : 900, height = innerWidth < 600 ? 290 : 310;
    const L = 55, R = 22, T = 23, B = 55, W = width - L - R, H = height - T - B;
    const X = x => L + (x - xmin) / (xmax - xmin) * W, Y = y => T + (ymax - y) / (ymax - ymin) * H;
    const num = v => Number(v.toFixed(2));
    let svg = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}"><title>${label}</title>`;
    for (let j = 0; j <= 4; j++) {
      const v = ymin + (ymax - ymin) * j / 4, y = Y(v);
      svg += `<path d="M${L},${y}H${width - R}" class="plot-grid"/><text x="${L - 10}" y="${y + 4}" text-anchor="end">${num(v)}</text>`;
    }
    for (const x of xticks) svg += `<text x="${X(x)}" y="${height - B + 22}" text-anchor="middle">${x}</text>`;
    if (reference !== undefined) svg += `<path d="M${X(reference)},${T}V${height - B}" class="plot-reference"/>`;
    for (const line of series) {
      const d = line.points.map(([x, y], i) => `${i ? 'L' : 'M'}${X(x).toFixed(2)},${Y(y).toFixed(2)}`).join(' ');
      svg += `<path d="${d}" fill="none" stroke="${line.color}" stroke-width="2.5" stroke-linejoin="round"${line.dash ? ' stroke-dasharray="6 5"' : ''}/>`;
    }
    if (marker !== undefined) {
      svg += `<path d="M${X(marker)},${T}V${height - B}" class="plot-marker"/>`;
      for (const line of series) {
        const point = line.points.find(([x]) => x === marker);
        if (point) svg += `<circle cx="${X(point[0])}" cy="${Y(point[1])}" r="4" fill="${line.color}" stroke="white" stroke-width="2"/>`;
      }
    }
    svg += `<text x="${L}" y="14" class="plot-axis-title">${ylabel}</text><text x="${L + W / 2}" y="${height - 9}" text-anchor="middle" class="plot-axis-title">${xlabel}</text></svg>`;
    box.innerHTML = `<div class="chart-legend">${series.map(s => `<span><i style="--line-color:${s.color};${s.dash ? 'border-top-style:dashed' : ''}"></i>${s.name}</span>`).join('')}</div>${svg}`;
    return box;
  }
  function r8() {
    if (!pipe.ok) { $('s8').replaceChildren(); $('fusion-readout').textContent = '当前配置无法重建。'; $('s8-transfer').replaceChildren(); $('s8-denominator').replaceChildren(); return; }
    const commonMax = Math.max(specMax(pipe.preApoSpectrum), specMax(pipe.spectrum));
    strip('s8', '', [
      figure('<span class="stage-number">1</span><b>共轭 OTF 加权求和 U</b><small>每份频带乘 H*，再相加</small>', logspec(pipe.numerator, { rings: RINGS })),
      figure('<span class="stage-number">2</span><b>Wiener 融合后</b><small>U ÷ (D + w²)，尚未切趾</small>', logspec(pipe.preApoSpectrum, { max: commonMax, rings: RINGS })),
      figure('<span class="stage-number">3</span><b>切趾窗 A</b><small>白 = 1，黑 = 0，线性亮度</small>', overlay(blit(plate(), (x, y) => gray(pipe.apodization[spectrumIndex(x, y, pipe.spectrumSize)])), { rings: RINGS })),
      figure('<span class="stage-number">4</span><b>最终融合输出</b><small>乘 A 后的频谱，交给 09 逆 FFT</small>', logspec(pipe.spectrum, { max: commonMax, rings: RINGS })),
    ]);
    const i = A.idx(fusionQ, 0, pipe.spectrumSize), n2 = N * N;
    const v = x => x === 0 ? '0' : Math.abs(x) < .001 ? x.toExponential(3) : Number(x.toPrecision(5)).toString();
    const denom = pipe.regularizedDenominator[i], pre = mag(pipe.preApoSpectrum, i) / n2, final = mag(pipe.spectrum, i) / n2;
    $('fusion-readout').innerHTML = `<div class="fusion-readout-title"><b>只看一个频率：q = (${fusionQ}, 0)</b><span>${fusionQ ? `对应周期 ${(N / fusionQ).toFixed(2)} 个采集像素` : '直流：平均亮度'}</span></div><div class="fusion-numbers"><div><span>分子幅度 |U|</span><b>${v(mag(pipe.numerator, i) / n2)}</b></div><i>÷</i><div><span>分母 D + w²</span><b>${v(denom)}</b></div><i>=</i><div><span>Wiener 后幅度</span><b>${v(pre)}</b></div><i>×</i><div><span>切趾窗 A</span><b>${v(pipe.apodization[i])}</b></div><i>=</i><div class="final-number"><span>最终幅度</span><b>${v(final)}</b></div></div><p>${denom > 1e-14 ? '所有数值直接读取本次计算；频谱幅度除以 128² 便于阅读。切趾只乘实数窗，因此这里可以按幅度核对。' : '这个频率没有有效观测，且 w = 0；为避免 0/0，本页将输出置零。'}</p>`;
    $('fusion-readout').dataset.pre = pre; $('fusion-readout').dataset.final = final;
    $('s8-denominator').replaceChildren(figure('fairSIM 实际分母 D + w² · 对数显示', scalarSpectrum(pipe.regularizedDenominator)));
    const points = values => Array.from({ length: 21 }, (_, q) => [q, values[A.idx(q, 0, pipe.spectrumSize)]]);
    $('s8-transfer').replaceChildren(linePlot({ label: '沿水平方向的理想匹配传递：宽场、Wiener 后、切趾后', xmax: 20, xticks: [0, 5, 10, 15, 20], xlabel: '频率 qx / DFT 格（向右：结构更细）', ylabel: '真实信号的幅度保留比例', marker: fusionQ, reference: KC, series: [
      { name: '宽场 OTF', color: '#2563eb', points: Array.from({ length: 21 }, (_, q) => [q, A.otf(q, 0, KC)]) },
      { name: 'Wiener 后，未切趾', color: '#a16207', dash: true, points: points(pipe.preApoTransfer) },
      { name: '最终输出，已切趾', color: '#087f6b', points: points(pipe.effectiveTransfer) },
    ] }));
  }
  function imagePlate(pixels) {
    const n = Math.sqrt(pixels.length), cv = blit(plate(n * SCALE, n * SCALE), (x, y) => gray(pixels[y * n + x]));
    const ctx = cv.getContext('2d'), y = (profileY + .5) / N * cv.height;
    ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2; ctx.setLineDash([8, 5]); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cv.width, y); ctx.stroke();
    return cv;
  }
  function r9() {
    const s = cap.truth.sample, px = pipe.pixels;
    const items = [figure('<b>样品真值</b><small>用于评价，不参与重建</small>', imagePlate(s)), figure('<b>无噪声宽场参考</b><small>仅经过检测 OTF</small>', imagePlate(cap.truth.widefield))];
    if (px) {
      items.push(figure(`<b>fairSIM 路径重建</b><small>256 × 256 · RMSE ${C.rmse(px, s).toFixed(4)}</small>`, imagePlate(pipe.outputPixels)));
      items.push(figure('<b>有符号误差</b><small>重建 − 真值 · 蓝负 / 红正</small>', errImg(px, s)));
    }
    strip('s9', '', items);
    if (!px) { $('s9c').replaceChildren(); $('c9').textContent = '当前配置没有可用重建。'; return; }
    const row = arr => Array.from({ length: N }, (_, x) => [x, arr[profileY * N + x]]);
    const final = Array.from({ length: 2 * N }, (_, x) => [x / 2, pipe.outputPixels[(2 * profileY) * 2 * N + x]]);
    const series = [
      { name: '样品真值', color: '#334155', dash: true, points: row(s) },
      { name: '宽场参考', color: '#2563eb', points: row(cap.truth.widefield) },
      { name: 'fairSIM 路径重建', color: '#087f6b', points: final },
    ];
    const values = series.flatMap(s => s.points.map(p => p[1]));
    $('s9c').replaceChildren(linePlot({ label: `第 ${profileY} 行的实际强度剖面`, series, xmax: 128, ymin: Math.min(0, Math.floor(Math.min(...values) * 10) / 10), ymax: Math.max(1, Math.ceil(Math.max(...values) * 10) / 10), xticks: [0, 32, 64, 96, 128], xlabel: '横向位置 x / 采集像素', ylabel: '强度（统一采集标度）' }));
    $('c9').innerHTML = `<b>沿橙线读图：</b>当前取 y = ${profileY}，比较峰的位置、峰间谷和幅度是否接近真值。曲线来自图像中的同一行；额外的起伏也可能是噪声或振铃。<br><span>保持原实现的零级分母计数，不用真值校正亮度，因此无噪声时也不保证 RMSE 小于宽场。</span>`;
  }

  function status() {
    const ok = pipe.ok && pipe.pixels;
    if (!ok) { $('status').innerHTML = `<div class="metric"><span class="metric-label">无法重建</span><b>${pipe.reason}</b></div>`; return; }
    const clipped = Array.from(pipe.pixels).filter(x => x < 0 || x > 1).length / (N * N);
    const wf = C.rmse(cap.truth.widefield, cap.truth.sample), rm = C.rmse(pipe.pixels, cap.truth.sample);
    const active = pipe.bands.filter(b => b.active).length, fallback = pipe.groups.filter(g => g.fallback).length;
    $('status').dataset.rmse = rm;
    $('status').innerHTML = `<div class="metric"><span class="metric-label">当前重建</span><b class="${pipe.reason === 'sim' ? 'positive' : 'caution'}">${pipe.reason === 'sim' ? 'fairSIM 路径' : '仅零级'}</b><small>${pipe.reason} · ${state.directions * 3} 帧观测</small></div>
      <div class="metric"><span class="metric-label">RMSE · 越低越接近真值</span><b class="${rm < wf ? 'positive' : 'caution'}">${rm.toFixed(4)}</b><small>宽场参考 ${wf.toFixed(4)}</small></div>
      <div class="metric"><span class="metric-label">参与融合的频带</span><b>${active}/${pipe.bands.length}</b><small>${state.msrc === 'known' ? '采用校准调制度' : '外部 m 估计（教学）'}</small></div>
      <div class="metric"><span class="metric-label">调制度回退</span><b>${fallback}<small> / ${pipe.groups.length} 方向</small></b><small>${fallback ? '超出 [0.4, 1.1]，采用 0.65' : 'm 均在 fairSIM 采用范围内'}</small></div>`;
  }
  function renderAll() { r1(); r2(); r3(); r4(); r7(); r8(); r9(); status(); }

  /* ---------- controls ---------- */
  const bindings = [];
  const bind = (id, key, out, fmtOut) => {
    const el = $(id);
    bindings.push({ el, key, out, fmtOut });
    const apply = () => {
      state[key] = el.type === 'range' ? Number(el.value) : (el.type === 'select-one' ? (isNaN(Number(el.value)) ? el.value : Number(el.value)) : el.value);
      if (out) $(out).textContent = fmtOut ? fmtOut(el.value) : el.value;
    };
    el.addEventListener('change', () => { cancelAnimationFrame(pending); apply(); recompute(); });
    el.addEventListener('input', () => { apply(); if (el.type === 'range') schedule(); });
    apply();
  };
  let pending = 0;
  const schedule = () => { cancelAnimationFrame(pending); pending = requestAnimationFrame(() => { pending = 0; recompute(); }); };
  bind('c-sample', 'sample'); bind('c-dir', 'directions'); bind('c-m', 'm', 'o-m');
  bind('c-noise', 'noise'); bind('c-msrc', 'msrc'); bind('c-eps', 'eps', 'o-eps');
  bind('c-apo', 'apo', 'o-apo'); bind('c-bend', 'bend', 'o-bend');
  bind('c-scope', 'scope'); bind('c-phase', 'phase', 'o-phase', v => v + '°');
  bind('c-angle', 'angle', 'o-angle', v => v + '°'); bind('c-merr', 'merr', 'o-merr', v => v + '%');
  bind('c-otf', 'otf', 'o-otf', v => v + '%');

  const presets = {
    ideal: { ...defaults },
    direction: { ...defaults, directions: 1 },
    noise: { ...defaults, noise: 'low', eps: .08 },
    mismatch: { ...defaults, angle: 3, scope: 'recon' },
  };
  function syncViewControls() {
    $('c-inspect').value = String(inspectDir);
    Array.from($('c-inspect').options).forEach((o, i) => { o.disabled = i >= state.directions; });
    document.querySelectorAll('[data-preset]').forEach(button => {
      const preset = presets[button.dataset.preset];
      button.setAttribute('aria-pressed', String(Object.keys(defaults).every(k => state[k] === preset[k])));
    });
  }
  function applyPreset(name) {
    cancelAnimationFrame(pending);
    Object.assign(state, presets[name]);
    for (const { el, key, out, fmtOut } of bindings) {
      el.value = state[key];
      if (out) $(out).textContent = fmtOut ? fmtOut(el.value) : el.value;
    }
    document.querySelector('.advanced').open = name === 'mismatch';
    recompute();
  }
  document.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => applyPreset(b.dataset.preset)));
  $('reset').addEventListener('click', () => {
    inspectDir = 0; inspectOrder = 2; probeBin = { x: 6, y: 0 }; viewHalf = 24; $('c-view').value = '24';
    fusionQ = 12; profileY = 80; $('c-fusion-q').value = 12; $('o-fusion-q').textContent = 12; $('c-profile-y').value = 80; $('o-profile-y').textContent = 80;
    applyPreset('ideal');
  });
  $('c-inspect').addEventListener('change', e => {
    inspectDir = Number(e.target.value); r4(); r7();
  });
  $('c-view').addEventListener('change', e => {
    viewHalf = Number(e.target.value);
    if (Math.abs(A.bin(probeBin.x)) >= viewHalf || Math.abs(A.bin(probeBin.y)) >= viewHalf) probeBin = { x: 6, y: 0 };
    renderAll();
  });
  document.querySelectorAll('.order-selector [data-order]').forEach(b => b.addEventListener('click', () => {
    inspectOrder = Number(b.dataset.order); renderDemixCalculation(); r5(); r6();
  }));
  $('demix-play').addEventListener('click', () => {
    if (demixPlaying) stopDemixPlayback();
    else {
      if (demixStep === 5) { demixStep = 0; renderDemixAnimation(true); }
      demixPlaying = true; queueDemixStep();
    }
    syncDemixPlayback();
  });
  const manualDemixStep = step => {
    stopDemixPlayback(); demixStep = Math.max(0, Math.min(5, step)); renderDemixAnimation(true);
  };
  $('demix-prev').addEventListener('click', () => manualDemixStep(demixStep - 1));
  $('demix-next').addEventListener('click', () => manualDemixStep(demixStep + 1));
  $('demix-replay').addEventListener('click', () => manualDemixStep(0));
  $('demix-speed').addEventListener('change', queueDemixStep);
  document.querySelectorAll('[data-demix-step]').forEach(b => b.addEventListener('click', () => manualDemixStep(Number(b.dataset.demixStep))));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { stopDemixPlayback(); syncDemixPlayback(); }
  });
  $('order-results').addEventListener('click', e => {
    const button = e.target.closest('[data-follow-order]');
    if (!button) return;
    inspectOrder = Number(button.dataset.followOrder); renderDemixCalculation(); r5(); r6();
    $('demix-animation').scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'start' });
    $('demix-play').focus({ preventScroll: true });
  });
  $('probe-reset').addEventListener('click', () => { probeBin = { x: 6, y: 0 }; r4(); });

  $('c-fusion-q').addEventListener('input', e => { fusionQ = Number(e.target.value); $('o-fusion-q').textContent = fusionQ; r8(); });
  $('c-profile-y').addEventListener('input', e => { profileY = Number(e.target.value); $('o-profile-y').textContent = profileY; r9(); });

  // Keep the current stage visible in the compact navigation without moving the page.
  const navLinks = Array.from(document.querySelectorAll('.stage-nav a'));
  const sections = navLinks.map(a => document.querySelector(a.getAttribute('href')));
  let scrolling = false;
  function updateNavigation() {
    const line = innerWidth <= 850 ? 155 : 110;
    let index = 0;
    sections.forEach((section, i) => { if (section.getBoundingClientRect().top <= line) index = i; });
    navLinks.forEach((a, i) => {
      if (i === index) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current');
    });
    scrolling = false;
  }
  addEventListener('scroll', () => {
    if (!scrolling) { scrolling = true; requestAnimationFrame(updateNavigation); }
  }, { passive: true });
  let resizeTimer;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { r8(); r9(); updateNavigation(); }, 120);
  });
  // References inside collapsed source notes should open before anchor navigation.
  document.querySelectorAll('a[href^="#source"]').forEach(a => a.addEventListener('click', () => { $('sources').open = true; }));

  if (window.katex) for (const el of document.querySelectorAll('[data-tex]'))
    katex.render(el.dataset.tex, el, { displayMode: el.classList.contains('formula'), throwOnError: false });
  recompute();
  updateNavigation();
  window.SIMAtlasPage = { get state() { return state; }, get pipe() { return pipe; }, get capture() { return cap; }, recompute, probe: b => { probeBin = b; r4(); } };
})();
