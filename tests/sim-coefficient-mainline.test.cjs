/* Production four-scene path and source-faithful frequency/spatial equivalence.
 * DOM state only: these assertions are not visual or layout acceptance. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const S=require('../web/parameter-demo/scenes/get-peak/mainline-state.js');
const Clock=require('../web/shared/animation/beat-clock.js');
const E=require('../web/shared/sim-parameter-estimation.js');
const M=require('../web/parameter-demo/sim-parameter-model.js');
const Registry=require('../web/shared/animation/scene-registry.js');
const Peak=require('../web/parameter-demo/scenes/get-peak/state.js');
const OTF=require('../web/parameter-demo/scenes/otf/storyboard.js');
const katex=require('../vendor/katex/katex.min.js');
const boot=require('./helpers/motion-dom.cjs');
const near=(a,b,e=1e-9)=>assert.ok(Number.isFinite(+a)&&Math.abs(+a-b)<e*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const visible=n=>{let a=1;for(;n;n=n.parent){if(n.hidden||n.attrs?.display==='none'||n.style?.visibility==='hidden')return 0;a*=+(n.attrs?.opacity??n.style?.opacity??1);}return a;};

test('final frequency prefixes equal the unchanged fairSIM estimator for signed integer and fractional shifts',()=>{
  const n=16,cutoff=6,bands=[0,1].map(b=>({re:Float64Array.from({length:n*n},(_,i)=>.4+Math.sin(i*.73+b*.8)),im:Float64Array.from({length:n*n},(_,i)=>.2+Math.cos(i*.43+b*1.1))}));
  const original=bands.map(z=>({re:Array.from(z.re),im:Array.from(z.im)}));
  for(const [kx,ky]of [[4,0],[-3,4],[4.2,-2.3],[-2.71,3.19]]){
    const peak=E.fairSimGetPeak({config:{n,cutoff},separated:{bands}},kx,ky);
    const lesson={estimate:{finalPeak:peak},capture:{config:{n,cutoff}}},d=S.dataFor(lesson),last=d.sums.at(-1);
    near(d.alpha.re,peak.alpha.re);near(d.alpha.im,peak.alpha.im);
    near(last.energy,n*n*peak.referenceEnergy);near(last.re,n*n*peak.cross.re);near(last.im,n*n*peak.cross.im);
    for(const p of d.points.filter((_,i)=>i%9===0)){
      let re=0,im=0;
      // Independent finite Fourier evaluation; no production shift/FFT here.
      for(let y=0;y<n;y++)for(let x=0;x<n;x++){
        const i=y*n+x,angle=-2*Math.PI*((p.q[0]+kx)*x+(p.q[1]+ky)*y)/n,c=Math.cos(angle),s=Math.sin(angle),z=peak.spatial[1];
        re+=z.re[i]*c-z.im[i]*s;im+=z.re[i]*s+z.im[i]*c;
      }
      near(p.v.re,re);near(p.v.im,im);
    }
    let prefix={re:0,im:0,energy:0};
    d.points.forEach((p,i)=>{prefix={re:prefix.re+p.product.re,im:prefix.im+p.product.im,energy:prefix.energy+p.energy};assert.deepEqual(d.sums[i+1],prefix);});
  }
  bands.forEach((z,i)=>{assert.deepEqual(Array.from(z.re),original[i].re);assert.deepEqual(Array.from(z.im),original[i].im);});
});

test('one common coefficient is the minimum of the pooled complex residual, not an average of unstable divisions',()=>{
  const lesson=M.createLesson(),d=S.dataFor(lesson),objective=a=>d.points.reduce((s,p)=>s+(p.v.re-a.re*p.u.re+a.im*p.u.im)**2+(p.v.im-a.re*p.u.im-a.im*p.u.re)**2,0);
  const minimum=objective(d.alpha);
  for(const [re,im]of [[.01,0],[0,-.03],[-.1,.1]])assert.ok(objective({re:d.alpha.re+re,im:d.alpha.im+im})>minimum);
  assert.equal(S.stops.length,4);assert.equal(S.timeline.duration,70000);
  assert.equal(S.correspondenceFormulas.recall,OTF.formulas.correct,'recall uses the same two-row OTF formula');
  assert.equal(S.correspondenceFormulas.locked,OTF.formulas.correct.replaceAll(String.raw`\mathbf k'`,String.raw`\widehat{\mathbf k}`));
  assert.match(S.correspondenceFormulas.locked,/S\(\\mathbf q-\\mathbf k\+\\widehat\{\\mathbf k\}\)/,'locking does not silently remove an estimation residual');
  assert.equal(S.correspondenceFormulas.aligned,S.correspondenceFormulas.locked.replace(String.raw`S(\mathbf q-\mathbf k+\widehat{\mathbf k})`,String.raw`S(\mathbf q)`));
  for(const formula of [...Object.values(S.correspondenceFormulas),...Object.values(S.derivationFormulas)])assert.doesNotThrow(()=>katex.renderToString(formula.slice(2,-2),{displayMode:true,throwOnError:true,strict:'error'}));
  for(const p of [0,.21,.22,.25,.26,.27,.28,.288,.30,.33,1]){
    const hop=S.wavevectorLock(p);assert.ok(hop.lift>=0&&hop.lift<=.42);near(hop.prime*hop.hat,0);
    if(p<=.22){near(hop.lift,0);near(hop.prime,1);near(hop.hat,0);}
    if(p>=.33){near(hop.lift,0);near(hop.prime,0);near(hop.hat,1);}
  }
  near(S.wavevectorLock(.27).lift,.42);
  for(const selected of S.timeline.beats){
    const retimed=Clock.define(S.timeline.beats.map(b=>({...b,duration:b.duration*(b.key===selected.key?1.7:1)})));
    for(const b of S.timeline.beats)for(const p of [.02,.23,.4,.63,.87,.99]){
      const a=S.state(lesson,S.timeline.progressFor(b.key,p)),z=S.state(lesson,retimed.progressFor(b.key,p),retimed);
      for(const key of ['mode','title','copy','note','equation','substep','count','sum','alpha','overview','handoff','recall','reliableCaption','correction','expand','sigma','subProgress','cards']){
        if(typeof a[key]==='number')near(a[key],z[key]);else assert.deepEqual(a[key],z[key],b.key+':'+key);
      }
    }
  }
});

test('conjugation removes arbitrary specimen phase while retaining the common phase',()=>{
  const m=.73,phi=-.61;
  for(const theta of [-3,-1.3,0,.4,2.9])for(const radius of [.001,1,37]){
    const u={re:radius*Math.cos(theta),im:radius*Math.sin(theta)};
    const v={re:m*radius*Math.cos(theta+phi),im:m*radius*Math.sin(theta+phi)};
    const numerator=S.product(u,v),energy=u.re*u.re+u.im*u.im;
    near(numerator.re/energy,m*Math.cos(phi));near(numerator.im/energy,m*Math.sin(phi));
    near(S.product(u,u).re,radius*radius);near(S.product(u,u).im,0);
  }
});

for(const main of [true,false])test(`${main?'Motion':'standalone'}: four scenes reuse one fraction, actual prefixes and one result across seeks and controls`,()=>{
  let lesson;
  const h=boot({page:main?'sim_motion_demo.html':'sim_parameter_demo.html',renderer:main?'web/motion/sim-motion.js':'web/parameter-demo/sim-parameter-app.js',beforeRenderer(ctx){const create=ctx.SIMParameterLesson.createView;ctx.SIMParameterLesson.createView=(p,l,o)=>{lesson=l;return create(p,l,o);};}});
  assert.deepEqual(h.errors,[]);
  const ctx=h.context,flow=main?ctx.SIMMotionParameterChapter.plan(ctx.SIMMotion):ctx.SIMParameterDemo.preview;
  assert.equal(flow.scenes.length,main?38:16);
  const registry=Registry.create(flow.scenes,{kind:main?'motion':'parameter',getPeak:Peak,chapter:ctx.SIMMotionParameterChapter,motion:ctx.SIMMotion});
  const go=(id,p)=>{const stop=S.stops.find(s=>s.id===id),location=registry.resolve({scene:(main?'parameters.':'')+id,beat:stop.coefficientBeat,progress:p});if(main){h.byId.get('progress').value=location.position;h.byId.get('progress').dispatch('input');}else ctx.SIMParameterDemo.player.seek(location.position);return S.stopProgress(stop,p);};
  const get=(k,v)=>h.nodes.find(n=>v===undefined?n.attrs[k]!==undefined:n.attrs[k]===String(v));
  const root=get('data-coefficient-mainline'),fraction=get('data-math-actors','coefficient-ratio'),vector=get('data-coefficient-result-vector');
  const before=lesson.estimate.finalPeak.prepared.map(z=>({re:Array.from(z.re),im:Array.from(z.im)}));
  const samples=S.stops.flatMap(s=>[.000001,.06,.1,.15,.23,.27,.34,.35,.36,.38,.39,.40,.42,.445,.46,.475,.485,.493,.5,.51,.52,.53,.63,.79,.82,.86,.88,.92,1].map(p=>[s.id,p])),saved=new Map();
  for(const [id,p]of [...samples,...samples.toReversed()]){
    const progress=go(id,p),expected=S.state(lesson,progress),actual=ctx.SIMCoefficientMainline.dataFor(lesson);
    assert.equal(root.attrs['data-mode'],expected.mode);assert.equal(+root.attrs['data-count'],expected.count);
    near(root.attrs['data-sum-re'],actual.sums[expected.count].re);near(root.attrs['data-sum-im'],actual.sums[expected.count].im);near(root.attrs['data-sum-energy'],actual.sums[expected.count].energy);
    assert.equal(h.byId.get(main?'scene-title':'pe-title').textContent,expected.title);
    if(expected.result===0)near(visible(vector),0);
    const snapshot=h.nodes.filter(n=>n===root||['coefficient-ratio','coefficient-correspondence'].includes(n.attrs['data-actor-owner'])||['data-correspondence-recall','data-reference-point','data-wavevector-slot','data-wavevector-glyph','data-correspondence-collapse'].some(key=>n.attrs[key]!==undefined)).map(n=>({...n.attrs}));
    snapshot.forEach(n=>Object.values(n).forEach(v=>assert.doesNotMatch(String(v),/NaN|Infinity|undefined/)));
    const key=id+p;if(saved.has(key))assert.deepEqual(snapshot,saved.get(key));else saved.set(key,snapshot);
  }
  go('coefficient-read',1);near(vector.attrs['data-re'],lesson.estimate.finalPeak.alpha.re);near(vector.attrs['data-im'],lesson.estimate.finalPeak.alpha.im);
  near(get('data-coefficient-result-angle').attrs['data-angle'],lesson.estimate.phase);
  go('coefficient-point',.5);const V=h.nodes.find(n=>n.attrs['data-actor-owner']==='coefficient-ratio'&&n.attrs['data-math-actor']==='V');
  go('least-squares-fit',1);const relationEnd=[V.attrs['data-x'],V.attrs['data-y']].map(Number);
  go('coefficient-point',.000001);near(V.attrs['data-x'],relationEnd[0],1e-6);near(V.attrs['data-y'],relationEnd[1],1e-6);
  go('coefficient-point',.30);assert.notEqual(V.attrs['data-y'],String(relationEnd[1]),'the original V moves into the numerator');
  go('coefficient-point',.38);const from=V.attrs.transform;go('coefficient-point',.44);assert.notEqual(V.attrs.transform,from,'the same numerator makes room for its conjugate');
  go('coefficient-sum',.10);const sum=h.nodes.find(n=>n.attrs['data-actor-owner']==='coefficient-ratio'&&n.attrs['data-math-actor']==='topSum'),alpha=visible(sum);
  go('coefficient-sum',.24);assert.ok(visible(sum)>alpha,'the sum grows into the same fraction');
  go('coefficient-sum',.45);const renders=h.mathRenders,measurements=h.work.measurements;go('coefficient-sum',.62);
  assert.equal(h.mathRenders,renders);assert.equal(h.work.measurements,measurements);assert.equal(get('data-math-actors','coefficient-ratio'),fraction);
  assert.equal(h.nodes.some(n=>n.attrs['data-get-peak-inverse-proof']!==undefined),false,'the implementation derivation is not mounted on the main path');
  const html=fs.readFileSync(main?'sim_motion_demo.html':'sim_parameter_demo.html','utf8');
  assert.match(html,/data-coefficient-theory="implementation"/);assert.match(html,/data-coefficient-theory="least-squares"/);
  assert.equal(get('data-coefficient-footer','coefficient-pooledRatio').style.visibility,'visible','the synchronized formula rail is visible');
  const derivation=key=>h.nodes.find(n=>n.attrs['data-actor-owner']==='coefficient-ratio'&&n.attrs['data-math-actor']===key);
  const footerActor=key=>h.nodes.find(n=>n.attrs['data-actor-owner']==='coefficient-derivation-footer'&&n.attrs['data-math-actor']===key);
  const stageLayer=get('data-coefficient-derivation','stage'),footerLayer=get('data-coefficient-derivation','footer');
  const goSub=t=>t<.48?go('coefficient-point',t/.48):t<.75?go('coefficient-sum',(t-.48)/.27):go('coefficient-read',(t-.75)/.25);
  const boundaries=[0,.035,.07,.08,.10,.11,.115,.145,.175,.18,.20,.215,.22,.235,.25,.27,.29,.31,.33,.35,.37,.405,.425,.45,.48,.50,.515,.525,.54,.545,.555,.565,.59,.70,.75,.77,.79,.82,.90,1],derivationSnapshots=new Map();
  const mainActors=h.nodes.filter(n=>['coefficient-ratio','coefficient-derivation-footer','coefficient-read-cards'].includes(n.attrs['data-actor-owner']));
  for(const t of [...boundaries,...boundaries.toReversed()]){
    goSub(t);near(stageLayer.attrs['data-sub-progress'],t,1e-7);near(footerLayer.attrs['data-sub-progress'],t,1e-7);
    assert.equal(stageLayer.attrs['aria-label'],footerLayer.attrs['aria-label']);
    assert.ok(visible(derivation('factor'))*visible(derivation('estimate'))===0,'estimated hats replace the original coefficient without overlapping ink');
    for(const key of ['V','U','star','bottomStar','energy','topSum','bottomSum','factor','estimate','numeratorU','numeratorEnergy','numeratorFactor']){
      near(visible(derivation(key)),visible(footerActor(key)));
      assert.equal(derivation(key).attrs['data-tex'],footerActor(key).attrs['data-tex']);
    }
    const coordinates=h.nodes.filter(n=>n.attrs['data-coordinate-subscript']!==undefined);
    if(t>=.565)coordinates.forEach(n=>{near(parseFloat(n.attrs.width),0);near(n.style.opacity,0);});
    const snapshot=mainActors.map(n=>({...n.attrs}));
    if(derivationSnapshots.has(t))assert.deepEqual(snapshot,derivationSnapshots.get(t),'every intermediate formula survives reverse seeking');else derivationSnapshots.set(t,snapshot);
  }
  goSub(.07);near(visible(get('data-frequency-map')),0);near(visible(get('data-frequency-pair')),0);
  goSub(.175);near(visible(derivation('V')),1);near(visible(derivation('U')),1);near(visible(derivation('star')),0);
  goSub(.25);near(visible(derivation('star')),1);near(visible(derivation('energy')),1);near(visible(derivation('U')),0);near(visible(derivation('bottomStar')),0);
  goSub(.32);near(visible(derivation('V')),0);near(visible(derivation('numeratorU')),1);near(visible(derivation('numeratorFactor')),1);
  goSub(.38);near(visible(derivation('star')),0);near(visible(derivation('numeratorEnergy')),1);
  goSub(.46);near(visible(derivation('V')),1);near(visible(derivation('star')),1);near(visible(derivation('numeratorFactor')),0);
  goSub(.57);near(visible(derivation('topSum')),1);near(visible(derivation('bottomSum')),1);near(visible(derivation('estimate')),1);near(visible(get('data-coefficient-cards')),0);
  goSub(1);near(visible(get('data-coefficient-card','m̂')),1);near(visible(get('data-coefficient-card','φ̂Δ')),1);
  assert.equal(h.nodes.filter(n=>n.attrs['data-coefficient-card']!==undefined).length,2,'the final output has the requested two result cards');
  const localRenders=h.mathRenders,localMeasurements=h.work.measurements;
  for(const t of boundaries.toReversed())goSub(t);
  assert.equal(h.mathRenders,localRenders,'seeks do not compile equations again');assert.equal(h.work.measurements,localMeasurements,'seeks do not measure equations again');
  const actor=key=>h.nodes.find(n=>n.attrs['data-actor-owner']==='coefficient-correspondence'&&n.attrs['data-math-actor']===key);
  go('least-squares-fit',.10);
  const footer=get('data-coefficient-footer','coefficient-correspondence'),formula=get('data-correspondence-formula'),retainedU=actor('U');
  assert.equal(footer.style.visibility,'visible');assert.equal(formula.parent,footer);
  assert.equal(footer.parent,h.byId.get(main?'equation':'pe-equation'),'the derivation lives in the requested formula area');
  const recall=get('data-correspondence-recall','recall');
  assert.equal(recall.attrs['data-tex'],OTF.formulas.correct);assert.equal(formula.attrs['aria-label'],OTF.formulas.correct);
  near(visible(recall),1);near(visible(actor('U')),0);
  near(visible(fraction),0);
  const anchor=registry.resolve({scene:(main?'parameters.':'')+'refine',beat:'returnSpectrum',progress:.694});
  if(main){h.byId.get('progress').value=anchor.position;h.byId.get('progress').dispatch('input');}else ctx.SIMParameterDemo.player.seek(anchor.position);
  const descendants=node=>[node,...node.children.flatMap(descendants)];
  const spectrumNodes=[...descendants(get('data-frequency-map')),...descendants(get('data-frequency-pair'))];
  const spectrumSnapshot=()=>spectrumNodes.map(n=>({attrs:{...n.attrs},text:n.textContent,alpha:visible(n)}));
  const original=spectrumSnapshot(),images=h.nodes.filter(n=>n.attrs['data-shared-band']!==undefined);
  const oldLock=get('data-locked-wavevector'),recallHeading=get('data-coefficient-recall-heading'),caption=get('data-coefficient-reliable-caption');
  const holds=[.000001,.02,.06,.10,.15,.22,.35,.45,.56,.69,.82,1];
  for(const p of [...holds,...holds.toReversed()]){
    const progress=go('least-squares-fit',p),expected=S.state(lesson,progress);
    assert.deepEqual(spectrumSnapshot(),original,'keep the exact returnSpectrum/.694 spectrum through the whole correspondence beat');
    assert.deepEqual(h.nodes.filter(n=>n.attrs['data-shared-band']!==undefined),images);
    near(visible(oldLock),1);
    near(visible(get('data-otf-normalization')),expected.recall);near(visible(recallHeading),expected.recall);
    for(const name of ['P','Q','R'])near(visible(get('data-reference-point',name)),0);
  }
  go('least-squares-fit',.56);
  assert.equal(caption.textContent,'公共区 Ω 内两边光学传递函数 H 都可靠');near(visible(caption),1);
  assert.ok(+caption.attrs.x>800,'the new recap text stays on the right');
  // Only the following single-point scene releases the retained overview.
  go('coefficient-point',.09);assert.ok(visible(get('data-frequency-map'))>0&&visible(get('data-frequency-map'))<1);
  go('coefficient-point',.19);near(visible(get('data-frequency-map')),0);assert.equal(get('data-coefficient-plane'),undefined);near(visible(recallHeading),0);
  go('least-squares-fit',1);assert.deepEqual(spectrumSnapshot(),original);
  const slots=h.nodes.filter(n=>n.attrs['data-wavevector-slot']!==undefined);
  assert.deepEqual(slots.map(n=>n.attrs['data-wavevector-slot']),['V-subscript','conjugate-address','sideband-address','denominator-address','sample-address']);
  const dimensions=slots.map(n=>[n.attrs.width,n.attrs.height,n.attrs.depth]);
  go('least-squares-fit',.21);
  const stationary=descendants(recall).filter(n=>n!==recall&&n.attrs['data-wavevector-slot']===undefined&&n.attrs['data-wavevector-glyph']===undefined);
  const still=()=>stationary.map(n=>({attrs:{...n.attrs},text:n.textContent,html:n.innerHTML})),beforeHop=still();
  const hopSamples=[.21,.22,.24,.252,.26,.27,.28,.288,.30,.33,.35],hopSnapshots=new Map();
  for(const p of [...hopSamples,...hopSamples.toReversed()]){
    go('least-squares-fit',p);const expected=S.wavevectorLock(p);
    near(visible(recall),1);
    assert.deepEqual(still(),beforeHop,'only the five candidate symbols animate');
    assert.deepEqual(slots.map(n=>[n.attrs.width,n.attrs.height,n.attrs.depth]),dimensions,'slot dimensions remain fixed during the hop');
    assert.deepEqual(spectrumSnapshot(),original);
    slots.forEach(slot=>{
      near(slot.attrs['data-lift'],expected.lift);
      slot.children.forEach(layer=>{near(parseFloat(layer.attrs.voffset),expected.lift);near(visible(layer),expected[layer.attrs['data-wavevector-glyph']]);});
    });
    const snapshot=slots.flatMap(slot=>[slot,...slot.children]).map(n=>({attrs:{...n.attrs},opacity:n.style.opacity,color:n.style.color}));
    if(hopSnapshots.has(p))assert.deepEqual(snapshot,hopSnapshots.get(p));else hopSnapshots.set(p,snapshot);
  }
  const symbols=html=>html.replace(/<annotation\b[\s\S]*?<\/annotation>/g,'').replace(/<[^>]*>/g,'').replace(/&#x([\da-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)));
  const nativeSymbols=(node,glyph)=>node.style.opacity==='0'||node.attrs['data-wavevector-glyph']&&node.attrs['data-wavevector-glyph']!==glyph?'':symbols(node.innerHTML)+node.textContent+node.children.map(n=>nativeSymbols(n,glyph)).join('');
  for(const [p,key,glyph]of [[.21,'recall','prime'],[.33,'locked','hat'],[.39,'aligned','hat'],[.445,'quotients','hat'],[.51,'definitions','hat']]){
    go('least-squares-fit',p);
    const expected=symbols(katex.renderToString(S.correspondenceFormulas[key].slice(2,-2),{displayMode:true,output:'mathml',throwOnError:true,strict:'error'}));
    assert.equal(nativeSymbols(recall,glyph),expected,'retained MathML preserves every symbol of the source equation');
  }
  const retainedRows=descendants(recall),bridgeSamples=[.35,.36,.375,.39,.40,.415,.43,.445,.46,.475,.50,.51],bridgeSnapshots=new Map();
  for(const p of [...bridgeSamples,...bridgeSamples.toReversed()]){
    go('least-squares-fit',p);const bridge=S.correspondenceBridge(p);
    assert.deepEqual(descendants(recall),retainedRows,'the original two rows survive every bridge seek');
    near(visible(recall),1);near(visible(actor('U')),0);
    const residual=get('data-correspondence-collapse','sample-residual');near(residual.attrs['data-collapse'],bridge.aligned);
    for(const key of ['reference-conjugate','side-conjugate','reference-left-modulus','side-left-modulus','reference-modulus-square','side-modulus-square','locked-subscript']){
      const pad=get('data-correspondence-collapse',key);near(pad.attrs['data-collapse'],bridge.quotient);
      if(parseFloat(pad.attrs.width)<1e-8)near(visible(pad.children[0]),0);
    }
    const snapshot=retainedRows.map(n=>({attrs:{...n.attrs},opacity:n.style.opacity}));
    if(bridgeSnapshots.has(p))assert.deepEqual(snapshot,bridgeSnapshots.get(p));else bridgeSnapshots.set(p,snapshot);
  }
  go('least-squares-fit',.33);near(visible(recall),1);near(visible(actor('V')),0);
  assert.equal(recall.attrs['data-notation'],'locked');assert.equal(recall.attrs['data-tex'],S.correspondenceFormulas.locked);
  assert.equal(formula.attrs['aria-label'],S.correspondenceFormulas.locked);
  for(const p of [.46,.467,.475,.485,.493,.50,.51,.52]){
    go('least-squares-fit',p);const motion=S.correspondenceMotion(p);
    near(visible(recall),1);near(visible(actor('U')),0);
    const alpha=get('data-coefficient-glyph','alpha'),factor=get('data-coefficient-glyph','factor');
    near(visible(alpha),motion.alpha);near(visible(factor),motion.factor);near(visible(alpha)*visible(factor),0);
    near(visible(get('data-correspondence-part','reference')),1);near(visible(get('data-correspondence-part','side')),1);
    near(visible(get('data-correspondence-part','sampleU')),1);near(visible(get('data-correspondence-part','sampleV')),1);
  }
  go('least-squares-fit',.53);
  for(const key of ['U','defineU','reference','eqU','sampleU','V','defineV','side','eqV','factor','sampleV'])near(visible(actor(key)),1);
  assert.equal(actor('defineU').attrs['data-tex'],'=');
  go('least-squares-fit',.63);near(visible(actor('factor')),0);near(visible(actor('alpha')),0);
  go('least-squares-fit',.68);near(visible(actor('alpha')),1);near(visible(actor('factor')),0);
  const uFrom=actor('U').attrs.transform;
  go('least-squares-fit',.735);assert.notEqual(actor('U').attrs.transform,uFrom);assert.ok(visible(actor('sampleV'))<1);
  go('least-squares-fit',.79);
  for(const key of ['V','eqV','alpha','U','alphaDefinition'])near(visible(actor(key)),1);
  near(visible(actor('sampleV')),0);near(visible(actor('sampleU')),0);
  for(const p of [.82,.84,.86,.87,.89,.92]){
    go('least-squares-fit',p);near(visible(actor('factor'))*visible(actor('alpha')),0);
  }
  go('least-squares-fit',1);
  assert.equal(formula.attrs['data-substep'],'restore-factor');assert.equal(formula.attrs['aria-label'],S.correspondenceFormulas.result);
  for(const key of ['V','eqV','left','factor','right','U'])near(visible(actor(key)),1);
  for(const key of ['reference','side','alpha','alphaDefinition','sampleU','sampleV'])near(visible(actor(key)),0);
  near(visible(recall),0);
  const stageFactor=get('data-coefficient-stage-factor'),stageAlpha=get('data-otf-term','alpha'),stageSample=get('data-otf-term','sample:1'),stageReference=get('data-otf-term','reference');
  const synchronization=[.445,.46,.467,.475,.485,.493,.50,.51,.52,.59,.61,.63,.64,.655,.675,.69,.735,.78,.82,.84,.86,.87,.895,.92,1],synchronized=new Map();
  for(const p of [...synchronization,...synchronization.toReversed()]){
    go('least-squares-fit',p);const motion=S.correspondenceMotion(p);
    near(visible(stageFactor),motion.factor);near(visible(stageAlpha),motion.alpha);
    near(visible(stageFactor)*visible(stageAlpha),0);
    near(visible(stageSample),1-motion.substitute);near(visible(stageReference),motion.substitute);
    if(p>=.53){near(visible(actor('factor')),motion.factor);near(visible(actor('alpha')),motion.alpha);}
    near(get('data-otf-normalization').attrs['data-coefficient-expansion'],motion.growth);
    const snapshot=[stageFactor,stageAlpha,stageSample,stageReference].map(n=>({...n.attrs}));
    if(synchronized.has(p))assert.deepEqual(snapshot,synchronized.get(p));else synchronized.set(p,snapshot);
  }
  go('least-squares-fit',.95);assert.equal(get('data-otf-normalization').attrs['aria-label'],'V = (m e^{iφΔ}) U');
  const correspondenceRenders=h.mathRenders,correspondenceMeasurements=h.work.measurements;
  for(const p of [.31,.68,.735,.04,.95])go('least-squares-fit',p);
  assert.equal(h.mathRenders,correspondenceRenders);assert.equal(h.work.measurements,correspondenceMeasurements);
  assert.equal(actor('U'),retainedU);
  for(const [old,beat]of Object.entries(S.legacy)){
    const location=registry.resolve({scene:(main?'parameters.':'')+'least-squares-fit',beat:old,progress:.37});assert.equal(location.entry.coefficientBeat,beat);
  }
  for(const old of Object.keys(S.legacyScenes)){const loc=registry.resolve({scene:(main?'parameters.':'')+old,progress:.2});assert.equal(loc.entry.coefficientBeat,S.legacyScenes[old]);}
  lesson.estimate.finalPeak.prepared.forEach((z,i)=>{assert.deepEqual(Array.from(z.re),before[i].re);assert.deepEqual(Array.from(z.im),before[i].im);});
  if(!main){
    h.byId.get('pe-theory-toggle').dispatch('click');assert.equal(h.byId.get('pe-theory').open,true);
    const position=ctx.SIMParameterDemo.player.state().position;
    h.doc.dispatch('click',{button:0,clientX:1200,target:h.byId.get('pe-theory')});h.doc.dispatch('keydown',{key:'ArrowRight',target:h.byId.get('pe-theory')});
    near(ctx.SIMParameterDemo.player.state().position,position);
    h.byId.get('pe-theory-close').dispatch('click');assert.equal(h.byId.get('pe-theory').open,false);
  }
  assert.deepEqual(h.errors,[]);
});
