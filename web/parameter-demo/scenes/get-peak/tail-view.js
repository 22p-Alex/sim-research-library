/* Retained A–D actors: algebra, explicitly separate ideal geometry, actual
 * array prefixes and the fitted coefficient. No estimator is run here. */
(function(root){
  'use strict';
  const Tail=root.SIMParameterTail,{ramp}=root.SIMBeatClock,lerp=(a,b,t)=>a+(b-a)*t;
  const ink='#dce8e6',cyan='#7ad5cd',purple='#b7a5eb',orange='#efb879';
  Tail.createView=function({parent,lesson,images,el,label,path,line,vector,set,text,opacity,plane,prefix,defs,uid}){
    const Peak=root.SIMGetPeak,data=Peak.dataFor(lesson),peak=data.peak;
    const num=x=>Math.abs(x)<1e-10?'0.000000':x.toFixed(6);
    const complex=z=>num(z.re)+(z.im<0&&Math.abs(z.im)>1e-10?' - ':' + ')+num(Math.abs(z.im))+'i';
    const tex=z=>String.raw`\left(`+num(z.re)+(z.im<0&&Math.abs(z.im)>1e-10?'-':'+')+num(Math.abs(z.im))+'i'+String.raw`\right)`;
    const group=el('g',{'data-parameter-tail':'','data-style-scope':'parameter-tail'},parent);
    const tokens={},add=(key,t,width=50,color=ink)=>tokens[key]={tex:t,width,color};
    add('z','z',24,orange);add('eq','=',30);add('approx',String.raw`\approx`,30);
    add('uStar',String.raw`u^*(\mathbf r)`,82,cyan);add('v',String.raw`v_{\widehat{\mathbf k}}(\mathbf r)`,116,purple);
    add('rU',String.raw`u(\mathbf r)=a_{\mathbf r}e^{i\psi_{\mathbf r}}`,340,cyan);
    add('rV',String.raw`v_{\widehat{\mathbf k}}(\mathbf r)=m a_{\mathbf r}e^{i\psi_{\mathbf r}}e^{i\phi_\Delta}`,535,purple);
    add('a','a',26,cyan);add('aCopy','a',26,cyan);add('m','m',32);
    add('minusPsi',String.raw`e^{-i\psi}`,96,cyan);add('plusPsi',String.raw`e^{i\psi}`,88,cyan);
    add('zeroPsi',String.raw`e^{i(-\psi+\psi)}`,184,cyan);add('one','1',24,cyan);
    add('phase',String.raw`e^{i\phi_\Delta}`,106);add('aSq','a^2',44,cyan);
    add('alpha1',String.raw`\alpha`,30);add('alpha2',String.raw`\alpha`,30);add('alpha3',String.raw`\alpha`,30);
    add('energyDef',String.raw`e(\mathbf r)=|u(\mathbf r)|^2=a_{\mathbf r}^2`,408,cyan);
    for(let i=1;i<=3;i++){add('z'+i,'z_'+i,36,orange);add('e'+i,'e_'+i,36,cyan);add('eq'+i,'=',30);}
    for(let i=1;i<=4;i++)add('plus'+i,'+',30);
    add('open','(',20);add('close',')',20);
    add('sumZ',String.raw`\sum_{\mathbf r}z(\mathbf r)`,182,orange);add('sumE',String.raw`\sum_{\mathbf r}e(\mathbf r)`,182,cyan);
    add('C','C',38,orange);add('E','E_0',50,cyan);add('EL','E_0',50,cyan);add('ER','E_0',50,cyan);
    tokens.barL={bar:true,width:190};tokens.barR={bar:true,width:170};
    add('hat',String.raw`\widehat\alpha`,46);add('defeq',':=',46);add('hat2',String.raw`\widehat\alpha=`,83);
    add('cNum',tex(peak.sums.at(-1)),390,orange);add('eNum',num(peak.referenceEnergy),222,cyan);
    add('alphaNum',tex(peak.alpha),390,orange);
    add('objective',String.raw`\widehat\alpha=\underset{\beta\in\mathbb C}{\arg\min}\sum_{\mathbf r}|v_{\widehat{\mathbf k}}-\beta u|^2`,1060);
    add('mDef',String.raw`\widehat m=|\widehat\alpha|`,292,orange);add('mNum',String.raw`\widehat m=`+num(peak.m),320,orange);
    add('phaseDef',String.raw`\widehat\phi_\Delta=\arg\widehat\alpha`,390,purple);
    add('polar',String.raw`\widehat\alpha=\widehat m e^{i\widehat\phi_\Delta}`,450);
    for(let j=0;j<3;j++){
      add('relative'+j,j===0?'0':j===1?String.raw`\frac{2\pi}{3}`:String.raw`\frac{4\pi}{3}`,86);
      add('delta'+j,String.raw`+\widehat\phi_\Delta`,140,purple);
      add('frame'+j,String.raw`\widehat\phi_`+j+'=',90);
    }
    const row=(keys,y=210,size=32,x=720)=>({keys,y,size,x});
    const refs=[row(['rU'],75,21,370),row(['rV'],112,21,490)];
    const triple=[1,2,3].map((i)=>row(['z'+i,'eq'+i,'alpha'+i,'e'+i],132+(i-1)*68));
    const left=['z1','plus1','z2','plus2','z3','eq1'];
    const frames=[
      {at:0,key:'product',rows:[row(['z','eq','uStar','v']),row(['energyDef'],280,23)]},
      {at:4,span:2,key:'polar-definitions',rows:[row(['rU'],135,29),row(['rV'],205,29)],origins:{rU:'uStar',rV:'v'}},
      {at:10,span:2,key:'substitute',rows:[...refs,row(['z','eq','a','minusPsi','m','aCopy','plusPsi','phase'],220)],origins:{a:'rU',minusPsi:'rU',m:'rV',aCopy:'rV',plusPsi:'rV',phase:'rV'},arcs:{minusPsi:25,phase:30}},
      {at:12,span:2,key:'cancel-phase',rows:[...refs,row(['z','eq','m','aSq','zeroPsi','phase'],220)],origins:{aSq:'a',zeroPsi:'minusPsi'},merges:{a:'aSq',aCopy:'aSq',minusPsi:'zeroPsi',plusPsi:'zeroPsi'},focus:['zeroPsi']},
      {at:14,span:1,key:'phase-is-one',rows:[...refs,row(['z','eq','m','aSq','one','phase'],220)],origins:{one:'zeroPsi'},merges:{zeroPsi:'one'}},
      {at:16,span:1,key:'remaining',rows:[...refs,row(['z','eq','m','aSq','phase'],220)]},
      {at:18,span:2,key:'name-alpha',rows:[row(['z','eq','alpha1','aSq'],185),row(['energyDef'],265,24)],origins:{alpha1:'phase'},merges:{m:'alpha1',phase:'alpha1'},arcs:{alpha1:32}},
      {at:20,span:2,key:'name-energy',rows:[row(['z1','eq1','alpha1','e1'],180),row(['energyDef'],260,24)],origins:{z1:'z',eq1:'eq',e1:'aSq'},merges:{z:'z1',eq:'eq1',aSq:'e1'}},
      {at:24,span:2,key:'second-position',rows:triple.slice(0,2),origins:{z2:'z1',eq2:'eq1',alpha2:'alpha1',e2:'e1'}},
      {at:28,span:2,key:'third-position',rows:triple,origins:{z3:'z2',eq3:'eq2',alpha3:'alpha2',e3:'e2'}},
      {at:33,span:3,key:'three-contributions',rows:[row([...left,'alpha1','e1','plus3','alpha2','e2','plus4','alpha3','e3'],205)],focus:['alpha1','alpha2','alpha3']},
      {at:42,span:3,key:'factor-out',rows:[row([...left,'alpha1','open','e1','plus3','e2','plus4','e3','close'],205)],merges:{alpha2:'alpha1',alpha3:'alpha1'},arcs:{alpha1:40}},
      {at:48,span:3,key:'all-positions',rows:[row(['sumZ','eq1','alpha1','sumE'],205)],origins:{sumZ:'z2',sumE:'e2'},merges:{z1:'sumZ',z2:'sumZ',z3:'sumZ',e1:'sumE',e2:'sumE',e3:'sumE'}},
      {at:51,span:2,key:'name-sums',rows:[row(['C','eq1','alpha1','E'],205)],origins:{C:'sumZ',E:'sumE'},merges:{sumZ:'C',sumE:'E'}},
      {at:58,span:2,key:'actual-relation',rows:[row(['C','approx','alpha1','E'],175)],origins:{approx:'eq1'},merges:{eq1:'approx'}},
      {at:69,span:2,key:'complete-sums',rows:[row(['C','approx','alpha1','E'],175)],poses:{cNum:{x:195,y:345,scale:.68},eNum:{x:1000,y:345,scale:.68}}},
      {at:74,span:3,key:'divide-both-sides',poses:{C:{x:432,y:171},barL:{x:362,y:207},EL:{x:434,y:258},approx:{x:653,y:218},alpha1:{x:852,y:171},E:{x:895,y:171},barR:{x:817,y:207},ER:{x:877,y:258}},origins:{EL:'E',ER:'E'},arcs:{EL:28,ER:20},focus:['EL','ER','E']},
      {at:80,span:3,key:'cancel-energy',poses:{C:{x:432,y:171},barL:{x:362,y:207},EL:{x:434,y:258},approx:{x:653,y:218},alpha1:{x:875,y:218}},merges:{E:'alpha1',ER:'alpha1'}},
      {at:83,span:2,key:'define-estimate',poses:{hat:{x:470,y:217},defeq:{x:537,y:217},C:{x:730,y:171},barL:{x:660,y:207},EL:{x:732,y:258}},origins:{hat:'alpha1',defeq:'approx'},merges:{alpha1:'hat',approx:'defeq'}},
      {at:88,span:3,key:'substitute-sums',poses:{hat:{x:358,y:217},defeq:{x:425,y:217},cNum:{x:525,y:171,scale:.8},barL:{x:525,y:207,scale:1.65},eNum:{x:585,y:258,scale:.8}},origins:{cNum:'C',eNum:'EL'},merges:{C:'cNum',EL:'eNum'}},
      {at:93,span:2,key:'coefficient',rows:[row(['hat2','alphaNum'],200,32)],origins:{hat2:'hat',alphaNum:'cNum'},merges:{hat:'hat2',cNum:'alphaNum'}},
      {at:96,span:3,key:'predict',rows:[row(['hat2','alphaNum'],85,22)]},
      {at:103,span:2,key:'least-squares',rows:[row(['hat2','alphaNum'],85,22),row(['objective'],190,28)]},
      {at:105,span:3,key:'read-handoff',rows:[row(['hat2','alphaNum'],140,28)]},
      {at:108,span:3,key:'read-modulus',rows:[row(['hat2','alphaNum'],110,24),row(['mDef'],205,32)]},
      {at:116,span:3,key:'read-phase',rows:[row(['mNum'],105,24),row(['phaseDef'],175,30),row(['polar'],250,30)]},
      {at:124,span:3,key:'relative-steps',rows:[row(['polar'],120,30),...[0,1,2].map(j=>row(['frame'+j,'relative'+j],255,26,250+470*j))]},
      {at:127,span:2,key:'common-phase',rows:[row(['polar'],120,30),...[0,1,2].map(j=>row(['frame'+j,'relative'+j,'delta'+j],255,26,250+470*j))],origins:{delta0:'polar',delta1:'polar',delta2:'polar'},arcs:{delta0:28,delta1:28,delta2:28}}
    ];
    // The complete numerical sums stay in view during the symbolic division,
    // then these same actors travel into the fraction at C3.
    for(const frame of frames)if(frame.at>=74&&frame.at<88)Object.assign(frame.poses,{cNum:{x:195,y:345,scale:.68},eNum:{x:1000,y:345,scale:.68}});
    const math=root.SIMMathActors.create({parent:group,tokens,frames,name:'parameter-tail'});
    const mode=label(group,720,40,'','pe-two-small',cyan);
    const ideal=el('g',{'data-tail-ideal':''},group);
    const inputPlane=plane(ideal,460,413,80,'tail-input'),outPlane=plane(ideal,960,413,80,'tail-product');
    const iu=path(inputPlane,cyan,{'data-tail-demo-u':''}),iv=path(inputPlane,purple,{'data-tail-demo-v':''});
    const iz=path(outPlane,orange,{'data-tail-demo-product':''});
    label(ideal,460,522,'参考与旁带 · 同一标尺','pe-two-small');label(ideal,960,522,'乘积 · 独立固定标尺','pe-two-small');
    const remainingEnergy=el('g',{'data-tail-remaining-energy':''},ideal);
    el('rect',{x:1230,y:405,width:30,height:64,fill:cyan},remainingEnergy);
    label(remainingEnergy,1245,494,'e = a²','pe-two-small',cyan);
    const sampleGroup=el('g',{'data-tail-demo-contributions':''},group);
    const demoPlots=Tail.demo.map((d,i)=>{
      const g=plane(sampleGroup,330+390*i,415,60,'tail-demo-'+i);
      const v=path(g,orange,{'data-tail-demo-z':i});
      const caption=label(g,0,92,'位置 '+(i+1)+' · 参考能量 '+d.energy,'pe-two-small',cyan);
      vector(v,d.z,8);return {g,v,caption};
    });
    const sumDemo=el('g',{'data-tail-demo-sum':''},group);
    const demoChain=Tail.demo.map((d,i)=>path(sumDemo,orange,{'data-tail-chain':i}));
    label(sumDemo,440,502,'复数箭头首尾相接','pe-two-small',orange);
    const bars=Tail.demo.map((d,i)=>el('rect',{y:395,height:26,width:d.energy*18,fill:cyan,'fill-opacity':.35+i*.2,'data-tail-demo-energy':i},sumDemo));
    label(sumDemo,1010,502,'参考能量按同一顺序相加','pe-two-small',cyan);
    const actual=el('g',{'data-tail-actual':''},group);
    const fields=[images.product,images.energy].map((href,b)=>{
      const g=el('g',{},actual),image=el('image',{x:0,y:0,width:150,height:150,href,style:'image-rendering:pixelated'},g);
      const title=label(g,75,-18,b?'e(r) · 参考能量':'z(r) · 复数乘积','pe-two-small',b?cyan:orange);
      const cursor=el('rect',{width:150/peak.n,height:150/peak.n,fill:'#fff',stroke:'#fff','stroke-width':1},g);
      return {g,image,title,cursor};
    });
    const clip=el('clipPath',{id:uid+'-tail-prefix'},defs),scanPrefix=el('path',{},clip);
    const overlay=el('rect',{x:-75,y:-75,width:150,height:150,fill:'#fff','fill-opacity':.13,'clip-path':`url(#${uid}-tail-prefix)`},actual);
    const cPlane=plane(actual,955,397,64,'tail-C'),cArrow=path(cPlane,orange,{'data-tail-C-vector':''});
    const cLabel=label(actual,955,510,'','pe-two-small',orange);
    const eBar=el('rect',{x:1200,width:36,y:462,height:0,fill:cyan},actual);
    const eLabel=label(actual,1218,510,'','pe-two-small',cyan);
    const countLabel=label(actual,460,531,'','pe-two-small');
    const result=el('g',{'data-tail-result':''},group);
    const resultPlane=plane(result,1070,400,74,'tail-alpha');
    const resultArrow=path(resultPlane,orange,{'data-tail-alpha-vector':''});
    const resultLength=path(resultPlane,orange,{'stroke-width':8,'stroke-opacity':.3});
    const arc=path(resultPlane,purple,{'data-tail-phase-arc':''});
    label(resultPlane,74,-8,'1','pe-two-small');
    const resultRead=label(result,720,510,'','pe-two-small');
    const comparisons=el('g',{'data-tail-predictions':''},group);
    let residualSquared=0,targetSquared=0;
    for(let i=0;i<peak.count;i++){
      const predicted=Tail.multiply(peak.alpha,{re:peak.spatial[0].re[i],im:peak.spatial[0].im[i]});
      residualSquared+=(peak.shifted.re[i]-predicted.re)**2+(peak.shifted.im[i]-predicted.im)**2;
      targetSquared+=peak.shifted.re[i]**2+peak.shifted.im[i]**2;
    }
    const relativeResidual=Math.sqrt(residualSquared/Math.max(targetSquared,1e-30));
    label(comparisons,720,545,relativeResidual<1e-8?'橙色预测与紫色观测：本组几乎重合':'橙色预测 · 紫色观测 · 细线表示实际残差','pe-two-small');
    set(comparisons,'data-relative-residual',relativeResidual);
    const comparisonsActors=data.samples.map((index,i)=>{
      const g=plane(comparisons,330+390*i,405,64,'tail-check-'+i);
      const reference=path(g,cyan,{'stroke-width':1.3,'stroke-dasharray':'3 3'}),observed=path(g,purple,{'stroke-width':4,'stroke-opacity':.6});
      const prediction=path(g,orange,{'data-tail-prediction':i}),residual=path(g,'#e69a9a',{'data-tail-residual':i});
      label(g,0,99,`r = (${index%peak.n}, ${Math.floor(index/peak.n)})`,'pe-two-small');return {index,g,reference,observed,prediction,residual};
    });
    const cards=el('g',{'data-tail-parameter-cards':''},group);
    const framePhases=el('g',{'data-tail-frame-phases':''},group);
    [0,1,2].forEach(j=>label(framePhases,250+470*j,335,num(peak.phase+2*Math.PI*j/3)+' rad','pe-two-small',purple));
    const cardValues=[`(${peak.kx.toFixed(2)}, ${peak.ky.toFixed(2)}) DFT 格`,num(peak.m),num(peak.phase)+' rad'];
    [0,1,2].forEach(i=>{const x=250+470*i;el('rect',{x:x-198,y:425,width:396,height:73,rx:6,fill:'#0c1b22',stroke:[cyan,orange,purple][i]},cards);label(cards,x,451,['k̂ · 已锁定','m̂ · 模长','φ̂Δ · 相角'][i],'pe-two-text',[cyan,orange,purple][i]);label(cards,x,480,cardValues[i],'pe-two-value');});
    function draw(s){
      const t=s.tail||{chapter:'A',seconds:0,shot:'A1',enter:0,time:0,ideal:0,actual:0};
      opacity(group,s.tail?t.enter:0);
      set(group,'data-shot',t.shot);set(group,'data-time',t.time);set(group,'data-dataset',t.ideal>0?'illustration':'observations');
      math.draw(t.time,s.tail?t.enter:0);set(math.group,'aria-label',s.formula.equation);
      text(mode,t.ideal>0?'理想比例示意 · 不进入实际估计':t.chapter==='A'?'本组实际乘积':t.chapter==='B'?'本组实际数据 · 全部空域位置':t.chapter==='C'?'同一组累计量 → 共同复比例':'同一个复系数 → 两个照明参数');
      opacity(ideal,t.ideal*(1-ramp(t.time,24,26)));
      const d=Tail.demo[0],turn=ramp(t.time,14,15),gain=ramp(t.time,15,16),psi=Math.atan2(d.u.im,d.u.re),a=Math.hypot(d.u.re,d.u.im);
      vector(iu,d.u,34);vector(iv,d.v,34);
      const z=Tail.multiply(d.v,{re:(1+(a-1)*gain)*Math.cos(-psi*turn),im:(1+(a-1)*gain)*Math.sin(-psi*turn)});
      vector(iz,z,34);opacity(iz,ramp(t.time,10,12));
      opacity(remainingEnergy,ramp(t.time,20,22));
      opacity(sampleGroup,ramp(t.time,24,26)*(1-ramp(t.time,33,36)));
      demoPlots.forEach((p,i)=>opacity(p.g,i===0?1:ramp(t.time,i===1?24:28,i===1?27:30)));
      opacity(sumDemo,ramp(t.time,33,36)*(1-ramp(t.time,56,58)));
      let sx=370,sy=440,bx=902;
      demoChain.forEach((n,i)=>{const d=Tail.demo[i],part=ramp(t.time,33+i,34+i);
        vector(n,{re:d.z.re*part,im:d.z.im*part},13);set(n,'transform',`translate(${sx} ${sy})`);sx+=d.z.re*13;sy-=d.z.im*13;
        set(bars[i],'x',bx);set(bars[i],'width',d.energy*18*part);bx+=d.energy*18;});
      const actualAlpha=t.chapter==='A'?ramp(t.time,4,6):t.actual*(1-ramp(t.time,72,75));opacity(actual,actualAlpha);
      const mini=t.chapter==='A'?1:0;
      fields.forEach((p,b)=>{
        set(p.g,'transform',mini?`translate(${1210+80*b} 60) scale(.4)`:`translate(${180+300*b} 337)`);
        set(p.image,'href',mini?[images.spatial[0],images.shifted][b]:[images.product,images.energy][b]);
        text(p.title,mini?(b?'vₖ · 暂存':'u · 暂存'):(b?'e(r) · 参考能量':'z(r) · 乘积'));
        const i=Math.max(0,s.count-1);set(p.cursor,'x',(i%peak.n)*150/peak.n);set(p.cursor,'y',Math.floor(i/peak.n)*150/peak.n);opacity(p.cursor,mini?0:s.count>0&&s.count<s.total?1:0);
      });
      prefix(scanPrefix,s.count,150);set(overlay,'transform','translate(255 412)');opacity(overlay,mini?0:1);
      vector(cArrow,s.sum,64/Math.max(Math.hypot(peak.sums.at(-1).re,peak.sums.at(-1).im),1e-30));
      text(cLabel,'C = '+complex(s.sum));text(eLabel,'E₀ = '+num(s.sum.energy));
      set(eBar,'height',128*s.sum.energy/peak.referenceEnergy);set(eBar,'y',462-128*s.sum.energy/peak.referenceEnergy);
      text(countLabel,`${s.count} / ${s.total} 个空域位置`);
      [cPlane,eBar,countLabel].forEach(n=>opacity(n,mini?0:1));
      [cLabel,eLabel].forEach(n=>opacity(n,mini?0:1-ramp(t.time,69,71)));
      const resultAlpha=s.solved?ramp(t.time,93,95)*(1-ramp(t.time,96,99)+ramp(t.time,105,108))*(1-ramp(t.time,124,127)):0;
      opacity(result,resultAlpha);
      const move=ramp(t.time,105,108);set(resultPlane,'transform',`translate(${lerp(1070,720,move)} 400)`);
      vector(resultArrow,s.alpha||{re:0,im:0},74);vector(resultLength,s.alpha||{re:0,im:0},74);
      opacity(resultLength,t.chapter==='D'?ramp(t.seconds,0,5):0);
      const phase=(s.phase||0)*ramp(t.time,116,121);
      set(arc,'d',Math.abs(phase)<1e-10?'M 0 0':`M 36 0 A 36 36 0 0 ${phase>=0?0:1} ${36*Math.cos(phase)} ${-36*Math.sin(phase)}`);
      set(arc,'data-angle',phase);opacity(arc,ramp(t.time,116,121));
      text(resultRead,t.chapter==='D'?(t.seconds<8?'m̂ = '+num(peak.m):'φ̂Δ '+(Math.abs(peak.phase)<1e-10?'≈ 0 rad': '= '+num(peak.phase)+' rad')):'α̂ = '+complex(peak.alpha));
      opacity(comparisons,s.solved?ramp(t.time,96,99)*(1-ramp(t.time,105,108)):0);
      comparisonsActors.forEach(p=>{
        const u={re:peak.spatial[0].re[p.index],im:peak.spatial[0].im[p.index]},v={re:peak.shifted.re[p.index],im:peak.shifted.im[p.index]};
        const fitted=s.alpha?Tail.multiply(s.alpha,u):u,amount=ramp(t.time,99,103),pred={re:lerp(u.re,fitted.re,amount),im:lerp(u.im,fitted.im,amount)},scale=55/data.comparisonMaximum;
        vector(p.reference,u,scale);vector(p.observed,v,scale);vector(p.prediction,pred,scale);
        set(p.residual,'d',`M ${pred.re*scale} ${-pred.im*scale} L ${v.re*scale} ${-v.im*scale}`);
        set(p.residual,'data-norm',Math.hypot(v.re-pred.re,v.im-pred.im));
      });
      opacity(cards,t.chapter==='D'?ramp(t.seconds,19,21):0);
      opacity(framePhases,t.chapter==='D'?ramp(t.seconds,21,23):0);
    }
    return {group,draw,math};
  };
})(typeof globalThis!=='undefined'?globalThis:this);
