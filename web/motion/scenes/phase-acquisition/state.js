/* Scene-owned deterministic state and formula choreography. */
(function(root) {
  'use strict';
  function create({ ramp, lerp, clamp }) {
  function acquisitionState(time) {
    const carry = ramp(time, 5, 5.28), handoff = ramp(time, 5.24, 5.32);
    const firstShift = ramp(time, 5.52, 5.70), secondShift = ramp(time, 5.80, 5.96), step = 2 * Math.PI / 3;
    const exit = 1 - ramp(time, 6, 6.3);
    return { carry, handoff, firstShift, secondShift, exit,
      clear: 1 - ramp(time, 5, 5.16),
      firstPose: { x: lerp(500, 360, carry), y: lerp(397, 250, carry), size: lerp(184, 224, carry) },
      stripOpacity: ramp(time, 5.32, 5.44) * exit,
      completed: ramp(time, 5.96, 6),
      phase: step * (firstShift + secondShift),
      active: time < 5.52 ? 0 : time < 5.8 ? 1 : 2,
      shifting: time > 5.52 && time < 5.70 || time > 5.80 && time < 5.96,
      frames: [
        { phase: 0, opacity: 1 },
        { phase: step * firstShift, opacity: ramp(time, 5.44, 5.50) },
        { phase: step * (1 + secondShift), opacity: ramp(time, 5.74, 5.80) },
      ],
      arrows: [ramp(time, 5.34, 5.44) * exit, ramp(time, 5.70, 5.78) * exit],
    };
  }
  // A fixed linear detection system maps cosine illumination to
  // d_phi = B0 + Bc cos(phi) + Bs sin(phi). These basis images come from the
  // three actual exposures, so phase animation keeps the specimen stationary.
  function acquisitionPixel(lesson, phase, index) {
    const { mean, cosine, sine } = lesson.acquisition;
    return mean[index] + cosine[index] * Math.cos(phase) + sine[index] * Math.sin(phase);
  }
  return { acquisitionState, acquisitionPixel };
  }
  if(typeof module!=='undefined'&&module.exports)module.exports=create;
  else (root.SIMMotionStateFactories ||= {})['phase-acquisition']=create;
})(typeof globalThis!=='undefined'?globalThis:this);
