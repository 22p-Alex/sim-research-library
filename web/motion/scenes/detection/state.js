/* Scene-owned deterministic state and formula choreography. */
(function(root) {
  'use strict';
  function create({ ramp, lerp, clamp, acquisitionState }) {
  function detectionState(time) {
    const dock = ramp(time, 4, 4.28), copy = ramp(time, 4.24, 4.46), filter = ramp(time, 4.56, 4.96);
    const resultFocus = ramp(time, 4.90, 5);
    return { dock, copy, filter, resultFocus,
      opacity: ramp(time, 4, 4.16) * (1 - acquisitionState(time).handoff),
      reference: ramp(time, 4.12, 4.30), duplicate: ramp(time, 4.24, 4.34),
      passband: ramp(time, 4.46, 4.56),
      inputFocus: 1 - ramp(time, 4.56, 4.66),
      filterFocus: ramp(time, 4.52, 4.64) * (1 - resultFocus),
      spectrumPose: { x: lerp(720, 940, dock), y: lerp(250, 147, dock), scale: lerp(1, 184 / 260, dock) },
      outputY: lerp(147, 397, copy),
    };
  }
  // H_t = (1-t) + tH, h_t = (1-t)δ + th. Linearity gives the same
  // intermediate image in both domains; t is teaching progress, not exposure.
  function detectionPixel(lesson, state, index) {
    const { emission, detected, transfer } = lesson.detection;
    const gain = lerp(1, transfer[index], state.filter), z = lesson.emissionSpectrum;
    return { spatial: lerp(emission[index], detected[index], state.filter),
      re: z.re[index] * gain, im: z.im[index] * gain, gain };
  }
  return { detectionState, detectionPixel };
  }
  if(typeof module!=='undefined'&&module.exports)module.exports=create;
  else (root.SIMMotionStateFactories ||= {})['detection']=create;
})(typeof globalThis!=='undefined'?globalThis:this);
