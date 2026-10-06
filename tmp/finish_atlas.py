from pathlib import Path
p=Path('sim-atlas.js');s=p.read_text()
s=s.replace("  const cplx = z => `${z.re >= 0 ? '' : '−'}${fmt(Math.abs(z.re))}${z.im >= 0 ? '+' : '−'}${fmt(Math.abs(z.im))}i`;", """  const cplx = z => {
    const number = v => Math.abs(v) < 1e-10 ? '0' : Math.abs(v) < .001 ? Math.abs(v).toExponential(1) : fmt(Math.abs(v));
    return `${z.re < -1e-10 ? '−' : ''}${number(z.re)}${z.im < -1e-10 ? '−' : '+'}${number(z.im)}i`;
  };""")
s=s.replace("  function blit(cv, fn)","  function chart(w, h) { const cv = plate(w * 2, h * 2); cv.getContext('2d').scale(2, 2); return cv; }\n  function blit(cv, fn)")
s=s.replace('这里的条件数针对实现采用的实基 [1, cosφ, sinφ]，不是上方复指数矩阵的条件数。三个级次的频谱一般都有复相位；零级对应的空域图为实值，只要求其频谱共轭对称。相位图隐藏低幅度位置，避免把数值噪声当结构。','这里采用实基 [1, cosφ, sinφ]；下方推导使用复指数基，矩阵条件数与基的归一化有关。零级对应的空域图为实值，其频谱满足共轭对称，仍然可以有复相位。')
s=s.replace("figure('分母 Σ w|T|²+ε²', blit(plate(),", "figure('分母 W + ε² · ε = ' + fmt(state.eps), overlay(blit(plate(),")
s=s.replace("      })),\n      figure('沿 0° 的理想匹配等效传递 G'", "      }), { rings: RINGS })),\n      figure('<b>融合输出</b> · log(1 + |Ŝ|)', logspec(pipe.spectrum || { re: new Float64Array(N * N), im: new Float64Array(N * N) }, { rings: RINGS })),\n      figure('沿 0° 的理想匹配等效传递 G'")
s=s.replace("const w = 560, h = 250, cv = plate(w, h)", "const w = innerWidth < 600 ? 380 : 760, h = 250, cv = chart(w, h)")
s=s.replace("const w = 760, h = 260, cv = plate(w, h)", "const w = innerWidth < 600 ? 380 : 760, h = 260, cv = chart(w, h)")
s=s.replace("const cv = plate(900, 250), ctx = cv.getContext('2d');\n    ctx.fillStyle = '#0d1424'; ctx.fillRect(0, 0, cv.width, cv.height);", "const w = innerWidth < 600 ? 340 : 900, h = innerWidth < 600 ? 670 : 250;\n    const cv = chart(w, h), ctx = cv.getContext('2d');\n    ctx.fillStyle = '#0d1424'; ctx.fillRect(0, 0, w, h);")
s=s.replace('const L = 35 + j * 300, W = 250, T = 45, H = 165;', 'const L = innerWidth < 600 ? 45 : 35 + j * 300, W = 250;\n      const top = innerWidth < 600 ? j * 220 : 0, T = top + 45, H = 150;')
s=s.replace('L, 22);','L, top + 22);').replace("L - 5, 232); ctx.fillText('0', X(0), 232); ctx.fillText('+14 px', L + W - 30, 232);", "L - 5, top + 214); ctx.fillText('0', X(0), top + 214); ctx.fillText('+14 px', L + W - 30, top + 214);\n      ctx.fillText('0', L - 20, T + H); ctx.fillText('1', L - 20, T);")
s=s.replace('  // References inside collapsed', "  let resizeTimer;\n  addEventListener('resize', () => {\n    clearTimeout(resizeTimer);\n    resizeTimer = setTimeout(() => { r8(); r9(); updateNavigation(); }, 120);\n  });\n  // References inside collapsed")
p.write_text(s)
p=Path('sim-atlas.css');s=p.read_text();s+='''
/* Display numerator, regularized denominator and the fused output together. */
#s8{grid-template-columns:repeat(3,minmax(0,1fr))}#s8 .plate:has(.curve){grid-column:1/-1;width:100%}#s8 .plate canvas.curve{max-width:860px;margin:0 auto}#s8 .plate:has(.curve) figcaption{text-align:center}.plate figcaption{font-size:11px}.figure-note{font-size:12px}
@media(max-width:600px){.plate figcaption{font-size:9px}.figure-note{font-size:10px}#s8 .plate canvas.curve{width:100%}}
''';p.write_text(s)
