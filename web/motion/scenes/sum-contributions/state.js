/* First show a complete multiply/add slowly, then collect the other records. */
(function(root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const scene = node ? require('./storyboard.js') : root.SIMMotionUnits['sum-contributions'];
  function create({clamp,smooth}) {
    const complex=(from,to=from,mix=0)=>({kind:'complex',from,to,mix:clamp(mix)});
    return function frame(lesson, progress, timeline = scene.timeline) {
      const s=scene.present(progress,timeline),c=s.cues,total=lesson.records.length;
      let index=0,part=0,weight=c.firstWeight,add=c.firstAdd;
      if(s.mode==='remainingBands'||s.mode==='basicResponse') {
        const position=c.remaining*(total-1);
        index=Math.min(total-1,1+Math.floor(position));
        part=position===total-1?1:position-Math.floor(position);
        weight=smooth(part*2);add=smooth(part*2-1);
      }
      const record=lesson.records[index];
      const completed=index+Number(add===1);
      return {...s,phase:'sum',index,local:part,completed,inverseProgress:0,
        views:[complex(record.band.shifted),complex(record.band.shifted,record.band.matched,weight),complex(record.before,record.after,add)],
        titles:['当前归位频带 C','加权贡献 H*C','累计频谱 F_sum'],
        detail:`${s.action} · 第 ${index+1} / ${total} 项 · 方向 ${record.band.direction+1} · ${record.band.order} 级`,
        foot:s.mode==='basicResponse'?'理想模型 F_sum=R₀S · R₀ 每带计一次 · 下一幕区分实际分母 R':`已完成 ${completed} / ${total} 项 · 先形成复数乘积，再加入累计数组`};
    };
  }
  if(node)module.exports=create;
  else(root.SIMMotionStateFactories ||= {})['sum-contributions']=create;
})(typeof globalThis !== 'undefined' ? globalThis : this);
