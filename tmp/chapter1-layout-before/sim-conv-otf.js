/* Chapter-1 2D lab: convolution in real space ⇄ pointwise OTF multiply in
 * frequency. Reuses the shared FFT (SIMCore.fft2); with a clear circular pupil
 * the FFT-derived OTF must agree with SIMCore.otf(...,'circular'), and the status
 * line reports that deviation. The defocus/comma phase masks are simplified
 * teaching terms for making H leave the real-nonnegative model, not a
 * calibrated aberration model.
 */
(function () {
  'use strict';
  const C=window.SIMCore,$=id=>document.getElementById(id);
  const N=128,HALF=N/2,SIZE=N*N,UP=2;
  const defaults={kind:'dots',dc:4,W:0,coma:0};
  let state={kind:defaults.kind,dc:defaults.dc,W:defaults.W,coma:defaults.coma};
  const f=(n,d=2)=>Number(n.toFixed(d)).toString();
  const wrapDelta=i=>i<=HALF?i:i-N;
  const buf=document.createElement('canvas');buf.width=N;buf.height=N;
  const bctx=buf.getContext('2d');

  function selectButtons(attr,value) {
    document.querySelectorAll(`[${attr}]`).forEach(el=>{const on=el.getAttribute(attr)===value;el.classList.toggle('active-blue',on);el.setAttribute('aria-pressed',String(on));});
  }

  function buildSample() {
    const a=new Float64Array(SIZE);
    for(let y=0;y<N;y++)for(let x=0;x<N;x++) {
      const dx=wrapDelta(x),dy=wrapDelta(y);let v=0;
      if(state.kind==='dots') {
        const s=.9,d=7;
        v=Math.exp(-((dx-d)*(dx-d)+dy*dy)/(2*s*s))+Math.exp(-((dx+d)*(dx+d)+dy*dy)/(2*s*s));
      } else if(state.kind==='stripes')
        v=.5+.16*Math.cos(C.TAU*dx/32)+.16*Math.cos(C.TAU*dx/10)+.16*Math.cos(C.TAU*dx/4.5);
      else
        v=Math.hypot(dx,dy)<=15?1:0;
      a[y*N+x]=v;
    }
    return a;
  }

  /* Pupil → PSF → OTF, sample → spectrum, pointwise product → inverse FFT. */
  function compute() {
    const R=N/(2*state.dc);
    const pr=new Float64Array(SIZE),pi=new Float64Array(SIZE);
    for(let y=0;y<N;y++)for(let x=0;x<N;x++) {
      const dx=wrapDelta(x),dy=wrapDelta(y),r=Math.hypot(dx,dy),i=y*N+x;
      if(r>R)continue;
      const rn=r/R,ph=C.TAU*(state.W*rn*rn+state.coma*(dx/R)*rn*rn);
      pr[i]=Math.cos(ph);pi[i]=Math.sin(ph);
    }
    C.fft2(pr,pi,N);
    const psf=new Float64Array(SIZE);let pmax=0;
    for(let i=0;i<SIZE;i++){const v=pr[i]*pr[i]+pi[i]*pi[i];psf[i]=v;if(v>pmax)pmax=v;}
    if(pmax>0)for(let i=0;i<SIZE;i++)psf[i]/=pmax;
    const oR=new Float64Array(SIZE),oI=new Float64Array(SIZE);
    oR.set(psf);
    C.fft2(oR,oI,N);
    const o0=oR[0]||1;
    for(let i=0;i<SIZE;i++){oR[i]/=o0;oI[i]/=o0;}
    const obj=buildSample(),sR=new Float64Array(SIZE),sI=new Float64Array(SIZE);
    sR.set(obj);
    C.fft2(sR,sI,N);
    const tR=new Float64Array(SIZE),tI=new Float64Array(SIZE);
    for(let i=0;i<SIZE;i++){tR[i]=sR[i]*oR[i]-sI[i]*oI[i];tI[i]=sR[i]*oI[i]+sI[i]*oR[i];}
    const rR=tR.slice(),rI=tI.slice();
    C.fft2(rR,rI,N,true);
    render(obj,psf,rR,sR,sI,oR,oI,tR,tI);
  }

  /* 2× nearest-neighbour upscale keeps the 128² data crisp on the 256² canvas. */
  function paint(id) {
    const cv=$(id),ctx=cv.getContext('2d');
    ctx.imageSmoothingEnabled=false;
    ctx.clearRect(0,0,cv.width,cv.height);
    ctx.drawImage(buf,0,0,cv.width,cv.height);
  }
  function drawReal(id,arr) {
    const img=bctx.createImageData(N,N);
    let mn=Infinity,mx=-Infinity;
    for(let i=0;i<SIZE;i++){if(arr[i]<mn)mn=arr[i];if(arr[i]>mx)mx=arr[i];}
    const rng=(mx-mn)||1;
    for(let y=0;y<N;y++)for(let x=0;x<N;x++) {
      const v=Math.pow(Math.max(0,Math.min(1,(arr[((y+HALF)%N)*N+((x+HALF)%N)]-mn)/rng)),.85),g=Math.round(255*v),p=(y*N+x)*4;
      img.data[p]=img.data[p+1]=img.data[p+2]=g;img.data[p+3]=255;
    }
    bctx.putImageData(img,0,0);paint(id);
  }
  function hot(v) {
    v=Math.max(0,Math.min(1,v));
    return [255*Math.min(1,v*3),255*Math.min(1,Math.max(0,v*3-1)),255*Math.min(1,Math.max(0,v*3-2))];
  }
  function drawSpec(id,re,im,logMode) {
    const img=bctx.createImageData(N,N),mag=new Float64Array(SIZE);let mx=0;
    for(let i=0;i<SIZE;i++) {
      let m=Math.hypot(re[i],im[i]);
      if(logMode)m=Math.log1p(m);
      mag[i]=m;if(m>mx)mx=m;
    }
    mx=mx||1;
    for(let y=0;y<N;y++)for(let x=0;x<N;x++) {
      const v=mag[((y+HALF)%N)*N+((x+HALF)%N)]/mx,rgb=hot(logMode?v:Math.pow(v,.6)),p=(y*N+x)*4;
      img.data[p]=rgb[0];img.data[p+1]=rgb[1];img.data[p+2]=rgb[2];img.data[p+3]=255;
    }
    bctx.putImageData(img,0,0);paint(id);
  }

  function drawChart(oR) {
    const cv=$('t1_conv_chart'),ctx=cv.getContext('2d'),W=cv.width,H=cv.height;
    const ml=44,mr=16,mt=14,mb=26,plotW=W-ml-mr,plotH=H-mt-mb;
    const eps=1e-6,prof=new Float64Array(N);
    let ymin=0,ymax=1.05;
    for(let a=0;a<N;a++) {
      const raw=oR[a];
      prof[a]=Math.abs(raw)<eps?0:raw;               // float round-off: not a real negative lobe
      if(prof[a]<ymin)ymin=prof[a];
      if(prof[a]>ymax)ymax=prof[a];
    }
    ymin=Math.min(ymin*1.1,-.15);
    const q2x=q=>ml+((q+HALF)/N)*plotW,y2py=v=>mt+(ymax-v)/(ymax-ymin)*plotH;
    const cut=N/state.dc,aber=state.W>0||state.coma>0;   // 截止周期 d_c → 频率索引 N/d_c
    ctx.clearRect(0,0,W,H);
    ctx.strokeStyle='#E2E8F0';ctx.lineWidth=1;
    for(let i=0;i<=4;i++){const y=mt+plotH*i/4;ctx.beginPath();ctx.moveTo(ml,y);ctx.lineTo(W-mr,y);ctx.stroke();}
    ctx.strokeStyle='#94A3B8';ctx.setLineDash([5,4]);
    ctx.beginPath();ctx.moveTo(ml,y2py(0));ctx.lineTo(W-mr,y2py(0));ctx.stroke();
    ctx.strokeStyle='#059669';
    for(const q of [-cut,cut]){ctx.beginPath();ctx.moveTo(q2x(q),mt);ctx.lineTo(q2x(q),mt+plotH);ctx.stroke();}
    ctx.setLineDash([]);
    // Analytic shared-layer model, drawn only where it applies.
    if(!aber) {
      ctx.strokeStyle='#94A3B8';ctx.setLineDash([3,3]);ctx.lineWidth=1.4;ctx.beginPath();
      for(let a=0;a<N;a++) {
        const q=a<=HALF?a:a-N,x=q2x(q),y=y2py(C.otf(q/N,0,1/state.dc,'circular'));
        a?ctx.lineTo(x,y):ctx.moveTo(x,y);
      }
      ctx.stroke();ctx.setLineDash([]);
    }
    let first=true,pq=0,pv=0;
    for(let i=0;i<N;i++) {
      const a=(i+HALF)%N,q=a<=HALF?a:a-N,v=prof[a];
      if(!first) {
        ctx.strokeStyle=(pv+v)/2>=0?'#2563EB':'#DC2626';ctx.lineWidth=2;
        ctx.beginPath();ctx.moveTo(q2x(pq),y2py(pv));ctx.lineTo(q2x(q),y2py(v));ctx.stroke();
      }
      first=false;pq=q;pv=v;
    }
    ctx.fillStyle='#475569';ctx.font='11px '+getComputedStyle(document.body).fontFamily;
    ctx.textAlign='right';ctx.fillText('1',ml-6,y2py(1)+4);ctx.fillText('0',ml-6,y2py(0)+4);
    ctx.textAlign='left';ctx.fillText('低频（粗条纹）',ml+4,H-8);
    ctx.textAlign='right';ctx.fillText('高频（细条纹）',W-mr-4,H-8);
    ctx.textAlign='center';ctx.fillStyle='#059669';
    ctx.fillText('−d_c',q2x(-cut),mt+plotH+16);ctx.fillText('+d_c',q2x(cut),mt+plotH+16);
  }

  /* Worst deviation of the FFT-derived centre row from the shared analytic model. */
  function deviation(oR) {
    let worst=0;
    for(let a=0;a<N;a++) {
      const q=a<=HALF?a:a-N;
      worst=Math.max(worst,Math.abs(oR[a]-C.otf(q/N,0,1/state.dc,'circular')));
    }
    return worst;
  }

  function render(obj,psf,res,sR,sI,oR,oI,tR,tI) {
    drawReal('t1_conv_sample',obj);drawReal('t1_conv_psf',psf);drawReal('t1_conv_cam',res);
    drawSpec('t1_conv_f_sample',sR,sI,true);drawSpec('t1_conv_f_otf',oR,oI,false);drawSpec('t1_conv_f_cam',tR,tI,true);
    drawChart(oR);
    const cut=f(state.dc),aber=state.W>0||state.coma>0;
    $('t1_conv_dc_out').textContent=f(state.dc)+' px';
    $('t1_conv_W_out').textContent=f(state.W,2);
    $('t1_conv_coma_out').textContent=f(state.coma,2);
    let verdict;
    if(aber) {
      const parts=[state.W>0?'离焦 '+f(state.W,2)+' 波长':'' ,state.coma>0?'非对称相位 '+f(state.coma,2):''].filter(Boolean);
      verdict=`已开启${parts.join(' + ')}：H 变成带相位、含负值的复函数，共享层的圆形瞳解析模型不再适用（灰色虚线已隐藏）。`;
    } else
      verdict=`灰色虚线是共享层 circular 解析模型；与算得中心行的最大差异 ${deviation(oR).toExponential(1)}，来自 128×128 离散光瞳的边缘（光瞳越大差异越小）。`;
    $('t1_conv_status').textContent=`截止周期 d_c = ${cut} px（= 最细可分辨条纹周期）。${verdict}`;
  }

  let pending=0;
  function queue() {cancelAnimationFrame(pending);pending=requestAnimationFrame(()=>{pending=0;compute();});}
  function syncOutputs() {
    $('t1_conv_dc_out').textContent=f(state.dc)+' px';
    $('t1_conv_W_out').textContent=f(state.W,2);
    $('t1_conv_coma_out').textContent=f(state.coma,2);
  }
  function init() {
    document.querySelectorAll('[data-conv-kind]').forEach(el=>el.addEventListener('click',()=>{
      state.kind=el.getAttribute('data-conv-kind');selectButtons('data-conv-kind',state.kind);compute();
    }));
    $('t1_conv_dc').addEventListener('input',()=>{state.dc=Number($('t1_conv_dc').value);syncOutputs();queue();});
    $('t1_conv_W').addEventListener('input',()=>{state.W=Number($('t1_conv_W').value);syncOutputs();queue();});
    $('t1_conv_coma').addEventListener('input',()=>{state.coma=Number($('t1_conv_coma').value);syncOutputs();queue();});
    selectButtons('data-conv-kind',state.kind);syncOutputs();compute();
  }
  function reset() {
    state.kind=defaults.kind;state.dc=defaults.dc;state.W=defaults.W;state.coma=defaults.coma;
    for(const [id,v] of [['t1_conv_dc',defaults.dc],['t1_conv_W',defaults.W],['t1_conv_coma',defaults.coma]])$(id).value=v;
    selectButtons('data-conv-kind',state.kind);syncOutputs();compute();
  }
  window.SIMConvOtf={init,reset};
})();