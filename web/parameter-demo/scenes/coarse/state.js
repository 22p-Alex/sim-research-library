/* Scene-owned progress state. Data come through the observation adapter. */
(function(root) {
  'use strict';
  function create({ M, E, A, dataFor }) {
    const { clamp, ramp } = M;
  function fftState(progress) {
    const p=clamp(progress);
    return {dim:ramp(p,.04,.10),gather:ramp(p,.12,.24),inverse:ramp(p,.28,.42),
      multiply:ramp(p,.48,.68),forward:ramp(p,.72,.80),normalize:ramp(p,.81,.85),
      dock:ramp(p,.86,.94),reveal:ramp(p,.94,.96),peak:ramp(p,.97,.995),
      mode:p<.12?'hold':p<.26?'fixed':p<.46?'inverse':p<.71?'multiply':p<.96?'forward':'peak'};
  }
    return { fftState };
  }
  if(typeof module!=='undefined'&&module.exports)module.exports=create;
  else(root.SIMParameterStateFactories ||= {})['coarse']=create;
})(typeof globalThis!=='undefined'?globalThis:this);
