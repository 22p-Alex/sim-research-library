/* This scene's operation and explanatory readout use the same local progress. */
(function(root){
  'use strict';
  function create({clamp,smooth}) {
    const complex=(from,to=from,mix=0)=>({kind:'complex',from,to,mix:clamp(mix)});
    const scalar=(values,log=false)=>({kind:'scalar',values,log});
    function operation(lesson,local) { const p=lesson.pipeline;
      const position=local*lesson.records.length,index=Math.min(lesson.records.length-1,Math.floor(position)); const part=local===1?1:position-index,record=lesson.records[index]; return { phase:'sum',index,local:part,views:[complex(record.band.shifted),complex(record.band.shifted,record.band.matched,smooth(part*2)),complex(record.before,record.after,smooth(part*2-1))] };
    }
    function frame(lesson,progress) {
      const local=clamp(progress),frame=operation(lesson,local);
      return {...frame,titles:["当前归位频带 C", "乘 OTF 后 H*C", "累计频谱 U"],detail:`第 ${frame.index + 1} / 9 项 · 方向 ${Math.floor(frame.index / 3) + 1} · ${['0', '+1', '−1'][frame.index % 3]} 级 · ${frame.local < .5 ? '乘共轭 OTF' : '加入累计结果'}`,inverseProgress:0};
    }
    return frame;
  }
  if(typeof module!=='undefined'&&module.exports)module.exports=create;
  else(root.SIMMotionStateFactories ||= {})['sum-contributions']=create;
})(typeof globalThis!=='undefined'?globalThis:this);
