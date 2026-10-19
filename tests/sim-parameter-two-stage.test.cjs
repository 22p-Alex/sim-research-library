const navPosition=require('./helpers/parameter-navigation.cjs').position;
/* Scientific/state checks for the production lesson. No browser or visual QA. */
const test = require('node:test'), assert = require('node:assert/strict');
const L = require('../web/parameter-demo/sim-parameter-two-stage.js');
const M = require('../web/parameter-demo/sim-parameter-model.js');
const E = require('../web/shared/sim-parameter-estimation.js');
const A = require('../web/atlas/sim-atlas-core.js');
const katex = require('../vendor/katex/katex.min.js');
const boot = require('./helpers/motion-dom.cjs');
const near = (a,b,eps=1e-9) => assert.ok(Number.isFinite(+a) && Math.abs(+a-b) <= eps*Math.max(1,Math.abs(b)), `${a} != ${b}`);
const mul = (a,b) => ({re:a.re*b.re-a.im*b.im,im:a.re*b.im+a.im*b.re});
const zOf = node => ({re:+node.attrs['data-re'],im:+node.attrs['data-im']});

test('the two stages define location before the final fairSIM getPeak pass, with valid formulas at all stops', () => {
  assert.deepEqual(L.scenes.map(s=>s.id), ['shared','line-shift','shift','otf','match','coarse','refine','least-squares-fit']);
  assert.deepEqual(L.scenes.map(s=>s.phase), [...Array(7).fill('position'),...Array(1).fill('coefficient')]);
  for(const s of L.scenes) for(const p of [0,.15,.3,.35,.5,.7,1]) {
    const state=L.stateForScene(s.id,p), formula=L.formulaAt(state);
    assert.equal(state.id,s.id); near(state.progress,p);
    assert.doesNotThrow(()=>katex.renderToString(formula.equation.slice(2,-2),{displayMode:true,throwOnError:true,strict:'error'}));
  }
  for(const formula of Object.values(L.formulas)) assert.doesNotThrow(()=>katex.renderToString(formula.slice(2,-2),{displayMode:true,throwOnError:true,strict:'error'}));
  assert.throws(()=>L.stateForScene('shift',NaN),/有限/);
  assert.match(L.formulas.coordinates,/\\mathbf k'=\(k'_x,k'_y\)/);
  assert.match(L.formulas.coordinates,/\\mathbf q\+\\mathbf k'/);
  assert.match(L.formulas.shift,/H\(\\mathbf q\+\\mathbf k'\)/);
  for (const p of [.15,.2,.3,.39,.68,.8,1]) assert.match(L.formulaAt(L.stateForScene('shift',p)).equation,/\\mathbf k'/);
  for (const p of [.4,.5,.6,.67]) {
    const source=L.formulaAt(L.stateForScene('shift',p)).equation;
    assert.match(source,/S\(\\mathbf f-\\mathbf k\)/);
    assert.doesNotMatch(source,/\\mathbf k'/,'the physical source keeps the true unknown k');
  }
  assert.match(L.formulas.subpixel,/e\^\{-\\frac\{2\\pi i\}/);
  for(const key of ['correct','match','score'])
    assert.ok(!L.formulas[key].includes(String.raw`U_{\mathbf k'}`),'the reference U at fixed q is independent of the candidate');
  assert.ok(L.formulas.correct.includes(String.raw`H^*(\mathbf q)\widetilde A_0(\mathbf q)`));
  assert.ok(L.formulas.correct.includes(String.raw`H^*(\mathbf q+\mathbf k')\widetilde A_{+1}(\mathbf q+\mathbf k')`));
  assert.ok(L.formulas.correct.includes(String.raw`|H(\mathbf q)|^2`));
  assert.ok(L.formulas.correct.includes(String.raw`|H(\mathbf q+\mathbf k')|^2`));
  assert.ok(L.formulas.coefficient.includes(String.raw`U_j=S(\mathbf q_j)`));
  assert.doesNotMatch(L.formulas.fit,/\\mathbf k'/,'the fitted-shift stage uses the documented U,V shorthand');
});

test('own complex conjugation leaves the OTF power; normalization recovers the specimen and its common coefficient', () => {
  const specimen={re:2.3,im:-1.7},alpha={re:.4,im:.65};
  for(const transfers of [[{re:.2,im:.4},{re:-.6,im:.1}],[{re:0,im:-.7},{re:.3,im:-.2}]]) {
    for(const [b,h] of transfers.entries()) {
      const target=b?mul(alpha,specimen):specimen, observed=mul(h,target);
      const {power,weighted,corrected}=E.correctOtf(observed,h);
      near(power,h.re*h.re+h.im*h.im);
      for(const component of ['re','im']) {
        near(weighted[component],power*target[component]);
        near(corrected[component],target[component]);
      }
      assert.ok(Math.hypot(weighted.re-target.re,weighted.im-target.im)>.1,'multiplication alone must not be presented as completed correction');
    }
  }
  for(const h of [{re:0,im:0},{re:Infinity,im:1},{re:1,im:NaN}])
    assert.throws(()=>E.correctOtf(specimen,h),/非零且有限/);
});

test('each candidate uses its own OTF on each band, leaving U fixed and the observations unchanged', () => {
  const capture=E.capture(), n=capture.raw.n;
  for(const group of capture.raw.groups) {
    const ctx=E.context(group,capture.config), [kx,ky]=capture.truth.vectors[group.index];
    const snapshots=ctx.separated.bands.map(z=>({re:z.re.slice(),im:z.im.slice()}));
    const actual=E.compare(ctx,kx,ky,true), other=E.compare(ctx,kx-1,ky+1,true);
    for(const [dx,dy] of [[kx,ky],[kx-1,ky+1],[kx+.25,ky-.05]]) {
      const candidate=E.compare(ctx,dx,dy,true), fractional=!Number.isInteger(dx)||!Number.isInteger(dy);
      const side=fractional?A.shift(ctx.separated.bands[1],dx,dy,n):ctx.separated.bands[1];
      for(const p of candidate.points) {
        const i=A.idx(...p.q,n), j=fractional?i:A.idx(p.q[0]+dx,p.q[1]+dy,n);
        for(const component of ['re','im']) {
          near(p.rawX[component],ctx.separated.bands[0][component][i]);
          near(p.rawY[component],side[component][j]);
          near(p.weightedX[component],p.h0*p.rawX[component]);
          near(p.weightedY[component],p.h1*p.rawY[component]);
          near(p.x[component],p.rawX[component]/p.h0);
          near(p.y[component],p.rawY[component]/p.h1);
          if(dx===kx && dy===ky)near(p.x[component],capture.truth.spectrum[component][i]);
        }
        near(p.power0,p.h0**2);near(p.power1,p.h1**2);
        assert.ok(p.h0>=ctx.config.minH && p.h1>=ctx.config.minH);
      }
    }
    const changed=actual.points.find(p=>p.energy>1e-8 && other.points.some(t=>t.q.join(',')===p.q.join(',') && Math.abs(t.h1-p.h1)>.01));
    assert.ok(changed);
    const alternative=other.points.find(p=>p.q.join(',')===changed.q.join(','));
    assert.deepEqual(alternative.rawX,changed.rawX,'the observation stays fixed');
    assert.deepEqual(alternative.x,changed.x,'the reference U at the same q remains fixed');
    assert.ok(Math.hypot(alternative.y.re-changed.y.re,alternative.y.im-changed.y.im)>1e-6,'the candidate changes the sideband value');
    assert.notDeepEqual(actual.points.map(p=>p.q),other.points.map(p=>p.q),'the candidate changes the comparison mask');
    assert.deepEqual(ctx.separated.bands,snapshots,'correction never overwrites the separated observations');
  }
  const unthresholded=E.context(capture.raw.groups[0],{...capture.config,minH:0});
  for(const p of E.compare(unthresholded,8,0,true).points) {
    assert.ok(p.h0>0 && p.h1>0,'zero transfer is excluded even if the threshold is zero');
    assert.ok([p.x.re,p.x.im,p.y.re,p.y.im].every(Number.isFinite));
  }
});


test('FFT correlation reproduces every circular shift with complex phase, sign and N squared normalization', () => {
  const n=8,size=n*n, make=()=>({re:new Float64Array(size),im:new Float64Array(size)});
  const check=(first,second)=>{
    const snapshots=[first,second].map(z=>({re:z.re.slice(),im:z.im.slice()}));
    const result=E.correlationMap(first,second,n);
    for(let ky=0;ky<n;ky++)for(let kx=0;kx<n;kx++) {
      const expected={re:0,im:0};
      for(let y=0;y<n;y++)for(let x=0;x<n;x++) {
        const i=y*n+x,j=A.idx(x+kx,y+ky,n);
        expected.re+=first.re[i]*second.re[j]+first.im[i]*second.im[j];
        expected.im+=first.re[i]*second.im[j]-first.im[i]*second.re[j];
      }
      near(result.correlation.re[ky*n+kx],expected.re,1e-10);
      near(result.correlation.im[ky*n+kx],expected.im,1e-10);
    }
    assert.deepEqual([first,second],snapshots,'FFT calculation preserves both fixed inputs');
    for(let i=0;i<size;i++) {
      const [u,v]=result.spatial;
      near(result.product.re[i],u.re[i]*v.re[i]+u.im[i]*v.im[i]);
      near(result.product.im[i],u.re[i]*v.im[i]-u.im[i]*v.re[i]);
    }
    return result;
  };
  const first=make(),second=make();first.re[A.idx(1,-2,n)]=2;first.im[A.idx(1,-2,n)]=3;
  second.re[A.idx(3,-3,n)]=-4;second.im[A.idx(3,-3,n)]=1;
  const result=check(first,second),peak=A.idx(2,-1,n);
  near(result.correlation.re[peak],-5);near(result.correlation.im[peak],14);
  near(result.correlation.re[A.idx(-2,1,n)],0);
  for(let i=0;i<size;i++){first.re[i]=Math.sin(i*.37);first.im[i]=Math.cos(i*.71);second.re[i]=Math.cos(i*.19);second.im[i]=Math.sin(i*.53);}
  check(first,second);
});

test('fixed preprocessing and FFT energy and mask maps preserve every admitted direct score in all directions', () => {
  const capture=E.capture();
  for(const group of capture.raw.groups) {
    const e=E.estimate(group,capture.config),f=e.fft,n=capture.config.n;
    assert.ok(e.ok);
    for(let y=0;y<n;y++)for(let x=0;x<n;x++) {
      const i=y*n+x,h=A.otf(A.bin(x,n),A.bin(y,n),capture.config.cutoff),keep=h>0&&h>=capture.config.minH;
      for(let b=0;b<2;b++) {
        near(f.masks[b].re[i],keep?1:0);
        for(const part of ['re','im'])near(f.inputs[b][part][i],keep?e.context.separated.bands[b][part][i]/h:0);
      }
    }
    for(const c of e.coarse.filter(c=>Math.hypot(c.kx,c.ky)>=capture.config.minRadius&&Math.hypot(c.kx,c.ky)<=capture.config.maxRadius)) {
      const direct=E.compare(e.context,c.kx,c.ky,true),fft=f.at(c.kx,c.ky);
      assert.equal(fft.count,direct.count);assert.equal(fft.valid,direct.valid);
      for(const key of ['score','xx','yy'])near(fft[key],direct[key],1e-9);
      for(const key of ['re','im'])near(fft.cross[key],direct.cross[key],1e-8);
      near(c.score,direct.score,1e-9);
    }
    near(e.kx,capture.truth.vectors[group.index][0]);near(e.ky,capture.truth.vectors[group.index][1]);
    near(e.m,capture.truth.m);near(e.phase,capture.truth.offsets[group.index]);
  }
});

test('direct scan accumulates actual prefixes before depositing scores; FFT keeps and fills the same grid in one batch', () => {
  let chapter;
  const h=boot({beforeRenderer(c){const create=c.SIMMotionParameterChapter.create;c.SIMMotionParameterChapter.create=o=>(chapter=create(o));}});
  const {context,byId,nodes}=h,flow=context.SIMMotionParameterChapter.plan(context.SIMMotion);
  const seek=(id,p)=>{byId.get('progress').value=navPosition(flow,id,p);byId.get('progress').dispatch('input');};
  const get=k=>nodes.find(n=>n.attrs[k]!==undefined),scan=get('data-direct-scan'),stamp=get('data-score-stamp'),fft=get('data-fft-pipeline');
  const cells=nodes.filter(n=>n.attrs['data-score-k']!==undefined),positions=cells.map(n=>[n.attrs.x,n.attrs.y]);
  const tracked=nodes.filter(n=>Object.keys(n.attrs).some(k=>k.startsWith('data-fft-')||k.startsWith('data-score-')||k.startsWith('data-scan-')||k==='data-direct-scan'));
  const frame=get('data-frequency-frame'),plot=get('data-frequency-plot'),pairPlot=get('data-spectrum-plot');
  const layoutFrames=new Map();
  const snapshots=new Map();
  for(const id of ['match','coarse'])for(const p of [.001,.05,.119,.17,.22,.237,.31,.45,.52,.59,.64,.72,.79,.82,.87,.91,.97,1]) {
    seek(id,p);
    assert.deepEqual(cells.map(n=>[n.attrs.x,n.attrs.y]),positions,'score coordinates never change between algorithms');
    assert.doesNotMatch(L.formulaAt(L.stateForScene(id,p)).equation,/arg\\,min|J\(|min_\\alpha|1-\\rho/);
    if(id==='match') {
      assert.equal(plot.attrs.transform,pairPlot.attrs.transform,'images and coordinates share their presentation transform');
      layoutFrames.set(p,[plot.attrs.transform,{...frame.attrs}]);
      if(p>=.12){
        const frameRight=+frame.attrs.x + +frame.attrs.width;
        const labels=scan.children.filter(n=>n.tagName==='text'&&n.attrs.display!=='none');
        labels.forEach(n=>near(n.attrs.x,850));
        assert.ok(frameRight+140<850,'the plotted spectrum leaves a separate readout column');
        assert.ok(Math.min(...cells.map(n=>+n.attrs.x))>1000,'the score grid occupies the third column');
      }
      const s=L.scanState(chapter.lesson,p),prefix=s.candidate.points.slice(0,s.count);
      near(scan.attrs['data-count'],s.count);
      near(scan.attrs['data-sum-re'],prefix.reduce((v,t)=>v+t.cross.re,0));
      near(scan.attrs['data-sum-im'],prefix.reduce((v,t)=>v+t.cross.im,0));
      if(+stamp.attrs.opacity>0)assert.equal(s.count,s.candidate.count,'finish all shared points before sending the score');
      const written=cells.filter(n=>n.attrs['data-written']==='true');
      assert.equal(written.length,s.committed.length);
    } else {
      const state=L.fftState(p);
      for(const key of ['dim','gather','inverse','multiply','forward','normalize','dock','reveal','peak'])near(fft.attrs['data-'+key],state[key]);
      const written=cells.filter(n=>n.attrs['data-written']==='true');
      if(state.gather===1&&state.reveal<1)assert.equal(written.length,0);
      if(state.reveal===1)assert.equal(written.length,chapter.lesson.estimate.coarse.filter(c=>c.valid).length);
      if(state.forward>0)near(state.multiply,1);
      if(state.multiply>0)near(state.inverse,1);
      if(state.gather>0)near(state.dim,1);
      if(state.normalize>0)near(state.forward,1);
      if(state.dock>0)near(state.normalize,1);
      if(state.reveal>0)near(state.dock,1);
    }
    snapshots.set(id+':'+p,tracked.map(n=>({...n.attrs})));
  }
  for(const [key,snapshot] of [...snapshots].reverse()) {const [id,p]=key.split(':');seek(id,+p);assert.deepEqual(tracked.map(n=>({...n.attrs})),snapshot);}
  for(const [p,saved] of [...layoutFrames].toReversed()){
    seek('match',p);assert.deepEqual([plot.attrs.transform,{...frame.attrs}],saved);
  }
  seek('coarse',1);const colors=cells.map(n=>n.attrs.fill),peak=get('data-fft-peak');
  near(peak.attrs.opacity,1);seek('refine',.001);assert.deepEqual(cells.map(n=>n.attrs.fill),colors);assert.ok(+peak.attrs.opacity>.99);
  assert.deepEqual(h.errors,[]);
});

test('FFT sweeps actual complex pixels before docking the normalized result onto the persistent score grid', () => {
  let chapter;
  const h=boot({beforeRenderer(c){const create=c.SIMMotionParameterChapter.create;c.SIMMotionParameterChapter.create=o=>(chapter=create(o));}});
  const {nodes,byId,context}=h,flow=context.SIMMotionParameterChapter.plan(context.SIMMotion);
  const seek=p=>{byId.get('progress').value=flow.index('parameters.coarse')-1+p;byId.get('progress').dispatch('input');};
  const get=key=>nodes.find(node=>node.attrs[key]!==undefined),f=chapter.lesson.estimate.fft,n=f.n;
  const cards=nodes.filter(node=>node.attrs['data-fft-input']!==undefined),product=get('data-fft-product'),prefix=get('data-fft-product-prefix');
  const cursors=nodes.filter(node=>node.attrs['data-fft-pixel-cursor']!==undefined);
  const scoreCells=nodes.filter(node=>node.attrs['data-score-k']!==undefined),resultCells=nodes.filter(node=>node.attrs['data-fft-score-k']!==undefined);
  assert.equal(nodes.some(node=>node.attrs['data-fft-merge']!==undefined||node.attrs['data-fft-forward']!==undefined),false);
  seek(.18);
  assert.equal(get('data-fft-backdrop'),undefined,'old actors fade without a rectangular cover');
  near(get('data-scan-cost').attrs.opacity,0);near(get('data-candidate-grid').attrs.opacity,0);
  near(get('data-fft-pipeline').attrs.opacity,0);
  // Every supported frequency is rendered, including the zero-order texture
  // formerly lost under DC. Zero padding remains exactly black in both cards.
  for(const image of nodes.filter(node=>node.attrs['data-fft-spectrum']!==undefined)) {
    const b=+image.attrs['data-fft-spectrum'],canvas=nodes[Number(image.attrs.href.split('fixture')[1])],brightness=[];
    for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++) {
      const i=A.idx(x-Math.floor(canvas.width/2),y-Math.floor(canvas.height/2),n),rgba=canvas.lastPixels.slice((y*canvas.width+x)*4,(y*canvas.width+x)*4+3);
      const value=Math.max(...rgba);
      if(Math.hypot(f.inputs[b].re[i],f.inputs[b].im[i])>1e-10)brightness.push(value);
      else near(value,0);
    }
    assert.equal(brightness.length,f.inputs[b].re.reduce((count,re,i)=>count+(Math.hypot(re,f.inputs[b].im[i])>1e-10?1:0),0),'the display includes the entire nonzero frequency support');
    assert.ok(brightness.length>100);brightness.sort((a,b)=>a-b);
    assert.ok(brightness[Math.floor(brightness.length/2)]>50,'the actual supported texture is visible under the DC display scale');
  }
  seek(.45);cards.forEach(card=>near(card.attrs.opacity,1));near(get('data-fft-product-image').attrs.opacity,1);
  const writes=h.work.canvas,renders=h.mathRenders,poses=cards.map(card=>card.attrs.transform);
  let previous=0;
  for(const p of [.48,.481,.51,.54,.59,.63,.679,.68]) {
    seek(p);
    const count=+prefix.attrs['data-count'];assert.ok(count>=previous);previous=count;
    assert.deepEqual(cards.map(card=>card.attrs.transform),poses,'the inputs remain in place while multiplying');
    const pieces=[...prefix.attrs.d.matchAll(/h (-?[\d.e+-]+) v (-?[\d.e+-]+) h (-?[\d.e+-]+) Z/g)];
    const area=pieces.reduce((sum,m)=>sum+Number(m[1])*Number(m[2]),0);
    near(area,200*200*count/(n*n));
    const i=Math.max(0,count-1);
    near(product.attrs['data-pixel-re'],f.product.re[i]);near(product.attrs['data-pixel-im'],f.product.im[i]);
    assert.deepEqual(cursors.map(c=>c.attrs['data-r']),Array(3).fill([i%n,Math.floor(i/n)].join(',')));
    if(count>0&&count<n*n)cursors.forEach(c=>near(c.attrs.opacity,1));
    if(count<n*n)near(get('data-fft-correlation-image').attrs.opacity,0);
  }
  assert.equal(previous,n*n);assert.equal(h.work.canvas,writes,'pixel sweeps use cached rasters');
  // Normalization preserves the actual score/color for each candidate. Once
  // docked, every preview cell occupies its original grid cell exactly.
  seek(.94);
  near(get('data-fft-result-scores').attrs.opacity,1);near(get('data-fft-correlation-image').attrs.opacity,0);
  const [tx,ty,scale]=product.attrs.transform.match(/-?[\d.]+/g).map(Number);
  const original=new Map(scoreCells.map(c=>[c.attrs['data-score-k'],c]));
  for(const cell of resultCells) {
    const target=original.get(cell.attrs['data-fft-score-k']);
    near(tx+scale*Number(cell.attrs.x),Number(target.attrs.x));near(ty+scale*Number(cell.attrs.y),Number(target.attrs.y));
    near(scale*Number(cell.attrs.width),Number(target.attrs.width));near(scale*Number(cell.attrs.height),Number(target.attrs.height));
    assert.equal(cell.attrs.fill,target.attrs.fill);
  }
  seek(.96);near(product.attrs.opacity,0);near(get('data-candidate-grid').attrs.opacity,1);
  assert.equal(get('data-candidate-grid').children.filter(c=>c.attrs['data-score-k']!==undefined).length,scoreCells.length);
  assert.equal(h.mathRenders,renders+3,'only the multiply, forward and peak formula modes compile once');
  assert.deepEqual(h.errors,[]);
});

for(const page of ['sim_motion_demo.html','sim_parameter_demo.html'])test(`${page}: repeated-scan cost motivates FFT before the spectra enter, with reversible beat narration`,()=>{
  const main=page==='sim_motion_demo.html';
  const h=boot({page,renderer:main?'web/motion/sim-motion.js':'web/parameter-demo/sim-parameter-app.js'});
  const {context,byId,nodes}=h,Study=context.SIMParameterLesson;
  const flow=main?context.SIMMotionParameterChapter.plan(context.SIMMotion):context.SIMParameterDemo.preview;
  const seek=(id,p)=>{
    const position=navPosition(flow,id,p,main);
    if(main){byId.get('progress').value=position;byId.get('progress').dispatch('input');}
    else context.SIMParameterDemo.player.seek(position);
  };
  const get=key=>nodes.find(n=>n.attrs[key]!==undefined);
  const title=byId.get(main?'scene-title':'pe-title'),copy=byId.get(main?'scene-description':'pe-copy');
  const equation=byId.get(main?'equation':'pe-equation'),note=byId.get(main?'equation-note':'pe-note');
  const heading=byId.get(main?'scene-copy':'pe-scene-copy').children.find(n=>n.attrs.class==='copy-handoff-previous');
  const cost=get('data-scan-cost'),grid=get('data-candidate-grid'),fft=get('data-fft-pipeline');
  const cards=nodes.filter(n=>n.attrs['data-fft-input']!==undefined),cells=nodes.filter(n=>n.attrs['data-score-k']!==undefined);
  seek('match',1);
  assert.match(title.textContent,/重扫/);assert.match(copy.textContent,/N².*N².*O\(N⁴\)/);
  const previousCost=[cost.attrs.opacity,cost.attrs.transform,grid.attrs.opacity,cells.map(n=>n.attrs.fill)];
  seek('coarse',.000001);
  assert.deepEqual([cost.attrs.opacity,cost.attrs.transform,grid.attrs.opacity,cells.map(n=>n.attrs.fill)],previousCost,'the completed cost and scoring map survive the scene boundary');
  const snapshot=()=>({title:title.textContent,copy:copy.textContent,note:note.textContent,
    heading:[heading.style.opacity,heading.style.transform,heading.children.map(n=>n.textContent),title.style.opacity],
    actors:[cost,grid,fft,...cards].map(n=>({...n.attrs})),formula:equation.attrs['data-formula-mode']});
  const saved=new Map();
  for(const p of [.001,.05,.099,.1001,.14,.1799,.18,.22,.2599,.26,.31,.48,.74,.97,1]){
    seek('coarse',p);
    const state=Study.stateForScene('coarse',p),presentation=Study.formulaAt(state),handoff=Study.formulaTransition(state);
    assert.equal(title.textContent,presentation.title);assert.equal(copy.textContent,presentation.copy);
    assert.equal(note.textContent,presentation.note);assert.equal(equation.attrs['data-formula-mode'],Study.formulaMode(state));
    assert.doesNotMatch([title.textContent,copy.textContent,note.textContent].join(' '),/上一幕|淡入|淡出|退场|光标|展开两张/);
    near(title.style.opacity,handoff.incoming);
    if(p<.10){
      assert.match(copy.textContent,/O\(N⁴\).*越慢/);near(cost.attrs.opacity,1);near(grid.attrs.opacity,1);near(fft.attrs.opacity,0);
      assert.match(presentation.equation,/N\^2.*N\^2.*N\^4/);
    }
    if(p===.14){
      assert.match(title.textContent,/不再逐格重扫/);assert.ok(+cost.attrs.opacity>0&&+cost.attrs.opacity<1);
      assert.ok(Number(cost.attrs.transform.match(/translate\(([-\d.]+)/)[1])<0);near(fft.attrs.opacity,0);
    }
    if(p===.22){
      assert.match(title.textContent,/预处理一次/);near(cost.attrs.opacity,0);assert.ok(+fft.attrs.opacity>0&&+fft.attrs.opacity<1);
      cards.forEach(card=>{const y=Number(card.attrs.transform.match(/translate\([\d.]+ ([-\d.]+)/)[1]);assert.ok(y>300&&y<328);});
    }
    saved.set(p,snapshot());
  }
  for(const [p,expected] of [...saved].reverse()){seek('coarse',p);assert.deepEqual(snapshot(),expected);}
  seek('coarse',1);const finalHeading=title.textContent;
  seek('refine',.0001);assert.equal(heading.children[0].textContent,finalHeading,'local refinement receives the completed FFT conclusion');
  assert.deepEqual(h.errors,[]);
});

test('matching is invariant to a common complex scale and equals minimized relative residual, not overlap area', () => {
  const capture=E.capture(), lesson=M.createLesson({raw:capture.raw,config:capture.config});
  Object.defineProperty(lesson.capture,'truth',{get(){throw new Error('The lesson read truth.');}});
  const d=L.dataFor(lesson);
  assert.equal(d,L.dataFor(lesson)); assert.equal(d.selected.length,3);
  assert.ok(d.examples[0].count>d.best.count); assert.ok(d.examples[0].score<d.best.score);
  for(const candidate of [...d.examples,d.compare(8.25,.25),d.compare(8.05,.05),d.compare(8.01,.01)]) {
    let residual=0;
    for(const p of candidate.points) {
      const prediction=mul(candidate.alpha,p.x);
      residual+=(p.y.re-prediction.re)**2+(p.y.im-prediction.im)**2;
    }
    near(residual/candidate.yy,1-candidate.score**2,1e-12);
    // Independently verify the completion of the square used in the lesson,
    // including coefficients away from the minimizer.
    for(const delta of [{re:.3,im:-.2},{re:-1,im:.7}]) {
      const alpha={re:candidate.alpha.re+delta.re,im:candidate.alpha.im+delta.im};
      const error=candidate.points.reduce((sum,p)=>{const prediction=mul(alpha,p.x);return sum+(p.y.re-prediction.re)**2+(p.y.im-prediction.im)**2;},0);
      near(error,residual+candidate.xx*(delta.re**2+delta.im**2),1e-12);
    }
    const independent=E.compare(lesson.estimate.context,candidate.kx,candidate.ky,true);
    near(candidate.score,independent.score); assert.equal(candidate.count,independent.count);
  }
  for(const p of d.selected) {
    assert.ok(d.examples.every(c=>c.points.some(t=>t.q.join(',')===p.q.join(','))));
    const prediction=mul(d.best.alpha,p.x); near(prediction.re,p.y.re); near(prediction.im,p.y.im);
  }
  const fit=L.leastSquaresState(lesson,1); near(fit.phase,lesson.estimate.phase); near(fit.m,lesson.estimate.m);
});

test('the geometric pool includes both weak paths, and q / q+k sample the same specimen coefficient in every direction', () => {
  const capture=E.capture(), n=capture.raw.n;
  for(let direction=0;direction<3;direction++) {
    const lesson=M.createLesson({raw:capture.raw,config:capture.config,direction}), d=L.dataFor(lesson), e=lesson.estimate;
    assert.deepEqual(d.support.reliable.map(p=>p.q.join(',')).sort(), Array.from(d.best.points,p=>p.q.join(',')).sort());
    assert.equal(d.support.all.length,d.support.reliable.length+d.support.rejected.length);
    assert.ok(d.support.rejected.some(p=>p.h0<capture.config.minH && p.h1>=capture.config.minH));
    assert.ok(d.support.rejected.some(p=>p.h1<capture.config.minH && p.h0>=capture.config.minH));
    const independent=[];
    for(let y=-10;y<=10;y++)for(let x=-10;x<=10;x++)if(A.otf(x,y)>0 && A.otf(x+e.kx,y+e.ky)>0)independent.push([x,y].join(','));
    assert.deepEqual(d.support.all.map(p=>p.q.join(',')).sort(),independent.sort());
    const alpha={re:capture.truth.m*Math.cos(capture.truth.offsets[direction]),im:capture.truth.m*Math.sin(capture.truth.offsets[direction])};
    for(const p of d.selected) {
      const i=A.idx(...p.q,n), j=A.idx(p.q[0]+e.kx,p.q[1]+e.ky,n), specimen={re:capture.truth.spectrum.re[i],im:capture.truth.spectrum.im[i]};
      const side=mul(alpha,specimen), bands=e.context.separated.bands;
      near(bands[0].re[i]/p.h0,specimen.re);near(bands[0].im[i]/p.h0,specimen.im);
      near(bands[1].re[j]/p.h1,side.re);near(bands[1].im[j]/p.h1,side.im);
      // Derive the arrows from the real rotation matrix and compare to the
      // independently generated sideband, including nonzero phase offsets.
      const phi=capture.truth.offsets[direction], m=capture.truth.m;
      near(p.y.re,m*(Math.cos(phi)*p.x.re-Math.sin(phi)*p.x.im));
      near(p.y.im,m*(Math.sin(phi)*p.x.re+Math.cos(phi)*p.x.im));
      near(Math.hypot(p.y.re,p.y.im),m*Math.hypot(p.x.re,p.x.im));
    }
  }
});

test('14-to-15 text and formula handoffs share the reversible playhead and preserve space beside the spectrum', () => {
  const h=boot(),{context,byId,nodes}=h,flow=context.SIMMotionParameterChapter.plan(context.SIMMotion);
  const seek=p=>{byId.get('progress').value=navPosition(flow,'otf',p);byId.get('progress').dispatch('input');};
  const get=key=>nodes.find(n=>n.attrs[key]!==undefined);
  const oldReadout=get('data-readout-outgoing'),correction=get('data-otf-normalization');
  const previousHeading=byId.get('scene-copy').children.find(n=>n.attrs.class==='copy-handoff-previous');
  const previousNote=byId.get('equation-note-slot').children.find(n=>n.attrs.class==='copy-handoff-previous');
  const snapshot=()=>[previousHeading.style.opacity,previousHeading.style.transform,previousNote.style.opacity,
    byId.get('scene-title').style.opacity,byId.get('equation-note').style.opacity,
    oldReadout.attrs.opacity,oldReadout.attrs.transform,
    byId.get('equation').children.map(n=>[n.style.opacity,n.style.transform,n.attrs['aria-hidden']])];
  const saved=new Map();
  for(const p of [.0001,.004,.008,.012,.02,.401,.406,.410,.42]) {
    seek(p);saved.set(p,snapshot());
    const state=context.SIMParameterLesson.stateForScene('otf',p),handoff=context.SIMParameterLesson.formulaTransition(state);
    const current=byId.get('equation').children[0];
    near(current.style.opacity,handoff.amount<1?handoff.incoming:1);
    assert.ok(handoff.incoming*handoff.outgoing===0,'different formulas leave before the next one enters');
    near(byId.get('equation-note').style.opacity,handoff.incoming);
    if(p<.018) {
      assert.equal(previousHeading.children[0].textContent,context.SIMParameterLesson.scene('shift').title);
      near(oldReadout.attrs.opacity,handoff.outgoing);
    }
  }
  assert.equal(correction.attrs.transform,'translate(70 0)');
  const renders=h.mathRenders;
  for(const p of [...saved.keys()].toReversed()){seek(p);assert.deepEqual(snapshot(),saved.get(p));}
  assert.equal(h.mathRenders,renders,'replay reuses both formula layers');
  h.media.matches=true;seek(.004);
  near(byId.get('scene-title').style.opacity,1);near(byId.get('equation').children[0].style.opacity,1);
  assert.equal(byId.get('equation').children.length,1,'reduced motion keeps one final formula');
  assert.deepEqual(h.errors,[]);
});

test('relocation, threshold exit and own-conjugate normalization remain ordered and reversible', () => {
  let chapter;
  const h=boot({beforeRenderer(c){const create=c.SIMMotionParameterChapter.create;c.SIMMotionParameterChapter.create=o=>(chapter=create(o));}});
  const {nodes,byId,context}=h,flow=context.SIMMotionParameterChapter.plan(context.SIMMotion),d=context.SIMParameterLesson.dataFor(chapter.lesson);
  const seek=(id,p)=>{byId.get('progress').value=navPosition(flow,id,p);byId.get('progress').dispatch('input');};
  const panels=[0,1].map(b=>nodes.find(n=>n.attrs['data-band-panel']===String(b)));
  const markers=nodes.filter(n=>n.attrs['data-corresponding-point']!==undefined);
  const images=[0,1].map(b=>nodes.find(n=>n.attrs['data-shared-band']===String(b)));
  const position=node=>{const a=node.attrs.transform.match(/-?[\d.]+/g).map(Number),b=node.parent.attrs.transform.match(/-?[\d.]+/g).map(Number);return [b[0]+a[0]*b[2],b[1]+a[1]*b[2]];};
  seek('shift',.3);assert.ok(+panels[1].attrs['data-center-x']<+panels[0].attrs['data-center-x']);
  seek('shift',.65);
  near(panels[0].attrs['data-center-x'],panels[1].attrs['data-center-x']);
  near(panels[0].attrs['data-center-y'],panels[1].attrs['data-center-y']);
  const zero=[+panels[0].attrs['data-center-x'],+panels[0].attrs['data-center-y']];
  for(const p of [.68,.73,.85,1]) {
    seek('shift',p);near(panels[0].attrs['data-center-x'],zero[0]);near(panels[0].attrs['data-center-y'],zero[1]);
    near(+panels[1].attrs['data-center-x']-zero[0],-chapter.lesson.estimate.kx*13*L.returnTo2DState(p).relocate);
  }
  for(let j=0;j<3;j++) {
    const zero=markers.find(n=>n.attrs['data-corresponding-point']===j+':0'),side=markers.find(n=>n.attrs['data-corresponding-point']===j+':1');
    position(zero).forEach((x,i)=>near(x,position(side)[i]));
    for(const [b,marker] of [zero,side].entries()) {
      const local=marker.attrs.transform.match(/-?[\d.]+/g).map(Number),img=images[b];
      near(local[0],+img.attrs.x+(+marker.attrs['data-fx']+13.5)*+img.attrs.width/27);
      near(local[1],+img.attrs.y+(+marker.attrs['data-fy']+13.5)*+img.attrs.height/27);
    }
  }
  const rejected=nodes.filter(n=>n.attrs['data-rejected-q']!==undefined),planes=nodes.filter(n=>['P','Q','R'].includes(n.attrs['data-complex-plane']));
  assert.equal(rejected.length,d.support.rejected.length);assert.equal(nodes.filter(n=>n.attrs['data-sampling-link']!==undefined).length,0);
  const fixedPositions=new Map(),snapshots=new Map(),formulaSnapshots=new Map(),textures=images.map(n=>n.attrs.href);
  const terms=nodes.filter(n=>n.attrs['data-otf-term']!==undefined);
  const term=tag=>terms.find(n=>n.attrs['data-otf-term']===tag);
  const fractionNodes=nodes.filter(n=>['data-otf-product-highlight','data-otf-fraction-line','data-otf-cancel'].some(k=>n.attrs[k]!==undefined));
  const xy=node=>node.attrs.transform.match(/-?[\d.]+/g).slice(0,2).map(Number);
  assert.equal(terms.filter(n=>n.attrs['data-otf-original-factor']!==undefined).length,2);
  assert.equal(terms.filter(n=>n.attrs['data-otf-conjugate-of']!==undefined).length,4);
  assert.equal(terms.filter(n=>n.attrs['data-otf-copy-from']!==undefined).length,0,'no factor comes from the other row');
  for(const attr of ['data-otf-magnitude','data-otf-original','data-otf-restored','data-otf-correction'])
    assert.equal(nodes.filter(n=>n.attrs[attr]!==undefined).length,0,'compensation bars are removed');
  const samples=[.001,.05,.16,.24,.32,.4,.46,.50,.54,.58,.63,.67,.70,.73,.77,.79,.83,.85,.87,.90,.93,.96,1];
  for(const p of [...samples,...samples.toReversed()]) {
    seek('otf',p);planes.forEach(n=>near(n.attrs.opacity,0));
    const snapshot=rejected.map(n=>[n.attrs.transform,n.attrs.opacity,n.attrs['data-exit-progress']]);
    if(snapshots.has(p))assert.deepEqual(snapshot,snapshots.get(p));else snapshots.set(p,snapshot);
    for(const node of rejected) {
      const xy=node.attrs.transform.match(/-?[\d.]+/g).slice(0,2);
      if(fixedPositions.has(node))assert.deepEqual(xy,fixedPositions.get(node));else fixedPositions.set(node,xy);
    }
    assert.deepEqual(images.map(n=>n.attrs.href),textures);
    if(p<.1)rejected.forEach(n=>near(n.attrs.opacity,1));
    if(p>=.4)rejected.forEach(n=>near(n.attrs.opacity,0));
    const state=L.otfState(p);
    if(p<=.46)near(state.multiply,0);
    if(p>=.58)near(state.multiply,1);
    if(p<.87)near(state.name,0);
    if(p<.94)near(state.relation,0);
    for(let b=0;b<2;b++) {
      const own=term('own:'+b),conjugate=term('conjugate:'+b),lhs=term('lhs-conjugate:'+b);
      const power=term('power:'+b),denominator=term('rhs-denominator:'+b);
      for(const node of [conjugate,lhs]) {
        assert.equal(node.attrs['data-otf-conjugate-of'],String(b));
        assert.equal(node.attrs['data-tex'],'H_'+b+'^*');
        assert.ok(Math.abs(xy(node)[1]-(270+b*118))<=45,'conjugate stays with its own row');
      }
      assert.equal(power.attrs['data-tex'],'|H_'+b+'|^2');
      for(const node of [denominator,term('lhs-denominator:'+b)])assert.equal(node.attrs['data-tex'],power.attrs['data-tex']);
      if(p<=.46) { near(own.attrs.opacity,1);near(conjugate.attrs.opacity,0);near(lhs.attrs.opacity,0); }
      if(p===.58) {
        near(xy(conjugate)[1],xy(own)[1]);near(conjugate.attrs.opacity,1);near(lhs.attrs.opacity,1);
      }
      if(p>=.67 && p<=.70) {
        near(power.attrs.opacity,1);near(own.attrs.opacity,0);near(conjugate.attrs.opacity,0);
        near(denominator.attrs.opacity,0);near(term('name:'+b).attrs.opacity,0);
      }
      if(p>=.77 && p<=.79) {
        near(power.attrs.opacity,1);near(denominator.attrs.opacity,1);
        assert.ok(xy(power)[1]<xy(denominator)[1]);
      }
      if(p===.85) {
        near(power.attrs.opacity,0);near(denominator.attrs.opacity,0);near(term('one:'+b).attrs.opacity,1);
        near(term('lhs-denominator:'+b).attrs.opacity,1);near(lhs.attrs.opacity,1);
      }
      if(p>=.93) {
        near(term('name:'+b).attrs.opacity,1);near(term('band:'+b).attrs.opacity,0);
        near(term('lhs-denominator:'+b).attrs.opacity,0);near(lhs.attrs.opacity,0);
      }
    }
    if(p===1) {
      near(term('sample:0').attrs.opacity,1);near(term('sample:1').attrs.opacity,0);
      near(term('reference').attrs.opacity,1);near(term('alpha').attrs.opacity,1);
    }
    const actorState=[...terms,...fractionNodes].map(n=>[n.attrs.transform,n.attrs.opacity,n.attrs['data-cancel-progress']]);
    if(formulaSnapshots.has(p))assert.deepEqual(actorState,formulaSnapshots.get(p));else formulaSnapshots.set(p,actorState);
  }
  seek('otf',.52);const renders=h.mathRenders;
  for(const p of [.56,.61,.65]) { seek('otf',p);assert.equal(h.mathRenders,renders,'the conjugate flight and product update persistent formula actors'); }
  assert.deepEqual(nodes.filter(n=>n.attrs['data-otf-term']!==undefined),terms);
  seek('match',.3);planes.forEach(n=>near(n.attrs.opacity,0));
  assert.deepEqual(h.errors,[]);
});

test('one q stays fixed while the formula finds q+k and only the sideband relocates by minus k', () => {
  let chapter;
  const h=boot({beforeRenderer(c){const create=c.SIMMotionParameterChapter.create;c.SIMMotionParameterChapter.create=o=>(chapter=create(o));}});
  const {context,byId,nodes}=h, flow=context.SIMMotionParameterChapter.plan(context.SIMMotion);
  const chapterModel=context.SIMMotionParameterChapter;
  const seek=p=>{byId.get('progress').value=flow.index('parameters.shared')-1+(chapterModel.sharedEntryDuration+p*L.scene('shared').duration)/chapterModel.sharedDuration;byId.get('progress').dispatch('input');};
  const markers=nodes.filter(n=>n.attrs['data-corresponding-point']!==undefined), regions=nodes.filter(n=>n.attrs['data-common-region']!==undefined);
  const position=n=>{const a=n.attrs.transform.match(/-?[\d.]+/g).map(Number),b=n.parent.attrs.transform.match(/-?[\d.]+/g).map(Number);return [b[0]+a[0]*b[2],b[1]+a[1]*b[2]];};
  const zero=markers.find(n=>n.attrs['data-corresponding-point']==='0:0'),side=markers.find(n=>n.attrs['data-corresponding-point']==='0:1');
  const pair=nodes.find(n=>n.attrs['data-frequency-pair']!==undefined),annotations=nodes.find(n=>n.attrs['data-shared-annotations']!==undefined);
  seek(.12);near(zero.attrs.opacity,1);near(side.attrs.opacity,0);
  const zeroPosition=position(zero), snapshots=new Map();
  seek(.22);
  const from=nodes.find(n=>n.attrs['data-formula-part']==='k-move-from'),to=nodes.find(n=>n.attrs['data-formula-part']==='k-move-to');
  const initial=from.style.transform;
  seek(.29); assert.notEqual(from.style.transform,initial); assert.ok(+to.style.opacity>.9);
  seek(.36);near(side.attrs.opacity,1);
  const cursor=nodes.find(n=>n.attrs['data-q-address-cursor']!==undefined),track=nodes.find(n=>n.attrs['data-q-relocation-track']!==undefined);
  for(const p of [.18,.22,.26,.30,.36,.45,.50,.54,.60,.68,.72,.78,.85,.94,1]) {
    seek(p);
    const state=L.sharedPointState(chapter.lesson,p);
    assert.equal(pair.attrs.transform,L.sharedFocusPose(1).transform);
    assert.equal(annotations.attrs.transform,pair.attrs.transform);
    near(annotations.attrs.opacity,1);
    position(zero).forEach((v,i)=>near(v,zeroPosition[i]));
    for(const [b,marker] of [zero,side].entries())position(marker).forEach((v,i)=>near(v,state.markerPositions[b][i]));
    near(cursor.attrs['data-fx'],state.cursor[0]);near(cursor.attrs['data-fy'],state.cursor[1]);
    near(track.attrs['data-motion-progress'],state.relocate);
    if(p<.78) {
      near(to.attrs['data-motion-progress'],state.derive);
      const plus=nodes.find(n=>n.attrs['data-formula-part']==='k-cancel-plus');near(plus.attrs['data-cancel-progress'],state.cancel);
    }
    snapshots.set(p,[position(zero),position(side),zero.attrs.opacity,side.attrs.opacity,cursor.attrs.transform,track.attrs.d,byId.get('equation').attrs['data-formula-mode']]);
  }
  for(const p of [...snapshots.keys()].toReversed()) {
    seek(p);assert.deepEqual([position(zero),position(side),zero.attrs.opacity,side.attrs.opacity,cursor.attrs.transform,track.attrs.d,byId.get('equation').attrs['data-formula-mode']],snapshots.get(p));
  }
  seek(.72);
  for(let j=0;j<3;j++) {
    const zero=markers.find(n=>n.attrs['data-corresponding-point']===j+':0'),side=markers.find(n=>n.attrs['data-corresponding-point']===j+':1');
    position(zero).forEach((v,i)=>near(v,position(side)[i]));
    near(zero.attrs.opacity,j===0?1:0);near(side.attrs.opacity,j===0?1:0);
  }
  const plus=nodes.find(n=>n.attrs['data-formula-part']==='k-cancel-plus');near(plus.attrs['data-cancel-progress'],1);
  seek(.94);regions.forEach(n=>near(n.attrs.opacity,1));
  seek(1);markers.forEach(n=>near(n.attrs.opacity,1));
  for(let j=0;j<3;j++) {
    const a=markers.find(n=>n.attrs['data-corresponding-point']===j+':0'),b=markers.find(n=>n.attrs['data-corresponding-point']===j+':1');
    near(+b.attrs['data-fx']-a.attrs['data-fx'],chapter.lesson.estimate.kx);
    near(+b.attrs['data-fy']-a.attrs['data-fy'],chapter.lesson.estimate.ky);
  }
  const container=h.doc.createElementNS('http://www.w3.org/2000/svg','g');
  const inline=context.SIMParameterLesson.createView(container,chapter.lesson);
  inline.drawScene('shared',0);
  assert.equal(inline.sharedPair.root.attrs.transform,pair.attrs.transform,'the standalone view uses the same focus');
  assert.equal(inline.sharedPair.panels[0].group.parent.attrs.transform,'translate(0 0) scale(1)','focus is applied only once');
  inline.destroy();
  assert.deepEqual(h.errors,[]);
});

test('the tracked q has equal physical addresses after relocation for all directions without changing complex values', () => {
  const capture=E.capture();
  for(let direction=0;direction<3;direction++) {
    const lesson=M.createLesson({raw:capture.raw,config:capture.config,direction}),saved=lesson.estimate.context.separated.bands.map(z=>[...z.re,...z.im]);
    const before=L.sharedPointState(lesson,.5),after=L.sharedPointState(lesson,.7);
    assert.deepEqual(before.centers[0],before.centers[1],'shared origins precede the physical shift');
    before.markerPositions[0].forEach((v,i)=>near(before.markerPositions[1][i]-v,before.k[i]*before.unit));
    after.markerPositions[0].forEach((v,i)=>near(v,after.markerPositions[1][i]));
    for(let i=0;i<=100;i++) {
      const s=L.sharedPointState(lesson,i/100);
      assert.deepEqual(s.centers[0],[900,375]);
      if(s.relocate>0)assert.equal(s.arrange,1);
      if(s.region>0)assert.equal(s.relocate,1);
      if(s.separate>0)assert.equal(s.region,1);
      if(s.found>0)assert.equal(s.derive,1);
    }
    assert.deepEqual(lesson.estimate.context.separated.bands.map(z=>[...z.re,...z.im]),saved);
  }
});

test('the real teaching example returns to the same two-dimensional data before relocation begins', () => {
  const h=boot(), {context,byId,nodes}=h, flow=context.SIMMotionParameterChapter.plan(context.SIMMotion);
  const seek=(id,p)=>{byId.get('progress').value=navPosition(flow,id,p);byId.get('progress').dispatch('input');};
  const real=nodes.find(n=>n.attrs['data-line-scene']==='line-shift');
  assert.equal(flow.index('parameters.line-complex'),-1);
  assert.ok(!nodes.some(n=>n.attrs['data-teaching-row']!==undefined || n.attrs['data-line-scene']==='line-complex'));
  const expected=M.createTeachingExample(), samples=[.21,.29,.39,.49,.59,.69,.79,.89,1], states=new Map();
  for(const p of [...samples,...samples.toReversed()]) {
    seek('line-shift',p);
    const candidate=+real.attrs['data-candidate'],count=+real.attrs['data-products'];
    near(real.attrs['data-partial'],expected.real[candidate].products.slice(0,count).reduce((a,b)=>a+b,0));
    const state={...real.attrs};if(states.has(p))assert.deepEqual(state,states.get(p));else states.set(p,state);
  }
  seek('line-shift',1);near(real.attrs['data-shift'],2);near(real.attrs['data-partial'],21);
  const pictures=nodes.filter(n=>n.attrs['data-shared-band']!==undefined),regions=nodes.filter(n=>n.attrs['data-common-region']!==undefined);
  const markers=nodes.filter(n=>n.attrs['data-corresponding-point']!==undefined),pair=nodes.find(n=>n.attrs['data-frequency-pair']!==undefined);
  seek('shared',1);
  const textures=pictures.map(n=>n.attrs.href),poses=pictures.map(n=>n.parent.attrs.transform);
  const frequencies=markers.map(n=>[n.attrs['data-fx'],n.attrs['data-fy']]);
  seek('shift',0);near(real.attrs.opacity,1);near(real.attrs['data-partial'],21);near(pair.attrs.opacity,0);
  seek('shift',.3);near(real.attrs.opacity,0);near(pair.attrs.opacity,1);
  assert.deepEqual(pictures.map(n=>n.parent.attrs.transform),poses,'restore the actual pair before moving it');
  regions.forEach(n=>near(n.attrs.opacity,1));markers.forEach(n=>near(n.attrs.opacity,1));
  const previous=new Map();
  for(const p of [.01,.1,.2,.3,.4,.65,.9,1,1,.9,.65,.4,.3,.2,.1,.01]) {
    seek('shift',p);
    const t=L.returnTo2DState(p);
    assert.ok(!t.relocate || t.actual===1,'the actual data arrives before relocation');
    near(real.attrs['data-partial'],21);assert.deepEqual(pictures.map(n=>n.attrs.href),textures);
    assert.deepEqual(markers.map(n=>[n.attrs['data-fx'],n.attrs['data-fy']]),frequencies,'toy shift 2 never changes the actual frequency addresses');
    const snapshot=[pair.attrs.opacity,real.attrs.opacity,pictures.map(n=>n.parent.attrs.transform),byId.get('equation').attrs['data-formula-mode']];
    if(previous.has(p))assert.deepEqual(snapshot,previous.get(p));else previous.set(p,snapshot);
  }
  seek('shared',1);near(real.attrs.opacity,0);
  assert.deepEqual(h.errors,[]);
});

test('production graphics use the shifted OTF, actual masks and values, and preserve the same points through both stages', () => {
  let chapter;
  const h=boot({beforeRenderer(ctx){const create=ctx.SIMMotionParameterChapter.create;ctx.SIMMotionParameterChapter.create=(o)=>(chapter=create(o));}});
  assert.deepEqual(h.errors,[]);
  const {nodes,byId,context}=h, flow=context.SIMMotionParameterChapter.plan(context.SIMMotion), lesson=chapter.lesson;
  const d=context.SIMParameterLesson.dataFor(lesson), e=lesson.estimate;
  const get=(attr,value)=>nodes.find(n=>value===undefined ? n.attrs[attr]!==undefined : n.attrs[attr]===value);
  const seek=(id,p=1)=>{byId.get('progress').value=navPosition(flow,id,p);byId.get('progress').dispatch('input');};
  const right=get('data-candidate-panel'), pair=get('data-frequency-pair'), map=get('data-frequency-map');
  const u=()=>['P','Q','R'].map(n=>get('data-vector-u',n)), v=()=>['P','Q','R'].map(n=>get('data-vector-v',n));
  seek('shift');
  const current=E.compare(e.context,+right.attrs['data-kx'],+right.attrs['data-ky'],true);
  const otfs=nodes.filter(n=>n.attrs['data-otf-band']!==undefined);
  const centers=otfs.map(n=>{
    const c=n.children.find(c=>c.tagName==='circle'), transform=n.parent.attrs.transform.match(/-?[\d.]+/g).map(Number);
    return [+c.attrs.cx*transform[2]+transform[0],+c.attrs.cy*transform[2]+transform[1]];
  });
  near(centers[1][0]-centers[0][0],-current.kx*13); near(centers[1][1]-centers[0][1],-current.ky*13);
  const imageURLs=nodes.filter(n=>n.attrs['data-shared-band']!==undefined).map(n=>n.attrs.href);
  seek('otf',.25);
  d.selected.forEach((p,i)=>{
    const actual=current.points.find(t=>t.q.join(',')===p.q.join(','));
    near(zOf(u()[i]).re,actual.rawX.re); near(zOf(v()[i]).im,actual.rawY.im);
  });
  seek('otf',.68);
  d.selected.forEach((p,i)=>{
    const actual=current.points.find(t=>t.q.join(',')===p.q.join(','));
    near(zOf(u()[i]).re,actual.weightedX.re); near(zOf(v()[i]).im,actual.weightedY.im);
  });
  seek('otf');
  d.selected.forEach((p,i)=>{
    const actual=current.points.find(t=>t.q.join(',')===p.q.join(','));
    near(zOf(u()[i]).re,actual.x.re); near(zOf(v()[i]).im,actual.y.im);
  });
  const mask=get('data-overlap-mask');
  const activeMask=()=>mask.children.filter(n=>+n.attrs.opacity>0).map(n=>n.attrs['data-q']).sort();
  assert.deepEqual(activeMask(),current.points.map(p=>p.q.join(',')).sort());
  for(const id of ['match','coarse','refine'])for(const p of [.31,.53,.79,1]) {
    seek(id,p);
    const c=E.compare(e.context,+right.attrs['data-kx'],+right.attrs['data-ky'],true);
    near(right.attrs['data-score'],c.score); near(right.attrs['data-count'],c.count);
    assert.deepEqual(activeMask(),c.points.map(p=>p.q.join(',')).sort());
  }
  // The correction illustration holds the same candidate until it exits;
  // only then can the map and values switch to the actual candidate search.
  seek('otf',1);
  const prepared=[right.attrs['data-kx'],right.attrs['data-ky'],right.attrs['data-score'],activeMask()];
  const preparedTerms=nodes.filter(n=>n.attrs['data-otf-term']!==undefined).map(n=>[n.attrs.transform,n.attrs.opacity]);
  for(const p of [.001,.05,.119]) {
    seek('match',p);
    assert.deepEqual([right.attrs['data-kx'],right.attrs['data-ky'],right.attrs['data-score'],activeMask()],prepared);
    assert.deepEqual(nodes.filter(n=>n.attrs['data-otf-term']!==undefined).map(n=>[n.attrs.transform,n.attrs.opacity]),preparedTerms);
    assert.equal(byId.get('equation').attrs['data-formula-mode'],'match-prepare');
  }
  // Zero phase is reported as observed; the known ramp does not invent a
  // trial common phase. Final accumulation uses a separate source-faithful pass.
  near(e.phase,0); seek('least-squares-fit',.32);
  assert.equal(context.SIMParameterLesson.leastSquaresState(lesson,.32).phase,null);
  const fitting=get('data-get-peak'), ratio=get('data-study-ratio'), peak=e.finalPeak;
  for(const progress of [.62,.70,.75,.79,.84,.87,1]) {
    seek('least-squares-fit',progress);
    const count=+fitting.attrs['data-count'], sum=peak.sums[count];
    near(fitting.attrs['data-sum-re'],sum.re); near(fitting.attrs['data-sum-im'],sum.im); near(fitting.attrs['data-energy'],sum.energy);
    if(+fitting.attrs['data-divide']>0)assert.equal(count,peak.count);
  }
  assert.deepEqual(nodes.filter(n=>n.attrs['data-shared-band']!==undefined).map(n=>n.attrs.href),imageURLs);
  near(zOf(ratio).re,peak.alpha.re);near(zOf(ratio).im,peak.alpha.im);
  assert.equal(get('data-fit-cloud'),undefined);
  assert.equal(get('data-fit-parameter','m').attrs['data-value'],String(e.m));
  assert.equal(get('data-fit-parameter','phase').attrs['data-value'],String(e.phase));
  assert.equal(get('data-illumination-preview'),undefined,'the stripe preview is removed');
  // The shortened illumination bridge hides the spectra. The next estimation
  // scene restores their full scale when they become visible again.
  byId.get('progress').value=flow.index('provisional-split');byId.get('progress').dispatch('input');
  near(byId.get('frequency-handoff-stage').style.opacity,0);
  seek('shared',.001);
  assert.equal(pair.attrs.transform,'translate(0 0) scale(1)');
  for(const n of nodes.filter(n=>n.attrs['data-shared-band']!==undefined))near(n.attrs.opacity,1);
});

test('every meaningful intermediate state is reversible and formula terms use the same playhead', () => {
  const h=boot(), {context,byId,nodes}=h, flow=context.SIMMotionParameterChapter.plan(context.SIMMotion);
  const seek=(id,p)=>{byId.get('progress').value=navPosition(flow,id,p);byId.get('progress').dispatch('input');};
  const tracked=nodes.filter(n=>['data-frequency-map','data-frequency-pair','data-candidate-panel','data-vector-u','data-vector-v','data-vector-prediction','data-vector-product','data-fitting','data-study-ratio','data-rejected-q','data-otf-term','data-otf-product-highlight','data-otf-fraction-line','data-otf-cancel','data-otf-normalization'].some(k=>n.attrs[k]!==undefined));
  const snapshots=new Map(), positions=L.scenes.flatMap(s=>[.001,.19,.34,.52,.76,1].map(p=>[s.id,p]));
  for(const [id,p] of [...positions,...positions.toReversed()]) {
    seek(id,p); const key=id+':'+p;
    const state=tracked.map(n=>Object.fromEntries(Object.entries(n.attrs).filter(([k])=>k==='d'||k==='opacity'||k==='transform'||k.startsWith('data-'))));
    if(snapshots.has(key))assert.deepEqual(state,snapshots.get(key));else snapshots.set(key,state);
  }
  seek('get-peak-sum',.4);const formula=byId.get('equation').children[0], count=h.mathRenders;
  seek('get-peak-sum',.7);assert.equal(byId.get('equation').children[0],formula);assert.equal(h.mathRenders,count);
  assert.equal(byId.get('equation').attrs['data-formula-mode'],'least-squares-fit-finalSum');
  h.windowEvents.pagehide.forEach(f=>f());assert.equal(byId.get('parameter-stage').children.length,0);assert.equal(byId.get('frequency-handoff-stage').children.length,0);
});
