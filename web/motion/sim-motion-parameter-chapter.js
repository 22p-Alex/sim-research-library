/* Integrated Motion chapter: shared observations in, estimated parameters and
 * a complete reconstruction out. No DOM, event listeners or playback clock.
 * The standalone preview and the Motion host use the same lesson. */
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const Story = node ? require('../parameter-demo/sim-parameter-model.js') : root.SIMParameterStory;
  const Estimator = node ? require('../shared/sim-parameter-estimation.js') : root.SIMParameterEstimation;
  const Study = node ? require('../parameter-demo/sim-parameter-two-stage.js') : root.SIMParameterLesson;
  const A = node ? require('../atlas/sim-atlas-core.js') : root.SIMAtlas;
  const notation = (node ? require('../shared/sim-band-formulas.js') : root.SIMBandFormulas).notation;
  // Acquisition, provisional separation, formal demixing, relocation and the
  // final audit belong to Motion. Only the estimation explanations are added.
  const sceneIds = Object.freeze(Study.scenes.map(scene => scene.id));
  const convention = Object.freeze({ orders: Object.freeze([0, 1, -1]), estimationOrder: 1,
    frequencyUnit: 'DFT bins', yAxis: 'down', forwardFFTExponent: -1,
    positiveBandFactor: 'm exp(+i phase)', negativeBandFactor: 'm exp(-i phase)' });
  // Equal, known relative phase steps leave one common offset to estimate.
  // Source: fairSIM (2016), Supplementary Note 1, Parameter estimation.
  // https://doi.org/10.1038/ncomms10980 — SI pp. 10–11. The explicit
  // 1/2 and 2/3 below use this demo's cosine / temporary-band convention.
  const parameterColors = Object.freeze({ k: '#7ad5cd', m: '#efb879', phase: '#b7a5eb' });
  const colored = (key, tex) => '{\\color{' + parameterColors[key] + '}' + tex + '}';
  const actualIlluminationTex = String.raw`I_j(\mathbf r)=1+` + colored('m', 'm')
    + String.raw`\cos\!\left(\frac{2\pi}{N}` + colored('k', String.raw`\mathbf k`)
    + String.raw`\cdot\mathbf r+` + colored('phase', String.raw`\phi_j`) + String.raw`\right)`;
  const unknownWeightFactorTex = String.raw`\frac1{m}e^{\mp i\phi_\Delta}`;
  const residualBandTex = String.raw`\widetilde A_{\pm1}(\mathbf f)=m e^{\pm i\phi_\Delta}A_{\pm1}(\mathbf f)`;
  // Explicit holds between hide/show/restore beats keep explanations separate
  // from the coefficients they replace. One reversible clock drives all actors.
  const provisionalDuration = 132000;
  const nominalFailureStart = 32.5, nominalFailureDuration = 22;
  // Controlled counterfactual, generated from the adopted bands of these frames.
  // No new acquisition, hidden sample or fitted display effect. All three
  // images reconstruct the SAME synthetic observations through A.pipeline.
  // The pi phase is chosen for exact opposition, not claimed as a measured value.
  // Artifact context: Fan et al. 2019, doi:10.1007/s41048-019-0081-7, Fig. 2.
  function createNominalFailure(lesson) {
    const n = lesson.capture.raw.n, g = lesson.group, cutoff = lesson.pipeline.cutoff;
    const phase = Math.PI, delta = .3, k = [g.kx, g.ky], nominal = [g.kx + delta, g.ky];
    const base = g.separated, phases = [0, 2 * Math.PI / 3, 4 * Math.PI / 3];
    const frames = phases.map((p, j) => {
      const z = { re: new Float64Array(n * n), im: new Float64Array(n * n) };
      for (let b = 0; b < 3; b++) {
        const angle = [0, 1, -1][b] * (p + phase), scale = b === 0 ? 1 : .5;
        const re = scale * Math.cos(angle), im = scale * Math.sin(angle);
        for (let i = 0; i < z.re.length; i++) {
          z.re[i] += re * base[b].re[i] - im * base[b].im[i];
          z.im[i] += re * base[b].im[i] + im * base[b].re[i];
        }
      }
      return { index: j, pixels: A.spatial(z, n).re };
    });
    function reconstruct(vector, adoptedPhase) {
      const raw = { n, groups: [{ index: g.index, frames: frames.map((frame, j) => ({ ...frame, phase: phases[j] + adoptedPhase })) }] };
      const cal = { n, kc: cutoff / n, electrons: 1, background: 0, readNoise: 0, shotNoise: false,
        groups: [{ index: g.index, angle: Math.atan2(vector[1], vector[0]) * 180 / Math.PI, period: n / Math.hypot(...vector), mean: 1 }] };
      const result = A.pipeline(raw, cal, {}, 1);
      if (!result.ok) throw new Error('标称参数对照重建失败：' + result.reason);
      return result;
    }
    const reference = reconstruct(k, phase), vector = reconstruct(nominal, phase), uncorrected = reconstruct(nominal, 0);
    const shifted = [A.shift(base[1], ...k, n), A.shift(base[1], ...nominal, n)];
    const fields = [base[0], ...shifted].map(z => ({ re: new Float64Array(z.re.length), im: new Float64Array(z.im.length) }));
    const probes = [];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const i = y * n + x, qx = A.bin(x, n), qy = A.bin(y, n);
      const hs = [A.otf(qx, qy, cutoff), A.otf(qx + k[0], qy + k[1], cutoff), A.otf(qx + nominal[0], qy + nominal[1], cutoff)];
      [base[0], ...shifted].forEach((z, b) => {
        if (hs[b] >= .12) { fields[b].re[i] = z.re[i] / hs[b]; fields[b].im[i] = z.im[i] / hs[b]; }
      });
      if (hs.every(h => h >= .12) && qx * qx + qy * qy > 1) {
        probes.push({ qx, qy, index: i, energy: Math.hypot(fields[0].re[i], fields[0].im[i]), angle: Math.atan2(fields[0].im[i], fields[0].re[i]) });
      }
    }
    probes.sort((a, b) => b.energy - a.energy);
    const selected = [];
    for (const point of probes) {
      if (selected.every(p => Math.hypot(p.qx - point.qx, p.qy - point.qy) >= 1.5)) selected.push(point);
      if (selected.length === 3) break;
    }
    const images = [reference.outputPixels, vector.outputPixels, uncorrected.outputPixels];
    let maximum = 0, minimum = 0, minIndex = 0;
    images.forEach(image => image.forEach(v => { maximum = Math.max(maximum, v); minimum = Math.min(minimum, v); }));
    uncorrected.outputPixels.forEach((v, i) => { if (v < uncorrected.outputPixels[minIndex]) minIndex = i; });
    const rms = image => Math.sqrt(image.reduce((sum, v, i) => sum + (v - reference.outputPixels[i]) ** 2, 0) / image.length);
    const residual = Float64Array.from(images[2], (v, i) => v - images[0][i]), size = 2 * n;
    let residualMaximum = 0, residualProfileY = 0, profileEnergy = 0;
    for (let y = 0; y < size; y++) {
      let energy = 0;
      for (let x = 0; x < size; x++) {
        const v = residual[y * size + x]; energy += v * v; residualMaximum = Math.max(residualMaximum, Math.abs(v));
      }
      if (energy > profileEnergy) { profileEnergy = energy; residualProfileY = y; }
    }
    // Pick the strongest signed error row, then measure its actual DFT peak.
    // Neither stripes nor negative pixels are painted into the reconstruction.
    let residualPeakBin = 0, residualPeakAmplitude = 0;
    for (let f = 1; f < size / 2; f++) {
      let re = 0, im = 0;
      for (let x = 0; x < size; x++) {
        const v = residual[residualProfileY * size + x], t = 2 * Math.PI * f * x / size;
        re += v * Math.cos(t); im += v * Math.sin(t);
      }
      const amplitude = Math.hypot(re, im);
      if (amplitude > residualPeakAmplitude) { residualPeakAmplitude = amplitude; residualPeakBin = f; }
    }
    return { n, size, k, nominal, delta, phase, m: 1, frames, reference, vector, uncorrected, fields,
      probes: selected, images, maximum, minimum, profileY: Math.floor(minIndex / size),
      residual, residualMaximum, residualProfileY, residualPeakBin, residualPeakAmplitude,
      errors: { vector: rms(vector.outputPixels), phase: rms(uncorrected.outputPixels) } };
  }
  function nominalFailureState(progress) {
    const p = Story.clamp(progress), t = p * nominalFailureDuration, r = Story.ramp;
    return { progress: p, mode: t < 3 ? 'nominalPlug' : t < 10 ? 'vectorFailure' : t < 17 ? 'phaseFailure' : 'nominalResidual',
      diagram: r(t, 2.4, 3.2), relocate: r(t, 3, 4.2), misregister: r(t, 4.6, 6.2),
      vectorView: r(t, 2.4, 3.2) * (1 - r(t, 9.4, 10)),
      phaseView: r(t, 10, 10.5) * (1 - r(t, 16.5, 17)), phase: r(t, 10.6, 12.6), cancellation: r(t, 12.6, 13),
      negative: r(t, 13, 13.6), residualView: r(t, 17, 17.6) };
  }
  const weightFactorColors = Object.freeze({ known: '#7ad5cd', unknown: '#efb879' });
  const actualWeightCells = Object.freeze(convention.orders.flatMap((order, row) => [0, 1, 2].map(column => Object.freeze({
    row, column, x: 625 + 180 * column, y: 260 + 80 * row, selected: row === 1 && column === 1,
    tex: 'u_{' + (order > 0 ? '+' + order : order) + ',' + column + '}',
  }))));
  function actualWeightState(seconds) {
    const t = seconds, r = Story.ramp, lift = r(t, 57, 59), dock = r(t, 75.5, 77.5);
    return { matrix: (1 - r(t, 59, 59.6) + r(t, 75.4, 76)) * (1 - r(t, 82, 82.6)),
      lift, dock, collapse: r(t, 74, 74.8), rowMove: r(t, 82.6, 84.8),
      highlight: r(t, 56, 56.5) * (1 - r(t, 57.2, 57.8)) + r(t, 77.5, 77.8) * (1 - r(t, 78, 78.4)),
      selectedPose: { x: 805 - 505 * lift * (1 - dock), y: 340 - 55 * lift * (1 - dock), scale: 1 + .35 * lift * (1 - dock) },
      indexed: 1 - r(t, 59.6, 59.85) + r(t, 75.05, 75.3),
      generic: r(t, 59.95, 60.2) * (1 - r(t, 74.7, 74.95)), rhs: r(t, 60.6, 61.2) * (1 - r(t, 74.2, 74.8)),
      rawPhase: 1 - r(t, 63, 63.35), expandedPhase: r(t, 64, 64.5), phaseSpread: r(t, 63.55, 64.8),
      rawAmplitude: 1 - r(t, 67, 67.3), splitAmplitudes: r(t, 67.5, 68),
      parentheses: 1 - r(t, 67, 67.3), factorMove: r(t, 67.5, 70),
      unknownExponential: r(t, 67.5, 68), multiply: r(t, 70, 70.5),
      labels: r(t, 70.5, 71) * (1 - r(t, 74, 74.4)),
      matrixName: 1 - r(t, 78, 78.4), vectors: r(t, 78.5, 79.3),
      rowFocus: r(t, 80, 80.6) * (1 - r(t, 82, 82.6)),
      rowTerms: r(t, 82, 82.6), rowOperators: r(t, 84.8, 85.3),
      rowNote: r(t, 80, 80.6) * (1 - r(t, 86, 86.5)) };
  }
  // Keep the completed +1 row until the local substitutions have finished.
  // Restore all three rows before collecting them into vector/matrix notation.
  function temporaryNotationState(seconds) {
    const r = Story.ramp, t = seconds;
    return { active: t >= 99.5, intro: r(t, 99.5, 100.2),
      returnRow: r(t, 100.5, 102.5), otherRows: r(t, 102.5, 103.2),
      scaffold: r(t, 102.3, 103) * (1 - r(t, 104.5, 105)),
      gather: r(t, 105, 107.5), arrive: r(t, 106.6, 107.5),
      center: r(t, 104.5, 105), definition: r(t, 108, 108.8) };
  }
  function observationExpansionState(seconds) {
    const r = Story.ramp, t = seconds;
    return { intro: r(t, 110, 110.6), widen: r(t, 110.6, 112.2),
      substitute: r(t, 112.2, 113.6), commute: r(t, 116, 118),
      response: r(t, 118.5, 120), distribute: r(t, 122, 124.5), dock: r(t, 125, 127) };
  }
  const sampleVectorTex = String.raw`\begin{bmatrix}S(\mathbf f)\\S(\mathbf f-\mathbf k)\\S(\mathbf f+\mathbf k)\end{bmatrix}`;
  const temporaryResponseTex = String.raw`\begin{bmatrix}1&0&0\\0&m e^{i\phi_\Delta}&0\\0&0&m e^{-i\phi_\Delta}\end{bmatrix}`;
  // Same noise-free observation law as SIMBandFormulas.observation/source:
  // D = H M [S(f), S(f-k), S(f+k)]^T. H(f) is a scalar shared by the frames.
  // Relative three-phase orthogonality gives U_tilde M = diag(1,m e^iφ,m e^-iφ).
  const observationTex = String.raw`\mathbf D(\mathbf f)=H(\mathbf f)M` + sampleVectorTex;
  const temporaryIndexTex = String.raw`\bigl[\widetilde U\bigr]_{\ell j}=\widetilde u_{\ell,j},\quad\ell\in\{0,+1,-1\}`;
  const provisionalFormulas = Object.freeze({
    knownWeights: String.raw`$$u_{0,j}=\frac13$$`,
    unknownWeights: String.raw`$$u_{\pm1,j}=\frac{2}{3m}e^{\mp i\phi_j}$$`,
    gather: String.raw`$$\mathbf A(\mathbf f)=U\cdot\mathbf D(\mathbf f)$$`,
    whyEstimate: '$$' + actualIlluminationTex + '$$',
    nominalPlug: String.raw`$$\mathbf k_{\mathrm{nom}},\qquad m_{\mathrm{nom}}=1,\qquad\phi_{j,\mathrm{nom}}=\frac{2\pi j}{3}$$`,
    vectorFailure: String.raw`$$\Delta\mathbf k=\mathbf k_{\mathrm{nom}}-\mathbf k=(0.3,0),\qquad S(\mathbf q+\Delta\mathbf k)\ne S(\mathbf q)$$`,
    phaseTurn: String.raw`$$z+e^{i\delta\phi}z$$`,
    phaseFailure: String.raw`$$\delta\phi=\pi:\qquad z+e^{i\delta\phi}z=0$$`,
    nominalResidual: String.raw`$$e_{\mathrm{nom}}=s_{\mathrm{nom}}-s_{\mathrm{matched}},\qquad\min s_{\mathrm{nom}}<0$$`,
    actualWeights: String.raw`$$U=M^{-1}$$`,
    extractWeight: String.raw`$$u_{\pm1,j}$$`,
    showWeight: String.raw`$$u_{\pm1,j}=\frac{2}{3m}e^{\mp i\phi_j}$$`,
    expandWeight: String.raw`$$u_{\pm1,j}=\frac{2}{3m}e^{\mp i(\phi'_j+\phi_\Delta)}$$`,
    splitWeight: String.raw`$$u_{\pm1,j}=\underbrace{{\color{#efb879}\frac1m e^{\mp i\phi_\Delta}}}_{\text{未知、三帧共用}}\ \underbrace{{\color{#7ad5cd}\frac23e^{\mp i\phi'_j}}}_{\text{已知、随帧变化}}$$`,
    rowProduct: String.raw`$$A_{+1}(\mathbf f)=u_{+1,0}D_0(\mathbf f)+u_{+1,1}D_1(\mathbf f)+u_{+1,2}D_2(\mathbf f)$$`,
    nameKnown: String.raw`$$\widetilde u_{\pm1,j}:={\color{#7ad5cd}\frac23e^{\mp i\phi'_j}},\qquad u_{\pm1,j}=\left({\color{#efb879}\frac1m e^{\mp i\phi_\Delta}}\right)\widetilde u_{\pm1,j}$$`,
    coefficientScale: String.raw`$$\widetilde u_{\pm1,j}=\left({\color{#efb879}m e^{\pm i\phi_\Delta}}\right)u_{\pm1,j}$$`,
    outputScale: '$$' + residualBandTex + String.raw`,\qquad\widetilde A_0=A_0$$`,
    temporaryRow: String.raw`$$\widetilde A_{+1}(\mathbf f)=\widetilde u_{+1,0}D_0(\mathbf f)+\widetilde u_{+1,1}D_1(\mathbf f)+\widetilde u_{+1,2}D_2(\mathbf f)$$`,
    matrixNotation: String.raw`$$\widetilde A_{\ell}(\mathbf f)=\sum_{j=0}^{2}\widetilde u_{\ell,j}D_j(\mathbf f),\qquad\ell\in\{0,+1,-1\}$$`,
    vectorNotation: String.raw`$$\widetilde{\mathbf A}(\mathbf f)=\widetilde U\cdot\mathbf D(\mathbf f)$$`,
    observationModel: String.raw`$$D_j(\mathbf f)=H(\mathbf f)\!\left[S(\mathbf f)+\frac m2e^{i\phi_j}S(\mathbf f-\mathbf k)+\frac m2e^{-i\phi_j}S(\mathbf f+\mathbf k)\right]$$`,
    substituteObservation: String.raw`$$\widetilde{\mathbf A}(\mathbf f)=H(\mathbf f)\bigl(\widetilde U M\bigr)` + sampleVectorTex + '$$',
    temporaryResponse: String.raw`$$\widetilde U M=` + temporaryResponseTex + '$$',
    expandBands: String.raw`$$\widetilde A_0=HS(\mathbf f),\quad\widetilde A_{+1}=m e^{i\phi_\Delta}HS(\mathbf f-\mathbf k),\quad\widetilde A_{-1}=m e^{-i\phi_\Delta}HS(\mathbf f+\mathbf k)$$`,
    ready: String.raw`$$\widetilde{\mathbf A}(\mathbf f)=\widetilde U\cdot\mathbf D(\mathbf f),\qquad` + temporaryIndexTex + '$$',
  });
  const provisionalSteps = Object.freeze([
    [0, 'knownHighlight', 'knownWeights'], [3.1, 'knownMessage', 'knownWeights'], [5.9, 'knownRestore', 'knownWeights'],
    [7.8, 'sideHighlight', 'unknownWeights'], [11.1, 'sideMessage', 'unknownWeights'], [14.4, 'sideRestore', 'unknownWeights'],
    [16, 'gather'], [19.5, 'whyEstimate'], [20.3, 'wavevectorReason', 'whyEstimate'], [25.3, 'amplitudePhaseReason', 'whyEstimate'],
    [32.5, 'nominalPlug'], [35.5, 'vectorFailure'], [42.5, 'phaseFailure'], [49.5, 'nominalResidual'],
    [54.5, 'actualWeights'], [57, 'extractWeight'], [60.6, 'showWeight'], [63, 'expandWeight'],
    [67, 'splitWeight'], [74, 'returnWeight', 'splitWeight'], [78, 'matrixApply', 'gather'],
    [82, 'rowProduct'], [86, 'nameKnown'], [90, 'coefficientScale'],
    [94, 'outputScale'], [99.5, 'matrixNotation'], [104.5, 'vectorNotation'],
    [110, 'observationModel'], [116, 'substituteObservation'], [118.5, 'temporaryResponse'], [122, 'expandBands'], [127, 'ready'],
  ].map(([seconds, mode, formulaKey = mode]) => Object.freeze({ start: seconds * 1000 / provisionalDuration, mode, formulaKey })));
  function provisionalState(progress) {
    const p = Story.clamp(progress), t = p * provisionalDuration / 1000, r = Story.ramp;
    const window = (start, end) => r(t, start, start + .5) * (1 - r(t, end, end + .5));
    const step = provisionalSteps.filter(item => p >= item.start).at(-1);
    const knownCoefficients = 1 - r(t, 2.2, 2.9) + r(t, 6.1, 6.8);
    const sideCoefficients = 1 - r(t, 10.2, 10.9) + r(t, 14.6, 15.3);
    const knownMessage = r(t, 3.1, 3.7) * (1 - r(t, 5.3, 5.9));
    const sideMessage = r(t, 11.1, 11.7) * (1 - r(t, 13.8, 14.4));
    const hop = start => t <= start || t >= start + .8 ? 0 : Math.sin(Math.PI * (t - start) / .8);
    const failure = nominalFailureState((t - nominalFailureStart) / nominalFailureDuration);
    const actual = actualWeightState(t), notation = temporaryNotationState(t), observation = observationExpansionState(t);
    const centered = notation.center * (1 - observation.dock);
    const operationPose = { x: 720 - 40 * centered, y: 85 + 200 * centered, scale: .72 + .4 * centered };
    let formulaKey = step.mode === 'phaseFailure' && failure.phase < 1 ? 'phaseTurn' : step.formulaKey;
    if (step.mode === 'showWeight' && actual.rhs < 1) formulaKey = 'extractWeight';
    if (step.mode === 'expandWeight' && actual.phaseSpread < 1) formulaKey = 'showWeight';
    if (step.mode === 'splitWeight' && actual.labels < 1) formulaKey = 'expandWeight';
    if (step.mode === 'matrixApply' && actual.vectors < 1) formulaKey = 'splitWeight';
    if (step.mode === 'rowProduct' && actual.rowOperators < 1) formulaKey = 'gather';
    if (step.mode === 'nameKnown' && t < 86.8) formulaKey = 'rowProduct';
    if (step.mode === 'coefficientScale' && t < 91.3) formulaKey = 'nameKnown';
    if (step.mode === 'outputScale' && t < 94.8) formulaKey = 'coefficientScale';
    if (step.mode === 'matrixNotation' && notation.otherRows < 1) formulaKey = notation.intro < 1 ? 'outputScale' : 'temporaryRow';
    if (step.mode === 'vectorNotation') formulaKey = notation.arrive < 1 ? 'matrixNotation' : notation.definition < 1 ? 'vectorNotation' : 'ready';
    return { progress: p, seconds: t, mode: step.mode, formulaKey, failure, actual, notation, observation, operationPose,
      focus: t < 7.8 ? 'known-row' : t < 16 ? 'side-rows' : '',
      matrix: 1 - r(t, 16, 16.25), context: 1 - r(t, 15.4, 16),
      gather: r(t, 16.25, 18.6), transfer: r(t, 16, 16.25) * (1 - r(t, 18, 18.6)),
      rows: [
        { coefficients: knownCoefficients, message: knownMessage, highlight: r(t, .6, 1.3) * (1 - r(t, 7, 7.6)) },
        { coefficients: sideCoefficients, message: sideMessage, highlight: r(t, 8.1, 8.8) * (1 - r(t, 15.3, 15.9)) },
        { coefficients: sideCoefficients, message: sideMessage, highlight: r(t, 8.1, 8.8) * (1 - r(t, 15.3, 15.9)) },
      ],
      operation: r(t, 17.6, 18.3) * (1 - r(t, 32, 32.5) + r(t, 78.5, 79.3)) * (1 - notation.intro + notation.arrive),
      whyEstimate: window(19.5, 32), kHop: hop(20.3), amplitudeHop: hop(25.3),
      kReason: r(t, 21.3, 21.9) * (1 - r(t, 24.1, 24.7)),
      amplitudeReason: r(t, 26.3, 26.9) * (1 - r(t, 30.2, 30.8)),
      nominalFailure: r(t, 32.5, 33) * (1 - r(t, 54, 54.5)),
      actualWeights: r(t, 54.5, 55) * (1 - notation.arrive), phaseFactor: actual.factorMove,
      coefficientFocus: window(86, 99.5), nameKnown: r(t, 86, 86.8),
      selectedCoefficient: r(t, 88, 88.8), coefficientScale: r(t, 90.5, 91.3),
      outputScale: r(t, 94, 94.8), temporaryOperation: r(t, 94, 94.8),
      ready: r(t, 127, 127.7) };
  }

  function provisionalFormulaAt(state) {
    const s = provisionalState(state.progress);
    const content = {
      knownHighlight: ['先看第一行的三个系数。', '把第一行完整框起来：三个权重都是 1/3。', '先读这一行，再看它是否含待确定的参数。'],
      knownMessage: ['第一行：已知常数，直接可算。', '系数暂时退去，在同一行说明：这里只需对三帧取平均。', '本行没有未知的相位和调制度。'],
      knownRestore: ['恢复系数，再看旁带权重。', '说明文字退去，三个 1/3 回到原位。', '第一行保持原来的位置与数值。'],
      sideHighlight: ['再看第二行和第三行。', '框住两行旁带系数：分母含 m，指数含 φⱼ。', '这两行需要拍摄时的实际调制度与相位。'],
      sideMessage: ['旁带权重：需要知道 φⱼ 和 m。', '两行系数退去，在对应行说明需要确定的量。', '这里只指出缺少什么，参数来源接下来再讲。'],
      sideRestore: ['先恢复系数，再收起矩阵。', '说明文字消失，两行权重回到原位；接下来把它们收成紧凑的分离式。', 'A 是三个来源组成的向量；D 是同一组三帧观测组成的向量。'],
      gather: ['将两列向量与权重，收成一个分离式。', '来源列缩为 A(f)，九个权重收为 U，三帧观测列缩为 D(f)。', '仍然是刚才的 A = U·D；现在看 U 中的参数来自哪里。'],
      whyEstimate: ['照明公式中的参数，能直接用预设值吗？', '先回到样品处实际形成的条纹，依次看波矢、调制度与相位。', '此处先看参数为什么可能偏离预设，暂不介绍估计方法。'],
      wavevectorReason: ['先看波矢 k：方向与间距未必等于预设。', '光束夹角、光路对准和像素标定可能有偏差，实际条纹的方向与间距也会随之偏离设定。', 'k 用于频带归位；硬件标称值不能保证实际位置逐频点对齐。'],
      amplitudePhaseReason: ['再看 m 与 φⱼ：实际反差与位置也会改变。', '两束光强或偏振失配会改变条纹反差；光程漂移会改变条纹位置，因此实际幅相可能偏离控制指令。', '这里讨论三帧共用的幅相偏差；帧间相对相移仍按已知、准确的等间隔值处理。'],
      nominalPlug: ['直接代回硬件标称值，会发生什么？', '先用标称波矢、m=1 与预设相移完成解混、归位和融合，逐项查看结果。', '受控教学对照：由同批频带重混三帧，实际 m=1、共同相位 π，标称波矢偏差 0.3 格；不改动主线观测。'],
      vectorFailure: ['结果一：亚像素错位，频带无法准确对齐。', '只改变归位波矢，先正确处理幅相。即使仅偏 0.3 个 DFT 格，公共区纹理也不再逐点对应，重建出现位置误差与重影。', '放大镜读取同一组复数频谱的局部幅度；右侧两图使用同一强度标尺。'],
      phaseFailure: ['结果二：反相抵消，出现黑边下冲。', '再漏掉共同相位校正。同一频点的复数方向逐渐转向相反，右侧切换到标称值重建，并用剖面保留实际负值。', '左侧相位特写取已对齐、OTF 校正后的同一 q；π 是特意选取的反相例子，一般相位误差不一定完全抵消。'],
      nominalResidual: ['看实际误差：黑边下冲与周期性残余条纹。', '误差图是标称重建减去匹配参数重建；下方读取误差最强的一行，展示残余振荡及其实际主频。', '所有图像与剖面均由数值管线产生；负值与条纹没有额外绘制。此例展示后果，不代表所有参数偏差都会产生相同伪影。'],
      actualWeights: ['那么实际的权重应该是什么呢？', '重新看实际照明参数对应的逆矩阵 U，先从旁带两行中选取一个权重。', 'm 与相位仍待确定；这里先整理权重的符号结构。'],
      extractWeight: ['从 U 中取出旁带权重。', '选中的权重从矩阵中移到左侧并放大；矩阵退去后，把它写成 ±1 级的通式。', 'u±₁,ⱼ 表示正、负旁带在第 j 帧使用的权重。'],
      showWeight: ['右侧写出刚才求得的系数。', '在 u±₁,ⱼ 右侧出现等号与 2/(3m) exp(∓iφⱼ)。', 'm、φⱼ 表示拍摄时的实际调制度与相位，尚未代入数值。'],
      expandWeight: ['把实际相位展开为两部分。', '保持左侧权重不动，将右侧 φⱼ 扩展成 φ′ⱼ+φΔ：已知的相对相移，加上未知的共同起点。', '本例假设 φ′ⱼ=2πj/3 已知且准确，三帧共用 m 与 φΔ，且 m ≠ 0。'],
      splitWeight: ['拆开系数，用颜色区分已知和未知。', '指数拆成两个相位因子，2/(3m) 拆成 1/m 与 2/3；未知因子移到左侧，已知因子移到右侧。', '青色：已知的 2/3 与 φ′ⱼ；橙色：未知的 m 与 φΔ，且三帧共用。'],
      returnWeight: ['把刚才拆开的 u，放回 U 的原位。', '展开式收回权重符号，恢复具体下标 u₊₁,₁；同一个权重缩小，回到矩阵的第二行、第二列。', '拆开的两部分仍共同构成这个 u；回到矩阵并不表示未知参数已经求出。'],
      matrixApply: ['U 的一行，决定 A 的一个级次。', '权重归位后，补回左侧的来源向量 A 与右侧的三帧观测 D；框出 +1 级对应的权重行、观测列和输出。', '行依次对应 0、+1、−1 级，列依次对应第 0、1、2 帧；仍在同一个检测频率 f 上运算。'],
      rowProduct: ['矩阵中的项飞入，组成这一行乘加式。', '把 +1 行的三个 u、对应的三帧 D 和输出 A₊₁ 移到公式中；组好后保留整行，接着只操作其中的权重。', '仍使用矩阵中的同一批符号；每个 u 与同一列的观测 D 配对。'],
      nameKnown: ['就在这条公式上，展开中间的 u。', '框出刚飞入的 u₊₁,₁；把它在原位置写成 ũ₊₁,₁ 除以 m exp(iφΔ)，其余项保持不动。', notation.tilde + notation.weight],
      coefficientScale: ['另外两个 u，也有相同的幅相校正。', '仍在同一条乘加式中展开其余两个权重。三个分母相同；等价地，每个临时权重都等于实际权重乘 m exp(iφΔ)。', '这一步只是把 u 的恒等式代回原处，A 与三个 D 没有变化；m 与 φΔ 仍然未知。'],
      outputScale: ['改用已知的 ũ，输出也随之变为 Ã。', '在原位置改用三个已知临时权重；左侧同步变为临时输出 Ã₊₁。整条公式保持位置，输出保留共同的 m 与相位。', notation.band + '第一行临时权重与实际权重同为 1/3。'],
      matrixNotation: ['把这条临时乘加式，放回三行矩阵。', '刚才的 Ã₊₁、三个 ũ 与三个 D 回到各自的行列位置；补齐 0 级与 −1 级，三行都作用于同一组三帧观测。', 'ℓ 是输出级次，j 是观测帧序号；+1 行只是这三个逐行乘加关系中的一行。'],
      vectorNotation: ['在画面中央，收成临时分离式。', '三份输出、九个权重与三帧观测在中央收成 Ã=ŨD；稍作停留，再从同一个 D 展开它与 H、S 的关系。', '矩阵写法只是将三条乘加式合写；ũℓ,ⱼ 就是 Ũ 中第 ℓ 级、第 j 帧对应的元素。'],
      observationModel: ['从 D 展开：OTF × 条纹照明后的频谱。', '在原式中展开 D：H 作用于同一混合矩阵 M 和三份移频样品频谱。M 仍是前面按实际照明参数写出的矩阵。', '本页 S 是样品频谱；条纹照明使每帧 Dⱼ 混合 S(f)、S(f−k)、S(f+k)，因此这里不能直接写 Dⱼ=HS。'],
      substituteObservation: ['H 对三帧相同，接着计算 ŨM。', '把当前检测频率的 H 提到前面，让临时权重 Ũ 与原混合矩阵 M 相邻；三份样品频谱继续留在原位置。', 'H(f) 在这里是同一个标量，移过 Ũ 不改变矩阵相乘的先后次序。'],
      temporaryResponse: ['级次分开，旁带留下共同幅相。', 'ŨM 化为对角矩阵：零级系数是 1，正、负旁带分别保留 m exp(±iφΔ)。', '已知且准确的三步相对相移消去不同级次之间的混合；未知的共同幅相仍保留在旁带。'],
      expandBands: ['把 H 和各行系数，带到对应频带。', '三个对角系数、H 和三份 S 沿各自的行展开，输出向量同时展开成 0、+1、−1 级；原临时分离式随后缩小移到上方。', '零级得到 Ã₀=H(f)S(f)；两个旁带还包含移频和共同幅相，接下来用公共信息估计它们。'],
      ready: ['带着临时频带，进入公共区比较。', 'Ũ 由已知临时权重 ũ 组成；Ã=ŨD 是它作用于同一组三帧的输出。接下来展开频谱，利用 0 级与 +1 级的公共信息估计参数。', notation.tilde + notation.band],
    }[s.mode];
    return { equation: provisionalFormulas[s.formulaKey], title: content[0], copy: content[1], note: content[2] };
  }
  // Prepend the host-owned split without speeding up the existing public-area
  // lesson. Both views sample this same clock, including reverse playback.
  const sharedEntryDuration = 12000;
  const sharedDuration = sharedEntryDuration + Study.scene('shared').duration;
  const temporaryBands = Object.freeze([
    { order: 0, color: '#7ad5cd', symbol: String.raw`\widetilde A_0(\mathbf f)`, rhs: String.raw`H(\mathbf f)S(\mathbf f)`, x: 720, finalX: 900 },
    { order: 1, color: '#b7a5eb', symbol: String.raw`\widetilde A_{+1}(\mathbf f)`, rhs: String.raw`m e^{i\phi_\Delta}H(\mathbf f)S(\mathbf f-\mathbf k)`, x: 360, finalX: 480 },
    { order: -1, color: '#efb879', symbol: String.raw`\widetilde A_{-1}(\mathbf f)`, rhs: String.raw`m e^{-i\phi_\Delta}H(\mathbf f)S(\mathbf f+\mathbf k)`, x: 1080, finalX: 1080 },
  ].map(Object.freeze));
  function sharedEntryState(progress) {
    const elapsed = Story.clamp(progress) * sharedDuration, p = Story.clamp(elapsed / sharedEntryDuration), r = Story.ramp;
    const split = r(p, .30, .52), settle = r(p, .82, .96), reveal = r(p, .32, .40);
    const negative = 1 - .75 * r(p, .66, .74) - .25 * r(p, .74, .82);
    return { progress: p, lessonProgress: Story.clamp((elapsed - sharedEntryDuration) / Study.scene('shared').duration),
      handoff: r(p, 0, .06), temporary: 1, split, reveal,
      source: 1 - r(p, .30, .40), pictures: r(p, .50, .62), negative, settle,
      labels: 1 - r(p, .94, 1), context: r(p, .94, 1),
      bands: temporaryBands.map(b => ({ order: b.order, x: b.x + (b.finalX - b.x) * settle,
        titleX: 672.48 + (b.x - 672.48) * split + (b.finalX - b.x) * settle,
        titleY: 85 + 164 * split, alpha: reveal * (b.order === -1 ? negative : 1) })) };
  }
  function sharedEntryFormulaAt(progress) {
    const s = sharedEntryState(progress), p = s.progress;
    const title = p < .30 ? '把刚才的粗分离，应用到这组三帧。' : p < .66 ? '从一个向量，展开三个临时级次。'
      : '先保留 0 级与 +1 级，寻找共同信息。';
    const note = p < .30 ? notation.tilde + notation.matrix
      : p < .66 ? '三份临时频带都来自同一组三帧；旁带仍保留未知的 m 与共同相位偏移。'
      : '−1 级只退出当前比较画面；其数据保留，后面的正式重建仍使用三个级次。';
    return { title, copy: p < .66 ? '沿用同一批观测：青色 0 级、紫色 +1 级、橙色 −1 级，图像与下方公式一一对应。'
      : '−1 级图像与公式一起淡出；留下的两份频谱继续用于说明公共区与参数估计。', note,
      equation: '$$' + temporaryBands.map(b => '{\\color{' + b.color + '}' + b.symbol + '=' + b.rhs + '}').join('\\qquad') + '$$' };
  }
  const bridges = [
    { ...provisionalFormulaAt({ progress: 1 }), id: 'provisional-split', label: '检查预设值', duration: provisionalDuration },
    { id: 'adopted-weights', label: '填回参数', title: '参数填回去，正式解混权重就能算出来。',
      copy: '三个方向各自求出参数。将方向 1 的相位和调制度填入 M，得到正式解混用的 U；波矢留给后面的归位。',
      equation: String.raw`$$\begin{gathered}\widehat\phi_j=\phi'_j+\widehat\phi_\Delta,\qquad U=M^{-1}\\M_{j,:}=\begin{bmatrix}1&\frac{\widehat m}{2}e^{i\widehat\phi_j}&\frac{\widehat m}{2}e^{-i\widehat\phi_j}\end{bmatrix}\end{gathered}$$`,
      note: '矩阵与权重都由实际估计值计算；波矢另供频带归位。下文 m、φⱼ、k 指采用的估计值，频带继续记为 A。', duration: 28000 },
  ];

  function adoptedState(progress) {
    const p = Story.clamp(progress), r = Story.ramp;
    return { progress: p, directions: r(p, 0, .10), focus: r(p, .10, .12),
      rows: [0, 1, 2].map(j => r(p, .12 + .12 * j, .24 + .12 * j)),
      inverse: [0, 1, 2].map(j => r(p, .52 + .12 * j, .64 + .12 * j)),
      process: r(p, .48, .52), factor: r(p, .66, .78), application: r(p, .88, .96) };
  }

  function plan(motionModel) {
    const { scenes, parameterSlot: slot } = motionModel;
    const after = scenes.findIndex(scene => scene.id === slot.after);
    if (after < 0 || scenes[after + 1]?.id !== slot.before) throw new Error('Motion 参数章节的前后锚点不匹配。');
    const inserted = sceneIds.map(id => ({ ...Study.scene(id), ...(id === 'shared' ? { duration: sharedDuration } : {}), id: 'parameters.' + id,
      owner: 'parameters', sceneId: id, chapter: '05 / 参数估计 · ' + (Study.scene(id).phase === 'position' ? '① 找位置' : '② 求幅相'), formulaDomain: '频域 · 参数估计',
    }));
    const existing = scenes.map((scene, legacyPosition) => ({ ...scene, owner: 'motion',
      sceneId: scene.id, legacyPosition,
      chapter: legacyPosition < 10 ? scene.chapter : legacyPosition < 12 ? '06 / 正式解混'
        : legacyPosition < 14 ? '07 / 频带归位' : legacyPosition < 17 ? '08 / 多方向覆盖'
        : legacyPosition < 21 ? '09 / Wiener 融合' : '10 / 图像与验证' }));
    const bridgeStops = bridges.map(scene => ({ ...scene, owner: 'bridge', sceneId: scene.id,
      chapter: scene.id === 'provisional-split' ? '05 / 参数与标称值' : '06 / 正式解混',
      formulaDomain: scene.id === 'provisional-split' ? '逆矩阵权重 → 照明参数' : '频域 · ' + scene.label }));
    // The production path proceeds directly from adopted weights to applying
    // them. The base model keeps its proof choreography for isolated algebra
    // checks, while this timeline omits the repeated verification stop.
    const continuation = existing.slice(after + 1).filter(scene => scene.id !== 'verify-demix');
    const stops = [...existing.slice(0, after + 1), bridgeStops[0], ...inserted, bridgeStops[1], ...continuation];
    const extra = inserted.length + bridgeStops.length, end = after + extra;
    const index = id => stops.findIndex(stop => stop.id === id);
    const legacyToFlow = new Map(stops.filter(s => s.owner === 'motion').map((s, i) => [s.legacyPosition, index(s.id)]));
    const baseTime = time => time <= after ? time : time <= end ? after : time <= end + 1
      ? 10.28 + .72 * motionModel.clamp((time - end - .12) / .88) : time - extra + 1;
    const sceneIndex = time => time <= after ? motionModel.sceneIndex(time) : time <= end ? Math.ceil(time - 1e-9)
      : time < end + 1 ? (time - end < .12 - 1e-9 ? end : end + 1)
      : legacyToFlow.get(motionModel.sceneIndex(baseTime(time)));
    function frame(time) {
      time = motionModel.clamp(time, 0, stops.length - 1);
      const target = Math.ceil(time - 1e-9), stop = stops[target], progress = time - target + 1;
      return { ...stop, index: sceneIndex(time), target, progress,
        baseTime: baseTime(time) };
    }
    // One interval ends at each stop, including the first estimation scene.
    const durations = stops.slice(1).map(stop => stop.duration ?? motionModel.transitionDurations[stop.legacyPosition - 1]);
    const pacing = Object.fromEntries(stops.slice(1).flatMap((stop, interval) => {
      const points = motionModel.transitionPacing?.[stop.legacyPosition - 1];
      return points ? [[interval, points]] : [];
    }));
    return { active: true, slot, stops, scenes: stops, durations, pacing, sceneIndex, frame, index };
  }

  function create(options = {}) {
    if (!options.raw || !options.config) throw new Error('嵌入章节需要宿主提供 raw 与 config，不能自行重新采集。');
    const direction = options.direction ?? 0;
    const lesson = Story.createLesson({ raw: options.raw, config: options.config, direction, truth: options.truth });
    let reconstruction = null;
    return {
      lesson, sceneIds, convention,
      state(sceneId, progress) {
        if (!sceneIds.includes(sceneId)) throw new Error('该场景由 Motion 主线负责，不属于新增估计章节。');
        return Study.stateForScene(sceneId, sceneId === 'shared' ? sharedEntryState(progress).lessonProgress : progress);
      },
      result() { return Story.getResult(lesson); },
      reconstructAll() {
        if (!reconstruction) {
          const estimated = Estimator.estimateDataset(options.raw, options.config);
          if (!estimated.ok) throw new Error(estimated.reason);
          reconstruction = Estimator.reconstructDataset(options.raw, estimated);
        }
        return reconstruction;
      },
    };
  }
  const api = { sceneIds, convention, bridges, provisionalState, provisionalSteps, provisionalFormulaAt, provisionalFormulas,
    provisionalDuration, unknownWeightFactorTex, residualBandTex, createNominalFailure, nominalFailureState, nominalFailureStart, nominalFailureDuration,
    sharedEntryDuration, sharedDuration, sharedEntryState, sharedEntryFormulaAt, temporaryBands,
    notation, parameterColors, actualIlluminationTex, weightFactorColors, actualWeightCells, actualWeightState,
    temporaryNotationState, temporaryIndexTex, observationExpansionState, observationTex, sampleVectorTex, temporaryResponseTex, adoptedState, plan, create };
  if (node) module.exports = api; else root.SIMMotionParameterChapter = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
