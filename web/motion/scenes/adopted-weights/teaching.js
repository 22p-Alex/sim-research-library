/* E–F: actual full observations -> compensated band -> distributed weights.
 * Numerical inputs are the existing estimate context and adopted pipeline. */
(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const Clock=node?require('../../../shared/animation/beat-clock.js'):root.SIMBeatClock;
  const {ramp}=Clock,lerp=(a,b,t)=>a+(b-a)*t;
  const shots={
    'adopted-weights':[
      ['E1',0,'返回原三帧的完整观测。','参数来自刚才的工作副本，现在把它用回完整的三帧观测。'],
      ['E2',6,'临时旁带多乘了一个共同系数。','临时旁带多乘了共同系数，因此现在除以它的估计值。'],
      ['E3',14,'在同一个真实频点补偿幅相。','长度乘调制度的倒数，相角减去共同相位。'],
      ['E4',22,'把同一个补偿用于整个旁带。','既然临时旁带来自三帧的加权和，这个补偿也能写进每一帧的权重。']
    ],
    'restore-weight':[
      ['F1',0,'重新展开原三帧的乘加式。','这就是此前算临时旁带的三项乘加，三帧数据仍然是原来的数据。'],
      ['F2',6,'把三项和代入补偿公式。','补偿整个输出，就是给整个三项和乘上同一个倒数。'],
      ['F3',14,'把同一个补偿逐项分配。','分配律让每一帧的临时权重，都乘上同一个补偿。'],
      ['F4',26,'给三组补偿后的因子命名。','这些经过补偿的系数，就是正式解混时采用的权重。'],
      ['F5',34,'从第二帧取出一个权重，实际算完。','第二帧的临时权重乘上刚才求出的补偿，就得到这个正式权重。'],
      ['F6',44,'保留一个可回填的结果。','这个权重已经可算，下一步把它放回正一级那一行、第二帧那一列。']
    ]
  },durations={'adopted-weights':28,'restore-weight':50};
  function state(id,progress){
    if(!shots[id])return null;
    const seconds=progress*durations[id],shot=shots[id].filter(x=>seconds>=x[1]-1e-9).at(-1);
    return {shot:shot[0],seconds,time:seconds+(id==='restore-weight'?28:0),title:shot[2],copy:shot[3],
      note:'原三帧完整频谱参与正式解混；输出仍含检测 OTF。',
      cardMove:id==='restore-weight'?1:ramp(seconds,2,4)};
  }
  const multiply=(a,b)=>({re:a.re*b.re-a.im*b.im,im:a.re*b.im+a.im*b.re});
  function dataFor(reconstruction,lesson){
    const estimate=reconstruction.estimates.find(e=>e.index===lesson.group.index),group=lesson.group;
    const context=estimate.context,n=context.config.n,index=6;
    const input={re:context.separated.bands[1].re[index],im:context.separated.bands[1].im[index]};
    const factor={re:Math.cos(group.phases[0])/group.m,im:-Math.sin(group.phases[0])/group.m};
    return {estimate,group,context,n,index,input,factor,output:multiply(factor,input),weight:group.weights[1][1]};
  }
  function createView(options){
    const {parent,reconstruction,lesson,create:el,attr:set,opacity,spectrumURL,maximum,single,singleName,singleNumber,parameterCards,cards}=options;
    const d=dataFor(reconstruction,lesson),cyan='#7ad5cd',orange='#efb879',purple='#b7a5eb';
    const group=el('g',{'data-weight-teaching':'','data-style-scope':'parameter-tail'},parent);
    const label=(p,x,y,value,color='#dce8e6')=>el('text',{x,y,fill:color,'font-size':18,'text-anchor':'middle'},p,value);
    const num=x=>Math.abs(x)<1e-10?'0.000000':x.toFixed(6);
    const tex=z=>String.raw`\left(`+num(z.re)+(z.im<0&&Math.abs(z.im)>1e-10?'-':'+')+num(Math.abs(z.im))+'i'+String.raw`\right)`;
    const tokens={},add=(key,tex,width=70,color='#dce8e6')=>tokens[key]={tex,width,color};
    add('temp',String.raw`\widetilde A_{+1}`,145,orange);add('truth',String.raw`A_{+1}`,105);add('estimate',String.raw`\widehat A_{+1}`,145,orange);
    add('eq','=',32);add('approx',String.raw`\approx`,32);add('alpha',String.raw`\alpha`,35);add('g',String.raw`\frac1{\widehat\alpha}`,78,cyan);
    add('open','(',20);add('close',')',20);add('plus0','+',28);add('plus1','+',28);
    add('compensation',String.raw`\widehat A_{+1}(\mathbf f)=\widetilde A_{+1}(\mathbf f)/\widehat\alpha`,790);
    add('reciprocal',String.raw`\frac1{\widehat\alpha}=\frac1{\widehat m}e^{-i\widehat\phi_\Delta}`,555,cyan);
    add('source',String.raw`\widetilde A_{+1}(\mathbf f)=\sum_{j=0}^2\widetilde u_{+1,j}D_j(\mathbf f)`,800);
    add('knownAlpha',String.raw`\widehat\alpha=\widehat m e^{i\widehat\phi_\Delta}`,450);
    for(let j=0;j<3;j++){
      add('w'+j,String.raw`\widetilde u_{+1,`+j+'}',103,orange);add('D'+j,'D_'+j,63);
      add('g'+j,String.raw`\frac1{\widehat\alpha}`,78,cyan);add('u'+j,'u_{+1,'+j+'}',91,orange);
    }
    add('selected','u_{+1,1}',130,orange);add('temporaryNumber',String.raw`\left(-\frac13-\frac{\sqrt3}{3}i\right)`,363,orange);
    add('factorNumber',tex(d.factor),380,cyan);add('weightNumber',tex(d.weight),402,orange);add('times',String.raw`\cdot`,24);
    add('temporaryExact',String.raw`\frac23e^{-i2\pi/3}`,276,orange);
    add('factorExact',String.raw`\frac1{\widehat m}e^{-i\widehat\phi_\Delta}`,300,cyan);
    add('rule',String.raw`u_{+1,j}=\widetilde u_{+1,j}/\widehat\alpha`,580,cyan);
    const row=(keys,y=240,size=32,x=720)=>({keys,y,size,x});
    // Observations and plus signs have fixed anchors throughout distribution.
    const rowFrame=(at,key,kind,span=3)=>{
      const final=kind==='named',lhs=kind==='temporary'?'temp':'estimate';
      const poses={[lhs]:{x:46,y:240,scale:.8},eq:{x:225,y:240,scale:.8},plus0:{x:685,y:240,scale:.8},plus1:{x:1030,y:240,scale:.8}};
      const rows=[row(['reciprocal'],163,20)];
      for(let j=0;j<3;j++){
        poses['D'+j]={x:555+345*j,y:240,scale:.85};
        const distributed=['distributed','named'].includes(kind)||(kind==='first'&&j===0)||(kind==='second'&&j<2);
        rows.push({keys:final?['u'+j]:distributed?['g'+j,'w'+j]:['w'+j],right:535+345*j,y:240,size:28,maxWidth:280});
      }
      if(['whole','first','second'].includes(kind)){
        poses.g={x:kind==='whole'?270:kind==='first'?716:1061,y:240,scale:.72};
        if(kind!=='second'){poses.open={x:kind==='whole'?350:772,y:240,scale:kind==='whole'?.8:.5};poses.close={x:1330,y:240,scale:.8};}
      }
      return {at,key,span,rows,poses};
    };
    const frames=[
      {at:0,key:'return-data',rows:[row(['knownAlpha'],215,28)]},
      {at:6,key:'residual-factor',span:3,rows:[row(['temp','eq','alpha','truth'],205)]},
      {at:9,key:'compensated-band',span:2,rows:[row(['compensation'],205,30),row(['temp','eq','alpha','truth'],285,23)]},
      {at:14,key:'reciprocal',span:2,rows:[row(['compensation'],180,24),row(['reciprocal'],270,32)]},
      {at:22,key:'full-band',span:3,rows:[row(['compensation'],185,24),row(['source'],270,28)]},
      rowFrame(28,'expand-three','temporary'),
      {...rowFrame(34,'substitute-output','whole'),origins:{estimate:'temp',g:'reciprocal'},merges:{temp:'estimate'}},
      {...rowFrame(42,'distribute-first','first'),origins:{g0:'g'},arcs:{g:28,g0:32}},
      {...rowFrame(45,'distribute-second','second'),origins:{g1:'g'},arcs:{g:28,g1:32}},
      {...rowFrame(48,'distribute-third','distributed'),origins:{g2:'g'},merges:{g:'g2'},arcs:{g2:32}},
      {...rowFrame(54,'name-weights','named'),origins:{u0:'w0',u1:'w1',u2:'w2'},merges:{w0:'u0',w1:'u1',w2:'u2',g0:'u0',g1:'u1',g2:'u2'}},
      {at:62,key:'select-second',span:2,rows:[row(['rule'],145,23),row(['selected','eq','factorExact','times','temporaryExact'],255,30)],origins:{selected:'u1',factorExact:'reciprocal',temporaryExact:'u1'},merges:{u1:'selected'},arcs:{selected:35}},
      {at:64,key:'known-weight',span:2,rows:[row(['rule'],145,23),row(['selected','eq','factorExact','times','temporaryNumber'],255,30)],origins:{temporaryNumber:'temporaryExact'},merges:{temporaryExact:'temporaryNumber'}},
      {at:66,key:'adopted-factor',span:2,rows:[row(['rule'],145,23),row(['selected','eq','factorNumber','times','temporaryNumber'],255,27)],origins:{factorNumber:'factorExact'},merges:{factorExact:'factorNumber'}},
      {at:69,key:'solved-weight',span:2,rows:[row(['rule'],145,23),row(['selected','eq','weightNumber'],255,30)],origins:{weightNumber:'temporaryNumber'},merges:{temporaryNumber:'weightNumber',factorNumber:'weightNumber'}},
      {at:72,key:'matrix-handoff',span:2,rows:[row(['rule'],145,23)]}
    ];
    const math=root.SIMMathActors.create({parent:group,tokens,frames,name:'weight-distribution'});
    const images=el('g',{'data-weight-full-observations':''},group);
    const scale=maximum(d.context.separated.spectra);
    const observationActors=d.context.separated.spectra.map((z,j)=>{
      const g=el('g',{'data-weight-observation':j},images);
      el('image',{x:-63,y:-63,width:126,height:126,href:spectrumURL(z,scale,[189,219,229],26),style:'image-rendering:pixelated'},g);
      label(g,0,93,'第 '+j+' 帧 · D'+j);return g;
    });
    const band=el('g',{'data-weight-temporary-band':''},images);
    el('image',{x:-75,y:-75,width:150,height:150,href:options.sharedPair.bandURLs[1],style:'image-rendering:pixelated'},band);
    label(band,0,101,'完整临时 +1 频带',orange);
    const geometry=el('g',{'data-weight-actual-compensation':''},group);
    for(const x of [420,1020]){el('path',{d:`M ${x-100} 411 H ${x+100} M ${x} 311 V 511`,stroke:'#36525d',fill:'none'},geometry);}
    const input=el('path',{stroke:purple,'stroke-width':3,fill:'none','data-weight-input':''},geometry);
    const output=el('path',{stroke:orange,'stroke-width':3,fill:'none','data-weight-output':''},geometry);
    label(geometry,420,538,'完整临时频带 · f = (6, 0)',purple);label(geometry,1020,538,'补偿结果 · 仍含检测 OTF',orange);
    const readout=label(geometry,720,335,'',cyan);
    const description=label(group,720,35,'估计完成 → 返回原三帧');
    function draw(id,progress){
      const s=state(id,progress);opacity(group,s?1:0);if(!s)return null;
      set(group,'data-shot',s.shot);set(group,'data-time',s.time);math.draw(s.time);
      set(description,'data-frequency-coordinate','6,0');description.textContent=s.time<28?'完整观测 · 补偿整个临时旁带':'固定同一个频率位置 · 补偿分配到三帧权重';
      const cardY=lerp(425,48,s.cardMove);opacity(parameterCards,1);cards.forEach(({g,x})=>set(g,'transform',`translate(${x} ${cardY})`));
      const geometryAlpha=ramp(s.time,14,16)*(1-ramp(s.time,22,25));opacity(geometry,geometryAlpha);
      opacity(images,ramp(s.time,2,4)*(1-geometryAlpha)*(1-ramp(s.time,62,65)));
      observationActors.forEach((g,j)=>set(g,'transform',`translate(${lerp(260+280*j,555+345*j,ramp(s.time,28,31))} 415)`));
      set(band,'transform','translate(1160 414)');opacity(band,1-ramp(s.time,28,31));
      const gain=Math.pow(1/d.group.m,ramp(s.time,16,18)),angle=-d.group.phases[0]*ramp(s.time,18,20);
      const value=multiply(d.input,{re:gain*Math.cos(angle),im:gain*Math.sin(angle)});
      const vectorScale=85/Math.max(Math.hypot(d.input.re,d.input.im),Math.hypot(d.output.re,d.output.im),1e-30);
      for(const [n,z,x]of [[input,d.input,420],[output,value,1020]]){
        set(n,'d',options.arrowPath(x,411,x+z.re*vectorScale,411-z.im*vectorScale));set(n,'data-re',z.re);set(n,'data-im',z.im);
      }
      set(output,'data-applied-angle',angle);set(output,'data-applied-gain',gain);
      readout.textContent='幅度 × '+num(1/d.group.m)+' · 相位减去 '+num(d.group.phases[0])+' rad';
      // This exact persistent legacy number continues into assemble-weights.
      opacity(single,ramp(s.time,72,74));set(single,'transform','translate(720 320)');opacity(singleName,1);opacity(singleNumber,1);
      return s;
    }
    return {group,math,data:d,draw};
  }
  const api={shots,durations,state,dataFor,createView};if(node)module.exports=api;else root.SIMAdoptedTeaching=api;
})(typeof globalThis!=='undefined'?globalThis:this);
