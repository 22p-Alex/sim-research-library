/* One illumination law, three observable changes. This controlled illustration
 * never changes the capture, estimator, reconstruction, or its display scale. */
(function(root){
  'use strict';
  root.SIMIlluminationParameters={create({parent,create,attr,opacity,imageURL,formulaBox}){
    const body=create('g',{'data-illumination-body':''},parent);
    const label=(x,y,text,color='#c6d5d7')=>create('text',{x,y,fill:color,'font-size':17,'text-anchor':'middle'},body,text);
    // Samples already account for the 420:280 physical aspect ratio below.
    // Fill that rectangle rather than fitting the square raster with side bars.
    const picture=create('image',{x:210,y:145,width:420,height:280,preserveAspectRatio:'none','data-parameter-stripes':''},body);
    create('rect',{x:210,y:145,width:420,height:280,fill:'none',stroke:'#36525d'},body);
    const wavevector=create('path',{fill:'none',stroke:'#7ad5cd','stroke-width':3,'data-parameter-wavevector':''},body);
    const interval=create('path',{fill:'none',stroke:'#7ad5cd','stroke-width':2,'data-parameter-spacing':''},body);
    const displacement=create('path',{fill:'none',stroke:'#b7a5eb','stroke-width':3,'data-parameter-translation':''},body);
    const profile=create('g',{'data-parameter-contrast-profile':''},body);
    create('path',{d:'M 795 155 V 425 H 1235 M 795 290 H 1235',fill:'none',stroke:'#506970'},profile);
    for(const [y,value] of [[155,'2'],[290,'1'],[425,'0']])create('text',{x:780,y:y+5,fill:'#9eb5bd','font-size':15,'text-anchor':'end'},profile,value);
    const curves=[0,1,2].map(j=>create('path',{fill:'none',stroke:['#edf0e9','#7ad5cd','#b7a5eb'][j],'stroke-width':j?1.5:2.5,'data-parameter-phase-profile':j},profile));
    const contrast=create('path',{fill:'none',stroke:'#efb879','stroke-width':2,'data-parameter-contrast':''},profile);
    label(420,450,'同一照明公式生成 · 参数作用示意');
    label(1015,450,'固定光强标尺 · 沿条纹法线取剖面');
    const meaning=label(720,480,'');
    const relation=formulaBox(body,120,490,1200,60,String.raw`$$\phi_j=\phi'_j+\phi_\Delta,\qquad\phi'_j=\frac{2\pi j}{3}\ (\text{已知}),\quad\phi_\Delta\ (\text{未知，三帧共用})$$`,{class:'parameter-phase-relation','data-parameter-phase-relation':''});
    let signature='';
    function arrow(x,y,dx,dy){const a=Math.atan2(dy,dx);return `M ${x} ${y} l ${dx} ${dy} m ${-10*Math.cos(a-.5)} ${-10*Math.sin(a-.5)} l ${10*Math.cos(a-.5)} ${10*Math.sin(a-.5)} l ${-10*Math.cos(a+.5)} ${-10*Math.sin(a+.5)}`;}
    return {draw(s){
      const state=s.illumination,{kx,ky,m,phase,kind}=state,n=128,length=Math.hypot(kx,ky),ux=kx/length,uy=ky/length;
      opacity(body,state.body);attr(body,'aria-hidden',state.body===0);
      attr(parent,'data-parameter-focus',kind);attr(picture,'data-kx',kx);attr(picture,'data-ky',ky);attr(picture,'data-m',m);attr(picture,'data-common-phase',phase);
      const key=[kx,ky,m,phase].map(v=>v.toFixed(5)).join(':');
      if(signature!==key){
        attr(picture,'href',imageURL((x,y,size)=>{const value=(1+m*Math.cos(2*Math.PI*(kx*x/size+ky*(y/size-.5)*2/3)+phase))/2;return [189,219,229].map(c=>Math.round(c*value));},96));
        curves.forEach((curve,j)=>attr(curve,'d',Array.from({length:161},(_,i)=>{const z=i/160,value=1+m*Math.cos(2*Math.PI*length*z+state.relativePhases[j]+phase);return `${i?'L':'M'} ${795+440*z} ${425-135*value}`;}).join(' ')));
        signature=key;
      }
      attr(wavevector,'d',arrow(420,285,70*ux,70*uy));
      const gap=420/length;attr(interval,'d',`M 420 355 l ${gap*ux} ${gap*uy} m ${-5*uy} ${5*ux} l ${10*uy} ${-10*ux}`);
      const shift=-420*phase/(2*Math.PI*length);attr(displacement,'d',arrow(420,285,shift*ux,shift*uy));
      attr(contrast,'d',`M 1260 ${290-135*m} H 1250 V ${290+135*m} H 1260`);
      opacity(wavevector,kind==='k'?1:.25);opacity(interval,kind==='k'?1:0);opacity(contrast,kind==='m'?1:.2);opacity(displacement,kind==='phase'?1:0);
      opacity(relation,kind==='phase'?1:0);
      meaning.textContent=kind==='k'?`k：方向与间距 · 法线方向 ${(Math.atan2(ky,kx)*180/Math.PI).toFixed(1)}° · 周期 ${(n/length).toFixed(2)} 像素`
        :kind==='m'?`m：反差 · Imax=${(1+m).toFixed(2)}，Imin=${(1-m).toFixed(2)} · 峰的位置不变`
        :'共同相位：白、青、紫三帧同时平移 · 已知相对相移不变';
    }};
  }};
})(typeof globalThis!=='undefined'?globalThis:this);
