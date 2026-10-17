/* Opt-in desktop rehearsal controls. All navigation uses the host player. */
(function(root) {
  'use strict';
  function mount({ document:doc, container, toggle, registry, player, current }) {
    let location, visible=false, cleanups=[];
    const element=(tag,attrs={},parent=container,text='')=>{
      const node=doc.createElement(tag);
      Object.entries(attrs).forEach(([k,v])=>node.setAttribute(k,v));
      if(text)node.textContent=text;parent.appendChild(node);return node;
    };
    const listen=(node,event,fn)=>{node.addEventListener(event,fn);cleanups.push(()=>node.removeEventListener?.(event,fn));};
    listen(container,'click',event=>event.stopPropagation?.());
    const field=(title,tag,attrs)=>{const label=element('label',{});element('span',{},label,title);return element(tag,attrs,label);};
    const scenes=field('场景','select',{'aria-label':'排练场景','data-rehearsal':'scene'});
    const beats=field('分镜','select',{'aria-label':'排练分镜','data-rehearsal':'beat'});
    const progress=field('拍内进度','input',{type:'range',min:0,max:1,step:.001,'aria-label':'分镜局部进度','data-rehearsal':'progress'});
    const play=element('button',{type:'button','data-rehearsal':'play'},container,'播放本拍');
    const copy=element('button',{type:'button','data-rehearsal':'copy'},container,'复制定位');
    const position=field('定位码（可粘贴）','input',{type:'text','data-rehearsal':'locator','aria-label':'分镜定位码'});
    const jump=element('button',{type:'button','data-rehearsal':'jump'},container,'跳转');
    const status=element('output',{'data-rehearsal':'status','aria-live':'polite'});
    for(const entry of registry.entries)element('option',{value:entry.id},scenes,`${String(entry.index+1).padStart(2,'0')} · ${entry.label}`);
    function fillBeats(entry) {
      Array.from(beats.children).forEach(n=>n.remove());
      for(const [i,b] of entry.beats.entries())element('option',{value:b.key},beats,`${i+1}. ${b.action}`);
    }
    function sync(id,p) {
      if(!visible)return;
      const next=registry.locate(id,p);
      if(location?.entry.id!==next.entry.id){scenes.value=next.entry.id;fillBeats(next.entry);}
      location=next;beats.value=next.beat.key;progress.value=String(next.progress);
      progress.setAttribute('aria-valuetext',(next.progress*100).toFixed(1)+'%');
      // Keep a pasted location intact until the user submits it.
      if(doc.activeElement!==position)position.value=registry.serialize(next);
      status.textContent=`${next.entry.label} / ${next.beat.action} / ${(next.progress*100).toFixed(1)}% · ${next.entry.unit}`;
    }
    const seek=(scene,beat,p)=>{const target=registry.resolve({scene,beat,progress:p});player.seek(target.position);return target;};
    listen(toggle,'click',()=>{visible=!visible;container.hidden=!visible;toggle.setAttribute('aria-expanded',visible);
      if(visible){player.pause();const s=current();sync(s.id,s.progress);} });
    listen(scenes,'change',()=>{const entry=registry.find(scenes.value);seek(entry.id,entry.beats[0].key,0);});
    listen(beats,'change',()=>seek(scenes.value,beats.value,0));
    listen(progress,'input',()=>seek(scenes.value,beats.value,Number(progress.value)));
    listen(play,'click',()=>{
      const entry=registry.find(scenes.value), beat=entry.beats.find(b=>b.key===beats.value);
      seek(entry.id,beat.key,0);player.go(entry.initial?0:entry.start+beat.end);
    });
    listen(copy,'click',async()=>{
      position.value=registry.serialize(location);
      try {if(!root.navigator?.clipboard?.writeText)throw new Error('clipboard unavailable');await root.navigator.clipboard.writeText(position.value);status.textContent='定位码已复制。';}
      catch {position.focus();position.select?.();status.textContent='请复制已选中的定位码。';}
    });
    listen(jump,'click',()=>{try {const target=registry.parse(position.value);player.seek(target.position);position.value=registry.serialize(target);status.textContent='已定位到 '+target.entry.label+' / '+target.beat.action;}
      catch(error){status.textContent=error.message;} });
    return { sync, registry, destroy(){cleanups.forEach(fn=>fn());cleanups=[];} };
  }
  root.SIMRehearsal={mount};
})(typeof globalThis!=='undefined'?globalThis:this);
