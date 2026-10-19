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
  const Coefficient = node ? require('./scenes/get-peak/mainline-state.js') : root.SIMCoefficientMainline;
  const TextTransition = node ? require('../shared/animation/text-transition.js') : root.SIMTextTransition;
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
  const navigationScenes = [...units, ...Coefficient.stops];
  const navigationScene = id => navigationScenes.find(s=>s.id===id);
  const navigationState = (id,p) => { const stop=navigationScene(id); if(!stop)throw new Error('未知参数场景：'+id); return stateForScene(stop.sceneId || id, stop.coefficientBeat ? Coefficient.stopProgress(stop,p) : p); };
  const formulas = Object.assign({}, ...units.map(s=>s.formulas), GetPeak.formulas, {"coefficient": "$$U_j=S(\\mathbf q_j),\\qquad V_j=m e^{i\\phi_\\Delta}U_j$$", "fit": "$$J(\\alpha)=E_0\\left|\\alpha-\\frac C{E_0}\\right|^2+E_1-\\frac{|C|^2}{E_0}$$"});
  const index = id => scenes.findIndex(s => s.id === id);
  const scene = id => { const s = scenes[index(id)]; if (!s) throw new Error('未知参数场景：' + id); return s; };
  function stateForScene(id, progress = 1) {
    if (!Number.isFinite(progress)) throw new Error('场景进度必须是有限数值。');
    if(id==='coefficient')return {id,step:7,progress:clamp(progress),position:7+clamp(progress),phase:'coefficient'};
    const s = scene(id), p = clamp(progress), step = index(id);
    return { id, step, progress: p, position: step + p, phase: s.phase,
      otfMultiply: id === 'otf' ? otfState(p).multiply : step > index('otf') ? 1 : 0,
      correction: id === 'otf' ? otfState(p).cancel : step > index('otf') ? 1 : 0,
      rotation: 0, scaling: 0 };
  }
  const presentationContext = () => ({M,formulas,lineState,otfState,refinementPhaseState});
  function formulaAt(s) {
    if(s.id==='coefficient')return Coefficient.presentation(s.progress);
    if(s.id===GetPeak.scene.legacyId){const state=GetPeak.presentation(s.progress);return {equation:state.formula.equation,note:state.note,title:state.title,copy:state.copy};}
    return scene(s.id).present(s.progress,presentationContext());
  }
  const dataFor = (node ? require('./comparison-data.js') : root.SIMComparisonData)({M,E,A});
  const { sharedState, sharedPointState, sharedFocusPose } = (node ? require('./scenes/shared/state.js') : root.SIMParameterStateFactories['shared'])({ M, E, A, dataFor });
  const { lineState } = (node ? require('./scenes/line-shift/state.js') : root.SIMParameterStateFactories['line-shift'])({ M, E, A, dataFor });
  const { returnTo2DState } = (node ? require('./scenes/shift/state.js') : root.SIMParameterStateFactories['shift'])({ M, E, A, dataFor });
  const { otfState, rejectionProgress } = (node ? require('./scenes/otf/state.js') : root.SIMParameterStateFactories['otf'])({ M, E, A, dataFor });
  function formulaMode(s) {
    if(s.id==='coefficient')return 'coefficient-'+Coefficient.presentation(s.progress).mode;
    if(s.id===GetPeak.scene.legacyId){const f=GetPeak.presentation(s.progress).formula;return s.id+'-'+(f.motion?f.motion.key:f.mode);}
    const data=scenes.find(x=>x.id===s.id);
    return data ? data.formulaMode(s.progress,presentationContext()) : s.id;
  }
  function formulaTransition(s,reduced=false) {
    if(s.id==='coefficient')return {...TextTransition.state(1,560),previous:null};
    const unit=scenes.find(unit=>unit.id===s.id);
    if(!unit)return {...TextTransition.state(1,560),previous:null};
    if(s.id===GetPeak.scene.legacyId) {
      const p=GetPeak.presentation(s.progress),boundary=p.boundary;
      const previous=boundary>0?stateForScene(s.id,boundary-1e-7):stateForScene('refine',1);
      return {...TextTransition.state(s.progress,GetPeak.timeline.duration,boundary,reduced),previous};
    }
    const cuts=unit.formulaCuts||(unit.beats||[]).map(beat=>beat.start);
    // Match storyboard rounding when the host recovers local progress by
    // subtracting a scene index (for example, .18 may become .17999999999999).
    const progress=Math.round(s.progress*1e12)/1e12;
    const boundary=[0,...cuts].filter(cut=>cut<=progress).at(-1);
    const previous=boundary>0?stateForScene(s.id,boundary-1e-7)
      :index(s.id)>0?stateForScene(scenes[index(s.id)-1].id,1):null;
    return {...TextTransition.state(progress,unit.duration,boundary,reduced),previous};
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

  const api = { scenes, navigationScenes, navigationScene, navigationState, scene, index, formulas, bandColors, stateForScene, formulaAt, formulaMode, formulaTransition, sharedState, sharedPointState, sharedFocusPose, lineState, returnTo2DState, otfState, rejectionProgress, dataFor, matchingState, scanState, fftState, refinementNarrative, refinementPhaseState, refinementState, refinementDataFor, getPeakBeats, getPeakDataFor, leastSquaresNarrative, leastSquaresState,coefficient:Coefficient };
  if (node) module.exports = api; else root.SIMParameterLesson = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
