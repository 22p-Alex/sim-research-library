/* 2D-SIM pipeline atlas: thin computation layer exposing every intermediate
 * artifact of the reconstruction, for a full-pipeline visual layout.
 * Demix / shift / fusion algebra migrated from the retired walkthrough core
 * (it was covered by exact-recovery tests); sample and probe APIs are new.
 * F{f}(k) = sum_r f(r) exp(-i 2pi k.r / N). Frequencies are DFT bins.
 * Chen et al. (2023), doi:10.1038/s41377-023-01204-4, Eqs. 1-9.
 * SIMCore and SIMExperiment are read-only dependencies.
 */
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const C = node ? require('./sim-core.js') : root.SIMCore;
  const E = node ? require('./sim-experiment.js') : root.SIMExperiment;

  // Integer illumination vectors: exact band shifts, no interpolation error.
  const N = 128, KC = 10, TAU = 2 * Math.PI;
  const VECTORS = [[8, 0], [4, 7], [-4, 7]];
  const CUTOFF_PERIOD = N / KC;          // 12.8 px, widefield limit
  const SIM_LIMIT = N / (KC + 8);        // 7.11 px, fused support limit
  const STAR_SPOKES = 16, STAR_R = 54;   // rim band r>54 stays empty for point pairs

  const bin = (i, n = N) => (i < n / 2 ? i : i - n);
  const idx = (x, y, n = N) => ((y % n + n) % n) * n + ((x % n + n) % n);

  function spectrum(pixels, n = N, imag) {
    const re = new Float64Array(pixels), im = imag ? new Float64Array(imag) : new Float64Array(n * n);
    C.fft2(re, im, n); return { re, im };
  }
  function spatial(z, n = N) {
    const re = z.re.slice(), im = z.im.slice(); C.fft2(re, im, n, true); return { re, im };
  }

  /* Siemens star: local period = 2 pi r / S, so one specimen carries three
   * readable zones -- widefield-visible rim, SIM-only middle ring, and an
   * inner core beyond the fused support. Point pairs add a separability test. */
  function makeSample(kind = 'star', n = N) {
    if (kind === 'gratings') return C.makeSample(n, 7.5);
    const out = new Float64Array(n * n), c = n / 2;
    const star = kind === 'star' || kind === 'star-points';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      let s = star ? 0.45 : 0.04;
      if (star) {
        const r = Math.hypot(x - c, y - c);
        if (r < STAR_R && r > 5) {
          const env = Math.min(1, (STAR_R - r) / 6, (r - 5) / 6);
          s += 0.45 * env * Math.cos(STAR_SPOKES * Math.atan2(y - c, x - c));
        }
      }
      out[y * n + x] = s;
    }
    if (kind === 'star-points' || kind === 'points') {
      // gaps 5 / 7 / 9 px sit in the empty rim: below SIM limit / at it / inside it
      for (const [px, py, gap] of [[64, 6, 5], [16, 98, 7], [112, 98, 9]])
        for (const sgn of [-1, 1]) {
          const cx = px + sgn * gap / 2;
          for (let y = 0; y < n; y++) for (let x = 0; x < n; x++)
            out[y * n + x] += 0.7 * Math.exp(-(((x - cx) ** 2 + (y - py) ** 2) / 3));
        }
    }
    return Float64Array.from(out, v => Math.min(1, v));
  }

  function phasesFor(mode) {
    return mode === 'close' ? [0, 15, 30].map(d => d * Math.PI / 180)
      : mode === 'duplicate' ? [0, 0, 0] : [0, TAU / 3, 2 * TAU / 3];
  }
  function vectorOf(d) {
    const [kx, ky] = VECTORS[d];
    return { kx, ky, angle: Math.atan2(ky, kx) * 180 / Math.PI, period: N / Math.hypot(kx, ky) };
  }
  function capture(p = {}) {
    const n = N, sample = makeSample(p.sample), m = p.m ?? 0.8;
    const phases = phasesFor(p.phases), count = p.directions === 3 ? 3 : 1;
    const noisy = p.noise && p.noise !== 'none', Q = p.noise === 'low' ? 150 : 5000;
    const B = noisy ? 5 : 0, read = noisy ? 2 : 0;
    const raw = { n, groups: [] }, calibration = { n, kc: KC / n, electrons: Q, background: B, readNoise: read, shotNoise: !!noisy, groups: [] };
    const truth = { sample, m, illumination: [], emission: [], spectrum: spectrum(sample, n) };
    for (let d = 0; d < count; d++) {
      const v = vectorOf(d), frames = [], lights = [], moires = [];
      calibration.groups.push({ index: d, angle: v.angle, period: v.period, mean: 1 });
      for (let j = 0; j < 3; j++) {
        const phase = phases[j];
        const illum = Float64Array.from(sample, (_, i) => 1 + m * Math.cos(TAU * (v.kx * (i % n) + v.ky * Math.floor(i / n)) / n + phase));
        const moire = Float64Array.from(sample, (s, i) => s * illum[i]);   // pre-OTF product
        const signal = C.forward(sample, n, { angle: v.angle, period: v.period, phase, m, mean: 1, kc: KC / n, otfModel: 'circular' });
        frames.push({ index: j, phase, pixels: E.camera(signal, { electrons: Q, background: B, readNoise: read, shotNoise: noisy }, (p.seed ?? 280926) + d * 1009 + j * 9176) });
        lights.push(illum); moires.push(moire);
      }
      raw.groups.push({ index: d, frames });
      truth.illumination.push(lights); truth.emission.push(moires);
    }
    truth.widefield = C.forward(sample, n, { angle: 0, period: 16, phase: 0, m: 0, mean: 1, kc: KC / n, otfModel: 'circular' });
    return { raw, calibration, truth };
  }

  function mixWeights(system) {
    const r = system.inverse;
    return r ? [r[0].map(x => ({ re: x, im: 0 })),
      r[1].map((x, j) => ({ re: x / 2, im: -r[2][j] / 2 })),
      r[1].map((x, j) => ({ re: x / 2, im: r[2][j] / 2 }))] : null;
  }
  function demix(spectra, weights, n = N) {
    return weights.map(row => {
      const re = new Float64Array(n * n), im = new Float64Array(n * n);
      for (let j = 0; j < 3; j++) for (let i = 0; i < n * n; i++) {
        re[i] += row[j].re * spectra[j].re[i] - row[j].im * spectra[j].im[i];
        im[i] += row[j].re * spectra[j].im[i] + row[j].im * spectra[j].re[i];
      }
      return { re, im };
    });
  }
  // C(q) = A(q + shift): multiply by exp(-i 2pi shift.r / N) in space.
  function shift(z, kx, ky, n = N) {
    if (Math.abs(kx - Math.round(kx)) < 1e-10 && Math.abs(ky - Math.round(ky)) < 1e-10) {
      const re = new Float64Array(n * n), im = new Float64Array(n * n);
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const i = y * n + x, j = idx(x + Math.round(kx), y + Math.round(ky), n);
        re[i] = z.re[j]; im[i] = z.im[j];
      }
      return { re, im };
    }
    const a = spatial(z, n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const i = y * n + x, ph = -TAU * (kx * x + ky * y) / n, c = Math.cos(ph), s = Math.sin(ph), r = a.re[i];
      a.re[i] = r * c - a.im[i] * s; a.im[i] = r * s + a.im[i] * c;
    }
    return spectrum(a.re, n, a.im);
  }
  // Mismatch may or may not reach the modulation estimator; see sim-experiment.
  function estimatorOptions(options) {
    if (options.errorsAffectEstimator !== false) return options;
    const { angleError, phaseError, otfError, ...clean } = options;
    return clean;
  }

  /* Full pipeline with every intermediate kept: raw spectra, phase system,
   * demix weights, separated orders, shifted bands, per-band transfer and
   * fusion weight, then numerator / denominator / fused spectrum / image. */
  function pipeline(raw, cal, options = {}, mKnown) {
    const n = raw.n, data = E.prepare(raw, cal, options);
    const estimates = E.estimate(data, cal, estimatorOptions(options));
    const out = { n, raw, data, estimates, groups: [], bands: [], ok: false, reason: null, pixels: null };
    const nr = new Float64Array(n * n), ni = new Float64Array(n * n), den = new Float64Array(n * n);
    const cutoff = cal.kc * n * (1 + (options.otfError || 0));
    for (const g of data.groups) {
      const rawSpectra = g.frames.map(f => spectrum(f.pixels, n));
      const phases = g.frames.map(f => f.phase + (options.phaseError || 0));
      const system = C.phaseSystem(phases), weights = mixWeights(system);
      const e = estimates.find(x => x.index === g.index);
      const baseM = mKnown === undefined ? (e?.ok ? e.m : 0) : mKnown;
      const m = baseM * (1 + (options.modulationError || 0));
      const a = (g.angle + (options.angleError || 0)) * Math.PI / 180;
      const kx = n * Math.cos(a) / g.period, ky = n * Math.sin(a) / g.period;
      const group = { index: g.index, angle: g.angle, period: g.period, frames: g.frames, rawSpectra, phases, system, weights, m, estimate: e, kx, ky, separated: null, bands: [] };
      out.groups.push(group);
      if (!weights || system.condition > 1000) { out.reason = weights ? 'ill-conditioned' : 'phase-rank'; continue; }
      group.separated = demix(rawSpectra, weights, n);
      for (let b = 0; b < 3; b++) {
        const order = [0, 1, -1][b], coefficient = b === 0 ? 1 : m / 2, active = b === 0 || m > 1e-8;
        const shifted = shift(group.separated[b], order * kx, order * ky, n);
        const h = new Float64Array(n * n), transfer = new Float64Array(n * n), contribution = new Float64Array(n * n);
        const variance = g.noiseVariance * weights[b].reduce((s, w) => s + w.re * w.re + w.im * w.im, 0);
        const weight = 1 / (3 * variance);
        const band = { direction: g.index, order, coefficient, active, weight, shifted, h, transfer, contribution, kx: order * kx, ky: order * ky };
        for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
          const i = y * n + x, H = C.otf(bin(x, n) + order * kx, bin(y, n) + order * ky, cutoff, 'circular'), T = coefficient * H;
          h[i] = H; transfer[i] = T; contribution[i] = active ? weight * T * T : 0;
          if (active) { nr[i] += weight * T * shifted.re[i]; ni[i] += weight * T * shifted.im[i]; den[i] += contribution[i]; }
        }
        group.bands.push(band); out.bands.push(band);
      }
    }
    out.numerator = { re: nr, im: ni }; out.denominator = den; out.cutoff = cutoff;
    if (out.reason) return out;
    const eps = options.eps ?? 0, re = new Float64Array(n * n), im = new Float64Array(n * n);
    out.regularizedDenominator = new Float64Array(n * n);
    out.effectiveTransfer = new Float64Array(n * n);
    for (let i = 0; i < n * n; i++) {
      const d = den[i] + eps * eps;
      out.regularizedDenominator[i] = d;
      if (d > 1e-14) {
        re[i] = nr[i] / d; im[i] = ni[i] / d;
        out.effectiveTransfer[i] = den[i] / d;
      }
    }
    out.spectrum = { re, im };
    const image = spatial(out.spectrum, n);
    out.pixels = image.re; out.imaginary = image.im;
    out.ok = true;
    out.reason = out.bands.some(b => b.order && b.active) ? 'sim' : 'zero-only';
    return out;
  }

  /* Angular contrast per radius ring: the spatial read-out of the resolution
   * boundary. star -> three zones; gratings -> nothing readable. */
  function radialProfile(px, opt = {}) {
    const n = opt.n || N, from = opt.from ?? 6, to = opt.to ?? 54, step = opt.step ?? 4, c = n / 2;
    const rings = [];
    for (let r = from; r <= to; r += step) {
      let m1 = 0, m2 = 0, cnt = 0;
      for (let a = 0; a < 360; a += 1) {
        const x = Math.round(c + r * Math.cos(a * Math.PI / 180)), y = Math.round(c + r * Math.sin(a * Math.PI / 180));
        if (x < 0 || y < 0 || x >= n || y >= n) continue;
        const v = px[y * n + x]; m1 += v; m2 += v * v; cnt++;
      }
      if (!cnt) continue;
      const mean = m1 / cnt, vari = m2 / cnt - mean * mean;
      rings.push({ r, localPeriod: TAU * r / STAR_SPOKES, mean, contrast: Math.sqrt(Math.max(0, vari)) / Math.max(1e-9, mean) });
    }
    return rings;
  }
  const zoneOf = localPeriod => localPeriod > CUTOFF_PERIOD ? 'widefield' : localPeriod > SIM_LIMIT ? 'sim-only' : 'beyond';

  /* One detector bin, one direction: the three mixed specimen components,
   * the demix coefficients applied, and where each order lands after shift. */
  function probe(p, d, x, y) {
    const g = p.groups[d]; if (!g) return null;
    const i = idx(x, y), s = n2 => v => v / (n2 * n2);
    const sc = s(N);
    const observed = g.rawSpectra.map(z => ({ re: sc(z.re[i]), im: sc(z.im[i]) }));
    const separated = g.separated ? g.separated.map(z => ({ re: sc(z.re[i]), im: sc(z.im[i]) })) : null;
    // Probe coordinates are unshifted array bins. q = f - order*k; evaluate
    // H at q + order*k = f, not at the same array index in the shifted H.
    const detector = [bin(x, N), bin(y, N)];
    const H = C.otf(...detector, p.cutoff, 'circular');
    const multiply = (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
    const sum = values => values.reduce((a, b) => ({ re: a.re + b.re, im: a.im + b.im }), { re: 0, im: 0 });
    const phaseFactor = (order, phase) => ({ re: Math.cos(order * phase), im: Math.sin(order * phase) });
    const orders = [0, 1, -1].map((order, b) => ({
      order,
      specimenBin: { x: idx(x - Math.round(order * g.kx), y - Math.round(order * g.ky)) % N, raw: [x - order * g.kx, y - order * g.ky] },
      specimenFrequency: [detector[0] - order * g.kx, detector[1] - order * g.ky],
      value: separated ? separated[b] : null,
      products: g.weights ? g.weights[b].map((w, j) => multiply(w, observed[j])) : null,
      responses: g.weights ? [0, 1, -1].map(h => sum(g.weights[b].map((w, j) => multiply(w, phaseFactor(h, g.phases[j]))))) : null,
      h: g.bands[b] ? H : null,
      transfer: g.bands[b] ? g.bands[b].coefficient * H : null,
      weight: g.bands[b] ? g.bands[b].weight : null,
    }));
    const remixed = separated ? g.phases.map(phase => sum(orders.map(o => multiply(phaseFactor(o.order, phase), o.value)))) : null;
    const closureError = remixed ? Math.max(...remixed.map((z, j) => Math.hypot(z.re - observed[j].re, z.im - observed[j].im))) : null;
    return { direction: d, bin: { x, y }, freq: { fx: bin(x, N) / N, fy: bin(y, N) / N }, observed, weights: g.weights, separated, orders, remixed, closureError, m: g.m, condition: g.system.condition };
  }

  const api = { N, KC, TAU, VECTORS, CUTOFF_PERIOD, SIM_LIMIT, STAR_SPOKES, STAR_R, bin, idx, spectrum, spatial, makeSample, phasesFor, vectorOf, capture, mixWeights, demix, shift, pipeline, radialProfile, zoneOf, probe };
  if (node) module.exports = api; else root.SIMAtlas = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
