/* This scene's operation and explanatory readout use the same local progress. */
(function(root){
  'use strict';
  function create({clamp,smooth}) {
    const complex=(from,to=from,mix=0)=>({kind:'complex',from,to,mix:clamp(mix)});
    const scalar=(values,log=false)=>({kind:'scalar',values,log});
    function operation(lesson,local) { const p=lesson.pipeline;
      return { phase:'apodization',index:-1,views:[complex(p.preApoSpectrum),scalar(p.apodization),complex(p.preApoSpectrum,p.spectrum,smooth(local))] };
    }
    function frame(lesson,progress) {
      const local=clamp(progress),frame=operation(lesson,local);
      const a=lesson.audit;
      return {...frame,titles:["滤波频谱 ŜW", "切趾窗 Papo", "最终频谱 Ŝ"],detail:"平滑频谱边缘减少截断振铃，也会损失高频幅度。",inverseProgress:0,
        foot:`q=(14,0)：${(100*a.preApoTransfer).toFixed(2)}% × ${a.window.toFixed(4)} → ${(100*a.finalTransfer).toFixed(2)}% · 数值来自实际传递数组`};
    }
    return frame;
  }
  if(typeof module!=='undefined'&&module.exports)module.exports=create;
  else(root.SIMMotionStateFactories ||= {})['apodization']=create;
})(typeof globalThis!=='undefined'?globalThis:this);
