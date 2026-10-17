/* Shared persistent actors for this scene family. */
(function(root){
  'use strict';
  (root.SIMMotionHostViews ||= {}).algebra = function({ arrowPath, M, A, $, lesson, create, attr, style, setText, opacity, compact, complex, math, imageURL, spectrumURL, spatialURL, maximum, formulaBox, canvasLayer, encodingAlgebraView }) {
  function buildEncodingAlgebra() {
    const parent = $('encoding-algebra-tokens');
    for (const token of M.encodingFormulaTokens) {
      const group = create('g', { 'data-encoding-token': token.id, 'data-encoding-band': token.band ?? '',
        color: token.band === null ? '#edf0e9' : M.colors[token.band] }, parent);
      if (token.kind === 'fraction-bar') {
        // KaTeX's MathML-only \rule is a black mspace, which disappears on
        // this dark background. Draw a stroke that inherits the band's color.
        create('line', { x1: -13, x2: 13, y1: 0, y2: 0, stroke: 'currentColor',
          'stroke-width': 1.6, 'stroke-linecap': 'round', 'vector-effect': 'non-scaling-stroke',
          'data-fraction-bar': token.id, 'aria-hidden': true }, group);
      } else {
        const box = create('foreignObject', { x: -token.width / 2, y: -42, width: token.width, height: 84 }, group);
        const content = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
        attr(content, 'class', 'encoding-algebra-math'); box.appendChild(content); math(content, token.equation);
      }
      encodingAlgebraView.push(group);
    }
  }
    return { buildEncodingAlgebra };
  };
})(typeof globalThis!=='undefined'?globalThis:this);
