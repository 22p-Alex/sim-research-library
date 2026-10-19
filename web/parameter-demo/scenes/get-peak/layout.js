/* Desktop SVG slots. Layout edits do not change timing or source data. */
(function (root) {
  'use strict';
  const slots = {
    actionY: 112, legendY: 532,
    locked: {x:720,y:64},
    entry: {cx:480,cy:283,unit:13,range:27,sourceSize:218},
    pair: { x: [370, 1070], y: 270, size: 256, detailY: 447 },
    preparation: {addressY:417,otfY:444,valueY:472,sampleY:484,sampleWidth:300},
    explanation: {x:720,formulaY:102,planeY:290,radius:86,labelY:407,detailY:438,captionY:164,
      axisLabels:{imaginary:{x:-18,y:-68,anchor:'end'}}},
    // Formula positions in em, relative to the center of one unbroken row.
    alphaFormula: {sourceX:-3,scaleX:-.5,scaledMX:2,scaledZX:2.75,expandX:-5.7,
      phaseX:.6,productMX:4,productPhaseX:5.8,productZX:7.7,coefficientX:6.95,
      labelY:-1.2,copyArc:.65},
    colorKey: {x:720,planeY:268,radius:68,barX:590,barY:388,barWidth:260,barHeight:12,tileX:705,tileY:432,tileSize:30},
    derivation:{x:720,y:252,width:700,factors:[500,940],factorWidth:400,captionY:174,explainY:360},
    single:{input:[330,270,180],plane:[900,270,136],positionY:96,angleY:434,swatchY:464,hintY:508},
    shift: { x: [370, 1070, 1070], y: 270, size: 186, displaySize:256,
      plane: [720, 270, 100], positionY:125, angleY:443, hintY:485, model:[720,440],swatchY:391,swatchSize:22 },
    pointwise:{x:[370,1070],operator:[720,246],coordinateY:435,counterY:435},
    product: { x: [280, 690], y: 277, size: 205, plane: [1125, 270, 100], readoutY: 443 },
    sum: { x: [230, 570], y: 270, size: 176, plane: [930, 270, 68], readoutY: 407, countY: 443, sampleY: 465 },
    result: { plane: [1070, 270, 97], cardX: [250, 720, 1190], cardY: 425, cardWidth: 396, cardHeight: 73 }
  };
  root.SIMGetPeak.layout = root.SIMBeatClock.freeze(slots);
})(typeof globalThis !== 'undefined' ? globalThis : this);
