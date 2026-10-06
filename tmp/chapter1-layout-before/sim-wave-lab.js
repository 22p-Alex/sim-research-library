/* Linked CH4 inspection and a separate beat-envelope teaching example.
 * CH4 uses SIMCore.scene; the envelope uses SIMCore.beatExample, whose
 * sum/product identities are derived in the adjacent, offline KaTeX text.
 */
(function () {
  'use strict';
  const C=window.SIMCore,$=id=>document.getElementById(id),val=id=>Number($(id).value);
  const colors={emission:'#fbbf24',camera:'#4ade80',removed:'#f87171',difference:'#fb923c',envelope:'#c4b5fd',sample:'#cbd5e1',illumination:'#38bdf8',sum:'#f472b6',dc:'#94a3b8'};
  const X=50,R=640,width=R-X;
  let hooks,scene,scenePhase=0,ch4View='compare',envelopeView='sum',envelopePhase=0,envelopeRAF=0;
  const f=(n,d=3)=>Number(n.toFixed(d)).toString();
  const put=(id,text)=>{$(id).textContent=text;};
  const label=(x,y,text,color='#94a3b8',size=11,anchor='start')=>`<text x="${x}" y="${y}" fill="${color}" font-size="${size}" text-anchor="${anchor}">${text}</text>`;
  const line=(x1,y1,x2,y2,color='#334155',dash='')=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}"${dash?` stroke-dasharray="${dash}"`:''}/>`;
  function axis(top,height,min,max,ticks,title,color,xmax=120) {
    let svg=label(X,top-12,title,color,12);
    for(const v of ticks){const y=top+height*(max-v)/(max-min);svg+=line(X,y,R,y,'#334155','3 4')+label(X-9,y+4,f(v),'#94a3b8',10,'end');}
    return {svg,y:v=>top+height*(max-v)/(max-min),x:v=>X+v/xmax*width};
  }
  function curve(fn,a,color,{xmax=120,dash='',stroke=1.7,id='',opacity=1}={}) {
    const pts=[];
    for(let i=0;i<=960;i++){const x=xmax*i/960;pts.push(`${a.x(x).toFixed(2)},${a.y(fn(x)).toFixed(2)}`);}
    return `<polyline${id?` data-curve="${id}"`:''} points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="${stroke}" opacity="${opacity}"${dash?` stroke-dasharray="${dash}"`:''}/>`;
  }
  function probe(a,x,v,color) {return line(a.x(x),a.y(a.max??2),a.x(x),a.y(a.min??0),'#e2e8f0','2 4')+`<circle cx="${a.x(x)}" cy="${a.y(v)}" r="3.6" fill="${color}" stroke="#090d16" stroke-width="1.5"/>`;}
  function xlabels(y,xmax=120) {let svg='';for(const x of [0,xmax/4,xmax/2,3*xmax/4,xmax])svg+=label(X+x/xmax*width,y,`${x}${x===xmax?' px':''}`,'#94a3b8',10,x===0?'start':x===xmax?'end':'middle');return svg;}
  function swatch(name,value,color) {return `<span><i class="wave-swatch" style="--swatch:${color}"></i>${name} <strong>${f(value)}</strong></span>`;}
  function selectButtons(attribute,choice) {document.querySelectorAll(`[${attribute}]`).forEach(el=>el.setAttribute('aria-pressed',String(el.getAttribute(attribute)===choice)));}
  // Nonnegative coefficients and signed cosine contributions are kept distinct.
  function bands(s,p) {
    const m=s.ex.m,I=s.ex.mean,a=x=>C.TAU*s.fs*x,b=x=>C.TAU*(s.kx*x+s.ky*120)+p;
    return [
      {key:'dc',name:'平均亮度',freq:0,amp:I/2,h:1,at:()=>1},
      {key:'sample',name:'样品频率',freq:s.fs,amp:I/2,h:s.hs,at:x=>Math.cos(a(x))},
      {key:'illumination',name:'照明频率',freq:s.fi,amp:I*m/2,h:s.hi,at:x=>Math.cos(b(x))},
      {key:'difference',name:'差频',freq:s.diff,amp:I*m/4,h:s.hd,at:x=>Math.cos(a(x)-b(x))},
      {key:'sum',name:'和频',freq:Math.hypot(s.fs+s.kx,s.ky),amp:I*m/4,h:C.otf(s.fs+s.kx,s.ky,s.kc),at:x=>Math.cos(a(x)+b(x))}
    ];
  }
  function renderScene(s,p=scenePhase) {
    scene=s;scenePhase=p;
    const probeX=val('t1_ch4_probe'),v=s.at(probeX,120),bs=bands(s,p),at=x=>s.at(x,120);
    const top=axis(35,88,0,2,[0,1,2],ch4View==='compare'?'进入镜头之前 · CH3 发射 e':'相机记录的总信号 · CH4',ch4View==='compare'?colors.emission:colors.camera);
    const bottom=ch4View==='components'?axis(185,86,-.6,.6,[-.5,0,.5],'相机内部的五项 · 有符号，相加得到上图',colors.difference):ch4View==='removed'?axis(185,86,-1,2,[-1,0,1,2],'滤掉的部分 r = e − d · 有正也有负',colors.removed):axis(185,86,0,2,[0,1,2],'经过镜头之后 · CH4 相机 d',colors.camera);
    let svg=top.svg+bottom.svg;
    const mainKey=ch4View==='compare'?'emission':'camera';
    svg+=curve(x=>at(x)[mainKey],top,colors[mainKey],{id:mainKey,stroke:2});
    svg+=probe(top,probeX,v[mainKey],colors[mainKey]);
    if(ch4View==='components') {
      bottom.min=-.6;bottom.max=.6;
      for(const band of bs)svg+=curve(x=>band.amp*band.h*band.at(x),bottom,colors[band.key],{id:band.key,dash:band.key==='dc'?'5 4':band.key==='difference'?'':'3 3',stroke:band.key==='difference'?2.5:1.5,opacity:band.amp*band.h>1e-9?1:.3});
      svg+=line(bottom.x(probeX),185,bottom.x(probeX),271,'#e2e8f0','2 4');
      $('t1_ch4_readout').innerHTML=bs.map(band=>swatch(band.name,band.amp*band.h*band.at(probeX),colors[band.key])).join('')+swatch('相加 = CH4',v.camera,colors.camera);
      put('t1_ch4_guide','上图只画相机总信号；下图把它拆开。灰虚线是平均亮度，橙实线是差频项。沿白色竖线读数：下方五项相加，恰好等于上方绿色读数。');
    } else {
      const removed=ch4View==='removed',key=removed?'removed':'camera',fn=x=>removed?at(x).emission-at(x).camera:at(x).camera;
      bottom.min=removed?-1:0;bottom.max=2;
      svg+=curve(fn,bottom,colors[key],{id:key,dash:removed?'4 3':'',stroke:2});
      svg+=probe(bottom,probeX,fn(probeX),colors[key]);
      $('t1_ch4_readout').innerHTML=swatch('输入 e',v.emission,colors.emission)+swatch('相机 d',v.camera,colors.camera)+(removed?swatch('差值 r',v.emission-v.camera,colors.removed):'');
      put('t1_ch4_guide',removed?'绿线是相机保留的信号，红虚线是输入减去输出的差值。它可以为负：模糊也会把邻近亮处的信号扩散到原本的暗处。任一点都满足：输入 = 绿色 + 红色。':'先比较上下两行：黄色含密集细节，绿色更平滑。两行使用相同的 0–2 强度刻度；拖动“读数位置”，沿同一条白色竖线比较输入与输出。');
    }
    svg+=xlabels(292);
    $('t1_ch4_plot').innerHTML=svg;
    $('t1_ch4_plot').setAttribute('aria-label',`CH4 ${ch4View==='compare'?'前后对照':ch4View==='components'?'分量拆解':'滤除残差'}，x=${probeX} px，输入 ${f(v.emission)}，相机 ${f(v.camera)}`);
    put('t1_ch4_probe_out',`${f(probeX)} px`);put('t1_ch4_phi_out',`${f(p/Math.PI,2)}π`);$('t1_ch4_phi').value=p/Math.PI;
    $('t1_ch4_bands').innerHTML=bs.map(band=>`<tr><td>${band.name}</td><td>${f(band.freq,4)}</td><td>${f(band.amp)}</td><td><span class="wave-gain"><i style="width:${band.h*100}%"></i></span>${f(band.h*100,1)}%</td><td>${f(band.amp*band.h,4)}</td></tr>`).join('');
    const surviving=bs.slice(1).filter(band=>band.amp*band.h>1e-10);
    let verdict;
    if(!s.ex.mean)verdict='当前没有激发光，输入与输出均为零。先增大上方照明周期，使光束进入入瞳。';
    else if(!s.ex.m)verdict='当前为均匀照明，没有差频项。相机只可能保留平均亮度和衰减后的样品条纹。';
    else if(s.diff<1e-10)verdict='当前差频为零：橙色分量是随相位变化的常量，改变平均亮度，没有空间上的宽条纹。';
    else if(surviving.length===1&&surviving[0].key==='difference')verdict=`当前恰好只剩平均亮度 + 差频项。宽条纹的周期为 ${f(1/s.diff,2)} px；播放相移，就能看到它移动。`;
    else verdict=`当前保留：平均亮度${surviving.length?' + '+surviving.map(b=>b.name).join(' + '):''}。${s.hd>0?'差频振幅只保留 '+f(s.hd*100,1)+'%。':'差频在截止点或通带外。'}${Math.abs(s.ky)>1e-10?' 图为水平截线，OTF 仍按二维频率模长计算。':''}`;
    put('t1_ch4_verdict',verdict);
  }
  function envelopeFill(a,model,product) {
    const upper=[],lower=[];
    for(let i=0;i<=960;i++){const x=i/960*200,v=model.at(x);upper.push(`${a.x(x).toFixed(2)},${a.y(product?v.upper:v.amplitude).toFixed(2)}`);lower.unshift(`${a.x(x).toFixed(2)},${a.y(product?0:-v.amplitude).toFixed(2)}`);}
    return `<polygon points="${upper.concat(lower).join(' ')}" fill="#a78bfa" opacity=".13"/>`;
  }
  function renderEnvelope() {
    const delta=val('t1_envelope_delta'),model=C.beatExample(delta,envelopePhase),product=envelopeView==='product',show=$('t1_envelope_show').checked;
    const a=axis(38,155,product?0:-2.25,2.25,product?[0,1,2]:[-2,-1,0,1,2],product?'黄色：样品 × 照明；紫色：慢变上边界 U':'黄色：两个余弦之和；紫色：上下包络 ±A',colors.envelope,200);
    let svg=a.svg;
    if(show)svg+=envelopeFill(a,model,product);
    svg+=curve(x=>model.at(x)[product?'product':'sum'],a,colors.emission,{xmax:200,id:'fast-signal',stroke:1.5});
    if(show){svg+=curve(x=>model.at(x)[product?'upper':'amplitude'],a,colors.envelope,{xmax:200,id:'upper-envelope',stroke:2.4});svg+=curve(x=>product?0:-model.at(x).amplitude,a,colors.envelope,{xmax:200,id:'lower-envelope',stroke:2.4});}
    svg+=xlabels(211,200);
    const b=axis(246,51,product?-.3:0,product?.3:2,product?[-.25,0,.25]:[0,1,2],product?'橙色：单独的差频项 ¼ cos(a − b) · 未经 OTF':'只看振幅 A：鼓包之间的距离 = 1 / Δf',product?colors.difference:colors.envelope,200);
    svg+=b.svg+curve(x=>model.at(x)[product?'difference':'amplitude'],b,product?colors.difference:colors.envelope,{xmax:200,id:product?'difference':'amplitude-only',stroke:2.2});
    // Mark adjacent maxima only when a full pair fits in the displayed interval.
    if(delta>0){const period=1/delta,x0=envelopePhase/C.TAU/delta;if(x0+period<=200){const l=b.x(x0),r=b.x(x0+period);svg+=line(l,315,r,315,colors.envelope)+line(l,311,l,319,colors.envelope)+line(r,311,r,319,colors.envelope)+label((l+r)/2,327,`${f(period,1)} px`,colors.envelope,10,'middle');}}
    $('t1_envelope_plot').innerHTML=svg;
    $('t1_envelope_plot').setAttribute('aria-label',`${product?'乘积上边界与差频':'两余弦之和与上下包络'}；频差 ${f(delta)}，相位 ${f(envelopePhase/Math.PI,2)}π，${delta?'鼓包间距 '+f(model.beatPeriod,1)+' px':'零频差，无空间鼓包'}`);
    put('t1_envelope_delta_out',`${f(delta)} cycles/px`);put('t1_envelope_phi_out',`${f(envelopePhase/Math.PI,2)}π`);$('t1_envelope_phi').value=envelopePhase/Math.PI;
    put('t1_envelope_guide',product?'同一对频率，改为相乘：紫线包住黄色波形的波峰；橙线单独画在下面，它会上下过零。观察：外边界和差频项的形状、数值并不相同。':'先找黄色细波，再沿紫色边界看“大鼓包”。紫色区域越宽，细波振幅越大；两条紫线合拢时，两个余弦局部抵消。可取消勾选包络，试着自己辨认。');
    const period=delta?`鼓包间距 ${f(model.beatPeriod,1)} px${model.beatPeriod>200?'（超过当前 200 px 视窗）':''}`:'频差为 0：包络在空间上是常数，没有一串鼓包；相移仍会改变整体振幅';
    put('t1_envelope_status',`f₁ = ${f(model.f1,4)}，f₂ = ${f(model.f2,4)} cycles/px · ${period}。${delta?'频差越小，鼓包越宽。':''}`);
    $('t1_envelope_sum_text').hidden=product;$('t1_envelope_product_text').hidden=!product;
  }
  function stopEnvelope() {cancelAnimationFrame(envelopeRAF);envelopeRAF=0;put('t1_envelope_play','▶ 播放包络移动');$('t1_envelope_play').setAttribute('aria-pressed','false');}
  function playEnvelope() {
    if(envelopeRAF){stopEnvelope();return;}
    put('t1_envelope_play','⏸ 暂停包络移动');$('t1_envelope_play').setAttribute('aria-pressed','true');let last=0;
    function tick(now) {
      if(document.hidden||$('tab1Content').hidden){stopEnvelope();return;}
      if(!last)last=now;
      if(now-last>=40){envelopePhase=(envelopePhase+Math.min(.1,(now-last)/1000)*.8)%C.TAU;last=now;renderEnvelope();}
      envelopeRAF=requestAnimationFrame(tick);
    }
    envelopeRAF=requestAnimationFrame(tick);
  }
  function setScenePlaying(playing) {put('t1_ch4_play',playing?'⏸ 暂停相移':'▶ 播放相移');$('t1_ch4_play').setAttribute('aria-pressed',String(playing));}
  function resetEnvelope() {stopEnvelope();envelopePhase=0;envelopeView='sum';for(const id of ['t1_envelope_delta','t1_envelope_phi'])$(id).value=$(id).defaultValue;$('t1_envelope_show').checked=true;selectButtons('data-envelope-view','sum');renderEnvelope();}
  function reset() {ch4View='compare';selectButtons('data-ch4-view','compare');$('t1_ch4_probe').value=30;resetEnvelope();}
  function init(callbacks) {
    hooks=callbacks;
    document.querySelectorAll('[data-ch4-view]').forEach(el=>el.addEventListener('click',()=>{ch4View=el.dataset.ch4View;selectButtons('data-ch4-view',ch4View);renderScene(scene);}));
    document.querySelectorAll('[data-envelope-view]').forEach(el=>el.addEventListener('click',()=>{envelopeView=el.dataset.envelopeView;selectButtons('data-envelope-view',envelopeView);renderEnvelope();}));
    $('t1_ch4_probe').addEventListener('input',()=>renderScene(scene));
    $('t1_ch4_phi').addEventListener('input',()=>hooks.setPhase(val('t1_ch4_phi')*Math.PI));
    $('t1_ch4_step').addEventListener('click',()=>hooks.setPhase((scenePhase+C.TAU/3)%C.TAU));
    $('t1_ch4_play').addEventListener('click',()=>hooks.playScene());
    $('t1_ch4_preset').addEventListener('click',()=>hooks.preset());
    $('t1_envelope_delta').addEventListener('input',renderEnvelope);
    $('t1_envelope_phi').addEventListener('input',()=>{envelopePhase=val('t1_envelope_phi')*Math.PI;renderEnvelope();});
    $('t1_envelope_step').addEventListener('click',()=>{envelopePhase=(envelopePhase+C.TAU/3)%C.TAU;renderEnvelope();});
    $('t1_envelope_play').addEventListener('click',playEnvelope);
    $('t1_envelope_reset').addEventListener('click',resetEnvelope);
    $('t1_envelope_show').addEventListener('change',renderEnvelope);
    renderEnvelope();
  }
  window.SIMWaveLab={init,renderScene,reset,stopEnvelope,setScenePlaying};
})();
