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
  assert.equal(Peak.timeline.beats.slice(0,5).reduce((s,b)=>s+b.duration,0),108000);
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

test('working spectra are defined before their ratio, and the purpose of changing domain precedes the inverse transform',()=>{
  const at=(key,local)=>Peak.presentation(Peak.timeline.progressFor(key,local));
  const definitions=at('finalPrepare',10/21),relation=at('finalPrepare',11.6/21);
  assert.equal(definitions.substep,'workingBands');assert.match(definitions.formula.equation,/B_0.*coloneqq.*B_1.*coloneqq/);
  assert.equal(relation.substep,'commonAlpha');assert.match(relation.formula.equation,/approx.*alpha/);
  for(const local of [0,1/60,2.999/60,1/60,0]){
    const s=at('finalInverse',local);
    assert.equal(s.substep,'purpose');near(s.cues.inverse,0);near(s.cues.derivationEnter,0);near(s.cues.shift,0);
    assert.doesNotMatch(s.formula.equation,/mathcal F|delta|e\^\{-/);
    near(s.cues.divide,0);
  }
  assert.equal(at('finalInverse',3/60).substep,'transform');
  near(at('finalInverse',3.4/60).cues.inverse,0);near(at('finalInverse',6.1/60).cues.inverse,1);
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

test('reindexing and extracting the same phase reproduces a full complex Fourier sum for signed shifts',()=>{
  const n=8,alpha={re:.67,im:-.21};
  const mul=(a,b)=>({re:a.re*b.re-a.im*b.im,im:a.re*b.im+a.im*b.re});
  const add=(a,b)=>({re:a.re+b.re,im:a.im+b.im});
  const exponential=angle=>({re:Math.cos(angle),im:Math.sin(angle)});
  const zero=()=>({re:0,im:0});
  const B0=Array.from({length:n*n},(_,i)=>({re:Math.sin(.7*i)+.2*Math.cos(i),im:Math.cos(.3*i)-.1*Math.sin(i)}));
  for(const k of [[2,1],[-2,1],[1,-3]]){
    const B1=Array.from({length:n*n},zero);
    for(let y=0;y<n;y++)for(let x=0;x<n;x++)B1[A.idx(x+k[0],y+k[1],n)]=mul(alpha,B0[y*n+x]);
    for(let ry=0;ry<n;ry++)for(let rx=0;rx<n;rx++){
      let source=zero(),reindexed=zero(),substituted=zero(),split=zero(),u=zero();
      const extra=exponential(2*Math.PI*(k[0]*rx+k[1]*ry)/n);
      for(let y=0;y<n;y++)for(let x=0;x<n;x++){
        const base=exponential(2*Math.PI*(x*rx+y*ry)/n);
        const shifted=exponential(2*Math.PI*((x+k[0])*rx+(y+k[1])*ry)/n);
        source=add(source,mul(B1[y*n+x],base));
        reindexed=add(reindexed,mul(B1[A.idx(x+k[0],y+k[1],n)],shifted));
        substituted=add(substituted,mul(mul(alpha,B0[y*n+x]),shifted));
        split=add(split,mul(mul(mul(alpha,B0[y*n+x]),base),extra));
        u=add(u,mul(B0[y*n+x],base));
      }
      const factored=mul(mul(alpha,extra),u);
      for(const value of [reindexed,substituted,split,factored]){
        near(value.re/(n*n),source.re/(n*n));near(value.im/(n*n),source.im/(n*n));
      }
    }
  }
});

test('the proof keeps exact reindexing, approximate observations and a definition before the delta abbreviation',()=>{
  const at=seconds=>Peak.presentation(Peak.timeline.progressFor('finalInverse',seconds/60));
  for(const seconds of [9.5,17.5])assert.match(at(seconds).formula.equation,/=/);
  for(const seconds of [21.5,26.5,31,38.2,44,48.3,59])assert.match(at(seconds).formula.equation,/\\approx/);
  const inside=at(23),outside=at(27),matched=at(40);
  assert.match(inside.formula.equation,/\\sum_\{\\mathbf q\} \\alpha B_0/);
  assert.match(outside.formula.equation,/\\alpha \\frac1\{N\^2\} \\sum/);
  assert.match(matched.formula.equation,/\\alpha e\^\{2\\pi.*\\frac1\{N\^2\}.*B_0/);
  assert.doesNotMatch(at(46.4).formula.equation,/\\delta/);
  near(at(46.4).cues.deltaDefinition,1);
  assert.match(at(49).formula.equation,/e\^\{i\\delta/);
  const Clock=require('../web/shared/animation/beat-clock.js');
  const retimed=Clock.define(Peak.timeline.beats.map(b=>({...b,duration:b.key==='finalInverse'?93000:b.duration})));
  const widths=Object.fromEntries(Object.keys(Peak.inverseTokens).map((key,i)=>[key,35+(i%4)*20]));
  for(let local=.001;local<1;local+=.007){
    const original=Peak.presentation(Peak.timeline.progressFor('finalInverse',local));
    const other=Peak.presentation(retimed.progressFor('finalInverse',local),retimed);
    assert.equal(other.proof.stage,original.proof.stage);assert.equal(other.formula.equation,original.formula.equation);
    assert.deepEqual(other.proof.emphasis,original.proof.emphasis);
    for(const key of Object.keys(original.proof.tokenAlpha))near(other.proof.tokenAlpha[key],original.proof.tokenAlpha[key],1e-7);
    const first=Peak.inverseMotion(original.proof,widths).actors,last=Peak.inverseMotion(other.proof,widths).actors;
    for(const key of Object.keys(first))for(const attr of ['x','y','scale','opacity'])near(first[key][attr],last[key][attr],1e-5);
  }
});

test('formula motion is geometric, endpoint-continuous and follows the cue after retiming',()=>{
  // Deliberately unequal glyph widths exercise layout without a browser font.
  const widths=Object.fromEntries(Object.keys(Peak.inverseTokens).map((key,i)=>[key,28+(i%5)*17]));
  const beat=Peak.timeline.beats.find(b=>b.key==='finalInverse');
  const at=local=>{
    const p=Peak.presentation(Peak.timeline.progressFor('finalInverse',local));
    return {p,m:Peak.inverseMotion(p.proof,widths,34)};
  };
  for(const stage of Peak.inverseStages.slice(1)){
    const [a,b]=beat.cues[stage.cue],before=at(a-1e-5),after=at(b+1e-5);
    for(const [boundary,stable,side] of [[a,before,1],[b,after,-1]]){
      const moving=at(boundary+side*1e-7);
      for(const [key,pose] of Object.entries(stable.m.actors))if(pose.opacity===1&&moving.m.actors[key].opacity>.999){
        near(moving.m.actors[key].x,pose.x,.02);near(moving.m.actors[key].y,pose.y,.02);
        near(moving.m.actors[key].scale,pose.scale,.001);
      }
    }
    const frames=[.25,.5,.75].map(t=>at(a+(b-a)*t));
    for(const frame of frames)for(const pose of Object.values(frame.m.actors)){
      assert.ok([pose.x,pose.y,pose.scale,pose.opacity].every(Number.isFinite));
      near(frame.m.actors.lhs.x,before.m.actors.lhs.x);near(frame.m.actors.lhs.y,0);
    }
    const first=frames[0].m.actors,last=frames[2].m.actors;
    assert.ok(Object.keys(first).some(key=>(first[key].opacity>0||last[key].opacity>0)
      && Math.hypot(first[key].x-last[key].x,first[key].y-last[key].y)>1),stage.key+' moves visible glyphs');
    if(stage.key==='factor')for(const frame of frames){near(frame.m.actors.extraOutside.opacity,1);assert.ok(frame.m.actors.extraOutside.y<0);}
    if(stage.key==='recognize')assert.ok(first.norm.scale>last.norm.scale);
  }
});

test('the f slot expands in its original brackets and superscript with continuous bounds',()=>{
  const parts={bandPrefix:49,bandClose:13,f:19,q:20,plusK:60,baseE:17,phasePrefix:45,supF:14,supQ:15,supPlus:43,supOpen:10,supClose:10,phaseTail:60};
  const widths={bandF:81,bandShifted:142,kernelF:136,kernelCombined:200};
  let lastBand=0,lastKernel=0;
  for(let t=0;t<=1.00001;t+=.01){
    const s=Peak.inverseAddressExpansion(Math.min(t,1),parts,widths);
    assert.ok(s.band.width>=lastBand);assert.ok(s.kernel.width>=lastKernel);
    lastBand=s.band.width;lastKernel=s.kernel.width;
    for(const group of [s.band,s.kernel]){
      assert.ok(group.box.width>0);assert.ok(group.box.height>0);
      for(const p of Object.values(group.parts)){near(p.y,0);assert.ok([p.x,p.sx,p.opacity].every(Number.isFinite));}
    }
    near(s.band.parts.bandPrefix.x,0);near(s.kernel.parts.baseE.x,0);
  }
  const first=Peak.inverseAddressExpansion(0,parts,widths),last=Peak.inverseAddressExpansion(1,parts,widths);
  near(first.band.parts.f.opacity,1);near(last.band.parts.f.opacity,0);near(last.band.parts.q.opacity,1);
  near(first.band.parts.plusK.sx,0);assert.ok(last.band.parts.plusK.sx>0);
  near(first.kernel.parts.supPlus.sx,0);assert.ok(last.kernel.parts.supPlus.sx>0);
  near(first.band.width,widths.bandF);near(last.band.width,widths.bandShifted);
  near(first.kernel.width,widths.kernelF);near(last.kernel.width,widths.kernelCombined);
  for(const key of ['band','kernel']){
    const middle=Peak.inverseAddressExpansion(.6,parts,widths)[key];
    assert.ok(middle.box.width>first[key].box.width&&middle.box.width<last[key].box.width);
  }
});

test('the extra-angle illustration applies the locked-k factor without changing magnitude or revealing alpha',()=>{
  const Clock=require('../web/shared/animation/beat-clock.js'),lesson=Story.createLesson();
  const timeline=Clock.define(Peak.timeline.beats.map(b=>({...b,duration:b.key==='finalInverse'?b.duration*1.7:b.duration})));
  for(const k of [[8,0],[3,-2],[-2.3,1.7],[0,0]])for(const r of [[0,0],[4,0],[7,11],[127,125]]) {
    const g=Peak.extraAngleGeometry(k,128,r,1),delta=2*Math.PI*(k[0]*r[0]+k[1]*r[1])/128;
    near(g.delta,delta);near(Math.hypot(g.source.re,g.source.im),1);near(Math.hypot(g.target.re,g.target.im),1);
    near(g.target.re,g.source.re*Math.cos(delta)-g.source.im*Math.sin(delta));
    near(g.target.im,g.source.re*Math.sin(delta)+g.source.im*Math.cos(delta));
  }
  for(const local of [.01,.12,.28,.4,.52,.64,.76,.84,.91,.999]) {
    const a=Peak.state(lesson,Peak.timeline.progressFor('finalInverse',local));
    const b=Peak.state(lesson,timeline.progressFor('finalInverse',local),timeline);
    near(a.extraAngle.angle,b.extraAngle.angle);near(Math.hypot(a.extraAngle.target.re,a.extraAngle.target.im),1);
    near(a.shift,0);assert.equal(a.alpha,null);assert.equal(a.solved,false);
    if(a.extraAngle.angle!==0){near(a.cues.recognizeU,1);near(a.cues.factorOutside,1);near(a.cues.deltaReveal,1);}
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
