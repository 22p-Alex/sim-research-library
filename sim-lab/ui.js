/* DOM, math formatting and grayscale rendering shared by this page only. */
(function () {
  'use strict';

  const $ = id => {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Missing SIM laboratory element: ${id}`);
    return element;
  };
  const value = id => Number($(id).value);
  const fmt = x => Number(x.toFixed(3)).toString();
  /* 相位均为 π/12 的整数步：读数用约分分数（如 2π/3），不用十进制近似。 */
  const piTex = rad => {
    const v = Math.round(rad / Math.PI * 12);
    if (!v) return '0';
    const gcd = (a, b) => b ? gcd(b, a % b) : a,
      g = gcd(Math.abs(v), 12),
      p = v / g,
      q = 12 / g,
      num = p === 1 ? '\\pi' : `${p}\\pi`;
    return q === 1 ? num : `\\tfrac{${num}}{${q}}`;
  };
  const piPlain = rad => {
    const v = Math.round(rad / Math.PI * 12);
    if (!v) return '0';
    const gcd = (a, b) => b ? gcd(b, a % b) : a,
      g = gcd(Math.abs(v), 12),
      p = v / g,
      q = 12 / g,
      num = p === 1 ? 'π' : `${p}π`;
    return q === 1 ? num : `${num}/${q}`;
  };
  const tex = (source, displayMode = false) => window.katex ? katex.renderToString(source, {
    displayMode,
    throwOnError: true,
    trust: false
  }) : source;
  function math(id, source) {
    $(id).innerHTML = tex(source);
  }
  function typeset(root = document) {
    for (const node of root.querySelectorAll('[data-tex]')) node.innerHTML = tex(node.dataset.tex, node.classList.contains('formula'));
  }
  function set(id, text) {
    $(id).textContent = text;
  }
  function badge(id, text, tone) {
    set(id, text);
    $(id).className = 'pill-badge badge pill-' + tone;
  }
  function output(id, unit = '') {
    set(id + '_out', fmt(value(id)) + unit);
  }
  function gray(id, arr, max = 1) {
    const cv = $(id),
      ctx = cv.getContext('2d');
    if (!arr) {
      ctx.fillStyle = '#101827';
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('无可用结果', cv.width / 2, cv.height / 2);
      return;
    }
    const img = ctx.createImageData(cv.width, cv.height);
    for (let i = 0; i < arr.length; i++) {
      const g = Math.round(255 * Math.max(0, Math.min(1, arr[i] / max)));
      img.data[4 * i] = img.data[4 * i + 1] = img.data[4 * i + 2] = g;
      img.data[4 * i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }
  window.SIMLab = {
    ui: {
      $,
      value,
      fmt,
      piTex,
      piPlain,
      tex,
      math,
      typeset,
      set,
      badge,
      output,
      gray
    }
  };
})();
