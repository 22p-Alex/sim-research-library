/* Scene-owned progress state. Data come through the observation adapter. */
(function(root) {
  'use strict';
  function create({ M, E, A, dataFor }) {
    const { clamp, ramp } = M;
  function returnTo2DState(progress) {
    const p = clamp(progress);
    return { teaching: 1 - ramp(p, 0, .15), actual: ramp(p, .12, .27), arrange: ramp(p, .40, .62), relocate: ramp(p, .68, .94) };
  }
    return { returnTo2DState };
  }
  if(typeof module!=='undefined'&&module.exports)module.exports=create;
  else(root.SIMParameterStateFactories ||= {})['shift']=create;
})(typeof globalThis!=='undefined'?globalThis:this);
