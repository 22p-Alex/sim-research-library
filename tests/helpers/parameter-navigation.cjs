/* Address the shared getPeak calculation through its independent host stops. */
const Peak=require('../../web/parameter-demo/scenes/get-peak/state.js');
function position(flow,id,progress,motion=true){
  let local=progress;
  if(id==='least-squares-fit'){
    const beat=Peak.timeline.at(progress),stop=Peak.stops[beat.beat];
    id=stop.id;local=beat.local;
  }
  const index=flow.index((motion?'parameters.':'')+id);
  return index-(motion?1:0)+Math.max(1e-7,local);
}
module.exports={position};
