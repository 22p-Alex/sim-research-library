/* This scene's operation and explanatory readout use the same local progress. */
(function(root){
  'use strict';
  function create({clamp,smooth}) {
    const complex=(from,to=from,mix=0)=>({kind:'complex',from,to,mix:clamp(mix)});
    const scalar=(values,log=false)=>({kind:'scalar',values,log});
    function operation(lesson,local) { const p=lesson.pipeline;
      const band=p.bands[2]; return { phase:'match', index:2, views:[complex(band.shifted),scalar(band.h),complex(band.shifted,band.matched,smooth(local))] };
    }
    function frame(lesson,progress) {
      const local=clamp(progress),frame=operation(lesson,local);
      return {...frame,titles:["归位频带 C₁,₋₁", "共轭 OTF H*₁,₋₁", "加权贡献 H*C"],detail:"原频带已有 H；本次再乘 H*，留下 |H|²S。",inverseProgress:0};
    }
    return frame;
  }
  if(typeof module!=='undefined'&&module.exports)module.exports=create;
  else(root.SIMMotionStateFactories ||= {})['otf-weight']=create;
})(typeof globalThis!=='undefined'?globalThis:this);
