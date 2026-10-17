/* This scene's operation and explanatory readout use the same local progress. */
(function(root){
  'use strict';
  function create({clamp,smooth}) {
    const complex=(from,to=from,mix=0)=>({kind:'complex',from,to,mix:clamp(mix)});
    const scalar=(values,log=false)=>({kind:'scalar',values,log});
    function operation(lesson,local) { const p=lesson.pipeline;
      return { phase:'wiener',index:-1,views:[complex(p.numerator),scalar(lesson.reciprocal,true),complex(p.numerator,p.preApoSpectrum,smooth(local))] };
    }
    function frame(lesson,progress) {
      const local=clamp(progress),frame=operation(lesson,local);
      return {...frame,titles:["累计频谱 U", "归一化系数 1/(R + w²)", "滤波频谱 ŜW"],detail:"用累计模平方构造分母；w² 限制弱传递处的反演增益。",inverseProgress:0};
    }
    return frame;
  }
  if(typeof module!=='undefined'&&module.exports)module.exports=create;
  else(root.SIMMotionStateFactories ||= {})['wiener']=create;
})(typeof globalThis!=='undefined'?globalThis:this);
