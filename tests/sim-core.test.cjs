const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('../sim-core.js');
const near=(a,b,tol=1e-10)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
const n=128;
const phases=[0,2*Math.PI/3,4*Math.PI/3];
function params(extra={}) {return {period:16,exPeriod:9,m:.7,kc:1/12,noise:0,seed:12,angles:[0],phases,
  directionOn:[true],phaseOn:[true,true,true],...extra};}
function target() {return Float64Array.from({length:n*n},(_,i)=>.5+.3*Math.cos(C.TAU*14*(i%n)/n+.71));}
const exact={eps:0,apodize:false};
const sceneParams={samplePeriod:7.5,illumPeriod:13,angle:0,m:.9,phase:.4,mode:'sim',cutoffPeriod:12};

test('FFT round trip preserves complex phase and amplitude',()=>{
  const re=Float64Array.from({length:64},(_,i)=>Math.sin(i*.3)),im=Float64Array.from({length:64},(_,i)=>Math.cos(i*.2));
  const r=re.slice(),z=im.slice();C.fft2(re,im,8);C.fft2(re,im,8,true);
  assert.ok(C.rmse(re,r)<1e-12);assert.ok(C.rmse(im,z)<1e-12);
});
test('all scene channels use the same actual multiplicative illumination',()=>{
  for(const angle of [0,30,90])for(const phase of [0,1.3,Math.PI]) {
    const scene=C.scene({...sceneParams,angle,phase});
    for(let x=0;x<31;x++) {
      const y=17,point=scene.at(x,y);
      const s=.5+.5*Math.cos(C.TAU*x/7.5);
      const I=1+.9*Math.cos(C.TAU*(x*Math.cos(angle*Math.PI/180)+y*Math.sin(angle*Math.PI/180))/13+phase);
      near(point.sample,s);near(point.illumination,I);near(point.emission,s*I);
    }
  }
});
test('analytic complete camera agrees with independently filtered sampled field',()=>{
  const p={...sceneParams,samplePeriod:16,illumPeriod:32,cutoffPeriod:4,angle:0};
  const s=Float64Array.from({length:n*n},(_,i)=>.5+.5*Math.cos(C.TAU*(i%n)/16));
  const result=C.forward(s,n,{angle:0,period:32,phase:p.phase,m:p.m,kc:1/4,noise:0});
  const scene=C.scene(p);
  near(C.rmse(result,Float64Array.from(result,(_,i)=>scene.at(i%n,Math.floor(i/n)).camera)),0);
});
test('zero difference retains a phase-dependent DC component with H(0)=1',()=>{
  const p={...sceneParams,samplePeriod:10.5,illumPeriod:10.5,phase:0};
  const a=C.scene(p),b=C.scene({...p,phase:Math.PI});
  near(a.hd,1);near(a.at(17,42).camera,.725);near(b.at(17,42).camera,.275);
});
test('90 degree illumination is constant along a horizontal line',()=>{
  const s=C.scene({...sceneParams,angle:90});near(s.at(0,120).illumination,s.at(97,120).illumination);
});
test('cutoff includes zero transfer at the edge and unity at DC',()=>{
  near(C.otf(1/12,0,1/12),0);near(C.otf(0,0,1/12),1);
  near(C.scene({...sceneParams,samplePeriod:12}).hs,0);
});
test('both blocked beams give zero emission; zero modulation keeps uniform light',()=>{
  const dark=C.scene({...sceneParams,illumPeriod:6}),uniform=C.scene({...sceneParams,m:0});
  near(dark.ex.mean,0);near(dark.at(3,7).emission,0);near(dark.at(3,7).camera,0);
  near(uniform.ex.mean,1);near(uniform.at(3,7).illumination,1);
});
test('excitation bound scales with the same objective and does not force contrast roll-off',()=>{
  const a=C.scene({...sceneParams,cutoffPeriod:20,illumPeriod:16});
  near(a.exPeriod,15);near(a.ex.m,.9);
  near(C.scene({...sceneParams,illumPeriod:9}).ex.m,.9);
});
test('on-grid superresolution sinusoid is recovered with correct phase',()=>{
  const s=target(),data=C.acquire(s,n,params()),r=C.reconstruct(data,exact);
  assert.ok(r.ok);assert.ok(C.rmse(s,r.pixels)<1e-10);
  const wf=C.forward(s,n,{angle:0,period:16,phase:0,m:0,kc:1/12,noise:0});
  assert.ok(C.rmse(s,wf)>.2);
});
test('a common known phase shift leaves the reconstruction invariant',()=>{
  const s=target(),a=C.reconstruct(C.acquire(s,n,params()),exact);
  const b=C.reconstruct(C.acquire(s,n,params({phases:phases.map(p=>p+Math.PI/6)})),exact);
  assert.ok(C.rmse(a.pixels,b.pixels)<1e-10);
});
test('three known nonuniform independent phases also reconstruct',()=>{
  const s=target(),r=C.reconstruct(C.acquire(s,n,params({phases:[0,.6,3.9]})),exact);
  assert.ok(r.ok);assert.ok(C.rmse(s,r.pixels)<1e-10);
});
test('phase estimation error is independent of actual acquisition phase',()=>{
  const data=C.acquire(target(),n,params()),a=C.reconstruct(data,exact),b=C.reconstruct(data,{...exact,phaseError:.3});
  assert.ok(C.rmse(a.pixels,b.pixels)>.05);
});
test('one/two phases and duplicate phases cannot determine three bands',()=>{
  for(const p of [params({phaseOn:[true,false,false]}),params({phaseOn:[true,true,false]}),params({phases:[0,0,2*Math.PI]})]) {
    const r=C.reconstruct(C.acquire(target(),n,p));assert.equal(r.ok,false);assert.equal(r.reason,'phase-rank');assert.equal(r.pixels,null);
  }
});
test('no frames and blocked excitation never return a fabricated image',()=>{
  for(const [p,why] of [[params({directionOn:[false]}),'no-data'],[params({phaseOn:[false,false,false]}),'no-data'],[params({period:6}),'blocked']]) {
    const r=C.reconstruct(C.acquire(target(),n,p));assert.equal(r.reason,why);assert.equal(r.pixels,null);
  }
});
test('reconstruction depends only on acquired frames, including its zero order',()=>{
  const s=target(),data=C.acquire(s,n,params());s.fill(9);
  const r=C.reconstruct(data,exact);near(r.pixels.reduce((a,b)=>a+b)/r.pixels.length,.5);
  for(const g of data.groups)for(const f of g.frames)f.pixels.fill(0);
  near(C.reconstruct(data,exact).pixels.reduce((a,b)=>a+Math.abs(b)),0);
});
test('uniform illumination uses the actual noisy raw average',()=>{
  const a=C.reconstruct(C.acquire(target(),n,params({m:0,phaseOn:[true,false,false]})));
  const b=C.reconstruct(C.acquire(target(),n,params({m:0,noise:.06,phaseOn:[true,false,false]})));
  assert.equal(a.reason,'widefield');assert.ok(C.rmse(a.pixels,b.pixels)>.001);assert.deepEqual(a.angles,[]);
});
test('OTF mismatch affects the zero order too',()=>{
  const s=Float64Array.from({length:n*n},(_,i)=>.5+.2*Math.cos(C.TAU*4*(i%n)/n));
  const data=C.acquire(s,n,params({m:0})),a=C.reconstruct(data),b=C.reconstruct(data,{otfError:.2});
  assert.ok(C.rmse(a.pixels,b.pixels)>.005);
});
test('Gaussian read noise is reproducible, approximately unit variance and changes across frames',()=>{
  const a=C.gaussianNoise(100000,123),b=C.gaussianNoise(100000,124);
  const mean=a.reduce((s,x)=>s+x)/a.length,variance=a.reduce((s,x)=>s+(x-mean)**2)/a.length;
  assert.ok(Math.abs(mean)<.015);near(variance,1,.025);assert.ok(C.rmse(a,b)>1);
  assert.deepEqual(a,C.gaussianNoise(100000,123));
});
test('true union boundary at 30 degrees and duplicate-direction handling',()=>{
  const angles=[0,60,120],kc=1/12,p=13;
  const r=C.radialSupport(Math.PI/6,kc,p,angles);
  near(r/kc,1.686528264621851);
  assert.equal(C.inSupport((r-1e-6)*Math.cos(Math.PI/6),(r-1e-6)*.5,kc,p,angles),true);
  assert.equal(C.inSupport((r+1e-6)*Math.cos(Math.PI/6),(r+1e-6)*.5,kc,p,angles),false);
  assert.deepEqual(C.uniqueAngles([0,0,180]),[0]);near(C.radialSupport(0,kc,p,[]),kc);
});
test('default finite object reconstruction improves over widefield without accessing it',()=>{
  const s=C.makeSample(n),p=params({period:13,angles:[0,60,120],directionOn:[true,true,true],m:.9});
  const r=C.reconstruct(C.acquire(s,n,p)),wf=C.forward(s,n,{angle:0,period:13,phase:0,m:0,kc:p.kc,noise:0});
  assert.ok(r.ok);assert.ok(C.rmse(r.pixels,s)<.07);assert.ok(C.rmse(r.pixels,s)<C.rmse(wf,s)*.5);
});
