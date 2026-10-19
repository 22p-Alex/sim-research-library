/* Scene-owned progress state. Data come through the observation adapter. */
(function(root) {
  'use strict';
  function create({ M, E, A, dataFor }) {
    const { clamp, ramp } = M;
  // Presentation only: move the pair midpoint (690, 375) to (720, 280)
  // while enlarging both panels equally. Detector coordinates stay intact.
  function sharedFocusPose(amount = 1) {
    const focus = clamp(amount), scale = 1 + .2 * focus, x = -108 * focus, y = -170 * focus;
    return { amount: focus, scale, x, y, transform: `translate(${x} ${y}) scale(${scale})` };
  }
  function sharedState(progress) {
    const p = clamp(progress);
    const separate = ramp(p, .80, .90), arrange = ramp(p, .39, .49), relocate = ramp(p, .54, .68);
    return { pin: ramp(p, .04, .10), derive: ramp(p, .18, .30), found: ramp(p, .30, .36),
      arrange, relocate, cancel: ramp(p, .68, .70), separate,
      overlap: arrange * (1 - separate), region: ramp(p, .70, .77), outline: ramp(p, .90, .94), reliable: ramp(p, .94, .98),
      points: [ramp(p, .04, .10), ramp(p, .93, .97), ramp(p, .96, 1)], names: ramp(p, .90, .94) };
  }
  // Separating presentation placement from physical frequency relocation
  // makes every coordinate auditable without measuring rendered geometry.
  function sharedPointState(lesson, progress) {
    const s = sharedState(progress), q = dataFor(lesson).selected[0].q, e = lesson.estimate;
    const unit = 218 / 27, zero = [900, 375], home = [480, 375];
    const relocation = s.relocate * (1 - s.separate);
    const side = [home[0] + (zero[0] - home[0]) * s.overlap - e.kx * unit * relocation,
      home[1] - e.ky * unit * relocation];
    const detector = [q[0] + e.kx, q[1] + e.ky];
    // This prescribed path illustrates the alignment condition; the actual
    // data-driven candidate search remains in the later match/coarse scenes.
    const candidateK = [e.kx * s.relocate, e.ky * s.relocate];
    const residual = [e.kx - candidateK[0], e.ky - candidateK[1]];
    return { ...s, q, k: [e.kx, e.ky], unit, centers: [zero, side],
      candidateK, residual, relocatedPoint: detector.map((v, axis) => v - candidateK[axis]),
      detector: [q, detector],
      markerPositions: [zero.map((v, axis) => v + q[axis] * unit), side.map((v, axis) => v + detector[axis] * unit)],
      cursor: [q[0] + e.kx * s.derive, q[1] + e.ky * s.derive],
      displacement: [-e.kx * relocation, -e.ky * relocation] };
  }
    return { sharedState, sharedPointState, sharedFocusPose };
  }
  if(typeof module!=='undefined'&&module.exports)module.exports=create;
  else(root.SIMParameterStateFactories ||= {})['shared']=create;
})(typeof globalThis!=='undefined'?globalThis:this);
