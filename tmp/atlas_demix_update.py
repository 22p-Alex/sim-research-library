from pathlib import Path
p=Path('sim-atlas.js');s=p.read_text()
s=s.replace("let viewHalf = 24, captureKey = '';", "let viewHalf = 24, captureKey = '', inspectOrder = 2;")
start=s.index('  function renderProbe()');end=s.index('  function r7()',start)
s=s[:start]+r'''  function mathMarkup(tex) {
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
  function renderProbe() {
    const el = $('probe'), context = probeContext();
    if (!context) { el.innerHTML = '<h3>当前配置无法解混</h3>'; return; }
    const { g, pr, exponent, scale } = context;
    el.innerHTML = `<div class="reason-title"><span class="reason-step">1</span><h3>同一个检测点，读出三次观测</h3></div>
      <p class="probe-meta">检测频率 f = (${A.bin(probeBin.x)}, ${A.bin(probeBin.y)}) 格 · 检测 bin (${probeBin.x}, ${probeBin.y})</p>
      <div class="observations">${pr.observed.map((z, j) => `<div class="observation"><span>D<sub>${j}</sub> · 采集相位 ${Math.round(g.frames[j].phase * 180 / Math.PI)}°</span><b>${arithmeticValue(z, scale)}</b>${state.phase ? `<small>计算采用相位 ${Math.round(g.phases[j] * 180 / Math.PI)}°</small>` : ''}</div>`).join('')}</div>
      <p class="number-scale">数值单位：10<sup>${exponent}</sup>（FFT 已除 N²）。下方观测、乘积和结果沿用此单位，解混系数无量纲。</p>
      ${mathMarkup(String.raw`D_j=A_0+e^{i\phi_j}A_{+1}+e^{-i\phi_j}A_{-1}`)}
      <p class="hint">每一帧都含 0 级、+1 级和 −1 级；三帧改变的是它们的相位权重。这里的 D 是图像 FFT 后的<b>复数</b>，不是相机上某个像素的亮度。</p>
      ${pr.orders[0].h === 0 ? '<p class="probe-warning">此点在采用的 OTF 通带外，通常没有可恢复的信号；非零值可能来自噪声或参数失配。可点击“回到示例点”继续看演算。</p>' : ''}`;
    renderMath(el);
  }
  function renderDemixCalculation() {
    const context = probeContext(), el = $('demix-calculation'), why = $('demix-cancellation');
    if (!context) { el.textContent = '当前配置无法解混。'; why.replaceChildren(); return; }
    const { g, pr, exponent, scale } = context, o = pr.orders[inspectOrder];
    const label = orderName(inspectOrder), ell = orderTex(inspectOrder);
    document.querySelectorAll('[data-order]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.order) === inspectOrder)));
    el.innerHTML = `<p class="calculation-intro">现在求 <b>${label} 级</b>。先给三次观测各乘一个系数，再把三个复数乘积相加。系数来自本次采用的相位矩阵。</p>
      ${mathMarkup(String.raw`\widehat A_{${ell}}=\sum_{j=0}^{2}w_{${ell},j}D_j,\qquad w_{\ell,j}=\frac13e^{-i\ell\phi_j}`)}
      <div class="term-grid">${o.products.map((product, j) => `<div class="term-card" data-term="${j}"><div class="term-label">第 ${j + 1} 项 <span>观测 D<sub>${j}</sub></span></div><div class="term-operand"><span>观测值</span><b>${arithmeticValue(pr.observed[j], scale)}</b></div><div class="term-operand"><span>× 系数</span><b>${arithmeticValue(pr.weights[inspectOrder][j])}</b></div><div class="term-product"><span>= 乘积</span><b>${arithmeticValue(product, scale)}</b></div></div>`).join('')}</div>
      <div class="sum-result"><div><span class="sum-symbol">Σ</span><span>把上面三个乘积相加</span></div><strong>${label} 级 = ${arithmeticValue(o.value, scale)}</strong><small>对应归一化复值 (${arithmeticValue(o.value, scale)}) × 10<sup>${exponent}</sup>。显示保留 4 位小数，计算使用完整精度。</small></div>`;
    why.innerHTML = `<div class="reason-title"><span class="reason-step">3</span><h3>为什么留下的是 ${label} 级？</h3></div>
      <p>相位加权把目标分量在三帧中的转动“转回来”，让它同向相加；另外两个分量的系数相加为零。这是对<b>本次采用的相位模型</b>的计算：</p>
      <div class="response-grid">${o.responses.map((z, i) => `<div class="response-item${i === inspectOrder ? ' retained' : ''}"><span>${orderName(i)} 级的总系数</span><b>${arithmeticValue(z)}</b><small>${i === inspectOrder ? '保留目标分量' : '另外一级相互抵消'}</small></div>`).join('')}</div>
      <p class="figure-note">有噪声时，噪声也参与加权；如果采用相位有偏差，算出的分量会带偏差。“能够解出三个数”不等于参数正确。</p>
      <details class="closure-check"><summary>代回三次观测，检查这次计算是否闭合</summary><div class="table-scroll"><table><thead><tr><th>观测</th><th>输入值</th><th>把三个答案重新混合</th></tr></thead><tbody>${pr.observed.map((z, j) => `<tr><td>D${j}</td><td>${arithmeticValue(z, scale)}</td><td>${arithmeticValue(pr.remixed[j], scale)}</td></tr>`).join('')}</tbody></table></div><p>最大复值差 ${pr.closureError.toExponential(1)}（除 N² 后）。三方程三未知数可对含噪数据同样闭合，因此这个检查只验证线性代数计算，不能证明样品恢复准确。</p></details>`;
    el.dataset.order = label;
    el.dataset.resultRe = o.value.re; el.dataset.resultIm = o.value.im;
    why.dataset.closureError = pr.closureError;
    renderMath(el);
  }
  function r5() {
    const context = probeContext();
    if (!context) { strip('s5a', '', []); strip('s5b', '', []); $('order-results').replaceChildren(); $('c5').textContent = '当前配置无法解混。'; return; }
    const { g, pr, scale, exponent } = context;
    $('order-results').innerHTML = pr.orders.map((o, i) => {
      const q = o.specimenFrequency, outside = Math.hypot(...q) > KC;
      return `<article class="order-result${i === inspectOrder ? ' selected' : ''}"><div class="order-result-title"><b>${orderName(i)} 级</b><span>${i === inspectOrder ? '刚才演算的答案' : '换一组系数可求出'}</span></div><strong>${arithmeticValue(o.value, scale)}</strong><small>× 10<sup>${exponent}</sup> · 归一化复值</small><p>原样品频率<br><b>q = (${q.map(fmt).join(', ')}) 格</b></p><span class="frequency-tag${outside ? ' extended' : ''}">${outside ? '在标称宽场截止之外' : '在标称宽场范围内'}</span><p class="order-meaning">${i === 0 ? '没有照明频移，保留检测 OTF 的衰减。' : '由照明编码进来；仍含 m/2 与 OTF 的衰减。'}</p></article>`;
    }).join('');
    const names = ['0 级', '+1 级', '−1 级'];
    strip('s5a', '幅度 · 红圈是同一个检测频率 f', g.separated.map((z, b) => figure(`${names[b]} · 红圈数值见上方答案`, logspec(z, { rings: [RINGS[0]], marker: probeBin }))));
    strip('s5b', '相位 · 红圈仍对应同一个 f', g.separated.map((z, b) => figure(`${names[b]} · 色相表示复相位`, phaseImg(z, { marker: probeBin }))));
    $('c5').innerHTML = '<b>读到这里要区分：</b>解混是把三个来源分开；它没有消除 OTF 衰减，也没有把频率搬回原位。上面的样品频率来源关系以参数匹配为前提，完整频谱只是把这套计算对所有检测点重复一遍。';
  }
  function r6() {
    const context = probeContext();
    if (!context) { strip('s6a', '', []); strip('s6b', '', []); $('shift-example').replaceChildren(); return; }
    const { g, pr } = context, o = pr.orders[inspectOrder], b = g.bands[inspectOrder];
    const f = [A.bin(probeBin.x), A.bin(probeBin.y)], q = o.specimenFrequency;
    $('shift-example').innerHTML = `<div class="reason-title"><span class="reason-step">→</span><h3>继续追踪刚才的 ${orderName(inspectOrder)} 级</h3></div><div class="frequency-journey"><div><small>解混后还放在检测点</small><b>f = (${f.join(', ')})</b></div><span>减去 ℓk<sub>d</sub><br>→</span><div><small>搬回它的样品频率</small><b>q = (${q.map(fmt).join(', ')})</b></div></div><p>本方向采用 k<sub>d</sub> = (${fmt(g.kx)}, ${fmt(g.ky)}) 格；因此本次平移 Δq = (${fmt(-b.kx)}, ${fmt(-b.ky)}) 格。${Math.hypot(...q) > KC ? '<b>这个 q 已在标称宽场截止之外</b>，但它的观测来自原来的检测位置 f。' : '这个分量的样品频率仍在标称宽场范围内。'}数据与 OTF 同时归位。</p>`;
    const names = ['0 级', '+1 级', '−1 级'];
    strip('s6a', '搬移前 · 红圈 f', g.separated.map((z, b) => figure(names[b], logspec(z, { rings: [RINGS[0]], marker: probeBin }))));
    strip('s6b', '搬移后 · 红圈 q', g.bands.map((bd, b) => figure(`${names[b]} · Δq = (${fmt(-bd.kx)}, ${fmt(-bd.ky)}) 格`, logspec(bd.shifted, { rings: RINGS, vectors: vectorsOf(), marker: { x: mod(f[0] - bd.kx, N), y: mod(f[1] - bd.ky, N) } }))));
  }
''' + s[end:]
s=s.replace('    renderProbe();\n    if (focus)', '    renderProbe(); renderDemixCalculation(); r5(); r6();\n    if (focus)')
s=s.replace('r1(); r2(); r3(); r4(); r5(); r6(); r7(); r8(); r9(); status();','r1(); r2(); r3(); r4(); r7(); r8(); r9(); status();')
s=s.replace('inspectDir = Number(e.target.value); r4(); r5(); r6(); r7();','inspectDir = Number(e.target.value); r4(); r7();')
s=s.replace('inspectDir = 0; probeBin = { x: 6, y: 0 };','inspectDir = 0; inspectOrder = 2; probeBin = { x: 6, y: 0 };')
s=s.replace("  $('probe-reset').addEventListener", "  document.querySelectorAll('[data-order]').forEach(b => b.addEventListener('click', () => {\n    inspectOrder = Number(b.dataset.order); renderDemixCalculation(); r5(); r6();\n  }));\n  $('probe-reset').addEventListener")
p.write_text(s)
