/* 2D-SIM pipeline atlas: thin computation layer exposing every intermediate
 * artifact of the reconstruction, for a full-pipeline visual layout.
 * Reconstruction follows fairSIM 711afd12cb8c4fd4207bbca7ee7610c5aed4f732:
 * BandSeparation, SimAlgorithm.runReconstruction (Wiener, otfBeforeShift=false),
 * WienerFilter and OtfProvider (ideal OTF, attenuation off, isotropic APO).
 * JavaScript adaptation of GPL-2.0-or-later fairSIM; see its bundled LICENSE.
 * Acquisition and optional modulation estimation are this atlas's simulator.
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
  const FAIRSIM = Object.freeze({ commit: '711afd12cb8c4fd4207bbca7ee7610c5aed4f732', wiener: .05, apoBend: .8, apoCutoff: 1.9 });
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

  // OtfProvider.fromEstimate(a=1), getOtfVal: 512 float samples and linear interpolation.
  const idealOTF = r => r >= 1 ? 0 : (2 / Math.PI) * (Math.acos(r) - r * Math.sqrt(1 - r * r));
  const otfTable = Float32Array.from({ length: 512 }, (_, i) => idealOTF(i / 512));
  function otf(x, y, cutoff = KC) {
    const pos = Math.sqrt(x * x + y * y) / cutoff * 512;
    if (pos + 1 >= 512) return 0;
    const l = Math.floor(pos), h = Math.ceil(pos), f = Math.fround(pos - l);
    return Math.fround(Math.fround(otfTable[l] * Math.fround(1 - f)) + Math.fround(otfTable[h] * f));
  }
  function filtered(pixels, cutoff, n = N) {
    const z = spectrum(pixels, n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const i = y * n + x, h = otf(bin(x, n), bin(y, n), cutoff);
      z.re[i] *= h; z.im[i] *= h;
    }
    return spatial(z, n).re;
  }
  // SimUtils.placeFreq / Vec2d.pasteFreq. Keep DFT-bin spacing, double Nyquist extent.
  function padSpectrum(z, n = Math.sqrt(z.re.length)) {
    const size = n * 2, out = { re: new Float64Array(size * size), im: new Float64Array(size * size) };
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const i = y * n + x, j = idx(bin(x, n), bin(y, n), size);
      out.re[j] = z.re[i]; out.im[j] = z.im[i];
    }
    return out;
  }
  function interpolateImage(pixels, n = N) {
    return Float64Array.from(spatial(padSpectrum(spectrum(pixels, n), n), 2 * n).re, v => 4 * v);
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
        const signal = filtered(moire, KC, n);
        frames.push({ index: j, phase, pixels: E.camera(signal, { electrons: Q, background: B, readNoise: read, shotNoise: noisy }, (p.seed ?? 280926) + d * 1009 + j * 9176) });
        lights.push(illum); moires.push(moire);
      }
      raw.groups.push({ index: d, frames });
      truth.illumination.push(lights); truth.emission.push(moires);
    }
    truth.widefield = filtered(sample, KC, n);
    return { raw, calibration, truth };
  }

  function mixWeights(system, m = 2) {
    const r = system.inverse;
    return r ? [r[0].map(x => ({ re: x, im: 0 })),
      r[1].map((x, j) => ({ re: x / m, im: -r[2][j] / m })),
      r[1].map((x, j) => ({ re: x / m, im: r[2][j] / m }))] : null;
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

  /* Fixed fairSIM Wiener path. Source quantities keep native FFT normalization.
   * outputNative is the literal 2N inverse FFT; outputPixels multiplies by four
   * solely to express intensity on the original acquisition scale. No fitting,
   * DC correction, clipping, or normalization against sample truth is performed. */
  function pipeline(raw, cal, options = {}, mKnown) {
    const n = raw.n, size = n * 2, len = size * size, data = E.prepare(raw, cal, options);
    const estimates = E.estimate(data, cal, estimatorOptions(options));
    const out = { n, spectrumSize: size, raw, data, estimates, groups: [], bands: [], ok: false, reason: null, pixels: null, reference: FAIRSIM };
    const nr = new Float64Array(len), ni = new Float64Array(len), den = new Float64Array(len), response = new Float64Array(len);
    const cutoff = cal.kc * n * (1 + (options.otfError || 0));
    for (const g of data.groups) {
      const rawSpectra = g.frames.map(f => spectrum(f.pixels, n));
      const phases = g.frames.map(f => f.phase + (options.phaseError || 0));
      const system = C.phaseSystem(phases);
      const e = estimates.find(x => x.index === g.index);
      const requestedM = (mKnown === undefined ? (e?.ok ? e.m : 0) : mKnown) * (1 + (options.modulationError || 0));
      // SimParam.Dir.getModulations: replace out-of-range modulation with 0.65.
      const m = requestedM < .4 || requestedM > 1.1 ? .65 : requestedM;
      const weights = mixWeights(system, m);
      const a = (g.angle + (options.angleError || 0)) * Math.PI / 180;
      const kx = n * Math.cos(a) / g.period, ky = n * Math.sin(a) / g.period;
      const group = { index: g.index, angle: g.angle, period: g.period, frames: g.frames, rawSpectra, phases, system, weights, m, requestedM, fallback: m !== requestedM, estimate: e, kx, ky, separated: null, bands: [] };
      out.groups.push(group);
      if (!weights || system.condition > 1000) { out.reason = weights ? 'ill-conditioned' : 'phase-rank'; continue; }
      group.separated = demix(rawSpectra, weights, n);
      for (let b = 0; b < 3; b++) {
        const order = [0, 1, -1][b], coefficient = b === 0 ? 1 : m / 2;
        const shifted = shift(padSpectrum(group.separated[b], n), order * kx, order * ky, size);
        const h = new Float64Array(len), contribution = new Float64Array(len);
        const matched = { re: new Float64Array(len), im: new Float64Array(len) };
        const band = { direction: g.index, order, coefficient, active: true, shifted, matched, h, transfer: h, contribution, kx: order * kx, ky: order * ky };
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
          const i = y * size + x, H = otf(bin(x, size) + order * kx, bin(y, size) + order * ky, cutoff);
          h[i] = H;
          matched.re[i] = H * shifted.re[i]; matched.im[i] = H * shifted.im[i];
          // Preserve WienerFilter.addWienerDenominator literally: its +/- loop
          // also counts the zero-order OTF twice. The numerator counts it once.
          contribution[i] = H * H * (order === 0 ? 2 : 1);
          nr[i] += matched.re[i]; ni[i] += matched.im[i]; den[i] += contribution[i];
          response[i] += H * H;
        }
        group.bands.push(band); out.bands.push(band);
      }
    }
    out.numerator = { re: nr, im: ni }; out.denominator = den; out.signalResponse = response; out.cutoff = cutoff;
    if (out.reason) return out;
    const w = options.eps ?? FAIRSIM.wiener;
    const apoBend = options.apoBend ?? FAIRSIM.apoBend, apoCutoff = options.apoCutoff ?? FAIRSIM.apoCutoff;
    out.settings = { w, apoBend, apoCutoff, attenuation: false, otfBeforeShift: false };
    const re = new Float64Array(len), im = new Float64Array(len);
    const pre = { re: new Float64Array(len), im: new Float64Array(len) };
    out.apodization = new Float64Array(len);
    out.regularizedDenominator = new Float64Array(len);
    out.preApoTransfer = new Float64Array(len); out.effectiveTransfer = new Float64Array(len);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = y * size + x, d = den[i] + w * w;
      const apo = Math.pow(idealOTF(Math.hypot(bin(x, size), bin(y, size)) / (cutoff * apoCutoff)), apoBend);
      out.apodization[i] = apo; out.regularizedDenominator[i] = d;
      if (d > 1e-14) { // Guard the supported w=0 teaching experiment against 0/0.
        pre.re[i] = nr[i] / d; pre.im[i] = ni[i] / d;
        re[i] = pre.re[i] * apo; im[i] = pre.im[i] * apo;
        out.preApoTransfer[i] = response[i] / d;
        out.effectiveTransfer[i] = apo * response[i] / d;
      }
    }
    out.preApoSpectrum = pre; out.spectrum = { re, im };
    const image = spatial(out.spectrum, size);
    out.outputNative = image.re; out.imaginary = image.im;
    out.outputPixels = Float64Array.from(image.re, v => 4 * v);
    out.pixels = new Float64Array(n * n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) out.pixels[y * n + x] = out.outputPixels[(2 * y) * size + 2 * x];
    out.ok = true; out.reason = 'sim';
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
    const H = otf(...detector, p.cutoff);
    const multiply = (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
    const sum = values => values.reduce((a, b) => ({ re: a.re + b.re, im: a.im + b.im }), { re: 0, im: 0 });
    const phaseFactor = (order, phase) => { const a = order === 0 ? 1 : g.m / 2; return { re: a * Math.cos(order * phase), im: a * Math.sin(order * phase) }; };
    const orders = [0, 1, -1].map((order, b) => ({
      order,
      specimenBin: { x: idx(x - Math.round(order * g.kx), y - Math.round(order * g.ky)) % N, raw: [x - order * g.kx, y - order * g.ky] },
      specimenFrequency: [detector[0] - order * g.kx, detector[1] - order * g.ky],
      value: separated ? separated[b] : null,
      products: g.weights ? g.weights[b].map((w, j) => multiply(w, observed[j])) : null,
      responses: g.weights ? [0, 1, -1].map(h => sum(g.weights[b].map((w, j) => multiply(w, phaseFactor(h, g.phases[j]))))) : null,
      h: g.bands[b] ? H : null,
      transfer: g.bands[b] ? H : null,
      coefficient: order ? g.m / 2 : 1,
    }));
    const remixed = separated ? g.phases.map(phase => sum(orders.map(o => multiply(phaseFactor(o.order, phase), o.value)))) : null;
    const closureError = remixed ? Math.max(...remixed.map((z, j) => Math.hypot(z.re - observed[j].re, z.im - observed[j].im))) : null;
    return { direction: d, bin: { x, y }, freq: { fx: bin(x, N) / N, fy: bin(y, N) / N }, observed, weights: g.weights, separated, orders, remixed, closureError, m: g.m, condition: g.system.condition };
  }

  const api = { FAIRSIM, otf, idealOTF, padSpectrum, interpolateImage, N, KC, TAU, VECTORS, CUTOFF_PERIOD, SIM_LIMIT, STAR_SPOKES, STAR_R, bin, idx, spectrum, spatial, makeSample, phasesFor, vectorOf, capture, mixWeights, demix, shift, pipeline, radialProfile, zoneOf, probe };
  if (node) module.exports = api; else root.SIMAtlas = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
