/* Scene-owned progress state. Data come through the observation adapter. */
(function(root) {
  'use strict';
  function create({ M, E, A, dataFor }) {
    const Scene=typeof module!=='undefined'&&module.exports?require('./storyboard.js'):root.SIMParameterUnits.refine;
    const { clamp, ramp } = M;
  function refinementNarrative(progress) {
    const p=Math.round(clamp(progress)*1e12)/1e12, mode=p<.22?'gridLimit':p<.56?'phaseRamp':p<Scene.lockStart?'zoomCascade':p<Scene.returnStart?'lockWinner':'returnSpectrum';
    const copy={
      gridLimit:{title:'整数峰只给出初值，波矢也可落在频率格之间。',copy:'粗定位只比较整数 DFT 频率格。放大整数峰周围 ±0.5 格，检查格间候选；局部拟合峰的位置来自当前观测，不预设它一定偏离整数中心。'},
      phaseRamp:{title:'空域乘线性相位斜坡，在频域计算小数格平移。',copy:'旁带先逆 FFT 回空域，乘候选 k′ 对应的线性相位斜坡，再正 FFT。读取小数位移处的复数频谱，与同移的 OTF 一起筛选可靠公共区，计算归一化分数 ρ(k′)。'},
      zoomCascade:{title:'三轮 5×5 局部细化，最终搜索步长为 0.01 格。',copy:'每轮选最高分点作为下一轮中心，把搜索范围缩小 5 倍。半宽 ±0.50 → ±0.10 → ±0.02 格，步长 0.25 → 0.05 → 0.01 格；锁定的波矢继续用于重建。'},
      lockWinner:{title:'选中这个位移，后面固定使用它。',copy:'最后一轮已经完成。突出实际胜出点，停止搜索，把候选位移记为估计波矢 k̂。'},
      returnSpectrum:{title:'位移已确定，两份公共信息还差什么？',copy:'固定使用刚才选中的波矢。它确定两路在哪里记录同一份样品信息，接下来比较这两份记录的共同幅相。'},
    };
    return {mode,...copy[mode]};
  }
  function refinementPhaseState(progress) {
    const p=Math.round(clamp(progress)*1e12)/1e12;
    const step=p<.28?'inverse':p<.30?'factor':p<.36?'multiply':p<.40?'forward':'score';
    const notes={
      inverse:'① 对照上方左图：先将未平移临时 +1 级逆 FFT，得到空域复场 a。橙点 r₀ 是接下来演示的一个实际像素。',
      factor:'② 固定同一个像素 r₀，读出单位模因子 exp(iθ₀)。θ₀ 随空间位置变化；相位斜坡不是给所有像素加同一个角度。',
      multiply:'③ 下方青色箭头是 a(r₀)，紫色箭头是乘积 b(r₀)。乘 exp(iθ₀) 只把角度加 θ₀，长度保持不变；箭头长度采用统一归一显示。',
      forward:'④ 每个像素都完成相同的逐点乘法后，对整张 b 做正 FFT，得到右侧小数位移处的频谱 B；不是只变换橙色单点。',
      score:'⑤ 仅在两边 H 可靠的公共区各除自身 H，再按两边能量归一化得到 ρ。通带外的傅里叶尾迹仅在显示中隐藏，评分数据不变。',
    };
    return {step,note:notes[step],inverse:ramp(p,.22,.28),factor:ramp(p,.28,.30),multiply:ramp(p,.30,.36),forward:ramp(p,.36,.40)};
  }
  function refinementState(lesson, progress) {
    const p=Math.round(clamp(progress)*1e12)/1e12,data=dataFor(lesson),round=p<.70?0:p<.85?1:2;
    const r=data.rounds[round],start=[.43,.735,.875][round],end=[.54,.825,.915][round];
    const local=ramp(p,start,end),count=Math.min(25,Math.floor((local+1e-12)*25));
    let candidate=count===25?r.best:count===0?(round?data.rounds[round-1].best:lesson.estimate.coarseBest):r.candidates[count-1];
    // A short actual fractional sweep makes the phase-to-frequency link
    // visible before scoring the 25 fixed candidates. Quantize the display
    // path at .01 bins to bound cached fields; no visual image interpolation.
    if(round===0&&p>=.40&&count===0) {
      const start=lesson.estimate.coarseBest,target=r.candidates[0],travel=ramp(p,.40,.43);
      candidate=data.compare(start.kx+Math.round((target.kx-start.kx)*travel*100)/100,
        start.ky+Math.round((target.ky-start.ky)*travel*100)/100);
    }
    const tail=Scene.lockState(p),transfer=p<Scene.lockStart?0:tail.cues.transfer;
    const returnView={collapse:transfer,overview:ramp(transfer,.12,.92)};
    return {...refinementNarrative(p),phaseDemo:refinementPhaseState(p),returnView,round,local,count,step:r.step,halfWidth:2*r.step,candidates:r.candidates,center:r.center,best:r.best,
      done:p>=.915,candidate,zoom:ramp(p,.025,.16),work:ramp(p,.20,.25),cascade:ramp(p,.56,.64),
      roundZoom:round?ramp(p,round===1?.70:.85,round===1?.735:.875):1,
      winner:ramp(p,end,end+.015),nextWindow:round<2?ramp(p,round===0?.64:.83,round===0?.69:.85):0,
      lock:p<Scene.lockStart?0:tail.cues.mark,lockTransfer:transfer,lockMode:p<Scene.lockStart?'search':tail.mode};
  }
  const refinementCache=new WeakMap();
  function refinementDataFor(lesson) {
    if(refinementCache.has(lesson))return refinementCache.get(lesson);
    const e=lesson.estimate,n=e.context.config.n,raw=e.context.separated.bands[1],spatial=A.spatial(raw,n),fields=new Map();
    let surface;
    const result={n,raw,spatial,fields,
      probe(kx,ky) {
        const x=Math.min(n-1,Math.floor(n/2)+Math.max(1,Math.floor(n/32))),y=Math.floor(n/2),i=y*n+x;
        const a={re:spatial.re[i],im:spatial.im[i]},theta=-2*Math.PI*(kx*x+ky*y)/n,unit={re:Math.cos(theta),im:Math.sin(theta)};
        return {x,y,a,theta,angle:Math.atan2(unit.im,unit.re),unit,b:{re:a.re*unit.re-a.im*unit.im,im:a.re*unit.im+a.im*unit.re}};
      },
      at(kx,ky) {
        const key=kx+','+ky;
        if(!fields.has(key)) {
          const modulated={re:new Float64Array(n*n),im:new Float64Array(n*n)};
          for(let y=0;y<n;y++)for(let x=0;x<n;x++) {
            const i=y*n+x,phase=-2*Math.PI*(kx*x+ky*y)/n,c=Math.cos(phase),s=Math.sin(phase);
            modulated.re[i]=spatial.re[i]*c-spatial.im[i]*s;
            modulated.im[i]=spatial.re[i]*s+spatial.im[i]*c;
          }
          fields.set(key,{kx,ky,modulated,shifted:A.spectrum(modulated.re,n,modulated.im),comparison:dataFor(lesson).compare(kx,ky)});
        }
        return fields.get(key);
      },
      surface() {
        if(!surface) {
          const side=21,halfWidth=.5,points=[];
          for(let y=0;y<side;y++)for(let x=0;x<side;x++) {
            const kx=e.coarseBest.kx+(2*x/(side-1)-1)*halfWidth,ky=e.coarseBest.ky+(2*y/(side-1)-1)*halfWidth;
            points.push(E.compare(e.context,kx,ky));
          }
          const scores=points.filter(p=>p.valid).map(p=>p.score);
          surface={side,halfWidth,points,minimum:Math.min(...scores),maximum:Math.max(...scores)};
        }
        return surface;
      }};
    refinementCache.set(lesson,result);return result;
  }
    return { refinementNarrative, refinementPhaseState, refinementState, refinementDataFor };
  }
  if(typeof module!=='undefined'&&module.exports)module.exports=create;
  else(root.SIMParameterStateFactories ||= {})['refine']=create;
})(typeof globalThis!=='undefined'?globalThis:this);
