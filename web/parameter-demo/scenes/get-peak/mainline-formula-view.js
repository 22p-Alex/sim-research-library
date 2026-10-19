/* Correspondence owns the footer. Retained symbols are driven only by the
 * correspondence beat's local progress, including reverse playback/seeks. */
(function(root){
  'use strict';
  const S=root.SIMCoefficientMainline,Actors=root.SIMMathActors,C=root.SIMBeatClock;
  S.createCorrespondenceFormulaView=function({parent,document=root.document}){
    parent.setAttribute('class','pe-study-formula pe-correspondence-formula');
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 1440 270');
    svg.setAttribute('role','img');
    svg.setAttribute('data-correspondence-formula','');parent.appendChild(svg);
    const colors={reference:'#7ad5cd',side:'#b7a5eb',factor:'#efb879'};
    // Keep the original rows through locking, alignment and OTF cancellation.
    // Five fixed-size slots change k′/k̂; separate pads then collapse only the
    // residual and the factors removed by the two algebraic identities.
    const make=(tag,attrs,p,ns='http://www.w3.org/1998/Math/MathML')=>{
      const n=document.createElementNS(ns,tag);for(const [key,value]of Object.entries(attrs||{}))n.setAttribute(key,value);
      p.appendChild(n);return n;
    };
    const recalled=make('foreignObject',{x:0,y:0,width:1440,height:270,'data-correspondence-recall':'recall','data-source-tex':S.correspondenceFormulas.recall},svg,'http://www.w3.org/2000/svg');
    const div=make('div',{class:'pe-correspondence-recalled-math'},recalled,'http://www.w3.org/1999/xhtml');
    const math=make('math',{display:'block'},div),table=make('mtable',{rowspacing:'0.25em',columnalign:'center',columnspacing:'0em'},math);
    const compiled=new Map();
    function tex(p,value){
      if(!compiled.has(value)){
        const output=root.katex.renderToString(value,{displayMode:true,output:'mathml',throwOnError:true,strict:'error'});
        compiled.set(value,output.match(/<semantics>([\s\S]*?)<annotation\b/)[1]);
      }
      const n=make('mrow',{'data-recalled-tex':value},p);n.innerHTML=compiled.get(value);return n;
    }
    const symbol=(p,tag,value,attrs={})=>{const n=make(tag,attrs,p);n.textContent=value;return n;};
    const op=(p,value)=>symbol(p,'mo',value,['(',')'].includes(value)?{stretchy:'false'}:{});
    const q=p=>symbol(p,'mi','q',{mathvariant:'bold'});
    const slots=[],collapses=[],parts={};
    const part=(p,key)=>parts[key]=make('mrow',{'data-correspondence-part':key},p);
    function collapse(p,key,phase,width){
      const pad=make('mpadded',{'data-correspondence-collapse':key},p),content=make('mrow',{},pad);
      collapses.push({pad,content,phase,width,unit:'em'});return content;
    }
    function wavevector(p,role){
      const slot=make('mpadded',{width:'1.05em',height:'1.3em',depth:'0.25em','data-wavevector-slot':role},p);
      const layers=['prime','hat'].map(key=>{
        const n=make('mpadded',{width:'0em',height:'0em',depth:'0em',lspace:'0em',voffset:'0em','data-wavevector-glyph':key},slot);
        tex(n,key==='prime'?String.raw`\mathbf k'`:String.raw`\widehat{\mathbf k}`);return n;
      });
      slots.push({slot,prime:layers[0],hat:layers[1]});return slot;
    }
    function address(p,role,residual=false){
      op(p,'(');q(p);
      const shift=residual?collapse(p,'sample-residual','aligned',3.6):p;
      if(residual){op(shift,'−');symbol(shift,'mi','k',{mathvariant:'bold','data-wavevector-true':''});}
      op(shift,'+');wavevector(shift,role);op(p,')');
    }
    const rows=[colors.reference,colors.side].map(color=>make('mstyle',{scriptlevel:'0',displaystyle:'true',mathcolor:color},make('mtd',{},make('mtr',{},table))));
    function fraction(p,key,shifted){
      const f=make('mfrac',{},p),top=make('mrow',{},f),bottom=make('mrow',{},f);
      const conjugate=collapse(top,key+'-conjugate','quotient',shifted?4.8:3.0);
      if(shifted){tex(conjugate,String.raw`H^*`);address(conjugate,'conjugate-address');tex(top,String.raw`\widetilde A_{+1}`);address(top,'sideband-address');}
      else{tex(conjugate,String.raw`H^*(\mathbf q)`);tex(top,String.raw`\widetilde A_0(\mathbf q)`);}
      symbol(collapse(bottom,key+'-left-modulus','quotient',.35),'mi','∣',{mathvariant:'normal'});
      if(shifted){symbol(bottom,'mi','H');address(bottom,'denominator-address');}
      else tex(bottom,String.raw`H(\mathbf q)`);
      const squared=make('msup',{},collapse(bottom,key+'-modulus-square','quotient',.8));
      symbol(squared,'mi','∣',{mathvariant:'normal'});symbol(squared,'mn','2');
    }
    tex(part(rows[0],'U'),String.raw`U(\mathbf q)`);op(part(rows[0],'defineU'),'=');
    fraction(part(rows[0],'reference'),'reference',false);op(part(rows[0],'eqU'),'=');tex(part(rows[0],'sampleU'),String.raw`S(\mathbf q)`);
    const side=rows[1],nameV=part(side,'V'),v=make('msub',{},nameV);
    symbol(v,'mi','V');wavevector(collapse(v,'locked-subscript','quotient',1.05),'V-subscript');
    op(nameV,'(');q(nameV);op(nameV,')');op(part(side,'defineV'),'=');
    fraction(part(side,'side'),'side',true);op(part(side,'eqV'),'=');
    // Expand only this coefficient slot. Both fractions and both sample terms
    // keep their original nodes until the quotient-removal step at .53.
    const coefficient=make('mpadded',{width:'1em',height:'1.3em',depth:'0.25em','data-correspondence-coefficient':''},part(side,'factor'));
    const alphaLayer=make('mpadded',{width:'0em',height:'0em',depth:'0em','data-coefficient-glyph':'alpha'},coefficient);
    const alphaMath=tex(alphaLayer,String.raw`\alpha`);
    const factorLayer=make('mpadded',{width:'0em',height:'0em',depth:'0em','data-coefficient-glyph':'factor'},coefficient);
    const factorMath=tex(factorLayer,String.raw`m e^{i\phi_\Delta}`);
    const sample=part(side,'sampleV');symbol(sample,'mi','S');address(sample,'sample-address',true);
    const tokens={
      U:{tex:String.raw`U(\mathbf{q})`,width:92,color:colors.reference},
      V:{tex:String.raw`V(\mathbf{q})`,width:92,color:colors.side},
      defineU:{tex:'=',width:40},defineV:{tex:'=',width:40},
      reference:{tex:String.raw`\frac{\widetilde{A}_0(\mathbf{q})}{H(\mathbf{q})}`,width:156,color:colors.reference},
      side:{tex:String.raw`\frac{\widetilde{A}_{+1}(\mathbf{q}+\widehat{\mathbf{k}})}{H(\mathbf{q}+\widehat{\mathbf{k}})}`,width:270,color:colors.side},
      eqU:{tex:'=',width:32},eqV:{tex:'=',width:32},
      sampleU:{tex:String.raw`S(\mathbf{q})`,width:90,color:colors.reference},
      sampleV:{tex:String.raw`S(\mathbf{q})`,width:90,color:colors.reference},
      factor:{tex:String.raw`m e^{i\phi_\Delta}`,width:145,color:colors.factor},
      alpha:{tex:String.raw`\alpha`,width:36,color:colors.factor},
      alphaDefinition:{tex:String.raw`\alpha\coloneqq m e^{i\phi_\Delta}`,width:270,color:colors.factor},
      left:{tex:'(',width:18},right:{tex:')',width:18}
    };
    const row=(keys,y,size=32)=>({keys,y,size,x:720,gap:14,maxWidth:1300});
    const definitions=[row(['U','defineU','reference','eqU','sampleU'],76),row(['V','defineV','side','eqV','factor','sampleV'],174)];
    const named=[row(['U','eqU','sampleU'],76),row(['V','eqV','alpha','sampleV'],164),row(['alphaDefinition'],242,26)];
    const result=[row(['V','eqV','left','factor','right','U'],135)];
    // Invisible slots keep the row's final spacing while the previous glyphs
    // fade completely. They prevent alpha and its expansion sharing ink.
    const frames=[
      {at:0,key:'recall',poses:{}},
      {at:.51,span:0,key:'definitions',rows:definitions},
      {at:.53,span:.05,key:'cancel-quotients',rows:[row(['U','eqU','sampleU'],76),row(['V','eqV','factor','sampleV'],164),row(['alphaDefinition'],242,26)]},
      {at:.59,span:.04,key:'name-alpha',rows:named,hidden:['alpha'],merges:{factor:'alpha'}},
      {at:.64,span:.035,key:'alpha',rows:named,origins:{alpha:'factor'}},
      {at:.69,span:.09,key:'substitute-U',rows:[row(['V','eqV','alpha','U'],135),row(['alphaDefinition'],242,26)],
        merges:{sampleU:'U',sampleV:'U'},arcs:{U:42},focus:['U','sampleU','sampleV']},
      {at:.82,span:.04,key:'open-alpha',rows:result,hidden:['factor'],merges:{alpha:'factor'}},
      {at:.87,span:.05,key:'restore-factor',rows:result,origins:{factor:'alpha'},focus:['factor']}
    ];
    const actors=Actors.create({parent:svg,tokens,frames,name:'coefficient-correspondence',document});
    // Resolve invisible slots with the same intrinsic widths as their rows.
    // Recompute only after the actor helper's one-time width measurement.
    let slotWidths='';
    const resolveSlots=()=>{
      const next=Object.values(actors.widths).join(',');if(next===slotWidths)return false;
      slotWidths=next;
      frames.forEach(frame=>{
        if(!frame.hidden)return;
        const poses=Actors.layout({...frame,poses:{}},actors.widths);
        frame.poses=Object.fromEntries(frame.hidden.map(key=>[key,{...poses[key],opacity:0}]));
      });
      return true;
    };
    let measured=false,handoffMeasured=false;
    const coefficientWidths={alpha:1,factor:4.5,unit:'em'};
    function measureCollapses(){
      if(measured)return;
      const viewport=svg.getBoundingClientRect();
      if(typeof viewport.width!=='number'){measured=true;return;}
      if(!(viewport.width>0))return;
      // Pixel lengths in SVG user units also preserve the smaller V subscript.
      const scale=viewport.width/1440,widths=collapses.map(({content})=>content.getBoundingClientRect().width/scale);
      const a=alphaMath.getBoundingClientRect().width/scale,f=factorMath.getBoundingClientRect().width/scale;
      if(widths.some(width=>!(width>0))||!(a>0&&f>0))return;
      collapses.forEach((item,i)=>{item.width=widths[i];item.unit='px';});measured=true;
      Object.assign(coefficientWidths,{alpha:a,factor:f,unit:'px'});
    }
    function drawCoefficient(local){
      const motion=S.correspondenceMotion(local),w=coefficientWidths;
      coefficient.setAttribute('width',(w.alpha+(w.factor-w.alpha)*motion.growth)+w.unit);
      coefficient.setAttribute('data-expansion',motion.growth);
      for(const [node,alpha]of [[alphaLayer,motion.alpha],[factorLayer,motion.factor]]){
        node.style.opacity=String(alpha);node.setAttribute('aria-hidden',alpha===0);
        node.setAttribute('voffset',(.28*(1-alpha))+'em');
      }
      coefficient.setAttribute('mathcolor',local>=.46?colors.factor:colors.side);
    }
    function drawCollapses(bridge){
      collapses.forEach(({pad,content,phase,width,unit})=>{
        const amount=bridge[phase],fade=C.ramp(amount,0,.45),shrink=C.ramp(amount,.45,1);
        if(shrink===0)pad.removeAttribute('width');else pad.setAttribute('width',width*(1-shrink)+unit);
        content.style.opacity=String(1-fade);content.setAttribute('aria-hidden',fade===1);
        pad.setAttribute('data-collapse',amount);
      });
    }
    function measureHandoff(){
      if(handoffMeasured||!measured)return;
      const viewport=svg.getBoundingClientRect();
      if(typeof viewport.width!=='number'){handoffMeasured=true;return;}
      if(!(viewport.width>0))return;
      // Cache the expanded endpoint in SVG units. The actor copy takes over
      // at exactly the same glyph positions; the two full equations never mix.
      drawCollapses(S.correspondenceBridge(.51));drawCoefficient(.51);actors.draw(.51,1);
      const scale=viewport.width/1440,poses={};
      const firstGlyph=node=>node.tagName.toLowerCase()==='mi'?node:Array.from(node.children).map(firstGlyph).find(Boolean);
      for(const key of definitions.flatMap(row=>row.keys)){
        const actor=actors.actors[key],content=actor.math.children[0].children[0];
        actor.g.setAttribute('transform','translate(0 0) scale(1)');
        const source=key==='factor'?factorMath:key==='V'?firstGlyph(parts.V):parts[key];
        const target=key==='V'?firstGlyph(content):content;
        const a=source.getBoundingClientRect(),b=target.getBoundingClientRect();
        if(!(a.width>0&&b.width>0))return;
        poses[key]={x:(a.left-b.left)/scale,y:(a.top-b.top)/scale,scale:1,opacity:1};
      }
      frames[1].poses=poses;handoffMeasured=true;
    }
    function draw(local){
      const bridge=S.correspondenceBridge(local),visible=local>=.53?1:0;
      const opacity=local<.53?C.ramp(local,0,.09):0,lock=S.wavevectorLock(local);
      // Measure in the uncollapsed pose, also when first seeking directly to
      // a later substep. Intrinsic widths are cached for all subsequent seeks.
      if(!measured){
        collapses.forEach(({pad,content})=>{pad.removeAttribute('width');content.style.opacity='1';});
        measureCollapses();
      }
      measureHandoff();drawCollapses(bridge);drawCoefficient(local);
      recalled.setAttribute('opacity',opacity);recalled.setAttribute('aria-hidden',opacity===0);
      const recalledKey=local>=.51?'definitions':local>=.40?'quotients':local>=.35?'aligned':lock.locked?'locked':'recall';
      recalled.setAttribute('data-notation',lock.locked?'locked':'candidate');
      recalled.setAttribute('data-tex',S.correspondenceFormulas[recalledKey]);
      recalled.setAttribute('data-expansion',S.correspondenceMotion(local).growth);
      slots.forEach(({slot,prime,hat})=>{
        slot.setAttribute('data-lift',lock.lift);slot.style.color=lock.emphasis>0?colors.factor:colors.side;
        for(const [node,alpha]of [[prime,lock.prime],[hat,lock.hat]]){
          node.setAttribute('voffset',lock.lift+'em');node.style.opacity=String(alpha);node.setAttribute('aria-hidden',alpha===0);
        }
      });
      // The first visible draw measures native MathML once; all later draws
      // only update transforms/opacity. A zero-alpha pose is still measured.
      resolveSlots();let state=actors.draw(local,visible);
      if(resolveSlots())state=actors.draw(local,visible);
      const formula=S.presentation(S.timeline.progressFor('correspondence',Math.min(local,1-1e-9))).equation;
      svg.setAttribute('aria-label',formula);svg.setAttribute('data-substep',local<.27?'recall':local<.35?'locked':local<.40?'aligned':local<.46?'divideH':local<.53?'expand-alpha':state.key);
      return state;
    }
    draw(0);return {group:svg,actors,draw};
  };
})(typeof globalThis!=='undefined'?globalThis:this);
