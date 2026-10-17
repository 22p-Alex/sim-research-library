/* This scene's operation and explanatory readout use the same local progress. */
(function(root){
  'use strict';
  function create({clamp,smooth}) {
    const complex=(from,to=from,mix=0)=>({kind:'complex',from,to,mix:clamp(mix)});
    const scalar=(values,log=false)=>({kind:'scalar',values,log});
    function operation(lesson,local) { const p=lesson.pipeline;
      return { phase:'inverse',index:-1,views:[complex(p.spectrum),scalar(p.apodization),complex(p.spectrum)] };
    }
    function frame(lesson,progress) {
      const local=clamp(progress),frame=operation(lesson,local);
      return {...frame,titles:["最终复数频谱 Ŝ", "", "SIM 重建图像"],detail:"逆变换使用完整复数数组，显示图的对数亮度不参与运算。",inverseProgress:smooth(local)};
    }
    return frame;
  }
  if(typeof module!=='undefined'&&module.exports)module.exports=create;
  else(root.SIMMotionStateFactories ||= {})['inverse-fft']=create;
})(typeof globalThis!=='undefined'?globalThis:this);
