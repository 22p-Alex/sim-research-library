/* Chapter-1 2D lab: convolution in real space ⇄ pointwise OTF multiply in
 * frequency. Reuses the shared FFT (SIMCore.fft2); with a clear circular pupil
 * the FFT-derived OTF agrees with SIMCore.otf(...,'circular'). Only the
 * aberration-free pupil is shown here; defocus/coma effects on the OTF are
 * deferred to later chapters.
 */
(function () {
  'use strict';

  const C = window.SIMCore,
    $ = id => document.getElementById(id);
  const N = 128,
    HALF = N / 2,
    SIZE = N * N;
  const defaults = {
    kind: 'stripes',
    dc: 4
  };
  let state = {
    kind: defaults.kind,
    dc: defaults.dc
  };
  const f = (n, d = 2) => Number(n.toFixed(d)).toString();
  const wrapDelta = i => i <= HALF ? i : i - N;
  const buf = document.createElement('canvas');
  buf.width = N;
  buf.height = N;
  const bctx = buf.getContext('2d');
  let current = null;
  const maximum = arr => arr.reduce((max, value) => Math.max(max, value), 0);
  function selectButtons(attr, value) {
    document.querySelectorAll(`[${attr}]`).forEach(el => {
      const on = el.getAttribute(attr) === value;
      el.classList.toggle('active-blue', on);
      el.setAttribute('aria-pressed', String(on));
    });
  }
  function buildSample() {
    const a = new Float64Array(SIZE);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = wrapDelta(x),
        dy = wrapDelta(y);
      let v = 0;
      if (state.kind === 'dots') {
        // 双点间距 4.8 px：默认 d_c=4 px 时相机图糊成一个长光斑（无法分辨），
        // 把 d_c 拖到最小 3 px 才隐约出现浅谷，演示分辨极限
        const s = .8,
          d = 2.4;
        v = Math.exp(-((dx - d) * (dx - d) + dy * dy) / (2 * s * s)) + Math.exp(-((dx + d) * (dx + d) + dy * dy) / (2 * s * s));
      } else if (state.kind === 'stripes') v = .5 + .16 * Math.cos(C.TAU * dx / 32) + .16 * Math.cos(C.TAU * dx / 10) + .16 * Math.cos(C.TAU * dx / 4.5);else v = Math.hypot(dx, dy) <= 15 ? 1 : 0;
      a[y * N + x] = v;
    }
    return a;
  }

  /* Pupil → PSF → OTF, sample → spectrum, pointwise product → inverse FFT. */
  function compute() {
    const R = N / (2 * state.dc);
    const pr = new Float64Array(SIZE),
      pi = new Float64Array(SIZE);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = wrapDelta(x),
        dy = wrapDelta(y),
        r = Math.hypot(dx, dy),
        i = y * N + x;
      if (r > R) continue;
      pr[i] = 1;
    }
    C.fft2(pr, pi, N);
    const psf = new Float64Array(SIZE);
    let pmax = 0;
    for (let i = 0; i < SIZE; i++) {
      const v = pr[i] * pr[i] + pi[i] * pi[i];
      psf[i] = v;
      if (v > pmax) pmax = v;
    }
    if (pmax > 0) for (let i = 0; i < SIZE; i++) psf[i] /= pmax;
    const oR = new Float64Array(SIZE),
      oI = new Float64Array(SIZE);
    oR.set(psf);
    C.fft2(oR, oI, N);
    const o0 = oR[0] || 1;
    for (let i = 0; i < SIZE; i++) {
      oR[i] /= o0;
      oI[i] /= o0;
    }
    const obj = buildSample(),
      sR = new Float64Array(SIZE),
      sI = new Float64Array(SIZE);
    sR.set(obj);
    C.fft2(sR, sI, N);
    const tR = new Float64Array(SIZE),
      tI = new Float64Array(SIZE);
    for (let i = 0; i < SIZE; i++) {
      tR[i] = sR[i] * oR[i] - sI[i] * oI[i];
      tI[i] = sR[i] * oI[i] + sI[i] * oR[i];
    }
    const rR = tR.slice(),
      rI = tI.slice();
    C.fft2(rR, rI, N, true);
    current = {
      sample: obj, psf, result: rR, maximum: maximum(rR)
    };
    render(obj, psf, rR, sR, sI, oR, oI, tR, tI);
  }

  /* 晕染：把当前这一列的 PSF 贡献当作一滴墨，柔和地洇在已累加的像上。
     不用任何边框、光标或遮罩提示"扫到哪里了"——墨迹本身自然浮现就是进度。
     contribution 已由 conv-scan 精确算出（该列样品与 PSF 卷积的结果），
     这里只负责显示：按能量归一化后以径向衰减的暖色叠加，读起来像扩散而不是描边。 */
    /* PSF 画布上的点同步晕开：卷积就是"每个样品点被这个光斑糊开"。
     播放时让光斑从锐点逐渐扩散到最终大小，观众才能把右侧相机的累加
     与左侧"一个点摊成多大"对应起来，而不是只看一条推进的墨带。 */
    /* 2× nearest-neighbour upscale keeps the 128² data crisp on the 256² canvas. */
  function paint(id) {
    const cv = $(id),
      ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(buf, 0, 0, cv.width, cv.height);
  }
  function drawReal(id, arr, fixedMaximum) {
    const img = bctx.createImageData(N, N);
    let mn = Infinity,
      mx = -Infinity;
    for (let i = 0; i < SIZE; i++) {
      if (arr[i] < mn) mn = arr[i];
      if (arr[i] > mx) mx = arr[i];
    }
    if (fixedMaximum !== undefined) {
      mn = 0;
      mx = fixedMaximum;
    }
    const rng = mx - mn || 1;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const v = Math.pow(Math.max(0, Math.min(1, (arr[(y + HALF) % N * N + (x + HALF) % N] - mn) / rng)), .85),
        g = Math.round(255 * v),
        p = (y * N + x) * 4;
      img.data[p] = img.data[p + 1] = img.data[p + 2] = g;
      img.data[p + 3] = 255;
    }
    bctx.putImageData(img, 0, 0);
    paint(id);
  }

      



      function hot(v) {
    v = Math.max(0, Math.min(1, v));
    return [255 * Math.min(1, v * 3), 255 * Math.min(1, Math.max(0, v * 3 - 1)), 255 * Math.min(1, Math.max(0, v * 3 - 2))];
  }
  function drawSpec(id, re, im, logMode) {
    const img = bctx.createImageData(N, N),
      mag = new Float64Array(SIZE);
    let mx = 0;
    for (let i = 0; i < SIZE; i++) {
      let m = Math.hypot(re[i], im[i]);
      if (logMode) m = Math.log1p(m);
      mag[i] = m;
      if (m > mx) mx = m;
    }
    mx = mx || 1;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const v = mag[(y + HALF) % N * N + (x + HALF) % N] / mx,
        rgb = hot(logMode ? v : Math.pow(v, .6)),
        p = (y * N + x) * 4;
      img.data[p] = rgb[0];
      img.data[p + 1] = rgb[1];
      img.data[p + 2] = rgb[2];
      img.data[p + 3] = 255;
    }
    bctx.putImageData(img, 0, 0);
    paint(id);
  }
  function render(obj, psf, res, sR, sI, oR, oI, tR, tI) {
    drawReal('t1_conv_sample', obj);
    drawReal('t1_conv_psf', psf);
    drawReal('t1_conv_cam', res, current.maximum);
    drawSpec('t1_conv_f_sample', sR, sI, true);
    drawSpec('t1_conv_f_otf', oR, oI, false);
    drawSpec('t1_conv_f_cam', tR, tI, true);
    $('t1_conv_dc_out').textContent = f(state.dc) + ' px';
  }
  let pending = 0;
  let initialized = false;
  function queue() {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(() => {
      pending = 0;
      compute();
    });
  }
  function syncOutputs() {
    $('t1_conv_dc_out').textContent = f(state.dc) + ' px';
  }
  function init() {
    if (initialized) return;
    initialized = true;
    $('t1_conv_reset').addEventListener('click', reset);
    document.querySelectorAll('[data-conv-kind]').forEach(el => el.addEventListener('click', () => {
      state.kind = el.getAttribute('data-conv-kind');
      selectButtons('data-conv-kind', state.kind);
      compute();
    }));
    $('t1_conv_dc').addEventListener('input', () => {
      state.dc = Number($('t1_conv_dc').value);
      syncOutputs();
      queue();
    });
    selectButtons('data-conv-kind', state.kind);
    syncOutputs();
    compute();
  }
  function reset() {
    state.kind = defaults.kind;
    state.dc = defaults.dc;
    $('t1_conv_dc').value = defaults.dc;
    selectButtons('data-conv-kind', state.kind);
    syncOutputs();
    compute();
  }
  // 卷积动画已移除，stop 保留为空操作：app.js 在切换章节时仍会调用它。
  window.SIMLab.convOtf = {
    init,
    reset,
    stop() {},
    get current() { return current; }
  };
})();
