/* Scene-owned deterministic state and formula choreography. */
(function(root) {
  'use strict';
  function create({ orders, ramp, sourceOriginState, sourceMatrixTime, inverseState }) {
  function demixState(time) {
    const origin = sourceOriginState(time);
    time = sourceMatrixTime(time);
    const inverse = ramp(time, 8.12, 8.22), proof = ramp(time, 9.20, 9.40), application = ramp(time, 10.16, 10.28), bands = ramp(time, 10.86, 11);
    const definitions = ramp(time, 7.24, 7.32), collapse = ramp(time, 7.32, 7.39), arrange = ramp(time, 7.40, 7.48);
    const transfers = [7.50, 7.66, 7.82].map(start => [0, 1, 2, 3].map(c => ramp(time, start + c * .032, start + c * .032 + .028)));
    const second = ramp(time, 7.63, 7.65), third = ramp(time, 7.79, 7.81);
    return { origin, panels: { origin: origin.overview, source: (1 - arrange) * (1 - origin.overview), mix: arrange - inverse, inverse: inverse - proof, proof: proof - application, result: application },
      definitions, collapse, arrange, transfers, activeRows: [1 - second, second - third, third],
      matrixRows: transfers.map(row => row[3]),
      // Only the isolated coefficient proof selects -1. The production path
      // holds at time 9 before estimating from the 0 / +1 overlap.
      inverse, inversion: inverseState(time), selectedRow: ramp(time, 9.12, 9.20), proof, expand: ramp(time, 9.42, 9.62), coefficientSum: ramp(time, 9.68, 9.86), proofComplete: ramp(time, 9.90, 10),
      application, products: [[10.30, 10.41], [10.43, 10.54], [10.56, 10.67]].map(([start, end]) => ramp(time, start, end)),
      applyRows: [[10.72, 10.77], [10.78, 10.83], [10.68, 10.71]].map(([start, end]) => ramp(time, start, end)),
      bands, reveal: ramp(time, 7.12, 7.24) };
  }
  return { demixState };
  }
  if(typeof module!=='undefined'&&module.exports)module.exports=create;
  else (root.SIMMotionStateFactories ||= {})['separate-bands']=create;
})(typeof globalThis!=='undefined'?globalThis:this);
