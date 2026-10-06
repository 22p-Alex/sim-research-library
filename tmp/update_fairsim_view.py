from pathlib import Path
p=Path('sim-atlas.js');s=p.read_text()
s=s.replace('for (let i = 0; i < N * N; i++) m = Math.max(m, mag(z, i))', 'for (let i = 0; i < z.re.length; i++) m = Math.max(m, mag(z, i))')
s=s.replace('const i = spectrumIndex(x, y);\n      return gray(Math.log(1 + mag(z, i)) / mx);', 'const i = spectrumIndex(x, y, Math.sqrt(z.re.length));\n      return gray(Math.log(1 + mag(z, i)) / mx);')
s=s.replace('const i = spectrumIndex(x, y);\n      const a = mag(z, i) / mx;', 'const i = spectrumIndex(x, y, Math.sqrt(z.re.length));\n      const a = mag(z, i) / mx;')
s=s.replace('function spectrumIndex(x, y) {\n    return A.idx(Math.floor((x / N * 2 - 1) * viewHalf), Math.floor((y / N * 2 - 1) * viewHalf));', 'function spectrumIndex(x, y, n = N) {\n    return A.idx(Math.floor((x / N * 2 - 1) * viewHalf), Math.floor((y / N * 2 - 1) * viewHalf), n);')
s=s.replace("eps: 0, phase:", "eps: .05, apo: 1.9, bend: .8, phase:")
s=s.replace("let viewHalf = 24, captureKey = '', inspectOrder = 2;", "let viewHalf = 24, captureKey = '', inspectOrder = 2, fusionQ = 12, profileY = 80;")
s=s.replace('eps: state.eps, phaseError:', 'eps: state.eps, apoCutoff: state.apo, apoBend: state.bend, phaseError:')
s=s.replace("const result = String.raw`\\widehat A_{${ell}}`;", "const result = String.raw`\\widehat A_{${ell}}`, am = i => i === 0 ? '' : String.raw`\\frac m2`;")
s=s.replace("i === 0 ? ah(i) : String.raw`e^", "i === 0 ? ah(i) : String.raw`${am(i)}e^")
s=s.replace("String.raw`u_{${ell},j}${i === 0 ? ''", "String.raw`u_{${ell},j}${am(i)}${i === 0 ? ''")
s=s.replace('\\frac13e^{-i(${ell})\\phi_j}', '\\frac{1}{3a_{${ell}}}e^{-i(${ell})\\phi_j}')
s=s.replace('；1/3 用来取平均。', '；再除以该级次的 aℓ，补偿调制度。')
s=s.replace('u_{${ell},j}e^{ih\\phi_j}', 'u_{${ell},j}a_he^{ih\\phi_j}')
s=s.replace('{ re: Math.cos(o.order * ph), im: Math.sin(o.order * ph) }', '{ re: o.coefficient * Math.cos(o.order * ph), im: o.coefficient * Math.sin(o.order * ph) }')
s=s.replace("const original = i === 0 ? '1' : String.raw`e^", "const original = i === 0 ? '1' : String.raw`\\frac m2e^")
s=s.replace('D_j=A_0+e^{i\\phi_j}A_{+1}+e^{-i\\phi_j}A_{-1}', 'D_j=A_0+\\frac m2e^{i\\phi_j}A_{+1}+\\frac m2e^{-i\\phi_j}A_{-1}')
s=s.replace('u_{\\ell,j}=\\frac13e^{-i\\ell\\phi_j}', 'u_{\\ell,j}=\\frac{1}{3a_\\ell}e^{-i\\ell\\phi_j}')
s=s.replace('这份信息由照明编码进来；仍有 m/2 与 OTF 衰减。', '这份信息由照明编码进来；m/2 已补偿，仍有 OTF 衰减。')
a=s.index('  function r7()');b=s.index('  function r8()',a)
part=s[a:b].replace('spectrumIndex(x, y)', 'spectrumIndex(x, y, pipe.spectrumSize)').replace('i < N * N', 'i < den.length').replace('Σ w|T|²', 'fairSIM 分母 D · OTF 平方和')
s=s[:a]+part+s[b:]
a=s.index('  function r8()');b=s.index('  function status()',a)
s=s[:a]+'''  function scalarSpectrum(values, maximum) {
    const max = maximum || Math.max(...values) || 1;
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

''' + s[b:]
s=s.replace("const active = pipe.bands.filter(b => b.active).length;", "const active = pipe.bands.filter(b => b.active).length, fallback = pipe.groups.filter(g => g.fallback).length;")
s=s.replace("'SIM 重建' : '仅零级'", "'fairSIM 路径' : '仅零级'")
s=s.replace("'采用已知调制度' : '可靠 m 估计 ' + pipe.estimates.filter(e => e.ok).length + '/' + pipe.estimates.length", "'采用校准调制度' : '外部 m 估计（教学）'")
s=s.replace('<span class="metric-label">显示截断像素</span>', '<span class="metric-label">调制度回退</span>')
s=s.replace("${(100 * clipped).toFixed(1)}<small> %</small></b><small>RMSE 使用未截断值", "${fallback}<small> / ${pipe.groups.length} 方向</small></b><small>${fallback ? '超出 [0.4, 1.1]，采用 0.65' : 'm 均在 fairSIM 采用范围内'}")
s=s.replace("bind('c-noise', 'noise'); bind('c-msrc', 'msrc'); bind('c-eps', 'eps', 'o-eps');", "bind('c-noise', 'noise'); bind('c-msrc', 'msrc'); bind('c-eps', 'eps', 'o-eps');\n  bind('c-apo', 'apo', 'o-apo'); bind('c-bend', 'bend', 'o-bend');")
s=s.replace("  // Keep the current stage visible", "  $('c-fusion-q').addEventListener('input', e => { fusionQ = Number(e.target.value); $('o-fusion-q').textContent = fusionQ; r8(); });\n  $('c-profile-y').addEventListener('input', e => { profileY = Number(e.target.value); $('o-profile-y').textContent = profileY; r9(); });\n\n  // Keep the current stage visible")
p.write_text(s)
