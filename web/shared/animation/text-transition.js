/* Text handoffs are sampled from the host playhead, never a second clock. */
(function(root){
  'use strict';
  const clamp=x=>Math.max(0,Math.min(1,x));
  const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
  function state(progress,duration,boundary=0,reduced=false){
    const amount=reduced?1:clamp((progress-boundary)*duration/560);
    // Leave a quiet midpoint rather than superimposing two different sentences.
    const incoming=smooth((amount-.45)/.55),outgoing=1-smooth(amount/.45);
    return {amount,incoming,outgoing,incomingY:5*(1-incoming),outgoingY:-3*(1-outgoing)};
  }
  function create({document,host,fields}){
    const previous=document.createElement('div');
    previous.setAttribute('class','copy-handoff-previous');previous.setAttribute('aria-hidden','true');
    const old=fields.map(field=>{const node=document.createElement(field.tag||'p');previous.appendChild(node);return node;});
    host.appendChild(previous);host.classList.toggle('copy-handoff',true);
    const style=(node,key,value)=>{value=String(value);if(node.style[key]!==value)node.style[key]=value;};
    function draw(from,pose){
      fields.forEach((field,i)=>{
        const value=String(from?.[field.key]||'');if(old[i].textContent!==value)old[i].textContent=value;
        const unchanged=value===field.node.textContent;
        style(old[i],'opacity',unchanged?0:1);
        style(field.node,'opacity',unchanged?1:pose.incoming);style(field.node,'transform',`translateY(${unchanged?0:pose.incomingY}px)`);
      });
      style(previous,'opacity',pose.outgoing);style(previous,'transform',`translateY(${pose.outgoingY}px)`);
      previous.hidden=pose.outgoing===0;
    }
    return {draw,reset(){draw(null,state(1,560));},previous};
  }
  const api={state,create};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SIMTextTransition=api;
})(typeof globalThis!=='undefined'?globalThis:this);
