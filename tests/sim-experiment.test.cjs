const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../sim-core'),E=require('../sim-experiment');
const near=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
const n=128,sample=C.makeSample(n);
const base={period:13,exPeriod:9,visibility:.9,kc:1/12,opticsMode:'finite',spotRadius:.12,decenter:.04,balance:1,illumBackground:.05,electrons:2000,background:4,readNoise:2,shotNoise:true,seed:240924,angles:[0,60,120],phases:[0,2*Math.PI/3,4*Math.PI/3],directionOn:[true,true,true],phaseOn:[true,true,true]};
const ideal={...base,opticsMode:'ideal',illumBackground:0,background:0,readNoise:0,shotNoise:false};
const take=p=>E.capture(sample,n,{...base,...p});
test('circular incoherent OTF is normalized, radial and zero at cutoff',()=>{
  near(C.otf(0,0,1,'circular'),1);near(C.otf(1,0,1,'circular'),0);
  near(C.otf(.5,0,1,'circular'),.3910022189557706);
});
test('finite spot power is continuous at pupil edge and vanishes only beyond its extent',()=>{
  near(E.pupilSpot(.5,0,.1).T,1);near(E.pupilSpot(1.1,0,.1).T,0);
  const at=E.pupilSpot(1,0,.1);assert.ok(at.T>.45&&at.T<.5);assert.ok(at.x<1);
  assert.ok(Math.abs(E.pupilSpot(1-1e-5,0,.1).T-E.pupilSpot(1+1e-5,0,.1).T)<.001);
});
test('symmetric clipping alone changes flux, not visibility',()=>{
  const p={...base,decenter:0,illumBackground:0};
  const a=E.optics({...p,period:13},0),b=E.optics({...p,period:9},0);
  near(a.m,.9);near(b.m,.9);assert.ok(b.mean<a.mean);
});
test('background and asymmetric transmission reduce actual effective modulation',()=>{
  const a=E.optics({...base,period:13},0),b=E.optics({...base,period:9},0);
  assert.ok(b.m<a.m);assert.ok(b.mean<a.mean);
  const imbalance=E.optics({...ideal,balance:.25},0);near(imbalance.m,.72);
});
test('optional pupil-edge roll-off lowers visibility and leaves the default model untouched',()=>{
  // Default keeps v constant: that is exactly what the symmetric-clipping test pins down.
  const off=E.optics({...ideal,period:9},0);
  near(off.m,.9);near(off.edge,1);near(off.rho,1);
  // Derived shape cos^2(2*alpha) with sin(alpha)=u/2: unity on axis, 1/4 at the bound.
  near(E.pupilVisibility(0,'pol'),1);near(E.pupilVisibility(1,'pol'),.25);
  near(E.pupilVisibility(0,'linear'),1);near(E.pupilVisibility(1,'linear'),0);
  let prev=1;
  for(let u=0;u<=1;u+=.05){const v=E.pupilVisibility(u,'pol');assert.ok(v<=prev+1e-12);prev=v;}
  for(const model of ['pol','linear']){
    const inner=E.optics({...ideal,period:13,contrastRollOff:model},0);
    const bound=E.optics({...ideal,period:9,contrastRollOff:model},0);
    assert.ok(inner.edge>bound.edge);                    // monotone toward the pupil edge
    near(bound.mean,inner.mean);                         // ideal point beams: flux untouched
    near(bound.m,.9*E.pupilVisibility(1,model));         // only v is scaled
    assert.ok(bound.m<off.m);
  }
  // A roll-off neither resurrects a blocked pattern nor creates contrast from nothing.
  assert.equal(E.optics({...ideal,period:6,contrastRollOff:'pol'},0).m,0);
  assert.equal(E.optics({...ideal,visibility:0,contrastRollOff:'pol'},0).m,0);
  // The estimator still recovers the reduced modulation from raw data alone.
  const a=E.capture(sample,n,{...ideal,period:128/12,contrastRollOff:'pol'});
  assert.ok(a.truth[0].m<.45);
  const r=E.run(a.raw,a.calibration,{eps:0,apodize:false});
  assert.equal(r.result.reason,'sim');
  r.estimates.forEach((e,i)=>{assert.ok(e.ok);near(e.m,a.truth[i].m,e.index===0?1e-9:.012);});
});
test('carrier from transmitted centroids stays below the excitation bound',()=>{
  for(let period=8;period<=13;period+=.1)for(const angle of [0,60,120]){
    const light=E.optics({...base,period},angle);
    if(light.m>0)assert.ok(light.period>=base.exPeriod-1e-10);
  }
  assert.ok(E.optics({...base,period:8.5},0).m>0);
});
test('Poisson samples have correct mean/variance at low and high counts, with reproducible seeds',()=>{
  for(const lambda of [.4,8,40,2000]) {
    const rng=E.random(191),N=80000;let sum=0,sum2=0;
    for(let i=0;i<N;i++){const x=E.poisson(lambda,rng);assert.ok(x>=0&&Number.isInteger(x));sum+=x;sum2+=x*x;}
    const mean=sum/N,variance=sum2/N-mean*mean;
    near(mean,lambda,Math.max(.012,.012*lambda));near(variance,lambda,Math.max(.015,.025*lambda));
  }
  const a=E.camera(new Float64Array(100).fill(.2),base,42);assert.deepEqual(a,E.camera(new Float64Array(100).fill(.2),base,42));
});
test('on-grid noiseless estimate recovers m without reading its value or sample',()=>{
  const a=take({...ideal,period:16}),r=E.run(a.raw,a.calibration,{eps:0,apodize:false});
  for(const e of r.estimates){assert.ok(e.ok);near(e.m,.9,e.index===0?1e-9:.012);}
  const before=r.result.pixels.slice();a.truth.forEach(t=>t.m=0);a.widefield.fill(999);
  assert.deepEqual(E.run(a.raw,a.calibration,{eps:0,apodize:false}).result.pixels,before);
  assert.ok(!JSON.stringify(a.calibration).includes('visibility'));
});
test('on-grid complete reconstruction is exact with estimated modulation',()=>{
  const s=Float64Array.from({length:n*n},(_,i)=>.5+.1*Math.cos(C.TAU*3*(i%n)/n)+.2*Math.cos(C.TAU*14*(i%n)/n));
  const a=E.capture(s,n,{...ideal,period:16,directionOn:[true,false,false]});
  const r=E.run(a.raw,a.calibration,{eps:0,apodize:false});assert.ok(r.estimates[0].ok);near(r.estimates[0].m,.9,1e-10);near(C.rmse(r.result.pixels,s),0,1e-10);
});
test('default noisy estimates are close to truth and improve over independent widefield',()=>{
  const a=take({}),r=E.run(a.raw,a.calibration);
  r.estimates.forEach((e,i)=>{assert.ok(e.ok);near(e.m,a.truth[i].m,.025);assert.ok(e.residual>0);});
  assert.ok(C.rmse(r.result.pixels,sample)<.08);assert.ok(C.rmse(r.result.pixels,sample)<C.rmse(a.widefield,sample)*.5);
});
test('calibrated camera background is removed but its shot noise remains',()=>{
  const a=take({...ideal,background:30}),b=take({...ideal,background:0});
  const ra=E.run(a.raw,a.calibration),rb=E.run(b.raw,b.calibration);near(C.rmse(ra.result.pixels,rb.result.pixels),0,1e-12);
  const noisy=take({...ideal,background:30,shotNoise:true});const prepared=E.prepare(noisy.raw,noisy.calibration);
  assert.ok(prepared.groups[0].frames[0].variance.every(v=>v>0));
});
test('zero modulation and dark frames cannot masquerade as SIM recovery',()=>{
  const a=take({...ideal,visibility:0}),r=E.run(a.raw,a.calibration);
  assert.ok(r.estimates.every(e=>!e.ok));assert.equal(r.result.reason,'widefield');assert.deepEqual(r.result.angles,[]);
  a.raw.groups.forEach(g=>g.frames.forEach(f=>f.pixels.fill(0)));
  const z=E.run(a.raw,a.calibration);near(z.result.pixels.reduce((s,x)=>s+Math.abs(x),0),0);
});
test('insufficient phases, no data, and no illumination produce explicit failures',()=>{
  for(const [p,reason] of [[{phaseOn:[true,false,false]},'phase-rank'],[{phases:[0,0,0]},'phase-rank'],[{directionOn:[false,false,false]},'no-data'],[{...ideal,period:6},'blocked']]){
    const a=take(p),r=E.run(a.raw,a.calibration);assert.equal(r.result.reason,reason);assert.equal(r.result.pixels,null);
  }
});
test('weak overlap is reported and excluded, not replaced by simulation truth',()=>{
  const a=take({period:8.5,electrons:20,readNoise:5}),r=E.run(a.raw,a.calibration);
  assert.ok(r.estimates.some(e=>!e.ok));assert.ok(r.result.omitted.length>0);
  for(const e of r.estimates.filter(e=>!e.ok))assert.equal(r.modulations[e.index],0);
});
test('changing raw modulation changes estimates with calibration held fixed',()=>{
  const a=take({...ideal,period:16,visibility:.4}),b=take({...ideal,period:16,visibility:.9});
  const ra=E.run(a.raw,b.calibration),rb=E.run(b.raw,b.calibration);
  near(ra.estimates[0].m,.4,1e-9);near(rb.estimates[0].m,.9,1e-9);
});
test('known nonuniform phases work, phase mismatch is a diagnostic not new data',()=>{
  const a=take({...ideal,period:16,phases:[.2,1.1,4.5]}),r=E.run(a.raw,a.calibration);
  near(r.estimates[0].m,.9,1e-10);
  const bad=E.run(a.raw,a.calibration,{phaseError:1});assert.ok(bad.estimates.some(e=>!e.ok));
});
test('clipped power agrees with the independent analytic circle-intersection area',()=>{
  const a=.12;
  for(const d of [.85,.95,1,1.05,1.11]){
    const area=d<=1-a?Math.PI*a*a:
      a*a*Math.acos((d*d+a*a-1)/(2*d*a))+Math.acos((d*d+1-a*a)/(2*d))-
      .5*Math.sqrt((-d+a+1)*(d+a-1)*(d-a+1)*(d+a+1));
    near(E.pupilSpot(d,0,a).T,area/(Math.PI*a*a),.0005);
  }
});
test('camera mean and variance include background shot noise and independent read noise',()=>{
  const N=160000,Q=100,B=25,sd=3,signal=new Float64Array(N).fill(.2);
  for(const shotNoise of [true,false]){
    const measured=E.camera(signal,{electrons:Q,background:B,readNoise:sd,shotNoise},193);
    const corrected=Float64Array.from(measured,v=>v-B/Q),mean=corrected.reduce((s,x)=>s+x,0)/N;
    const variance=corrected.reduce((s,x)=>s+(x-mean)**2,0)/N;
    near(mean,.2,.0007);
    near(variance,((shotNoise?45:0)+sd**2)/Q**2,.00012);
  }
});
test('unmodulated excitation reduces contrast while retaining absolute fringe amplitude',()=>{
  const a=E.optics({...ideal,illumBackground:0},0),b=E.optics({...ideal,illumBackground:.3},0);
  near(a.m,.9);near(b.m,.9/1.3);near(a.mean*a.m,b.mean*b.m);
  assert.ok(b.mean>a.mean);
  const c=E.optics({...ideal,background:50,electrons:100,readNoise:10},0);
  near(c.m,a.m);near(c.mean,a.mean);
});
test('common reconstruction phase offset preserves the separated zero order',()=>{
  const acquired=take({...ideal,period:16}),data=E.prepare(acquired.raw,acquired.calibration);
  for(const g of data.groups){
    const a=C.phaseSystem(g.frames.map(f=>f.phase)),b=C.phaseSystem(g.frames.map(f=>f.phase+Math.PI/6));
    near(a.condition,b.condition);
    for(const i of [0,300,1024,9000]){
      const zero=row=>row.reduce((s,x,q)=>s+x*g.frames[q].pixels[i],0);
      near(zero(a.inverse[0]),zero(b.inverse[0]));
    }
  }
  const mods=Object.fromEntries(acquired.truth.map(t=>[t.index,t.m]));
  const a=E.run(acquired.raw,acquired.calibration,{},mods),b=E.run(acquired.raw,acquired.calibration,{phaseError:Math.PI/6},mods);
  assert.ok(C.rmse(a.result.pixels,b.result.pixels)>.01);
});
test('mismatch scope separates estimator screening from reconstruction artefacts',()=>{
  const acquired=take(ideal),frames=()=>acquired.raw.groups.map(g=>g.frames.map(f=>Array.from(f.pixels)));
  const before=frames(),clean=E.run(acquired.raw,acquired.calibration,{});
  assert.equal(clean.result.reason,'sim');
  for(const error of [{angleError:3},{phaseError:Math.PI/6},{otfError:.2}]){
    // Default scope also corrupts the estimator: its reliability screen then
    // drops the sidebands, so the mismatch is masked as a zero-order fallback.
    const both=E.run(acquired.raw,acquired.calibration,{...error});
    const explicit=E.run(acquired.raw,acquired.calibration,{...error,errorsAffectEstimator:true});
    const recon=E.run(acquired.raw,acquired.calibration,{...error,errorsAffectEstimator:false});
    assert.ok(both.estimates.some(e=>!e.ok),`${error} should trip the screen by default`);
    assert.equal(both.result.reason,'widefield');
    assert.deepEqual(explicit.modulations,both.modulations);
    // Keeping the estimator on the clean calibration retains the sidebands, so
    // the same error now reaches band placement and shows up as an artefact.
    assert.ok(recon.estimates.every(e=>e.ok),`${error} should not trip a clean estimator`);
    assert.equal(recon.result.reason,'sim');
    assert.deepEqual(recon.modulations,clean.modulations);
    assert.ok(C.rmse(recon.result.pixels,clean.result.pixels)>.01);
    assert.deepEqual(frames(),before);
  }
});
