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
      return {...frame,titles:["滤波频谱 ŜW", "切趾窗 Papo", "最终频谱 Ŝ"],detail:"每个频率乘以切趾窗的对应值。",inverseProgress:0};
    }
    return frame;
  }
  if(typeof module!=='undefined'&&module.exports)module.exports=create;
  else(root.SIMMotionStateFactories ||= {})['apodization']=create;
})(typeof globalThis!=='undefined'?globalThis:this);
