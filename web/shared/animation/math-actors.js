/* Retained mathematical groups. A single playhead interpolates layout frames;
 * compilation and intrinsic-width measurement happen once, never per frame. */
(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const Clock=node?require('./beat-clock.js'):root.SIMBeatClock;
  const {ramp}=Clock,lerp=(a,b,t)=>a+(b-a)*t;
  function layout(frame,widths){
    const poses={};
    for(const row of frame.rows||[]){
      const size=row.size||32,gap=row.gap??8;
      const raw=row.keys.reduce((n,k)=>n+(widths[k]||30),0)+gap*Math.max(0,row.keys.length-1);
      const scale=Math.min(size/32,(row.maxWidth||1260)/raw);
      let x=row.right!==undefined?row.right-raw*scale:(row.x??720)-raw*scale/2;
      for(const key of row.keys){poses[key]={x,y:row.y,scale,opacity:1};x+=((widths[key]||30)+gap)*scale;}
    }
    for(const [key,p] of Object.entries(frame.poses||{}))poses[key]={scale:1,opacity:1,...p};
    return poses;
  }
  function sample(frames,time,widths){
    let index=0;for(let i=1;i<frames.length;i++)if(time>=frames[i].at-1e-9)index=i;
    const frame=frames[index],previous=frames[Math.max(0,index-1)];
    const to=layout(frame,widths),from=index?layout(previous,widths):to;
    const amount=index?ramp(time,frame.at,frame.at+(frame.span??2)):1,poses={};
    for(const key of new Set([...Object.keys(from),...Object.keys(to)])){
      const origin=frame.origins?.[key],destination=frame.merges?.[key];
      const a=from[key]||{...(from[origin]||to[key]),opacity:0};
      const b=to[key]||{...(to[destination]||from[key]),opacity:0};
      const arc=frame.arcs?.[key]||0;
      poses[key]={x:lerp(a.x,b.x,amount),y:lerp(a.y,b.y,amount)-arc*Math.sin(Math.PI*amount),
        scale:lerp(a.scale,b.scale,amount),opacity:lerp(a.opacity,b.opacity,amount)};
    }
    return {key:frame.key||String(index),index,amount,poses,equation:frame.equation||'',focus:frame.focus||[]};
  }
  function create({parent,tokens,frames,name='math',document=root.document}){
    const svg='http://www.w3.org/2000/svg',html='http://www.w3.org/1999/xhtml',mathNS='http://www.w3.org/1998/Math/MathML';
    const set=(n,k,v)=>{v=String(v);if(n.getAttribute(k)!==v)n.setAttribute(k,v);};
    const el=(tag,attrs,p,ns=svg)=>{const n=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs||{}))set(n,k,v);p?.appendChild(n);return n;};
    const group=el('g',{'data-math-actors':name},parent),actors={},widths={};
    for(const [key,value]of Object.entries(tokens)){
      const spec=typeof value==='string'?{tex:value}:value;
      const g=el('g',{'data-math-actor':key,'data-actor-owner':name,'data-tex':spec.tex||''},group);
      widths[key]=spec.width||Math.max(22,(spec.tex||'').replace(/\\[a-zA-Z]+|[{}_^]/g,'').length*13);
      if(spec.bar){el('line',{x1:0,x2:spec.width,y1:0,y2:0,stroke:spec.color||'#dce8e6','stroke-width':1.5},g);actors[key]={g};continue;}
      const box=el('foreignObject',{x:0,y:-48,width:1440,height:144},g);
      const div=el('div',{class:'sim-retained-math'},box,html);
      div.style.fontSize='32px';div.style.color=spec.color||'#dce8e6';
      const math=el('math',{display:'block'},div,mathNS),pad=el('mpadded',{height:'1.5em',depth:'1em'},math,mathNS);
      const row=el('mrow',{},pad,mathNS);
      const output=root.katex.renderToString(spec.tex,{displayMode:true,output:'mathml',throwOnError:true,strict:'error'});
      const body=output.match(/<semantics>([\s\S]*?)<annotation\b/);
      if(!body)throw new Error('MathML missing: '+key);
      row.innerHTML=body[1];actors[key]={g,box,math};
    }
    let measured=false;
    function measure(){
      if(measured)return;
      const saved=Object.values(actors).map(a=>[a.g,a.g.getAttribute('transform')]);
      for(const [g]of saved)set(g,'transform','translate(0 0) scale(1)');
      try{
      const first=Object.values(actors).find(a=>a.math),rect=first.math.getBoundingClientRect();
      if(typeof rect.width!=='number'){measured=true;return;}
      const viewport=first.box.getBoundingClientRect();if(!(rect.width>0&&viewport.width>0))return;
      const unit=1440/viewport.width,next={};
      for(const [key,a]of Object.entries(actors)){if(!a.math)continue;const w=a.math.getBoundingClientRect().width*unit;if(!(w>0))return;next[key]=w;}
      Object.assign(widths,next);measured=true;
      }finally{for(const [g,transform]of saved){if(transform===null||transform===undefined)g.removeAttribute('transform');else set(g,'transform',transform);}}
    }
    function draw(time,visible=1){
      set(group,'opacity',visible);set(group,'aria-hidden',visible===0);
      if(visible>0)measure();
      const s=sample(frames,time,widths);set(group,'data-frame',s.key);
      for(const [key,a]of Object.entries(actors)){
        const p=s.poses[key];set(a.g,'opacity',p?.opacity||0);set(a.g,'aria-hidden',!p||p.opacity===0);
        if(p){set(a.g,'transform',`translate(${p.x} ${p.y}) scale(${p.scale})`);set(a.g,'data-x',p.x);set(a.g,'data-y',p.y);}
        else{set(a.g,'transform','translate(0 0) scale(1)');set(a.g,'data-x',0);set(a.g,'data-y',0);}
        set(a.g,'data-emphasized',s.focus.includes(key));
      }
      return s;
    }
    draw(0,0);return {group,actors,widths,draw};
  }
  const api={layout,sample,create};if(node)module.exports=api;else root.SIMMathActors=api;
})(typeof globalThis!=='undefined'?globalThis:this);
