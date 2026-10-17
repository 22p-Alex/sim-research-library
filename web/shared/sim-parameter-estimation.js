/* Teaching estimator: provisional separation, OTF-corrected overlap,
 * normalized complex correlation, then complex least-squares scale.
 * Method: Müller et al. 2016, doi:10.1038/ncomms10980, Supplementary Note 1.
 * Each band is corrected by its own H: conj(H) A / |H|^2 = A/H.
 * This is the algebra used by fairSIM commonRegion's divideByOtf branch.
 * This is NOT a port of its search, masks or normalization. Coordinates: x right,
 * y down; forward FFT has a negative exponential; frequencies are DFT bins.
 */
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const A = node ? require('../atlas/sim-atlas-core.js') : root.SIMAtlas;
  const C = node ? require('./sim-core.js') : root.SIMCore;
  const TAU = 2 * Math.PI;
  const wrapPhase = phase => Math.atan2(Math.sin(phase), Math.cos(phase));
  const defaults = Object.freeze({ n: A.N, cutoff: A.KC, minH: .15, minPoints: 20,
    minRadius: 3, maxRadius: 10, nominalPhases: [0, TAU / 3, 2 * TAU / 3] });

  // Keep both steps explicit for the lesson and for complex-OTF unit checks.
  // The capture below still uses the existing real, nonnegative circular OTF.
  // Threshold selection must precede this pointwise inverse; no regularizer
  // is added here, since that would no longer be equal to division by H.
  function correctOtf(value, transfer) {
    const power = transfer.re ** 2 + transfer.im ** 2;
    if (!(power > 0) || !Number.isFinite(power)) throw new Error('OTF 校正需要非零且有限的 H。');
    const weighted = { re: transfer.re * value.re + transfer.im * value.im,
      im: transfer.re * value.im - transfer.im * value.re };
    return { power, weighted, corrected: { re: weighted.re / power, im: weighted.im / power } };
  }

  // Only this forward generator sees illumination truth. Its raw frames have
  // neither phase nor wave-vector metadata. The estimator takes raw+config.
  function capture(options = {}) {
    const n = options.n || A.N, cutoff = options.cutoff || A.KC;
    const sample = options.sample || A.makeSample('star-points', n);
    const vectors = options.vectors || A.VECTORS, offsets = options.offsets || [.35, .55, -.4];
    if (vectors.some(v => v.length !== 2 || !v.every(Number.isInteger))) throw new Error('本教学采集使用整数 DFT 波矢，以保持周期边界下的成像关系。');
    const m = options.m ?? .8, nominalPhases = options.nominalPhases || defaults.nominalPhases;
    const raw = { n, groups: [] }, illumination = [], phases = [];
    for (let d = 0; d < vectors.length; d++) {
      const [kx, ky] = vectors[d], frames = [], lights = [], actual = [];
      nominalPhases.forEach((nominal, j) => {
        const phase = nominal + offsets[d], light = new Float64Array(n * n);
        const emission = Float64Array.from(sample, (value, i) => {
          light[i] = 1 + m * Math.cos(TAU * (kx * (i % n) + ky * Math.floor(i / n)) / n + phase);
          return value * light[i];
        });
        const z = A.spectrum(emission, n);
        for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
          const i = y * n + x, h = A.otf(A.bin(x, n), A.bin(y, n), cutoff);
          z.re[i] *= h; z.im[i] *= h;
        }
        frames.push({ index: j, pixels: A.spatial(z, n).re }); lights.push(light); actual.push(phase);
      });
      raw.groups.push({ index: d, frames }); illumination.push(lights); phases.push(actual);
    }
    return { raw, config: { ...defaults, n, cutoff, nominalPhases: [...nominalPhases],
      minRadius: .3 * cutoff, maxRadius: cutoff },
      truth: { sample, spectrum: A.spectrum(sample, n), vectors: vectors.map(v => [...v]), offsets: [...offsets], m, phases, illumination } };
  }

  function separate(group, config) {
    const { n, nominalPhases } = config;
    if (group.frames.length !== 3 || nominalPhases.length !== 3) throw new Error('临时分离需要三帧与三个名义相位。');
    if (group.frames.some(f => f.pixels.length !== n * n || f.pixels.some(v => !Number.isFinite(v)))) throw new Error('相机帧尺寸或数值无效。');
    const system = C.phaseSystem(nominalPhases), weights = A.mixWeights(system, 1);
    if (!weights || system.condition > 1000) throw new Error('名义相位不能形成稳定的三频带分离。');
    const spectra = group.frames.map(f => A.spectrum(f.pixels, n));
    const bands = A.demix(spectra, weights, n);
    return { spectra, bands, weights };
  }

  function context(group, options = {}) {
    const config = { ...defaults, ...options }, separated = separate(group, config);
    const points = [], { n, cutoff, minH } = config;
    for (let y = -Math.ceil(cutoff); y <= cutoff; y++) for (let x = -Math.ceil(cutoff); x <= cutoff; x++) {
      const h = A.otf(x, y, cutoff);
      if (h <= 0 || h < minH) continue;
      const i = A.idx(x, y, n), z = separated.bands[0];
      const raw = { re: z.re[i], im: z.im[i] };
      points.push({ x, y, i, h, raw, correction: correctOtf(raw, { re: h, im: 0 }) });
    }
    return { config, separated, points };
  }

  function compare(ctx, kx, ky, keepPoints = false) {
    const { config, separated } = ctx, { n, cutoff, minH, minPoints } = config;
    const integer = Math.abs(kx - Math.round(kx)) < 1e-10 && Math.abs(ky - Math.round(ky)) < 1e-10;
    const shifted = integer ? null : A.shift(separated.bands[1], kx, ky, n);
    let xx = 0, yy = 0, re = 0, im = 0, count = 0;
    const points = [];
    for (const point of ctx.points) {
      const h = A.otf(point.x + kx, point.y + ky, cutoff);
      if (h <= 0 || h < minH) continue;
      const z = shifted || separated.bands[1], i = shifted ? point.i : A.idx(point.x + Math.round(kx), point.y + Math.round(ky), n);
      const rawY = { re: z.re[i], im: z.im[i] };
      const zero = point.correction, side = correctOtf(rawY, { re: h, im: 0 });
      // At a fixed q, U is independent of k'. The sideband address and the
      // comparison set change with k'; each operand uses its own OTF.
      const xr = zero.corrected.re, xi = zero.corrected.im, yr = side.corrected.re, yi = side.corrected.im;
      const cr = xr * yr + xi * yi, ci = xr * yi - xi * yr, energy = xr * xr + xi * xi;
      xx += energy; yy += yr * yr + yi * yi; re += cr; im += ci; count++;
      if (keepPoints) points.push({ q: [point.x, point.y], h0: point.h, h1: h,
        rawX: point.raw, rawY, weightedX: zero.weighted, weightedY: side.weighted,
        power0: zero.power, power1: side.power,
        x: { re: xr, im: xi }, y: { re: yr, im: yi }, cross: { re: cr, im: ci }, energy });
    }
    const valid = count >= minPoints && xx > 1e-14 && yy > 1e-14;
    const score = valid ? Math.min(1, Math.hypot(re, im) / Math.sqrt(xx * yy)) : 0;
    const alpha = valid ? { re: re / xx, im: im / xx } : { re: 0, im: 0 };
    return { kx, ky, valid, score, count, xx, yy, cross: { re, im }, alpha, points };
  }

  // Negative-exponent forward FFT; inverse normalization is 1/(n*n).
  // Thus sum_q conj(P[q]) Q[q+k] = n*n FFT(conj(IFFT(P)) IFFT(Q))[k].
  // Indices are circular. The compact OTF support in this lesson lies clear
  // of the periodic boundary for every admitted search candidate.
  function correlateSpatial(a, b, n) {
    const product = { re: new Float64Array(n*n), im: new Float64Array(n*n) };
    for (let i=0;i<n*n;i++) {
      product.re[i]=a.re[i]*b.re[i]+a.im[i]*b.im[i];
      product.im[i]=a.re[i]*b.im[i]-a.im[i]*b.re[i];
    }
    const correlation=A.spectrum(product.re,n,product.im);
    for(let i=0;i<n*n;i++){correlation.re[i]*=n*n;correlation.im[i]*=n*n;}
    return {product,correlation};
  }
  function correlationMap(first, second, n) {
    const spatial=[A.spatial(first,n),A.spatial(second,n)];
    return {...correlateSpatial(...spatial,n),spatial};
  }
  function fixedCorrelation(ctx) {
    const {n,cutoff,minH,minPoints}=ctx.config, size=n*n;
    const zeros=()=>({re:new Float64Array(size),im:new Float64Array(size)});
    const inputs=[zeros(),zeros()],masks=[zeros(),zeros()],energies=[zeros(),zeros()];
    for(let y=0;y<n;y++)for(let x=0;x<n;x++) {
      const i=y*n+x,h=A.otf(A.bin(x,n),A.bin(y,n),cutoff);
      if(h<=0 || h<minH)continue;
      for(let b=0;b<2;b++) {
        const z=ctx.separated.bands[b],value=correctOtf({re:z.re[i],im:z.im[i]},{re:h,im:0}).corrected;
        inputs[b].re[i]=value.re;inputs[b].im[i]=value.im;masks[b].re[i]=1;
        energies[b].re[i]=value.re**2+value.im**2;
      }
    }
    const main=correlationMap(...inputs,n);
    const maskSpatial=masks.map(z=>A.spatial(z,n)),energySpatial=energies.map(z=>A.spatial(z,n));
    const xx=correlateSpatial(energySpatial[0],maskSpatial[1],n).correlation;
    const yy=correlateSpatial(maskSpatial[0],energySpatial[1],n).correlation;
    const counts=correlateSpatial(...maskSpatial,n).correlation;
    const score=new Float64Array(size);
    function at(kx,ky) {
      const i=A.idx(kx,ky,n),count=Math.max(0,Math.round(counts.re[i]));
      const ex=Math.max(0,xx.re[i]),ey=Math.max(0,yy.re[i]);
      const cross={re:main.correlation.re[i],im:main.correlation.im[i]};
      const valid=count>=minPoints && ex>1e-14 && ey>1e-14;
      const value=valid?Math.min(1,Math.hypot(cross.re,cross.im)/Math.sqrt(ex*ey)):0;
      return {kx,ky,valid,count,xx:ex,yy:ey,cross,score:value,
        alpha:valid?{re:cross.re/ex,im:cross.im/ex}:{re:0,im:0}};
    }
    for(let y=0;y<n;y++)for(let x=0;x<n;x++)score[y*n+x]=at(A.bin(x,n),A.bin(y,n)).score;
    return {...main,inputs,masks,energies,xx,yy,counts,score,at,n};
  }

  function estimate(group, options = {}) {
    const ctx = context(group, options), { config } = ctx, extent = Math.ceil(config.maxRadius);
    const fft = fixedCorrelation(ctx);
    const coarse = [];
    for (let ky = -extent; ky <= extent; ky++) for (let kx = -extent; kx <= extent; kx++) {
      const radius = Math.hypot(kx, ky);
      if (radius < config.minRadius || radius > config.maxRadius) coarse.push({ kx, ky, score: 0, valid: false, count: 0 });
      else coarse.push(fft.at(kx, ky));
    }
    let best = coarse.reduce((a, b) => b.valid && (!a || b.score > a.score) ? b : a, null);
    if (!best || best.score < .55) return { ok: false, reason: '有效公共区不足，或没有可靠的相关峰。', context: ctx, coarse, extent };
    const coarseBest = best, rounds = [];
    // Odd grids retain their center: exact integer data need not drift off-grid.
    // Finite search precision is 0.01 bins; it is not a confidence interval.
    for (const step of [.25, .05, .01]) {
      const center = { kx: best.kx, ky: best.ky }, candidates = [];
      for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) {
        const kx = center.kx + x * step, ky = center.ky + y * step;
        const radius = Math.hypot(kx, ky);
        candidates.push(radius < config.minRadius || radius > config.maxRadius
          ? { kx, ky, score: 0, valid: false, count: 0 } : compare(ctx, kx, ky));
      }
      best = candidates.reduce((a, b) => b.valid && b.score > a.score + 1e-14 ? b : a, best);
      rounds.push({ step, center, candidates, best });
    }
    const fit = compare(ctx, best.kx, best.ky, true), m = Math.hypot(fit.alpha.re, fit.alpha.im), phase = Math.atan2(fit.alpha.im, fit.alpha.re);
    if (!Number.isFinite(m) || m < .05 || m > 1.1 || fit.score < .8) return { ok: false, reason: '调制度或公共区匹配未通过本示例的有效性检查。', context: ctx, coarse, coarseBest, rounds, extent, fit };
    const phases = config.nominalPhases.map(p => p + phase);
    return { ok: true, context: ctx, coarse, coarseBest, rounds, extent, fit, fft,
      kx: best.kx, ky: best.ky, m, phase, phases, angle: Math.atan2(best.ky, best.kx) * 180 / Math.PI,
      period: config.n / Math.hypot(best.kx, best.ky), precision: .01 };
  }

  function reconstruct(group, estimateResult) {
    if (!estimateResult.ok) throw new Error('需要有效的参数估计结果才能正式解混。');
    const { context: ctx, phases, m, angle, period } = estimateResult, { n, cutoff } = ctx.config;
    const raw = { n, groups: [{ index: group.index, frames: group.frames.map((f, j) => ({ index: f.index, phase: phases[j], pixels: f.pixels })) }] };
    const calibration = { n, kc: cutoff / n, electrons: 1, background: 0, readNoise: 0, shotNoise: false,
      groups: [{ index: group.index, angle, period, mean: 1 }] };
    const pipeline = A.pipeline(raw, calibration, {}, m);
    if (!pipeline.ok) throw new Error('估计参数接入重建失败：' + pipeline.reason);
    const reconstructed = pipeline.groups[0], weights = reconstructed.weights;
    // Remix using adopted parameters: this checks the algebraic interface, NOT
    // independent parameter accuracy. Ground truth is checked separately.
    let error = 0, energy = 0;
    reconstructed.rawSpectra.forEach((observed, j) => {
      for (let i = 0; i < n * n; i++) {
        let re = 0, im = 0;
        [0, 1, -1].forEach((order, b) => {
          const a = order === 0 ? 1 : reconstructed.m / 2, c = a * Math.cos(order * phases[j]), s = a * Math.sin(order * phases[j]), z = reconstructed.separated[b];
          re += c * z.re[i] - s * z.im[i]; im += c * z.im[i] + s * z.re[i];
        });
        error += (re - observed.re[i]) ** 2 + (im - observed.im[i]) ** 2; energy += observed.re[i] ** 2 + observed.im[i] ** 2;
      }
    });
    return { pipeline, weights, adoptedM: reconstructed.m, modulationFallback: reconstructed.fallback, closure: Math.sqrt(error / Math.max(energy, 1e-30)) };
  }

  // Dataset entry point for a host chapter. Read only documented acquisition
  // configuration and observed pixels; illumination truth is never inspected.
  function estimateDataset(raw, options = {}) {
    const config = {};
    for (const key of Object.keys(defaults)) config[key] = options[key] === undefined ? defaults[key] : options[key];
    config.n = options.n === undefined ? raw.n : options.n;
    config.nominalPhases = [...config.nominalPhases];
    const result = { ok: false, raw, config, estimates: [], reason: null };
    if (!Number.isInteger(raw.n) || raw.n < 1 || config.n !== raw.n || !Array.isArray(raw.groups) || !raw.groups.length) {
      result.reason = '观测尺寸、估计配置或方向列表无效。'; return result;
    }
    const indices = new Set();
    for (const group of raw.groups) {
      if (!Number.isInteger(group.index) || group.index < 0 || indices.has(group.index)) {
        result.reason = '方向编号必须是唯一的非负整数。'; return result;
      }
      indices.add(group.index);
    }
    result.estimates = raw.groups.map(group => {
      try { return { index: group.index, ...estimate(group, config) }; }
      catch (error) { return { index: group.index, ok: false, reason: error.message }; }
    });
    const failed = result.estimates.find(item => !item.ok);
    result.ok = !failed;
    if (failed) result.reason = '方向 ' + failed.index + '：' + failed.reason;
    return result;
  }

  function reconstructDataset(raw, datasetResult) {
    if (!datasetResult?.ok || datasetResult.raw !== raw) throw new Error('需要同一份观测的有效全方向参数估计结果。');
    const { config, estimates } = datasetResult, { n, cutoff } = config;
    if (raw.n !== n || !Array.isArray(estimates) || estimates.length !== raw.groups.length) throw new Error('全方向估计与观测不匹配。');
    const byIndex = new Map(estimates.map(item => [item.index, item]));
    if (byIndex.size !== estimates.length) throw new Error('全方向估计的方向编号重复。');
    const parameters = raw.groups.map(group => {
      const item = byIndex.get(group.index);
      if (!item?.ok || ![item.kx, item.ky, item.phase, item.m, item.angle, item.period].every(Number.isFinite)
        || item.period <= 0 || !Array.isArray(item.phases) || item.phases.length !== group.frames.length || !item.phases.every(Number.isFinite)) {
        throw new Error('方向 ' + group.index + ' 缺少有效的完整估计参数。');
      }
      // Keep the teaching equations and the adopted reconstruction consistent:
      // reject values that the fixed fairSIM core would replace with 0.65.
      if (item.m < .4 || item.m > 1.1) throw new Error('方向 ' + group.index + ' 的估计调制度会触发重建核心回退。');
      return { index: group.index, kx: item.kx, ky: item.ky, phase: item.phase, m: item.m,
        phases: [...item.phases], angle: item.angle, period: item.period };
    });
    const adopted = new Map(parameters.map(item => [item.index, item]));
    const reconstructionRaw = { n, groups: raw.groups.map(group => ({ index: group.index,
      frames: group.frames.map((frame, j) => ({ index: frame.index, phase: adopted.get(group.index).phases[j], pixels: frame.pixels })) })) };
    const calibration = { n, kc: cutoff / n, electrons: 1, background: 0, readNoise: 0, shotNoise: false,
      groups: parameters.map(item => ({ index: item.index, angle: item.angle, period: item.period, mean: 1 })) };
    const modulations = Object.fromEntries(parameters.map(item => [item.index, item.m]));
    const pipeline = A.pipeline(reconstructionRaw, calibration, {}, modulations);
    if (!pipeline.ok) throw new Error('全方向估计参数接入重建失败：' + pipeline.reason);
    if (pipeline.groups.some(group => group.fallback)) throw new Error('全方向重建的调制度触发了核心回退。');
    return { pipeline, parameters, estimates, raw: reconstructionRaw, config, modulationFallback: false };
  }
  const api = { defaults, capture, separate, correctOtf, context, compare, correlationMap, fixedCorrelation, estimate, reconstruct, estimateDataset, reconstructDataset, wrapPhase };
  if (node) module.exports = api; else root.SIMParameterEstimation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
