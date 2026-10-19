/* A registry for both host timelines. It does not own another animation clock. */
(function(root) {
  'use strict';
  const bounded = x => Math.max(0, Math.min(1, x));
  function create(scenes, { kind, getPeak, chapter, motion } = {}) {
    const entries = scenes.map((scene, index) => {
      const localId = scene.sceneId || scene.id.replace(/^parameters\./, '');
      const parameter = scene.owner === 'parameters' || scene.section === 'estimation';
      const canonical = (scene.coefficientBeat || scene.getPeakBeat || localId === 'least-squares-fit') ? 'get-peak' : localId;
      const folder = parameter ? 'web/parameter-demo/scenes/' : 'web/motion/scenes/';
      const path = scene.unit || (scene.owner === 'connection' ? 'web/parameter-demo/sim-parameter-preview.js' : folder + canonical + '/storyboard.js');
      let beats = scene.beats || [{ key: 'main', action: scene.label, start: 0, end: 1 }];
      const aliases=scene.teachingBeats?beats:[];
      if(scene.teachingBeats){
        beats=[...(scene.teachingBeats[0].start>0?[{key:'product-operation',action:'共轭乘积 · 原有操作',start:0,end:scene.teachingBeats[0].start}]:[]),...scene.teachingBeats];
      }
      if (canonical === 'get-peak' && !scene.getPeakBeat && !scene.coefficientBeat) beats = getPeak.timeline.beats;
      if (localId === 'frequency-encoding' && motion) {
        const source = motion.encodingDerivationStages;
        beats = [{ key:'entry', action:'接住条纹照明', start:0, end:source[0].start-2 },
          ...source.map(b => ({ key:b.id, action:b.title, start:b.start-2, end:b.end-2 })),
          { key:'shift-spectra', action:'展开并移动频谱', start:source.at(-1).end-2, end:1 }];
      }
      if (localId === 'provisional-split' && chapter) {
        beats = chapter.provisionalSteps.map((b, i, all) => ({ key:b.mode,
          action:chapter.provisionalFormulaAt({progress:b.start+1e-7}).title,
          start:b.start, end:all[i+1]?.start ?? 1 }));
      }
      const start = kind === 'motion' ? Math.max(0, index - 1) : index;
      return { id:scene.id, canonical, index, label:scene.label, title:scene.title, objective:scene.title,
        unit:path, getPeakBeat:scene.getPeakBeat,coefficientBeat:scene.coefficientBeat, beats, aliases, duration:scene.duration || 0, start, initial:kind === 'motion' && index === 0,
        entry:index ? scenes[index-1].id : null, exit:scenes[index+1]?.id || null,
        review:{ numerical:'automated', formula:'automated', transition:'automated', visual:'pending-user' } };
    });
    if(new Set(entries.map(s=>s.id)).size!==entries.length) throw new Error('场景 ID 重复。');
    const find = id => entries.find(e=>e.id===id || e.canonical===id);
    function resolve({ scene, beat='main', progress=0 }) {
      let entry=find(scene);
      const prefix=String(scene).startsWith('parameters.')?'parameters.':'',localId=String(scene).replace(/^parameters\./,'');
      const legacyBeats={finalPrepare:'correspondence',finalInverse:'singleRatio',finalShift:'singleRatio',finalShiftScan:'singleRatio',finalCompare:'singleRatio',finalProduct:'pooledRatio',finalSum:'pooledRatio',finalDivide:'pooledRatio',finalRead:'readParameters'};
      const legacyScenes={'get-peak-inverse':'singleRatio','get-peak-point':'singleRatio','get-peak-scan':'singleRatio','get-peak-compare':'singleRatio','get-peak-product':'pooledRatio','get-peak-sum':'pooledRatio','get-peak-divide':'pooledRatio','get-peak-read':'readParameters'};
      const oldShot=/^[A-D][1-6]$/.test(beat)?({A:'pooledRatio',B:'pooledRatio',C:'pooledRatio',D:'readParameters'})[beat[0]]:null;
      const replacement=legacyBeats[beat]||oldShot||legacyScenes[localId];
      if(replacement&&entries.some(e=>e.coefficientBeat===replacement)){
        entry=entries.find(e=>e.coefficientBeat===replacement&&e.id.startsWith(prefix));beat=replacement;
      }
      // Legacy composite locators select the new stop that owns this beat.
      if(entry?.canonical==='get-peak' && ![...entry.beats,...entry.aliases].some(b=>b.key===beat)) {
        entry=entries.find(e=>e.canonical==='get-peak' && e.getPeakBeat===beat);
      }
      const local=Number(progress);
      if(!entry || !Number.isFinite(local) || local<0 || local>1) throw new Error('场景定位无效。');
      const b=entry.beats.find(b=>b.key===beat)||entry.aliases.find(b=>b.key===beat);
      if(!b) throw new Error('该幕没有此分镜：'+beat);
      const p=b.start+(b.end-b.start)*local;
      // Existing hosts attribute exact integer boundaries to the preceding
      // endpoint. Enter the next scene just beyond that boundary on request.
      const position=entry.initial?0:entry.start+Math.max(1e-7,p);
      return { entry, beat:b, progress:local, sceneProgress:p, position };
    }
    function locate(id, progress) {
      const entry=find(id);
      if(!entry) throw new Error('未知场景：'+id);
      const p=bounded(progress), beat=entry.beats.find(b=>p < b.end-1e-10)||entry.beats.at(-1);
      return { entry, beat, progress:bounded((p-beat.start)/(beat.end-beat.start)), sceneProgress:p };
    }
    function serialize(location) {
      return 'scene='+encodeURIComponent(location.entry.id)+'&beat='+encodeURIComponent(location.beat.key)+'&p='+location.progress.toFixed(6);
    }
    function parse(value) {
      const match=String(value).replace(/^#/, '').split(/[\s?]/).find(p=>p.startsWith('scene='));
      if(!match) throw new Error('请粘贴 scene=…&beat=…&p=… 定位码。');
      const data=Object.fromEntries(match.split('&').map(pair=>pair.split('=').map(decodeURIComponent)));
      if(!data.scene || !data.beat || data.p===undefined) throw new Error('定位码缺少场景、分镜或进度。');
      return resolve({scene:data.scene,beat:data.beat,progress:Number(data.p)});
    }
    return { entries, find, resolve, locate, serialize, parse };
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={create};else root.SIMSceneRegistry={create};
})(typeof globalThis!=='undefined'?globalThis:this);
