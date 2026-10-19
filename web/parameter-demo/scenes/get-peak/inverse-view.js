/* Retained MathML actors: cached intrinsic widths supply natural spacing;
 * the playhead moves each actor continuously through the algebra. */
(function(root){
  'use strict';
  const Story=root.SIMGetPeak,{ramp}=root.SIMBeatClock;
  const mathNS='http://www.w3.org/1998/Math/MathML',htmlNS='http://www.w3.org/1999/xhtml';
  let instance=0;
  Story.createInverseView=function({parent,cards,el,label,path,plane,vector,set,text,opacity,colors}){
    const l=Story.layout.derivation,pair=Story.layout.pair,doc=root.document;
    const ink='var(--sim-inverse-ink, #dce8e6)',accent='var(--sim-inverse-accent, #efb879)',reference='var(--sim-inverse-reference, #7ad5cd)',side='var(--sim-inverse-side, #b7a5eb)';
    const group=el('g',{'data-get-peak-derivation':'','data-inverse-style-scope':'formula-teaching'},parent);
    const clipId='sim-inverse-formula-zone-'+(++instance),defs=el('defs',{},group);
    const clip=el('clipPath',{id:clipId,clipPathUnits:'userSpaceOnUse'},defs);
    el('rect',{x:0,y:0,width:1440,height:l.formulaBottom,'data-get-peak-formula-clip':''},clip);
    const graphClip=el('clipPath',{id:clipId+'-graph',clipPathUnits:'userSpaceOnUse'},defs);
    el('rect',{x:0,y:l.geometryTop,width:1440,height:560-l.geometryTop,'data-get-peak-geometry-clip':''},graphClip);
    const formulas=el('g',{'clip-path':`url(#${clipId})`,'data-get-peak-formula-zone':'','data-zone-bottom':l.formulaBottom},group);
    const style=(node,key,value)=>{value=String(value);if(node.style[key]!==value)node.style[key]=value;};
    function mathNode(tag,attrs,parent){
      const node=doc.createElementNS(mathNS,tag);
      for(const [key,value] of Object.entries(attrs||{}))set(node,key,value);
      if(parent)parent.appendChild(node);return node;
    }
    function line(x,y,width,size,attrs={},padding=['1.3em','.9em']){
      const box=el('foreignObject',{x,y,width,height:l.lineHeight,...attrs},formulas);
      const div=doc.createElementNS(htmlNS,'div');set(div,'class','pe-inverse-math');box.appendChild(div);
      // Only the structural row belongs to this unit. Theme authors can set
      // these inherited custom properties without editing animation code.
      style(div,'fontSize',`var(--sim-inverse-${size}-size, ${l.sizes[size]}px)`);
      style(div,'color',ink);style(div,'display','flex');style(div,'justifyContent','flex-start');
      style(div,'alignItems','flex-start');style(div,'whiteSpace','nowrap');
      const math=mathNode('math',{display:'block'},div);style(math,'margin','0');
      // A fixed ascent/depth keeps the baseline stationary when a brace,
      // summation limit or fraction appears; horizontal spacing stays native.
      const pad=mathNode('mpadded',{height:padding[0],depth:padding[1]},math);
      const row=mathNode('mrow',{},pad);return {box,row,math,div};
    }
    function compile(parent,name,tex,attrs={}){
      const tag=name==='lhs'||name==='equal'||name==='approx'?'mpadded':'mrow';
      const node=mathNode(tag,{'data-inverse-fragment':name,'data-tex':tex,...attrs},parent);
      if(name==='lhs')set(node,'width','2.25em');
      if(name==='equal'||name==='approx'){set(node,'width','1.15em');set(node,'lspace','.12em');}
      const output=root.katex.renderToString(tex,{displayMode:true,output:'mathml',throwOnError:true,strict:'error'});
      const body=output.match(/<semantics>([\s\S]*?)<annotation\b/);
      if(!body)throw new Error('逆变换公式缺少 MathML 结构：'+name);
      node.innerHTML=body[1];return node;
    }
    const definitions=Story.inverseDefinitions.map((tex,i)=>{
      const item=line(l.referenceX,l.referenceY[i],l.referenceWidth,'reference',{'data-get-peak-definition':i});
      compile(item.row,'definition-'+i,tex);return item;
    });
    const main={box:el('g',{transform:`translate(${l.mainX} ${l.mainY})`,x:l.mainX,y:l.mainY,
      'data-get-peak-inverse-row':''},formulas)},tokens={};
    function actor(name,tex,attrs={}){
      const g=el('g',{'data-inverse-token-actor':name,...attrs},main.box);
      const item=line(0,0,l.mainWidth,'main',{},['1.55em','1.7em']);
      item.box.remove();g.appendChild(item.box);
      compile(item.row,name,tex);return {g,...item};
    }
    for(const [name,tex] of Object.entries(Story.inverseTokens))tokens[name]=actor(name,tex,{'data-get-peak-inverse-token':name});
    const expansionGroups=Object.fromEntries(['band','kernel'].map(kind=>[kind,el('g',{'data-get-peak-address-expansion':kind},main.box)]));
    const fragments={};
    for(const [key,tex] of Object.entries(Story.inverseAddressParts)){
      const kind=['bandPrefix','bandClose','f','q','plusK'].includes(key)?'band':'kernel';
      const item=actor('address-'+key,tex,{'data-get-peak-address-fragment':key});
      item.g.remove();expansionGroups[kind].appendChild(item.g);fragments[key]=item;
    }
    const focusBoxes=Object.fromEntries(['band','kernel'].map(kind=>[kind,el('rect',{rx:4,fill:'none',
      'data-get-peak-address-focus':kind,class:'pe-inverse-address-focus'},main.box)]));
    const ruleFocus=el('rect',{x:l.ruleX-5,y:l.ruleY+7,width:27,height:33,rx:4,
      class:'pe-inverse-address-focus','data-get-peak-address-focus':'rule'},formulas);
    let em=l.sizes.main,widths=Object.fromEntries(Object.entries(l.advancesEm).map(([key,value])=>[key,value*em]));
    let partWidths=Object.fromEntries(Object.entries(l.addressEm).map(([key,value])=>[key,value*em]));
    let measured=false;
    function measureOnce(){
      if(measured)return;
      const sample=tokens.lhs.math.getBoundingClientRect(),viewport=tokens.lhs.box.getBoundingClientRect();
      // The simulated DOM has no font layout; its documented fallback is the
      // same input used by the pure motion tests. Real zero-width mounts retry.
      if(typeof sample.width!=='number'){measured=true;return;}
      if(sample.width<=0||viewport.width<=0)return;
      const unit=l.mainWidth/viewport.width,next={};
      for(const [key,item] of Object.entries(tokens)){
        const width=item.math.getBoundingClientRect().width*unit;
        if(!(width>0))return;next[key]=width;
      }
      const nextParts={};
      for(const [key,item] of Object.entries(fragments)){
        // A previously collapsed +k still needs its unscaled intrinsic width.
        set(item.g,'transform','translate(0 0) scale(1 1)');
        const width=item.math.getBoundingClientRect().width*unit;
        if(!(width>0))return;nextParts[key]=width;
      }
      widths=next;partWidths=nextParts;em=widths.lhs/2.25;measured=true;
    }
    const rules=Object.fromEntries(Object.entries(Story.inverseRules).map(([name,tex])=>{
      const item=line(l.ruleX,l.ruleY,l.ruleWidth,'rule',{'data-get-peak-inverse-rule':name});
      compile(item.row,'rule-'+name,tex);return [name,item.box];
    }));
    const delta=line(l.deltaX,l.deltaY,l.ruleWidth,'angle',{'data-get-peak-delta-definition':''});
    compile(delta.row,'delta',String.raw`\delta(\mathbf r)=\frac{2\pi}{N}\widehat{\mathbf k}\cdot\mathbf r`);
    style(delta.div,'color',accent);
    const angleName=actor('angle-name',String.raw`\delta(\mathbf r)`,{'data-inverse-motion-annotation':'delta-name'});
    const bracket=path(main.box,colors[0],{'stroke-width':1.4,'data-get-peak-recognize-u':''});
    const bracketLabel=line(0,0,160,'rule',{'data-get-peak-reference-brace-label':''});
    bracketLabel.box.remove();main.box.appendChild(bracketLabel.box);
    compile(bracketLabel.row,'reference-brace',String.raw`u(\mathbf r)`);style(bracketLabel.div,'color',reference);
    const geometry=el('g',{'data-get-peak-extra-rotation':'','data-illustration':'unit-complex-multiplication',
      'data-zone-top':l.geometryTop,'clip-path':`url(#${clipId}-graph)`},group);
    const axes=plane(geometry,...l.plane,'extra-angle',{imaginary:{x:12,y:-68,anchor:'middle'}});
    const original=path(axes,colors[0],{'stroke-width':2,'stroke-dasharray':'4 4','data-get-peak-extra-source':''});
    const rotated=path(axes,colors[2],{'stroke-width':3,'data-get-peak-extra-vector':''});
    const arc=path(axes,colors[2],{'stroke-width':2,'data-get-peak-extra-arc':''});
    const arcLabel=label(axes,0,0,'δ','pe-two-text',colors[2]);
    const unit=line(l.unitX,l.unitY,l.unitWidth,'unit',{'data-get-peak-unit-rotation':''});
    // Move this whole actor into the geometry owner. No per-frame reparenting.
    unit.box.remove();geometry.appendChild(unit.box);
    compile(unit.row,'unit',String.raw`|e^{i\delta}|=1\qquad z\longmapsto ze^{i\delta}`);
    const coordinate=label(geometry,l.unitX+l.unitWidth/2,l.coordinateY,'','pe-two-small');
    const legend=label(geometry,l.unitX+l.unitWidth/2,l.legendY,'单位长度复乘示意 · z = αu(r)','pe-two-small');
    set(legend,'data-get-peak-rotation-legend','');
    function pose(item,p){
      set(item.g,'transform',`translate(${p.x} ${p.y+1.55*em*(1-p.scale)}) scale(${p.scale})`);
      opacity(item.g,p.opacity);
      for(const key of ['x','y','scale'])set(item.g,'data-motion-'+key,p[key]);
    }
    return {draw(s){
      const c=s.cues,d=c.derivationEnter,p=s.proof;
      if(s.mode==='finalInverse'&&d>0)measureOnce();
      const motion=Story.inverseMotion(p,widths,em,l.mainWidth);
      cards.forEach((card,i)=>{
        const shrink=c.definitionReveal;
        opacity(card.g,1-ramp(shrink,.12,.9));
        set(card.g,'transform',`translate(${pair.x[i]} ${pair.y}) scale(${1-.55*shrink})`);
        opacity(card.image,1-ramp(s.inverse,0,.35));opacity(card.spatial,ramp(s.inverse,.55,1));
        opacity(card.transform,s.inverse>0&&s.inverse<1?1:0);
        text(card.heading,s.inverse===1?(i?'v(r)':'u(r)'):(i?'B₁ → v':'B₀ → u'));
      });
      opacity(group,c.definitionReveal);
      definitions.forEach((item,i)=>{
        set(item.box,'data-reference-matched',i===0&&p.match);
        style(item.div,'color',i?side:reference);set(item.box,'data-identity-color',i?'side':'reference');
        set(item.box,'transform',`translate(${(pair.x[i]-200-l.referenceX)*(1-d)} ${(pair.y-48-l.referenceY[i])*(1-d)})`);
      });
      opacity(main.box,c.derivationRow);set(main.box,'data-proof-stage',p.stage);
      set(main.box,'data-equation',p.equation);
      const enter=c.derivationRow,rowScale=l.sizes.reference/l.sizes.main+(1-l.sizes.reference/l.sizes.main)*enter;
      const startX=l.referenceX-motion.left*rowScale;
      const startY=l.referenceY[1]+1.3*l.sizes.reference-1.55*em*rowScale;
      set(main.box,'transform',`translate(${startX+(l.mainX-startX)*enter} ${startY+(l.mainY-startY)*enter}) scale(${rowScale})`);
      set(main.box,'data-row-scale',rowScale);set(main.box,'data-definition-center-x',l.mainX+motion.left+motion.definitionWidth/2);
      const expanding=c.addressSubstitution>0&&c.addressSubstitution<1;
      for(const [name,item] of Object.entries(tokens)){
        const highlight=p.emphasis.includes(name);
        pose(item,motion.actors[name]);set(item.g,'data-stage-active',p.active.includes(name));
        const extra=['kernelExtra','extraOutside','kernelDelta'].includes(name);
        const match=p.match&&['norm','sumQ','bandZero','kernelReference','u'].includes(name);
        const identity=name==='lhs'||p.index<2?side:ink;
        style(item.div,'color',match?reference:extra||highlight?accent:identity);
        set(item.g,'data-emphasized',highlight||match);
        opacity(item.box,expanding&&['bandF','bandShifted','kernelF','kernelCombined'].includes(name)?0:1);
      }
      const expansion=Story.inverseAddressExpansion(c.addressSubstitution,partWidths,widths,em);
      const focus=c.addressFocus*(1-ramp(c.addressSubstitution,.94,1));
      for(const kind of ['band','kernel']){
        const item=expansion[kind],anchor=kind==='band'
          ?motion.actors[c.addressSubstitution===1?'bandShifted':'bandF'].x
          :motion.actors[c.addressSubstitution===1?'kernelCombined':'kernelF'].x;
        opacity(expansionGroups[kind],expanding?1:0);
        set(expansionGroups[kind],'data-growth',expansion.growth);set(expansionGroups[kind],'data-slot-width',item.width);
        for(const [key,position] of Object.entries(item.parts)){
          const fragment=fragments[key];
          set(fragment.g,'transform',`translate(${anchor+position.x} 0) scale(${position.sx} 1)`);
          set(fragment.g,'data-motion-x',anchor+position.x);set(fragment.g,'data-motion-sx',position.sx);
          opacity(fragment.g,position.opacity);
          style(fragment.div,'color',key==='plusK'||key==='supPlus'?accent:side);
        }
        const box=focusBoxes[kind],b=item.box,perimeter=2*(b.width+b.height);
        for(const [key,value] of Object.entries({x:anchor+b.x,y:b.y,width:b.width,height:b.height,
          'stroke-dasharray':`${perimeter} ${perimeter}`,'stroke-dashoffset':perimeter*(1-c.addressFocus)}))set(box,key,value);
        set(box,'data-expansion-progress',expansion.growth);opacity(box,focus);
      }
      opacity(ruleFocus,focus*c.addressRule);
      const bracketAlpha=ramp(c.factorOutside,.75,1)*(1-c.recognizeU);
      const braceStart=motion.actors.norm.x,braceEnd=motion.actors.kernelReference.x+widths.kernelReference*motion.actors.kernelReference.scale;
      const braceY=2.65*em;
      set(bracket,'d',`M ${braceStart} ${braceY-7} v 7 H ${braceEnd} v -7`);opacity(bracket,bracketAlpha);
      set(bracketLabel.box,'x',(braceStart+braceEnd)/2-30);set(bracketLabel.box,'y',braceY+2);opacity(bracketLabel.box,bracketAlpha);
      const naming=p.motion?.kind==='named'?p.motion.amount:0;
      pose(angleName,{x:(l.deltaX-l.mainX)+(motion.actors.kernelDelta.x+.7*em-(l.deltaX-l.mainX))*naming,
        y:(l.deltaY+1.3*l.sizes.angle-l.mainY-1.55*em)*(1-naming)-.55*em*naming,
        scale:.78-.15*naming,opacity:ramp(naming,0,.18)*(1-ramp(naming,.62,.93))});
      style(angleName.div,'color',accent);
      for(const [name,node] of Object.entries(rules))opacity(node,p.auxiliary===name
        ?name==='address'?c.addressRule:name==='factor'?1-ramp(c.factorOutside,.4,.65):1:0);
      opacity(delta.box,c.deltaDefinition);opacity(geometry,c.positivePlane);
      const g=s.extraAngle,scale=l.plane[2]-8;
      vector(original,g.source,scale);vector(rotated,g.target,scale);
      set(rotated,'data-delta',g.delta);set(rotated,'data-applied-angle',g.angle);set(rotated,'data-r',g.r.join(','));
      const radius=36,start=g.psi,end=start+g.angle;
      set(arc,'d',Math.abs(g.angle)<1e-10?'M 0 0':`M ${radius*Math.cos(start)} ${-radius*Math.sin(start)} A ${radius} ${radius} 0 ${Math.abs(g.angle)>Math.PI?1:0} ${g.angle>=0?0:1} ${radius*Math.cos(end)} ${-radius*Math.sin(end)}`);
      set(arcLabel,'x',51*Math.cos(start+g.angle/2));set(arcLabel,'y',-51*Math.sin(start+g.angle/2));opacity(arcLabel,c.positiveTurn);
      const degrees=(g.turn*180/Math.PI).toFixed(1).replace(/\.0$/,'');
      text(coordinate,`r = (${g.r.join(', ')})　δ ≡ ${degrees}°（模 360°）`);
    }};
  };
})(typeof globalThis!=='undefined'?globalThis:this);
