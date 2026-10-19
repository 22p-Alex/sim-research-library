/* The same retained equation carries the single-point, conjugate, pooled and
 * parameter-reading derivation. A shared teaching progress drives both rails. */
(function(root){
  'use strict';
  const S=root.SIMCoefficientMainline,C=root.SIMBeatClock,Actors=root.SIMMathActors;
  const orange='#efb879',purple='#b7a5eb',teal='#7ad5cd';
  const factor=String.raw`\left({\color{#efb879}m}e^{i{\color{#b7a5eb}\phi_\Delta}}\right)`;
  const estimated=String.raw`{\color{#efb879}\widehat m}e^{i{\color{#b7a5eb}\widehat\phi_\Delta}}`;
  S.createDerivationActors=function({parent,document=root.document,footer=false}){
    const svgNS='http://www.w3.org/2000/svg',mathNS='http://www.w3.org/1998/Math/MathML';
    const make=(tag,attrs,p,ns=mathNS)=>{const n=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs||{}))n.setAttribute(k,v);p.appendChild(n);return n;};
    const layer=make('g',{'data-coefficient-derivation':footer?'footer':'stage'},parent,svgNS);
    const tokens={V:{tex:'V',width:105,color:purple},U:{tex:'U',width:105,color:teal},eq:{tex:'=',width:32},factor:{tex:factor,width:205},
      star:{tex:String.raw`U^*`,width:125,color:teal},bottomStar:{tex:String.raw`U^*`,width:125,color:teal},
      energy:{tex:String.raw`|U|^2`,width:160,color:teal},numeratorU:{tex:'U',width:105,color:teal},
      numeratorEnergy:{tex:String.raw`|U|^2`,width:160,color:teal},numeratorFactor:{tex:factor,width:205},
      topSum:{tex:String.raw`\sum_{\mathbf q\in\Omega}`,width:108},bottomSum:{tex:String.raw`\sum_{\mathbf q\in\Omega}`,width:108},
      estimate:{tex:estimated,width:205},bar:{bar:true,width:1}};
    let frames=[{at:0,key:'entry',poses:{}}];
    const actors=Actors.create({parent:layer,tokens,frames,name:footer?'coefficient-derivation-footer':'coefficient-ratio',document});
    actors.actors.bar.g.children[0].setAttribute('vector-effect','non-scaling-stroke');
    const addresses=[],subscripts=[],bases={};
    // Address pads expose q₁ locally without replacing V or U. Later only the
    // subscript 1 collapses; q remains as the common summation variable.
    function addressed(key,kind){
      const content=actors.actors[key].math.children[0].children[0];content.innerHTML='';
      const power=kind==='energy'?make('msup',{},content):null,row=power?make('mrow',{},power):content;
      if(kind==='energy')make('mo',{},row).textContent='|';
      const name=kind==='star'?make('msup',{},row):row;
      const glyph=make('mi',{},name);glyph.textContent=key==='V'?'V':'U';bases[key]=glyph;
      if(kind==='star')make('mo',{},name).textContent='*';
      const pad=make('mpadded',{width:'2.8em','data-coefficient-address':key},row),address=make('mrow',{},pad);
      make('mo',{stretchy:'false'},address).textContent='(';
      const coordinate=make('msub',{},address);make('mi',{mathvariant:'bold'},coordinate).textContent='q';
      const one=make('mpadded',{width:'.5em','data-coordinate-subscript':key},coordinate);make('mn',{},one).textContent='1';
      make('mo',{stretchy:'false'},address).textContent=')';
      addresses.push({pad,address});subscripts.push(one);
      if(kind==='energy'){make('mo',{},row).textContent='|';make('mn',{},power).textContent='2';}
    }
    for(const key of ['V','U','numeratorU'])addressed(key,'plain');
    for(const key of ['star','bottomStar'])addressed(key,'star');
    for(const key of ['energy','numeratorEnergy'])addressed(key,'energy');
    const r=C.ramp,baseWidths={V:27,U:27},seed={
      V:{x:968,y:388,scale:.8125},eq:{x:1052,y:388,scale:.8125},
      factor:{x:1095,y:388,scale:.8125},U:{x:1351,y:388,scale:.8125}};
    function relation(addressed=false){
      return Actors.layout({rows:[{keys:['V','eq','factor','U'],x:720,y:240,size:44,gap:20}]},addressed?actors.widths:{...actors.widths,...baseWidths});
    }
    function fraction(numerator,denominator,{hat=false,y=240}={}){
      const widths=actors.widths,gap=12,scale=1.13;
      const width=keys=>keys.reduce((sum,key)=>sum+widths[key],0)+gap*(keys.length-1);
      const fw=Math.max(width(numerator),width(denominator))+28,coefficient=hat?'estimate':'factor';
      const total=fw+36+widths.eq+28+widths[coefficient],left=720-total*scale/2;
      const poses={bar:{x:left,y:y+9,scale:fw*scale},eq:{x:left+(fw+36)*scale,y,scale},[coefficient]:{x:left+(fw+36+widths.eq+28)*scale,y,scale}};
      for(const [keys,baseline]of [[numerator,y-40],[denominator,y+48]]){
        let x=left+(fw-width(keys))*scale/2;
        for(const key of keys){poses[key]={x,y:baseline,scale};x+=(widths[key]+gap)*scale;}
      }
      return poses;
    }
    function buildFrames(){
      const single=fraction(['V'],['U']),multiply=fraction(['star','V'],['bottomStar','U']);
      const conjugate=fraction(['star','V'],['energy']),pooled=fraction(['topSum','star','V'],['bottomSum','energy'],{hat:true});
      const next=[{at:-1,key:'entry',poses:footer?relation():seed},
        {at:0,span:.07,key:'center',poses:relation()},
        {at:.08,span:.03,key:'coordinate',poses:relation(true)},
        {at:.115,span:.06,key:'divide',poses:single,arcs:{U:-35,V:18}},
        {at:.18,span:.035,key:'multiply-conjugate',poses:multiply,origins:{star:'V',bottomStar:'U'},focus:['star','bottomStar']},
        {at:.22,span:.03,key:'modulus',poses:conjugate,origins:{energy:'U'},merges:{U:'energy',bottomStar:'energy'}},
        {at:.27,span:.04,key:'expand-V',poses:fraction(['star','numeratorFactor','numeratorU'],['energy']),
          origins:{numeratorFactor:'V',numeratorU:'V'},merges:{V:'numeratorU'},focus:['star','numeratorU']},
        {at:.33,span:.04,key:'cancel-sample-phase',poses:fraction(['numeratorFactor','numeratorEnergy'],['energy']),
          origins:{numeratorEnergy:'numeratorU'},merges:{star:'numeratorEnergy',numeratorU:'numeratorEnergy'},focus:['numeratorEnergy']},
        {at:.405,span:.045,key:'restore-observations',poses:conjugate,origins:{star:'numeratorEnergy',V:'numeratorFactor'},merges:{numeratorEnergy:'star',numeratorFactor:'V'}},
        {at:.50,span:.065,key:'pool',poses:pooled,origins:{topSum:'star',bottomSum:'energy',estimate:'factor'},merges:{factor:'estimate'},focus:['topSum','bottomSum','estimate']},
        {at:.75,span:.04,key:'read',poses:fraction(['topSum','star','V'],['bottomSum','energy'],{hat:true,y:140})}];
      frames.splice(0,frames.length,...next);
    }
    let measured=false,entryMeasured=false;
    function measure(entry){
      if(!measured){
        // Measure native MathML with addresses fully expanded once. Playback
        // thereafter changes only stored poses, pad widths and opacity.
        actors.draw(-1,1);
        for(const key of ['V','U']){
          const box=actors.actors[key].box.getBoundingClientRect(),glyph=bases[key].getBoundingClientRect();
          if(box.width>0&&glyph.width>0)baseWidths[key]=glyph.width*1440/box.width;
        }
        measured=true;buildFrames();
      }
      if(footer||entryMeasured||!entry)return;
      const first=actors.actors.V.box.getBoundingClientRect();
      if(typeof first.width!=='number'){entryMeasured=true;return;}
      // Transfer the exact original right-hand row, including its native font
      // baseline, before moving the same V and U into the central fraction.
      const findMath=n=>n.tagName.toLowerCase()==='math'?n:Array.from(n.children).map(findMath).find(Boolean);
      const poses={};
      for(const key of ['V','eq','factor','U']){
        const a=actors.actors[key],source=findMath(entry[key]);if(!source)return;
        a.g.setAttribute('transform','translate(0 0) scale(0.8125)');
        const viewport=a.box.getBoundingClientRect(),sourceContent=source.children[0]?.children[0]||source;
        const glyph=n=>n.tagName.toLowerCase()==='mi'?n:Array.from(n.children).map(glyph).find(Boolean);
        const sourceRect=(bases[key]?glyph(sourceContent):sourceContent).getBoundingClientRect(),target=(bases[key]||a.math.children[0].children[0]).getBoundingClientRect();
        if(!(viewport.width>0&&sourceRect.width>0&&target.width>0))return;
        const unit=viewport.width/(1440*.8125);
        poses[key]={x:(sourceRect.left-target.left)/unit,y:(sourceRect.top-target.top)/unit,scale:.8125};
      }
      Object.assign(seed,poses);entryMeasured=true;buildFrames();
    }
    function draw(t,visible=1,entry){
      if(visible>0){
        measure(); // compile/measure in the full, stable intrinsic pose
        const address=r(t,.08,.11),pooled=r(t,.50,.565);
        addresses.forEach(({pad,address:node})=>{pad.setAttribute('width',2.8*address+'em');node.style.opacity=String(address);});
        subscripts.forEach(n=>{n.setAttribute('width',.5*(1-pooled)+'em');n.style.opacity=String(1-pooled);});
        measure(entry);
      }
      const state=actors.draw(t,visible);
      if(t>=.50){
        const old=actors.actors.factor.g,hat=actors.actors.estimate.g;
        const a=1-r(t,.50,.525),b=r(t,.545,.565);
        old.setAttribute('opacity',a);old.setAttribute('aria-hidden',a===0);hat.setAttribute('opacity',b);hat.setAttribute('aria-hidden',b===0);
      }
      const lift=100*r(t,.75,.79);layer.setAttribute('transform',footer?`translate(0 ${-105+lift})`:'translate(0 0)');
      layer.setAttribute('data-sub-progress',t);layer.setAttribute('data-derivation-phase',S.derivationKey(t));
      layer.setAttribute('aria-label',S.derivationFormulas[S.derivationKey(t)]);
      return state;
    }
    buildFrames();draw(0,0);return {group:layer,actors,draw};
  };
  S.createDerivationFormulaView=function({parent,document=root.document}){
    parent.setAttribute('class','pe-study-formula pe-correspondence-formula');
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    for(const[k,v]of Object.entries({viewBox:'0 0 1440 270',role:'img','data-coefficient-formula':''}))svg.setAttribute(k,v);
    parent.appendChild(svg);const formula=S.createDerivationActors({parent:svg,document,footer:true});
    return {draw(progress){const s=S.presentation(progress);formula.draw(s.subProgress);svg.setAttribute('aria-label',s.equation);return s;},group:svg};
  };
  S.createView=function({parent,lesson,el,label,line,path,vector,set,text,opacity}){
    const d=S.dataFor(lesson),r=C.ramp;
    const g=el('g',{'data-coefficient-mainline':'',opacity:0},parent),formula=S.createDerivationActors({parent:g});
    const reliableCaption=label(g,1110,470,'公共区 Ω 内两边光学传递函数 H 都可靠','pe-two-text');
    set(reliableCaption,'data-coefficient-reliable-caption','');
    const subtitles=[
      ['代数上看：直接相除就能算出来'],
      ['为什么乘共轭 U*？因为 U*(q₁)U(q₁) = |U(q₁)|²，','正好消去样品自身的随机相位'],
      ['单个频点易受噪声干扰；公共区 Ω 内所有点共享同一个 m exp(iφΔ)，','对全部可靠点求和即可抗噪（复数最小二乘解）'],
      ['复数比值：取模长得到调制度 m̂，取相角得到共同相位偏移 φ̂Δ']
    ].map((lines,i)=>{const group=el('g',{'data-coefficient-subtitle':i+1},g),y=i===3?530:i===2?420:380;lines.forEach((value,j)=>label(group,720,y+j*30,value,'pe-two-text'));return group;});
    const phaseNote=el('g',{'data-coefficient-phase-cancellation':''},g);
    const phaseMath=Actors.create({parent:phaseNote,name:'coefficient-phase-proof',tokens:{identity:{tex:String.raw`U_1=|U_1|e^{i\theta_1},\quad U_1^*U_1=|U_1|^2e^{i(-\theta_1+\theta_1)}=|U_1|^2\ge0`,width:1040,color:teal}},frames:[{at:0,rows:[{keys:['identity'],x:720,y:470,size:26,maxWidth:1240}]}]});
    const pool=el('g',{'data-coefficient-pool':''},g);
    const poolMath=Actors.create({parent:pool,name:'coefficient-pool-notes',tokens:{C:{tex:String.raw`C=\sum_{\mathbf q\in\Omega}U^*(\mathbf q)V(\mathbf q)`,width:430,color:purple},E:{tex:String.raw`E_U=\sum_{\mathbf q\in\Omega}|U(\mathbf q)|^2>0`,width:400,color:teal}},frames:[{at:0,rows:[{keys:['C'],x:380,y:340,size:26},{keys:['E'],x:1060,y:340,size:26}]}]});
    label(pool,380,375,'同相乘积同向累加增强','pe-two-small',purple);label(pool,1060,375,'用 0 级总能量归一化','pe-two-small',teal);
    const counter=label(pool,720,495,'','pe-two-small');
    const cards=el('g',{'data-coefficient-cards':''},g),branches=el('g',{'data-coefficient-branches':''},cards);
    path(branches,orange,{'d':'M 720 216 L 720 236 L 370 236 L 370 270'});path(branches,purple,{'d':'M 720 236 L 1060 236 L 1060 270'});
    const cardNodes=[['m̂',70,600,orange,'模长 = 调制度'],['φ̂Δ',730,640,purple,'相角 = 共同相位偏移']].map(([name,x,width,color,title])=>{
      const group=el('g',{'data-coefficient-card':name},cards);el('rect',{x,y:280,width,height:215,rx:8,fill:'#0c1b22',stroke:color},group);label(group,x+width/2,314,title,'pe-two-text',color);return group;
    });
    const cardMath=Actors.create({parent:cards,name:'coefficient-read-cards',tokens:{
      m:{tex:S.derivationFormulas.magnitude.slice(2,-2),width:545,color:orange},
      phase:{tex:String.raw`\widehat\phi_\Delta=\arg\!\left(\sum_{\mathbf q\in\Omega}U^*(\mathbf q)V(\mathbf q)\right)`,width:595,color:purple},
      frames:{tex:String.raw`\widehat\phi_j=\frac{2\pi j}{3}+\widehat\phi_\Delta`,width:420,color:purple}},
      frames:[{at:0,rows:[{keys:['m'],x:370,y:379,size:29,maxWidth:530},{keys:['phase'],x:1050,y:365,size:28,maxWidth:575},{keys:['frames'],x:1050,y:423,size:28,maxWidth:575}]}]});
    const num=x=>Math.abs(x)<1e-8?'0.0000':Math.abs(x)>=1e5?x.toExponential(3):x.toFixed(4);
    const magnitudeValue=label(cards,370,467,'','pe-two-small',orange),phaseValue=label(cards,1050,470,'','pe-two-small',purple);
    // The small phasor in the phase card displays the actual result, including
    // near-zero phase; no illustrative rotation enters the estimator.
    const alphaVector=path(cards,purple,{'data-coefficient-result-vector':''}),resultArc=path(cards,purple,{'data-coefficient-result-angle':''});
    function draw(progress,{entry}={}){
      opacity(g,progress===null?0:1);if(progress===null)return null;
      const s=S.state(lesson,progress),prepare=s.mode==='correspondence',t=s.subProgress;
      set(g,'data-mode',s.mode);set(g,'data-substep',s.substep);set(g,'data-sub-progress',t);set(g,'data-count',s.count);set(g,'data-total',s.total);
      for(const[key,v]of Object.entries(s.sum))set(g,'data-sum-'+key,v);
      opacity(reliableCaption,s.reliableCaption);formula.draw(t,prepare?0:1,entry);
      const fades=[r(t,.035,.07)*(1-r(t,.235,.25)),r(t,.25,.265)*(1-r(t,.46,.48)),r(t,.48,.50)*(1-r(t,.73,.75)),r(t,.75,.78)];
      subtitles.forEach((node,i)=>opacity(node,prepare?0:fades[i]));
      phaseMath.draw(0,prepare?0:r(t,.29,.32)*(1-r(t,.44,.475)));
      const poolAlpha=!prepare&&s.mode==='pooledRatio'?r(s.local,.25,.34)*(1-r(t,.73,.75)):0;
      opacity(pool,poolAlpha);poolMath.draw(0,poolAlpha);
      text(counter,s.count+' / '+s.total+' 个可靠对应频点 · C = '+num(s.sum.re)+(s.sum.im<0?' − ':' + ')+num(Math.abs(s.sum.im))+'i · E_U = '+num(s.sum.energy));
      opacity(cards,s.cards);cardMath.draw(0,s.cards);
      vector(alphaVector,d.alpha,24,[1280,470]);
      const angle=lesson.estimate.phase*s.phase,cx=1280,cy=470,rad=14;
      set(resultArc,'d',`M ${cx+rad} ${cy} A ${rad} ${rad} 0 ${Math.abs(angle)>Math.PI?1:0} ${angle>=0?0:1} ${cx+rad*Math.cos(angle)} ${cy-rad*Math.sin(angle)}`);
      set(resultArc,'data-angle',angle);opacity(resultArc,s.phase);set(alphaVector,'data-magnitude-read',s.magnitude);
      text(magnitudeValue,'m̂ = '+num(Math.hypot(d.alpha.re,d.alpha.im)));text(phaseValue,'φ̂Δ = '+num(lesson.estimate.phase)+' rad · j = 0, 1, 2');
      set(g,'aria-label',s.equation);return s;
    }
    draw(null);return {group:g,draw,data:d,fraction:formula.actors};
  };
})(typeof globalThis!=='undefined'?globalThis:this);
