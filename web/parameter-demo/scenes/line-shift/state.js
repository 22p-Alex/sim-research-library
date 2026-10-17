/* Scene-owned progress state. Data come through the observation adapter. */
(function(root) {
  'use strict';
  function create({ M, E, A, dataFor }) {
    const { clamp, ramp } = M;
  function lineState(progress) {
    return { real: M.realCorrelationState(clamp((progress - .20) / .80)) };
  }
    return { lineState };
  }
  if(typeof module!=='undefined'&&module.exports)module.exports=create;
  else(root.SIMParameterStateFactories ||= {})['line-shift']=create;
})(typeof globalThis!=='undefined'?globalThis:this);
