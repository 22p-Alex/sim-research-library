/* Effective-parameter experiment, NOT full pupil-field propagation.
 * Only capture() sees the specimen and illumination truth. estimate() receives
 * raw data and explicitly calibrated quantities; run() never reads truth.
 */
(function(root){
  'use strict';
  const C=typeof module!=='undefined'&&module.exports?require('./sim-core.js'):root.SIMCore;
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),rad=x=>x*Math.PI/180;
  const freq=(x,n)=>(x<n/2?x:x-n)/n;
  function random(seed) {
    let state=seed>>>0;
    return ()=>{state=(state+0x6D2B79F5)>>>0;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
  }
  function logFactorial(k) {
    if(k<32){let s=0;for(let j=2;j<=k;j++)s+=Math.log(j);return s;}
    return (k+.5)*Math.log(k)-k+.9189385332046727+1/(12*k)-1/(360*k**3);
  }
  // Inversion at low counts, transformed rejection (PTRS) at high counts.
  function poisson(lambda,rng) {
    if(lambda<=0)return 0;
    if(lambda<10){const limit=Math.exp(-lambda);let p=1,k=0;do{k++;p*=rng();}while(p>limit);return k-1;}
    const s=Math.sqrt(lambda),b=.931+2.53*s,a=-.059+.02483*b,inv=1.1239+1.1328/(b-3.4),vr=.9277-3.6224/(b-2);
    for(;;){const u=rng()-.5,v=rng(),us=.5-Math.abs(u);if(!us)continue;const k=Math.floor((2*a/us+b)*u+lambda+.43);
      if(k<0)continue;if(us>=.07&&v<=vr)return k;if(us<.013&&v>us)continue;
      if(Math.log(v*inv/(a/(us*us)+b))<=-lambda+k*Math.log(lambda)-logFactorial(k))return k;}
  }
  function camera(signal,p,seed) {
    const rng=random(seed),read=C.gaussianNoise(signal.length,seed^0xabc123),pixels=new Float64Array(signal.length);
    const Q=p.electrons,B=p.background,sd=p.readNoise;
    for(let i=0;i<pixels.length;i++) {
      const mu=Q*Math.max(0,signal[i])+B;
      pixels[i]=((p.shotNoise?poisson(mu,rng):mu)+sd*read[i])/Q;
    }
    return pixels;
  }
  // Uniform circular intensity spot of radius a clipped by a unit circular pupil.
  // Quadrature of transmitted power and its first moment; no field propagation.
  function pupilSpot(x,y,a) {
    const d=Math.hypot(x,y);
    if(a<=1e-8)return {T:d<=1?1:0,x,y};
    if(d+a<=1)return {T:1,x,y};
    if(d>=1+a)return {T:0,x:0,y:0};
    const lo=Math.max(-1,d-a),hi=Math.min(1,d+a),steps=512,dx=(hi-lo)/steps;
    let area=0,moment=0;
    for(let i=0;i<steps;i++){const u=lo+(i+.5)*dx,h=2*Math.min(Math.sqrt(Math.max(0,1-u*u)),Math.sqrt(Math.max(0,a*a-(u-d)**2)));area+=h*dx;moment+=u*h*dx;}
    const center=area?moment/area:0;
    return {T:clamp(area/(Math.PI*a*a),0,1),x:d?center*x/d:0,y:d?center*y/d:0};
  }
  // Angle-dependent part of the scalar visibility v. Amplitude clipping alone does
  // NOT lower contrast for symmetric beams (see the symmetric-clipping test); what a
  // real system additionally loses as both beams approach the pupil edge is the
  // polarization overlap (and differential aberration). For beams at +-alpha with
  // in-plane polarization the projected angle between them is 2*alpha, and with
  // u = f_i/f_ex,max = 2*sin(alpha) this gives cos^2(2*alpha) = (1 - u^2/2)^2.
  // The shape is derived, its absolute scale is not: grating/SLM efficiency and
  // aberrations also enter, so v(u) must be measured per system before quantitative use.
  function pupilVisibility(rho,model) {
    const u=clamp(Math.abs(rho),0,1);
    if(model==='pol')return (1-u*u/2)**2;
    if(model==='linear')return 1-u;
    return 1;
  }
  function optics(p,angle) {
    const rho=p.exPeriod/p.period,a=p.opticsMode==='ideal'?0:p.spotRadius;
    const off=p.opticsMode==='ideal'?0:p.decenter,co=Math.cos(rad(angle)),sn=Math.sin(rad(angle));
    const plus=pupilSpot(rho*co+off,rho*sn,a),minus=pupilSpot(-rho*co+off,-rho*sn,a);
    const I1=.5*plus.T,I2=.5*p.balance*minus.T,mean=I1+I2+p.illumBackground;
    const edge=pupilVisibility(rho,p.contrastRollOff);
    const m=mean>0?2*p.visibility*edge*Math.sqrt(I1*I2)/mean:0;
    const kx=(plus.x-minus.x)/(2*p.exPeriod),ky=(plus.y-minus.y)/(2*p.exPeriod);
    const fi=Math.hypot(kx,ky);
    return {plus,minus,I1,I2,mean,m,edge,rho,nominalAngle:angle,angle:fi?Math.atan2(ky,kx)*180/Math.PI:angle,period:fi?1/fi:p.period};
  }
  function capture(sample,n,p) {
    const raw={n,groups:[]},truth=[],calibration={n,kc:p.kc,otfModel:'circular',groups:[],electrons:p.electrons,background:p.background,readNoise:p.readNoise,shotNoise:p.shotNoise};
    p.angles.forEach((angle,d)=>{
      if(!p.directionOn[d])return;
      const light=optics(p,angle);truth.push({index:d,...light});
      const group={index:d,frames:[]};
      calibration.groups.push({index:d,angle:light.angle,period:light.period,mean:light.mean});
      p.phases.forEach((phase,q)=>{
        if(!p.phaseOn[q])return;
        const signal=C.forward(sample,n,{angle:light.angle,period:light.period,phase,m:light.m,mean:light.mean,kc:p.kc,otfModel:'circular'});
        group.frames.push({index:q,phase,pixels:camera(signal,p,(p.seed+1009*d+9176*q)>>>0)});
      });raw.groups.push(group);
    });
    // An independent, noiseless optical reference, never supplied to run().
    const widefield=C.forward(sample,n,{angle:0,period:p.period,phase:0,m:0,mean:1,kc:p.kc,otfModel:'circular'});
    return {raw,calibration,truth,widefield};
  }
  function prepare(raw,cal,options={}) {
    const data={n:raw.n,kc:cal.kc,period:1,ex:{mean:1},groups:[]};
    for(const g of raw.groups) {
      const known=cal.groups.find(x=>x.index===g.index);
      if(!known||known.mean<1e-8)continue;
      const Q=cal.electrons,B=cal.background,den=Q*known.mean;
      const frames=g.frames.map(f=>{
        const pixels=new Float64Array(f.pixels.length),variance=new Float64Array(f.pixels.length);
        for(let i=0;i<pixels.length;i++){
          const counts=f.pixels[i]*Q;pixels[i]=(counts-B)/den;
          variance[i]=((cal.shotNoise?Math.max(0,counts):0)+cal.readNoise**2)/(den*den);
        }
        return {index:f.index,phase:f.phase,pixels,variance};
      });
      data.groups.push({index:g.index,angle:known.angle,period:known.period,frames});
    }
    // Relative average variance for approximate band fusion (not full GLS).
    const vars=data.groups.map(g=>g.frames.reduce((s,f)=>s+f.variance.reduce((a,b)=>a+b,0),0)/Math.max(1,g.frames.length*raw.n**2));
    const ref=vars.filter(v=>v>0).sort((a,b)=>a-b)[Math.floor(vars.filter(v=>v>0).length/2)]||1;
    data.groups.forEach((g,i)=>{g.noiseVariance=vars[i]>0?vars[i]/ref:1;});
    return data;
  }
  function estimateGroup(g,n,kc,options={}) {
    const fail=(reason,extra={})=>({index:g.index,ok:false,m:null,rawM:null,reason,points:0,...extra});
    const system=C.phaseSystem(g.frames.map(f=>f.phase+(options.phaseError||0)));
    if(!system.inverse)return fail('phase-rank',{system});
    if(system.condition>1000)return fail('ill-conditioned',{system});
    const size=n*n,rows=system.inverse,b0=new Float64Array(size),br=new Float64Array(size),bi=new Float64Array(size);
    const angle=rad(g.angle+(options.angleError||0)),kx=Math.cos(angle)/g.period,ky=Math.sin(angle)/g.period;
    let v0=0,v1=0,covR=0,covI=0;
    for(let i=0;i<size;i++) {
      let c=0,s=0,cr=0,ci=0;
      for(let q=0;q<g.frames.length;q++) {
        const f=g.frames[q],v=f.pixels[i],nv=f.variance[i];
        b0[i]+=rows[0][q]*v;c+=rows[1][q]*v;s+=rows[2][q]*v;
        v0+=rows[0][q]**2*nv;v1+=(rows[1][q]**2+rows[2][q]**2)*nv/4;
        cr+=rows[0][q]*rows[1][q]*nv/2;ci-=rows[0][q]*rows[2][q]*nv/2;
      }
      const phase=C.TAU*(kx*(i%n)+ky*Math.floor(i/n)),co=Math.cos(phase),sn=Math.sin(phase);
      br[i]=(c*co-s*sn)/2;bi[i]=(-s*co-c*sn)/2;
      covR+=cr*co+ci*sn;covI+=ci*co-cr*sn;
    }
    const b0i=new Float64Array(size);C.fft2(b0,b0i,n);C.fft2(br,bi,n);
    const cutoff=kc*(1+(options.otfError||0));
    let xx=0,yy=0,xy=0,imag=0,observedCross=0,observedImag=0,nx=0,ny=0,points=0;
    for(let y=0;y<n;y++)for(let x=0;x<n;x++) {
      const fx=freq(x,n),fy=freq(y,n),h0=C.otf(fx,fy,cutoff,'circular'),h1=C.otf(fx+kx,fy+ky,cutoff,'circular');
      if(h0<.06||h1<.06)continue;
      const i=y*n+x,xr=h1*b0[i],xi=h1*b0i[i],yr=h0*br[i],yi=h0*bi[i];
      xx+=xr*xr+xi*xi;yy+=yr*yr+yi*yi;xy+=xr*yr+xi*yi;imag+=xr*yi-xi*yr;
      observedCross+=xr*yr+xi*yi;observedImag+=xr*yi-xi*yr;
      nx+=h1*h1*v0;ny+=h0*h0*v1;xy-=h0*h1*covR;imag-=h0*h1*covI;points++;
    }
    const sx=xx-nx,sy=yy-ny,rawM=2*xy/sx;
    // Display observed diagnostics, not noise-subtracted residuals clipped to zero.
    const residual=yy>0&&Number.isFinite(rawM)?Math.sqrt(Math.max(0,yy-rawM*observedCross+(rawM/2)**2*xx)/yy):null;
    const correlation=xx>0&&yy>0?clamp(Math.hypot(observedCross,observedImag)/Math.sqrt(xx*yy),0,1):0;
    const information=ny>0?sy/ny:(sy>1e-16?Infinity:0);
    const details={system,points,rawM:Number.isFinite(rawM)?rawM:null,residual,correlation,information};
    if(points<12||sx<=Math.max(1e-12,3*nx))return fail('weak-overlap',details);
    if(sy<=Math.max(1e-12,3*ny)||rawM<.03)return fail('weak-modulation',details);
    if(rawM>1.08||!Number.isFinite(rawM)||correlation<.8||residual>.5||Math.abs(imag)>Math.max(1e-10,Math.abs(xy)*.4))return fail('model-mismatch',details);
    return {index:g.index,ok:true,m:clamp(rawM,0,1),reason:rawM>1?'boundary':'fit',...details};
  }
  function estimate(data,cal,options={}) {return data.groups.filter(g=>g.frames.length).map(g=>estimateGroup(g,data.n,cal.kc,options));}
  // By default an injected calibration error also corrupts the modulation
  // estimator, whose reliability screen can then drop the sidebands entirely and
  // mask the mismatch as a plain zero-order fallback. errorsAffectEstimator=false
  // keeps the estimator on the clean calibration, so band-misplacement artefacts
  // stay visible in the reconstruction instead of being screened away.
  function estimatorOptions(options) {
    if(options.errorsAffectEstimator!==false)return options;
    const {angleError,phaseError,otfError,...clean}=options;
    return clean;
  }
  function run(raw,cal,options={},knownModulations) {
    const data=prepare(raw,cal,options),estimates=estimate(data,cal,estimatorOptions(options)),mods={};
    const total=raw.groups.reduce((s,g)=>s+g.frames.length,0);
    const fail=(reason,system)=>({ok:false,reason,pixels:null,total,system,angles:[],bands:[]});
    if(!total)return {data,estimates,result:fail('no-data')};
    if(!data.groups.some(g=>g.frames.length))return {data,estimates,result:fail('blocked')};
    // Rank checks must not be circumvented by classifying an unidentifiable m as zero.
    const bad=estimates.find(e=>e.reason==='phase-rank'||e.reason==='ill-conditioned');
    if(bad)return {data,estimates,result:fail(bad.reason,bad.system)};
    for(const e of estimates)mods[e.index]=knownModulations?knownModulations[e.index]:(e.ok?e.m:0);
    for(const key of Object.keys(mods))mods[key]*=1+(options.modulationError||0);
    const result=C.reconstruct(data,{...options,otfModel:'circular',modulations:mods});
    result.omitted=knownModulations?[]:estimates.filter(e=>!e.ok).map(e=>e.index);
    return {data,estimates,modulations:mods,result};
  }
  const api={random,poisson,camera,pupilSpot,pupilVisibility,optics,capture,prepare,estimate,estimateGroup,run};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SIMExperiment=api;
})(typeof globalThis!=='undefined'?globalThis:this);
