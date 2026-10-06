(function () {
  'use strict';
  const C=window.SIMCore,E=window.SIMExperiment,$=id=>document.getElementById(id),value=id=>Number($(id).value);
  let activeTab=1,mode='sim',studioPhase=0,studioRAF=0,sceneRAF=0,phase=0;
  const directionOn=[true,true,true],phaseOn=[true,true,true];
  let seed=240924,acquisitionKey='',acquisition=null,latest=null,modalFocus=null,opticsTouched=false;
  const N=128,sample=C.makeSample(N);
  const fmt=x=>Number(x.toFixed(3)).toString();
  const piLabel=x=>`${fmt(x/Math.PI)}π`;
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
  function stopAnimations() {
    cancelAnimationFrame(studioRAF);cancelAnimationFrame(sceneRAF);studioRAF=sceneRAF=0;
    set('t1_btn_studio_anim','▶ 光栅相移动画');set('t1_btn_sim_anim','▶ 相移动画');
    window.SIMWaveLab.stopEnvelope();window.SIMWaveLab.setScenePlaying(false);
  }
  function switchTab(which) {
    activeTab=which;stopAnimations();
    for(const i of [1,2]){$('tab'+i+'Content').hidden=i!==which;$('tab'+i+'Btn').classList.toggle('active',i===which);$('tab'+i+'Btn').setAttribute('aria-selected',String(i===which));}
    if(which===1)updateScene();else updateReconstruction();
  }
  $('tab1Btn').addEventListener('click',()=>switchTab(1));$('tab2Btn').addEventListener('click',()=>switchTab(2));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopAnimations();});
  function drawStudio() {
    const cv=$('t1_cv_studio'),arr=new Float64Array(cv.width*cv.height),p=value('t1_studio_p'),a=value('t1_studio_ang')*Math.PI/180;
    const co=Math.cos(a),sn=Math.sin(a),f=C.TAU/p;
    for(let y=0;y<cv.height;y++)for(let x=0;x<cv.width;x++)
      arr[y*cv.width+x]=(.5+.5*Math.cos(f*x))*(.5+.5*Math.cos(f*(co*x+sn*y)+studioPhase));
    gray(cv.id,arr);output('t1_studio_ang','°');output('t1_studio_p',' px');
    const d=2*Math.sin(Math.abs(a)/2);
    set('t1_studio_vmo',d<1e-10?'差频周期 ∞：没有空间差频条纹；相移仍改变平均亮度。':`差频周期 ${fmt(p/d)} px · 为原周期的 ${fmt(1/d)} 倍`);
  }
  function drawLens(s) {
    const cv=$('t1_cv_illum_lens'),ctx=cv.getContext('2d'),w=cv.width,h=cv.height;
    // Fixed pupil-plane scale: R ∝ NA ∝ 1/d_c; r ∝ f_i = 1/P_i.
    // Thus r/R = f_i/f_ex,max, matching the point-beam transmission model.
    // 960 is a drawing scale, chosen to fit R=240 at the minimum d_c=4 px.
    const apertureRadius=960*s.kc,offset=960*.75*s.fi;
    ctx.fillStyle='#090d16';ctx.fillRect(0,0,w,h);
    ctx.fillStyle='rgba(56,189,248,.12)';ctx.beginPath();ctx.ellipse(300,93,252,20,0,0,C.TAU);ctx.fill();
    ctx.strokeStyle='#64748b';ctx.lineWidth=1.5;ctx.stroke();
    ctx.fillStyle='#334155';ctx.fillRect(30,208,540,5);
    if(mode==='widefield') {
      ctx.fillStyle='rgba(147,197,253,.22)';ctx.fillRect(300-apertureRadius,5,2*apertureRadius,88);
      ctx.beginPath();ctx.moveTo(300-apertureRadius,93);ctx.lineTo(300+apertureRadius,93);ctx.lineTo(370,207);ctx.lineTo(230,207);ctx.closePath();ctx.fill();
    } else {
      for(const sign of [-1,1]) {
        const xp=300+sign*offset;
        ctx.strokeStyle=s.ex.transmitted?'#38bdf8':'#f87171';ctx.lineWidth=3;
        ctx.beginPath();ctx.moveTo(xp,0);ctx.lineTo(xp,s.ex.transmitted?93:34);ctx.stroke();
        if(s.ex.transmitted) {
          ctx.fillStyle='rgba(56,189,248,.14)';ctx.beginPath();ctx.moveTo(xp-35,93);ctx.lineTo(xp+35,93);ctx.lineTo(370,207);ctx.lineTo(230,207);ctx.closePath();ctx.fill();
          ctx.beginPath();ctx.moveTo(xp,93);ctx.lineTo(300,207);ctx.stroke();
        } else {ctx.fillStyle='#f87171';ctx.beginPath();ctx.arc(xp,34,5,0,C.TAU);ctx.fill();}
      }
    }
    // Draw the stop last so blocked rays never appear to pass through it.
    ctx.fillStyle='#334155';ctx.fillRect(30,34,270-apertureRadius,8);ctx.fillRect(300+apertureRadius,34,270-apertureRadius,8);
    ctx.strokeStyle='#fbbf24';ctx.lineWidth=2;
    for(const sign of [-1,1]) {const x=300+sign*apertureRadius;ctx.beginPath();ctx.moveTo(x,30);ctx.lineTo(x,46);ctx.stroke();}
    for(let x=80;x<520;x++) {
      const light=s.at(x,120).illumination,g=Math.round(light/2*255);
      ctx.fillStyle=`rgb(${g},${g},${g})`;ctx.fillRect(x,195,1,12);
    }
    ctx.font='12px sans-serif';ctx.textAlign='left';ctx.fillStyle='#94a3b8';ctx.fillText('可变入瞳',35,24);ctx.fillText('物镜',12,97);ctx.fillText('样品平面',35,232);
    ctx.textAlign='right';ctx.fillText('瞳面固定标尺 · 纵向示意',570,24);
  }
  function drawWaves(s) {
    const w=660,left=46,right=644,scale=(right-left)/120,colors=['#cbd5e1','#38bdf8','#fbbf24','#4ade80'];
    const names=['CH1 · 样品','CH2 · 照明','CH3 · 发射 = 样品 × 照明','CH4 · 相机 = 发射经过镜头模糊（下方可单独拆解）'];
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
    drawLens(s);drawWaves(s);window.SIMWaveLab.renderScene(s,phase);
    for(const id of ['t1_cutoff_range','t1_ss','t1_si'])output(id,' px');output('t1_sa','°');output('t1_m');math('t1_phi_out',`${fmt(phase/Math.PI)}\\pi`);
    $('t1_cv_illum_lens_footer').innerHTML=`激发截止周期 ${fmt(s.exPeriod)} px；平均照明 ${tex(`I_0=${s.ex.mean}`)}。${tex('d_c')} 控制孔径，${tex('P_i')} 控制光束间距。`;
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
  function toggleAnimation(kind) {
    const studio=kind==='studio',current=studio?studioRAF:sceneRAF;
    if(current){cancelAnimationFrame(current);if(studio)studioRAF=0;else sceneRAF=0;set(studio?'t1_btn_studio_anim':'t1_btn_sim_anim',studio?'▶ 光栅相移动画':'▶ 相移动画');if(!studio)window.SIMWaveLab.setScenePlaying(false);return;}
    if(!studio)window.SIMWaveLab.setScenePlaying(true);
    set(studio?'t1_btn_studio_anim':'t1_btn_sim_anim','⏸ 暂停动画');let last=0;
    function step(now) {
      if(activeTab!==1||document.hidden)return;
      if(!last)last=now;
      if(now-last>=65) {
        const delta=Math.min(.15,(now-last)/1000);last=now;
        if(studio){studioPhase=(studioPhase+delta)%C.TAU;drawStudio();}
        else {phase=(phase+delta)%C.TAU;$('t1_phi').value=phase/Math.PI;updateScene();}
      }
      if(studio)studioRAF=requestAnimationFrame(step);else sceneRAF=requestAnimationFrame(step);
    }
    if(studio)studioRAF=requestAnimationFrame(step);else sceneRAF=requestAnimationFrame(step);
  }
  $('t1_btn_studio_anim').addEventListener('click',()=>toggleAnimation('studio'));
  $('t1_btn_sim_anim').addEventListener('click',()=>toggleAnimation('scene'));
  $('t1_btn_laser_toggle').addEventListener('click',()=>{mode=mode==='sim'?'widefield':'sim';set('t1_btn_laser_toggle',mode==='sim'?'切换为均匀宽场':'切换为双束干涉');$('t1_btn_laser_toggle').setAttribute('aria-pressed',String(mode==='sim'));updateScene();});
  for(const id of ['t1_cutoff_range','t1_ss','t1_si','t1_sa','t1_m','t1_phi'])$(id).addEventListener('input',()=>{phase=value('t1_phi')*Math.PI;updateScene();});
  for(const id of ['t1_studio_ang','t1_studio_p'])$(id).addEventListener('input',drawStudio);
  function acquisitionParams() {
    return {period:value('wAp'),exPeriod:9,visibility:value('wAm'),kc:1/12,readNoise:value('wAnoise'),seed,
      opticsMode:$('wAoptics').value,contrastRollOff:$('wArollOff').value,spotRadius:value('wAspot'),decenter:value('wAdecenter'),balance:value('wAbalance'),illumBackground:value('wAillumBg'),
      electrons:10**value('wAcounts'),background:value('wAbg'),shotNoise:$('wAshot').checked,
      angles:[1,2,3].map(i=>value('wAang'+i)),phases:[1,2,3].map(i=>value('wAphi'+i)*Math.PI/12),directionOn:directionOn.slice(),phaseOn:phaseOn.slice()};
  }
  function reconstructionOptions() {
    return {eps:value('wAepsr'),phaseError:value('wAphase')*Math.PI/12,angleError:value('wAangle'),
      modulationError:value('wAmerr')/100,otfError:value('wAotf')/100,
      errorsAffectEstimator:$('wAerrScope').value!=='recon'};
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
    if(!result.ok) {set('wAext','坐标尺固定，以检测截止频率为单位。当前无可用重建；中心圆仅作检测带宽参考。');return;}
    let worst=Infinity;
    for(let deg=0;deg<360;deg+=.5)worst=Math.min(worst,radial(deg*Math.PI/180));
    set('wAext',`固定坐标，单位为检测截止频率。采用 ${angles.length} 个不同方向；最弱方向几何倍数 ${(worst/kc).toFixed(2)}×。支持域按已校准载频绘制，不是 FFT 幅度图。`);
  }
  // Just-in-time consequence of the optics controls. Assumption text stays in the
  // collapsed <details>; this line only appears once the user actually touches an
  // optics control, so the numeric outcome is shown exactly when it is relevant.
  function renderOpticsEcho(p) {
    const el=$('wAopticsEcho');
    if(!opticsTouched){el.hidden=true;return;}
    const o=E.optics(p,p.angles[0]),nominal=1/p.period,eff=1/o.period;
    el.hidden=false;
    el.innerHTML=p.opticsMode==='ideal'
      ?`理想点光束：两束全透过（T=1），有效载频等于标称 ${fmt(nominal)} px⁻¹；方向 1 m_eff=${o.m.toFixed(3)}。`
      :`方向 1 截光后果：透过 T₊=${o.plus.T.toFixed(2)} / T₋=${o.minus.T.toFixed(2)}，平均照明 ${tex(`\\bar I=${o.mean.toFixed(3)}`)}，有效载频 ${fmt(eff)} px⁻¹（标称 ${fmt(nominal)}），m_eff=${o.m.toFixed(3)}${o.edge<1?`，可见度 ×${o.edge.toFixed(2)}`:''}。`;
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
    $('wAc2_footer').innerHTML=frames.length?`方向 ${frames[0].group.index+1} · ${tex(`\\phi=${fmt(frames[0].frame.phase/Math.PI)}\\pi`)} · 未扣背景`:'未选择采集帧';
    set('wAc2h',`查看 ${frames.length} 帧`);
    const distinct=C.uniqueAngles(acquisition.calibration.groups.filter(g=>acquisition.raw.groups.find(x=>x.index===g.index)?.frames.length).map(g=>g.angle));
    let status,tone='blue',label;
    const err=options.phaseError||options.angleError||options.modulationError||options.otfError;
    // A mismatch that also reaches the estimator can trip its reliability screen,
    // so the sidebands are dropped and the artefact never becomes visible.
    const estimatorPolluted=!!err&&options.errorsAffectEstimator!==false;
    if(!r.ok) {
      tone='red';label='无法重建';
      if(r.reason==='no-data')status='当前没有采集帧。开启至少一个方向和足够的独立相位后再重建。';
      else if(r.reason==='blocked')status='没有可标定的样品激发光。原始帧可能仍有检测背景与噪声，不能生成样品重建。';
      else if(r.reason==='phase-rank')status=`相位矩阵秩为 ${r.system.rank}/3，无法唯一分离三个频带。请使用三个独立相位；相位 0 和 2π 等价。`;
      else status=`相位矩阵条件数 ${r.system.condition.toFixed(1)}，超过本演示的数值阈值 1000，暂停不稳定反演。`;
    } else if(r.reason==='widefield') {
      label='仅零级频带';tone='amber';
      // The known-m run on identical raw isolates screening from real bandwidth loss.
      const screenedOut=!isKnown&&known.result.ok&&known.result.reason!=='widefield';
      status=isKnown?'已知调制度为零，仅重建零级；没有超分辨增益。'
        :screenedOut&&estimatorPolluted?`注入的失配同时进入调制度估计，${r.omitted?.length||0} 个方向的拟合未通过可靠性筛查，一级频带被整体弃用，只剩零级；同一批 raw 在已知调制度真值下仍可重建。这展示的是估计器的自我保护，不是失配伪影本身：将「失配作用范围」改为「仅进入重建」，或把「重建使用」切到已知调制度真值，才能看到频带错位与泄漏。`
        :'没有可靠检出的调制度，仅用当前 raw 的零级做正则重建；这不代表照明真值一定为零。';
    }
    else {
      label=isKnown?'已知参数对照':'数据估计重建';
      const counts=`${frames.length} 帧，${distinct.length} 个不同方向；${isKnown?'使用调制度真值对照':'使用从 raw 估计的调制度'}。`;
      if(err) {
        label='含校准失配';tone='amber';
        status=counts+(estimatorPolluted
          ?`失配同时作用于估计器与重建${r.omitted?.length?`；方向 ${r.omitted.map(x=>x+1).join('、')} 已因拟合不可靠而降级为零级`:''}。请结合下方相关系数、相对残差与采用 m 判断。`
          :'失配仅作用于重建，估计器仍用正确标定，因此一级频带得以保留，可直接观察频带错位与泄漏造成的伪影。');
      }
      else if(r.omitted?.length) {tone='amber';status=counts+`方向 ${r.omitted.map(x=>x+1).join('、')} 的估计不可靠，仅保留其零级；其余方向采用一级频带。`;}
      else if(r.condition>10) {label='相位病态';tone='amber';status=counts+'相位间隔不均，噪声易被放大；当前融合忽略跨频带噪声相关。';}
      else if(distinct.length<3) {label='方向覆盖受限';tone='amber';status=counts+'方向不完整或重复，不能据采集帧数量判断各方向都获得超分辨。';}
      else status=counts+'几何覆盖见左图；恢复质量请结合 RMSE、噪声和正则强度判断。';
    }
    badge('wAc3b',label,tone);set('wAc3_footer',r.ok?`${r.total} 帧，经背景与照明标定归一化`:'未生成结果');
    set('wAst',status);
    set('wAme',[0,1,2].map(i=>{const e=estimated.estimates.find(e=>e.index===i);return e?.ok?e.m.toFixed(3):'—';}).join(' / '));
    const reliable=estimated.estimates.filter(e=>e.ok).length;set('wAquality',`${reliable} / ${estimated.estimates.length}`);
    const signalCounts=frames.length?frames.reduce((sum,{frame})=>sum+frame.pixels.reduce((s,v)=>s+v*p.electrons-p.background,0),0)/(frames.length*N*N):null;
    set('wAphotons',signalCounts===null?'—':Math.max(0,signalCounts).toFixed(1));
    const maxFi=Math.max(0,...(r.bands||[]).map(b=>1/b.period));
    const gain=r.ok?1+maxFi/p.kc:null;
    set('wAk1',r.ok?(maxFi/p.kc).toFixed(2):'—');set('wAk2',gain?(1/(gain*p.kc)).toFixed(2)+' px':'—');set('wAk3',gain?gain.toFixed(2)+'×':'—');
    const rmse=result=>result.ok?C.rmse(result.pixels,sample).toFixed(4):'—';
    set('wArmse',`RMSE：估计参数 ${rmse(estimated.result)} / 已知调制度 ${rmse(known.result)} / 无噪声宽场 ${C.rmse(wf,sample).toFixed(4)}`);
    const condition=r.ok?r.condition:r.system?.condition;
    set('wAcondition',`相位条件数：${condition===undefined?'—':Number.isFinite(condition)?condition.toFixed(2):'∞'}`);
    const clipped=r.pixels?Array.from(r.pixels).filter(x=>x<0||x>1).length/r.pixels.length:0;
    set('wAclip',r.ok?`重建显示截断：${(100*clipped).toFixed(1)}% 像素`:'');
    for(const id of ['wAp','wAm','wAnoise','wAepsr','wAspot','wAdecenter','wAbalance','wAillumBg','wAbg'])output(id,id==='wAp'?' px':'');
    set('wAcounts_out',Math.round(p.electrons)+' e⁻');$('wAspot').disabled=p.opticsMode==='ideal';$('wAdecenter').disabled=p.opticsMode==='ideal';
    output('wAangle','°');output('wAmerr','%');output('wAotf','%');math('wAphase_out',`${fmt(options.phaseError/Math.PI)}\\pi`);
    for(let i=1;i<=3;i++){output('wAang'+i,'°');math('wAphi'+i+'_out',`${fmt(p.phases[i-1]/Math.PI)}\\pi`);}
    renderOpticsEcho(p);
    const reasons={'phase-rank':'相位秩不足','ill-conditioned':'相位病态','weak-overlap':'重叠区信号不足','weak-modulation':'调制未可靠检出','model-mismatch':'模型匹配不佳','fit':'通过筛查','boundary':'触及物理边界'};
    $('wAestimates').innerHTML=[0,1,2].map(i=>{
      const t=acquisition.truth.find(x=>x.index===i),e=estimated.estimates.find(x=>x.index===i),used=selected.modulations?.[i];
      if(!t)return `<tr><td>${i+1}</td><td colspan="6">未采集该方向</td></tr>`;
      const detail=e?`${reasons[e.reason]}<small>${e.points} 点 · 相关 ${e.correlation===undefined?'—':e.correlation.toFixed(3)} · 残差 ${e.residual==null?'—':e.residual.toFixed(3)}</small>`:'无可用帧或无激发';
      const estimate=e?.ok?e.m.toFixed(3):`—${e?.rawM!=null?`<small>候选 ${e.rawM.toFixed(3)}</small>`:''}`;
      return `<tr><td>${i+1}<small>${p.angles[i]}°</small></td><td>${t.m>0?t.period.toFixed(3):'无调制载频'}</td><td>${t.mean.toFixed(3)}<small>透过 ${t.plus.T.toFixed(2)} / ${t.minus.T.toFixed(2)}</small></td><td>${t.mean?(t.edge<1?`${t.m.toFixed(3)}<small>v×${t.edge.toFixed(2)}</small>`:t.m.toFixed(3)):'无激发'}</td><td class="${e?.ok?'':'unreliable'}">${estimate}</td><td>${used===undefined?'—':used>0?used.toFixed(3):'仅零级'}</td><td class="${e?.ok?'':'unreliable'}">${detail}</td></tr>`;
    }).join('');
    drawMap(p,r);latest={params:p,options,data:acquisition.raw,calibration:acquisition.calibration,truth:acquisition.truth,estimated,known,result:r,wf};window.SIMDemo.latest=latest;
    if(!$('wAmodal').hidden)fillModal();
    document.dispatchEvent(new CustomEvent('sim-updated'));
  }
  function fillModal() {
    if(!latest)return;const data=latest.data;
    let html='';
    for(let d=0;d<3;d++)for(let q=0;q<3;q++) {
      const group=data.groups.find(g=>g.index===d),frame=group?.frames.find(f=>f.index===q);
      html+=`<div><canvas id="raw_${d}_${q}" width="128" height="128" style="width:100%;display:block;border-radius:6px"></canvas><p class="legend">方向 ${d+1} · ${tex(`\\phi=${fmt(latest.params.phases[q]/Math.PI)}\\pi`)}${frame?'':' · 未采集'}</p></div>`;
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
    for(let i=0;i<3;i++)for(const [prefix,on,slider] of [['wAdir',directionOn,'wAang'],['wAphiL',phaseOn,'wAphi']]) {
      $(prefix+(i+1)).classList.toggle('active',on[i]);$(prefix+(i+1)).setAttribute('aria-pressed',String(on[i]));$(slider+(i+1)).disabled=!on[i];
    }
  }
  for(let i=0;i<3;i++) {
    $('wAdir'+(i+1)).addEventListener('click',()=>{directionOn[i]=!directionOn[i];updateToggleState();queueReconstruction();});
    $('wAphiL'+(i+1)).addEventListener('click',()=>{phaseOn[i]=!phaseOn[i];updateToggleState();queueReconstruction();});
  }
  for(const el of $('tab2Content').querySelectorAll('input[type=range]'))el.addEventListener('input',queueReconstruction);
  for(const id of ['wAoptics','wArollOff','wAreconMode','wAerrScope','wAshot'])$(id).addEventListener('change',queueReconstruction);
  for(const id of ['wAspot','wAdecenter','wAbalance','wAillumBg','wAcounts','wAbg','wAnoise'])$(id).addEventListener('input',()=>{opticsTouched=true;});
  for(const id of ['wAoptics','wArollOff','wAshot'])$(id).addEventListener('change',()=>{opticsTouched=true;});
  $('wAresample').addEventListener('click',()=>{seed++;updateReconstruction();});
  function resetTab1(){stopAnimations();for(const el of $('tab1Content').querySelectorAll('input[type=range]'))el.value=el.defaultValue;mode='sim';phase=studioPhase=0;window.SIMWaveLab.reset();window.SIMConvOtf.reset();set('t1_btn_laser_toggle','切换为均匀宽场');$('t1_btn_laser_toggle').setAttribute('aria-pressed','true');drawStudio();updateScene();}
  function resetTab2(){for(const el of $('tab2Content').querySelectorAll('input[type=range]'))el.value=el.defaultValue;$('wAoptics').value='finite';$('wArollOff').value='none';$('wAreconMode').value='estimated';$('wAerrScope').value='both';$('wAshot').checked=true;directionOn.fill(true);phaseOn.fill(true);seed=240924;opticsTouched=false;updateToggleState();updateReconstruction();}
  function idealPreset(){resetTab2();$('wAoptics').value='ideal';$('wAshot').checked=false;for(const id of ['wAnoise','wAbg','wAillumBg'])$(id).value=0;updateReconstruction();}
  $('wAideal').addEventListener('click',idealPreset);
  $('t1_reset').addEventListener('click',resetTab1);$('t2_reset').addEventListener('click',resetTab2);
  window.SIMDemo={updateScene,updateReconstruction,resetTab1,resetTab2,idealPreset,switchTab};
  window.Tab1={update:updateScene,setCutoff(v){$('t1_cutoff_range').value=v;updateScene();}};
  window.Tab2={update:updateReconstruction};
  window.SIMWaveLab.init({
    setPhase(p){cancelAnimationFrame(sceneRAF);sceneRAF=0;set('t1_btn_sim_anim','▶ 相移动画');window.SIMWaveLab.setScenePlaying(false);phase=p;$('t1_phi').value=phase/Math.PI;updateScene();},
    playScene(){toggleAnimation('scene');},
    preset(){stopAnimations();for(const [id,v] of Object.entries({t1_ss:7.5,t1_si:10.5,t1_sa:0,t1_m:.9,t1_cutoff_range:12,t1_phi:0}))$(id).value=v;phase=0;mode='sim';set('t1_btn_laser_toggle','切换为均匀宽场');$('t1_btn_laser_toggle').setAttribute('aria-pressed','true');updateScene();}
  });
  typeset();
  window.SIMConvOtf.init();
  drawStudio();updateScene();updateReconstruction();
})();
