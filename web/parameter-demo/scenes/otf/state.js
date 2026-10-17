/* Scene-owned progress state. Data come through the observation adapter. */
(function(root) {
  'use strict';
  function create({ M, E, A, dataFor }) {
    const { clamp, ramp } = M;
  function otfState(progress) {
    const p = clamp(progress);
    // Each row uses its own conjugate. Normalization follows the completed
    // product H*H=|H|², and U/V are named only after cancellation.
    return { warning: ramp(p, .02, .10), discard: ramp(p, .10, .37), detail: ramp(p, .40, .46),
      multiply: ramp(p, .48, .58), power: ramp(p, .60, .67), divide: ramp(p, .70, .77),
      cancel: ramp(p, .79, .85), name: ramp(p, .87, .93), relation: ramp(p, .94, .98),
      formula: p < .4 ? 'region' : p < .48 ? 'otfSymbols' : p < .70 ? 'otfMultiply' : p < .87 ? 'otfNormalize' : 'correct' };
  }
  function rejectionProgress(progress, rank) {
    // The weakest samples leave first. Shrinking a selection cell does not
    // move its frequency coordinate or alter the observed spectrum.
    return ramp(progress, .10 + .12 * clamp(rank), .25 + .12 * clamp(rank));
  }
    return { otfState, rejectionProgress };
  }
  if(typeof module!=='undefined'&&module.exports)module.exports=create;
  else(root.SIMParameterStateFactories ||= {})['otf']=create;
})(typeof globalThis!=='undefined'?globalThis:this);
