(function () {
  'use strict';
  const C=window.SIMCore,E=window.SIMExperiment,$=id=>document.getElementById(id),value=id=>Number($(id).value);
  let activeTab=1,mode='sim',sceneRAF=0,phase=0;
  const directionOn=[true,true,true],phaseOn=[true,true,true];
  let seed=240924,acquisitionKey='',acquisition=null,latest=null,modalFocus=null;
  const N=128,sample=C.makeSample(N);
  const fmt=x=>Number(x.toFixed(3)).toString();
  /* 相位均为 π/12 的整数步：读数用约分分数（如 2π/3），不用十进制近似。 */
  const piTex=rad=>{const v=Math.round(rad/Math.PI*12);if(!v)return '0';
    const gcd=(a,b)=>b?gcd(b,a%b):a,g=gcd(Math.abs(v),12),p=v/g,q=12/g,num=p===1?'\\pi':`${p}\\pi`;
    return q===1?num:`\\tfrac{${num}}{${q}}`;};
  const piPlain=rad=>{const v=Math.round(rad/Math.PI*12);if(!v)return '0';
    const gcd=(a,b)=>b?gcd(b,a%b):a,g=gcd(Math.abs(v),12),p=v/g,q=12/g,num=p===1?'π':`${p}π`;
    return q===1?num:`${num}/${q}`;};
  const tex=(source,displayMode=false)=>window.katex?katex.renderToString(source,{displayMode,throwOnError:true,trust:false}):source;
  function math(id,source){$(id).innerHTML=tex(source);}
  function typeset(root=document){for(const node of root.querySelectorAll('[data-tex]'))node.innerHTML=tex(node.dataset.tex,node.classList.contains('formula'));}
  function set(id,text){$(id).textContent=text;}
  function badge(id,text,tone){set(id,text);$(id).className='pill-badge badge pill-'+tone;}
  function output(id,unit=''){set(id+'_out',fmt(value(id))+unit);}
  function gray(id,arr,max=1) {
    const cv=$(id),ctx=cv.getContext('2d');
    if(!arr){ctx.fillStyle='#101827';ctx.fillRect(0,0,cv.width,cv.height);ctx.fillStyle='#94a3b8';ctx.font='12px sans-serif';ctx.textAlign='center';ctx.fillText('无可用结果',cv.width/2,cv.height/2);return;}
    const img=ctx.createImageData(cv.width,cv.height);
    for(let i=0;i<arr.length;i++) {
      const g=Math.round(255*Math.max(0,Math.min(1,arr[i]/max)));
      img.data[4*i]=img.data[4*i+1]=img.data[4*i+2]=g;img.data[4*i+3]=255;
    }
    ctx.putImageData(img,0,0);
  }
  function markPlay(id,playing,idleText){
    const b=$(id);if(!b)return;
    b.textContent=playing?'暂停动画':idleText;
    b.classList.toggle('is-playing',playing);
    b.setAttribute('aria-pressed',String(playing));
  }
  function stopAnimations() {
    cancelAnimationFrame(sceneRAF);sceneRAF=0;
    markPlay('t1_btn_sim_anim',false,'相移动画');
  }
  function switchTab(which) {
    activeTab=which;stopAnimations();
    for(const i of [1,2]){$('tab'+i+'Content').hidden=i!==which;$('tab'+i+'Btn').classList.toggle('active',i===which);$('tab'+i+'Btn').setAttribute('aria-selected',String(i===which));}
    if(which===1)updateScene();else updateReconstruction();
    const workspaceTop=document.querySelector('.page-head').getBoundingClientRect().bottom+window.scrollY-10;
    if(window.scrollY>workspaceTop)window.scrollTo({top:Math.max(0,workspaceTop),behavior:'instant'});
  }
  $('tab1Btn').addEventListener('click',()=>switchTab(1));$('tab2Btn').addEventListener('click',()=>switchTab(2));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopAnimations();});

  function drawLens(s) {
    const svg=$('t1_cv_illum_lens'),uniform=mode==='widefield',passed=s.ex.transmitted;
    // Fixed scale in each pupil view: R ∝ 1/d_c, r ∝ 1/P_i.
    // A point in the back focal plane becomes a tilted plane wave. The
    // longitudinal distances below are schematic; they are not an NA calibration.
    const cx=238,pupilY=80,lensY=177,sampleY=324,f=lensY-pupilY;
    const R=720*s.kc,r=540*s.fi,ratio=r/R,pcx=610,pcy=148,pR=352*s.kc,pr=264*s.fi;
    const dirX=s.kx/s.fi,dirY=s.ky/s.fi,blue='#397dac',amber='#b98235',blocked='#bb514c';
    const n=v=>Number(v.toFixed(3));
    const line=(x1,y1,x2,y2,attrs='')=>`<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" ${attrs}/>`;
    const text=(x,y,label,cls='optic-label',attrs='')=>`<text x="${x}" y="${y}" class="${cls}" ${attrs}>${label}</text>`;
    const sourceColor=sign=>passed?(sign<0?blue:amber):blocked;
    let parts=`<defs>
      <marker id="optic-blue-arrow" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L8 4L0 8Z" fill="${blue}"/></marker>
      <marker id="optic-amber-arrow" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L8 4L0 8Z" fill="${amber}"/></marker>
      <clipPath id="optic-strip-clip"><rect x="118" y="324" width="240" height="18" rx="2"/></clipPath>
    </defs>`;
    parts+=text(18,20,'沿照明方向的纵向截面','optic-small');
    parts+=line(492,18,492,375,'stroke="#e1e7ee"');
    parts+=line(cx,55,cx,353,'stroke="#c5cfdb" stroke-dasharray="4 5"');
    parts+=text(18,67,'后焦瞳面','optic-note');
    parts+=`<rect x="38" y="76" width="${n(cx-R-38)}" height="8" rx="2" fill="#64758a"/><rect x="${n(cx+R)}" y="76" width="${n(438-cx-R)}" height="8" rx="2" fill="#64758a"/>`;
    for(const sign of [-1,1])parts+=line(cx+sign*R,70,cx+sign*R,90,'stroke="#344f73" stroke-width="2"');
    parts+=`<rect x="54" y="164" width="368" height="26" rx="9" fill="#f1f5fa" stroke="#afc0d3"/>
      <path d="M64 177 Q238 141 412 177 Q238 207 64 177Z" fill="#e8f0f8" stroke="#7f9eba" stroke-width="1.3"/>`;
    parts+=text(18,152,'物镜 · 等效透镜','optic-note');
    if(uniform) {
      parts+=text(cx,45,'独立均匀照明','optic-note','text-anchor="middle"');
      for(const t of [-.6,-.2,.2,.6])parts+=line(cx+t*R,88,cx+t*R,sampleY,`data-ray="uniform" stroke="${blue}" stroke-width="1.6" opacity=".65" marker-end="url(#optic-blue-arrow)"`);
    } else {
      for(const sign of [-1,1]) {
        const xp=cx+sign*r,color=sourceColor(sign),labelX=sign<0?135:342;
        parts+=text(labelX,44,sign<0?'光束 1':'光束 2','optic-note',`text-anchor="middle" style="fill:${color}"`);
        parts+=`<path d="M${labelX} 51 L${n(xp)} 64 V71" fill="none" stroke="${color}" stroke-width="1" opacity=".55"/>`;
        parts+=`<circle cx="${n(xp)}" cy="${pupilY}" r="4.5" fill="${color}" stroke="white" stroke-width="1.5"/>`;
        if(!passed) {
          parts+=`<path d="M${n(xp-5)} 95l10 10m-10 0l10-10" stroke="${blocked}" stroke-width="1.6"/>`;
          continue;
        }
        // Three distinct parallel rays per beam: no fabricated common focus.
        const slope=-sign*r/f,shift=-slope*(sampleY-lensY),marker=sign<0?'blue':'amber';
        for(const d of [-24,0,24]) {
          const lx=cx+shift+d,sx=cx+d;
          parts+=line(xp,pupilY+5,lx,lensY,`stroke="${color}" stroke-width="1.1" opacity=".3"`);
          parts+=line(lx,lensY,sx,sampleY,`data-ray="outgoing" stroke="${color}" stroke-width="${d===0?1.8:1.2}" opacity="${d===0?.9:.55}"`);
          const ya=253,yb=275;
          parts+=line(lx+slope*(ya-lensY),ya,lx+slope*(yb-lensY),yb,`stroke="${color}" stroke-width="1.4" marker-end="url(#optic-${marker}-arrow)"`);
        }
        for(const y of [231,294]) {
          const x=cx+shift+slope*(y-lensY);
          parts+=line(x-24,y+slope*24,x+24,y-slope*24,`stroke="${color}" stroke-width="1" opacity=".25"`);
        }
      }
    }
    parts+=text(18,239,uniform?'均匀照明':passed?'两组倾斜平面波':'入瞳阻断','optic-note');
    parts+=text(18,257,uniform?'照明强度不随位置变化':passed?'每组箭线彼此平行':'样品侧没有激发光','optic-small');
    parts+=line(70,346,406,346,'stroke="#8e9cab" stroke-width="2"');
    parts+='<g clip-path="url(#optic-strip-clip)"><rect x="118" y="324" width="240" height="18" fill="black"/>';
    for(let i=0;i<160;i++) {
      const u=(i+.5)/160*120,v=s.at(u*dirX,u*dirY).illumination,g=Math.round(Math.max(0,Math.min(1,v/2))*255);
      parts+=`<rect x="${118+i*1.5}" y="324" width="1.55" height="18" fill="rgb(${g},${g},${g})"/>`;
    }
    parts+='</g>';
    parts+=text(cx,367,'样品面 · 沿照明方向读取 I(u)','optic-note','text-anchor="middle"');
    parts+=text(cx,387,'纵向距离仅作示意；不绘制有限光斑包络','optic-small','text-anchor="middle"');
    parts+=text(pcx,20,'瞳面俯视 · 固定标尺','optic-small','text-anchor="middle"');
    parts+=`<circle cx="${pcx}" cy="${pcy}" r="88" fill="#f2f4f7" stroke="#d4dde7" stroke-dasharray="3 4"/>`;
    parts+=line(pcx-96,pcy,pcx+96,pcy,'stroke="#d9e1e9"')+line(pcx,pcy-96,pcx,pcy+96,'stroke="#d9e1e9"');
    parts+=`<circle data-optic="aperture" cx="${pcx}" cy="${pcy}" r="${n(pR)}" fill="${uniform?'#edf4fb':'white'}" stroke="#6f8faf" stroke-width="1.8"/>`;
    parts+=line(pcx,pcy,pcx,pcy-pR,'stroke="#7b91a9" stroke-width="1.2"');
    parts+=text(pcx+7,n(pcy-pR/2),'R','optic-note');
    if(!uniform)for(const sign of [-1,1]) {
      const x=pcx+sign*pr*dirX,y=pcy-sign*pr*dirY,color=sourceColor(sign);
      parts+=line(pcx,pcy,x,y,`stroke="${color}" stroke-dasharray="2 3" opacity=".7"`);
      parts+=`<circle data-optic="beam-${sign<0?'negative':'positive'}" cx="${n(x)}" cy="${n(y)}" r="3.7" fill="${color}" stroke="white" stroke-width="1.1"/>`;
    }
    parts+=text(pcx,259,uniform?'均匀宽场':`r / R = ${n(ratio)}`,'optic-reading','text-anchor="middle"');
    parts+=text(pcx,280,uniform?'无干涉调制':passed?'双束位于入瞳内':'双束已超出入瞳','optic-note',`text-anchor="middle" style="fill:${passed?'#47647d':blocked}"`);
    parts+=text(pcx,311,`照明频率方向 ${fmt(Math.atan2(s.ky,s.kx)*180/Math.PI)}°`,'optic-note','text-anchor="middle"');
    parts+=text(pcx,333,'d_c 改变入瞳半径 R','optic-small','text-anchor="middle"');
    parts+=text(pcx,351,'P_i 改变光束径向位置 r','optic-small','text-anchor="middle"');
    svg.innerHTML=parts;
    svg.setAttribute('data-state',uniform?'uniform':passed?'transmitted':'blocked');
    svg.setAttribute('aria-label',uniform?'均匀宽场照明：样品侧照明恒定':`双束照明，光束径向位置与入瞳半径之比 ${n(ratio)}，${passed?'双束通过，样品侧为两组倾斜平面波':'双束被阻断，样品侧无激发光'}`);
  }
  function drawWaves(s) {
    const w=660,left=46,right=644,scale=(right-left)/120,colors=['#cbd5e1','#38bdf8','#fbbf24','#4ade80'];
    const names=['CH1 · 样品','CH2 · 照明','CH3 · 发射 = 样品 × 照明','CH4 · 相机 = 发射经过镜头模糊'];
    const keys=['sample','illumination','emission','camera'];
    let svg='';
    for(let row=0;row<4;row++) {
      const top=30+row*90,bottom=top+52;
      if(row===3)svg+='<rect x="8" y="282" width="644" height="79" rx="7" fill="#143426" fill-opacity=".65"/>';
      svg+=`<text x="${left}" y="${top-10}" fill="${colors[row]}" font-size="12">${names[row]}</text>`;
      for(const v of [0,1,2]) {
        const y=bottom-v*26;
        svg+=`<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" stroke="#334155" stroke-dasharray="3 3"/><text x="23" y="${y+4}" fill="#94a3b8" font-size="10">${v}</text>`;
      }
      const points=[];
      for(let i=0;i<=600;i++) {
        const x=i/5,v=s.at(x,120),px=left+x*scale;
        points.push(`${px.toFixed(2)},${(bottom-v[keys[row]]*26).toFixed(2)}`);
      }
      svg+=`<polyline points="${points.join(' ')}" fill="none" stroke="${colors[row]}" stroke-width="1.5"/>`;
    }
    svg+='<text x="46" y="380" fill="#94a3b8" font-size="11">x = 0 px</text><text x="570" y="380" fill="#94a3b8" font-size="11">120 px</text>';
    $('t1_waves').innerHTML=svg;
  }
  function sceneParams() {
    return {samplePeriod:value('t1_ss'),illumPeriod:value('t1_si'),angle:value('t1_sa'),m:value('t1_m'),phase,mode,cutoffPeriod:value('t1_cutoff_range')};
  }
  function updateScene() {
    const p=sceneParams(),s=C.scene(p),w=600,h=240;
    const arrays={sample:new Float64Array(w*h),emission:new Float64Array(w*h),camera:new Float64Array(w*h)};
    for(let y=0;y<h;y++)for(let x=0;x<w;x++) {
      const v=s.at(x,y),i=y*w+x;arrays.sample[i]=v.sample;arrays.emission[i]=v.emission;arrays.camera[i]=v.camera;
    }
    gray('t1_cv_sample',arrays.sample,2);gray('t1_cv_mod',arrays.emission,2);gray('t1_cv_camera',arrays.camera,2);
    for(const id of ['t1_cv_sample','t1_cv_mod','t1_cv_camera']) {
      const ctx=$(id).getContext('2d');ctx.strokeStyle='rgba(56,189,248,.6)';ctx.lineWidth=1;ctx.setLineDash([4,6]);ctx.beginPath();ctx.moveTo(0,120);ctx.lineTo(600,120);ctx.stroke();ctx.setLineDash([]);
    }
    drawLens(s);drawWaves(s);
    for(const id of ['t1_cutoff_range','t1_ss','t1_si'])output(id,' px');output('t1_sa','°');output('t1_m');math('t1_phi_out',`${fmt(phase/Math.PI)}\\pi`);
    $('t1_cv_illum_lens_footer').innerHTML=`<span>激发截止周期 <strong>${fmt(s.exPeriod)} px</strong></span><span>平均照明 ${tex(`I_0=${s.ex.mean}`)}</span>${mode==='sim'?'<span>光束径向位置 / 入瞳半径 '+fmt(s.fi*s.exPeriod)+'</span>':''}`;
    const sim=s.ex.mean&&s.ex.m>0;
    set('t1_cP',sim?(s.diff<1e-10?'∞':fmt(1/s.diff)+' px'):'—（均匀照明无差频）');set('t1_cH',sim?s.hd.toFixed(3):'—');
    set('t1_cM',s.ex.mean?s.ex.m.toFixed(2):'无激发');set('t1_cG',sim?s.maxGain.toFixed(2)+'×':'—');
    let status,tone='green',label;
    if(!s.ex.mean) {status='理想点光束均超出入瞳：平均照明、发射荧光和无噪声相机信号均为零；无可恢复频带。';label='无激发';tone='red';}
    else if(s.ex.m===0) {status=s.hs>0?'均匀照明：样品本征频率位于检测通带内，保留其衰减后的条纹。':'均匀照明：样品本征频率位于截止点或通带外，只保留平均亮度。';label='均匀照明';tone=s.hs>0?'blue':'amber';}
    else if(s.diff<1e-10) {status='差频为零：差频项成为随相位变化的直流亮度，直流 OTF 为 1。相机是否还有空间条纹，取决于其余频率是否在通带内。';label='差频为直流';tone='blue';}
    else if(s.hd>0&&s.hs===0) {status='样品细条纹超出检测带宽，差频进入通带。相机还可能含照明频率项；需多相位解混才能恢复原频带。';label='差频可传递';}
    else if(s.hs>0) {status='样品本征频率已可直接传递；相机同时保留所有位于通带内的样品、照明、差频和和频分量。';label='本征频率可见';tone='blue';}
    else {status='样品本征频率与差频均在检测通带外或截止点。可能仍能看到照明条纹，但这不等于恢复了样品细节。';label='目标频率未传递';tone='amber';}
    set('t1_cam_status',status);badge('t1_txt_det_badge',label,tone);
    badge('t1_txt_ex_badge',!s.ex.mean?'两束光被阻断':mode==='widefield'?'均匀宽场':s.ex.m===0?'无调制':`照明真值 ${s.ex.m.toFixed(2)}`,!s.ex.mean?'red':'blue');
    $('t1_cutoff_explain').innerHTML=`检测 ${tex(`f_c=${s.kc.toFixed(4)}\\,\\mathrm{px}^{-1}`)}；${tex(`H(f_s)=${s.hs.toFixed(3)}`)}，${tex(`H(f_i)=${s.hi.toFixed(3)}`)}。蓝色虚线为波形取样行。`;
    window.SIMDemo.scene={params:p,model:s,arrays};
  }
  function toggleAnimation() {
    if(sceneRAF){stopAnimations();return;}
    markPlay('t1_btn_sim_anim',true);let last=0;
    function step(now) {
      if(activeTab!==1||document.hidden){stopAnimations();return;}
      if(!last)last=now;
      const delta=(now-last)/1000;
      if(delta>=1/30){
        phase=(phase+delta)%C.TAU;$('t1_phi').value=phase/Math.PI;updateScene();last=now;
      }
      sceneRAF=requestAnimationFrame(step);
    }
    sceneRAF=requestAnimationFrame(step);
  }
  $('t1_btn_sim_anim').addEventListener('click',toggleAnimation);
  $('t1_btn_laser_toggle').addEventListener('click',()=>{mode=mode==='sim'?'widefield':'sim';set('t1_btn_laser_toggle',mode==='sim'?'切换为均匀宽场':'切换为双束干涉');$('t1_btn_laser_toggle').setAttribute('aria-pressed',String(mode==='sim'));updateScene();});
  for(const id of ['t1_cutoff_range','t1_ss','t1_si','t1_sa','t1_m','t1_phi']){const el=$(id);if(el)el.addEventListener('input',()=>{phase=value('t1_phi')*Math.PI;updateScene();});}
  function acquisitionParams() {
    return {period:value('wAp'),exPeriod:9,visibility:value('wAm'),kc:1/12,readNoise:value('wAnoise'),seed,
      opticsMode:'finite',contrastRollOff:'none',spotRadius:.12,decenter:0,balance:value('wAbalance'),illumBackground:value('wAillumBg'),
      electrons:10**value('wAcounts'),background:value('wAbg'),shotNoise:$('wAshot').checked,
      angles:[1,2,3].map(i=>value('wAang'+i)),phases:[1,2,3].map(i=>value('wAphi'+i)*Math.PI/12),directionOn:directionOn.slice(),phaseOn:phaseOn.slice()};
  }
  function reconstructionOptions() {
    return {eps:value('wAepsr'),phaseError:value('wAphase')*Math.PI/12,angleError:value('wAangle'),
      modulationError:value('wAmerr')/100,otfError:value('wAotf')/100,
      errorsAffectEstimator:true};
  }
  function drawMap(p,result) {
    const kc=p.kc,angles=result.ok?result.angles:[],bands=result.ok?result.bands:[];
    const radial=a=>Math.max(kc,...bands.map(b=>C.radialSupport(a,kc,b.period,[b.angle])));
    // Fixed physical viewport, sized for the largest admissible illumination frequency.
    // Changing P_i must move the sideband centers, not resize the objective's OTF.
    const scale=102/(kc+1/p.exPeriod),r=kc*scale,c=120;
    let svg='<rect width="240" height="240" fill="white"/>';
    svg+='<line x1="8" y1="120" x2="232" y2="120" stroke="#e2e8f0"/><line x1="120" y1="8" x2="120" y2="232" stroke="#e2e8f0"/>';
    const circles=[[0,0]];
    for(const b of bands)for(const sign of [-1,1])circles.push([sign*Math.cos(b.angle*Math.PI/180)/b.period,sign*Math.sin(b.angle*Math.PI/180)/b.period]);
    for(const [x,y] of circles)svg+=`<circle cx="${c+x*scale}" cy="${c-y*scale}" r="${r}" fill="#dbeafe" fill-opacity=".2" stroke="#60a5fa" stroke-dasharray="4 3"/>`;
    svg+=`<circle cx="120" cy="120" r="${r}" fill="#eff6ff" stroke="#2563eb"/>`;
    const pts=[];
    for(let deg=0;deg<360;deg++) {const a=deg*Math.PI/180,rr=radial(a)*scale;pts.push(`${(c+rr*Math.cos(a)).toFixed(2)},${(c-rr*Math.sin(a)).toFixed(2)}`);}
    svg+=`<polygon points="${pts.join(' ')}" fill="none" stroke="#b91c1c" stroke-width="1.4"/>`;
    for(const a of [0,60,120])for(const sign of [-1,1]) {
      const x=sign*Math.cos(a*Math.PI/180)/7.5,y=sign*Math.sin(a*Math.PI/180)/7.5,inside=result.ok&&(Math.hypot(x,y)<kc||bands.some(b=>C.inSupport(x,y,kc,b.period,[b.angle])));
      svg+=`<circle cx="${c+x*scale}" cy="${c-y*scale}" r="3.5" fill="${inside?'#16a34a':'#94a3b8'}"/>`;
    }
    for(const tick of [-2,-1,1,2]) {
      const x=c+tick*r,y=c-tick*r;
      svg+=`<line x1="${x}" y1="117" x2="${x}" y2="123" stroke="#64748b"/><text x="${x}" y="134" text-anchor="middle" fill="#64748b" font-size="9">${tick}</text>`;
      svg+=`<line x1="117" y1="${y}" x2="123" y2="${y}" stroke="#64748b"/><text x="112" y="${y+3}" text-anchor="end" fill="#64748b" font-size="9">${tick}</text>`;
    }
    svg+=`<foreignObject x="202" y="96" width="37" height="22"><div xmlns="http://www.w3.org/1999/xhtml" style="font-size:10px;color:#64748b">${tex('f_x/f_c')}</div></foreignObject><foreignObject x="126" y="2" width="40" height="24"><div xmlns="http://www.w3.org/1999/xhtml" style="font-size:10px;color:#64748b">${tex('f_y/f_c')}</div></foreignObject>`;
    $('wAmap').innerHTML=svg;
    set('wAext',result.ok?`${angles.length} 个方向`:'暂无重建');
  }
  function updateReconstruction() {
    const p=acquisitionParams(),options=reconstructionOptions(),key=JSON.stringify(p);
    if(key!==acquisitionKey){acquisition=E.capture(sample,N,p);acquisitionKey=key;}
    const estimated=E.run(acquisition.raw,acquisition.calibration,options);
    const truthMods=Object.fromEntries(acquisition.truth.map(t=>[t.index,t.m]));
    const known=E.run(acquisition.raw,acquisition.calibration,options,truthMods);
    const isKnown=$('wAreconMode').value==='known',selected=isKnown?known:estimated,r=selected.result;
    const frames=acquisition.raw.groups.flatMap(g=>g.frames.map(f=>({group:g,frame:f}))),wf=acquisition.widefield;
    gray('wAc0',sample);gray('wAc1',wf);gray('wAc2',frames.length?frames[0].frame.pixels:null);gray('wAc3',r.pixels);
    $('wAc2_footer').innerHTML=frames.length?`方向 ${frames[0].group.index+1} · ${tex(`\\phi=${piTex(frames[0].frame.phase)}`)}`:'未选择采集帧';
    set('wAc2h',`查看 ${frames.length} 帧`);
    const distinct=C.uniqueAngles(acquisition.calibration.groups.filter(g=>acquisition.raw.groups.find(x=>x.index===g.index)?.frames.length).map(g=>g.angle));
    let status='',tone='blue',label;
    const err=options.phaseError||options.angleError||options.modulationError||options.otfError;
    // A mismatch that also reaches the estimator can trip its reliability screen,
    // so the sidebands are dropped and the artefact never becomes visible.
    const estimatorPolluted=!!err&&options.errorsAffectEstimator!==false;
    if(!r.ok) {
      tone='red';label='无法重建';
      if(r.reason==='no-data')status='没有采集帧。请开启至少一个采集方向。';
      else if(r.reason==='blocked')status='激发光被阻断，无法重建。请增大照明周期或调整光路。';
      else if(r.reason==='phase-rank')status=`相位矩阵秩为 ${r.system.rank}/3。请使用三个不同相位；0 与 2π 等价。`;
      else status='相位过于接近，无法稳定重建。请拉开三个相位的间隔。';
    } else if(r.reason==='widefield') {
      label='仅零级频带';tone='amber';
      // The known-m run on identical raw isolates screening from real bandwidth loss.
      const screenedOut=!isKnown&&known.result.ok&&known.result.reason!=='widefield';
      status=isKnown?'调制度为零，当前只能得到宽场结果。'
        :screenedOut&&estimatorPolluted?'调制度估计未通过可靠性筛查，当前只保留宽场信息。可将调制度切换为“使用真值对照”，观察失配伪影。'
        :'未能可靠估计调制度，当前只保留宽场信息。可提高信号计数后重试。';
    }
    else {
      label=isKnown?'已知参数对照':'数据估计重建';
      if(err) {
        label='含校准失配';tone='amber';
        status=isKnown
          ?'使用真值对照保留一级频带，可在图像中观察校准失配造成的条纹错位与伪影。'
          :`失配同时进入估计与重建${r.omitted?.length?`；方向 ${r.omitted.map(x=>x+1).join('、')} 仅保留宽场信息`:''}。详见重建设置。`;
      }
      else if(r.omitted?.length) {tone='amber';status=`方向 ${r.omitted.map(x=>x+1).join('、')} 的估计不可靠，仅保留该方向的宽场信息。`;}
      else if(r.condition>10) {label='相位病态';tone='amber';status='相位过于接近，噪声容易被放大。请调整相位间隔。';}
      else if(distinct.length<3) {label='方向覆盖受限';tone='amber';status=`当前只有 ${distinct.length} 个不同方向，其他方向的细节可能无法恢复。`;}
    }
    badge('wAc3b',label,tone);set('wAc3_footer',r.ok?`${r.total} 帧联合重建`:'未生成结果');
    set('wAst',status);$('wAst').hidden=!status;
    set('wAme',[0,1,2].map(i=>{const e=estimated.estimates.find(e=>e.index===i);return e?.ok?e.m.toFixed(3):'—';}).join(' / '));
    const reliable=estimated.estimates.filter(e=>e.ok).length;set('wAquality',`${reliable} / ${estimated.estimates.length}`);
    const signalCounts=frames.length?frames.reduce((sum,{frame})=>sum+frame.pixels.reduce((s,v)=>s+v*p.electrons-p.background,0),0)/(frames.length*N*N):null;
    set('wAphotons',signalCounts===null?'—':Math.max(0,signalCounts).toFixed(1));
    const maxFi=Math.max(0,...(r.bands||[]).map(b=>1/b.period));
    const gain=r.ok?1+maxFi/p.kc:null;
    set('wAk3',gain?gain.toFixed(2)+'×':'—');
    const rmse=result=>result.ok?C.rmse(result.pixels,sample).toFixed(4):'—';
    set('wAcurrentRmse',rmse(r));
    set('wArmse',`RMSE：估计参数 ${rmse(estimated.result)} / 已知调制度 ${rmse(known.result)} / 无噪声宽场 ${C.rmse(wf,sample).toFixed(4)}`);
    const condition=r.ok?r.condition:r.system?.condition;
    set('wAcondition',`相位条件数：${condition===undefined?'—':Number.isFinite(condition)?condition.toFixed(2):'∞'}`);
    const clipped=r.pixels?Array.from(r.pixels).filter(x=>x<0||x>1).length/r.pixels.length:0;
    set('wAclip',r.ok?`重建显示截断：${(100*clipped).toFixed(1)}% 像素`:'');
    for(const id of ['wAp','wAm','wAnoise','wAepsr','wAbalance','wAillumBg','wAbg'])output(id,id==='wAp'?' px':'');
    set('wAcounts_out',Math.round(p.electrons)+' e⁻');
    output('wAangle','°');output('wAmerr','%');output('wAotf','%');math('wAphase_out',piTex(options.phaseError));
    for(let i=1;i<=3;i++){output('wAang'+i,'°');math('wAphi'+i+'_out',piTex(p.phases[i-1]));}
    const reasons={'phase-rank':'相位秩不足','ill-conditioned':'相位病态','weak-overlap':'重叠区信号不足','weak-modulation':'调制未可靠检出','model-mismatch':'模型匹配不佳','fit':'通过筛查','boundary':'触及物理边界'};
    $('wAestimates').innerHTML=[0,1,2].map(i=>{
      const t=acquisition.truth.find(x=>x.index===i),e=estimated.estimates.find(x=>x.index===i),used=selected.modulations?.[i];
      if(!t)return `<tr><td>${i+1}</td><td colspan="6">未采集该方向</td></tr>`;
      const detail=e?`${reasons[e.reason]}<small>${e.points} 点 · 相关 ${e.correlation===undefined?'—':e.correlation.toFixed(3)} · 残差 ${e.residual==null?'—':e.residual.toFixed(3)}</small>`:'无可用帧或无激发';
      const estimate=e?.ok?e.m.toFixed(3):`—${e?.rawM!=null?`<small>候选 ${e.rawM.toFixed(3)}</small>`:''}`;
      return `<tr><td>${i+1}<small>${p.angles[i]}°</small></td><td>${t.m>0?t.period.toFixed(3):'无调制载频'}</td><td>${t.mean.toFixed(3)}<small>透过 ${t.plus.T.toFixed(2)} / ${t.minus.T.toFixed(2)}</small></td><td>${t.mean?(t.edge<1?`${t.m.toFixed(3)}<small>v×${t.edge.toFixed(2)}</small>`:t.m.toFixed(3)):'无激发'}</td><td class="${e?.ok?'':'unreliable'}">${estimate}</td><td>${used===undefined?'—':used>0?used.toFixed(3):'仅零级'}</td><td class="${e?.ok?'':'unreliable'}">${detail}</td></tr>`;
    }).join('');
    drawMap(p,r);latest={params:p,options,data:acquisition.raw,calibration:acquisition.calibration,truth:acquisition.truth,estimated,known,result:r,wf};window.SIMDemo.latest=latest;
    syncScope();renderMismatchImpact(p,r);
    if(!$('wAmodal').hidden)fillModal();
    document.dispatchEvent(new CustomEvent('sim-updated'));
  }
  /* 失配卡片不用固定讲解：按当前滑块取值与筛查结果，动态生成“这次调整产生的影响”。 */
  function renderMismatchImpact(p,r){
    const a=value('wAangle'),ph=value('wAphase'),me=value('wAmerr'),oe=value('wAotf'),eps=value('wAepsr');
    const act=acquisition.calibration.groups.filter(g=>directionOn[g.index]&&acquisition.raw.groups.find(x=>x.index===g.index)?.frames.length);
    const per=act.length?Math.min(...act.map(g=>g.period||value('wAp'))):value('wAp');
    const ext=1+1/(per*p.kc),segs=[];
    if(a)segs.push(`角度 +${a}°：支持域边缘（≈${ext.toFixed(2)}× 检测截止）的频带位置误差 ≈ ${(ext*Math.sin(a*Math.PI/180)).toFixed(2)}× 检测截止`);
    if(ph)segs.push(`相位 +${piPlain(ph*Math.PI/12)}（三相位间隔不变）：重建条纹整体平移 ≈ ${(ph*per/24).toFixed(1)} px`);
    if(me)segs.push(`采用 m ×${(1+me/100).toFixed(2)}：一级频带幅度与融合权重同比例失真，不改变真实照明`);
    if(oe)segs.push(`假设截止 ×${(1+oe/100).toFixed(2)}：OTF 权重失配，真实检测带宽不变`);
    const estMis=a||ph||oe,est=latest.estimated.estimates,rel=est.filter(e=>e.ok).length;
    if(estMis&&$('wAreconMode').value==='known')
      segs.push(`估计筛查通过 ${rel}/${est.length} 个方向；当前使用真值 m，一级频带不因调制度估计被拒而丢弃`);
    else if(estMis&&rel<est.length)
      segs.push(`失配同时进入估计器：筛查通过 ${rel}/${est.length} 个方向，被拒方向降级为零级${r.reason==='widefield'?'，重建已退化为宽场，拖滑块看似无效——这是估计器的自我保护，不是伪影本身':''}`);
    else if(estMis)
      segs.push(`筛查通过 ${rel}/${est.length}、一级频带保留：失配直接表现为频带错位、泄漏、鬼影与方向性条纹`);
    $('wAerrImpact').textContent=(segs.length?'只改变估计与重建、不重新生成 raw。':'未注入失配：拖动任一滑块看它的单独影响。')+
      (segs.length?segs.join('；')+'。':'')+`正则 ε=${fmt(eps)}：|T|=${fmt(eps)} 处融合权重减半，越大越平滑。`;
  }
  function fillModal() {
    if(!latest)return;const data=latest.data;
    let html='';
    for(let d=0;d<3;d++)for(let q=0;q<3;q++) {
      const group=data.groups.find(g=>g.index===d),frame=group?.frames.find(f=>f.index===q);
      html+=`<div><canvas id="raw_${d}_${q}" width="128" height="128" style="width:100%;display:block;border-radius:6px"></canvas><p class="legend">方向 ${d+1} · ${tex(`\\phi=${piTex(latest.params.phases[q])}`)}${frame?'':' · 未采集'}</p></div>`;
    }
    $('wAmodalGrid').innerHTML=html;
    for(let d=0;d<3;d++)for(let q=0;q<3;q++) {
      const f=data.groups.find(g=>g.index===d)?.frames.find(f=>f.index===q);gray(`raw_${d}_${q}`,f?.pixels||null);
    }
    const total=data.groups.reduce((s,g)=>s+g.frames.length,0);
    set('wAmodalInfo',`本次实际采集 ${total} 帧。显示的是同一批 raw（光电子计数除以计数尺度 Q），尚未扣除背景和照明标定；所有图固定标尺 0–1。噪声种子 ${seed}。`);
  }
  function openModal(){modalFocus=document.activeElement;fillModal();$('wAmodal').hidden=false;$('wAmodal').style.display='flex';$('wAmodalClose').focus();}
  function closeModal(){$('wAmodal').hidden=true;$('wAmodal').style.display='none';modalFocus?.focus();}
  $('wAc2h').addEventListener('click',openModal);$('wAmodalClose').addEventListener('click',closeModal);
  $('wAmodal').addEventListener('click',e=>{if(e.target===$('wAmodal'))closeModal();});
  document.addEventListener('keydown',e=>{if(!$('wAmodal').hidden){if(e.key==='Escape')closeModal();if(e.key==='Tab'){e.preventDefault();$('wAmodalClose').focus();}}});
  let pending=0;
  function queueReconstruction(){cancelAnimationFrame(pending);pending=requestAnimationFrame(()=>{pending=0;updateReconstruction();});}
  function updateToggleState() {
    for(let i=0;i<3;i++){
      // 方向：可开关
      $('wAdir'+(i+1)).classList.toggle('active',directionOn[i]);
      $('wAdir'+(i+1)).setAttribute('aria-pressed',String(directionOn[i]));
      $('wAang'+(i+1)).disabled=!directionOn[i];
      // 相位：必需帧，常亮且不可关闭，仅滑块可调
      $('wAphiL'+(i+1)).classList.add('active');
      $('wAphiL'+(i+1)).setAttribute('aria-pressed','true');
      $('wAphi'+(i+1)).disabled=false;
    }
  }
  for(let i=0;i<3;i++) {
    $('wAdir'+(i+1)).addEventListener('click',()=>{directionOn[i]=!directionOn[i];updateToggleState();queueReconstruction();});
  }
  for(const el of $('tab2Content').querySelectorAll('input[type=range]'))el.addEventListener('input',queueReconstruction);
  for(const id of ['wAreconMode','wAshot'])$(id).addEventListener('change',queueReconstruction);
  /* 「失配作用范围」切换按钮已移除：失配固定作用于估计器与重建（wAerrScope恒为 both）。
     syncScope 仅复位该隐藏字段，避免残留值影响后续判断。 */
  function syncScope(){$('wAerrScope').value='both';}
  $('wAresample').addEventListener('click',()=>{seed++;updateReconstruction();});
  function resetTab1(){stopAnimations();for(const el of $('tab1Content').querySelectorAll('input[type=range]'))el.value=el.defaultValue;mode='sim';phase=0;window.SIMConvOtf.reset();set('t1_btn_laser_toggle','切换为均匀宽场');$('t1_btn_laser_toggle').setAttribute('aria-pressed','true');updateScene();}
  function resetTab2(){for(const el of $('tab2Content').querySelectorAll('input[type=range]'))el.value=el.defaultValue;$('wAreconMode').value='estimated';$('wAerrScope').value='both';$('wAshot').checked=true;directionOn.fill(true);phaseOn.fill(true);seed=240924;updateToggleState();updateReconstruction();}
  function idealPreset(){resetTab2();$('wAshot').checked=false;for(const id of ['wAnoise','wAbg','wAillumBg'])$(id).value=0;updateReconstruction();}
  $('wAideal').addEventListener('click',idealPreset);
  $('t1_reset').addEventListener('click',resetTab1);$('t2_reset').addEventListener('click',resetTab2);
  window.SIMDemo={updateScene,updateReconstruction,resetTab1,resetTab2,idealPreset,switchTab};
  window.Tab1={update:updateScene,setCutoff(v){$('t1_cutoff_range').value=v;updateScene();}};
  window.Tab2={update:updateReconstruction};
  typeset();
  window.SIMConvOtf.init();
  updateToggleState();updateScene();updateReconstruction();
})();
