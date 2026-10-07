/* Compare the browser computation with the pinned, unmodified fairSIM Java
 * Wiener implementation. Requires JDK 11+. Only FFT is supplied by a small test
 * adapter, to avoid downloading ImageJ/JTransforms for a 2D numerical check. */
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { execFileSync } = require('node:child_process');
const A = require('../web/atlas/sim-atlas-core');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'Wiener-SIM/fairSIM-src/fairSIM/src/main/java');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-fairsim-'));
const helpers = path.join(__dirname, 'fairsim-reference');
execFileSync('javac', ['-d', scratch, '-sourcepath', source + ':' + helpers,
  path.join(helpers, 'JTransformsConnector.java'), path.join(helpers, 'Reference.java'),
  path.join(source, 'org/fairsim/linalg/BasicVectors.java')], { stdio: 'pipe' });
function reference(p) {
  const chunks = [], int = v => { const b = Buffer.alloc(4); b.writeInt32BE(v); chunks.push(b); },
    dbl = v => { const b = Buffer.alloc(8); b.writeDoubleBE(v); chunks.push(b); };
  int(p.n); int(p.groups.length);
  [p.cutoff, p.settings.w, p.settings.apoBend, p.settings.apoCutoff].forEach(dbl);
  for (const g of p.groups) {
    [g.kx, g.ky, g.requestedM, ...g.phases].forEach(dbl);
    for (const f of g.frames) {
      const b = Buffer.alloc(f.pixels.length * 4);
      f.pixels.forEach((v, i) => b.writeFloatBE(v, i * 4)); chunks.push(b);
    }
  }
  const input = path.join(scratch, 'frames.bin'), output = path.join(scratch, 'result.bin');
  fs.writeFileSync(input, Buffer.concat(chunks));
  execFileSync('java', ['-Djava.awt.headless=true', '-cp', scratch, 'Reference', input, output], { stdio: 'pipe', timeout: 30000 });
  const bytes = fs.readFileSync(output);
  return Float64Array.from({ length: bytes.length / 4 }, (_, i) => bytes.readFloatBE(4 * i));
}
const cases = [
  ['noiseless three directions', {}, {}],
  ['low photon counts', { noise: 'low' }, { eps: .08 }],
  ['one direction', { directions: 1 }, {}],
  ['fractional shift, phase and OTF mismatch', {}, { angleError: 3, phaseError: .2, otfError: .1 }],
  ['modulation fallback', { m: .2 }, {}],
  ['different apodization', {}, { apoBend: 1, apoCutoff: 1.5 }],
];
for (const [label, capture, options] of cases) test('fairSIM Java parity: ' + label, () => {
  const cap = A.capture({ sample: 'star-points', directions: 3, m: .8, noise: 'none', ...capture });
  const p = A.pipeline(cap.raw, cap.calibration, options, cap.truth.m), expected = reference(p);
  assert.equal(expected.length, p.outputNative.length);
  let max = 0, square = 0;
  for (let i = 0; i < expected.length; i++) {
    const d = Math.abs(expected[i] - p.outputNative[i]); max = Math.max(max, d); square += d * d;
  }
  console.log(label, JSON.stringify({ maxNativeError: max, rmsNativeError: Math.sqrt(square / expected.length) }));
  assert.ok(max < 2e-5, `Java / JS disagreement: ${max}`);
});
