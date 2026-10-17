/* Desktop SVG slots. Layout edits do not change timing or source data. */
(function (root) {
  'use strict';
  const slots = {
    actionY: 112, legendY: 481,
    pair: { x: [390, 1050], y: 282, size: 224, detailY: 447 },
    shift: { x: [215, 615, 1130], y: 282, size: 186, plane: [862, 282, 53] },
    product: { x: [280, 690], y: 277, size: 205, plane: [1125, 273, 73], readoutY: 443 },
    sum: { x: [230, 570], y: 270, size: 176, plane: [930, 270, 68], readoutY: 407, countY: 443, sampleY: 465 },
    result: { plane: [1070, 270, 97], cardX: [250, 720, 1190], cardY: 425, cardWidth: 396, cardHeight: 73 }
  };
  root.SIMGetPeak.layout = root.SIMBeatClock.freeze(slots);
})(typeof globalThis !== 'undefined' ? globalThis : this);
