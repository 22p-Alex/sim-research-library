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
  // Retained mathematical actors move through the algebra. The original
  // definitions and the completed main-row entrance stay fixed afterward.
  const definitions=[0,1].map(b=>get('data-get-peak-definition',b));
  const proofToken=name=>get('data-get-peak-inverse-token',name);
  const mainRow=get('data-get-peak-inverse-row');
  const pose=n=>[n.attrs.x,n.attrs.y,n.attrs.transform];
  beat('finalInverse',5.2/60);
  const sourceCard=pose(get('data-get-peak-field','inverse-0'));
  beat('finalInverse',.111);
  const emerging=definitions.map(pose);
  beat('finalInverse',9.5/60);
  assert.notDeepEqual(definitions.map(pose),emerging,'image-to-definition handoff moves before settling');
  assert.notDeepEqual(pose(get('data-get-peak-field','inverse-0')),sourceCard,'images shrink in place before the formulas dock');
  beat('finalInverse',10.4/60);const copiedRow=pose(mainRow);
  beat('finalInverse',12/60);
  assert.notDeepEqual(pose(mainRow),copiedRow,'the working equation travels from the retained v definition');
  const definitionPoses=definitions.map(pose),mainPose=pose(mainRow);
  const definitionChildren=definitions.map(n=>n.children[0]);
  const proofStates=new Map(),proofCheckpoints=[12,13.3,14.7,15.8,16.8,18.5,20.2,21.3,23,24.7,25.6,27,28.6,30.2,33,35.8,37.5,40,41.5,43.2,45,46.4,47.5,49,51.5,54,56.5,59.9];
  const proofRenders=h.mathRenders;
  const measurements=h.work.measurements;
  for(const seconds of [...proofCheckpoints,...proofCheckpoints.toReversed()]) {
    beat('finalInverse',seconds/60);
    const shown=Peak.presentation(Peak.timeline.progressFor('finalInverse',seconds/60));
    assert.doesNotMatch(shown.formula.equation,/e\^\{-/);
    near(visible(get('data-get-peak-alpha-illustration')),0);
    definitions.forEach((n,b)=>{near(visible(n),1);assert.deepEqual(pose(n),definitionPoses[b]);assert.equal(n.children[0],definitionChildren[b]);});
    assert.deepEqual(pose(mainRow),mainPose);assert.equal(proofToken('lhs').tagName,'g');
    assert.equal(get('data-inverse-fragment','equal').attrs.width,get('data-inverse-fragment','approx').attrs.width);
    for(const [old,next] of [['sumF','sumQ'],['bandF','bandShifted'],['bandShifted','bandZero'],['kernelF','kernelCombined'],['kernelCombined','kernelReference'],['kernelExtra','extraOutside'],['extraOutside','kernelDelta'],['norm','matchedU'],['matchedU','u']])
      assert.ok(visible(proofToken(old))===0||visible(proofToken(next))===0,old+' / '+next);
    const displayed=proofToken('lhs').parent.children.filter(n=>n.attrs['data-stage-active']==='true');
    assert.deepEqual(displayed.map(n=>n.attrs['data-get-peak-inverse-token']),Array.from(shown.proof.active));
    assert.equal(displayed.map(n=>Peak.inverseTokens[n.attrs['data-get-peak-inverse-token']]).join(' '),shown.formula.equation.slice(2,-2));
    assert.equal(mainRow.attrs['data-equation'],shown.proof.equation);
    const formula=h.byId.get(main?'equation':'pe-equation');
    assert.ok(formula.children.every(n=>n.style.display==='none'),'no duplicate complete equation in the footer');
    assert.ok(h.nodes.filter(n=>n.attrs['data-get-peak-inverse-rule']!==undefined&&visible(n)>0).length<=1);
    const snapshot=h.nodes.filter(n=>n.attrs['data-get-peak-inverse-token']!==undefined||n.attrs['data-get-peak-extra-vector']!==undefined).map(n=>({...n.attrs,style:{...n.style}}));
    if(proofStates.has(seconds))assert.deepEqual(snapshot,proofStates.get(seconds));else proofStates.set(seconds,snapshot);
    if(seconds===18.5){near(visible(proofToken('bandShifted')),1);near(visible(proofToken('kernelCombined')),1);near(visible(proofToken('alpha')),0);}
    if(seconds===23){near(visible(proofToken('alphaInside')),1);near(visible(proofToken('alpha')),0);near(visible(proofToken('bandZero')),1);}
    if(seconds===27){near(visible(proofToken('alphaInside')),0);near(visible(proofToken('alpha')),1);near(visible(proofToken('kernelCombined')),1);}
    if(seconds===33){near(visible(proofToken('kernelReference')),1);near(visible(proofToken('kernelExtra')),1);}
    if(seconds===40){near(visible(proofToken('extraOutside')),1);near(visible(get('data-get-peak-recognize-u')),1);near(visible(proofToken('norm')),1);}
    if(seconds===45){near(visible(proofToken('u')),1);near(visible(proofToken('extraOutside')),1);near(visible(proofToken('kernelDelta')),0);}
    if(seconds===46.4){near(visible(get('data-get-peak-delta-definition')),1);near(visible(proofToken('kernelDelta')),0);}
    if(seconds>=49){near(visible(proofToken('u')),1);near(visible(proofToken('kernelDelta')),1);near(visible(proofToken('norm')),0);}
    if(seconds<49)near(visible(get('data-get-peak-extra-rotation')),0);
    if(seconds>=56.5){
      const v=get('data-get-peak-extra-vector');near(Math.hypot(+v.attrs['data-re'],+v.attrs['data-im']),1);
      near(+v.attrs['data-applied-angle'],Math.atan2(Math.sin(+v.attrs['data-delta']),Math.cos(+v.attrs['data-delta'])));
    }
  }
  assert.equal(h.mathRenders,proofRenders,'all inverse steps reuse the same compiled mathematical groups');
  assert.equal(h.work.measurements,measurements,'continuous motion uses cached widths, not per-frame layout reads');
  beat('finalInverse',.108);
  for(const node of definitions)near(visible(node),1);
  for(const i of [0,1])near(visible(get('data-get-peak-field','inverse-'+i)),0);
  const translatedX=n=>+n.attrs.x+ +n.attrs.transform.match(/translate\(([-\d.]+)/)[1];
  const enteringX=definitions.map(translatedX);
  for(const [i,x] of [370,1070].entries())assert.match(get('data-get-peak-field','inverse-'+i).attrs.transform,new RegExp('^translate\\('+x+' 270\\)'));
  beat('finalInverse',12/60);
  assert.ok(definitions.every((node,i)=>translatedX(node)<enteringX[i]),'the formulas move left, while the images keep their original centers');
  assert.equal(definitions[0].attrs['data-identity-color'],'reference');assert.equal(definitions[1].attrs['data-identity-color'],'side');
  assert.notEqual(definitions[0].children[0].style.color,definitions[1].children[0].style.color);
  near(mainRow.attrs['data-definition-center-x'],720);near(mainRow.attrs['data-row-scale'],1);
  beat('finalInverse',13/60);near(visible(get('data-get-peak-inverse-rule','address')),1);near(visible(get('data-get-peak-address-focus','band')),0);
  beat('finalInverse',14.8/60);near(visible(get('data-get-peak-address-focus','band')),1);
  const addressFrames=[];
  for(const seconds of [16.4,17.1,17.8]){
    beat('finalInverse',seconds/60);
    const band=get('data-get-peak-address-expansion','band'),box=get('data-get-peak-address-focus','band');
    const prefix=get('data-get-peak-address-fragment','bandPrefix'),plus=get('data-get-peak-address-fragment','plusK');
    near(visible(band),1);near(visible(prefix),1);assert.ok(visible(plus)>0);
    addressFrames.push({width:+box.attrs.width,x:+prefix.attrs['data-motion-x'],sx:+plus.attrs['data-motion-sx']});
  }
  for(let i=1;i<addressFrames.length;i++){
    assert.ok(addressFrames[i].width>addressFrames[i-1].width,'the box grows with the address');
    assert.ok(addressFrames[i].sx>addressFrames[i-1].sx,'+k unfolds horizontally');
    near(addressFrames[i].x,addressFrames[0].x,1e-7);
  }
  beat('finalInverse',1);
  const formulaClip=get('data-get-peak-formula-clip'),graphClip=get('data-get-peak-geometry-clip');
  assert.ok(+formulaClip.attrs.y+ +formulaClip.attrs.height<+graphClip.attrs.y,'formula and complex-plane ownership have a positive vertical gap');
  assert.match(get('data-get-peak-formula-zone').attrs['clip-path'],/sim-inverse-formula-zone/);
  const slots=h.context.SIMGetPeak.layout.derivation;
  assert.ok(slots.deltaY+2.2*slots.sizes.angle<+graphClip.attrs.y,'the complete delta definition fits above the graph');
  assert.ok(slots.mainY+3.25*slots.sizes.main<+graphClip.attrs.y,'the padded main equation fits above the graph');
  // A changing opacity is insufficient: inspect actual intermediate positions
  // in both production hosts across extraction, splitting and contraction.
  const motionPose=(seconds,name)=>{
    beat('finalInverse',seconds/60);const node=proofToken(name);
    return {x:+node.attrs['data-motion-x'],y:+node.attrs['data-motion-y'],scale:+node.attrs['data-motion-scale'],opacity:visible(node)};
  };
  for(const [a,b,name] of [[24.8,26.1,'alpha'],[29.7,31.5,'kernelExtra'],[35.8,38.3,'extraOutside'],[41.5,43.2,'norm'],[47.0,48.2,'u']]){
    const first=motionPose(a,name),last=motionPose(b,name);
    assert.ok(Math.hypot(first.x-last.x,first.y-last.y)>3,'visible geometric motion: '+name);
    assert.ok(first.opacity>0||last.opacity>0);
    if(name==='norm')assert.ok(first.scale>last.scale,'the original sum shrinks as one block');
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
  const originalProductScale=12800/Peak.timeline.beats.find(b=>b.key==='finalProduct').duration;
  beat('finalProduct',.17*originalProductScale);near(visible(lock)>0,1);near(Peak.state(lesson,Peak.timeline.progressFor('finalProduct',.17*originalProductScale)).conjugate,0);
  beat('finalProduct',.55*originalProductScale);near(visible(lock),0);near(u.attrs['data-im'],-p.spatial[0].im[i]);
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
