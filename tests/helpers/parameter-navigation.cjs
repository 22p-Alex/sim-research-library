/* Current four-scene amplitude/phase path; earlier search helpers stay local. */
const Mainline=require('../../web/parameter-demo/scenes/get-peak/mainline-state.js');
function position(flow,id,progress,motion=true){
  let local=progress;
  if(id==='least-squares-fit'){
    const beat=Mainline.timeline.at(progress);id=Mainline.stops[beat.beat].id;local=beat.local;
  }
  const mapped=Mainline.legacyScenes[id];
  if(mapped)id=Mainline.stops.find(s=>s.coefficientBeat===mapped).id;
  const index=flow.index((motion?'parameters.':'')+id);
  if(index<0)throw new Error('Unknown navigation scene: '+id);
  return index-(motion?1:0)+Math.max(1e-7,local);
}
module.exports={position};
