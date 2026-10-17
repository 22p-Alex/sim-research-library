/* Numerical Fourier identities and reversible DOM state. No browser/visual QA. */
const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../web/atlas/sim-atlas-core.js'),E=require('../web/shared/sim-parameter-estimation.js');
const M=require('../web/parameter-demo/sim-parameter-model.js'),L=require('../web/parameter-demo/sim-parameter-two-stage.js');
const boot=require('./helpers/motion-dom.cjs');
const visibleAlpha = node => { let alpha=1; for(let n=node;n;n=n.parent) alpha *= Number(n.attrs.opacity ?? n.style.opacity ?? 1); return alpha; };
const near=(a,b,tol=1e-9)=>assert.ok(Number.isFinite(+a)&&Math.abs(+a-b)<=tol*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const capture=E.capture(),lesson=M.createLesson({raw:capture.raw,config:capture.config});

test('fractional phase modulation equals direct Fourier evaluation, preserves energy and leaves observations intact',()=>{
  const data=L.refinementDataFor(lesson),n=data.n,kx=8.25,ky=-.15,raw=data.raw;
  const snapshot={re:raw.re.slice(),im:raw.im.slice()},f=data.at(kx,ky);
  assert.equal(data.at(kx,ky),f,'cache the candidate calculation for replay');
  const energy=z=>z.re.reduce((sum,re,i)=>sum+re*re+z.im[i]*z.im[i],0);
  near(energy(f.modulated),energy(data.spatial),1e-12);
  // Evaluate the finite Fourier sum directly at q+k; this is independent of
  // FFT modulation and checks the exponent sign and the fractional address.
  for(const [qx,qy] of [[0,0],[-3,2],[4,-1]]) {
    let re=0,im=0;
    for(let y=0;y<n;y++)for(let x=0;x<n;x++) {
      const i=y*n+x,theta=-2*Math.PI*((qx+kx)*x+(qy+ky)*y)/n,c=Math.cos(theta),s=Math.sin(theta);
      re+=data.spatial.re[i]*c-data.spatial.im[i]*s;im+=data.spatial.re[i]*s+data.spatial.im[i]*c;
    }
    const i=A.idx(qx,qy,n);near(f.shifted.re[i],re,1e-8);near(f.shifted.im[i],im,1e-8);
  }
  const recovered=A.shift(f.shifted,-kx,-ky,n);
  for(let i=0;i<n*n;i++){near(recovered.re[i],raw.re[i],1e-9);near(recovered.im[i],raw.im[i],1e-9);}
  for(const point of f.comparison.points) {
    const i=A.idx(...point.q,n),h=A.otf(point.q[0]+kx,point.q[1]+ky,capture.config.cutoff);
    near(point.y.re,f.shifted.re[i]/h);near(point.y.im,f.shifted.im[i]/h);
  }
  assert.deepEqual(raw,snapshot);assert.equal(L.refinementDataFor(lesson),data);
});

test('the three phases use the actual nested 5 by 5 searches and never claim measurement accuracy from step size',()=>{
  for(const [p,mode] of [[0,'gridLimit'],[.219,'gridLimit'],[.22,'phaseRamp'],[.559,'phaseRamp'],[.56,'zoomCascade'],[.934,'zoomCascade'],[.935,'returnSpectrum']])
    assert.equal(L.refinementState(lesson,p).mode,mode);
  const sweep=L.refinementState(lesson,.415);
  assert.equal(sweep.count,0);assert.ok(!Number.isInteger(sweep.candidate.kx)&&!Number.isInteger(sweep.candidate.ky));
  near(sweep.candidate.score,E.compare(lesson.estimate.context,sweep.candidate.kx,sweep.candidate.ky).score);
  for(const [round,start,end] of [[0,.43,.54],[1,.735,.825],[2,.875,.915]]) {
    let count=0;
    for(let j=0;j<=20;j++) {
      const s=L.refinementState(lesson,start+(end-start)*j/20),r=lesson.estimate.rounds[round];
      assert.equal(s.round,round);assert.ok(s.count>=count);count=s.count;
      near(s.step,[.25,.05,.01][round]);near(s.halfWidth,[.5,.1,.02][round]);
      assert.equal(s.candidates,r.candidates);
      if(round)assert.deepEqual(s.center,{kx:lesson.estimate.rounds[round-1].best.kx,ky:lesson.estimate.rounds[round-1].best.ky});
      for(let i=0;i<25;i++){near(s.candidates[i].kx,s.center.kx+(i%5-2)*s.step);near(s.candidates[i].ky,s.center.ky+(Math.floor(i/5)-2)*s.step);}
    }
    assert.equal(count,25);
  }
  const final=L.refinementState(lesson,1);near(final.candidate.kx,lesson.estimate.kx);near(final.candidate.ky,lesson.estimate.ky);
  assert.match(L.scene('refine').note,/搜索步长不是测量精度/);
  assert.doesNotMatch(L.refinementNarrative(1).title,/精确|精度/);
});

test('the overview return starts after the final grid is locked and preserves the adopted vector and score',()=>{
  let previous=0;
  for(const p of [.915,.93,.935,.947,.96,.975,.985,.99,1]) {
    const s=L.refinementState(lesson,p);
    assert.equal(s.count,25);assert.equal(s.done,true);near(s.candidate.kx,lesson.estimate.kx);near(s.candidate.ky,lesson.estimate.ky);near(s.candidate.score,lesson.estimate.fit.score);
    if(s.returnView.collapse>0)near(s.lock,1);
    assert.ok(s.returnView.overview>=previous);previous=s.returnView.overview;
  }
  const end=L.refinementState(lesson,1);
  for(const value of Object.values(end.returnView))near(value,1);
  assert.equal(L.formulaMode(L.stateForScene('refine',1)),'refine-returnSpectrum');
});

test('the selected spatial pixel multiplies by the actual unit phasor and Fourier evaluation follows the completed multiplication',()=>{
  const data=L.refinementDataFor(lesson),probe=data.probe(8.5,-.25),f=data.at(8.5,-.25),i=probe.y*data.n+probe.x;
  near(Math.hypot(probe.unit.re,probe.unit.im),1,1e-12);
  near(probe.b.re,f.modulated.re[i]);near(probe.b.im,f.modulated.im[i]);
  near(Math.hypot(probe.a.re,probe.a.im),Math.hypot(probe.b.re,probe.b.im),1e-12);
  for(const p of [.22,.28,.29,.30,.32,.34,.36,.38,.40,.415,.43,.50]) {
    const s=L.refinementState(lesson,p),demo=s.phaseDemo;
    if(demo.multiply>0)near(demo.factor,1);
    if(demo.forward>0)near(demo.multiply,1);
    if(s.count>0)near(demo.forward,1);
  }
});

test('the zoom surface samples only observed scores and does not fabricate a displaced true peak',()=>{
  Object.defineProperty(lesson.capture,'truth',{configurable:true,get(){throw new Error('Refinement accessed simulation truth');}});
  const data=L.refinementDataFor(lesson),surface=data.surface(),side=surface.side,coarse=lesson.estimate.coarseBest;
  assert.equal(surface.points.length,side*side);assert.equal(data.surface(),surface);
  for(const i of [0,side-1,(side*side-1)/2,side*side-1]) {
    const p=surface.points[i],expected=E.compare(lesson.estimate.context,p.kx,p.ky);
    near(p.score,expected.score);assert.ok(Math.abs(p.kx-coarse.kx)<=.5);assert.ok(Math.abs(p.ky-coarse.ky)<=.5);
  }
  near(surface.points[(side*side-1)/2].score,coarse.score);
});

for(const page of ['sim_motion_demo.html','sim_parameter_demo.html'])test(`${page} links phase, Fourier samples, OTF, scores and dynamic narration on one reversible playhead`,()=>{
  let chapter,lessonView;
  const h=boot({page,renderer:page==='sim_motion_demo.html'?'web/motion/sim-motion.js':'web/parameter-demo/sim-parameter-app.js',beforeRenderer(c){
    const create=c.SIMMotionParameterChapter.create;c.SIMMotionParameterChapter.create=o=>(chapter=create(o));
    const createView=c.SIMParameterLesson.createView;c.SIMParameterLesson.createView=(...args)=>(lessonView=createView(...args));
  }});
  const {context,byId,nodes}=h,motion=page==='sim_motion_demo.html';
  const flow=motion?context.SIMMotionParameterChapter.plan(context.SIMMotion):context.SIMParameterPreview;
  const slider=byId.get(motion?'progress':'pe-progress'),index=flow.index(motion?'parameters.refine':'refine');
  const seek=p=>{slider.value=motion?index-1+p:index+p;slider.dispatch('input');};
  const get=key=>nodes.find(n=>n.attrs[key]!==undefined),cells=nodes.filter(n=>n.attrs['data-refine-cell']!==undefined);
  const samples=[.001,.10,.219,.22,.28,.29,.30,.32,.34,.36,.38,.40,.415,.43,.48,.54,.56,.58,.60,.64,.66,.699,.70,.76,.825,.849,.85,.875,.90,.915,.93,.935,.947,.96,.975,.985,.99,1];
  const snapshots=new Map();
  seek(.10); // Warm the measured contour nodes before collecting snapshots.
  seek(.22); // Warm the persistent phase formula and its complex comparison.
  const tracked=nodes.filter(n=>Object.keys(n.attrs).some(k=>k.startsWith('data-refine')||k==='data-subpixel-refine')||n.attrs['data-formula-part']?.startsWith('refine-'));
  const snapshot=()=>tracked.map(n=>({...n.attrs,displayOpacity:n.style.opacity,displayTransform:n.style.transform}));
  let phaseRenders;
  for(const p of samples) {
    seek(p);const s=L.refinementState(chapter.lesson,p),root=get('data-subpixel-refine');
    assert.equal(root.attrs['data-mode'],s.mode);near(root.attrs['data-round'],s.round+1);near(root.attrs['data-score'],s.candidate.score);
    assert.equal(byId.get(motion?'scene-title':'pe-title').textContent,s.title);
    assert.equal(cells.filter(c=>c.attrs['data-written']==='true').length,s.count);
    assert.ok(+get('data-refine-candidate-readout').attrs.opacity===0||+get('data-refine-round-summary').attrs.opacity===0,'candidate and round summaries have exclusive presentation states');
    if(p>=.66){near(get('data-refine-search-backdrop').attrs.opacity,1);near(get('data-refine-round-summary').attrs.opacity,1-M.ramp(p,.935,.95));}
    for(const [i,c] of cells.entries()){near(c.attrs['data-score'],s.candidates[i].score);near(c.attrs['data-kx'],s.candidates[i].kx);near(c.attrs['data-ky'],s.candidates[i].ky);}
    const otf=get('data-refine-shifted-otf');near(otf.attrs.cx,-s.candidate.kx*220/27);near(otf.attrs.cy,-s.candidate.ky*220/27);
    near(get('data-refine-phase-ramp').attrs['data-kx'],s.candidate.kx);near(get('data-refine-phase-ramp').attrs['data-ky'],s.candidate.ky);
    const actual=E.compare(chapter.lesson.estimate.context,s.candidate.kx,s.candidate.ky,true);
    const admitted=nodes.filter(n=>n.attrs['data-refine-q']!==undefined&&+n.attrs.opacity>0).map(n=>n.attrs['data-refine-q']).sort();
    assert.deepEqual(admitted,actual.points.map(p=>p.q.join(',')).sort());
    if(s.mode==='phaseRamp')assert.match(byId.get(motion?'equation':'pe-equation').attrs['data-formula-mode'],/phaseRamp/);
    if(s.mode==='phaseRamp') {
      if(phaseRenders===undefined)phaseRenders=h.mathRenders;else assert.equal(h.mathRenders,phaseRenders,'phase tokens animate without recompiling formulas');
      const diagram=get('data-refine-phase-diagram'),after=get('data-refine-complex-after'),factor=nodes.find(n=>n.attrs['data-formula-part']==='refine-factor');
      const probe=context.SIMParameterLesson.refinementDataFor(chapter.lesson).probe(s.candidate.kx,s.candidate.ky),theta=probe.angle*s.phaseDemo.multiply;
      near(diagram.attrs['data-x'],get('data-refine-sample-point').attrs['data-x']);near(diagram.attrs['data-y'],get('data-refine-sample-point').attrs['data-y']);
      near(factor.attrs['data-unit-re'],probe.unit.re);near(factor.attrs['data-unit-im'],probe.unit.im);
      near(after.attrs['data-re'],probe.a.re*Math.cos(theta)-probe.a.im*Math.sin(theta));
      near(after.attrs['data-im'],probe.a.re*Math.sin(theta)+probe.a.im*Math.cos(theta));
      near(Math.hypot(+after.attrs['data-re'],+after.attrs['data-im']),Math.hypot(probe.a.re,probe.a.im));
      if(s.phaseDemo.multiply===1){near(after.attrs['data-re'],probe.b.re);near(after.attrs['data-im'],probe.b.im);}
    }
    if([.32,.43,.54].includes(p)) {
      const display=get('data-refine-shifted-sideband'),reference=get('data-refine-reference-spectrum');
      const field=context.SIMParameterLesson.refinementDataFor(chapter.lesson).at(s.candidate.kx,s.candidate.ky);
      let hiddenNonzero=0;
      for(const [image,kx,ky] of [[reference,0,0],[display,s.candidate.kx,s.candidate.ky]]) {
        const canvas=nodes[Number(image.attrs.href.split('fixture')[1])];
        for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++) {
          const qx=x-13,qy=y-13,keep=A.otf(qx+kx,qy+ky,chapter.lesson.capture.config.cutoff)>=chapter.lesson.capture.config.minH;
          const pixel=(y*canvas.width+x)*4;
          assert.equal(canvas.lastPixels[pixel+3],keep?255:0,'only the reliable OTF support can light a spectrum pixel');
          if(!keep) {
            assert.deepEqual(Array.from(canvas.lastPixels.slice(pixel,pixel+3)),[0,0,0]);
            const i=A.idx(qx,qy,field.shifted.re.length**.5);
            if(image===display&&Math.hypot(field.shifted.re[i],field.shifted.im[i])>1e-8)hiddenNonzero++;
          }
        }
      }
      if(p===.43)assert.ok(hiddenNonzero>0,'hide display tails without truncating the computed complex spectrum');
    }
    snapshots.set(p,snapshot());
  }
  const rasterWrites=h.work.canvas;
  for(const p of samples.toReversed()){seek(p);assert.deepEqual(snapshot(),snapshots.get(p));}
  assert.equal(h.work.canvas,rasterWrites,'replay reuses candidate rasters and the measured score surface');
  seek(1);near(get('data-refine-final-target').attrs.opacity,1);near(get('data-subpixel-refine').attrs.opacity,0);
  near(get('data-frequency-map').attrs.opacity,1);near(get('data-frequency-pair').attrs.opacity,1);
  assert.equal(lessonView.sharedPair.bands,chapter.lesson.estimate.context.separated.bands,'return the original observed spectra');
  const images=nodes.filter(n=>n.attrs['data-shared-band']!==undefined),originalImages=[...images];
  const overviewNodes=[get('data-frequency-map'),get('data-frequency-pair'),get('data-overlap-mask'),...images,
    ...nodes.filter(n=>n.attrs['data-band-panel']!==undefined||n.attrs['data-otf-band']!==undefined||n.attrs['data-reference-point']!==undefined
      ||['P','Q','R'].includes(n.attrs['data-complex-plane'])||['P','Q','R'].includes(n.attrs['data-vector-u'])||['P','Q','R'].includes(n.attrs['data-vector-v']))];
  const before=overviewNodes.map(n=>({...n.attrs}));
  lessonView.drawScene('least-squares-fit',0);
  assert.deepEqual(overviewNodes.map(n=>({...n.attrs})),before,'18 ends in the exact frequency and complex-value pose used by 19 at entry');
  assert.deepEqual(nodes.filter(n=>n.attrs['data-shared-band']!==undefined),originalImages,'the handoff never replaces spectrum nodes');
  for(const p of [.2,.32,.52,.82]) {
    lessonView.drawScene('least-squares-fit',p);
    near(visibleAlpha(get('data-frequency-map')),0);
    for(const name of ['P','Q','R']) near(visibleAlpha(nodes.find(n=>n.attrs['data-complex-plane']===name)),0);
  }
  assert.equal(nodes.find(n=>n.attrs['data-fit-cloud']!==undefined),undefined,'obsolete P/Q/R fit actors are removed');
  const peak=get('data-get-peak');
  assert.equal(+peak.attrs['data-total'],chapter.lesson.estimate.finalPeak.count,'final accumulation uses the full spatial grid');
  lessonView.drawScene('refine',1);
  assert.deepEqual(overviewNodes.map(n=>({...n.attrs})),before,'reverse restores all overview actors');
  assert.deepEqual(h.errors,[]);
});
