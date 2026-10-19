/* Semantic and numerical handoffs only; this fixture never opens a browser. */
const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../web/atlas/sim-atlas-core.js'),E=require('../web/shared/sim-parameter-estimation.js');
const Story=require('../web/parameter-demo/sim-parameter-model.js');
const Lesson=require('../web/parameter-demo/sim-parameter-two-stage.js');
const Peak=require('../web/parameter-demo/scenes/get-peak/state.js');
const boot=require('./helpers/motion-dom.cjs'),{position}=require('./helpers/parameter-navigation.cjs');
const near=(a,b,tol=1e-9)=>assert.ok(Number.isFinite(+a)&&Math.abs(+a-b)<tol,`${a} != ${b}`);
const visible=n=>{let a=1;for(;n;n=n.parent){if(n.hidden||n.attrs.display==='none')return 0;a*=Number(n.attrs.opacity??n.style.opacity??1);}return a;};

test('the alpha entry uses paired observed frequencies and retains the fully locked result for 1.5 seconds',()=>{
  assert.equal(Peak.timeline.beats.slice(0,5).reduce((s,b)=>s+b.duration,0),60000);
  for(const phase of [0,.35,-.72]) {
    const cap=E.capture({m:.67,offsets:[phase,.55,-.4]}),lesson=Story.createLesson({raw:cap.raw,config:cap.config});
    const data=Peak.dataFor(lesson),p=data.peak,q=data.frequencyPoint.q,i=A.idx(...q,p.n),j=A.idx(q[0]+p.kx,q[1]+p.ky,p.n);
    assert.equal(p.masks[0][i],1);assert.equal(p.masks[1][j],1);
    assert.ok(Math.abs(data.frequencyPoint.h0-data.frequencyPoint.h1)>.01);
    near(data.frequencyPoint.x.re,p.prepared[0].re[i]);near(data.frequencyPoint.y.im,p.prepared[1].im[j]);
    for(const sample of data.samples) {
      assert.ok(p.energy[sample]>1e-12);
      const re=p.spatial[0].re[sample],im=p.spatial[0].im[sample];
      near(p.shifted.re[sample],.67*(Math.cos(phase)*re-Math.sin(phase)*im));
      near(p.shifted.im[sample],.67*(Math.sin(phase)*re+Math.cos(phase)*im));
    }
    const lock=Lesson.scene('refine'),hold=lock.lockTimeline.beats.find(b=>b.key==='holdWinner');
    near(hold.duration,1500);
    for(const local of [0,.5,.999]) {
      const p=lock.lockStart+(1-lock.lockStart)*lock.lockTimeline.progressFor(hold.key,local);
      const s=Lesson.refinementState(lesson,p);
      near(s.lock,1);near(s.lockTransfer,0);near(s.returnView.collapse,0);assert.equal(s.count,25);
      near(Lesson.formulaTransition(Lesson.stateForScene('refine',p)).incoming,1);
      near(s.candidate.kx,lesson.estimate.kx);near(s.candidate.ky,lesson.estimate.ky);
    }
  }
});

for(const main of [true,false])test(`${main?'motion':'standalone'} preserves source identity, sample and scale through alpha entry and conjugation`,()=>{
  let lesson;
  const h=boot({page:main?'sim_motion_demo.html':'sim_parameter_demo.html',renderer:main?'web/motion/sim-motion.js':'web/parameter-demo/sim-parameter-app.js',
    beforeRenderer(ctx){const create=ctx.SIMParameterLesson.createView;ctx.SIMParameterLesson.createView=(container,data,options)=>{lesson=data;return create(container,data,options);};}});
  assert.deepEqual(h.errors,[]);
  const flow=main?h.context.SIMMotionParameterChapter.plan(h.context.SIMMotion):h.context.SIMParameterDemo.preview;
  const seek=(id,p)=>{const value=position(flow,id,p,main);if(main){h.byId.get('progress').value=value;h.byId.get('progress').dispatch('input');}else h.context.SIMParameterDemo.player.seek(value);};
  const beat=(key,p)=>seek('least-squares-fit',Peak.timeline.progressFor(key,p));
  const get=(key,value)=>h.nodes.find(n=>value===undefined?n.attrs[key]!==undefined:n.attrs[key]===String(value));
  const lock=get('data-locked-wavevector'),originals=h.nodes.filter(n=>n.attrs['data-shared-band']!==undefined);
  seek('refine',1);const lockedPose=lock.attrs.transform;
  for(const p of [0,.1,.2,.4,.7,.88,1]) {
    beat('finalPrepare',p);near(visible(lock),1);assert.equal(lock.attrs.transform,lockedPose);
    const prepared=get('data-get-peak-field','prepared-0');
    assert.ok(visible(originals[0])+visible(prepared)>.4,'the source-to-work handoff cannot leave an empty body');
    assert.deepEqual(h.nodes.filter(n=>n.attrs['data-shared-band']!==undefined),originals);
  }
  beat('finalPrepare',.7);
  for(const b of [0,1]) {
    const marker=get('data-get-peak-frequency-point',b),q=Peak.dataFor(lesson).frequencyPoint.q,p=lesson.estimate.finalPeak;
    assert.equal(marker.attrs['data-address'],[q[0]+b*p.kx,q[1]+b*p.ky].join(','));
  }
  beat('finalInverse',1);near(visible(get('data-get-peak-frequency-point',0)),0);
  // The positive extra factor is derived before any reverse rotation is taught.
  for(const local of [.15,.4,.6,.9,.6,.4,.15]) {
    beat('finalInverse',local);
    const shown=Peak.presentation(Peak.timeline.progressFor('finalInverse',local));
    assert.doesNotMatch(shown.formula.equation,/e\^\{-/);
    near(visible(get('data-get-peak-alpha-illustration')),0);
    if(local<.32)assert.doesNotMatch(shown.formula.equation,/delta/);
    if(local>.78){
      near(visible(get('data-get-peak-kernel','combined')),0);
      near(visible(get('data-get-peak-kernel','extra')),1);
      near(visible(get('data-get-peak-kernel','reference')),1);
    }
  }
  beat('finalShift',.8);
  const p=lesson.estimate.finalPeak,i=Peak.dataFor(lesson).sampleIndex,ramp=get('data-get-peak-ramp-vector');
  near(Math.hypot(+ramp.attrs['data-re'],+ramp.attrs['data-im']),Math.hypot(p.spatial[1].re[i],p.spatial[1].im[i]));
  near(get('data-get-peak-ramp-color',0).attrs['data-brightness'],+get('data-get-peak-ramp-color',1).attrs['data-brightness']);
  assert.notEqual(get('data-get-peak-ramp-color',0).attrs['data-hue'],get('data-get-peak-ramp-color',1).attrs['data-hue']);
  const pointwise=get('data-get-peak-pointwise'),pointwiseStates=new Map();
  const operationSnapshot=()=>h.nodes.filter(n=>Object.keys(n.attrs).some(k=>k.startsWith('data-get-peak-point')||k.startsWith('data-get-peak-cursor')))
    .map(n=>({...n.attrs}));
  assert.equal(get('data-get-peak-field','shift-factor'),undefined,'the angle map does not compete with the main operation');
  for(const local of [.2,.3,.54,.7,.94,.999,.7,.54,.3,.2]) {
    beat('finalShiftScan',local);
    const operation=Peak.state(lesson,Peak.timeline.progressFor('finalShiftScan',local)).pointwise;
    near(visible(pointwise),1);near(visible(get('data-get-peak-field','shift-reference')),0);
    for(const name of ['shift-input','shift-output']) {
      assert.equal(get('data-get-peak-cursor',name).attrs['data-index'],String(operation.index));
      near(visible(get('data-get-peak-field',name)),1);
    }
    assert.equal(+get('data-get-peak-shift-prefix').attrs['data-count'],operation.count);
    if(local<.25)assert.equal(operation.count,0);
    near(operation.output.re,p.shifted.re[operation.index]);near(operation.output.im,p.shifted.im[operation.index]);
    near(get('data-get-peak-point-write').attrs.opacity,operation.write);
    const snapshot=operationSnapshot();
    if(pointwiseStates.has(local))assert.deepEqual(snapshot,pointwiseStates.get(local));else pointwiseStates.set(local,snapshot);
  }
  beat('finalCompare',1);
  near(visible(pointwise),0);near(visible(get('data-get-peak-field','shift-reference')),1);
  const u=get('data-get-peak-compare-u'),v=get('data-get-peak-compare-v'),plane=get('data-get-peak-comparison-detail');
  near(u.attrs['data-scale'],v.attrs['data-scale']);
  const snapshot=()=>[plane.attrs.transform,plane.attrs['data-sample'],u.attrs.d,v.attrs.d,u.attrs['data-scale'],v.attrs['data-scale']];
  const carried=snapshot();
  beat('finalProduct',0);assert.deepEqual(snapshot(),carried,'same vectors and sample enter the conjugation scene');
  beat('finalProduct',.17);near(visible(lock)>0,1);near(Peak.state(lesson,Peak.timeline.progressFor('finalProduct',.17)).conjugate,0);
  beat('finalProduct',.55);near(visible(lock),0);near(u.attrs['data-im'],-p.spatial[0].im[i]);
  beat('finalCompare',1);assert.deepEqual(snapshot(),carried,'backward seeking restores the original two observations');
  const endpoints=[...[3,8,10.7,11.6,12.8,15.8,18.6,20.5].map(seconds=>['finalPrepare',seconds/21]),['finalInverse',.5],['finalShiftScan',.5],['finalCompare',.5],['finalProduct',.4],['finalSum',.3]];
  const states=new Map();
  for(const [key,t] of [...endpoints,...endpoints.toReversed()]) {
    beat(key,t);
    const expected=Peak.presentation(Peak.timeline.progressFor(key,t));
    assert.equal(h.byId.get(main?'scene-title':'pe-title').textContent,expected.title);
    assert.equal(h.byId.get(main?'equation-note':'pe-note').textContent,expected.note);
    // Formula nodes are cached lazily and remain detached after replacement.
    // Compare persistent actors plus the currently mounted formula, not that cache.
    const current=h.nodes.filter(n=>n.attrs['data-get-peak-formula-beat']===undefined&&Object.keys(n.attrs).some(k=>k.startsWith('data-get-peak'))).map(n=>({...n.attrs}));
    const equation=h.byId.get(main?'equation':'pe-equation');
    assert.equal(equation.children[0].attrs['data-get-peak-formula-beat'],expected.formula.mode);
    current.push({...equation.children[0].attrs});
    for(const attrs of current)for(const value of Object.values(attrs))assert.doesNotMatch(value,/NaN|Infinity|undefined/);
    const name=key+':'+t;if(states.has(name))assert.deepEqual(current,states.get(name));else states.set(name,current);
  }
  beat('finalRead',.5);
  near(lesson.estimate.phase,main?0:.35);
  if(main)assert.ok(h.nodes.some(n=>n.textContent==='本例共同相位 φ̂Δ ≈ 0 rad'));
  beat('finalPrepare',19.2/21);
  const data=Peak.dataFor(lesson),key=get('data-get-peak-color-key'),color=Peak.displayColor(data.displaySample.re,data.displaySample.im,data.displayScales.prepared[0]);
  assert.equal(key.attrs['data-actual'],'true');near(key.attrs['data-brightness'],color.brightness);
  assert.equal(get('data-get-peak-color-tile').attrs['data-rgb'],color.rgb.join(','));
  const colorField=get('data-get-peak-color-field',0),raster=h.nodes[Number(colorField.attrs.href.match(/fixture(\d+)/)[1])];
  const q=data.frequencyPoint.q,side=2*Math.ceil(lesson.estimate.context.config.cutoff)+7,index=((q[1]+(side-1)/2)*side+q[0]+(side-1)/2)*4;
  assert.deepEqual(Array.from(raster.lastPixels.slice(index,index+3)),color.rgb,'the legend and actual frequency pixel use the same mapping');
  beat('finalPrepare',8/21);
  const formula=h.byId.get(main?'equation':'pe-equation').children[0];
  const separator=formula.children.find(n=>n.attrs.class==='pe-peak-formula-separator');
  assert.ok(separator);assert.equal(separator.attrs['data-emphasized'],undefined);
  assert.ok(!formula.children.find(n=>n.attrs['data-formula-part']==='get-peak-side').innerHTML.includes('<mo>,</mo>'));
  for(const b of [0,1]){
    const symbol=get('data-get-peak-sample-symbol',b);
    near(+symbol.attrs.x + +symbol.attrs.width/2,[370,1070][b]);
    assert.ok(+get('data-get-peak-otf-label',b).attrs.y>+get('data-get-peak-address-label',b).attrs.y+20);
  }
  // All three alpha explanations share one mounted equation, including at
  // their exact boundaries. Only factors move; the host must not fade it out.
  beat('finalCompare',.32);
  const equation=h.byId.get(main?'equation':'pe-equation'),alpha=equation.children[0];
  const row=alpha.children[0],detail=alpha.children[1];
  const token=name=>row.children.find(n=>n.attrs['data-formula-part']==='get-peak-alpha-'+name);
  assert.equal(alpha.children.length,2);assert.equal(detail.children.length,3);
  assert.ok(!row.children.some(n=>n.attrs.class==='pe-peak-formula-separator'));
  assert.ok(detail.children.every(n=>!n.innerHTML.includes('<mo>,</mo>')));
  const renders=h.mathRenders;
  const formulaSnapshot=()=>[...row.children,...detail.children].map(n=>[n.attrs['aria-hidden'],n.attrs['data-emphasized'],n.style.opacity,n.style.transform]);
  const formulaStates=new Map(),checkpoints=[.24,.32,.35999,.36,.36001,.38,.4,.46,.54,.56,.60,.68,.72];
  for(const local of [...checkpoints,...checkpoints.toReversed()]) {
    beat('finalCompare',local);
    assert.equal(equation.children[0],alpha,'retain the formula group across alpha substeps');
    assert.equal(equation.children.length,1,'no outgoing duplicate of the equation');near(alpha.style.opacity,1);
    const current=formulaSnapshot();
    if(formulaStates.has(local))assert.deepEqual(current,formulaStates.get(local));else formulaStates.set(local,current);
    assert.ok(+token('productM').style.opacity + +token('coefficient').style.opacity<=1+1e-10);
    assert.ok(detail.children.filter(n=>+n.style.opacity>0).length<=1);
  }
  assert.equal(h.mathRenders,renders,'moving factors never recompiles their math');
  for(const boundary of [.36,.56]) {
    beat('finalCompare',boundary-1e-7);const before=formulaSnapshot();
    beat('finalCompare',boundary+1e-7);const after=formulaSnapshot();
    for(let i=0;i<before.length;i++) {
      near(+before[i][2],+after[i][2],.001);
      const coords=s=>[...s.matchAll(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g)].map(m=>+m[0]);
      coords(before[i][3]).forEach((x,j)=>near(x,coords(after[i][3])[j],.001));
    }
  }
  beat('finalCompare',.32);const scaledPosition=token('scaledZ').style.transform;
  beat('finalCompare',.46);assert.notEqual(token('scaledZ').style.transform,scaledPosition);near(token('scaledZ').style.opacity,1);
  beat('finalCompare',.53);const productPosition=token('productZ').style.transform;
  beat('finalCompare',.65);assert.equal(token('productZ').style.transform,productPosition);
  near(token('coefficient').style.opacity,1);near(token('productPhase').style.opacity,0);
  h.media.matches=true;
  for(const [local,shown,hidden] of [[.2,'scaledZ','productZ'],[.45,'productPhase','coefficient'],[.65,'coefficient','productPhase']]) {
    beat('finalCompare',local);near(token(shown).style.opacity,1);near(token(hidden).style.opacity,0);
  }
  h.media.matches=false;
  seek('refine',.5);near(visible(lock),0);
  assert.deepEqual(h.errors,[]);
});

test('formula actions follow the geometry and remain continuous when the comparison beat is retimed',()=>{
  const Clock=require('../web/shared/animation/beat-clock.js');
  const retimed=Clock.define(Peak.timeline.beats.map(b=>({...b,duration:b.key==='finalCompare'?b.duration*1.7:b.duration})));
  for(let i=0;i<200;i++) {
    const local=.16+i*.0029;
    const state=Peak.presentation(Peak.timeline.progressFor('finalCompare',local)),f=state.formula.motion;
    const geometry=Peak.alphaGeometry(state.cues);
    assert.ok(f);near(geometry.scale,1+(.68-1)*f.scale);near(geometry.angle,Math.PI/3*f.rotation);
    if(f.rotation>0)near(f.expand,1);
    if(f.merge>0)near(f.rotation,1);
    const after=Peak.presentation(retimed.progressFor('finalCompare',local),retimed).formula.motion;
    for(const key of ['scale','expand','rotation','merge'])near(after[key],f[key]);
    for(const key of Object.keys(f.details))near(after.details[key],f.details[key]);
    assert.ok(Object.values(f.details).filter(x=>x>0).length<=1);
  }
});

test('complex multiplication illustrates scale then rotation, while color changes remain display-only',()=>{
  const lesson=Story.createLesson(),data=Peak.dataFor(lesson),peak=data.peak;
  const at=local=>Peak.state(lesson,Peak.timeline.progressFor('finalCompare',local));
  const colorAt=seconds=>Peak.state(lesson,Peak.timeline.progressFor('finalPrepare',seconds/21));
  for(let local=.16;local<=.72;local+=.005){
    const {geometry:g,solved}=at(local),a={re:g.scale*Math.cos(g.angle),im:g.scale*Math.sin(g.angle)};
    near(Math.hypot(g.source.re,g.source.im),1);
    near(g.target.re,a.re*g.source.re-a.im*g.source.im);near(g.target.im,a.re*g.source.im+a.im*g.source.re);
    if(local<.4)near(g.angle,0);else near(Math.hypot(g.target.re,g.target.im),.68);
    assert.equal(solved,false);
  }
  const before=at(.60),after=at(.72);assert.notDeepEqual(before.geometry.source,after.geometry.source);
  near(before.geometry.angle,after.geometry.angle);near(before.geometry.scale,after.geometry.scale);
  for(let i=0;i<=500;i++){
    const s=at(i/500);
    assert.ok(s.illustrationAlpha===0||s.comparisonAlpha===0,'retire one set of axes before introducing the other');
  }
  assert.deepEqual(Peak.displayColor(0,0,1).rgb,[0,0,0]);
  assert.deepEqual(Peak.displayColor(1,0,1).rgb,[255,56,56]);
  assert.deepEqual(Peak.displayColor(0,1,1).rgb,[156,255,56]);
  for(const rho of [.001,.02,.1,1])for(const angle of [-2.4,0,.6,Math.PI]){
    const c=Peak.displayColor(rho*Math.cos(angle),rho*Math.sin(angle),1);
    near(c.brightness,Math.log1p(1000*rho)/Math.log1p(1000));
    near(Peak.displayColor(rho*Math.cos(angle+.4),rho*Math.sin(angle+.4),1).brightness,c.brightness);
  }
  for(const seconds of [15.6,16,17])near(colorAt(seconds).displayKey.brightness,1);
  near(data.displayScales.spatial[1],data.displayScales.shifted);
  const index=A.idx(...data.frequencyPoint.q,peak.n);
  near(data.displaySample.re,peak.prepared[0].re[index]);near(data.displaySample.im,peak.prepared[0].im[index]);
});

test('the displayed multiplier has unit modulus and reproduces the actual shifted field at every coordinate',()=>{
  const lesson=Story.createLesson(),{peak,phaseField}=Peak.dataFor(lesson);
  const source=peak.spatial[1],before=[source.re.slice(),source.im.slice()];
  for(let i=0;i<peak.count;i++) {
    const re=phaseField.re[i],im=phaseField.im[i];near(Math.hypot(re,im),1);
    near(source.re[i]*re-source.im[i]*im,peak.shifted.re[i]);
    near(source.re[i]*im+source.im[i]*re,peak.shifted.im[i]);
  }
  const Clock=require('../web/shared/animation/beat-clock.js');
  const retimed=Clock.define(Peak.timeline.beats.map(b=>({...b,duration:b.key==='finalShiftScan'?b.duration*1.7:b.duration})));
  const at=(local,timeline=Peak.timeline)=>Peak.state(lesson,timeline.progressFor('finalShiftScan',local),timeline).pointwise;
  for(const local of [.2,.35,.48,.54,.59,.6,.7,.94,.999]) {
    const current=at(local),other=at(local,retimed);
    assert.equal(current.index,other.index);assert.equal(current.count,other.count);
    near(current.angle,other.angle);near(current.output.re,other.output.re);near(current.output.im,other.output.im);
    near(Math.hypot(current.input.re,current.input.im),Math.hypot(current.output.re,current.output.im));
    if(local<.25)assert.equal(current.count,0);
    if(local>=.94)assert.equal(current.count,peak.count);
  }
  assert.deepEqual(source.re,before[0]);assert.deepEqual(source.im,before[1]);
});

test('a displaced Fourier component creates the positive extra angle and is cancelled by the reverse rotation',()=>{
  const n=8,k=[2,1],q=[1,-2],alpha={re:.7,im:-.2},value={re:2,im:-1};
  const zero=()=>({re:new Float64Array(n*n),im:new Float64Array(n*n)}),B0=zero(),B1=zero();
  const i=A.idx(...q,n),j=A.idx(q[0]+k[0],q[1]+k[1],n);
  B0.re[i]=value.re;B0.im[i]=value.im;
  B1.re[j]=alpha.re*value.re-alpha.im*value.im;B1.im[j]=alpha.re*value.im+alpha.im*value.re;
  const u=A.spatial(B0,n),v=A.spatial(B1,n);
  for(let r=0;r<n*n;r++){
    const delta=2*Math.PI*(k[0]*(r%n)+k[1]*Math.floor(r/n))/n,c=Math.cos(delta),s=Math.sin(delta);
    const ar=alpha.re*u.re[r]-alpha.im*u.im[r],ai=alpha.re*u.im[r]+alpha.im*u.re[r];
    near(v.re[r],ar*c-ai*s);near(v.im[r],ar*s+ai*c);
    near(v.re[r]*c+v.im[r]*s,ar);near(v.im[r]*c-v.re[r]*s,ai);
  }
});

test('Euler formula replacements retire old glyphs before introducing new glyphs at the same address',()=>{
  const M=require('../web/motion/sim-motion-model.js');
  for(let t=2.02;t<=2.46;t+=.0002){
    const tokens=Object.fromEntries(M.encodingDerivationState(t).formula.tokens.map(p=>[p.id,p]));
    for(const [a,b] of [['ex','er'],['er','eft'],['eft','ef'],['cosine','cosTheta'],['exponentPlusTheta','exponentPlusAngle'],['exponentMinusTheta','exponentMinusAngle']])
      assert.ok(tokens[a].opacity===0||tokens[b].opacity===0,a+' / '+b);
  }
});
