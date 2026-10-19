/* Scene-owned beats: narration, equations and operation cues share one timeline. */
(function(root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const Clock = node ? require('../../../shared/animation/beat-clock.js') : root.SIMBeatClock;
  const definitions = [
  {
    "key": "normalEquation",
    "action": "共轭权重的来源",
    "duration": 8000,
    "title": "同一个重叠频率，为何在两条频带中强弱不同？",
    "copy": "先暂存原来的高频点，改看重叠点 q=(6,0)。方向 1 的零级与 −1 级记录同一个 S，但 H 约为 0.2848 与 0.7471，传递强弱相差约 2.6 倍。",
    "equation": "$$(\\sum_b|H_b|^2+w^2)\\widehat S=\\sum_b H_b^*C_b$$",
    "note": "原高频 q=(14,0) 用来验证信息找回；重叠点解释多带融合。等权二次正则化拟合产生 H* 与 |H|²；完整推导见原理与数值，未声称无条件统计最优。"
  },
  {
    "key": "conjugateWeight",
    "action": "一条频带乘 H*",
    "duration": 8000,
    "title": "已有 H，再乘自身 H*，形成一条加权贡献。",
    "copy": "先处理方向 1 的零级。左图是 C₁,₀，中图是对应 H*，右图逐复数频点形成 |H|²S；接下来保留这份结果直接累加。",
    "equation": "$$B_{d,\\ell}={\\color{#7ad5cd}H_{d,\\ell}^*}C_{d,\\ell}=|H_{d,\\ell}|^2S$$",
    "note": "本拍只完成一条贡献，不除 H。完整融合权重还包含后续分母，且不同于三帧解混的逆矩阵权重 u。",
    "cues": {
      "weight": [
        0.12,
        0.82
      ]
    }
  },
  {
    "key": "weightReady",
    "action": "保留加权结果",
    "duration": 4000,
    "title": "一条贡献算好，再收集全部九条。",
    "copy": "保留右侧的零级加权结果。下一幕直接把它加入累计频谱，再处理其余八条频带；标记始终留在重叠点。",
    "equation": "$$B_{d,\\ell}=H_{d,\\ell}^*C_{d,\\ell},\\qquad F_{\\rm sum}=\\sum_{d,\\ell}B_{d,\\ell}$$",
    "note": "所有贡献使用同一频率坐标 q；先计算复数，再取模长显示。"
  }
];
  const timeline = Clock.define(definitions);
  const {key, action, cues, ...opening} = definitions[0];
  const scene = { ...{
  "label": "OTF 加权",
  "stageIndex": 16,
  "id": "otf-weight",
  "theoryTopic": "weights",
  "encodingFormula": false,
  "demixFormula": false,
  "detectionFormula": false,
  "acquisitionFormula": false,
  "domainPair": null,
  "formulaDomain": "频域 · 覆盖与融合",
  "chapterIndex": 6,
  "chapter": "07 / Wiener 融合"
}, ...opening,
    timeline, beats: timeline.beats, duration: timeline.duration,
    present(progress, clock = timeline) {
      const state = clock.at(progress);
      return { ...state.definition, mode: state.mode, beat: state.beat, beatCount: clock.beats.length,
        local: state.local, cues: state.cues, progress: state.progress };
    }
  };
  if (node) module.exports = scene;
  else (root.SIMMotionUnits ||= {})[scene.id] = scene;
})(typeof globalThis !== 'undefined' ? globalThis : this);
