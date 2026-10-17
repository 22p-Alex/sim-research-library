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
    "title": "为什么乘 H*？先看同一频率的正规方程。",
    "copy": "把各条归位频带写成 Cᵦ≈HᵦS。等权二次正则化拟合的正规方程，在右侧产生 Hᵦ*Cᵦ，左侧产生 |Hᵦ|²；因此两者一起出现。",
    "equation": "$$(\\sum_b|H_b|^2+w^2)\\widehat S=\\sum_b H_b^*C_b$$",
    "note": "这是说明共轭乘数来源的基础模型，未声称解混后的噪声独立、等方差或该实现无条件统计最优。第 29 幕再说明固定源码的额外零级计数。"
  },
  {
    "key": "conjugateWeight",
    "action": "一条频带乘 H*",
    "duration": 8000,
    "title": "已有 H，再乘自身 H*，形成一条加权贡献。",
    "copy": "左图是归位频带 C₁,₋₁，中图是对应 H*。右图逐复数频点执行乘法，理想成像关系下留下 |H|²S。",
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
    "copy": "右图保留同一条实际加权频带。三个方向、每方向三个级次，下一幕把九条贡献分别计算后相加。",
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
