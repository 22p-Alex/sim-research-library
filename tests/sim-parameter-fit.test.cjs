/* Numerical and runtime invariants for the unified fit. No browser or layout QA. */
const test = require('node:test'), assert = require('node:assert/strict');
const E = require('../web/shared/sim-parameter-estimation.js');
const M = require('../web/parameter-demo/sim-parameter-model.js');
const L = require('../web/parameter-demo/sim-parameter-two-stage.js');
const Peak=require('../web/parameter-demo/scenes/get-peak/state.js');
const navPosition=require('./helpers/parameter-navigation.cjs').position;
const Chapter = require('../web/motion/sim-motion-parameter-chapter.js');
const boot = require('./helpers/motion-dom.cjs');
const near = (a, b, eps = 1e-10) => assert.ok(Math.abs(+a - b) <= eps * Math.max(1, Math.abs(b)), `${a} != ${b}`);
const visibleAlpha = node => { let alpha=1; for(let n=node;n;n=n.parent) { if(n.attrs.display==='none'||n.hidden)return 0; alpha *= Number(n.attrs.opacity ?? n.style.opacity ?? 1); } return alpha; };
const multiply = (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
const magnitude = z => Math.hypot(z.re, z.im);
const zOf = node => ({ re: +node.attrs['data-re'], im: +node.attrs['data-im'] });

test('the final getPeak playhead uses full spatial prefixes and reveals no fitted value before division', () => {
  const capture = E.capture({ m: .67, offsets: [-.72, .55, -.4] });
  capture.raw.groups[0].frames.forEach((frame, j) => frame.pixels.forEach((_, i) => { frame.pixels[i] += .002 * Math.sin(i * .37 + j * .81); }));
  const originals = capture.raw.groups[0].frames.map(frame => Array.from(frame.pixels));
  const lesson = M.createLesson({ raw: capture.raw, config: capture.config }), peak = lesson.estimate.finalPeak;
  Object.defineProperty(lesson.capture, 'truth', { get() { throw new Error('animation accessed generation truth'); } });
  assert.equal(peak.count, capture.config.n ** 2);
  assert.notEqual(peak.count, lesson.estimate.fit.count, 'spatial positions are not the old reliable frequency points');
  const sums = peak.product.re.reduce((s, re, i) => ({ re: s.re + re, im: s.im + peak.product.im[i], energy: s.energy + peak.energy[i] }), { re: 0, im: 0, energy: 0 });
  near(peak.alpha.re, sums.re / sums.energy); near(peak.alpha.im, sums.im / sums.energy);
  for (let i = 0; i <= 400; i++) {
    const p = i / 400, state = L.leastSquaresState(lesson, p);
    assert.deepEqual(state.k, [lesson.estimate.kx, lesson.estimate.ky]);
    assert.equal(state.total, peak.count); assert.deepEqual(state.sum, peak.sums[state.count]);
    assert.ok(state.count >= 0 && state.count <= peak.count);
    if (state.divide > 0) assert.equal(state.count, peak.count);
    if (!state.solved) assert.equal(state.alpha, null); else assert.deepEqual(state.alpha, peak.alpha);
    if (!state.read) { assert.equal(state.phase, null); assert.equal(state.m, null); }
    else { near(state.phase, peak.phase); near(state.m, peak.m); }
    assert.equal('trial' in state, false); assert.equal('residual' in state, false);
    assert.ok(state.panels.filter(alpha=>alpha>0).length<=2,'only adjacent panels may crossfade');
    near(state.panels.reduce((a,b)=>a+b,0),state.beat?1:state.body);
    if (state.overview > 0) assert.equal(state.cues.workSpectra,0,'native addresses unfold before prepared fields appear');
    if (state.shiftOutput > 0 || state.shiftScan > 0) near(state.shift, 1, 1e-12);
  }
  near(L.leastSquaresState(lesson, 1).phase, lesson.estimate.phase);
  assert.ok(peak.phase < -.7, 'negative observed phase remains negative');
  assert.deepEqual(capture.raw.groups[0].frames.map(frame => Array.from(frame.pixels)), originals);
});

test('parameter cards restore one actual +1 weight before returning it to U and expanding its row', () => {
  const h=boot(),flow=h.context.SIMMotionParameterChapter.plan(h.context.SIMMotion);
  assert.deepEqual(h.errors,[]);
  const get=(key,value)=>h.nodes.find(n=>value===undefined?n.attrs[key]!==undefined:n.attrs[key]===String(value));
  const sample=[];
  for(const scene of Chapter.adoptedScenes)for(const p of [0.000001,.12,.36,.50,.68,.84,1])sample.push([scene.id,p]);
  const saved=new Map();
  for(const [id,p] of [...sample,...sample.toReversed()]){
    h.byId.get('progress').value=flow.index(id)-1+p;h.byId.get('progress').dispatch('input');
    const s=Chapter.adoptedState(p,id);
    near(get('data-adopted-U').style.opacity,s.matrix);
    if(s.rows.some(v=>v>0)){assert.equal(s.dock,1);assert.equal(s.cards,0);}
    if(s.rowFocus>0)assert.deepEqual(s.rows,[1,1,1]);
    const pose=get('data-adopted-single').attrs.transform;
    if(id==='assemble-weights'&&p===1)assert.equal(pose,'translate(805 340)');
    const snapshot=[pose,get('data-adopted-cards').style.opacity,get('data-adopted-U').style.opacity];
    const key=id+':'+p;
    if(saved.has(key))assert.deepEqual(snapshot,saved.get(key));else saved.set(key,snapshot);
  }
  const restored=zOf(get('data-adopted-restored-weight'));
  const actual=get('data-adopted-inverse','1:1');near(restored.re,actual.attrs['data-re']);near(restored.im,actual.attrs['data-im']);
  assert.equal(get('data-adopted-matrix'),undefined,'the full M comparison belongs to the theory panel');
  for(const p of [.000001,.04,.15,.23,.30,.42]){
    h.byId.get('progress').value=flow.index('separate-bands')-1+p;h.byId.get('progress').dispatch('input');
    if(p>=.23&&p<.42)for(let j=0;j<3;j++)assert.equal(get('data-adopted-row-term',j).attrs.transform,`translate(${475+360*j} 265)`);
  }
  assert.deepEqual(h.errors,[]);
});

for (const page of ['sim_motion_demo.html', 'sim_parameter_demo.html']) test(`${page} keeps candidate shifts distinct from the locked fit on replay`, () => {
  let view;
  const h = boot({ page, renderer: page === 'sim_motion_demo.html' ? 'web/motion/sim-motion.js' : 'web/parameter-demo/sim-parameter-app.js',
    beforeRenderer(ctx) {
      const create = ctx.SIMParameterLesson.createView;
      ctx.SIMParameterLesson.createView = (...args) => (view = create(...args));
    } });
  const status = h.nodes.find(n => n.attrs['data-wavevector-status'] !== undefined);
  const footer = h.nodes.find(n => n.attrs['data-two-stage-footer'] !== undefined);
  assert.equal(footer.attrs.display,'none');
  const navigation=h.nodes.find(n=>n.attrs['data-parameter-navigation']!==undefined);
  assert.equal(navigation.attrs.display,'none');
  const samples = [
    ['shift', .9, false], ['otf', .6, false], ['match', .4, false], ['match', .8, false],
    ['coarse', .01, false], ['refine', .9, false], ['refine', 1, true],
    ['least-squares-fit', 0, true], ['least-squares-fit', 1, true],
  ];
  for (const [id, p, locked] of [...samples, ...samples.toReversed()]) {
    view.drawScene(id, p);
    assert.equal(status.attrs['data-locked'], String(locked));
    if (locked) assert.match(status.textContent, /−k̂.*位置锁定/);
    else {
      assert.doesNotMatch(status.textContent, /位置锁定|k̂/);
      assert.match(status.textContent, /k′/);
    }
  }
  for(const scene of L.scenes){
    view.drawScene(scene.id,.5);
    for(const node of h.nodes.filter(n=>n.attrs['data-scene-note']!==undefined)){assert.equal(node.attrs.display,'none');near(visibleAlpha(node),0);}
  }
  const live=h.nodes.find(n=>n.attrs['data-actor-owner']==='coefficient-ratio'&&n.attrs['data-math-actor']==='V');
  if(page==='sim_motion_demo.html'){
    const flow=h.context.SIMMotionParameterChapter.plan(h.context.SIMMotion);
    h.byId.get('progress').value=navPosition(flow,'coefficient-point',.5);h.byId.get('progress').dispatch('input');
  }else{
    const demo=h.context.SIMParameterDemo;
    demo.player.seek(navPosition(demo.preview,'coefficient-point',.5,false));
  }
  assert.ok(visibleAlpha(live)>0,'the retained observation term remains visible before the conjugate demonstration');
  // Continue the same caption's position into OTF preparation, including reverse.
  view.drawScene('shift', 1); const from = +footer.attrs.y;
  view.drawScene('otf', 0); near(footer.attrs.y, from);
  view.drawScene('otf', .06); assert.ok(+footer.attrs.y < from && +footer.attrs.y > 518);
  view.drawScene('otf', .12); near(footer.attrs.y, 518);
  view.drawScene('otf', 0); near(footer.attrs.y, from);
  assert.deepEqual(h.errors, []);
});
