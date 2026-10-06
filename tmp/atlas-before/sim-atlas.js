/* Renderer for the pipeline atlas. Pure DOM/canvas: all physics lives in
 * sim-atlas-core.js. Nine bands, one per pipeline stage, plus a probe panel
 * that answers "what is mixed at this detector bin?". */
(function () {
  'use strict';
  const A = window.SIMAtlas, C = window.SIMCore;
  const N = A.N, KC = A.KC, KI = 8, SCALE = 2, PX = N * SCALE;
  const $ = id => document.getElementById(id);
  const fmt = x => Number(x.toFixed(3)).toString();
  const cplx = z => `${z.re >= 0 ? '' : '−'}${fmt(Math.abs(z.re))}${z.im >= 0 ? '+' : '−'}${fmt(Math.abs(z.im))}i`;
  const mod = (v, n) => ((v % n) + n) % n;

  /* ---------- canvas helpers ---------- */
  function plate(w = PX, h = PX) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
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
  function specMax(z) { let m = 0; for (let i = 0; i < N * N; i++) m = Math.max(m, mag(z, i)); return m; }
  // Display array bin (bx,by) at screen grid ((bx+N/2)%N, (by+N/2)%N), log scale.
  function logspec(z, opt = {}) {
    const mx = Math.log(1 + (opt.max || specMax(z)));
    const cv = plate();
    blit(cv, (x, y) => {
      const i = mod(y + N / 2, N) * N + mod(x + N / 2, N);
      return gray(Math.log(1 + mag(z, i)) / mx);
    });
    overlay(cv, opt);
    return cv;
  }
  function phaseImg(z, opt = {}) {
    const mx = specMax(z) || 1;
    const cv = plate();
    blit(cv, (x, y) => {
      const i = mod(y + N / 2, N) * N + mod(x + N / 2, N);
      const a = mag(z, i) / mx;
      if (a < 0.02) return [10, 12, 20];
      const h = mod(Math.atan2(z.im[i], z.re[i]) * 180 / Math.PI + 360, 360);
      return hsl2rgb(h, .85, .28 + .42 * Math.min(1, a * 2.2));
    });
    overlay(cv, opt);
    return cv;
  }
  function overlay(cv, opt) {
    const ctx = cv.getContext('2d'), c = PX / 2, u = PX / N;
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
      const x = (opt.marker.x + N / 2) % N * u + u / 2, y = (opt.marker.y + N / 2) % N * u + u / 2;
      ctx.strokeStyle = '#f87171'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 7, 0, 2 * Math.PI); ctx.stroke();
    }
    if (opt.boundary) {
      ctx.strokeStyle = '#f87171'; ctx.lineWidth = 1.6; ctx.beginPath();
      for (let d = 0; d <= 360; d += 2) {
        const r = opt.boundary(d * Math.PI / 180) * u, a = d * Math.PI / 180;
        const x = c + r * Math.cos(a), y = c - r * Math.sin(a);
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
    const c = document.createElement('figcaption'); c.innerHTML = caption; f.append(c); return f;
  }
  function strip(id, lane, items) {
    const el = $(id); el.replaceChildren();
    if (lane) { const l = document.createElement('span'); l.className = 'lane'; l.textContent = lane; el.append(l); }
    for (const it of items) el.append(it);
  }
  // Fused-support radius in bins, per angle (kc and |k_i| both in bins).
  function supportRadius(theta, angles) {
    let r = KC;
    for (const a of angles) {
      const d = theta - a * Math.PI / 180, c = Math.abs(Math.cos(d));
      const disc = KC * KC - KI * KI * Math.sin(d) ** 2;
      if (disc >= 0) r = Math.max(r, KI * c + Math.sqrt(disc));
    }
    return r;
  }

  /* ---------- state ---------- */
  const state = { sample: 'star-points', directions: 3, m: .8, noise: 'none', msrc: 'known', eps: 0, phase: 0, angle: 0, merr: 0, otf: 0, scope: 'both' };
  let cap = null, pipe = null, probeBin = { x: 70, y: 64 }, inspectDir = 0;
  const options = () => ({
    eps: state.eps, phaseError: state.phase * Math.PI / 180, angleError: state.angle,
    modulationError: state.merr / 100, otfError: state.otf / 100,
    errorsAffectEstimator: state.scope !== 'recon',
  });
  const RINGS = [
    { r: KC, color: '#38bdf8', dash: [5, 4] },
    { r: KC + KI, color: '#4ade80', dash: [2, 3] },
  ];
  const vectorsOf = () => (state.directions === 3 ? A.VECTORS : A.VECTORS.slice(0, 1));

  function recompute() {
    cap = A.capture({ sample: state.sample, directions: state.directions, m: state.m, noise: state.noise });
    const mKnown = state.msrc === 'known' ? state.m : undefined;
    pipe = A.pipeline(cap.raw, cap.calibration, options(), mKnown);
    inspectDir = Math.min(inspectDir, pipe.groups.length - 1);
    renderAll();
  }

  /* ---------- band renderers ---------- */
  function r1() {
    const s = cap.truth.sample, sp = cap.truth.spectrum;
    strip('s1', '', [
      figure('<b>样品</b> · 西门子星' + (state.sample.includes('points') ? ' + 点对' : ''), blit(plate(), (x, y) => gray(s[y * N + x]))),
      figure('log|F| · <span class="k">蓝</span>=k<sub>c</sub> <span class="good">青</span>=k<sub>c</sub>+|k<sub>i</sub>| <b>+</b>=k<sub>i</sub>',
        logspec(sp, { rings: RINGS, vectors: vectorsOf() })),
      figure('<b>无噪声宽场参考</b>', blit(plate(), (x, y) => gray(cap.truth.widefield[y * N + x]))),
    ]);
    const wf = A.radialProfile(cap.truth.widefield);
    const zones = { beyond: wf.find(r => A.zoneOf(r.localPeriod) === 'beyond'), sim: wf.find(r => A.zoneOf(r.localPeriod) === 'sim-only'), wide: wf.find(r => A.zoneOf(r.localPeriod) === 'widefield') };
    $('c1').innerHTML = `三个区域在同一张图上：<b>r &lt; 18</b> 超出融合支撑（宽场与 SIM 都恢复不了）；` +
      `<b>18 &lt; r &lt; 32</b> 仅 SIM 可达（宽场对比度 ${zones.sim ? zones.sim.contrast.toFixed(3) : '—'}）；` +
      `<b>r &gt; 32</b> 宽场部分可见但仍被 OTF 衰减。点对间距 5 / 7 / 9 px 分别落在三个区域里。`;
    $('zones').replaceChildren(...[
      ['r &lt; 18 · 局部周期 &lt; 7.1 px', '超出 SIM 极限', '#f87171'],
      ['18 &lt; r &lt; 32 · 7.1–12.8 px', '仅 SIM 可达', '#4ade80'],
      ['r &gt; 32 · &gt; 12.8 px', '宽场部分可见', '#38bdf8'],
    ].map(([t, s2, col]) => {
      const d = document.createElement('span'); d.className = 'zone';
      d.innerHTML = `<i style="background:${col}"></i>${t} · ${s2}`; return d;
    }));
  }
  function r2() {
    const lights = [], moires = [];
    for (let d = 0; d < cap.truth.illumination.length; d++) {
      lights.push(figure(`方向 ${d + 1} · φ=0 照明`, blit(plate(), (x, y) => gray(cap.truth.illumination[d][0][y * N + x] / 1.8))));
      moires.push(figure(`方向 ${d + 1} · 样品×照明`, blit(plate(), (x, y) => gray(cap.truth.emission[d][0][y * N + x] / 1.8))));
    }
    strip('s2a', '照明', lights); strip('s2b', '摩尔纹', moires);
  }
  function r3() {
    const raws = [], specs = [];
    for (const g of pipe.groups) for (const f of g.frames) {
      raws.push(figure(`方向 ${g.index + 1} · φ=${fmt(f.phase / Math.PI)}π`, blit(plate(), (x, y) => gray(f.pixels[y * N + x]))));
      specs.push(figure('', logspec(A.spectrum(f.pixels, N), { rings: [RINGS[0]] })));
    }
    strip('s3a', 'raw', raws); strip('s3b', 'log|F|', specs);
  }
  function r4() {
    const g = pipe.groups[inspectDir];
    const cv = g ? logspec(g.rawSpectra[0], { rings: RINGS, vectors: vectorsOf(), marker: probeBin }) : plate();
    cv.style.cursor = 'crosshair';
    cv.onclick = e => {
      const rect = cv.getBoundingClientRect();
      const sx = Math.floor((e.clientX - rect.left) / rect.width * N), sy = Math.floor((e.clientY - rect.top) / rect.height * N);
      probeBin = { x: mod(sx + N / 2, N), y: mod(sy + N / 2, N) };
      r4();
    };
    strip('s4', '', [figure(`方向 ${inspectDir + 1} · φ=0 帧频谱<br><span class="k">点击取探测点</span>`, cv)]);
    renderProbe();
  }
  function renderProbe() {
    const el = $('probe'), g = pipe.groups[inspectDir];
    if (!g || !g.separated) { el.innerHTML = '<h3>探测点</h3><p class="hint">当前配置无法解混（相位秩不足或病态），没有可展示的中间量。</p>'; return; }
    const pr = A.probe(pipe, inspectDir, probeBin.x, probeBin.y);
    const rows = pr.orders.map(o => {
      const tgt = o.specimenBin.raw;
      return `<tr><td>${o.order === 0 ? '0 级' : o.order > 0 ? '+1 级' : '−1 级'}</td>` +
        `<td>${cplx(o.value)}</td><td>${fmt(Math.hypot(o.value.re, o.value.im))}</td>` +
        `<td>(${fmt(tgt[0] - N / 2)}, ${fmt(tgt[1] - N / 2)})</td><td>${o.h === null ? '—' : o.h.toFixed(3)}</td></tr>`;
    }).join('');
    el.innerHTML = `<h3>探测点 · 检测 bin (${probeBin.x}, ${probeBin.y}) = 频率 (${fmt(pr.freq.fx)}, ${fmt(pr.freq.fy)}) px⁻¹</h3>
      <table><tr><th>观测量</th><th>D₀</th><th>D₁</th><th>D₂</th></tr>
      <tr><td>复值</td>${pr.observed.map(o => `<td>${cplx(o)}</td>`).join('')}</tr>
      <tr><td>模</td>${pr.observed.map(o => `<td>${fmt(Math.hypot(o.re, o.im))}</td>`).join('')}</tr></table>
      <table style="margin-top:8px"><tr><th>级次</th><th>解混值 X</th><th>|X|</th><th>搬回样品频率</th><th>H(k±kᵢ)</th></tr>${rows}</table>
      <p class="hint">三个观测是同一检测点上 <b>三个样品频率</b> 的线性混合；解混矩阵条件数 ${pr.condition.toFixed(2)}，采用 m = ${pr.m.toFixed(3)}。
      H = 0 的级次表示该样品频率搬回后落在 OTF 之外，本就不携带可测信息。</p>`;
  }
  function r5() {
    const g = pipe.groups[inspectDir];
    if (!g || !g.separated) { strip('s5a', '', []); strip('s5b', '', []); $('c5').textContent = '当前配置无法解混。'; return; }
    const names = ['0 级', '+1 级', '−1 级'];
    strip('s5a', '幅度', g.separated.map((z, b) => figure(names[b], logspec(z, { rings: [RINGS[0]] }))));
    strip('s5b', '相位', g.separated.map((z, b) => figure(names[b], phaseImg(z))));
    $('c5').innerHTML = `相移矩阵条件数 <b>${g.system.condition.toFixed(2)}</b>（等间隔三相位时最小）。` +
      `零级相位图只有 0 / π 两色，因为它是实函数；±1 级是复函数，相位连续变化——那份相位就是结构的位置信息，也是 Δφ 失配旋转的对象。`;
  }
  function r6() {
    const g = pipe.groups[inspectDir];
    if (!g || !g.separated) { strip('s6a', '', []); strip('s6b', '', []); return; }
    const names = ['0 级', '+1 级', '−1 级'];
    strip('s6a', '检测坐标', g.separated.map((z, b) => figure(names[b], logspec(z, { rings: [RINGS[0]] }))));
    strip('s6b', '样品坐标', g.bands.map((bd, b) => figure(`${names[b]} · 搬 ${(bd.kx).toFixed(0)},${(bd.ky).toFixed(0)}`,
      logspec(bd.shifted, { rings: RINGS, vectors: vectorsOf() }))));
  }
  function r7() {
    const angles = pipe.groups.map(g => g.angle + (state.angle || 0));
    const g = pipe.groups[inspectDir];
    // Plate 1: one direction only, so the two sideband lobes stay readable.
    const cv1 = plate();
    if (g) {
      const z0 = g.bands[0].shifted, zp = g.bands[1].shifted, zm = g.bands[2].shifted;
      const m0 = specMax(z0) || 1, mp = specMax(zp) || 1, mm = specMax(zm) || 1;
      blit(cv1, (x, y) => {
        const i = mod(y + N / 2, N) * N + mod(x + N / 2, N);
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
      const i = mod(y + N / 2, N) * N + mod(x + N / 2, N);
      const rgb = [0, 0, 0];
      if (pipe.groups[0] && pipe.groups[0].bands[0].h[i] > .06) { rgb[0] = 62; rgb[1] = 62; rgb[2] = 62; }
      pipe.groups.forEach((gg, d) => {
        if (gg.bands[1].h[i] > .06 || gg.bands[2].h[i] > .06) rgb[d] = 205;
      });
      return rgb;
    });
    overlay(cv2, { rings: RINGS, vectors: vectorsOf() });
    // Plate 3: fusion weight sum with the true fused-support boundary.
    const den = pipe.denominator;
    let dmax = 0; for (let i = 0; i < N * N; i++) dmax = Math.max(dmax, den[i]);
    const cv3 = blit(plate(), (x, y) => {
      const i = mod(y + N / 2, N) * N + mod(x + N / 2, N);
      return gray(Math.log(1 + den[i] / (dmax || 1) * 100) / Math.log(101));
    });
    overlay(cv3, { rings: RINGS, vectors: vectorsOf(), boundary: t => supportRadius(t, angles) });
    strip('s7', '', [
      figure(`方向 ${inspectDir + 1}：零级(紫灰) +1 级(<span style="color:#f87171">红</span>) −1 级(<span style="color:#4ade80">绿</span>)`, cv1),
      figure('三方向理论支撑域（重叠处混色）', cv2),
      figure('Σ w|T|² · <span class="bad">红</span>=融合支撑边界', cv3),
    ]);
  }
  function r8() {
    const num = pipe.numerator, den = pipe.denominator;
    let nmax = 0; for (let i = 0; i < N * N; i++) nmax = Math.max(nmax, mag(num, i));
    let dmax = 0; for (let i = 0; i < N * N; i++) dmax = Math.max(dmax, den[i]);
    strip('s8', '', [
      figure('|分子| log', logspec(num, { max: nmax, rings: RINGS })),
      figure('分母 Σ w|T|²+ε²', blit(plate(), (x, y) => {
        const i = mod(y + N / 2, N) * N + mod(x + N / 2, N);
        return gray(Math.log(1 + den[i] / (dmax || 1) * 100) / Math.log(101));
      })),
      figure('沿 0° 的等效传递剖面', transferCurve()),
    ]);
  }
  function transferCurve() {
    const w = 560, h = 250, cv = plate(w, h), ctx = cv.getContext('2d');
    ctx.fillStyle = '#0d1424'; ctx.fillRect(0, 0, w, h);
    const L = 44, R = 12, T = 14, B = 30, maxF = KC + KI;
    const X = f => L + (w - L - R) * f / maxF, Y = v => h - B - (h - T - B) * v;
    ctx.strokeStyle = '#243149'; ctx.lineWidth = 1;
    for (let v = 0; v <= 1.001; v += .25) { ctx.beginPath(); ctx.moveTo(L, Y(v)); ctx.lineTo(w - R, Y(v)); ctx.stroke(); }
    // widefield OTF along 0deg
    ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2; ctx.beginPath();
    for (let f = 0; f <= maxF; f += .25) { const v = C.otf(f, 0, KC, 'circular'); f === 0 ? ctx.moveTo(X(f), Y(v)) : ctx.lineTo(X(f), Y(v)); }
    ctx.stroke();
    // equivalent transfer = denominator profile, normalised
    const den = pipe.denominator; let dmax = 0;
    for (let f = 0; f <= maxF; f += .25) dmax = Math.max(dmax, den[Math.round(f) * 1]);
    for (let f = 0; f <= maxF; f += .25) {
      const i = Math.round(f); dmax = Math.max(dmax, den[i]);
    }
    ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 2; ctx.beginPath();
    for (let f = 0; f <= maxF; f += .25) {
      const v = den[Math.round(f)] / (dmax || 1);
      f === 0 ? ctx.moveTo(X(f), Y(v)) : ctx.lineTo(X(f), Y(v));
    }
    ctx.stroke();
    ctx.fillStyle = '#94a3b8'; ctx.font = '11px sans-serif';
    ctx.fillText('0', L - 12, Y(0) + 4); ctx.fillText('1', L - 12, Y(1) + 4);
    ctx.fillText('频率 / DFT 格（沿 0°）', w / 2 - 60, h - 8);
    ctx.fillText('k_c', X(KC) - 6, h - B + 14); ctx.fillText('k_c+|k_i|', X(maxF) - 34, h - B + 14);
    ctx.strokeStyle = '#64748b'; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(X(KC), T); ctx.lineTo(X(KC), h - B); ctx.moveTo(X(maxF), T); ctx.lineTo(X(maxF), h - B); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#38bdf8'; ctx.fillText('宽场 OTF', L + 8, T + 12);
    ctx.fillStyle = '#4ade80'; ctx.fillText('SIM 等效传递', L + 74, T + 12);
    return cv;
  }
  function r9() {
    const s = cap.truth.sample, px = pipe.pixels;
    const items = [
      figure('<b>样品真值</b>', blit(plate(), (x, y) => gray(s[y * N + x]))),
      figure('无噪声宽场', blit(plate(), (x, y) => gray(cap.truth.widefield[y * N + x]))),
    ];
    if (px) {
      const rm = C.rmse(px, s), wf = C.rmse(cap.truth.widefield, s);
      items.push(figure(`<b>SIM 重建</b> · <span class="${rm < wf ? 'good' : 'bad'}">RMSE ${rm.toFixed(4)}</span>`, blit(plate(), (x, y) => gray(px[y * N + x]))));
      items.push(figure('误差（重建−真值）±0.2', errImg(px, s)));
    }
    strip('s9', '', items);
    strip('s9c', '', [figure('径向对比度剖面：真值 / 宽场 / SIM', profileCurve())]);
    const wf = A.radialProfile(cap.truth.widefield), sm = px ? A.radialProfile(px) : [];
    const simOnly = wf.map((r, i) => [r, sm[i]]).filter(([r, q]) => A.zoneOf(r.localPeriod) === 'sim-only' && q);
    const gain = simOnly.length ? simOnly.reduce((a, [r, q]) => a + q.contrast / Math.max(1e-6, r.contrast), 0) / simOnly.length : NaN;
    $('c9').innerHTML = px
      ? `在「仅 SIM」环带上，宽场对比度平均 ${(simOnly.reduce((a, [r]) => a + r.contrast, 0) / Math.max(1, simOnly.length)).toFixed(3)}，` +
      `SIM 恢复到 ${(simOnly.reduce((a, [, q]) => a + q.contrast, 0) / Math.max(1, simOnly.length)).toFixed(3)}。` +
      `宽场曲线是 OTF 的渐变衰减形状，SIM 曲线是平台——<b>平台的高度由拼接与加权融合决定，平台的宽度就是分辨率增益</b>。`
      : '当前配置没有可用重建。';
  }
  function profileCurve() {
    const w = 760, h = 260, cv = plate(w, h), ctx = cv.getContext('2d');
    ctx.fillStyle = '#0d1424'; ctx.fillRect(0, 0, w, h);
    const L = 40, R = 14, T = 14, B = 30;
    const tv = A.radialProfile(cap.truth.sample), wf = A.radialProfile(cap.truth.widefield);
    const sm = pipe.pixels ? A.radialProfile(pipe.pixels) : null;
    const rmax = tv[tv.length - 1].r;
    const X = r => L + (w - L - R) * r / rmax, Y = v => h - B - (h - T - B) * Math.min(1, v);
    // zone bands
    const zones = [['beyond', 'rgba(248,113,113,.10)'], ['sim-only', 'rgba(74,222,128,.10)'], ['widefield', 'rgba(56,189,248,.08)']];
    for (const [z, col] of zones) {
      const rs = tv.filter(r => A.zoneOf(r.localPeriod) === z);
      if (!rs.length) continue;
      ctx.fillStyle = col; ctx.fillRect(X(rs[0].r - 2), T, X(rs[rs.length - 1].r + 2) - X(rs[0].r - 2), h - T - B);
    }
    ctx.strokeStyle = '#243149';
    for (let v = 0; v <= 1.001; v += .25) { ctx.beginPath(); ctx.moveTo(L, Y(v)); ctx.lineTo(w - R, Y(v)); ctx.stroke(); }
    const line = (prof, col, dash) => {
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash(dash || []); ctx.beginPath();
      prof.forEach((p, i) => i === 0 ? ctx.moveTo(X(p.r), Y(p.contrast)) : ctx.lineTo(X(p.r), Y(p.contrast)));
      ctx.stroke(); ctx.setLineDash([]);
    };
    line(tv, '#e2e8f0', [4, 3]); line(wf, '#38bdf8'); if (sm) line(sm, '#4ade80');
    ctx.fillStyle = '#94a3b8'; ctx.font = '11px sans-serif';
    ctx.fillText('对比度', 6, T + 10); ctx.fillText('半径 r / px', w / 2 - 30, h - 8);
    ctx.fillStyle = '#e2e8f0'; ctx.fillText('真值', L + 6, T + 12);
    ctx.fillStyle = '#38bdf8'; ctx.fillText('宽场', L + 44, T + 12);
    ctx.fillStyle = '#4ade80'; ctx.fillText('SIM', L + 82, T + 12);
    return cv;
  }

  function status() {
    const ok = pipe.ok && pipe.pixels;
    const rel = pipe.estimates.filter(e => e.ok).length;
    const clipped = ok ? Array.from(pipe.pixels).filter(x => x < 0 || x > 1).length / (N * N) : 0;
    $('status').innerHTML = ok
      ? `重建 <b>${pipe.reason}</b> · RMSE 宽场 ${C.rmse(cap.truth.widefield, cap.truth.sample).toFixed(4)} / SIM ${C.rmse(pipe.pixels, cap.truth.sample).toFixed(4)}` +
      ` · 频带 ${pipe.bands.filter(b => b.active).length}/${pipe.bands.length} 参与融合` +
      (state.msrc === 'estimated' ? ` · 可靠 m 估计 ${rel}/${pipe.estimates.length}` : '') +
      ` · 显示截断 ${(100 * clipped).toFixed(1)}%`
      : `无法重建：<b>${pipe.reason}</b>`;
  }
  function renderAll() { r1(); r2(); r3(); r4(); r5(); r6(); r7(); r8(); r9(); status(); }

  /* ---------- controls ---------- */
  const bind = (id, key, out, fmtOut) => {
    const el = $(id);
    const apply = () => {
      state[key] = el.type === 'range' ? Number(el.value) : (el.type === 'select-one' ? (isNaN(Number(el.value)) ? el.value : Number(el.value)) : el.value);
      if (out) $(out).textContent = fmtOut ? fmtOut(el.value) : el.value;
    };
    el.addEventListener('change', () => { apply(); recompute(); });
    el.addEventListener('input', () => { apply(); if (el.type === 'range') schedule(); });
    apply();
  };
  let pending = 0;
  const schedule = () => { cancelAnimationFrame(pending); pending = requestAnimationFrame(() => { pending = 0; recompute(); }); };
  bind('c-sample', 'sample'); bind('c-dir', 'directions'); bind('c-m', 'm', 'o-m');
  bind('c-noise', 'noise'); bind('c-msrc', 'msrc'); bind('c-eps', 'eps', 'o-eps');
  bind('c-scope', 'scope'); bind('c-phase', 'phase', 'o-phase', v => v + '°');
  bind('c-angle', 'angle', 'o-angle', v => v + '°'); bind('c-merr', 'merr', 'o-merr', v => v + '%');
  bind('c-otf', 'otf', 'o-otf', v => v + '%');

  if (window.katex) for (const el of document.querySelectorAll('[data-tex]'))
    katex.render(el.dataset.tex, el, { displayMode: el.classList.contains('formula'), throwOnError: false });
  recompute();
  window.SIMAtlasPage = { get state() { return state; }, get pipe() { return pipe; }, get capture() { return cap; }, recompute, probe: b => { probeBin = b; r4(); } };
})();
