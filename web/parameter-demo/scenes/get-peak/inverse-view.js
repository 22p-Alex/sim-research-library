/* A retained derivation: the two definitions stay put while copies of the
 * sideband's factors change address, split, and leave the summation. */
(function(root){
  'use strict';
  const Story=root.SIMGetPeak,{ramp}=root.SIMBeatClock,lerp=(a,b,t)=>a+(b-a)*t;
  Story.createInverseView=function({parent,cards,mathLabel,el,label,path,plane,vector,set,text,opacity,colors}){
    const l=Story.layout.derivation,pair=Story.layout.pair;
    const group=el('g',{'data-get-peak-derivation':''},parent);
    const definitions=[
      String.raw`u(\mathbf r)=\frac1{N^2}\sum_{\mathbf q}B_0(\mathbf q)e^{2\pi i\mathbf q\cdot\mathbf r/N}`,
      String.raw`v(\mathbf r)=\frac1{N^2}\sum_{\mathbf f}B_1(\mathbf f)e^{2\pi i\mathbf f\cdot\mathbf r/N}`
    ].map((tex,b)=>mathLabel(group,pair.x[b],l.definitionY,l.definitionWidth,tex,colors[b],
      {height:70,'data-get-peak-definition':b}));
    const relation=mathLabel(group,720,l.relationY,1000,
      String.raw`\mathbf f=\mathbf q+\widehat{\mathbf k}\qquad B_1(\mathbf q+\widehat{\mathbf k})\approx\alpha B_0(\mathbf q)`,colors[1],
      {'data-get-peak-address-rule':''});
    const row=el('g',{'data-get-peak-inverse-row':''},group),tokens={};
    function token(name,tex,width,color=colors[0],extra={}){
      const node=mathLabel(row,0,-35,width,tex,color,{height:70,'data-get-peak-inverse-token':name,...extra});
      tokens[name]=node;return node;
    }
    token('lhs',String.raw`v(\mathbf r)`,114,colors[1]);
    token('equal','=',40,colors[1]);token('approx',String.raw`\approx`,40,colors[1]);
    token('alpha',String.raw`\alpha`,44,colors[1]);
    token('norm',String.raw`\frac1{N^2}`,70);
    token('sumF',String.raw`\sum_{\mathbf f}`,64);token('sumQ',String.raw`\sum_{\mathbf q}`,64);
    token('bandF',String.raw`B_1(\mathbf f)`,140,colors[1]);
    token('bandShifted',String.raw`B_1(\mathbf q+\widehat{\mathbf k})`,214,colors[1]);
    token('bandZero',String.raw`B_0(\mathbf q)`,140);
    token('kernelF',String.raw`e^{2\pi i\mathbf f\cdot\mathbf r/N}`,290,colors[1]);
    token('kernelCombined',String.raw`e^{2\pi i(\mathbf q+\widehat{\mathbf k})\cdot\mathbf r/N}`,340,colors[1],{'data-get-peak-kernel':'combined'});
    token('kernelReference',String.raw`e^{2\pi i\mathbf q\cdot\mathbf r/N}`,240,colors[0],{'data-get-peak-kernel':'reference'});
    token('kernelExtra',String.raw`e^{2\pi i\widehat{\mathbf k}\cdot\mathbf r/N}`,270,colors[2],{'data-get-peak-kernel':'extra'});
    token('kernelDelta',String.raw`e^{i\delta(\mathbf r)}`,195,colors[2]);
    token('u',String.raw`u(\mathbf r)`,120);
    const bracket=path(group,colors[0],{'stroke-width':1.5,'data-get-peak-recognize-u':''});
    const bracketLabel=mathLabel(group,954,l.bracketY-4,180,String.raw`u(\mathbf r)`,colors[0]);
    const referenceBox=el('rect',{x:pair.x[0]-300,y:l.definitionY+5,width:600,height:62,rx:8,
      fill:'none',stroke:colors[0],'stroke-width':1.4,'data-get-peak-reference-match':''},group);
    const geometry=el('g',{'data-get-peak-extra-rotation':'','data-illustration':'unit-complex-multiplication'},group);
    const axes=plane(geometry,...l.plane,'extra-angle');
    const original=path(axes,colors[0],{'stroke-width':2,'stroke-dasharray':'4 4','data-get-peak-extra-source':''});
    const rotated=path(axes,colors[2],{'stroke-width':3,'data-get-peak-extra-vector':''});
    const arc=path(axes,colors[2],{'stroke-width':2,'data-get-peak-extra-arc':''});
    const arcLabel=label(axes,0,0,'δ','pe-two-text',colors[2]);
    const delta=mathLabel(group,l.angleX,l.angleY,590,String.raw`\delta(\mathbf r)=\frac{2\pi}{N}\widehat{\mathbf k}\cdot\mathbf r`,colors[2],
      {height:58,'data-get-peak-delta-definition':''});
    const unit=mathLabel(geometry,l.angleX,l.angleY+57,570,String.raw`|e^{i\delta}|=1\qquad\arg(ze^{i\delta})=\arg z+\delta\pmod{2\pi}`,colors[2]);
    const coordinate=label(geometry,l.plane[0],l.plane[1]-94,'','pe-two-small');
    const legend=label(geometry,l.angleX,l.captionY+34,'青：z = αu(r)　橙：z · exp(iδ)　单位长度示意','pe-two-small');
    set(unit,'data-get-peak-unit-rotation','');set(legend,'data-get-peak-rotation-legend','');
    // Old glyphs leave before their replacements arrive; no stacked equations.
    const out=t=>1-ramp(t,0,.4),into=t=>ramp(t,.6,1);
    function pose(name,x,y,alpha){set(tokens[name],'transform',`translate(${x} ${y})`);opacity(tokens[name],alpha);}
    return {draw(s){
      const c=s.cues,d=c.derivationEnter,a=c.addressSubstitution,b=c.bandSubstitution;
      const split=c.kernelSplit,pull=c.factorOutside,fold=c.recognizeU,deltaName=c.deltaReveal;
      cards.forEach((card,i)=>{
        opacity(card.g,1-ramp(d,.25,.85));
        set(card.g,'transform',`translate(${pair.x[i]} ${pair.y-55*d}) scale(${1-.65*d})`);
        opacity(card.image,1-ramp(s.inverse,0,.35));opacity(card.spatial,ramp(s.inverse,.55,1));
        opacity(card.transform,s.inverse>0&&s.inverse<1?1:0);
        text(card.heading,s.inverse===1?(i?'v(r)':'u(r)'):(i?'B₁ → v':'B₀ → u'));
      });
      opacity(group,d);
      definitions.forEach(node=>set(node,'transform',`translate(0 ${(pair.y-l.definitionY-35)*(1-d)})`));
      const rowEnter=c.derivationRow,rowScale=lerp(.6,1,rowEnter);
      opacity(row,rowEnter);
      set(row,'transform',`translate(${lerp(pair.x[1],720,rowEnter)-720*rowScale} ${lerp(l.definitionY+35,l.rowY,rowEnter)}) scale(${rowScale})`);
      opacity(relation,c.derivationRow*(1-ramp(split,0,.4)));
      pose('lhs',l.lhs,0,1);pose('equal',l.equal,0,out(b));pose('approx',l.equal,0,into(b));
      pose('alpha',lerp(l.band-37,l.alpha,b),46*Math.sin(Math.PI*b),into(b));
      const remain=out(fold),normX=lerp(l.norm,l.outsideNorm,pull),sumX=lerp(l.sum,l.outsideSum,pull);
      const bandX=lerp(l.band,l.outsideBand,pull),refX=lerp(l.reference,l.outsideReference,pull);
      // The sum contracts towards the same persistent u token.
      const contract=x=>lerp(x,l.foldedU,fold);
      pose('norm',contract(normX),0,remain);pose('sumF',sumX,0,out(a));pose('sumQ',contract(sumX),0,into(a)*remain);
      pose('bandF',l.band,0,out(a));pose('bandShifted',l.band,0,into(a)*out(b));pose('bandZero',contract(bandX),0,into(b)*remain);
      pose('kernelF',l.kernel,0,out(a));pose('kernelCombined',l.kernel,0,into(a)*out(split));
      pose('kernelReference',contract(lerp(l.kernel,refX,split)),0,into(split)*remain);
      const extraX=lerp(lerp(l.kernel,l.extra,split),l.outsideExtra,pull);
      pose('kernelExtra',extraX,46*Math.sin(Math.PI*split)+68*Math.sin(Math.PI*pull),into(split)*out(deltaName));
      pose('kernelDelta',l.outsideExtra,0,into(deltaName));pose('u',l.foldedU,0,into(fold));
      const bracketAlpha=ramp(pull,.94,1)*(1-fold);
      set(bracket,'d',`M ${l.outsideNorm-36} ${l.bracketY-23} v 8 H ${l.outsideReference+120} v -8`);
      opacity(bracket,bracketAlpha);opacity(bracketLabel,bracketAlpha);opacity(referenceBox,Math.max(bracketAlpha,fold));
      opacity(delta,deltaName);opacity(geometry,c.positivePlane);
      const g=s.extraAngle,scale=l.plane[2]-8;
      vector(original,g.source,scale);vector(rotated,g.target,scale);
      set(rotated,'data-delta',g.delta);set(rotated,'data-applied-angle',g.angle);set(rotated,'data-r',g.r.join(','));
      const radius=39,start=g.psi,end=start+g.angle;
      set(arc,'d',Math.abs(g.angle)<1e-10?'M 0 0':`M ${radius*Math.cos(start)} ${-radius*Math.sin(start)} A ${radius} ${radius} 0 ${Math.abs(g.angle)>Math.PI?1:0} ${g.angle>=0?0:1} ${radius*Math.cos(end)} ${-radius*Math.sin(end)}`);
      set(arcLabel,'x',55*Math.cos(start+g.angle/2));set(arcLabel,'y',-55*Math.sin(start+g.angle/2));opacity(arcLabel,c.positiveTurn);
      text(coordinate,`固定 r = (${g.r.join(', ')}) · δ ≡ ${g.turn.toFixed(3)} rad（模 2π）`);
    }};
  };
})(typeof globalThis!=='undefined'?globalThis:this);
