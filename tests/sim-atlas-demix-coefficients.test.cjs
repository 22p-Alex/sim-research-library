const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../web/atlas/sim-atlas-demix-coefficients.js');
const C = require('../web/shared/sim-core.js');
const A = require('../web/atlas/sim-atlas-core.js');

const near = (a, b, eps = 1e-11) => assert.ok(Math.hypot(a.re - b.re, a.im - b.im) < eps, `${JSON.stringify(a)} != ${JSON.stringify(b)}`);
const mul = (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
const sum = xs => xs.reduce((a, b) => ({ re: a.re + b.re, im: a.im + b.im }), { re: 0, im: 0 });

test('real inverse weights decode every source for equal and unequal phase spacing', () => {
  const phaseSets = [[0, 2 * Math.PI / 3, 4 * Math.PI / 3], [0, 0.31, 1.72]];
  for (const phases of phaseSets) {
    const m = 0.8;
    const weights = A.mixWeights(C.phaseSystem(phases), m);
    assert.ok(weights, 'chosen phases have a nonsingular real phase system');
    for (let target = 0; target < 3; target++) {
      const model = D.build({ phases, m, weights, target });
      assert.equal(model.columns.length, 3);
      for (let source = 0; source < 3; source++) {
        const column = model.columns[source];
        assert.equal(column.original.length, 3);
        assert.equal(column.weighted.length, 3);
        near(column.sum, sum(column.weighted));
        const expected = { re: source === target ? 1 : 0, im: 0 };
        near(column.sum, expected, 2e-11);
        for (let j = 0; j < 3; j++) near(column.weighted[j], mul(weights[target][j], column.original[j]));
      }
    }
  }
});

