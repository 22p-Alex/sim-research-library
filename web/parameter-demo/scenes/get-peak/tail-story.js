/* A–D of the approved product-to-weight manuscript. Seconds below are local
 * teaching coordinates; duration edits preserve all normalized operations. */
(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const Clock=node?require('../../../shared/animation/beat-clock.js'):root.SIMBeatClock;
  const prefix=12.8*.966,durations={finalProduct:prefix+32,finalSum:40,finalDivide:36,finalRead:24};
  const f=tex=>({parts:[{key:'main',tex}],join:'',emphasis:[{at:0,parts:['main']}]});
  const shots={
    finalProduct:[
      ['A1',0,'乘积里还剩下什么？','刚才算出了乘积；接下来看看，它为什么能告诉我们照明参数。',String.raw`z(\mathbf r)=u^*(\mathbf r)v_{\widehat{\mathbf k}}(\mathbf r),\quad e(\mathbf r)=|u(\mathbf r)|^2`],
      ['A2',4,'展开同一点的长度和相角。','每个位置有自己的方向；旁带在它的基础上，多了同一个伸缩和转角。',String.raw`u=a e^{i\psi},\quad v_{\widehat{\mathbf k}}=m a e^{i\psi}e^{i\phi_\Delta}`],
      ['A3',10,'相反的参考相角抵消。','相反的参考相角抵消，乘积的方向只留下共同相位。',String.raw`z=(a e^{-i\psi})(m a e^{i\psi}e^{i\phi_\Delta})=m a^2e^{i\phi_\Delta}`],
      ['A4',18,'还剩下每个位置的参考能量。','共同相位已经留下，但乘积长度里，还乘着这个位置的参考能量。',String.raw`z(\mathbf r)=\alpha a_{\mathbf r}^2=\alpha e(\mathbf r)`],
      ['A5',24,'换位置，同一个系数继续起作用。','位置变了，参考能量变了，乘在它前面的共同系数没有变。',String.raw`z_1=\alpha e_1,\quad z_2=\alpha e_2,\quad z_3=\alpha e_3`]
    ],
    finalSum:[
      ['B1',0,'先把三个贡献真的加起来。','把三个乘积相加，就是把三个“共同系数乘参考能量”相加。',String.raw`z_1+z_2+z_3=\alpha e_1+\alpha e_2+\alpha e_3`],
      ['B2',8,'将同一个系数提到括号外。','因为所有位置共用同一个系数，它可以提到求和外面。',String.raw`z_1+z_2+z_3=\alpha(e_1+e_2+e_3)`],
      ['B3',16,'从三个位置推广到全场。','全场累计仍然满足同一关系：复数和等于共同系数乘参考总能量。',String.raw`C=\sum_{\mathbf r}z(\mathbf r)=\alpha\sum_{\mathbf r}e(\mathbf r)=\alpha E_0`],
      ['B4',24,'回到本组实际数据。','实际数据可能不完全成比例，我们把所有位置的贡献一起算进去。',String.raw`C\approx\alpha E_0`],
      ['B5',30,'两路同步遍历完整空域网格。','每个空域位置都参加一次，两个累计量来自完全相同的位置集合。',String.raw`C=\sum_{\mathbf r}u^*v_{\widehat{\mathbf k}},\quad E_0=\sum_{\mathbf r}|u|^2`]
    ],
    finalDivide:[
      ['C1',0,'在关系两边同时除以参考能量。','两边除以同一个参考总能量，右边就能去掉这个能量尺度。',String.raw`C\approx\alpha E_0\ \Longrightarrow\ \frac C{E_0}\approx\frac{\alpha E_0}{E_0}`],
      ['C2',8,'约去能量，给可计算的比值命名。','这个从数据算出的比值，就是对共同系数的估计。',String.raw`\frac C{E_0}\approx\alpha,\qquad\widehat\alpha:=\frac C{E_0}`],
      ['C3',16,'代入刚才的两路累计量。','现在得到的是一个复数，它同时保存长度比例和相位差。',String.raw`\widehat\alpha=\frac{\sum_{\mathbf r}u^*v_{\widehat{\mathbf k}}}{\sum_{\mathbf r}|u|^2}`],
      ['C4',24,'用估出的系数预测原来的旁带。','我们求的是让全场预测与观测的平方误差之和最小的那个共同系数。',String.raw`\widehat\alpha=\underset{\beta\in\mathbb C}{\arg\min}\sum_{\mathbf r}|v_{\widehat{\mathbf k}}-\beta u|^2`]
    ],
    finalRead:[
      ['D1',0,'沿同一根箭头读取模长。','共同系数的长度，就是调制度。',String.raw`\widehat m=|\widehat\alpha|`],
      ['D2',8,'从正实轴读取相角。','共同相位是这根箭头相对正实轴的角度；接近零时如实显示。',String.raw`\widehat\phi_\Delta=\arg\widehat\alpha,\quad\widehat\alpha=\widehat m e^{i\widehat\phi_\Delta}`],
      ['D3',16,'把共同相位加到已知三次步进。','同一方向的三帧共享这个偏移，把它加到各自已知的相对相位上。',String.raw`\widehat\phi_j=\phi'_j+\widehat\phi_\Delta,\quad\phi'_j=2\pi j/3`]
    ]
  };
  function apply(definitions){
    for(const b of definitions){if(!shots[b.key])continue;
      const duration=durations[b.key],offset=b.key==='finalProduct'?prefix:0;
      if(offset){b.cues=Object.fromEntries(Object.entries(b.cues).map(([k,a])=>[k,a.map(x=>x*12.8/duration)]));}
      else b.cues={};
      if(b.key==='finalSum')Object.assign(b.cues,{sumFirst:[30/40,30/40],sumSweep:[32/40,37/40],contribution:[30/40,32/40],sumScan:[32/40,32/40]});
      if(b.key==='finalDivide')Object.assign(b.cues,{resultEnter:[0,0],divide:[19/36,21/36],divideExit:[1,1]});
      if(b.key==='finalRead')Object.assign(b.cues,{readReady:[0,0],readEnter:[0,0],phaseRead:[8/24,13/24],lengthRead:[0,5/24],cards:[19/24,21/24]});
      b.duration=duration*1000;b.visibility={enter:[0,offset?.12*12.8/duration:.015]};
      b.steps=[...(offset?[{key:'product-operation',at:0}]:[]),...shots[b.key].map(([key,at,title,copy,tex])=>({key,at:(offset+at)/duration,title,copy,note:b.key==='finalProduct'||(b.key==='finalSum'&&at<24)?'理想比例示意；示意取值不进入实际估计。':b.key==='finalSum'?'累计遍历完整空域网格；工作掩膜点数不是累计次数。':b.key==='finalDivide'?'参考能量须非零；这是固定参考场的一元复数最小二乘比例。':'相对步进已知且准确；模长直接给调制度。',formula:f(tex)}))];
      b.tailShots=shots[b.key].map((s,i)=>({key:s[0],action:s[2],start:(s[1]+offset)/duration,end:((shots[b.key][i+1]?.[1]??(duration-offset))+offset)/duration}));
      if(!offset){const first=b.steps[0];Object.assign(b,{title:first.title,copy:first.copy,note:first.note,formula:first.formula});}
    }
  }
  function state(mode,local){
    if(!durations[mode])return null;
    const seconds=local*durations[mode]-(mode==='finalProduct'?prefix:0);
    if(seconds<0)return null;
    const shot=shots[mode].filter(s=>seconds>=s[1]-1e-8).at(-1);
    const chapter={finalProduct:'A',finalSum:'B',finalDivide:'C',finalRead:'D'}[mode];
    return {chapter,seconds,shot:shot[0],enter:chapter==='A'?Clock.ramp(seconds,2,4):1,
      time:({A:0,B:32,C:72,D:108}[chapter])+seconds,
      ideal:chapter==='A'?Clock.ramp(seconds,4,6):chapter==='B'?1-Clock.ramp(seconds,24,26):0,
      actual:chapter==='B'?Clock.ramp(seconds,26,28):['C','D'].includes(chapter)?1:0};
  }
  const demoAlpha={re:.4,im:.4*Math.sqrt(3)},demoU=[{re:1,im:1},{re:-1,im:1},{re:2,im:-2}];
  const multiply=(a,b)=>({re:a.re*b.re-a.im*b.im,im:a.re*b.im+a.im*b.re});
  const demo=demoU.map(u=>{const v=multiply(demoAlpha,u),energy=u.re*u.re+u.im*u.im;return {u,v,energy,z:{re:demoAlpha.re*energy,im:demoAlpha.im*energy}};});
  const api={prefix,durations,shots,apply,state,demo,demoAlpha,multiply};if(node)module.exports=api;else root.SIMParameterTail=api;
})(typeof globalThis!=='undefined'?globalThis:this);
