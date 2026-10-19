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
  const sceneIds = Object.freeze(Study.navigationScenes.map(scene => scene.id));
  const convention = Object.freeze({ orders: Object.freeze([0, 1, -1]), estimationOrder: 1,
    frequencyUnit: 'DFT bins', yAxis: 'down', forwardFFTExponent: -1,
    positiveBandFactor: 'm exp(+i phase)', negativeBandFactor: 'm exp(-i phase)' });
  // Equal, known relative phase steps leave one common offset to estimate.
  // Source: fairSIM (2016), Supplementary Note 1, Parameter estimation.
  // https://doi.org/10.1038/ncomms10980 — SI pp. 10–11. The explicit
  // 1/2 and 2/3 below use this demo's cosine / temporary-band convention.
  const { provisionalState, provisionalSteps, provisionalFormulaAt, provisionalFormulas, provisionalDuration, unknownWeightFactorTex, residualBandTex, createNominalFailure, nominalFailureState, nominalFailureStart, nominalFailureDuration, parameterColors, actualIlluminationTex, weightFactorColors, actualWeightCells, actualWeightState, temporaryNotationState, temporaryIndexTex, observationExpansionState, observationTex, sampleVectorTex, temporaryResponseTex } = (node ? require('./scenes/provisional-split/storyboard.js') : root.SIMProvisionalStory)({ Story, A, notation, convention });
  const { sharedEntryDuration, sharedDuration, sharedEntryState, sharedEntryFormulaAt, temporaryBands } = (node ? require('../parameter-demo/scenes/shared/entry.js') : root.SIMSharedEntry)({ Story, Study, notation });
  const adopted = (node ? require('./scenes/adopted-weights/storyboard.js') : root.SIMAdoptedStory)(Story);
  const { adoptedState } = adopted;
  const adoptedScenes=adopted.scenes;
  const bridges = [
    { ...provisionalFormulaAt({ progress: 1 }), id: 'provisional-split', label: '检查预设值', duration: provisionalDuration },
    ...adopted.scenes,
  ];

  function plan(motionModel) {
    const { scenes, parameterSlot: slot } = motionModel;
    const after = scenes.findIndex(scene => scene.id === slot.after);
    if (after < 0 || scenes[after + 1]?.id !== slot.before) throw new Error('Motion 参数章节的前后锚点不匹配。');
    const inserted = sceneIds.map(id => ({ ...Study.navigationScene(id), ...(id === 'shared' ? { duration: sharedDuration } : {}), id: 'parameters.' + id,
      owner: 'parameters', sceneId: id, chapter: '05 / 参数估计 · ' + (Study.navigationScene(id).phase === 'position' ? '① 找位置' : '② 求幅相'), formulaDomain: '频域 · 参数估计',
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
    const stops = [...existing.slice(0, after + 1), bridgeStops[0], ...inserted, ...bridgeStops.slice(1), ...continuation];
    const extra = inserted.length + bridgeStops.length, end = after + extra;
    const index = id => stops.findIndex(stop => stop.id === id);
    const legacyToFlow = new Map(stops.filter(s => s.owner === 'motion').map((s, i) => [s.legacyPosition, index(s.id)]));
    const baseTime = time => time <= after ? time : time <= end ? after : time <= end + 1
      ? 10.28 + .72 * motionModel.clamp((scenes.find(s=>s.id==='separate-bands').applicationProgress(time-end)-.42)/.58) : time - extra + 1;
    const sceneIndex = time => time <= after ? motionModel.sceneIndex(time) : time <= end ? Math.ceil(time - 1e-9)
      : time < end + 1 ? end + 1
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
        return Study.navigationState(sceneId, sceneId === 'shared' ? sharedEntryState(progress).lessonProgress : progress);
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
    temporaryNotationState, temporaryIndexTex, observationExpansionState, observationTex, sampleVectorTex, temporaryResponseTex, adoptedState, adoptedScenes, plan, create };
  if (node) module.exports = api; else root.SIMMotionParameterChapter = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
