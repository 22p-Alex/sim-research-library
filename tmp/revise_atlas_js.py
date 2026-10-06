from pathlib import Path
p=Path('sim-atlas.js');s=p.read_text()
def replace_fn(name,body):
    global s
    start=s.index('  function '+name+'(')
    end=s.index('\n  function ',start+5) if '\n  function ' in s[start+5:] else None
    # Use brace matching with strings? Bound by next top-level named function or known marker.
    s=s[:start]+body.rstrip()+'\n'+s[end:]
s=s.replace('const mx = Math.log(1 + (opt.max || specMax(z)));','const mx = Math.log(1 + (opt.max || specMax(z))) || 1;')
s=s.replace('const i = mod(y + N / 2, N) * N + mod(x + N / 2, N);','const i = spectrumIndex(x, y);')
s=s.replace('const ctx = cv.getContext(\'2d\'), c = PX / 2, u = PX / N;',"const ctx = cv.getContext('2d'), c = PX / 2, u = PX / (2 * viewHalf);\n    ctx.strokeStyle = '#1c293c'; ctx.lineWidth = 1;\n    ctx.beginPath(); ctx.moveTo(0, c); ctx.lineTo(PX, c); ctx.moveTo(c, 0); ctx.lineTo(c, PX); ctx.stroke();\n    ctx.fillStyle = '#8fa2bb'; ctx.font = '9px sans-serif';\n    ctx.fillText('−' + viewHalf, 5, c - 5); ctx.fillText('+' + viewHalf + ' x', PX - 34, c - 5);\n    ctx.fillText('y', c + 5, PX - 8);")
s=s.replace('const x = (opt.marker.x + N / 2) % N * u + u / 2, y = (opt.marker.y + N / 2) % N * u + u / 2;','const x = c + A.bin(opt.marker.x) * u + u / 2, y = c + A.bin(opt.marker.y) * u + u / 2;')
s=s.replace('y = c - r * Math.sin(a)','y = c + r * Math.sin(a)')
s=s.replace("const f = document.createElement('figure'); f.className = 'plate'; f.append(cv);", "const f = document.createElement('figure'); f.className = 'plate'; f.append(cv);\n    cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', caption.replace(/<[^>]*>/g, ''));\n    if (cv.width !== cv.height) cv.classList.add('curve');")
start=s.index('  // Fused-support radius');end=s.index('  /* ---------- state',start)
s=s[:start]+'''  // Draw only the requested frequency window; all reconstruction arrays stay intact.
  function spectrumIndex(x, y) {
    return A.idx(Math.floor((x / N * 2 - 1) * viewHalf), Math.floor((y / N * 2 - 1) * viewHalf));
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

''' + s[end:]
s=s.replace("  const state = {", "  const defaults = {")
s=s.replace("scope: 'both' };\n  let cap", "scope: 'both' };\n  const state = { ...defaults };\n  let viewHalf = 24, captureKey = '';\n  let cap")
s=s.replace('probeBin = { x: 70, y: 64 }','probeBin = { x: 6, y: 0 }')
s=s.replace("    cap = A.capture({ sample: state.sample, directions: state.directions, m: state.m, noise: state.noise });", "    const key = JSON.stringify([state.sample, state.directions, state.m, state.noise]);\n    if (!cap || key !== captureKey) {\n      cap = A.capture({ sample: state.sample, directions: state.directions, m: state.m, noise: state.noise });\n      captureKey = key;\n    }")
s=s.replace('    renderAll();\n  }','    syncViewControls();\n    renderAll();\n  }',1)
replace_fn('r1','''  function r1() {
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
  }''')
s=s.replace('/ 1.8','/ 2')
replace_fn('r3','''  function r3() {
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
  }''')
replace_fn('r4','''  function r4(focus = false) {
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
    renderProbe();
    if (focus) cv.focus({ preventScroll: true });
  }''')
replace_fn('renderProbe','''  function renderProbe() {
    const el = $('probe'), g = pipe.groups[inspectDir];
    if (!g || !g.separated) { el.innerHTML = '<h3>探测点</h3><p class="hint">当前配置无法解混，没有可展示的中间量。</p>'; return; }
    const pr = A.probe(pipe, inspectDir, probeBin.x, probeBin.y);
    const rows = pr.orders.map(o => `<tr><td>${o.order === 0 ? '0 级' : o.order > 0 ? '+1 级' : '−1 级'}</td><td>${cplx(o.value)}</td><td>(${o.specimenFrequency.map(fmt).join(', ')})</td><td>${o.h.toFixed(3)}</td></tr>`).join('');
    el.innerHTML = `<h3>检测频率 f = (${A.bin(probeBin.x)}, ${A.bin(probeBin.y)}) 格</h3>
      <p class="probe-meta">检测 bin (${probeBin.x}, ${probeBin.y}) · (${fmt(pr.freq.fx)}, ${fmt(pr.freq.fy)}) cycles/pixel</p>
      <div class="table-scroll"><table><tr><th>三次观测</th><th>D₀</th><th>D₁</th><th>D₂</th></tr><tr><td>复值 / N²</td>${pr.observed.map(o => `<td>${cplx(o)}</td>`).join('')}</tr></table></div>
      <div class="table-scroll"><table><tr><th>级次</th><th>解混值 A / N²</th><th>搬回样品频率 q / 格</th><th>H(f)</th></tr>${rows}</table></div>
      <p class="hint">q = f − ℓk<sub>d</sub>。三项共用检测位置的 H(f)；归位后，T<sub>ℓ</sub>(q) = a<sub>ℓ</sub>H(f)。${pr.orders[0].h === 0 ? '<b>此点位于采用的 OTF 通带外；非零观测可能来自噪声或 OTF 失配。</b>' : '此点在采用的检测通带内。'} 采用 m = ${pr.m.toFixed(3)}。</p>
      <details><summary>查看本方向的解混系数</summary><div class="table-scroll"><table><tr><th>A = M⁻¹D</th><th>D₀ 系数</th><th>D₁ 系数</th><th>D₂ 系数</th></tr>${pr.weights.map((row, i) => `<tr><td>${['0', '+1', '−1'][i]} 级</td>${row.map(w => `<td>${cplx(w)}</td>`).join('')}</tr>`).join('')}</table></div></details>`;
  }''')
s=s.replace('`零级相位图只有 0 / π 两色，因为它是实函数；±1 级是复函数，相位连续变化——那份相位就是结构的位置信息，也是 Δφ 失配旋转的对象。`','`这里的条件数针对实现采用的实基 [1, cosφ, sinφ]，不是上方复指数矩阵的条件数。三个级次的频谱一般都有复相位；零级对应的空域图为实值，只要求其频谱共轭对称。相位图隐藏低幅度位置，避免把数值噪声当结构。`')
s=s.replace('（等间隔三相位时最小）','（实基矩阵）')
s=s.replace('`${names[b]} · 搬 ${(bd.kx).toFixed(0)},${(bd.ky).toFixed(0)}`','`${names[b]} · Δq = (${fmt(-bd.kx)}, ${fmt(-bd.ky)}) 格`')
s=s.replace('    const angles = pipe.groups.map(g => g.angle + (state.angle || 0));\n','')
s=s.replace('if (g) {\n      const z0','if (g?.bands.length) {\n      const z0')
s=s.replace('pipe.groups[0].bands[0].h[i] > .06','pipe.groups[0].bands[0]?.h[i] > 0')
s=s.replace('gg.bands[1].h[i] > .06 || gg.bands[2].h[i] > .06','gg.bands[1]?.h[i] > 0 || gg.bands[2]?.h[i] > 0')
s=s.replace('boundary: t => supportRadius(t, angles)','boundary: supportRadius')
s=s.replace("figure('三方向理论支撑域（重叠处混色）', cv2)","figure(`${state.directions} 方向几何支撑 · 重叠处混色`, cv2)")
s=s.replace('const num = pipe.numerator, den = pipe.denominator;','const num = pipe.numerator, den = pipe.regularizedDenominator || pipe.denominator;')
s=s.replace("      figure('沿 0° 的等效传递剖面', transferCurve()),", "      figure('沿 0° 的理想匹配等效传递 G', transferCurve()),")
# Actual transfer replaces the erroneous normalized fusion denominator.
start=s.index('    // equivalent transfer =');end=s.index("    ctx.fillStyle = '#94a3b8'",start)
s=s[:start]+'''    const effective = pipe.effectiveTransfer || new Float64Array(N * N);
    ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 2; ctx.beginPath();
    for (let f = 0; f <= maxF; f += .25) {
      const v = effective[Math.round(f)];
      f === 0 ? ctx.moveTo(X(f), Y(v)) : ctx.lineTo(X(f), Y(v));
    }
    ctx.stroke();
''' + s[end:]
s=s.replace("ctx.fillText('SIM 等效传递', L + 74, T + 12);", "ctx.fillText('G = W / (W + ε²)', L + 96, T + 12);")
replace_fn('r9','''  function r9() {
    const s = cap.truth.sample, px = pipe.pixels;
    const items = [figure('<b>样品真值</b>', blit(plate(), (x, y) => gray(s[y * N + x]))), figure('无噪声宽场参考', blit(plate(), (x, y) => gray(cap.truth.widefield[y * N + x])))];
    if (px) {
      const rm = C.rmse(px, s), wf = C.rmse(cap.truth.widefield, s);
      items.push(figure(`<b>SIM 重建</b> · <span class="${rm < wf ? 'good' : 'bad'}">RMSE ${rm.toFixed(4)}</span>`, blit(plate(), (x, y) => gray(px[y * N + x]))));
      items.push(figure('有符号误差 · 重建 − 真值', errImg(px, s)));
    }
    strip('s9', '', items);
    const star = state.sample.startsWith('star');
    strip('s9c', '', star ? [figure('不同半径处的环向对比度 · σ / μ', profileCurve())] : state.sample === 'points' ? [figure('三组点对的水平强度剖面 · 真值 / 宽场 / SIM', pointCurve())] : []);
    if (!px) { $('c9').textContent = '当前配置没有可用重建。'; return; }
    if (!star) { $('c9').innerHTML = state.sample === 'points' ? '<b>读点对剖面：</b>比较峰位、峰间谷与真值是否一致。更窄的峰或额外的振铃并不自动代表分辨率提高。' : '<b>读细条纹：</b>比较三个方向的纹理与误差。此处不套用星形样品的径向分区；RMSE 是整幅图像的偏差，不单独衡量分辨率。'; return; }
    const wf = A.radialProfile(cap.truth.widefield), sm = A.radialProfile(px);
    const mid = wf.map((r, i) => [r, sm[i]]).filter(([r]) => A.zoneOf(r.localPeriod) === 'sim-only');
    const avg = k => mid.reduce((a, pair) => a + pair[k].contrast, 0) / Math.max(1, mid.length);
    $('c9').innerHTML = `在名义扩展环带，宽场平均对比度 <b>${avg(0).toFixed(3)}</b>，SIM 为 <b>${avg(1).toFixed(3)}</b>。这是当前样品的环向统计，不是 OTF 曲线。噪声也会抬高对比度，需同时核对真值与 RMSE。`;
  }''')
# Add a separate meaningful profile for the point specimen.
pos=s.index('  function profileCurve()')
s=s[:pos]+'''  function pointCurve() {
    const cv = plate(900, 250), ctx = cv.getContext('2d');
    ctx.fillStyle = '#0d1424'; ctx.fillRect(0, 0, cv.width, cv.height);
    [[64, 6, 5], [16, 98, 7], [112, 98, 9]].forEach(([cx, cy, gap], j) => {
      const L = 35 + j * 300, W = 250, T = 45, H = 165;
      const X = t => L + (t + 14) / 28 * W;
      ctx.strokeStyle = '#243149';
      for (const v of [0, .5, 1]) { ctx.beginPath(); ctx.moveTo(L, T + H * (1 - v)); ctx.lineTo(L + W, T + H * (1 - v)); ctx.stroke(); }
      [[cap.truth.sample, '#e2e8f0'], [cap.truth.widefield, '#38bdf8'], [pipe.pixels, '#4ade80']].forEach(([px, c]) => {
        if (!px) return; ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.beginPath();
        for (let t = -14; t <= 14; t++) { const y = T + H * (1 - px[A.idx(cx + t, cy)]); t === -14 ? ctx.moveTo(X(t), y) : ctx.lineTo(X(t), y); } ctx.stroke();
      });
      ctx.fillStyle = '#cbd5e1'; ctx.font = '12px sans-serif'; ctx.fillText(`间距 ${gap} px`, L, 22);
      ctx.fillStyle = '#94a3b8'; ctx.fillText('−14', L - 5, 232); ctx.fillText('0', X(0), 232); ctx.fillText('+14 px', L + W - 30, 232);
    });
    return cv;
  }
''' + s[pos:]
# Don't silently clamp contrast to 1 under noisy reconstructions.
s=s.replace('const X = r => L + (w - L - R) * r / rmax, Y = v => h - B - (h - T - B) * Math.min(1, v);','const ymax = Math.max(1, ...tv.map(p => p.contrast), ...wf.map(p => p.contrast), ...(sm || []).map(p => p.contrast));\n    const X = r => L + (w - L - R) * r / rmax, Y = v => h - B - (h - T - B) * v / ymax;')
s=s.replace("ctx.fillText('对比度', 6, T + 10);", "ctx.fillText('σ/μ', 6, T + 10);\n    ctx.fillText(ymax.toFixed(1), 8, T + 28);\n    for (const r of [10, 20, 30, 40, 50]) ctx.fillText(String(r), X(r) - 5, h - B + 14);")
start=s.index('  function status()');end=s.index('  /* ---------- controls',start)
s=s[:start]+'''  function status() {
    const ok = pipe.ok && pipe.pixels;
    if (!ok) { $('status').innerHTML = `<div class="metric"><span class="metric-label">无法重建</span><b>${pipe.reason}</b></div>`; return; }
    const clipped = Array.from(pipe.pixels).filter(x => x < 0 || x > 1).length / (N * N);
    const wf = C.rmse(cap.truth.widefield, cap.truth.sample), rm = C.rmse(pipe.pixels, cap.truth.sample);
    const active = pipe.bands.filter(b => b.active).length;
    $('status').dataset.rmse = rm;
    $('status').innerHTML = `<div class="metric"><span class="metric-label">当前重建</span><b class="${pipe.reason === 'sim' ? 'positive' : 'caution'}">${pipe.reason === 'sim' ? 'SIM 重建' : '仅零级'}</b><small>${pipe.reason} · ${state.directions * 3} 帧观测</small></div>
      <div class="metric"><span class="metric-label">RMSE · 越低越接近真值</span><b class="${rm < wf ? 'positive' : 'caution'}">${rm.toFixed(4)}</b><small>宽场参考 ${wf.toFixed(4)}</small></div>
      <div class="metric"><span class="metric-label">参与融合的频带</span><b>${active}/${pipe.bands.length}</b><small>${state.msrc === 'known' ? '采用已知调制度' : '可靠 m 估计 ' + pipe.estimates.filter(e => e.ok).length + '/' + pipe.estimates.length}</small></div>
      <div class="metric"><span class="metric-label">显示截断像素</span><b>${(100 * clipped).toFixed(1)}<small> %</small></b><small>RMSE 使用未截断值</small></div>`;
  }
  function renderAll() { r1(); r2(); r3(); r4(); r5(); r6(); r7(); r8(); r9(); status(); }

''' + s[end:]
p.write_text(s)
