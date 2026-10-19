/* Mathematical provenance, retained actors and bidirectional state; no browser. */
const test=require('node:test'),assert=require('node:assert/strict');
const Tail=require('../web/parameter-demo/scenes/get-peak/tail-story.js');
const Peak=require('../web/parameter-demo/scenes/get-peak/state.js');
const Teaching=require('../web/motion/scenes/adopted-weights/teaching.js');
const Registry=require('../web/shared/animation/scene-registry.js');
const boot=require('./helpers/motion-dom.cjs');
const near=(a,b,e=1e-9)=>assert.ok(Number.isFinite(+a)&&Math.abs(a-b)<e*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);
const visible=n=>{let alpha=1;for(;n;n=n.parent){if(n.hidden||n.style?.display==='none')return 0;alpha*=Number(n.style?.opacity??n.attrs?.opacity??1);}return alpha;};

test('ideal phase cancellation leaves energy weights without modifying actual parameter inputs',()=>{
  let re=0,im=0,energy=0;
  for(const d of Tail.demo){
    const z=Tail.multiply({re:d.u.re,im:-d.u.im},d.v);
    near(z.re,d.z.re);near(z.im,d.z.im);near(z.re,Tail.demoAlpha.re*d.energy);near(z.im,Tail.demoAlpha.im*d.energy);
    re+=z.re;im+=z.im;energy+=d.energy;
  }
  assert.equal(energy,12);near(re/energy,.4);near(im/energy,.4*Math.sqrt(3));
  assert.equal(Object.values(Tail.shots).reduce((n,s)=>n+s.length,0)+Object.values(Teaching.shots).reduce((n,s)=>n+s.length,0),27);
  near(Object.values(Tail.durations).reduce((s,n)=>s+n,0)-Tail.prefix+78,210);
});

for(const main of [true,false])test(`${main?'Motion':'standalone'}: all new coefficient shots use retained actors, real prefixes, gated results and reversible state`,()=>{
  let lesson;
  const h=boot({page:main?'sim_motion_demo.html':'sim_parameter_demo.html',renderer:main?'web/motion/sim-motion.js':'web/parameter-demo/sim-parameter-app.js',
    beforeRenderer(ctx){const create=ctx.SIMParameterLesson.createView;ctx.SIMParameterLesson.createView=(p,l,o)=>{lesson=l;return create(p,l,o);};}});
  assert.deepEqual(h.errors,[]);
  const ctx=h.context,flow=main?ctx.SIMMotionParameterChapter.plan(ctx.SIMMotion):ctx.SIMParameterDemo.preview;
  const reg=Registry.create(flow.scenes,{kind:main?'motion':'parameter',getPeak:Peak,chapter:ctx.SIMMotionParameterChapter,motion:ctx.SIMMotion});
  const go=(scene,beat,p)=>{const location=reg.resolve({scene:(main?'parameters.':'')+scene,beat,progress:p});if(main){h.byId.get('progress').value=location.position;h.byId.get('progress').dispatch('input');}else ctx.SIMParameterDemo.player.seek(location.position);};
  const get=(key,v)=>h.nodes.find(n=>v===undefined?n.attrs[key]!==undefined:n.attrs[key]===String(v));
  const root=get('data-parameter-tail'),math=get('data-math-actors','parameter-tail'),result=get('data-tail-alpha-vector'),actual=get('data-tail-actual');
  const snapshot=()=>h.nodes.filter(n=>n===root||n===math||n.attrs['data-actor-owner']==='parameter-tail'||n.attrs['data-tail-C-vector']!==undefined||n.attrs['data-tail-prediction']!==undefined).map(n=>({attrs:{...n.attrs},style:{...n.style}}));
  const tuples=Peak.stops.filter(s=>Tail.shots[s.getPeakBeat]).flatMap(s=>s.teachingBeats.flatMap(b=>[.05,.53,.95].map(p=>[s.id,b.key,p])));
  const snapshots=new Map(),raw=lesson.estimate.finalPeak.spatial.map(z=>({re:Array.from(z.re),im:Array.from(z.im)}));
  for(const [scene,beat,p]of [...tuples,...tuples.toReversed()]){
    go(scene,beat,p);assert.equal(root.attrs['data-shot'],beat);
    const key=scene+beat+p,now=snapshot();if(snapshots.has(key))assert.deepEqual(now,snapshots.get(key));else snapshots.set(key,now);
    for(const n of now)for(const value of Object.values(n.attrs))assert.doesNotMatch(value,/NaN|Infinity|undefined/);
    if(beat[0]==='A'||beat[0]==='B'||beat==='C1'||beat==='C2')assert.equal(visible(result),0,'no coefficient before complete numerical division');
  }
  go('get-peak-sum','B3',.5);assert.equal(get('data-get-peak').attrs['data-count'],'0');
  go('get-peak-sum','B5',.5);
  const count=+get('data-get-peak').attrs['data-count'],sum=lesson.estimate.finalPeak.sums[count];
  assert.ok(count>0&&count<lesson.estimate.finalPeak.count);assert.ok(visible(actual)>0);
  near(get('data-get-peak').attrs['data-sum-re'],sum.re);near(get('data-get-peak').attrs.energy??get('data-get-peak').attrs['data-energy'],sum.energy);
  go('get-peak-divide','C3',.9);near(result.attrs['data-re'],lesson.estimate.finalPeak.alpha.re);assert.ok(visible(result)>0);
  go('get-peak-divide','C4',.7);
  const peak=lesson.estimate.finalPeak;let residual=0,energy=0;
  for(let i=0;i<peak.count;i++){
    const predicted=Tail.multiply(peak.alpha,{re:peak.spatial[0].re[i],im:peak.spatial[0].im[i]});
    residual+=(peak.shifted.re[i]-predicted.re)**2+(peak.shifted.im[i]-predicted.im)**2;
    energy+=peak.shifted.re[i]**2+peak.shifted.im[i]**2;
  }
  near(get('data-tail-predictions').attrs['data-relative-residual'],Math.sqrt(residual/energy));
  go('get-peak-read','D2',.9);near(get('data-tail-phase-arc').attrs['data-angle'],lesson.estimate.phase);
  go('get-peak-sum','B2',.2);const renders=h.mathRenders,measurements=h.work.measurements,node=math;
  go('get-peak-sum','B2',.8);assert.equal(h.mathRenders,renders);assert.equal(h.work.measurements,measurements);assert.equal(math,node);
  lesson.estimate.finalPeak.spatial.forEach((z,i)=>{assert.deepEqual(Array.from(z.re),raw[i].re);assert.deepEqual(Array.from(z.im),raw[i].im);});
  const alias=reg.resolve({scene:(main?'parameters.':'')+'get-peak-sum',beat:'finalSum',progress:.875});
  const fine=reg.resolve({scene:(main?'parameters.':'')+'get-peak-sum',beat:'B5',progress:.5});near(alias.position,fine.position);
  assert.deepEqual(h.errors,[]);
});

test('weight compensation uses full temporary observations and distributes into fixed observation slots before matrix handoff',()=>{
  const h=boot(),ctx=h.context,flow=ctx.SIMMotionParameterChapter.plan(ctx.SIMMotion);
  const get=(k,v)=>h.nodes.find(n=>v===undefined?n.attrs[k]!==undefined:n.attrs[k]===String(v));
  const reg=Registry.create(flow.scenes,{kind:'motion',getPeak:Peak,chapter:ctx.SIMMotionParameterChapter,motion:ctx.SIMMotion});
  const go=(scene,beat,p)=>{const loc=reg.resolve({scene,beat,progress:p});h.byId.get('progress').value=loc.position;h.byId.get('progress').dispatch('input');};
  go('adopted-weights','E3',.85);
  const input=get('data-weight-input'),output=get('data-weight-output'),g=+output.attrs['data-applied-gain'],a=+output.attrs['data-applied-angle'];
  near(output.attrs['data-re'],g*(+input.attrs['data-re']*Math.cos(a)-+input.attrs['data-im']*Math.sin(a)));
  near(output.attrs['data-im'],g*(+input.attrs['data-re']*Math.sin(a)+ +input.attrs['data-im']*Math.cos(a)));
  near(g,1.25);near(a,0);assert.ok(visible(output)>0);
  const observationNodes=[0,1,2].map(i=>h.nodes.find(n=>n.attrs['data-actor-owner']==='weight-distribution'&&n.attrs['data-math-actor']==='D'+i));
  const snapshots=new Map();let observations;
  for(const p of [.02,.26,.51,.78,.99,.51,.26,.02]){
    go('restore-weight','F3',p);
    const poses=observationNodes.map(n=>n.attrs.transform);if(!observations)observations=poses;else assert.deepEqual(poses,observations);
    const now=h.nodes.filter(n=>n.attrs['data-actor-owner']==='weight-distribution').map(n=>({...n.attrs}));
    if(snapshots.has(p))assert.deepEqual(now,snapshots.get(p));else snapshots.set(p,now);
  }
  go('restore-weight','F6',1);const single=get('data-adopted-single'),value=get('data-adopted-restored-weight');
  const old=[value.attrs['data-re'],value.attrs['data-im']];near(old[0],-5/12);near(old[1],-5*Math.sqrt(3)/12);
  assert.ok(visible(single)>0);const pose=single.attrs.transform;
  go('assemble-weights','main',.00001);assert.equal(single.attrs.transform,pose);assert.deepEqual([value.attrs['data-re'],value.attrs['data-im']],old);
  assert.deepEqual(h.errors,[]);
});
