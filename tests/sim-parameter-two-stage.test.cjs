/* Scientific/state checks for the production lesson. No browser or visual QA. */
const test = require('node:test'), assert = require('node:assert/strict');
const L = require('../web/parameter-demo/sim-parameter-two-stage.js');
const M = require('../web/parameter-demo/sim-parameter-model.js');
const E = require('../web/shared/sim-parameter-estimation.js');
const A = require('../web/atlas/sim-atlas-core.js');
const katex = require('../vendor/katex/katex.min.js');
const boot = require('./helpers/motion-dom.cjs');
const near = (a,b,eps=1e-9) => assert.ok(Number.isFinite(+a) && Math.abs(+a-b) <= eps*Math.max(1,Math.abs(b)), `${a} != ${b}`);
const mul = (a,b) => ({re:a.re*b.re-a.im*b.im,im:a.re*b.im+a.im*b.re});
const zOf = node => ({re:+node.attrs['data-re'],im:+node.attrs['data-im']});

test('the two stages define location before coefficient geometry and conjugation, with valid formulas at all stops', () => {
  assert.deepEqual(L.scenes.map(s=>s.id), ['shared','line-shift','shift','otf','match','coarse','refine','geometry','conjugate','fit','read']);
  assert.deepEqual(L.scenes.map(s=>s.phase), [...Array(7).fill('position'),...Array(4).fill('coefficient')]);
  for(const s of L.scenes) for(const p of [0,.15,.3,.35,.5,.7,1]) {
    const state=L.stateForScene(s.id,p), formula=L.formulaAt(state);
    assert.equal(state.id,s.id); near(state.progress,p);
    assert.doesNotThrow(()=>katex.renderToString(formula.equation.slice(2,-2),{displayMode:true,throwOnError:true,strict:'error'}));
  }
  for(const formula of Object.values(L.formulas)) assert.doesNotThrow(()=>katex.renderToString(formula.slice(2,-2),{displayMode:true,throwOnError:true,strict:'error'}));
  assert.throws(()=>L.stateForScene('shift',NaN),/有限/);
  assert.match(L.formulas.coordinates,/\\mathbf k'=\(k'_x,k'_y\)/);
  assert.match(L.formulas.coordinates,/\\mathbf q\+\\mathbf k'/);
  assert.match(L.formulas.shift,/H\(\\mathbf q\+\\mathbf k'\)/);
  for (const p of [.15,.2,.3,.39,.68,.8,1]) assert.match(L.formulaAt(L.stateForScene('shift',p)).equation,/\\mathbf k'/);
  for (const p of [.4,.5,.6,.67]) {
    const source=L.formulaAt(L.stateForScene('shift',p)).equation;
    assert.match(source,/S\(\\mathbf f-\\mathbf k\)/);
    assert.doesNotMatch(source,/\\mathbf k'/,'the physical source keeps the true unknown k');
  }
  assert.match(L.formulas.subpixel,/e\^\{-\\frac\{2\\pi i\}/);
});

test('matching is invariant to a common complex scale and equals minimized relative residual, not overlap area', () => {
  const capture=E.capture(), lesson=M.createLesson({raw:capture.raw,config:capture.config});
  Object.defineProperty(lesson.capture,'truth',{get(){throw new Error('The lesson read truth.');}});
  const d=L.dataFor(lesson);
  assert.equal(d,L.dataFor(lesson)); assert.equal(d.selected.length,3);
  assert.ok(d.examples[0].count>d.best.count); assert.ok(d.examples[0].score<d.best.score);
  for(const candidate of [...d.examples,d.compare(8.25,.25),d.compare(8.05,.05),d.compare(8.01,.01)]) {
    let residual=0;
    for(const p of candidate.points) {
      const prediction=mul(candidate.alpha,p.x);
      residual+=(p.y.re-prediction.re)**2+(p.y.im-prediction.im)**2;
    }
    near(residual/candidate.yy,1-candidate.score**2,1e-12);
    // Independently verify the completion of the square used in the lesson,
    // including coefficients away from the minimizer.
    for(const delta of [{re:.3,im:-.2},{re:-1,im:.7}]) {
      const alpha={re:candidate.alpha.re+delta.re,im:candidate.alpha.im+delta.im};
      const error=candidate.points.reduce((sum,p)=>{const prediction=mul(alpha,p.x);return sum+(p.y.re-prediction.re)**2+(p.y.im-prediction.im)**2;},0);
      near(error,residual+candidate.xx*(delta.re**2+delta.im**2),1e-12);
    }
    const independent=E.compare(lesson.estimate.context,candidate.kx,candidate.ky,true);
    near(candidate.score,independent.score); assert.equal(candidate.count,independent.count);
  }
  for(const p of d.selected) {
    assert.ok(d.examples.every(c=>c.points.some(t=>t.q.join(',')===p.q.join(','))));
    const prediction=mul(d.best.alpha,p.x); near(prediction.re,p.y.re); near(prediction.im,p.y.im);
  }
  const fit=L.transformState(lesson,1); near(fit.phase,lesson.estimate.phase); near(fit.m,lesson.estimate.m);
});

test('the geometric pool includes both weak paths, and q / q+k sample the same specimen coefficient in every direction', () => {
  const capture=E.capture(), n=capture.raw.n;
  for(let direction=0;direction<3;direction++) {
    const lesson=M.createLesson({raw:capture.raw,config:capture.config,direction}), d=L.dataFor(lesson), e=lesson.estimate;
    assert.deepEqual(d.support.reliable.map(p=>p.q.join(',')).sort(), d.best.points.map(p=>p.q.join(',')).sort());
    assert.equal(d.support.all.length,d.support.reliable.length+d.support.rejected.length);
    assert.ok(d.support.rejected.some(p=>p.h0<capture.config.minH && p.h1>=capture.config.minH));
    assert.ok(d.support.rejected.some(p=>p.h1<capture.config.minH && p.h0>=capture.config.minH));
    const independent=[];
    for(let y=-10;y<=10;y++)for(let x=-10;x<=10;x++)if(A.otf(x,y)>0 && A.otf(x+e.kx,y+e.ky)>0)independent.push([x,y].join(','));
    assert.deepEqual(d.support.all.map(p=>p.q.join(',')).sort(),independent.sort());
    const alpha={re:capture.truth.m*Math.cos(capture.truth.offsets[direction]),im:capture.truth.m*Math.sin(capture.truth.offsets[direction])};
    for(const p of d.selected) {
      const i=A.idx(...p.q,n), j=A.idx(p.q[0]+e.kx,p.q[1]+e.ky,n), specimen={re:capture.truth.spectrum.re[i],im:capture.truth.spectrum.im[i]};
      const side=mul(alpha,specimen), bands=e.context.separated.bands;
      near(bands[0].re[i]/p.h0,specimen.re);near(bands[0].im[i]/p.h0,specimen.im);
      near(bands[1].re[j]/p.h1,side.re);near(bands[1].im[j]/p.h1,side.im);
      // Derive the arrows from the real rotation matrix and compare to the
      // independently generated sideband, including nonzero phase offsets.
      const phi=capture.truth.offsets[direction], m=capture.truth.m;
      near(p.y.re,m*(Math.cos(phi)*p.x.re-Math.sin(phi)*p.x.im));
      near(p.y.im,m*(Math.sin(phi)*p.x.re+Math.cos(phi)*p.x.im));
      near(Math.hypot(p.y.re,p.y.im),m*Math.hypot(p.x.re,p.x.im));
    }
  }
});

test('left-side presentation, physical relocation, threshold exit and magnitude correction remain distinct and reversible', () => {
  let chapter;
  const h=boot({beforeRenderer(c){const create=c.SIMMotionParameterChapter.create;c.SIMMotionParameterChapter.create=o=>(chapter=create(o));}});
  const {nodes,byId,context}=h,flow=context.SIMMotionParameterChapter.plan(context.SIMMotion),d=context.SIMParameterLesson.dataFor(chapter.lesson);
  const seek=(id,p)=>{byId.get('progress').value=flow.index('parameters.'+id)-1+p;byId.get('progress').dispatch('input');};
  const panels=[0,1].map(b=>nodes.find(n=>n.attrs['data-band-panel']===String(b)));
  const markers=nodes.filter(n=>n.attrs['data-corresponding-point']!==undefined);
  const images=[0,1].map(b=>nodes.find(n=>n.attrs['data-shared-band']===String(b)));
  const position=node=>{const a=node.attrs.transform.match(/-?[\d.]+/g).map(Number),b=node.parent.attrs.transform.match(/-?[\d.]+/g).map(Number);return [b[0]+a[0]*b[2],b[1]+a[1]*b[2]];};
  seek('shift',.3);assert.ok(+panels[1].attrs['data-center-x']<+panels[0].attrs['data-center-x']);
  seek('shift',.65);
  near(panels[0].attrs['data-center-x'],panels[1].attrs['data-center-x']);
  near(panels[0].attrs['data-center-y'],panels[1].attrs['data-center-y']);
  const zero=[+panels[0].attrs['data-center-x'],+panels[0].attrs['data-center-y']];
  for(const p of [.68,.73,.85,1]) {
    seek('shift',p);near(panels[0].attrs['data-center-x'],zero[0]);near(panels[0].attrs['data-center-y'],zero[1]);
    near(+panels[1].attrs['data-center-x']-zero[0],-chapter.lesson.estimate.kx*13*L.returnTo2DState(p).relocate);
  }
  for(let j=0;j<3;j++) {
    const zero=markers.find(n=>n.attrs['data-corresponding-point']===j+':0'),side=markers.find(n=>n.attrs['data-corresponding-point']===j+':1');
    position(zero).forEach((x,i)=>near(x,position(side)[i]));
    for(const [b,marker] of [zero,side].entries()) {
      const local=marker.attrs.transform.match(/-?[\d.]+/g).map(Number),img=images[b];
      near(local[0],+img.attrs.x+(+marker.attrs['data-fx']+13.5)*+img.attrs.width/27);
      near(local[1],+img.attrs.y+(+marker.attrs['data-fy']+13.5)*+img.attrs.height/27);
    }
  }
  const rejected=nodes.filter(n=>n.attrs['data-rejected-q']!==undefined),planes=nodes.filter(n=>['P','Q','R'].includes(n.attrs['data-complex-plane']));
  assert.equal(rejected.length,d.support.rejected.length);assert.equal(nodes.filter(n=>n.attrs['data-sampling-link']!==undefined).length,0);
  const fixedPositions=new Map(),snapshots=new Map(),barSnapshots=new Map(),textures=images.map(n=>n.attrs.href);
  const samples=[.001,.05,.16,.24,.32,.4,.5,.53,.61,.70,.73,.81,.92,1];
  for(const p of [...samples,...samples.toReversed()]) {
    seek('otf',p);planes.forEach(n=>near(n.attrs.opacity,0));
    const snapshot=rejected.map(n=>[n.attrs.transform,n.attrs.opacity,n.attrs['data-exit-progress']]);
    if(snapshots.has(p))assert.deepEqual(snapshot,snapshots.get(p));else snapshots.set(p,snapshot);
    for(const node of rejected) {
      const xy=node.attrs.transform.match(/-?[\d.]+/g).slice(0,2);
      if(fixedPositions.has(node))assert.deepEqual(xy,fixedPositions.get(node));else fixedPositions.set(node,xy);
    }
    assert.deepEqual(images.map(n=>n.attrs.href),textures);
    if(p<.1)rejected.forEach(n=>near(n.attrs.opacity,1));
    if(p>=.4)rejected.forEach(n=>near(n.attrs.opacity,0));
    if(p<.5)near(L.stateForScene('otf',p).correction,0);
    const correction=L.otfState(p).correctionByBand;
    if(p<=.53)assert.deepEqual(correction,[0,0]);
    if(p===.61)assert.ok(correction[0]>0 && correction[0]<1 && correction[1]===0);
    if(p===.70)assert.deepEqual(correction,[1,0]);
    if(p===.81)assert.ok(correction[0]===1 && correction[1]>0 && correction[1]<1);
    if(p>=.92)assert.deepEqual(correction,[1,1]);
    const barState=[];
    d.selected.forEach((point,i)=>[0,1].forEach(b=>{
      const bar=nodes.find(n=>n.attrs['data-otf-magnitude']===['P','Q','R'][i]+':'+b), value=b?point.y:point.x, otf=b?point.h1:point.h0;
      const original=nodes.find(n=>n.attrs['data-otf-original']===['P','Q','R'][i]+':'+b);
      const beforeValue=nodes.find(n=>n.attrs['data-otf-before-value']===['P','Q','R'][i]+':'+b);
      const afterValue=nodes.find(n=>n.attrs['data-otf-after-value']===['P','Q','R'][i]+':'+b);
      const operation=nodes.find(n=>n.attrs['data-otf-operation']===['P','Q','R'][i]+':'+b);
      const restored=nodes.find(n=>n.attrs['data-otf-restored']===['P','Q','R'][i]+':'+b);
      const gain=otf+(1-otf)*correction[b];
      near(zOf(bar).re,value.re*gain);near(zOf(bar).im,value.im*gain);
      const correctedMagnitude=Math.hypot(value.re,value.im), originalMagnitude=correctedMagnitude*otf;
      near(original.attrs['data-magnitude'],originalMagnitude);
      near(bar.attrs['data-original-magnitude'],originalMagnitude);
      near(bar.attrs['data-corrected-magnitude'],correctedMagnitude);
      near(+bar.attrs.width / +original.attrs.width,gain/otf);
      near(bar.attrs['data-gain'],gain/otf);
      near(restored.attrs.width,+bar.attrs.width-+original.attrs.width);
      const normalization=chapter.lesson.capture.config.n**2;
      near(beforeValue.textContent,originalMagnitude/normalization,.5e-5);
      near(afterValue.textContent,correctedMagnitude*gain/normalization,.5e-5);
      const displayed=operation.textContent.match(/÷ ([\d.]+) · 当前 ×([\d.]+)/);
      assert.ok(displayed);near(displayed[1],otf,.0005);near(displayed[2],gain/otf,.005);
      barState.push([original.attrs.width,bar.attrs.width,beforeValue.textContent,afterValue.textContent,operation.textContent,restored.attrs.width]);
    }));
    if(barSnapshots.has(p))assert.deepEqual(barState,barSnapshots.get(p));else barSnapshots.set(p,barState);
  }
  seek('match',.3);planes.forEach(n=>near(n.attrs.opacity,1));
  assert.deepEqual(h.errors,[]);
});

test('one q stays fixed while the formula finds q+k and only the sideband relocates by minus k', () => {
  let chapter;
  const h=boot({beforeRenderer(c){const create=c.SIMMotionParameterChapter.create;c.SIMMotionParameterChapter.create=o=>(chapter=create(o));}});
  const {context,byId,nodes}=h, flow=context.SIMMotionParameterChapter.plan(context.SIMMotion);
  const chapterModel=context.SIMMotionParameterChapter;
  const seek=p=>{byId.get('progress').value=flow.index('parameters.shared')-1+(chapterModel.sharedEntryDuration+p*L.scene('shared').duration)/chapterModel.sharedDuration;byId.get('progress').dispatch('input');};
  const markers=nodes.filter(n=>n.attrs['data-corresponding-point']!==undefined), regions=nodes.filter(n=>n.attrs['data-common-region']!==undefined);
  const position=n=>{const a=n.attrs.transform.match(/-?[\d.]+/g).map(Number),b=n.parent.attrs.transform.match(/-?[\d.]+/g).map(Number);return [b[0]+a[0]*b[2],b[1]+a[1]*b[2]];};
  const zero=markers.find(n=>n.attrs['data-corresponding-point']==='0:0'),side=markers.find(n=>n.attrs['data-corresponding-point']==='0:1');
  seek(.12);near(zero.attrs.opacity,1);near(side.attrs.opacity,0);
  const zeroPosition=position(zero), snapshots=new Map();
  seek(.22);
  const from=nodes.find(n=>n.attrs['data-formula-part']==='k-move-from'),to=nodes.find(n=>n.attrs['data-formula-part']==='k-move-to');
  const initial=from.style.transform;
  seek(.29); assert.notEqual(from.style.transform,initial); assert.ok(+to.style.opacity>.9);
  seek(.36);near(side.attrs.opacity,1);
  const cursor=nodes.find(n=>n.attrs['data-q-address-cursor']!==undefined),track=nodes.find(n=>n.attrs['data-q-relocation-track']!==undefined);
  for(const p of [.18,.22,.26,.30,.36,.45,.50,.54,.60,.68,.72,.78,.85,.94,1]) {
    seek(p);
    const state=L.sharedPointState(chapter.lesson,p);
    position(zero).forEach((v,i)=>near(v,zeroPosition[i]));
    for(const [b,marker] of [zero,side].entries())position(marker).forEach((v,i)=>near(v,state.markerPositions[b][i]));
    near(cursor.attrs['data-fx'],state.cursor[0]);near(cursor.attrs['data-fy'],state.cursor[1]);
    near(track.attrs['data-motion-progress'],state.relocate);
    if(p<.78) {
      near(to.attrs['data-motion-progress'],state.derive);
      const plus=nodes.find(n=>n.attrs['data-formula-part']==='k-cancel-plus');near(plus.attrs['data-cancel-progress'],state.cancel);
    }
    snapshots.set(p,[position(zero),position(side),zero.attrs.opacity,side.attrs.opacity,cursor.attrs.transform,track.attrs.d,byId.get('equation').attrs['data-formula-mode']]);
  }
  for(const p of [...snapshots.keys()].toReversed()) {
    seek(p);assert.deepEqual([position(zero),position(side),zero.attrs.opacity,side.attrs.opacity,cursor.attrs.transform,track.attrs.d,byId.get('equation').attrs['data-formula-mode']],snapshots.get(p));
  }
  seek(.72);
  for(let j=0;j<3;j++) {
    const zero=markers.find(n=>n.attrs['data-corresponding-point']===j+':0'),side=markers.find(n=>n.attrs['data-corresponding-point']===j+':1');
    position(zero).forEach((v,i)=>near(v,position(side)[i]));
    near(zero.attrs.opacity,j===0?1:0);near(side.attrs.opacity,j===0?1:0);
  }
  const plus=nodes.find(n=>n.attrs['data-formula-part']==='k-cancel-plus');near(plus.attrs['data-cancel-progress'],1);
  seek(.94);regions.forEach(n=>near(n.attrs.opacity,1));
  seek(1);markers.forEach(n=>near(n.attrs.opacity,1));
  for(let j=0;j<3;j++) {
    const a=markers.find(n=>n.attrs['data-corresponding-point']===j+':0'),b=markers.find(n=>n.attrs['data-corresponding-point']===j+':1');
    near(+b.attrs['data-fx']-a.attrs['data-fx'],chapter.lesson.estimate.kx);
    near(+b.attrs['data-fy']-a.attrs['data-fy'],chapter.lesson.estimate.ky);
  }
  assert.deepEqual(h.errors,[]);
});

test('the tracked q has equal physical addresses after relocation for all directions without changing complex values', () => {
  const capture=E.capture();
  for(let direction=0;direction<3;direction++) {
    const lesson=M.createLesson({raw:capture.raw,config:capture.config,direction}),saved=lesson.estimate.context.separated.bands.map(z=>[...z.re,...z.im]);
    const before=L.sharedPointState(lesson,.5),after=L.sharedPointState(lesson,.7);
    assert.deepEqual(before.centers[0],before.centers[1],'shared origins precede the physical shift');
    before.markerPositions[0].forEach((v,i)=>near(before.markerPositions[1][i]-v,before.k[i]*before.unit));
    after.markerPositions[0].forEach((v,i)=>near(v,after.markerPositions[1][i]));
    for(let i=0;i<=100;i++) {
      const s=L.sharedPointState(lesson,i/100);
      assert.deepEqual(s.centers[0],[900,375]);
      if(s.relocate>0)assert.equal(s.arrange,1);
      if(s.region>0)assert.equal(s.relocate,1);
      if(s.separate>0)assert.equal(s.region,1);
      if(s.found>0)assert.equal(s.derive,1);
    }
    assert.deepEqual(lesson.estimate.context.separated.bands.map(z=>[...z.re,...z.im]),saved);
  }
});

test('the real teaching example returns to the same two-dimensional data before relocation begins', () => {
  const h=boot(), {context,byId,nodes}=h, flow=context.SIMMotionParameterChapter.plan(context.SIMMotion);
  const seek=(id,p)=>{byId.get('progress').value=flow.index('parameters.'+id)-1+p;byId.get('progress').dispatch('input');};
  const real=nodes.find(n=>n.attrs['data-line-scene']==='line-shift');
  assert.equal(flow.index('parameters.line-complex'),-1);
  assert.ok(!nodes.some(n=>n.attrs['data-teaching-row']!==undefined || n.attrs['data-line-scene']==='line-complex'));
  const expected=M.createTeachingExample(), samples=[.21,.29,.39,.49,.59,.69,.79,.89,1], states=new Map();
  for(const p of [...samples,...samples.toReversed()]) {
    seek('line-shift',p);
    const candidate=+real.attrs['data-candidate'],count=+real.attrs['data-products'];
    near(real.attrs['data-partial'],expected.real[candidate].products.slice(0,count).reduce((a,b)=>a+b,0));
    const state={...real.attrs};if(states.has(p))assert.deepEqual(state,states.get(p));else states.set(p,state);
  }
  seek('line-shift',1);near(real.attrs['data-shift'],2);near(real.attrs['data-partial'],21);
  const pictures=nodes.filter(n=>n.attrs['data-shared-band']!==undefined),regions=nodes.filter(n=>n.attrs['data-common-region']!==undefined);
  const markers=nodes.filter(n=>n.attrs['data-corresponding-point']!==undefined),pair=nodes.find(n=>n.attrs['data-frequency-pair']!==undefined);
  seek('shared',1);
  const textures=pictures.map(n=>n.attrs.href),poses=pictures.map(n=>n.parent.attrs.transform);
  const frequencies=markers.map(n=>[n.attrs['data-fx'],n.attrs['data-fy']]);
  seek('shift',0);near(real.attrs.opacity,1);near(real.attrs['data-partial'],21);near(pair.attrs.opacity,0);
  seek('shift',.3);near(real.attrs.opacity,0);near(pair.attrs.opacity,1);
  assert.deepEqual(pictures.map(n=>n.parent.attrs.transform),poses,'restore the actual pair before moving it');
  regions.forEach(n=>near(n.attrs.opacity,1));markers.forEach(n=>near(n.attrs.opacity,1));
  const previous=new Map();
  for(const p of [.01,.1,.2,.3,.4,.65,.9,1,1,.9,.65,.4,.3,.2,.1,.01]) {
    seek('shift',p);
    const t=L.returnTo2DState(p);
    assert.ok(!t.relocate || t.actual===1,'the actual data arrives before relocation');
    near(real.attrs['data-partial'],21);assert.deepEqual(pictures.map(n=>n.attrs.href),textures);
    assert.deepEqual(markers.map(n=>[n.attrs['data-fx'],n.attrs['data-fy']]),frequencies,'toy shift 2 never changes the actual frequency addresses');
    const snapshot=[pair.attrs.opacity,real.attrs.opacity,pictures.map(n=>n.parent.attrs.transform),byId.get('equation').attrs['data-formula-mode']];
    if(previous.has(p))assert.deepEqual(snapshot,previous.get(p));else previous.set(p,snapshot);
  }
  seek('shared',1);near(real.attrs.opacity,0);
  assert.deepEqual(h.errors,[]);
});

test('production graphics use the shifted OTF, actual masks and values, and preserve the same points through both stages', () => {
  let chapter;
  const h=boot({beforeRenderer(ctx){const create=ctx.SIMMotionParameterChapter.create;ctx.SIMMotionParameterChapter.create=(o)=>(chapter=create(o));}});
  assert.deepEqual(h.errors,[]);
  const {nodes,byId,context}=h, flow=context.SIMMotionParameterChapter.plan(context.SIMMotion), lesson=chapter.lesson;
  const d=context.SIMParameterLesson.dataFor(lesson), e=lesson.estimate;
  const get=(attr,value)=>nodes.find(n=>value===undefined ? n.attrs[attr]!==undefined : n.attrs[attr]===value);
  const seek=(id,p=1)=>{byId.get('progress').value=flow.index('parameters.'+id)-1+p;byId.get('progress').dispatch('input');};
  const right=get('data-candidate-panel'), pair=get('data-frequency-pair'), map=get('data-frequency-map');
  const u=()=>['P','Q','R'].map(n=>get('data-vector-u',n)), v=()=>['P','Q','R'].map(n=>get('data-vector-v',n));
  seek('shift');
  const current=E.compare(e.context,+right.attrs['data-kx'],+right.attrs['data-ky'],true);
  const otfs=nodes.filter(n=>n.attrs['data-otf-band']!==undefined);
  const centers=otfs.map(n=>{
    const c=n.children.find(c=>c.tagName==='circle'), transform=n.parent.attrs.transform.match(/-?[\d.]+/g).map(Number);
    return [+c.attrs.cx*transform[2]+transform[0],+c.attrs.cy*transform[2]+transform[1]];
  });
  near(centers[1][0]-centers[0][0],-current.kx*13); near(centers[1][1]-centers[0][1],-current.ky*13);
  const imageURLs=nodes.filter(n=>n.attrs['data-shared-band']!==undefined).map(n=>n.attrs.href);
  seek('otf',.25);
  d.selected.forEach((p,i)=>{
    const actual=current.points.find(t=>t.q.join(',')===p.q.join(','));
    near(zOf(u()[i]).re,actual.x.re*actual.h0); near(zOf(v()[i]).im,actual.y.im*actual.h1);
  });
  seek('otf');
  d.selected.forEach((p,i)=>{
    const actual=current.points.find(t=>t.q.join(',')===p.q.join(','));
    near(zOf(u()[i]).re,actual.x.re); near(zOf(v()[i]).im,actual.y.im);
  });
  const mask=get('data-overlap-mask');
  const activeMask=()=>mask.children.filter(n=>+n.attrs.opacity>0).map(n=>n.attrs['data-q']).sort();
  assert.deepEqual(activeMask(),current.points.map(p=>p.q.join(',')).sort());
  for(const id of ['match','coarse','refine'])for(const p of [.31,.53,.79,1]) {
    seek(id,p);
    const c=E.compare(e.context,+right.attrs['data-kx'],+right.attrs['data-ky'],true);
    near(right.attrs['data-score'],c.score); near(right.attrs['data-count'],c.count);
    assert.deepEqual(activeMask(),c.points.map(p=>p.q.join(',')).sort());
  }
  // The correction illustration holds the same candidate until it exits;
  // only then can the map and values switch to the actual candidate search.
  seek('otf',1);
  const prepared=[right.attrs['data-kx'],right.attrs['data-ky'],right.attrs['data-score'],activeMask()];
  const preparedBars=nodes.filter(n=>n.attrs['data-otf-magnitude']!==undefined).map(n=>[n.attrs.width,n.attrs['data-re'],n.attrs['data-im']]);
  for(const p of [.001,.05,.119]) {
    seek('match',p);
    assert.deepEqual([right.attrs['data-kx'],right.attrs['data-ky'],right.attrs['data-score'],activeMask()],prepared);
    assert.deepEqual(nodes.filter(n=>n.attrs['data-otf-magnitude']!==undefined).map(n=>[n.attrs.width,n.attrs['data-re'],n.attrs['data-im']]),preparedBars);
    assert.equal(byId.get('equation').attrs['data-formula-mode'],'match-prepare');
  }
  // The actual full story has zero common phase: a visible trial still returns
  // to that fitted value instead of inventing a nonzero acquisition phase.
  near(e.phase,0); seek('geometry',.32);
  const trial=context.SIMParameterLesson.transformState(lesson,.32); assert.ok(Math.abs(trial.phase)>.5);
  d.selected.forEach((p,i)=>{
    const expected=mul(p.x,{re:Math.cos(trial.phase),im:Math.sin(trial.phase)}), node=get('data-vector-prediction',['P','Q','R'][i]);
    near(zOf(node).re,expected.re); near(zOf(node).im,expected.im);
  });
  seek('geometry');
  const frozenMap=map.attrs.transform, frozenPair=pair.attrs.transform;
  d.selected.forEach((p,i)=>{const node=get('data-vector-prediction',['P','Q','R'][i]);near(zOf(node).re,p.y.re);near(zOf(node).im,p.y.im);});
  seek('conjugate');
  d.selected.forEach((p,i)=>{
    const node=get('data-vector-product',['P','Q','R'][i]);
    near(zOf(node).re,p.x.re*p.y.re+p.x.im*p.y.im);near(zOf(node).im,p.x.re*p.y.im-p.x.im*p.y.re);
  });
  for(const id of ['conjugate','fit','read']) {
    seek(id); assert.equal(map.attrs.transform,frozenMap);assert.equal(pair.attrs.transform,frozenPair);
  }
  assert.deepEqual(nodes.filter(n=>n.attrs['data-shared-band']!==undefined).map(n=>n.attrs.href),imageURLs);
  const fitting=get('data-fitting'), ratio=get('data-study-ratio');
  for(const p of [.2,.45,.60,.75,1]) {
    seek('fit',p); const count=+fitting.attrs['data-count'], points=d.best.points.slice(0,count);
    near(fitting.attrs['data-sum-re'],points.reduce((s,p)=>s+p.cross.re,0));
    near(fitting.attrs['data-energy'],points.reduce((s,p)=>s+p.energy,0));
    if(+fitting.attrs['data-divide']>0)assert.equal(count,d.best.count);
  }
  near(zOf(ratio).re,d.best.alpha.re);near(zOf(ratio).im,d.best.alpha.im);
  seek('fit');const ratioPath=ratio.attrs.d;seek('read',.001);assert.equal(ratio.attrs.d,ratioPath);
  seek('read');const light=get('data-illumination-preview');near(light.attrs['data-phase'],e.phase);near(light.attrs['data-modulation'],e.m);
  // The shortened illumination bridge hides the spectra. The next estimation
  // scene restores their full scale when they become visible again.
  byId.get('progress').value=flow.index('provisional-split');byId.get('progress').dispatch('input');
  near(byId.get('frequency-handoff-stage').style.opacity,0);
  seek('shared',.001);
  assert.equal(pair.attrs.transform,'translate(0 0) scale(1)');
  for(const n of nodes.filter(n=>n.attrs['data-shared-band']!==undefined))near(n.attrs.opacity,1);
});

test('every meaningful intermediate state is reversible and formula terms use the same playhead', () => {
  const h=boot(), {context,byId,nodes}=h, flow=context.SIMMotionParameterChapter.plan(context.SIMMotion);
  const seek=(id,p)=>{byId.get('progress').value=flow.index('parameters.'+id)-1+p;byId.get('progress').dispatch('input');};
  const tracked=nodes.filter(n=>['data-frequency-map','data-frequency-pair','data-candidate-panel','data-vector-u','data-vector-v','data-vector-prediction','data-vector-product','data-fitting','data-study-ratio','data-rejected-q','data-otf-magnitude','data-otf-correction'].some(k=>n.attrs[k]!==undefined));
  const snapshots=new Map(), positions=L.scenes.flatMap(s=>[.001,.19,.34,.52,.76,1].map(p=>[s.id,p]));
  for(const [id,p] of [...positions,...positions.toReversed()]) {
    seek(id,p); const key=id+':'+p;
    const state=tracked.map(n=>Object.fromEntries(Object.entries(n.attrs).filter(([k])=>k==='d'||k==='opacity'||k==='transform'||k.startsWith('data-'))));
    if(snapshots.has(key))assert.deepEqual(state,snapshots.get(key));else snapshots.set(key,state);
  }
  seek('geometry',.22);const formula=byId.get('equation').children[0], count=h.mathRenders;
  seek('geometry',.73);assert.equal(byId.get('equation').children[0],formula);assert.equal(h.mathRenders,count);
  assert.equal(nodes.find(n=>n.attrs['data-formula-part']==='scaling').attrs['data-emphasized'],'true');
  h.windowEvents.pagehide.forEach(f=>f());assert.equal(byId.get('parameter-stage').children.length,0);assert.equal(byId.get('frequency-handoff-stage').children.length,0);
});
