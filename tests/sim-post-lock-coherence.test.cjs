/* Semantic regressions for the post-lock review; no browser or visual verdict. */
const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../web/atlas/sim-atlas-core.js');
const M=require('../web/motion/sim-motion-model.js');
const Chapter=require('../web/motion/sim-motion-parameter-chapter.js');
const Peak=require('../web/parameter-demo/scenes/get-peak/state.js');
const Clock=require('../web/shared/animation/beat-clock.js');
const katex=require('../vendor/katex/katex.min.js');
const before=require('./fixtures/sim-motion/2026-10-18-post-lock-before.json');
const boot=require('./helpers/motion-dom.cjs');
const near=(a,b,tol=1e-9)=>assert.ok(Number.isFinite(+a)&&Math.abs(+a-b)<tol,`${a} != ${b}`);
const capture=A.capture({sample:'star-points',directions:3,m:.8,noise:'none'});
const chapter=Chapter.create({raw:capture.raw,config:{n:capture.raw.n,cutoff:A.KC},direction:0});
const reconstruction=chapter.reconstructAll(),lesson=M.createLesson({capture,pipeline:reconstruction.pipeline});
const scene=id=>M.scenes.find(s=>s.id===id);
const at=(id,key,local)=>scene(id).timeline.progressFor(key,local);
const frame=(id,key,local)=>M.fusionFrame(lesson,({ 'otf-weight':16,'sum-contributions':17,wiener:18 })[id]+at(id,key,local));

test('the retained acquisition and all recorded numerical results agree with the before version',()=>{
  for(const [key,value] of Object.entries(before.numerical.audit))near(lesson.audit[key],value,1e-11);
  near(lesson.audit.preApoTransfer,before.numerical.highFrequency.preApo);
  near(lesson.audit.window,before.numerical.highFrequency.window);
  near(lesson.audit.dcTransfer,before.numerical.dc);
  for(const [d,p] of reconstruction.parameters.entries())for(const key of ['kx','ky','m','phase'])near(p[key],before.numerical.directions[d][key]);
  for(const [d,group] of reconstruction.pipeline.raw.groups.entries())for(const [j,f] of group.frames.entries())assert.equal(f.pixels,capture.raw.groups[d].frames[j].pixels);
  near(lesson.audit.preApoTransfer*lesson.audit.window,lesson.audit.ratio,1e-11);
});

test('getPeak explains the ratio before division and the ideal product relation holds over the full field',()=>{
  const peak=chapter.lesson.estimate.finalPeak;
  assert.equal(peak.count,128**2);
  assert.ok(peak.supportCounts.every(count=>count>0&&count<peak.count));
  let residual=0,energy=0;
  for(let i=0;i<peak.count;i++){
    const u={re:peak.spatial[0].re[i],im:peak.spatial[0].im[i]},a=peak.alpha;
    const re=a.re*u.re-a.im*u.im,im=a.re*u.im+a.im*u.re;
    residual+=(peak.shifted.re[i]-re)**2+(peak.shifted.im[i]-im)**2;
    energy+=peak.shifted.re[i]**2+peak.shifted.im[i]**2;
    near(peak.product.re[i],a.re*peak.energy[i],1e-10);
    near(peak.product.im[i],a.im*peak.energy[i],1e-10);
  }
  assert.ok(Math.sqrt(residual/energy)<1e-12);
  assert.match(Peak.formulas.finalCompare,/alpha u/);
  assert.match(Peak.formulas.finalProduct,/underbrace/);
  assert.match(Peak.formulas.finalDivide,/Longrightarrow/);
  assert.doesNotMatch(Peak.entry.copy,/保持这些位置|比较公共点的相位/);
  near(peak.cross.re,peak.alpha.re*peak.referenceEnergy);
});

test('the fitting objective and normal equation retain both observations before any conjugate multiplication',()=>{
  const unit=scene('otf-weight'),first=lesson.pipeline.bands[0],other=lesson.pipeline.bands[2];
  const order=key=>unit.beats.findIndex(b=>b.key===key);
  assert.ok(order('fitObjective')>=0&&order('fitObjective')<order('normalEquation'));
  assert.ok(order('normalEquation')<order('conjugateWeight'));
  for(const key of ['fitObjective','normalEquation'])for(const local of [.01,.47,.99]){
    const f=frame('otf-weight',key,local);
    assert.equal(f.showOperators,false);near(f.cues.weight,0);
    assert.equal(f.views[0].from,first.shifted);assert.equal(f.views[1].from,other.shifted);
    for(const i of [0,A.idx(6,0,256),A.idx(-6,7,256)]){
      near(M.pixel(f.views[2],i).re,first.shifted.re[i]);
      near(M.pixel(f.views[2],i).im,first.shifted.im[i]);
    }
  }
  const product=frame('otf-weight','conjugateWeight',1),i=A.idx(6,0,256);
  assert.equal(product.showOperators,true);near(product.cues.weight,1);
  near(M.pixel(product.views[2],i).re,first.matched.re[i]);
  near(M.pixel(product.views[2],i).im,first.matched.im[i]);
  assert.ok(Math.hypot(first.matched.re[i]-first.shifted.re[i],first.matched.im[i]-first.shifted.im[i])>1e-6);
});

test('the first multiply and add finish separately, and the final sum keeps all nine contributions',()=>{
  const first=lesson.records[0],mul=frame('sum-contributions','firstWeight',1),half=frame('sum-contributions','firstAdd',.47);
  const sum=frame('sum-contributions','basicResponse',.5);
  assert.equal(mul.completed,0);assert.equal(half.index,0);assert.equal(sum.completed,9);
  near(half.cues.firstAdd,.5,1e-10);
  for(let i=0;i<first.after.re.length;i++){
    near(M.pixel(mul.views[1],i).re,first.band.matched.re[i]);
    near(M.pixel(mul.views[2],i).re,0);
    near(M.pixel(half.views[2],i).re,first.after.re[i]*half.cues.firstAdd);
    near(M.pixel(half.views[2],i).im,first.after.im[i]*half.cues.firstAdd);
    near(M.pixel(sum.views[2],i).re,lesson.pipeline.numerator.re[i]);
    near(M.pixel(sum.views[2],i).im,lesson.pipeline.numerator.im[i]);
  }
});

test('R0 transitions to the source denominator with only one extra zero-order term per direction',()=>{
  const p=lesson.pipeline,middle=frame('wiener','sourceDenominator',.47),ready=frame('wiener','sourceDenominator',1),done=frame('wiener','normalize',1);
  for(let i=0;i<p.denominator.length;i++){
    const extra=p.bands.filter(b=>b.order===0).reduce((total,b)=>total+b.h[i]**2,0);
    near(p.denominator[i]-p.signalResponse[i],extra);
    near(M.pixel(middle.views[1],i).re,p.signalResponse[i]+extra/2);
    near(M.pixel(ready.views[2],i).re,p.numerator.re[i]);
    near(M.pixel(done.views[2],i).re,p.preApoSpectrum.re[i]);
    near(M.pixel(done.views[2],i).im,p.preApoSpectrum.im[i]);
  }
});

test('new beat timings can change without altering formulas, narration or per-beat numerical operations',()=>{
  for(const id of ['otf-weight','sum-contributions','wiener','relocate-bands']){
    const unit=scene(id),make=id==='relocate-bands'?null:require('../web/motion/scenes/'+id+'/state.js')({clamp:M.clamp,smooth:x=>{x=M.clamp(x);return x*x*(3-2*x);}});
    for(const selected of unit.beats){
      const changed=Clock.define(unit.beats.map(b=>({...b,duration:b.duration*(b.key===selected.key?1.7:1)})));
      for(const beat of unit.beats)for(const local of [.01,.47,.99]){
        const a=unit.present(unit.timeline.progressFor(beat.key,local)),b=unit.present(changed.progressFor(beat.key,local),changed);
        for(const key of ['mode','title','copy','equation','note'])assert.equal(a[key],b[key]);
        for(const key of Object.keys(a.cues))near(a.cues[key],b.cues[key]);
        assert.doesNotThrow(()=>katex.renderToString(a.equation.slice(2,-2),{throwOnError:true,output:'mathml'}));
        if(make){const old=make(lesson,unit.timeline.progressFor(beat.key,local)),next=make(lesson,changed.progressFor(beat.key,local),changed);assert.equal(old.index,next.index);for(let v=0;v<3;v++)for(const i of [0,A.idx(14,0,256),A.idx(-6,7,256)]){const z=M.pixel(old.views[v],i),w=M.pixel(next.views[v],i);for(const k of ['re','im'])near(z[k],w[k],1e-10*Math.max(1,Math.abs(z[k])));}}
      }
    }
  }
});

test('frequency-grid preparation precedes relocation and preserves signed frequency addresses',()=>{
  const unit=scene('relocate-bands');
  near(unit.movement(at('relocate-bands','embedGrid',.99)),0);
  near(unit.movement(1),1);
  for(const z of lesson.group.separated){
    const padded=A.padSpectrum(z,128);
    for(let y=0;y<256;y++)for(let x=0;x<256;x++){
      const qx=A.bin(x,256),qy=A.bin(y,256),i=y*256+x;
      const supported=qx>=-64&&qx<64&&qy>=-64&&qy<64;
      near(padded.re[i],supported?z.re[A.idx(qx,qy,128)]:0);
      near(padded.im[i],supported?z.im[A.idx(qx,qy,128)]:0);
    }
  }
});

test('production headings, cached formulas and fusion frames follow the selected beat in both directions',()=>{
  const h=boot(),flow=h.context.SIMMotionParameterChapter.plan(h.context.SIMMotion),slider=h.byId.get('progress');
  assert.deepEqual(h.errors,[]);
  const samples=[];
  for(const id of ['relocate-bands','otf-weight','sum-contributions','wiener'])for(const beat of scene(id).beats)samples.push({id,p:scene(id).timeline.progressFor(beat.key,.47),key:beat.key});
  const snapshots=new Map();
  for(const sample of [...samples,...samples.toReversed()]){
    const {id,p,key}=sample,position=flow.index(id)-1+p;
    slider.value=position;slider.dispatch('input');
    const expected=scene(id).present(p),equation=h.byId.get('equation');
    assert.equal(h.byId.get('scene-title').textContent,expected.title);
    assert.equal(h.byId.get('equation-note').textContent,expected.note);
    assert.equal(equation.attrs['data-motion-formula-mode'],id+':'+key);
    if(id!=='relocate-bands')assert.equal(h.byId.get('fusion-stage').attrs['data-fusion-mode'],key);
    if(id==='otf-weight'){
      const operators=h.nodes.filter(n=>n.parent===h.byId.get('fusion-stage')&&n.attrs.class==='operation-sign');
      assert.equal(operators.length,2);
      const expectedOpacity=['fitObjective','normalEquation'].includes(key)?0:1;
      for(const operator of operators)near(operator.style.opacity,expectedOpacity);
    }
    const snapshot=[h.byId.get('scene-title').textContent,h.byId.get('equation-note').textContent,equation.children[0].innerHTML];
    const cacheKey=id+':'+key;
    if(snapshots.has(cacheKey))assert.deepEqual(snapshot,snapshots.get(cacheKey));else snapshots.set(cacheKey,snapshot);
    const renders=h.mathRenders;slider.value=position+1e-6;slider.dispatch('input');assert.equal(h.mathRenders,renders,'same beat reuses its compiled formula');
  }
  const bars=h.nodes.filter(n=>n.attrs['data-transfer-step']);
  assert.equal(bars.length,4);
  const values=Object.fromEntries(bars.map(b=>[b.attrs['data-transfer-step'],+b.attrs['data-transfer-value']]));
  near(values.wiener*values.window,values.final);
  assert.equal(h.nodes.find(n=>n.attrs['data-relocation-grid']!==undefined).attrs['data-grid-output'],'256');
  assert.deepEqual(h.errors,[]);
});

test('the illumination illustration changes only the indicated physical quantity and keeps relative phase steps',()=>{
  const cue=t=>Chapter.provisionalState(t/132).illumination;
  const k0=cue(22),k1=cue(25),m0=cue(25.5),m1=cue(28.3),p0=cue(28.8),p1=cue(31.5);
  near(cue(19.5).formula,0);near(cue(20.3).formula,1);
  near(cue(20.9).body,0);near(cue(21.8).body,1);
  assert.equal(cue(21.8).direction,0,'the parameter changes start after the body has entered');
  assert.notEqual(k0.kx,k1.kx);assert.notEqual(k0.ky,k1.ky);
  near(k0.m,k1.m);near(k0.phase,k1.phase);
  for(const key of ['kx','ky','phase'])near(m0[key],m1[key]);
  assert.ok(m1.m<m0.m);
  for(const key of ['kx','ky','m'])near(p0[key],p1[key]);
  near(p1.phase-p0.phase,Math.PI/2);
  for(let j=0;j<3;j++)near((p1.relativePhases[j]+p1.phase)-(p0.relativePhases[j]+p0.phase),Math.PI/2);
  for(let t=19.5;t<=32;t+=.1){const s=Chapter.provisionalState(t/132);assert.equal(s.kHop,0);assert.equal(s.amplitudeHop,0);}
});

test('the fusion explanation uses a nonzero overlap contribution and carries the previous product into the sum',()=>{
  const weighted=frame('otf-weight','weightReady',1),next=frame('sum-contributions','firstWeight',.000001);
  assert.deepEqual(weighted.focus,[6,0]);assert.deepEqual(next.focus,[6,0]);
  const i=A.idx(6,0,256),empty=A.idx(14,0,256),first=lesson.pipeline.bands[0];
  assert.ok(first.h[i]>0);assert.equal(first.h[empty],0);
  const z=M.pixel(next.views[1],i),previous=M.pixel(weighted.views[2],i);
  assert.ok(Math.hypot(z.re,z.im)>0);near(z.re,previous.re);near(z.im,previous.im);
  assert.equal(next.completed,0);near(M.pixel(next.views[2],i).re,0);
});

test('compensation, the separated-band hold and the ending preserve their meanings on backward seeks',()=>{
  const h=boot(),flow=h.context.SIMMotionParameterChapter.plan(h.context.SIMMotion),slider=h.byId.get('progress');
  const get=key=>h.nodes.find(n=>n.attrs[key]!==undefined);
  const seek=(id,p)=>{slider.value=flow.index(id)-1+p;slider.dispatch('input');};
  assert.deepEqual(h.errors,[]);
  seek('adopted-weights',.95);
  // Read the full array; the former probe display divided values by N².
  const out=get('data-compensated-band-vector'),band=lesson.group.separated[1],target={re:band.re[6],im:band.im[6]};
  near(out.attrs['data-re'],target.re/(128*128));near(out.attrs['data-im'],target.im/(128*128));
  assert.ok(+get('data-adopted-compensation').style.opacity>0);
  assert.equal(h.nodes.filter(n=>n.attrs['data-adopted-parameter']!==undefined).length,3);
  seek('separate-bands',.90);
  near(flow.frame(flow.index('separate-bands')-1+.90).baseTime,11);
  assert.equal(h.byId.get('equation').hidden,false);
  assert.equal(h.byId.get('demix-equations').hidden,true);
  assert.match(h.byId.get('scene-description').textContent,/检测频率.*H\(f\)/);
  seek('separate-bands',.5);
  assert.equal(h.byId.get('equation').hidden,true);assert.equal(h.byId.get('demix-equations').hidden,false);
  const modes=[['image-comparison',.3,'structure'],['image-comparison',.8,'profile'],['frequency-audit',.3,'highFrequency'],['frequency-audit',.8,'globalError']];
  const snapshots=new Map();
  for(const [id,p,mode] of [...modes,...modes.toReversed()]){
    seek(id,p);
    assert.equal(h.byId.get('comparison-stage').attrs['data-comparison-mode'],mode);
    const metrics=+get('data-comparison-global-error').style.opacity;
    assert.equal(metrics,mode==='globalError'?1:0,'RMSE is presented only after high-frequency recovery');
    const snapshot=[get('data-comparison-structure').style.opacity,get('data-comparison-high-frequency').style.opacity,metrics];
    if(snapshots.has(mode))assert.deepEqual(snapshot,snapshots.get(mode));else snapshots.set(mode,snapshot);
  }
  for(const id of ['inverse-fft','image-comparison','frequency-audit'])assert.ok(scene(id).duration>=4000);
  assert.equal(h.nodes.filter(n=>n.attrs['data-structure-detail']!==undefined).length,3);
  assert.deepEqual(h.errors,[]);
});
