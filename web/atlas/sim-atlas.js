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
    ctx.fillStyle = '#a5b3c5'; ctx.font = '12px sans-serif';
    ctx.fillText('−' + viewHalf, 6, c - 6);
    ctx.textAlign = 'right'; ctx.fillText('+' + viewHalf + ' x', PX - 6, c - 6);
    ctx.textAlign = 'left'; ctx.fillText('y', c + 6, PX - 8);
    ctx.lineWidth = 1.4;
    for (const ring of opt.rings || []) {
      ctx.strokeStyle = ring.color; ctx.setLineDash(ring.dash || []);
      ctx.beginPath(); ctx.arc(c, c, ring.r * u, 0, 2 * Math.PI); ctx.stroke();
    }
    ctx.setLineDash([]);
    for (const [i, v] of (opt.vectors || []).entries()) {
      const x = c + v[0] * u, y = c + v[1] * u;
      ctx.strokeStyle = opt.vectorColor || '#fbbf24'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.lineTo(x + 5, y); ctx.moveTo(x, y - 5); ctx.lineTo(x, y + 5); ctx.stroke();
      if (opt.vectorLabels?.[i]) {
        ctx.fillStyle = ctx.strokeStyle; ctx.font = '12px sans-serif';
        ctx.fillText(opt.vectorLabels[i], x + 7, y - 7);
      }
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
  /* 波矢 k 指向"亮度变化"的方向，条纹等亮线与它垂直。这两个方向极易被读反，
     所以凡是画纯条纹的图都叠一支双向箭头，标签也只写波矢。ctx.rotate 与
     照明公式 cos(2π(cos a·x + sin a·y)/p) 共用同一套 y 向下的图像坐标。 */
  function kArrow(cv, deg) {
    const ctx = cv.getContext('2d'), c = cv.width / 2, L = cv.width * .3, head = cv.width * .05;
    ctx.save(); ctx.translate(c, c); ctx.rotate(deg * Math.PI / 180);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [w, col] of [[6, 'rgba(4,8,16,.82)'], [2.4, '#fbbf24']]) {
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath();
      ctx.moveTo(-L, 0); ctx.lineTo(L, 0);
      ctx.moveTo(L, 0); ctx.lineTo(L - head, -head * .55);
      ctx.moveTo(L, 0); ctx.lineTo(L - head, head * .55);
      ctx.moveTo(-L, 0); ctx.lineTo(-L + head, -head * .55);
      ctx.moveTo(-L, 0); ctx.lineTo(-L + head, head * .55);
      ctx.stroke();
    }
    ctx.restore(); return cv;
  }
  const kCaption = (kx, ky, deg) => `k<sub>d</sub> = (${kx}, ${ky}) 格 · 波矢 ${deg.toFixed(1)}° · 箭头 = 亮度变化方向，条纹与箭头垂直`;
  function figure(caption, cv) {
    const f = document.createElement('figure'); f.className = 'plate'; f.append(cv);
    cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', caption.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
    if (cv.width !== cv.height) cv.classList.add('curve');
    const c = document.createElement('figcaption'); c.innerHTML = caption; f.append(c); return f;
  }
  function strip(id, lane, items) {
    const el = $(id); el.replaceChildren(); el.dataset.groups = items.length;
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
  // One fixed acquisition and fairSIM configuration; interactions only inspect it.
  const state = Object.freeze({ sample: 'star-points', directions: 3, m: .8, noise: 'none',
    eps: A.FAIRSIM.wiener, apo: A.FAIRSIM.apoCutoff, bend: A.FAIRSIM.apoBend,
    phase: 0, angle: 0, merr: 0, otf: 0 });
  let viewHalf = 24, inspectOrder = 2, profileY = 80;
  let cap = null, pipe = null, probeBin = { x: 6, y: 0 }, inspectDir = 0;
  const orderColors = ['#76638f', '#bb4b4b', '#087b60'];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let demixStep = 0, demixTimer = 0, demixPlaying = false;
  const fusionPlayback = { source: null, plan: null, stage: -1, progress: 0, speed: .5, done: [false, false, false], playing: false, raf: 0, epoch: 0, last: null, painted: 0, views: [], frameKey: '' };
  const options = () => ({
    eps: state.eps, apoCutoff: state.apo, apoBend: state.bend,
  });
  const encodingBaseImages = new WeakMap();
  const RINGS = [
    { r: KC, color: '#38bdf8', dash: [5, 4] },
    { r: KC + KI, color: '#4ade80', dash: [2, 3] },
  ];
  const vectorsOf = () => (state.directions === 3 ? A.VECTORS : A.VECTORS.slice(0, 1));

  function recompute() {
    if (!cap) cap = A.capture({ sample: state.sample, directions: state.directions, m: state.m, noise: state.noise });
    pipe = A.pipeline(cap.raw, cap.calibration, options(), state.m);
    inspectDir = Math.min(inspectDir, pipe.groups.length - 1);
    syncViewControls();
    renderAll();
  }

  /* ---------- band renderers ---------- */
  function r1() {
    const s = cap.truth.sample, sp = cap.truth.spectrum;
    strip('s1', '', [
      figure('<b>样品真值</b> · 西门子星 + 点对', blit(plate(), (x, y) => gray(s[y * N + x]))),
      figure('样品频谱 S(q) · log(1 + |S|)', logspec(sp, { rings: RINGS, vectors: vectorsOf() })),
      figure('<b>无噪声宽场参考</b> · 经检测 OTF 衰减', blit(plate(), (x, y) => gray(cap.truth.widefield[y * N + x]))),
    ]);
    $('c1').innerHTML = '<b>从外向内读：</b>r ≳ 32.6 px 对应宽场通带内的局部周期；18.1 ≲ r ≲ 32.6 px 需要扩展频率覆盖；更小半径的局部周期超出名义 SIM 支撑。点对间距 5 / 7 / 9 px 是独立对照，不能直接等同于条纹周期的分辨判据。';
    $('zones').innerHTML = [
      ['#38bdf8', '外圈 · 宽场通带内'], ['#4ade80', '中圈 · 需要 SIM 扩展'], ['#f87171', '内圈 · 超出名义支撑'],
    ].map(([c, t]) => `<span class="zone"><i style="background:${c}"></i>${t}</span>`).join('');
  }

  function r2() {
    const lights = [], moires = [];
    for (let d = 0; d < cap.truth.illumination.length; d++) {
      const [kx, ky] = A.VECTORS[d], deg = Math.atan2(ky, kx) * 180 / Math.PI;
      lights.push(figure(`方向 ${d + 1} · φ₀=0 照明<small>${kCaption(kx, ky, deg)}</small>`,
        kArrow(blit(plate(), (x, y) => gray(cap.truth.illumination[d][0][y * N + x] / 2)), deg)));
      moires.push(figure(`方向 ${d + 1} · 样品×照明`, blit(plate(), (x, y) => gray(cap.truth.emission[d][0][y * N + x] / 2))));
    }
    strip('s2a', '照明', lights); strip('s2b', '摩尔纹', moires);
    renderEncodingSpectra();
  }

  /* Step 02 spectrum copies. This panel shows the PHYSICAL acquisition encoding,
   * so every parameter comes from the capture truth (A.VECTORS, cap.truth.m and
   * the true frame-0 phase), never from reconstruction-adopted values: changing
   * reconstruction assumptions must not retro-change already-acquired light.
   * The three shape references are unweighted; the fourth is the true weighted
   * emission spectrum, taken straight from the FFT of the frame-0 emission. */
  const hexRgb = hex => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  function shiftedSpectrum(sp, dx, dy, n = N) {
    const re = new Float64Array(n * n), im = new Float64Array(n * n);
    const rx = Math.round(dx), ry = Math.round(dy);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const src = A.idx(x - rx, y - ry, n), dst = A.idx(x, y, n);
      re[dst] = sp.re[src]; im[dst] = sp.im[src];
    }
    return { re, im };
  }
  function tintLogSpec(z, color, opt = {}) {
    const mx = Math.log(1 + (opt.max || specMax(z))) || 1, [cr, cg, cb] = hexRgb(color);
    const cv = plate();
    blit(cv, (x, y) => {
      const i = spectrumIndex(x, y, Math.sqrt(z.re.length));
      const v = Math.log(1 + mag(z, i)) / mx;
      return [Math.round(cr * v), Math.round(cg * v), Math.round(cb * v)];
    });
    overlay(cv, opt);
    return cv;
  }
  // Acquisition truth for the inspected direction; independent of reconstruction.
  function acquisitionTruth() {
    const dirIdx = Math.min(inspectDir, cap.raw.groups.length - 1);
    const [kx, ky] = A.VECTORS[dirIdx];
    return { dirIdx, kx, ky, m: cap.truth.m, phase0: cap.raw.groups[dirIdx].frames[0].phase };
  }
  function renderEncodingSpectra() {
    const el = $('s2-spectrum'); if (!el) return;
    const t = acquisitionTruth();
    const sp = cap.truth.spectrum;
    const sp1 = shiftedSpectrum(sp, t.kx, t.ky), sm1 = shiftedSpectrum(sp, -t.kx, -t.ky);
    const f = [A.bin(probeBin.x), A.bin(probeBin.y)];
    const map = encodingFrequencyMap(f, [t.kx, t.ky]);
    const q = map.sourceFrequency, shownQ = map.zero, shownPlus = map.plus, shownMinus = map.minus;
    // The physical modulated emission spectrum of the φ=0 frame.
    const comb = A.spectrum(cap.truth.emission[t.dirIdx][0], N);
    const zeroM = Math.abs(t.m) < 1e-12;
    const zeroTag = zeroM ? '<small class="zero-weight">m=0：无边带贡献（仅几何位置）</small>' : '';
    const pointText = point => `(${point.map(fmt).join(', ')})`;
    const panel = (order, z, color, caption, cx, cy, mapped) => {
      const cv = tintLogSpec(z, color, { rings: [RINGS[0]], vectors: [[cx, cy]] });
      encodingBaseImages.set(cv, cv.getContext('2d').getImageData(0, 0, cv.width, cv.height));
      const f = figure(caption, cv);
      f.className = 'plate encoding-panel';
      f.dataset.order = String(order); f.dataset.centerX = String(cx); f.dataset.centerY = String(cy);
      f.dataset.zeroWeight = String(order !== 0 && zeroM);
      f.dataset.sourceFrequency = JSON.stringify(q);
      f.dataset.mappedFrequency = JSON.stringify(mapped);
      return f;
    };
    const combinedCanvas = logspec(comb, { rings: [RINGS[0]] });
    encodingBaseImages.set(combinedCanvas, combinedCanvas.getContext('2d').getImageData(0, 0, combinedCanvas.width, combinedCanvas.height));
    const combined = figure(`<b>混合结果</b><small>检测位置 f=${pointText(f)}</small>`, combinedCanvas);
    combined.className = 'plate encoding-panel'; combined.dataset.order = 'sum';
    combined.dataset.sourceFrequency = JSON.stringify(q);
    combined.dataset.mappedFrequency = JSON.stringify(f);
    el.replaceChildren(
      panel(0, sp, orderColors[0], `<b>原位置</b><small data-frequency-caption>q=${pointText(shownQ)} · 形状参考</small>`, 0, 0, shownQ),
      panel(1, sp1, orderColors[1], `<b>向 +k<sub>d</sub> 平移</b><small data-frequency-caption>q+k<sub>d</sub>=${pointText(shownPlus)} · 形状参考</small>${zeroTag}`, t.kx, t.ky, shownPlus),
      panel(-1, sm1, orderColors[2], `<b>向 −k<sub>d</sub> 平移</b><small data-frequency-caption>q−k<sub>d</sub>=${pointText(shownMinus)} · 形状参考</small>${zeroTag}`, -t.kx, -t.ky, shownMinus),
      combined,
    );
    el.dataset.kx = String(t.kx); el.dataset.ky = String(t.ky); el.dataset.m = String(t.m);
    el.dataset.source = 'acquisition';
    $('s2-spectrum-label').textContent = `方向 ${t.dirIdx + 1} · 真实采集 ${['k₁', 'k₂', 'k₃'][t.dirIdx]}=(${t.kx}, ${t.ky}) 格 · m=${fmt(t.m)} · φ₀=${Math.round(t.phase0 * 180 / Math.PI)}°`;
    updateEncodingProbeMarkers();
  }
  // Mark only the four step-02 canvases. Other spectrum markers keep their
  // existing ring/cross conventions and are not affected by this filled point.
  function drawEncodingFrequencyPoint(cv, point) {
    const shown = point.map(v => A.bin(mod(v, N)));
    if (shown.some(v => v < -viewHalf || v >= viewHalf)) return false;
    const ctx = cv.getContext('2d'), u = PX / (2 * viewHalf);
    const x = PX / 2 + shown[0] * u + u / 2, y = PX / 2 + shown[1] * u + u / 2;
    ctx.save();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(x, y, 8, 0, 2 * Math.PI); ctx.stroke();
    ctx.fillStyle = '#ff6b35'; ctx.strokeStyle = '#7c2d12'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, 5, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
    ctx.restore();
    return true;
  }
  function updateEncodingProbeMarkers() {
    const el = $('s2-spectrum'); if (!el) return;
    const t = acquisitionTruth(), f = [A.bin(probeBin.x), A.bin(probeBin.y)];
    const map = encodingFrequencyMap(f, [t.kx, t.ky]);
    const locations = { '0': map.zero, '1': map.plus, '-1': map.minus, sum: map.mixed };
    const kLabel = ['k₁', 'k₂', 'k₃'][t.dirIdx];
    const labels = { '0': 'q', '1': 'q+' + kLabel, '-1': 'q−' + kLabel, sum: '检测位置 f' };
    for (const panel of el.querySelectorAll('.encoding-panel')) {
      const mapped = locations[panel.dataset.order], cv = panel.querySelector('canvas');
      const base = cv && encodingBaseImages.get(cv);
      if (!mapped || !base) continue;
      const ctx = cv.getContext('2d'); ctx.putImageData(base, 0, 0);
      panel.dataset.sourceFrequency = JSON.stringify(map.sourceFrequency);
      panel.dataset.mappedFrequency = JSON.stringify(mapped);
      panel.dataset.markerVisible = String(drawEncodingFrequencyPoint(cv, mapped));
      const caption = panel.querySelector('[data-frequency-caption]');
      if (caption) caption.textContent = `${labels[panel.dataset.order]}=(${mapped.map(fmt).join(', ')}) · 形状参考`;
      const mixedCaption = panel.querySelector('figcaption small');
      if (panel.dataset.order === 'sum' && mixedCaption) mixedCaption.textContent = `检测位置 f=(${mapped.map(fmt).join(', ')})`;
    }
    renderEncodingProbeLink();
  }
  // Frequency locations in the sampled DFT are periodic; captions and markers
  // use the canonical signed bins shown by these plots.
  function encodingFrequencyMap(frequency, wavevector, n = N) {
    const canonical = point => point.map(v => A.bin(mod(v, n)));
    const rawSource = [frequency[0] + wavevector[0], frequency[1] + wavevector[1]];
    const sourceFrequency = canonical(rawSource);
    return {
      sourceFrequency,
      zero: sourceFrequency,
      plus: canonical([rawSource[0] + wavevector[0], rawSource[1] + wavevector[1]]),
      minus: canonical([rawSource[0] - wavevector[0], rawSource[1] - wavevector[1]]),
      mixed: canonical(frequency),
    };
  }
  function encodingProbeSummary(sourceFrequency, detectorFrequency, modulation, detectorOtf, cutoff) {
    const norm = Math.hypot(sourceFrequency[0], sourceFrequency[1]);
    const target = Math.hypot(detectorFrequency[0], detectorFrequency[1]);
    let state;
    if (Math.abs(modulation) < 1e-12) state = 'm=0，无边带贡献，仅示意位置';
    else if (detectorOtf === 0) state = '落在圈边/圈外，无信号传递';
    else if (Math.abs(norm - cutoff) < 1e-9) state = '从圈边移入圈内';
    else if (norm > cutoff) state = '由圈外移入圈内';
    else if (target < cutoff) state = '平移后仍在圈内';
    else state = '落在圈边/圈外，无信号传递';
    return `(${sourceFrequency.join(', ')}) → (${detectorFrequency.join(', ')})：${state}`;
  }
  /* Short probe-linked location/status for step 02. Refresh it with the point;
   * distinguish geometric mapping from actual sideband transfer at m=0 or OTF=0. */
  function renderEncodingProbeLink() {
    const el = $('s2-probe-link'); if (!el) return;
    const t = acquisitionTruth();
    const f = [A.bin(probeBin.x), A.bin(probeBin.y)];
    const otf = A.otf(...f, A.KC);
    const map = encodingFrequencyMap(f, [t.kx, t.ky]);
    const q = map.zero;
    el.textContent = encodingProbeSummary(q, f, t.m, otf, A.KC);
  }


  function r3() {
    const dirIdx = Math.min(inspectDir, pipe.groups.length - 1);
    const group = (g, title, domain, items) => {
      const el = document.createElement('div'); el.className = 'frame-group';
      el.innerHTML = `<h3><span class="frame-kind">${title}<span class="frame-domain">${domain}</span></span><span class="frame-meta"><span class="frame-direction">方向 ${g.index + 1}</span><span>波矢 ${g.angle.toFixed(1)}°</span></span></h3>`;
      const grid = document.createElement('div'); grid.className = 'frame-grid'; grid.append(...items); el.append(grid); return el;
    };
    const framesOf = g => g.frames.map(f => figure(`φ = ${Math.round(f.phase * 180 / Math.PI)}°`, kArrow(blit(plate(), (x, y) => gray(f.pixels[y * N + x])), g.angle)));
    const specsOf = g => g.rawSpectra.map((z, j) => figure(`φ = ${Math.round(g.frames[j].phase * 180 / Math.PI)}°`, logspec(z, { rings: [RINGS[0]] })));
    const cur = pipe.groups[dirIdx];
    // Default reading order: the inspected direction's paired frames + spectra
    // first, so the phase explanation follows one paired set, not all 18 plates.
    strip('s3a', '', [group(cur, '采集帧', '归一化强度', framesOf(cur))]);
    strip('s3b', '', [group(cur, '对应频谱', '对数幅度', specsOf(cur))]);
    const others = pipe.groups.filter(g => g.index !== dirIdx);
    const otherBox = $('s3-other'), otherDetails = $('s3-other-directions');
    if (others.length) {
      otherDetails.hidden = false;
      otherBox.replaceChildren();
      for (const g of others) otherBox.append(group(g, '采集帧', '归一化强度', framesOf(g)), group(g, '对应频谱', '对数幅度', specsOf(g)));
    } else {
      otherDetails.hidden = true; otherBox.replaceChildren();
    }
    const truePhases = cap.raw.groups[dirIdx].frames.map(f => Math.round(f.phase * 180 / Math.PI) + '°').join(', ');
    $('s3-direction-label').textContent = `当前检查方向 ${dirIdx + 1} · 真实采集相位 ${truePhases}`;
    $('frame-count').textContent = `${state.directions} 方向 × 3 相位 = ${state.directions * 3} 帧`;
    renderAcquisitionEquations();
  }

  // Format known model parameters as simple rationals within floating-point
  // tolerance. Keep symbolic factors when no simple fraction is available.
  // Never apply this formatter to measured FFT values.
  function fractionTex(value, factor = '', fallback = String(value)) {
    for (let denominator = 1; denominator <= 1000; denominator++) {
      const numerator = Math.round(value * denominator);
      if (Math.abs(value - numerator / denominator) > 1e-12) continue;
      if (!numerator) return '0';
      const top = `${Math.abs(numerator) === 1 && factor ? '' : Math.abs(numerator)}${factor}`;
      return `${numerator < 0 ? '-' : ''}${denominator === 1 ? top : String.raw`\frac{${top}}{${denominator}}`}`;
    }
    return fallback;
  }
  // Both acquisition equations and the adopted reconstruction matrix use the
  // same notation, but each caller supplies its own physical/model parameters.
  function encodingWeightTex(m, phase, order, j, parenthesize = false) {
    if (order === 0) return '1';
    if (m === 0) return parenthesize ? String.raw`0\cdot ` : '0';
    const half = fractionTex(m / 2, '', String.raw`\frac{m}{2}`);
    const quarter = fractionTex(m / 4, '', String.raw`\frac{m}{4}`);
    const root = fractionTex(m / 4, String.raw`\sqrt{3}`, String.raw`\frac{m\sqrt{3}}{4}`);
    const turn = mod(order * phase / (2 * Math.PI), 1), third = Math.round(turn * 3);
    if (Math.abs(turn - third / 3) < 1e-12) {
      if (third % 3 === 0) return half;
      const value = String.raw`-${quarter}${third % 3 === 1 ? '+' : '-'}${root}i`;
      return parenthesize ? String.raw`\left(${value}\right)` : value;
    }
    const angle = fractionTex(phase / Math.PI, String.raw`\pi`, String.raw`\phi_{${j}}`);
    return String.raw`${half}e^{${order === 1 ? '' : '-'}i\left(${angle}\right)}`;
  }

  // Exact notation for known model weights, never for measured complex data.
  // Nonstandard phases retain exponentials; nonuniform phase sets use M^-1.
  function equalPhaseSteps(phases) {
    return phases.every((phase, j) => Math.abs(Math.sin((phase - phases[0] - j * 2 * Math.PI / 3) / 2)) < 1e-12);
  }
  function scaledPhaseTex(amplitude, phase, amplitudeSymbol, phaseSymbol) {
    const a = fractionTex(amplitude, '', amplitudeSymbol);
    const turn = mod(phase / (2 * Math.PI), 1), third = Math.round(turn * 3);
    if (Math.abs(turn - third / 3) < 1e-12) {
      if (third % 3 === 0) return a;
      const half = fractionTex(amplitude / 2, '', String.raw`\frac{${amplitudeSymbol}}{2}`);
      const root = fractionTex(amplitude / 2, String.raw`\sqrt{3}`, String.raw`\frac{${amplitudeSymbol}\sqrt{3}}{2}`);
      return String.raw`\left(-${half}${third % 3 === 1 ? '+' : '-'}${root}i\right)`;
    }
    return String.raw`${a}e^{i\left(${fractionTex(phase / Math.PI, String.raw`\pi`, phaseSymbol)}\right)}`;
  }
  function demixWeightTex(g, target, j) {
    const ell = [0, 1, -1][target];
    if (!equalPhaseSteps(g.phases)) return String.raw`u_{${orderTex(target)},${j}}`;
    const a = target === 0 ? 1 : g.m / 2;
    return scaledPhaseTex(1 / (3 * a), -ell * g.phases[j],
      target === 0 ? String.raw`\frac13` : String.raw`\frac{2}{3m}`, String.raw`-(${ell})\phi_{${j}}`);
  }
  function demixProductTex(g, target, source, j) {
    const ell = [0, 1, -1][target], h = [0, 1, -1][source];
    if (!equalPhaseSteps(g.phases)) return String.raw`${demixWeightTex(g, target, j)}\,${encodingWeightTex(g.m, g.phases[j], h, j, true)}`;
    const aTarget = target === 0 ? 1 : g.m / 2, aSource = source === 0 ? 1 : g.m / 2;
    const symbol = target === 0 && source !== 0 ? String.raw`\frac{m}{6}`
      : target !== 0 && source === 0 ? String.raw`\frac{2}{3m}` : String.raw`\frac13`;
    return scaledPhaseTex(aSource / (3 * aTarget), (h - ell) * g.phases[j], symbol, String.raw`(${h - ell})\phi_{${j}}`);
  }
  function demixAnswerTex(g, target) {
    return String.raw`\widehat A_{${orderTex(target)}}=` + g.phases.map((_, j) => String.raw`${demixWeightTex(g, target, j)}D_{${j}}`).join('+');
  }

  function phasePartsTex(amplitude, phase, amplitudeSymbol, phaseSymbol) {
    const turn = mod(phase / (2 * Math.PI), 1), third = Math.round(turn * 3);
    if (Math.abs(turn - third / 3) < 1e-12) {
      if (third % 3 === 0) return { re: fractionTex(amplitude, '', amplitudeSymbol), im: '0' };
      const half = fractionTex(amplitude / 2, '', String.raw`\frac{${amplitudeSymbol}}{2}`);
      const root = fractionTex(amplitude / 2, String.raw`\sqrt{3}`, String.raw`\frac{${amplitudeSymbol}\sqrt{3}}{2}`);
      return { re: `-${half}`, im: `${third % 3 === 1 ? '' : '-'}${root}` };
    }
    const a = fractionTex(amplitude, '', amplitudeSymbol);
    const angle = fractionTex(phase / Math.PI, String.raw`\pi`, phaseSymbol);
    return { re: String.raw`${a}\cos\left(${angle}\right)`, im: String.raw`${a}\sin\left(${angle}\right)` };
  }
  function demixColumnPartsTex(g, target, source) {
    if (!equalPhaseSteps(g.phases)) return g.phases.map((_, j) => {
      const coefficient = demixProductTex(g, target, source, j);
      return { re: String.raw`\operatorname{Re}\left[${coefficient}\right]`, im: String.raw`\operatorname{Im}\left[${coefficient}\right]` };
    });
    const ell = [0, 1, -1][target], h = [0, 1, -1][source];
    const aTarget = target === 0 ? 1 : g.m / 2, aSource = source === 0 ? 1 : g.m / 2;
    const symbol = target === 0 && source !== 0 ? String.raw`\frac{m}{6}`
      : target !== 0 && source === 0 ? String.raw`\frac{2}{3m}` : String.raw`\frac13`;
    return g.phases.map((phase, j) => phasePartsTex(aSource / (3 * aTarget), (h - ell) * phase, symbol, String.raw`(${h - ell})\phi_{${j}}`));
  }
  function signedSumTex(terms) {
    return terms.map((term, j) => `${j && !term.startsWith('-') ? '+' : ''}${term}`).join('');
  }
  function coefficientTotalTex(z) {
    if (Math.hypot(z.re, z.im) < 1e-10) return '0';
    if (Math.hypot(z.re - 1, z.im) < 1e-10) return '1';
    return String.raw`\sum_j c_j`;
  }
  function demixColumnAdditionTex(g, target, source, sum) {
    const parts = demixColumnPartsTex(g, target, source);
    const re = Math.abs(sum.re) < 1e-10 ? '0' : fractionTex(sum.re, '', String.raw`\operatorname{Re}\sum_j c_j`);
    const im = Math.abs(sum.im) < 1e-10 ? '0' : fractionTex(sum.im, '', String.raw`\operatorname{Im}\sum_j c_j`);
    return String.raw`\begin{aligned}\text{实部}:\quad&${signedSumTex(parts.map(p => p.re))}=${re}\\[8pt]\text{虚部}:\quad&${signedSumTex(parts.map(p => p.im))}=${im}\\[8pt]\text{合计}:\quad&${re}+(${im})i=${coefficientTotalTex(sum)}\end{aligned}`;
  }

  // Keep the analytical circular-pupil expression exact at the detector bin.
  // The numerical audit separately reports the actual interpolated OTF value.
  function idealOtfAtTex(f, cutoff) {
    const square = f[0] ** 2 + f[1] ** 2;
    const name = String.raw`H_{\mathrm{ideal}}(${f.join(',')})`;
    const ratio = (radicand, denominator) => fractionTex(Math.sqrt(radicand) / denominator, '',
      String.raw`\frac{\sqrt{${radicand}}}{${denominator}}`);
    const rho = ratio(square, cutoff);
    if (square === 0) return String.raw`\rho=0,\qquad ${name}=1`;
    if (square >= cutoff ** 2) return String.raw`\rho=${rho}\ge1,\qquad ${name}=0`;
    const product = ratio(square * (cutoff ** 2 - square), cutoff ** 2);
    return String.raw`\rho=${rho},\qquad ${name}=\frac2\pi\left[\arccos\left(${rho}\right)-${product}\right]`;
  }

  /* Step 03 keeps the three observations separate. Each equation attaches the
   * acquisition coefficient to its component. Reconstruction assumptions
   * never alter these physical equations. */
  function renderAcquisitionEquations() {
    const el = $('acquisition-weights'); if (!el) return;
    const dirIdx = Math.min(inspectDir, cap.raw.groups.length - 1);
    const phases = cap.raw.groups[dirIdx].frames.map(f => f.phase);
    const m = cap.truth.m;
    const noisy = cap.calibration.shotNoise || cap.calibration.readNoise > 0;
    const equations = phases.map((phase, j) => {
      const coefficients = [0, 1, -1].map(order => {
        const amplitude = order === 0 ? 1 : m / 2;
        return [amplitude * Math.cos(order * phase), amplitude * Math.sin(order * phase)];
      });
      const terms = ['A_0', String.raw`${encodingWeightTex(m, phase, 1, j, true)}A_{+1}`, String.raw`${encodingWeightTex(m, phase, -1, j, true)}A_{-1}`];
      const tex = String.raw`D_{${j}}=${terms.join('+')}${noisy ? String.raw`+N_{${j}}` : ''}`;
      const phaseLabel = String.raw`{\color{#64748b}{\phi_${j}=${fmt(phase * 180 / Math.PI)}^\circ}}`;
      const row = String.raw`${phaseLabel}&D_{${j}}&=&${terms.map((term, i) => colorOrder(i, term)).join('&+&')}${noisy ? String.raw`&+&N_{${j}}` : ''}`;
      return { phase, coefficients, tex, row };
    });
    const definitions = [
      ['0 级', String.raw`A_0=H(\mathbf f)S(\mathbf f)`],
      ['+1 级', String.raw`A_{+1}=H(\mathbf f)S(\mathbf f-\mathbf k_d)`],
      ['−1 级', String.raw`A_{-1}=H(\mathbf f)S(\mathbf f+\mathbf k_d)`],
    ].map(([name, tex], i) => `<div class="acquisition-definition" style="--order-color:${orderColors[i]}"><span>${name}</span>${mathMarkup(colorOrder(i, tex))}</div>`).join('');
    const systemTex = String.raw`\begin{array}{rrclclcl${noisy ? 'cl' : ''}}${equations.map(eq => eq.row).join(String.raw`\\[12pt]`)}\end{array}`;
    const modulation = String.raw`m=${fractionTex(m)},\quad \frac m2=${fractionTex(m / 2, '', String.raw`\frac m2`)}`;
    const standardPhases = phases.every((phase, j) => Math.abs(Math.sin((phase - j * 2 * Math.PI / 3) / 2)) < 1e-12);
    const phaseSystem = C.phaseSystem(phases);
    const identifiable = m !== 0 && phaseSystem.rank === 3;
    let conclusion;
    if (m === 0) conclusion = '当前 m=0：两份边带前的系数都是零，三帧没有提供分开+1、−1 级的信息。重建时改用回退调制度也不能补造这些信息。';
    else if (!identifiable) conclusion = '当前采集相位没有提供三条独立方程，无法唯一确定三个分量。重复测量同一个相位不能替代独立的相位编码。';
    else if (noisy) conclusion = '当前相位提供三条独立的编码方程；解混可得到三个分量的估计。每帧的噪声 Nⱼ 也会随权重传入结果。';
    else conclusion = '当前采集相位与非零调制度提供三条独立方程。使用正确的采集参数，就能分别求出三个分量。';
    if (identifiable && phaseSystem.condition > 10) conclusion += ' 相位较接近，解混对噪声更敏感。';
    const identifiabilityProof = m === 0
      ? `<p>当前三条无噪声方程都退化为同一条，+1、−1 级不参与观测：</p>${mathMarkup(String.raw`D_0=D_1=D_2=A_0`)}<p>所以测得三帧仍不足以确定两份边带。需要非零调制度，以及能够提供独立方程的采集相位。</p>`
      : standardPhases
        ? `<p>对 0°、120°、240° 这组相位，在无噪声且参数已知时，可直接由三帧观测得到：</p>${mathMarkup(String.raw`\begin{aligned}A_0&=\frac{D_0+D_1+D_2}{3}\\[6pt]A_{+1}&=\frac{2D_0-D_1-D_2}{3m}+\frac{D_1-D_2}{i\sqrt3\,m}\\[6pt]A_{-1}&=\frac{2D_0-D_1-D_2}{3m}-\frac{D_1-D_2}{i\sqrt3\,m}\end{aligned}`)}<p>第一行的直接相加只留下 0 级；后两行用不同的加权组合区分+1、−1 级。因为 m≠0，三项都能分别求出。${noisy ? ' 当前开启噪声，实际计算还会包含对应的噪声组合，得到的是分量的估计。' : ''}</p>`
        : `<p>对当前相位，把三条方程写作矩阵形式。无噪声时，三个未知量能否唯一确定取决于编码矩阵是否可逆：</p>${mathMarkup(String.raw`M_{j\ell}=a_\ell e^{i\ell\phi_j},\quad a_0=1,\quad a_{\pm1}=\frac m2,\qquad \mathbf D=M\mathbf A,\quad \det M\ne0`)}<p>${identifiable ? '当前编码矩阵可逆；相位接近会使求逆对噪声更加敏感。' : '当前编码矩阵不可逆，三次观测不足以唯一确定三个分量。'}</p>`;
    el.dataset.source = 'acquisition';
    el.dataset.equations = JSON.stringify(equations.map(({ row, ...eq }) => eq));
    el.dataset.identifiable = String(identifiable);
    el.innerHTML = `<div class="acquisition-heading"><h3>同样三个未知量，三次不同的观测</h3><span>方向 ${dirIdx + 1} · ${noisy ? '含噪声' : '无噪声'}</span></div>
      <p class="acquisition-intro">固定同一个检测频率 f。D₀、D₁、D₂ 分别来自第 1、2、3 帧；每一帧都在测量下面三个分量的混合。</p>
      <div class="acquisition-definitions">${definitions}</div>
      <p class="acquisition-caption">三个 A 已包含检测 OTF，尚未乘照明权重。下面省略共同的自变量 f。</p>
      <div class="acquisition-system-head"><b>三帧共用这三个 A，只改变相位</b><span>真实采集 <span data-tex="${modulation}"></span></span></div>
      <div class="acquisition-system" aria-label="按级次对齐的三帧完整观测方程">${mathMarkup(systemTex)}</div>
      <p class="acquisition-reading">竖着看同一列：0 级前始终是 1；${m === 0 ? '当前两份边带前都是 0。' : '+1、−1 级的权重分别按相反的相位方向变化。'}${noisy ? ' Nⱼ 表示第 j 帧的噪声频谱。' : ''}</p>
      <div class="acquisition-conclusion${identifiable ? '' : ' is-degenerate'}"><b>${identifiable ? '这些方程告诉我们什么' : '当前为什么无法分开'}</b><p>${conclusion}</p><a href="#b4">下一步：用三帧数据实际解一次 →</a></div>
      <details class="derivation acquisition-proof"><summary>${identifiable ? '为什么这些方程能分开三个分量？' : '当前为什么无法唯一求解？'}</summary>${identifiabilityProof}<p>上述推导直接由本页的观测方程得到。<a href="#source-review">成像模型依据 [1] ↗</a></p></details>
      <details class="derivation"><summary>分数和根式从哪里来？</summary><p>将真实采集的 m 与相位代入照明权重，再用欧拉公式展开：</p>${mathMarkup(String.raw`\frac m2 e^{\pm i\phi_j}=\frac m2\left(\cos\phi_j\pm i\sin\phi_j\right)`)}<p>例如相位为 120° 时，+1 级的系数是：</p>${mathMarkup(String.raw`\frac m2 e^{i2\pi/3}=\frac m2\left(-\frac12+\frac{\sqrt3}{2}i\right)=-\frac m4+\frac{m\sqrt3}{4}i`)}</details>`;
    renderMath(el);
  }

  function r4(focus = false) {
    updateEncodingProbeMarkers();
    const g = pipe.groups[inspectDir];
    const context = probeContext(), canvases = [];
    const f = [A.bin(probeBin.x), A.bin(probeBin.y)];
    $('demix-measurements-meta').textContent = `方向 ${inspectDir + 1} · 三帧共同检测频率 f = (${f.join(', ')}) 格 · 红圈只标检测位置`;
    strip('s4', '', (g?.rawSpectra || []).map((z, j) => {
      const cv = logspec(z, { rings: [RINGS[0]], marker: probeBin });
      canvases.push(cv); cv.style.cursor = 'crosshair'; cv.tabIndex = 0;
      cv.setAttribute('aria-label', `第 ${j + 1} 帧频谱，检测点 (${f.join(', ')})，可用方向键选点`);
      cv.onclick = e => {
        const rect = cv.getBoundingClientRect();
        probeBin = { x: mod(Math.floor(((e.clientX - rect.left) / rect.width * 2 - 1) * viewHalf), N), y: mod(Math.floor(((e.clientY - rect.top) / rect.height * 2 - 1) * viewHalf), N) };
        r4(j + 1);
      };
      cv.onkeydown = e => {
        const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
        if (!d) return;
        e.preventDefault();
        const clamp = v => Math.max(-viewHalf, Math.min(viewHalf - 1, v));
        probeBin = { x: mod(clamp(A.bin(probeBin.x) + d[0]), N), y: mod(clamp(A.bin(probeBin.y) + d[1]), N) };
        r4(j + 1);
      };
      const reading = context ? `<strong class="demix-frame-value">D<sub>${j}</sub> ≈ ${arithmeticValue(context.pr.observed[j], context.scale)}</strong>` : '';
      return figure(`方向 ${inspectDir + 1} · 第 ${j + 1} 帧 · φ = ${fmt(g.frames[j].phase * 180 / Math.PI)}°${reading}`, cv);
    }));
    const scale = $('demix-readings-scale');
    scale.innerHTML = context ? `三个复数的共同单位：10<sup>${context.exponent}</sup>（FFT 已除 N²）。图像显示对数幅度，下面的解混使用完整复数。` : '当前相位配置不能唯一解混。';
    scale.dataset.observed = context ? JSON.stringify(context.pr.observed) : '[]';
    renderProbe(); renderDemixOverview(); renderDemixCalculation(); r5(); r6();
    if (focus) canvases[(Number(focus) || 1) - 1]?.focus({ preventScroll: true });
  }

  /* Step 04 matrix panorama: D = M A-hat with M built from the ADOPTED phases and m
   * of the inspected direction (M_{j,h} = a_h e^{i h φ_j}), never from display
   * text. Exposes M as data so tests can check M^{-1}M ≈ I against the live
   * separation weights. */
  function renderDemixOverview() {
    const el = $('demix-overview-matrix'); if (!el) return;
    const g = pipe.groups[inspectDir];
    if (!g || !g.weights) { el.innerHTML = '<p class="figure-note">当前配置无法解混。</p>'; return; }
    const a = g.m / 2, ph = g.phases;
    const cell = (h, j) => ({ re: (h === 0 ? 1 : a) * Math.cos(h * ph[j]), im: (h === 0 ? 1 : a) * Math.sin(h * ph[j]) });
    const hs = [0, 1, -1];
    const M = ph.map((_, j) => hs.map(h => cell(h, j)));   // M[j][col]
    const matrixTex = ph.map((phase, j) => hs.map(h => encodingWeightTex(g.m, phase, h, j)));
    const rows = matrixTex.map(row => row.join('&')).join(String.raw`\\[5pt]`);
    const exactM = fractionTex(g.m, '', '');
    const estimates = hs.map((_, i) => colorOrder(i, String.raw`\widehat A_{${orderTex(i)}}`)).join(String.raw`\\`);
    el.innerHTML = `<div class="demix-matrix-equation">${mathMarkup(String.raw`\begin{gathered}\underbrace{\begin{bmatrix}D_0\\D_1\\D_2\end{bmatrix}}_{\substack{\mathbf D\\\text{已知观测}}}=\underbrace{\begin{bmatrix}${rows}\end{bmatrix}}_{\substack{M\\\text{采用的混合权重}}}\underbrace{\begin{bmatrix}${estimates}\end{bmatrix}}_{\substack{\widehat{\mathbf A}\\\text{待求的分量估计}}}\\[1em]\widehat{\mathbf A}=\underbrace{M^{-1}}_{\text{解混系数}}\mathbf D\end{gathered}`)}</div><p class="figure-note">矩阵每行对应一帧，每列依次对应 0、+1、−1 级。M 使用<b>重建采用的相位与调制度</b>；无噪声且参数匹配时，估计 Â 等于上面的真实 A。${exactM ? '' : ' 当前采用的调制度没有简洁分数形式，矩阵保留符号 m；近似值放在“数值核对”中。'}</p>`;
    el.dataset.matrix = JSON.stringify(M.map(row => row.map(z => [z.re, z.im])));
    el.dataset.matrixTex = JSON.stringify(matrixTex);
    el.dataset.phases = JSON.stringify(Array.from(ph));
    el.dataset.m = String(g.m);
    const mismatch = state.phase || state.angle || state.merr || state.otf || g.fallback;
    const known = $('demix-overview-known');
    known.innerHTML = `方向 ${inspectDir + 1} · <span data-tex="${exactM ? `m=${exactM}` : 'm'}"></span>${exactM ? '' : '（采用值见数值核对）'}${g.fallback ? '（回退值）' : ''} · φ = ${ph.map(p => Math.round(p * 180 / Math.PI) + '°').join(', ')}${mismatch ? ' · <b class="bad">采用值</b>' : ''}`;
    renderMath(known);
    // True-vs-adopted phase comparison: equal phase spacing alone does not
    // guarantee that reconstruction uses the correct absolute phases.
    const cmp = $('demix-phase-compare');
    if (cmp) {
      const truePh = cap.raw.groups[inspectDir].frames.map(f => f.phase);
      const samePh = truePh.every((p, j) => Math.abs(p - ph[j]) < 1e-12);
      const dphi = ph[0] - truePh[0];
      cmp.innerHTML = samePh
        ? `真实采集相位与采用相位一致：φ = ${truePh.map(p => Math.round(p * 180 / Math.PI) + '°').join(', ')}。`
        : `真实采集 φ<sup>true</sup> = ${truePh.map(p => Math.round(p * 180 / Math.PI) + '°').join(', ')}；重建采用 φ<sup>adopt</sup> = ${ph.map(p => Math.round(p * 180 / Math.PI) + '°').join(', ')}。公共偏差 Δφ=${Math.round(dphi * 180 / Math.PI)}° 保持相位间距${equalPhaseSteps(ph) ? '（当前仍等间隔）' : '（当前仍非等间隔）'}，但无噪声、其余参数匹配时解混结果整体乘 <span data-tex="e^{-i\\ell\\Delta\\phi}"></span>，即 <span data-tex="\\widehat A_\\ell=e^{-i\\ell\\Delta\\phi}A_\\ell"></span>。`;
      renderMath(cmp);
    }
    renderMath(el);
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
      for (const id of ['demix-equation', 'demix-step-explanation', 'demix-coefficient-guide', 'demix-applied-weights', 'demix-source-terms', 'demix-animation-result', 'demix-model-note']) $(id).replaceChildren();
      return;
    }
    const { g, pr, scale, exponent } = context, target = pr.orders[inspectOrder];
    const coefficientModel = window.SIMDemixCoefficients.build({ phases: g.phases, m: g.m, weights: g.weights, target: inspectOrder });
    const uniform = equalPhaseSteps(g.phases);
    const ell = orderTex(inspectOrder), ah = i => String.raw`A_{${orderTex(i)}}`;
    const result = String.raw`\widehat A_{${ell}}`, am = i => i === 0 ? '' : String.raw`\frac m2`;
    const sourceTerms = [0, 1, 2].map(i => colorOrder(i, i === 0 ? ah(i) : String.raw`${am(i)}e^{${i === 1 ? '' : '-'}i\phi_j}${ah(i)}`));
    const weightedTerms = [0, 1, 2].map(i => colorOrder(i, String.raw`u_{${ell},j}${am(i)}${i === 0 ? '' : String.raw`e^{${i === 1 ? '' : '-'}i\phi_j}`}${ah(i)}`));
    const combined = coefficientModel.columns.map((column, i) => colorOrder(i, String.raw`${coefficientTotalTex(column.sum)}\cdot ${ah(i)}`)).join('+');
    const exactAnswer = demixAnswerTex(g, inspectOrder);
    const weightedD = exactAnswer.slice(exactAnswer.indexOf('=') + 1);
    const stages = [
      ['三帧都混有同样三个未知分量', String.raw`D_j=${sourceTerms.join('+')}`,
        '下面一列只跟踪一个来源，三行依次对应第 1、2、3 帧。A 不随采集帧改变，变化的是它前面的照明系数。'],
      ['给三帧分别乘上这三个解混权重', uniform ? exactAnswer
        : String.raw`${result}=\sum_{j=0}^{2}u_{${ell},j}D_j,\qquad u_{\ell,j}=(M^{-1})_{\ell,j}`,
        `本次提取 ${orderName(inspectOrder)} 级。上式是三帧的组合方式；下方先保留“解混权重 × 照明系数”，下一步再把两者乘开。`],
      ['把每帧的乘法分配给三个来源', String.raw`${result}=\sum_{j=0}^{2}\left[${weightedTerms.join('+')}\right]`,
        uniform ? '下方已经乘开每个系数。目标列的三项系数都变成 1/3；另外两列包含正、负的实部或虚部。此时还没有相加。'
          : '下方保留真实逆矩阵权重的乘积。非等间隔时，目标列的三个系数不必各为 1/3；要把这一列加完才能判断结果。'],
      ['提出共同的 A，把每列的三个系数相加', String.raw`${result}=\sum_{\ell'=-1}^{1}\underbrace{\left(\sum_{j=0}^{2}u_{${ell},j}a_{\ell'}e^{i\ell'\phi_j}\right)}_{\text{该列三个系数相加}}A_{\ell'}`,
        '同一列的 A 完全相同，可以提出括号。下面保留三个系数的完整加法；下一步分别算实部与虚部。'],
      ['实部、虚部分别相加，算出 1 和 0', String.raw`\begin{aligned}${result}&=${weightedD}\\[8pt]&=${combined}\\[8pt]&=A_{${ell}}\end{aligned}`,
        '中间一行的 1 和 0 来自下方逐列计算：实部与实部相加，虚部与虚部相加。系数和为 0 的分量被抵消；A 本身可以非零。'],
      ['把相同权重用到 FFT 读数，得到实际复数', exactAnswer,
        `上面验证了这组权重为何保留 ${orderName(inspectOrder)} 级。把实际三帧读数代入，得到下面的 Â；它仍含检测 OTF。`],
    ];
    const [title, equation, explanation] = stages[demixStep];
    $('demix-step-status').textContent = `${demixStep + 1} / 6 · ${title}`;
    $('demix-equation').innerHTML = mathMarkup(equation);
    $('demix-step-explanation').textContent = explanation;
    const applied = $('demix-applied-weights');
    applied.hidden = demixStep === 0;
    applied.innerHTML = g.phases.map((_, j) => `<div class="demix-decoder-weight"><span>第 ${j + 1} 帧 · 乘解混权重</span>${mathMarkup(String.raw`u_{${ell},${j}}=${demixWeightTex(g, inspectOrder, j)}`)}</div>`).join('');
    $('demix-coefficient-guide').textContent = demixStep < 3
      ? '横着看同一帧：权重同时乘进三个来源。竖着看同一列：这是同一个 A 在三帧中的贡献。'
      : '沿每一列从上往下读：三个逐帧贡献 → 提出共同的 A → 三个系数相加。下面算的是系数，不需要预先知道样品分量 A。';
    const terms = $('demix-source-terms');
    if (!terms.children.length) terms.innerHTML = [0, 1, 2].map(i => `<div class="source-term" data-source="${i}" style="--order-color:${orderColors[i]}"><div class="source-term-head"></div><p class="source-term-caption"></p><div class="source-term-math"></div><div class="source-term-sum"><h4></h4><div class="source-term-addition"></div></div><p class="source-term-foot"></p></div>`).join('');
    for (let i = 0; i < 3; i++) {
      const card = terms.children[i], o = pr.orders[i], isTarget = i === inspectOrder;
      const coefficients = g.phases.map((_, j) => demixProductTex(g, inspectOrder, i, j));
      const sum = coefficientModel.columns[i].sum;
      card.classList.toggle('target-term', isTarget);
      card.classList.toggle('cancelled-term', demixStep >= 4 && !isTarget);
      card.querySelector('.source-term-head').innerHTML = `<b>${orderName(i)} 级 · A<sub>${orderName(i)}</sub></b><span>${isTarget ? '本次目标' : '另一路来源'}</span>`;
      card.querySelector('.source-term-caption').textContent = demixStep === 0 ? '三帧的照明贡献' : demixStep === 1 ? '权重 × 原来的照明贡献' : '乘开后的三帧贡献';
      const rows = g.phases.map((_, j) => {
        const original = encodingWeightTex(g.m, g.phases[j], [0, 1, -1][i], j, true);
        const coefficient = demixStep === 0 ? original : demixStep === 1 ? String.raw`u_{${ell},${j}}\cdot ${original}` : coefficients[j];
        return String.raw`\text{第 ${j + 1} 帧}:\quad&${coefficient}\,${ah(i)}`;
      });
      card.querySelector('.source-term-math').innerHTML = mathMarkup(String.raw`\begin{aligned}${rows.join(String.raw`\\[12pt]`)}\end{aligned}`);
      const addition = card.querySelector('.source-term-sum');
      addition.hidden = demixStep < 3;
      addition.querySelector('h4').textContent = demixStep === 3 ? '提出 A 后，先把系数写成加法' : '分别算实部和虚部';
      addition.querySelector('.source-term-addition').innerHTML = mathMarkup(demixStep === 3
        ? String.raw`\begin{aligned}\text{系数和}={}&${coefficients[0]}\\&+${coefficients[1]}\\&+${coefficients[2]}\end{aligned}`
        : demixColumnAdditionTex(g, inspectOrder, i, sum));
      card.querySelector('.source-term-foot').textContent = demixStep >= 4 ? isTarget ? '系数和为 1：这一列保留' : '系数和为 0：这一列抵消；A 本身可以非零' : `来源频率 q = (${o.specimenFrequency.map(fmt).join(', ')}) 格`;
      card.dataset.coefficientRe = sum.re; card.dataset.coefficientIm = sum.im;
      card.dataset.products = JSON.stringify(coefficientModel.columns[i].weighted);
    }
    const answer = $('demix-animation-result');
    answer.innerHTML = `<div class="reason-title"><span class="reason-step">4</span><h3>代入三帧读数，得到分离结果</h3></div>
      ${mathMarkup(demixAnswerTex(g, inspectOrder))}
      <div class="demix-answer-value"><span>检测点 f = (${[A.bin(pr.bin.x), A.bin(pr.bin.y)].map(fmt).join(', ')}) · ${orderName(inspectOrder)} 级</span><strong>Â<sub>${orderName(inspectOrder)}</sub> ≈ (${arithmeticValue(target.value, scale)}) × 10<sup>${exponent}</sup></strong></div>
      <p>这份结果对应样品频率 q = (${target.specimenFrequency.map(fmt).join(', ')})，仍含 H(f) 衰减。步骤 06 再把整份频带归位到样品坐标。</p>
      <div class="demix-answer-links"><a href="#demix-arithmetic">展开完整数值乘加 ↓</a><a href="#b5">下一步：三个分量代表什么 →</a></div>`;
    answer.dataset.resultRe = target.value.re; answer.dataset.resultIm = target.value.im;
    answer.classList.toggle('answer-current', demixStep === 5);
    root.dataset.resultRe = target.value.re; root.dataset.resultIm = target.value.im;
    const modulationMismatch = Math.abs(g.m - cap.truth.m) > 1e-10;
    const nonideal = state.noise !== 'none' || state.phase || state.angle || state.otf || state.merr || g.fallback || modulationMismatch;
    $('demix-model-note').innerHTML = nonideal
      ? '当前含噪声或参数失配：抵消关系针对采用模型；Â 是解混估计值，可能偏离真实分量 A。'
      : `各列系数来自当前${uniform ? '等间隔三相位' : '非等间隔相位矩阵'}的实际复权重；它们的总系数与 fairSIM 逆矩阵计算一致。<a href="#source-fairsim">BandSeparation.java 依据 [2] ↗</a>`;
    if (g.fallback || modulationMismatch) {
      $('demix-model-note').innerHTML += `<br><b>${g.fallback ? '调制度回退：' : '调制度失配：'}</b>无噪声、其余参数匹配时：${mathMarkup(String.raw`\widehat A_{\pm1}=\frac{m_{\mathrm{true}}}{m_{\mathrm{adopt}}}A_{\pm1}`)}按采用 m 补偿，不等于补偿了真实调制度。具体采用值见“数值核对”。`;
    }
    renderMath(root); renderMath(answer);
    if (animate && !reducedMotion.matches) {
      for (const el of [ $('demix-equation'), ...terms.querySelectorAll('.source-term-math'), ...terms.querySelectorAll('.source-term-addition') ]) {
        el.getAnimations().forEach(a => a.cancel());
        el.animate([{ opacity: .15, transform: 'translateY(12px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 550, easing: 'cubic-bezier(.2,.7,.2,1)' });
      }
    }
  }
  function renderProbe() {
    const el = $('probe'), context = probeContext();
    const equations = $('probe-equations');
    const readings = $('probe-observations'), otfValues = $('probe-otf-values'), otfExpression = $('probe-otf-expression');
    if (!context) {
      el.innerHTML = '<h3>当前配置无法解混</h3>';
      for (const node of [equations, readings, otfValues, otfExpression]) node.replaceChildren();
      equations.hidden = true;
      return;
    }
    equations.hidden = false;
    const { g, pr, exponent, scale } = context;
    const f = [A.bin(probeBin.x), A.bin(probeBin.y)], k = A.VECTORS[inspectDir];
    const sources = [0, 1, -1].map(h => f.map((v, axis) => v - h * k[axis]));
    const physicalCutoff = cap.calibration.kc * N;
    const physicalH = A.otf(...f, physicalCutoff), adoptedH = A.otf(...f, pipe.cutoff);
    const noisy = cap.calibration.shotNoise || cap.calibration.readNoise > 0;
    const half = fractionTex(cap.truth.m / 2, '', String.raw`\frac m2`);
    const substitutionOpen = equations.querySelector('.probe-substitution')?.open;
    const component = i => colorOrder(i, String.raw`A_{${orderTex(i)}}`);
    const definitions = sources.map((q, i) => {
      const sign = i === 1 ? '-' : '+';
      const coordinate = i === 0
        ? String.raw`\mathbf q=\mathbf f=(${f.join(',')})`
        : String.raw`\begin{gathered}\mathbf q=\mathbf f${sign}\mathbf k_{${inspectDir + 1}}\\[2pt](${f.join(',')})${sign}(${k.join(',')})=(${q.join(',')})\end{gathered}`;
      return `<tr class="probe-component-row">
        <td>${mathMarkup(colorOrder(i, String.raw`A_{${orderTex(i)}}(${f.join(',')})`))}</td><td class="probe-definition-operator">=</td>
        <td>${mathMarkup(String.raw`H(${f.join(',')})`)}</td><td class="probe-definition-operator">×</td>
        <td>${mathMarkup(colorOrder(i, String.raw`S(${q.join(',')})`))}</td></tr>
        <tr class="probe-coordinate-row"><td colspan="4" aria-hidden="true"></td>
        <td><div class="probe-source-coordinate">${mathMarkup(coordinate)}</div></td></tr>`;
    }).join('');
    // Use the same acquisition-weight formatter as step 03, with true phases
    // and modulation. Reconstruction errors must not change this substitution.
    const frame = 1, phase = g.frames[frame].phase;
    const expanded = sources.map((q, i) => {
      const coefficient = i === 0 ? '' : encodingWeightTex(cap.truth.m, phase, [0, 1, -1][i], frame, true);
      const product = String.raw`H(${f.join(',')})\,${colorOrder(i, `S(${q.join(',')})`)}`;
      return String.raw`${i === 0 ? `D_${frame}(${f.join(',')})={}&` : '&+{}'}${coefficient}\underbrace{${product}}_{${component(i)}(${f.join(',')})}`;
    }).join(String.raw`\\[8pt]`);
    const substitution = String.raw`\begin{aligned}${expanded}${noisy ? `+N_${frame}(${f.join(',')})` : ''}\end{aligned}`;
    el.innerHTML = `<div class="reason-title"><h3>这一个检测点的三个来源</h3></div>
      <p class="probe-meta">方向 ${inspectDir + 1} · 检测频率 f = (${f.join(', ')}) 格 · 真实照明 k<sub>d</sub> = (${k.join(', ')}) 格</p>
      <div class="table-scroll"><table class="probe-definitions" aria-label="待求分量、检测传递和样品频谱逐项对照">
        <thead><tr><th scope="col">模型分量 A<small>待估计 · 步骤 03 的同色分量</small></th><th aria-label="等于"></th><th scope="col">检测传递 H<small>共用同一检测位置</small></th><th aria-label="乘以"></th><th scope="col">样品频谱 S(q)<small>同一样品 · 按下方坐标找来源</small></th></tr></thead>
        <tbody>${definitions}</tbody></table></div>
      ${physicalH === 0 ? '<p class="probe-warning">此检测点的真实 OTF 为零，无噪声时三个 A 都为零；含噪读数仍可能非零。可回到示例点继续推导。</p>' : adoptedH === 0 ? '<p class="probe-warning">此点真实 OTF 非零，但重建采用的 OTF 为零；当前检测模型存在失配。</p>' : ''}`;
    equations.innerHTML = `<div class="probe-equation-heading"><b>同样三个 A，代回三帧观测</b><a href="#acquisition-weights">对照步骤 03 ↑</a></div>
      <div class="probe-observation-equation">${mathMarkup(String.raw`\underbrace{D_j}_{\text{已知观测}}=${component(0)}+\underbrace{${half}e^{i\phi_j}}_{\text{照明权重}}${component(1)}+\underbrace{${half}e^{-i\phi_j}}_{\text{照明权重}}${component(2)}${noisy ? '+N_j' : ''}`)}</div>
      <p class="probe-formula-note">j = 0、1、2 对应三帧；省略共同的检测坐标 f。权重沿用<b>真实采集</b>相位与调制度。${noisy ? 'Nⱼ 为噪声频谱。' : ''}</p>
      <details class="probe-substitution"${substitutionOpen ? ' open' : ''}><summary>逐项代入第 2 帧 · φ₁ = ${fmt(phase * 180 / Math.PI)}°</summary>
        ${mathMarkup(substitution)}
        <p class="probe-formula-note">括号下的 A 对应上表同色分量；分数、根式或指数系数与步骤 03 的第 2 行相同。</p></details>
      <p class="hint">D₀、D₁、D₂ 来自三帧 FFT 在此点的复数读数。<a href="#demix-arithmetic">查看 FFT 读数与代入计算 ↓</a></p>`;
    readings.innerHTML = `<h3>① 三个读数：从整帧图像做 FFT 得到</h3>
      ${mathMarkup(String.raw`D_j(f_x,f_y)=\frac{1}{N^2}\sum_{x=0}^{N-1}\sum_{y=0}^{N-1}d_j[x,y]e^{-i2\pi(f_xx+f_yy)/N},\qquad N=${N}`)}
      <p>dⱼ 是校正相机背景与增益后的第 j 帧，f 用 DFT 格表示。FFT 对整帧像素加权求和；读出 D 不需要预先知道 A 或 S。</p>
      <div class="observations">${pr.observed.map((z, j) => `<div class="observation"><span>D<sub>${j}</sub> · 采集相位 ${Math.round(g.frames[j].phase * 180 / Math.PI)}°</span><b>≈ ${arithmeticValue(z, scale)}</b>${state.phase ? `<small>计算采用相位 ${Math.round(g.phases[j] * 180 / Math.PI)}°</small>` : ''}</div>`).join('')}</div>
      <p class="number-scale">FFT 观测近似值，实部与虚部各保留最多 4 位小数；计算使用完整精度。数值单位：10<sup>${exponent}</sup>（FFT 已除 N²）。下方观测、乘积和结果沿用此单位，解混系数无量纲。</p>`;
    otfExpression.innerHTML = `<p>代入当前检测点 f = (${f.join(', ')})，以真实检测截止频率计算：</p>${mathMarkup(idealOtfAtTex(f, physicalCutoff))}`;
    otfValues.innerHTML = `<h3>② OTF：解析式与实际取值</h3>
      ${mathMarkup(String.raw`H_{\mathrm{ideal}}(${f.join(',')})\approx ${A.idealOTF(Math.hypot(...f) / physicalCutoff).toFixed(9)},\qquad H_{\mathrm{true}}^{\mathrm{lookup}}\approx ${physicalH.toFixed(9)}`)}
      <p>左边代入上方圆瞳解析式；右边是生成采集帧时实际使用的 OTF。它按 fairSIM 的方式使用 512 个单精度样本并作线性插值，所以可有微小差异；最后一个查表间隔及范围外返回零。</p>
      ${Math.abs(pipe.cutoff - physicalCutoff) > 1e-12 ? `<p>当前存在 OTF 失配：真实截止 ${fmt(physicalCutoff)} 格，采用截止 ${fmt(pipe.cutoff)} 格；重建采用 H ≈ ${adoptedH.toFixed(9)}。采用值不会改变已采集的 D。</p>` : '<p>当前重建采用的 OTF 与真实检测 OTF 一致。</p>'}
      <p>调制度核对：真实 m ≈ ${cap.truth.m.toFixed(6)}，采用 m ≈ ${g.m.toFixed(6)}${g.fallback ? '（回退值）' : ''}。采用值用于下面的解混系数。${Math.abs(g.m - cap.truth.m) > 1e-10 ? ` 无噪声、其余参数匹配时，边带估计为真实分量的约 ${(cap.truth.m / g.m).toFixed(4)} 倍。` : ''}</p>`;
    readings.dataset.observed = JSON.stringify(pr.observed);
    otfValues.dataset.physicalH = physicalH; otfValues.dataset.adoptedH = adoptedH;
    el.dataset.sourceFrequencies = JSON.stringify(sources);
    renderMath(el); renderMath(equations);
    renderMath(readings); renderMath(otfExpression); renderMath(otfValues);
  }
  function renderDemixCalculation() {
    const context = probeContext(), el = $('demix-calculation'), why = $('demix-cancellation');
    if (!context) { el.textContent = '当前配置无法解混。'; why.replaceChildren(); $('demix-target-description').replaceChildren(); resetDemixAnimation(); return; }
    const { g, pr, exponent, scale } = context, o = pr.orders[inspectOrder];
    const label = orderName(inspectOrder), ell = orderTex(inspectOrder);
    document.querySelectorAll('.order-selector [data-order]').forEach(b => {
      const i = Number(b.dataset.order);
      b.setAttribute('aria-pressed', String(i === inspectOrder));
      b.innerHTML = `<b>${orderName(i)} 级</b><small>q = (${pr.orders[i].specimenFrequency.map(fmt).join(', ')})</small>`;
    });
    $('demix-target-description').innerHTML = `本次求 <b>${label} 级</b>：它来自样品频率 <b>q = (${o.specimenFrequency.map(fmt).join(', ')})</b>。同样三帧，只换解混权重，就能求出另外两项。`;
    el.innerHTML = `<h3>③ 解混：代入当前读数</h3><p class="calculation-intro">现在求 <b>${label} 级</b>。先给三次观测各乘一个系数，再把三个复数乘积相加。系数来自本次采用的相位矩阵。</p>
      ${mathMarkup(String.raw`\widehat A_{${ell}}=\sum_{j=0}^{2}u_{${ell},j}D_j,\qquad ` + (equalPhaseSteps(g.phases) ? String.raw`u_{\ell,j}=\frac{1}{3a_\ell}e^{-i\ell\phi_j}` : String.raw`u_{\ell,j}=(M^{-1})_{\ell,j}`))}
      <div class="term-grid">${o.products.map((product, j) => `<div class="term-card" data-term="${j}"><div class="term-label">第 ${j + 1} 项 <span>观测 D<sub>${j}</sub></span></div><div class="term-operand"><span>观测值</span><b>${arithmeticValue(pr.observed[j], scale)}</b></div><div class="term-operand"><span>× 系数</span><b>${arithmeticValue(pr.weights[inspectOrder][j])}</b></div><div class="term-product"><span>= 乘积</span><b>${arithmeticValue(product, scale)}</b></div></div>`).join('')}</div>
      <div class="sum-result"><div><span class="sum-symbol">Σ</span><span>把上面三个乘积相加</span></div><strong>${label} 级 = ${arithmeticValue(o.value, scale)}</strong><small>对应归一化复值 (${arithmeticValue(o.value, scale)}) × 10<sup>${exponent}</sup>。显示保留 4 位小数，计算使用完整精度。</small></div>`;
    why.innerHTML = `<div class="reason-title"><span class="reason-step">4</span><h3>为什么留下的是 ${label} 级？</h3></div>
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
      return `<article class="order-result${i === inspectOrder ? ' selected' : ''}" style="--order-color:${orderColors[i]}" data-frequency-x="${q[0]}" data-frequency-y="${q[1]}" data-pattern-visible="${visible}"><div class="order-result-title"><b>${orderName(i)} 级 · Â<sub>${orderName(i)}</sub></b><span>${i === inspectOrder ? '刚才演算的答案' : '换一组系数可求出'}</span></div><p class="component-source">归位样品坐标 <b>q = (${q.map(fmt).join(', ')}) 格</b></p><div class="component-preview"><div class="component-pattern" role="img" aria-label="${orderName(i)} 级的频率与相位示意，统一对比度"></div><div class="component-stats"><span>${frequency < 1e-9 ? '直流 · 不随位置变化' : `周期 <b>${fmt(N / frequency)} px</b>`}</span><span>幅度 |Â|<br><b>${Number((magnitude / scale).toPrecision(4))} × 10<sup>${exponent}</sup></b></span><span>${visible ? `相位 <b>${fmt(phase * 180 / Math.PI)}°</b>` : '数值近零或超出绘图范围<br>暂不展示条纹'}</span></div></div><span class="frequency-tag${outside ? ' extended' : ''}">${outside ? '在标称宽场截止之外' : '在标称宽场范围内'}</span><p class="component-value-label">解混估计 Â<sub>${orderName(i)}</sub> · 检测点 (${A.bin(probeBin.x)}, ${A.bin(probeBin.y)})</p><strong>${arithmeticValue(o.value, scale)}</strong><small>× 10<sup>${exponent}</sup> · 归一化复值</small><p class="order-meaning">${i === 0 ? '这份信息未被照明频移；仍有 OTF 衰减。' : '这份信息由照明编码进来；按采用 m/2 补偿，仍有 OTF 衰减；'}</p><button type="button" class="component-follow" data-follow-order="${i}">↑ 演示如何分出这一项</button></article>`;
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
    strip('s5a', '幅度 · 红圈是同一个检测频率 f', g.separated.map((z, b) => figure(`${names[b]} · Â · 红圈数值见上方答案`, logspec(z, { rings: [RINGS[0]], marker: probeBin }))));
    strip('s5b', '相位 · 红圈仍对应同一个 f', g.separated.map((z, b) => figure(`${names[b]} · Â · 色相表示复相位`, phaseImg(z, { marker: probeBin }))));
    $('c5').innerHTML = '<b>Â 和 C 是同份数据的两个阶段：</b>Â 记在检测位置 f，C 搬回样品位置 q。u 才是解混系数；Â、C 都是计算结果，仍含传递衰减。上面的条纹用于解释单个复数分量；恢复后的完整结构见步骤 09。';
  }
  function r6() {
    const context = probeContext();
    if (!context) { strip('s6a', '', []); strip('s6b', '', []); $('shift-example').replaceChildren(); return; }
    const { g, pr, scale, exponent } = context, o = pr.orders[inspectOrder], b = g.bands[inspectOrder];
    const f = [A.bin(probeBin.x), A.bin(probeBin.y)], q = o.specimenFrequency;
    $('shift-example').innerHTML = `<div class="reason-title"><span class="reason-step">→</span><h3>继续追踪刚才的 ${orderName(inspectOrder)} 级：Â → C</h3></div><div class="frequency-journey"><div><small>Â<sub>${orderName(inspectOrder)}</sub> · 解混数据，记在检测位置</small><b>f = (${f.join(', ')})</b><span class="journey-value">(${arithmeticValue(o.value, scale)}) × 10<sup>${exponent}</sup></span></div><span>减去 ℓk<sub>d</sub><br>数值不变 →</span><div><small>C<sub>${orderName(inspectOrder)}</sub> · 同份数据，归到样品位置</small><b>q = (${q.map(fmt).join(', ')})</b><span class="journey-value">(${arithmeticValue(o.value, scale)}) × 10<sup>${exponent}</sup></span></div></div><p>本方向采用 k<sub>d</sub> = (${fmt(g.kx)}, ${fmt(g.ky)}) 格；因此本次平移 Δq = (${fmt(-b.kx)}, ${fmt(-b.ky)}) 格。${Math.hypot(...q) > KC ? '<b>这个 q 已在标称宽场截止之外</b>，但它的观测来自原来的检测位置 f。' : '这个分量的样品频率仍在标称宽场范围内。'}数据与 OTF 同时归位；C 仍带原检测位置的衰减。</p>`;
    const names = ['0 级', '+1 级', '−1 级'];
    strip('s6a', '归位前 · 红圈 f', g.separated.map((z, b) => figure(`${names[b]} · Â(f)`, logspec(z, { rings: [RINGS[0]], marker: probeBin }))));
    strip('s6b', '归位后 · 红圈 q', g.bands.map((bd, b) => figure(`${names[b]} · C(q) · Δq = (${fmt(-bd.kx)}, ${fmt(-bd.ky)}) 格`, logspec(bd.shifted, { rings: RINGS, vectors: vectorsOf(), marker: { x: mod(f[0] - bd.kx, N), y: mod(f[1] - bd.ky, N) } }))));
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
      figure(`方向 ${inspectDir + 1}：0 级(紫灰) +1 级(<span style="color:var(--red)">红</span>) −1 级(<span style="color:var(--green)">绿</span>)`, cv1),
      figure(`${state.directions} 方向几何支撑 · 重叠处混色`, cv2),
      figure('fairSIM 平方和 R · OTF 平方和 · <span class="bad">红</span>=融合支撑边界', cv3),
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
  /* Fusion teaching frames use the reconstruction's complex arrays. Only the
   * display interpolates; the fairSIM calculation itself is never animated or
   * changed. A cumulative sum must add complex values before taking magnitude. */
  function buildFusionPlan(p) {
    const length = p.numerator.re.length;
    let sum = { re: new Float64Array(length), im: new Float64Array(length) };
    let maximum = Math.max(specMax(p.preApoSpectrum), specMax(p.spectrum));
    const records = p.groups.flatMap(g => g.bands).map(band => {
      const before = sum;
      sum = { re: new Float64Array(length), im: new Float64Array(length) };
      for (let i = 0; i < length; i++) {
        sum.re[i] = before.re[i] + band.matched.re[i];
        sum.im[i] = before.im[i] + band.matched.im[i];
      }
      maximum = Math.max(maximum, specMax(band.shifted), specMax(band.matched), specMax(sum));
      return { band, before, after: sum };
    });
    const reciprocal = Float64Array.from(p.regularizedDenominator, d => d > 1e-14 ? 1 / d : 0);
    let weightMax = 0; for (const v of reciprocal) weightMax = Math.max(weightMax, v);
    return { source: p, records, maximum: maximum || 1, reciprocal, weightMax: weightMax || 1 };
  }
  function fusionFrame(plan, stage, progress) {
    const p = plan.source, t = Math.max(0, Math.min(1, progress));
    // Ease only the display transition; exact complex endpoints stay unchanged.
    const spectrum = (from, to = from, mix = 0) => ({ kind: 'spectrum', from, to, mix: mix * mix * (3 - 2 * mix), maximum: plan.maximum });
    const scalar = (values, maximum, logarithmic = false) => ({ kind: 'scalar', values, maximum, logarithmic });
    if (stage === 0) {
      const position = t * plan.records.length, index = Math.min(plan.records.length - 1, Math.floor(position));
      const local = t === 1 ? 1 : position - index;
      const { band, before, after } = plan.records[index];
      return { index, phase: local < .5 ? 'weight' : 'add', band, views: [
        spectrum(band.shifted),
        spectrum(band.shifted, band.matched, Math.min(1, local * 2)),
        spectrum(before, after, Math.max(0, local * 2 - 1)),
      ] };
    }
    return { index: -1, phase: 'filter', views: stage === 1
      ? [spectrum(p.numerator), scalar(plan.reciprocal, plan.weightMax, true), spectrum(p.numerator, p.preApoSpectrum, t)]
      : [spectrum(p.preApoSpectrum), scalar(p.apodization, 1), spectrum(p.preApoSpectrum, p.spectrum, t)] };
  }
  function fusionPixel(view, i) {
    if (view.kind === 'scalar') return { re: view.values[i], im: 0 };
    // Exact endpoints matter when phases cancel or when a coefficient is zero.
    if (view.mix === 0) return { re: view.from.re[i], im: view.from.im[i] };
    if (view.mix === 1) return { re: view.to.re[i], im: view.to.im[i] };
    return {
      re: view.from.re[i] + view.mix * (view.to.re[i] - view.from.re[i]),
      im: view.from.im[i] + view.mix * (view.to.im[i] - view.from.im[i]),
    };
  }
  function stopFusionPlayback() {
    cancelAnimationFrame(fusionPlayback.raf);
    fusionPlayback.raf = 0; fusionPlayback.playing = false; fusionPlayback.last = null;
    fusionPlayback.epoch++;
  }
  function syncFusionSource() {
    const f = fusionPlayback;
    if (f.source === pipe) return;
    stopFusionPlayback();
    Object.assign(f, { source: pipe, plan: null, stage: -1, progress: 0, done: [false, false, false], views: [], frameKey: '' });
    const eq = $('fusion-animation-equation'); if (eq) eq.dataset.stage = '';
    $('fusion-player').hidden = true; $('fusion-results').hidden = true;
    for (const id of ['fusion-input', 'fusion-weight', 'fusion-output']) {
      const cv = $(id); cv.getContext('2d').clearRect(0, 0, cv.width, cv.height);
    }
    syncFusionControls();
  }
  function syncFusionControls() {
    const f = fusionPlayback;
    document.querySelectorAll('[data-fusion-step]').forEach(button => {
      const stage = Number(button.dataset.fusionStep), active = stage === f.stage;
      button.disabled = !pipe.ok;
      button.setAttribute('aria-pressed', String(active));
      button.dataset.complete = String(f.done[stage]);
      button.style.setProperty('--step-fill', String(active ? f.progress : f.done[stage] ? 1 : 0));
      const action = active && f.playing ? '播放中 · 点击暂停'
        : active && f.progress < 1 ? '已暂停 · 点击继续'
        : f.done[stage] ? '已完成 · 点击重播' : '点击播放';
      button.querySelector('.fusion-card-state').textContent = action;
      button.setAttribute('aria-label', ['加权求和', 'Wiener 滤波', '乘切趾窗'][stage] + '，' + action);
    });
    // Completing the final operation is enough to present the full overview,
    // including when the user jumps straight to the third card.
    $('fusion-results').hidden = !f.done[2];
    $('fusion-player').hidden = f.stage < 0 || (f.stage === 2 && f.progress === 1);
    const active = pipe.ok && f.stage >= 0;
    $('fusion-play').disabled = !active;
    $('fusion-play').textContent = !active ? '先选择步骤' : f.playing ? '暂停' : f.progress === 1 ? '重播本步' : '继续';
    $('fusion-progress').disabled = !active;
    const speedIndex = [.25, .5, 1, 2].indexOf(f.speed);
    $('fusion-speed').disabled = !pipe.ok || reducedMotion.matches;
    $('fusion-speed').value = String(speedIndex);
    $('fusion-speed').setAttribute('aria-valuetext', f.speed + ' 倍速');
    $('fusion-speed-value').textContent = f.speed + '×';
    $('fusion-speed-dial').style.setProperty('--dial-angle', (-135 + speedIndex * 90) + 'deg');
    $('fusion-speed-dial').dataset.speedIndex = String(speedIndex);
    $('fusion-playback-help').textContent = reducedMotion.matches
      ? '系统已开启减少动态效果，播放直接显示本步结果；仍可拖动进度，逐帧对照公式。'
      : '拖动进度会暂停，可以停在任意位置对照公式，再点“继续”。倍速只改变演示时长。';
    syncFusionProgress();
  }
  function syncFusionProgress() {
    const progress = fusionPlayback.progress, percent = Math.round(progress * 100) + '%';
    $('fusion-progress').value = String(Math.round(progress * 1000));
    $('fusion-progress').setAttribute('aria-valuetext', percent);
    $('fusion-progress').style.setProperty('--range-fill', progress * 100 + '%');
    $('fusion-progress-value').textContent = percent;
  }
  function drawFusionFrame(force = false) {
    const f = fusionPlayback;
    if (f.stage < 0 || !f.plan) return;
    const frame = fusionFrame(f.plan, f.stage, f.progress);
    const key = f.stage + ':' + frame.index + ':' + frame.phase + ':' + Math.floor(f.progress * 2);
    const order = frame.band?.order, ell = order > 0 ? '+1' : order === -1 ? '−1' : '0';
    const names = ['加权求和', 'Wiener 滤波', '乘切趾窗'];
    if (key !== f.frameKey || force) {
      f.frameKey = key;
      $('fusion-animation-title').textContent = '0' + (f.stage + 1) + ' / ' + names[f.stage];
      $('fusion-animation-status').textContent = f.progress === 1 ? '本步完成'
        : f.stage === 0 ? '方向 ' + (frame.band.direction + 1) + ' · ' + ell + ' 级 · ' + (frame.phase === 'weight' ? '乘 OTF' : '加入累计和') : '逐点相乘';
      const eqEl = $('fusion-animation-equation');
      if (f.stage === 0) {
        if (eqEl.dataset.stage !== '0' || !eqEl.querySelector('.katex')) {
          eqEl.dataset.stage = '0';
          delete eqEl.dataset.tex;
          eqEl.innerHTML = '<div class="fusion-eq-rows">' +
            '<div class="fusion-eq-row"><span class="fusion-eq-label">方向内合并</span><span class="fusion-eq-math formula" data-tex="U_d = H_{d,0}^{*} C_{d,0} + H_{d,+1}^{*} C_{d,+1} + H_{d,-1}^{*} C_{d,-1}"></span></div>' +
            '<div class="fusion-eq-row"><span class="fusion-eq-label">跨方向汇总</span><span class="fusion-eq-math formula" data-tex="U = \\sum_d U_d"></span></div>' +
            '</div>' +
            '<p class="fusion-eq-note"><span data-tex="U">U</span> 是各方向加权汇总后的二维复数频谱。</p>';
          if (typeof renderMath === 'function') renderMath(eqEl);
        }
      } else if (f.stage === 1) {
        if (eqEl.dataset.stage !== '1' || !eqEl.querySelector('.katex')) {
          eqEl.dataset.stage = '1';
          const equation = '\\widehat S_{\\mathrm W}(\\mathbf q)=U(\\mathbf q)\\,\\frac{1}{R(\\mathbf q)+w^2}';
          eqEl.dataset.tex = equation;
          eqEl.innerHTML = '<div class="fusion-eq-rows">' +
            '<div class="fusion-eq-row"><span class="fusion-eq-label">Wiener 滤波</span><span class="fusion-eq-math formula" data-tex="' + equation + '"></span></div>' +
            '</div>' +
            '<p class="fusion-eq-note"><span data-tex="R(\\mathbf q)">R(\\mathbf q)</span> 是各方向 OTF 模平方累计，<span data-tex="w">w</span> 控制反演增益与噪声放大。</p>';
          if (typeof renderMath === 'function') renderMath(eqEl);
        }
      } else if (f.stage === 2) {
        if (eqEl.dataset.stage !== '2' || !eqEl.querySelector('.katex')) {
          eqEl.dataset.stage = '2';
          const equation = '\\widehat S(\\mathbf q)=\\widehat S_{\\mathrm W}(\\mathbf q)\\,P_{\\mathrm{apo}}(\\mathbf q)';
          eqEl.dataset.tex = equation;
          eqEl.innerHTML = '<div class="fusion-eq-rows">' +
            '<div class="fusion-eq-row"><span class="fusion-eq-label">乘切趾窗</span><span class="fusion-eq-math formula" data-tex="' + equation + '"></span></div>' +
            '</div>' +
            '<p class="fusion-eq-note"><span data-tex="P_{\\mathrm{apo}}(\\mathbf q)">P_{\\mathrm{apo}}(\\mathbf q)</span> 为平滑切趾窗，平缓压低边缘高频以抑制振铃假影。</p>';
          if (typeof renderMath === 'function') renderMath(eqEl);
        }
      }
      const labels = f.stage === 0
        ? ['归位频带 C<small>方向 ' + (frame.band.direction + 1) + ' · ' + ell + ' 级</small>',
          '乘共轭 OTF → H*C<small>左图中的这一份观测被加权</small>',
          '加到累计和 U<small>' + (f.progress === 1 ? '全部 ' + f.plan.records.length + ' 项已加入' : '已加入 ' + frame.index + ' 项 · 正在处理第 ' + (frame.index + 1) + ' 项') + '</small>']
        : f.stage === 1 ? ['加权和 U<small>来自第 1 步的完整结果</small>', '× Wiener 系数 1 / (R + w²)<small>系数独立对数显示 · 白色最大</small>', '→ Wiener 频谱 Ŝ<sub>W</sub><small>同一标尺，观察滤波前后的变化</small>']
        : ['Wiener 频谱 Ŝ<sub>W</sub><small>来自第 2 步的完整结果</small>', '× 切趾窗 P<sub>apo</sub><small>线性亮度 · 黑 0，白 1</small>', '→ 最终频谱 Ŝ<small>同一标尺，观察边缘的衰减</small>'];
      ['input', 'weight', 'output'].forEach((name, j) => {
        $('fusion-' + name + '-label').innerHTML = labels[j];
        $('fusion-' + name).setAttribute('aria-label', labels[j].replace(/<[^>]*>/g, ' '));
      });
      $('fusion-animation-copy').textContent = f.stage === 0
        ? f.progress === 1 ? '各方向的 0、+1、−1 级均已乘对应 OTF，再以复数相加；右图就是完整分子 U。'
          : frame.phase === 'weight' ? '先看中图：当前频带逐点乘共轭 OTF。此时右侧的累计和保持不变。'
          : '再看右图：把中间这份加权频带加入累计和；三个级次完成后，继续下一个方向。'
        : f.stage === 1 ? '左图逐点乘中间的系数，得到右图。R 按所引用 fairSIM 版本累计 OTF 模平方；w 限制反演增益。'
        : '左图逐点乘切趾窗，右图边缘随之压低。完成后，最终频谱交给步骤 09 的逆 FFT。';
    }
    frame.views.forEach((view, j) => {
      const old = f.views[j];
      if (!force && old && old.from === view.from && old.to === view.to && old.mix === view.mix && old.values === view.values) return;
      const cv = $(['fusion-input', 'fusion-weight', 'fusion-output'][j]);
      blit(cv, (x, y) => {
        const z = fusionPixel(view, spectrumIndex(x, y, f.source.spectrumSize));
        const value = Math.hypot(z.re, z.im);
        const brightness = view.kind === 'spectrum' ? Math.log1p(value) / Math.log1p(view.maximum)
          : view.logarithmic ? Math.log1p(100 * value / view.maximum) / Math.log(101) : value / view.maximum;
        return gray(brightness);
      });
      overlay(cv, { rings: RINGS });
    });
    f.views = frame.views;
    document.querySelectorAll('[data-fusion-step]').forEach(button => {
      const stage = Number(button.dataset.fusionStep);
      button.style.setProperty('--step-fill', String(stage === f.stage ? f.progress : f.done[stage] ? 1 : 0));
    });
    syncFusionProgress();
  }
  function finishFusionStep() {
    const f = fusionPlayback;
    if (!f.plan || f.stage < 0) return;
    stopFusionPlayback(); f.progress = 1; f.done[f.stage] = true;
    drawFusionFrame(); syncFusionControls();
  }
  function queueFusionPlayback() {
    const f = fusionPlayback;
    if (reducedMotion.matches) { finishFusionStep(); return; }
    f.playing = true; f.last = null; f.painted = 0;
    const epoch = f.epoch;
    const tick = now => {
      if (!f.playing || epoch !== f.epoch) return;
      const elapsed = f.last === null ? 0 : now - f.last;
      f.last = now;
      // At the default 0.5×, each band takes 8 s (weight 4 s + add 4 s),
      // and the Wiener/apodization steps each take 12 s.
      const duration = f.stage === 0 ? f.plan.records.length * 4000 : 6000;
      f.progress = Math.min(1, f.progress + elapsed * f.speed / duration);
      if (f.progress === 1) { finishFusionStep(); return; }
      if (now - f.painted >= 1000 / 60) { drawFusionFrame(); f.painted = now; }
      f.raf = requestAnimationFrame(tick);
    };
    f.raf = requestAnimationFrame(tick); syncFusionControls();
  }
  function startFusionStep(stage) {
    if (!pipe.ok || ![0, 1, 2].includes(stage)) return;
    syncFusionSource(); stopFusionPlayback();
    const f = fusionPlayback;
    if (!f.plan) f.plan = buildFusionPlan(pipe);
    f.stage = stage; f.progress = 0; f.views = []; f.frameKey = '';
    $('fusion-player').hidden = false;
    drawFusionFrame(true); queueFusionPlayback();
  }
  function activateFusionStep(stage) {
    if (!pipe.ok || ![0, 1, 2].includes(stage)) return;
    syncFusionSource();
    const f = fusionPlayback;
    if (stage !== f.stage || f.progress === 1) { startFusionStep(stage); return; }
    if (f.playing) { stopFusionPlayback(); syncFusionControls(); }
    else queueFusionPlayback();
  }
  function setFusionSpeed(value) {
    const speed = Number(value), f = fusionPlayback;
    if (![.25, .5, 1, 2].includes(speed) || speed === f.speed) return;
    const wasPlaying = f.playing;
    stopFusionPlayback(); f.speed = speed;
    // Start a new clock at the displayed frame, so a speed change never
    // reinterprets the time already elapsed or leaves two RAF loops running.
    if (wasPlaying) queueFusionPlayback();
    else syncFusionControls();
  }
  function fusionSpeedAngle(clientX, clientY, rect) {
    const x = clientX - rect.left - rect.width / 2, y = clientY - rect.top - rect.height / 2;
    // Clicking the centre focuses the control without choosing an arbitrary stop.
    if (Math.hypot(x, y) < 8) return null;
    return Math.atan2(x, -y) * 180 / Math.PI;
  }
  function fusionSpeedIndex(angle) {
    return Math.max(0, Math.min(3, Math.round((angle + 135) / 90)));
  }
  function bindFusionSpeedDial() {
    const input = $('fusion-speed'), speeds = [.25, .5, 1, 2];
    let drag = null;
    const selectIndex = value => {
      const index = Number(value);
      if (input.disabled || !Number.isInteger(index) || index < 0 || index > 3) return;
      setFusionSpeed(speeds[index]);
    };
    input.addEventListener('input', () => selectIndex(input.value));
    input.addEventListener('change', () => selectIndex(input.value));
    input.addEventListener('keydown', event => {
      if (input.disabled) return;
      const current = speeds.indexOf(fusionPlayback.speed);
      const next = { ArrowRight: current + 1, ArrowUp: current + 1, ArrowLeft: current - 1, ArrowDown: current - 1, Home: 0, End: 3 }[event.key];
      if (next === undefined) return;
      event.preventDefault(); selectIndex(Math.max(0, Math.min(3, next)));
    });
    input.addEventListener('pointerdown', event => {
      if (input.disabled || drag || event.button !== 0) return;
      event.preventDefault(); input.focus({ preventScroll: true });
      const angle = fusionSpeedAngle(event.clientX, event.clientY, input.getBoundingClientRect());
      const sweep = angle === null ? -135 + speeds.indexOf(fusionPlayback.speed) * 90 : Math.max(-135, Math.min(135, angle));
      drag = { id: event.pointerId, angle, sweep };
      input.setPointerCapture(event.pointerId);
      if (angle !== null) selectIndex(fusionSpeedIndex(sweep));
    });
    input.addEventListener('pointermove', event => {
      if (!drag || drag.id !== event.pointerId || input.disabled) return;
      const angle = fusionSpeedAngle(event.clientX, event.clientY, input.getBoundingClientRect());
      if (angle === null) return;
      if (drag.angle !== null) {
        // Unwrap the circle before clamping its open bottom gap, so dragging
        // across ±180° cannot jump from the fastest stop to the slowest.
        const delta = (angle - drag.angle + 540) % 360 - 180;
        drag.sweep = Math.max(-135, Math.min(135, drag.sweep + delta));
      } else drag.sweep = Math.max(-135, Math.min(135, angle));
      drag.angle = angle; selectIndex(fusionSpeedIndex(drag.sweep));
    });
    const endDrag = event => {
      if (!drag || drag.id !== event.pointerId) return;
      drag = null;
      if (input.hasPointerCapture(event.pointerId)) input.releasePointerCapture(event.pointerId);
    };
    input.addEventListener('pointerup', endDrag);
    input.addEventListener('pointercancel', endDrag);
    input.addEventListener('lostpointercapture', () => { drag = null; });
  }
  function seekFusionProgress(value) {
    const progress = Number(value);
    if (!pipe.ok || !Number.isFinite(progress)) return;
    syncFusionSource();
    const f = fusionPlayback;
    if (!f.plan || f.stage < 0) return;
    stopFusionPlayback(); f.progress = Math.max(0, Math.min(1, progress));
    if (f.progress === 1) f.done[f.stage] = true;
    drawFusionFrame(true); syncFusionControls();
  }
  function r8() {
    syncFusionSource();
    drawFusionFrame(true);
    if (!pipe.ok) { $('s8').replaceChildren(); $('s8-transfer').replaceChildren(); $('s8-denominator').replaceChildren(); return; }
    const commonMax = Math.max(specMax(pipe.preApoSpectrum), specMax(pipe.spectrum));
    strip('s8', '', [
      figure('<span class="stage-number">1</span><b>OTF 加权求和 U</b><small>每份频带乘 H*，再相加</small>', logspec(pipe.numerator, { rings: RINGS })),
      figure('<span class="stage-number">2</span><b>Wiener 频谱 Ŝ<sub>W</sub></b><small>U / (R + w²)，尚未切趾</small>', logspec(pipe.preApoSpectrum, { max: commonMax, rings: RINGS })),
      figure('<span class="stage-number">3</span><b>切趾窗 P<sub>apo</sub></b><small>白 = 1，黑 = 0，线性亮度</small>', overlay(blit(plate(), (x, y) => gray(pipe.apodization[spectrumIndex(x, y, pipe.spectrumSize)])), { rings: RINGS })),
      figure('<span class="stage-number">4</span><b>最终频谱 Ŝ</b><small>乘 P<sub>apo</sub> 后的频谱，交给 09 逆 FFT</small>', logspec(pipe.spectrum, { max: commonMax, rings: RINGS })),
    ]);
    $('s8-denominator').replaceChildren(figure('fairSIM 实际分母 R + w² · 对数显示', scalarSpectrum(pipe.regularizedDenominator)));
    const points = values => Array.from({ length: 21 }, (_, q) => [q, values[A.idx(q, 0, pipe.spectrumSize)]]);
    $('s8-transfer').replaceChildren(linePlot({ label: '沿水平方向的理想匹配传递：宽场、Wiener 后、切趾后', xmax: 20, xticks: [0, 5, 10, 15, 20], xlabel: '频率 qx / DFT 格（向右：结构更细）', ylabel: '真实信号的幅度保留比例', reference: KC, series: [
      { name: '宽场 OTF', color: '#2563eb', points: Array.from({ length: 21 }, (_, q) => [q, A.otf(q, 0, KC)]) },
      { name: 'G_W · Wiener 后，未切趾', color: '#a16207', dash: true, points: points(pipe.preApoTransfer) },
      { name: 'G · 最终输出，已切趾', color: '#087f6b', points: points(pipe.effectiveTransfer) },
    ] }));
  }
  // Evaluation only: truth never feeds back into the reconstruction pipeline.
  function renderQuality() {
    const quality = $('quality-readout');
    if (!pipe.ok || !pipe.pixels) { quality.replaceChildren(); return; }
    const truth = cap.truth.sample, pixels = pipe.pixels, n2 = N * N;
    let bias = 0, mse = 0;
    for (let i = 0; i < n2; i++) {
      const e = pixels[i] - truth[i]; bias += e; mse += e * e;
    }
    bias /= n2; mse /= n2;
    const share = mse > 1e-24 ? bias * bias / mse : null;
    quality.innerHTML = `<div class="quality-card"><span>整体绝对强度误差 · RMSE</span><b>${Math.sqrt(mse).toFixed(4)}</b><small>无噪声宽场参考 ${C.rmse(cap.truth.widefield, truth).toFixed(4)}；不是分辨率的单独指标</small></div>
      <div class="quality-card"><span>平均亮度偏差 · 重建 − 真值</span><b>${bias.toFixed(4)}</b><small>${share === null ? 'MSE 近零，不报告占比' : `平均偏差平方占当前 MSE 的 ${(share * 100).toFixed(2)}%`}</small></div>`;
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
      items.push(figure('<b>有符号误差</b><small>重建 − 真值 · 蓝负 / 红正 · 颜色越强，局部绝对强度误差越大；不能单独判断方向分辨率</small>', errImg(px, s)));
    }
    strip('s9', '', items);
    renderQuality();
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
    $('c9').innerHTML = `<b>沿橙线读图：</b>当前取 y = ${profileY}。<b>先分别看峰位、峰间谷和绝对亮度。</b>绿线越贴近黑虚线，表示这条剖面的强度误差越小；峰高偏低或谷变浅可能提示对比度或高频衰减，也需要结合平均亮度偏差、步骤 07 的支撑与步骤 08 的传递曲线判断。曲线来自图像中的同一行；额外的起伏也可能是噪声或振铃。<br><span class="profile-blind"><b>盲区提醒：</b>橙线只能沿横向取样，量的是"亮度沿 x 变化"的那批结构。它<b>看不见"沿 y 变化"的结构有没有被恢复</b>——那些条纹恰好与橙线平行。判断方向覆盖要结合步骤 07 的支撑图和不同朝向结构的表现；误差图可能混有亮度、位置或噪声误差，不能单独判定哪个方向没恢复。</span><br><span>保持原实现的 0 级分母计数，不用真值校正亮度，因此无噪声时也不保证 RMSE 小于宽场。</span>`;
  }

  function renderAll() { r1(); r2(); r3(); r4(); r7(); r8(); r9(); }

  /* ---------- controls ---------- */
  const rangeControls = Array.from(document.querySelectorAll('input[type="range"]'));
  function paintRange(el) {
    const min = Number(el.min || 0), max = Number(el.max || 100);
    const progress = max > min ? (Number(el.value) - min) / (max - min) : 0;
    el.style.setProperty('--range-fill', `${100 * Math.max(0, Math.min(1, progress))}%`);
  }
  for (const el of rangeControls) {
    paintRange(el);
    el.addEventListener('input', () => paintRange(el));
    el.addEventListener('change', () => paintRange(el));
  }
  function syncViewControls() {
    rangeControls.forEach(paintRange);
    $('c-inspect').value = String(inspectDir);
  }
  $('c-inspect').addEventListener('change', e => {
    inspectDir = Number(e.target.value); renderEncodingSpectra(); r3(); r4(); r7();
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
    if (document.hidden) { stopDemixPlayback(); syncDemixPlayback(); stopFusionPlayback(); syncFusionControls(); }
  });
  $('order-results').addEventListener('click', e => {
    const button = e.target.closest('[data-follow-order]');
    if (!button) return;
    inspectOrder = Number(button.dataset.followOrder); renderDemixCalculation(); r5(); r6();
    $('demix-animation').scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'start' });
    $('demix-play').focus({ preventScroll: true });
  });
  $('probe-reset').addEventListener('click', () => { probeBin = { x: 6, y: 0 }; r4(); });

  document.querySelectorAll('[data-fusion-step]').forEach(button => button.addEventListener('click', () => activateFusionStep(Number(button.dataset.fusionStep))));
  $('fusion-play').addEventListener('click', () => activateFusionStep(fusionPlayback.stage));
  bindFusionSpeedDial();
  $('fusion-progress').addEventListener('input', e => seekFusionProgress(Number(e.target.value) / 1000));
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches && fusionPlayback.playing) finishFusionStep();
    syncFusionControls();
  });
  $('c-profile-y').addEventListener('input', e => { profileY = Number(e.target.value); $('o-profile-y').textContent = profileY; r9(); });

  // Keep the current stage visible in the compact navigation without moving the page.
  const navLinks = Array.from(document.querySelectorAll('.stage-nav a'));
  const sections = navLinks.map(a => document.querySelector(a.getAttribute('href')));
  let scrolling = false, navLockUntil = 0;
  function setActiveNav(index) {
    navLinks.forEach((a, i) => {
      if (i === index) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current');
    });
  }
  // A direct anchor click must highlight its target immediately, and win over the
  // scroll recompute that smooth-scrolling fires on the way down.
  navLinks.forEach((a, i) => a.addEventListener('click', () => { setActiveNav(i); navLockUntil = performance.now() + 900; }));
  function updateNavigation() {
    scrolling = false;
    if (performance.now() < navLockUntil) return;
    // "Top 1/3 of the reading area": a stage is current once its top passes this line.
    const line = innerHeight / 3;
    let index = 0;
    sections.forEach((section, i) => { if (section && section.getBoundingClientRect().top <= line) index = i; });
    setActiveNav(index);
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
  document.addEventListener('click', event => {
    if (event.target.closest('a[href^="#source"]')) $('sources').open = true;
  });
  $('b4').addEventListener('click', event => {
    if (event.target.closest('a[href="#demix-arithmetic"]')) $('demix-arithmetic').open = true;
  });

  if (window.katex) for (const el of document.querySelectorAll('[data-tex]'))
    katex.render(el.dataset.tex, el, { displayMode: el.classList.contains('formula'), throwOnError: false });
  recompute();
  updateNavigation();
  window.SIMAtlasPage = { get state() { return state; }, get pipe() { return pipe; }, get capture() { return cap; }, recompute, probe: b => { probeBin = b; r4(); }, encodingFrequencyMap, encodingProbeSummary };
})();
