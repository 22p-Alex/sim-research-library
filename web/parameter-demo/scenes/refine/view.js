/* Observation-driven subpixel story. No clock and no browser measurements.
 * Phase, shifted spectrum, OTF, mask and score share the same candidate. */
(function(root) {
  'use strict';
  const L=root.SIMParameterLesson,A=root.SIMAtlas,M=root.SIMParameterStory;
  L.createRefinementView=function(options) {
    const {parent,defs,lesson,el,label,line,path,arrow,raster,fieldURL,set,text,opacity,heat,uid}=options;
    const e=lesson.estimate,n=e.context.config.n,colors=L.bandColors;
    const note=(...args)=>{const node=label(...args);set(node,'display','none');set(node,'data-scene-note','');return node;};
    function maskedFrequencyURL(z,kx,ky,color) {
      const side=27,rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)),values=new Float64Array(side*side),keep=new Uint8Array(side*side);
      let maximum=1e-30;
      for(let y=0;y<side;y++)for(let x=0;x<side;x++) {
        const qx=x-13,qy=y-13,j=y*side+x,i=A.idx(qx,qy,n);
        if(A.otf(qx+kx,qy+ky,e.context.config.cutoff)<e.context.config.minH)continue;
        keep[j]=1;values[j]=Math.hypot(z.re[i],z.im[i]);maximum=Math.max(maximum,values[j]);
      }
      // Display the same reliable support used by compare. Fractional DFT
      // tails outside that support stay in z, but cannot light the backdrop.
      return raster(side,side,(x,y)=>{
        const i=y*side+x;if(!keep[i])return [0,0,0,0];
        const value=Math.log1p(1e4*values[i]/maximum)/Math.log1p(1e4);
        return [...rgb.map(c=>Math.round(c*value)),255];
      });
    }
    const g=el('g',{'data-subpixel-refine':'','data-source':'observed-provisional-sideband'},parent);
    const fmt=(v,d=2)=>(Math.abs(v)<.5*10**-d?0:v).toFixed(d);
    const peak=el('g',{'data-refine-grid-limit':''},g);
    const peakImage=el('image',{x:-126,y:-126,width:252,height:252,style:'image-rendering:pixelated','data-refine-surface':''},peak);
    const contours=el('g',{fill:'none',stroke:'#efb879','stroke-width':1,'stroke-opacity':.65,'data-refine-contours':''},peak);
    el('rect',{x:-126,y:-126,width:252,height:252,fill:'none',stroke:colors[0],'stroke-width':1.5},peak);
    line(peak,-126,0,126,0,'#bdd0d466');line(peak,0,-126,0,126,'#bdd0d466');
    for(const v of [-.5,-.25,0,.25,.5]) {
      const q=v*240;
      line(peak,q,126,q,131);label(peak,q,148,fmt(v),'pe-two-small');
      line(peak,-131,q,-126,q);const t=label(peak,-137,q+4,fmt(v),'pe-two-small');set(t,'text-anchor','end');
    }
    label(peak,0,-151,'±0.5 格','pe-two-text');
    el('circle',{cx:0,cy:0,r:4,fill:colors[0],'data-refine-integer-origin':''},peak);
    const fitted=el('g',{'data-refine-fitted-offset':''},peak);
    el('circle',{r:10,fill:'none',stroke:colors[2],'stroke-width':2},fitted);
    line(fitted,-15,0,15,0,colors[2]);line(fitted,0,-15,0,15,colors[2]);
    const peakNote=note(g,720,482,'','pe-two-small');
    const work=el('g',{'data-refine-phase-work':''},g),left=el('g',{transform:'translate(360 300)'},work);
    label(left,0,-151,'Ã₊₁ → a(r)','pe-two-text',colors[1]);
    const imageAttrs={x:-100,y:-100,width:200,height:200,style:'image-rendering:pixelated'};
    el('rect',{x:-113,y:-113,width:226,height:226,rx:5,class:'pe-two-panel'},left);
    const raw=el('image',{...imageAttrs,href:fieldURL(e.context.separated.bands[1],colors[1],true),'data-refine-raw-sideband':''},left);
    const spatial=el('image',{...imageAttrs,'data-refine-spatial':''},left);
    const phase=el('image',{...imageAttrs,'data-refine-phase-ramp':''},left);
    const samplePoint=el('g',{'data-refine-sample-point':''},left);
    el('circle',{r:5,fill:'#091115',stroke:colors[2],'stroke-width':2},samplePoint);
    label(samplePoint,12,-10,'r₀','pe-two-small',colors[2]);
    const inverseLabel=note(left,0,140,'','pe-two-small');
    const phaseValue=label(left,0,165,'','pe-two-small');
    const fftArrow=path(work,colors[2],{'data-refine-fft-arrow':'',d:arrow(493,300,577,300)});
    label(work,535,278,'正 FFT','pe-two-small',colors[2]);
    const middle=el('g',{transform:'translate(720 300)'},work),freq=el('g',{'data-refine-frequency':''},middle);
    label(middle,0,-151,'Bₖ′(q)','pe-two-text',colors[1]);
    const clip=el('clipPath',{id:uid+'-refine-frequency',clipPathUnits:'userSpaceOnUse'},defs);
    el('rect',{x:-110,y:-110,width:220,height:220},clip);
    set(freq,'clip-path','url(#'+uid+'-refine-frequency)');
    el('rect',{x:-110,y:-110,width:220,height:220,fill:'#091115'},freq);
    const frequencyAttrs={x:-110,y:-110,width:220,height:220,style:'image-rendering:pixelated'};
    el('image',{...frequencyAttrs,href:maskedFrequencyURL(e.context.separated.bands[0],0,0,colors[0]),opacity:.55,
      'data-refine-reference-spectrum':'','data-display-support':'own-reliable-otf'},freq);
    const shifted=el('image',{...frequencyAttrs,opacity:.78,'data-refine-shifted-sideband':'','data-display-support':'own-reliable-otf'},freq);
    const unit=220/27;
    for(let q=-13;q<=13;q++) {
      line(freq,q*unit,-110,q*unit,110,'#8eabb61b');line(freq,-110,q*unit,110,q*unit,'#8eabb61b');
    }
    const reliable=el('g',{'data-refine-reliable':''},freq);
    const reliableCells=e.context.points.map(point=>el('rect',{x:point.x*unit-unit/2,y:point.y*unit-unit/2,
      width:unit-1,height:unit-1,fill:colors[2],'fill-opacity':.28,'data-refine-q':[point.x,point.y].join(',')},reliable));
    el('circle',{cx:0,cy:0,r:e.context.config.cutoff*unit,fill:'none',stroke:colors[0],'stroke-width':1.2},freq);
    const otf=el('circle',{r:e.context.config.cutoff*unit,fill:'none',stroke:colors[1],'stroke-width':1.8,'data-refine-shifted-otf':''},freq);
    line(freq,-110,0,110,0,'#bdd0d455');line(freq,0,-110,0,110,'#bdd0d455');
    note(middle,0,140,'仅显各自可靠通带 · 橙格参与评分','pe-two-small');
    const displacement=label(middle,0,165,'','pe-two-small');
    const scoreArrow=path(work,colors[2],{'data-refine-score-arrow':'',d:arrow(863,300,924,300)});
    label(work,891,278,'ρ(k′)','pe-two-small',colors[2]);
    const search=el('g',{'data-refinement-grid':''},g);
    const searchBackdrop=el('rect',{x:-185,y:-168,width:370,height:352,rx:6,fill:'#091115','data-refine-search-backdrop':''},search);
    const searchFrame=el('rect',{x:-125,y:-125,width:250,height:250,fill:'#091115',stroke:colors[0],'stroke-width':2,'data-refine-round-frame':''},search);
    const fineTitle=label(search,0,-148,'','pe-two-text');set(fineTitle,'data-refine-round-title','');
    const cells=Array.from({length:25},(_,i)=>el('rect',{x:-122+i%5*50,y:-122+Math.floor(i/5)*50,
      width:44,height:44,'data-refine-cell':i},search));
    const xTicks=[],yTicks=[];
    for(let j=0;j<5;j++) {
      xTicks.push(label(search,-100+j*50,141,'','pe-two-small'));
      const t=label(search,-136,-96+j*50,'','pe-two-small');set(t,'text-anchor','end');yTicks.push(t);
    }
    const cursor=el('rect',{width:46,height:46,fill:'none','stroke-width':2,'data-refine-candidate-cursor':''},search);
    const winner=el('circle',{r:13,fill:'none','stroke-width':2,'data-refine-round-winner':''},search);
    const nextWindow=el('rect',{width:40,height:40,fill:'none','stroke-dasharray':'4 3','stroke-width':2,'data-refine-next-window':''},search);
    const finalTarget=el('g',{'data-refine-final-target':''},search);
    line(finalTarget,-19,0,19,0,colors[2],{'stroke-width':2});line(finalTarget,0,-19,0,19,colors[2],{'stroke-width':2});
    const fineDetail=note(search,0,164,'','pe-two-small');set(fineDetail,'data-refine-round-detail','');
    const roundNotes=el('g',{'data-refine-round-summary':''},g);
    const notes=e.rounds.map((r,i)=>label(roundNotes,320+i*400,116,`第 ${i+1} 轮：±${fmt(2*r.step)} · 步长 ${fmt(r.step)}`,'pe-two-small',colors[i]));
    const values=label(g,720,116,'','pe-two-text');set(values,'data-refine-candidate-readout','');
    let surfaceReady=false,spatialReady=false;
    const images=new Map();
    function prepareSurface() {
      if(surfaceReady)return;
      const surface=L.refinementDataFor(lesson).surface(),side=surface.side;
      const norm=c=>c.valid?(c.score-surface.minimum)/Math.max(1e-12,surface.maximum-surface.minimum):0;
      set(peakImage,'href',raster(side,side,(x,y)=>{
        const value=norm(surface.points[y*side+x]);return [12+205*value,25+137*value,31+69*value,255];
      }));
      // Marching squares over measured scores; no invented radial peak.
      for(const level of [.25,.5,.75,.9]) {
        let d='';
        for(let y=0;y<side-1;y++)for(let x=0;x<side-1;x++) {
          const corners=[[x,y],[x+1,y],[x+1,y+1],[x,y+1]],crossings=[];
          for(let edge=0;edge<4;edge++) {
            const a=corners[edge],b=corners[(edge+1)%4],va=norm(surface.points[a[1]*side+a[0]]),vb=norm(surface.points[b[1]*side+b[0]]);
            if((va<level)===(vb<level))continue;
            const t=(level-va)/(vb-va);
            crossings.push([-120+240*(a[0]+(b[0]-a[0])*t)/(side-1),-120+240*(a[1]+(b[1]-a[1])*t)/(side-1)]);
          }
          for(let i=0;i+1<crossings.length;i+=2)d+=`M ${crossings[i][0]} ${crossings[i][1]} L ${crossings[i+1][0]} ${crossings[i+1][1]} `;
        }
        el('path',{d,'data-refine-contour-level':level},contours);
      }
      set(peakImage,'data-score-min',surface.minimum);set(peakImage,'data-score-max',surface.maximum);
      surfaceReady=true;
    }
    function prepareField(candidate) {
      const data=L.refinementDataFor(lesson),key=candidate.kx+','+candidate.ky;
      if(!spatialReady){set(spatial,'href',fieldURL(data.spatial,colors[1],false));spatialReady=true;}
      if(!images.has(key)) {
        const f=data.at(candidate.kx,candidate.ky),size=64;
        const stripe=raster(size,size,(x,y)=>{
          const theta=-2*Math.PI*(candidate.kx*x/size+candidate.ky*y/size),v=.5+.5*Math.cos(theta);
          return [55+128*v,43+122*v,92+143*v,105];
        });
        images.set(key,{stripe,spectrum:maskedFrequencyURL(f.shifted,candidate.kx,candidate.ky,colors[1])});
      }
      const image=images.get(key);set(phase,'href',image.stripe);set(shifted,'href',image.spectrum);
    }
    function draw(progress,state,origin) {
      if(progress===null){opacity(g,0);return;}
      const p=progress,s=state,c=s.candidate,workAlpha=s.work*(1-s.cascade);
      opacity(g,1-s.returnView.collapse);set(g,'data-mode',s.mode);set(g,'data-round',s.round+1);set(g,'data-count',s.count);
      for(const [key,value] of Object.entries(s.returnView))set(g,'data-return-'+key,value);
      set(g,'data-kx',c.kx);set(g,'data-ky',c.ky);set(g,'data-score',c.score);
      if(s.zoom>0&&s.work<1)prepareSurface();
      const size=1+(252/origin.cell-1)*s.zoom,scale=origin.cell/252*size;
      set(peak,'transform',`translate(${origin.x+(720-origin.x)*s.zoom} ${origin.y+(300-origin.y)*s.zoom}) scale(${scale})`);
      opacity(peak,M.ramp(p,.025,.055)*(1-s.work));
      const dx=e.kx-e.coarseBest.kx,dy=e.ky-e.coarseBest.ky;
      set(fitted,'transform',`translate(${240*dx} ${240*dy})`);set(fitted,'data-dkx',dx);set(fitted,'data-dky',dy);
      text(peakNote,Math.hypot(dx,dy)<1e-9?'青点：整数初值 · 橙色准星：本组拟合峰，恰与整数点重合':'青点：整数初值 · 橙色准星：本组实际局部拟合峰');
      opacity(peakNote,(1-s.work)*M.ramp(p,.08,.14));
      opacity(work,workAlpha);opacity(search,s.work);
      // Set the same candidate images even while the columns are hidden, so
      // seeking backwards cannot leave a future candidate in their hrefs.
      prepareField(c);
      const demo=s.phaseDemo,inverse=demo.inverse;
      opacity(raw,1-inverse);opacity(spatial,inverse);opacity(phase,demo.factor);
      const forward=demo.forward;
      opacity(middle,forward);opacity(fftArrow,forward);opacity(scoreArrow,forward);
      const probe=L.refinementDataFor(lesson).probe(c.kx,c.ky);
      set(samplePoint,'transform',`translate(${-100+(probe.x+.5)*200/n} ${-100+(probe.y+.5)*200/n})`);
      set(samplePoint,'data-x',probe.x);set(samplePoint,'data-y',probe.y);opacity(samplePoint,demo.factor);
      text(inverseLabel,inverse<1?'未平移临时 +1 级 → 逆 FFT':'橙点 r₀ 对应下方箭头 · 乘相位只旋转');
      text(phaseValue,`θ[x,y] = −2π(${fmt(c.kx)}x ${c.ky<0?'−':'+'} ${fmt(Math.abs(c.ky))}y)/N`);
      set(phase,'data-kx',c.kx);set(phase,'data-ky',c.ky);set(phase,'data-sign',-1);
      set(otf,'cx',-c.kx*unit);set(otf,'cy',-c.ky*unit);set(otf,'data-kx',c.kx);set(otf,'data-ky',c.ky);
      // Estimator search entries intentionally retain no point list. Read the
      // cached full comparison, including entries whose `points` is empty.
      const admitted=new Set(L.dataFor(lesson).compare(c.kx,c.ky).points.map(point=>point.q.join(',')));
      reliableCells.forEach(node=>opacity(node,admitted.has(node.getAttribute('data-refine-q'))?1:0));
      set(reliable,'data-count',c.count);set(shifted,'data-kx',c.kx);set(shifted,'data-ky',c.ky);
      text(displacement,`Δk′ = (${fmt(c.kx-e.coarseBest.kx)}, ${fmt(c.ky-e.coarseBest.ky)}) 格`);
      text(values,s.mode==='gridLimit'?`整数初值 k̂int = (${fmt(e.coarseBest.kx,0)}, ${fmt(e.coarseBest.ky,0)})`
        :`k′ = (${fmt(c.kx)}, ${fmt(c.ky)}) · ρ = ${fmt(c.score,6)}`);
      // The candidate line leaves before the round summary enters its rail.
      // It must not sit behind the title of the enlarging central grid.
      opacity(values,1-M.ramp(p,.56,.59));
      const valid=s.candidates.filter(c=>c.valid),lo=Math.min(...valid.map(c=>c.score)),hi=Math.max(...valid.map(c=>c.score));
      const roundColor=colors[s.round],zoomScale=.2+.8*s.roundZoom,focusScale=1+.08*s.cascade;
      const previous=s.round?e.rounds[s.round-1]:null;
      const offset=previous?[(s.center.kx-previous.center.kx)/(2*previous.step)*100,(s.center.ky-previous.center.ky)/(2*previous.step)*100]:[0,0];
      const collapse=s.returnView.collapse,searchX=1080-360*s.cascade+offset[0]*(1-s.roundZoom)*focusScale,searchY=300+offset[1]*(1-s.roundZoom)*focusScale;
      const wx=(s.best.kx-s.center.kx)/s.halfWidth*100,wy=(s.best.ky-s.center.ky)/s.halfWidth*100;
      set(search,'transform',`translate(${searchX+wx*zoomScale*focusScale*.8*collapse} ${searchY+wy*zoomScale*focusScale*.8*collapse}) scale(${zoomScale*focusScale*(1-.8*collapse)})`);
      set(search,'data-half-width',s.halfWidth);set(search,'data-step',s.step);set(search,'data-score-min',lo);set(search,'data-score-max',hi);
      opacity(searchBackdrop,s.cascade);
      set(searchFrame,'stroke',roundColor);set(cursor,'stroke',roundColor);set(winner,'stroke',roundColor);set(nextWindow,'stroke',colors[Math.min(2,s.round+1)]);
      text(fineTitle,`第 ${s.round+1} 轮 · ±${fmt(s.halfWidth)} 格 · 步长 ${fmt(s.step)}`);
      cells.forEach((node,i)=>{
        const value=s.candidates[i],written=i<s.count;
        set(node,'fill',written&&value.valid?heat((value.score-lo)/Math.max(1e-12,hi-lo)):'#13262e');
        set(node,'data-kx',value.kx);set(node,'data-ky',value.ky);set(node,'data-score',value.score);set(node,'data-written',written);set(node,'data-round',s.round+1);
        const selected=Math.abs(value.kx-s.best.kx)<1e-9&&Math.abs(value.ky-s.best.ky)<1e-9;
        opacity(node,selected?1:1-.78*s.lock);
      });
      for(let j=0;j<5;j++){text(xTicks[j],fmt(s.center.kx+(j-2)*s.step));text(yTicks[j],fmt(s.center.ky+(j-2)*s.step));}
      const index=s.candidates.findIndex(v=>Math.abs(v.kx-c.kx)<1e-8&&Math.abs(v.ky-c.ky)<1e-8);
      set(cursor,'x',-123+Math.max(0,index)%5*50);set(cursor,'y',-123+Math.floor(Math.max(0,index)/5)*50);opacity(cursor,s.count>0&&s.count<25?1:0);
      set(winner,'cx',wx);set(winner,'cy',wy);opacity(winner,s.winner);
      set(nextWindow,'x',wx-20);set(nextWindow,'y',wy-20);opacity(nextWindow,s.nextWindow);
      set(finalTarget,'transform',`translate(${wx} ${wy})`);opacity(finalTarget,s.lock);
      text(fineDetail,s.done?`锁定 k̂ = (${fmt(e.kx)}, ${fmt(e.ky)}) · ρ = ${fmt(e.fit.score,6)}`
        :s.count===25?`最高分成为下一轮中心 · 局部色标 ${fmt(lo,6)}—${fmt(hi,6)}`:`已计算 ${s.count}/25 点 · 局部色标 ${fmt(lo,6)}—${fmt(hi,6)}`);
      opacity(roundNotes,M.ramp(p,.62,.66)*(1-s.returnView.collapse));notes.forEach((node,i)=>opacity(node,i<=s.round?1:.3));
      return {x:searchX+wx*zoomScale*focusScale,y:searchY+wy*zoomScale*focusScale};
    }
    return {root:g,draw};
  };
  L.createRefinementFormulaView=function({parent,document:doc,lesson,compile}) {
    const colors=L.bandColors;
    const make=(tag,attrs={},owner=parent)=>{
      const node=doc.createElement(tag);for(const [key,value] of Object.entries(attrs))node.setAttribute(key,value);owner.appendChild(node);return node;
    };
    const svg=(tag,attrs,owner)=>{
      const node=doc.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value] of Object.entries(attrs))node.setAttribute(key,value);owner.appendChild(node);return node;
    };
    const set=(node,key,value)=>{if(node.getAttribute(key)!==String(value))node.setAttribute(key,value);};
    const show=(node,value)=>{node.style.opacity=String(value);set(node,'aria-hidden',value===0);};
    const caption=make('div',{class:'pe-refine-formula-caption','data-refine-formula-step':''});
    const body=make('div',{class:'pe-refine-formula-body'}),equations=make('div',{class:'pe-refine-formula-equations'},body);
    const slot=()=>make('div',{class:'pe-refine-formula-slot'},equations);
    const main=slot(),detail=slot();
    const inverse=compile(main,'refine-inverse',String.raw`a=\mathcal F_N^{-1}\{\widetilde A_{+1}\}`);
    const product=make('div',{class:'pe-refine-formula-product'},main);
    const input=compile(product,'refine-input',String.raw`a(\mathbf r_0)`);input.style.color=colors[0];
    const times=compile(product,'refine-times',String.raw`\times`);
    const factor=compile(product,'refine-factor',String.raw`e^{i\theta_0}`);factor.style.color=colors[2];
    const equals=compile(product,'refine-equals','=');
    const output=compile(product,'refine-output',String.raw`b(\mathbf r_0)`);output.style.color=colors[1];
    const theta=compile(detail,'refine-theta',String.raw`\theta_0=-\frac{2\pi}{N}(k'_x x_0+k'_y y_0)`);
    const forward=compile(detail,'refine-forward',String.raw`B_{\mathbf k'}(\mathbf q)=\mathcal F_N\{b\}(\mathbf q)=\widetilde A_{+1}(\mathbf q+\mathbf k')`);
    const corrected=compile(detail,'refine-corrected',String.raw`V_{\mathbf k'}(\mathbf q)=\frac{B_{\mathbf k'}(\mathbf q)}{H(\mathbf q+\mathbf k')},\quad\mathbf q\in\Omega_{\mathbf k',\tau}`);
    const plot=svg('svg',{viewBox:'0 0 180 112',class:'pe-refine-phase-diagram','data-refine-phase-diagram':'',role:'img','aria-label':'同一像素的复数乘法：相位相加，模长不变'},body);
    svg('circle',{cx:88,cy:52,r:34,fill:'none',stroke:'#55737c','stroke-width':1},plot);
    svg('path',{d:'M 44 52 H 132 M 88 8 V 96',fill:'none',stroke:'#55737c','stroke-width':1},plot);
    const arc=svg('path',{fill:'none',stroke:colors[2],'stroke-width':2,'data-refine-phase-arc':''},plot);
    const before=svg('path',{fill:'none',stroke:colors[0],'stroke-width':2,'data-refine-complex-before':''},plot);
    const after=svg('path',{fill:'none',stroke:colors[1],'stroke-width':3,'data-refine-complex-after':''},plot);
    const legend=svg('text',{x:88,y:108,'text-anchor':'middle',fill:'#8eabb6','font-size':10},plot);legend.textContent='青 a → 紫 b · 长度归一显示';
    const numeric=make('div',{class:'pe-refine-formula-numeric','data-refine-formula-values':''});
    const arrow=angle=>{
      const x=88+34*Math.cos(angle),y=52-34*Math.sin(angle);
      return `M 88 52 L ${x} ${y} M ${x-6*Math.cos(angle-.45)} ${y+6*Math.sin(angle-.45)} L ${x} ${y} L ${x-6*Math.cos(angle+.45)} ${y+6*Math.sin(angle+.45)}`;
    };
    return {draw(progress) {
      const state=L.refinementState(lesson,progress),demo=state.phaseDemo,c=state.candidate,probe=L.refinementDataFor(lesson).probe(c.kx,c.ky);
      const rotation=probe.angle*demo.multiply,phi=Math.atan2(probe.a.im,probe.a.re),co=Math.cos(rotation),si=Math.sin(rotation);
      const result={re:probe.a.re*co-probe.a.im*si,im:probe.a.re*si+probe.a.im*co};
      const label={inverse:'① 逆 FFT：得到空域复场 a',factor:'② 取上图橙点 r₀，准备单位模相位因子',multiply:'③ 同点相乘：相位加 θ₀，长度不变',forward:'④ 每个像素都相乘后，对整张 b 做 FFT',score:'⑤ 频谱与 H 同坐标，再筛选、校正和评分'};
      if(caption.textContent!==label[demo.step])caption.textContent=label[demo.step];
      set(caption,'data-step',demo.step);set(parent,'data-phase-step',demo.step);
      show(inverse,1-demo.factor);show(product,demo.factor);show(times,demo.factor);show(factor,demo.factor);
      show(equals,demo.multiply);show(output,demo.multiply);
      factor.style.transform=`translateY(${-10*(1-demo.factor)}px)`;
      output.style.transform=`translateX(${12*(1-demo.multiply)}px)`;
      for(const [node,active] of [[input,demo.factor>0&&demo.multiply<1],[factor,demo.factor>0&&demo.forward===0],[output,demo.multiply>0&&demo.forward===0]])set(node,'data-emphasized',active);
      const normalize=M.ramp(progress,.43,.46);
      show(theta,1-demo.forward);show(forward,demo.forward*(1-normalize));show(corrected,normalize);
      plot.style.opacity=String(demo.factor);set(plot,'aria-hidden',demo.factor===0);
      set(before,'d',arrow(phi));set(after,'d',arrow(phi+rotation));
      set(before,'data-re',probe.a.re);set(before,'data-im',probe.a.im);
      set(after,'data-re',result.re);set(after,'data-im',result.im);set(after,'data-progress',demo.multiply);
      set(after,'data-target-re',probe.b.re);set(after,'data-target-im',probe.b.im);
      set(factor,'data-unit-re',probe.unit.re);set(factor,'data-unit-im',probe.unit.im);set(factor,'data-theta',probe.angle);
      set(plot,'data-x',probe.x);set(plot,'data-y',probe.y);
      const d=Array.from({length:25},(_,i)=>{
        const a=phi+rotation*i/24;return `${i?'L':'M'} ${88+26*Math.cos(a)} ${52-26*Math.sin(a)}`;
      }).join(' ');set(arc,'d',d);
      const value=`r₀ = (${probe.x}, ${probe.y}) · θ₀ ≡ ${probe.angle.toFixed(2)} rad（模 2π） · |a| = |b| = ${Math.hypot(probe.a.re,probe.a.im).toFixed(4)}`;
      if(numeric.textContent!==value)numeric.textContent=value;
    }};
  };
})(typeof globalThis!=='undefined'?globalThis:this);
