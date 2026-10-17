/* Numerical and interaction checks only: no browser, screenshots or layout QA. */
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const A = require('../web/atlas/sim-atlas-core.js');
const katex = require('../vendor/katex/katex.min.js');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'web/atlas/sim-atlas.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'sim_pipeline_atlas.html'), 'utf8');
const portion = (start, end) => {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a, start);
  return source.slice(a, b);
};
function reconstruction(directions = 3, options = {}, noise = 'none') {
  const cap = A.capture({ sample: 'star-points', m: .8, directions, noise });
  return A.pipeline(cap.raw, cap.calibration, options, .8);
}
function fixture(pipe) {
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
  const nodes = {}, raf = new Map(); let sequence = 0;
  const element = () => ({
    dataset: {}, attrs: {}, parts: {}, events: {}, hidden: false, textContent: '', innerHTML: '',
    style: { values: {}, setProperty(key, value) { this.values[key] = value; } },
    setAttribute(key, value) { this.attrs[key] = value; },
    querySelector(key) { return this.parts[key] ||= element(); },
    addEventListener(key, callback) { this.events[key] = callback; },
    getContext() { return { clearRect() {} }; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 80, height: 80 }; },
    setPointerCapture(id) { this.capturedPointer = id; },
    releasePointerCapture() { this.capturedPointer = null; },
    hasPointerCapture(id) { return this.capturedPointer === id; },
    focus() { this.focused = true; },
  });
  const get = id => { assert.ok(ids.has(id), 'Missing HTML target: ' + id); return nodes[id] ||= element(); };
  const buttons = [0, 1, 2].map(step => { const b = element(); b.dataset.fusionStep = String(step); return b; });
  const speeds = [.25, .5, 1, 2], speedInput = get('fusion-speed');
  speedInput.value = '1'; speedInput.min = '0'; speedInput.max = '3'; speedInput.step = '1';
  const playback = vm.runInNewContext(portion('  const fusionPlayback =', '  const options =') + '\nfusionPlayback;');
  const motion = { matches: false, addEventListener(type, callback) { this.change = callback; } };
  const bridge = { render(tex) { katex.renderToString(tex, { displayMode: true, throwOnError: true }); } };
  const context = vm.createContext({
    pipe, fusionPlayback: playback, $: get, document: { querySelectorAll: selector => {
      if (selector === '[data-fusion-step]') return buttons;
      throw new Error('Unexpected selector: ' + selector);
    } },
    window: { katex: bridge }, katex: bridge, reducedMotion: motion, Float64Array,
    specMax(z) { let m = 0; for (let i = 0; i < z.re.length; i++) m = Math.max(m, Math.hypot(z.re[i], z.im[i])); return m; },
    blit(cv, sample) { cv.samples = [sample(0, 0), sample(6, 0), sample(14, 0)]; return cv; },
    spectrumIndex: (x, y, n) => A.idx(x, y, n), gray: v => [v, v, v],
    overlay() {}, RINGS: [],
    requestAnimationFrame(callback) { raf.set(++sequence, callback); return sequence; },
    cancelAnimationFrame(id) { raf.delete(id); },
  });
  const run = code => vm.runInContext(code, context);
  run(portion('  function buildFusionPlan(', '  function r8()'));
  run(portion("  document.querySelectorAll('[data-fusion-step]').forEach(button => button.addEventListener", "  $('c-profile-y').addEventListener"));
  run('syncFusionSource()');
  return {
    run, context, get, buttons, speedInput, playback, motion, raf,
    tick(now) { const callbacks = [...raf.values()]; raf.clear(); callbacks.forEach(callback => callback(now)); },
    click(step) { buttons[step].events.click(); },
    chooseSpeed(speed) { speedInput.value = String(speeds.indexOf(speed)); speedInput.events.input({ target: speedInput }); },
    selectedSpeeds() { return [speeds[Number(speedInput.value)]]; },
  };
}
function assertSpectrum(ctx, expression, expected) {
  ctx.expected = expected;
  // Verify every complex bin, including destructive interference and OTF zeros.
  vm.runInContext('for (let i = 0; i < expected.re.length; i++) {'
    + 'const z = fusionPixel(' + expression + ', i);'
    + 'if (Math.abs(z.re - expected.re[i]) > 1e-10 || Math.abs(z.im - expected.im[i]) > 1e-10)'
    + 'throw new Error("Incorrect complex bin " + i); }', ctx);
}

test('animation endpoints reproduce all three complex pipeline results for 1/3 directions, noise, mismatch and w=0', () => {
  for (const [directions, options, noise] of [[1, {}, 'none'], [3, {}, 'none'], [3, { eps: 0 }, 'none'], [3, { angleError: 3, phaseError: .2 }, 'low']]) {
    const pipe = reconstruction(directions, options, noise), f = fixture(pipe);
    const original = { re: pipe.numerator.re.slice(), im: pipe.numerator.im.slice() };
    f.run('plan = buildFusionPlan(pipe)');
    assert.equal(f.context.plan.records.length, directions * 3);
    assertSpectrum(f.context, 'fusionFrame(plan, 0, 1).views[2]', pipe.numerator);
    assertSpectrum(f.context, 'fusionFrame(plan, 1, 0).views[2]', pipe.numerator);
    assertSpectrum(f.context, 'fusionFrame(plan, 1, 1).views[2]', pipe.preApoSpectrum);
    assertSpectrum(f.context, 'fusionFrame(plan, 2, 0).views[2]', pipe.preApoSpectrum);
    assertSpectrum(f.context, 'fusionFrame(plan, 2, 1).views[2]', pipe.spectrum);
    for (let index = 0; index < directions * 3; index++) {
      const progress = (index + .75) / (directions * 3);
      assertSpectrum(f.context, 'fusionFrame(plan, 0, ' + progress + ').views[1]', pipe.bands[index].matched);
    }
    for (let i = 0; i < pipe.numerator.re.length; i++) {
      assert.equal(f.context.plan.reciprocal[i], pipe.regularizedDenominator[i] > 1e-14 ? 1 / pipe.regularizedDenominator[i] : 0);
    }
    assert.deepEqual(pipe.numerator, original, 'Animation must never modify reconstruction arrays');
  }
});

test('intermediate cumulative frames add complex contributions before magnitude; transition brightness has a fixed scale', () => {
  const f = fixture(reconstruction(1));
  const z = (re, im) => ({ re: Float64Array.of(re), im: Float64Array.of(im) });
  f.context.small = {
    groups: [{ bands: [{ shifted: z(4, 6), matched: z(2, 3) }, { shifted: z(-4, -6), matched: z(-2, -3) }] }],
    numerator: z(0, 0), preApoSpectrum: z(0, 0), spectrum: z(0, 0),
    regularizedDenominator: Float64Array.of(0), apodization: Float64Array.of(0),
  };
  f.run('plan = buildFusionPlan(small)');
  assertSpectrum(f.context, 'fusionFrame(plan, 0, .5).views[2]', z(2, 3));
  assertSpectrum(f.context, 'fusionFrame(plan, 0, .875).views[2]', z(1, 1.5));
  assertSpectrum(f.context, 'fusionFrame(plan, 0, 1).views[2]', z(0, 0));
  assert.equal(f.context.plan.reciprocal[0], 0);
  for (let stage = 0; stage < 3; stage++) for (const progress of [0, .3, .6, 1]) {
    f.context.stage = stage; f.context.progress = progress;
    f.run('frame = fusionFrame(plan, stage, progress)');
    for (const view of f.context.frame.views) if (view.kind === 'spectrum') assert.equal(view.maximum, f.context.plan.maximum);
  }
});

test('the third card alone reveals all four results; cards can pause, resume and replay', () => {
  const f = fixture(reconstruction());
  assert.equal(f.get('fusion-results').hidden, true);
  assert.equal(f.get('fusion-player').hidden, true);
  assert.equal(f.playback.plan, null, 'Build the preview only when a card is activated');
  f.click(2);
  assert.equal(f.playback.playing, true);
  assert.equal(f.raf.size, 1);
  assert.equal(f.get('fusion-player').hidden, false);
  assert.match(f.buttons[2].attrs['aria-label'], /点击暂停/);
  f.tick(0); f.tick(1400);
  assert.ok(f.playback.progress > 0);
  f.click(2);
  const paused = f.playback.progress;
  assert.equal(f.raf.size, 0);
  assert.match(f.buttons[2].attrs['aria-label'], /点击继续/);
  f.tick(30000);
  assert.equal(f.playback.progress, paused);
  f.click(2);
  f.tick(30000);
  assert.equal(f.playback.progress, paused, 'Resume must not jump over time spent paused');
  f.tick(50000);
  assert.equal(f.playback.done[2], true);
  assert.equal(f.playback.done[0], false);
  assert.equal(f.playback.done[1], false);
  assert.equal(f.playback.progress, 1);
  assert.equal(f.get('fusion-results').hidden, false);
  assert.equal(f.get('fusion-player').hidden, true, 'The completed third animation gives way to the four-result overview');
  f.tick(100000);
  assert.equal(f.playback.stage, 2, 'A completed step waits for another card click');
  assert.equal(f.raf.size, 0);
  f.click(1);
  f.tick(100001); f.tick(112001);
  assert.equal(f.playback.done[1], true);
  assert.equal(f.get('fusion-results').hidden, false);
  assert.equal(f.get('fusion-player').hidden, false, 'Selecting another card reopens its animation');
  f.click(0);
  f.tick(120000); f.tick(192000);
  assert.equal(f.playback.done.every(Boolean), true);
  assert.equal(f.get('fusion-results').hidden, false);
  assert.equal(f.raf.size, 0);
  assert.match(f.buttons[2].attrs['aria-label'], /点击重播/);
  f.click(0);
  assert.equal(f.playback.progress, 0);
  assert.equal(f.get('fusion-player').hidden, false);
  assert.equal(f.get('fusion-results').hidden, false, 'Completed overview stays available during a replay');
  f.click(0);
  assert.equal(f.playback.playing, false);
  assert.match(f.buttons[0].attrs['aria-label'], /点击继续/);
});

test('card switches and reconstruction changes cancel stale frames; view-only redraws preserve progress', () => {
  const f = fixture(reconstruction());
  f.click(0);
  const stale = [...f.raf.values()][0];
  f.click(2); stale(20000);
  assert.equal(f.playback.stage, 2);
  assert.equal(f.playback.progress, 0);
  assert.equal(f.raf.size, 1);
  f.tick(20000); f.tick(24800); f.click(2);
  f.run('syncFusionSource(); drawFusionFrame(true)');
  assert.equal(f.playback.progress, .4);
  f.context.pipe = reconstruction(1);
  f.run('syncFusionSource()');
  assert.equal(f.raf.size, 0);
  assert.equal(f.playback.plan, null);
  assert.equal(f.playback.stage, -1);
  assert.equal(f.playback.done.some(Boolean), false);
  assert.equal(f.get('fusion-player').hidden, true);
  assert.equal(f.get('fusion-results').hidden, true);
  f.click(1);
  f.context.pipe = { ok: false };
  f.run('syncFusionSource()');
  assert.equal(f.raf.size, 0);
  assert.ok(f.buttons.every(button => button.disabled));
  f.click(0);
  assert.equal(f.playback.stage, -1);
});

test('reduced-motion users can complete all cards without animation; any viewing order works', () => {
  const f = fixture(reconstruction(1));
  f.click(2);
  f.motion.matches = true; f.motion.change();
  assert.equal(f.playback.done[2], true);
  assert.equal(f.get('fusion-results').hidden, false);
  assert.equal(f.get('fusion-player').hidden, true);
  for (const stage of [1, 0]) {
    f.click(stage);
    assert.equal(f.playback.done[stage], true);
    assert.equal(f.playback.playing, false);
    assert.equal(f.raf.size, 0);
  }
  assert.equal(f.get('fusion-results').hidden, false);
  assert.ok(f.buttons.every(button => button.dataset.complete === 'true'));
});

test('playback speed applies to every stage; changing speed preserves the frame and cancels the old clock', () => {
  const f = fixture(reconstruction(1));
  assert.equal(f.playback.speed, .5);
  assert.deepEqual(f.selectedSpeeds(), [.5]);
  assert.equal(f.get('fusion-play').disabled, true);
  assert.equal(f.get('fusion-progress').disabled, true);
  for (const speed of [.25, .5, 1, 2]) for (const stage of [0, 1, 2]) {
    f.chooseSpeed(speed);
    assert.deepEqual(f.selectedSpeeds(), [speed], 'The knob selects the requested speed');
    assert.equal(f.get('fusion-speed-value').textContent, speed + '×');
    assert.ok(f.get('fusion-speed').attrs['aria-valuetext'].includes(String(speed)));
    assert.match(f.get('fusion-speed').attrs['aria-valuetext'], /倍|×/);
    f.run('startFusionStep(' + stage + ')');
    f.tick(0); f.tick(1000);
    const duration = stage === 0 ? 12000 : 6000;
    assert.equal(f.playback.progress, 1000 * speed / duration);
  }
  f.run('startFusionStep(1)');
  f.tick(1000); f.tick(1600);
  const progress = f.playback.progress, stale = [...f.raf.values()][0];
  f.chooseSpeed(.5);
  assert.equal(f.playback.progress, progress);
  assert.equal(f.raf.size, 1);
  stale(999999);
  assert.equal(f.playback.progress, progress);
  f.tick(2000);
  assert.equal(f.playback.progress, progress, 'A new speed starts timing at the displayed frame');
  f.tick(3200);
  assert.ok(Math.abs(f.playback.progress - progress - .1) < 1e-12);
  const epoch = f.playback.epoch;
  f.chooseSpeed(.5);
  assert.equal(f.playback.epoch, epoch, 'Clicking the active speed keeps its playback clock running');
  assert.deepEqual(f.selectedSpeeds(), [.5]);
  f.get('fusion-play').events.click();
  const paused = f.playback.progress;
  assert.equal(f.get('fusion-play').textContent, '继续');
  assert.equal(f.raf.size, 0);
  f.chooseSpeed(2);
  f.tick(50000);
  assert.equal(f.playback.progress, paused);
  assert.equal(f.playback.playing, false, 'Selecting speed while paused must not start playback');
  f.get('fusion-play').events.click();
  f.tick(60000);
  assert.equal(f.playback.progress, paused, 'Dedicated resume control ignores time spent paused');
  f.tick(60600);
  assert.ok(Math.abs(f.playback.progress - paused - .2) < 1e-12);
  f.context.pipe = reconstruction(3);
  f.run('syncFusionSource()');
  assert.equal(f.playback.speed, 2, 'Reconstruction changes preserve the selected viewing speed');
  assert.deepEqual(f.selectedSpeeds(), [2]);
  assert.equal(f.get('fusion-play').disabled, true);
  assert.equal(f.get('fusion-progress').value, '0');
});

test('seeking pauses on the requested complex frame, preserves results and supports reduced motion', () => {
  const pipe = reconstruction(1), f = fixture(pipe);
  f.click(0);
  assert.equal(f.get('fusion-play').textContent, '暂停');
  assert.equal(f.get('fusion-progress').disabled, false);
  const stale = [...f.raf.values()][0];
  f.get('fusion-progress').events.input({ target: { value: '250' } });
  assert.equal(f.playback.progress, .25);
  assert.equal(f.playback.playing, false);
  assert.equal(f.raf.size, 0);
  assert.equal(f.get('fusion-progress-value').textContent, '25%');
  assert.equal(f.get('fusion-progress').attrs['aria-valuetext'], '25%');
  assertSpectrum(f.context, 'fusionPlayback.views[1]', pipe.bands[0].matched);
  stale(99999);
  assert.equal(f.playback.progress, .25);
  f.get('fusion-progress').events.input({ target: { value: '1000' } });
  assertSpectrum(f.context, 'fusionPlayback.views[2]', pipe.numerator);
  assert.equal(f.playback.done[0], true);
  assert.equal(f.get('fusion-play').textContent, '重播本步');
  f.get('fusion-play').events.click();
  assert.equal(f.playback.progress, 0);
  assert.equal(f.playback.playing, true);
  f.click(2);
  f.get('fusion-progress').events.input({ target: { value: '1000' } });
  assertSpectrum(f.context, 'fusionPlayback.views[2]', pipe.spectrum);
  assert.equal(f.get('fusion-results').hidden, false);
  assert.equal(f.get('fusion-player').hidden, true);
  f.get('fusion-progress').events.input({ target: { value: '400' } });
  assert.equal(f.get('fusion-player').hidden, false, 'Dragging back reopens a completed animation');
  assert.equal(f.get('fusion-results').hidden, false);
  assert.equal(f.playback.playing, false);
  f.motion.matches = true; f.motion.change();
  assert.equal(f.get('fusion-speed').disabled, true);
  assert.equal(f.playback.progress, .4, 'Reduced motion preserves a manually selected static frame');
  f.get('fusion-progress').events.input({ target: { value: '750' } });
  assert.equal(f.playback.progress, .75);
  assert.equal(f.raf.size, 0);
  f.get('fusion-play').events.click();
  assert.equal(f.playback.progress, 1);
  assert.equal(f.raf.size, 0);
  f.motion.matches = false; f.motion.change();
  assert.equal(f.get('fusion-speed').disabled, false);
});

test('speed knob clicks, drags and keyboard commands select four stops without crossing the dead zone', () => {
  const f = fixture(reconstruction(1)), input = f.get('fusion-speed');
  const point = (angle, extra = {}) => {
    const radians = angle * Math.PI / 180;
    return { clientX: 40 + 30 * Math.sin(radians), clientY: 40 - 30 * Math.cos(radians),
      pointerId: 7, button: 0, isPrimary: true, preventDefault() {}, ...extra };
  };
  const down = angle => input.events.pointerdown(point(angle));
  const up = angle => input.events.pointerup(point(angle));
  for (const [index, angle] of [-135, -45, 45, 135].entries()) {
    down(angle); up(angle);
    assert.equal(Number(input.value), index);
    assert.equal(f.playback.speed, [.25, .5, 1, 2][index]);
    assert.equal(input.capturedPointer, null);
  }
  down(135);
  input.events.pointermove(point(170));
  input.events.pointermove(point(-170));
  input.events.pointermove(point(-135));
  assert.equal(f.playback.speed, 2, 'Crossing the bottom dead zone must not jump from maximum to minimum');
  up(-135);
  down(135); input.events.pointermove(point(45)); up(45);
  assert.equal(f.playback.speed, 1);
  const before = f.playback.speed;
  input.events.pointerdown(point(0, { clientX: 40, clientY: 40 }));
  input.events.pointerup(point(0, { clientX: 40, clientY: 40 }));
  assert.equal(f.playback.speed, before, 'The center cannot supply a meaningful rotation angle');
  let prevented = 0;
  const key = name => input.events.keydown({ key: name, preventDefault() { prevented++; } });
  key('Home'); assert.equal(f.playback.speed, .25);
  key('ArrowUp'); assert.equal(f.playback.speed, .5);
  key('ArrowRight'); assert.equal(f.playback.speed, 1);
  key('End'); assert.equal(f.playback.speed, 2);
  key('ArrowDown'); assert.equal(f.playback.speed, 1);
  key('ArrowLeft'); assert.equal(f.playback.speed, .5);
  assert.equal(prevented, 6);
  f.motion.matches = true; f.motion.change();
  key('End'); down(-135); up(-135);
  assert.equal(f.playback.speed, .5, 'A disabled knob cannot change speed through custom handlers');
});

test('three step cards expose labelled playback controls without removing the formula or results', () => {
  const section = html.slice(html.indexOf('<div class="fusion-workbench">'), html.indexOf('<div id="fusion-results"'));
  assert.equal((section.match(/type="button" class="fusion-card" data-fusion-step="/g) || []).length, 3);
  assert.match(section, /id="fusion-play"[^>]*type="button"/);
  assert.match(section, /id="fusion-speed"[^>]*type="range"[^>]*min="0"[^>]*max="3"[^>]*step="1"/);
  assert.match(section, /id="fusion-speed"[^>]*aria-labelledby="fusion-speed-label"/);
  assert.match(section, /id="fusion-speed-value"/);
  assert.doesNotMatch(section, /data-fusion-speed=/);
  assert.doesNotMatch(section, /<select/);
  assert.match(section, /for="fusion-progress"/);
  assert.match(section, /id="fusion-progress"[^>]*type="range"/);
  assert.match(html, /id="fusion-original-formula"/);
  assert.match(html, /id="fusion-results"/);
});
