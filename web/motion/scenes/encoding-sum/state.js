/* Scene-owned deterministic state and formula choreography. */
(function(root) {
  'use strict';
  function create({ ramp, lerp, clamp, orders, detectionState }) {
  function encodingSumState(time) {
    const arrange = ramp(time, 3.08, 3.32), weight = ramp(time, 3.32, 3.58), merge = ramp(time, 3.60, 3.94);
    const detection = detectionState(time), detect = detection.dock, factor = lerp(1, .4, weight);
    return { arrange, weight, merge, factor, detect, probe: ramp(time, 3.34, 3.50),
      opacity: ramp(time, 3, 3.16) * (1 - ramp(time, 4, 4.16)),
      expanded: ramp(time, 3, 3.14) * (1 - ramp(time, 3.94, 4)),
      zeroFocus: ramp(time, 3.08, 3.18) * (1 - ramp(time, 3.32, 3.42)),
      weightFocus: ramp(time, 3.32, 3.42) * (1 - ramp(time, 3.60, 3.72)),
      sumFocus: ramp(time, 3.60, 3.94),
      panels: [
        { x: lerp(360, 720, arrange) + 220 * detect, y: 250 - 36 * Math.sin(Math.PI * arrange) - 103 * detect, scale: detection.spectrumPose.scale, opacity: 1 },
        { x: lerp(lerp(720, 360, arrange), 720, merge), y: 250 + 36 * Math.sin(Math.PI * arrange), scale: 1, opacity: 1 - merge },
        { x: lerp(1080, 720, merge), y: 250, scale: 1, opacity: 1 - merge },
      ],
    };
  }
  function encodingSumPixel(lesson, state, index) {
    const z = lesson.encodingCopies;
    return { re: z[0].re[index] + state.merge * state.factor * (z[1].re[index] + z[2].re[index]),
      im: z[0].im[index] + state.merge * state.factor * (z[1].im[index] + z[2].im[index]) };
  }
  return { encodingSumState, encodingSumPixel };
  }
  if(typeof module!=='undefined'&&module.exports)module.exports=create;
  else (root.SIMMotionStateFactories ||= {})['encoding-sum']=create;
})(typeof globalThis!=='undefined'?globalThis:this);
