/* Known fairSIM coefficients before and after multiplication by inverse weights. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SIMDemixCoefficients = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const ORDERS = [0, 1, -1];

  function complex(value, label) {
    if (!value || !Number.isFinite(value.re) || !Number.isFinite(value.im))
      throw new TypeError(label + ' must be a finite complex number');
    return { re: value.re, im: value.im };
  }
  function multiply(a, b) {
    return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
  }
  function add(a, b) { return { re: a.re + b.re, im: a.im + b.im }; }

  function build({ phases, m, weights, target } = {}) {
    if (!Array.isArray(phases) || phases.length !== 3 || !phases.every(Number.isFinite))
      throw new TypeError('phases must contain three finite angles');
    if (!Number.isFinite(m) || m < 0) throw new TypeError('m must be a finite nonnegative number');
    if (!Array.isArray(weights) || weights.length !== 3 || weights.some(row => !Array.isArray(row) || row.length !== 3))
      throw new TypeError('weights must be a 3×3 complex matrix');
    if (!Number.isInteger(target) || target < 0 || target > 2) throw new RangeError('target must be 0, 1, or 2');

    const row = weights[target].map((w, j) => complex(w, 'weights[' + target + '][' + j + ']'));
    const columns = ORDERS.map((order, source) => {
      const amplitude = source === 0 ? 1 : m / 2;
      const original = phases.map(phase => {
        const angle = order * phase;
        return { re: amplitude * Math.cos(angle), im: amplitude * Math.sin(angle) };
      });
      const weighted = original.map((z, j) => multiply(row[j], z));
      // Deliberately sum the actual products in frame order; cancellation is numerical, not encoded.
      const sum = weighted.reduce(add, { re: 0, im: 0 });
      return { original, weighted, sum };
    });

    return { columns };
  }

  return { build };
});
