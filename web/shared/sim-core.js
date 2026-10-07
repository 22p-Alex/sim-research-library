/* SIM teaching model. Fourier convention: exp(-i 2π k·r).
 * Source: Chen et al., Light Sci Appl 12, 172 (2023), Eqs. 1–9 / Fig. 4.
 * No DOM or ground-truth reference is accessible from reconstruct().
 */
(function (root) {
  'use strict';
  const TAU = 2 * Math.PI;
  const rad = d => d * Math.PI / 180;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  // Deliberately simplified, radial, real OTF (not a calibrated objective).
  function otf(fx, fy, kc, model='triangle') {
    const r=Math.hypot(fx,fy)/kc;
    if(r>=1)return 0;
    return model==='circular'?2/Math.PI*(Math.acos(r)-r*Math.sqrt(1-r*r)):1-r;
  }
  function excitation(period, cutoffPeriod, m, mode = 'sim') {
    if (mode === 'widefield') return { mean: 1, m: 0, transmitted: true };
    const transmitted = period >= cutoffPeriod - 1e-10;
    return { mean: transmitted ? 1 : 0, m: transmitted ? m : 0, transmitted };
  }
  function scene(p) {
    const fs = 1 / p.samplePeriod, fi = 1 / p.illumPeriod;
    const kx = fi * Math.cos(rad(p.angle)), ky = fi * Math.sin(rad(p.angle));
    const kc = 1 / p.cutoffPeriod;
    // Fixed λex/λem = 0.75, same variable-NA objective in both paths.
    const exPeriod = 0.75 * p.cutoffPeriod;
    const ex = excitation(p.illumPeriod, exPeriod, p.m, p.mode);
    const dx = fs - kx, dy = -ky, sx = fs + kx, sy = ky;
    const hs = otf(fs, 0, kc), hi = otf(kx, ky, kc);
    const hd = otf(dx, dy, kc), hu = otf(sx, sy, kc);
    function at(x, y) {
      const sample = 0.5 + 0.5 * Math.cos(TAU * fs * x);
      const illumination = ex.mean * (1 + ex.m * Math.cos(TAU * (kx*x + ky*y) + p.phase));
      const difference = ex.mean * ex.m / 4 * hd * Math.cos(TAU * (dx*x + dy*y) - p.phase);
      const camera = ex.mean * (0.5 + 0.5 * hs * Math.cos(TAU * fs*x)
        + ex.m / 2 * hi * Math.cos(TAU * (kx*x + ky*y) + p.phase)
        + ex.m / 4 * hu * Math.cos(TAU * (sx*x + sy*y) + p.phase)) + difference;
      return { sample, illumination, emission: sample * illumination, camera, difference };
    }
    return { at, ex, exPeriod, kc, fs, fi, kx, ky, dx, dy, hd, hs, hi,
      diff: Math.hypot(dx, dy), maxGain: ex.mean && ex.m > 0 ? 1 + fi/kc : 1 };
  }
  function fft1(re, im, inverse) {
    const n = re.length;
    for (let i=1,j=0;i<n;i++) {
      let bit=n>>1; for (;j&bit;bit>>=1) j^=bit; j^=bit;
      if(i<j) { [re[i],re[j]]=[re[j],re[i]]; [im[i],im[j]]=[im[j],im[i]]; }
    }
    for(let len=2;len<=n;len*=2) {
      const a=(inverse?TAU:-TAU)/len, wr=Math.cos(a), wi=Math.sin(a);
      for(let start=0;start<n;start+=len) {
        let cr=1,ci=0;
        for(let j=0;j<len/2;j++) {
          const x=start+j,y=x+len/2, tr=re[y]*cr-im[y]*ci,ti=re[y]*ci+im[y]*cr;
          re[y]=re[x]-tr; im[y]=im[x]-ti; re[x]+=tr; im[x]+=ti;
          const next=cr*wr-ci*wi;ci=cr*wi+ci*wr;cr=next;
        }
      }
    }
    if(inverse) for(let i=0;i<n;i++){re[i]/=n;im[i]/=n;}
  }
  function fft2(re, im, n, inverse=false) {
    const r=new Float64Array(n),z=new Float64Array(n);
    for(let y=0;y<n;y++) {
      for(let x=0;x<n;x++){r[x]=re[y*n+x];z[x]=im[y*n+x];}
      fft1(r,z,inverse);
      for(let x=0;x<n;x++){re[y*n+x]=r[x];im[y*n+x]=z[x];}
    }
    for(let x=0;x<n;x++) {
      for(let y=0;y<n;y++){r[y]=re[y*n+x];z[y]=im[y*n+x];}
      fft1(r,z,inverse);
      for(let y=0;y<n;y++){re[y*n+x]=r[y];im[y*n+x]=z[y];}
    }
  }
  const freq=(i,n)=>(i<n/2?i:i-n)/n;
  function gaussianNoise(length, seed) {
    let state=seed>>>0;
    function uniform() {
      state=(state+0x6D2B79F5)>>>0;let t=state;
      t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);
      return ((t^(t>>>14))>>>0)/4294967296;
    }
    const a=new Float64Array(length);
    for(let i=0;i<length;i+=2) {
      const r=Math.sqrt(-2*Math.log(Math.max(1e-12,uniform()))),t=TAU*uniform();
      a[i]=r*Math.cos(t);if(i+1<length)a[i+1]=r*Math.sin(t);
    }
    return a;
  }
  function makeSample(n=128, period=7.5) {
    const s=new Float64Array(n*n),disks=[{x:.5,y:34/128,a:0},{x:34/128,y:90/128,a:60},{x:94/128,y:90/128,a:120}];
    for(let y=0;y<n;y++)for(let x=0;x<n;x++) {
      let v=.02;
      for(const d of disks) {
        let t=clamp((25*n/128-Math.hypot(x-d.x*n,y-d.y*n))/(5*n/128),0,1);
        t=t*t*(3-2*t);
        v+=t*(.5+.5*Math.cos(TAU*(Math.cos(rad(d.a))*x+Math.sin(rad(d.a))*y)/period));
      }
      s[y*n+x]=Math.min(1,v);
    }
    return s;
  }
  function forward(sample, n, p) {
    const re=new Float64Array(n*n),im=new Float64Array(n*n);
    const kx=Math.cos(rad(p.angle))/p.period,ky=Math.sin(rad(p.angle))/p.period;
    const mean=p.mean===undefined?1:p.mean;
    for(let y=0;y<n;y++)for(let x=0;x<n;x++)
      re[y*n+x]=sample[y*n+x]*mean*(1+p.m*Math.cos(TAU*(kx*x+ky*y)+p.phase));
    fft2(re,im,n);
    for(let y=0;y<n;y++)for(let x=0;x<n;x++) {
      const h=otf(freq(x,n),freq(y,n),p.kc,p.otfModel),i=y*n+x;re[i]*=h;im[i]*=h;
    }
    fft2(re,im,n,true);
    if(p.noise>0) {
      const noise=gaussianNoise(n*n,p.seed);
      for(let i=0;i<re.length;i++)re[i]+=p.noise*noise[i];
    }
    return re;
  }
  function acquire(sample,n,p) {
    const ex=excitation(p.period,p.exPeriod,p.m),groups=[];
    p.angles.forEach((angle,d)=>{
      if(!p.directionOn[d])return;
      const frames=[];
      p.phases.forEach((phase,q)=>{
        if(!p.phaseOn[q])return;
        frames.push({phase,index:q,pixels:forward(sample,n,{angle,phase,period:p.period,
          mean:ex.mean,m:ex.m,kc:p.kc,noise:p.noise,seed:(p.seed+1009*d+9176*q)>>>0})});
      });
      groups.push({angle,index:d,frames});
    });
    return {n,groups,ex,period:p.period,kc:p.kc};
  }
  function invert3(matrix) {
    const a=matrix.map((row,i)=>row.concat([0,1,2].map(j=>+(i===j))));
    for(let i=0;i<3;i++) {
      let pivot=i;for(let j=i+1;j<3;j++)if(Math.abs(a[j][i])>Math.abs(a[pivot][i]))pivot=j;
      if(Math.abs(a[pivot][i])<1e-12)return null;
      [a[i],a[pivot]]=[a[pivot],a[i]];
      const div=a[i][i];for(let j=0;j<6;j++)a[i][j]/=div;
      for(let j=0;j<3;j++)if(j!==i){const f=a[j][i];for(let k=0;k<6;k++)a[j][k]-=f*a[i][k];}
    }
    return a.map(r=>r.slice(3));
  }
  // Symmetric 3x3 Jacobi eigensolver for a genuine 2-norm condition number.
  function eigenvalues3(a) {
    a=a.map(r=>r.slice());
    for(let it=0;it<40;it++) {
      let p=0,q=1;for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)if(Math.abs(a[i][j])>Math.abs(a[p][q])){p=i;q=j;}
      if(Math.abs(a[p][q])<1e-14)break;
      const t=.5*Math.atan2(2*a[p][q],a[q][q]-a[p][p]),c=Math.cos(t),s=Math.sin(t);
      const pp=a[p][p],qq=a[q][q],pq=a[p][q];
      for(let k=0;k<3;k++)if(k!==p&&k!==q){const kp=a[k][p],kq=a[k][q];a[k][p]=a[p][k]=c*kp-s*kq;a[k][q]=a[q][k]=s*kp+c*kq;}
      a[p][p]=c*c*pp-2*s*c*pq+s*s*qq;a[q][q]=s*s*pp+2*s*c*pq+c*c*qq;a[p][q]=a[q][p]=0;
    }
    return [a[0][0],a[1][1],a[2][2]].sort((x,y)=>x-y);
  }
  function phaseSystem(phases) {
    const matrix=phases.map(p=>[1,Math.cos(p),Math.sin(p)]);
    const gram=Array.from({length:3},(_,i)=>Array.from({length:3},(_,j)=>matrix.reduce((s,r)=>s+r[i]*r[j],0)));
    const ev=eigenvalues3(gram),rank=ev.filter(v=>v>1e-10).length;
    const condition=rank===3?Math.sqrt(ev[2]/ev[0]):Infinity;
    return {rank,condition,inverse:phases.length===3&&rank===3?invert3(matrix):null};
  }
  function uniqueAngles(angles) {
    const a=[];for(const angle of angles){const v=((angle%180)+180)%180;if(!a.some(x=>Math.min(Math.abs(x-v),180-Math.abs(x-v))<1e-8))a.push(v);}return a;
  }
  function inSupport(x,y,kc,period,angles) {
    if(Math.hypot(x,y)<kc-1e-12)return true;
    return angles.some(a=>[-1,1].some(s=>Math.hypot(x-s*Math.cos(rad(a))/period,y-s*Math.sin(rad(a))/period)<kc-1e-12));
  }
  function radialSupport(theta,kc,period,angles) {
    let r=kc;const q=1/period;
    for(const a of angles) {
      const delta=theta-rad(a),c=Math.abs(Math.cos(delta)),disc=kc*kc-q*q*Math.sin(delta)**2;
      if(disc>=0)r=Math.max(r,q*c+Math.sqrt(disc));
    }
    return r;
  }
  function reconstruct(data, options={}) {
    const n=data.n,size=n*n,total=data.groups.reduce((s,g)=>s+g.frames.length,0);
    const fail=(reason,system)=>({ok:false,reason,pixels:null,total,system,angles:[]});
    if(!total)return fail('no-data');
    if(!data.ex.mean)return fail('blocked');
    const eps=options.eps===undefined?.02:options.eps,phaseError=options.phaseError||0;
    // Explicit per-direction estimates bypass the legacy known-parameter path entirely.
    const explicit=options.modulations!==undefined;
    const getM=g=>explicit?(options.modulations[g.index]||0):data.ex.m*(1+(options.modulationError||0));
    const modulated=data.groups.some(g=>g.frames.length&&getM(g)>1e-8);
    const kc=data.kc*(1+(options.otfError||0));
    const nr=new Float64Array(size),ni=new Float64Array(size),den=new Float64Array(size);
    let maxCondition=1,system=null;
    const bands=data.groups.filter(g=>g.frames.length&&getM(g)>1e-8).map(g=>({angle:g.angle,period:g.period||data.period}));
    const angles=uniqueAngles(bands.map(g=>g.angle));
    const estimateAngles=uniqueAngles(angles.map(a=>a+(options.angleError||0)));
    function accumulate(re,im,kx,ky,weight) {
      fft2(re,im,n);
      for(let y=0;y<n;y++)for(let x=0;x<n;x++) {
        const i=y*n+x,h=otf(freq(x,n)+kx,freq(y,n)+ky,kc,options.otfModel);
        nr[i]+=weight*h*re[i];ni[i]+=weight*h*im[i];den[i]+=weight*h*h;
      }
    }
    for(const group of data.groups) {
      if(!group.frames.length)continue;
      const mEst=getM(group);
      if(mEst<=1e-8) {
        const re=new Float64Array(size);
        // For nonuniform phases use the demodulated zero order, not a biased average.
        const sys=phaseSystem(group.frames.map(f=>f.phase+phaseError));
        const row=explicit&&sys.inverse?sys.inverse[0]:group.frames.map(()=>1/group.frames.length);
        for(let q=0;q<group.frames.length;q++)for(let i=0;i<size;i++)re[i]+=group.frames[q].pixels[i]*row[q];
        const v=group.noiseVariance||1;
        accumulate(re,new Float64Array(size),0,0,1/(3*v*row.reduce((s,x)=>s+x*x,0)));continue;
      }
      system=phaseSystem(group.frames.map(f=>f.phase+phaseError));
      // Rank is also checked for the true acquisition; an estimator cannot add information.
      const actual=phaseSystem(group.frames.map(f=>f.phase));
      if(actual.rank<3||!system.inverse)return fail('phase-rank',actual);
      maxCondition=Math.max(maxCondition,system.condition,actual.condition);
      if(maxCondition>1000)return fail('ill-conditioned',system);
      const rows=system.inverse,b0=new Float64Array(size),c=new Float64Array(size),s=new Float64Array(size);
      for(let q=0;q<group.frames.length;q++)for(let i=0;i<size;i++) {
        const v=group.frames[q].pixels[i];b0[i]+=rows[0][q]*v;c[i]+=rows[1][q]*v;s[i]+=rows[2][q]*v;
      }
      const noiseScale=group.noiseVariance||1;
      const variance0=noiseScale*rows[0].reduce((v,x)=>v+x*x,0);
      const varianceSide=noiseScale*rows[1].reduce((v,x,q)=>v+x*x+rows[2][q]**2,0)/(mEst*mEst);
      accumulate(b0,new Float64Array(size),0,0,1/(3*variance0));
      const angle=rad(group.angle+(options.angleError||0)),kx=Math.cos(angle)/(group.period||data.period),ky=Math.sin(angle)/(group.period||data.period);
      const pr=new Float64Array(size),pi=new Float64Array(size),mr=new Float64Array(size),mi=new Float64Array(size);
      for(let y=0;y<n;y++)for(let x=0;x<n;x++) {
        const i=y*n+x,ph=TAU*(kx*x+ky*y),co=Math.cos(ph),sn=Math.sin(ph);
        // C+iQ with Q=-s: demodulate +illumination side, then shift by -k_i.
        pr[i]=(c[i]*co-s[i]*sn)/mEst;pi[i]=(-s[i]*co-c[i]*sn)/mEst;
        mr[i]=pr[i];mi[i]=-pi[i];
      }
      accumulate(pr,pi,kx,ky,1/(3*varianceSide));
      accumulate(mr,mi,-kx,-ky,1/(3*varianceSide));
    }
    const re=new Float64Array(size),im=new Float64Array(size);
    for(let y=0;y<n;y++)for(let x=0;x<n;x++) {
      const i=y*n+x,fx=freq(x,n),fy=freq(y,n),r=Math.hypot(fx,fy);
      const edge=explicit?Math.max(kc,...bands.map(b=>radialSupport(Math.atan2(fy,fx),kc,b.period,[b.angle+(options.angleError||0)]))):radialSupport(Math.atan2(fy,fx),kc,data.period,modulated?estimateAngles:[]);
      const apo=options.apodize===false?1:(r<.85*edge?1:.5*(1+Math.cos(Math.PI*clamp((r/edge-.85)/.15,0,1))));
      const d=den[i]+eps*eps;re[i]=d?apo*nr[i]/d:0;im[i]=d?apo*ni[i]/d:0;
    }
    fft2(re,im,n,true);
    return {ok:true,reason:modulated?'sim':'widefield',pixels:re,total,
      condition:maxCondition,angles:modulated?angles:[],bands,system,denominator:den};
  }
  function rmse(a,b) { let v=0;for(let i=0;i<a.length;i++)v+=(a[i]-b[i])**2;return Math.sqrt(v/a.length); }
  const api={TAU,otf,excitation,scene,fft2,forward,makeSample,acquire,phaseSystem,
    uniqueAngles,inSupport,radialSupport,reconstruct,rmse,gaussianNoise};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.SIMCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
