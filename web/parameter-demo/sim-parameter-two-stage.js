/* Production lesson: correspondence, one-dimensional arithmetic, search and fit.
 * Uses an observation-only estimator and the fairSIM 2016 SI band model;
 * own-OTF correction is expanded as conjugate multiplication and normalization.
 * The normalized score and 5×5 search remain project choices. */
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const M = node ? require('./sim-parameter-model.js') : root.SIMParameterStory;
  const E = node ? require('../shared/sim-parameter-estimation.js') : root.SIMParameterEstimation;
  const A = node ? require('../atlas/sim-atlas-core.js') : root.SIMAtlas;
  const GetPeak = node ? require('./scenes/get-peak/state.js') : root.SIMGetPeak;
  const { clamp, ramp } = M;
  const bandColors = Object.freeze(['#7ad5cd', '#b7a5eb', '#efb879']);
  const units = node ? [
    require('./scenes/shared/storyboard.js'),
    require('./scenes/line-shift/storyboard.js'),
    require('./scenes/shift/storyboard.js'),
    require('./scenes/otf/storyboard.js'),
    require('./scenes/match/storyboard.js'),
    require('./scenes/coarse/storyboard.js'),
    require('./scenes/refine/storyboard.js'),
  ] : ["shared", "line-shift", "shift", "otf", "match", "coarse", "refine"].map(id=>root.SIMParameterUnits[id]);
  const scenes = [...units, { ...GetPeak.scene, id: GetPeak.scene.legacyId }];
  const formulas = Object.assign({}, ...units.map(s=>s.formulas), GetPeak.formulas, {"coefficient": "$$U_j=S(\\mathbf q_j),\\qquad V_j=m e^{i\\phi_\\Delta}U_j$$", "fit": "$$J(\\alpha)=E_0\\left|\\alpha-\\frac C{E_0}\\right|^2+E_1-\\frac{|C|^2}{E_0}$$"});
  const index = id => scenes.findIndex(s => s.id === id);
  const scene = id => { const s = scenes[index(id)]; if (!s) throw new Error('未知参数场景：' + id); return s; };
  function stateForScene(id, progress = 1) {
    if (!Number.isFinite(progress)) throw new Error('场景进度必须是有限数值。');
    const s = scene(id), p = clamp(progress), step = index(id);
    return { id, step, progress: p, position: step + p, phase: s.phase,
      otfMultiply: id === 'otf' ? otfState(p).multiply : step > index('otf') ? 1 : 0,
      correction: id === 'otf' ? otfState(p).cancel : step > index('otf') ? 1 : 0,
      rotation: 0, scaling: 0 };
  }
  const presentationContext = () => ({M,formulas,lineState,otfState,refinementPhaseState});
  function formulaAt(s) {
    if(s.id===GetPeak.scene.legacyId){const state=GetPeak.presentation(s.progress);return {equation:state.formula.equation,note:state.note};}
    return scene(s.id).present(s.progress,presentationContext());
  }
  const dataFor = (node ? require('./comparison-data.js') : root.SIMComparisonData)({M,E,A});
  const { sharedState, sharedPointState } = (node ? require('./scenes/shared/state.js') : root.SIMParameterStateFactories['shared'])({ M, E, A, dataFor });
  const { lineState } = (node ? require('./scenes/line-shift/state.js') : root.SIMParameterStateFactories['line-shift'])({ M, E, A, dataFor });
  const { returnTo2DState } = (node ? require('./scenes/shift/state.js') : root.SIMParameterStateFactories['shift'])({ M, E, A, dataFor });
  const { otfState, rejectionProgress } = (node ? require('./scenes/otf/state.js') : root.SIMParameterStateFactories['otf'])({ M, E, A, dataFor });
  function formulaMode(s) {
    if(s.id===GetPeak.scene.legacyId)return s.id+'-'+GetPeak.presentation(s.progress).formula.mode;
    const data=scenes.find(x=>x.id===s.id);
    return data ? data.formulaMode(s.progress,presentationContext()) : s.id;
  }
  const { matchingState, scanState } = (node ? require('./scenes/match/state.js') : root.SIMParameterStateFactories['match'])({ M, E, A, dataFor });
  const { fftState } = (node ? require('./scenes/coarse/state.js') : root.SIMParameterStateFactories['coarse'])({ M, E, A, dataFor });
  const { refinementNarrative, refinementPhaseState, refinementState, refinementDataFor } = (node ? require('./scenes/refine/state.js') : root.SIMParameterStateFactories['refine'])({ M, E, A, dataFor });
  // Names retain the old scene API for the 33/13-stop host timelines.
  // Every value below comes from finalPeak, independently of the search pairs.
  // Compatibility boundary for the existing two hosts. The scene itself has
  // one canonical name and owns all beat/formula/presentation state.
  const getPeakBeats = GetPeak.timeline.beats.map(b => Object.freeze([b.key, b.start, b.end, b.action, b.title, b.copy, b.note, b.footer]));
  const getPeakDataFor = GetPeak.dataFor, leastSquaresNarrative = GetPeak.narrative, leastSquaresState = GetPeak.state;

  const api = { scenes, scene, index, formulas, bandColors, stateForScene, formulaAt, formulaMode, sharedState, sharedPointState, lineState, returnTo2DState, otfState, rejectionProgress, dataFor, matchingState, scanState, fftState, refinementNarrative, refinementPhaseState, refinementState, refinementDataFor, getPeakBeats, getPeakDataFor, leastSquaresNarrative, leastSquaresState };
  if (node) module.exports = api; else root.SIMParameterLesson = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
