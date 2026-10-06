/* Guided, single-input experiments over the existing acquisition/reconstruction.
 * A is an immutable result snapshot. B always follows the visible controls.
 * Reconstruction comparisons retain the exact same raw object and pixel arrays.
 */
(function(){
  'use strict';
  const $=id=>document.getElementById(id),C=window.SIMCore,D=window.SIMDemo;
  const base={wAp:13,wAm:.9,wAbalance:1,wAillumBg:0,
    wAcounts:3,wAbg:0,wAnoise:0,wAshot:false,wAreconMode:'known',wAerrScope:'both',
    wAangle:0,wAphase:0,wAmerr:0,wAotf:0,wAepsr:.02};
  /* 11 项对照按「误差来源与认知目的」分四组：讲课时按组推进，
     自学时先读组说明再逐项拖动。groupMeta.teaching 直接用作讲解词。 */
  const groupMeta={
    signal:{title:'信号不足',hint:'信号变弱：三种降低信噪比的途径，破坏方式不同',
      teaching:'计数降低、读出噪声增加和光子型背景升高，都会降低信噪比并影响调制度估计。正确扣除背景均值后，背景的散粒噪声仍会留下。'},
    contrast:{title:'对比度不足',hint:'条纹变淡：调制度是量测出来的，不是设定出来的',
      teaching:'调制度 m 决定照明一级频带的强度，也影响解调归一化与噪声放大。本页可比较已知真值与原始帧估计，或观察非调制照明如何稀释条纹对比度。'},
    calib:{title:'校准错误',hint:'几何与频率失配：增加光子不会自动纠正错误参数',
      teaching:'相位原点、角度、调制度和 OTF 截止的采用值若有系统偏差，仅增加光子数不会修正它们。本组保持原始帧不变，逐一检查错误参数对重建的影响。'},
    recon:{title:'重建侧',hint:'正则化权衡与背景均值扣除验证',
      teaching:'正则化对照复用同一批原始帧，观察平滑与细节的取舍；背景扣除验证会改变原始帧的常量背景，并在关闭噪声时检查扣均值后的重建是否一致。'}
  };
  const groupOf={estimate:'contrast',
    counts:'signal',read:'signal',background:'signal',illumination:'contrast',
    phase:'calib',angle:'calib',modulation:'calib',otf:'calib',
    regularization:'recon',background_mean:'recon'};

  const experiments=[
    {id:'estimate',name:'1 · 调制度：真值输入与数据估计',a:{wAcounts:2,wAm:.4,wAshot:true,wAnoise:2},b:{wAreconMode:'estimated'},
      aLabel:'同一批 raw，使用调制度真值',bLabel:'同一批 raw，使用估计调制度',
      guide:'只切换调制度来源；其他校准量仍完全已知。比较采用的 m、RMSE 与细条纹。真值输入也不能消除噪声和有限带宽误差；单次噪声下 RMSE 不保证严格排序。'},
    {id:'counts',name:'2 · 信号计数：Q = 10000 → 100',a:{wAcounts:4,wAshot:true,wAnoise:2},b:{wAcounts:2},
      aLabel:'高计数：Q = 10000 e⁻',bLabel:'低计数：Q = 100 e⁻',
      guide:'只降低信号计数尺度 Q，照明调制度不变。已知 m 用于隔离采集噪声的影响。观察低计数下条纹与噪声；Q 不是画面实际平均计数，更不是总光子数。'},
    {id:'read',name:'3 · 读出噪声：σr = 0 → 10 e⁻',a:{wAcounts:2,wAshot:true},b:{wAnoise:10},
      aLabel:'仅散粒噪声，σr = 0',bLabel:'增加读出噪声，σr = 10 e⁻',
      guide:'只增加读出噪声标准差；光路、信号计数尺度和背景不变。Poisson 噪声在两边均开启。看 B 的细条纹是否被噪声淹没，并核对 RMSE。'},
    {id:'illumination',name:'4 · 非调制照明：Iu = 0 → 0.3',a:{wAshot:true,wAnoise:2},b:{wAillumBg:.3},
      aLabel:'无非调制照明，Iu = 0',bLabel:'加入非调制照明，Iu = 0.3',
      guide:'只增加激发样品的非调制光。总计数上升，调制度由 0.900 降至约 0.692；绝对条纹调制幅度不变。平均照明已正确归一化，重建不应仅因输入变亮就被判为更好。'},
    {id:'background',name:'5 · 检测背景：B = 0 → 50 e⁻',a:{wAcounts:2,wAshot:true,wAnoise:2},b:{wAbg:50},
      aLabel:'无检测背景，B = 0',bLabel:'检测背景 B = 50 e⁻/像素/帧',
      guide:'只增加检测端的光子型背景，照明调制度保持 0.900。两边都减去正确背景均值，B 的散粒噪声仍会留下。再做“验证背景扣除”无噪声对照，可单独验证背景均值是否正确扣除。'},
    {id:'phase',name:'7 · 公共相位失配：0 → π/6',a:{},b:{wAphase:2},
      aLabel:'无噪声，采用正确相位',bLabel:'同一 raw，重建相位统一偏移 π/6',
      guide:'保持 raw 和 m 不变，只给重建相位加 π/6。三个相位间隔没有改变，但一级频带的复相位错误。它不是逐帧相位抖动；上方实际采集相位与重建同时平移时则是另一个实验。'},
    {id:'angle',name:'8 · 角度失配：0° → 3°',a:{},b:{wAangle:3},
      aLabel:'无噪声，采用正确角度',bLabel:'同一 raw，各方向采用角度 +3°',
      guide:'只给重建载频方向统一加 3°，频带被搬到错误位置。raw 不变，比较条纹错位与 RMSE。下方支持域仍按真实已校准载频绘制，不能用它判断错误搬移后的保真度。'},
    {id:'modulation',name:'9 · 调制度失配：0 → −30%',a:{},b:{wAmerr:-30},
      aLabel:'无噪声，采用 m = 0.900',bLabel:'同一 raw，采用 m = 0.630',
      guide:'只把重建采用的调制度乘以 0.7，照明实际 m 仍为 0.900。它影响一级频带的幅度归一化和融合权重；不要把该滑块当作改变真实照明。'},
    {id:'otf',name:'10 · OTF 截止失配：0 → +20%',a:{},b:{wAotf:20},
      aLabel:'无噪声，采用正确圆瞳 OTF',bLabel:'同一 raw，假设检测截止高 20%',
      guide:'只把重建模型的检测截止频率乘以 1.2。真实检测带宽不变，不会凭空增加可测信息。此实验只检查圆瞳 OTF 的尺度误差，不代表球差、离焦等完整像差。'},
    {id:'regularization',name:'11 · 正则化：ε = 0.005 → 0.1',a:{wAcounts:2,wAshot:true,wAnoise:2,wAepsr:.005},b:{wAepsr:.1},
      aLabel:'同一批低计数 raw，ε = 0.005',bLabel:'同一批低计数 raw，ε = 0.1',
      guide:'只增加正则强度，真实采集与采用的 m 均不变。比较噪声抑制与细条纹损失。更平滑、RMSE 更小都不自动意味着分辨率更高。'},
    {id:'background_mean',name:'12 · 验证背景扣除：关闭全部噪声',a:{wAcounts:2},b:{wAbg:50},
      aLabel:'无噪声，B = 0',bLabel:'无噪声，B = 50 e⁻/像素/帧',
      guide:'只改变常量检测背景；Poisson 和读出噪声都关闭。原始帧变亮，但正确扣背景后 A / B 重建应在数值精度内相同。与“检测背景”对照：扣均值不等于去掉背景散粒噪声。'},
  ];
  let reference=null,active=null,busy=false;
  const labels={wAp:'标称周期',wAm:'相干偏振系数 v',wAnoise:'读出噪声 σr',wAepsr:'正则 ε',wAbalance:'入射功率比',wAillumBg:'非调制照明 Iu',wAcounts:'计数尺度 Q',wAbg:'检测背景 B',wAangle:'重建角度偏差',wAphase:'公共相位偏差',wAmerr:'采用 m 相对偏差',wAotf:'检测截止估计偏差',wAreconMode:'调制度来源',wAerrScope:'失配作用范围',wAshot:'Poisson 噪声',seed:'噪声种子',directions:'采集方向开关',phases:'采集相位开关'};
  for(let i=1;i<=3;i++){labels['wAang'+i]='采集方向 '+i;labels['wAphi'+i]='采集相位 '+i;}
  function settings(){
    const x={};
    for(const id of Object.keys(labels))if($(id)){const el=$(id);x[id]=el.type==='checkbox'?el.checked:el.value;}
    x.seed=D.latest.params.seed;x.directions=D.latest.params.directionOn.map(Number).join('/');x.phases=D.latest.params.phaseOn.map(Number).join('/');return x;
  }
  function settingText(id,v){
    if(id==='wAcounts')return Math.round(10**Number(v))+' e⁻';
    if(id==='wAreconMode')return v==='known'?'真值对照':'数据估计';
    if(id==='wAerrScope')return v==='recon'?'仅重建失配':'估计器同时失配';
    if(id==='wAshot')return v?'开':'关';
    if(id==='wAphase'||/^wAphi\d$/.test(id))return Number(v)===0?'0':`${v}π/12`;
    if(id==='wAangle'||/^wAang\d$/.test(id))return v+'°';
    if(id==='wAmerr'||id==='wAotf')return v+'%';
    return String(v);
  }
  function snapshot(){
    const l=D.latest,mode=$('wAreconMode').value,chosen=mode==='known'?l.known:l.estimated;
    const frames=l.data.groups.flatMap(g=>g.frames),Q=l.params.electrons,B=l.params.background;
    const count=frames.length?frames.reduce((s,f)=>s+f.pixels.reduce((v,x)=>v+x*Q-B,0),0)/(frames.length*l.data.n**2):null;
    return {settings:settings(),params:l.params,raw:l.data,mode,truth:l.truth.map(t=>({index:t.index,m:t.m,mean:t.mean,period:t.period})),
      pixels:l.result.pixels?.slice()||null,reason:l.result.reason,used:{...chosen.modulations},
      rmse:l.result.ok?C.rmse(l.result.pixels,C.makeSample(l.data.n)):null,count,
      reliable:l.estimated.estimates.filter(e=>e.ok).length,estimateCount:l.estimated.estimates.length};
  }
  function draw(id,pixels,max=1){
    const cv=$(id),ctx=cv.getContext('2d');
    if(!pixels){ctx.fillStyle='#101827';ctx.fillRect(0,0,cv.width,cv.height);ctx.fillStyle='#94a3b8';ctx.font='12px sans-serif';ctx.textAlign='center';ctx.fillText('无可用结果',cv.width/2,cv.height/2);return;}
    const out=ctx.createImageData(cv.width,cv.height);
    for(let i=0;i<pixels.length;i++){const v=Math.round(255*Math.max(0,Math.min(1,pixels[i]/max)));out.data.set([v,v,v,255],4*i);}
    ctx.putImageData(out,0,0);
  }
  const text=(id,value)=>{$(id).textContent=value;};
  const f=x=>x==null?'—':x.toFixed(4);
  /* 指标明细改为分层结构：RMSE 独占一行作视觉焦点，真值/采用 m 拆三列对齐
     （差异 >5% 时高亮该方向），次要信息合并成一行中点分隔。
     目的是让"估计器准不准"这一对比一眼可见——原先两行 m 值同权重平铺，看不出差别。 */
  const METRIC_MISMATCH=0.05;
  function metrics(id,s){
    const clipped=s.pixels?100*s.pixels.filter(x=>x<0||x>1).length/s.pixels.length:null;
    const root=$(id);
    root.replaceChildren();
    root.classList.add('metric-stack');

    const head=document.createElement('div');head.className='metric-head';
    const hl=document.createElement('span');hl.className='metric-head-label';hl.textContent='RMSE';
    const hv=document.createElement('span');hv.className='metric-head-value';hv.textContent=f(s.rmse);
    head.append(hl,hv);

    const table=document.createElement('div');table.className='metric-m-table';
    const headRow=document.createElement('div');headRow.className='metric-m-row metric-m-head';
    headRow.append(el('span','metric-m-label',''));
    for(const i of[1,2,3])headRow.append(el('span','metric-m-cell','方向 '+i));
    table.append(headRow);

    const rows=[
      ['真值 m',s.truth,t=>t.m,'truth'],
      ['采用 m',s.used,null,'used'],
    ];
    for(const [label,src,get,kind] of rows){
      const row=document.createElement('div');row.className='metric-m-row metric-m-'+kind;
      row.append(el('span','metric-m-label',label));
      for(let i=0;i<3;i++){
        let txt='—',diff=false;
        if(kind==='truth'){
          const t=src.find(t=>t.index===i);txt=t?t.m.toFixed(3):'—';
        }else{
          txt=src[i]===undefined?'—':src[i].toFixed(3);
          const t=s.truth.find(t=>t.index===i);
          // 只有"采用"侧且真值可得时才判断偏差，避免真值缺失时误标
          if(t&&src[i]!==undefined&&Math.abs(src[i]-t.m)>METRIC_MISMATCH*Math.max(Math.abs(t.m),1e-6))diff=true;
        }
        row.append(el('span','metric-m-cell'+(diff?' is-off':''),txt));
      }
      table.append(row);
    }

    const foot=document.createElement('div');foot.className='metric-foot';
    const bits=[
      ['信号',s.count==null?'—':s.count.toFixed(0)+' e⁻'],
      ['m 估计',s.reliable+'/'+s.estimateCount],
      ['截断',clipped==null?'—':clipped.toFixed(1)+'%'],
      ['来源',s.mode==='known'?'真值':'估计'],
    ];
    for(const [k,v] of bits)foot.append(el('span','metric-foot-item',k+' '+v));

    root.append(head,table,foot);
  }
  function el(tag,cls,txt){const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e;}
  function render(){
    if(busy)return;
    $('wApairResults').hidden=!reference;$('wAclearA').disabled=!reference;
    if(!reference){text('wApairRelation','');return;}
    const b=snapshot(),a=reference;
    const changes=Object.keys(labels).filter(id=>a.settings[id]!==b.settings[id]);
    const sameRaw=a.raw===b.raw,sameAcquisition=JSON.stringify(a.params)===JSON.stringify(b.params),unchanged=changes.length===0;
    text('wApairRelation',sameRaw?'同一批 raw：A / B 复用完全相同的原始帧与噪声实现。':
      sameAcquisition?'相同采集设置与种子：raw 已重新计算，数值可复现；这不是一次新的独立噪声测量。':
      a.params.seed===b.params.seed?'不同采集：A / B 改变了采集条件；保留同一随机种子以便复现，不能据此认定噪声实现相同。':'不同采集：B 的采集条件或噪声种子已改变。');
    text('wApairChanges',unchanged?'当前 B 与 A 的设置相同。可只改下方一个参数。':`相对 A 改变了 ${changes.length} 项：`+changes.map(id=>`${labels[id]} ${settingText(id,a.settings[id])} → ${settingText(id,b.settings[id])}`).join('；'));
    text('wApairALabel',a.label||'保存时的控制台结果');
    const matchesPreset=active&&Object.entries(active.b).every(([id,v])=>String(b.settings[id])===String(v))&&changes.length===1;
    text('wApairBLabel',matchesPreset?active.bLabel:'实时结果 · 设置差异见上方');
    draw('wApairA',a.pixels);draw('wApairB',b.pixels);metrics('wApairAMetrics',a);metrics('wApairBMetrics',b);
    text('wApairARmse',f(a.rmse));text('wApairBRmse',f(b.rmse));
    if(a.pixels&&b.pixels){
      draw('wApairDiff',Float64Array.from(b.pixels,(v,i)=>Math.abs(v-a.pixels[i])),.25);
      const delta=b.rmse-a.rmse;
      text('wApairDelta',`ΔRMSE ${delta>0?'+':''}${delta.toFixed(4)} · ${Math.abs(delta)<1e-8?'整体误差相同':delta>0?'B 的误差较大':'B 的误差较小'}`);
    }else{draw('wApairDiff',null);text('wApairDelta','至少一边没有可用重建；先检查相位秩、采集开关或激发是否被阻断。');}
  }
  function assign(values){for(const [id,v] of Object.entries(values)){const el=$(id);if(el.type==='checkbox')el.checked=v;else el.value=v;}}
  function clear(){reference=null;active=null;showGroupHint($('wAexperiment').value);render();}
  function load(id){
    const e=experiments.find(x=>x.id===id);if(!e)return;
    busy=true;
    try{
      D.resetTab2();assign({...base,...e.a});D.updateReconstruction();reference=snapshot();reference.label=e.aLabel;
      assign(e.b);D.updateReconstruction();active=e;sel.value=id;text('wApairGuide',e.guide);showGroupHint(e.id);
    }finally{busy=false;}
    render();
  }
  /* 下拉框按四组 optgroup 组织：讲课可按组推进，自学可先读组内说明。
     原name 前缀序号（"3 · "）已由组内顺序体现，故去掉避免与组号重复。 */
  const sel=$('wAexperiment');
  const byGroup={signal:[],contrast:[],calib:[],recon:[]};
  for(const e of experiments){const g=groupOf[e.id]||'signal';byGroup[g].push(e);}
  for(const [g,items] of Object.entries(byGroup)){
    if(!items.length)continue;
    const og=document.createElement('optgroup');
    og.label=groupMeta[g].title+' · '+groupMeta[g].hint;
    for(const e of items){
      const opt=new Option(e.name.replace(/^\d+\s*·\s*/,''),e.id);
      og.append(opt);
    }
    sel.append(og);
  }
  function showGroupHint(id){
    const e=experiments.find(x=>x.id===id);if(!e)return;
    const g=groupMeta[groupOf[e.id]];
    text('wAgroupHint',g.teaching);
  }
  showGroupHint(sel.value||experiments[0].id);
  sel.addEventListener('change',()=>{showGroupHint(sel.value);
    const e=experiments.find(x=>x.id===sel.value);
    text('wApairGuide',e.guide+' 点击“载入对照”后生效。');});
  text('wApairGuide',experiments.find(e=>e.id===sel.value).guide);
  $('wAloadPair').addEventListener('click',()=>load(sel.value));
  $('wAsaveA').addEventListener('click',()=>{reference=snapshot();active=null;text('wApairGuide','已保存当前结果为 A。只改变一个采集或重建参数；上方会列出全部差异，并提示是否复用同一批 raw。');render();});
  $('wAclearA').addEventListener('click',clear);
  for(const id of ['t2_reset','wAideal'])$(id).addEventListener('click',clear);
  document.addEventListener('sim-updated',render);
  window.SIMComparisons={experiments,load,clear,get reference(){return reference;}};
  if(location.hash==='#compare'){D.switchTab(2);requestAnimationFrame(()=>$('compare').scrollIntoView({block:'start'}));}
})();
