/* Check the teaching notation against the actual FFT/demixing pipeline.
 * No browser, layout inspection, screenshots, or duplicated physics engine. */
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const A = require('../web/atlas/sim-atlas-core.js');
const C = require('../web/shared/sim-core.js');
const coefficients = require('../web/atlas/sim-atlas-demix-coefficients.js');
const katex = require('../vendor/katex/katex.min.js');
const source = fs.readFileSync(path.join(root, 'web/atlas/sim-atlas.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'sim_pipeline_atlas.html'), 'utf8');
const decode = s => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
const portion = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));

// Minimal text-only DOM surface for the renderers. KaTeX itself validates every
// generated expression; numerical assertions independently read its TeX inputs.
function node() {
  return {
    dataset: {}, innerHTML: '', textContent: '', children: [], parts: {},
    classList: { toggle() {}, contains: () => true },
    querySelector(selector) { return this.parts[selector] ||= node(); },
    querySelectorAll(selector) {
      if (selector !== '[data-tex]') return [];
      const own = [...this.innerHTML.matchAll(/data-tex="([^"]*)"/g)].map(m => ({
        dataset: { tex: decode(m[1]) }, classList: { contains: () => true },
      }));
      return own.concat(...[...this.children, ...Object.values(this.parts)].map(n => n.querySelectorAll(selector)));
    },
    replaceChildren() { this.innerHTML = ''; this.children = []; this.parts = {}; },
  };
}
function fixture(cap = A.capture({ sample: 'star-points', m: .8, directions: 3 }), options = {}) {
  const elements = {}, get = id => elements[id] ||= node();
  get('demix-source-terms').children = [node(), node(), node()];
  const pipe = A.pipeline(cap.raw, cap.calibration, options, cap.truth.m);
  const bridge = { render: tex => katex.renderToString(tex, { throwOnError: true, displayMode: true }) };
  const ctx = vm.createContext({
    A, C, N: A.N, cap, pipe, inspectDir: 0, inspectOrder: 2, demixStep: 0,
    state: { phase: 0, angle: 0, otf: 0, merr: 0, noise: 'none' },
    probeBin: { x: 6, y: 0 }, $: get, document: { querySelectorAll: () => [] },
    window: { katex: bridge, SIMDemixCoefficients: coefficients }, katex: bridge, reducedMotion: { matches: true },
    fmt: n => Number(n.toFixed(3)).toString(), mod: (n, d) => ((n % d) + d) % d,
    orderColors: ['#76638f', '#bb4b4b', '#087b60'],
    syncDemixPlayback() {}, resetDemixAnimation() {},
  });
  vm.runInContext(
    portion('  function fractionTex(', '  /* Step 03') +
    portion('  function renderAcquisitionEquations(', '  function r4(') +
    portion('  function renderDemixOverview(', '  function stopDemixPlayback(') +
    portion('  function renderDemixAnimation(', '  function r5('), ctx);
  return { ctx, get, run: code => vm.runInContext(code, ctx) };
}

function scalar(s, m) {
  s = s.replace(/\s/g, '');
  if (s.startsWith('-')) return -scalar(s.slice(1), m);
  const frac = s.match(/^\\frac\{(.+)\}\{([^{}]+)\}$/);
  if (frac) return scalar(frac[1], m) / scalar(frac[2], m);
  const root = s.match(/^(.*)\\sqrt\{(\d+)\}$/);
  if (root) return scalar(root[1] || '1', m) * Math.sqrt(Number(root[2]));
  const pi = s.match(/^(\d*)\\pi$/);
  if (pi) return Number(pi[1] || 1) * Math.PI;
  if (/^\d*m$/.test(s)) return Number(s.slice(0, -1) || 1) * m;
  assert.match(s, /^\d+(?:\.\d+)?$/);
  return Number(s);
}
function complex(s, m) {
  if (s.startsWith('\\left(')) {
    const body = s.slice(6, -7), split = body.slice(1).search(/[+-]/) + 1;
    assert.ok(split > 0 && body.endsWith('i'), s);
    return { re: scalar(body.slice(0, split), m), im: (body[split] === '-' ? -1 : 1) * scalar(body.slice(split + 1, -1), m) };
  }
  const exp = s.match(/^(.*?)e\^\{(-?)i\\left\((.*?)\\right\)\}$/);
  if (exp) {
    const a = scalar(exp[1], m), p = (exp[2] ? -1 : 1) * scalar(exp[3], m);
    return { re: a * Math.cos(p), im: a * Math.sin(p) };
  }
  return { re: scalar(s, m), im: 0 };
}
const multiply = (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
const sum = zs => zs.reduce((a, b) => ({ re: a.re + b.re, im: a.im + b.im }), { re: 0, im: 0 });
function near(actual, expected, tolerance = 1e-11) {
  assert.ok(Math.hypot(actual.re - expected.re, actual.im - expected.im) < tolerance, JSON.stringify({ actual, expected }));
}

test('exact displayed decoder and expanded coefficients agree with the inverse matrix', () => {
  const f = fixture();
  for (const m of [.4, .65, .8, .96, 1.1, Math.PI / 4]) {
    for (const degrees of [0, 5, 15, 30, 45]) {
      const phases = A.phasesFor().map(p => p + degrees * Math.PI / 180);
      const g = { m, phases, weights: A.mixWeights(C.phaseSystem(phases), m) };
      f.ctx.g = g;
      for (let target = 0; target < 3; target++) {
        const ws = phases.map((_, j) => {
          const tex = f.run('demixWeightTex(g,' + target + ',' + j + ')');
          katex.renderToString(tex, { throwOnError: true });
          assert.ok(!/\d\.\d/.test(tex), tex);
          const value = complex(tex, m);
          near(value, g.weights[target][j]);
          return value;
        });
        // Independent arbitrary complex observations exercise the final formula.
        const data = [{ re: 7, im: -3 }, { re: -2, im: 5 }, { re: 1, im: 2 }];
        near(sum(ws.map((w, j) => multiply(w, data[j]))), sum(g.weights[target].map((w, j) => multiply(w, data[j]))));
        for (let h = 0; h < 3; h++) {
          const terms = phases.map((phase, j) => {
            const tex = f.run('demixProductTex(g,' + target + ',' + h + ',' + j + ')');
            katex.renderToString(tex, { throwOnError: true });
            assert.ok(!/\d\.\d/.test(tex), tex);
            const value = complex(tex, m), a = h === 0 ? 1 : m / 2, angle = [0, 1, -1][h] * phase;
            near(value, multiply(g.weights[target][j], { re: a * Math.cos(angle), im: a * Math.sin(angle) }));
            return value;
          });
          near(sum(terms), { re: target === h ? 1 : 0, im: 0 });
        }
      }
    }
  }
});

test('all six stages keep frame contributions and coefficient addition on the main flow', () => {
  const f = fixture();
  f.run('renderProbe(); renderDemixOverview()');
  const expected = A.probe(f.ctx.pipe, 0, 6, 0);
  assert.equal((f.get('probe-observations').innerHTML.match(/<b>≈ /g) || []).length, 3);
  assert.ok(!f.get('probe').innerHTML.includes('2.377'));
  assert.ok(f.get('probe-observations').innerHTML.includes('2.377'));
  assert.deepEqual(JSON.parse(f.get('probe').dataset.sourceFrequencies), [[6, 0], [-2, 0], [14, 0]]);
  for (let target = 0; target < 3; target++) {
    f.ctx.inspectOrder = target;
    f.run('renderDemixCalculation()');
    for (let step = 0; step < 6; step++) {
      f.ctx.demixStep = step;
      f.run('renderDemixAnimation()');
      // The stub has no real parent tree: render each formula-bearing node.
      for (const id of ['demix-equation', 'demix-source-terms', 'demix-model-note']) {
        for (const n of f.get(id).querySelectorAll('[data-tex]')) {
          katex.renderToString(n.dataset.tex, { throwOnError: true });
          assert.ok(!/\d\.\d/.test(n.dataset.tex), n.dataset.tex);
        }
      }
      near({ re: Number(f.get('demix-animation').dataset.resultRe), im: Number(f.get('demix-animation').dataset.resultIm) }, expected.orders[target].value);
      near({ re: Number(f.get('demix-animation-result').dataset.resultRe), im: Number(f.get('demix-animation-result').dataset.resultIm) }, expected.orders[target].value);
      assert.ok(f.get('demix-animation-result').innerHTML.includes('代入三帧读数'));
      assert.ok(f.get('demix-animation-result').innerHTML.includes('仍含 H(f) 衰减'));
      for (let source = 0; source < 3; source++) {
        const card = f.get('demix-source-terms').children[source];
        const rows = card.querySelector('.source-term-math').innerHTML;
        for (let frame = 1; frame <= 3; frame++) assert.ok(rows.includes(`第 ${frame} 帧`));
        assert.equal(card.querySelector('.source-term-sum').hidden, step < 3);
        if (step >= 4) {
          const addition = card.querySelector('.source-term-sum').querySelector('.source-term-addition').innerHTML;
          for (const word of ['实部', '虚部', '合计']) assert.ok(addition.includes(word));
        }
        const products = JSON.parse(card.dataset.products);
        products.forEach((value, j) => {
          const phase = f.ctx.pipe.groups[0].phases[j], order = [0, 1, -1][source], a = source === 0 ? 1 : f.ctx.pipe.groups[0].m / 2;
          near(value, multiply(expected.weights[target][j], { re: a * Math.cos(order * phase), im: a * Math.sin(order * phase) }));
        });
        near({ re: Number(card.dataset.coefficientRe), im: Number(card.dataset.coefficientIm) }, expected.orders[target].responses[source]);
      }
    }
    near({ re: Number(f.get('demix-calculation').dataset.resultRe), im: Number(f.get('demix-calculation').dataset.resultIm) }, expected.orders[target].value);
  }
  assert.match(html, /<details class="derivation" id="demix-arithmetic">/);
  assert.match(html, /id="demix-arithmetic">[\s\S]*id="probe-observations"[\s\S]*id="probe-otf-values"[\s\S]*id="demix-calculation"/);
});

function componentScalar(s, m) {
  if (s.startsWith('-')) return -componentScalar(s.slice(1), m);
  const trig = s.match(/^(.*?)\\(cos|sin)\\left\((.*?)\\right\)$/);
  return trig ? scalar(trig[1], m) * Math[trig[2]](scalar(trig[3], m)) : scalar(s, m);
}

test('real and imaginary terms in the visible cancellation trace match actual inverse weights', () => {
  const f = fixture();
  for (const m of [.4, .65, .8, 1.1, Math.PI / 4]) for (const degrees of [0, 5, 15, 30, 45]) {
    const phases = A.phasesFor().map(p => p + degrees * Math.PI / 180);
    f.ctx.g = { m, phases, weights: A.mixWeights(C.phaseSystem(phases), m) };
    for (let target = 0; target < 3; target++) for (let source = 0; source < 3; source++) {
      const parts = f.run(`demixColumnPartsTex(g,${target},${source})`);
      parts.forEach((part, j) => {
        const h = [0, 1, -1][source], a = source === 0 ? 1 : m / 2;
        const expected = multiply(f.ctx.g.weights[target][j], { re: a * Math.cos(h * phases[j]), im: a * Math.sin(h * phases[j]) });
        near({ re: componentScalar(part.re, m), im: componentScalar(part.im, m) }, expected);
      });
    }
  }
});

test('zero-order cancellation visibly derives 1 and 0 from the same three observations', () => {
  const f = fixture();
  f.ctx.inspectOrder = 0; f.ctx.demixStep = 4;
  f.run('renderDemixAnimation()');
  const equation = f.get('demix-equation').innerHTML;
  for (let j = 0; j < 3; j++) assert.ok(equation.includes(`\\frac{1}{3}D_{${j}}`));
  assert.ok(equation.includes('1\\cdot A_{0}'));
  assert.ok(equation.includes('0\\cdot A_{+1}'));
  const cards = f.get('demix-source-terms').children;
  const trace = i => cards[i].querySelector('.source-term-sum').querySelector('.source-term-addition').innerHTML;
  assert.ok(trace(0).includes('\\frac{1}{3}+\\frac{1}{3}+\\frac{1}{3}=1'));
  assert.ok(trace(1).includes('\\frac{2}{15}-\\frac{1}{15}-\\frac{1}{15}=0'));
  assert.ok(trace(1).includes('0+\\frac{\\sqrt{3}}{15}-\\frac{\\sqrt{3}}{15}=0'));
  assert.ok(trace(2).includes('0-\\frac{\\sqrt{3}}{15}+\\frac{\\sqrt{3}}{15}=0'));
});

test('three raw spectrum probes share a bin, actual FFT readings and keyboard selection', () => {
  const f = fixture();
  let focused;
  Object.assign(f.ctx, {
    viewHalf: 24, RINGS: ['detection-cutoff'], updateEncodingProbeMarkers() {},
    logspec(z, opt) {
      return { z, opt, style: {}, setAttribute() {}, focus() { focused = this; },
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 256, height: 256 }) };
    },
    figure: (caption, cv) => ({ caption, cv }),
    strip: (id, lane, items) => { f.get(id).items = items; },
    renderProbe() {}, renderDemixOverview() {}, renderDemixCalculation() {}, r5() {}, r6() {},
  });
  vm.runInContext(portion('  function r4(', '  /* Step 04 matrix'), f.ctx);
  for (let dir = 0; dir < 3; dir++) {
    f.ctx.inspectDir = dir;
    f.run('r4()');
    const frames = f.get('s4').items;
    assert.equal(frames.length, 3);
    frames.forEach(({ cv, caption }, j) => {
      assert.equal(cv.z, f.ctx.pipe.groups[dir].rawSpectra[j]);
      assert.equal(cv.opt.marker, f.ctx.probeBin);
      assert.ok(caption.includes(`D<sub>${j}</sub> ≈`));
    });
    assert.deepEqual(JSON.parse(f.get('demix-readings-scale').dataset.observed), A.probe(f.ctx.pipe, dir, f.ctx.probeBin.x, f.ctx.probeBin.y).observed);
  }
  const second = f.get('s4').items[1].cv;
  let prevented = false;
  second.onkeydown({ key: 'ArrowRight', preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(f.ctx.probeBin.x, 7);
  assert.equal(focused, f.get('s4').items[1].cv, 'focus stays on the inspected frame after rerender');
  f.get('s4').items[2].cv.onclick({ clientX: 160, clientY: 128 });
  assert.equal(f.ctx.probeBin.x, 6);
  assert.equal(f.ctx.probeBin.y, 0);
  assert.equal(focused, f.get('s4').items[2].cv);
});

test('main separation flow precedes collapsed source, matrix and numeric derivations', () => {
  const section = html.slice(html.indexOf('<section class="band" id="b4">'), html.indexOf('<section class="band" id="b5">'));
  const sequence = ['id="s4"', 'class="order-selector"', 'id="demix-animation"', 'id="demix-animation-result"', 'id="demix-sources"', 'id="demix-matrix-details"', 'id="demix-arithmetic"'];
  const positions = sequence.map(s => section.indexOf(s));
  assert.ok(positions.every((p, i) => p >= 0 && (!i || p > positions[i - 1])));
  for (const id of ['demix-sources', 'demix-matrix-details', 'demix-arithmetic', 'demix-theory', 'probe-otf-theory'])
    assert.match(section, new RegExp('<details class="derivation" id="' + id + '">'));
});

test('probe keeps acquisition truth separate from adopted parameters, including noise and cutoff', () => {
  for (const noise of ['none', 'low']) {
    const cap = A.capture({ m: .8, directions: 3, noise });
    const f = fixture(cap, { otfError: -.2, phaseError: Math.PI / 12, modulationError: .2, angleError: 5 });
    f.ctx.state.phase = 15;
    for (let dir = 0; dir < 3; dir++) {
      f.ctx.inspectDir = dir;
      for (const point of [[0, 0], [6, 0], [9, 0], [10, 0], [-4, 5], [14, 0]]) {
        f.ctx.probeBin = { x: (point[0] + A.N) % A.N, y: (point[1] + A.N) % A.N };
        f.run('renderProbe()');
        const physical = A.otf(...point, A.KC);
        assert.equal(Number(f.get('probe-otf-values').dataset.physicalH), physical);
        assert.equal(Number(f.get('probe-otf-values').dataset.adoptedH), A.otf(...point, f.ctx.pipe.cutoff));
        assert.deepEqual(JSON.parse(f.get('probe').dataset.sourceFrequencies), [0, 1, -1].map(h => point.map((v, axis) => v - h * A.VECTORS[dir][axis])));
        assert.ok(f.get('probe-observations').innerHTML.includes('计算采用相位 15°'));
        assert.equal(f.get('probe-equations').innerHTML.includes('+N_j'), noise !== 'none');
      }
    }
  }
});

test('annotated source products and substituted frame agree with acquisition FFT data', () => {
  for (const capture of [{ m: .8 }, { m: .2, phases: 'close' }]) {
    const cap = A.capture({ sample: 'star-points', directions: 3, ...capture });
    const f = fixture(cap, { phaseError: Math.PI / 12, modulationError: .2, angleError: 5, otfError: -.2 });
    for (let dir = 0; dir < 3; dir++) for (const point of [[6, 0], [-4, 5], [10, 0]]) {
      f.ctx.inspectDir = dir;
      f.ctx.probeBin = { x: (point[0] + A.N) % A.N, y: (point[1] + A.N) % A.N };
      f.run('renderProbe(); renderAcquisitionEquations()');
      const markup = f.get('probe').innerHTML;
      const table = markup.match(/<tbody>([\s\S]*?)<\/tbody>/)[1];
      const expressions = [...table.matchAll(/data-tex="([^"]*)"/g)].map(m => decode(m[1]));
      assert.equal(expressions.length, 12);
      const products = [0, 1, -1].map((order, i) => {
        const [component, transfer, specimen, coordinate] = expressions.slice(i * 4, i * 4 + 4);
        const componentPoint = component.match(/A_\{(0|\+1|-1)\}\((-?\d+),(-?\d+)\)/);
        assert.equal(Number(componentPoint[1]), order);
        assert.deepEqual(componentPoint.slice(2).map(Number), point);
        assert.equal(transfer, `H(${point.join(',')})`);
        const q = specimen.match(/S\((-?\d+),(-?\d+)\)/).slice(1).map(Number);
        assert.deepEqual(q, point.map((v, axis) => v - order * A.VECTORS[dir][axis]));
        const displayedPoints = [...coordinate.matchAll(/\((-?\d+),(-?\d+)\)/g)].map(m => m.slice(1).map(Number));
        assert.deepEqual(displayedPoints, order === 0 ? [point] : [point, A.VECTORS[dir], q]);
        if (order !== 0) assert.ok(coordinate.includes(`\\mathbf f${order === 1 ? '-' : '+'}\\mathbf k_{${dir + 1}}`));
        const index = A.idx(...q), h = A.otf(...point, A.KC) / (A.N * A.N);
        return { re: h * cap.truth.spectrum.re[index], im: h * cap.truth.spectrum.im[index] };
      });
      const substitution = f.get('probe-equations').querySelectorAll('[data-tex]').at(-1).dataset.tex;
      const coefficients = [{ re: 1, im: 0 }, ...[...substitution.matchAll(/&\+\{\}(.*?)\\underbrace/g)].map(m => complex(m[1], cap.truth.m))];
      assert.equal(coefficients.length, 3);
      const acquisition = JSON.parse(f.get('acquisition-weights').dataset.equations)[1];
      coefficients.forEach((value, i) => near(value, { re: acquisition.coefficients[i][0], im: acquisition.coefficients[i][1] }));
      // Read the displayed A definitions and weights to reproduce the actual
      // second frame, even though the decoder uses deliberately wrong parameters.
      const predicted = sum(coefficients.map((value, i) => multiply(value, products[i])));
      near(predicted, A.probe(f.ctx.pipe, dir, ...point).observed[1]);
    }
  }
});

test('OTF exact substitution agrees with the analytical model over the detector grid', () => {
  const f = fixture();
  const example = f.run('idealOtfAtTex([6,0],10)');
  assert.ok(example.includes('\\arccos\\left(\\frac{3}{5}\\right)-\\frac{12}{25}'));
  for (let x = -12; x <= 12; x++) for (let y = -12; y <= 12; y++) {
    const tex = f.run('idealOtfAtTex([' + x + ',' + y + '],10)');
    katex.renderToString(tex, { throwOnError: true });
    assert.ok(!/\d\.\d/.test(tex), tex);
    const body = tex.match(/\\arccos\\left\((.*?)\\right\)-(.*?)\\right\]/);
    const value = body ? 2 / Math.PI * (Math.acos(scalar(body[1])) - scalar(body[2]))
      : tex.endsWith('=1') ? 1 : 0;
    assert.ok(Math.abs(value - A.idealOTF(Math.hypot(x, y) / 10)) < 1e-12, tex);
  }
  for (const m of html.matchAll(/data-tex="([^"]*)"/g)) katex.renderToString(decode(m[1]), { throwOnError: true, displayMode: true });
});

test('modulation fallback changes the decoder without changing the physical equation', () => {
  for (const m of [0, .2]) {
    const f = fixture(A.capture({ m, directions: 1 }));
    f.run('renderProbe(); renderDemixOverview(); renderDemixAnimation()');
    assert.equal(f.ctx.pipe.groups[0].m, .65);
    const tex = f.get('probe-equations').querySelectorAll('[data-tex]').find(n => n.dataset.tex.includes('D_j')).dataset.tex;
    assert.ok(tex.includes(m === 0 ? '0e^' : '\\frac{1}{10}e^'));
    assert.ok(f.get('demix-overview-matrix').innerHTML.includes('\\frac{13}{40}'));
    assert.ok(f.get('demix-model-note').innerHTML.includes('调制度回退'));
    assert.ok(f.get('probe-otf-values').innerHTML.includes((m / .65).toFixed(4)));
  }
});

test('nonuniform phases use the inverse matrix; singular phases clear stale readings', () => {
  const f = fixture(A.capture({ m: .8, phases: 'close', directions: 1 }));
  for (let step = 0; step < 6; step++) {
    f.ctx.demixStep = step;
    f.run('renderDemixAnimation(); renderDemixCalculation()');
    if (step === 1) assert.ok(f.get('demix-equation').innerHTML.includes('M^{-1}'));
    if (step === 2) assert.ok(f.get('demix-step-explanation').textContent.includes('不必各为 1/3'));
    for (const id of ['demix-equation', 'demix-source-terms']) {
      for (const n of f.get(id).querySelectorAll('[data-tex]')) katex.renderToString(n.dataset.tex, { throwOnError: true });
    }
  }
  f.ctx.cap = A.capture({ m: .8, phases: 'duplicate', directions: 1 });
  f.ctx.pipe = A.pipeline(f.ctx.cap.raw, f.ctx.cap.calibration, {}, .8);
  f.run('renderProbe(); renderDemixAnimation(); renderDemixCalculation()');
  for (const id of ['probe-equations', 'probe-observations', 'probe-otf-values', 'probe-otf-expression', 'demix-equation']) assert.equal(f.get(id).innerHTML, '');
});
