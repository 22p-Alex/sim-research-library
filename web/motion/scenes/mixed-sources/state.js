/* Scene-owned deterministic state and formula choreography. */
(function(root) {
  'use strict';
  function create({ orders, ramp, lerp, clamp }) {
  // Revisit the unweighted encoding copies before naming their detected
  // versions A. The same playhead filters full complex data, then reads f.
  // Formula anchors and thumbnail destinations share these descriptors.
  const sourceAnchors = Object.freeze(orders.map((order, row) => Object.freeze({
    order, overview: Object.freeze({ x: 430 + row * 350, y: 275 }),
    expanded: Object.freeze({ x: 980, y: 218 + row * 100, thumbnailX: 1240 }),
    scalar: Object.freeze({ x: 605 + row * 315, y: 207 }),
    vector: Object.freeze({ x: 1205, y: 314 + row * 72, thumbnailX: 1310 }),
  })));
  const sourceMatrixTime = time => time > 7.12 && time < 8
    ? 7.12 + .88 * clamp((time - 7.54) / .46) : time;
  function sourceOriginState(time) {
    const dock = ramp(time, 7.42, 7.54), matrix = ramp(sourceMatrixTime(time), 7.40, 7.48);
    const opacity = ramp(time, 7.12, 7.16) * (1 - ramp(time, 8.12, 8.22));
    return { opacity, overview: opacity * (1 - dock), dock, matrix,
      panels: sourceAnchors.map(anchor => ({
        order: anchor.order,
        x: lerp(lerp(anchor.overview.x, anchor.expanded.thumbnailX, dock), anchor.vector.thumbnailX, matrix),
        y: lerp(lerp(anchor.overview.y, anchor.expanded.y, dock), anchor.vector.y, matrix),
        scale: lerp(1, .28, dock),
      })),
      filter: ramp(time, 7.21, 7.30), alias: ramp(time, 7.31, 7.35),
      probe: ramp(time, 7.36, 7.40) };
  }
  function sourceOriginPixel(lesson, orderIndex, progress, index) {
    const gain = lerp(1, lesson.detection.transfer[index], clamp(progress));
    return { re: lesson.encodingCopies[orderIndex].re[index] * gain,
      im: lesson.encodingCopies[orderIndex].im[index] * gain };
  }
  return { sourceAnchors, sourceMatrixTime, sourceOriginState, sourceOriginPixel };
  }
  if(typeof module!=='undefined'&&module.exports)module.exports=create;
  else (root.SIMMotionStateFactories ||= {})['mixed-sources']=create;
})(typeof globalThis!=='undefined'?globalThis:this);
